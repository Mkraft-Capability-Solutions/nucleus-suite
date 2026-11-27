<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-07 — Time & Attendance — APIs, Integrations and Agents

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-07 |
| Title | Time & Attendance — APIs, Integrations and Agents |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 13_API_and_Tools, 14_Agents, 15_Integration_Flows<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Form CRUD endpoints

| Form ID | Form | Target object | Endpoint |
| :--- | :--- | :--- | :--- |
| FRM-TIM-01 | Shift Master | shift_master | /api/v1/ops/modules/shift_master/records |
| FRM-TIM-02 | Roster / Shift Schedule | roster_schedule | /api/v1/ops/modules/roster_schedule/records |
| FRM-TIM-03 | Check In / Check Out | check_in_out | /api/v1/attendance/punches |
| FRM-TIM-04 | Attendance Day Detail and Override | attendance_detail | /api/v1/ops/modules/attendance_detail/records |
| FRM-TIM-05 | Attendance Regularisation Request | my_attendance | /api/v1/attendance/days |
| FRM-TIM-06 | Gate Pass | gate_passes | /api/v1/gate-passes |
| FRM-TIM-07 | Overtime Register and Approval | overtime_register | /api/v1/ot-requests |
| FRM-TIM-08 | Attendance Exception Resolution | attendance_exceptions | /api/v1/regularizations |

## 2. Public REST and governed tool surface

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REST | /v1/attendance/events | POST | Bulk punch ingestion | time.ingest | write | No | Device agents, kiosks | Idempotent on (person, ts, device) |
| REST | /v1/attendance/days | GET | Derived days with totals, status and provenance | time.read | read | — | Manager apps, analytics | Scope-resolved; pay fields never present |
| REST | /v1/attendance/recompute | POST | Request recompute for a person and range | time.admin | write | Yes | Admin, integrations | Rejected for locked periods |
| REST | /v1/gate-passes | GET, POST | Request and list gate passes | time.self | write | No | Apps, business messaging | Ceiling enforced server-side |
| TOOL | list_exceptions | read | Open attendance exceptions for a scope | time.read | read | — | Attendance Steward | Drives the daily triage |
| TOOL | propose_regularisation | propose | Draft a regularisation with evidence | time.propose | propose | Yes | Attendance Steward | Human approves unless under the tenant threshold |

### Additional interfaces (Authored)

| Surface | Name | Method / class | Purpose | Permission | Side effect | Consumed by | Defined in |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REST | /v1/attendance/devices/{device_id}/heartbeat | POST | Site agent or terminal liveness signal with buffer depth and clock offset for the device health report | time.ingest | write | Site agents, biometric terminals | ICD-01 §10.1, §10.4 (TIM-INT-001) |

## 3. Integration flows

| Flow | Direction | Mechanism | Cadence | Payload | Ownership / rules | Reconciliation | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Biometric and access-control devices | Device → Nucleus | Device SDK, push webhook, or site agent polling the buffer | Continuous | Punch events with device ID and timestamp | Offline buffering assumed; clock drift corrected with the raw value retained | Device health: expected vs received event counts per shift | P1 |

Payload-level specifications are in ICD-01.

## 4. Agents operating in this domain

| Agent | Cadence | What it does | Tools used | Autonomy default | Approval threshold | Ledger fields | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Attendance Steward | Daily | Triages the exception queue, proposes regularisations, flags unpaired punches and inferred shifts, drafts manager nudges | list_exceptions, propose_regularisation, read_employee | Propose only; auto under the configured threshold | Tenant-set minutes threshold | exception_id, evidence, proposed_change, simulation, approver, outcome | P2 |

## 5. API requirements (Authored)

- Public REST MUST be described in OpenAPI 3.1, versioned, with a sandbox tenant per partner (IA-01).
- Every write MUST accept an `Idempotency-Key` and return the effective-dated version it created.
- The tool surface is built once and exposed twice (internal agents and external MCP clients); every tool call MUST pass the policy gate and be recorded in the action ledger.

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
| Size | 17 | specified items (table rows) | Counted automatically at generation |
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
