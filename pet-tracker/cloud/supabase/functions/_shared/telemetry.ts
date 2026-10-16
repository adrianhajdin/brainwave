/**
 * Telemetry contract for Deno edge functions.
 * KEEP IN SYNC with cloud/ingest-worker/src/schema.ts (same rules, same tests).
 */
import { z } from "npm:zod@3.23.8";

export const DEVICE_ID_RE = /^pt-[0-9]{15}$/;

export const telemetrySchema = z
  .object({
    device_id: z.string().regex(DEVICE_ID_RE),
    lat: z.number().finite().gte(-90).lte(90),
    lng: z.number().finite().gte(-180).lte(180),
    batt: z.number().int().gte(0).lte(100),
    accuracy: z.number().finite().gte(0).lte(100_000),
    ts: z.number().int().gte(1_600_000_000).lte(4_102_444_800).optional(),
    seq: z.number().int().gte(0).lte(0xffff_ffff).optional(),
  })
  .strict()
  .refine((t) => !(t.lat === 0 && t.lng === 0), { message: "null-island fix rejected" });

export type Telemetry = z.infer<typeof telemetrySchema>;

export function validateTelemetry(
  deviceId: string,
  payload: unknown,
): { ok: true; value: Telemetry } | { ok: false; reason: string } {
  if (!DEVICE_ID_RE.test(deviceId)) return { ok: false, reason: "invalid topic device id" };

  const parsed = telemetrySchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  if (parsed.data.device_id !== deviceId) {
    return { ok: false, reason: "device_id does not match authenticated topic identity" };
  }
  return { ok: true, value: parsed.data };
}
