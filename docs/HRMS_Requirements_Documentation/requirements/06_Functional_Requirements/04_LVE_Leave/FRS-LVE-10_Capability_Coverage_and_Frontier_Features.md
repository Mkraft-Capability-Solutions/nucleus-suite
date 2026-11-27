<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-10 — Leave — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-10 |
| Title | Leave — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Leave |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| LVE-01 | Leave accrual run | Critical | P1 | CMP-02, CMP-10 |
| LVE-02 | Joining-month proration | High | P1 | CMP-02, CMP-10 |
| LVE-03 | Leave request validation | High | P1 | CMP-02 |
| LVE-04 | Leave approval chain | High | P1 | CMP-01 |
| LVE-05 | Early return and re-credit | Critical | P1 | CMP-02, CMP-04 |
| LVE-06 | Comp-off credit and expiry | High | P1 | CMP-02 |
| LVE-07 | Year-end encashment, lapse and birthday leave | High | P1 | CMP-02 |
| LVE-08 | Balance projection from the ledger | Critical | P1 | CMP-02 |

Forms specified: 4 with 72 fields; screens: 3; rules: 26.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-LVE-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| LVE-CG-001 | Statutory maternity and paternity tracking | The system MUST manage maternity benefit leave, medical documentation, nursing breaks and return-to-work milestones per applicable statute (to be validated by Legal). | Must | P1 |
| LVE-CG-002 | Leave of absence (long, unpaid, sabbatical) | The system MUST support leave of absence with effect on service continuity, benefits eligibility and payroll, and return-from-leave workflow. | Must | P2 |
| LVE-CG-003 | Leave donation / shared leave bank | The system COULD allow employees to donate earned leave to a colleague or a pooled bank under policy limits with HR approval. | Could | P3 |
| LVE-CG-004 | Calendar integration | Approved leave SHOULD be published to the employee's and team's corporate calendars as out-of-office entries. | Should | P2 |
| LVE-CG-005 | Optional and restricted holidays | The system MUST support optional/restricted holiday quotas by location and religion-neutral choice lists. | Must | P1 |
| LVE-CG-006 | Leave policy simulator | HR MUST be able to simulate a proposed leave policy change against historical balances and requests and see the effect on balances, liability and coverage before publishing. | Must | P2 |
| LVE-CG-007 | Team coverage rules | Managers MUST be able to define minimum staffing per team or line; leave requests that would breach coverage MUST be flagged at application time. | Must | P2 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LVE-FX-001 | Coverage-aware leave planner | Suggests leave dates that minimise team coverage gaps and shows sandwich-rule impact transparently before applying. | Better planning for employees and managers alike. | Eligibility service, ledger | Tier 1 | P4 |
| LVE-FX-002 | Within-policy auto-approval agent | Approves leave automatically when policy, balance and coverage conditions are met, with full ledger entry and manager override. | Removes routine approval latency safely. | CMP-01 approval engine, action ledger | Tier 2 | P4 |
| LVE-FX-003 | Burnout nudges | Nudges employees and managers when no leave has been taken for a configurable period. | Wellbeing built into absence management. | Ledger | Tier 1 | P4 |
| LVE-FX-004 | Leave liability forecasting | Projects encashment liability by entity and cost centre for finance. | Links absence to financial planning. | Ledger, FIN | Tier 1 | P4 |
| LVE-FX-005 | Predictive absence planning | Forecasts absence peaks (festivals, harvest season, weather) by site so supervisors can plan rosters and contract labour in advance. | Turns absence from surprise into plan. | Analytics projections | Tier 2 | P5 |

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
| Size | 20 | specified items (table rows) | Counted automatically at generation |
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
