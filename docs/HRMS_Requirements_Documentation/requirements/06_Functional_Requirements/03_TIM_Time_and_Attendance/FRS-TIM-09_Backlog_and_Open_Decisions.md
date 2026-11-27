<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-09 — Time & Attendance — Backlog and Open Decisions

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-09 |
| Title | Time & Attendance — Backlog and Open Decisions |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Delivery Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PLAN, EST, DAR |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 18_Build_Backlog, 22_Open_Decisions<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 11_Open_Questions |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## Phase 1 — Core Hrms (Weeks 9-24)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-030 | Time | Punch ingestion: biometric plus one more source, offline buffer and catch-up | P1 | CMP-07 | BL-020 | 10 | 500 events/s sustained per tenant at shift change |
| BL-031 | Time | Attendance day derivation: pairing, segments, breaks, gross, net, OT, provenance | P1 | CMP-04 | BL-030 | 12 | TC-T80 to TC-T89 pass, including the 19h20m cross-midnight day |
| BL-032 | Time | Shift inference with assigned vs applied and override | P1 | CMP-04 | BL-031 | 4 | TC-T92 passes; inference is visible to the roster owner |
| BL-033 | Time | Day type resolution from calendar plus class rest-day policy | P1 | CMP-10 | BL-021 | 4 | TC-T101, TC-T102 pass |
| BL-034 | Time | Disposition rule set: thresholds, grace, late counting, exemption, long-night relief | P1 | CMP-04 | BL-031 | 10 | TC-T112 to TC-T118 pass; thresholds editable as data |
| BL-035 | Time | Gate pass with service-enforced ceiling and credit-back | P1 | CMP-01 | BL-031 | 5 | TC-T121, TC-T86 pass on app AND business messaging paths |
| BL-036 | Time | Overtime computation, eligibility, approval, run tagging | P1 | CMP-01 | BL-034 | 6 | TC-T130 to TC-T134 pass |
| BL-037 | Time | Exception queue and regularisation | P1 | CMP-01 | BL-031 | 6 | Unpaired punches surface, never disappear |
| BL-038 | Time | Attendance recompute worker with as-at reads and delta output | P1 | CMP-04 | BL-031 | 10 | 5,000 people, one month, under 10 minutes, interactive latency unaffected |
| BL-039 | Time | Team history view with export | P1 | CMP-08 | BL-034 | 5 | Works on a phone; scoped by reporting line at query time |

## Phase 2 — Pilot And Intelligence (Weeks 25-40)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-125 | Intelligence | Attendance Steward agent | P2 | CMP-11 | BL-123, BL-037 | 8 | Proposals carry a dry-run diff; reversal rate tracked |

## Open decisions blocking this domain

| ID | Decision | Why it matters | Blocks | Must close by | Owner | Current lean |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OD-08 | Default overtime basis: gross span or net hours | Affects every attendance golden case and the central rule pack default | BL-031, BL-110 | Phase 1 week 9 | Product + payroll SME | Gross for this client; default stated in the pack |
| OD-09 | Which Phase 1 absorption option we take for the four to six engineer-weeks v1.1 added | Deciding late is how Phase 1 quietly becomes Phase 1 and a half | BL-034, BL-040, BL-132 | Phase 0 exit | Deb / delivery lead | Preference order: move Performance to P3; defer the second ingestion source; extend P1 by three weeks |
| OD-10 | Break deduction default in the product (recorded-not-deducted vs deducted) | Changes net minutes, disposition and OT for every client | BL-031 | Phase 1 week 9 | Product | Configurable, no silent default |
| OD-13 | Agent autonomy defaults for the first tenant | Reversal rate is the number a prospect will ask for | BL-125 | Phase 2 | Product | Propose-only at first tenant |

## Open questions on client requirements

| Question ID | Requirement | Module | Question | Why the source does not answer it | What it affects | Who should answer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Q-01 | R-01 | ATT | Is the intermediate break deducted from paid hours? | The example gives total hours of 19:20 and OT of 7:20, which means the 45-minute break is not deducted. Confirm this is intended, and whether it holds for all break types or only the dinner break. | Changes OT cost on every long shift. | HR product owner with the client |
| Q-10 | R-12 | GPS | Does unused gate pass entitlement lapse each month? | The source gives a monthly entitlement but does not say whether it carries forward. | Affects the entitlement check and the utilisation report. | HR product owner with the client |
| Q-11 | R-13 | SHF | How often may the night extension be used? | The source states the rule without a frequency limit. | Without a cap the rule can be used to normalise late arrival. | HR product owner with the client |
| Q-12 | R-13 | ATT | Does the late counter reset on the calendar month or the payroll month? | These differ where the payroll cycle is not the calendar month. | Changes who receives the fourth-late half day and when. | HR product owner with the client |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| Approval authority (DOC-01 §7) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 19 | specified items (table rows) | Counted automatically at generation |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | items / hour | Compare with PPB control limits |
| Requirement volatility (changes since baseline) | 0 | CRs touching this artefact | Not yet baselined (CM-03) |

**Defects found, by detection phase and severity**

| Detection phase | Major | Minor | Editorial | Injected in phase (major) |
| :--- | :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 | — |
| Peer review | *pending* | | | |
| Design / build | | | | |
| System / integration test | | | | |
| UAT | | | | |
| Production (escaped) | | | | each escaped major opens a CAR record (CAR-01) |

Within control limits of the review-rate PPB? *To be assessed at peer review.*

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
