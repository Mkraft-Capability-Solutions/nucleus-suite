<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-03 — Leave — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-03 |
| Title | Leave — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Leave |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-LVE-01 | Leave Type Configuration | SCR-032 | Implementation consultant | 36 | Core HR > Leave operations > Leave policy configuration (SCR-032) | leave_policy_admin | /api/v1/ops/modules/leave_policy_admin/records |
| FRM-LVE-02 | Apply for Leave | SCR-030 | Employee | 20 | Core HR > Leave operations > Leave requests (SCR-030) | leave_requests | /api/v1/leave-requests |
| FRM-LVE-03 | Compensatory Off Claim | SCR-033 | Employee | 8 | Core HR > Leave operations > Compensatory off claim (SCR-033) | compensatory_off | /api/v1/ops/modules/compensatory_off/records |
| FRM-LVE-04 | Leave Encashment Request | SCR-034 | Employee, HR | 8 | Core HR > Leave operations > Leave encashment request (SCR-034) | leave_encashment | /api/v1/ops/modules/leave_encashment/records |

## 2. Field specifications

### FRM-LVE-01 — Leave Type Configuration (SCR-032)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Type | Leave type code | leave_type | Text | Char(10) | Y | — | Unique per tenant | — | Implementation | — |
| Type | Leave type name | name | Text | Char(60) | Y | — | — | — | All | — |
| Type | Unit | unit | Select | Char(10) | Y | Days | Days / Hours | PL_LEAVE_UNIT | Implementation | — |
| Type | Paid / unpaid | is_paid | Toggle | Bool | Y | Paid | — | — | Implementation | Unpaid types create loss-of-pay days |
| Type | Gender restriction | gender_restriction | Select | Char(20) | N | None | From list | PL_GENDER | Implementation | Maternity and paternity only |
| Type | Applicable worker classes | applicable_classes[] | Multi-select | Ref[] | Y | All | At least one | PL_WORKER_CLASS | Implementation | — |
| Type | Applicable leave bands | applicable_bands[] | Multi-select | Ref[] | Y | All | At least one | — | Implementation | Ineligible types are not shown, not shown-and-blocked |
| Accrual | Accrual method | accrual_method | Select | Char(20) | Y | Monthly | Annual / Monthly / Per attendance / None | PL_ACCRUAL_METHOD | Implementation | — |
| Accrual | Annual entitlement | annual_days | Number | Dec(5,2) | Y | — | 0-365 | — | Implementation | — |
| Accrual | Accrual frequency | accrual_frequency | Select | Char(15) | Y | Monthly | Monthly / Quarterly / Annually | PL_FREQUENCY | Implementation | — |
| Accrual | Accrual on | accrual_day | Select | Char(15) | Y | Month end | Month start / Month end | PL_ACCRUAL_DAY | Implementation | — |
| Accrual | Proration on joining | proration_rule | Lookup | Ref | Y | Standard | Active proration rule | — | Implementation | Joining-month slab table |
| Accrual | Eligibility wait (days from joining) | eligibility_wait_days | Number | Int | Y | 0 | 0-365 | — | Implementation | — |
| Accrual | Earned against attendance | earned_against_attendance | Toggle | Bool | Y | No | — | — | Implementation | Earned leave in factories accrues on days worked |
| Balance | Carry forward allowed | carry_forward | Toggle | Bool | Y | Yes | — | — | Implementation | — |
| Balance | Maximum carry forward | max_carry_forward | Number | Dec(5,2) | Y if carry forward | — | >= 0 | — | Implementation | — |
| Balance | Carry-forward expiry (months) | carry_forward_expiry_months | Number | Int | N | 12 | — | — | Implementation | Expiring credits are shown on the apply screen |
| Balance | Maximum accumulation | max_accumulation | Number | Dec(5,2) | N | — | >= annual entitlement | — | Implementation | Accrual stops at the ceiling |
| Balance | Negative balance allowed | allow_negative | Toggle | Bool | Y | No | — | — | Implementation | — |
| Balance | Negative balance limit | negative_limit | Number | Dec(5,2) | Y if allowed | — | >= 0 | — | Implementation | — |
| Balance | Encashable | is_encashable | Toggle | Bool | Y | No | — | — | Implementation | — |
| Balance | Encashment cap (days per year) | encashment_cap | Number | Dec(5,2) | Y if encashable | — | >= 0 | — | Implementation | — |
| Application | Minimum days per request | min_days | Number | Dec(3,1) | Y | 0.5 | — | — | Implementation | — |
| Application | Maximum days per request | max_days | Number | Dec(5,1) | N | — | >= minimum | — | Implementation | — |
| Application | Maximum instances per month | max_instances_month | Number | Int | N | — | >= 1 | — | Implementation | — |
| Application | Half day allowed | allow_half_day | Toggle | Bool | Y | Yes | — | — | Implementation | — |
| Application | Advance notice (days) | advance_notice_days | Number | Int | Y | 1 | 0-90 | — | Implementation | Emergency types set 0 |
| Application | Backdating allowed (days) | backdate_days | Number | Int | Y | 7 | 0-90 | — | Implementation | — |
| Application | Reason mandatory | reason_mandatory | Toggle | Bool | Y | No | — | — | Implementation | — |
| Application | Document mandatory beyond (days) | document_after_days | Number | Int | N | 3 | — | — | Implementation | Sick leave beyond 3 days needs a certificate |
| Rules | Sandwich rule | sandwich_rule | Select | Char(25) | Y | Exclude | Exclude / Include holidays / Include rest days / Include both | PL_SANDWICH_RULE | Implementation | Determines whether intervening days are deducted |
| Rules | Cannot be combined with | excluded_with[] | Multi-select | Ref[] | N | — | Other leave types | — | Implementation | Evaluated before the approval chain starts |
| Rules | Must be preceded by | prerequisite_type | Lookup | Ref | N | — | Other leave type | — | Implementation | — |
| Rules | Approval chain | approval_chain_id | Lookup | Ref | Y | Standard | Active chain | — | Implementation | — |
| Control | Effective from | effective_from | Date | Date | Y | Today | — | — | Implementation | In-flight requests finish on the version they started on |
| Control | Status | status | Select | Char(12) | Y | Active | — | PL_ACTIVE_STATUS | Implementation | — |

### FRM-LVE-02 — Apply for Leave (SCR-030)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Request | Leave type | leave_type | Select | Ref | Y | — | Only types the band and class are eligible for | PL_LEAVE_TYPE | Self | Ineligible types are not shown at all |
| Request | From date | date_from | Date | Date | Y | — | Not before joining; within the backdating window | — | Self | — |
| Request | To date | date_to | Date | Date | Y | Same as from | From <= To | — | Self | — |
| Request | Half day at start | is_half_day_start | Toggle | Bool | N | Off | Only where the type allows half days | — | Self | — |
| Request | Half day at end | is_half_day_end | Toggle | Bool | N | Off | Only where the type allows half days | — | Self | — |
| Request | Half day session | half_day_session | Select | Char(10) | Y if half day | First half | First half / Second half | PL_HALF_DAY_SESSION | Self | — |
| Request | Days applied | days_applied | Number (derived) | Dec(4,1) | Y | Computed | — | — | Self | Rest days and holidays excluded per the sandwich rule |
| Request | Reason | reason | Text | Char(300) | Y for some types | — | Per type configuration | — | Self | — |
| Request | Supporting document | document_ref | File | Ref | Y beyond the configured duration | — | PDF/JPG, max 5 MB | — | Self, HR | — |
| Request | Contact during leave | contact | Phone | Char(16) | N | Registered mobile | E.164 | — | Self | — |
| Request | Address during leave | leave_address | Text | Char(200) | N | — | — | — | Self | Required for long leave in some establishments |
| Request | Handover to | handover_person_id | Lookup | Ref | N | — | Active assignment in the same org unit | — | Self | Notified on approval |
| Context | Balance as at start date | projected_balance | Panel (derived) | Dec(5,1) | — | Computed | — | — | Self | Shows credits expiring before the leave starts |
| Context | Credits expiring before start | expiring_credits | Panel (derived) | Dec(5,1) | — | Computed | — | — | Self | — |
| Context | Rule messages | validation_messages | Panel (derived) | Text | — | Computed | — | — | Self | Names the rule: combination, monthly cap, eligibility wait |
| Context | Team availability on these dates | team_conflict_count | Panel (derived) | Int | — | Computed | — | — | Self, manager | Advisory, not blocking |
| Approval | Approver chain | approval_chain | Panel (derived) | Ref[] | Y | From configuration | — | — | Self | Shown before submission |
| Approval | Decision / remarks | decision, decision_remarks | Select + text | Mixed | Y | — | Reason mandatory on reject | PL_DECISION | Approver | — |
| Cancellation | Cancel request | cancel_reason | Text | Char(200) | Y on cancel | — | Min 10 chars | — | Self | Cancelling an approved future leave re-credits in one transaction |
| Early return | Actual return date | actual_return_date | Date | Date | Y on early return | — | Inside the approved span | — | Self, HR | Triggers reversal and recompute in one transaction |

### FRM-LVE-03 — Compensatory Off Claim (SCR-033)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Claim | Worked date | worked_date | Date | Date | Y | — | Must be a rest day or holiday with attendance | — | Self | Claim rejected if no attendance exists that day |
| Claim | Day type | day_type | Text (derived) | Char(15) | Y | From calendar | — | PL_DAY_TYPE | Self | — |
| Claim | Hours worked | hours_worked | Number (derived) | Dec(4,2) | Y | From attendance day | — | — | Self | — |
| Claim | Credit claimed | credit_days | Number (derived) | Dec(3,1) | Y | Per the half-day and full-day thresholds | 0.5 or 1.0 | — | Self | Not a free-text number |
| Claim | Reason for working | reason | Text | Char(200) | Y | — | Min 10 chars | — | Self | — |
| Claim | Overtime already claimed | ot_claimed_flag | Toggle (derived) | Bool | — | From OT register | Cannot claim both OT and comp-off for the same day | — | Self, Payroll | Hard block, not a warning |
| Credit | Credit expires on | credit_expiry | Date (derived) | Date | Y | Worked date plus validity | — | — | Self | Expiring credits are shown on the leave apply screen |
| Approval | Approver / decision / remarks | approver_id, decision, decision_remarks | Mixed | Mixed | Y | Reporting manager | Reason mandatory on reject | PL_DECISION | Approver | Approval writes a credit row to the leave ledger |

### FRM-LVE-04 — Leave Encashment Request (SCR-034)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Request | Leave type | leave_type | Select | Ref | Y | — | Encashable types only | PL_LEAVE_TYPE | Self | — |
| Request | Current balance | current_balance | Number (derived) | Dec(5,1) | — | From ledger | — | — | Self | — |
| Request | Days to encash | days_to_encash | Number | Dec(5,1) | Y | — | Within the annual cap; balance must remain above the retention floor | — | Self | — |
| Request | Encashment rate basis | rate_basis | Text (derived) | Char(30) | Y | From policy | — | PL_ENCASHMENT_BASIS | Self, Payroll | Basic, basic plus DA, or gross |
| Request | Estimated amount | estimated_amount | Money (derived) | Dec(10,2) | — | Computed | — | — | Self, Payroll | Indicative; payroll recomputes at run time |
| Request | Reason | reason | Text | Char(200) | N | — | — | — | Self | — |
| Approval | Approver / decision | approver_id, decision | Mixed | Mixed | Y | HR | — | PL_DECISION | Approver | — |
| Payroll | Tag to payroll run | tagged_run_id | Lookup | Ref | Y | — | Open run | — | Payroll | Debits the ledger only when the run is approved |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACCRUAL_DAY | Accrual timing | Config | 2 | Period start · Period end |
| PL_ACCRUAL_METHOD | Accrual method | Config | 4 | Annual credit · Monthly accrual · Per days worked · No accrual (entitlement based) |
| PL_ACTIVE_STATUS | Record status | System | 2 | Active · Inactive |
| PL_DAY_TYPE | Day type | System | 4 | Working day · Weekly off / rest day · Holiday · National holiday |
| PL_DECISION | Approval decision | System | 4 | Approve · Reject · Return for correction · Delegate |
| PL_ENCASHMENT_BASIS | Encashment rate basis | Config | 3 | Basic · Basic + DA · Gross |
| PL_FREQUENCY | Frequency | System | 5 | Monthly · Quarterly · Half-yearly · Annual · Event-based |
| PL_GENDER | Gender | System | 4 | Male · Female · Other · Prefer not to say |
| PL_HALF_DAY_SESSION | Half day session | System | 2 | First half · Second half |
| PL_LEAVE_TYPE | Leave type | Config | 11 | Earned leave · Casual leave · Sick leave · Maternity leave · Paternity leave · Compensatory off · Leave without pay · Bereavement leave · Marriage leave · Birthday leave · Special leave |
| PL_LEAVE_UNIT | Leave unit | Config | 2 | Days · Hours |
| PL_SANDWICH_RULE | Sandwich rule | Config | 4 | Exclude holidays and rest days · Include holidays · Include rest days · Include both |
| PL_WORKER_CLASS | Worker class | Config | 9 | Staff — monthly · Staff — probation · Workman — permanent · Workman — badli / substitute · Workman — temporary · Contract labour · Apprentice · Trainee · Retainer / consultant |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-LVE-01 | Leave Type Master | LVE | Master form | R-08 | EL, CL, SL, COFF and birthday leave, each with its accrual basis, monthly cap, lapse or encash behaviour and what it may not be combined with. | N | Register | 6 |
| F-LVE-02 | Leave Accrual Rule Setup | LVE | Configuration | R-08 | The grade-based annual credit, the monthly EL accrual, the six-month new-joiner hold and the joining-month proration table. | N | Rule print | 0 |
| F-LVE-03 | Leave Application | LVE | Transaction form | R-06, R-08 | Application through Supervisor, HOD and HR Head, enforcing the combination restrictions and the monthly caps at entry. | N | Leave letter | 7 |
| F-LVE-04 | Leave Cancellation & Early Return | LVE | Transaction form | R-06 | Shortens an approved leave, marks the unused days present and credits the balance back in one action. | N | Approval trail | 5 |
| F-LVE-05 | Leave Balance & Ledger | LVE | Enquiry | R-06, R-07, R-08 | One row per credit, availing, lapse, encashment and reversal, so a balance can always be explained. | N | Leave ledger | 0 |
| F-LVE-06 | COFF Register | LVE | Transaction form | R-07 | COFF earned, its expiry date and its lapse. The nightly job writes the lapse here. | N | COFF register | 4 |
| F-LVE-07 | Year End Leave Processing | LVE | Processing screen | R-08 | Encashes EL and lapses CL and SL at year end, in one reversible run with a preview. | N | Encashment and lapse statement | 5 |

#### F-LVE-01 — Leave Type Master

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Identity | Leave type code | leave_type_code | Text | Char(10) | Y | — | EL, CL, SL, COFF, BDAY at minimum | — | All roles | Yes | R-08 |
| Header | Behaviour | Is compensatory off | is_compensatory | Toggle | Bool | Y | N | COFF carries an expiry; other types do not | — | All roles | Yes | R-07 |
| Header | Behaviour | Is birthday leave | is_birthday_leave | Toggle | Bool | Y | N | Where Y, eligibility is driven by date_of_birth. Quantum and window are unstated in the source — see the open questions. | — | All roles | Yes | R-08 |
| Header | Behaviour | Encashable | is_encashable | Toggle | Bool | Y | N | EL only, per the source | — | All roles | Yes | R-08 |
| Header | Behaviour | Half day permitted | half_day_permitted | Toggle | Bool | Y | Y | — | — | All roles | Yes | R-08 |
| Header | Behaviour | Display unit | display_unit | Select | Char(10) | Y | Days | Days or Months. The source asks for the days-or-months calculation method to be settable for display. | EN_LEAVE_DISPLAY_UNIT | All roles | Yes — value set configurable per tenant | R-08 |

#### F-LVE-03 — Leave Application

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Application | Leave type | leave_type_code | Lookup | Ref | Y | — | Must be active in the employee's leave scheme | — | All roles | Yes | R-08 |
| Header | Application | From date | leave_from_date | Date | Date | Y | — | — | — | All roles | No — system derived | R-06 |
| Header | Application | To date | leave_to_date | Date | Date | Y | — | Not earlier than leave_from_date | — | All roles | No — system derived | R-06 |
| Header | Application | Days applied | days_applied | Number (derived) | Dec(5,2) | Y | — | Excludes rest days and holidays where the leave type says so | — | All roles | No — system derived | R-06 |
| Header | Validation | Combination check result | combination_check_result | Read-only | Char(60) | Y | — | Blocks submission where CL abuts or overlaps EL or SL in a contiguous absence, per the source | — | All roles | No — system derived | R-08 |
| Header | Validation | Monthly cap check result | monthly_cap_check_result | Read-only | Char(60) | Y | — | Blocks above 2 CL or 10 EL in a month, counting days already approved in that month | — | All roles | No — system derived | R-08 |
| Control | Approval | Current approval level | approval_level | Read-only | Char(20) | Y | Supervisor | Supervisor, then HOD, then HR Head. Each level must be recorded with actor and timestamp. | EN_LEAVE_APPROVAL_LEVEL | All roles | Yes — value set configurable per tenant | R-06 |

#### F-LVE-04 — Leave Cancellation & Early Return

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Early return | Original approved leave reference | original_leave_ref | Lookup | Ref | Y | — | Must be an approved, not yet closed, leave application | — | HR roles only | No — system derived | R-06 |
| Header | Early return | Actual return date | actual_return_date | Date | Date | Y | — | Between the original from and to dates. For a 10-day leave returned on day 7, days 7 to 10 are released. | — | HR roles only | No — system derived | R-06 |
| Header | Early return | Days credited back | days_credited_back | Number (derived) | Dec(5,2) | Y | — | Written to the leave ledger as a reversal against the original availing, not as a fresh accrual | — | HR roles only | No — system derived | R-06 |
| Header | Early return | Attendance action | attendance_action | Select | Char(20) | Y | Mark present | Mark present or Leave unchanged. The source requires the released days to be marked present. | EN_EARLY_RETURN_ACTION | HR roles only | Yes — value set configurable per tenant | R-06 |
| Header | Early return | Updated by HR | hr_updated_by | Read-only | Ref | Y | — | The source gives HR the option to update the leave. The actor must be recorded, not implied. | — | HR roles only | No — system derived | R-06 |

#### F-LVE-06 — COFF Register

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Line | COFF | COFF earned date | coff_earned_date | Date | Date | Y | — | The date worked that generated the COFF | — | All roles | No — system derived | R-07 |
| Line | COFF | COFF expiry date | coff_expiry_date | Date (derived) | Date | Y | Earned date plus coff_lapse_days | Read-only. Recomputed only if the lapse policy changes before the COFF is availed. | — | All roles | No — system derived | R-07 |
| Line | COFF | COFF status | coff_status | Select (derived) | Char(20) | Y | Available | Available, Availed, Lapsed. The nightly job moves Available to Lapsed on the expiry date. | EN_COFF_STATUS | All roles | Yes — value set configurable per tenant | R-07 |
| Line | COFF | Lapse run reference | lapse_run_ref | Read-only | Ref | Y when status is Lapsed | — | Which nightly run lapsed it, so a disputed balance can be traced | — | All roles | No — system derived | R-07 |

#### F-LVE-07 — Year End Leave Processing

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Run | Processing year | processing_year | Number | Int(4) | Y | Current year | — | — | HR roles only | No — system derived | R-08 |
| Header | Run | Run mode | run_mode | Select | Char(20) | Y | Preview | Preview or Commit. Preview must produce the same figures as Commit and change nothing. | EN_RUN_MODE | HR roles only | Yes — value set configurable per tenant | R-08 |
| Line | Result | EL encashed days | el_encashed_days | Number (derived) | Dec(5,2) | Y | — | Feeds the payroll input for encashment | — | HR roles only | No — system derived | R-08 |
| Line | Result | CL lapsed days | cl_lapsed_days | Number (derived) | Dec(5,2) | Y | — | — | — | HR roles only | No — system derived | R-08 |
| Line | Result | SL lapsed days | sl_lapsed_days | Number (derived) | Dec(5,2) | Y | — | — | — | HR roles only | No — system derived | R-08 |

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
| Size | 123 | specified items (table rows) | Counted automatically at generation |
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
