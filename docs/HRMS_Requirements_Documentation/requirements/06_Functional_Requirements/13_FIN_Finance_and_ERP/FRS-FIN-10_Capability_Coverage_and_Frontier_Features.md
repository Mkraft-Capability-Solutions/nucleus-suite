<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-10 — Finance & ERP — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-10 |
| Title | Finance & ERP — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| FIN-01 | ERP employee master inbound sync | Critical | P1 | CMP-07, CMP-10 |
| FIN-02 | GL mapping maintenance and validation | Critical | P1 | CMP-10 |
| FIN-03 | Salary journal generation and posting | Critical | P1 | CMP-03 |
| FIN-04 | Reconciliation reporting | Critical | P1 | CMP-08 |
| FIN-05 | Bank file generation and dual control | Critical | P1 | CMP-05 |

Forms specified: 2 with 17 fields; screens: 4; rules: 14.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-FIN-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| FIN-CG-001 | Labour cost allocation to projects | Payroll costs MUST be allocable across cost centres, projects and grants by percentage or by timesheet, reflected in the salary journal. | Must | P2 |
| FIN-CG-002 | Leave and gratuity liability accruals | The system MUST compute monthly accruals for leave encashment and gratuity liability and post them to the GL. | Should | P3 |
| FIN-CG-003 | Headcount and workforce budget vs actual | Finance MUST be able to compare budgeted headcount and cost to actuals by entity, site and cost centre. | Should | P3 |
| FIN-CG-004 | Travel and expense management | Employees MUST submit travel requests and expense claims with policy limits, receipt capture, approval routing, advances settlement and ERP posting. | Must | P3 |
| FIN-CG-005 | Benefits and statutory liability accounting | The system MUST post employer statutory contributions, benefit costs and liabilities to the GL with period accruals and reversals. | Must | P2 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-FX-001 | Continuous labour-cost ledger | Labour cost accrues daily by cost centre and project from time and pay events, enabling continuous close. | Finance sees cost as it is incurred. | Outbox, ledger | No AI | P5 |
| FIN-FX-002 | Workforce cost scenario planning | Monte Carlo projections of workforce cost under hiring, attrition and pay-increase scenarios. | Planning with probability, not single numbers. | Analytics projections | Tier 1 | P5 |
| FIN-FX-003 | AI bank and ERP reconciliation | Matches disbursements and journal postings to bank statements and ERP acknowledgements, surfacing exceptions. | Zero-gap reconciliation. | Outbox | Tier 2 | P4 |
| FIN-FX-004 | Real-time workforce P&L | Shows labour cost, productivity and revenue per site or line in near real time for plant heads. | Connects people decisions to business results. | Continuous labour-cost ledger | Tier 1 | P5 |

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
