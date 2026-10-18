# 4. EU compliance & certification roadmap (Netherlands / EU)

> Status as of **October 2026**. This is an engineering roadmap, not legal advice. Confirm the applicable standard *editions* with your accredited test lab (ISO/IEC 17025) when you book, and have the technical file reviewed by a regulatory specialist before the first shipment.

## 4.1 Which laws apply to this product

| Legislation | Why it applies | Status |
|---|---|---|
| **Radio Equipment Directive 2014/53/EU (RED)** | It contains an LTE transmitter and a GNSS receiver. The main CE regime; covers safety, EMC and spectrum | In force |
| **RED Delegated Regulation (EU) 2022/30**: Art. 3.3(d)(e)(f) cybersecurity | Internet-connected radio equipment that processes personal data (location) | **Mandatory since 1 Aug 2025** |
| **Cyber Resilience Act (EU) 2024/2847** | "Product with digital elements" | **Vulnerability/incident reporting since 11 Sep 2026** (applies to products already on the market); full requirements and CE marking under the CRA from **11 Dec 2027** |
| RoHS 2011/65/EU + (EU) 2015/863 | Electrical equipment | In force |
| REACH (EC) 1907/2006 | SVHCs in articles (enclosure, collar, cables) | In force |
| WEEE 2012/19/EU | Producer responsibility for e-waste | In force |
| **Batteries Regulation (EU) 2023/1542** | Built-in Li-ion battery | Phasing in. Labelling since 18 Aug 2026; **removability rules from 18 Feb 2027** |
| General Product Safety Regulation (EU) 2023/988 | Consumer product (residual safety, traceability, online sales) | Since 13 Dec 2024 |
| Market Surveillance Regulation (EU) 2019/1020 | Needs an EU-established responsible economic operator | In force |
| GDPR (EU) 2016/679 + Dutch UAVG | Location data of owners | In force |
| Packaging & Packaging Waste Regulation (EU) 2025/40 | Product packaging | Applies from 12 Aug 2026 |

The Dutch market-surveillance authority for RED is the **Rijksinspectie Digitale Infrastructuur (RDI)**. For privacy it is the **Autoriteit Persoonsgegevens (AP)**.

## 4.2 Step-by-step checklist

### Phase 0: Design decisions that make or break certification

- [ ] **Use the certified nRF9160 (or nRF9151) SiP and follow Nordic's reference layout** for RF, decoupling and the GNSS LNA. In the EU, module test reports *support* your file but do **not** transfer automatically, because there is no "modular approval" as there is under the FCC. You are the manufacturer of the end product.
- [ ] **Antenna**: tuned for all bands you enable (e.g. B3/B8/B20 for NL/EU LTE-M). Do passive (efficiency) and active (TRP/TIS) OTA tests early. Radiated spurious emissions and poor TRP are the most common failures.
- [ ] Battery: buy cells with an **IEC 62133-2 certificate and UN 38.3 test summary**, and a protection circuit.
- [ ] Enclosure: IP67 per **EN 60529** (immersion 1 m / 30 min), tested on the final MJF/injection part. MJF PA12 is porous, so add vapour smoothing or sealing and validate after ageing. Rate the charging contacts as well.
- [ ] Charging: if charged by wire, use USB-C on the dock (simplest future-proof route under the common-charger amendment 2022/2380, even though trackers are not a listed category).

### Phase 1: Pre-compliance (2–4 weeks, in-house or at a lab)

- [ ] Conducted and radiated emissions scan, ESD gun on the enclosure seams (EN 61000-4-2 levels used by EN 301 489-1)
- [ ] TRP/TIS spot check in a chamber; GNSS C/N0 with the device on a phantom/collar
- [ ] Power profile (PPK2) vs the budget in [01-power-and-gnss.md](01-power-and-gnss.md)
- [ ] Cybersecurity gap assessment against EN 18031-1/-2 (see 4.3)

### Phase 2: Formal testing (accredited lab; indicative €25–50k all-in, 6–10 weeks)

| RED article | Requirement | Harmonised standards (confirm current editions) |
|---|---|---|
| **3.1(a) Safety** | Electrical / fire / battery safety | EN IEC 62368-1 (ICT equipment safety); EN 62133-2 (Li-ion cell/pack); EN 60529 if IP67 is claimed |
| **3.1(a) Health** | RF exposure | EN 62311 (general assessment) or EN IEC 62479 (low power). The lab decides whether body-worn SAR (EN 50566 / EN IEC 62209-1528) is needed. A collar is not worn by a person, but handling distance matters |
| **3.1(b) EMC** | Emissions & immunity | EN 301 489-1 + **EN 301 489-52** (cellular UE) + **EN 301 489-19** (GNSS receivers) |
| **3.2 Spectrum** | Efficient use of radio spectrum | **EN 301 908-1 + EN 301 908-13** (E-UTRA UE: LTE-M & NB-IoT); **EN 303 413** (GNSS receivers) |
| **3.3(d)** | Network protection | **EN 18031-1** |
| **3.3(e)** | Personal data & privacy | **EN 18031-2** (location = personal data) |
| 3.3(f) | Fraud / monetary value | EN 18031-3: **not applicable** (no payments on the device) |

**Conformity assessment route.** With harmonised standards applied in full, RED Module A (internal production control) applies and no Notified Body is required. **Exception for 3.3:** the EN 18031 references were published (Implementing Decision (EU) 2025/138) *with restrictions*. If your design relies on a restricted option, there is no presumption of conformity and you need a Notified Body (EU-type examination, Module B+C). An example is letting the user skip setting a password; for -2, specific parental-control cases. This design has **no user-settable device credentials** (certificate-based authentication, no local UI or network services), so Module A should be possible. Have the lab confirm this in writing.

Operator / industry certification is **not** required by EU law, but plan for it: GCF certification of the end product (or reuse of the SiP's GCF certificate plus antenna OTA), and any acceptance testing 1NCE's roaming partners require.

### Phase 3: Technical documentation (RED Annex V; keep for 10 years)

- [ ] Product description, photos, intended use (pets only, IP67, operating temperature range)
- [ ] Schematics, layout, BOM, antenna data, firmware version identification
- [ ] Risk assessment (safety + RF exposure + **cybersecurity risk assessment** per EN 18031)
- [ ] Test reports (above) + list of harmonised standards applied
- [ ] RoHS: EN IEC 63000 file (supplier material declarations, e.g. IPC-1752A)
- [ ] REACH Art. 33 SVHC screening of all articles (Candidate List updates twice a year)
- [ ] Battery: IEC 62133-2 certificate, UN 38.3 test summary, Batteries Regulation labelling evidence
- [ ] **SBOM** per firmware release (`west ncs-sbom` → SPDX) + vulnerability-handling procedure (needed for the CRA anyway)

### Phase 4: Declaration, marking, documentation

- [ ] **EU Declaration of Conformity** (RED Annex VI) listing RED, RoHS, the 2022/30 delegated act and the standards. A simplified DoC with a URL may go in the box
- [ ] **CE mark** on the product (≥ 5 mm), plus manufacturer name, postal address, website/e-mail (GPSR), type and batch/serial number. If the device is too small, put them on the packaging and in the documents
- [ ] **Instructions and safety information in Dutch** (and every language of each target market), including **frequency bands and maximum transmitted power** (RED Art. 10(8)), charging and battery warnings, IP67 limits, and disposal
- [ ] WEEE symbol (crossed-out wheelie bin, EN 50419) on product and battery
- [ ] Batteries Regulation labels: chemistry, capacity, separate-collection symbol (QR code from 18 Feb 2027)

### Phase 5: Registrations in the Netherlands

- [ ] **WEEE** producer registration and collection-scheme membership (e.g. **Stichting OPEN**)
- [ ] **Batteries** producer responsibility (e.g. **Stibat**)
- [ ] **Packaging** EPR (Afvalfonds Verpakkingen) once over the thresholds
- [ ] KvK details and an EU contact address on the product (GPSR / Reg. 2019/1020)
- [ ] Each additional EU country needs its own WEEE/battery/packaging registrations, or an **authorised representative** where that is allowed

### Phase 6: Post-market obligations

- [ ] **CRA Art. 14 reporting (in force now):** an **actively exploited vulnerability** or **severe incident** → early warning **within 24 h**, notification within 72 h, final report, all through ENISA's single reporting platform to the competent CSIRT (in NL, coordinated with the NCSC). Set up the on-call process and templates *before* launch
- [ ] Coordinated vulnerability disclosure policy + `security.txt`; monitor Zephyr, NCS, TF-M, MCUboot and modem-firmware advisories
- [ ] **Security updates free of charge for the support period** (CRA: at least 5 years unless the product's expected use is shorter). State the end-of-support date at purchase
- [ ] Batteries Regulation **Art. 11 (from 18 Feb 2027)**: portable batteries must be removable and replaceable by the end user. There is an **exemption (Art. 11(2))** for appliances designed to operate primarily in wet environments and intended to be washable/rinsable, which must instead be replaceable by independent professionals. An IP67 collar tracker is a credible candidate, but document the justification and follow the Commission's guidance, or design a user-replaceable sealed battery door
- [ ] GPSR: product-safety incident handling, Safety Gate notification of dangerous incidents, recall procedure
- [ ] Re-assess conformity for every hardware change and for any software change that affects radio parameters or security functions

## 4.3 How Zephyr, TF-M and nRF9160 TrustZone map onto EN 18031

EN 18031-1/-2 define security **assets** (network, security and privacy assets) and **mechanisms**. Each mechanism must be implemented or justified as not applicable, and must be backed by documentation and test evidence. The table maps each mechanism family to what this design provides; cite the exact requirement IDs from your copy of the standard in the technical file.

| EN 18031 mechanism family | What the standard wants | How this design meets it |
|---|---|---|
| **ACM** Access control | Only authorised entities can reach security/privacy assets | **TrustZone/SPU**: keys and crypto live in the TF-M secure partition and the modem; the non-secure app has no access to them. **APPROTECT + SECUREAPPROTECT** lock the debug port. Broker ACL / AWS IoT policy: a device can only publish or subscribe on its own topics. Supabase RLS: an owner sees only their own devices and data |
| **AUM** Authentication | Strong authentication for every network-accessible interface; no universal default passwords | **Mutual TLS** with a per-device X.509 certificate. The key is generated **inside the modem** (`AT%KEYGEN`) and is never exportable. No passwords exist on the device. The device exposes **no listening services**: it only makes outbound connections. App users authenticate through Supabase Auth; device ownership is proven with a per-device ≥ 50-bit claim code (bcrypt) |
| **SUM** Secure update | Updates exist, their integrity and authenticity are verified, and they can be automatic | **MCUboot**: ECDSA-P256 signature check before every boot, encrypted images, **hardware anti-rollback counter in OTP**, automatic revert if a new image never confirms. Delivery over mutually authenticated HTTPS, triggered by the cloud (`down/fota`) with no user action. Modem firmware is updated through delta FOTA |
| **SSM** Secure storage | Integrity / confidentiality of stored security assets | Credentials in the **modem's protected key storage**; application secrets in **TF-M Internal Trusted / Protected Storage** (PSA); code protected by the SPU and APPROTECT |
| **CCK** Confidential cryptographic keys | Unique per device, generated securely, not exposed | Per-device ECC key generated by the modem's TRNG; CA keys held in an HSM; **no shared secrets across the fleet**. The MCUboot signing key is held offline / in an HSM (replace the sample keys) |
| **SCM** Secure communication | Integrity, confidentiality, replay protection and authenticity of communications | TLS 1.2 limited to **ECDHE-ECDSA AES-GCM/CBC-SHA256** (forward secrecy), with server certificate **and hostname** verification (`TLS_PEER_VERIFY_REQUIRED` + SNI). In the backend: TLS to Postgres with CA verification, the topic ↔ certificate identity binding, and timestamp-window checks |
| **CRY** Cryptography | Best-practice algorithms and key lengths | P-256 / SHA-256 / AES-128 everywhere through the **PSA Crypto API** (CryptoCell-310 accelerated); no custom crypto |
| **RLM** Resilience | Survive DoS / malformed input; recover | Task + hardware **watchdog**, `RESET_ON_FATAL_ERROR`, stack canaries and HW stack protection; bounded buffers (oversized downlinks drained and dropped); typed, heap-free JSON parsing with range checks; LTE back-off by the modem; store-and-forward |
| **GEC** General equipment capabilities | No known exploitable vulnerabilities, minimal attack surface, secure defaults, input validation, documentation | `prj.conf` is the **production default**: no UART, no shell, no logs, no open ports. Debug features live only in `overlay-debug.conf`. SBOM per release (`west ncs-sbom`), CVE monitoring of Zephyr/NCS/TF-M/MCUboot (Zephyr has a PSIRT and publishes advisories). Validation on device (downlinks) **and** in the cloud (zod schema, DB constraints) |
| **LGM** Logging (-2) | Record security-relevant events | Broker connection/ACL logs (e.g. the "Denied PUBLISH" entries seen in testing), worker structured logs (no coordinates), DB audit through Supabase logs. Event-only logging on the device, since UART logging is off |
| **DLM** Deletion (-2) | The user can delete personal data | `release_device`, account-deletion cascade, `telemetry` DELETE policy, 180-day automatic purge, all verified by DB tests. A device factory reset wipes the RAM backlog; it holds no persistent location history |
| **UNM** User notification (-2) | Inform the user about changes to privacy-relevant settings | Lost mode and interval changes are user-initiated in the app; the app shows the active mode and the support/update period |

### Why TrustZone specifically matters for the assessor

EN 18031 asks you to show that **a compromise of the "ordinary" application does not expose security assets**. On a microcontroller without TrustZone, any memory-safety bug in the MQTT or JSON code gives an attacker the TLS private key and the means to impersonate the device fleet-wide. On the nRF9160 the protections are split across three boundaries:

1. The **modem core** holds the TLS stack and the private key, behind a separate CPU and memory.
2. The **TF-M secure partition** holds crypto and secure storage behind the PSA API, enforced in hardware by the SPU.
3. **MCUboot** in a separate, fprotect-locked flash region refuses unsigned or rolled-back code, so a compromise cannot persist across a reboot.

That layering is what you document as the justification for the ACM, SSM, CCK and SUM mechanisms. Zephyr adds a well-maintained, openly disclosed supply chain: Zephyr's PSIRT, published CVEs, and Nordic's NCS security advisories. Together with an SBOM, that is the evidence behind the GEC requirements for having no known exploitable vulnerabilities, and it is the same evidence the CRA will ask for from December 2027.

### Note on terminology

**EN 18031 is not the Cyber Resilience Act.** EN 18031-1/-2/-3 are the harmonised standards under the **RED delegated act 2022/30**, which is mandatory now. The **CRA** is a separate regulation with its own essential requirements (Annex I) and its own harmonised standards, being developed by CEN/CENELEC. Its reporting duties already apply, and it becomes the CE basis for cybersecurity from **11 Dec 2027**. Design to the CRA Annex I now; EN 18031 compliance covers a large part of it.
