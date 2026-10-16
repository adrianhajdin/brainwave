#!/usr/bin/env node
// Publishes one tracker message exactly like firmware/src/cloud.c does
// (MQTT 3.1.1, mutual TLS, QoS 1, persistent session).
//
//   node scripts/simulate-device.mjs --url mqtts://localhost:8883 \
//     --ca ca.crt --cert device.crt --key device.key \
//     --id pt-351234567890123 [--topic-id <other id>] [--payload '<json>']
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import mqtt from "mqtt";

const { values: a } = parseArgs({
  options: {
    url: { type: "string" },
    ca: { type: "string" },
    cert: { type: "string" },
    key: { type: "string" },
    id: { type: "string" },
    "topic-id": { type: "string" },
    payload: { type: "string" },
    lat: { type: "string", default: "52.379012" },
    lng: { type: "string", default: "4.899512" },
    ts: { type: "string" },
  },
});

const topicId = a["topic-id"] ?? a.id;
const payload =
  a.payload ??
  JSON.stringify({
    device_id: a.id,
    lat: Number(a.lat),
    lng: Number(a.lng),
    batt: 87,
    accuracy: 6.2,
    ts: a.ts ? Number(a.ts) : Math.floor(Date.now() / 1000),
    seq: 1,
  });

const client = await mqtt.connectAsync(a.url, {
  clientId: a.id,
  protocolVersion: 4,
  clean: false,
  ca: readFileSync(a.ca),
  cert: readFileSync(a.cert),
  key: readFileSync(a.key),
  rejectUnauthorized: true,
});

try {
  await client.publishAsync(`pt/v1/${topicId}/telemetry`, payload, { qos: 1 });
  console.log(`PUBACK pt/v1/${topicId}/telemetry`);
} finally {
  await client.endAsync();
}
