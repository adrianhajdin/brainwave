# 2. Firmware (nRF Connect SDK v3.4.1 / Zephyr 4.4)

## 2.1 Layout

| File | Responsibility |
|---|---|
| `src/main.c` | Event loop and state machine (STATIONARY ⇄ MOVING), report cycle, store-and-forward backlog, task watchdog |
| `src/modem.c` | `nrf_modem_lib` init, asynchronous LTE attach, registration tracking (home or roaming), PSM grant logging, cell info, lost mode (PSM ⇄ eDRX) |
| `src/location.c` | GNSS single-shot fixes, A-GNSS request capture (IRQ-safe, `k_event`), GNSS time → Unix time |
| `src/cloud.c` | MQTT 3.1.1 over modem-offloaded TLS 1.2: mutual auth, session resumption, ECDHE-ECDSA only, persistent session, typed downlink parsing, RAI |
| `src/motion.c` | ADXL362 activity/inactivity triggers (linked + referenced mode, autosleep) |
| `src/battery.c` | `%XVBAT` → state of charge (replace with nPM1300 fuel gauge in production) |
| `src/fota.c` | HTTPS download of MCUboot images, image confirmation after the first successful publish |
| `prj.conf` | **Production** configuration: secure and low-power by default |
| `overlay-debug.conf` | UART logs and short intervals. Never ship it |
| `sysbuild.conf`, `sysbuild/mcuboot.conf` | MCUboot: ECDSA-P256 signatures, encrypted images, hardware anti-rollback |
| `boards/thingy91_nrf9160_ns.conf` | ADXL362 thresholds for the reference hardware |

### Telemetry payload (topic `pt/v1/<device_id>/telemetry`, QoS 1)

```json
{"device_id":"pt-351234567890123","lat":52.379012,"lng":4.899512,"batt":87,"accuracy":6.2,"ts":1760620000,"seq":42}
```

Beyond the five fields you asked for, the payload adds `ts` (GNSS UTC fix time, so buffered fixes are ordered correctly and replays of old data are bounded) and `seq`.

### Downlinks (`pt/v1/<device_id>/down/+`, persistent session)

| Topic | Body | Effect |
|---|---|---|
| `down/config` | `{"interval_s":900,"lost_mode":false}` | Range-checked (60–86400 s); lost mode switches PSM → eDRX and reports every 60 s |
| `down/fota` | `{"host":"https://fw.example.eu","path":"pt/app_update-1.3.0.signed.encrypted.bin"}` | Downloads over mutually authenticated HTTPS. MCUboot verifies the signature before booting |
| `down/agnss` | binary (nRF Cloud A-GNSS format) | Injected into the GNSS receiver |

Publish `down/config` as a retained QoS 1 message so a device that reconnects always gets the current configuration.

## 2.2 Build

```bash
# One-time: toolchain + SDK (or use the nRF Connect for VS Code extension)
pip install west
west init -m https://github.com/nrfconnect/sdk-nrf --mr v3.4.1 ncs && cd ncs && west update
# Zephyr SDK 1.0.1 with the arm-zephyr-eabi toolchain

# Production build (nRF9160 DK)
west build -p -b nrf9160dk/nrf9160/ns path/to/pet-tracker/firmware \
  -- -DCONFIG_TRACKER_MQTT_BROKER_HOSTNAME=\"mqtt.tracker.example.eu\"

# Development build with UART logs (Thingy:91 = nRF9160 + ADXL362)
west build -p -b thingy91/nrf9160/ns path/to/pet-tracker/firmware \
  -- -DEXTRA_CONF_FILE=overlay-debug.conf -DSB_CONFIG_BOOT_ENCRYPTION=n
```

Verified in this repository with NCS **v3.4.1** and Zephyr SDK **1.0.1**, with no warnings from application code:

| Target | Config | Result |
|---|---|---|
| `nrf9160dk/nrf9160/ns` | production (MCUboot + encryption + HW anti-rollback, TF-M) | ✅ app 109 kB / RAM 48 kB; `zephyr.signed.encrypted.bin` produced |
| `nrf9160dk/nrf9160/ns` | debug overlay | ✅ |
| `thingy91/nrf9160/ns` | production / debug, `SB_CONFIG_BOOT_ENCRYPTION=n` | ✅ |

> **Thingy:91 note:** its fixed partition table gives MCUboot 48 kB, and MCUboot with ECIES image decryption (PSA backend) needs about 58 kB. That is why the Thingy:91 builds turn encryption off. **Size the bootloader partition at 64 kB on your custom board**, as the nRF9160 DK layout does.

The code has been built but has not yet run on hardware or on a live network. Expect to tune GNSS timeouts, accelerometer thresholds and RRC/PSM behaviour on the bench (PPK2) and in field trials.

## 2.3 Security architecture on the nRF9160

```
┌─────────────── nRF9160 SiP ───────────────────────────────────────────────┐
│  Application core (Cortex-M33, ARMv8-M TrustZone)                          │
│  ┌──────── Secure (TF-M) ──────────┐   ┌──────── Non-secure ────────────┐ │
│  │ PSA Crypto (CryptoCell-310)      │◄──│ Zephyr app (this firmware)     │ │
│  │ Internal Trusted / Protected     │PSA│ - no keys in RAM/flash         │ │
│  │   Storage, attestation           │API│ - parses only typed downlinks  │ │
│  │ SPU: flash/RAM/periph. isolation │   │                                │ │
│  └──────────────────────────────────┘   └───────────────┬────────────────┘ │
│  MCUboot (immutable, 64 kB) – ECDSA-P256 verify, ECIES  │ AT / sockets    │
│     decrypt, OTP security counter                        ▼                  │
│  Modem core (separate CPU, own firmware)  ─ TLS/DTLS stack, credential      │
│     storage (sec_tag), AT%KEYGEN key generation, LTE-M/NB-IoT, GNSS         │
│  APPROTECT / SECUREAPPROTECT (debug port locked via UICR)                    │
└──────────────────────────────────────────────────────────────────────────┘
```

* **The private key is generated inside the modem** (`AT%KEYGEN`) and cannot be read back by anything, including our own application, TF-M, or an attacker with code execution on the app core.
* **TLS runs inside the modem**, which is a separate core with its own firmware. A memory-safety bug in the application can neither read session keys nor downgrade verification.
* **TF-M** (the secure processing environment) isolates crypto and secure storage behind the PSA API, enforced by the SPU. The non-secure application cannot access secure flash, secure RAM or secure peripherals.
* **The boot chain**: immutable MCUboot verifies an ECDSA-P256 signature over TF-M + application, decrypts encrypted update images, and enforces a monotonic hardware security counter in OTP, so old images with known vulnerabilities cannot be reinstalled. Unconfirmed images revert automatically.

## 2.4 Manufacturing & provisioning (per device)

1. **Flash** the merged production hex (MCUboot + TF-M + app) and the certified **modem firmware** (mfw 1.3.x on nRF9160) with `nrfutil device program`.
2. **Generate the device key inside the modem and get a CSR.** With the modem offline (`AT+CFUN=4`):
   ```
   AT%KEYGEN=201,2,0          # sec_tag 201, client-key type, CSR output
   ```
   Nordic's `nrfcredstore` tool (pip) has a `generate` command that wraps this for factory scripts.
3. **Sign the CSR** in your factory PKI (offline root CA → online issuing CA in an HSM; ECDSA P-256; CN = `pt-<IMEI>`; EKU clientAuth; validity ≥ product life).
4. **Write the client certificate and broker CA** into the same sec_tag (`AT%CMNG=0,201,1,…` and `AT%CMNG=0,201,0,…`). For AWS IoT, register the certificate (or use Just-In-Time Registration with your CA) and create a Thing named `pt-<IMEI>`.
5. **Register the device in the backend** with `select public.provision_device('pt-<IMEI>', '<IMEI>', '<claim code>')` as `service_role`. The claim code is ≥ 10 random characters (≥ 50 bits), printed on the label/QR code, and stored only as a bcrypt hash.
6. **Lock the debug port**: `nrfutil device protection-set All` (sets UICR APPROTECT + SECUREAPPROTECT; the firmware's default `NRF_APPROTECT_USE_UICR` keeps it locked). Recovery is only possible through a full erase, which also destroys the modem credentials.
7. **End-of-line test**: attach to the network, get a GNSS fix (sky simulator or a window), one publish with PUBACK, then **ship mode** (PMIC) so the battery isn't drained in the warehouse.

## 2.5 Production checklist (firmware)

- [ ] Replace the MCUboot **sample keys** (`sysbuild.conf` header) with HSM-held signing and encryption keys
- [ ] Bump `SB_CONFIG_MCUBOOT_HW_DOWNGRADE_PREVENTION_COUNTER_VALUE` for every security release
- [ ] Custom board devicetree: 64 kB MCUboot partition, GNSS LNA/antenna control (COEX0/MAGPIO), PMIC, accelerometer
- [ ] nPM1300 + `nrf_fuel_gauge` instead of voltage-based SoC; charger thermal limits per EN 62133-2
- [ ] Modem firmware delta-FOTA path (`dfu_target` modem delta) and a policy for tracking modem FW CVEs
- [ ] SBOM per release: `west ncs-sbom` → SPDX, kept in the technical file (CRA Annex VII)
- [ ] Network acceptance testing with 1NCE in each launch country: PSM/eDRX grants, CE levels, TCP NAT timeouts
- [ ] Consider the nRF9151 SiP (Nordic's current-generation, smaller and lower-power successor). The firmware ports with a board change. Check component lifecycle status before freezing the BOM
