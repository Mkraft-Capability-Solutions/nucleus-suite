<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-EXP-10 — Experience — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-EXP-10 |
| Title | Experience — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Experience |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-EXP-00, FRS-EXP-01, FRS-EXP-02, FRS-EXP-03, FRS-EXP-04, FRS-EXP-05, FRS-EXP-06, FRS-EXP-07, FRS-EXP-08, FRS-EXP-09, FRS-EXP-10, FRS-EXP-11, FRS-EXP-12, FRS-EXP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-19, R-20, R-21, R-22 · processes EXP-01–EXP-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| EXP-01 | Recognition nomination, award and payout | Medium | P2 | CMP-01, CMP-03 |
| EXP-02 | Announcement generation and publish | Low | P2 | CMP-03r, CMP-07 |
| EXP-03 | Letter generation and issue register | Medium | P2 | CMP-03r, CMP-01 |

Forms specified: 3 with 35 fields; screens: 3; rules: 6.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-EXP-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| EXP-CG-001 | Employee listening surveys | HR MUST be able to run pulse and engagement surveys (eNPS) with anonymity thresholds, multilingual delivery and action planning. | Must | P3 |
| EXP-CG-002 | Wellbeing programmes | The system SHOULD manage wellbeing programmes, EAP access and opt-in challenges without storing health data beyond explicit consent. | Should | P3 |
| EXP-CG-003 | Communities and social feed | The system COULD provide moderated communities and a social feed for announcements, recognition and interest groups. | Could | P4 |
| EXP-CG-004 | Diversity, equity and inclusion analytics | HR MUST see representation, pay and progression metrics by permitted attributes with privacy thresholds and action tracking. | Must | P3 |
| EXP-CG-005 | Celebrations and milestones | The system SHOULD recognise birthdays, work anniversaries and milestones automatically, with manager and peer messages and opt-out. | Should | P2 |
| EXP-CG-006 | Internal communications and campaigns | HR SHOULD run targeted multilingual campaigns with acknowledgement tracking for policy and safety communications. | Should | P2 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EXP-FX-001 | Continuous listening with NLP themes | Themes and sentiment from surveys and helpdesk text in all supported languages with anonymity thresholds and action tracking. | Hear the workforce continuously, not annually. | Analytics projections | Tier 1 | P4 |
| EXP-FX-002 | Personalised multilingual communications | Announcements auto-adapted to the reader's language and role with human approval of translations for policy content. | Every worker understands every message. | Template renderer | Tier 2 | P4 |
| EXP-FX-003 | Recognition currency | Peer recognition points redeemable for rewards with tax treatment handled through payroll. | Recognition that is valued and compliant. | Ledger, PAY | No AI | P4 |
| EXP-FX-004 | Personal wellbeing companion (opt-in) | A private assistant suggesting breaks, leave and wellbeing resources from the employee's own data, never shared with managers. | Wellbeing support that respects privacy. | Policy Assistant | Tier 1 | P5 |

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
| Size | 13 | specified items (table rows) | Counted automatically at generation |
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
