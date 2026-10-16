/**
 * Collar configuration downlink (lost mode, night watch, report interval).
 *
 * public.devices changes fire pg_notify('device_config', {device_uid, config})
 * (see migration …0400). This module LISTENs on a dedicated connection and
 * publishes the config as a RETAINED QoS 1 message on
 * pt/v1/<device_uid>/down/config, so a collar asleep in PSM gets it on its
 * next wake. LISTEN needs a session connection: use the direct database host
 * or the Supavisor *session* pooler (port 5432), not the transaction pooler.
 */
import pg from "pg";
import { z } from "zod";

import { log } from "./log.ts";
import { DEVICE_ID_RE } from "./schema.ts";

export const collarConfigSchema = z
  .object({
    interval_s: z.number().int().gte(60).lte(86_400),
    lost_mode: z.boolean(),
    night_mode: z.boolean(),
    night_start_utc_min: z.number().int().gte(0).lte(1439),
    night_end_utc_min: z.number().int().gte(0).lte(1439),
    night_interval_s: z.number().int().gte(60).lte(3600),
  })
  .strict();

export type CollarConfig = z.infer<typeof collarConfigSchema>;

const notificationSchema = z.object({
  device_uid: z.string().regex(DEVICE_ID_RE),
  config: collarConfigSchema,
});

export interface ConfigDownlink {
  topic: string;
  payload: string;
}

/** Pure: notification payload -> MQTT message (null if invalid). */
export function toDownlink(notificationPayload: string | undefined): ConfigDownlink | null {
  if (!notificationPayload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(notificationPayload);
  } catch {
    return null;
  }
  const v = notificationSchema.safeParse(parsed);
  if (!v.success) return null;
  return {
    topic: `pt/v1/${v.data.device_uid}/down/config`,
    // Field names match firmware/src/cloud.c config_descr.
    payload: JSON.stringify(v.data.config),
  };
}

type Publish = (topic: string, payload: string) => Promise<void>;

export class ConfigSync {
  #client: pg.Client | null = null;
  #stopped = false;
  #retryMs = 1000;
  readonly #connectionString: string;
  readonly #ssl: pg.ClientConfig["ssl"];
  readonly #publish: Publish;

  constructor(connectionString: string, ssl: pg.ClientConfig["ssl"], publish: Publish) {
    this.#connectionString = connectionString;
    this.#ssl = ssl;
    this.#publish = publish;
  }

  start(): void {
    void this.#connect();
  }

  async #connect(): Promise<void> {
    if (this.#stopped) return;
    const client = new pg.Client({ connectionString: this.#connectionString, ssl: this.#ssl, application_name: "pet-tracker-config-sync" });
    client.on("notification", (msg) => {
      const downlink = toDownlink(msg.payload);
      if (!downlink) {
        log.warn("ignoring malformed device_config notification");
        return;
      }
      this.#publish(downlink.topic, downlink.payload)
        .then(() => log.info("collar config published", { topic: downlink.topic }))
        .catch((err: unknown) => log.error("collar config publish failed", { topic: downlink.topic, error: String(err) }));
    });
    client.on("error", (err) => {
      log.error("config listener connection error", { error: String(err) });
      this.#reconnect(client);
    });
    client.on("end", () => this.#reconnect(client));

    try {
      await client.connect();
      await client.query("LISTEN device_config");
      this.#client = client;
      this.#retryMs = 1000;
      log.info("listening for collar config changes");
    } catch (err) {
      log.error("config listener connect failed", { error: String(err) });
      this.#reconnect(client);
    }
  }

  #reconnect(client: pg.Client): void {
    if (this.#stopped || (this.#client !== null && this.#client !== client)) return;
    this.#client = null;
    client.removeAllListeners();
    void client.end().catch(() => undefined);
    const delay = this.#retryMs;
    this.#retryMs = Math.min(this.#retryMs * 2, 60_000);
    setTimeout(() => void this.#connect(), delay);
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    await this.#client?.end().catch(() => undefined);
  }
}
