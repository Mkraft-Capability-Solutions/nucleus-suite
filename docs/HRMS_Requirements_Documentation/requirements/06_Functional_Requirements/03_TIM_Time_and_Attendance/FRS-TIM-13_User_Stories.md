<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-13 — Time & Attendance — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-13 |
| Title | Time & Attendance — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Derived from FRS-TIM-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

66 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 41, Should 18, Could 7.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| TIM-US-001 | Employee / worker | to punch from the mobile app even when the site has no network | Must | TIM-UC-001 |
| TIM-US-002 | Plant HR / time office | duplicate reads from a terminal to be marked rather than dropped | Must | TIM-UC-001 |
| TIM-US-003 | Auditor | every clock-drift correction to keep the raw device time alongside the corrected time | Should | TIM-UC-001 |
| TIM-US-004 | Payroll manager | a punch that arrives for a locked payroll period to raise an exception instead of altering the day | Must | TIM-UC-001 |
| TIM-US-005 | Plant HR / time office | a shift that runs past midnight to be one attendance day on the date it started | Must | TIM-UC-002 |
| TIM-US-006 | Plant HR / time office | each gap between punches stored as its own break row | Must | TIM-UC-002 |
| TIM-US-007 | Implementation consultant | break deduction and overtime basis to be tenant settings | Must | TIM-UC-002 |
| TIM-US-008 | Auditor | every computed day to carry its ruleset version and every recomputation to leave a field-level delta | Must | TIM-UC-002 |
| TIM-US-009 | Plant HR / time office | the shift to be taken from the time a worker actually punched in | Must | TIM-UC-003 |
| TIM-US-010 | Implementation consultant | overlapping inference windows to be rejected when I save the shift group | Must | TIM-UC-003 |
| TIM-US-011 | Plant HR / time office | to override a wrong inference with a reason | Must | TIM-UC-003 |
| TIM-US-012 | Plant HR / time office | daily-wage contractual workers with no rest days to show Sunday as a working day | Must | TIM-UC-004 |
| TIM-US-013 | HR operations | rest-day policy to attach to the worker class rather than the contractor engagement | Must | TIM-UC-004 |
| TIM-US-014 | Employee / worker | work done on my weekly off to be shown as rest-day working | Must | TIM-UC-004 |
| TIM-US-015 | Implementation consultant | each location to have its own holiday calendar | Must | TIM-UC-004 |
| TIM-US-016 | Plant HR / time office | half-day and absent thresholds to follow the length of the shift applied | Must | TIM-UC-005 |
| TIM-US-017 | Employee / worker | to see how many late arrivals I have used this month | Must | TIM-UC-005 |
| TIM-US-018 | HR operations | grace exemption to come from the designation band | Must | TIM-UC-005 |
| TIM-US-019 | Employee / worker | a late start after a long night to still count as a full day | Must | TIM-UC-005 |
| TIM-US-020 | Employee / worker | to be told immediately when a gate pass would exceed my monthly entitlement | Must | TIM-UC-006 |
| TIM-US-021 | Manager / supervisor | approved gate-pass time to be credited back to my team member's work hours | Must | TIM-UC-006 |
| TIM-US-022 | Employee / worker | to request a gate pass through the business messaging channel | Should | TIM-UC-006 |
| TIM-US-023 | Plant HR / time office | official passes tracked separately from personal ones | Must | TIM-UC-006 |
| TIM-US-024 | Manager / supervisor | to approve overtime with its basis and rate in front of me | Must | TIM-UC-007 |
| TIM-US-025 | Payroll manager | rest-day-only overtime eligibility applied by day type | Must | TIM-UC-007 |
| TIM-US-026 | Payroll manager | overtime paid in its own run after salary | Must | TIM-UC-007 |
| TIM-US-027 | Manager / supervisor | a warning when approving overtime would breach the statutory weekly limit | Must | TIM-UC-007 |
| TIM-US-028 | Manager / supervisor | the agent to propose a fix for a missed punch with evidence and a preview of the result | Must | TIM-UC-008 |
| TIM-US-029 | Tenant admin | to set the threshold under which the agent may resolve exceptions itself | Should | TIM-UC-008 |
| TIM-US-030 | Auditor | every agent proposal and every decision on it recorded in the action ledger | Must | TIM-UC-008 |
| TIM-US-031 | Payroll manager | a correction to a locked period to become arrears instead of changing the locked day | Must | TIM-UC-009 |
| TIM-US-032 | HR operations | recompute to read policy as it was on each date | Must | TIM-UC-009 |
| TIM-US-033 | Plant HR / time office | to watch a large recompute progress without slowing the system for others | Should | TIM-UC-009 |
| TIM-US-034 | Payroll manager | the pre-payroll audit to list days not recomputed since the last rule change | Must | TIM-UC-009 |
| TIM-US-035 | Manager / supervisor | to pick any date range, even across months, for one team member | Must | TIM-UC-010 |
| TIM-US-036 | Manager / supervisor | the person selector to offer only my own reportees | Must | TIM-UC-010 |
| TIM-US-037 | Compliance owner | every team-history export to be logged | Must | TIM-UC-010 |
| TIM-US-038 | Manager / supervisor | team history to work on my phone on the shop floor | Must | TIM-UC-010 |
| TIM-US-039 | Employee / worker | my weekly timesheet prefilled with my attendance hours | Should | TIM-UC-011 |
| TIM-US-040 | Manager / supervisor | to approve or return individual timesheet lines | Should | TIM-UC-011 |
| TIM-US-041 | Finance | approved time costed to project and cost centre | Should | TIM-UC-011 |
| TIM-US-042 | Employee / worker | to punch from my phone when I am at an approved site | Must | TIM-UC-012 |
| TIM-US-043 | Compliance owner | face templates to stay on the worker's phone unless the worker consents | Must | TIM-UC-012 |
| TIM-US-044 | Plant HR / time office | refused and suspect mobile punches raised as exceptions | Must | TIM-UC-012 |
| TIM-US-045 | Employee / worker | a mobile punch taken without signal to be kept and sent later | Must | TIM-UC-012 |
| TIM-US-046 | Employee / worker | to swap a shift with a colleague through the app | Should | TIM-UC-013 |
| TIM-US-047 | Manager / supervisor | swaps and claims that break rest or overtime rules refused before they reach me | Should | TIM-UC-013 |
| TIM-US-048 | Manager / supervisor | to choose between several claimants for one open shift | Could | TIM-UC-013 |
| TIM-US-049 | Employee / worker | my long and short days to balance in a time bank | Could | TIM-UC-014 |
| TIM-US-050 | Manager / supervisor | absence during core hours flagged | Could | TIM-UC-014 |
| TIM-US-051 | Employee / worker | to convert banked hours into leave | Could | TIM-UC-014 |
| TIM-US-052 | Plant HR / time office | a draft roster generated from demand | Should | TIM-UC-015 |
| TIM-US-053 | Compliance owner | the generator to stop at statutory limits and rest days | Should | TIM-UC-015 |
| TIM-US-054 | Manager / supervisor | to review coverage for my lines before publication | Should | TIM-UC-015 |
| TIM-US-055 | Manager / supervisor | to request overtime pre-approval with the budget impact shown | Must | TIM-UC-016 |
| TIM-US-056 | Payroll manager | unapproved overtime flagged before I lock inputs | Must | TIM-UC-016 |
| TIM-US-057 | Compliance owner | a warning when pre-approval would exceed weekly limits | Must | TIM-UC-016 |
| TIM-US-058 | Plant HR / time office | meal and bus usage matched to attendance automatically | Should | TIM-UC-017 |
| TIM-US-059 | Employee / worker | to see my canteen and transport deductions by day | Should | TIM-UC-017 |
| TIM-US-060 | Finance | subsidy totals per vendor and cost centre | Should | TIM-UC-017 |
| TIM-US-061 | Employee / worker | to declare my weekly work location and book desks | Should | TIM-UC-018 |
| TIM-US-062 | Manager / supervisor | to see team presence by day | Should | TIM-UC-018 |
| TIM-US-063 | HR operations | attendance derived from the declared location | Should | TIM-UC-018 |
| TIM-US-064 | Employee / worker | to opt in to beacon presence and withdraw at any time | Could | TIM-UC-019 |
| TIM-US-065 | Compliance owner | only presence at defined points stored | Could | TIM-UC-019 |
| TIM-US-066 | Plant HR / time office | beacon punches treated like any other source | Could | TIM-UC-019 |

## 2. Stories with acceptance criteria

### TIM-US-001 · Ingest punches from every enrolled source

As a **Employee / worker**, I want to punch from the mobile app even when the site has no network, so that my attendance is recorded at the time I actually arrived or left and I do not have to raise a correction.

Priority: **Must** · Use case: TIM-UC-001 · Realises: TIM-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | employee E1018 is inside the plant geofence and his phone is offline at 21:15 on 08 Sep | he punches IN on the app | the app stores the punch locally with a signed timestamp of 21:15 and shows it as waiting to sync |
| 2 | the queued 21:15 punch | the phone reconnects at 21:52 | the platform stores one attendance_event with punch_ts 21:15, source mobile and received_at 21:52, and queues 08 Sep for derivation |

### TIM-US-002 · Ingest punches from every enrolled source

As a **Plant HR / time office**, I want duplicate reads from a terminal to be marked rather than dropped, so that I can find terminals that double-read without losing any genuine punch.

Priority: **Must** · Use case: TIM-UC-001 · Realises: TIM-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018 places his finger twice on the same terminal at 08:00:05 and 08:00:41 | both reads are ingested | two attendance_events are stored, the second has is_duplicate set and only the 08:00:05 event is used for pairing |
| 2 | two punches from the same person and terminal 90 seconds apart | they are ingested | neither is marked as a duplicate because the gap exceeds the 60-second window |

### TIM-US-003 · Ingest punches from every enrolled source

As a **Auditor**, I want every clock-drift correction to keep the raw device time alongside the corrected time, so that I can explain any punch time shown on a payslip back to what the terminal recorded.

Priority: **Should** · Use case: TIM-UC-001 · Realises: TIM-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a terminal whose last sync offset shows it running 95,000 ms fast | it sends a punch stamped 08:01:35 | the event stores a corrected punch time of 08:00:00, the raw value 08:01:35 and the offset applied |
| 2 | the same corrected event | the attendance day is derived | first_in uses 08:00:00 and the raw value remains retrievable from the event history |

### TIM-US-004 · Ingest punches from every enrolled source

As a **Payroll manager**, I want a punch that arrives for a locked payroll period to raise an exception instead of altering the day, so that figures I have already locked for payroll never move without my knowledge.

Priority: **Must** · Use case: TIM-UC-001 · Realises: TIM-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | September attendance inputs are locked for payroll | a replayed punch for E1018 dated 28 Sep arrives on 03 Oct | the 28 Sep attendance day is unchanged and an attendance exception citing RL-075 appears in the exception queue |
| 2 | the same late punch | I inspect the raw events for E1018 on 28 Sep | the punch is present and immutable with received_at 03 Oct |

### TIM-US-005 · Derive the attendance day from paired punches

As a **Plant HR / time office**, I want a shift that runs past midnight to be one attendance day on the date it started, so that night workers are neither split across two days nor marked absent the next morning.

Priority: **Must** · Use case: TIM-UC-002 · Realises: TIM-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018 on shift A 08:00-20:00 punches IN 08:00, OUT 20:30, IN 21:15 on 08 Sep and OUT 03:20 on 09 Sep | the day is derived | one attendance day dated 08 Sep exists with first_in 08:00, last_out 03:20 and gross 19h20m |
| 2 | the same punches | 09 Sep is derived | the 03:20 OUT is not counted on 09 Sep and 09 Sep is not marked Absent because of it |

### TIM-US-006 · Derive the attendance day from paired punches

As a **Plant HR / time office**, I want each gap between punches stored as its own break row, so that I can run a break register without asking for a custom report.

Priority: **Must** · Use case: TIM-UC-002 · Realises: TIM-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's day of 08 Sep is derived | I run the break register for E1018 on 08 Sep | exactly one row appears: start 20:30, end 21:15, 45 minutes, type meal, recorded and not deducted |
| 2 | segments 08:00-20:30 and 21:15-03:20 | the totals are checked | 750 plus 365 segment minutes plus the 45-minute break equal the 1,160-minute gross span |

### TIM-US-007 · Derive the attendance day from paired punches

As a **Implementation consultant**, I want break deduction and overtime basis to be tenant settings, so that each client's policy is applied without code changes.

Priority: **Must** · Use case: TIM-UC-002 · Realises: TIM-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | deduct_breaks is NO and ot_basis is GROSS for the tenant | E1018's 08 Sep day is derived against the 12-hour shift | net is 19h20m and ot_minutes_raw is 440 (7h20m) |
| 2 | a test tenant with deduct_breaks YES and ot_basis NET | the same punches are derived | net is 18h35m and ot_minutes_raw is 395 (6h35m) |

### TIM-US-008 · Derive the attendance day from paired punches

As a **Auditor**, I want every computed day to carry its ruleset version and every recomputation to leave a field-level delta, so that I can explain why a recomputed day differs from the original.

Priority: **Must** · Use case: TIM-UC-002 · Realises: TIM-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's 08 Sep day was computed under the then-current ruleset | an approved regularisation changes last_out and the day is recomputed | an attendance_day_delta records last_out with old value, new value and reason, and the row shows the ruleset version used |
| 2 | a day whose inputs have not changed | it is recomputed | the row is identical and no delta is written |

### TIM-US-009 · Infer the applied shift from the first in-punch

As a **Plant HR / time office**, I want the shift to be taken from the time a worker actually punched in, so that a worker who covers B shift is processed on B shift without me editing the roster.

Priority: **Must** · Use case: TIM-UC-003 · Realises: TIM-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee rostered to shift A (08:00-20:00) whose first in-punch is 20:05, inside shift B's window | the day is derived | shift applied is B, shift assigned remains A, the inference reason is recorded and time.shift.inferred is emitted |
| 2 | E1020 Arjun Bhat's days of 04 and 11 Sep, where the applied shift differs from the assigned one | disposition runs | the 12-hour thresholds of the inferred shift are applied, not those of the rostered shift |

### TIM-US-010 · Infer the applied shift from the first in-punch

As a **Implementation consultant**, I want overlapping inference windows to be rejected when I save the shift group, so that inference can never be ambiguous in production.

Priority: **Must** · Use case: TIM-UC-003 · Realises: TIM-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | SH-A in shift group PLANT12 has the inference window 06:30-09:29 | I save SH-B in PLANT12 with earliest-in 09:00 | the save fails and the message names SH-A and SH-B and the overlapping interval 09:00-09:29 |
| 2 | the same group | I set SH-B's window to 19:00-22:29 | the group saves successfully |

### TIM-US-011 · Infer the applied shift from the first in-punch

As a **Plant HR / time office**, I want to override a wrong inference with a reason, so that the day is judged on the correct shift and the change is auditable.

Priority: **Must** · Use case: TIM-UC-003 · Realises: TIM-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a day inferred as shift B for a worker who stayed on shift A for a line changeover | I override the applied shift to A with the reason 'Line 3 changeover cover' | an audit entry records me, the time, old and new shift and the reason, and time.shift.overridden is emitted |
| 2 | the same day | I try to save the override with an empty reason | the save is blocked with a message that a reason is required |

### TIM-US-012 · Resolve the day type before disposition

As a **Plant HR / time office**, I want daily-wage contractual workers with no rest days to show Sunday as a working day, so that their attendance and daily wages are computed on the days they are expected to work.

Priority: **Must** · Use case: TIM-UC-004 · Realises: TIM-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1032 Shivanna Muniyappa belongs to a class with has_rest_days set to NO | Sundays 06 and 13 Sep are resolved | both days show day type Working, not Weekly Off |
| 2 | E1032 raises a regularisation asking for Sunday 13 Sep to be treated as a weekly off | the request is decided | it is rejected and 13 Sep stays Working, because rest-day entitlement comes from the worker class and cannot be created by an attendance correction |

### TIM-US-013 · Resolve the day type before disposition

As a **HR operations**, I want rest-day policy to attach to the worker class rather than the contractor engagement, so that employees and helpers supplied by the same vendor each get their own entitlement.

Priority: **Must** · Use case: TIM-UC-004 · Realises: TIM-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1034 Imran Shaikh (class 3PE) and E1036 Lakshmi Rao (class 3PH) are deployed by the same vendor at the same site and shift | Sunday 06 Sep is resolved | the day is Weekly Off for E1034 and Working for E1036 |
| 2 | the vendor engagement record is edited | the days are recomputed | the day types do not change, because the engagement carries no rest-day policy |

### TIM-US-014 · Resolve the day type before disposition

As a **Employee / worker**, I want work done on my weekly off to be shown as rest-day working, so that I am not marked Half Day or Absent for volunteering on a rest day.

Priority: **Must** · Use case: TIM-UC-004 · Realises: TIM-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my class has Sunday as weekly off and I work 5 hours on a Sunday | the day is disposed | my status reads Weekly Off - worked, and no half-day or absent threshold is applied |
| 2 | the same day | I open My attendance | the day type is shown as Weekly Off with the hours I worked |

### TIM-US-015 · Resolve the day type before disposition

As a **Implementation consultant**, I want each location to have its own holiday calendar, so that a local festival at one plant does not become a holiday at plants in other states.

Priority: **Must** · Use case: TIM-UC-004 · Realises: TIM-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 15 Sep 2026 is Vinayaka Chaturthi in the holiday calendars of Medchal Works (Hyderabad) and Oragadam Works (Chennai) only | 15 Sep is resolved for workers at Medchal Works and at Chakan Works (Pune) | Medchal workers get day type Holiday and Chakan workers get Working |
| 2 | a worker transfers between the two plants mid-month | days on either side of the transfer are resolved | each day uses the calendar of the location effective on that date |

### TIM-US-016 · Dispose the attendance day against shift thresholds and late rules

As a **Plant HR / time office**, I want half-day and absent thresholds to follow the length of the shift applied, so that workers on 8, 9, 10 and 12-hour shifts are judged against their own thresholds.

Priority: **Must** · Use case: TIM-UC-005 · Realises: TIM-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | three working days on a 12-hour shift with net hours of 11:45, 11:00 and 6:00 | the days are disposed | the statuses are Present, Half Day and Absent respectively |
| 2 | E1041 on a 10-hour shift on 07 Sep with net hours of 9:15 | the day is disposed | the status is Half Day because 9:15 is below 9:30, and RL-113 appears in the rule trail |

### TIM-US-017 · Dispose the attendance day against shift thresholds and late rules

As a **Employee / worker**, I want to see how many late arrivals I have used this month, so that I know before a fourth late arrival turns a day into a half day.

Priority: **Must** · Use case: TIM-UC-005 · Realises: TIM-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1019 Sneha Nair on an 08:00 shift arrives late beyond grace on 01, 03 and 07 Sep with full hours | she opens My attendance on 07 Sep | the counter shows 3 of 3 forgiven and all three days are Present |
| 2 | she arrives at 08:20 on 10 Sep and again late on 14 Sep | those days are disposed | both are Half Day citing RL-117, an 08:10 arrival on any day records no late instance, and the counter resets to 0 on 01 Oct |

### TIM-US-018 · Dispose the attendance day against shift thresholds and late rules

As a **HR operations**, I want grace exemption to come from the designation band, so that managers are exempt from late deductions without a hardcoded grade list.

Priority: **Must** · Use case: TIM-UC-005 · Realises: TIM-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1021 Rekha Deshpande holds a designation whose band is grace-exempt and works the 09:00 general shift | she arrives at 09:25, as on each of her five late days in September | no late instance is recorded, no deduction applies and every such day is Present |
| 2 | a non-exempt colleague arrives at 09:25 on the same shift | the day is disposed | a late instance of 25 minutes is recorded and the monthly counter increases by one |

### TIM-US-019 · Dispose the attendance day against shift thresholds and late rules

As a **Employee / worker**, I want a late start after a long night to still count as a full day, so that I am not penalised for staying until the early hours to finish the work.

Priority: **Must** · Use case: TIM-UC-005 · Realises: TIM-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's shift of 08 Sep ended at 03:20 on 09 Sep | he arrives at 09:25 on 09 Sep and leaves at 20:10 | 09 Sep is Present with no late mark and no grace deduction, citing RL-118, even though the 10h45m span is below the 11h30m half-day threshold |
| 2 | the same long night | he arrives at 09:40 instead | the relief window does not apply and the arrival is counted as late against the 08:00 shift start |

### TIM-US-020 · Request, approve and credit a gate pass

As a **Employee / worker**, I want to be told immediately when a gate pass would exceed my monthly entitlement, so that I do not wait for an approval that cannot be given.

Priority: **Must** · Use case: TIM-UC-006 · Realises: TIM-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1023 Kavya Venkatesh has approved personal passes GP-2026-0141 (04 Sep) and GP-2026-0155 (11 Sep) of 120 minutes each | she submits GP-2026-0163 for 15:00-17:00 on 24 Sep | the request is rejected at validation with text naming the 240-minute and 2-pass monthly ceiling, and no approver is notified |
| 2 | E1044 Rahul Gaikwad has no personal passes in September | he requests GP-2026-0152, one 240-minute pass on 09 Sep | it is accepted for approval, and once approved any further personal pass that month is rejected on the minutes ceiling |

### TIM-US-021 · Request, approve and credit a gate pass

As a **Manager / supervisor**, I want approved gate-pass time to be credited back to my team member's work hours, so that an approved errand does not turn a full day into a half day.

Priority: **Must** · Use case: TIM-UC-006 · Realises: TIM-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1023 is out from 12:00 to 14:00 on 04 Sep on personal pass GP-2026-0141, which I approve | the day is recomputed | a 120-minute gate_pass break is recorded, 120 minutes are credited back and net hours equal those without the pass |
| 2 | a pass that is still pending when the day is derived | I view the day | no minutes are credited, and after I approve it the day is recomputed with the credit applied |

### TIM-US-022 · Request, approve and credit a gate pass

As a **Employee / worker**, I want to request a gate pass through the business messaging channel, so that I can ask from the shop floor without a computer.

Priority: **Should** · Use case: TIM-UC-006 · Realises: TIM-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I have used 2 personal passes this month | I request a third through the business messaging channel | I receive the same ceiling rejection text as the web form |
| 2 | I have used no passes this month | I request a 60-minute personal pass through the channel | the request appears in my manager's approvals inbox with source shown as messaging channel |

### TIM-US-023 · Request, approve and credit a gate pass

As a **Plant HR / time office**, I want official passes tracked separately from personal ones, so that staff sent out on company business do not lose their personal entitlement.

Priority: **Must** · Use case: TIM-UC-006 · Realises: TIM-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1023 has used 240 personal minutes in September | an official pass of 90 minutes for a supplier visit is requested for her | it is accepted for approval and her personal usage remains 240 of 240 |
| 2 | E1026 has approved official pass GP-2026-0148 of 60 minutes on 07 Sep for a vendor pickup at the gate | I view E1026's gate-pass history | the pass is listed as official and his personal usage for September shows 0 minutes and 0 instances |

### TIM-US-024 · Compute and approve overtime

As a **Manager / supervisor**, I want to approve overtime with its basis and rate in front of me, so that only overtime I have checked becomes payable.

Priority: **Must** · Use case: TIM-UC-007 · Realises: TIM-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018, eligible on all days, worked a 19h20m gross span on 08 Sep against a 12-hour shift | I open the overtime approval | it shows 440 minutes (7h20m), basis gross, day type Working and multiplier 2.0 |
| 2 | I have not yet approved it | payroll inputs are prepared | the record is excluded from every pay run; once I approve, time.overtime.approved is emitted and it becomes payable |

### TIM-US-025 · Compute and approve overtime

As a **Payroll manager**, I want rest-day-only overtime eligibility applied by day type, so that workers with that eligibility are paid overtime only for rest-day and holiday working.

Priority: **Must** · Use case: TIM-UC-007 · Realises: TIM-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1034 Imran Shaikh has eligibility rest_day_and_holiday_only and works a span above 12 hours on Friday 04 Sep | overtime is computed | payable overtime is 0 and the raw minutes are retained on the record |
| 2 | E1034 works on Sunday 06 Sep, his weekly off | overtime is computed | the whole worked span is payable overtime |

### TIM-US-026 · Compute and approve overtime

As a **Payroll manager**, I want overtime paid in its own run after salary, so that overtime is never mixed into the salary run, as the client requires.

Priority: **Must** · Use case: TIM-UC-007 · Realises: TIM-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September salary run is still open | I try to execute the September overtime payment run | it is blocked with a message that the linked salary run must close first |
| 2 | the September salary run is closed | I execute the overtime run | approved September overtime records tagged to it are paid and posted separately from salary |

### TIM-US-027 · Compute and approve overtime

As a **Manager / supervisor**, I want a warning when approving overtime would breach the statutory weekly limit, so that I never approve overtime beyond the limit unknowingly.

Priority: **Must** · Use case: TIM-UC-007 · Realises: TIM-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a team member whose approved overtime this week already reaches the weekly limit in the state rule pack | I open a further overtime record for approval | a warning names the limit and the excess minutes before I can decide |
| 2 | a record within the weekly limit | I open it | no limit warning is shown |

### TIM-US-028 · Resolve attendance exceptions through regularisation

As a **Manager / supervisor**, I want the agent to propose a fix for a missed punch with evidence and a preview of the result, so that I can clear the exception queue in one decision per item.

Priority: **Must** · Use case: TIM-UC-008 · Realises: TIM-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1026 Manjunath Poojary has an IN at 20:02 on 05 Sep with no matching OUT (exception EX-2026-0341), and the gate security register shows his exit at 08:12 | the agent proposes OUT 08:12 | I see the register evidence, a dry-run diff setting last_out and gross minutes and adding a 12-minute overtime line, and a confidence value |
| 2 | I approve the proposal | the decision is saved | a regularisation is created, recompute is queued for 05 Sep and EX-2026-0341 is closed |

### TIM-US-029 · Resolve attendance exceptions through regularisation

As a **Tenant admin**, I want to set the threshold under which the agent may resolve exceptions itself, so that small, well-evidenced fixes are automatic and larger ones stay with people.

Priority: **Should** · Use case: TIM-UC-008 · Realises: TIM-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the auto-resolve threshold is set to 120 minutes | the agent finds a 15-minute correction supported by terminal evidence | it applies the regularisation and the action ledger records it as auto-resolved under the agent principal |
| 2 | the same threshold | the agent's proposed correction is 180 minutes | the change is proposal-only and waits in the queue for a human decision |

### TIM-US-030 · Resolve attendance exceptions through regularisation

As a **Auditor**, I want every agent proposal and every decision on it recorded in the action ledger, so that I can verify that the agent stayed within its permitted threshold.

Priority: **Must** · Use case: TIM-UC-008 · Realises: TIM-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 12 regularisations in September, 5 of them auto-resolved | I review the action ledger for September | each of the 12 shows the proposer, the evidence reference, the simulation result and either the human approver or the threshold in force |
| 2 | an auto-resolved entry | I compare its change size with the threshold recorded on it | the change is within that threshold |

### TIM-US-031 · Recompute attendance after a change

As a **Payroll manager**, I want a correction to a locked period to become arrears instead of changing the locked day, so that a closed payroll always reconciles to the attendance it was paid on.

Priority: **Must** · Use case: TIM-UC-009 · Realises: TIM-09

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | August payroll is closed and a regularisation adds 4 hours to E1018's day of 28 Aug | recompute runs | the 28 Aug attendance day is unchanged and an arrears item for E1018 is raised for the September run |
| 2 | the same recompute | I check notifications | payroll.input.stale has been emitted and I am notified of the arrears item with its reason |

### TIM-US-032 · Recompute attendance after a change

As a **HR operations**, I want recompute to read policy as it was on each date, so that a class change from mid-month does not rewrite the earlier days.

Priority: **Must** · Use case: TIM-UC-009 · Realises: TIM-09

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1032 moves to a class with Sunday weekly off effective 15 Sep | recompute runs for 01-30 Sep | 06 and 13 Sep remain Working and 20 and 27 Sep become Weekly Off |
| 2 | the class change is recorded on 18 Sep with effect from 15 Sep | recompute runs | it is queued automatically for E1032 from 15 Sep without manual action |

### TIM-US-033 · Recompute attendance after a change

As a **Plant HR / time office**, I want to watch a large recompute progress without slowing the system for others, so that I can change a rule mid-cycle with confidence.

Priority: **Should** · Use case: TIM-UC-009 · Realises: TIM-09

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a change to the 9-hour threshold row affects 5,000 people for one month | the recompute is queued | the recompute monitor shows progress and the job completes in under 10 minutes |
| 2 | the recompute is running | employees check in and open My attendance | their response times stay within normal interactive targets |

### TIM-US-034 · Recompute attendance after a change

As a **Payroll manager**, I want the pre-payroll audit to list days not recomputed since the last rule change, so that I never pay on stale attendance.

Priority: **Must** · Use case: TIM-UC-009 · Realises: TIM-09

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a rule change at 10:00 on 25 Sep leaves 40 days not yet recomputed | I run the pre-payroll audit | the check fails and lists those 40 person-days |
| 2 | the recompute for those days completes | I rerun the audit | the check passes |

### TIM-US-035 · View and export team attendance history

As a **Manager / supervisor**, I want to pick any date range, even across months, for one team member, so that I can review their full history in one view.

Priority: **Must** · Use case: TIM-UC-010 · Realises: TIM-10

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am the reporting manager of E1018 | I set the range 01 Jan to 15 Mar and select E1018 | the history returns every day in the range with status, net hours, overtime, gate pass, late status and applied shift |
| 2 | the same view | I export it to CSV | the exported rows match the screen row for row |

### TIM-US-036 · View and export team attendance history

As a **Manager / supervisor**, I want the person selector to offer only my own reportees, so that I cannot see colleagues' teams by mistake.

Priority: **Must** · Use case: TIM-UC-010 · Realises: TIM-10

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1036 is not in my reporting line | I search for E1036 in the team calendar | E1036 cannot be selected |
| 2 | I open a link that requests E1036's history directly | the server evaluates it | no data is returned and the attempt is refused |

### TIM-US-037 · View and export team attendance history

As a **Compliance owner**, I want every team-history export to be logged, so that I can show who took personal data out of the system.

Priority: **Must** · Use case: TIM-UC-010 · Realises: TIM-10

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a manager exports a PDF of the whole team for 01-30 Sep | I review the export log | an entry shows the manager, the time, format PDF and the scope of team and range |
| 2 | a manager views the same range without exporting | I review the log | no export entry is created |

### TIM-US-038 · View and export team attendance history

As a **Manager / supervisor**, I want team history to work on my phone on the shop floor, so that I can answer a worker's query without going to a desk.

Priority: **Must** · Use case: TIM-UC-010 · Realises: TIM-10

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I open team history on a phone for E1018 on 08 Sep | the page loads | I see status Present, net 19h20m, overtime 7h20m and applied shift A |
| 2 | my phone is on a weak network and I select the whole team for one month | results load | the first member's rows render before the remaining members finish loading |

### TIM-US-039 · Log and approve project and task timesheets

As a **Employee / worker**, I want my weekly timesheet prefilled with my attendance hours, so that I only allocate time rather than retyping it.

Priority: **Should** · Use case: TIM-UC-011 · Realises: TIM-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my net attendance for Monday 07 Sep was 8h45m | I open the timesheet for that week | Monday shows 8h45m available to allocate across my projects |
| 2 | I allocate 9h30m to projects on Monday | I try to submit | submission is blocked and Monday is flagged as exceeding attendance by 45 minutes |

### TIM-US-040 · Log and approve project and task timesheets

As a **Manager / supervisor**, I want to approve or return individual timesheet lines, so that one wrong entry does not hold up the whole week.

Priority: **Should** · Use case: TIM-UC-011 · Realises: TIM-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a submitted timesheet with 6 lines | I return line 4 with the comment 'Wrong task' | lines 1-3 and 5-6 are approved and only line 4 reopens for the employee |
| 2 | the employee corrects and resubmits line 4 | it reaches me | only line 4 is presented for approval |

### TIM-US-041 · Log and approve project and task timesheets

As a **Finance**, I want approved time costed to project and cost centre, so that project costs are allocated without spreadsheets.

Priority: **Should** · Use case: TIM-UC-011 · Realises: TIM-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | approved lines totalling 120 hours on a project for September | I open the allocation view | I see 120 hours costed by cost centre at the rates effective on each worked date |
| 2 | a line approved after the September costing period closed | allocation runs | the line appears in October as an adjustment referencing September |

### TIM-US-042 · Punch from mobile inside a geofence with a live selfie

As a **Employee / worker**, I want to punch from my phone when I am at an approved site, so that my attendance is recorded without a terminal.

Priority: **Must** · Use case: TIM-UC-012 · Realises: TIM-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a 200-metre geofence around a client site assigned to me | I punch IN 50 metres from its centre after a successful selfie | the punch is accepted with source mobile, my coordinates and a selfie reference |
| 2 | I am 1.2 km from the nearest assigned geofence | I try to punch | the punch is refused and the app shows the distance to the nearest geofence |

### TIM-US-043 · Punch from mobile inside a geofence with a live selfie

As a **Compliance owner**, I want face templates to stay on the worker's phone unless the worker consents, so that we hold no more biometric data than the law and our policy allow.

Priority: **Must** · Use case: TIM-UC-012 · Realises: TIM-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a worker without a recorded consent for server-side matching | they punch from the app | only the match and liveness result is sent with the punch and no template is transmitted |
| 2 | a worker who records consent | they punch | the event stores the consent reference used for server-side matching |

### TIM-US-044 · Punch from mobile inside a geofence with a live selfie

As a **Plant HR / time office**, I want refused and suspect mobile punches raised as exceptions, so that I can follow up attempts made outside the geofence or failing liveness.

Priority: **Must** · Use case: TIM-UC-012 · Realises: TIM-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a worker fails liveness three times when the tenant limit is three | the third attempt fails | an exception appears on the attendance exception queue with the worker, time and reason |
| 2 | the same worker later punches successfully | I view the exception | it links to the successful punch so I can close it |

### TIM-US-045 · Punch from mobile inside a geofence with a live selfie

As a **Employee / worker**, I want a mobile punch taken without signal to be kept and sent later, so that working at a remote site does not cost me attendance.

Priority: **Must** · Use case: TIM-UC-012 · Realises: TIM-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am inside the geofence with no signal at 07:58 | I complete the selfie and punch IN | the punch is queued on the phone with a signed 07:58 timestamp and its location and liveness result |
| 2 | the phone regains signal at 09:10 | the queue replays | the platform stores the punch with punch_ts 07:58 and queues the day for derivation |

### TIM-US-046 · Swap shifts and claim open shifts

As a **Employee / worker**, I want to swap a shift with a colleague through the app, so that cover is arranged formally and both of us are paid correctly.

Priority: **Should** · Use case: TIM-UC-013 · Realises: TIM-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am on shift A on 18 Sep and my colleague is on shift B the same day, both qualified for each other's line | I request a swap and she accepts | the request goes to our supervisor for approval |
| 2 | the supervisor approves | the roster is republished | I am assigned B and she is assigned A on 18 Sep and both days are queued for recompute |

### TIM-US-047 · Swap shifts and claim open shifts

As a **Manager / supervisor**, I want swaps and claims that break rest or overtime rules refused before they reach me, so that I only spend time on compliant requests.

Priority: **Should** · Use case: TIM-UC-013 · Realises: TIM-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a worker whose approved overtime this week already reaches the weekly limit | they claim an open 12-hour shift | the claim is refused and the message names the weekly limit |
| 2 | a worker without the forklift qualification | they claim an open shift that requires it | the claim is refused naming the missing qualification |

### TIM-US-048 · Swap shifts and claim open shifts

As a **Manager / supervisor**, I want to choose between several claimants for one open shift, so that I can give the shift to the most suitable person.

Priority: **Could** · Use case: TIM-UC-013 · Realises: TIM-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | three valid claims for an open night shift on 20 Sep | I open the request | I see the claimants in claim order with each one's hours this week |
| 2 | I approve the second claimant | the decision is saved | the other two claims are declined automatically and their claimants notified |

### TIM-US-049 · Work flexi-time and manage a time bank

As a **Employee / worker**, I want my long and short days to balance in a time bank, so that I can adjust my hours around commitments without penalty.

Priority: **Could** · Use case: TIM-UC-014 · Realises: TIM-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a daily target of 8h with core hours 10:00-16:00 | I work 09:00-18:30 on Monday with net 9h30m | 90 minutes are credited to my time bank |
| 2 | I work 10:00-17:00 on Tuesday with net 7h | the day is computed | 60 minutes are debited and my balance shows 30 minutes |

### TIM-US-050 · Work flexi-time and manage a time bank

As a **Manager / supervisor**, I want absence during core hours flagged, so that flexibility does not leave the team uncovered when it matters.

Priority: **Could** · Use case: TIM-UC-014 · Realises: TIM-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | core hours 10:00-16:00 | a team member arrives at 10:40 | the day is flagged as a core-hours breach and treated as a late arrival |
| 2 | a team member arrives at 09:50 and leaves at 16:05 | the day is computed | no breach is flagged |

### TIM-US-051 · Work flexi-time and manage a time bank

As a **Employee / worker**, I want to convert banked hours into leave, so that surplus time becomes time off.

Priority: **Could** · Use case: TIM-UC-014 · Realises: TIM-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a balance of 8h and a policy converting 8h to one day of leave | I request conversion and my manager approves | one day of leave is credited and my bank balance becomes zero |
| 2 | a balance of 5h | I request conversion of 8h | the request is refused and my available balance of 5h is shown |

### TIM-US-052 · Generate rosters from forecast labour demand

As a **Plant HR / time office**, I want a draft roster generated from demand, so that I start from a compliant plan instead of a blank grid.

Priority: **Should** · Use case: TIM-UC-015 · Realises: TIM-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | demand of 40 operators on shift A and 25 on shift B for line 3 for a 4-week period | I generate the draft | the draft shows coverage per day against 40 and 25 and lists any unfilled positions |
| 2 | a worker with approved leave on 22 Sep | the draft is generated | the worker is not rostered on 22 Sep |

### TIM-US-053 · Generate rosters from forecast labour demand

As a **Compliance owner**, I want the generator to stop at statutory limits and rest days, so that a generated roster never plans unlawful hours.

Priority: **Should** · Use case: TIM-UC-015 · Realises: TIM-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | demand that can only be met by planning some workers beyond the weekly limit | the draft is generated | those positions stay unfilled and are reported as shortfall |
| 2 | a worker whose class has Sunday weekly off | the draft is generated | the worker is not rostered on Sundays |

### TIM-US-054 · Generate rosters from forecast labour demand

As a **Manager / supervisor**, I want to review coverage for my lines before publication, so that the skills I need are on every shift.

Priority: **Should** · Use case: TIM-UC-015 · Realises: TIM-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a draft roster for my two lines | I open the coverage view | I see each shift's planned headcount by skill against demand |
| 2 | I comment 'need one more welder on B shift, 15 Sep' | I send it back | the roster owner sees the comment against that line, shift and date |

### TIM-US-055 · Pre-approve overtime against a line budget

As a **Manager / supervisor**, I want to request overtime pre-approval with the budget impact shown, so that I can plan extra hours without overspending.

Priority: **Must** · Use case: TIM-UC-016 · Realises: TIM-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Peenya Machining has 120 of 400 November OT hours left | I request 24 hours for 2026-11-14 | the request shows 96 hours remaining after approval and the projected cost |
| 2 | E1030 is a trainee with no overtime eligibility | I include E1030 | E1030 is excluded from payable hours with the reason shown |

### TIM-US-056 · Pre-approve overtime against a line budget

As a **Payroll manager**, I want unapproved overtime flagged before I lock inputs, so that we never pay overtime nobody approved.

Priority: **Must** · Use case: TIM-UC-016 · Realises: TIM-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018 worked 3 hours overtime on 2026-11-16 with no pre-approval | I open the pre-lock check | E1018's 3 hours are listed as unapproved |
| 2 | Plant HR marks it non-payable with a reason | I lock inputs | the hours are excluded from pay and retained for reporting |

### TIM-US-057 · Pre-approve overtime against a line budget

As a **Compliance owner**, I want a warning when pre-approval would exceed weekly limits, so that we do not plan unlawful hours.

Priority: **Must** · Use case: TIM-UC-016 · Realises: TIM-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1019 already has 58 hours that week and the limit is 60 | a 4-hour pre-approval is requested | the approver sees the limit warning and must enter a reason |
| 2 | the approver rejects it | the decision is saved | the rejection reason is recorded |

### TIM-US-058 · Reconcile canteen and transport usage with attendance

As a **Plant HR / time office**, I want meal and bus usage matched to attendance automatically, so that I only review the mismatches.

Priority: **Should** · Use case: TIM-UC-017 · Realises: TIM-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 1,180 meals served at Peenya on 2026-11-04 and 1,172 matched to present workers | reconciliation runs | 8 mismatches are listed for review |
| 2 | a badge not linked to any active worker | the feed is processed | the entry is quarantined and no deduction is made |

### TIM-US-059 · Reconcile canteen and transport usage with attendance

As a **Employee / worker**, I want to see my canteen and transport deductions by day, so that I can raise a query if something is wrong.

Priority: **Should** · Use case: TIM-UC-017 · Realises: TIM-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am E1029 with 22 meals and 22 bus trips in November | I open self-service | I see each date and the deduction per item |
| 2 | a meal is recorded on a day I was on leave | I raise a query | it routes to Plant HR with the entry attached |

### TIM-US-060 · Reconcile canteen and transport usage with attendance

As a **Finance**, I want subsidy totals per vendor and cost centre, so that I pay vendors only for reconciled usage.

Priority: **Should** · Use case: TIM-UC-017 · Realises: TIM-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | November reconciliation is closed | I open the subsidy summary | totals by vendor and cost centre exclude unresolved mismatches |
| 2 | a vendor error is confirmed | the summary is regenerated | the vendor total is reduced accordingly |

### TIM-US-061 · Declare work location and book a desk

As a **Employee / worker**, I want to declare my weekly work location and book desks, so that my office days are planned and my attendance is correct.

Priority: **Should** · Use case: TIM-UC-018 · Realises: TIM-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a policy of 3 office days a week | I declare Monday, Wednesday and Thursday as office | the plan is accepted and I can book desks for those days |
| 2 | I have used all home days for November | I declare another home day | it is routed to my manager for approval |

### TIM-US-062 · Declare work location and book a desk

As a **Manager / supervisor**, I want to see team presence by day, so that I can set team days when most people are in.

Priority: **Should** · Use case: TIM-UC-018 · Realises: TIM-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my team of 9 at Bengaluru Corporate Office | I view the week | I see each person's declared location by day |
| 2 | Wednesday has 8 of 9 in the office | I view the week | Wednesday is highlighted as the best team day |

### TIM-US-063 · Declare work location and book a desk

As a **HR operations**, I want attendance derived from the declared location, so that home and office days follow the correct rules.

Priority: **Should** · Use case: TIM-UC-018 · Realises: TIM-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1011 declared home on 2026-11-06 and logged on remotely | the day is derived | it is recorded as work from home, not absent |
| 2 | E1011 declared home but punched in at the office | the day is derived | it is recorded as office presence with a note |

### TIM-US-064 · Accept opt-in presence signals from wearables or beacons

As a **Employee / worker**, I want to opt in to beacon presence and withdraw at any time, so that I control whether it is used.

Priority: **Could** · Use case: TIM-UC-019 · Realises: TIM-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am E1045 at Chakan Works | I opt in after reading the Marathi notice | my consent is recorded with the notice version |
| 2 | I withdraw consent | I pass a gate beacon one minute later | no presence event is stored |

### TIM-US-065 · Accept opt-in presence signals from wearables or beacons

As a **Compliance owner**, I want only presence at defined points stored, so that we do not track workers continuously.

Priority: **Could** · Use case: TIM-UC-019 · Realises: TIM-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a wearable passes three undefined points and one gate beacon | signals are processed | one punch at the gate is stored and nothing else |
| 2 | an audit request | I export beacon data for October | every event shows a defined point and a consent reference |

### TIM-US-066 · Accept opt-in presence signals from wearables or beacons

As a **Plant HR / time office**, I want beacon punches treated like any other source, so that attendance is derived consistently.

Priority: **Could** · Use case: TIM-UC-019 · Realises: TIM-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1045 passes the gate beacon at 16:52 and the exit beacon at 03:05 next morning | the day is derived | the D-shift day shows first in 16:52 and last out 03:05 |
| 2 | two gate beacon events 20 s apart | both are received | the second is marked duplicate and retained |

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
| Size | 198 | specified items (table rows) | Counted automatically at generation |
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
