<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-11 — People Core — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-11 |
| Title | People Core — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — People Core |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 04_Org_Units, 05_Designations, 06_Worker_Classes, 10_Sanctioned_Manpower, 11_Positions, 12_Employees, 38_Employment_Categories, 62_Documents |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Employment category | EMP | F-EMP-01 — Employee Master | Permanent | All roles | R-03 | Yes — value set configurable per tenant |
| Employment sub-category | EMP | F-EMP-01 — Employee Master | — | All roles | R-04 | Yes — value set configurable per tenant |
| Rest day applicable | EMP | F-EMP-01 — Employee Master | Defaulted from the employment sub-category, then the category | All roles | R-03, R-04 | Yes — default per category, overridable per employee |
| Rest day pattern | EMP | F-EMP-01 — Employee Master | From the work calendar | All roles | R-03, R-04 | Yes |
| OT eligible | EMP | F-EMP-01 — Employee Master | Y | All roles | R-05 | Yes |
| OT eligibility basis | EMP | F-EMP-01 — Employee Master | All days | All roles | R-05 | Yes — value set configurable per tenant |
| OT rate multiplier | EMP | F-EMP-01 — Employee Master | From the leave and OT scheme | Payroll and HR roles only | R-05 | Yes |
| Leave scheme | EMP | F-EMP-01 — Employee Master | Defaulted from grade and employment category | All roles | R-08 | Yes |
| COFF lapse days | EMP | F-EMP-01 — Employee Master | 60 from the leave scheme | HR roles only | R-07 | Yes — default 60 per the stated policy |
| Trainee type | EMP | F-EMP-01 — Employee Master | — | All roles | R-08 | Yes — value set configurable per tenant |
| Payroll processing location | EMP | F-EMP-01 — Employee Master | Employee work location | All roles | R-09 | Yes |
| Attendance location | EMP | F-EMP-01 — Employee Master | Employee work location | All roles | R-09 | Yes |
| Gate pass entitlement hours per month | EMP | F-EMP-01 — Employee Master | 4.00 | HR roles only | R-12 | Yes — default 4 hours per the stated policy |
| Gate pass count limit per month | EMP | F-EMP-01 — Employee Master | 2 | HR roles only | R-12 | Yes — default 2 per the stated policy |
| Category code | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-03, R-04 | Yes |
| Category name | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-03, R-04 | Yes |
| Is third party | EMP | F-EMP-02 — Employment Category & Sub-category Master | N | All roles | R-04 | Yes |
| Default rest day applicable | EMP | F-EMP-02 — Employment Category & Sub-category Master | Y | All roles | R-03, R-04 | Yes |
| Default wage basis | EMP | F-EMP-02 — Employment Category & Sub-category Master | Monthly | All roles | R-03 | Yes |
| Default leave scheme | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-08 | Yes |
| Sub-category code | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-04 | Yes |
| Sub-category name | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-04 | Yes |
| Rest day applicable | EMP | F-EMP-02 — Employment Category & Sub-category Master | Inherited from the category | All roles | R-04 | Yes |
| Scheme code | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Scheme name | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Applies from grade rank | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Applies to trainees | EMP | F-EMP-03 — Leave Scheme Master | N | All roles | R-08 | Yes |
| EL treatment at year end | EMP | F-EMP-03 — Leave Scheme Master | Encash | All roles | R-08 | Yes — value set configurable per tenant |
| CL treatment at year end | EMP | F-EMP-03 — Leave Scheme Master | Lapse | All roles | R-08 | Yes — value set configurable per tenant |
| SL treatment at year end | EMP | F-EMP-03 — Leave Scheme Master | Lapse | All roles | R-08 | Yes — value set configurable per tenant |
| COFF lapse days | EMP | F-EMP-03 — Leave Scheme Master | 60 | All roles | R-07 | Yes |
| Leave type | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Accrual frequency | EMP | F-EMP-03 — Leave Scheme Master | Annual | All roles | R-08 | Yes — value set configurable per tenant |
| Accrual quantity | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Accrual date | EMP | F-EMP-03 — Leave Scheme Master | 01-01 | All roles | R-08 | Yes |
| Minimum service months before accrual | EMP | F-EMP-03 — Leave Scheme Master | 0 | All roles | R-08 | Yes |
| Catch-up quantity on completing minimum service | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Maximum availed per month | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Joining month from | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Joining month to | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Cut-off day in the last month | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Quantity credited | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Leave type | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Cannot be combined with | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Grade rank | EMP | F-EMP-04 — Designation & Grade Master | — | All roles | R-08, R-13 | Yes |
| Exempt from grace deduction | EMP | F-EMP-04 — Designation & Grade Master | N | All roles | R-13 | Yes |
| Department | ORG | F-ORG-01 — Organisation Chart | — | All roles | R-23 | Yes |
| Functional reporting manager | ORG | F-ORG-01 — Organisation Chart | — | All roles | R-23 | Yes |

## 2. Reference and golden data

### `04_Org_Units` (15 rows)

| Org unit code | Org unit name | Parent | Level | Type | Primary location | Cost centre |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OU-100 | Executive Office |  | 1 | Function | LOC-BLR | CC-1000 |
| OU-110 | Manufacturing | OU-100 | 2 | Function |  | CC-2000 |
| OU-111 | Machining | OU-110 | 3 | Sub-function |  | CC-2100 |
| OU-112 | Assembly | OU-110 | 3 | Sub-function |  | CC-2200 |
| OU-113 | Quality Assurance | OU-110 | 3 | Sub-function |  | CC-2300 |
| OU-114 | Maintenance | OU-110 | 3 | Sub-function |  | CC-2400 |
| OU-120 | Supply Chain | OU-100 | 2 | Function |  | CC-3000 |
| OU-121 | Stores | OU-120 | 3 | Sub-function |  | CC-3100 |
| OU-122 | Logistics | OU-120 | 3 | Sub-function |  | CC-3200 |
| OU-130 | Engineering | OU-100 | 2 | Function |  | CC-4000 |
| OU-140 | Sales & Marketing | OU-100 | 2 | Function | LOC-BLR | CC-5000 |
| OU-150 | Finance & Accounts | OU-100 | 2 | Function | LOC-BLR | CC-6000 |
| OU-160 | Human Resources | OU-100 | 2 | Function |  | CC-6500 |
| OU-170 | Information Technology | OU-100 | 2 | Function | LOC-BLR | CC-7000 |
| OU-180 | Environment, Health & Safety | OU-110 | 3 | Sub-function |  | CC-2500 |

### `05_Designations` (21 rows)

| Designation code | Title | Band | Exempt from grace deduction | Leave band | Overtime default | Notice period (days) | Grade rank | Default leave scheme | Rule the rank serves |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DES-01 | Managing Director | E | Y | AGM_AND_ABOVE | None | 90 | 100 | LS-AGM | AGM and above — 18 EL / 6 CL / 6 SL on 1 Jan (LP-01 to LP-03); also grace-exempt |
| DES-02 | Vice President | E | Y | AGM_AND_ABOVE | None | 90 | 90 | LS-AGM | AGM and above — 18 EL / 6 CL / 6 SL on 1 Jan (LP-01 to LP-03); also grace-exempt |
| DES-03 | General Manager | D | Y | AGM_AND_ABOVE | None | 90 | 80 | LS-AGM | AGM and above — 18 EL / 6 CL / 6 SL on 1 Jan (LP-01 to LP-03); also grace-exempt |
| DES-04 | Assistant General Manager | D | Y | AGM_AND_ABOVE | None | 60 | 70 | LS-AGM | AGM and above — 18 EL / 6 CL / 6 SL on 1 Jan (LP-01 to LP-03); also grace-exempt |
| DES-05 | Senior Manager | C | Y | STANDARD | None | 60 | 60 | LS-STD | Assistant Manager and above — exempt from the late-mark deduction |
| DES-06 | Manager | C | Y | STANDARD | None | 60 | 55 | LS-STD | Assistant Manager and above — exempt from the late-mark deduction |
| DES-07 | Assistant Manager | C | Y | STANDARD | None | 30 | 50 | LS-STD | Assistant Manager and above — exempt from the late-mark deduction |
| DES-08 | Senior Engineer | B | N | STANDARD | All | 30 | 40 | LS-STD |  |
| DES-09 | Engineer | B | N | STANDARD | All | 30 | 35 | LS-STD |  |
| DES-10 | Senior Officer | B | N | STANDARD | All | 30 | 34 | LS-STD |  |
| DES-11 | Officer | A | N | STANDARD | All | 30 | 30 | LS-STD |  |
| DES-12 | Senior Operator | A | N | STANDARD | All | 30 | 25 | LS-STD |  |
| DES-13 | Operator | A | N | STANDARD | All | 30 | 20 | LS-STD |  |
| DES-14 | Technician | A | N | STANDARD | All | 30 | 20 | LS-STD |  |
| DES-15 | Graduate Engineer Trainee | T | N | TRAINEE_GET | None | 15 | 15 | LS-TRN |  |
| DES-16 | Diploma Engineer Trainee | T | N | TRAINEE_DET | None | 15 | 14 | LS-TRN |  |
| DES-17 | Helper | H | N | NOT_ELIGIBLE | RestDayHolidayOnly | 7 | 5 | LS-NONE |  |
| DES-18 | Contract Operator | H | N | NOT_ELIGIBLE | All | 7 | 5 | LS-NONE |  |
| DES-19 | Apprentice | T | N | NOT_ELIGIBLE | None | 7 | 10 | LS-NONE |  |
| DES-20 | Retainer Consultant | C | Y | NOT_ELIGIBLE | None | 30 | 50 | LS-NONE | Assistant Manager and above — exempt from the late-mark deduction |
| Exempt from grace deduction is Y for Assistant Manager and above, per client rule. Leave band drives the accrual policy in sheet 15. ADDED v1.1: Grade rank is the single numeric ladder every "and above" rule must compare. AGM and above is rank >= 70; Assistant Manager and above is rank >= 50. No rule may match a designation name. |  |  |  |  |  |  |  |  |  |

### `06_Worker_Classes` (10 rows)

| Class code | Label | Has rest days | Rest day pattern | Wage type | Overtime eligibility | Leave eligible | Statutory set | Obligation | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| WC-PERM | Permanent | Y | Sunday weekly off | Monthly | All | Y | PF+ESI+PT+LWF+Gratuity | Direct |  |
| WC-FTC | Fixed Term Contract | Y | Sunday weekly off | Monthly | All | Y | PF+ESI+PT+LWF+Gratuity (FTC treatment) | Direct |  |
| WC-TRN | Trainee | Y | Sunday weekly off | Monthly | None | Y (CL only, per band) | PF+ESI+PT | Direct | Point 7 |
| WC-APP | Apprentice | Y | Sunday weekly off | Stipend | None | N | Apprentices Act — no PF/ESI | Direct |  |
| WC-CONT | Contractual — daily wage | N | No rest day | Daily | All | N | PF+ESI+PT | Direct | Point 2 |
| WC-3PE | Third-Party Employee | Y | Sunday weekly off | Monthly | RestDayHolidayOnly | N | Contractor's PF/ESI — verification held | Principal Employer | Points 3, 4 |
| WC-3PH | Third-Party Helper | N | No rest day | Daily | RestDayHolidayOnly | N | Contractor's PF/ESI — verification held | Principal Employer | Point 3 |
| WC-CONS | Retainer Consultant | N | Not applicable | Retainer | None | N | TDS 194J only | Not applicable |  |
| WC-GIG | Gig / Platform Worker | N | Not applicable | Per engagement | None | N | Social Security Code — aggregator contribution | Aggregator |  |
| Worker class carries time and pay policy, not just statutory applicability. Every attribute here is overridable on the individual assignment with a reason. |  |  |  |  |  |  |  |  |  |

### `10_Sanctioned_Manpower` (11 rows)

| Record | Org unit | Designation | Location | Sanctioned | Filled | Open requisitions | Effective from | Approved by | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SM-001 | OU-111 | DES-13 | LOC-PLA | 24 | 24 | 1 | 2026-04-01 | E1002 | Point 25 |
| SM-002 | OU-111 | DES-08 | LOC-PLA | 4 | 3 | 1 | 2026-04-01 | E1002 | Point 24 |
| SM-003 | OU-112 | DES-12 | LOC-PLA | 12 | 11 | 0 | 2026-04-01 | E1002 |  |
| SM-004 | OU-113 | DES-11 | LOC-PLA | 6 | 6 | 0 | 2026-04-01 | E1002 | Updated v1.1 — E1069 joined against this line, so Quality Officers at Peenya are now at sanction |
| SM-005 | OU-114 | DES-14 | LOC-PLA | 8 | 8 | 0 | 2026-04-01 | E1002 |  |
| SM-006 | OU-112 | DES-13 | LOC-PUN | 18 | 16 | 2 | 2026-04-01 | E1002 |  |
| SM-007 | OU-111 | DES-08 | LOC-PUN | 3 | 3 | 0 | 2026-04-01 | E1002 |  |
| SM-008 | OU-113 | DES-09 | LOC-HYD | 5 | 4 | 0 | 2026-04-01 | E1002 |  |
| SM-009 | OU-111 | DES-13 | LOC-CHN | 20 | 18 | 1 | 2026-04-01 | E1002 |  |
| SM-010 | OU-122 | DES-11 | LOC-PUN | 3 | 3 | 0 | 2026-04-01 | E1002 |  |
| Machining operators at Peenya are at full sanctioned strength — this is what blocks the addition requisition REQ-2026-0041 in sheet 26. UPDATED v1.1: SM-004 shows 6 of 6 filled after E1069 joined; the open requisition against it is closed. |  |  |  |  |  |  |  |  |  |

### `11_Positions` (11 rows)

| Position code | Title | Org unit | Location | Grade | Cost centre | Status | Current incumbent | Last incumbent | Vacated on | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| POS-2214 | Senior Engineer — Machining | OU-111 | LOC-PLA | B | CC-2100 | Vacant |  | E1071 | 2026-08-22 | Point 24 |
| POS-2216 | Senior Engineer — Machining | OU-111 | LOC-PLA | B | CC-2100 | Filled | E1018 |  |  |  |
| POS-2301 | Officer — Quality | OU-113 | LOC-PLA | A | CC-2300 | Filled | E1023 |  |  |  |
| POS-2410 | Technician — Maintenance | OU-114 | LOC-PLA | A | CC-2400 | Filled | E1026 |  |  |  |
| POS-3121 | Officer — Stores | OU-121 | LOC-PLA | A | CC-3100 | Filled | E1037 |  |  |  |
| POS-2225 | Operator — Assembly | OU-112 | LOC-PUN | A | CC-2200 | Vacant |  | E1072 | 2026-09-02 |  |
| POS-2226 | Operator — Assembly | OU-112 | LOC-PUN | A | CC-2200 | Vacant |  | E1073 | 2026-08-11 |  |
| POS-4011 | Engineer — Engineering | OU-130 | LOC-BLR | B | CC-4000 | Filled | E1065 |  |  |  |
| POS-3210 | Officer — Logistics | OU-122 | LOC-PUN | A | CC-3200 | Filled | E1066 |  |  |  |
| POS-2115 | Operator — Machining | OU-111 | LOC-CHN | A | CC-2100 | Vacant |  | E1074 | 2026-07-30 |  |
| A position exists with or without a person in it. E1071 to E1074 are prior incumbents who have left and are not in the employee sheet — they exist only as vacancy history. |  |  |  |  |  |  |  |  |  |  |

### `12_Employees` (70 rows)

| Employee code | Full name | Gender | Date of birth | Date of joining | Entity | Location | Org unit | Designation | Band | Worker class | Shift group | Default shift | Manager code | Manager name | Payroll group | Vendor | Status | UAN (dummy) | Bank a/c last 4 | Demo point / note | Employment category | Employment sub-category | Rest day applicable | Rest day pattern | Wage basis | OT eligible | OT eligibility basis | OT rate multiplier | Leave scheme | Leave band | Trainee type | COFF lapse days | EL eligibility from | Payroll processing location | Attendance location | Continuous service years | Grade rank | Exempt from grace deduction | Gate pass hours per month | Gate pass count per month | ERP employee key | Resolution note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E1001 | Arvind Raghunathan | M | 1968-03-12 | 2012-04-02 | LE-01 | LOC-BLR | OU-100 | DES-01 | E | WC-PERM | OFFICE8 | SH-F |  |  | HO |  | Active | UAN000100037037 | XXXX7017 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-BLR | LOC-BLR | 14.45 | 100 | Y | 4 | 2 | VPI-1001 |  |
| E1002 | Meenakshi Sundaram | F | 1972-09-04 | 2014-07-01 | LE-01 | LOC-BLR | OU-110 | DES-02 | E | WC-PERM | OFFICE8 | SH-F | E1001 | Arvind Raghunathan | HO |  | Active | UAN000100037074 | XXXX7034 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-BLR | LOC-BLR | 12.21 | 90 | Y | 4 | 2 | VPI-1002 |  |
| E1003 | Farhan Qureshi | M | 1974-01-28 | 2015-11-16 | LE-01 | LOC-BLR | OU-150 | DES-02 | E | WC-PERM | OFFICE8 | SH-F | E1001 | Arvind Raghunathan | HO |  | Active | UAN000100037111 | XXXX7051 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-BLR | LOC-BLR | 10.83 | 90 | Y | 4 | 2 | VPI-1003 |  |
| E1004 | Ritu Balachandran | F | 1976-06-19 | 2016-02-01 | LE-01 | LOC-BLR | OU-160 | DES-03 | D | WC-PERM | OFFICE8 | SH-F | E1001 | Arvind Raghunathan | HO |  | Active | UAN000100037148 | XXXX7068 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-BLR | LOC-BLR | 10.62 | 80 | Y | 4 | 2 | VPI-1004 |  |
| E1005 | Prakash Venugopal | M | 1975-11-07 | 2013-09-09 | LE-01 | LOC-BLR | OU-130 | DES-03 | D | WC-PERM | OFFICE8 | SH-F | E1002 | Meenakshi Sundaram | HO |  | Active | UAN000100037185 | XXXX7085 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-BLR | LOC-BLR | 13.02 | 80 | Y | 4 | 2 | VPI-1005 |  |
| E1006 | Anita Mathew | F | 1988-04-23 | 2019-06-03 | LE-01 | LOC-BLR | OU-160 | DES-06 | C | WC-PERM | OFFICE8 | SH-F | E1004 | Ritu Balachandran | HO |  | Active | UAN000100037222 | XXXX7102 | HR Ops demo persona | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 7.29 | 55 | Y | 4 | 2 | VPI-1006 |  |
| E1007 | Deepak Sarangi | M | 1987-12-02 | 2018-08-20 | LE-01 | LOC-BLR | OU-150 | DES-07 | C | WC-PERM | OFFICE8 | SH-F | E1003 | Farhan Qureshi | HO |  | Active | UAN000100037259 | XXXX7119 | Payroll demo persona | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 8.07 | 50 | Y | 4 | 2 | VPI-1007 |  |
| E1008 | Shalini Krishnamurthy | F | 1995-07-30 | 2022-01-10 | LE-01 | LOC-BLR | OU-160 | DES-11 | A | WC-PERM | OFFICE8 | SH-F | E1006 | Anita Mathew | HO |  | Active | UAN000100037296 | XXXX7136 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 4.68 | 30 | N | 4 | 2 | VPI-1008 |  |
| E1009 | Vikram Chauhan | M | 1990-02-14 | 2020-03-02 | LE-01 | LOC-BLR | OU-160 | DES-10 | B | WC-PERM | OFFICE8 | SH-F | E1004 | Ritu Balachandran | HO |  | Active | UAN000100037333 | XXXX7153 | Compliance owner | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 6.54 | 34 | N | 4 | 2 | VPI-1009 |  |
| E1010 | Nandita Bose | F | 1985-10-11 | 2017-05-15 | LE-01 | LOC-BLR | OU-150 | DES-05 | C | WC-PERM | OFFICE8 | SH-F | E1003 | Farhan Qureshi | HO |  | Active | UAN000100037370 | XXXX7170 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 9.34 | 60 | Y | 4 | 2 | VPI-1010 |  |
| E1011 | Rohit Agarwal | M | 1993-05-26 | 2021-09-06 | LE-01 | LOC-BLR | OU-150 | DES-11 | A | WC-PERM | OFFICE8 | SH-F | E1010 | Nandita Bose | HO |  | Active | UAN000100037407 | XXXX7187 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 5.02 | 30 | N | 4 | 2 | VPI-1011 |  |
| E1012 | Sameer Kulkarni | M | 1986-08-08 | 2019-02-11 | LE-01 | LOC-BLR | OU-170 | DES-06 | C | WC-PERM | OFFICE8 | SH-F | E1003 | Farhan Qureshi | HO |  | Active | UAN000100037444 | XXXX7204 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 7.59 | 55 | Y | 4 | 2 | VPI-1012 |  |
| E1013 | Tanvi Deshmukh | F | 1997-01-17 | 2023-07-17 | LE-01 | LOC-BLR | OU-170 | DES-09 | B | WC-PERM | OFFICE8 | SH-F | E1012 | Sameer Kulkarni | HO |  | Active | UAN000100037481 | XXXX7221 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 3.16 | 35 | N | 4 | 2 | VPI-1013 |  |
| E1014 | Harish Nambiar | M | 1983-03-05 | 2018-04-02 | LE-01 | LOC-BLR | OU-140 | DES-05 | C | WC-PERM | OFFICE8 | SH-F | E1001 | Arvind Raghunathan | HO |  | Active | UAN000100037518 | XXXX7238 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 8.45 | 60 | Y | 4 | 2 | VPI-1014 |  |
| E1015 | Pooja Trivedi | F | 1989-09-21 | 2020-10-05 | LE-01 | LOC-BLR | OU-140 | DES-06 | C | WC-PERM | OFFICE8 | SH-F | E1014 | Harish Nambiar | HO |  | Active | UAN000100037555 | XXXX7255 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-BLR | 5.94 | 55 | Y | 4 | 2 | VPI-1015 |  |
| E1016 | Basavaraj Hiremath | M | 1973-07-14 | 2014-01-06 | LE-01 | LOC-PLA | OU-110 | DES-03 | D | WC-PERM | STAFF9 | SH-E | E1002 | Meenakshi Sundaram | PLANT-BLR |  | Active | UAN000100037592 | XXXX7272 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-PLA | LOC-PLA | 12.69 | 80 | Y | 4 | 2 | VPI-1016 |  |
| E1017 | Nikhil Iyer | M | 1984-05-09 | 2017-08-21 | LE-01 | LOC-PLA | OU-111 | DES-05 | C | WC-PERM | STAFF9 | SH-E | E1016 | Basavaraj Hiremath | PLANT-BLR |  | Active | UAN000100037629 | XXXX7289 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 9.07 | 60 | Y | 4 | 2 | VPI-1017 |  |
| E1018 | Ravi Kulkarni | M | 1991-11-23 | 2019-11-04 | LE-01 | LOC-PLA | OU-111 | DES-08 | B | WC-PERM | PLANT12 | SH-A | E1017 | Nikhil Iyer | PLANT-BLR |  | Active | UAN000100037666 | XXXX7306 | Point 1 — 19h20m cross-midnight day | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 6.86 | 40 | N | 4 | 2 | VPI-1018 |  |
| E1019 | Sneha Nair | F | 1994-02-06 | 2021-06-14 | LE-01 | LOC-PLA | OU-111 | DES-09 | B | WC-PERM | PLANT12 | SH-A | E1017 | Nikhil Iyer | PLANT-BLR |  | Active | UAN000100037703 | XXXX7323 | Point 12 — four late instances | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 5.25 | 35 | N | 4 | 2 | VPI-1019 |  |
| E1020 | Arjun Bhat | M | 1996-06-29 | 2022-02-07 | LE-01 | LOC-PLA | OU-112 | DES-09 | B | WC-PERM | PLANT12 | SH-A | E1021 | Rekha Deshpande | PLANT-BLR |  | Active | UAN000100037740 | XXXX7340 | Point 13 — punches into B shift | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 4.6 | 35 | N | 4 | 2 | VPI-1020 |  |
| E1021 | Rekha Deshpande | F | 1982-12-16 | 2016-09-12 | LE-01 | LOC-PLA | OU-112 | DES-06 | C | WC-PERM | STAFF9 | SH-E | E1016 | Basavaraj Hiremath | PLANT-BLR |  | Active | UAN000100037777 | XXXX7357 | Manager demo persona | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 10.01 | 55 | Y | 4 | 2 | VPI-1021 |  |
| E1022 | Mohan Joseph | M | 1992-08-03 | 2020-07-01 | LE-01 | LOC-PLA | OU-112 | DES-12 | A | WC-PERM | PLANT12 | SH-A | E1021 | Rekha Deshpande | PLANT-BLR |  | Active | UAN000100037814 | XXXX7374 | Points 12, 9 — half day, absent, special-terms loan | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 6.21 | 25 | N | 4 | 2 | VPI-1022 |  |
| E1023 | Kavya Venkatesh | F | 1995-04-18 | 2021-03-15 | LE-01 | LOC-PLA | OU-113 | DES-11 | A | WC-PERM | PLANT12 | SH-A | E1024 | Srinivas Achar | PLANT-BLR |  | Active | UAN000100037851 | XXXX7391 | Point 11 — gate pass 2 x 2h | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 5.5 | 30 | N | 4 | 2 | VPI-1023 |  |
| E1024 | Srinivas Achar | M | 1980-10-27 | 2015-12-01 | LE-01 | LOC-PLA | OU-113 | DES-07 | C | WC-PERM | STAFF9 | SH-E | E1016 | Basavaraj Hiremath | PLANT-BLR |  | Active | UAN000100037888 | XXXX7408 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 10.79 | 50 | Y | 4 | 2 | VPI-1024 |  |
| E1025 | Lakshmi Gowda | F | 1998-03-09 | 2023-01-09 | LE-01 | LOC-PLA | OU-111 | DES-13 | A | WC-PERM | PLANT12 | SH-A | E1017 | Nikhil Iyer | PLANT-BLR |  | Active | UAN000100037925 | XXXX7425 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 3.68 | 20 | N | 4 | 2 | VPI-1025 |  |
| E1026 | Manjunath Poojary | M | 1990-01-31 | 2019-04-22 | LE-01 | LOC-PLA | OU-114 | DES-14 | A | WC-PERM | PLANT12 | SH-B | E1027 | Girish Deshpande | PLANT-BLR |  | Active | UAN000100037962 | XXXX7442 | Night shift | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 7.4 | 20 | N | 4 | 2 | VPI-1026 |  |
| E1027 | Girish Deshpande | M | 1981-06-11 | 2017-02-13 | LE-01 | LOC-PLA | OU-114 | DES-07 | C | WC-PERM | STAFF9 | SH-E | E1016 | Basavaraj Hiremath | PLANT-BLR |  | Active | UAN000100037999 | XXXX7459 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 9.59 | 50 | Y | 4 | 2 | VPI-1027 |  |
| E1028 | Yashoda Rani | F | 1989-05-02 | 2018-10-29 | LE-01 | LOC-PLA | OU-112 | DES-12 | A | WC-PERM | PLANT12 | SH-A | E1021 | Rekha Deshpande | PLANT-BLR |  | Active | UAN000100038036 | XXXX7476 | Point 6 — comp-off nearing lapse | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 7.88 | 25 | N | 4 | 2 | VPI-1028 |  |
| E1029 | Prashant Salian | M | 2000-09-15 | 2024-08-01 | LE-01 | LOC-PLA | OU-111 | DES-13 | A | WC-PERM | PLANT12 | SH-B | E1017 | Nikhil Iyer | PLANT-BLR |  | Active | UAN000100038073 | XXXX7493 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 2.12 | 20 | N | 4 | 2 | VPI-1029 |  |
| E1030 | Chetan Bhandary | M | 2003-04-26 | 2026-07-01 | LE-01 | LOC-PLA | OU-111 | DES-15 | T | WC-TRN | STAFF9 | SH-E | E1017 | Nikhil Iyer | PLANT-BLR |  | Active | UAN000100038110 | XXXX7510 | Point 7 — GET, July joiner, 3 CL/SL | CAT-TRN — Trainee | SUB-TRN — Engineer trainee | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-TRN | TRAINEE_GET | GET | 60 | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 0.21 | 15 | N | 4 | 2 | VPI-1030 |  |
| E1031 | Divya Hegde | F | 2004-08-12 | 2026-07-01 | LE-01 | LOC-PLA | OU-113 | DES-16 | T | WC-TRN | STAFF9 | SH-E | E1024 | Srinivas Achar | PLANT-BLR |  | Active | UAN000100038147 | XXXX7527 | Point 7 — DET, July joiner, 3 CL/SL | CAT-TRN — Trainee | SUB-TRN — Engineer trainee | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-TRN | TRAINEE_DET | DET | 60 | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 0.21 | 14 | N | 4 | 2 | VPI-1031 |  |
| E1032 | Shivanna Muniyappa | M | 1987-02-20 | 2025-04-01 | LE-01 | LOC-PLA | OU-111 | DES-18 | H | WC-CONT | PLANT12 | SH-A | E1017 | Nikhil Iyer | PLANT-BLR | VN-02 | Active | UAN000100038184 | XXXX7544 | Point 2 — daily wage, no rest day | CAT-CONT — Contractual |  | N |  | Daily | Y | All days | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 1.46 | 5 | N |  |  | VPI-1032 | no rest day — resolves at category level; not leave eligible |
| E1033 | Ratnamma Devaraju | F | 1990-11-05 | 2025-06-15 | LE-01 | LOC-PLA | OU-112 | DES-18 | H | WC-CONT | PLANT12 | SH-A | E1021 | Rekha Deshpande | PLANT-BLR | VN-02 | Active | UAN000100038221 | XXXX7561 | Point 2 — daily wage, works Sunday | CAT-CONT — Contractual |  | N |  | Daily | Y | All days | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 1.25 | 5 | N |  |  | VPI-1033 | no rest day — resolves at category level; not leave eligible |
| E1034 | Imran Shaikh | M | 1993-07-08 | 2025-02-10 | LE-01 | LOC-PLA | OU-112 | DES-13 | A | WC-3PE | PLANT12 | SH-A | E1021 | Rekha Deshpande | PLANT-BLR | VN-01 | Active | UAN000100038258 | XXXX7578 | Points 3, 4 — 3P employee, has rest days, OT rest/holiday only | CAT-3P — Third party | SUB-EMP — Employee | Y | Sunday weekly off | Monthly | Y | Rest days and holidays only | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 1.59 | 20 | N |  |  | VPI-1034 | OT only on a rest day or holiday; not leave eligible |
| E1035 | Ashok Naik | M | 1991-12-19 | 2025-03-01 | LE-01 | LOC-PLA | OU-114 | DES-14 | A | WC-3PE | PLANT12 | SH-A | E1027 | Girish Deshpande | PLANT-BLR | VN-01 | Active | UAN000100038295 | XXXX7595 |  | CAT-3P — Third party | SUB-EMP — Employee | Y | Sunday weekly off | Monthly | Y | Rest days and holidays only | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 1.54 | 20 | N |  |  | VPI-1035 | OT only on a rest day or holiday; not leave eligible |
| E1036 | Lakshmi Rao | F | 1994-06-03 | 2025-05-20 | LE-01 | LOC-PLA | OU-121 | DES-17 | H | WC-3PH | PLANT12 | SH-A | E1037 | Venkatesh Murthy | PLANT-BLR | VN-01 | Active | UAN000100038332 | XXXX7612 | Point 3 — helper, no rest days | CAT-3P — Third party | SUB-HLP — Helper | N |  | Daily | Y | Rest days and holidays only | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 1.32 | 5 | N |  |  | VPI-1036 | no rest day — resolves at sub-category (Helper) level; OT only on a rest day or holiday; not leave eligible |
| E1037 | Venkatesh Murthy | M | 1986-09-28 | 2019-07-08 | LE-01 | LOC-PLA | OU-121 | DES-11 | A | WC-PERM | STAFF9 | SH-E | E1016 | Basavaraj Hiremath | PLANT-BLR |  | Active | UAN000100038369 | XXXX7629 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PLA | LOC-PLA | 7.19 | 30 | N | 4 | 2 | VPI-1037 |  |
| E1038 | Parvathi Bai | F | 1996-01-22 | 2026-01-12 | LE-01 | LOC-PLA | OU-121 | DES-17 | H | WC-3PH | PLANT12 | SH-A | E1037 | Venkatesh Murthy | PLANT-BLR | VN-01 | Active | UAN000100038406 | XXXX7646 | Point 7 — January joiner reference | CAT-3P — Third party | SUB-HLP — Helper | N |  | Daily | Y | Rest days and holidays only | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-PLA | LOC-PLA | 0.67 | 5 | N |  |  | VPI-1038 | no rest day — resolves at sub-category (Helper) level; OT only on a rest day or holiday; not leave eligible |
| E1039 | Sanjay Pawar | M | 1977-04-17 | 2015-06-01 | LE-01 | LOC-PUN | OU-110 | DES-03 | D | WC-PERM | STAFF9 | SH-E | E1002 | Meenakshi Sundaram | PLANT-PUN |  | Active | UAN000100038443 | XXXX7663 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-PUN | LOC-PUN | 11.29 | 80 | Y | 4 | 2 | VPI-1039 |  |
| E1040 | Aditi Joshi | F | 1985-08-24 | 2018-11-19 | LE-01 | LOC-PUN | OU-112 | DES-06 | C | WC-PERM | STAFF9 | SH-E | E1039 | Sanjay Pawar | PLANT-PUN |  | Active | UAN000100038480 | XXXX7680 | Point 9 — guarantor, now blocked | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PUN | LOC-PUN | 7.82 | 55 | Y | 4 | 2 | VPI-1040 |  |
| E1041 | Mahesh Shinde | M | 1988-10-13 | 2020-01-20 | LE-01 | LOC-PUN | OU-111 | DES-08 | B | WC-PERM | PLANT10 | SH-C | E1040 | Aditi Joshi | PLANT-PUN |  | Active | UAN000100038517 | XXXX7697 | Point 9 — guarantor, loan application rejected | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PUN | LOC-PUN | 6.65 | 40 | N | 4 | 2 | VPI-1041 |  |
| E1042 | Swapnil Kadam | M | 1994-03-07 | 2022-09-05 | LE-01 | LOC-PUN | OU-114 | DES-09 | B | WC-PERM | PLANT10 | SH-C | E1040 | Aditi Joshi | PLANT-PUN |  | In notice | UAN000100038554 | XXXX7714 | Point 16 — in notice, LWD 18 Sep | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PUN | LOC-PUN | 4.03 | 35 | N | 4 | 2 | VPI-1042 |  |
| E1043 | Neha Mishra | F | 1992-12-01 | 2021-11-02 | LE-01 | LOC-PUN | OU-160 | DES-11 | A | WC-PERM | STAFF9 | SH-E | E1039 | Sanjay Pawar | PLANT-PUN |  | Active | UAN000100038591 | XXXX7731 | Point 5 — early return from 10-day leave | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PUN | LOC-PUN | 4.87 | 30 | N | 4 | 2 | VPI-1043 |  |
| E1044 | Rahul Gaikwad | M | 1989-06-16 | 2019-03-11 | LE-01 | LOC-PUN | OU-112 | DES-12 | A | WC-PERM | PLANT10 | SH-C | E1040 | Aditi Joshi | PLANT-PUN |  | Active | UAN000100038628 | XXXX7748 | Point 9 — active loan, 4x basic | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PUN | LOC-PUN | 7.52 | 25 | N | 4 | 2 | VPI-1044 |  |
| E1045 | Sunita Bhosale | F | 1997-10-04 | 2023-05-08 | LE-01 | LOC-PUN | OU-113 | DES-13 | A | WC-PERM | PLANT10 | SH-D | E1040 | Aditi Joshi | PLANT-PUN |  | Active | UAN000100038665 | XXXX7765 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PUN | LOC-PUN | 3.36 | 20 | N | 4 | 2 | VPI-1045 |  |
| E1046 | Dattatray More | M | 1992-02-11 | 2026-02-02 | LE-01 | LOC-PUN | OU-111 | DES-18 | H | WC-CONT | PLANT10 | SH-C | E1040 | Aditi Joshi | PLANT-PUN | VN-03 | Active | UAN000100038702 | XXXX7782 | Point 7 — February joiner, 5 CL/SL | CAT-CONT — Contractual |  | N |  | Daily | Y | All days | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-PUN | LOC-PUN | 0.62 | 5 | N |  |  | VPI-1046 | no rest day — resolves at category level; not leave eligible |
| E1047 | Koteswara Rao | M | 1976-05-30 | 2016-08-16 | LE-02 | LOC-HYD | OU-110 | DES-03 | D | WC-PERM | STAFF9 | SH-E | E1002 | Meenakshi Sundaram | PLANT-HYD |  | Active | UAN000100038739 | XXXX7799 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-HYD | LOC-HYD | 10.08 | 80 | Y | 4 | 2 | VPI-1047 |  |
| E1048 | Sirisha Yadav | F | 1987-11-09 | 2019-09-23 | LE-02 | LOC-HYD | OU-113 | DES-06 | C | WC-PERM | STAFF9 | SH-E | E1047 | Koteswara Rao | PLANT-HYD |  | Active | UAN000100038776 | XXXX7816 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-HYD | LOC-HYD | 6.98 | 55 | Y | 4 | 2 | VPI-1048 |  |
| E1049 | Naveen Bandaru | M | 1990-08-27 | 2021-04-12 | LE-02 | LOC-HYD | OU-130 | DES-08 | B | WC-PERM | STAFF9 | SH-E | E1047 | Koteswara Rao | PLANT-HYD |  | Active | UAN000100038813 | XXXX7833 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-HYD | LOC-HYD | 5.43 | 40 | N | 4 | 2 | VPI-1049 |  |
| E1050 | Suresh Pillai | M | 1983-01-19 | 2017-10-30 | LE-02 | LOC-HYD | OU-122 | DES-10 | B | WC-PERM | STAFF9 | SH-E | E1047 | Koteswara Rao | PLANT-HYD |  | Active | UAN000100038850 | XXXX7850 | Points 6, 9 — comp-off credits, released guarantor | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-HYD | LOC-HYD | 8.88 | 34 | N | 4 | 2 | VPI-1050 |  |
| E1051 | Haritha Reddy | F | 1999-04-02 | 2024-02-19 | LE-02 | LOC-HYD | OU-112 | DES-09 | B | WC-PERM | PLANT12 | SH-A | E1048 | Sirisha Yadav | PLANT-HYD |  | Active | UAN000100038887 | XXXX7867 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-HYD | LOC-HYD | 2.57 | 35 | N | 4 | 2 | VPI-1051 |  |
| E1052 | Anjaneyulu Gadde | M | 1993-09-11 | 2022-12-05 | LE-02 | LOC-HYD | OU-111 | DES-13 | A | WC-PERM | PLANT12 | SH-B | E1049 | Naveen Bandaru | PLANT-HYD |  | Active | UAN000100038924 | XXXX7884 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-HYD | LOC-HYD | 3.78 | 20 | N | 4 | 2 | VPI-1052 |  |
| E1053 | Padmaja Cheruku | F | 1995-03-25 | 2026-03-09 | LE-02 | LOC-HYD | OU-121 | DES-17 | H | WC-3PH | PLANT12 | SH-A | E1050 | Suresh Pillai | PLANT-HYD | VN-04 | Active | UAN000100038961 | XXXX7901 | Point 7 — March joiner, 5 CL/SL | CAT-3P — Third party | SUB-HLP — Helper | N |  | Daily | Y | Rest days and holidays only | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-HYD | LOC-HYD | 0.52 | 5 | N |  |  | VPI-1053 | no rest day — resolves at sub-category (Helper) level; OT only on a rest day or holiday; not leave eligible |
| E1054 | Selvaraj Murugan | M | 1974-12-08 | 2015-02-02 | LE-02 | LOC-CHN | OU-110 | DES-03 | D | WC-PERM | STAFF9 | SH-E | E1002 | Meenakshi Sundaram | PLANT-CHN |  | Active | UAN000100038998 | XXXX7918 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-AGM | AGM_AND_ABOVE |  | 60 | Not applicable — annual credit on 1 January | LOC-CHN | LOC-CHN | 11.62 | 80 | Y | 4 | 2 | VPI-1054 |  |
| E1055 | Kalaivani Subramani | F | 1986-07-21 | 2020-06-22 | LE-02 | LOC-CHN | OU-160 | DES-06 | C | WC-PERM | STAFF9 | SH-E | E1054 | Selvaraj Murugan | PLANT-CHN |  | Active | UAN000100039035 | XXXX7935 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-CHN | LOC-CHN | 6.23 | 55 | Y | 4 | 2 | VPI-1055 |  |
| E1056 | Anand Krishnan | M | 1985-02-28 | 2018-01-15 | LE-02 | LOC-CHN | OU-111 | DES-08 | B | WC-PERM | PLANT12 | SH-A | E1054 | Selvaraj Murugan | HO |  | Active | UAN000100039072 | XXXX7952 | Point 8 — HO payroll, plant attendance. Point 9 — 6x basic | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-BLR | LOC-CHN | 8.67 | 40 | N | 4 | 2 | VPI-1056 | payrolled at head office while attending at LOC-CHN — point 8 |
| E1057 | Bhuvaneswari Raman | F | 1998-05-14 | 2023-03-27 | LE-02 | LOC-CHN | OU-113 | DES-11 | A | WC-PERM | PLANT12 | SH-A | E1055 | Kalaivani Subramani | PLANT-CHN |  | Active | UAN000100039109 | XXXX7969 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-CHN | LOC-CHN | 3.47 | 30 | N | 4 | 2 | VPI-1057 |  |
| E1058 | Karthik Chidambaram | M | 1996-09-06 | 2025-09-01 | LE-02 | LOC-CHN | OU-114 | DES-09 | B | WC-PERM | PLANT12 | SH-A | E1054 | Selvaraj Murugan | PLANT-CHN |  | Active | UAN000100039146 | XXXX7986 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-CHN | LOC-CHN | 1.04 | 35 | N | 4 | 2 | VPI-1058 |  |
| E1059 | Vetrivel Pandian | M | 1991-01-12 | 2021-08-09 | LE-02 | LOC-CHN | OU-112 | DES-12 | A | WC-PERM | PLANT12 | SH-B | E1054 | Selvaraj Murugan | PLANT-CHN |  | Active | UAN000100039183 | XXXX8003 |  | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-CHN | LOC-CHN | 5.1 | 25 | N | 4 | 2 | VPI-1059 |  |
| E1060 | Jayanthi Elangovan | F | 2001-06-23 | 2026-04-06 | LE-02 | LOC-CHN | OU-111 | DES-13 | A | WC-PERM | PLANT12 | SH-A | E1054 | Selvaraj Murugan | PLANT-CHN |  | Active | UAN000100039220 | XXXX8020 | Point 7 — April joiner, 4 CL/SL | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | 2026-10-06 | LOC-CHN | LOC-CHN | 0.44 | 20 | N | 4 | 2 | VPI-1060 |  |
| E1061 | Murugesan Palani | M | 1990-10-30 | 2026-05-11 | LE-02 | LOC-CHN | OU-111 | DES-18 | H | WC-CONT | PLANT12 | SH-A | E1054 | Selvaraj Murugan | PLANT-CHN | VN-05 | Active | UAN000100039257 | XXXX8037 | Points 2, 7 — May joiner, daily wage | CAT-CONT — Contractual |  | N |  | Daily | Y | All days | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-CHN | LOC-CHN | 0.35 | 5 | N |  |  | VPI-1061 | no rest day — resolves at category level; not leave eligible |
| E1062 | Saravanan Thangavel | M | 1992-04-09 | 2025-12-01 | LE-02 | LOC-CHN | OU-114 | DES-14 | A | WC-3PE | PLANT12 | SH-A | E1054 | Selvaraj Murugan | PLANT-CHN | VN-05 | Active | UAN000100039294 | XXXX8054 |  | CAT-3P — Third party | SUB-EMP — Employee | Y | Sunday weekly off | Monthly | Y | Rest days and holidays only | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-CHN | LOC-CHN | 0.79 | 20 | N |  |  | VPI-1062 | OT only on a rest day or holiday; not leave eligible |
| E1063 | Revathi Natarajan | F | 2004-02-17 | 2026-02-16 | LE-02 | LOC-CHN | OU-113 | DES-19 | T | WC-APP | STAFF9 | SH-E | E1055 | Kalaivani Subramani | PLANT-CHN |  | Active |  | XXXX8071 | Apprentice — no PF/ESI | CAT-APP — Apprentice |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-NONE | NOT_ELIGIBLE | Apprentice |  | Not applicable — scheme accrues no EL | LOC-CHN | LOC-CHN | 0.58 | 10 | N |  |  | VPI-1063 | not leave eligible |
| E1064 | Gopinath Sekar | M | 1971-08-05 | 2026-06-01 | LE-02 | LOC-CHN | OU-180 | DES-20 | C | WC-CONS | OFFICE8 | SH-F | E1054 | Selvaraj Murugan | HO |  | Active |  | XXXX8088 | Consultant — TDS 194J, no leave | CAT-RET — Retainer |  | N |  | Monthly | Y | All days | 2 | LS-NONE | NOT_ELIGIBLE |  |  | Not applicable — scheme accrues no EL | LOC-BLR | LOC-CHN | 0.29 | 50 | Y |  |  | VPI-1064 | no rest day — resolves at category level; payrolled at head office while attending at LOC-CHN — point 8; not leave eligible |
| E1065 | Ishita Chatterjee | F | 1999-11-27 | 2026-08-17 | LE-01 | LOC-BLR | OU-130 | DES-09 | B | WC-PERM | OFFICE8 | SH-F | E1005 | Prakash Venugopal | HO |  | Active | UAN000100039405 | XXXX8105 | Point 7 — August joiner, 2 CL/SL | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | 2027-02-17 | LOC-BLR | LOC-BLR | 0.08 | 35 | N | 4 | 2 | VPI-1065 |  |
| E1066 | Abhinav Rastogi | M | 1997-07-13 | 2026-09-01 | LE-01 | LOC-PUN | OU-122 | DES-11 | A | WC-PERM | STAFF9 | SH-E | E1039 | Sanjay Pawar | PLANT-PUN |  | Active | UAN000100039442 | XXXX8122 | Point 7 — September joiner, 2 CL/SL | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | 2027-03-01 | LOC-PUN | LOC-PUN | 0.04 | 30 | N | 4 | 2 | VPI-1066 |  |
| E1067 | Ankita Bhargava | F | 1995-12-04 | 2026-03-16 | LE-01 | LOC-BLR | OU-113 | DES-09 | B | WC-PERM | OFFICE8 | SH-F | E1005 | Prakash Venugopal | HO |  | Active | UAN000100039479 | XXXX8139 | Point 7 — completes 6 months 16 Sep, 9 EL credited | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | 2026-09-16 | LOC-BLR | LOC-BLR | 0.5 | 35 | N | 4 | 2 | VPI-1067 |  |
| E1068 | Dinesh Vaidya | M | 1987-03-18 | 2019-05-06 | LE-01 | LOC-PUN | OU-130 | DES-08 | B | WC-PERM | STAFF9 | SH-E | E1039 | Sanjay Pawar | PLANT-PUN |  | In notice | UAN000100039516 | XXXX8156 | Point 16 — resigned, LWD 30 Sep, F&F | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | Eligible — six months completed before 2026 | LOC-PUN | LOC-PUN | 7.36 | 40 | N | 4 | 2 | VPI-1068 |  |
| E1069 | Meera Prabhu | F | 1993-02-11 | 2026-01-12 | LE-01 | LOC-PLA | OU-113 | DES-11 | A | WC-PERM | STAFF9 | SH-E | E1024 | Srinivas Achar | PLANT-BLR |  | Active | UAN000100039553 | XXXX7418 | Added v1.1 — the January 2026 joiner the proration ladder needed (PR-01, 6 CL and 6 SL). Fills the one vacancy that sheet 10 showed against SM-004. | CAT-PERM — Permanent |  | Y | Sunday weekly off | Monthly | Y | All days | 2 | LS-STD | STANDARD |  | 60 | 2026-07-12 | LOC-PLA | LOC-PLA | 0.67 | 30 | N | 4 | 2 | VPI-1069 |  |
| 69 workers across 9 worker classes, 5 sites and 4 states. E1056 is the point-8 record: located at Chennai, payrolled at head office. Payroll group and location are independent by design. ADDED v1.1 — columns V to AQ carry the policy attributes the WIP requirements are actually about: rest-day applicability (R-03, R-04), OT eligibility basis (R-05), leave scheme and COFF lapse (R-07, R-08), payroll versus attendance location (R-09), continuous service for the loan ceiling (R-10) and the gate-pass entitlement (R-12). Every value is derived from 38_Employment_Categories, 05_Designations and 06_Worker_Classes, so the resolution order in rule RL-05 can be demonstrated rather than asserted. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `38_Employment_Categories` (11 rows)

| Category code | Category name | Is third party | Sub-category code | Sub-category name | Rest day applicable | Rest day pattern | Wage basis | Default leave scheme | Default OT eligibility basis | Resolves to worker class | Employees on this row | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CAT-PERM | Permanent | N |  |  | Y | Sunday weekly off | Monthly | LS-STD | All days | WC-PERM | 44 |  |
| CAT-FTC | Fixed Term Contract | N |  |  | Y | Sunday weekly off | Monthly | LS-STD | All days | WC-FTC | 0 | Seeded for completeness — no employee on this category in the demo tenant |
| CAT-CONT | Contractual | N |  |  | N |  | Daily | LS-NONE | All days | WC-CONT | 5 | Point 2 — no rest day, paid daily wages |
| CAT-3P | Third party | Y | SUB-EMP | Employee | Y | Sunday weekly off | Monthly | LS-NONE | Rest days and holidays only | WC-3PE | 3 | Points 3, 4 |
| CAT-3P | Third party | Y | SUB-HLP | Helper | N |  | Daily | LS-NONE | Rest days and holidays only | WC-3PH | 4 | Point 3 — the rest-day answer differs from SUB-EMP on the same category |
| CAT-TRN | Trainee | N | SUB-GET | Graduate Engineer Trainee | Y | Sunday weekly off | Monthly | LS-TRN | Not eligible | WC-TRN | 1 | Point 7 — trainees are eligible for CL |
| CAT-TRN | Trainee | N | SUB-DET | Diploma Engineer Trainee | Y | Sunday weekly off | Monthly | LS-TRN | Not eligible | WC-TRN | 1 | Point 7 |
| CAT-APP | Apprentice | N |  |  | Y | Sunday weekly off | Monthly | LS-NONE | Not eligible | WC-APP | 1 | Apprentices Act — outside the DET and GET CL entitlement |
| CAT-RET | Retainer | N |  |  | N |  | Monthly | LS-NONE | Not eligible | WC-CONS | 1 |  |
| CAT-GIG | Gig / platform | N |  |  | N |  | Per engagement | LS-NONE | Not eligible | WC-GIG | 0 | Seeded for completeness |
| ADDED v1.1 for form F-EMP-02. This is the sheet rule RL-05 resolves against: rest-day applicability is read from the employee record first, then the sub-category, then the category. The two CAT-3P rows are the whole of demo points 3 and 4 — one category, one vendor, one site, one shift, and two different rest-day answers, settled by data rather than by a code branch. Load this before 12_Employees. |  |  |  |  |  |  |  |  |  |  |  |  |

### `62_Documents` (8 rows)

| Document | Employee code | Name | Document class | Reference (masked) | Uploaded on | Verified by | Verification status | Expires on | Mandatory | Blocks | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DOC-2026-1188 | E1066 | Abhinav Rastogi | Aadhaar | XXXX XXXX 4417 | 2026-08-27 | E1008 | Verified |  | Y | Joining | Point 23 |
| DOC-2026-1189 | E1066 | Abhinav Rastogi | PAN | XXXXX1194F | 2026-08-27 | E1008 | Verified |  | Y | Payroll — no TDS without it | Point 23 |
| DOC-2026-1190 | E1066 | Abhinav Rastogi | Medical fitness certificate | MFC/PUN/2026/0881 | 2026-08-29 | E1009 | Verified | 2027-08-29 | Y | Joining at a factory establishment | Points 23, 26 |
| DOC-2026-1191 | E1066 | Abhinav Rastogi | Relieving letter | Previous employer | 2026-08-30 | E1008 | Verified |  | N |  |  |
| DOC-2026-1204 | E1034 | Imran Shaikh | Contract / agreement | VN-01 deployment letter | 2026-04-02 | E1009 | Verified | 2027-03-31 | Y | Deployment at the establishment | Point 3 |
| DOC-2026-1205 | E1036 | Lakshmi Rao | Medical fitness certificate | MFC/BLR/2025/1902 | 2025-09-14 | E1009 | Rejected | 2026-09-14 | Y | Deployment — expires 14 September, renewal not received | Point 17 — a third-party worker whose fitness certificate lapses inside the demo window. The principal employer carries this, not the contractor. |
| DOC-2026-1211 | E1063 | Revathi Natarajan | Educational certificate | Diploma, 2025 | 2026-02-16 |  | Pending |  | Y | Apprentice registration under NAPS |  |
| ADDED v1.1 for form FRM-PPL-05. Identifiers are masked here and format-valid dummies in the tenant, per the rule in the README — never demo with a real Aadhaar or PAN. DOC-2026-1205 is the row to open on the compliance walk: a contractor's worker whose medical fitness certificate expires on 14 September, one day before the demo clock. The obligation is the principal employer's, which is exactly the argument for holding third-party workers in the same system as everyone else. |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 205 | specified items (table rows) | Counted automatically at generation |
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
