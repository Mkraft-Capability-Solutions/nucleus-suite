<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-10 — Lifecycle — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-10 |
| Title | Lifecycle — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Lifecycle |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| LCY-01 | Pre-boarding | High | P1 | CMP-01 |
| LCY-02 | Joining chain | Critical | P1 | CMP-01, CMP-03r |
| LCY-03 | Probation and confirmation | Medium | P2 | CMP-01, CMP-03r |
| LCY-04 | Promotion and transfer | High | P2 | CMP-01, CMP-10 |
| LCY-05 | Resignation and notice | High | P1 | CMP-01 |
| LCY-06 | Clearance / no-dues | Critical | P1 | CMP-01, CMP-05 |
| LCY-07 | F&F settlement on the last working day | Critical | P1 | CMP-03, CMP-05 |
| LCY-08 | Asset allocation and return | Medium | P1 | CMP-01 |

Forms specified: 4 with 51 fields; screens: 3; rules: 12.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-LCY-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| LCY-CG-001 | Background verification orchestration | The system MUST initiate background verification with vendors, track check status per component and gate joining on configurable mandatory checks. | Must | P2 |
| LCY-CG-002 | Internal mobility and transfer journeys | Employees MUST be able to apply for internal roles and HR MUST be able to run inter-entity transfers with continuity of service, leave and statutory accounts. | Must | P2 |
| LCY-CG-003 | Rehire eligibility and alumni | The system SHOULD record rehire eligibility at exit and maintain an alumni record for boomerang hiring with consent. | Should | P3 |
| LCY-CG-004 | Exit interview and attrition reasons | The system MUST capture structured exit reasons and exit-interview responses for attrition analytics with anonymised reporting. | Must | P2 |
| LCY-CG-005 | Probation review automation | The system MUST schedule probation reviews before the due date, collect manager assessment and drive confirm, extend or separate outcomes with letters. | Must | P1 |
| LCY-CG-006 | Contract-to-permanent conversion | HR MUST be able to convert contract or trainee workers to permanent employment with service continuity rules, revised worker class and statutory re-registration. | Must | P2 |
| LCY-CG-007 | Notice period management and buy-out | The system MUST compute notice period, shortfall, buy-out amount and leave adjustment, and feed the result to full-and-final settlement. | Must | P1 |
| LCY-CG-008 | Knowledge transfer at exit | Exiting employees SHOULD complete a structured hand-over plan (documents, access, responsibilities) approved by the manager before clearance closes. | Should | P3 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LCY-FX-001 | Agentic onboarding concierge | Orchestrates BGV, IT accounts, assets, induction and statutory registrations across systems and chases owners until day-one readiness is green. | Day-one productivity guaranteed by orchestration, not checklists. | Blocking-item lock, tool surface | Tier 2 | P4 |
| LCY-FX-002 | Early-attrition early warning | Flags new joiners at risk in the first 90 days from engagement and attendance signals for HRBP outreach. | Protects hiring investment. | Analytics projections | Tier 3 | P5 |
| LCY-FX-003 | Exit sentiment analysis | Themes free-text exit feedback across the organisation with anonymity thresholds. | Actionable insight from exits. | Analytics projections | Tier 1 | P4 |
| LCY-FX-004 | Personalised onboarding journeys by role and language | Generates a day-by-day onboarding journey per joiner, adapting to progress and language. | Every joiner gets a tailored start. | Journeys, template renderer | Tier 2 | P4 |

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
