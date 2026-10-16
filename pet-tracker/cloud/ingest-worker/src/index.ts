/**
 * Pet tracker ingest worker.
 *
 * Why a long-running worker and not a serverless/edge function?
 * An MQTT *subscription* needs a persistent TCP/TLS session; edge functions
 * are request-scoped and are killed after seconds to minutes. Run this on
 * Render / Fly.io / DigitalOcean App Platform / ECS with >= 2 replicas: the
 * MQTT 5 shared subscription load-balances messages across them. If you use
 * AWS IoT Core you can instead push via an IoT Rule to the Supabase Edge
 * Function in ../supabase/functions/telemetry-ingest (same validation).
 *
 * Delivery semantics: QoS 1 end to end. The PUBACK to the broker is sent
 * only after the database commit (customHandleAcks), so a crash before the
 * commit leads to redelivery; duplicates are dropped by the DB unique key.
 */
import { createServer } from "node:http";
import mqtt, { type IPublishPacket } from "mqtt";

import { AgnssClient, RateLimiter } from "./agnss.ts";
import { loadConfig } from "./config.ts";
import { TelemetryStore } from "./db.ts";
import { log, setLogLevel } from "./log.ts";
import { parseTopic, validateAgnssRequest, validateTelemetry } from "./schema.ts";

const cfg = loadConfig();
setLogLevel(cfg.LOG_LEVEL);

const store = new TelemetryStore(cfg);
const agnss =
  cfg.NRF_CLOUD_LOCATION_BASE_URL && cfg.NRF_CLOUD_OAT
    ? new AgnssClient({ baseUrl: cfg.NRF_CLOUD_LOCATION_BASE_URL, token: cfg.NRF_CLOUD_OAT })
    : null;
const agnssLimiter = new RateLimiter(cfg.AGNSS_MIN_INTERVAL_S * 1000);

const counters = { ok: 0, duplicate: 0, rejected: 0, failed: 0, agnss: 0 };

const SUBSCRIPTIONS = [
  `$share/${cfg.MQTT_SHARE_GROUP}/pt/v1/+/telemetry`,
  `$share/${cfg.MQTT_SHARE_GROUP}/pt/v1/+/agnss/req`,
];

const client = mqtt.connect(cfg.MQTT_URL, {
  clientId: cfg.MQTT_CLIENT_ID,
  protocolVersion: 5,
  clean: true,
  keepalive: 60,
  reconnectPeriod: 5_000,
  connectTimeout: 15_000,
  ca: cfg.mqttTls.ca,
  cert: cfg.mqttTls.cert,
  key: cfg.mqttTls.key,
  rejectUnauthorized: true,
  customHandleAcks: (topic: string, message: Buffer, _packet: IPublishPacket, done: (error: Error | number, code?: number) => void) => {
    handle(topic, message)
      .then(() => done(0))
      .catch((err: unknown) => {
        counters.failed++;
        log.error("message handling failed", { topic, error: String(err) });
        done(0x80); // MQTT 5 "unspecified error"; the device retries on its next cycle
      });
  },
});

async function handle(topic: string, payload: Buffer): Promise<void> {
  const parsed = parseTopic(topic);
  if (!parsed) {
    counters.rejected++;
    log.warn("unexpected topic", { topic });
    return;
  }

  if (parsed.kind === "telemetry") {
    const v = validateTelemetry(parsed.deviceId, payload);
    if (!v.ok) {
      counters.rejected++;
      log.warn("telemetry rejected", { device: parsed.deviceId, reason: v.reason });
      return; // ack: a malformed message will never become valid
    }

    const result = await store.ingest(parsed.deviceId, v.value);
    if (result.status === "ok") counters.ok++;
    else if (result.status === "duplicate") counters.duplicate++;
    else counters.rejected++;

    log.info("telemetry", {
      device: parsed.deviceId,
      status: result.status,
      geofence_events: result.events?.length ?? 0,
    });
    // Geofence notifications: rows land in public.geofence_events, which the
    // apps receive via Supabase Realtime; push (APNs/FCM) is fanned out by a
    // Database Webhook on that table - nothing to do here.
    return;
  }

  // A-GNSS request
  if (!agnss) {
    log.warn("A-GNSS requested but nRF Cloud is not configured", { device: parsed.deviceId });
    return;
  }
  const v = validateAgnssRequest(payload);
  if (!v.ok) {
    counters.rejected++;
    log.warn("A-GNSS request rejected", { device: parsed.deviceId, reason: v.reason });
    return;
  }
  if (!agnssLimiter.allow(parsed.deviceId)) {
    log.warn("A-GNSS rate-limited", { device: parsed.deviceId });
    return;
  }

  const parts = await agnss.fetchParts(v.value);
  for (const part of parts) {
    await client.publishAsync(`pt/v1/${parsed.deviceId}/down/agnss`, part, { qos: 0 });
  }
  counters.agnss++;
  log.info("A-GNSS served", { device: parsed.deviceId, parts: parts.length, bytes: parts.reduce((n, p) => n + p.length, 0) });
}

client.on("connect", (connack) => {
  log.info("broker connected", { sessionPresent: connack.sessionPresent });
  client.subscribe(SUBSCRIPTIONS, { qos: 1 }, (err, granted) => {
    if (err) log.error("subscribe failed", { error: String(err) });
    else log.info("subscribed", { granted: granted?.map((g) => `${g.topic}@${g.qos}`) });
  });
});
client.on("reconnect", () => log.warn("broker reconnecting"));
client.on("error", (err) => log.error("broker error", { error: String(err) }));

// Liveness / readiness for the platform's health checks.
const health = createServer(async (req, res) => {
  if (req.url === "/healthz") {
    const ok = client.connected && (await store.healthy());
    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ mqtt: client.connected, counters }));
    return;
  }
  res.writeHead(404).end();
});
health.listen(cfg.HEALTH_PORT);

async function shutdown(signal: string): Promise<void> {
  log.info("shutting down", { signal });
  health.close();
  await client.endAsync(); // waits for in-flight acks
  await store.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
