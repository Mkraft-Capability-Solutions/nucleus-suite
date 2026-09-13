# Workbook to UI coverage

Source: `docs/Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx`. Reviewed all 23 sheets. The workbook was not modified.

49 screen IDs are specified; 49 have a matching operational UI surface. This does **not** mean every feature, rule, offline behavior or integration is implemented.

## Sheet-by-sheet assessment

| Sheet | Extracted requirement rows | Current assessment |
| --- | ---: | --- |
| 00_Read_Me | 30 | Reference and planning material; not a feature-completion claim. |
| 01_Sheet_Index | 23 | Reference and planning material; not a feature-completion claim. |
| 02_Process_Architecture | 34 | Reference and planning material; not a feature-completion claim. |
| 03_Process_Inventory | 93 | UI/scenario coverage is partial; enforcement and all transitions are not verified. |
| 04_Process_Steps | 250 | UI/scenario coverage is partial; enforcement and all transitions are not verified. |
| 05_Swimlane_Maps | 80 | UI/scenario coverage is partial; enforcement and all transitions are not verified. |
| 06_Data_Dictionary | 97 | Live execution and storage are deferred by the frontend-only scope; existing code does not establish integration acceptance. |
| 07_Screens | 49 | Every screen ID mapped below; generic UI is not end-to-end completion. |
| 08_Form_Fields | 79 | Field-level specifications attached to the process guide. Generic forms have label/validation gaps; see JSON detail. |
| 09_Business_Rules | 239 | UI/scenario coverage is partial; enforcement and all transitions are not verified. |
| 10_Config_Tables | 18 | UI/scenario coverage is partial; enforcement and all transitions are not verified. |
| 11_State_Machines | 52 | UI/scenario coverage is partial; enforcement and all transitions are not verified. |
| 12_Events | 41 | Live execution and storage are deferred by the frontend-only scope; existing code does not establish integration acceptance. |
| 13_API_and_Tools | 28 | Live execution and storage are deferred by the frontend-only scope; existing code does not establish integration acceptance. |
| 14_Agents | 9 | Live execution and storage are deferred by the frontend-only scope; existing code does not establish integration acceptance. |
| 15_Integration_Flows | 12 | Live execution and storage are deferred by the frontend-only scope; existing code does not establish integration acceptance. |
| 16_Reuse_Register | 12 | Reference and planning material; not a feature-completion claim. |
| 17_Traceability | 31 | Acceptance requirements captured. No claim of full rule, security, offline, load or release compliance. |
| 19_Test_Cases | 53 | Acceptance requirements captured. No claim of full rule, security, offline, load or release compliance. |
| 18_Build_Backlog | 88 | Reference and planning material; not a feature-completion claim. |
| 20_NFR_and_DoD | 18 | Acceptance requirements captured. No claim of full rule, security, offline, load or release compliance. |
| 21_Roles_and_RACI | 12 | Acceptance requirements captured. No claim of full rule, security, offline, load or release compliance. |
| 22_Open_Decisions | 14 | Reference and planning material; not a feature-completion claim. |

## Screen mapping

| Workbook reference | Screen | UI module | Form labels not matched exactly |
| --- | --- | --- | ---: |
| 07_Screens!A6 (SCR-005) | Principal, role and scope grant | `access_scope` | 0 |
| 07_Screens!A7 (SCR-010) | Employee record — identity and personal | `person_record` | 7 |
| 07_Screens!A8 (SCR-011) | Assignment and policy attributes | `assignment_admin` | 9 |
| 07_Screens!A9 (SCR-012) | Position register | `position_register` | 0 |
| 07_Screens!A10 (SCR-013) | Sanctioned strength board | `sanctioned_strength` | 0 |
| 07_Screens!A11 (SCR-014) | Document vault | `document_vault` | 0 |
| 07_Screens!A13 (SCR-020) | Check in / check out | `check_in_out` | 0 |
| 07_Screens!A14 (SCR-021) | My attendance | `my_attendance` | 0 |
| 07_Screens!A15 (SCR-022) | Attendance day detail (HR/supervisor) | `attendance_detail` | 11 |
| 07_Screens!A16 (SCR-023) | Gate pass | `gate_passes` | 3 |
| 07_Screens!A17 (SCR-024) | Overtime register | `overtime_register` | 0 |
| 07_Screens!A18 (SCR-025) | Attendance exception queue | `attendance_exceptions` | 0 |
| 07_Screens!A19 (SCR-026) | Recompute monitor | `recompute_monitor` | 0 |
| 07_Screens!A20 (SCR-027) | Team history | `team_history` | 0 |
| 07_Screens!A22 (SCR-030) | Apply for leave | `leave_requests` | 6 |
| 07_Screens!A23 (SCR-031) | Leave balance and ledger | `leave_ledger` | 0 |
| 07_Screens!A24 (SCR-032) | Leave policy configuration | `leave_policy_admin` | 0 |
| 07_Screens!A26 (SCR-050) | Payroll run cockpit | `payroll_runs` | 3 |
| 07_Screens!A27 (SCR-051) | Pre-payroll audit | `pre_payroll_audit` | 0 |
| 07_Screens!A28 (SCR-052) | Salary structure simulator | `salary_simulator` | 0 |
| 07_Screens!A29 (SCR-053) | Payslip | `payslips` | 0 |
| 07_Screens!A30 (SCR-054) | Tax declaration and projection | `tax_declarations` | 0 |
| 07_Screens!A31 (SCR-055) | Disbursement and bank file | `bank_disbursement` | 0 |
| 07_Screens!A32 (SCR-056) | Full and final | `full_and_final` | 0 |
| 07_Screens!A34 (SCR-040) | Unified approval inbox | `approval_inbox` | 0 |
| 07_Screens!A35 (SCR-041) | Assistant / helpdesk | `assistant_helpdesk` | 0 |
| 07_Screens!A36 (SCR-042) | Employee home | `employee_home` | 0 |
| 07_Screens!A38 (SCR-060) | Joining chain console | `joining_chain` | 0 |
| 07_Screens!A39 (SCR-061) | Clearance board | `clearance_board` | 3 |
| 07_Screens!A40 (SCR-062) | Policy acknowledgement | `policy_acknowledgements` | 0 |
| 07_Screens!A41 (SCR-063) | My learning | `learning_paths` | 0 |
| 07_Screens!A42 (SCR-064) | Asset register | `asset_register` | 0 |
| 07_Screens!A43 (SCR-065) | Recognition | `recognition_register` | 0 |
| 07_Screens!A44 (SCR-066) | Announcements | `announcement_management` | 0 |
| 07_Screens!A45 (SCR-067) | Letters | `letters_register` | 0 |
| 07_Screens!A47 (SCR-070) | Rule pack manager | `rule_pack_manager` | 0 |
| 07_Screens!A48 (SCR-071) | Golden case library | `golden_case_library` | 0 |
| 07_Screens!A49 (SCR-072) | Obligation calendar | `obligation_calendar` | 0 |
| 07_Screens!A50 (SCR-073) | Statutory forms and registers | `statutory_register` | 0 |
| 07_Screens!A52 (SCR-080) | Loans and advances | `loans_advances` | 6 |
| 07_Screens!A53 (SCR-090) | Requisition | `requisitions` | 4 |
| 07_Screens!A54 (SCR-091) | Referrals | `referrals` | 0 |
| 07_Screens!A55 (SCR-095) | Contractor engagement and invoice | `contractor_reconciliation` | 0 |
| 07_Screens!A57 (SCR-100) | Integration configuration | `integration_config` | 0 |
| 07_Screens!A58 (SCR-101) | Sync monitor | `sync_monitor` | 0 |
| 07_Screens!A59 (SCR-102) | GL mapping and journal | `gl_mapping` | 0 |
| 07_Screens!A60 (SCR-103) | Reconciliation | `reconciliation` | 0 |
| 07_Screens!A61 (SCR-110) | Agent console and action ledger | `agent_ledger` | 0 |
| 07_Screens!A62 (SCR-111) | Operational reports | `operational_reports` | 0 |

## What remains

- Generic screen actions and browser state are available for layout review. Complete validation, conditional field visibility, offline queues, multi-stage approvals and state guards must be accepted separately.
- Live payroll disbursement, statutory filing, document delivery, ERP/WhatsApp/Teams integrations, agent execution and durable audit trails are not enabled in this phase.
- `WORKBOOK_UI_COVERAGE.json` retains every extracted requirement row, source row number and detailed screen/form/step/rule mapping. A missing exact label is a review candidate, not an automatic proof that the concept is absent elsewhere.
- Each operational screen includes a Process guide so reviewers can compare its reference actions and fields with the current UI. The guide is reference content, not an implementation of the listed workflow.
