/**
 * Message contracts between tracker firmware and backend.
 * Pure functions only, so they are unit-testable without a broker or DB.
 */
import { z } from "zod";

export const DEVICE_ID_RE = /^pt-[0-9]{15}$/;

/** Hard cap before JSON.parse: telemetry is ~150 B, A-GNSS requests ~90 B. */
export const MAX_UPLINK_BYTES = 512;

const TOPIC_RE = /^pt\/v1\/(pt-[0-9]{15})\/(telemetry|agnss\/req)$/;

export type UplinkKind = "telemetry" | "agnss";

export interface ParsedTopic {
  deviceId: string;
  kind: UplinkKind;
}

/**
 * The device id is taken from the topic, which the broker policy binds to the
 * TLS client certificate (AWS IoT: ${iot:Connection.Thing.ThingName}). The
 * body is never trusted for identity.
 */
export function parseTopic(topic: string): ParsedTopic | null {
  const m = TOPIC_RE.exec(topic);
  if (!m) return null;
  return {
    deviceId: m[1]!,
    kind: m[2] === "telemetry" ? "telemetry" : "agnss",
  };
}

export const telemetrySchema = z
  .object({
    device_id: z.string().regex(DEVICE_ID_RE),
    lat: z.number().finite().gte(-90).lte(90),
    lng: z.number().finite().gte(-180).lte(180),
    batt: z.number().int().gte(0).lte(100),
    accuracy: z.number().finite().gte(0).lte(100_000),
    /** GNSS UTC time, Unix seconds. Optional for older firmware. */
    ts: z.number().int().gte(1_600_000_000).lte(4_102_444_800).optional(),
    seq: z.number().int().gte(0).lte(0xffff_ffff).optional(),
  })
  .strict()
  .refine((t) => !(t.lat === 0 && t.lng === 0), {
    message: "null-island fix rejected",
  });

export type Telemetry = z.infer<typeof telemetrySchema>;

/** nRF Cloud A-GNSS type ids: 1 UTC, 2 ephemerides, 3 almanac, 4 Klobuchar,
 *  5 NeQuick, 6 GPS TOW, 7 GPS system clock, 8 location, 9 integrity. */
export const agnssRequestSchema = z
  .object({
    types: z.array(z.number().int().gte(1).lte(9)).min(1).max(9),
    /** 0 = unknown (modem could not read the serving cell). */
    mcc: z.number().int().refine((v) => v === 0 || (v >= 200 && v <= 799), "invalid MCC"),
    mnc: z.number().int().gte(0).lte(999),
    tac: z.number().int().gte(0).lte(0xffffff),
    eci: z.number().int().gte(0).lte(0xfffffff),
  })
  .strict();

export type AgnssRequest = z.infer<typeof agnssRequestSchema>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function parseJson(payload: Buffer): ValidationResult<unknown> {
  if (payload.length === 0 || payload.length > MAX_UPLINK_BYTES) {
    return { ok: false, reason: `payload size ${payload.length} out of bounds` };
  }
  try {
    return { ok: true, value: JSON.parse(payload.toString("utf8")) };
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
}

export function validateTelemetry(
  deviceId: string,
  payload: Buffer,
): ValidationResult<Telemetry> {
  const json = parseJson(payload);
  if (!json.ok) return json;

  const parsed = telemetrySchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  if (parsed.data.device_id !== deviceId) {
    return { ok: false, reason: "device_id does not match authenticated topic identity" };
  }
  return { ok: true, value: parsed.data };
}

export function validateAgnssRequest(payload: Buffer): ValidationResult<AgnssRequest> {
  const json = parseJson(payload);
  if (!json.ok) return json;

  const parsed = agnssRequestSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, value: { ...parsed.data, types: [...new Set(parsed.data.types)].sort((a, b) => a - b) } };
}

/**
 * Nordic's reference backend splits ephemerides into their own download:
 * together with the other types they exceed what fits in one device buffer.
 * The firmware expects exactly this split (ephemerides first).
 */
export function splitAgnssTypes(types: readonly number[]): number[][] {
  const ephe = types.filter((t) => t === 2);
  const rest = types.filter((t) => t !== 2);
  return [ephe, rest].filter((part) => part.length > 0);
}
