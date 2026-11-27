<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CTG-10 — Contingent Workforce — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CTG-10 |
| Title | Contingent Workforce — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Contingent Workforce |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-CTG-00, FRS-CTG-01, FRS-CTG-02, FRS-CTG-03, FRS-CTG-04, FRS-CTG-05, FRS-CTG-06, FRS-CTG-07, FRS-CTG-08, FRS-CTG-09, FRS-CTG-10, FRS-CTG-11, FRS-CTG-12, FRS-CTG-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · processes CTG-01–CTG-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| CTG-01 | Contractor engagement and worker registration | High | P3 | CMP-10 |
| CTG-02 | Contractor attendance and invoice reconciliation | High | P3 | CMP-04 |
| CTG-03 | Principal employer compliance verification | High | P3 | CMP-01 |

Forms specified: 2 with 24 fields; screens: 1; rules: 3.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-CTG-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| CTG-CG-001 | Vendor management for contract labour | The system MUST maintain contractor vendors with licences, rate cards, statutory registration numbers, and headcount caps per site. | Must | P2 |
| CTG-CG-002 | Statutory challan verification | The system MUST collect vendors' monthly PF/ESI challans and wage registers and reconcile them against deployed contract workers before invoice approval. | Must | P2 |
| CTG-CG-003 | Safety induction and PPE issue | Contract workers MUST complete site safety induction and PPE issue before gate access is activated. | Must | P2 |
| CTG-CG-004 | Contract worker gate attendance and wage validation | The system MUST reconcile contractor wage payments with gate attendance and minimum-wage rules before releasing contractor invoices. | Must | P2 |
| CTG-CG-005 | Contractor workforce planning | Plant HR SHOULD forecast contract labour requirements by line and season and compare with vendor capacity. | Should | P3 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CTG-FX-001 | Contractor compliance score | Scores vendors from challan, wage-register and safety evidence read by AI document extraction, reviewed by compliance. | Principal-employer risk under control. | Compliance Watcher agent | Tier 2 | P4 |
| CTG-FX-002 | Invoice-to-attendance auto-reconciliation | Matches contractor invoices to gate attendance and rate cards and proposes approve/hold with reasons. | Stops over-billing automatically. | Recompute worker, outbox | Tier 2 | P4 |
| CTG-FX-003 | On-demand plant labour pool | Pre-verified contract workers can be called for short-term demand with instant onboarding. | Flexible capacity with compliance intact. | Eligibility service | Tier 1 | P5 |
| CTG-FX-004 | Contract labour digital passport | A worker-held verifiable record of skills, safety training and work history usable across contractors and sites (with consent). | Faster, safer deployment of contract labour. | Verifiable credentials | No AI | P5 |

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
| Size | 12 | specified items (table rows) | Counted automatically at generation |
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
