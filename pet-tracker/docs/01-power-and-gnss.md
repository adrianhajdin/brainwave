# 1. Power & GNSS strategy

Goal: **≥ 14 days on a 300 mAh LiPo with a fix every 15 min while moving.**

## 1.1 What actually drains the battery

| State | Typical current (nRF9160) | Notes |
|---|---|---|
| PSM sleep (modem) + System ON idle (app core, RTC) | ~3–5 µA | Requires **UART off**; an enabled UARTE alone draws ~0.6 mA |
| Accelerometer (ADXL362, linked/autosleep) | ~0.3–2 µA | One IRQ at motion start, one after 5 min stillness |
| PMIC / protection IC quiescent | ~1–4 µA | Pick parts by Iq; nPM1300 recommended |
| GNSS acquiring / tracking | ~40–50 mA | Dominant cost per fix: **time-to-fix is everything** |
| LTE-M RRC connected (TLS, MQTT) | ~20–60 mA avg, 200+ mA TX peaks | Seconds per report |
| LTE RRC inactivity tail (no RAI) | ~5–10 mA for 5–20 s | Network timer; removed with **RAI** |
| eDRX idle (81.92 s cycle) | ~15–25 µA | Only in "lost mode" |

These figures are planning values for the design. Measure your own board with a
Nordic PPK2 and the Online Power Profiler, at the coverage levels your customers
will actually have.

## 1.2 Budget

Usable capacity: 300 mAh × 0.85 (3.5 V cut-off, ageing, cold) ≈ **255 mAh → 18.2 mAh/day for 14 days.**

Per-event cost (planning values, CE level 0 = normal coverage):

| Event | Model | Charge |
|---|---|---|
| GNSS fix, A-GNSS warm / hot start, low-accuracy mode | ~8 s × 45 mA | 0.10 mAh |
| LTE-M report session (TLS resume + MQTT QoS1 + RAI) | ~3 s × 50 mA | 0.04 mAh |
| **Report total (+20 % margin)** | | **0.17 mAh** |
| A-GNSS refresh (extra session + ~5 kB) | every ~2 h of activity | 0.05 mAh |
| Sleep floor (~9 µA) + LiPo self-discharge (~3 %/month) | 24 h | 0.52 mAh/day |

| Scenario (per day) | Reports | mAh/day | Days on 300 mAh | Days on 400 mAh |
|---|---|---|---|---|
| Typical dog: 6 h moving + 10 transitions + 3 heartbeats | 37 | ~7.0 | **~36** | ~48 |
| Very active: 12 h moving + 20 transitions | 70 | ~12.8 | **~20** | ~26 |
| Worst case: moving 24 h | 96 | ~17.4 | **~14.6** | ~19.5 |
| Worst case in a basement (CE level 2, ~4× LTE airtime) | 96 | ~31 | ~8 | ~11 |

**Conclusions**

1. 14 days at 15-minute moving updates holds for realistic behaviour, and only just holds for continuous movement.
2. Coverage and antenna efficiency matter most. A poor LTE antenna pushes the modem to higher TX power and coverage-enhancement repetitions, which costs more than any firmware optimisation can recover. Budget for a proper antenna design (for example an antenna booster with a tuned matching network) and over-the-air (OTA) testing.
3. Recommended firmware addition: stretch the moving interval when `lte_lc_conn_eval_params_get()` reports CE level ≥ 2 or a high energy estimate.
4. Use 400 mAh if the enclosure allows it.

## 1.3 Zephyr / nRF Connect SDK power configuration

All of this lives in [`firmware/prj.conf`](../firmware/prj.conf). The `lte_lc` library applies it when the modem initialises.

```kconfig
# LTE-M preferred (mobility + short radio-on time), NB-IoT fallback, GPS on
CONFIG_LTE_NETWORK_MODE_LTE_M_NBIOT_GPS=y
CONFIG_LTE_MODE_PREFERENCE_LTE_M=y

# 1NCE APN
CONFIG_LTE_LC_PDN_DEFAULTS_OVERRIDE=y
CONFIG_LTE_LC_PDN_DEFAULT_APN="iot.1nce.net"
CONFIG_LTE_LC_PDN_DEFAULT_FAM_IPV4=y

# PSM - requested timers (3GPP TS 24.008 bit strings)
CONFIG_LTE_PSM_REQ=y
CONFIG_LTE_PSM_REQ_RPTAU="00101100"   # T3412ext: unit 001 (1 h) x 12 = 12 h
CONFIG_LTE_PSM_REQ_RAT="00000011"     # T3324:    unit 000 (2 s) x 3  =  6 s

# eDRX - only requested in "lost mode" (cloud command)
CONFIG_LTE_EDRX_REQ=n
CONFIG_LTE_EDRX_REQ_VALUE_LTE_M="0101"  # 81.92 s
CONFIG_LTE_PTW_VALUE_LTE_M="0000"       # 1.28 s paging time window

# Release Assistance Indication
CONFIG_LTE_RAI_REQ=y

# No UART / logs / console in production
CONFIG_SERIAL=n
CONFIG_LOG=n
CONFIG_TFM_LOG_LEVEL_SILENCE=y
```

### Why these timer values

* **Periodic TAU = 12 h.** The tracker always starts its own exchanges, so it never needs to be pageable for long. Each TAU is a short signalling exchange, which this timer limits to two per day. A longer TAU (24 h or more) saves very little and some networks clamp it anyway.
* **Active time = 6 s.** This is how long the device stays pageable after RRC release. It is kept short because downlinks (config, FOTA jobs, A-GNSS) are delivered while the device is connected anyway, through the MQTT persistent session. Requesting 0 s is rejected by some networks.
* **eDRX is off.** PSM's ~3 µA beats eDRX's ~20 µA. The trade-off is that a cloud command waits until the next report (≤ 15 min while moving, ≤ 6 h while stationary). **Lost mode** flips this: PSM off, eDRX 81.92 s, reports every 60 s. Commands then arrive within about 80 s for roughly +20 µA. That is acceptable for an emergency mode that lasts hours, not weeks.
* **The network decides.** These are *requested* values. 1NCE is a roaming SIM, so the granted values depend on the visited network. The firmware logs `PSM granted: periodic TAU … active time …`. If `active_time == -1`, PSM was refused and the budget above no longer holds. Check this during network acceptance testing in each target country.

### The report cycle (firmware/src/main.c)

```
          ┌──────────── PSM (~3 µA), app core idle, ADXL362 armed ────────────┐
 timer /  │                                                                     │
 motion ──┤ 1. GNSS single fix (LTE asleep, radio free)                          │
          │      └─ modem asks for A-GNSS? → short MQTT exchange → inject →     │
          │         RAI_NO_DATA → GNSS continues                                │
          │ 2. LTE wakes: MQTT CONNECT (TLS resumed) → PUBLISH backlog (QoS 1)  │
          │    → queued downlinks arrive (persistent session)                   │
          │ 3. RAI_LAST + DISCONNECT → RRC released at once → PSM               │
          └─────────────────────────────────────────────────────────────────────┘
```

* **Motion gating.** While the animal is still, the only traffic is a heartbeat every 6 h. Motion start triggers an immediate fix (rate-limited to one per 2 min). Five minutes of stillness triggers a final "resting position" fix.
* **Store and forward.** Fixes taken without coverage go into a 32-entry RAM ring buffer and are flushed in the next session. The backend de-duplicates and orders them by GNSS time.
* **The watchdog proves liveness.** The main loop wakes at least every 7.5 min to feed the task watchdog. That costs a few µC per wake, against a 900 s watchdog timeout.

## 1.4 A-GNSS: from minutes to seconds

A GNSS receiver needs four pieces of information:

1. Which satellites are up (almanac).
2. Precise orbits (ephemerides).
3. Time.
4. Rough position.

Without assistance, it decodes the ephemerides from the satellite signal at **50 bit/s**. A complete set takes at least 30 s with a clear sky, often minutes under trees or between buildings, at ~45 mA throughout.

| Start type | What the receiver knows | TTFF (open sky) | Charge |
|---|---|---|---|
| Cold, unassisted | nothing | 35 s … minutes | 0.5–2 mAh |
| **A-GNSS** | ephemerides, time, coarse position (from the LTE cell) pushed over LTE | **~3–15 s** | ~0.05–0.2 mAh |
| Hot (previous fix < ~2 h, `MULTIPLE_HOT_START`) | everything still valid | 1–3 s | ~0.03 mAh |

### How it is wired in this design

```
GNSS (modem) --NRF_MODEM_GNSS_EVT_AGNSS_REQ--> firmware (location.c)
firmware --pt/v1/<id>/agnss/req {"types":[1,2,...],"mcc","mnc","tac","eci"}--> broker
broker --> ingest worker (agnss.ts) --HTTPS GET .../location/agnss?types=..&mcc=..--> nRF Cloud
nRF Cloud --binary--> worker --pt/v1/<id>/down/agnss (part 1: ephemerides, part 2: rest)--> device
device: nrf_cloud_agnss_process() --> nrf_modem_gnss_agnss_write() --> GNSS
```

* **Request only what is missing.** The modem's request frame lists exactly which satellites' ephemerides and almanacs, and which time/ionosphere/position data, it lacks. When moving it is usually nothing at all.
* **Two parts.** Ephemerides are sent on their own because, together with the other types, they exceed what fits in one device buffer. This is the same split Nordic's reference cloud uses. The firmware waits for both parts.
* **The proxy runs on our backend.** The device never holds nRF Cloud credentials or opens a second TLS session. The Organization Auth Token stays server-side, and the worker rate-limits each device to one request per 10 min. Location Services cloud-to-cloud access needs an nRF Cloud **Pro or Enterprise plan** and is billed per request. Include that in the subscription-free business case.
* **Radio sharing.** On the nRF9160, GNSS only runs while LTE is idle. After injecting assistance data the firmware sets `SO_RAI = RAI_NO_DATA` so RRC is released immediately and GNSS gets the radio back. Without RAI, GNSS sits blocked for the 5–20 s network inactivity timer.
* **Low-accuracy mode** (`NRF_MODEM_GNSS_USE_CASE_LOW_ACCURACY`) accepts a fix from fewer satellites using a reference altitude. Tens of metres is enough for a pet and saves seconds per fix. Single-shot mode stops the receiver automatically at fix or timeout (90 s cap).

### Alternatives

| Option | When | Trade-off |
|---|---|---|
| **P-GPS** (nRF Cloud predicted ephemerides) | Long offline periods | ~2 weeks of predictions in flash; one larger download a week instead of several small ones a day; slightly slower TTFF |
| **SUPL** (Nordic SUPL client library + a SUPL server) | You already license a SUPL server | Separately licensed library. Public SUPL servers have terms of use that usually exclude commercial products |
| **Self-hosted assistance** (broadcast ephemerides from IGS/BKG, encoded to `nrf_modem_gnss_agnss_*` structs) | Zero per-request vendor fees | You own the encoder, time/iono models and their correctness |
| **Cell / Wi-Fi location fallback** | Indoors / GNSS timeout | ~0.5–1 km accuracy; useful "last known area" for a lost pet |

## 1.5 Data budget (1NCE: 500 MB / 10 years ≈ 137 kB/day)

| Item | Size |
|---|---|
| Report session with TLS resumption (TCP + TLS abbreviated handshake + MQTT CONNECT/PUBLISH/DISCONNECT, incl. IP headers) | ~1.2–1.5 kB |
| Same with a full TLS handshake (ECC certificates) | ~3–4 kB |
| A-GNSS (filtered ephemerides + rest) | ~2–5 kB |

Typical use is ~45 reports and ~4 refreshes a day, about **75–90 kB/day**, which fits. Worst case is 96 reports and ~12 refreshes a day, about **180 kB/day**, which is over budget. TLS session resumption (`ZSOCK_TLS_SESSION_CACHE_ENABLED`) is already on.

**Recommended v2 transport: CoAP over DTLS 1.2 with Connection ID (RFC 9146).** The nRF9160 modem supports it natively. DTLS-CID survives NAT rebinding and PSM without any new handshake, so a report costs ~150–250 bytes, and over UDP the RAI behaviour is exact. That makes it about 6–10× cheaper in data and radio time than MQTT over TCP+TLS. Only the device-to-broker leg changes: put a CoAP-to-MQTT bridge in front of the existing ingest path.
