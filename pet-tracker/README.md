# Pet tracker: nRF9160 · Zephyr · Supabase/PostGIS · EU-compliant

A reference implementation of a subscription-free LTE-M/NB-IoT pet tracker for the EU market, designed to be secure by default:
- **nRF9160 SiP** with integrated GNSS;
- **1NCE** SIM (`iot.1nce.net`);
- **nRF Connect SDK v3.4.1** firmware with TF-M (TrustZone) and MCUboot;
- an MQTTS broker (AWS IoT Core, HiveMQ/EMQX or Mosquitto);
- **Supabase** (PostgreSQL + PostGIS) with row-level security.

| Topic | Document |
|---|---|
| Power budget, PSM/eDRX/RAI configuration, A-GNSS, data budget | [docs/01-power-and-gnss.md](docs/01-power-and-gnss.md) |
| Firmware architecture, build, provisioning, security on nRF9160 | [docs/02-firmware.md](docs/02-firmware.md) |
| Broker options, ingest paths, database, GDPR | [docs/03-cloud.md](docs/03-cloud.md) |
| CE/RED/EMC/RoHS checklist, EN 18031 mapping, CRA | [docs/04-eu-compliance.md](docs/04-eu-compliance.md) |
| REA analysis of Traccar → cat tracker feature design | [docs/05-reverse-engineering-traccar.md](docs/05-reverse-engineering-traccar.md) |
| **Mobile app (Expo Go): test with your own phone as the cat** | [app/README.md](app/README.md) |

## Layout

```
firmware/                      Zephyr application (nRF Connect SDK v3.4.1)
  src/main.c                   state machine: GNSS in PSM → MQTT/TLS session → RAI → PSM
  src/{modem,location,cloud,motion,battery,fota}.c
  prj.conf                     production config (PSM 12 h / 6 s, RAI, 1NCE APN, no UART)
  overlay-debug.conf           logs + short intervals for the bench
  sysbuild.conf                MCUboot: ECDSA-P256, encrypted images, HW anti-rollback
app/                           Expo (SDK 58) React Native app: multi-cat map, phone-as-tracker,
                               route replay, home zones; demo mode or Supabase
cloud/
  supabase/migrations/         schema, RLS, ingest/claim functions, retention job, cats + phone trackers
  supabase/functions/          Edge Function for the AWS IoT Rule (push) path
  ingest-worker/               Node 22 / TypeScript MQTT subscriber + A-GNSS proxy
  broker/mosquitto/            mTLS + per-device ACL reference broker config
  broker/aws-iot/              least-privilege device policy + topic rule
  db-tests/                    46 behavioural SQL tests (PostgreSQL + PostGIS)
```

## What has been verified here

| Area | How | Result |
|---|---|---|
| Firmware compiles | `west build` for `nrf9160dk/nrf9160/ns` (production + debug) and `thingy91/nrf9160/ns` with NCS v3.4.1 / Zephyr SDK 1.0.1 | ✅ no app warnings; signed + encrypted DFU image produced |
| Database | `cloud/db-tests/run.sh` on PostgreSQL 16 + PostGIS 3.4 | ✅ 46/46 |
| Mobile app | `tsc`, unit tests, `expo export` web + Android + iOS, headless-Chromium walkthrough with simulated GPS | ✅ |
| Worker | `npm test`, `tsc --noEmit` | ✅ 8/8 |
| End to end | Mosquitto (mTLS + ACL) → worker → Postgres (TLS, least-privilege role) | ✅ including spoofing / no-cert rejection |
| Edge function | `deno check` + local HTTP smoke test | ✅ |

**Not verified yet:**
- the firmware on real hardware or a live 1NCE network;
- PSM grants on the visited networks;
- GNSS time-to-first-fix and current draw (bench work with a PPK2 is needed);
- the Supabase-hosted platform pieces: Auth, Realtime and pg_cron are stubbed in the tests;
- the nRF Cloud A-GNSS API, which was implemented from Nordic's documentation and reference cloud and still needs to be checked against your nRF Cloud plan.

## Quick start

```bash
# Database tests (needs local PostgreSQL 15+ with PostGIS)
cd cloud/db-tests && PGHOST=/var/run/postgresql ./run.sh

# Worker
cd cloud/ingest-worker && npm ci && npm test && npm run build
cp .env.example .env   # fill in, then: node --env-file=.env dist/index.js

# Firmware (nRF Connect SDK v3.4.1 workspace)
west build -p -b nrf9160dk/nrf9160/ns firmware -- -DEXTRA_CONF_FILE=overlay-debug.conf
```
