<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# VV-01 — Test Case Catalogue

| Attribute | Value |
| :--- | :--- |
| Document ID | VV-01 |
| Title | Test Case Catalogue |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | QA / Test Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | VV |
| Related documents | QA-03, MTP-01, FRS-<DOM>-08 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## ATTENDANCE GOLDEN CASES — expected values come from 21_Expected_Attendance, not from this workbook

| Case ID | Area | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-T80 | Attendance | Cross-midnight day stays on one attendance date | E1018 Ravi Kulkarni, 08 Sep 2026 | One attendance day dated 08 Sep, spanning 08:00 to 03:20 | RL-080 | Golden |
| TC-T82 | Attendance | Four punches pair into two segments | E1018, 08 Sep | Segments 08:00-20:30 and 21:15-03:20 | RL-082 | Golden |
| TC-T83 | Attendance | Dinner gap is its own break row | E1018, 08 Sep | 45-minute break, reportable independently | RL-083 | Golden |
| TC-T84 | Attendance | Gross span | E1018, 08 Sep | 19h 20m | RL-084 | Golden |
| TC-T87 | Attendance | Overtime against the 12h shift on the gross basis | E1018, 08 Sep | 7h 20m OT | RL-087 | Golden |
| TC-T92 | Attendance | Shift inference from the in-punch | E1020 Arjun Bhat, 04 and 11 Sep | Shift applied differs from shift assigned; 12h threshold applied against the inferred shift | RL-092 | Golden |
| TC-T101 | Attendance | Daily-wage contractual worker has no rest day | E1032 Shivanna Muniyappa, 06 and 13 Sep | Sunday shows Working, not Weekly Off | RL-101 | Golden |
| TC-T102 | Attendance | Same vendor, different classes, different rest days | E1034 Imran Shaikh (3PE) vs E1036 Lakshmi Rao (3PH), 06 Sep | Sunday is Weekly Off for one, Working for the other | RL-102 | Golden |
| TC-T112 | Attendance | Absent threshold on a 12h shift | E1022, 02 and 09 Sep | Below 6:30 net → Absent | RL-112 | Golden |
| TC-T113 | Attendance | Half-day threshold on a 10h shift | E1041, 07 Sep | Below 9:30 net → Half Day | RL-113 | Golden |
| TC-T115 | Attendance | Grace-exempt designation arrives late | E1021 (Manager grade), any late day | No late instance, no deduction | RL-115 | Golden |
| TC-T117 | Attendance | Fourth late instance in the month | E1019 Sneha Nair, 01/03/07/10/14 Sep | First three forgiven; fourth converts the day to Half Day | RL-117 | Golden |
| TC-T118 | Attendance | Long-night relief | E1018, 09 Sep after a 03:20 finish | Arrival up to 09:30 still credited a full day | RL-118 | Golden |
| TC-T121 | Attendance | Gate-pass monthly ceiling | E1023, GP-2026-0141, 0155, 0163 | Two approved 2h passes; the third rejected on the ceiling | RL-121 | Golden |
| TC-T86 | Attendance | Approved gate-pass minutes credited back | E1023, 04 and 11 Sep | Gap appears as a break and the same minutes credited; net hours unchanged | RL-086 | Golden |
| TC-T132 | Attendance | Rest-day-only overtime eligibility | E1034 Imran Shaikh, 04 Sep vs 06 Sep | Weekday OT = 0 despite a 12h+ span; rest-day span pays in full | RL-132 | Golden |

## LEAVE GOLDEN CASES

| Case ID | Area | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-L171 | Leave | Six-month EL wait then a single credit | E1067 Ankita Bhargava, completes six months 16 Sep 2026 | 9 EL days credited on completion, then 1.5/month | RL-171 | Golden |
| TC-L173 | Leave | Band-based annual credit | E1004 (AGM band) vs E1019 (standard) | 18 EL on 1 Jan vs 1.5 EL per month | RL-173 | Golden |
| TC-L180 | Leave | Joining-month proration | E1060 Jayanthi Elangovan, joined 06 Apr 2026 | 4 CL and 4 SL | RL-180 | Golden |
| TC-L192 | Leave | Combination rule blocks CL with EL | LV-2026-0802, E1019 | Rejected at validation before the chain, message names the rule | RL-192 | Golden |
| TC-L193 | Leave | Monthly cap on EL | 11th EL day in one month | Rejected at validation with the cap named | RL-193 | Golden |
| TC-L200 | Leave | Early return marks present and re-credits | LV-2026-0774, E1043 Neha Mishra | Original debit plus a reversal credit for the unused days | RL-200, RL-201 | Golden |
| TC-L15 | Leave | HR edit on an approved request is logged | LV-2026-0774, HR closed on 14 Sep | Actor, timestamp and reason recorded | RL-015 | Golden |
| TC-L210 | Leave | Two comp-off credits on separate clocks | CO-2026-0231 and CO-2026-0288, E1028 | July credit lapses 10 Sep; 06 Sep credit runs to 05 Nov | RL-210 | Golden |
| TC-L212 | Leave | Unconsumed comp-off lapses | E1044 Rahul Gaikwad's lapsed credit | Lapse row written on its own expiry date | RL-212 | Golden |

## PAYROLL AND FINANCE GOLDEN CASES

| Case ID | Area | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Y281 | Payroll | 50% floor add-back fires | E1014 and E1049 in 13_Salary_Structure | Excluded components exceed 50%; excess added back to the wage base | RL-281 | Golden |
| TC-Y290 | Payroll | Daily-wage earnings node selected by class | E1032 (WC-CONT) | Paid on days present, not a prorated monthly rate; day count on the payslip | RL-290 | Golden |
| TC-Y302 | Payroll | PT differs by state on one run | LE-01 Karnataka vs LE-02 Tamil Nadu, Sep 2026 | Different PT amounts; one state where it does not apply | RL-302 | Golden |
| TC-Y330 | Payroll | Two runs against one period | PR-2026-09-01 and PR-2026-09-02 | Regular pays 30 Sep; off-cycle OT pays 07 Oct with its own bank file and journal | RL-330 | Golden |
| TC-F521 | Finance | Unmapped component blocks approval | GL-023 deliberately unmapped | Run cannot reach APPROVED; message names the component | RL-521 | Negative |
| TC-F530 | Finance | Reconciliation assertions | Sep 2026 journal, both runs | All seven assertions pass with zero dimension residue | RL-530 | Golden |
| TC-F510 | Integration | ERP inbound outcomes | Batch ERP-SYNC-2026-09-14, six rows | Three clean upserts, one conflict held, one unmatched, one duplicate rejected on hash | RL-513, RL-514, RL-516 | Golden |

## SCOPE, LOAN, EXIT AND TALENT CASES

| Case ID | Area | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-P05 | Security | Plant user reading a head-office-payrolled employee | E1056 Anand Krishnan, LOC-CHN, payroll group HO | Attendance fields populated; every compensation and rate field null | RL-005 | Golden — RUNS ON EVERY BUILD |
| TC-M430 | Loans | Eligibility method is the single source | E1044, E1041, E1056, E1050, E1022 | Same answer from screen, guarantor lock, payroll node and agent tool | RL-430 | Golden |
| TC-M432 | Loans | Guarantor lock blocks an application | LN-APP-2026-0014, E1041 | Rejected with the guarantee named as the reason | RL-432 | Negative |
| TC-M433 | Loans | Ceiling rises after five years | E1056 Anand Krishnan, 8 years 8 months | 6x basic ceiling applied | RL-433 | Golden |
| TC-M443 | Loans | Director override on special terms | LN-2026-0012, E1022 | Sanctioned above ceiling with approver, reason and rules waived recorded | RL-443 | Golden |
| TC-M452 | Loans | Closure releases guarantors | LN-2025-0112, E1050 | Release rows written; guarantors eligible again | RL-452 | Golden |
| TC-X402 | Exit | Blocking items hold F&F | E1042 Swapnil Kadam, two open blocking items | F&F held; clearing the items releases it | RL-402 | Golden |
| TC-X340 | Exit | F&F settles on the last working day | E1068 Dinesh Vaidya, LWD 30 Sep | Fully cleared; settlement on the LWD | RL-340 | Golden |
| TC-R461 | Talent | Replacement consumes no fresh sanction | REQ-2026-0037 against POS-2214 | Approved without consuming sanctioned strength | RL-461 | Golden |
| TC-R462 | Talent | Addition blocked at full sanction | REQ-2026-0041, OU-111 at Peenya, 24 of 24 | Blocked at approval; override required | RL-462 | Negative |
| TC-C382 | Compliance | Form F generated in the joining chain | FRM-F-2026-0112 for E1066 | Produced as a joining step, not chased afterwards | RL-382 | Golden |
| TC-E502 | Experience | Issued letter retains its template version | TPL-APPT-02 issued to E1066 | Reprint two years later reproduces the original version | RL-502 | Golden |

## PROPERTY TESTS — run on every build, no fixed data

| Case ID | Area | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PR01 | Payroll | Net pay never exceeds gross | Any run | Invariant holds | — | Property |
| TC-PR02 | Payroll | Deductions never produce negative net without an explicit flag | Any run | Invariant holds | RL-311 | Property |
| TC-PR03 | Payroll | Recomputation is idempotent | Any closed run | Identical output from the snapshot | RL-251 | Property |
| TC-PR04 | Payroll | Proration across any month boundary sums to the full-month value | Any month | Invariant holds | RL-272 | Property |
| TC-PR05 | Attendance | Net minutes never exceed gross minutes | Any day | Invariant holds | — | Property |
| TC-PR06 | Attendance | Recomputing an unchanged day produces an identical row | Any day | No delta written | RL-089 | Property |
| TC-PR07 | Attendance | Segments plus breaks equal the gross span | Any day | Invariant holds | RL-084 | Property |
| TC-PR08 | Leave | Accrual re-run produces no second credit | Any period | Idempotency key holds | RL-172 | Property |
| TC-PR09 | Platform | No query escapes its tenant, including a query with a bug in it | Any query | RLS blocks | RL-004 | Property |

## Test cases for capability gaps (Authored)

652 test cases, one per acceptance criterion of the capability-gap user stories; full Given / When / Then detail is in each domain's FRS-<DOM>-08.

| Domain | Test cases |
| :--- | ---: |
| Platform & Foundations (PLT) | 94 |
| People Core (PPL) | 52 |
| Time & Attendance (TIM) | 56 |
| Leave (LVE) | 34 |
| Payroll (PAY) | 54 |
| Compliance (CMP) | 46 |
| Lifecycle (LCY) | 40 |
| Self-service & Helpdesk (SSV) | 34 |
| Compensation, Loans & Benefits (CMB) | 56 |
| Talent (TAL) | 76 |
| Contingent Workforce (CTG) | 30 |
| Experience (EXP) | 26 |
| Finance & ERP (FIN) | 24 |
| Intelligence & Agents (INT) | 30 |

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
| Size | 67 | specified items (table rows) | Counted automatically at generation |
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
