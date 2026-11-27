<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# TR-02 — Demo Point Traceability Matrix

| Attribute | Value |
| :--- | :--- |
| Document ID | TR-02 |
| Title | Demo Point Traceability Matrix |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Business Analyst Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | TR-01, REQ-02, UCC-01, VV-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 17_Traceability<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 12_Traceability_Matrix |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Demo point → process → screen → rule → dataset → test

| Pt | Requirement | Processes | Screens | Rules | Dataset sheets | Test cases | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Multi-punch day, 19h20m across midnight, separate dinner-break report, OT 7h20m, team history for a date range | TIM-01, TIM-02, TIM-07, TIM-10 | SCR-021, SCR-022, SCR-024, SCR-027 | RL-080 to RL-089, RL-160, RL-161 | 20_Punch_Events, 21_Expected_Attendance | TC-T80, TC-T83, TC-T84, TC-T87, TC-T161 | P1 |
| 2 | Contractual employees have no rest days and are paid daily wages | PPL-03, TIM-04, PAY-06 | SCR-011, SCR-021, SCR-053 | RL-101, RL-290, RL-291 | 06_Worker_Classes, 12_Employees, 21_Expected_Attendance | TC-T101, TC-Y290 | P1 |
| 3 | Third-party group: employees have rest days, helpers do not, under one vendor | PPL-03, TIM-04, CTG-01 | SCR-011, SCR-095 | RL-101, RL-102 | 06_Worker_Classes, 12_Employees | TC-T102 | P1 (policy) / P3 (module 13) |
| 4 | Overtime only on rest days or holidays for some employees | PPL-03, TIM-07 | SCR-024 | RL-130, RL-132 | 06_Worker_Classes, 21_Expected_Attendance, 23_Overtime_Register | TC-T130, TC-T132 | P1 |
| 5 | Early return from leave: mark present, re-credit balance, three-level approval, HR can update | LVE-04, LVE-05, PLT-05 | SCR-030, SCR-031, SCR-040 | RL-014, RL-015, RL-195, RL-200 to RL-203 | 18_Leave_Requests, 17_Leave_Ledger | TC-L200, TC-L201, TC-L15 | P1 |
| 6 | Comp-off lapses 60 days from the credit date | LVE-06, LVE-08 | SCR-031 | RL-210 to RL-213 | 19_CompOff_Ledger | TC-L210, TC-L212, TC-L213 | P1 |
| 7 | Auto leave credit: bands, monthly accrual, joiner proration, caps, combination rules, encashment, birthday leave, trainees | LVE-01, LVE-02, LVE-03, LVE-07 | SCR-030, SCR-031, SCR-032 | RL-170 to RL-173, RL-180 to RL-182, RL-192, RL-193, RL-220, RL-222 | 14, 15, 16, 17 | TC-L171, TC-L173, TC-L180, TC-L192, TC-L193 | P1 |
| 8 | HO-generated salary, plant attendance, plant users cannot see rate | PLT-02, PPL-01 | SCR-005, SCR-011, SCR-022 | RL-003, RL-004, RL-005, RL-036 | 12_Employees, 13_Salary_Structure | TC-P03, TC-P05 (every build), TC-H36 | P0 |
| 9 | Loan policy: one at a time, two guarantors, 4x and 6x basic, guarantor lock, director override | CMB-01 to CMB-04, PAY-08 | SCR-080 | RL-430 to RL-434, RL-441 to RL-444, RL-450 to RL-452 | 24_Loans, 25_Loan_Guarantors | TC-M430 to TC-M452 | P1 (eligibility + deduction) / P2 (full module) |
| 10 | Overtime generated and paid after salary, not with it | TIM-07, PAY-01, PAY-10, FIN-03 | SCR-024, SCR-050, SCR-053 | RL-134, RL-240, RL-330 to RL-333 | 23_Overtime_Register, 26_Payroll_Runs | TC-Y134, TC-Y330, TC-F333 | P1 |
| 11 | Gate pass: 4 hours a month, maximum two instances, added to work hours | TIM-06, TIM-02 | SCR-023, SCR-021 | RL-086, RL-120 to RL-123 | 22_Gate_Pass, 21_Expected_Attendance | TC-T86, TC-T121 | P1 |
| 12 | Half-day and absent thresholds by shift, grace, three lates, designation exemption, long-night relief | TIM-05 | SCR-021, SCR-022 | RL-111 to RL-119, RL-052 | 08_Attendance_Rules, 21_Expected_Attendance | TC-T112, TC-T113, TC-T115, TC-T117, TC-T118 | P1 |
| 13 | Auto shift capture from the in-punch | TIM-03 | SCR-022 | RL-090 to RL-094 | 07_Shifts, 21_Expected_Attendance | TC-T91, TC-T92, TC-T94 | P1 |
| 14 | Link the ERP employee master by API | FIN-01, PPL-08 | SCR-100, SCR-101 | RL-510 to RL-516 | 36_ERP_Inbound_Master | TC-F510 to TC-F516 | P1 (direction decided in P0) |
| 15 | Account posting to ERP | FIN-02, FIN-03, FIN-04 | SCR-102, SCR-103 | RL-321, RL-520 to RL-524, RL-530, RL-531 | 35_GL_Mapping, 26_Payroll_Runs | TC-F520, TC-F521, TC-F530 | P1 |
| 16 | Full and final on the last working day with a no-dues process | LCY-05, LCY-06, LCY-07, PAY-12 | SCR-061, SCR-056 | RL-400 to RL-403, RL-340 to RL-342 | 27_Exit_Clearance | TC-X400, TC-X402, TC-X340 | P1 |
| 17 | Statutory compliance, Factory Act forms and returns | CMP-01p, CMP-02p, CMP-03p, PAY-07 | SCR-070, SCR-072, SCR-073 | RL-302, RL-360 to RL-364, RL-370 to RL-372, RL-380 to RL-383 | 28_Statutory_Calendar, 29_Statutory_Forms | TC-Y302, TC-C380, TC-C382 | P1 |
| 18 | Star employees | EXP-01 | SCR-065, SCR-066 | RL-490 to RL-492 | 30_Recognition_Referral | TC-E490, TC-E491 | P2 |
| 19 | Referral process and awards | TAL-03, EXP-01 | SCR-091 | RL-470 to RL-472 | 30_Recognition_Referral | TC-R470, TC-R471, TC-R472 | P2 |
| 20 | Announcements: birthday, star employee, new joiner, referral, management messages | EXP-02, SSV-03 | SCR-066 | RL-397, RL-492 | 31_Announcements | TC-X397, TC-E492 | P2 |
| 21 | Appointment and other HR letters | EXP-03, LCY-03, CMB-06 | SCR-067 | RL-500 to RL-502 | 32_Letter_Templates | TC-E500, TC-E502 | P2 |
| 22 | Organisation chart, department-wise hierarchy | PPL-05 | SCR-012, SCR-013 | RL-020, RL-055 to RL-057 | 04_Org_Units, 12_Employees | TC-H35, TC-R56 | P1 |
| 23 | Induction training at joining, and asset | LCY-02, LCY-08, TAL-05 | SCR-060, SCR-063, SCR-064 | RL-395, RL-396 | 33_Assets, 34_Induction_Learning | TC-X395, TC-X396 | P1 (assets) / P3 (learning depth) |
| 24 | Recruitment: position code for replacement | PPL-04, TAL-01 | SCR-012, SCR-090 | RL-058, RL-460, RL-461 | 11_Positions, 37_Requisitions | TC-R461 | P3 |
| 25 | Approved manpower, department wise | PPL-04, TAL-01 | SCR-013, SCR-090 | RL-055 to RL-057, RL-462, RL-463 | 10_Sanctioned_Manpower | TC-R462 | P3 |
| 26 | Joining form under the Factory Act, Form F | LCY-02, CMP-03p | SCR-060, SCR-073 | RL-382, RL-380 | 29_Statutory_Forms, 34_Induction_Learning | TC-C382 | P1 — owner still to be assigned (blueprint Annexure A) |
| Demo points covered | 26 |  |  |  |  |  |  |
| Answered in Phase 0 or 1 | 21 |  |  |  |  |  |  |
| Client status: WIP | 8 |  |  |  |  |  |  |
| Client status: Done | 18 |  |  |  |  |  |  |

## 2. Requirement → form → field → rule → report → test → question

| Req ID | Source point | Requirement | Forms | Fields | Rules | Reports | Tests | Open questions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-01 | 1 | Multi-punch work hours across midnight, with break captured separately | F-ATT-01, F-ATT-02, F-ATT-03, F-ATT-04, F-SHF-01, F-OTM-01 | 20 | RL-01, RL-02, RL-03, RL-04 | RP-01, RP-03, RP-04 | T-01, T-02, T-03 | Q-01 |
| R-02 | 1 | Team Calendar — date-range history and report for a manager's own team | F-ATT-05 | 5 | — | RP-02 | T-05 | — |
| R-03 | 2 | Contractual employees have no rest days and are paid daily wages | F-EMP-01, F-EMP-02 | 8 | RL-05, RL-26 | — | T-06 | Q-14 |
| R-04 | 3 | Third-party group — Employees get rest days, Helpers do not | F-EMP-01, F-EMP-02 | 10 | RL-05 | — | T-07 | — |
| R-05 | 4 | Some employees receive OT only on rest days or holidays | F-EMP-01, F-ATT-01, F-OTM-01 | 5 | RL-04 | RP-04 | T-04 | — |
| R-06 | 5 | Early return from leave — mark present and credit the balance back | F-ATT-04, F-LVE-03, F-LVE-04, F-LVE-05 | 9 | RL-15 | RP-05 | T-08, T-09 | — |
| R-07 | 6 | COFF lapses 60 days from the COFF date | F-EMP-01, F-EMP-03, F-LVE-05, F-LVE-06 | 7 | RL-06 | RP-05, RP-06 | T-10 | Q-07 |
| R-08 | 7 | Automatic leave credit — grade-based, monthly accrual, new-joiner proration | F-EMP-01, F-EMP-03, F-EMP-04, F-LVE-01, F-LVE-02, F-LVE-03, F-LVE-05, F-LVE-07 | 39 | RL-07, RL-08, RL-09, RL-10, RL-11, RL-12, RL-13, RL-14 | RP-05, RP-07, RP-08 | T-11, T-12, T-13, T-14, T-15, T-16, T-17 | Q-02, Q-03, Q-04, Q-05, Q-06 |
| R-09 | 8 | Salary processed at head office, attendance at plant, salary hidden from plant users | F-EMP-01, F-PAY-01, F-PAY-02, F-SEC-01 | 6 | RL-24 | RP-14 | T-18 | — |
| R-10 | 9 | Loan policy — one active loan, guarantor interlock, multiple-of-basic ceiling | F-PAY-01, F-LON-01, F-LON-02, F-LON-03 | 15 | RL-21, RL-22 | RP-10 | T-19, T-20, T-21 | Q-08, Q-09 |
| R-11 | 10 | OT is generated and paid after salary generation, in a separate run | F-OTM-01, F-OTM-02, F-PAY-02 | 3 | RL-23 | RP-04 | T-22 | — |
| R-12 | 11 | Personal gate pass — 4 hours a month, maximum two passes, added to work hours | F-ATT-01, F-ATT-04, F-GPS-01 | 9 | RL-20 | RP-09 | T-23 | Q-10 |
| R-13 | 12 | Attendance thresholds by shift length, grace period and late-mark rules | F-EMP-04, F-ATT-01, F-ATT-06, F-SHF-01, F-SHF-03 | 25 | RL-16, RL-17, RL-18 | RP-03 | T-24, T-25, T-26 | Q-11, Q-12 |
| R-14 | 13 | Auto shift detection from the in-punch time | F-SHF-01, F-SHF-02 | 7 | RL-19 | — | T-27 | — |
| R-15 | 14 | Link the ERP employee master to Nucleus | F-INT-01 | 3 | — | — | T-28 | Q-15 |
| R-16 | 15 | Show and generate account posting in the ERP from Nucleus | F-PAY-02, F-INT-02 | 5 | — | RP-15 | T-29 | — |
| R-17 | 16 | Full and final settlement on the same day, gated by no-dues | F-FNF-01, F-FNF-02 | 12 | RL-25 | RP-11 | T-30 | Q-16 |
| R-18 | 17 | Statutory compliance — Factory Act forms and returns | F-STA-01 | 5 | — | RP-12 | T-32 | Q-13 |
| R-19 | 18 | Star employees | F-ENG-01 | 4 | — | — | T-33 | — |
| R-20 | 19 | Referral process and awards | F-ENG-02 | 5 | — | — | T-34 | — |
| R-21 | 20 | Announcements — birthday, star employee, new joiner, referral, management messages | F-ENG-03 | 4 | — | — | T-35 | — |
| R-22 | 21 | Appointment letter and other HR letters | F-DOC-01 | 4 | — | — | T-36 | — |
| R-23 | 22 | Organisation chart and department-wise hierarchy | F-ORG-01 | 3 | — | — | T-37 | — |
| R-24 | 23 | Induction training at joining, and asset issue | F-ONB-01, F-ONB-02 | 6 | — | — | T-38 | — |
| R-25 | 24 | Recruitment — position code for a replacement | F-REC-02 | 4 | — | — | T-39 | — |
| R-26 | 25 | Approved manpower, department-wise | F-REC-01, F-REC-02 | 1 | — | — | T-40 | — |
| R-27 | 26 | Joining form under the Factory Act — Form F | F-STA-02 | 5 | — | RP-13 | T-31 | Q-13 |

## 3. Requirement → use case

| Client requirement | Use cases realising it |
| :--- | :--- |
| R-01 | TIM-UC-001, TIM-UC-002, TIM-UC-007 |
| R-02 | TIM-UC-010 |
| R-03 | PPL-UC-003 |
| R-04 | PPL-UC-003 |
| R-05 | PPL-UC-003 |
| R-06 | LVE-UC-004, LVE-UC-005 |
| R-07 | LVE-UC-006, LVE-UC-008 |
| R-08 | LVE-UC-001, LVE-UC-002, LVE-UC-003, LVE-UC-007 |
| R-09 | PLT-UC-002 |
| R-10 | CMB-UC-001, CMB-UC-002, CMB-UC-003, CMB-UC-004, CMB-UC-005 |
| R-11 | TIM-UC-007 |
| R-12 | TIM-UC-002, TIM-UC-006 |
| R-13 | TIM-UC-005 |
| R-14 | TIM-UC-003 |
| R-15 | FIN-UC-001 |
| R-16 | FIN-UC-002, FIN-UC-003, FIN-UC-004 |
| R-17 | LCY-UC-005, LCY-UC-006, LCY-UC-007 |
| R-18 | CMP-UC-001, CMP-UC-002, CMP-UC-003, CMP-UC-009 |
| R-19 | EXP-UC-001 |
| R-20 | TAL-UC-003 |
| R-21 | EXP-UC-002 |
| R-22 | EXP-UC-003 |
| R-23 | PPL-UC-005, PPL-UC-014 |
| R-24 | LCY-UC-002, LCY-UC-003, LCY-UC-008 |
| R-25 | TAL-UC-001 |
| R-26 | TAL-UC-001 |
| R-27 | CMP-UC-003 |

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
