<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# TR-03 — Form Data Coverage Matrix

| Attribute | Value |
| :--- | :--- |
| Document ID | TR-03 |
| Title | Form Data Coverage Matrix |
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
| Related documents | DA-05, VV-03 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus HRMS Demo Dataset v1.1 — sheet(s) 69_Coverage_Matrix |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Which golden-dataset sheet supplies data for each form or screen.

| Form ID | Form or screen | Module | Specified in | Demo sheet that supplies the data |
| :--- | :--- | :--- | :--- | :--- |
| FRM-PLT-01 | Legal Entity Master | PLT | Forms | 02_Legal_Entities |
| FRM-PLT-02 | Location / Work Site Master | PLT | Forms | 03_Locations |
| FRM-PLT-03 | User, Role and Scope Grant | PLT | Forms | 43_Roles_and_Data_Scope, 44_Demo_Users |
| FRM-PPL-01 | Add / Edit Employee — Identity and Personal | PPL | Forms | 12_Employees |
| FRM-PPL-02 | Employment, Assignment and Policy | PPL | Forms | 12_Employees columns V to AQ |
| FRM-PPL-03 | Position Master | PPL | Forms | 11_Positions |
| FRM-PPL-04 | Sanctioned Strength | PPL | Forms | 10_Sanctioned_Manpower |
| FRM-PPL-05 | Document Upload and Verification | PPL | Forms | 62_Documents |
| FRM-PPL-06 | Asset Allocation and Return | PPL | Forms | 33_Assets |
| FRM-TIM-01 | Shift Master | TIM | Forms | 07_Shifts |
| FRM-TIM-02 | Roster / Shift Schedule | TIM | Forms | 52_Shift_Roster |
| FRM-TIM-03 | Check In / Check Out | TIM | Forms | 20_Punch_Events |
| FRM-TIM-04 | Attendance Day Detail and Override | TIM | Forms | 21_Expected_Attendance |
| FRM-TIM-05 | Attendance Regularisation Request | TIM | Forms | 50_Attendance_Regularisation |
| FRM-TIM-06 | Gate Pass | TIM | Forms | 22_Gate_Pass |
| FRM-TIM-07 | Overtime Register and Approval | TIM | Forms | 23_Overtime_Register |
| FRM-TIM-08 | Attendance Exception Resolution | TIM | Forms | 51_Attendance_Exceptions |
| FRM-LVE-01 | Leave Type Configuration | LVE | Forms | 14_Leave_Types, 40_Leave_Rules_Matrix |
| FRM-LVE-02 | Apply for Leave | LVE | Forms | 18_Leave_Requests |
| FRM-LVE-03 | Compensatory Off Claim | LVE | Forms | 19_CompOff_Ledger |
| FRM-LVE-04 | Leave Encashment Request | LVE | Forms | 54_Year_End_Leave_Preview, 58_FnF_Settlement |
| FRM-PAY-01 | Pay Component Master | PAY | Forms | 47_Pay_Components |
| FRM-PAY-02 | Salary Structure | PAY | Forms | 13_Salary_Structure |
| FRM-PAY-03 | Payroll Run | PAY | Forms | 26_Payroll_Runs, 55_Payroll_Register |
| FRM-PAY-04 | Pre-Payroll Audit Resolution | PAY | Forms | 51_Attendance_Exceptions |
| FRM-PAY-05 | Investment Declaration and Tax | PAY | Forms | Not supplied |
| FRM-PAY-06 | Reimbursement Claim | PAY | Forms | Not supplied |
| FRM-PAY-07 | Disbursement and Bank File | PAY | Forms | 57_Bank_File |
| FRM-PAY-08 | Full and Final Settlement | PAY | Forms | 58_FnF_Settlement |
| FRM-CMB-01 | Loan Application | CMB | Forms | 24_Loans, 25_Loan_Guarantors |
| FRM-CMB-02 | Salary Advance Request | CMB | Forms | 24_Loans — LN-APP-2026-0019 |
| FRM-TAL-01 | Manpower Requisition | TAL | Forms | 37_Requisitions |
| FRM-TAL-02 | Candidate Record and Application | TAL | Forms | 59_Candidates_and_Offers |
| FRM-TAL-03 | Interview Feedback | TAL | Forms | 59_Candidates_and_Offers |
| FRM-TAL-04 | Offer | TAL | Forms | 59_Candidates_and_Offers |
| FRM-TAL-05 | Employee Referral | TAL | Forms | 30_Recognition_Referral |
| FRM-LCY-01 | Pre-boarding and Joining Chain | LCY | Forms | 61_Preboarding_Chain |
| FRM-LCY-02 | Confirmation | LCY | Forms | 60_Confirmations |
| FRM-LCY-03 | Resignation and Exit | LCY | Forms | 27_Exit_Clearance, 58_FnF_Settlement |
| FRM-LCY-04 | Exit Clearance | LCY | Forms | 27_Exit_Clearance |
| FRM-EXP-01 | Letter Generation | EXP | Forms | 32_Letter_Templates |
| FRM-EXP-02 | Recognition Nomination | EXP | Forms | 30_Recognition_Referral |
| FRM-EXP-03 | Announcement | EXP | Forms | 31_Announcements |
| FRM-SSV-01 | Helpdesk Ticket | SSV | Forms | 63_Helpdesk_Tickets |
| FRM-CMP-01 | Obligation Calendar Entry | CMP | Forms | 28_Statutory_Calendar |
| FRM-CTG-01 | Contractor Engagement | CTG | Forms | 45_Vendors_Contractors |
| FRM-CTG-02 | Contractor Invoice Reconciliation | CTG | Forms | 46_Contractor_Invoices |
| FRM-FIN-01 | GL Mapping | FIN | Forms | 35_GL_Mapping |
| FRM-FIN-02 | ERP Integration and Field Ownership | FIN | Forms | 36_ERP_Inbound_Master |
| F-EMP-01 | Employee Master | EMP | Build | 12_Employees columns V to AQ |
| F-EMP-02 | Employment Category & Sub-category Master | EMP | Build | 38_Employment_Categories |
| F-EMP-03 | Leave Scheme Master | EMP | Build | 39_Leave_Schemes, 40_Leave_Rules_Matrix |
| F-EMP-04 | Designation & Grade Master | EMP | Build | 05_Designations |
| F-ATT-01 | Daily Attendance Processing | ATT | Build | 21_Expected_Attendance |
| F-ATT-02 | Punch Register | ATT | Build | 20_Punch_Events |
| F-ATT-03 | Break Register | ATT | Build | 49_Break_Register |
| F-ATT-04 | Attendance Regularisation | ATT | Build | 50_Attendance_Regularisation |
| F-ATT-05 | Team Calendar | ATT | Build | 21_Expected_Attendance, 44_Demo_Users |
| F-ATT-06 | Grace & Late Policy Setup | ATT | Build | 41_Grace_Late_Policy |
| F-SHF-01 | Shift Master | SHF | Build | 07_Shifts |
| F-SHF-02 | Shift Roster | SHF | Build | 52_Shift_Roster |
| F-SHF-03 | Night Extension Rule Setup | SHF | Build | 42_Night_Extension_Rule |
| F-LVE-01 | Leave Type Master | LVE | Build | 14_Leave_Types |
| F-LVE-02 | Leave Accrual Rule Setup | LVE | Build | 15_Leave_Accrual_Policy, 16_Leave_Proration |
| F-LVE-03 | Leave Application | LVE | Build | 18_Leave_Requests |
| F-LVE-04 | Leave Cancellation & Early Return | LVE | Build | 18_Leave_Requests, 50_Attendance_Regularisation |
| F-LVE-05 | Leave Balance & Ledger | LVE | Build | 53_Leave_Balance_AsOn, 17_Leave_Ledger |
| F-LVE-06 | COFF Register | LVE | Build | 19_CompOff_Ledger |
| F-LVE-07 | Year End Leave Processing | LVE | Build | 54_Year_End_Leave_Preview |
| F-OTM-01 | OT Computation & Approval | OTM | Build | 23_Overtime_Register |
| F-OTM-02 | OT Payment Run | OTM | Build | 26_Payroll_Runs, 55_Payroll_Register, 57_Bank_File |
| F-GPS-01 | Gate Pass Request | GPS | Build | 22_Gate_Pass |
| F-PAY-01 | Salary Structure | PAY | Build | 13_Salary_Structure |
| F-PAY-02 | Payroll Run | PAY | Build | 55_Payroll_Register |
| F-LON-01 | Loan Application | LON | Build | 24_Loans |
| F-LON-02 | Guarantor Register | LON | Build | 25_Loan_Guarantors |
| F-LON-03 | Salary Advance | LON | Build | 24_Loans — LN-APP-2026-0019 |
| F-FNF-01 | Full & Final Settlement | FNF | Build | 58_FnF_Settlement |
| F-FNF-02 | No Dues Clearance Checklist | FNF | Build | 27_Exit_Clearance |
| F-STA-01 | Statutory Registers & Returns | STA | Build | 29_Statutory_Forms, 48_PT_Slabs |
| F-STA-02 | Form F — Joining Form | STA | Build | 29_Statutory_Forms, 61_Preboarding_Chain |
| F-REC-01 | Approved Manpower Budget | REC | Build | 10_Sanctioned_Manpower |
| F-REC-02 | Manpower Requisition | REC | Build | 37_Requisitions, 59_Candidates_and_Offers |
| F-ONB-01 | Induction Checklist | ONB | Build | 34_Induction_Learning, 60_Confirmations |
| F-ONB-02 | Asset Allocation | ONB | Build | 33_Assets |
| F-ENG-01 | Star Employee Nomination | ENG | Build | 30_Recognition_Referral |
| F-ENG-02 | Employee Referral | ENG | Build | 30_Recognition_Referral, 59_Candidates_and_Offers |
| F-ENG-03 | Announcements | ENG | Build | 31_Announcements |
| F-DOC-01 | Letter Template & Issue | DOC | Build | 32_Letter_Templates |
| F-ORG-01 | Organisation Chart | ORG | Build | 04_Org_Units, 12_Employees |
| F-INT-01 | ERP Employee Master Sync | INT | Build | 36_ERP_Inbound_Master |
| F-INT-02 | Payroll Account Posting | INT | Build | 56_GL_Journal, 35_GL_Mapping |
| F-SEC-01 | Role & Data Scope Setup | SEC | Build | 43_Roles_and_Data_Scope |

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
| Size | 93 | specified items (table rows) | Counted automatically at generation |
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
