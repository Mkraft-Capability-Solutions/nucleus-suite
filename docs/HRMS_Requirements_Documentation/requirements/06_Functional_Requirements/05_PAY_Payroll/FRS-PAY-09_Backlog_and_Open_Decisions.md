<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-09 — Payroll — Backlog and Open Decisions

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-09 |
| Title | Payroll — Backlog and Open Decisions |
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
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 18_Build_Backlog, 22_Open_Decisions<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 11_Open_Questions |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## Phase 1 — Core Hrms (Weeks 9-24)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-050 | Payroll | Run types, lifecycle states, input lock and hashed snapshot | P1 | CMP-05 | BL-005 | 8 | A run recomputes to the paisa from its snapshot |
| BL-051 | Payroll | Gross-to-net DAG with integer money and trace capture | P1 | CMP-03 | BL-050 | 14 | Every payslip line drills to its rule and inputs |
| BL-052 | Payroll | Wage-base node with the 50% floor add-back | P1 | CMP-03 | BL-051 | 6 | TC-Y280 to TC-Y282 pass; node testable in isolation |
| BL-053 | Payroll | Daily-wage earnings node | P1 | CMP-03 | BL-051 | 4 | TC-Y290 passes; day count visible on the payslip |
| BL-054 | Payroll | Central rule pack plus Karnataka: PF, ESI, PT, LWF, 24Q | P1 | CMP-09 | BL-051 | 14 | 300 payroll golden cases green |
| BL-055 | Payroll | Pre-payroll audit with the eleven rule checks and severity gating | P1 | CMP-05 | BL-051 | 8 | A CRITICAL flag blocks approval |
| BL-056 | Payroll | Loan deduction node with the net-pay floor | P1 | CMP-03 | BL-051, BL-070 | 4 | TC-Y311, TC-Y312 pass |
| BL-057 | Payroll | Off-cycle overtime run with its own bank file and journal | P1 | CMP-03 | BL-051, BL-036 | 6 | TC-Y330, TC-F333 pass; run selector everywhere |
| BL-058 | Payroll | Payslip, bank file, dual control, rollback | P1 | CMP-05 | BL-051 | 8 | Rollback blocked past DISBURSEMENT_PREPARED |

## Open decisions blocking this domain

| ID | Decision | Why it matters | Blocks | Must close by | Owner | Current lean |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OD-14 | Payroll SME: hire or retain as a reviewer | The highest-risk gap in the team; silent wrongness otherwise | BL-054, BL-090 | Phase 0 — non-negotiable | Deb | Retain a practising consultant |

## Open questions on client requirements

_No entries in source for this scope._

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
| Size | 10 | specified items (table rows) | Counted automatically at generation |
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
