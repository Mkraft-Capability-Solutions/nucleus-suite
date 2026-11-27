<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-04 — Leave — Screens, Reports and UX

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-04 |
| Title | Leave — Screens, Reports and UX |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Leave |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 07_Screens, 21_Roles_and_RACI<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 08_Reports_and_Outputs<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 67_Reports_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Screens

| Screen ID | Screen | Persona | Platform | Purpose | Key actions | Permission scope | Offline | Process refs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-030 | Apply for leave | Employee | Mobile, business messaging, web | Apply with live balance, expiry warnings and rule messages | Apply, cancel, record early return | Self only | Queue apply | LVE-03, LVE-05 |
| SCR-031 | Leave balance and ledger | Employee, HR | Mobile, web | Projected balance with the full transaction trail | View, export | Self; HR within scope | Read only | LVE-08 |
| SCR-032 | Leave policy configuration | Implementation consultant | Web | Types, accrual policies, proration, combination rules, caps, expiry | Create, version, simulate | Implementation role | No | LVE-01, PLT-03 |

## 2. Personas using these screens

| Persona | Who they are | Scope | Can see | Cannot see | Key screens |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Employee / worker | Any person with an active assignment | Self only | Own attendance, payslip, balances, documents, learning, announcements | Anyone else's record | SCR-042, SCR-021, SCR-030, SCR-053 |
| Implementation consultant | Configures the tenant | Tenant | All configuration objects, workflow builder, simulation | Production personal data beyond what configuration requires | SCR-032, SCR-100, SCR-007 |

## 3. Reports and outputs

| Report ID | Report | Form ID | Requirement | What it shows | Filters | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-05 | Leave balance and ledger | F-LVE-05 | R-06, R-07, R-08 | Opening, credited, availed, lapsed, encashed and closing per leave type, with every movement traceable. | As on date, employee, leave type | A balance that cannot be explained line by line is a defect. |
| RP-06 | COFF expiry forecast | F-LVE-06 | R-07 | COFF available with its expiry date, so an employee can be warned before it lapses. | Expiring within days, department | Lapsing without warning is the complaint this prevents. |
| RP-07 | Leave accrual audit | F-LVE-02 | R-08 | What was credited to whom, when, under which rule — the evidence for a disputed balance. | Accrual period, leave scheme, leave type | Needed because the accrual logic has many branches. |
| RP-08 | Year end encashment and lapse statement | F-LVE-07 | R-08 | EL encashed and CL and SL lapsed per employee, from the preview or the committed run. | Processing year, run mode | Preview output must match the committed output exactly. |

### Report configuration

| Report | Name | Module | Requirement | Sheets that feed it | Filters to set in the demo | What to point out | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-05 | Leave balance and ledger | LVE | R-06, R-07, R-08 | 53_Leave_Balance_AsOn, 17_Leave_Ledger | As on 15 September, all employees | Drill any closing balance to the movements behind it | Points 5, 6, 7 |
| RP-06 | COFF expiry forecast | LVE | R-07 | 19_CompOff_Ledger, 17_Leave_Ledger | Expiring within 60 days | E1028 holds two credits nine weeks apart. E1044's lapsed credit is the complaint this report prevents. | Point 6 |
| RP-07 | Leave accrual audit | LVE | R-08 | 15_Leave_Accrual_Policy, 16_Leave_Proration, 17_Leave_Ledger | January to September 2026, all schemes | Which rule credited what to whom. Walk E1069 and E1067 — same rule, six months apart. | Point 7 |
| RP-08 | Year end encashment and lapse statement | LVE | R-08 | 54_Year_End_Leave_Preview | 2026, run mode Preview | Run Preview twice and show nothing changed | Point 7 |

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
