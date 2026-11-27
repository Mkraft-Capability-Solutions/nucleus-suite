<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-04 — Time & Attendance — Screens, Reports and UX

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-04 |
| Title | Time & Attendance — Screens, Reports and UX |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 07_Screens, 21_Roles_and_RACI<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 08_Reports_and_Outputs<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 67_Reports_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Screens

| Screen ID | Screen | Persona | Platform | Purpose | Key actions | Permission scope | Offline | Process refs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-020 | Check in / check out | Employee | Mobile, kiosk, business messaging, web | Punch with geofence and optional selfie | Check in, check out | Self only | YES — queue with signed timestamp | TIM-01 |
| SCR-021 | My attendance | Employee | Mobile, web | Day-by-day status, net hours, late allowance remaining, OT, gate-pass balance | Raise regularisation, view rule that applied | Self only | YES — last 60 days cached | TIM-05, SSV-01 |
| SCR-022 | Attendance day detail (HR/supervisor) | Supervisor, HR | Web, mobile | Segments, breaks, shift assigned vs applied, rules applied, provenance | Override shift, regularise, recompute | Location scope; pay fields null outside payroll group | No | TIM-02, TIM-03 |
| SCR-023 | Gate pass | Employee, approver | Mobile, business messaging, web | Request and approve gate passes; shows minutes and instances used | Request, approve, reject | Self; approver by reporting line | No | TIM-06 |
| SCR-024 | Overtime register | Supervisor, payroll | Web | OT by person and date with eligibility basis, multiplier and pay run | Approve, tag run, export | Location scope | No | TIM-07 |
| SCR-025 | Attendance exception queue | Supervisor, HR | Web | Unpaired punches, missing days, device failures, inferred shifts, agent proposals | Accept proposal, amend, reject, bulk-resolve | Location scope | No | TIM-08 |
| SCR-026 | Recompute monitor | HR admin, engineer | Web | Queue depth, running jobs, deltas produced, locked-period collisions | Requeue, inspect delta | Admin | No | TIM-09 |
| SCR-027 | Team history | Manager | Mobile, web | Date range, one member or whole team: attendance, leave, OT, gate pass, late | Filter, export CSV/PDF | Reporting line, evaluated at query time | Read only | TIM-10 |

## 2. Personas using these screens

| Persona | Who they are | Scope | Can see | Cannot see | Key screens |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Employee / worker | Any person with an active assignment | Self only | Own attendance, payslip, balances, documents, learning, announcements | Anyone else's record | SCR-042, SCR-021, SCR-030, SCR-053 |
| Manager / supervisor | Holds reporting-line responsibility | Own reporting subtree | Team attendance, leave, approvals, team history, profile cards | Compensation outside their line; wellbeing signals of any individual | SCR-040, SCR-027, SCR-022 |
| Plant HR / time office | HR at a site | Location grant, can_edit_time | Attendance and time records for the site, including head-office-payrolled staff at that site | Any compensation or rate field for populations outside their payroll group | SCR-022, SCR-025, SCR-061 |

## 3. Reports and outputs

| Report ID | Report | Form ID | Requirement | What it shows | Filters | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-01 | Break register | F-ATT-03 | R-01 | Every intermediate break by employee and date, with start, end, duration and break type, for a date range. | Employee, date range, department, shift, break type | The 45-minute dinner break in the source example is a row here. |
| RP-02 | Team attendance history | F-ATT-05 | R-02 | Attendance history for a manager's team or a single team member across a date range, exportable. | From date, to date, team member, include indirect reportees | Scoped to the logged-in manager's reporting line. |
| RP-03 | Daily attendance register | F-ATT-01 | R-01, R-13 | Gains gross hours, break minutes, net hours, OT hours, late mark and the detected shift. | Date range, department, shift, day status | Must show detected shift alongside rostered shift. |
| RP-04 | Overtime statement | F-OTM-01 | R-01, R-05, R-11 | OT hours and amount by employee for the OT period, showing the day type so rest-day-only eligibility is visible. | OT period, department, eligibility basis | Separate from the salary register. |
| RP-09 | Gate pass utilisation | F-GPS-01 | R-12 | Hours and passes used against entitlement per employee per month. | Month, department | Makes the two-pass cap auditable. |

### Report configuration

| Report | Name | Module | Requirement | Sheets that feed it | Filters to set in the demo | What to point out | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-01 | Break register | ATT | R-01 | 49_Break_Register, 20_Punch_Events | E1018, 08 September | The 45-minute dinner break as its own row, and gate-to-gate hours unchanged at 19h20m | Point 1 |
| RP-02 | Team attendance history | ATT | R-02 | 21_Expected_Attendance, 44_Demo_Users | Signed in as E1017, 01 to 15 September, all reportees | A range that crosses a month boundary, and a non-reportee that cannot be selected | Point 1 |
| RP-03 | Daily attendance register | ATT | R-01, R-13 | 21_Expected_Attendance, 52_Shift_Roster | LOC-PLA, 01 to 15 September | Detected shift shown beside rostered shift on E1020's 04 September row | Point 13 |
| RP-04 | Overtime statement | OTM | R-01, R-05, R-11 | 23_Overtime_Register, 55_Payroll_Register | September OT period, LOC-PLA | E1034's two rows — the same 12-hour span, one on a working day paying nothing and one on a rest day paying in full | Points 4, 10 |
| RP-09 | Gate pass utilisation | GPS | R-12 | 22_Gate_Pass | September, LOC-PLA | E1023 at 240 minutes and two instances, with the third request refused | Point 11 |
| RP-17 | Attendance exception queue | ATT | R-01, R-13 | 51_Attendance_Exceptions | Open exceptions, all severities | Three block payroll, one blocks a vendor payment, two resolve themselves. Run it before the payroll run. | Point 12 |

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
| Size | 22 | specified items (table rows) | Counted automatically at generation |
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
