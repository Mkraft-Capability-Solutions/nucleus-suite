<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-SSV-10 — Self-service & Helpdesk — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-SSV-10 |
| Title | Self-service & Helpdesk — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Self-service & Helpdesk |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-SSV-00, FRS-SSV-01, FRS-SSV-02, FRS-SSV-03, FRS-SSV-04, FRS-SSV-05, FRS-SSV-06, FRS-SSV-07, FRS-SSV-08, FRS-SSV-09, FRS-SSV-10, FRS-SSV-11, FRS-SSV-12, FRS-SSV-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-03 · processes SSV-01–SSV-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| SSV-01 | Employee self-service action | High | P1 | CMP-08 |
| SSV-02 | Manager unified approval inbox | High | P1 | CMP-01, CMP-08 |
| SSV-03 | business messaging channel transaction | High | P2 | CMP-02, CMP-08 |
| SSV-04 | Helpdesk ticket | Medium | P2 | CMP-01 |
| SSV-05 | Grounded policy answer | Medium | P2 | CMP-11, CMP-06 |

Forms specified: 1 with 13 fields; screens: 3; rules: 7.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-SSV-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| SSV-CG-001 | HR service catalogue and knowledge base | The system MUST provide a searchable service catalogue and versioned knowledge base with article ownership, review dates and multilingual variants. | Must | P1 |
| SSV-CG-002 | Employee journeys | HR SHOULD be able to compose guided journeys (new parent, relocation, first-time manager) of tasks, content and nudges. | Should | P3 |
| SSV-CG-003 | Accessibility conformance | All self-service surfaces MUST conform to WCAG 2.2 AA and support screen readers, keyboard-only use and high-contrast themes. | Must | P1 |
| SSV-CG-004 | Native mobile application | The system MUST provide mobile apps with offline read of payslips, balances and documents, and biometric app unlock. | Must | P2 |
| SSV-CG-005 | Omnichannel virtual HR agent | Employees MUST reach the same HR assistant through web, mobile, kiosk, voice and the business messaging channel, with conversation continuity across channels. | Must | P2 |
| SSV-CG-006 | Confidential HR case management | Sensitive cases (medical, harassment, disciplinary) MUST be handled in restricted case queues with need-to-know access and separate audit. | Must | P2 |
| SSV-CG-007 | Document self-service on demand | Employees MUST be able to generate standard letters (address proof, salary certificate, experience letter) instantly from approved templates with digital signature. | Must | P2 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SSV-FX-001 | Voice-first HR in 11 languages | Nucleus Talk handles queries and transactions by voice, including an IVR fallback for workers without smartphones. | Inclusive access for low-literacy and frontline workforce. | Policy Assistant, tool surface | Tier 2 | P4 |
| SSV-FX-002 | Proactive nudges | The system notifies people before they need to ask (expiring documents, pending PF transfer, unclaimed reimbursement). | Service that anticipates rather than reacts. | Event bus | Tier 1 | P3 |
| SSV-FX-003 | End-to-end task agents | Multi-step requests (e.g. address change + new bank + updated nominee) are completed by an agent with one confirmation. | Fewer forms, fewer clicks. | Tool surface, action ledger | Tier 2 | P4 |
| SSV-FX-004 | Shop-floor kiosk mode | Shared kiosks with badge/face login for payslips, leave and helpdesk on the factory floor. | Self-service where workers actually are. | Scope resolver | No AI | P3 |
| SSV-FX-005 | Emotion-free sentiment-aware routing | Routes cases by urgency signals in text (never inferred emotions about individuals) to the right specialist with SLA. | Faster help for urgent cases without intrusive profiling. | Case management | Tier 2 | P4 |

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
