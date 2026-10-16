import { readFileSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  /** mqtts://<broker>:8883 (AWS IoT ATS endpoint, HiveMQ, EMQX, ...) */
  MQTT_URL: z.string().url().refine((u) => u.startsWith("mqtts://"), "MQTT_URL must use mqtts://"),
  MQTT_CLIENT_ID: z.string().min(1).default(`pt-ingest-${process.pid}`),
  /** Shared-subscription group: run N replicas for HA / horizontal scale. */
  MQTT_SHARE_GROUP: z.string().regex(/^[A-Za-z0-9_-]+$/).default("ingest"),
  MQTT_CA_FILE: z.string().min(1),
  MQTT_CERT_FILE: z.string().min(1),
  MQTT_KEY_FILE: z.string().min(1),

  /** Postgres URL for the least-privilege `telemetry_ingest` role (Supavisor). */
  DATABASE_URL: z.string().url(),
  /** Supabase server CA (Dashboard > Database > SSL). Enables full verification. */
  DATABASE_CA_FILE: z.string().optional(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),

  /** e.g. https://api.nrfcloud.com/v1/organizations/<org>/projects/<project>/location */
  NRF_CLOUD_LOCATION_BASE_URL: z.string().url().optional(),
  /** nRF Cloud Organization Auth Token scoped to Location Services. */
  NRF_CLOUD_OAT: z.string().min(1).optional(),
  /** Per-device A-GNSS rate limit (protects quota, cost, and the 1NCE data budget). */
  AGNSS_MIN_INTERVAL_S: z.coerce.number().int().min(0).default(600),

  HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof envSchema> & {
  mqttTls: { ca: Buffer; cert: Buffer; key: Buffer };
  databaseCa: Buffer | undefined;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Invalid configuration:\n  ${issues}`);
  }
  const cfg = parsed.data;
  return {
    ...cfg,
    mqttTls: {
      ca: readFileSync(cfg.MQTT_CA_FILE),
      cert: readFileSync(cfg.MQTT_CERT_FILE),
      key: readFileSync(cfg.MQTT_KEY_FILE),
    },
    databaseCa: cfg.DATABASE_CA_FILE ? readFileSync(cfg.DATABASE_CA_FILE) : undefined,
  };
}
