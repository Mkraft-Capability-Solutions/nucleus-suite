<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-10 — Time & Attendance — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-10 |
| Title | Time & Attendance — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| TIM-01 | Punch ingestion from all sources | Critical | P1 | CMP-07 |
| TIM-02 | Attendance day derivation | Critical | P1 | CMP-04, CMP-10 |
| TIM-03 | Shift inference from in-punch | High | P1 | CMP-04 |
| TIM-04 | Day type resolution | Critical | P1 | CMP-10 |
| TIM-05 | Disposition — grace, lates, half-day, absent, relief | Critical | P1 | CMP-04, CMP-10 |
| TIM-06 | Gate pass request, approval and credit | High | P1 | CMP-01, CMP-02 |
| TIM-07 | Overtime computation and approval | Critical | P1 | CMP-01, CMP-04 |
| TIM-08 | Exception queue and regularisation | High | P1 | CMP-01, CMP-04 |
| TIM-09 | Attendance recompute | Critical | P1 | CMP-04 |
| TIM-10 | Team history and operational time reports | High | P1 | CMP-08 |

Forms specified: 8 with 107 fields; screens: 8; rules: 55.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-TIM-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| TIM-CG-001 | Project and task timesheets | Knowledge workers MUST be able to log time against projects, tasks and cost centres with approval routing and costing to FIN. | Should | P3 |
| TIM-CG-002 | Mobile geofenced and selfie attendance | Field and remote workers MUST be able to punch from mobile within configured geofences with liveness-checked selfie capture; biometric templates MUST NOT leave the device unless consented. | Must | P1 |
| TIM-CG-003 | Shift swap and open-shift marketplace | Workers SHOULD be able to request shift swaps and pick open shifts subject to qualification, rest-period and overtime rules, with supervisor approval. | Should | P3 |
| TIM-CG-004 | Flexi-time and time banking | The system SHOULD support core-hours flexi-time, time-bank credit/debit and conversion to leave or overtime per policy. | Could | P3 |
| TIM-CG-005 | Labour-demand scheduling | The system SHOULD generate rosters from forecast labour demand per line/site, honouring skills, statutory limits and worker preferences. | Should | P4 |
| TIM-CG-006 | Overtime pre-approval and budget control | Overtime above configured thresholds MUST be pre-approved against a line or cost-centre OT budget, with unapproved overtime flagged before payroll lock. | Must | P1 |
| TIM-CG-007 | Canteen and transport integration | Plant sites SHOULD reconcile canteen consumption and company transport usage with attendance for subsidy, deduction and roster planning. | Should | P3 |
| TIM-CG-008 | Hybrid work and desk booking | Office employees SHOULD declare work location (office, home, client site), book desks and see team presence, with location feeding attendance rules. | Should | P3 |
| TIM-CG-009 | Wearable and IoT presence (opt-in) | Sites COULD accept presence signals from approved wearables or access beacons, only with recorded consent and without continuous location tracking. | Could | P4 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TIM-FX-001 | AI roster optimiser | Generates rosters from demand forecasts, skills, fatigue rules, statutory limits and preferences; explains each assignment and leaves final approval to supervisors. | Optimisation-grade scheduling for plants, not just shift templates. | Rule pack evaluator | Tier 2 | P5 |
| TIM-FX-002 | Fatigue and safety risk scoring | Flags consecutive night shifts, short rest gaps and excessive overtime before they occur, with supervisor alerts. | Links time data to worker safety outcomes. | Recompute worker | Tier 2 | P4 |
| TIM-FX-003 | Punch anomaly detection | Detects buddy-punching patterns, device clock drift and impossible travel between sites for review. | Protects payroll integrity at the source. | Ingestion pipeline | Tier 2 | P4 |
| TIM-FX-004 | Voice punch with geofence | Nucleus Talk accepts 'punch in' in any supported language, validated by geofence and device binding. | Hands-free punching for frontline workers. | Tool surface | Tier 1 | P3 |
| TIM-FX-005 | OT budget burn forecasting | Predicts month-end overtime cost per line from current trends and alerts plant heads early. | Cost control before payroll, not after. | Analytics projections | Tier 1 | P4 |
| TIM-FX-006 | Computer-vision-free presence assurance | Presence is confirmed through device binding, geofence and liveness without storing images centrally. | Strong attendance integrity with privacy by design. | Ingestion pipeline | Tier 1 | P4 |

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
| Size | 25 | specified items (table rows) | Counted automatically at generation |
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
