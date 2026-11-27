<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-03 — Lifecycle — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-03 |
| Title | Lifecycle — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Lifecycle |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-LCY-01 | Pre-boarding and Joining Chain | SCR-060 | HR Ops | 15 | Core HR > People & lifecycle > Joining chain console (SCR-060) | joining_chain | /api/v1/onboarding/instances |
| FRM-LCY-02 | Confirmation | SCR-068 | Manager, HR | 10 | Core HR > People & lifecycle > Confirmation review (SCR-068) | probation_confirmation | /api/v1/ops/modules/probation_confirmation/records |
| FRM-LCY-03 | Resignation and Exit | SCR-069 | Employee, HR | 16 | Core HR > People & lifecycle > Resignation and exit (SCR-069) | resignation_exit | /api/v1/ops/modules/resignation_exit/records |
| FRM-LCY-04 | Exit Clearance | SCR-061 | Department owners, HR | 10 | Core HR > People & lifecycle > Clearance board (SCR-061) | clearance_board | /api/v1/ops/modules/clearance_board/records |

## 2. Field specifications

### FRM-LCY-01 — Pre-boarding and Joining Chain (SCR-060)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Hire | Candidate / offer reference | candidate_id, offer_id | Read-only | Ref | Y | From the accepted offer | — | — | HR | Person record created from the offer, not retyped |
| Hire | Actual joining date | actual_joining_date | Date | Date | Y | Proposed joining date | Deviation needs a reason | — | HR | — |
| Hire | Joining deviation reason | joining_deviation_reason | Text | Char(200) | Y if deviating | — | Min 10 chars | — | HR | — |
| Chain | Checklist item | chain_item[] | Table | Composite | Y | From the template by worker class and location | — | — | HR, owner | Repeating: item, owner, due date, blocking flag |
| Chain | Item owner | item_owner_id | Lookup | Ref | Y per item | From the template | Active principal | — | HR | — |
| Chain | Due date | item_due_date | Date (derived) | Date | Y per item | Joining date plus the offset | — | — | HR, owner | SLA breach escalates to the HRBP |
| Chain | Blocking | is_blocking | Toggle (derived) | Bool | Y per item | From the template | — | — | HR | Blocking items hold shop-floor access and payroll |
| Chain | Status | item_status | Select | Char(15) | Y per item | Open | Open / In progress / Done / Waived | PL_TASK_STATUS | Owner, HR | — |
| Chain | Completed on / by | completed_on, completed_by | Read-only | Mixed | — | System | — | — | HR | — |
| Chain | Waiver reason | item_waiver_reason | Text | Char(300) | Y on waive | — | Authorised role; min 20 chars | — | Authorised role | — |
| Artefacts | Generated artefacts | generated_artefacts[] | Panel (derived) | Ref[] | — | System | — | — | HR | Appointment letter, Form F nomination, ID card, statutory registrations |
| Artefacts | Statutory registration status | pf_reg_status, esi_reg_status | Panel (derived) | Char(15) | — | System | — | PL_REGISTRATION_STATUS | HR | UAN generated at registration if absent |
| Artefacts | Induction learning assigned | learning_assignment_id | Read-only | Ref | — | System | — | — | HR | Same mechanism as any other trigger |
| Progress | Chain progress | progress_percent | Panel (derived) | Int | — | Computed | — | — | HR | — |
| Progress | Blockers | open_blocking_items | Panel (derived) | Int | — | Computed | — | — | HR | — |

### FRM-LCY-02 — Confirmation (SCR-068)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Confirmation | Employee / probation end | person_id, confirmation_due | Read-only | Mixed | Y | From the assignment | — | — | Manager, HR | Reminder raised 30 days ahead |
| Confirmation | Manager recommendation | recommendation | Select | Char(25) | Y | — | Confirm / Extend / Terminate | PL_CONFIRMATION_ACTION | Manager | — |
| Confirmation | Performance rating | probation_rating | Select | Char(20) | Y | — | From the rating scale | PL_RATING_SCALE | Manager | — |
| Confirmation | Assessment comments | assessment | Text | Char(1000) | Y | — | Min 50 chars | — | Manager, HR | — |
| Confirmation | Extension period (months) | extension_months | Number | Int | Y if extending | 3 | 1-6 | — | Manager, HR | Extension resets the confirmation due date |
| Confirmation | Extension reason | extension_reason | Text | Char(500) | Y if extending | — | Min 30 chars | — | Manager, HR | — |
| Confirmation | Effective date of confirmation | confirmation_effective_date | Date | Date | Y if confirming | Probation end plus one day | Backdating needs a reason | — | HR | Triggers referral award maturity and benefit eligibility |
| Confirmation | Salary revision on confirmation | revise_salary | Toggle | Bool | N | No | — | — | HR | Opens the salary structure form |
| Confirmation | Letter to be issued | issue_letter | Toggle | Bool | Y | Yes | — | — | HR | — |
| Approval | Approval status / approver | approval_status, approver_id | Panel (derived) | Mixed | Y | From the chain | — | PL_APPROVAL_STATUS | HR | — |

### FRM-LCY-03 — Resignation and Exit (SCR-069)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Exit | Exit type | exit_type | Select | Char(25) | Y | Resignation | Resignation / Termination / Retirement / Contract end / Abandonment / Death | PL_EXIT_TYPE | Self, HR | Drives gratuity, notice and clearance behaviour |
| Exit | Resignation date | resignation_date | Date | Date | Y | Today | Not in the future beyond 7 days | — | Self, HR | — |
| Exit | Reason category | exit_reason_category | Select | Char(30) | Y | — | From list | PL_EXIT_REASON | Self, HR | — |
| Exit | Reason detail | exit_reason_detail | Text | Char(500) | Y | — | Min 20 chars | — | Self, HR | — |
| Exit | Notice period applicable | notice_period_days | Number (derived) | Int | Y | From the assignment | — | — | HR | — |
| Exit | Requested last working day | requested_lwd | Date | Date | Y | Resignation date plus notice | — | — | Self | — |
| Exit | Approved last working day | approved_lwd | Date | Date | Y | Requested last working day | Earlier date creates a notice shortfall | — | HR | Shortfall raises a recovery on full and final |
| Exit | Notice waiver | notice_waived_days, waiver_reason | Mixed | Mixed | N | 0 | Authorised role; min 20 chars | — | Authorised role | — |
| Exit | Garden leave | is_garden_leave | Toggle | Bool | N | No | — | — | HR | Attendance exempt, salary continues |
| Exit | Rehire eligible | rehire_eligible | Select | Char(15) | Y | Yes | Yes / No / With approval | PL_REHIRE_ELIGIBILITY | HR only | Not visible to the employee |
| Exit | Rehire ineligibility reason | rehire_reason | Text | Char(300) | Y if not eligible | — | Min 20 chars | — | HR only | — |
| Interview | Exit interview conducted on / by | exit_interview_date, interviewer_id | Mixed | Mixed | N | — | Before the last working day | — | HR | — |
| Interview | Exit interview responses | exit_interview[] | Table | Composite | N | From the questionnaire | — | — | HR | Feeds attrition analysis, not the settlement |
| Approval | Manager and HR acceptance | manager_accepted, hr_accepted | Toggle | Bool | Y | Off | Both required before clearance starts | — | Manager, HR | — |
| Downstream | Clearance initiated | clearance_initiated | Toggle (derived) | Bool | — | System | — | — | HR | Instantiated from the template on acceptance |
| Downstream | Access revocation date | access_revocation_date | Date (derived) | Date | Y | Last working day | — | — | HR, IT | Systems access revoked automatically |

### FRM-LCY-04 — Exit Clearance (SCR-061)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Item | Checklist item | item | Read-only | Char(120) | Y | From the template by class and location | — | — | Owner, HR | — |
| Item | Owner | owner_id | Lookup | Ref | Y | From the template | Active principal | — | HR | Reassignable with reason |
| Item | Blocking | is_blocking | Read-only | Bool | Y | From the template | — | — | Owner, HR | Full and final is held while any blocking item is open |
| Item | Due date | due_date | Date (derived) | Date | Y | Last working day minus the offset | — | — | Owner, HR | — |
| Item | Status | status | Select | Char(15) | Y | Open | Open / Cleared / Waived | PL_CLEARANCE_ITEM_STATUS | Owner, HR | Only the owner or HR may clear |
| Item | Cleared on / by | cleared_on, cleared_by | Read-only | Mixed | — | System | — | — | Owner, HR | — |
| Item | Recovery amount | recovery_amount | Money | Dec(10,2) | N | 0 | >= 0 | — | HR, Payroll | Raises a payroll input on full and final |
| Item | Recovery description | recovery_description | Text | Char(200) | Y if recovery > 0 | — | Min 10 chars | — | HR, Payroll | Unreturned asset becomes a recovery line |
| Item | Waiver reason | waive_reason | Text | Char(300) | Y on waive | — | Authorised role; min 20 chars | — | Authorised role | — |
| Header | Full and final state | fnf_state | Panel (derived) | Char(20) | — | Computed from blocking items | — | PL_CLEARANCE_STATUS | HR, Payroll | — |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_APPROVAL_STATUS | Approval status | System | 5 | Draft · Pending approval · Approved · Rejected · Withdrawn |
| PL_CLEARANCE_ITEM_STATUS | Clearance item status | System | 3 | Open · Cleared · Waived |
| PL_CLEARANCE_STATUS | Clearance status | System | 4 | Not started · In progress · Blocked · Cleared |
| PL_CONFIRMATION_ACTION | Confirmation action | System | 3 | Confirm · Extend probation · Terminate |
| PL_EXIT_REASON | Exit reason category | Config | 12 | Better opportunity · Compensation · Career growth · Relocation · Higher studies · Personal / family · Health · Work environment · Manager relationship · Performance · Disciplinary · Not disclosed |
| PL_EXIT_TYPE | Exit type | System | 7 | Resignation · Termination · Retirement · Contract end · Abandonment · Death in service · Redundancy |
| PL_RATING_SCALE | Rating scale | Config | 5 | Outstanding · Exceeds expectations · Meets expectations · Needs improvement · Unsatisfactory |
| PL_REGISTRATION_STATUS | Statutory registration status | System | 4 | Not required · Pending · Registered · Failed |
| PL_REHIRE_ELIGIBILITY | Rehire eligibility | System | 3 | Yes · No · With approval |
| PL_TASK_STATUS | Task status | System | 5 | Open · In progress · Done · Waived · Overdue |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-FNF-01 | Full & Final Settlement | FNF | Transaction form | R-17 | Same-day settlement, released only once no-dues is complete. Carries a known save defect to be fixed. | N | F&F statement | 4 |
| F-FNF-02 | No Dues Clearance Checklist | FNF | Workbench | R-17 | Department-wise clearance with a sign-off per department, blocking F&F release until every line is cleared or waived with a reason. | N | Clearance certificate | 6 |
| F-ONB-01 | Induction Checklist | ONB | Workbench | R-24 | Induction training items completed at joining, blocking confirmation until done. | N | Induction record | 3 |
| F-ONB-02 | Asset Allocation | ONB | Transaction form | R-24 | Assets issued at joining, and the same list read back at F&F for return. | N | Asset issue slip | 3 |

#### F-FNF-01 — Full & Final Settlement

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Settlement | Last working date | last_working_date | Date | Date | Y | — | — | — | HR roles only | No — system derived | R-17 |
| Header | Settlement | Settlement date | settlement_date | Date | Date | Y | Last working date | The source requires same-day settlement, so this defaults to the last working date rather than a later run date | — | HR roles only | Yes | R-17 |
| Header | Clearance | No dues status | no_dues_status | Read-only | Char(20) | Y | Pending | Pending, Cleared or Waived. Settlement cannot be released while any department line is Pending. | EN_NO_DUES_STATUS | HR roles only | Yes — value set configurable per tenant | R-17 |
| Header | Clearance | No dues reference | no_dues_ref | Lookup | Ref | Y | — | The clearance checklist record for this employee | — | HR roles only | No — system derived | R-17 |

#### F-FNF-02 — No Dues Clearance Checklist

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Line | Checklist | Department | clearance_department | Lookup | Ref | Y | — | One row per department that must sign off. The department list is configuration, not code. | — | All roles | Yes | R-17 |
| Line | Checklist | Clearance item | clearance_item | Text | Char(120) | Y | — | For example assets returned, library, IT access, canteen, transport | — | All roles | Yes | R-17 |
| Line | Checklist | Status | clearance_status | Select | Char(20) | Y | Pending | Pending, Cleared or Waived | EN_NO_DUES_STATUS | All roles | Yes — value set configurable per tenant | R-17 |
| Line | Checklist | Recovery amount | recovery_amount | Money | Dec(18,2) | N | 0.00 | Flows into the F&F settlement as a deduction | — | HR roles only | Yes | R-17 |
| Line | Checklist | Waiver reason | waiver_reason | Text | Char(300) | Y when status is Waived | — | A waiver without a reason must not save | — | HR roles only | No — system derived | R-17 |
| Line | Checklist | Cleared by | cleared_by | Read-only | Ref | Y when status is not Pending | — | Actor and timestamp recorded per line | — | All roles | No — system derived | R-17 |

#### F-ONB-01 — Induction Checklist

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Line | Induction | Induction item | induction_item | Text | Char(120) | Y | — | The checklist is configuration per location or department | — | All roles | Yes | R-24 |
| Line | Induction | Completion status | induction_status | Select | Char(20) | Y | Pending | Confirmation must be blocked while any mandatory item is Pending | — | All roles | Yes | R-24 |
| Line | Induction | Completed on | induction_completed_on | Date | Date | Y when status is Completed | — | — | — | All roles | No — system derived | R-24 |

#### F-ONB-02 — Asset Allocation

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Line | Assets | Asset code | asset_code | Lookup | Ref | Y | — | The same list is read back at F&F for return and recovery | — | All roles | No — system derived | R-24, R-17 |
| Line | Assets | Issued on | asset_issued_on | Date | Date | Y | Date of joining | — | — | All roles | No — system derived | R-24 |
| Line | Assets | Recovery value if not returned | asset_recovery_value | Money | Dec(18,2) | N | 0.00 | Flows into the no-dues checklist as a recovery amount | — | HR roles only | Yes | R-24, R-17 |

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
| Size | 85 | specified items (table rows) | Counted automatically at generation |
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
