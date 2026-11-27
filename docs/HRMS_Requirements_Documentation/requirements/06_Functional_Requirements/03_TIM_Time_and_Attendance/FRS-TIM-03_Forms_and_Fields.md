<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-03 — Time & Attendance — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-03 |
| Title | Time & Attendance — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-TIM-01 | Shift Master | SCR-028 | Implementation, HR | 20 | Core HR > Attendance operations > Shift master (SCR-028) | shift_master | /api/v1/ops/modules/shift_master/records |
| FRM-TIM-02 | Roster / Shift Schedule | SCR-029 | Supervisor | 12 | Core HR > Attendance operations > Roster / Shift Schedule (SCR-029) | roster_schedule | /api/v1/ops/modules/roster_schedule/records |
| FRM-TIM-03 | Check In / Check Out | SCR-020 | Employee | 10 | Core HR > Attendance operations > Check in and check out (SCR-020) | check_in_out | /api/v1/attendance/punches |
| FRM-TIM-04 | Attendance Day Detail and Override | SCR-022 | Supervisor, HR | 22 | Core HR > Attendance operations > Attendance day detail (SCR-022) | attendance_detail | /api/v1/ops/modules/attendance_detail/records |
| FRM-TIM-05 | Attendance Regularisation Request | SCR-021 | Employee | 12 | Core HR > Attendance operations > My attendance history (SCR-021) | my_attendance | /api/v1/attendance/days |
| FRM-TIM-06 | Gate Pass | SCR-023 | Employee, Approver | 12 | Core HR > Attendance operations > Gate pass register (SCR-023) | gate_passes | /api/v1/gate-passes |
| FRM-TIM-07 | Overtime Register and Approval | SCR-024 | Supervisor, Payroll | 11 | Core HR > Attendance operations > Overtime register (SCR-024) | overtime_register | /api/v1/ot-requests |
| FRM-TIM-08 | Attendance Exception Resolution | SCR-025 | Supervisor, HR | 8 | Core HR > Attendance operations > Attendance exception queue (SCR-025) | attendance_exceptions | /api/v1/regularizations |

## 2. Field specifications

### FRM-TIM-01 — Shift Master (SCR-028)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Shift | Shift code | shift_code | Text | Char(10) | Y | — | Unique per tenant | — | HR | — |
| Shift | Shift name | shift_name | Text | Char(60) | Y | — | — | — | All | Shown on rosters and attendance screens |
| Shift | Shift group | shift_group | Lookup | Ref | Y | — | Active group | — | HR | Inference only operates inside the group |
| Shift | Start time | start_time | Time | Time | Y | — | — | — | All | — |
| Shift | End time | end_time | Time | Time | Y | — | — | — | All | End before start means the shift crosses midnight |
| Shift | Crosses midnight | crosses_midnight | Toggle (derived) | Bool | — | Computed | — | — | All | Attendance day keys on the SHIFT start date |
| Shift | Shift hours | shift_hours | Number (derived) | Dec(4,2) | — | End minus start minus unpaid breaks | — | — | All | — |
| Shift | Earliest in | earliest_in | Time | Time | Y | Start minus 2h | Windows must not overlap inside a group | — | HR | Overlap blocks save |
| Shift | Latest in | latest_in | Time | Time | Y | Start plus 4h | — | — | HR | — |
| Shift | Grace period (minutes) | grace_minutes | Number | Int | Y | 10 | 0-60 | — | HR | Grace exemption lives on the band, never per person |
| Shift | Half day below (minutes) | half_day_below_minutes | Number | Int | Y | 240 | — | — | HR | — |
| Shift | Absent below (minutes) | absent_below_minutes | Number | Int | Y | 120 | Must be less than half-day threshold | — | HR | — |
| Shift | Break 1 start / end | break1_start, break1_end | Time | Time | N | — | Inside the shift window | — | HR | — |
| Shift | Break 1 paid | break1_paid | Toggle | Bool | Y | No | — | — | HR | This client records breaks but does not deduct them |
| Shift | Break 2 start / end | break2_start, break2_end | Time | Time | N | — | Inside the shift window | — | HR | — |
| Shift | Break 2 paid | break2_paid | Toggle | Bool | Y | Yes | — | — | HR | — |
| Shift | Overtime basis | ot_basis | Select | Char(10) | Y | Net | Gross / Net | PL_OT_BASIS | HR | Basis must be stated on screen, never assumed |
| Shift | Overtime starts after (minutes) | ot_after_minutes | Number | Int | Y | Shift hours | — | — | HR | — |
| Shift | Night shift allowance eligible | night_allowance_eligible | Toggle | Bool | Y | No | — | — | HR, Payroll | Raises a payroll input per qualifying day |
| Shift | Status | status | Select | Char(12) | Y | Active | — | PL_ACTIVE_STATUS | HR | — |

### FRM-TIM-02 — Roster / Shift Schedule (SCR-029)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Scope | Location | location_id | Lookup | Ref | Y | User's location | Within location grant | — | Supervisor | — |
| Scope | Org unit / section | org_unit | Lookup | Ref | Y | — | Active | — | Supervisor | — |
| Scope | Period from / to | period_from, period_to | Date range | Date | Y | Next month | Max 62 days per publish | — | Supervisor | — |
| Roster | Employee | person_id | Lookup (grid row) | Ref | Y | — | Active assignment at the location | — | Supervisor | Grid: one row per person, one column per date |
| Roster | Date | roster_date | Date (grid column) | Date | Y | — | Inside the period | — | Supervisor | — |
| Roster | Shift | shift_code | Select (grid cell) | Ref | Y | Default shift | Must belong to the person's shift group | — | Supervisor | Blank cell means rest day |
| Roster | Day type override | day_type_override | Select | Char(15) | N | — | Working / Rest / Holiday | PL_DAY_TYPE | Supervisor | Overrides the location calendar for this person |
| Roster | Weekly rest day check | rest_days_in_week | Number (derived) | Int | — | Computed | Must satisfy the statutory minimum | — | Supervisor | Publish blocked if a person has no rest day in a week |
| Roster | Consecutive working days | consecutive_days | Number (derived) | Int | — | Computed | Warn above 6 | — | Supervisor | — |
| Publish | Publish status | publish_status | Select | Char(12) | Y | Draft | Draft / Published | PL_PUBLISH_STATUS | Supervisor | Republishing a past date queues a recompute |
| Publish | Notify employees | notify_on_publish | Toggle | Bool | Y | Yes | — | — | Supervisor | Push plus business messaging where enabled |
| Publish | Change reason | publish_reason | Text | Char(200) | Y on republish | — | Min 10 chars | — | Supervisor | — |

### FRM-TIM-03 — Check In / Check Out (SCR-020)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Punch | Direction | direction | Button | Char(3) | Y | Inferred from last punch | IN / OUT | PL_PUNCH_DIRECTION | Self | Unpaired punches go to the exception queue, never auto-corrected |
| Punch | Punch timestamp | punch_ts | Timestamp | Timestamp | Y | Device clock | Signed at capture; stored UTC | — | Self | Immutable once written |
| Punch | Capture source | source | Text (derived) | Char(15) | Y | From channel | Biometric / Mobile / Kiosk / business messaging / Web | PL_PUNCH_SOURCE | Self | — |
| Punch | Device / terminal ID | device_id | Text (derived) | Char(30) | Y for device punches | — | Registered device | — | Self | — |
| Punch | Location (lat, long) | punch_geo | Geo | Dec(9,6) | Y for mobile | Device GPS | Inside the geofence or flagged | — | Self | Outside-geofence punch is accepted and flagged, not blocked |
| Punch | Geofence result | geofence_result | Text (derived) | Char(15) | Y for mobile | Computed | Inside / Outside / Unavailable | PL_GEOFENCE_RESULT | Self, supervisor | — |
| Punch | Selfie | selfie_ref | File | Ref | Y where the site requires it | — | JPG, max 2 MB | — | Self, supervisor | Liveness check where enabled |
| Punch | Work order / job code | job_code | Lookup | Ref | N | — | Active job | — | Self | Only where job costing is on |
| Punch | Offline queue flag | is_offline_queued | Toggle (derived) | Bool | — | System | — | — | Self | Queued with a signed timestamp, synced when online |
| Punch | Remarks | punch_remark | Text | Char(120) | N | — | — | — | Self | — |

### FRM-TIM-04 — Attendance Day Detail and Override (SCR-022)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Attendance date | attendance_date | Date (read-only) | Date | Y | — | — | — | Supervisor, HR | The SHIFT start date, not the punch calendar date |
| Header | Employee | person_id | Lookup (read-only) | Ref | Y | — | — | — | Supervisor, HR | — |
| Header | Shift assigned / applied | shift_id_assigned, shift_id_applied | Text (read-only) | Ref | Y | — | — | — | Supervisor, HR | Difference plus reason shown prominently |
| Header | Day type | day_type | Text (read-only) | Char(15) | Y | From calendar and roster | — | PL_DAY_TYPE | Supervisor, HR | — |
| Totals | First in / last out | first_in, last_out | Time (read-only) | Time | Y | — | — | — | Supervisor, HR | — |
| Totals | Gross minutes | gross_minutes | Number (read-only) | Int | Y | — | — | — | Supervisor, HR | Shown in h:mm as well as minutes |
| Totals | Break minutes | break_minutes | Number (read-only) | Int | Y | — | — | — | Supervisor, HR | — |
| Totals | Gate pass minutes | gate_pass_minutes | Number (read-only) | Int | Y | — | — | — | Supervisor, HR | — |
| Totals | Net minutes | net_minutes | Number (read-only) | Int | Y | — | — | — | Supervisor, HR | — |
| Totals | Overtime minutes and basis | ot_minutes_payable, ot_basis | Number (read-only) | Int/Char | Y | — | — | — | Supervisor, HR | Basis label must be visible, not assumed |
| Disposition | Status | status | Text (read-only) | Char(20) | Y | Computed | — | PL_ATTENDANCE_STATUS | Supervisor, HR | Present, half day, absent, weekly off, holiday, on leave |
| Disposition | Rules applied | applied_rule_ids | Text (read-only) | Char[] | Y | Computed | — | — | Supervisor, HR | Status without its rule trail is unarguable |
| Disposition | Late by / instance no / beyond allowance | late_by_minutes, late_instance_no, late_beyond_allowance | Number (read-only) | Int | Y | Computed | — | — | Supervisor, HR | Visible to the employee too |
| Disposition | Early going minutes | early_out_minutes | Number (read-only) | Int | Y | Computed | — | — | Supervisor, HR | — |
| Segments | Segment list (in, out, minutes) | attendance_segment[] | Table (read-only) | Composite | Y | Computed | — | — | Supervisor, HR | One row per paired in/out |
| Breaks | Break list (type, minutes, paid) | attendance_break[] | Table (read-only) | Composite | Y | Computed | — | — | Supervisor, HR | This is the break report the client asked for |
| Provenance | Computed at / ruleset version / source event count | computed_at, ruleset_version, source_event_count | Text (read-only) | Mixed | Y | System | — | — | Supervisor, HR, auditor | Makes a March recomputation defensible |
| Actions | Override shift | override_shift_code | Select | Ref | N | — | Must belong to the group; reason mandatory | — | Per permission | Queues a recompute for the day |
| Actions | Override status | override_status | Select | Char(20) | N | — | Authorised role; reason mandatory | PL_ATTENDANCE_STATUS | HR only | Delta recorded, never a silent overwrite |
| Actions | Override reason | override_reason | Text | Char(300) | Y on any override | — | Min 10 chars | — | Per permission | Every action logged with actor and reason |
| Actions | Recompute | recompute_trigger | Button | — | — | — | Blocked inside a locked payroll period | — | Per permission | Locked periods produce arrears, not rewrites |
| Pay | Rate / salary / OT amount | salary_structure.* | Money (read-only) | Dec(12,2) | — | — | — | — | NULL outside the payroll group grant | Returns NULL, not zero, outside the grant |

### FRM-TIM-05 — Attendance Regularisation Request (SCR-021)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Request | Attendance date | regularisation_date | Date | Date | Y | — | Inside the open attendance period | — | Self | Closed periods are not regularisable |
| Request | Current status | current_status | Text (read-only) | Char(20) | — | From attendance day | — | — | Self | — |
| Request | Regularisation type | regularisation_type | Select | Char(25) | Y | — | From list | PL_REGULARISATION_TYPE | Self | Missing punch, wrong shift, on duty, work from home, late waiver |
| Request | Requested in time | requested_in_time | Time | Time | Y for punch corrections | — | Inside the shift window | — | Self | — |
| Request | Requested out time | requested_out_time | Time | Time | Y for punch corrections | — | After in time | — | Self | — |
| Request | Reason | reason | Text | Char(300) | Y | — | Min 15 chars | — | Self | — |
| Request | Supporting document | document_ref | File | Ref | N | — | PDF/JPG, max 5 MB | — | Self | Mandatory for on-duty claims where configured |
| Context | Regularisations used this month | used_this_month | Number (derived) | Int | — | Computed | — | — | Self | Monthly cap shown before submission |
| Context | Monthly cap | monthly_cap | Number (derived) | Int | — | From rule set | — | — | Self | Cap breach blocks submission with the rule named |
| Approval | Approver | approver_id | Lookup (derived) | Ref | Y | Reporting manager | From the approval chain | — | Self | — |
| Approval | Decision | decision | Select | Char(12) | Y | — | Approve / Reject | PL_DECISION | Approver | — |
| Approval | Decision remarks | decision_remarks | Text | Char(300) | Y on reject | — | Min 10 chars | — | Approver | Approval queues a recompute of that day |

### FRM-TIM-06 — Gate Pass (SCR-023)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Request | Date | date | Date | Date | Y | Today | Within the open attendance period | — | Self | — |
| Request | From time | from_ts | Time | Time | Y | — | Inside the shift window | — | Self | — |
| Request | To time | to_ts | Time | Time | Y | — | After from; within the remaining ceiling | — | Self | — |
| Request | Duration (minutes) | duration_minutes | Number (derived) | Int | — | Computed | — | — | Self | — |
| Request | Type | pass_type | Select | Char(15) | Y | Personal | Personal / Official | PL_GATE_PASS_TYPE | Self | Official does not consume the personal ceiling |
| Request | Reason | reason | Text | Char(200) | Y | — | Min 5 chars | — | Self | — |
| Request | Expected return | expected_return_ts | Time | Time | N | Same as to time | — | — | Self | — |
| Context | Minutes used this month | minutes_used_month | Number (derived) | Int | — | Computed | — | — | Self | 240 minutes for this client |
| Context | Instances used this month | instances_used_month | Number (derived) | Int | — | Computed | — | — | Self | 2 instances for this client |
| Approval | Approver | approver_id | Lookup (derived) | Ref | Y | Reporting manager | From the approval chain | — | Self | Approvable from business messaging |
| Approval | Decision / remarks | decision, decision_remarks | Select + text | Mixed | Y | — | Reason mandatory on reject | PL_DECISION | Approver | — |
| Gate | Actual out / in scan | actual_out_ts, actual_in_ts | Timestamp | Timestamp | N | Security gate scan | — | — | Security, HR | Overstay is flagged against net minutes |

### FRM-TIM-07 — Overtime Register and Approval (SCR-024)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Filter | Location / org unit / period | location_id, org_unit, period | Filters | Mixed | Y | User scope, current period | Inside the grant | — | Supervisor | — |
| Record | Employee | person_id | Lookup (read-only) | Ref | Y | — | — | — | Supervisor | — |
| Record | Date / day type | date, day_type | Read-only | Mixed | Y | — | — | PL_DAY_TYPE | Supervisor | Rest day and holiday OT carry different multipliers |
| Record | Eligibility basis | ot_eligibility_basis | Text (read-only) | Char(40) | Y | From class or override | — | — | Supervisor | Basis shown per row, never inferred |
| Record | OT minutes raw | ot_minutes_raw | Number (read-only) | Int | Y | Computed | — | — | Supervisor | — |
| Record | OT minutes payable | ot_minutes_payable | Number | Int | Y | Same as raw | Cannot exceed raw | — | Supervisor | Supervisor may reduce, never increase |
| Record | Multiplier | ot_multiplier | Number (read-only) | Dec(3,2) | Y | From rule pack | — | — | Supervisor, Payroll | Statutory minimum enforced by the rule pack |
| Record | Reduction reason | reduction_reason | Text | Char(200) | Y if reduced | — | Min 10 chars | — | Supervisor | — |
| Record | Statutory cap check | weekly_ot_cap_status | Text (derived) | Char(20) | — | Computed | Within / Breach | PL_CAP_STATUS | Supervisor, Compliance | Breach is flagged, approval still possible with reason |
| Action | Approve / reject | decision | Button | Char(12) | Y | — | Bulk action allowed | PL_DECISION | Supervisor | — |
| Action | Tag to payroll run | tagged_run_id | Lookup | Ref | Y before run lock | — | Open run of the right type | — | Payroll | Untagged OT does not reach payroll |

### FRM-TIM-08 — Attendance Exception Resolution (SCR-025)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Exception | Exception type | exception_type | Text (read-only) | Char(30) | Y | System | — | PL_EXCEPTION_TYPE | Supervisor, HR | Unpaired punch, missing day, device failure, inferred shift, geofence breach |
| Exception | Employee / date | person_id, date | Read-only | Mixed | Y | — | — | — | Supervisor, HR | — |
| Exception | Severity | severity | Text (read-only) | Char(10) | Y | System | Critical / Warning / Info | PL_SEVERITY | Supervisor, HR | Critical blocks the period lock |
| Exception | System proposal | proposed_resolution | Text (read-only) | Char(300) | N | Agent draft | — | — | Supervisor, HR | A proposal, never an applied change |
| Resolution | Action | resolution_action | Select | Char(25) | Y | — | Accept proposal / Amend / Reject / Escalate | PL_EXCEPTION_ACTION | Supervisor, HR | — |
| Resolution | Amended value | amended_value | Mixed | Char(100) | Y if amending | — | Type-dependent | — | Supervisor, HR | — |
| Resolution | Reason | resolution_reason | Text | Char(300) | Y | — | Min 10 chars | — | Supervisor, HR | — |
| Resolution | Bulk apply to selection | bulk_apply | Toggle | Bool | N | Off | Same type and same reason only | — | Supervisor, HR | Bulk resolution still writes one audit row per record |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACTIVE_STATUS | Record status | System | 2 | Active · Inactive |
| PL_ATTENDANCE_STATUS | Attendance day status | System | 9 | Present · Half day · Absent · Weekly off · Holiday · On leave · On duty · Work from home · Not scheduled |
| PL_CAP_STATUS | Statutory cap status | System | 3 | Within limit · Approaching limit · Breach |
| PL_DAY_TYPE | Day type | System | 4 | Working day · Weekly off / rest day · Holiday · National holiday |
| PL_DECISION | Approval decision | System | 4 | Approve · Reject · Return for correction · Delegate |
| PL_EXCEPTION_ACTION | Exception resolution action | System | 4 | Accept proposal · Amend · Reject · Escalate |
| PL_EXCEPTION_TYPE | Attendance exception type | System | 8 | Unpaired punch · Missing attendance day · Device failure · Shift inferred · Geofence breach · Duplicate punch · Punch outside roster · Late beyond allowance |
| PL_GATE_PASS_TYPE | Gate pass type | Config | 2 | Personal · Official |
| PL_GEOFENCE_RESULT | Geofence result | System | 3 | Inside · Outside · Unavailable |
| PL_OT_BASIS | Overtime basis | Config | 2 | Gross minutes · Net minutes |
| PL_PUBLISH_STATUS | Roster publish status | System | 2 | Draft · Published |
| PL_PUNCH_DIRECTION | Punch direction | System | 2 | IN · OUT |
| PL_PUNCH_SOURCE | Punch source | System | 6 | Biometric device · Mobile app · Kiosk · business messaging · Web · Manual (regularised) |
| PL_REGULARISATION_TYPE | Regularisation type | Config | 6 | Missing punch · Wrong shift applied · On duty · Work from home · Late waiver · Device failure |
| PL_SEVERITY | Severity | System | 3 | Critical · Warning · Info |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-ATT-01 | Daily Attendance Processing | ATT | Processing screen | R-01, R-05, R-12, R-13 | Pairs punches, computes gross and net hours, applies the shift thresholds and produces the day status. | N | Daily attendance register | 15 |
| F-ATT-02 | Punch Register | ATT | Enquiry | R-01 | Raw punch pairs for a date range, including pairs that cross midnight. | N | Punch register | 0 |
| F-ATT-03 | Break Register | ATT | Report | R-01 | Every intermediate break — the gap between an OUT and the next IN inside a work session — with its duration. | N | Break register | 9 |
| F-ATT-04 | Attendance Regularisation | ATT | Transaction form | R-01, R-06, R-12 | Corrects a day status, including marking present the days an employee returned early from leave. | N | Approval trail | 0 |
| F-ATT-05 | Team Calendar | ATT | Workbench | R-02 | A manager's view of the team. Gains a from and to date range, per-member history and an export. | N | Team attendance report | 5 |
| F-ATT-06 | Grace & Late Policy Setup | ATT | Configuration | R-13 | Grace minutes, the number of lates allowed in a month, the consequence from the next late, and the grade exempt from it. | N | Policy print | 6 |
| F-SHF-01 | Shift Master | SHF | Master form | R-01, R-13, R-14 | Shift timings plus the half-day and absent thresholds for that shift length, and the in-punch window used to detect it. | N | Shift register | 10 |
| F-SHF-02 | Shift Roster | SHF | Transaction form | R-14 | The planned shift per employee per day, which auto-detection may override. | N | Roster print | 0 |
| F-SHF-03 | Night Extension Rule Setup | SHF | Configuration | R-13 | The rule that lets an employee who worked past midnight report late the next day and still be paid a full day. | N | Policy print | 6 |
| F-OTM-01 | OT Computation & Approval | OTM | Processing screen | R-01, R-05, R-11 | Derives OT from gross hours less shift hours, respecting the employee OT eligibility basis. | N | OT statement | 3 |
| F-OTM-02 | OT Payment Run | OTM | Processing screen | R-11 | A payment run separate from payroll, with its own period and its own posting. | N | OT payment register | 3 |
| F-GPS-01 | Gate Pass Request | GPS | Transaction form | R-12 | Personal gate pass against a monthly entitlement, with the approved duration credited to work hours. | N | Gate pass slip | 5 |

#### F-ATT-01 — Daily Attendance Processing

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Identity | Attendance date | attendance_date | Date | Date | Y | — | The day a work session is attributed to. A session beginning 08:00 and ending 03:20 belongs to the start date. | — | All roles | No — system derived | R-01 |
| Header | Shift | Rostered shift | rostered_shift_code | Lookup | Ref | Y | From the shift roster | — | — | All roles | Yes | R-14 |
| Header | Shift | Detected shift | detected_shift_code | Lookup (derived) | Ref | Y | Derived from the first in-punch | Where it differs from the rostered shift the detected shift governs and the difference is recorded | — | All roles | No — system derived | R-14 |
| Header | Shift | Shift override reason | shift_override_reason | Text | Char(200) | Y when the detected shift differs from the rostered shift | — | Auto-populated as "Detected from in-punch" when the system overrides; manual override requires a typed reason | — | All roles | No — system derived | R-14 |
| Header | Hours | First in punch | first_in_time | Time (derived) | DateTime | Y | — | The earliest IN of the session | — | All roles | No — system derived | R-01 |
| Header | Hours | Last out punch | last_out_time | Time (derived) | DateTime | Y | — | The latest OUT of the session, which may fall on the following calendar date | — | All roles | No — system derived | R-01 |
| Header | Hours | Gross work hours | gross_work_hours | Number (derived) | Dec(6,2) | Y | — | Last out less first in. For the worked example this is 19:20 and it includes the dinner break. | — | All roles | No — system derived | R-01 |
| Header | Hours | Total break minutes | total_break_minutes | Number (derived) | Int(4) | Y | — | The sum of the gaps between an OUT and the next IN within the session. Reported, and per the source not deducted from gross hours. | — | All roles | No — system derived | R-01 |
| Header | Hours | Net work hours | net_work_hours | Number (derived) | Dec(6,2) | Y | — | Gross hours less any break the policy says to deduct, plus approved gate pass hours. This is the figure the half-day and absent thresholds compare against. | — | All roles | No — system derived | R-01, R-12, R-13 |
| Header | Hours | Approved gate pass hours | gatepass_hours_credited | Number (derived) | Dec(4,2) | Y | 0.00 | Only from an approved gate pass. A pending pass credits nothing. | — | All roles | No — system derived | R-12 |
| Header | Overtime | OT hours | ot_hours | Number (derived) | Dec(6,2) | Y | — | Gross work hours less shift hours, and zero where the employee's OT eligibility basis does not cover the day type. For the worked example, 19:20 less 12:00 is 7:20. | — | All roles | No — system derived | R-01, R-05 |
| Header | Status | Day status | day_status | Select (derived) | Char(20) | Y | — | Present, Half day, Absent, Weekly off, Holiday, On leave. Derived from net hours against the shift thresholds and then the late-mark rule. | EN_DAY_STATUS | All roles | No — system derived | R-13 |
| Header | Status | Late mark applied | late_mark_applied | Toggle (derived) | Bool | Y | N | Y where arrival is beyond the grace window and the employee is not grade-exempt | — | All roles | No — system derived | R-13 |
| Header | Status | Late count in month | late_count_in_month | Number (derived) | Int(2) | Y | 0 | Resets on the first of each calendar month. From the fourth late the day status becomes Half day. | — | All roles | No — system derived | R-13 |
| Header | Status | Night extension applied | night_extension_applied | Toggle (derived) | Bool | Y | N | Y where the previous session ran past the configured hour and this day's late arrival is therefore not penalised | — | All roles | No — system derived | R-13 |

#### F-ATT-03 — Break Register

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Filter | From date | from_date | Date | Date | Y | First day of the current month | Not later than to_date | — | All roles | No — system derived | R-01 |
| Header | Filter | To date | to_date | Date | Date | Y | Today | Not earlier than from_date | — | All roles | No — system derived | R-01 |
| Line | Breaks | Employee code | employee_code | Lookup | Ref | Y | — | — | — | All roles | No — system derived | R-01 |
| Line | Breaks | Attendance date | attendance_date | Date | Date | Y | — | — | — | All roles | No — system derived | R-01 |
| Line | Breaks | Break sequence | break_seq | Number | Int(2) | Y | — | Sequential within the session | — | All roles | No — system derived | R-01 |
| Line | Breaks | Break start | break_start_time | Time | DateTime | Y | — | The OUT punch that opens the break | — | All roles | No — system derived | R-01 |
| Line | Breaks | Break end | break_end_time | Time | DateTime | Y | — | The next IN punch | — | All roles | No — system derived | R-01 |
| Line | Breaks | Break minutes | break_minutes | Number (derived) | Int(4) | Y | — | For the worked example, 20:30 to 21:15 is 45 | — | All roles | No — system derived | R-01 |
| Line | Breaks | Break type | break_type | Select | Char(20) | Y | Unclassified | Meal, Personal, Gate pass or Unclassified. A break overlapping an approved gate pass classifies as Gate pass. | EN_BREAK_TYPE | All roles | Yes — value set configurable per tenant | R-01 |

#### F-ATT-05 — Team Calendar

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Filter | From date | filter_from_date | Date | Date | Y | First day of the current month | Not later than filter_to_date. The range must not be capped to a single month. | — | All roles | No — system derived | R-02 |
| Header | Filter | To date | filter_to_date | Date | Date | Y | Last day of the current month | Not earlier than filter_from_date | — | All roles | No — system derived | R-02 |
| Header | Filter | Team member | filter_employee_code | Lookup | Ref | N | All reportees | The list is scoped to the logged-in manager's reporting line only. A manager must not be able to select outside it. | — | Reporting manager and above | No — system derived | R-02 |
| Header | Filter | Include indirect reportees | include_indirect | Toggle | Bool | Y | N | Where Y, the whole reporting subtree is included rather than direct reportees only | — | Reporting manager and above | Yes | R-02 |
| Control | Output | Export team history | export_team_history | Action | Composite | N | — | Produces the team attendance report for the selected range and member, respecting the same data scope as the screen | — | Reporting manager and above | No — system derived | R-02 |

#### F-ATT-06 — Grace & Late Policy Setup

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Grace | Grace minutes on arrival | grace_minutes_in | Number | Int(3) | Y | 15 | Between 0 and 120 | — | HR roles only | Yes — default 15 per the stated policy | R-13 |
| Header | Grace | Grace minutes on departure | grace_minutes_out | Number | Int(3) | Y | 15 | Between 0 and 120 | — | HR roles only | Yes — default 15 per the stated policy | R-13 |
| Header | Late marks | Lates allowed per month | lates_allowed_per_month | Number | Int(2) | Y | 3 | Between 0 and 31 | — | HR roles only | Yes — default 3 per the stated policy | R-13 |
| Header | Late marks | Consequence beyond the allowance | late_consequence | Select | Char(20) | Y | Half day | Half day, Leave deduction or Warning only. The source states half day. | EN_LATE_CONSEQUENCE | HR roles only | Yes — value set configurable per tenant | R-13 |
| Header | Late marks | Counter reset basis | late_counter_reset | Select | Char(20) | Y | Calendar month | Calendar month or Payroll month. These differ where the payroll cycle is not the calendar month. | EN_COUNTER_RESET | HR roles only | Yes — value set configurable per tenant | R-13 |
| Header | Exemption | Exempt from grade rank | exempt_from_grade_rank | Number | Int(3) | Y | Assistant Manager rank | Employees at or above this rank are not penalised for late arrival | — | HR roles only | Yes | R-13 |

#### F-SHF-01 — Shift Master

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Identity | Shift code | shift_code | Text | Char(10) | Y | — | Unique within the tenant | — | All roles | Yes | R-13, R-14 |
| Header | Timing | Shift start time | shift_start_time | Time | Time | Y | — | — | — | All roles | Yes | R-13 |
| Header | Timing | Shift end time | shift_end_time | Time | Time | Y | — | May fall on the next day; the shift duration must be derived, not typed | — | All roles | Yes | R-13 |
| Header | Timing | Shift duration hours | shift_duration_hours | Number (derived) | Dec(4,2) | Y | — | End less start, handling the midnight crossing | — | All roles | No — system derived | R-01, R-13 |
| Header | Thresholds | Half day threshold hours | half_day_threshold_hours | Number | Dec(4,2) | Y | Per the shift length | Net hours below this and at or above the absent threshold produce a half day. 11.50 for a 12-hour shift, 9.50 for 10, 8.50 for 9, 7.50 for 8. | — | All roles | Yes — configuration, not code | R-13 |
| Header | Thresholds | Absent threshold hours | absent_threshold_hours | Number | Dec(4,2) | Y | Per the shift length | Net hours below this produce Absent. 6.50 for a 12-hour shift, 6.00 for 10, 5.00 for 9, 4.50 for 8. | — | All roles | Yes — configuration, not code | R-13 |
| Header | Detection | Detection window from | detect_window_from | Time | Time | Y when auto-detection is on | — | The earliest in-punch that resolves to this shift | — | All roles | Yes | R-14 |
| Header | Detection | Detection window to | detect_window_to | Time | Time | Y when auto-detection is on | — | The latest in-punch that resolves to this shift. Windows across shifts must not overlap — validate on save. | — | All roles | Yes | R-14 |
| Header | Detection | Auto detect enabled | auto_detect_enabled | Toggle | Bool | Y | Y | — | — | All roles | Yes | R-14 |
| Header | Overtime | OT starts after hours | ot_starts_after_hours | Number | Dec(4,2) | Y | Shift duration | The base the OT calculation subtracts. For the worked example this is 12.00. | — | All roles | Yes | R-01 |

#### F-SHF-03 — Night Extension Rule Setup

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Rule | Applies to shift | applies_to_shift_code | Lookup | Ref | Y | — | The source names A shift | — | HR roles only | Yes | R-13 |
| Header | Rule | Triggered when previous session ends after | trigger_after_time | Time | Time | Y | 03:00 | The source gives 03:00 or 04:00 as the trigger | — | HR roles only | Yes | R-13 |
| Header | Rule | Permitted late arrival until | permitted_arrival_until | Time | Time | Y | 09:30 | The source permits 09:00 or 09:30 | — | HR roles only | Yes | R-13 |
| Header | Rule | Minimum departure time to qualify | min_departure_time | Time | Time | Y | 20:00 | The source requires work until 20:00 for the full day to stand | — | HR roles only | Yes | R-13 |
| Header | Rule | Day status when the rule applies | resulting_day_status | Select | Char(20) | Y | Present | Full day, per the source, with no late mark and no grace deduction | EN_DAY_STATUS | HR roles only | Yes — value set configurable per tenant | R-13 |
| Header | Rule | Maximum uses per month | max_uses_per_month | Number | Int(2) | N | — | The source does not state a limit. Leaving this blank means unlimited; see the open questions. | — | HR roles only | Yes | R-13 |

#### F-OTM-01 — OT Computation & Approval

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Eligibility | Day type | day_type | Select (derived) | Char(20) | Y | — | Working day, Rest day or Holiday. Where the employee basis is rest days and holidays only, a working day yields no OT. | EN_DAY_TYPE | All roles | No — system derived | R-05 |
| Header | Computation | OT basis hours | ot_basis_hours | Number (derived) | Dec(6,2) | Y | Gross work hours | The source computes OT on gross hours, so the dinner break is not deducted. Confirm before release. | — | All roles | Yes | R-01 |
| Header | Computation | OT hours payable | ot_hours_payable | Number (derived) | Dec(6,2) | Y | — | OT basis hours less the shift OT threshold, floored at zero | — | All roles | No — system derived | R-01 |

#### F-OTM-02 — OT Payment Run

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Run | OT period from | ot_period_from | Date | Date | Y | — | Independent of the payroll period | — | Payroll and HR roles only | Yes | R-11 |
| Header | Run | OT period to | ot_period_to | Date | Date | Y | — | Not earlier than ot_period_from | — | Payroll and HR roles only | Yes | R-11 |
| Header | Run | Linked payroll run | linked_payroll_run_ref | Lookup | Ref | Y | — | The salary run this OT follows. The run must refuse to execute before that payroll run is closed. | — | Payroll and HR roles only | No — system derived | R-11 |

#### F-GPS-01 — Gate Pass Request

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Request | Gate pass type | gatepass_type | Select | Char(20) | Y | Personal | Personal or Official. Only Personal consumes the monthly entitlement. | EN_GATEPASS_TYPE | All roles | Yes — value set configurable per tenant | R-12 |
| Header | Request | Duration hours | gatepass_hours | Number | Dec(4,2) | Y | — | Sum of approved personal passes in a month must not exceed gatepass_hours_per_month | — | All roles | No — system derived | R-12 |
| Header | Validation | Passes used this month | passes_used_this_month | Read-only | Int(2) | Y | — | Blocks submission once gatepass_count_per_month is reached | — | All roles | No — system derived | R-12 |
| Header | Validation | Hours remaining this month | hours_remaining_this_month | Read-only | Dec(4,2) | Y | — | — | — | All roles | No — system derived | R-12 |
| Control | Effect | Credit to work hours on approval | credit_to_work_hours | Toggle | Bool | Y | Y | Approved duration is added to net work hours for the day. A rejected or pending pass credits nothing. | — | All roles | Yes | R-12 |

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
| Size | 204 | specified items (table rows) | Counted automatically at generation |
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
