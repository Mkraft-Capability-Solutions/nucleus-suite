<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-04 — Finance & ERP — Screens, Reports and UX

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-04 |
| Title | Finance & ERP — Screens, Reports and UX |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 07_Screens, 21_Roles_and_RACI<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 08_Reports_and_Outputs<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 67_Reports_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Screens

| Screen ID | Screen | Persona | Platform | Purpose | Key actions | Permission scope | Offline | Process refs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-100 | Integration configuration | Implementation consultant | Web | Master-data mode and the field-level ownership map | Set mode, edit map, validate | Implementation role | No | FIN-01 |
| SCR-101 | Sync monitor | HR admin, integration engineer | Web | Batches, applied rows, conflicts held, unmatched codes, duplicates | Resolve conflict, rematch, replay | Admin | No | FIN-01 |
| SCR-102 | GL mapping and journal | Finance | Web | Component-to-account map and the journal per run with dimensions | Map, validate, post, download | Finance | No | FIN-02, FIN-03 |
| SCR-103 | Reconciliation | Finance | Web | Gross, net, statutory, dimension and loan checks with drill-down | Run, drill, export | Finance | No | FIN-04 |

## 2. Personas using these screens

| Persona | Who they are | Scope | Can see | Cannot see | Key screens |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Finance | Owns the GL handshake | Entity | Journal, mapping, reconciliation, bank file | Individual HR data beyond what the journal drills to | SCR-102, SCR-103, SCR-055 |
| Implementation consultant | Configures the tenant | Tenant | All configuration objects, workflow builder, simulation | Production personal data beyond what configuration requires | SCR-032, SCR-100, SCR-007 |
| Auditor | Internal or external | Read-only, scoped | Audit trail, action ledger, rule pack history, reconciliation | Write access of any kind | SCR-110, SCR-103 |

## 3. Reports and outputs

| Report ID | Report | Form ID | Requirement | What it shows | Filters | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-15 | Payroll posting log | F-INT-02 | R-16 | What was posted to the ERP, when, with what reference, and what failed. | Payroll period, posting status | A failed posting must be visible, not silent. |

### Report configuration

| Report | Name | Module | Requirement | Sheets that feed it | Filters to set in the demo | What to point out | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-15 | Payroll posting log | INT | R-16 | 56_GL_Journal, 35_GL_Mapping | August 2026, all posting statuses | The blocked run with GL-023 unmapped, then the balanced journal, then the re-run that creates no second posting | Point 15 |

## 4. UX requirements for every screen in this domain (Authored)

- Screens MUST use the design-token system only and conform to WCAG 2.2 AA.
- Every label MUST be an i18n key; all 11 supported languages MUST render, including right-to-left for Arabic.
- Each screen MUST define empty, loading, error, success and, where marked, offline states.
- Masked fields MUST render masked for personas without the salary or identity scope; hiding in the browser is not authorisation — the server MUST enforce scope (SEC-01).
- Voice (Nucleus Talk) and AI-assist touchpoints MUST follow the risk tiering in GOV-11.

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
| Size | 9 | specified items (table rows) | Counted automatically at generation |
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
