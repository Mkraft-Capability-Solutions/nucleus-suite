<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-11 — Payroll — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-11 |
| Title | Payroll — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 26_Payroll_Runs, 47_Pay_Components, 48_PT_Slabs, 55_Payroll_Register, 57_Bank_File, 58_FnF_Settlement |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

_No entries in source for this scope._

## 2. Reference and golden data

### `26_Payroll_Runs` (7 rows)

| Run ID | Entity | Period | Run type | State | Employees | Gross (INR) | Net (INR) | Statutory (INR) | Pay date | GL posted on | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PR-2026-08-01 | LE-01 | Aug 2026 | Regular | CLOSED | 412 | 28640000 | 24118000 | 3820000 | 2026-08-31 | 2026-09-02 |  |
| PR-2026-09-01 | LE-01 | Sep 2026 | Regular | PRE_AUDIT | 418 | 29015000 |  |  | 2026-09-30 |  | Point 10 |
| PR-2026-09-02 | LE-01 | Sep 2026 | Off-cycle overtime | DRAFT | 96 | 412000 |  |  | 2026-10-07 |  | Point 10 — overtime disburses after the salary run, as its own run |
| PR-2026-09-03 | LE-01 | Sep 2026 | Full and final | DRAFT | 2 |  |  |  | 2026-09-30 |  | Point 16 — E1042 and E1068 |
| PR-2026-08-11 | LE-02 | Aug 2026 | Regular | CLOSED | 188 | 11240000 | 9506000 | 1488000 | 2026-08-31 | 2026-09-02 |  |
| PR-2026-09-11 | LE-02 | Sep 2026 | Regular | PRE_AUDIT | 189 | 11318000 |  |  | 2026-09-30 |  |  |
| Four runs against September for LE-01. Any screen that assumes one run per period is wrong — payslip retrieval, the cycle stepper and the statutory outputs all need a run selector. |  |  |  |  |  |  |  |  |  |  |  |

### `47_Pay_Components` (25 rows)

| Component code | Component name | Type | Calculation | Taxable | PF applicable | ESI applicable | PT applicable | In the Code on Wages base | Proration basis | Shows on payslip | GL mapping | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PC-BASIC | Basic | Earning | Fixed, from the salary structure | Y | Y | Y | Y | Y | Calendar days paid | Y | GL-001 | Point 9 — the loan ceiling multiplies this |
| PC-DA | Dearness allowance | Earning | 12% of Basic | Y | Y | Y | Y | Y | Calendar days paid | Y | GL-002 |  |
| PC-HRA | House rent allowance | Earning | 40% of Basic | Y | N | Y | Y | N | Calendar days paid | Y | GL-003 |  |
| PC-CONV | Conveyance | Earning | Fixed 1,600 | Y | N | Y | Y | N | Calendar days paid | Y | GL-004 |  |
| PC-SPL | Special allowance | Earning | Balancing figure to gross | Y | N | Y | Y | N | Calendar days paid | Y | GL-005 | Carries the 50% floor add-back — see column P of sheet 13 |
| PC-DWAGE | Daily wage | Earning | Daily rate multiplied by days present | Y | Y | Y | Y | Y | Days present | Y | GL-001 | Point 2 — the component a daily-wage worker is paid on |
| PC-RETAINER | Retainer fee | Earning | Fixed monthly | Y | N | N | N | N | Calendar days | Y | GL-001 | TDS under 194J, not salary |
| PC-OT | Overtime | Earning | OT hours multiplied by the hourly wage base and the OT multiplier | Y | N | Y | N | N | Not prorated | Y | GL-006 | Points 4, 10 — paid only in the off-cycle OT run |
| PC-LEAVE-ENC | Leave encashment | Earning | Encashable balance multiplied by the daily wage base | Y | N | N | N | N | Not prorated | Y | GL-010 | Point 7 — raised by the year-end run and at F&F |
| PC-NOTICE-PAY | Notice pay | Earning | Shortfall days multiplied by the daily gross | Y | N | N | N | N | Not prorated | Y | GL-001 | Point 16 |
| PC-GRATUITY | Gratuity | Earning | 15/26 of Basic+DA for each completed year | Y (exempt to limit) | N | N | N | N | Not prorated | Y | GL-009 | Point 16 |
| PC-RECOG | Recognition award | Earning | Fixed, from the nomination | Y | N | N | Y | N | Not prorated | Y | GL-011 | Point 18 |
| PC-REFERRAL | Referral award | Earning | Fixed, from the referral record | Y | N | N | Y | N | Not prorated | Y | GL-012 | Point 19 |
| PC-PF-EE | Provident fund — employee | Deduction | 12% of the statutory wage base |  |  |  |  |  | Follows the wage base | Y | GL-014 | Reads column Q of sheet 13, not gross |
| PC-ESI-EE | ESI — employee | Deduction | 0.75% of gross where gross is at or below the ESI ceiling |  |  |  |  |  | Follows gross | Y | GL-015 |  |
| PC-PT | Professional tax | Deduction | From the state slab set on the work location |  |  |  |  |  | Not prorated | Y | GL-016 / GL-017 | Point 17 — differs by state on the same run |
| PC-TDS | Income tax deducted at source | Deduction | Projected annual liability spread over remaining months |  |  |  |  |  | Not prorated | Y | GL-018 |  |
| PC-LWF | Labour welfare fund | Deduction | From the state LWF set, at the stated frequency |  |  |  |  |  | Not prorated | Y | GL-019 |  |
| PC-LOAN | Loan instalment recovery | Deduction | Instalment from the active loan |  |  |  |  |  | Not prorated | Y | GL-020 | Point 9 — reads 24_Loans |
| PC-ADV | Salary advance recovery | Deduction | From the advance schedule |  |  |  |  |  | Not prorated | Y | GL-021 | Point 9 |
| PC-CANTEEN | Canteen recovery | Deduction | From the canteen feed |  |  |  |  |  | Not prorated | Y | GL-022 |  |
| PC-RECOVERY | Exit recovery | Deduction | From the no-dues checklist |  |  |  |  |  | Not prorated | Y | GL-022 | Point 16 — unreturned assets land here |
| PC-PF-ER | Provident fund — employer | Employer contribution | 12% of the statutory wage base |  |  |  |  |  | Follows the wage base | N | GL-007 |  |
| PC-ESI-ER | ESI — employer | Employer contribution | 3.25% of gross where within the ceiling |  |  |  |  |  | Follows gross | N | GL-008 |  |
| ADDED v1.1 for form FRM-PAY-01. v1.0 carried the components as column headings in sheet 13 and as names in the GL map, but never as a master — so nothing said which of them is PF-bearing, which prorates on days present, or which one a daily-wage worker is actually paid on. The last three columns are the ones to walk: proration basis explains point 2, the Code on Wages column explains the add-back in sheet 13, and GL mapping is the join to sheet 35. |  |  |  |  |  |  |  |  |  |  |  |  |

### `48_PT_Slabs` (10 rows)

| Slab set | State | Monthly gross from (INR) | Monthly gross to (INR) | PT per month (INR) | Deduction frequency | Special rule | Applies to locations | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| KA-PT-Slab-2026 | Karnataka | 0 | 24999 | 0 | Monthly |  | LOC-BLR, LOC-PLA | Point 17 |
| KA-PT-Slab-2026 | Karnataka | 25000 |  | 200 | Monthly |  | LOC-BLR, LOC-PLA | Point 17 |
| MH-PT-Slab-2026 | Maharashtra | 0 | 7500 | 0 | Monthly |  | LOC-PUN | Point 17 |
| MH-PT-Slab-2026 | Maharashtra | 7501 | 10000 | 175 | Monthly | Nil for women up to this band | LOC-PUN | Point 17 |
| MH-PT-Slab-2026 | Maharashtra | 10001 |  | 200 | Monthly | February is 300 so the annual total reaches 2,500 — the single best proof that PT is a slab engine and not a constant | LOC-PUN | Point 17 |
| TS-PT-Slab-2026 | Telangana | 0 | 15000 | 0 | Monthly |  | LOC-HYD | Point 17 |
| TS-PT-Slab-2026 | Telangana | 15001 | 20000 | 150 | Monthly |  | LOC-HYD | Point 17 |
| TS-PT-Slab-2026 | Telangana | 20001 |  | 200 | Monthly |  | LOC-HYD | Point 17 |
| TN-PT-Slab-2026 | Tamil Nadu | 0 |  |  | Half yearly | Levied by the local body on half-yearly income, not monthly on gross. This is why OB-2026-0917 reads Not applicable for the August monthly cycle — the obligation is real but falls due half-yearly. | LOC-CHN | Point 17 |
| ADDED v1.1. v1.0 named a slab set on every location but never gave the slabs, so "PT differs by state on the same run" could only be asserted. Run September for LE-01 and show four employees on four different PT outcomes in one register. AMBER WARNING: these are demo values. Slabs are amended by state notification and Tamil Nadu is levied by the local body, so confirm each against the current notification before the demo — a wrong slab in front of a finance head costs more credibility than a missing feature. |  |  |  |  |  |  |  |  |

### `55_Payroll_Register` (19 rows)

| Run | Employee code | Name | Payroll group | Work location | Days in period | Days paid | LOP days | Basic | DA | HRA | Conveyance | Special allowance | Overtime | Gross | PF employee | ESI employee | Professional tax | PT state | TDS | Loan recovery | Other recovery | Total deductions | Net pay | What to point out | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PR-2026-08-01 | E1018 | Ravi Kulkarni | PLANT-BLR | LOC-PLA | 31 | 31 | 0 | 38250 | 4590 | 15300 | 1600 | 10710 | 0 | 70450 | 5141 | 0 | 200 | Karnataka | 3100 | 0 | 0 | 8441 | 62009 | Clean full month, no attendance effects |  |
| PR-2026-08-01 | E1019 | Sneha Nair | PLANT-BLR | LOC-PLA | 31 | 31 | 0 | 38500 | 4620 | 15400 | 1600 | 10780 | 0 | 70900 | 5174 | 0 | 200 | Karnataka | 3150 | 0 | 0 | 8524 | 62376 | Clean in August. Compare with her September line below |  |
| PR-2026-08-01 | E1022 | Mohan Joseph | PLANT-BLR | LOC-PLA | 31 | 31 | 0 | 21500 | 2580 | 8600 | 1600 | 6020 | 0 | 40300 | 2890 | 0 | 200 | Karnataka | 900 | 0 | 0 | 3990 | 36310 | Clean in August |  |
| PR-2026-08-01 | E1032 | Shivanna Muniyappa | PLANT-BLR | LOC-PLA | 31 | 27 | 0 | 17550 | 0 | 0 | 0 | 0 | 0 | 17550 | 2106 | 132 | 200 | Karnataka | 0 | 0 | 0 | 2438 | 15112 | Point 2 — daily wage. 27 days present in a 31-day month, no weekly off generated and none deducted. Paid on days present, not on a monthly salary. | Point 2 |
| PR-2026-08-01 | E1036 | Lakshmi Rao | PLANT-BLR | LOC-PLA | 31 | 27 | 0 | 17145 | 0 | 0 | 0 | 0 | 0 | 17145 | 2057 | 129 | 200 | Karnataka | 0 | 0 | 0 | 2386 | 14759 | Point 3 — third-party helper, no rest day, daily wage | Point 3 |
| PR-2026-08-01 | E1044 | Rahul Gaikwad | PLANT-PUN | LOC-PUN | 31 | 31 | 0 | 21750 | 2610 | 8700 | 1600 | 6090 | 0 | 40750 | 2923 | 0 | 200 | Maharashtra | 900 | 3500 | 0 | 7523 | 33227 | Point 9 — the loan instalment on LN-2026-0041 recovers here, read from the loan record rather than keyed | Point 9 |
| PR-2026-08-01 | E1056 | Anand Krishnan | HO | LOC-CHN | 31 | 31 | 0 | 39000 | 4680 | 15600 | 1600 | 10920 | 0 | 71800 | 5242 | 0 | 0 | Tamil Nadu | 3200 | 0 | 0 | 8442 | 63358 | Point 8 — payroll group HO, work location Chennai. Professional tax is nil because Tamil Nadu levies it half-yearly through the local body, not monthly. Same run, four different PT answers across the register. | Points 8, 17 |
| PR-2026-08-01 | E1069 | Meera Prabhu | PLANT-BLR | LOC-PLA | 31 | 31 | 0 | 21750 | 2610 | 8700 | 1600 | 6090 | 0 | 40750 | 2923 | 0 | 200 | Karnataka | 900 | 0 | 0 | 4023 | 36727 | Added v1.1 |  |
| PR-2026-09-01 | E1019 | Sneha Nair | PLANT-BLR | LOC-PLA | 30 | 29 | 1 | 37217 | 4466 | 14887 | 1547 | 10421 | 0 | 68538 | 5002 | 0 | 200 | Karnataka | 3050 | 0 | 0 | 8252 | 60286 | Point 12 — half days on 10 and 14 September from the fourth and fifth late marks, one LOP day between them. Trace it back to rows AD-00025 and AD-00029 in sheet 21. | Point 12 |
| PR-2026-09-01 | E1021 | Rekha Deshpande | PLANT-BLR | LOC-PLA | 30 | 30 | 0 | 62500 | 7500 | 25000 | 1600 | 17500 | 0 | 114100 | 8400 | 0 | 200 | Karnataka | 4400 | 0 | 0 | 13000 | 101100 | Point 12 — five lates beyond grace in the same month and no deduction at all, because her grade rank is 55 and the exempt rank is 50. Put this line next to E1019 above. | Point 12 |
| PR-2026-09-01 | E1022 | Mohan Joseph | PLANT-BLR | LOC-PLA | 30 | 28.5 | 1.5 | 20425 | 2451 | 8170 | 1520 | 5719 | 0 | 38285 | 2745 | 0 | 200 | Karnataka | 850 | 0 | 0 | 3795 | 34490 | Point 12 — a half day on 02 September and an absence on 09 September. The absence raised LOP, not a leave debit | Point 12 |
| PR-2026-09-01 | E1043 | Neha Mishra | PLANT-PUN | LOC-PUN | 30 | 30 | 0 | 21500 | 2580 | 8600 | 1600 | 6020 | 0 | 40300 | 2890 | 0 | 200 | Maharashtra | 880 | 0 | 0 | 3970 | 36330 | Point 5 — ten days of approved leave, returned after seven. Days 14 to 16 are paid as present, not as leave, and three EL days went back to her balance. | Point 5 |
| PR-2026-09-01 | E1032 | Shivanna Muniyappa | PLANT-BLR | LOC-PLA | 30 | 30 | 0 | 19500 | 0 | 0 | 0 | 0 | 0 | 19500 | 2340 | 146 | 200 | Karnataka | 0 | 0 | 0 | 2686 | 16814 | Point 2 — thirty days present including both Sundays, because this worker class generates no weekly off | Point 2 |
| PR-2026-09-01 | E1056 | Anand Krishnan | HO | LOC-CHN | 30 | 30 | 0 | 39000 | 4680 | 15600 | 1600 | 10920 | 0 | 71800 | 5242 | 0 | 0 | Tamil Nadu | 3200 | 0 | 0 | 8442 | 63358 | Point 8 — invisible to the Chennai plant HR sign-in on the same register | Point 8 |
| PR-2026-09-02 | E1018 | Ravi Kulkarni | PLANT-BLR | LOC-PLA |  |  |  | 0 | 0 | 0 | 0 | 0 | 24160 | 24160 | 0 | 0 | 0 | Karnataka | 1450 | 0 | 0 | 1450 | 22710 | Point 1 and 10 — 7h20m from 08 September at twice the hourly wage base. Disbursed on 07 October in a run of its own, after the September salary run has closed. | Points 1, 10 |
| PR-2026-09-02 | E1034 | Imran Shaikh | PLANT-BLR | LOC-PLA |  |  |  | 0 | 0 | 0 | 0 | 0 | 23860 | 23860 | 0 | 179 | 0 | Karnataka | 0 | 0 | 0 | 179 | 23681 | Point 4 — the whole 12h08m span of 06 September is payable because it fell on his rest day. His 04 September span was just as long and pays nothing. | Point 4 |
| PR-2026-09-02 | E1026 | Manjunath Poojary | PLANT-BLR | LOC-PLA |  |  |  | 0 | 0 | 0 | 0 | 0 | 290 | 290 | 0 | 2 | 0 | Karnataka | 0 | 0 | 0 | 2 | 288 | Twelve minutes, after the missed out punch was regularised | Point 1 |
| PR-2026-09-02 | E1032 | Shivanna Muniyappa | PLANT-BLR | LOC-PLA |  |  |  | 0 | 0 | 0 | 0 | 0 | 33 | 33 | 0 | 0 | 0 | Karnataka | 0 | 0 | 0 | 0 | 33 | Point 2 — a daily-wage worker earns overtime on the same basis as anyone else; 13 September is an ordinary working day for him, not a rest day. | Point 2 |
| ADDED v1.1. Eighteen sample lines, not a complete register — PR-2026-08-01 ran 412 employees and PR-2026-09-01 runs 418. The August lines are from the closed run and tie to the journal in 56_GL_Journal and the bank file in 57_Bank_File. The September lines sit at pre-audit and are the ones that carry attendance into pay: put the E1019 and E1021 rows side by side, same month, same late-mark rule, one loses a day and the other loses nothing. The four overtime lines belong to a separate run with its own pay date, which is the whole of demo point 10. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `57_Bank_File` (5 rows)

| File | Run | Entity | Bank | Format | Value date | Records | Total amount (INR) | Status | Reconciles to | Variance | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BF-2026-08-0412 | PR-2026-08-01 | LE-01 | HDFC Bank | Corporate bulk payment, fixed width | 2026-08-31 | 412 | 24118000 | Released and acknowledged | Salary payable credit on journal JV-2026-08-0441, line 10 | 0 | Point 15 |
| BF-2026-08-0188 | PR-2026-08-11 | LE-02 | ICICI Bank | Corporate bulk payment, fixed width | 2026-08-31 | 188 | 9506000 | Released and acknowledged | Salary payable credit on the LE-02 August journal | 0 |  |
| BF-2026-10-0096 | PR-2026-09-02 | LE-01 | HDFC Bank | Corporate bulk payment, fixed width | 2026-10-07 | 96 | 384190 | Not generated — run is in DRAFT | Salary payable credit on journal JV-2026-10-0007, line 3 | 0 | Point 10 — a second file, a second value date, a week after the salary file |
| BF-2026-09-0002 | PR-2026-09-03 | LE-01 | HDFC Bank | Corporate bulk payment, fixed width | 2026-09-30 | 1 | 251219 | Held — one of the two settlements is not cleared | Full and final settlement for E1068; E1042 is excluded until his clearance closes | 0 | Point 16 — the no-dues gate reaches the bank file, not just the screen |
| ADDED v1.1 for form FRM-PAY-07. The last row is the one worth dwelling on: E1042's settlement is held at the clearance checklist and therefore never reaches the payment file at all. A no-dues process that only greys out a button on a screen is not a control; one that keeps the amount out of the bank file is. |  |  |  |  |  |  |  |  |  |  |  |

### `58_FnF_Settlement` (18 rows)

| Settlement | Employee code | Name | Resigned on | Last working day | Notice required | Notice served | Completed years of service | No dues status | Component | Type | Amount (INR) | Basis | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FF-2026-0021 | E1068 | Dinesh Vaidya | 2026-08-31 | 2026-09-30 | 30 | 30 | 7 | Cleared — all 6 lines | September salary, 01 to 30 Sep | Earning | 70900 | Full month worked to the last working day |  |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | Gratuity | Earning | 174138 | 15/26 of Basic plus DA, 43,120, for 7 completed years | Point 16 |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | Leave encashment | Earning | 15755 | 9.5 EL days at 1,658.46, the wage base divided by 26. The balance is the one in sheet 53 and includes the September accrual credited on the last working day. | Points 7, 16 |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | Notice pay | Earning | 0 | 30 days required and 30 served — nothing either way |  |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | Provident fund — employee | Deduction | 5174 | 12% of the wage base |  |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | Professional tax | Deduction | 200 | Maharashtra, Chakan Works | Point 17 |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | TDS | Deduction | 4200 |  |  |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | Asset recovery | Deduction | 0 | Laptop AST-L-0298 returned on 24 September in good condition | Points 16, 23 |
| FF-2026-0021 | E1068 | Dinesh Vaidya |  |  |  |  |  |  | NET SETTLEMENT | Net | 251219 | Released on the last working day, 30 September, in run PR-2026-09-03 | Point 16 |
| FF-2026-0018 | E1042 | Swapnil Kadam | 2026-08-19 | 2026-09-18 | 30 | 30 | 4 | Held — 2 blocking lines open | September salary, 01 to 18 Sep | Earning | 43080 | 18 of 30 days |  |
| FF-2026-0018 | E1042 | Swapnil Kadam |  |  |  |  |  |  | Gratuity | Earning | 0 | Not payable. Four years of continuous service against the five-year qualifying period — put this next to E1068 above, because the rule is the same and the answer is opposite. | Point 16 |
| FF-2026-0018 | E1042 | Swapnil Kadam |  |  |  |  |  |  | Leave encashment | Earning | 10080 | 6 EL days at 1,680, the wage base divided by 26 | Point 16 |
| FF-2026-0018 | E1042 | Swapnil Kadam |  |  |  |  |  |  | Provident fund — employee | Deduction | 3145 | 12% of the prorated wage base |  |
| FF-2026-0018 | E1042 | Swapnil Kadam |  |  |  |  |  |  | Professional tax | Deduction | 200 | Maharashtra | Point 17 |
| FF-2026-0018 | E1042 | Swapnil Kadam |  |  |  |  |  |  | TDS | Deduction | 1800 |  |  |
| FF-2026-0018 | E1042 | Swapnil Kadam |  |  |  |  |  |  | Asset recovery | Deduction | 12500 | Tool kit AST-T-0077 at 12,000 and locker key AST-K-0231 at 500, both still out. The figures come from the recovery value added to sheet 33 in v1.1, and the same two items are the blocking clearance lines in sheet 27. | Points 16, 23 |
| FF-2026-0018 | E1042 | Swapnil Kadam |  |  |  |  |  |  | NET SETTLEMENT | Net | 35515 | Computed but not released. Clear the tool kit and the knowledge transfer line in sheet 27, then release and watch it join the bank file. | Point 16 |
| ADDED v1.1 for form FRM-PAY-08. v1.0 had the clearance checklist in sheet 27 and a settlement run in sheet 26, but nothing in between — no amounts, so the same-day settlement in demo point 16 could be described and not shown. Run the two side by side. E1068 clears and settles on his last working day, which is the promise. E1042 is computed to the rupee and held, and the 12,500 of unreturned assets only exists as a number because the checklist found them. The gratuity contrast between the two is worth naming out loud: seven years pays, four does not, and no one had to remember the rule. |  |  |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 84 | specified items (table rows) | Counted automatically at generation |
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
