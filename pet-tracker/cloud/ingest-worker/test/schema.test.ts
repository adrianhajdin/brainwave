import assert from "node:assert/strict";
import { test } from "node:test";

import { AgnssClient, RateLimiter } from "../src/agnss.ts";
import { parseTopic, splitAgnssTypes, validateAgnssRequest, validateTelemetry } from "../src/schema.ts";

const ID = "pt-351234567890123";
const good = { device_id: ID, lat: 52.379012, lng: 4.899512, batt: 87, accuracy: 6.2, ts: 1_760_620_000, seq: 42 };
const buf = (o: unknown) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o));

test("topics: identity comes from the topic", () => {
  assert.deepEqual(parseTopic(`pt/v1/${ID}/telemetry`), { deviceId: ID, kind: "telemetry" });
  assert.deepEqual(parseTopic(`pt/v1/${ID}/agnss/req`), { deviceId: ID, kind: "agnss" });
  assert.equal(parseTopic(`pt/v1/${ID}/down/config`), null);
  assert.equal(parseTopic("pt/v1/pt-1/telemetry"), null);
  assert.equal(parseTopic(`pt/v1/${ID}/telemetry/extra`), null);
});

test("telemetry: the firmware payload is accepted", () => {
  // Exactly what firmware/src/cloud.c emits.
  const raw = `{"device_id":"${ID}","lat":52.379012,"lng":4.899512,"batt":87,"accuracy":6.2,"ts":1760620000,"seq":42}`;
  const v = validateTelemetry(ID, buf(raw));
  assert.ok(v.ok, v.ok ? "" : v.reason);
});

test("telemetry: minimal payload from the brief is accepted", () => {
  const { ts: _ts, seq: _seq, ...minimal } = good;
  assert.ok(validateTelemetry(ID, buf(minimal)).ok);
});

test("telemetry: rejects spoofed identity, bad ranges, junk", () => {
  const cases: Array<[string, unknown]> = [
    ["other device's id", { ...good, device_id: "pt-999999999999999" }],
    ["lat > 90", { ...good, lat: 91 }],
    ["lng < -180", { ...good, lng: -181 }],
    ["battery 101", { ...good, batt: 101 }],
    ["fractional battery", { ...good, batt: 50.5 }],
    ["negative accuracy", { ...good, accuracy: -1 }],
    ["null island", { ...good, lat: 0, lng: 0 }],
    ["unknown field", { ...good, admin: true }],
    ["string lat", { ...good, lat: "52.3" }],
    ["ts in ms", { ...good, ts: 1_760_620_000_000 }],
  ];
  for (const [label, payload] of cases) {
    assert.equal(validateTelemetry(ID, buf(payload)).ok, false, label);
  }
  assert.equal(validateTelemetry(ID, buf("{not json")).ok, false, "invalid JSON");
  assert.equal(validateTelemetry(ID, Buffer.alloc(0)).ok, false, "empty");
  assert.equal(validateTelemetry(ID, Buffer.alloc(4096, 0x20)).ok, false, "oversized");
});

test("A-GNSS: firmware request validates, types de-duplicated and sorted", () => {
  const v = validateAgnssRequest(buf(`{"types":[9,1,2,2,6,7],"mcc":204,"mnc":8,"tac":3021,"eci":21651463}`));
  assert.ok(v.ok);
  assert.deepEqual(v.ok && v.value.types, [1, 2, 6, 7, 9]);
  assert.ok(validateAgnssRequest(buf(`{"types":[2],"mcc":0,"mnc":0,"tac":0,"eci":0}`)).ok, "unknown cell");
  assert.equal(validateAgnssRequest(buf(`{"types":[10],"mcc":204,"mnc":8,"tac":1,"eci":1}`)).ok, false);
  assert.equal(validateAgnssRequest(buf(`{"types":[2],"mcc":100,"mnc":8,"tac":1,"eci":1}`)).ok, false);
});

test("A-GNSS: ephemerides travel alone, first", () => {
  assert.deepEqual(splitAgnssTypes([1, 2, 6, 7, 9]), [[2], [1, 6, 7, 9]]);
  assert.deepEqual(splitAgnssTypes([2]), [[2]]);
  assert.deepEqual(splitAgnssTypes([1, 9]), [[1, 9]]);
});

test("A-GNSS client: query shape, auth, part order, size guard", async () => {
  const calls: URL[] = [];
  const fake: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url);
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer oat");
    const size = url.searchParams.get("types") === "2" ? 2000 : 300;
    return new Response(new Uint8Array(size), { status: 200 });
  };
  const c = new AgnssClient({ baseUrl: "https://api.nrfcloud.com/v1/organizations/o/projects/p/location/", token: "oat", fetchImpl: fake });
  const parts = await c.fetchParts({ types: [1, 2, 9], mcc: 204, mnc: 8, tac: 3021, eci: 21651463 });

  assert.deepEqual(parts.map((p) => p.length), [2000, 300]);
  assert.equal(calls[0]!.pathname, "/v1/organizations/o/projects/p/location/agnss");
  assert.equal(calls[0]!.searchParams.get("types"), "2");
  assert.equal(calls[1]!.searchParams.get("types"), "1,9");
  assert.equal(calls[1]!.searchParams.get("mcc"), "204");

  const tooBig: typeof fetch = async () => new Response(new Uint8Array(5000), { status: 200 });
  await assert.rejects(new AgnssClient({ baseUrl: "https://x/location", token: "t", fetchImpl: tooBig }).fetchParts({ types: [2], mcc: 0, mnc: 0, tac: 0, eci: 0 }));
});

test("rate limiter", () => {
  let now = 0;
  const rl = new RateLimiter(600_000, () => now);
  assert.equal(rl.allow(ID), true);
  assert.equal(rl.allow(ID), false);
  now += 600_000;
  assert.equal(rl.allow(ID), true);
});
