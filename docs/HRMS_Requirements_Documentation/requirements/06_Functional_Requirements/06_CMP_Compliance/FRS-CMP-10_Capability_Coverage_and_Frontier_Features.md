<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-10 — Compliance — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-10 |
| Title | Compliance — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compliance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| CMP-01p | Rule pack authoring, test and deployment | Critical | P1 | CMP-09 |
| CMP-02p | Obligation calendar and filing | Critical | P1 | CMP-01 |
| CMP-03p | Statutory form and register generation | Critical | P1 | CMP-03r, CMP-09 |
| CMP-04p | Labour Codes wage-base simulation | High | P2 | CMP-03 |
| CMP-05p | AI governance logging and disclosure | High | P2 | CMP-06 |
| CMP-06p | DPDP consent, retention and erasure | High | P3 | CMP-06 |

Forms specified: 1 with 12 fields; screens: 4; rules: 12.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-CMP-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| CMP-CG-001 | Labour code readiness pack | The rule-pack engine MUST carry versioned rule packs for the consolidated labour codes (wages, social security, industrial relations, OSH) switchable by effective date when notified (to be validated by Legal). | Must | P2 |
| CMP-CG-002 | POSH case management | The system MUST provide confidential case intake, Internal Committee workflow, timelines and annual report generation for workplace harassment cases with restricted access. | Must | P2 |
| CMP-CG-003 | Contract labour (CLRA) registers | The system MUST maintain contractor registers, licences and returns required for principal employers (to be validated by Legal). | Must | P2 |
| CMP-CG-004 | ESG / BRSR workforce disclosures | The system SHOULD generate workforce disclosures for sustainability reporting (headcount, diversity, wages, turnover, safety, training hours) with data lineage. | Should | P3 |
| CMP-CG-005 | Compliance training tracking | Mandatory compliance training (POSH, safety, code of conduct) MUST be assigned by rule, tracked to completion and escalated when overdue. | Must | P2 |
| CMP-CG-006 | Environment, health and safety incident management | Sites MUST record incidents and near-misses, investigate root cause, track corrective actions and generate statutory accident notices within the required time (to be validated by Legal). | Must | P2 |
| CMP-CG-007 | Grievance and whistle-blower channel | Employees MUST be able to raise grievances and protected disclosures, including anonymously, with confidential case handling, escalation timelines and outcome reporting. | Must | P2 |
| CMP-CG-008 | Licence and registration renewals | The system MUST track factory licences, establishment registrations and contractor licences with expiry alerts and renewal workflow. | Must | P2 |
| CMP-CG-009 | Inspection visit register | Sites MUST record statutory inspection visits, remarks and orders, and track compliance actions to closure. | Must | P2 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMP-FX-001 | Regulatory change radar | Monitors official notifications, summarises changes and drafts rule-pack updates for compliance approval with citations. | Compliance that keeps pace with regulation automatically. | Rule pack evaluator, Compliance Watcher | Tier 3 | P5 |
| CMP-FX-002 | Continuous compliance score | Live compliance posture per entity and site (filings, registers, training, contractor challans) with predicted exposure. | From annual audits to continuous assurance. | Obligation calendar | Tier 1 | P4 |
| CMP-FX-003 | Inspection-ready pack in one click | Assembles registers, returns and evidence for an inspector visit, scoped to the site and period. | Hours instead of days of preparation. | Compliance Watcher agent | Tier 2 | P3 |
| CMP-FX-004 | Compliance copilot for inspectors' questions | Answers an inspector's or auditor's question with cited registers and evidence, scoped and logged. | Audits move from days to minutes. | Compliance Watcher, action ledger | Tier 2 | P5 |

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
