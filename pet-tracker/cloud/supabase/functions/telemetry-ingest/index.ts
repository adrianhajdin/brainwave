/**
 * Supabase Edge Function: telemetry ingest for the AWS IoT Core route.
 *
 *   tracker --MQTTS--> AWS IoT Core --IoT Rule (HTTPS action)--> this function
 *                                                   --> public.ingest_telemetry()
 *
 * Edge functions are request-scoped, so they cannot hold an MQTT subscription.
 * AWS IoT Core therefore PUSHES each message here via a Topic Rule:
 *
 *   SELECT *, topic(3) AS mqtt_device_id FROM 'pt/v1/+/telemetry'
 *
 * `topic(3)` is the device id from the topic, which the IoT policy binds to the
 * device certificate (${iot:Connection.Thing.ThingName}); the JSON body is never
 * trusted for identity. For a self-hosted broker use ../../../ingest-worker.
 *
 * Deploy:  supabase functions deploy telemetry-ingest --no-verify-jwt
 *          supabase secrets set INGEST_SHARED_SECRET=<32+ random bytes, base64>
 * (JWT verification is off because AWS cannot mint Supabase JWTs; the shared
 *  secret header configured on the IoT Rule authenticates the caller instead.)
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

import { validateTelemetry } from "../_shared/telemetry.ts";

const SECRET = Deno.env.get("INGEST_SHARED_SECRET") ?? "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const encoder = new TextEncoder();

/** Constant-time comparison of the shared secret. */
async function secretMatches(candidate: string | null): Promise<boolean> {
  if (!candidate || SECRET.length < 32) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(SECRET)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  if (!(await secretMatches(req.headers.get("x-pt-ingest-secret")))) {
    return json(401, { error: "unauthorized" });
  }

  const raw = await req.text();
  if (raw.length > 1024) return json(413, { error: "payload too large" });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  // One-time AWS IoT "topic rule destination" handshake: log it for an
  // operator to confirm (aws iot confirm-topic-rule-destination ...).
  if (body.messageType === "DestinationConfirmation") {
    console.log(JSON.stringify({ msg: "AWS IoT destination confirmation", arn: body.arn, confirmationToken: body.confirmationToken }));
    return json(200, { status: "confirmation logged" });
  }

  const { mqtt_device_id: topicDeviceId, ...payload } = body;
  if (typeof topicDeviceId !== "string") {
    return json(400, { error: "missing mqtt_device_id (check the IoT Rule SQL)" });
  }

  const v = validateTelemetry(topicDeviceId, payload);
  if (!v.ok) {
    // 200 on purpose: a malformed message will never become valid; a non-2xx
    // would only make the IoT Rule error action fire repeatedly.
    console.warn(JSON.stringify({ msg: "telemetry rejected", device: topicDeviceId, reason: v.reason }));
    return json(200, { status: "rejected", reason: v.reason });
  }

  const t = v.value;
  const { data, error } = await supabase.rpc("ingest_telemetry", {
    p_device_uid: topicDeviceId,
    p_lat: t.lat,
    p_lng: t.lng,
    p_accuracy_m: t.accuracy,
    p_battery_pct: t.batt,
    p_seq: t.seq ?? null,
    p_recorded_at: t.ts !== undefined ? new Date(t.ts * 1000).toISOString() : null,
  });

  if (error) {
    console.error(JSON.stringify({ msg: "ingest failed", device: topicDeviceId, error: error.message }));
    return json(503, { error: "storage unavailable" }); // IoT Rule error action
  }

  return json(200, { status: data?.status ?? "ok", events: data?.events?.length ?? 0 });
});
