# 3. Cloud architecture & data

```
 Tracker ──MQTTS (mTLS, TLS 1.2 ECDHE-ECDSA)──► Broker (EU region)
   ▲  pt/v1/<id>/telemetry, agnss/req              │  per-device ACL: CN = client id = topic id
   │  pt/v1/<id>/down/{config,fota,agnss}          │
   │                                               ├─► Ingest worker (Node 22, ≥2 replicas,
   │                                               │     $share/ingest/… shared subscription)
   │                                               │     zod validation → ingest_telemetry()
   │                                               │     A-GNSS proxy → nRF Cloud
   │                                               │
   │                                  (AWS only)   └─► IoT Rule ──HTTPS──► Supabase Edge Function
   │                                                                        telemetry-ingest
   │                                                                              │
   └──────────── Next.js dashboard / React Native app ◄── Realtime + PostgREST ──┤
                 (Supabase Auth, RLS)                                            ▼
                                                         Supabase Postgres + PostGIS (EU)
```

## 3.1 Broker choice

| | AWS IoT Core (eu-central-1) | HiveMQ Cloud / EMQX Cloud | Self-hosted Mosquitto / EMQX (DigitalOcean AMS3 / FRA1) |
|---|---|---|---|
| Device auth | X.509 per Thing, policy variables | X.509 or user/pass | X.509, `use_identity_as_username` |
| Per-device topic isolation | [`aws-iot/device-policy.json`](../cloud/broker/aws-iot/device-policy.json) | ACL rules | [`mosquitto/acl`](../cloud/broker/mosquitto/acl) |
| Ingest | worker **or** IoT Rule → Edge Function | worker | worker |
| Ops burden | none | low | you patch, scale and monitor it (CRA: your vulnerability handling) |
| Indicative cost, 10k devices × ~50 msg/day | ~€20–50/month (messaging + rules) | plan-based | 1–2 droplets + your time |

Recommendation: **AWS IoT Core** or a managed EU HiveMQ/EMQX for production; the reviewed Mosquitto config is the dev/staging reference. Use one ingest worker codebase for all of them.

## 3.2 Why a worker *and* an edge function?

An MQTT subscription is a long-lived TCP/TLS session. Supabase Edge Functions (and serverless functions in general) are request-scoped and are terminated after seconds to minutes, so **an edge function cannot subscribe to a broker**. That leaves two correct patterns:

1. **Pull: [`cloud/ingest-worker`](../cloud/ingest-worker)**, a small always-on Node.js/TypeScript service (Render, Fly.io, DigitalOcean App Platform, ECS) with an MQTT 5 *shared subscription*, so N replicas share the load and one can die. It works with every broker and also hosts the A-GNSS proxy.
2. **Push: [`supabase/functions/telemetry-ingest`](../cloud/supabase/functions/telemetry-ingest/index.ts)**. An AWS IoT Topic Rule ([`telemetry-rule.json`](../cloud/broker/aws-iot/telemetry-rule.json)) POSTs each message to the Edge Function. Identity comes from `topic(3)`, and the caller is authenticated by a shared secret fetched with `get_secret()` (Secrets Manager). Failures go to an SQS dead-letter queue.

Both paths apply the **same validation** and call the **same database function**.

### Validation rules (`src/schema.ts`, `_shared/telemetry.ts`)

* ≤ 512 bytes before `JSON.parse`, then a strict zod schema with unknown keys rejected.
* `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`, `batt` integer 0–100, `accuracy` 0–100 km, `ts` in Unix **seconds**. (0,0) is rejected.
* **Identity binding**: `device_id` in the body must equal the device id in the topic. The broker ACL guarantees the topic matches the certificate CN, so a stolen or cloned device can only ever write its own track.
* Malformed messages are acked and dropped, since retrying will never fix them. Transient DB errors are retried 3× with backoff before the message counts as failed.
* QoS 1 end to end: the worker sends its PUBACK only **after** the DB commit (`customHandleAcks`), and QoS 1 duplicates are removed by `unique (device_id, recorded_at)`.

### Verified

| Test | Result |
|---|---|
| `cloud/db-tests/run.sh`: 29 behavioural tests against PostgreSQL 16 + PostGIS 3.4 | ✅ claim flow, RLS isolation, ingest, de-duplication, out-of-order backlog, accuracy-aware geofence hysteresis, future-timestamp rejection, account-deletion erasure |
| `cloud/ingest-worker`: `npm test` (8 tests), `tsc --noEmit` | ✅ |
| End-to-end: Mosquitto (mTLS + ACL) → worker → Postgres (TLS, `telemetry_ingest` role) | ✅ fix stored; redelivery de-duplicated; malformed payload rejected; **intruder cert publishing on another device's topic denied by the broker**; body/topic id mismatch rejected; client without a certificate refused at TLS |
| Edge function: `deno check` + local run | ✅ 401 without/with wrong secret, AWS destination handshake, spoofed id rejected, 503 when DB is down |

## 3.3 Database (Supabase, EU region)

Migrations: [`20261016000100_tracker_core.sql`](../cloud/supabase/migrations/20261016000100_tracker_core.sql), [`20261016000200_retention.sql`](../cloud/supabase/migrations/20261016000200_retention.sql).

| Table | Purpose | App access (RLS) |
|---|---|---|
| `devices` | device identity, owner, status, last location/battery | owner: select; update **only** `display_name`, `report_interval_s` (column grants) |
| `private.device_secrets` | bcrypt claim-code hash | none (schema not exposed) |
| `telemetry` | `geography(Point,4326)`, accuracy, battery, GNSS time; **`owner_id` snapshot** | owner: select, delete (self-service erasure) |
| `geofences` | `geography(Polygon,4326)`, 100 m²–100 km², enter/exit alerts | owner: CRUD, only on own devices |
| `geofence_state` | last inside/outside per device × fence | internal |
| `geofence_events` | transitions, `notify` flag | owner: select, delete |

Functions (all `SECURITY DEFINER`, `search_path = ''`, `EXECUTE` revoked from `PUBLIC`):

* `provision_device(uid, imei, claim_code)`: `service_role` only (factory).
* `claim_device(uid, claim_code)`: authenticated users. Returns one generic error, so device ids cannot be enumerated. Put a rate limit in front of it.
* `release_device(id)`: the owner gives up the device; their history for that device is erased.
* `ingest_telemetry(…)`: the **only** device write path, executable only by `telemetry_ingest` / `service_role`. It row-locks the device, so concurrent deliveries serialise, inserts with de-duplication, and advances `last_location` only for the newest fix. It evaluates geofences with `ST_Covers` plus an **accuracy-aware hysteresis band** (`ST_DWithin(area, point, max(accuracy, 25 m))`), so a fix whose uncertainty circle straddles the fence keeps the previous state instead of firing exit/enter alerts.

The `telemetry_ingest` role is created `NOLOGIN`. Enable it out-of-band:
`alter role telemetry_ingest with login password '<secret manager>';`

### Frontend integration

* **Registration**: scan the QR code → `supabase.rpc('claim_device', { p_device_uid, p_claim_code })`.
* **Live map**: subscribe to Realtime `postgres_changes` on `devices` (RLS-filtered per user). Use `last_location` and `last_accuracy_m` to draw an accuracy circle.
* **History**: `select recorded_at, location, accuracy_m from telemetry where device_id = … order by recorded_at desc` (index `telemetry_device_recorded_uk`).
* **Geofences**: draw on the map → insert GeoJSON as `ST_GeogFromText('POLYGON(...)')` through an RPC, or a circle as `ST_Buffer(point::geography, radius_m)`.
* **Push notifications**: a Supabase Database Webhook on `geofence_events` inserts where `notify = true` → an Edge Function → Expo/FCM/APNs.

## 3.4 GDPR by design

* A pet's location is **personal data of the owner**: it shows where they live, walk and work. That makes systematic location monitoring of many users a likely **DPIA** case under the Dutch AP's list.
* **EU data residency**: Supabase (Frankfurt), AWS IoT (eu-central-1), worker in the EU. 1NCE (Germany) and Nordic nRF Cloud are processors and need a DPA. Note that A-GNSS requests reveal the serving cell (~km location) to nRF Cloud; record this in the register of processing.
* **Minimisation**: no raw payloads stored; worker logs never contain coordinates; claim codes stored hashed.
* **Storage limitation**: `pg_cron` purges telemetry and geofence events after 180 days. Make this configurable per user if you offer a "keep history" option.
* **Erasure**: account deletion cascades to telemetry, geofences and events, and resets the device (verified in tests). Device hand-over (`release_device`) wipes the previous owner's track.
* **Purpose separation**: a new owner never sees old data, because `telemetry.owner_id` is snapshotted at insert.
