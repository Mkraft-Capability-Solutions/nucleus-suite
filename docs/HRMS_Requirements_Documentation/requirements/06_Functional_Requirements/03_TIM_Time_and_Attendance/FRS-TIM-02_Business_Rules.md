<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-02 — Time & Attendance — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-02 |
| Title | Time & Attendance — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Time — Ingestion And Derivation

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-070 | A punch is captured from any enrolled source and stored immutably. | source set | Biometric, mobile, business messaging, kiosk, web, gate | Config | TIM-01.1 | TC-T70 |
| RL-071 | Offline punches are queued locally with a signed timestamp and replayed on reconnect. | queue_ttl | 7 days | Config | TIM-01.1, TIM-01.2 | TC-T71 |
| RL-072 | Device clock drift is corrected using the device's last sync offset; the raw value is retained alongside the correction. | max_drift_ms | ±120000 | Config | TIM-01.2 | TC-T72 |
| RL-073 | Duplicate punches inside the dedupe window are marked, not discarded. | dedupe_window_s | 60 | Config | TIM-01.3 | TC-T73 |
| RL-074 | Every landed punch queues the affected attendance day for derivation. | — | Always | Code invariant | TIM-01.4 | TC-T74 |
| RL-075 | A punch arriving for a locked payroll period raises an exception instead of changing the locked day. | — | Enforced | Code invariant | TIM-01.4, TIM-09.4 | TC-T75 |
| RL-080 | An attendance day is keyed on the date the SHIFT started, not the calendar date of the punch. | — | Always | Code invariant | TIM-02.1 | TC-T80 (demo point 1) |
| RL-081 | Events inside the day window are ordered by timestamp before pairing. | day_window_hours | 30 | Config | TIM-02.2 | TC-T81 |
| RL-082 | IN pairs to the next OUT; an unpaired event raises an exception and is never discarded. | — | Enforced | Code invariant | TIM-02.3 | TC-T82 |
| RL-083 | Every gap between consecutive segments is written as a break row with a type and a paid flag. | break types | meal, gate_pass, other | Config | TIM-02.4 | TC-T83 (demo point 1) |
| RL-084 | gross_minutes = last_out − first_in. | — | Always | Code invariant | TIM-02.5 | TC-T84 |
| RL-085 | Whether recorded breaks are deducted from net is tenant configuration. | deduct_breaks | NO for this client (gate-to-gate) | attendance_rule_set | TIM-02.6 | TC-T85 |
| RL-086 | Approved personal gate-pass minutes are credited back into work hours before disposition thresholds are applied. | — | Enforced | Code invariant | TIM-02.7, TIM-06.4 | TC-T86 (demo point 11) |
| RL-087 | Overtime = max(0, basis_minutes − shift_minutes), where basis is gross or net per tenant configuration. | ot_basis | GROSS for this client | attendance_rule_set | TIM-02.8 | TC-T87 |
| RL-088 | Every attendance day stores computed_at and the ruleset version that produced it. | — | Always | Code invariant | TIM-02.9 | TC-T88 |
| RL-089 | Recomputation writes an audit delta; recomputing an unchanged day produces an identical row and no delta. | — | Idempotent | Code invariant | TIM-02.10 | TC-T89 |

### Time — Shift, Day Type And Disposition

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-090 | The assigned shift comes from the published roster, falling back to the assignment default. | — | Roster first | Code invariant | TIM-03.1 | TC-T90 |
| RL-091 | Inference windows must not overlap within a shift group; overlapping configuration fails validation at save. | earliest_in, latest_in | Per shift | shift_window | TIM-03.2 | TC-T91 |
| RL-092 | Where the in-punch falls in another shift's window inside the group, that shift is adopted, with assigned and inferred both recorded. | — | Adopt + record | Code invariant | TIM-03.3 | TC-T92 (demo point 13) |
| RL-093 | An HR override of an inferred shift is logged with actor and reason. | — | Logged | Code invariant | TIM-03.4 | TC-T93 |
| RL-094 | Threshold lookup uses the APPLIED shift's duration, not the assigned shift's. | — | Applied | Code invariant | TIM-03.5, TIM-05.2 | TC-T94 |
| RL-100 | Day type is resolved from the location's work and holiday calendar. | — | Per location | work_calendar | TIM-04.1 | TC-T100 |
| RL-101 | The worker class's rest-day policy overlays the calendar. | has_rest_days, rest_day_pattern | Sunday weekly off, or none | worker_class | TIM-04.2 | TC-T101 (demo point 2) |
| RL-102 | Policy attaches to worker class, never to the contractor engagement. | — | Class is the unit of policy | Code invariant | TIM-04.3 | TC-T102 (demo point 3) |
| RL-103 | Day type is written before thresholds are applied. | — | Order enforced | Code invariant | TIM-04.4 | TC-T103 |
| RL-110 | On a non-working day type, thresholds are skipped and status reflects the day type. | — | Skip | Code invariant | TIM-05.1 | TC-T110 |
| RL-111 | Disposition thresholds are looked up by shift duration from a configuration table. | threshold rows | 12h/10h/9h/8h rows | attendance_rule_set | TIM-05.2 | TC-T111 |
| RL-112 | Below the absent threshold the day is Absent. | absent_below_min | 390 / 360 / 300 / 270 | attendance_rule_set | TIM-05.3 | TC-T112 (demo point 12) |
| RL-113 | Below the half-day threshold the day is Half Day. | half_day_below_min | 690 / 570 / 510 / 450 | attendance_rule_set | TIM-05.4 | TC-T113 (demo point 12) |
| RL-114 | Grace applies to both the in and the out punch. | grace_in_min, grace_out_min | 15 and 15 | attendance_rule_set | TIM-05.5 | TC-T114 |
| RL-115 | Grace-exempt bands incur no late instance and no deduction. | grace_exempt | Assistant Manager and above | designation | TIM-05.6 | TC-T115 |
| RL-116 | Late instances are counted per calendar month and the count is visible to the employee. | late_allowance_per_month | 3 forgiven | attendance_rule_set | TIM-05.7 | TC-T116 |
| RL-117 | From the fourth late instance in a month, each late arrival beyond grace marks the day Half Day. | — | 4th onward | attendance_rule_set | TIM-05.8 | TC-T117 (demo point 12) |
| RL-118 | An employee who finished after the long-night hour may arrive within the relief window the next day and still be credited a full day. | long_night_after, relief_until | 03:00 and 09:30 | attendance_rule_set | TIM-05.9 | TC-T118 (demo point 12) |
| RL-119 | The status stores the IDs of the rules that produced it. | — | Always | Code invariant | TIM-05.10 | TC-T119 |

### Time — Gate Pass, Overtime, Exceptions

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-120 | A gate pass carries a type: personal or official. | pass_type | Personal / Official | Config | TIM-06.1 | TC-T120 |
| RL-121 | Personal gate passes are capped per calendar month by total minutes and by instance count. | monthly_minutes, max_instances | 240 minutes, 2 instances | Config | TIM-06.2 | TC-T121 (demo point 11) |
| RL-122 | Approved personal gate-pass minutes are added to work hours; unapproved absence stays deducted. | — | Enforced | Code invariant | TIM-06.4 | TC-T122 |
| RL-123 | Official gate passes are tracked but do not consume the personal ceiling. | — | Excluded | Config | TIM-06.5 | TC-T123 |
| RL-130 | Overtime payability is decided by the resolved ot_eligibility, not by hours alone. | ot_eligibility | always / rest_day_and_holiday_only / none | worker_class + assignment | TIM-07.1 | TC-T130 |
| RL-131 | Eligibility none means zero payable overtime; raw minutes are still retained for reporting. | — | Retain raw | Code invariant | TIM-07.2 | TC-T131 |
| RL-132 | For rest_day_and_holiday_only, weekday overtime is zero and rest-day or holiday working pays the whole span. | — | Enforced | Code invariant | TIM-07.3 | TC-T132 (demo point 4) |
| RL-133 | The overtime multiplier comes from the state rule pack; exceeding statutory weekly limits warns the approver. | multiplier, weekly_limit | 2.0 for this client | rule_pack | TIM-07.4 | TC-T133 |
| RL-134 | Overtime is tagged to the run that will pay it, which may be an off-cycle run. | pay_in_run_id | Off-cycle for this client | payroll_run | TIM-07.6 | TC-Y134 (demo point 10) |
| RL-140 | Exceptions are raised for unpaired punches, missing days, device failure, inferred shifts and threshold crossings. | exception types | Per list | Config | TIM-08.1 | TC-T140 |
| RL-141 | An agent may propose a regularisation but only auto-resolve under the tenant's configured threshold. | auto_threshold_minutes | 120 (illustrative) | Tenant policy | TIM-08.2, INT-01 | TC-A141 |
| RL-142 | An approved regularisation queues recompute and closes the exception. | — | Automatic | Code invariant | TIM-08.4 | TC-T142 |
| RL-150 | The recompute queue carries person, date range and reason. | reasons | 6 reasons listed in TIM-09.1 | Code invariant | TIM-09.1 | TC-T150 |
| RL-151 | Recompute reads every input as at the recompute snapshot, never as at today. | — | Enforced | Code invariant | TIM-09.2 | TC-T151 |
| RL-152 | Recompute runs in an isolated worker and must not degrade interactive latency. | throughput target | 5,000 people × 1 month < 10 min | NFR | TIM-09.3 | TC-N152 |
| RL-153 | Recompute never alters a locked or closed payroll period; it raises an arrears item instead. | — | Enforced | Code invariant | TIM-09.4 | TC-Y153 |
| RL-154 | Deltas feed the pre-payroll audit check for days not recomputed since the last rule change. | — | Automatic | Code invariant | TIM-09.5, PAY-03.1 | TC-Y154 |
| RL-160 | Team history is scoped by the manager's reporting line, evaluated at query time. | — | Query-time | Code invariant | TIM-10.1 | TC-T160 |
| RL-161 | Team history returns attendance, leave, overtime, gate pass, late status and applied shift per day. | — | Fixed column set | Product | TIM-10.2 | TC-T161 (demo point 1) |
| RL-162 | Exports of personal data are logged. | — | Always | Code invariant | TIM-10.3 | TC-C162 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

| Rule ID | Module | Rule | Requirement | Statement | Worked example | Where it is configured |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BS:RL-01 | ATT | Work session pairing across midnight | R-01 | A work session starts at the first IN after the shift detection window opens and ends at the last OUT before the next session's first IN. The session is attributed to the date of the first IN, even where the last OUT falls on the next calendar date. Punches must be paired by sequence, not by calendar date. | IN 08:00 on day 1, OUT 20:30, IN 21:15, OUT 03:20 on day 2 is one session attributed to day 1. | Shift Master — detection window |
| BS:RL-02 | ATT | Gross work hours | R-01 | Gross work hours equal the last OUT less the first IN of the session, with no deduction for intermediate breaks. | 08:00 to 03:20 is 19 hours 20 minutes. | Not configurable — definitional |
| BS:RL-03 | ATT | Break derivation | R-01 | Every gap between an OUT and the following IN inside a session is a break. Each is written to the break register with its start, end and duration. Per the source these are reported, not deducted. | 20:30 to 21:15 is a 45-minute break, reported separately. | Break type list is configurable |
| BS:RL-04 | OTM | Overtime computation | R-01, R-05 | OT hours equal gross work hours less the shift OT threshold, floored at zero, and are set to zero where the employee's OT eligibility basis does not cover the day type. | 19:20 less 12:00 is 7 hours 20 minutes of OT. | Shift Master — OT starts after hours |
| BS:RL-16 | SHF | Half-day and absent thresholds | R-13 | Net work hours below the half-day threshold and at or above the absent threshold give a half day; below the absent threshold gives Absent. Thresholds sit on the shift, so a new shift length needs configuration, not code. | 12-hour shift: half day below 11:30, absent below 6:30. 10-hour: 9:30 and 6:00. 9-hour: 8:30 and 5:00. 8-hour: 7:30 and 4:30. | Shift Master — threshold fields |
| BS:RL-17 | ATT | Grace period and late marks | R-13 | Fifteen minutes of in and out grace apply. Three lates beyond grace are allowed in a month; from the fourth, the day is a half day. Employees at or above the exempt grade rank are not affected. | A fourth late arrival at 08:20 on a 08:00 shift gives a half day for a non-exempt employee and no penalty for an Assistant Manager. | Grace & Late Policy Setup |
| BS:RL-18 | SHF | Night extension | R-13 | Where the previous session ran past the trigger hour, the employee may arrive up to the permitted hour the next day and, provided work continues to the minimum departure time, the day is a full day with no late mark. | Out at 03:20, in at 09:15 the next day, out at 20:00 gives a full day. | Night Extension Rule Setup |
| BS:RL-19 | SHF | Auto shift detection | R-14 | The shift is resolved from the first in-punch against each shift's detection window. The detected shift governs over the rostered shift and the difference is recorded. Detection windows must not overlap. | An employee rostered to A shift punching in at 20:05 is processed on B shift. | Shift Master — detection window |
| BS:RL-20 | GPS | Gate pass entitlement and credit | R-12 | Personal gate pass is limited to the monthly hour entitlement and the monthly pass count. Approved gate pass hours are added to net work hours for the day. | Four hours a month as one pass of four or two of two; a third pass in the month is blocked. | Employee Master — entitlement fields |
| BS:RL-23 | OTM | OT paid after payroll | R-11 | OT is computed and paid in a run separate from payroll, after the linked payroll run is closed. The OT period is independent of the payroll period. | April salary is released, then April OT is run and paid separately. | OT Payment Run — linked payroll run |

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
| Size | 65 | specified items (table rows) | Counted automatically at generation |
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
