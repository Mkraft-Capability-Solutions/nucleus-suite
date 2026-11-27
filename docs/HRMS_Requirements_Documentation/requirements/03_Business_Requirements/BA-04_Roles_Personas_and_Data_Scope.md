<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# BA-04 — Roles, Personas and Data Scope

| Attribute | Value |
| :--- | :--- |
| Document ID | BA-04 |
| Title | Roles, Personas and Data Scope |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Security Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | GOV-08, GOV-10, SEC-01, STRS-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 21_Roles_and_RACI<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 43_Roles_and_Data_Scope, 44_Demo_Users |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Hiding data in the browser is a convenience, not authorisation; the server enforces scope (SEC-01). Plant and location-scoped users see attendance for their location and never see salary or rate structures.

## 1. Personas, scope and visibility

| Persona | Who they are | Scope | Can see | Cannot see | Key screens |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Employee / worker | Any person with an active assignment | Self only | Own attendance, payslip, balances, documents, learning, announcements | Anyone else's record | SCR-042, SCR-021, SCR-030, SCR-053 |
| Manager / supervisor | Holds reporting-line responsibility | Own reporting subtree | Team attendance, leave, approvals, team history, profile cards | Compensation outside their line; wellbeing signals of any individual | SCR-040, SCR-027, SCR-022 |
| Plant HR / time office | HR at a site | Location grant, can_edit_time | Attendance and time records for the site, including head-office-payrolled staff at that site | Any compensation or rate field for populations outside their payroll group | SCR-022, SCR-025, SCR-061 |
| HR operations | Core HR at entity level | Entity grant | Records, lifecycle, documents, leave administration, letters | Payroll computation unless separately granted | SCR-010, SCR-011, SCR-060, SCR-067 |
| Payroll manager | Runs the cycle | Payroll group + entity | Everything in the run, salary structures, audit flags | Records outside the payroll group | SCR-050, SCR-051, SCR-055 |
| Finance | Owns the GL handshake | Entity | Journal, mapping, reconciliation, bank file | Individual HR data beyond what the journal drills to | SCR-102, SCR-103, SCR-055 |
| Compliance owner | Files returns and registers | Entity + state | Obligations, forms, registers, rule packs, evidence | Compensation detail beyond statutory needs | SCR-070, SCR-072, SCR-073 |
| Implementation consultant | Configures the tenant | Tenant | All configuration objects, workflow builder, simulation | Production personal data beyond what configuration requires | SCR-032, SCR-100, SCR-007 |
| Tenant admin | Owns users and scope | Tenant | Principals, roles, grants, agent policy | Payroll amounts unless separately granted | SCR-005, SCR-110 |
| Director / approver | Sanction and override authority | Entity | Items routed to them, with the rules being waived named | Routine operational data | SCR-040, SCR-080 |
| Auditor | Internal or external | Read-only, scoped | Audit trail, action ledger, rule pack history, reconciliation | Write access of any kind | SCR-110, SCR-103 |
| Agent principal | A Nucleus agent | Scoped role, narrower than its human owner | Only what its tools expose | Any path to data that is not a declared tool | SCR-110 |

## 2. Role and data-scope matrix (pilot tenant)

| Role code | Role name | Scope dimension | Scope value | Can view salary structure | Can view rate structure | Can view attendance | Can edit attendance | Can run payroll | Can approve | Enforced in | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-PLANT-HR | Plant HR — Chennai | Attendance location | LOC-CHN | N | N | Y | Y | N | Attendance regularisation | Screen, report, export and API | Point 8 |
| R-PLANT-HR | Plant HR — Peenya | Attendance location | LOC-PLA | N | N | Y | Y | N | Attendance regularisation | Screen, report, export and API | Point 8 |
| R-PAYROLL | Payroll manager | Payroll processing location | LOC-BLR (payroll group HO) | Y | Y | Y | N | Y | Payroll run, OT run | Screen, report, export and API | Point 8 |
| R-PLANT-PAY | Plant payroll — Chennai | Payroll processing location | LOC-CHN (payroll group PLANT-CHN) | Y | Y | Y | N | Y | Payroll run | Screen, report, export and API | Point 8 — sees plant-paid salary but not E1056, who is paid at head office |
| R-MANAGER | Reporting manager | Reporting line | Own reportees, direct and indirect | N | N | Y | N | N | Leave, OT, gate pass, regularisation | Screen and export | Points 1, 12 |
| R-HRHEAD | HR Head | Legal entity | LE-01 and LE-02 | Y | N | Y | Y | N | Leave level 3, F&F, requisition | Screen, report, export and API | Points 5, 16 |
| R-FINANCE | Finance | Legal entity | LE-01 and LE-02 | Y | N | N | N | N | Loan level 3, F&F release, GL posting | Screen, report and export | Points 9, 15 |
| R-DIRECTOR | Director | Legal entity | LE-01 and LE-02 | Y | Y | Y | N | N | Loan special terms only | Screen and report | Point 9 |
| R-COMPLIANCE | Compliance owner | Establishment | All factory establishments | N | N | Y | N | N | Statutory filing sign-off | Screen and report | Points 17, 26 |
| R-EMPLOYEE | Employee self-service | Self | Own record only | Y (own only) | N | Y (own only) | N | N | None | Screen and mobile |  |

## 3. Pilot users (login names only; no credentials are recorded in documentation)

| User ID | Login | Full name | Linked employee | Role | Scope granted | Sign in for | What the client should see | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| U-001 | kalaivani.s | Kalaivani Subramani | E1055 | R-PLANT-HR | LOC-CHN | The restriction half of point 8 | Opens E1056 Anand Krishnan: attendance is visible and editable, every compensation field is blank. Run the salary register and the export — he is absent from both. | Point 8 |
| U-002 | deepak.s | Deepak Sarangi | E1007 | R-PAYROLL | Payroll group HO | The permission half of point 8 | Opens the same employee and sees the full structure. Same record, two answers, decided by the payroll processing location on the employee. | Point 8 |
| U-003 | nikhil.i | Nikhil Iyer | E1017 | R-MANAGER | Own reporting line | Team calendar, point 1 remark | Team Calendar for 01 to 15 September. E1018, E1019, E1025, E1029, E1030 and E1032 are selectable; anyone else is not. Export matches the screen. | Point 1 |
| U-004 | rekha.d | Rekha Deshpande | E1021 | R-MANAGER | Own reporting line | The grade exemption in point 12 | Her own September attendance: five lates beyond grace, every day Present. Then E1019 in the same month, half days from the fourth late. | Point 12 |
| U-005 | ritu.b | Ritu Balachandran | E1004 | R-HRHEAD | LE-01 and LE-02 | Leave level 3 and the HR override | Approves LV-2026-0774 at HR Head, then closes it on early return with three days credited back. The HR edit is recorded against her, not against the original approver. | Point 5 |
| U-006 | anita.m | Anita Mathew | E1006 | R-HRHEAD | LE-01 | F&F and letters | Holds E1042 at two open blocking clearance lines, releases E1068 on his last working day. | Point 16 |
| U-007 | nandita.b | Nandita Bose | E1010 | R-FINANCE | LE-01 and LE-02 | GL posting, point 15 | Runs the posting with GL-023 missing and is blocked, adds the mapping, then posts a balanced journal and reconciles it to the bank file. | Point 15 |
| U-008 | arvind.r | Arvind Raghunathan | E1001 | R-DIRECTOR | LE-01 and LE-02 | The loan override in point 9 | Approves the special-terms sanction on LN-2026-0012 as a recorded approval. Show that the amount cannot be edited into place without it. | Point 9 |
| U-009 | vikram.c | Vikram Chauhan | E1009 | R-COMPLIANCE | All factory establishments | Points 17 and 26 | The obligation calendar across four states, then Form 28 for Karnataka against the Tamil Nadu register set, then Form F for E1066. | Points 17, 26 |
| U-010 | ravi.k | Ravi Kulkarni | E1018 | R-EMPLOYEE | Self | The employee view of point 1 | His own 08 September: two segments, 19h20m gate to gate, a 45-minute break shown separately, 7h20m of overtime. | Point 1 |

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
| Size | 32 | specified items (table rows) | Counted automatically at generation |
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
