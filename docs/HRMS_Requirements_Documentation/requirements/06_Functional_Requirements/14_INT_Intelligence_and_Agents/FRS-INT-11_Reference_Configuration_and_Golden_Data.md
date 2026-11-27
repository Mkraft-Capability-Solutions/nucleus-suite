<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-INT-11 — Intelligence & Agents — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-INT-11 |
| Title | Intelligence & Agents — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Intelligence & Agents |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-INT-00, FRS-INT-01, FRS-INT-02, FRS-INT-03, FRS-INT-04, FRS-INT-05, FRS-INT-06, FRS-INT-07, FRS-INT-08, FRS-INT-09, FRS-INT-10, FRS-INT-11, FRS-INT-12, FRS-INT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-08 · processes INT-01–INT-04 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 67_Reports_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

_No entries in source for this scope._

## 2. Reference and golden data

### `67_Reports_Register` (18 rows)

| Report | Name | Module | Requirement | Build action | Sheets that feed it | Filters to set in the demo | What to point out | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RP-01 | Break register | ATT | R-01 | New | 49_Break_Register, 20_Punch_Events | E1018, 08 September | The 45-minute dinner break as its own row, and gate-to-gate hours unchanged at 19h20m | Point 1 |
| RP-02 | Team attendance history | ATT | R-02 | New | 21_Expected_Attendance, 44_Demo_Users | Signed in as E1017, 01 to 15 September, all reportees | A range that crosses a month boundary, and a non-reportee that cannot be selected | Point 1 |
| RP-03 | Daily attendance register | ATT | R-01, R-13 | Edit existing | 21_Expected_Attendance, 52_Shift_Roster | LOC-PLA, 01 to 15 September | Detected shift shown beside rostered shift on E1020's 04 September row | Point 13 |
| RP-04 | Overtime statement | OTM | R-01, R-05, R-11 | Edit existing | 23_Overtime_Register, 55_Payroll_Register | September OT period, LOC-PLA | E1034's two rows — the same 12-hour span, one on a working day paying nothing and one on a rest day paying in full | Points 4, 10 |
| RP-05 | Leave balance and ledger | LVE | R-06, R-07, R-08 | Edit existing | 53_Leave_Balance_AsOn, 17_Leave_Ledger | As on 15 September, all employees | Drill any closing balance to the movements behind it | Points 5, 6, 7 |
| RP-06 | COFF expiry forecast | LVE | R-07 | New | 19_CompOff_Ledger, 17_Leave_Ledger | Expiring within 60 days | E1028 holds two credits nine weeks apart. E1044's lapsed credit is the complaint this report prevents. | Point 6 |
| RP-07 | Leave accrual audit | LVE | R-08 | New | 15_Leave_Accrual_Policy, 16_Leave_Proration, 17_Leave_Ledger | January to September 2026, all schemes | Which rule credited what to whom. Walk E1069 and E1067 — same rule, six months apart. | Point 7 |
| RP-08 | Year end encashment and lapse statement | LVE | R-08 | New | 54_Year_End_Leave_Preview | 2026, run mode Preview | Run Preview twice and show nothing changed | Point 7 |
| RP-09 | Gate pass utilisation | GPS | R-12 | New | 22_Gate_Pass | September, LOC-PLA | E1023 at 240 minutes and two instances, with the third request refused | Point 11 |
| RP-10 | Loan and guarantor exposure | LON | R-10 | New | 24_Loans, 25_Loan_Guarantors | As on 15 September | Who guarantees whom, and who is therefore blocked. The interlock is invisible without this. | Point 9 |
| RP-11 | No dues status | FNF | R-17 | New | 27_Exit_Clearance, 58_FnF_Settlement | Last working day within September | E1042 held at two lines, with the 12,500 recovery already priced | Point 16 |
| RP-12 | Statutory registers and returns | STA | R-18 | Edit existing | 29_Statutory_Forms, 28_Statutory_Calendar | September, LOC-PLA and then LOC-CHN | The Karnataka and Tamil Nadu register sets are different | Point 17 |
| RP-13 | Form F register | STA | R-27 | New | 29_Statutory_Forms, 61_Preboarding_Chain | LOC-PLA, joining dates in 2026 | A gapless serial per establishment | Point 26 |
| RP-14 | Salary register | PAY | R-09 | Edit existing | 55_Payroll_Register, 43_Roles_and_Data_Scope | September, run as U-001 and then as U-002 | The same register, two sign-ins, and E1056 missing from one of them | Point 8 |
| RP-15 | Payroll posting log | INT | R-16 | New | 56_GL_Journal, 35_GL_Mapping | August 2026, all posting statuses | The blocked run with GL-023 unmapped, then the balanced journal, then the re-run that creates no second posting | Point 15 |
| RP-16 | Contractor reconciliation | CTG | R-03, R-04 | New — added v1.1 | 46_Contractor_Invoices, 21_Expected_Attendance | VN-01, September | Three claimed days with no attendance behind them, held rather than paid | Point 3 |
| RP-17 | Attendance exception queue | ATT | R-01, R-13 | New — added v1.1 | 51_Attendance_Exceptions | Open exceptions, all severities | Three block payroll, one blocks a vendor payment, two resolve themselves. Run it before the payroll run. | Point 12 |
| ADDED v1.1, expanding sheet 08 of the build workbook and naming the demo sheet behind each report. Fifteen reports come from the build sheet; RP-16 and RP-17 are added here because v1.1 introduced the data for them. Column F is the one to check before the demo: if a report has no sheet feeding it, there is nothing to show. |  |  |  |  |  |  |  |  |

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
| Size | 18 | specified items (table rows) | Counted automatically at generation |
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
