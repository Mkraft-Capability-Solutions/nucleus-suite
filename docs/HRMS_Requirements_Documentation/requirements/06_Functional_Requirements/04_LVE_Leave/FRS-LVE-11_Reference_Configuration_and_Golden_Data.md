<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-11 — Leave — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-11 |
| Title | Leave — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Leave |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 09_Holiday_Calendar, 14_Leave_Types, 15_Leave_Accrual_Policy, 16_Leave_Proration, 17_Leave_Ledger, 18_Leave_Requests, 19_CompOff_Ledger, 39_Leave_Schemes, 40_Leave_Rules_Matrix, 53_Leave_Balance_AsOn, 54_Year_End_Leave_Preview |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Leave type code | LVE | F-LVE-01 — Leave Type Master | — | All roles | R-08 | Yes |
| Is compensatory off | LVE | F-LVE-01 — Leave Type Master | N | All roles | R-07 | Yes |
| Is birthday leave | LVE | F-LVE-01 — Leave Type Master | N | All roles | R-08 | Yes |
| Encashable | LVE | F-LVE-01 — Leave Type Master | N | All roles | R-08 | Yes |
| Half day permitted | LVE | F-LVE-01 — Leave Type Master | Y | All roles | R-08 | Yes |
| Display unit | LVE | F-LVE-01 — Leave Type Master | Days | All roles | R-08 | Yes — value set configurable per tenant |
| Leave type | LVE | F-LVE-03 — Leave Application | — | All roles | R-08 | Yes |
| Current approval level | LVE | F-LVE-03 — Leave Application | Supervisor | All roles | R-06 | Yes — value set configurable per tenant |
| Attendance action | LVE | F-LVE-04 — Leave Cancellation & Early Return | Mark present | HR roles only | R-06 | Yes — value set configurable per tenant |
| COFF status | LVE | F-LVE-06 — COFF Register | Available | All roles | R-07 | Yes — value set configurable per tenant |
| Run mode | LVE | F-LVE-07 — Year End Leave Processing | Preview | HR roles only | R-08 | Yes — value set configurable per tenant |

## 2. Reference and golden data

### `09_Holiday_Calendar` (14 rows)

| Date | Holiday | Applicable locations | Type |
| :--- | :--- | :--- | :--- |
| 2026-01-01 | New Year's Day | LOC-BLR,LOC-PUN,LOC-HYD,LOC-CHN | Festival |
| 2026-01-14 | Makara Sankranti / Pongal | LOC-BLR,LOC-HYD,LOC-CHN | Festival |
| 2026-01-26 | Republic Day | ALL | National |
| 2026-03-04 | Holi | LOC-PUN | Festival |
| 2026-04-14 | Dr Ambedkar Jayanti / Tamil New Year | LOC-BLR,LOC-PUN,LOC-CHN | Festival |
| 2026-05-01 | May Day | ALL | Statutory |
| 2026-08-15 | Independence Day | ALL | National |
| 2026-08-26 | Ganesh Chaturthi | LOC-BLR,LOC-PUN | Festival |
| 2026-09-15 | Vinayaka Chaturthi | LOC-HYD,LOC-CHN | Festival |
| 2026-10-02 | Gandhi Jayanti | ALL | National |
| 2026-10-20 | Ayudha Puja / Dussehra | LOC-BLR,LOC-CHN,LOC-HYD | Festival |
| 2026-11-08 | Deepavali | ALL | Festival |
| 2026-12-25 | Christmas | LOC-CHN | Festival |
| Holidays differ by location. 15 Sep 2026 is a holiday at Hyderabad and Chennai only, which is visible in the September attendance for E1056. |  |  |  |

### `14_Leave_Types` (8 rows)

| Leave type | Name | Unit | Accrual | Carry forward | Year-end action | Max per month | Cannot be combined with | Expiry rule | Applies to bands | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EL | Earned Leave | Day | Band-dependent | Yes, up to 45 days | Encash | 10 | CL | None | AGM_AND_ABOVE, STANDARD | Point 7 |
| CL | Casual Leave | Day | Annual on 1 Jan, prorated for joiners | No | Lapse | 2 | EL, SL | 31 Dec | AGM_AND_ABOVE, STANDARD, TRAINEE_GET, TRAINEE_DET | Point 7 |
| SL | Sick Leave | Day | Annual on 1 Jan, prorated for joiners | No | Lapse |  | CL | 31 Dec | AGM_AND_ABOVE, STANDARD | Point 7 |
| CO | Compensatory Off | Day | On rest-day or holiday working | No | Lapse |  |  | 60 days from each credit | All eligible classes | Point 6 |
| BL | Birthday Leave | Day | One day, on or around date of birth | No | Lapse | 1 |  | Birth month | AGM_AND_ABOVE, STANDARD | Point 7 |
| ML | Maternity Leave | Day | Statutory, on eligibility | Not applicable | Not applicable |  |  | Per Maternity Benefit Act | All eligible classes |  |
| LOP | Loss of Pay | Day | Not accrued | Not applicable | Not applicable |  |  |  | All |  |
| Casual leave cannot be taken with or merged into earned or sick leave, and is capped at 2 days a month. Earned leave is capped at 10 days a month. Both are validation rules on the request, evaluated before the approval chain starts. |  |  |  |  |  |  |  |  |  |  |

### `15_Leave_Accrual_Policy` (11 rows)

| Policy code | Leave band | Leave type | Annual days | Accrual frequency | Days per period | Eligibility wait (months) | Credit on completion | Credit date | Demo point | Leave scheme | Availing cap per month |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LP-01 | AGM_AND_ABOVE | EL | 18 | Annual | 18 | 0 |  | 1 January | Point 7 | LS-AGM | 10 |
| LP-02 | AGM_AND_ABOVE | CL | 6 | Annual | 6 | 0 |  | 1 January | Point 7 | LS-AGM | 2 |
| LP-03 | AGM_AND_ABOVE | SL | 6 | Annual | 6 | 0 |  | 1 January | Point 7 | LS-AGM |  |
| LP-04 | STANDARD | EL | 18 | Monthly | 1.5 | 6 | 9 | Last day of each month | Point 7 | LS-STD | 10 |
| LP-05 | STANDARD | CL | 6 | Annual | 6 | 0 |  | 1 January | Point 7 | LS-STD | 2 |
| LP-06 | STANDARD | SL | 6 | Annual | 6 | 0 |  | 1 January | Point 7 | LS-STD |  |
| LP-07 | TRAINEE_GET | CL | 6 | Annual | 6 | 0 |  | 1 January | Point 7 | LS-TRN | 2 |
| LP-08 | TRAINEE_DET | CL | 6 | Annual | 6 | 0 |  | 1 January | Point 7 | LS-TRN | 2 |
| LP-09 | AGM_AND_ABOVE | BL | 1 | Annual | 1 | 0 |  | Birth month | Point 7 | LS-AGM | 1 |
| LP-10 | STANDARD | BL | 1 | Annual | 1 | 0 |  | Birth month | Point 7 | LS-STD | 1 |
| Standard-band employees accrue no earned leave for six months; on completing six months they receive 9 days as a single credit, then 1.5 days a month. E1067 Ankita Bhargava completes six months on 16 September 2026 — use her to show the credit landing. ADDED v1.1: every policy row now names the leave scheme it belongs to (39_Leave_Schemes) and its monthly availing cap. The cap is enforced on the application, never on the accrual. |  |  |  |  |  |  |  |  |  |  |  |

### `16_Leave_Proration` (8 rows)

| Rule code | Joining month from | Joining month to | CL days | SL days | Example employee | Demo point | Leave-eligible check |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PR-01 | January | January | 6 | 6 | E1069 Meera Prabhu — joined 12 Jan 2026 (WC-PERM, leave eligible) | Point 7 | Verified — worker class is leave eligible |
| PR-02 | February | March | 5 | 5 | E1067 Ankita Bhargava — joined 16 Mar 2026 (WC-PERM, leave eligible) | Point 7 | Verified — worker class is leave eligible |
| PR-03 | April | May | 4 | 4 | E1060 Jayanthi Elangovan — joined 06 Apr 2026 (WC-PERM, leave eligible) | Point 7 | Verified — worker class is leave eligible |
| PR-04 | June | July | 3 | 3 | E1030 Chetan Bhandary — joined 01 Jul 2026 (WC-TRN, CL only) | Point 7 | Verified — trainee scheme, CL only |
| PR-05 | August | September | 2 | 2 | E1065 Ishita Chatterjee — joined 17 Aug 2026 (WC-PERM, leave eligible) | Point 7 | Verified — worker class is leave eligible |
| PR-06 | October | 4 December | 1 | 1 | No current employee — see 61_Preboarding_Chain, C-2026-0071 joins 05 Oct 2026 | Point 7 | No record yet |
| PR-07 | 5 December | 31 December | 0 | 0 | No current employee — depends on the answer to open question Q-02 | Point 7 | No record yet |
| CORRECTED v1.1. In v1.0 the PR-01 and PR-02 examples named E1038 Parvathi Bai and E1046 Dattatray More, who are a third-party helper and a contractual daily-wage worker — neither is leave eligible, so neither could carry a proration credit. PR-01 now points at E1069, added in v1.1 for exactly this rung; PR-02 points at E1067, who was already the worked example in sheet 15. Every named example is now a worker whose class actually accrues leave. |  |  |  |  |  |  |  |

### `17_Leave_Ledger` (46 rows)

| Ledger ID | Employee code | Name | Leave type | Transaction | Days | Effective date | Expires on | Narration | Source reference | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LL-0001 | E1004 | Ritu Balachandran | EL | Credit | 18 | 2026-01-01 |  | Annual credit, AGM band | LP-01 | Point 7 |
| LL-0002 | E1004 | Ritu Balachandran | CL | Credit | 6 | 2026-01-01 | 2026-12-31 | Annual credit | LP-02 | Point 7 |
| LL-0003 | E1004 | Ritu Balachandran | SL | Credit | 6 | 2026-01-01 | 2026-12-31 | Annual credit | LP-03 | Point 7 |
| LL-0004 | E1004 | Ritu Balachandran | EL | Debit | 5 | 2026-05-18 |  | Leave taken, LV-2026-0402 |  |  |
| LL-0005 | E1019 | Sneha Nair | CL | Credit | 6 | 2026-01-01 | 2026-12-31 | Annual credit | LP-05 | Point 7 |
| LL-0006 | E1019 | Sneha Nair | SL | Credit | 6 | 2026-01-01 | 2026-12-31 | Annual credit | LP-06 | Point 7 |
| LL-0007 | E1019 | Sneha Nair | EL | Credit | 12 | 2026-08-31 |  | Monthly accrual Jan–Aug at 1.5/month | LP-04 | Point 7 |
| LL-0008 | E1019 | Sneha Nair | CL | Debit | 2 | 2026-06-11 |  | Leave taken, LV-2026-0488 |  |  |
| LL-0009 | E1043 | Neha Mishra | EL | Credit | 12 | 2026-08-31 |  | Monthly accrual Jan–Aug | LP-04 |  |
| LL-0010 | E1043 | Neha Mishra | CL | Credit | 6 | 2026-01-01 | 2026-12-31 | Annual credit | LP-05 |  |
| LL-0011 | E1043 | Neha Mishra | EL | Debit | 10 | 2026-09-07 |  | Applied 10 days, LV-2026-0774 |  | Point 5 |
| LL-0012 | E1043 | Neha Mishra | EL | Reversal | 3 | 2026-09-14 |  | Early return from LV-2026-0774 — unused days re-credited, attendance recomputed for 14, 15 and 16 Sep |  | Point 5 |
| LL-0013 | E1067 | Ankita Bhargava | CL | Credit | 5 | 2026-03-16 | 2026-12-31 | Proration rule PR-02, March joiner | LP-05 | Point 7 |
| LL-0014 | E1067 | Ankita Bhargava | SL | Credit | 5 | 2026-03-16 | 2026-12-31 | Proration rule PR-02, March joiner | LP-06 | Point 7 |
| LL-0015 | E1067 | Ankita Bhargava | EL | Credit | 9 | 2026-09-16 |  | Six months completed — single 9-day credit | LP-04 | Point 7 |
| LL-0016 | E1060 | Jayanthi Elangovan | CL | Credit | 4 | 2026-04-06 | 2026-12-31 | Proration rule PR-03, April joiner | LP-05 | Point 7 |
| LL-0017 | E1060 | Jayanthi Elangovan | SL | Credit | 4 | 2026-04-06 | 2026-12-31 | Proration rule PR-03, April joiner | LP-06 | Point 7 |
| LL-0018 | E1030 | Chetan Bhandary | CL | Credit | 3 | 2026-07-01 | 2026-12-31 | Proration rule PR-04, GET trainee | LP-07 | Point 7 |
| LL-0019 | E1031 | Divya Hegde | CL | Credit | 3 | 2026-07-01 | 2026-12-31 | Proration rule PR-04, DET trainee | LP-08 | Point 7 |
| LL-0020 | E1065 | Ishita Chatterjee | CL | Credit | 2 | 2026-08-17 | 2026-12-31 | Proration rule PR-05, August joiner | LP-05 | Point 7 |
| LL-0021 | E1065 | Ishita Chatterjee | SL | Credit | 2 | 2026-08-17 | 2026-12-31 | Proration rule PR-05, August joiner | LP-06 | Point 7 |
| LL-0022 | E1028 | Yashoda Rani | CO | Credit | 1 | 2026-07-12 | 2026-09-10 | Rest-day working 12 Jul | CO-2026-0231 | Point 6 |
| LL-0023 | E1028 | Yashoda Rani | CO | Credit | 1 | 2026-09-06 | 2026-11-05 | Rest-day working 06 Sep | CO-2026-0288 | Point 6 |
| LL-0024 | E1050 | Suresh Pillai | CO | Credit | 1 | 2026-08-09 | 2026-10-08 | Rest-day working 09 Aug | CO-2026-0266 | Point 6 |
| LL-0025 | E1050 | Suresh Pillai | CO | Debit | 1 | 2026-08-28 |  | Comp-off availed | CO-2026-0244 |  |
| LL-0026 | E1018 | Ravi Kulkarni | EL | Credit | 12 | 2026-08-31 |  | Monthly accrual Jan–Aug | LP-04 |  |
| LL-0027 | E1018 | Ravi Kulkarni | CL | Credit | 6 | 2026-01-01 | 2026-12-31 | Annual credit | LP-05 |  |
| LL-0028 | E1022 | Mohan Joseph | CL | Credit | 6 | 2026-01-01 | 2026-12-31 | Annual credit | LP-05 |  |
| LL-0029 | E1022 | Mohan Joseph | CL | No movement — application rejected | 0 | 2026-09-09 |  | CORRECTED v1.1. In v1.0 this row was a 2-day CL debit whose own narration said no leave was applied and LOP was raised. A debit with no leave behind it silently removes two days from the balance. Kept as a zero-day row so the rejected application is still visible. |  |  |
| LL-0030 | E1056 | Anand Krishnan | EL | Credit | 12 | 2026-08-31 |  | Monthly accrual Jan–Aug | LP-04 |  |
| LL-0031 | E1069 | Meera Prabhu | CL | Credit | 6 | 2026-01-12 | 2026-12-31 | Proration rule PR-01, January joiner | LP-05 | Point 7 |
| LL-0032 | E1069 | Meera Prabhu | SL | Credit | 6 | 2026-01-12 | 2026-12-31 | Proration rule PR-01, January joiner | LP-06 | Point 7 |
| LL-0033 | E1069 | Meera Prabhu | EL | Credit | 9 | 2026-07-12 |  | Six months completed 12 Jul — single 9-day catch-up credit | LP-04 | Point 7 |
| LL-0034 | E1069 | Meera Prabhu | EL | Credit | 1.5 | 2026-08-31 |  | Monthly accrual resumes at 1.5 after the catch-up | LP-04 | Point 7 |
| LL-0035 | E1069 | Meera Prabhu | CL | Debit | 1 | 2026-08-21 |  | Leave taken, LV-2026-0712 |  |  |
| LL-0036 | E1068 | Dinesh Vaidya | EL | Credit | 12 | 2026-08-31 |  | Monthly accrual Jan–Aug | LP-04 |  |
| LL-0037 | E1068 | Dinesh Vaidya | EL | Debit | 4 | 2026-05-11 |  | Leave taken, LV-2026-0361 |  |  |
| LL-0038 | E1068 | Dinesh Vaidya | EL | Credit | 1.5 | 2026-09-30 |  | September accrual, credited on the last working day | LP-04 | Point 16 |
| LL-0039 | E1042 | Swapnil Kadam | EL | Credit | 12 | 2026-08-31 |  | Monthly accrual Jan–Aug | LP-04 |  |
| LL-0040 | E1042 | Swapnil Kadam | EL | Debit | 6 | 2026-04-20 |  | Leave taken, LV-2026-0288 |  |  |
| LL-0041 | E1028 | Yashoda Rani | CO | Debit | 1 | 2026-09-09 |  | Comp-off availed against CO-2026-0231, LV-2026-0788 | CO-2026-0231 | ADDED v1.1 — sheet 19 showed this credit consumed but the ledger had no debit, so the balance read one day high |
| LL-0042 | E1050 | Suresh Pillai | CO | Credit | 1 | 2026-06-29 | 2026-08-28 | Holiday working, stock count | CO-2026-0244 | ADDED v1.1 — the credit behind the LL-0025 debit was missing |
| LL-0043 | E1041 | Mahesh Shinde | CO | Credit | 1 | 2026-09-13 | 2026-11-12 | Rest-day working, preventive maintenance | CO-2026-0301 | ADDED v1.1 — credit existed only in sheet 19 |
| LL-0044 | E1044 | Rahul Gaikwad | CO | Credit | 1 | 2026-05-31 | 2026-07-30 | Rest-day working | CO-2026-0198 | ADDED v1.1 — credit existed only in sheet 19 |
| LL-0045 | E1044 | Rahul Gaikwad | CO | Lapse | 1 | 2026-07-30 |  | Lapsed unconsumed on its expiry date — nightly lapse run LAPSE-2026-07-30 | CO-2026-0198 | Point 6 — ADDED v1.1. Without this row the lapse existed as a status in sheet 19 but never touched the balance |
| Balance is a projection over this ledger, not a stored column. Comp-off expiry, joiner proration and the early-return reversal all fall out of the ledger model — LL-0022 and LL-0023 are two credits for the same person on two separate 60-day clocks, which a single balance cannot express. ADDED v1.1: LL-0031 to LL-0035 give the January rung of the proration ladder and a second worked example of the six-month catch-up — E1069 already past it, E1067 landing on 16 September during the demo window. RECONCILED v1.1. Sheet 19 held six comp-off credits; the ledger carried only three of them and none of the consumptions or the lapse, so a balance built from the ledger disagreed with the comp-off register for four of the five workers. Every credit, availing and lapse in sheet 19 now has a matching ledger movement, and 53_Leave_Balance_AsOn is derived from this sheet alone. Reconcile the two before the demo — being asked to explain a balance and finding the ledger short is the worst moment to discover it. |  |  |  |  |  |  |  |  |  |  |

### `18_Leave_Requests` (8 rows)

| Request ID | Employee code | Name | Leave type | From | To | Days applied | Days availed | Status | Step 1 — Supervisor | Step 2 — HOD | Step 3 — HR Head | HR edit | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LV-2026-0774 | E1043 | Neha Mishra | EL | 2026-09-07 | 2026-09-16 | 10 | 7 | Availed, early return | E1039 approved 05 Sep | E1039 approved 05 Sep | E1004 approved 06 Sep | E1006 closed the request on 14 Sep on early return; 3 unused days re-credited | Point 5 |
| LV-2026-0801 | E1019 | Sneha Nair | CL | 2026-09-21 | 2026-09-22 | 2 |  | Pending | E1017 pending |  |  |  | Point 7 |
| LV-2026-0802 | E1019 | Sneha Nair | CL + EL | 2026-09-24 | 2026-09-28 | 5 |  | Rejected by rule | Not routed |  |  | Blocked at validation — casual leave cannot be combined with earned leave | Point 7 |
| LV-2026-0803 | E1018 | Ravi Kulkarni | EL | 2026-10-05 | 2026-10-16 | 11 |  | Rejected by rule | Not routed |  |  | Blocked at validation — exceeds the 10-day monthly cap on earned leave | Point 7 |
| LV-2026-0788 | E1028 | Yashoda Rani | CO | 2026-09-09 | 2026-09-09 | 1 |  | Approved | E1021 approved 08 Sep | E1016 approved 08 Sep | E1004 approved 08 Sep | Consumed against CO-2026-0231 before it lapsed on 10 Sep | Point 6 |
| LV-2026-0795 | E1057 | Bhuvaneswari Raman | SL | 2026-09-10 | 2026-09-11 | 2 | 2 | Availed | E1055 approved 10 Sep | E1054 approved 10 Sep | E1004 approved 11 Sep |  |  |
| LV-2026-0812 | E1067 | Ankita Bhargava | EL | 2026-09-18 | 2026-09-18 | 1 |  | Pending | E1005 pending |  |  | Applied the day after the 9-day credit landed | Point 7 |
| Approval runs Supervisor, then HOD, then HR Head, sequentially. Two requests are rejected at validation before the chain starts, which is where combination and cap rules belong. |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `19_CompOff_Ledger` (7 rows)

| Credit ID | Employee code | Name | Earned on | Reason | Days | Expires on | Status | Consumed on | Days remaining | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CO-2026-0231 | E1028 | Yashoda Rani | 2026-07-12 | Rest-day working, Assembly line changeover | 1 | 2026-09-10 | Consumed | 2026-09-09 | 0 | Point 6 |
| CO-2026-0288 | E1028 | Yashoda Rani | 2026-09-06 | Rest-day working, month-end despatch | 1 | 2026-11-05 | Open |  | 1 | Point 6 |
| CO-2026-0244 | E1050 | Suresh Pillai | 2026-06-29 | Holiday working, stock count | 1 | 2026-08-28 | Consumed | 2026-08-28 | 0 | Point 6 |
| CO-2026-0266 | E1050 | Suresh Pillai | 2026-08-09 | Rest-day working, inbound clearance | 1 | 2026-10-08 | Open |  | 1 | Point 6 |
| CO-2026-0301 | E1041 | Mahesh Shinde | 2026-09-13 | Rest-day working, preventive maintenance | 1 | 2026-11-12 | Open |  | 1 | Point 6 |
| CO-2026-0198 | E1044 | Rahul Gaikwad | 2026-05-31 | Rest-day working | 1 | 2026-07-30 | Lapsed |  | 0 | Point 6 — show a credit that expired unconsumed |
| Each credit carries its own 60-day clock. Yashoda Rani holds two credits expiring nine weeks apart; Rahul Gaikwad has one that lapsed unused. This is the clearest single demonstration of why the leave model has to be a ledger. |  |  |  |  |  |  |  |  |  |  |

### `39_Leave_Schemes` (5 rows)

| Scheme code | Scheme name | Applies from grade rank | Applies to trainees | EL at year end | CL at year end | SL at year end | EL carry forward cap (days) | COFF lapse days | Birthday leave | Accrual policies in this scheme | Employees mapped | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LS-AGM | Senior Grade Scheme — AGM and above | 70 | N | Encash | Lapse | Lapse | 45 | 60 | Y | LP-01, LP-02, LP-03, LP-09 | 4 | Point 7 — 18 EL, 6 CL and 6 SL credited in one movement on 1 January |
| LS-STD | Standard Staff Scheme | 0 | N | Encash | Lapse | Lapse | 45 | 60 | Y | LP-04, LP-05, LP-06, LP-10 | 40 | Point 7 — 6 CL and 6 SL in January, 1.5 EL a month, no EL for the first six months then a 9-day catch-up |
| LS-TRN | Trainee Scheme — DET and GET | 0 | Y | Not applicable | Lapse | Not applicable |  | 60 | N | LP-07, LP-08 | 2 | Point 7 — CL only; DET and GET are eligible, an apprentice is not |
| LS-NONE | Not leave eligible | 0 | N | Not applicable | Not applicable | Not applicable |  |  | N | None | 23 | Contractual, third-party, apprentice, retainer and gig populations |
| ADDED v1.1 for form F-EMP-03. A scheme is selected by grade rank, never by matching a designation name — which is what open question Q-06 is about. Changing the rank on LS-AGM from 70 to 60 should move every Senior Manager onto the annual credit without a release: that is the single best way to show the accrual engine is configuration. The year-end columns drive 54_Year_End_Leave_Preview. |  |  |  |  |  |  |  |  |  |  |  |  |

### `40_Leave_Rules_Matrix` (10 rows)

| Rule code | Scheme | Leave type | Cannot be combined with | Checked across contiguous absence | Max availed per calendar month | Min service months before accrual | Catch-up on completion | Half day permitted | Encashable | Display unit | Blocked at | Demo record | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LR-01 | LS-STD | CL | EL, SL | Y | 2 | 0 |  | Y | N | Days | Validation, before the approval chain starts | LV-2026-0802 — CL + EL applied together, rejected by rule | Point 7 |
| LR-02 | LS-STD | EL | CL | Y | 10 | 6 | 9 | Y | Y | Days | Validation, before the approval chain starts | LV-2026-0803 — 11 EL days in October, rejected on the monthly cap | Point 7 |
| LR-03 | LS-STD | SL | CL | Y |  | 0 |  | Y | N | Days | Validation | LV-2026-0795 — 2 SL for E1057, approved through all three levels | Point 7 |
| LR-04 | LS-STD | CO |  | N |  | 0 |  | N | N | Days | Expiry check at application | LV-2026-0788 — consumed against CO-2026-0231 one day before it lapsed | Point 6 |
| LR-05 | LS-STD | BL |  | N | 1 | 0 |  | N | N | Days | Eligibility window check | Quantum and window unstated by the client — see open question Q-03 | Point 7 |
| LR-06 | LS-AGM | CL | EL, SL | Y | 2 | 0 |  | Y | N | Days | Validation | E1004 Ritu Balachandran | Point 7 |
| LR-07 | LS-AGM | EL | CL | Y | 10 | 0 |  | Y | Y | Days | Validation | E1004 — annual 18-day credit, no six-month hold | Point 7 |
| LR-08 | LS-TRN | CL |  | N | 2 | 0 |  | Y | N | Days | Validation | E1030 GET and E1031 DET, 3 CL each under proration rule PR-04 | Point 7 |
| LR-09 | All schemes | LOP |  | N |  | 0 |  | Y | N | Days | Not blocked — LOP is the fallback | E1022 09 Sep, absent with no leave applied | Point 12 |
| ADDED v1.1. Rule RL-11 says the combination check must run across a contiguous absence, not only within one application — so the demo has to show 2 CL approved first and then a separate EL application for the abutting days being refused. LV-2026-0802 covers the single-application case; run the two-application case live during the demo, because that is the one most products get wrong. |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `53_Leave_Balance_AsOn` (31 rows)

| Employee code | Name | Leave type | Opening 01 Jan 2026 | Credited | Availed | Reversed | Lapsed | Encashed | Closing as on 15 Sep 2026 | Ledger movements behind it | What to point out |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E1004 | Ritu Balachandran | EL | 0 | 18 | 5 | 0 | 0 | 0 | 13 | LL-0001, LL-0004 |  |
| E1004 | Ritu Balachandran | CL | 0 | 6 | 0 | 0 | 0 | 0 | 6 | LL-0002 |  |
| E1004 | Ritu Balachandran | SL | 0 | 6 | 0 | 0 | 0 | 0 | 6 | LL-0003 |  |
| E1019 | Sneha Nair | CL | 0 | 6 | 2 | 0 | 0 | 0 | 4 | LL-0005, LL-0008 |  |
| E1019 | Sneha Nair | SL | 0 | 6 | 0 | 0 | 0 | 0 | 6 | LL-0006 |  |
| E1019 | Sneha Nair | EL | 0 | 12 | 0 | 0 | 0 | 0 | 12 | LL-0007 |  |
| E1043 | Neha Mishra | EL | 0 | 12 | 10 | 3 | 0 | 0 | 5 | LL-0009, LL-0011, LL-0012 | Point 5 — 10 days debited on application, 3 reversed on early return. The reversal is a movement against the original availing, not a fresh accrual, so the closing balance is explainable line by line. |
| E1043 | Neha Mishra | CL | 0 | 6 | 0 | 0 | 0 | 0 | 6 | LL-0010 |  |
| E1067 | Ankita Bhargava | CL | 0 | 5 | 0 | 0 | 0 | 0 | 5 | LL-0013 |  |
| E1067 | Ankita Bhargava | SL | 0 | 5 | 0 | 0 | 0 | 0 | 5 | LL-0014 |  |
| E1067 | Ankita Bhargava | EL | 0 | 9 | 0 | 0 | 0 | 0 | 9 | LL-0015 | Point 7 — the catch-up lands on 16 September, during the demo window. |
| E1060 | Jayanthi Elangovan | CL | 0 | 4 | 0 | 0 | 0 | 0 | 4 | LL-0016 |  |
| E1060 | Jayanthi Elangovan | SL | 0 | 4 | 0 | 0 | 0 | 0 | 4 | LL-0017 |  |
| E1030 | Chetan Bhandary | CL | 0 | 3 | 0 | 0 | 0 | 0 | 3 | LL-0018 |  |
| E1031 | Divya Hegde | CL | 0 | 3 | 0 | 0 | 0 | 0 | 3 | LL-0019 |  |
| E1065 | Ishita Chatterjee | CL | 0 | 2 | 0 | 0 | 0 | 0 | 2 | LL-0020 |  |
| E1065 | Ishita Chatterjee | SL | 0 | 2 | 0 | 0 | 0 | 0 | 2 | LL-0021 |  |
| E1028 | Yashoda Rani | CO | 0 | 2 | 1 | 0 | 0 | 0 | 1 | LL-0022, LL-0023, LL-0041 | Point 6 — two credits on separate 60-day clocks, one consumed a day before it expired. |
| E1050 | Suresh Pillai | CO | 0 | 2 | 1 | 0 | 0 | 0 | 1 | LL-0024, LL-0025, LL-0042 |  |
| E1018 | Ravi Kulkarni | EL | 0 | 12 | 0 | 0 | 0 | 0 | 12 | LL-0026 |  |
| E1018 | Ravi Kulkarni | CL | 0 | 6 | 0 | 0 | 0 | 0 | 6 | LL-0027 |  |
| E1022 | Mohan Joseph | CL | 0 | 6 | 0 | 0 | 0 | 0 | 6 | LL-0028, LL-0029 | Point 12 — six days intact. The 09 September absence raised LOP and took nothing from this balance. |
| E1056 | Anand Krishnan | EL | 0 | 12 | 0 | 0 | 0 | 0 | 12 | LL-0030 |  |
| E1069 | Meera Prabhu | CL | 0 | 6 | 1 | 0 | 0 | 0 | 5 | LL-0031, LL-0035 |  |
| E1069 | Meera Prabhu | SL | 0 | 6 | 0 | 0 | 0 | 0 | 6 | LL-0032 |  |
| E1069 | Meera Prabhu | EL | 0 | 10.5 | 0 | 0 | 0 | 0 | 10.5 | LL-0033, LL-0034 | Point 7 — the 9-day catch-up on completing six months, then 1.5 a month. |
| E1068 | Dinesh Vaidya | EL | 0 | 13.5 | 4 | 0 | 0 | 0 | 9.5 | LL-0036, LL-0037, LL-0038 | Point 16 — 9.5 days is the figure encashed in the full and final settlement. |
| E1042 | Swapnil Kadam | EL | 0 | 12 | 6 | 0 | 0 | 0 | 6 | LL-0039, LL-0040 | Point 16 — encashed in the held settlement. |
| E1041 | Mahesh Shinde | CO | 0 | 1 | 0 | 0 | 0 | 0 | 1 | LL-0043 |  |
| E1044 | Rahul Gaikwad | CO | 0 | 1 | 0 | 0 | 1 | 0 | 0 | LL-0044, LL-0045 | Point 6 — one credit, one lapse, nil balance. The lapse is a movement, not a status change, which is why the balance actually falls. |
| ADDED v1.1 for report RP-05. Every figure here is a projection over 17_Leave_Ledger — there is no stored balance column anywhere in this dataset, by design. The column that matters is the second from last: a balance a client disputes has to be explainable movement by movement, and if the product cannot produce that list, the balance is a number nobody can defend. Opening is nil throughout because the demo tenant starts on 1 January 2026. |  |  |  |  |  |  |  |  |  |  |  |

### `54_Year_End_Leave_Preview` (15 rows)

| Employee code | Name | Leave scheme | Leave type | Balance as on 15 Sep | Further accrual to 31 Dec | Expiring before 31 Dec | Projected balance at 31 Dec | Year-end action | Days encashed | Days lapsed | Encashment rate per day (INR) | Encashment amount (INR) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E1004 | Ritu Balachandran | LS-AGM | EL | 13 | 3 |  | 16 | Encash | 16 | 0 | 6250 | 100000 |
| E1004 | Ritu Balachandran | LS-AGM | CL | 6 | 0 |  | 6 | Lapse | 0 | 6 |  | 0 |
| E1004 | Ritu Balachandran | LS-AGM | SL | 6 | 0 |  | 6 | Lapse | 0 | 6 |  | 0 |
| E1018 | Ravi Kulkarni | LS-STD | EL | 12 | 6 |  | 18 | Encash | 18 | 0 | 1647 | 29646 |
| E1018 | Ravi Kulkarni | LS-STD | CL | 6 | 0 |  | 6 | Lapse | 0 | 6 |  | 0 |
| E1019 | Sneha Nair | LS-STD | EL | 12 | 6 |  | 18 | Encash | 18 | 0 | 1658 | 29844 |
| E1019 | Sneha Nair | LS-STD | CL | 4 | 0 |  | 4 | Lapse | 0 | 4 |  | 0 |
| E1019 | Sneha Nair | LS-STD | SL | 6 | 0 |  | 6 | Lapse | 0 | 6 |  | 0 |
| E1067 | Ankita Bhargava | LS-STD | EL | 9 | 4.5 |  | 13.5 | Encash | 13.5 | 0 | 1647 | 22235 |
| E1067 | Ankita Bhargava | LS-STD | CL | 5 | 0 |  | 5 | Lapse | 0 | 5 |  | 0 |
| E1069 | Meera Prabhu | LS-STD | EL | 10.5 | 6 |  | 16.5 | Encash | 16.5 | 0 | 937 | 15461 |
| E1069 | Meera Prabhu | LS-STD | CL | 5 | 0 |  | 5 | Lapse | 0 | 5 |  | 0 |
| E1030 | Chetan Bhandary | LS-TRN | CL | 3 | 0 |  | 3 | Lapse | 0 | 3 |  | 0 |
| E1028 | Yashoda Rani | LS-STD | CO | 1 | 0 | 1 | 0 | Lapse on expiry, not at year end | 0 | 1 |  | 0 |
| ADDED v1.1 for form F-LVE-07 and report RP-08. Run mode Preview must produce exactly these figures and write nothing; Commit must produce the same figures again and write the encashment as a payroll input and the lapse as a ledger movement. Run Preview twice in the demo and show the balances unchanged — that is the assurance a payroll head is actually asking for. Encashment rate is (Basic + DA) divided by 26, per component PC-LEAVE-ENC. The comp-off row is here to make the distinction: comp-off lapses on its own 60-day clock, not at year end, so the year-end run must leave it alone. |  |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 174 | specified items (table rows) | Counted automatically at generation |
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
