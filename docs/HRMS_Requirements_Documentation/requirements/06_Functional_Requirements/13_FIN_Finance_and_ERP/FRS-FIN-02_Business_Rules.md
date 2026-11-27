<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-02 — Finance & ERP — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-02 |
| Title | Finance & ERP — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Finance And Integration

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-510 | Master-data direction is a per-tenant choice of Nucleus-owned, ERP-owned or co-owned. | master_mode | Co-owned is the common answer | integration_config | FIN-01.1 | TC-F510 (demo point 14) |
| RL-511 | In co-owned mode no field has two owners and every mandatory field has one. | — | Validated | Code invariant | FIN-01.2 | TC-F511 |
| RL-512 | Inbound sync runs through the integration service; domain modules never call the ERP directly. | — | Enforced | Architecture | FIN-01.3 | TC-F512 |
| RL-513 | Upserts are idempotent on the external employee code and rejected on a repeated payload hash. | — | Idempotent | Code invariant | FIN-01.4 | TC-F513 |
| RL-514 | A conflict on a Nucleus-owned field is held for review; conflict policy is explicit configuration, never implicit last-write-wins. | conflict_policy | Explicit | integration_config | FIN-01.5 | TC-F514 |
| RL-515 | ERP-owned fields are read-only in the Nucleus UI. | — | Enforced | Code invariant | FIN-01.6 | TC-F515 |
| RL-516 | An unmatched external employee code is parked for resolution and never auto-creates a person. | — | Parked | Code invariant | FIN-01.7 | TC-F516 |
| RL-520 | Cost is split at employee level from the assignment as it stood in the pay period, before aggregation. | dimensions | Cost centre, department, location, project, custom | gl_mapping | FIN-03.1 | TC-F520 |
| RL-521 | Every pay component in a run must have a GL mapping before the run can be approved. | — | Blocking | Code invariant | FIN-03.2 | TC-F521 (demo point 15) |
| RL-522 | One balanced journal per run per legal entity, with run type as a dimension. | — | Per run | Code invariant | FIN-03.3 | TC-F522 |
| RL-523 | Delivery is by API, structured file, staging table or manual download, and the result is recorded either way. | mechanisms | ERP-native XML voucher, CSV, native, API | integration_config | FIN-03.4 | TC-F523 |
| RL-524 | The finance system's document number is written back onto the payroll run. | — | Always | Code invariant | FIN-03.5 | TC-F524 |
| RL-530 | Seven reconciliation assertions must pass and be shown passing: gross, net vs bank, statutory vs challan, dimension residue, overtime, loan movement, drill-through. | — | All seven | Product | FIN-04.1 | TC-F530 |
| RL-531 | Every GL line drills back to contributing employees and payslip lines. | — | Always | Product | FIN-04.2 | TC-F531 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

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
