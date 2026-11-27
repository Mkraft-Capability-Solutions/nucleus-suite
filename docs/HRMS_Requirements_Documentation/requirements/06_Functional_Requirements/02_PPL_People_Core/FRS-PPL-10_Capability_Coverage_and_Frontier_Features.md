<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-10 — People Core — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-10 |
| Title | People Core — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — People Core |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| PPL-01 | Create person, position and assignment | Critical | P1 | CMP-10, CMP-08 |
| PPL-02 | Assignment change (effective-dated, retro-capable) | Critical | P1 | CMP-10, CMP-01 |
| PPL-03 | Worker class and policy attribute resolution | Critical | P1 | CMP-10 |
| PPL-04 | Position control and sanctioned strength | High | P3 | CMP-10 |
| PPL-05 | Org unit change and reorganisation | Medium | P1 | CMP-10 |
| PPL-06 | Document capture, classification and expiry | Medium | P1 | CMP-08 |
| PPL-07 | Rehire, entity transfer and class change | High | P2 | CMP-10 |
| PPL-08 | Duplicate person detection | High | P2 | CMP-11 |

Forms specified: 6 with 210 fields; screens: 6; rules: 23.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-PPL-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| PPL-CG-001 | Job architecture | The system MUST maintain job families, job profiles, grades/bands and competency/skill requirements as effective-dated objects referenced by positions and assignments. | Must | P1 |
| PPL-CG-002 | Matrix and multiple organisation hierarchies | The system MUST support concurrent supervisory, cost-centre, location, legal-entity, project and matrix (dotted-line) hierarchies, each effective-dated and usable for routing and security. | Must | P1 |
| PPL-CG-003 | Global assignment and expatriate management | The system SHOULD support host/home assignments, split payroll indicators, shadow payroll flags, assignment allowances and visa/permit expiry tracking. | Should | P4 |
| PPL-CG-004 | Dependants, nominees and emergency contacts | The system MUST hold dependants and nominees (PF, gratuity Form F, insurance) with share percentages that MUST total 100% per nomination type. | Must | P1 |
| PPL-CG-005 | Mass reorganisation | HR MUST be able to stage a reorganisation (move org units, positions and people) as a single effective-dated change set with preview of routing and security impact before commit. | Must | P2 |
| PPL-CG-006 | Interactive org chart | The system MUST render an interactive organisation chart with drill-down, vacancy display, headcount and span-of-control, filterable by entity and location scope. | Must | P1 |
| PPL-CG-007 | Concurrent employment and multiple assignments | A person MUST be able to hold more than one concurrent assignment (different entity, position or worker class) with separate pay, time and security treatment. | Must | P2 |
| PPL-CG-008 | Headcount and position planning | HR and finance MUST be able to plan positions and headcount by period, site and cost centre against sanctioned strength, with approval workflow and variance tracking. | Must | P3 |
| PPL-CG-009 | Digital employee ID and verifiable employment letter | Employees MUST be able to present a digital ID card and download verifiable employment and salary certificates generated on demand. | Should | P2 |
| PPL-CG-010 | Organisation health metrics | Managers and HR SHOULD see span of control, layers, vacancy age, tenure mix and flight-risk concentration per organisation unit. | Should | P3 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PPL-FX-001 | Organisation digital twin | A live model of the organisation supports what-if reorganisations showing cost, span of control, routing changes and attrition risk before commit. | Turns reorganisation from spreadsheet guesswork into simulated decisions. | Effective-dated write, analytics projections | Tier 3 | P5 |
| PPL-FX-002 | AI data-quality steward | An agent continuously detects missing statutory identifiers, inconsistent worker-class attributes and duplicate persons, and proposes fixes for HR confirmation. | Proactive master-data quality instead of month-end clean-up. | Tool surface, action ledger | Tier 2 | P4 |
| PPL-FX-003 | Verifiable credentials wallet | Education, experience and certification credentials can be issued and verified as W3C Verifiable Credentials, reducing background-check time. | Portable, tamper-proof employment records. | Template renderer | No AI | P5 |
| PPL-FX-004 | Explainable attrition risk | Per-team attrition risk with top drivers and recommended actions, visible only to authorised HR with explanation and opt-out of individual scoring where required. | Predictive retention with transparency and fairness controls. | Analytics projections | Tier 3 | P5 |
| PPL-FX-005 | Conversational profile updates | Employees update address, nominees or bank details by voice or business messaging with identity re-verification and document capture. | Self-service for workers who do not use desktops. | SSV channel, tool surface | Tier 2 | P3 |
| PPL-FX-006 | Self-updating skills and career profile | Profiles update from completed learning, projects and certifications with the employee approving each suggested change. | Profiles stay current without forms. | Skills cloud | Tier 2 | P4 |

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
| Size | 24 | specified items (table rows) | Counted automatically at generation |
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
