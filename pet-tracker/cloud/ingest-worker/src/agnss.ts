/**
 * A-GNSS proxy: device -> our broker -> this worker -> nRF Cloud Location
 * Services (cloud-to-cloud) -> our broker -> device.
 *
 * The device never needs nRF Cloud credentials or a second TLS session, the
 * Organization Auth Token stays server-side, and we can rate-limit and cache.
 */
import { splitAgnssTypes, type AgnssRequest } from "./schema.ts";

/** Must match DOWNLINK_MAX_LEN in firmware/src/cloud.c. */
export const DEVICE_DOWNLINK_MAX = 4096;

export interface AgnssClientOptions {
  baseUrl: string; // .../v1/organizations/<org>/projects/<project>/location
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class AgnssClient {
  readonly #opts: Required<AgnssClientOptions>;

  constructor(opts: AgnssClientOptions) {
    this.#opts = { fetchImpl: fetch, timeoutMs: 8_000, ...opts };
  }

  /**
   * Returns one binary blob per part, ephemerides first, in the format
   * consumed by nrf_cloud_agnss_process() on the device.
   */
  async fetchParts(req: AgnssRequest): Promise<Buffer[]> {
    const parts: Buffer[] = [];

    for (const types of splitAgnssTypes(req.types)) {
      const url = new URL(`${this.#opts.baseUrl.replace(/\/$/, "")}/agnss`);
      url.searchParams.set("types", types.join(","));
      if (req.mcc !== 0) {
        url.searchParams.set("mcc", String(req.mcc));
        url.searchParams.set("mnc", String(req.mnc));
        url.searchParams.set("tac", String(req.tac));
        url.searchParams.set("eci", String(req.eci));
      }
      // Query shape mirrors Nordic's reference cloud (asset-tracker-cloud-aws-js).
      // nRF Cloud also offers filtered ephemerides (only satellites visible at
      // the cell) which roughly halve type-2 payloads - see GetAssistanceData.

      const res = await this.#opts.fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.#opts.token}`,
          Accept: "application/octet-stream",
        },
        signal: AbortSignal.timeout(this.#opts.timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`nRF Cloud A-GNSS ${types.join(",")} failed: HTTP ${res.status}`);
      }

      const body = Buffer.from(await res.arrayBuffer());
      if (body.length === 0 || body.length > DEVICE_DOWNLINK_MAX) {
        throw new Error(`A-GNSS part ${types.join(",")} is ${body.length} B (device max ${DEVICE_DOWNLINK_MAX})`);
      }
      parts.push(body);
    }

    return parts;
  }
}

/** Simple in-memory per-device limiter (per replica; good enough as a cost guard). */
export class RateLimiter {
  readonly #last = new Map<string, number>();
  readonly #minIntervalMs: number;
  readonly #now: () => number;

  constructor(minIntervalMs: number, now: () => number = Date.now) {
    this.#minIntervalMs = minIntervalMs;
    this.#now = now;
  }

  allow(key: string): boolean {
    const t = this.#now();
    const prev = this.#last.get(key);
    if (prev !== undefined && t - prev < this.#minIntervalMs) return false;
    this.#last.set(key, t);
    if (this.#last.size > 100_000) this.#last.clear(); // bound memory
    return true;
  }
}
