import pg from "pg";

import type { Config } from "./config.ts";
import type { Telemetry } from "./schema.ts";

export interface IngestResult {
  status: "ok" | "duplicate" | "unknown_device" | "inactive_device" | "rejected_timestamp";
  telemetry_id?: number;
  events?: Array<{ geofence_id: string; geofence_name: string; transition: "enter" | "exit" }>;
}

/** SQLSTATE classes worth retrying: connection, resources, serialization, admin shutdown. */
const TRANSIENT = /^(08|53|40|57P)/;

export class TelemetryStore {
  readonly #pool: pg.Pool;

  constructor(cfg: Config) {
    this.#pool = new pg.Pool({
      connectionString: cfg.DATABASE_URL,
      max: cfg.DATABASE_POOL_SIZE,
      ssl: cfg.databaseCa ? { ca: cfg.databaseCa, rejectUnauthorized: true } : { rejectUnauthorized: true },
      statement_timeout: 5_000,
      application_name: "pet-tracker-ingest",
    });
  }

  /**
   * The role behind DATABASE_URL can do exactly one thing: EXECUTE
   * public.ingest_telemetry. Ownership, geofencing and de-duplication are
   * enforced inside that function.
   */
  async ingest(deviceId: string, t: Telemetry): Promise<IngestResult> {
    const recordedAt = t.ts !== undefined ? new Date(t.ts * 1000).toISOString() : null;

    for (let attempt = 1; ; attempt++) {
      try {
        const res = await this.#pool.query<{ result: IngestResult }>(
          `select public.ingest_telemetry($1, $2::float8, $3::float8, $4::real, $5::smallint, $6::integer, $7::timestamptz) as result`,
          [deviceId, t.lat, t.lng, t.accuracy, t.batt, t.seq ?? null, recordedAt],
        );
        return res.rows[0]!.result;
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        if (attempt >= 3 || !(TRANSIENT.test(code) || code === "")) throw err;
        await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
      }
    }
  }

  async healthy(): Promise<boolean> {
    try {
      await this.#pool.query("select 1");
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }
}
