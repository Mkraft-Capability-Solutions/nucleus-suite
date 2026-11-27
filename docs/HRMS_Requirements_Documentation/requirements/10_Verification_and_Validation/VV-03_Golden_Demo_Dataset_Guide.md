<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# VV-03 — Golden Demo Dataset Guide

| Attribute | Value |
| :--- | :--- |
| Document ID | VV-03 |
| Title | Golden Demo Dataset Guide |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | QA / Test Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | VV, TS |
| Related documents | VV-01, VV-02, UAT-01, FRS-<DOM>-11 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus HRMS Demo Dataset v1.1 — sheet(s) 00_README, 01_Scenario_Map, 70_Change_Log_v1_1 |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. About the golden dataset

| Topic | Detail |
| :--- | :--- |
| Nucleus HRMS — Demo Dataset v1.0 |  |
| Version | v1.1, 15 September 2026. Extends v1.0 with 33 sheets and corrects four data defects. Read 70_Change_Log_v1_1 first, then 69_Coverage_Matrix. Load order for the added sheets is in the change log note. Every formula from v1.0 is unchanged and recalculates identically. |
| Purpose | Reference data for populating a Nucleus demo tenant. Every record is engineered so that one or more of the 26 client demo points can be shown live, end to end. |
| Demo client | Vindhya Precision Industries Pvt Ltd — a fictional multi-state manufacturer. Two legal entities, five sites, four states, 68 workers across nine worker classes. |
| Demo period | Attendance and transactions are dated 01–15 September 2026. Payroll cycle is September 2026. Set the demo tenant clock to 15 September 2026 so open items sit in the right state. |
| HOW TO USE THIS FILE |  |
| 1 | Load sheets in the numbered order. 02–19 are master and configuration data and must exist before any transaction sheet will import. |
| 2 | Enter the data exactly as given. The values are not arbitrary — thresholds, times, dates and amounts are chosen so the expected results in sheet 21 are reproduced by the product. |
| 3 | After loading, run the attendance computation for 01–15 September and reconcile against sheet 21 (21_Expected_Attendance). Any row where the product disagrees with the expected status is a defect to fix before the demo, not a data error. |
| 4 | Sheet 01_Scenario_Map is the demo script. It names, for each of the 26 client points, the exact records to open on screen and what the client should see. |
| LEGEND — how to read the sheets |  |
| Codes ending in a number | Primary keys. Use these exact values; every other sheet references them. |
| Demo_Point column | Names the client requirement that the row exists to prove. Blank means the row is background data providing realistic volume. |
| Grey banded rows | Alternate-row shading only. No meaning. |
| Amber cells | A value that must be entered exactly as given, because a computed result depends on it. |
| Blank cells | Deliberately empty — either not applicable to that worker class, or a field the product is expected to derive. |
| Formulas | Sheets 13, 21 and 24 carry formulas that derive values from the configuration sheets. They are there so the dataset checks itself — if you change a threshold in 08, the expected status in 21 updates. |
| WHAT IS DELIBERATELY NOT HERE |  |
| Bank account numbers | Only last four digits are given. Use the product's own test account generator. |
| Aadhaar, PAN, UAN | Format-valid dummy values only, flagged as such. Never demo with real identifiers. |
| Photographs and documents | Attach any placeholder; none are supplied. |
| COVERAGE | All 26 demo points are covered. See 01_Scenario_Map for the record-level mapping. |

## 2. Scenario map — records that prove each requirement

| Demo point | Requirement | Sheets to load | Records to open | What the client should see | Also load (added in v1.1) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Multi-punch day, 19h20m across midnight, separate dinner-break report, OT 7h20m | 20_Punch_Events, 21_Expected_Attendance | E1018 Ravi Kulkarni, 08 Sep 2026 | Two segments (08:00–20:30, 21:15–03:20). Gross 19h20m, dinner break 45m listed separately, OT 7h20m against the 12h shift. Attendance date stays 08 Sep, not split across two days. | 49_Break_Register, 43_Roles_and_Data_Scope, 44_Demo_Users, 52_Shift_Roster |
| 1 | Team history for a date range, from the team calendar | 21_Expected_Attendance | Manager E1017 Nikhil Iyer, 01–15 Sep | Filter by manager and date range; export the per-day attendance, OT, late and gate-pass columns. | 49_Break_Register, 43_Roles_and_Data_Scope, 44_Demo_Users, 52_Shift_Roster |
| 2 | Contractual employees have no rest days and are paid daily wages | 06_Worker_Classes, 12_Employees, 21_Expected_Attendance | WC-CONT; E1032 Shivanna Muniyappa, 06 and 13 Sep | Sundays appear as Working, not Weekly Off. Wage type Daily on the employee record. | 38_Employment_Categories, 47_Pay_Components, 55_Payroll_Register |
| 3 | Third-party group: employees have rest days, helpers do not | 06_Worker_Classes, 12_Employees, 21_Expected_Attendance | E1034 Imran Shaikh (WC-3PE) vs E1036 Lakshmi Rao (WC-3PH), 06 Sep | Same vendor VN-01, same site, same shift. Sunday is Weekly Off for one and Working for the other. | 38_Employment_Categories, 45_Vendors_Contractors, 46_Contractor_Invoices |
| 4 | Overtime only on rest days or holidays for some employees | 06_Worker_Classes, 21_Expected_Attendance | E1034 Imran Shaikh, 04 Sep vs 06 Sep | Weekday OT computes to zero despite a 12h+ span. Rest-day working pays the whole span as OT. | 38_Employment_Categories, 55_Payroll_Register |
| 5 | Early return from leave — mark present, re-credit balance, three-level approval | 18_Leave_Requests, 17_Leave_Ledger | LV-2026-0774, E1043 Neha Mishra | Applied 10 days, returned after 6. Ledger shows the original debit and a reversal credit of the unused days. Approval trail shows Supervisor, then HOD, then HR Head, with an HR edit logged. | 50_Attendance_Regularisation, 53_Leave_Balance_AsOn, 64_Approval_Workflows |
| 6 | Comp-off lapses 60 days from the credit date | 19_CompOff_Ledger | CO-2026-0231 (E1028) and CO-2026-0288 (E1028) | Two credits on separate clocks. The July credit lapses 10 Sep; the 06 Sep credit runs to 05 Nov. Show that a single balance-level expiry cannot express this. | 53_Leave_Balance_AsOn — the ledger now reconciles to the comp-off register |
| 7 | Auto leave credit — bands, accrual, joiner proration, caps, encashment, trainees | 14_Leave_Types, 15_Leave_Accrual_Policy, 16_Leave_Proration, 17_Leave_Ledger | E1004 (AGM band, 18 EL), E1019 (standard, 1.5 EL/month), E1067 Ankita Bhargava (6 months on 16 Sep, 9 EL), E1060 (April joiner, 4 CL/SL), E1030/E1031 (GET/DET) | Walk the ladder from policy to individual balance. Then attempt a CL+EL combined application and show it blocked by the exclusion rule, and an 11th EL day in one month blocked by the monthly cap. | 39_Leave_Schemes, 40_Leave_Rules_Matrix, 53_Leave_Balance_AsOn, 54_Year_End_Leave_Preview |
| 8 | HO-generated salary, plant attendance, plant users cannot see rate | 12_Employees, 13_Salary_Structure | E1056 Anand Krishnan — location LOC-CHN, payroll group HO | Sign in as the Chennai plant HR user: attendance visible and editable, every compensation field blank. Sign in as E1007 Deepak Sarangi (payroll): the same record shows full salary. | 43_Roles_and_Data_Scope, 44_Demo_Users, 55_Payroll_Register |
| 9 | Loan policy — one at a time, guarantors, 4x and 6x basic, guarantor lock, override | 24_Loans, 25_Loan_Guarantors | LN-2026-0041, LN-2026-0009, LN-APP-2026-0014, LN-2026-0012 | E1044 has an active loan at 4x basic. His guarantors E1040 and E1041 are now blocked — show E1041's application rejected with the reason. E1056 qualifies at 6x on 8 years' service. E1050's closed loan released his guarantors. E1022 carries a director-approved special-terms sanction. | 64_Approval_Workflows |
| 10 | Overtime generated and paid after salary, not with it | 23_Overtime_Register, 26_Payroll_Runs | PR-2026-09-01 and PR-2026-09-02 | Two runs against September. The regular run releases on 30 Sep; the off-cycle OT run on 07 Oct, with its own bank file and its own GL journal line. | 55_Payroll_Register, 56_GL_Journal, 57_Bank_File |
| 11 | Gate pass — 4 hours a month, maximum two, added to work hours | 22_Gate_Pass, 21_Expected_Attendance | GP-2026-0141, GP-2026-0155, GP-2026-0163 (E1023) | Two approved passes of 2h each. Both dates show the gap as a break and the same minutes credited back, so net hours are unaffected. The third request is rejected on the monthly ceiling. | 49_Break_Register, 67_Reports_Register |
| 12 | Half-day and absent thresholds, grace, three lates, exemption, long-night relief | 08_Attendance_Rules, 21_Expected_Attendance | E1022 (02 and 09 Sep), E1019 (01/03/07/10/14 Sep), E1041 (07 Sep), E1018 (09 Sep), E1021 any late day | Half day, absent, the fourth late converting to half day, the 10h-shift threshold, relief after a 03:20 finish, and a Manager-grade employee arriving late with no deduction. | 41_Grace_Late_Policy, 42_Night_Extension_Rule, 51_Attendance_Exceptions — and E1021 now has attendance |
| 13 | Auto shift capture from the in-punch | 07_Shifts, 21_Expected_Attendance | E1020 Arjun Bhat, 04 and 11 Sep | Assigned SH-A, punched inside the SH-B window. Shift_Applied differs from Shift_Assigned and the 12h threshold is applied against the inferred shift. | 52_Shift_Roster, 51_Attendance_Exceptions |
| 14 | Link the ERP employee master by API | 36_ERP_Inbound_Master | Batch ERP-SYNC-2026-09-14, six rows | Three clean upserts, one field-ownership conflict held for review, one unmatched employee code, one duplicate payload rejected on hash. Show the ownership map deciding who wins. |  |
| 15 | Account posting to ERP | 35_GL_Mapping, 26_Payroll_Runs | September journal, both runs | Every component mapped to an account and cost centre. Show the run blocked when a mapping is missing, then the balanced journal and the reconciliation to the bank file total. | 56_GL_Journal, 57_Bank_File, 35_GL_Mapping — four accounts added so the journal balances |
| 16 | Full and final on the last working day, with no-dues clearance | 27_Exit_Clearance | E1068 Dinesh Vaidya (LWD 30 Sep), E1042 Swapnil Kadam (LWD 18 Sep) | Nine checklist items with named owners, four blocking. E1042 has two open blocking items so F&F is held; E1068 is fully cleared and settles on the last working day. | 58_FnF_Settlement, 33_Assets recovery value, 57_Bank_File |
| 17 | Statutory compliance, Factory Act forms and returns | 28_Statutory_Calendar, 29_Statutory_Forms | Sep–Nov obligations across four states | PT differs by state on the same run. Show the register set for a Karnataka factory against Tamil Nadu. | 48_PT_Slabs, 62_Documents, 45_Vendors_Contractors |
| 18 | Star employees | 30_Recognition_Referral | RC-2026-Q2-004, RC-2026-Q2-007 | Programme, citation, period and the award component flowing to payroll as an earning. |  |
| 19 | Referral process and awards | 30_Recognition_Referral | RF-2026-0021 (part paid), RF-2026-0026 (balance due on confirmation) | Referral tracked from candidate through to a payroll payout in a named run. | 59_Candidates_and_Offers, 60_Confirmations |
| 20 | Announcements — birthday, star employee, new joiner, referral, management message | 31_Announcements | AN-2026-0088 through AN-2026-0094 | Auto-generated from events, with audience rules and channel selection including business messaging. |  |
| 21 | Appointment and other HR letters | 32_Letter_Templates | TPL-APPT-02 issued to E1066, TPL-CONF-01 issued to E1058 | Template version retained against the issued letter, so a reprint two years later is provable. |  |
| 22 | Organisation chart, department-wise hierarchy | 04_Org_Units, 12_Employees | OU-100 down to OU-180, three levels | Drill the chart, then filter headcount by org unit and location. |  |
| 23 | Induction training at joining, and asset | 33_Assets, 34_Induction_Learning | E1066 Abhinav Rastogi, joined 01 Sep | Induction path assigned on joining, three assets allocated, and the same assets appearing as blocking clearance items at exit. | 60_Confirmations, 61_Preboarding_Chain, 62_Documents |
| 24 | Recruitment — position code for replacement | 11_Positions, 37_Requisitions | REQ-2026-0037 against vacated POS-2214; REQ-2026-0041 as an addition | The replacement consumes no fresh sanction. The addition is blocked because Machining is at sanctioned strength. | 59_Candidates_and_Offers, 61_Preboarding_Chain |
| 25 | Approved manpower, department wise | 10_Sanctioned_Manpower | OU-111 Machining at Peenya — 24 sanctioned, 24 filled | Sanctioned against actual against open requisitions, by department, designation and location. | 59_Candidates_and_Offers |
| 26 | Joining form under the Factory Act, Form F | 29_Statutory_Forms, 34_Induction_Learning | FRM-F-2026-0112 for E1066 | Generated inside the joining chain, not chased afterwards. Owner for this item is to be assigned. | 61_Preboarding_Chain |

## 3. Dataset sheet catalogue

| Sheet | Rows | Domain pack | Columns |
| :--- | ---: | :--- | :--- |
| `00_README` | 21 | VV-03 §1 | Nucleus HRMS — Demo Dataset v1.0 |
| `01_Scenario_Map` | 28 | VV-03 §2 | Demo point, Requirement, Client status, Sheets to load, Records to open, What the client should see, Also load (added in v1.1) |
| `02_Legal_Entities` | 2 | FRS-PLT-11 | Entity code, Registered name, CIN / LLPIN, Registered office, PAN, PF / Labour code, GSTIN, Financial year, Status |
| `03_Locations` | 5 | FRS-PLT-11 | Location code, Location name, Entity, City, State, State code, Establishment type, PIN, Factory licence, PT slab set, LWF set, Payroll group, Factory Act applies |
| `04_Org_Units` | 15 | FRS-PPL-11 | Org unit code, Org unit name, Parent, Level, Type, Primary location, Cost centre |
| `05_Designations` | 21 | FRS-PPL-11 | Designation code, Title, Band, Exempt from grace deduction, Leave band, Overtime default, Notice period (days), Grade rank, Default leave scheme, Rule the rank serves |
| `06_Worker_Classes` | 10 | FRS-PPL-11 | Class code, Label, Has rest days, Rest day pattern, Wage type, Overtime eligibility, Leave eligible, Statutory set, Obligation, Demo point |
| `07_Shifts` | 7 | FRS-TIM-11 | Shift code, Shift name, Shift group, Start, End, Duration (min), Break — recorded, paid (min), Break — deducted (min), Inference window — earliest in, Inference window — latest in, Crosses midnight, Half day if net below (min), Absent if net below (min), OT starts after (min), Auto detect enabled, Thresholds source |
| `08_Attendance_Rules` | 5 | FRS-TIM-11 | Shift hours, Half day if net below (min), Absent if net below (min), Grace in (min), Grace out (min), Late instances allowed per month, Long night finishes after, Next-day relief until, Stated as |
| `09_Holiday_Calendar` | 14 | FRS-LVE-11 | Date, Holiday, Applicable locations, Type |
| `10_Sanctioned_Manpower` | 11 | FRS-PPL-11 | Record, Org unit, Designation, Location, Sanctioned, Filled, Open requisitions, Effective from, Approved by, Demo point |
| `11_Positions` | 11 | FRS-PPL-11 | Position code, Title, Org unit, Location, Grade, Cost centre, Status, Current incumbent, Last incumbent, Vacated on, Demo point |
| `12_Employees` | 70 | FRS-PPL-11 | Employee code, Full name, Gender, Date of birth, Date of joining, Entity, Location, Org unit, Designation, Band, Worker class, Shift group, Default shift, Manager code, Manager name, Payroll group, Vendor, Status, UAN (dummy), Bank a/c last 4, Demo point / note, Employment category, Employment sub-category, Rest day applicable, Rest day pattern, Wage basis, OT eligible, OT eligibility basis, OT rate multiplier, Leave scheme, Leave band, Trainee type, COFF lapse days, EL eligibility from, Payroll processing location, Attendance location, Continuous service years, Grade rank, Exempt from grace deduction, Gate pass hours per month |
| `13_Salary_Structure` | 70 | FRS-CMB-11 | Employee code, Name, Worker class, Wage type, Basic (INR), DA (INR), HRA (INR), Conveyance (INR), Special allowance (INR), Daily rate (INR), Monthly retainer (INR), Monthly gross (INR), Wage base — Basic+DA (INR), Excluded components (INR), Excluded as % of gross, 50% floor add-back (INR), Statutory wage base (INR) |
| `14_Leave_Types` | 8 | FRS-LVE-11 | Leave type, Name, Unit, Accrual, Carry forward, Year-end action, Max per month, Cannot be combined with, Expiry rule, Applies to bands, Demo point |
| `15_Leave_Accrual_Policy` | 11 | FRS-LVE-11 | Policy code, Leave band, Leave type, Annual days, Accrual frequency, Days per period, Eligibility wait (months), Credit on completion, Credit date, Demo point, Leave scheme, Availing cap per month |
| `16_Leave_Proration` | 8 | FRS-LVE-11 | Rule code, Joining month from, Joining month to, CL days, SL days, Example employee, Demo point, Leave-eligible check |
| `17_Leave_Ledger` | 46 | FRS-LVE-11 | Ledger ID, Employee code, Name, Leave type, Transaction, Days, Effective date, Expires on, Narration, Source reference, Demo point |
| `18_Leave_Requests` | 8 | FRS-LVE-11 | Request ID, Employee code, Name, Leave type, From, To, Days applied, Days availed, Status, Step 1 — Supervisor, Step 2 — HOD, Step 3 — HR Head, HR edit, Demo point |
| `19_CompOff_Ledger` | 7 | FRS-LVE-11 | Credit ID, Employee code, Name, Earned on, Reason, Days, Expires on, Status, Consumed on, Days remaining, Demo point |
| `20_Punch_Events` | 397 | FRS-TIM-11 | Event ID, Employee code, Name, Attendance date, Segment, Direction, Time, Calendar date of punch, Source, Device, Note |
| `21_Expected_Attendance` | 226 | FRS-TIM-11 | Record, Employee code, Name, Date, Day, Shift assigned, Shift applied, Shift hours, Shift minutes, Day type, First in, Last out, Gross minutes, Break minutes (recorded, paid), Gate pass minutes (deducted), Gate pass credit (approved), OT eligibility, Late by (min), Late instance no, Late beyond allowance, Long-night relief, Note, , Net minutes, Overtime minutes, Expected status, Net (h:mm), OT (h:mm) |
| `22_Gate_Pass` | 6 | FRS-TIM-11 | Gate pass ID, Employee code, Name, Date, From, To, Minutes, Type, Reason, Status, Approver, Minutes used this month, Instances this month, Demo point |
| `23_Overtime_Register` | 8 | FRS-TIM-11 | OT record, Employee code, Name, Date, Day type, OT minutes, OT hours, Rate multiplier, Eligibility basis, Approved by, Approved on, Pay in run, Demo point |
| `24_Loans` | 8 | FRS-CMB-11 | Loan / application ID, Employee code, Name, Purpose, Principal (INR), Sanctioned on, Tenure (months), Instalment (INR), Outstanding (INR), Status, Sanctioned by, Special terms, Eligibility basis, Demo point / reason, Basic (INR), Ceiling multiple, Eligibility ceiling (INR), Within ceiling? |
| `25_Loan_Guarantors` | 10 | FRS-CMB-11 | Loan ID, Guarantor code, Guarantor name, Mandatory, Accepted on, Released on, Guarantor currently blocked, Demo point |
| `26_Payroll_Runs` | 7 | FRS-PAY-11 | Run ID, Entity, Period, Run type, State, Employees, Gross (INR), Net (INR), Statutory (INR), Pay date, GL posted on, Demo point |
| `27_Exit_Clearance` | 13 | FRS-LCY-11 | Employee code, Name, Resigned on, Last working day, Notice served, Checklist item, Owner, Blocking, Status, Cleared on, F&F state, Demo point |
| `28_Statutory_Calendar` | 13 | FRS-CMP-11 | Obligation ID, Obligation, Authority, Entity, State, Period, Due date, Owner, Status, Evidence, Demo point |
| `29_Statutory_Forms` | 9 | FRS-CMP-11 | Form instance, Form, Act / Rules, State, Entity, Location, Period, Generated on, Filed on, Status, Demo point |
| `30_Recognition_Referral` | 8 | FRS-EXP-11 | Record ID, Type, Employee / referrer, Name, Programme / requisition, Period, Citation / candidate, Award (INR), Award status, Pay in run, Announced, Demo point |
| `31_Announcements` | 9 | FRS-EXP-11 | Announcement ID, Type, Title, Audience rule, Channels, Publish from, Publish to, Source event, Created by, Status, Demo point |
| `32_Letter_Templates` | 13 | FRS-EXP-11 | Template / issue ID, Template, Version, Approval required, Issued to, Name, Issued on, Issued by, Merge fields used, Retained version, Demo point |
| `33_Assets` | 10 | FRS-LCY-11 | Asset code, Type, Description, Serial, Status, Allocated to, Name, Issued on, Returned on, Condition, Clearance item at exit, Demo point, Recovery value if not returned (INR) |
| `34_Induction_Learning` | 11 | FRS-LCY-11 | Record, Employee code, Name, Item, Type, Assigned on, Due on, Completed on, Status, Trigger, Demo point |
| `35_GL_Mapping` | 28 | FRS-FIN-11 | Mapping ID, Entity, Pay component / head, Dr / Cr, GL account code, GL account name, Cost centre source, Dimensioned by, Demo point |
| `36_ERP_Inbound_Master` | 9 | FRS-FIN-11 | Sync row, Batch, External employee code, Nucleus code, Field, ERP value, Nucleus value, Field owner, Outcome, Demo point |
| `37_Requisitions` | 8 | FRS-TAL-11 | Requisition, Type, Against position, Org unit, Designation, Location, Raised on, Hiring manager, Sanctioned, Filled, Status, Blocker, Demo point |
| `38_Employment_Categories` | 11 | FRS-PPL-11 | Category code, Category name, Is third party, Sub-category code, Sub-category name, Rest day applicable, Rest day pattern, Wage basis, Default leave scheme, Default OT eligibility basis, Resolves to worker class, Employees on this row, Demo point |
| `39_Leave_Schemes` | 5 | FRS-LVE-11 | Scheme code, Scheme name, Applies from grade rank, Applies to trainees, EL at year end, CL at year end, SL at year end, EL carry forward cap (days), COFF lapse days, Birthday leave, Accrual policies in this scheme, Employees mapped, Demo point |
| `40_Leave_Rules_Matrix` | 10 | FRS-LVE-11 | Rule code, Scheme, Leave type, Cannot be combined with, Checked across contiguous absence, Max availed per calendar month, Min service months before accrual, Catch-up on completion, Half day permitted, Encashable, Display unit, Blocked at, Demo record, Demo point |
| `41_Grace_Late_Policy` | 3 | FRS-TIM-11 | Policy code, Applies to, Grace minutes on arrival, Grace minutes on departure, Lates allowed per month, Consequence beyond the allowance, Counter reset basis, Exempt from grade rank, Exempt designations, Effective from, Demo record, Demo point |
| `42_Night_Extension_Rule` | 3 | FRS-TIM-11 | Rule code, Applies to shift, Previous session ends after, Permitted arrival until, Minimum departure to qualify, Resulting day status, Late mark suppressed, Grace deduction suppressed, Maximum uses per month, Effective from, Demo record, Demo point |
| `43_Roles_and_Data_Scope` | 11 | FRS-PLT-11 | Role code, Role name, Scope dimension, Scope value, Can view salary structure, Can view rate structure, Can view attendance, Can edit attendance, Can run payroll, Can approve, Enforced in, Demo point |
| `44_Demo_Users` | 11 | FRS-PLT-11 | User ID, Login, Full name, Linked employee, Role, Scope granted, Sign in for, What the client should see, Demo point |
| `45_Vendors_Contractors` | 6 | FRS-CTG-11 | Vendor code, Vendor name, Engagement type, Sites served, Contract from, Contract to, CLRA licence, PF code, ESI code, Workers deployed, Worker classes, Invoice basis, PF / ESI verification, Demo point |
| `46_Contractor_Invoices` | 5 | FRS-CTG-11 | Invoice, Vendor, Period, Site, Worker days claimed, Worker days from attendance, Variance (days), Rate per day, Claimed amount (INR), Passed amount (INR), Status, Reconciliation note, Demo point |
| `47_Pay_Components` | 25 | FRS-PAY-11 | Component code, Component name, Type, Calculation, Taxable, PF applicable, ESI applicable, PT applicable, In the Code on Wages base, Proration basis, Shows on payslip, GL mapping, Demo point |
| `48_PT_Slabs` | 10 | FRS-PAY-11 | Slab set, State, Monthly gross from (INR), Monthly gross to (INR), PT per month (INR), Deduction frequency, Special rule, Applies to locations, Demo point |
| `49_Break_Register` | 5 | FRS-TIM-11 | Break ID, Employee code, Name, Attendance date, Session, Break seq, Break start, Break end, Break minutes, Break type, Derived from, Deducted from net hours, Demo point |
| `50_Attendance_Regularisation` | 6 | FRS-TIM-11 | Request, Employee code, Name, Attendance date, Original status, Requested status, Reason, Evidence, Raised on, Raised by, Approver, Approval status, Effect once approved, Demo point |
| `51_Attendance_Exceptions` | 7 | FRS-TIM-11 | Exception, Employee code, Name, Attendance date, Exception type, Detail, Detected on, Severity, Resolution path, Resolved on, Status, Demo point |
| `52_Shift_Roster` | 9 | FRS-TIM-11 | Roster, Employee code, Name, Org unit, From date, To date, Rostered shift, Rotation pattern, Published on, Published by, Overridden by detection, Demo point |
| `53_Leave_Balance_AsOn` | 31 | FRS-LVE-11 | Employee code, Name, Leave type, Opening 01 Jan 2026, Credited, Availed, Reversed, Lapsed, Encashed, Closing as on 15 Sep 2026, Ledger movements behind it, What to point out |
| `54_Year_End_Leave_Preview` | 15 | FRS-LVE-11 | Employee code, Name, Leave scheme, Leave type, Balance as on 15 Sep, Further accrual to 31 Dec, Expiring before 31 Dec, Projected balance at 31 Dec, Year-end action, Days encashed, Days lapsed, Encashment rate per day (INR), Encashment amount (INR) |
| `55_Payroll_Register` | 19 | FRS-PAY-11 | Run, Employee code, Name, Payroll group, Work location, Days in period, Days paid, LOP days, Basic, DA, HRA, Conveyance, Special allowance, Overtime, Gross, PF employee, ESI employee, Professional tax, PT state, TDS, Loan recovery, Other recovery, Total deductions, Net pay, What to point out, Demo point |
| `56_GL_Journal` | 28 | FRS-FIN-11 | Journal, Run, Entity, Period, Line, Mapping ID, Pay component / head, Dr / Cr, GL account, Account name, Cost centre source, Debit (INR), Credit (INR), Posting status, ERP posting reference, Demo point |
| `57_Bank_File` | 5 | FRS-PAY-11 | File, Run, Entity, Bank, Format, Value date, Records, Total amount (INR), Status, Reconciles to, Variance, Demo point |
| `58_FnF_Settlement` | 18 | FRS-PAY-11 | Settlement, Employee code, Name, Resigned on, Last working day, Notice required, Notice served, Completed years of service, No dues status, Component, Type, Amount (INR), Basis, Demo point |
| `59_Candidates_and_Offers` | 9 | FRS-TAL-11 | Candidate, Requisition, Name, Source, Referred by, Stage, Rounds completed, Verdict, Offer, Offered CTC (INR pa), Offer status, Proposed joining date, Becomes employee, Demo point |
| `60_Confirmations` | 6 | FRS-LCY-11 | Record, Employee code, Name, Date of joining, Probation months, Confirmation due, Mandatory induction complete, Manager recommendation, Action, Status, Blocked by, Letter issued, Demo point |
| `61_Preboarding_Chain` | 10 | FRS-LCY-11 | Record, Candidate, Name, Offer, Joining date, Location, Chain step, Owner, Due, Status, Blocks joining, Demo point |
| `62_Documents` | 8 | FRS-PPL-11 | Document, Employee code, Name, Document class, Reference (masked), Uploaded on, Verified by, Verification status, Expires on, Mandatory, Blocks, Demo point |
| `63_Helpdesk_Tickets` | 7 | FRS-SSV-11 | Ticket, Raised by, Name, Category, Subject, Priority, Raised on, SLA due, Assigned to, Status, Resolution, Demo point |
| `64_Approval_Workflows` | 11 | FRS-PLT-11 | Workflow, Name, Form, Chain, Sequential or parallel, Recorded per level, Escalation, Delegation allowed, Return to applicant, Live demo record, Demo point |
| `65_Enum_Seed_Values` | 26 | DA-03 | Enum code, Enum name, Module, System or Config, Complete value set, Default in this tenant, Requirement |
| `66_Picklist_Seed_Values` | 120 | DA-02 | Picklist code, Name, Seeded by, Values, Complete value set |
| `67_Reports_Register` | 18 | FRS-INT-11 | Report, Name, Module, Requirement, Build action, Sheets that feed it, Filters to set in the demo, What to point out, Demo point |
| `68_Acceptance_Test_Data` | 41 | VV-02 | Test, Requirement, Test, Demo records to use, Expected result, Data readiness |
| `69_Coverage_Matrix` | 94 | TR-03 | Form ID, Form or screen, Module, Specified in, Demo sheet that supplies the data, Status |
| `70_Change_Log_v1_1` | 18 | VV-03 §4 | Type, Sheet or area, What was wrong or missing in v1.0, What v1.1 does about it, Demo point affected |

## 4. Dataset corrections between dataset versions 1.0 and 1.1

| Type | Sheet or area | What was wrong or missing in v1.0 | What v1.1 does about it | Demo point affected |
| :--- | :--- | :--- | :--- | :--- |
| Defect | 16_Leave_Proration | The January and February to March examples named E1038 and E1046 — a third-party helper and a contractual daily-wage worker, neither of whom is leave eligible and neither of whom could carry a proration credit. | Examples corrected. E1069 added as a leave-eligible January joiner, and a leave-eligibility check column added so the same mistake is visible next time. | Point 7 |
| Defect | 17_Leave_Ledger | Sheet 19 held six comp-off credits; the ledger carried three of them, none of the consumptions and not the lapse. A balance built from the ledger disagreed with the comp-off register for four of five workers. | Five movements added and the two sheets reconciled. 53_Leave_Balance_AsOn is derived from the ledger alone. | Point 6 |
| Defect | 17_Leave_Ledger | LL-0029 was a two-day casual leave debit whose own narration said no leave was applied and LOP was raised instead — two days silently removed from a balance. | Changed to a zero-day no-movement row so the rejected application stays visible without touching the balance. | Point 12 |
| Defect | 35_GL_Mapping | GL-009 and GL-010 debit the gratuity and leave-encashment provisions with no credit account anywhere in the map, so any journal containing them was short by 700,000 and could not balance. LE-02 had no professional tax credit account at all. | Four mappings added: GL-024, GL-025, GL-026 and GL-027. | Points 15, 17 |
| Gap | 21_Expected_Attendance and 20_Punch_Events | E1021 Rekha Deshpande is named in the demo script as the grade-exempt case for demo point 12 and had no punches and no attendance, so half of that point could not be shown. | 26 punch events and 15 attendance days added — five lates beyond grace in one month, every day still Present. | Point 12 |
| Gap | 12_Employees | The record carried 21 columns and none of the attributes the WIP requirements are about: rest-day applicability, OT eligibility basis, leave scheme, COFF lapse, payroll versus attendance location, continuous service or gate-pass entitlement. | 22 policy columns added, every value derived from the category, designation and worker class masters so the resolution order can be shown rather than asserted. | R-03 to R-12 |
| Gap | 05_Designations | A band letter but no numeric grade rank, so every "and above" rule had nothing to compare against and would have had to match a designation name. | Grade rank and default leave scheme added. AGM and above is rank 70; Assistant Manager and above is rank 50. | Points 7, 12 |
| Gap | Roles and users | No roles, no users, no data scope anywhere in the dataset — demo point 8 is about who is signed in, and it could not be run at all. | 43_Roles_and_Data_Scope and 44_Demo_Users added, ten sign-ins each tied to a point in the script. | Point 8 |
| Gap | Vendors | VN-01 to VN-05 were referenced on the employee record and in the contract-labour register but never defined. | 45_Vendors_Contractors and 46_Contractor_Invoices added. | Points 3, 4, 17 |
| Gap | Break register | Demo point 1 asks for the dinner break to be reported separately and there was no break-level data. | 49_Break_Register added, distinguishing punched breaks from the scheduled shift break. | Point 1 |
| Gap | Payroll outputs | Runs existed at header level only — no employee lines, no journal, no bank file — so demo points 10 and 15 could be described but not shown. | 55_Payroll_Register, 56_GL_Journal and 57_Bank_File added. Both journals balance and reconcile to the bank files. | Points 8, 10, 15 |
| Gap | Full and final | The clearance checklist and the settlement run existed with nothing in between — no amounts. | 58_FnF_Settlement added for both cases, including the gratuity contrast at seven years against four. | Point 16 |
| Gap | Statutory | Every location named a professional tax slab set and no slabs existed anywhere. | 48_PT_Slabs added for four states. Values are demo figures and must be confirmed against current notifications. | Point 17 |
| Gap | Recruitment and lifecycle | Requisitions pointed at candidates who did not exist; confirmation and pre-boarding had no records. | 59_Candidates_and_Offers, 60_Confirmations and 61_Preboarding_Chain added. | Points 19, 23, 24, 25, 26 |
| Gap | Configuration masters | Employment categories, leave schemes, the combination matrix, the grace policy and the night extension rule were all stated as rules with no configuration behind them. | 38, 39, 40, 41 and 42 added. Every number the client stated as policy now sits in a row rather than in the engine. | Points 2, 3, 4, 6, 7, 12 |
| Gap | Tenant seeding | The dataset could not seed a tenant on its own — the value sets lived only in the specification workbooks. | 65_Enum_Seed_Values and 66_Picklist_Seed_Values added, 25 enums and 119 picklists. |  |
| Addition | Traceability | Nothing tied the dataset back to the specifications, so there was no way to tell what was missing. | 67_Reports_Register, 68_Acceptance_Test_Data and 69_Coverage_Matrix added. |  |

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
| Size | 137 | specified items (table rows) | Counted automatically at generation |
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
