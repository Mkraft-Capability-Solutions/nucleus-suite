<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-04 — Payroll — Screens, Reports and UX

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-04 |
| Title | Payroll — Screens, Reports and UX |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 07_Screens, 21_Roles_and_RACI<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 08_Reports_and_Outputs<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 67_Reports_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Screens

| Screen ID | Screen | Persona | Platform | Purpose | Key actions | Permission scope | Offline | Process refs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-050 | Payroll run cockpit | Payroll manager | Web | Run list by period with run type and state; the cycle stepper | Create run, lock, calculate, approve, rollback | Payroll group + entity | No | PAY-01, PAY-02, PAY-09 |
| SCR-051 | Pre-payroll audit | Payroll manager | Web | Flags by severity with owner, detail and agent-drafted resolution | Resolve, waive with reason | Payroll role | No | PAY-03 |
| SCR-052 | Salary structure simulator | HR, Comp | Web | Wage base, 50% floor test, statutory cost and take-home impact of a proposed structure | Simulate, compare, adopt | Comp role | No | PAY-05, CMP-04p |
| SCR-053 | Payslip | Employee | Mobile, web | Payslip by period AND run, with drill-down to the rule behind each line | View, download, explain line | Self only | YES — last 12 months | PAY-13 |
| SCR-054 | Tax declaration and projection | Employee | Mobile, web | Regime choice, declarations, proofs, projected TDS | Declare, upload proof | Self only | No | PAY-07 |
| SCR-055 | Disbursement and bank file | Finance | Web | Bank file totals, checksum, dual-control release | Generate, verify, release | Finance, dual control | No | PAY-09, FIN-05 |
| SCR-056 | Full and final | Payroll, HR | Web | Settlement working with clearance status and blocking items | Compute, approve, settle | Payroll + HR | No | PAY-12, LCY-07 |

## 2. Personas using these screens

| Persona | Who they are | Scope | Can see | Cannot see | Key screens |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Employee / worker | Any person with an active assignment | Self only | Own attendance, payslip, balances, documents, learning, announcements | Anyone else's record | SCR-042, SCR-021, SCR-030, SCR-053 |
| Payroll manager | Runs the cycle | Payroll group + entity | Everything in the run, salary structures, audit flags | Records outside the payroll group | SCR-050, SCR-051, SCR-055 |
| Finance | Owns the GL handshake | Entity | Journal, mapping, reconciliation, bank file | Individual HR data beyond what the journal drills to | SCR-102, SCR-103, SCR-055 |

## 3. Reports and outputs

| Report ID | Report | Form ID | Requirement | What it shows | Filters | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-14 | Salary register | F-PAY-02 | R-09 | Salary by employee, filtered by payroll processing location and honouring the salary visibility rule. | Payroll period, payroll location | A plant user running this must not see head-office-paid employees' salary. |

### Report configuration

| Report | Name | Module | Requirement | Sheets that feed it | Filters to set in the demo | What to point out | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-14 | Salary register | PAY | R-09 | 55_Payroll_Register, 43_Roles_and_Data_Scope | September, run as U-001 and then as U-002 | The same register, two sign-ins, and E1056 missing from one of them | Point 8 |

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
