<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-02 — Platform & Foundations — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-02 |
| Title | Platform & Foundations — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Platform & Foundations |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Platform, Scope And Approval

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-001 | An agent principal cannot exist without a named accountable human owner. | owner_principal_id | Mandatory | Code invariant | PLT-02.1, INT-01.1 | TC-P01 |
| RL-002 | A principal sees data only for the legal entities granted to it. | entity_grant | Per user | Admin UI | PLT-02.2 | TC-P02 |
| RL-003 | A principal sees time data only for the locations granted to it. | location_grant, can_edit_time | Per user | Admin UI | PLT-02.3 | TC-P03 |
| RL-004 | Effective scope is the intersection of tenant, entity, location, reporting line and payroll group. | — | Intersection, never union | Code invariant | PLT-02.4 | TC-P04 |
| RL-005 | Compensation fields return null to a principal outside the record's payroll group, even where time fields are visible. | salary field set | Null, not absent | Code invariant | PLT-02.5, SCR-022 | TC-P05 (runs every build) |
| RL-010 | Every approvable request routes through one chain definition resolved by request type, worker class, location and amount band. | chain_id | Per request type | approval_chain | PLT-05, LVE-04, TIM-06, CMB-03, TAL-01 | TC-P10 |
| RL-011 | Each step resolves its approver by role, position or named person, and starts an SLA clock. | resolution_mode, sla_hours | Per step | approval_chain | PLT-05.2 | TC-P11 |
| RL-012 | An approval queued against a principal who has left reroutes to the successor or the role holder; it never vanishes. | reroute_policy | Successor, then role | approval_chain | PLT-05.2 | TC-P12 |
| RL-013 | A decision records actor, timestamp, channel and, on rejection or return, a reason. | — | Reason mandatory on reject | Code invariant | PLT-05.3 | TC-P13 |
| RL-014 | Steps are sequential and mandatory unless the definition marks a step optional. | mandatory | Sequential: Supervisor → HOD → HR Head | approval_chain | LVE-04.1 | TC-L14 |
| RL-015 | HR may edit or close a request at any stage; the edit is logged with actor and reason. | — | Enabled | Role permission | PLT-05.6, LVE-04.4 | TC-L15 |
| RL-020 | A temporal fact is never updated in place; a new version is written and the prior version end-dated. | valid_from/to, recorded_from/to | Always | Code invariant | PLT-08, PPL-02.3 | TC-P20 |
| RL-021 | An as-at read takes valid_at and recorded_at; payroll and recompute must pass the snapshot timestamp, not now. | valid_at, recorded_at | Snapshot for derived work | Code invariant | PLT-08.3, TIM-09.2 | TC-P21 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

| Rule ID | Module | Rule | Requirement | Statement | Worked example | Where it is configured |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BS:RL-24 | SEC | Salary visibility by payroll location | R-09 | Where payroll processing location differs from attendance location, salary and rate structure are visible only to roles scoped to the payroll location. The restriction applies to screens, reports, exports and the API alike. | A plant user sees attendance for a head-office-paid employee but not the salary or rate structure. | Role & Data Scope Setup |

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
| Size | 14 | specified items (table rows) | Counted automatically at generation |
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
