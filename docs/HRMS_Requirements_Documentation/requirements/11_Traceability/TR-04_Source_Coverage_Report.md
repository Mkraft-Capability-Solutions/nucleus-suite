<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# TR-04 — Source Coverage Report

| Attribute | Value |
| :--- | :--- |
| Document ID | TR-04 |
| Title | Source Coverage Report |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | PQA Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, PQA, CM |
| Related documents | SRC-01, REQ-02, TR-01, TR-02, TR-03 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0<br>Nucleus HRMS — Complete Forms & Fields Specification v1.0<br>Nucleus HR Demo Points Build Sheet v1.0<br>Nucleus HRMS Demo Dataset v1.1<br>HR Demo Points (client tracker)<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Automated audit showing that every sheet and every identifier in the source workbooks appears in the requirements set.

**Summary.** Sheets used: 111 / 111. Identifiers covered: 1430 / 1430. Form endpoint rows covered: 49 / 49.

## 1. Sheet coverage

| Book | Sheet | Rows | Used | IDs | Covered | Missing IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| P | 00_Read_Me | 33 | Yes | 0 | 0 |  |
| P | 01_Sheet_Index | 26 | Yes | 0 | 0 |  |
| P | 02_Process_Architecture | 40 | Yes | 20 | 20 |  |
| P | 03_Process_Inventory | 110 | Yes | 93 | 93 |  |
| P | 04_Process_Steps | 311 | Yes | 58 | 58 |  |
| P | 05_Swimlane_Maps | 92 | Yes | 9 | 9 |  |
| P | 06_Data_Dictionary | 110 | Yes | 0 | 0 |  |
| P | 07_Screens | 61 | Yes | 49 | 49 |  |
| P | 08_Form_Fields | 91 | Yes | 9 | 9 |  |
| P | 09_Business_Rules | 256 | Yes | 239 | 239 |  |
| P | 10_Config_Tables | 21 | Yes | 0 | 0 |  |
| P | 11_State_Machines | 63 | Yes | 0 | 0 |  |
| P | 12_Events | 45 | Yes | 0 | 0 |  |
| P | 13_API_and_Tools | 33 | Yes | 0 | 0 |  |
| P | 14_Agents | 13 | Yes | 0 | 0 |  |
| P | 15_Integration_Flows | 15 | Yes | 0 | 0 |  |
| P | 16_Reuse_Register | 15 | Yes | 11 | 11 |  |
| P | 17_Traceability | 34 | Yes | 0 | 0 |  |
| P | 19_Test_Cases | 61 | Yes | 53 | 53 |  |
| P | 18_Build_Backlog | 96 | Yes | 79 | 79 |  |
| P | 20_NFR_and_DoD | 21 | Yes | 0 | 0 |  |
| P | 21_Roles_and_RACI | 15 | Yes | 0 | 0 |  |
| P | 22_Open_Decisions | 17 | Yes | 14 | 14 |  |
| F | 00_Read_Me | 39 | Yes | 0 | 0 |  |
| F | 01_Form_Index | 53 | Yes | 49 | 49 |  |
| F | 02_Field_Spec | 912 | Yes | 49 | 49 |  |
| F | 03_Picklists | 122 | Yes | 119 | 119 |  |
| B | 01_Requirement_Register | 30 | Yes | 27 | 27 |  |
| B | 02_Module_Index | 21 | Yes | 0 | 0 |  |
| B | 03_Forms_and_Screens | 47 | Yes | 44 | 44 |  |
| B | 04_Field_Specification | 217 | Yes | 36 | 36 |  |
| B | 05_Rules_and_Calculations | 29 | Yes | 26 | 26 |  |
| B | 06_Enum_Values | 28 | Yes | 25 | 25 |  |
| B | 07_Approval_Workflows | 12 | Yes | 9 | 9 |  |
| B | 08_Reports_and_Outputs | 18 | Yes | 15 | 15 |  |
| B | 09_Configuration_Register | 131 | Yes | 0 | 0 |  |
| B | 10_Acceptance_Tests | 43 | Yes | 40 | 40 |  |
| B | 11_Open_Questions | 19 | Yes | 16 | 16 |  |
| B | 12_Traceability_Matrix | 30 | Yes | 27 | 27 |  |
| D | 00_README | 22 | Yes | 0 | 0 |  |
| D | 01_Scenario_Map | 29 | Yes | 0 | 0 |  |
| D | 02_Legal_Entities | 3 | Yes | 0 | 0 |  |
| D | 03_Locations | 6 | Yes | 0 | 0 |  |
| D | 04_Org_Units | 16 | Yes | 0 | 0 |  |
| D | 05_Designations | 22 | Yes | 0 | 0 |  |
| D | 06_Worker_Classes | 11 | Yes | 0 | 0 |  |
| D | 07_Shifts | 8 | Yes | 0 | 0 |  |
| D | 08_Attendance_Rules | 6 | Yes | 0 | 0 |  |
| D | 09_Holiday_Calendar | 15 | Yes | 0 | 0 |  |
| D | 10_Sanctioned_Manpower | 12 | Yes | 10 | 10 |  |
| D | 11_Positions | 12 | Yes | 0 | 0 |  |
| D | 12_Employees | 71 | Yes | 0 | 0 |  |
| D | 13_Salary_Structure | 71 | Yes | 0 | 0 |  |
| D | 14_Leave_Types | 9 | Yes | 0 | 0 |  |
| D | 15_Leave_Accrual_Policy | 12 | Yes | 0 | 0 |  |
| D | 16_Leave_Proration | 9 | Yes | 0 | 0 |  |
| D | 17_Leave_Ledger | 47 | Yes | 0 | 0 |  |
| D | 18_Leave_Requests | 9 | Yes | 0 | 0 |  |
| D | 19_CompOff_Ledger | 8 | Yes | 0 | 0 |  |
| D | 20_Punch_Events | 398 | Yes | 0 | 0 |  |
| D | 21_Expected_Attendance | 227 | Yes | 0 | 0 |  |
| D | 22_Gate_Pass | 7 | Yes | 0 | 0 |  |
| D | 23_Overtime_Register | 9 | Yes | 0 | 0 |  |
| D | 24_Loans | 9 | Yes | 0 | 0 |  |
| D | 25_Loan_Guarantors | 11 | Yes | 0 | 0 |  |
| D | 26_Payroll_Runs | 8 | Yes | 0 | 0 |  |
| D | 27_Exit_Clearance | 14 | Yes | 0 | 0 |  |
| D | 28_Statutory_Calendar | 14 | Yes | 0 | 0 |  |
| D | 29_Statutory_Forms | 10 | Yes | 0 | 0 |  |
| D | 30_Recognition_Referral | 9 | Yes | 0 | 0 |  |
| D | 31_Announcements | 10 | Yes | 0 | 0 |  |
| D | 32_Letter_Templates | 14 | Yes | 0 | 0 |  |
| D | 33_Assets | 11 | Yes | 0 | 0 |  |
| D | 34_Induction_Learning | 12 | Yes | 0 | 0 |  |
| D | 35_GL_Mapping | 29 | Yes | 0 | 0 |  |
| D | 36_ERP_Inbound_Master | 10 | Yes | 0 | 0 |  |
| D | 37_Requisitions | 9 | Yes | 0 | 0 |  |
| D | 38_Employment_Categories | 12 | Yes | 0 | 0 |  |
| D | 39_Leave_Schemes | 6 | Yes | 0 | 0 |  |
| D | 40_Leave_Rules_Matrix | 11 | Yes | 0 | 0 |  |
| D | 41_Grace_Late_Policy | 4 | Yes | 0 | 0 |  |
| D | 42_Night_Extension_Rule | 4 | Yes | 0 | 0 |  |
| D | 43_Roles_and_Data_Scope | 12 | Yes | 0 | 0 |  |
| D | 44_Demo_Users | 12 | Yes | 0 | 0 |  |
| D | 45_Vendors_Contractors | 7 | Yes | 0 | 0 |  |
| D | 46_Contractor_Invoices | 6 | Yes | 0 | 0 |  |
| D | 47_Pay_Components | 26 | Yes | 0 | 0 |  |
| D | 48_PT_Slabs | 11 | Yes | 0 | 0 |  |
| D | 49_Break_Register | 6 | Yes | 0 | 0 |  |
| D | 50_Attendance_Regularisation | 7 | Yes | 0 | 0 |  |
| D | 51_Attendance_Exceptions | 8 | Yes | 0 | 0 |  |
| D | 52_Shift_Roster | 10 | Yes | 0 | 0 |  |
| D | 53_Leave_Balance_AsOn | 32 | Yes | 0 | 0 |  |
| D | 54_Year_End_Leave_Preview | 16 | Yes | 0 | 0 |  |
| D | 55_Payroll_Register | 20 | Yes | 0 | 0 |  |
| D | 56_GL_Journal | 29 | Yes | 0 | 0 |  |
| D | 57_Bank_File | 6 | Yes | 0 | 0 |  |
| D | 58_FnF_Settlement | 19 | Yes | 0 | 0 |  |
| D | 59_Candidates_and_Offers | 10 | Yes | 0 | 0 |  |
| D | 60_Confirmations | 7 | Yes | 0 | 0 |  |
| D | 61_Preboarding_Chain | 11 | Yes | 0 | 0 |  |
| D | 62_Documents | 9 | Yes | 0 | 0 |  |
| D | 63_Helpdesk_Tickets | 8 | Yes | 0 | 0 |  |
| D | 64_Approval_Workflows | 12 | Yes | 10 | 10 |  |
| D | 65_Enum_Seed_Values | 27 | Yes | 25 | 25 |  |
| D | 66_Picklist_Seed_Values | 121 | Yes | 119 | 119 |  |
| D | 67_Reports_Register | 19 | Yes | 17 | 17 |  |
| D | 68_Acceptance_Test_Data | 42 | Yes | 40 | 40 |  |
| D | 69_Coverage_Matrix | 95 | Yes | 93 | 93 |  |
| D | 70_Change_Log_v1_1 | 19 | Yes | 0 | 0 |  |
| H | Sheet1 | 27 | Yes | 0 | 0 |  |

## 2. Content intentionally excluded

- **Delivery status columns** — all requirements are new, so client and delivery tracker statuses are excluded: `Client status`, `Demo status`, `Build action`, `Action`, `Data readiness`, coverage `Status`, and the `Status` column of the client tracker. Business-data status fields inside the golden dataset (for example an employee's employment status) are retained because they are data.
- **Third-party product references** — product-mapping columns and third-party product names in the sources are removed or replaced by generic terms (for example "ERP system", "business messaging channel").

## 3. Identifier conventions applied

| Convention | Reason | Applied as |
| :--- | :--- | :--- |
| Build-sheet rule IDs `RL-01…` collide with process-workbook rule IDs `RL-001…` | Ambiguous traceability | Build-sheet rules shown as `BS:RL-xx` (qualified, not renumbered) |
| Domain document IDs `<DOM>-nn` would collide with process IDs (e.g. `TIM-01`) | Ambiguous traceability | Domain documents use `FRS-<DOM>-nn` |
| Compliance processes use the suffix `p` (`CMP-01p`) to avoid colliding with component IDs `CMP-nn` | — | Retained as in source |
| Two form namespaces: `FRM-<MOD>-nn` (forms workbook) and `F-<MOD>-nn` (build sheet client deltas) | Two IDs for related forms | Both retained; workflow and coverage tables cross-reference them |

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
| Size | 115 | specified items (table rows) | Counted automatically at generation |
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
