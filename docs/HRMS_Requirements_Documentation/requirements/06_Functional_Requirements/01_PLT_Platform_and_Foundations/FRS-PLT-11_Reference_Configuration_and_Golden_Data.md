<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-11 — Platform & Foundations — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-11 |
| Title | Platform & Foundations — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Platform & Foundations |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 02_Legal_Entities, 03_Locations, 43_Roles_and_Data_Scope, 44_Demo_Users, 64_Approval_Workflows |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Role code | SEC | F-SEC-01 — Role & Data Scope Setup | — | HR roles only | R-09 | Yes |
| Scope dimension | SEC | F-SEC-01 — Role & Data Scope Setup | Attendance location | HR roles only | R-09 | Yes — value set configurable per tenant |
| Can view salary structure | SEC | F-SEC-01 — Role & Data Scope Setup | N | HR roles only | R-09 | Yes |
| Can view rate structure | SEC | F-SEC-01 — Role & Data Scope Setup | N | HR roles only | R-09 | Yes |

## 2. Reference and golden data

### `02_Legal_Entities` (2 rows)

| Entity code | Registered name | CIN / LLPIN | Registered office | PAN | PF / Labour code | GSTIN | Financial year | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LE-01 | Vindhya Precision Industries Pvt Ltd | U29253KA2011PTC058411 | Bengaluru, Karnataka | AAACV4471K | KA/BLR/0045512 | 29AAACV4471K1ZP | Apr-Mar | Active |
| LE-02 | Vindhya Components Pvt Ltd | U29309TG2016PTC112904 | Hyderabad, Telangana | AAECV8820M | TS/HYD/0021877 | 36AAECV8820M1ZR | Apr-Mar | Active |

### `03_Locations` (5 rows)

| Location code | Location name | Entity | City | State | State code | Establishment type | PIN | Factory licence | PT slab set | LWF set | Payroll group | Factory Act applies |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LOC-BLR | Bengaluru Corporate Office | LE-01 | Bengaluru | Karnataka | KA | Office | 560001 | Not applicable | KA-PT-Slab-2026 | KA-LWF | HO | N |
| LOC-PLA | Peenya Works | LE-01 | Bengaluru | Karnataka | KA | Factory | 560058 | KA/FAC/2013/00891 | KA-PT-Slab-2026 | KA-LWF | PLANT-BLR | Y |
| LOC-PUN | Chakan Works | LE-01 | Pune | Maharashtra | MH | Factory | 410501 | MH/FAC/2015/03327 | MH-PT-Slab-2026 | MH-LWF | PLANT-PUN | Y |
| LOC-HYD | Medchal Works | LE-02 | Hyderabad | Telangana | TS | Factory | 501401 | TS/FAC/2016/01142 | TS-PT-Slab-2026 | TS-LWF | PLANT-HYD | Y |
| LOC-CHN | Oragadam Works | LE-02 | Chennai | Tamil Nadu | TN | Factory | 602105 | TN/FAC/2015/02218 | TN-PT-Slab-2026 | TN-LWF | PLANT-CHN | Y |

### `43_Roles_and_Data_Scope` (11 rows)

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
| ADDED v1.1 for form F-SEC-01. Demo point 8 could not be shown from v1.0 at all, because the dataset had no roles and no users — the whole point is who is signed in. Note the two payroll rows: the restriction is scoped on the payroll processing location, not the work location, which is why the Chennai plant payroll role still cannot see E1056. Prove it in all four surfaces named in the last column, not just by hiding the screen. |  |  |  |  |  |  |  |  |  |  |  |

### `44_Demo_Users` (11 rows)

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
| ADDED v1.1. Ten sign-ins, each tied to a point in the demo script. Create them in the tenant before the demo and keep the sessions open in separate browser profiles — the point-8 comparison lands only if the two windows are side by side and the client can see it is the same employee record. Passwords are not given here; use the tenant convention. |  |  |  |  |  |  |  |  |

### `64_Approval_Workflows` (11 rows)

| Workflow | Name | Form | Chain | Sequential or parallel | Recorded per level | Escalation | Delegation allowed | Return to applicant | Live demo record | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| W-01 | Leave application | F-LVE-03 / FRM-LVE-02 | Supervisor → HOD → HR Head | Sequential | Actor, decision, timestamp, comment | After 3 days to the next level | Y | HR Head only, with a reason | LV-2026-0774 — E1039, then E1039 as HOD, then E1004 on 06 Sep | Point 5 |
| W-02 | Leave early return | F-LVE-04 | HR Head | Single level | Actor, decision, timestamp, days released | None | N | N | LV-2026-0774 closed by E1006 on 14 Sep with 3 days credited back, and RG-2026-0214 written in the same commit | Point 5 |
| W-03 | Overtime | F-OTM-01 | Supervisor → HOD | Sequential | Actor, decision, timestamp, hours approved | After 2 days | Y | Y | OT-2026-0912 — E1017 approved 7h20m on 09 Sep | Points 1, 10 |
| W-04 | Gate pass | F-GPS-01 | Reporting manager | Single level | Actor, decision, timestamp | None | Y | N | GP-2026-0163 rejected by E1024 on the monthly ceiling. The entitlement is checked at submission and again at approval, because another pass may have been approved in between. | Point 11 |
| W-05 | Loan application | F-LON-01 | HOD → HR Head → Finance | Sequential | Actor, decision, timestamp, eligibility snapshot | After 5 days | N | Y | LN-APP-2026-0014 rejected at eligibility before the chain started | Point 9 |
| W-06 | Loan special terms | F-LON-01 | Director | Inserted step, cannot be skipped | Actor, decision, timestamp, override reason | None | N | N | LN-2026-0012 — E1001 sanctioned 150,000 against an 86,000 ceiling as a recorded approval, not an edit | Point 9 |
| W-07 | No dues clearance | F-FNF-02 | One sign-off per department | Parallel | Actor, decision, timestamp, recovery amount, waiver reason | After 5 days to HR | Y | N | E1042 — four cleared, two open, both blocking | Point 16 |
| W-08 | Full and final settlement | F-FNF-01 | HR Head → Finance | Sequential | Actor, decision, timestamp | None | N | Y | FF-2026-0021 released on the last working day; FF-2026-0018 held | Point 16 |
| W-09 | Manpower requisition | F-REC-02 | HOD → HR Head, plus a level when sanction is exceeded | Sequential | Actor, decision, timestamp, sanction check result | After 5 days | Y | Y | REQ-2026-0041 blocked at approval because Machining is at full sanction | Points 24, 25 |
| W-10 | Attendance regularisation | F-ATT-04 | Reporting manager | Single level | Actor, decision, timestamp, original and corrected status | After 3 days | Y | Y | RG-2026-0220 rejected — a regularisation cannot create a rest-day entitlement the worker class does not carry | Point 2 |
| ADDED v1.1, expanding sheet 07 of the build workbook into records that exist in this dataset. Two rows carry the weight. W-02 is a single approval level that must commit an attendance correction and a ledger credit together or not at all — show it and then show both records. W-06 is an approval that cannot be skipped and cannot be replaced by editing the amount, which is the difference between a policy and a control. W-10 was added beyond the build sheet's nine because regularisation is where most attendance rules quietly get bypassed. |  |  |  |  |  |  |  |  |  |  |

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
| Size | 44 | specified items (table rows) | Counted automatically at generation |
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
