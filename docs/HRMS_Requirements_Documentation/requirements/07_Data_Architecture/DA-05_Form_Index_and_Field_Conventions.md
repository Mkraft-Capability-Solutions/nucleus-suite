<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# DA-05 — Form Index and Field Conventions

| Attribute | Value |
| :--- | :--- |
| Document ID | DA-05 |
| Title | Form Index and Field Conventions |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | UX Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, RDM |
| Related documents | FRS-<DOM>-03 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 00_Read_Me, 01_Form_Index<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 08_Form_Fields |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Field specification conventions

| Topic | Rule |
| :--- | :--- |
| What it replaces | Sheet 08_Form_Fields of 'Nucleus — Process Flows & Process Maps v1.0', which specified only the eight forms that carried complex rules. That sheet remains valid; this workbook supersedes and extends it to full coverage. |
| What it is not | It is not a process map, a state machine or a test plan. Those live in the Process Flows workbook. Where a field's behaviour depends on a rule, the rule is named in the Validation column so it can be traced back. |
| Designers and front-end developers | Open 02_Field_Spec and filter the Form ID column. Every row is one field on one form, in display order, grouped by section. Section names are the visual groupings on the screen. |
| Back-end developers | The Field name column is the snake_case object.field name and matches the Data Dictionary in the Process Flows workbook. Fields marked (derived) are computed and must never be writable through the API. |
| QA | Mandatory, Validation and Default are the three columns that generate test cases. Every 'Y if ...' entry is a conditional-mandatory case that needs both branches tested. |
| Implementation consultants | 03_Picklists holds every dropdown in the product with its complete value set. Values marked Config are tenant-editable at implementation; values marked System are fixed. |
| Section | The visual grouping on the screen. Fields appear in the order listed. |
| Field label | The exact label the user sees. Do not paraphrase it in the UI. |
| Field name | snake_case object.field. Matches the Data Dictionary. A name ending in [] is a repeating group. |
| Control | The input widget. '(derived)' means computed and read-only. '(read-only)' means displayed but never editable on this form. |
| Data type | Storage type and length. Money is stored as an integer in the smallest currency unit and displayed with two decimals. |
| Mandatory | Y, N, or a condition. A condition must be enforced in the service layer, not only in the UI. |
| Default | The value present when the form opens. '—' means empty. |
| Validation | The rule enforced at save. Rules that block the save are stated as blocks; rules that only warn say so. |
| Picklist | The code on 03_Picklists holding the complete value set. '—' means free entry or a lookup to a master table. |
| Visibility | Which personas see the field. 'masked' means the value is tokenised and only the last characters are shown. |
| Effective dating | Any field marked temporal in the Data Dictionary is versioned. Changing it creates a new row with an effective date; it never overwrites history. |
| Reason on override | Every override of a policy default requires a free-text reason of at least 10 characters. No reason, no save. |
| Audit | Every create, update and delete writes an audit entry with actor, timestamp, before and after values. Reads of restricted fields are also logged. |
| Masking | Aadhaar, PAN, passport and bank account are tokenised at rest. The form shows the last four characters only, and the full value is never returned by the API. |
| Backdating | Backdating into a closed payroll period is permitted where the field allows it, and always produces an arrears entry rather than a rewrite of the closed period. |
| Deletion | Nucleus end-dates rather than deletes. The 'delete' action sets an end date and retains the row. |
| Money and rounding | Money is stored as an integer in the smallest currency unit. Rounding is applied once, at the component level, per the component's rounding rule. |
| Mandatory enforcement | Every mandatory and conditional rule in this workbook is enforced in the service layer so that business messaging, API and mobile entry cannot bypass it. |
| Error messages | A blocked save must name the rule that blocked it and the value that failed. 'Invalid input' is not an acceptable message. |
| Forms specified | 49 |
| Fields specified | 860 |
| Picklists specified | 119 |
| Modules covered | Platform, People Core, Time & Attendance, Leave, Payroll, Compensation & Loans, Lifecycle, Talent, Experience, Self-service & Helpdesk, Compliance, Contingent Workforce, Finance & ERP |

## 2. Form index with navigation path and CRUD endpoint

| Form ID | Form | Module | Screen ID | Primary persona | Fields | Full Location Path | Target Module ID | CRUD API Endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-PLT-01 | Legal Entity Master | PLT Platform | SCR-001 | Tenant admin | 22 | Platform & Admin > People & lifecycle > Legal entity master (SCR-001) | legal_entity | /api/v1/organization/entities |
| FRM-PLT-02 | Location / Work Site Master | PLT Platform | SCR-002 | Tenant admin | 20 | Platform & Admin > People & lifecycle > Location / Work site master (SCR-002) | location_master | /api/v1/organization/locations |
| FRM-PLT-03 | User, Role and Scope Grant | PLT Platform | SCR-005 | Tenant admin | 16 | Core HR > People & lifecycle > Access scope administration (SCR-005) | access_scope | /api/v1/identity/memberships |
| FRM-PPL-01 | Add / Edit Employee — Identity and Personal | PPL People Core | SCR-010 | HR Ops | 117 | Core HR > People & lifecycle > Employee record (SCR-010) | person_record | /api/v1/people |
| FRM-PPL-02 | Employment, Assignment and Policy | PPL People Core | SCR-011 | HR Ops | 45 | Core HR > People & lifecycle > Assignment and policy attributes (SCR-011) | assignment_admin | /api/v1/organization/tree |
| FRM-PPL-03 | Position Master | PPL People Core | SCR-012 | HR, Finance | 15 | Core HR > People & lifecycle > Position register (SCR-012) | position_register | /api/v1/organization/tree |
| FRM-PPL-04 | Sanctioned Strength | PPL People Core | SCR-013 | HR, Finance | 11 | Core HR > People & lifecycle > Sanctioned strength board (SCR-013) | sanctioned_strength | /api/v1/organization/tree |
| FRM-PPL-05 | Document Upload and Verification | PPL People Core | SCR-014 | Employee, HR | 10 | Core HR > People & lifecycle > Document vault (SCR-014) | document_vault | /api/v1/ops/modules/document_vault/records |
| FRM-PPL-06 | Asset Allocation and Return | PPL People Core | SCR-064 | Admin, IT | 12 | Core HR > People & lifecycle > Asset register (SCR-064) | asset_register | /api/v1/assets |
| FRM-TIM-01 | Shift Master | TIM Time & Attendance | SCR-028 | Implementation, HR | 20 | Core HR > Attendance operations > Shift master (SCR-028) | shift_master | /api/v1/ops/modules/shift_master/records |
| FRM-TIM-02 | Roster / Shift Schedule | TIM Time & Attendance | SCR-029 | Supervisor | 12 | Core HR > Attendance operations > Roster / Shift Schedule (SCR-029) | roster_schedule | /api/v1/ops/modules/roster_schedule/records |
| FRM-TIM-03 | Check In / Check Out | TIM Time & Attendance | SCR-020 | Employee | 10 | Core HR > Attendance operations > Check in and check out (SCR-020) | check_in_out | /api/v1/attendance/punches |
| FRM-TIM-04 | Attendance Day Detail and Override | TIM Time & Attendance | SCR-022 | Supervisor, HR | 22 | Core HR > Attendance operations > Attendance day detail (SCR-022) | attendance_detail | /api/v1/ops/modules/attendance_detail/records |
| FRM-TIM-05 | Attendance Regularisation Request | TIM Time & Attendance | SCR-021 | Employee | 12 | Core HR > Attendance operations > My attendance history (SCR-021) | my_attendance | /api/v1/attendance/days |
| FRM-TIM-06 | Gate Pass | TIM Time & Attendance | SCR-023 | Employee, Approver | 12 | Core HR > Attendance operations > Gate pass register (SCR-023) | gate_passes | /api/v1/gate-passes |
| FRM-TIM-07 | Overtime Register and Approval | TIM Time & Attendance | SCR-024 | Supervisor, Payroll | 11 | Core HR > Attendance operations > Overtime register (SCR-024) | overtime_register | /api/v1/ot-requests |
| FRM-TIM-08 | Attendance Exception Resolution | TIM Time & Attendance | SCR-025 | Supervisor, HR | 8 | Core HR > Attendance operations > Attendance exception queue (SCR-025) | attendance_exceptions | /api/v1/regularizations |
| FRM-LVE-01 | Leave Type Configuration | LVE Leave | SCR-032 | Implementation consultant | 36 | Core HR > Leave operations > Leave policy configuration (SCR-032) | leave_policy_admin | /api/v1/ops/modules/leave_policy_admin/records |
| FRM-LVE-02 | Apply for Leave | LVE Leave | SCR-030 | Employee | 20 | Core HR > Leave operations > Leave requests (SCR-030) | leave_requests | /api/v1/leave-requests |
| FRM-LVE-03 | Compensatory Off Claim | LVE Leave | SCR-033 | Employee | 8 | Core HR > Leave operations > Compensatory off claim (SCR-033) | compensatory_off | /api/v1/ops/modules/compensatory_off/records |
| FRM-LVE-04 | Leave Encashment Request | LVE Leave | SCR-034 | Employee, HR | 8 | Core HR > Leave operations > Leave encashment request (SCR-034) | leave_encashment | /api/v1/ops/modules/leave_encashment/records |
| FRM-PAY-01 | Pay Component Master | PAY Payroll | SCR-057 | Implementation, Payroll | 28 | Payroll & Finance > Payroll & finance operations > Pay component master (SCR-057) | pay_component_master | /api/v1/ops/modules/pay_component_master/records |
| FRM-PAY-02 | Salary Structure | PAY Payroll | SCR-052 | HR, Compensation | 25 | Core HR > Payroll & finance operations > Salary structure simulator (SCR-052) | salary_simulator | /api/v1/wage-simulations |
| FRM-PAY-03 | Payroll Run | PAY Payroll | SCR-050 | Payroll manager | 18 | Payroll & Finance > Payroll & finance operations > Payroll run cockpit (SCR-050) | payroll_runs | /api/v1/payroll-runs |
| FRM-PAY-04 | Pre-Payroll Audit Resolution | PAY Payroll | SCR-051 | Payroll manager | 8 | Payroll & Finance > Payroll & finance operations > Pre-payroll audit (SCR-051) | pre_payroll_audit | /api/v1/payroll-anomalies |
| FRM-PAY-05 | Investment Declaration and Tax | PAY Payroll | SCR-054 | Employee | 35 | Payroll & Finance > Payroll & finance operations > Tax declaration and projection (SCR-054) | tax_declarations | /api/v1/ops/modules/tax_declarations/records |
| FRM-PAY-06 | Reimbursement Claim | PAY Payroll | SCR-058 | Employee | 12 | Payroll & Finance > Payroll & finance operations > Reimbursement claim (SCR-058) | reimbursement_claim | /api/v1/ops/modules/reimbursement_claim/records |
| FRM-PAY-07 | Disbursement and Bank File | PAY Payroll | SCR-055 | Finance | 13 | Payroll & Finance > Payroll & finance operations > Bank disbursement control (SCR-055) | bank_disbursement | /api/v1/ops/modules/bank_disbursement/records |
| FRM-PAY-08 | Full and Final Settlement | PAY Payroll | SCR-056 | Payroll, HR | 18 | Payroll & Finance > Payroll & finance operations > Full and final settlement (SCR-056) | full_and_final | /api/v1/fnf-settlements |
| FRM-CMB-01 | Loan Application | CMB Compensation & Loans | SCR-080 | Employee, HR, Finance | 22 | Payroll & Finance > Payroll & finance operations > Loans and advances (SCR-080) | loans_advances | /api/v1/loans |
| FRM-CMB-02 | Salary Advance Request | CMB Compensation & Loans | SCR-081 | Employee | 8 | Payroll & Finance > Payroll & finance operations > Salary advance request (SCR-081) | salary_advance | /api/v1/ops/modules/salary_advance/records |
| FRM-TAL-01 | Manpower Requisition | TAL Talent | SCR-090 | Hiring manager | 21 | Core HR > Talent & experience operations > Recruitment requisitions (SCR-090) | requisitions | /api/v1/requisitions |
| FRM-TAL-02 | Candidate Record and Application | TAL Talent | SCR-092 | Recruiter | 19 | Core HR > Talent & experience operations > Candidate record and application (SCR-092) | candidate_application | /api/v1/ops/modules/candidate_application/records |
| FRM-TAL-03 | Interview Feedback | TAL Talent | SCR-093 | Interviewer | 10 | Core HR > Talent & experience operations > Interview feedback (SCR-093) | interview_feedback | /api/v1/ops/modules/interview_feedback/records |
| FRM-TAL-04 | Offer | TAL Talent | SCR-094 | Recruiter, HR | 14 | Core HR > Talent & experience operations > Offer management (SCR-094) | offer_management | /api/v1/ops/modules/offer_management/records |
| FRM-TAL-05 | Employee Referral | TAL Talent | SCR-091 | Employee, HR | 10 | Core HR > Talent & experience operations > Referral tracking (SCR-091) | referrals | /api/v1/referrals |
| FRM-LCY-01 | Pre-boarding and Joining Chain | LCY Lifecycle | SCR-060 | HR Ops | 15 | Core HR > People & lifecycle > Joining chain console (SCR-060) | joining_chain | /api/v1/onboarding/instances |
| FRM-LCY-02 | Confirmation | LCY Lifecycle | SCR-068 | Manager, HR | 10 | Core HR > People & lifecycle > Confirmation review (SCR-068) | probation_confirmation | /api/v1/ops/modules/probation_confirmation/records |
| FRM-LCY-03 | Resignation and Exit | LCY Lifecycle | SCR-069 | Employee, HR | 16 | Core HR > People & lifecycle > Resignation and exit (SCR-069) | resignation_exit | /api/v1/ops/modules/resignation_exit/records |
| FRM-LCY-04 | Exit Clearance | LCY Lifecycle | SCR-061 | Department owners, HR | 10 | Core HR > People & lifecycle > Clearance board (SCR-061) | clearance_board | /api/v1/ops/modules/clearance_board/records |
| FRM-EXP-01 | Letter Generation | EXP Experience | SCR-067 | HR Ops | 13 | Core HR > People & lifecycle > Letters and issue register (SCR-067) | letters_register | /api/v1/hr-letters |
| FRM-EXP-02 | Recognition Nomination | EXP Experience | SCR-065 | Manager, HR | 10 | Core HR > Talent & experience operations > Recognition register (SCR-065) | recognition_register | /api/v1/recognition-events |
| FRM-EXP-03 | Announcement | EXP Experience | SCR-066 | HR | 12 | Core HR > Talent & experience operations > Announcements (SCR-066) | announcement_management | /api/v1/announcements |
| FRM-SSV-01 | Helpdesk Ticket | SSV Self-service & Helpdesk | SCR-043 | Employee, HR | 13 | Analytics & AI > Intelligence operations > Helpdesk ticket (SCR-043) | helpdesk_ticket | /api/v1/ops/modules/helpdesk_ticket/records |
| FRM-CMP-01 | Obligation Calendar Entry | CMP Compliance | SCR-072 | Compliance owner | 12 | Workforce Operations > Compliance engineering > Obligation calendar (SCR-072) | obligation_calendar | /api/v1/compliance/obligations |
| FRM-CTG-01 | Contractor Engagement | CTG Contingent Workforce | SCR-095 | Purchase, HR | 12 | Core HR > Compliance engineering > Contractor engagement and invoice (SCR-095) | contractor_reconciliation | /api/v1/contractors/invoices |
| FRM-CTG-02 | Contractor Invoice Reconciliation | CTG Contingent Workforce | SCR-096 | Finance, HR | 12 | Workforce Operations > Compliance engineering > Contractor invoice reconciliation (SCR-096) | contractor_invoice | /api/v1/ops/modules/contractor_invoice/records |
| FRM-FIN-01 | GL Mapping | FIN Finance & ERP | SCR-102 | Finance | 8 | Payroll & Finance > Payroll & finance operations > GL mapping and journal (SCR-102) | gl_mapping | /api/v1/ops/modules/gl_mapping/records |
| FRM-FIN-02 | ERP Integration and Field Ownership | FIN Finance & ERP | SCR-100 | Implementation consultant | 9 | Core HR > Integration operations > Integration configuration (SCR-100) | integration_config | /api/v1/integrations/connections |

## 3. Earlier field list from the process workbook

Retained for traceability; where it differs, the Forms & Fields specification governs.

| Screen ID | Section | Field label | Control | Source object.field | Mandatory | Validation | Default | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-010 | Identity | Employee code | Text (read-only) | person.employee_code | Y | Unique per tenant; format per tenant ID policy | Auto or ERP-supplied | All | Read-only when ERP owns the field |
| SCR-010 | Identity | Full name | Text | person.full_name | Y | 2-120 chars | — | All | Duplicate check on name + DOB + site |
| SCR-010 | Identity | Gender | Select | person.gender | Y | M / F / Other / Prefer not to say | — | All | Drives gender-conditional leave types only |
| SCR-010 | Identity | Date of birth | Date | person.date_of_birth | Y | Age ≥ statutory minimum for the establishment type | — | All | Feeds the birthday announcement and birthday leave |
| SCR-010 | Identity | Date of joining | Date | employment.employment_start | Y | Not after today + 90 days; backdating allowed with reason | — | All | Backdated joining after a payroll run triggers arrears |
| SCR-010 | Contact | Mobile | Phone | person.mobile | Y | E.164; unique warning if shared | — | All | The business messaging channel key |
| SCR-010 | Contact | Personal email | Email | person.personal_email | N | RFC email | — | All | Used for pre-boarding and alumni |
| SCR-010 | Contact | Present / permanent address | Address block | person.present_address | Y | PIN validated against state | — | All | PIN drives PT and LWF cross-checks |
| SCR-010 | Contact | Emergency contact | Group | person.emergency_contact | Y | Name + relation + phone | — | All | Mandatory before shop-floor access |
| SCR-010 | Statutory | Aadhaar | Masked text | person.aadhaar_token | N | 12 digits, checksum; stored tokenised | — | HR + self, masked | Mismatch does NOT block joining; it blocks payroll |
| SCR-010 | Statutory | PAN | Masked text | person.pan_token | N | 10 char ABCDE1234F; stored tokenised | — | HR + self, masked | Required for TDS |
| SCR-010 | Statutory | UAN | Text | person.uan | N | 12 digits | — | HR + self | Generated at registration if absent |
| SCR-010 | Statutory | ESI IP number | Text | person.esi_ip | N | 17 digits | — | HR + self | Only where ESI applies |
| SCR-010 | Bank | Account number | Masked text | bank_detail.account_token | Y | Tokenised; last 4 shown | — | HR + self, masked | Change inside a payroll window raises an alert |
| SCR-010 | Bank | IFSC | Text | bank_detail.ifsc | Y | 11 char, bank master lookup | — | HR + self | Validated against the bank master |
| SCR-011 | Placement | Position | Lookup | assignment.position_code | Y | Must be vacant and not frozen | — | HR | Filling it flips position status |
| SCR-011 | Placement | Org unit | Lookup | assignment.org_unit | Y | Active unit | From position | HR | ERP-owned in co-owned mode |
| SCR-011 | Placement | Designation | Lookup | assignment.designation_code | Y | Active designation | — | HR | Carries band, grace exemption and leave band |
| SCR-011 | Placement | Band | Text (derived) | assignment.band | Y | — | From designation | HR | Read-only |
| SCR-011 | Placement | Location | Lookup | assignment.location_id | Y | Active location | — | HR | Drives holidays, PT, LWF, forms and time visibility |
| SCR-011 | Placement | Payroll group | Lookup | assignment.payroll_group | Y | Active group | NOT defaulted from location | HR | Independent of location by design (demo point 8) |
| SCR-011 | Placement | Manager | Lookup | assignment.manager_assignment_id | Y | Active assignment; no cycles | — | HR | Cycle check must run at save |
| SCR-011 | Placement | Cost centre | Lookup | assignment.cost_centre | Y | Active in the client's chart | From position | HR | Journal dimension |
| SCR-011 | Policy | Worker class | Select | assignment.worker_class | Y | Active class | — | HR | Supplies rest days, wage type, OT eligibility, statutory set |
| SCR-011 | Policy | Has rest days (override) | Toggle | assignment.override_has_rest_days | N | Reason required when set | From class | HR | Temporal |
| SCR-011 | Policy | Rest day pattern (override) | Select | assignment.override_rest_day_pattern | N | Reason required | From class | HR | Weekly day(s) / rotating / none |
| SCR-011 | Policy | Wage type (override) | Select | assignment.override_wage_type | N | Reason required | From class | HR | Monthly / daily / stipend / retainer |
| SCR-011 | Policy | Overtime eligibility (override) | Select | assignment.override_ot_eligibility | N | Reason required | From class | HR | always / rest_day_and_holiday_only / none |
| SCR-011 | Policy | Shift group and default shift | Lookup | assignment.shift_group, default_shift | Y | Shift must belong to the group | — | HR | Inference only operates inside the group |
| SCR-011 | Policy | Effective from | Date | assignment.effective_from | Y | Any date; past dates flagged as retro | Today | HR | Retro into a closed period creates arrears, never a rewrite |
| SCR-011 | Policy | Change reason | Text | assignment.override_reason | Y when overriding | Min 10 chars | — | HR | No reason, no save |
| SCR-030 | Request | Leave type | Select | leave_request.leave_type | Y | Only types the band is eligible for | — | Employee | Ineligible types are not shown, not shown-and-blocked |
| SCR-030 | Request | From / to | Date range | leave_request.date_from/date_to | Y | From ≤ To; not before joining | — | Employee | Rest days and holidays inside the span are excluded per policy |
| SCR-030 | Request | Half day start / end | Toggle | leave_request.is_half_day_start/end | N | Only where the type allows half days | Off | Employee |  |
| SCR-030 | Request | Days applied | Number (derived) | leave_request.days_applied | Y | — | Computed | Employee | Read-only |
| SCR-030 | Request | Reason | Text | leave_request.reason | Y for some types | Per type configuration | — | Employee |  |
| SCR-030 | Request | Contact during leave | Phone | leave_request.contact | N | E.164 | Mobile | Employee |  |
| SCR-030 | Context | Balance as at start date | Panel (derived) | leave_ledger projection | — | — | Computed | Employee | Shows credits expiring before the leave starts |
| SCR-030 | Context | Rule messages | Panel | validation output | — | — | — | Employee | Names the rule: combination, monthly cap, eligibility wait |
| SCR-030 | Early return | Actual return date | Date | leave_request.actual_return_date | Y on early return | Inside the approved span | — | Employee, HR | Triggers reversal + recompute in one transaction |
| SCR-023 | Request | Date | Date | gate_pass.date | Y | Within the open attendance period | Today | Employee |  |
| SCR-023 | Request | From / to time | Time | gate_pass.from_ts/to_ts | Y | Inside the shift window; ≤ remaining ceiling | — | Employee |  |
| SCR-023 | Request | Type | Select | gate_pass.pass_type | Y | Personal / Official | Personal | Employee | Official does not consume the personal ceiling |
| SCR-023 | Request | Reason | Text | gate_pass.reason | Y | Min 5 chars | — | Employee |  |
| SCR-023 | Context | Minutes used / instances this month | Panel (derived) | gate_pass aggregation | — | — | Computed | Employee | 240 minutes, 2 instances for this client |
| SCR-022 | Header | Attendance date | Date (read-only) | attendance_day.attendance_date | Y | — | — | Supervisor, HR | The SHIFT start date, not the punch calendar date |
| SCR-022 | Header | Shift assigned / applied | Text (read-only) | attendance_day.shift_id_assigned / _applied | Y | — | — | Supervisor, HR | Difference plus reason shown prominently |
| SCR-022 | Totals | First in / last out | Time (read-only) | attendance_day.first_in/last_out | Y | — | — | Supervisor, HR |  |
| SCR-022 | Totals | Gross / break / gate pass / net minutes | Number (read-only) | attendance_day.*_minutes | Y | — | — | Supervisor, HR | Shown in h:mm as well as minutes |
| SCR-022 | Totals | Overtime minutes and basis | Number (read-only) | attendance_day.ot_minutes_payable, ot_basis | Y | — | — | Supervisor, HR | Basis label must be visible, not assumed |
| SCR-022 | Disposition | Status and the rules applied | Text (read-only) | attendance_day.status, applied_rule_ids | Y | — | — | Supervisor, HR | Status without its rule trail is unarguable |
| SCR-022 | Disposition | Late by / instance no / beyond allowance | Number | attendance_day.late_* | Y | — | — | Supervisor, HR |  |
| SCR-022 | Segments | Segment list with in/out and minutes | Table | attendance_segment | Y | — | — | Supervisor, HR |  |
| SCR-022 | Breaks | Break list with type, minutes, paid flag | Table | attendance_break | Y | — | — | Supervisor, HR | This is the break report the client asked for |
| SCR-022 | Provenance | Computed at, ruleset version, source event count | Text | attendance_day.computed_* | Y | — | — | Supervisor, HR, auditor |  |
| SCR-022 | Actions | Override shift / regularise / recompute | Buttons | — | — | Reason mandatory on every action | — | Per permission | Every action logged with actor and reason |
| SCR-022 | Pay | Rate, salary, OT amount | Money | salary_structure.* | — | — | — | NULL for principals outside the payroll group | The point-8 assertion; tested on every build |
| SCR-080 | Eligibility | Eligible / ceiling / reasons | Panel (derived) | GET /loans/eligibility | — | — | Computed | Employee, HR, Finance | Reasons shown verbatim; same method the payroll node calls |
| SCR-080 | Application | Purpose | Select | loan_application.purpose | Y | Configured purpose list | — | Employee |  |
| SCR-080 | Application | Principal | Money | loan_application.principal | Y | ≤ ceiling unless override requested | — | Employee | 4x basic, 6x above five years' service |
| SCR-080 | Application | Tenure (months) | Number | loan_application.tenure_months | Y | Within configured min/max | — | Employee | Instalment derived and shown |
| SCR-080 | Guarantors | Guarantor 1 and 2 (mandatory) | Lookup | loan_guarantor.guarantor_person_id | Y | Each must pass the same eligibility check | — | Employee | Each accepts explicitly |
| SCR-080 | Guarantors | Guarantor 3 (optional) | Lookup | loan_guarantor.guarantor_person_id | N | Required above the configured amount threshold | — | Employee |  |
| SCR-080 | Sanction | Special terms / rules waived | Checkbox + text | loan.special_terms, rules_waived | N | Director role only; reason mandatory | Off | Director | The waived rules are named, not implied |
| SCR-090 | Requisition | Type | Select | requisition.requisition_type | Y | Replacement / Addition | — | Hiring manager | Drives the sanction check |
| SCR-090 | Requisition | Against position | Lookup | requisition.against_position_code | Y for replacement | Position must be vacant | — | Hiring manager | Consumes no fresh sanction |
| SCR-090 | Requisition | Org unit / designation / location | Lookup | requisition.* | Y | Active values | — | Hiring manager | The sanction key |
| SCR-090 | Context | Sanctioned / filled / open / headroom | Panel (derived) | sanctioned_position + assignment + requisition | — | — | Computed | Hiring manager | Live, not a monthly report |
| SCR-090 | Override | Override reason | Text | requisition.override_reason | Y when overriding | Min 20 chars, authorised role only | — | Authorised role |  |
| SCR-050 | Run | Entity / period / payroll group | Lookup | payroll_run.* | Y | Active values | — | Payroll |  |
| SCR-050 | Run | Run type | Select | payroll_run.run_type | Y | regular / off_cycle_ot / arrears / fnf / bonus | regular | Payroll | A period carries several runs |
| SCR-050 | Run | Pay date | Date | payroll_run.pay_date | Y | ≥ period end unless off-cycle | — | Payroll |  |
| SCR-050 | State | Run state and stepper | Panel | payroll_run.run_state | — | Transitions guarded by 11_State_Machines | DRAFT | Payroll | Rollback disabled past DISBURSEMENT_PREPARED |
| SCR-050 | Validation | Unmapped components | Panel | gl_mapping check | — | Blocks APPROVED | — | Payroll, Finance | Demo point 15 |
| SCR-061 | Item | Checklist item / owner / blocking | Table | clearance_item.* | Y | Template-instantiated | From template | Owner, HR |  |
| SCR-061 | Item | Status / cleared on | Select + date | clearance_item.status, cleared_on | Y | Only the owner or HR may clear | Open | Owner, HR |  |
| SCR-061 | Item | Waiver reason | Text | clearance_item.waive_reason | Y when waiving | Authorised role; min 20 chars | — | Authorised role |  |
| SCR-061 | Item | Recovery amount | Money | clearance_item.recovery_amount | N | Raises a payroll input on F&F | — | HR, Payroll | Unreturned asset becomes a recovery line |
| SCR-061 | Header | F&F state | Panel (derived) | blocking item aggregation | — | — | Computed | HR, Payroll | Held while any blocking item is open |

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
| Size | 157 | specified items (table rows) | Counted automatically at generation |
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
