<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-08 — Time & Attendance — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-08 |
| Title | Time & Attendance — Test Cases and Acceptance |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | QA / Test Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | VV, PR |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-TIM-13.


## Attendance Golden Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-T80 | Cross-midnight day stays on one attendance date | E1018 Ravi Kulkarni, 08 Sep 2026 | One attendance day dated 08 Sep, spanning 08:00 to 03:20 | RL-080 | Golden |
| TC-T82 | Four punches pair into two segments | E1018, 08 Sep | Segments 08:00-20:30 and 21:15-03:20 | RL-082 | Golden |
| TC-T83 | Dinner gap is its own break row | E1018, 08 Sep | 45-minute break, reportable independently | RL-083 | Golden |
| TC-T84 | Gross span | E1018, 08 Sep | 19h 20m | RL-084 | Golden |
| TC-T87 | Overtime against the 12h shift on the gross basis | E1018, 08 Sep | 7h 20m OT | RL-087 | Golden |
| TC-T92 | Shift inference from the in-punch | E1020 Arjun Bhat, 04 and 11 Sep | Shift applied differs from shift assigned; 12h threshold applied against the inferred shift | RL-092 | Golden |
| TC-T101 | Daily-wage contractual worker has no rest day | E1032 Shivanna Muniyappa, 06 and 13 Sep | Sunday shows Working, not Weekly Off | RL-101 | Golden |
| TC-T102 | Same vendor, different classes, different rest days | E1034 Imran Shaikh (3PE) vs E1036 Lakshmi Rao (3PH), 06 Sep | Sunday is Weekly Off for one, Working for the other | RL-102 | Golden |
| TC-T112 | Absent threshold on a 12h shift | E1022, 02 and 09 Sep | Below 6:30 net → Absent | RL-112 | Golden |
| TC-T113 | Half-day threshold on a 10h shift | E1041, 07 Sep | Below 9:30 net → Half Day | RL-113 | Golden |
| TC-T115 | Grace-exempt designation arrives late | E1021 (Manager grade), any late day | No late instance, no deduction | RL-115 | Golden |
| TC-T117 | Fourth late instance in the month | E1019 Sneha Nair, 01/03/07/10/14 Sep | First three forgiven; fourth converts the day to Half Day | RL-117 | Golden |
| TC-T118 | Long-night relief | E1018, 09 Sep after a 03:20 finish | Arrival up to 09:30 still credited a full day | RL-118 | Golden |
| TC-T121 | Gate-pass monthly ceiling | E1023, GP-2026-0141, 0155, 0163 | Two approved 2h passes; the third rejected on the ceiling | RL-121 | Golden |
| TC-T86 | Approved gate-pass minutes credited back | E1023, 04 and 11 Sep | Gap appears as a break and the same minutes credited; net hours unchanged | RL-086 | Golden |
| TC-T132 | Rest-day-only overtime eligibility | E1034 Imran Shaikh, 04 Sep vs 06 Sep | Weekday OT = 0 despite a 12h+ span; rest-day span pays in full | RL-132 | Golden |

## Property Tests

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PR05 | Net minutes never exceed gross minutes | Any day | Invariant holds | — | Property |
| TC-PR06 | Recomputing an unchanged day produces an identical row | Any day | No delta written | RL-089 | Property |
| TC-PR07 | Segments plus breaks equal the gross span | Any day | Invariant holds | RL-084 | Property |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-01 | R-01 | Work session crossing midnight is one session | Punch IN 08:00, OUT 20:30, IN 21:15, OUT 03:20 next day against a 12-hour A shift. | One attendance record on day 1. Gross work hours 19:20. Break minutes 45. Day status Present. Day 2 is not marked absent. |  |
| T-02 | R-01 | Break appears in the break register | Run the break register for the same employee and date. | One row: start 20:30, end 21:15, 45 minutes, break type Meal or Unclassified. |  |
| T-03 | R-01 | OT is computed on gross hours | Same session, employee OT eligible on all days. | OT hours 7:20. |  |
| T-05 | R-02 | Team calendar range spans more than one month | As a reporting manager, set from 01 January to 15 March and pick one team member. | History returns for the full range. Export matches the screen. A non-reportee cannot be selected. |  |
| T-22 | R-11 | OT cannot be paid with salary | Attempt to run OT payment before the linked payroll run is closed. | Blocked. After payroll closes, the OT run executes and posts separately. |  |
| T-23 | R-12 | Gate pass entitlement and credit | Take two passes of two hours in a month, then attempt a third. | The third is blocked. Approved hours are added to net work hours; a pending pass adds nothing. |  |
| T-24 | R-13 | Shift thresholds produce the right day status | On a 12-hour shift record net hours of 11:45, 11:00 and 6:00. | Present, Half day and Absent. Repeat on 10, 9 and 8-hour shifts against their own thresholds. |  |
| T-25 | R-13 | Grace, late count and grade exemption | Arrive 08:10 then 08:20 four times in a month, for a non-exempt employee and for an Assistant Manager. | 08:10 is within grace. The fourth late gives the non-exempt employee a half day; the Assistant Manager is unaffected. The counter resets on the first of the next month. |  |
| T-26 | R-13 | Night extension gives a full day | Work to 03:20, arrive 09:15 the next day and work to 20:00. | Full day, no late mark, no grace deduction. |  |
| T-27 | R-14 | Shift detected from the in-punch | An employee rostered to A shift punches in at 20:05. | Processed on B shift. The override is recorded. Detection windows across shifts do not overlap. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-TIM-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TIM-TC-001 | TIM-UC-011 | TIM-CG-001 | TIM-US-039 | my net attendance for Monday 07 Sep was 8h45m | I open the timesheet for that week | Monday shows 8h45m available to allocate across my projects | System / acceptance | Test |
| TIM-TC-002 | TIM-UC-011 | TIM-CG-001 | TIM-US-039 | I allocate 9h30m to projects on Monday | I try to submit | submission is blocked and Monday is flagged as exceeding attendance by 45 minutes | System / acceptance | Test |
| TIM-TC-003 | TIM-UC-011 | TIM-CG-001 | TIM-US-040 | a submitted timesheet with 6 lines | I return line 4 with the comment 'Wrong task' | lines 1-3 and 5-6 are approved and only line 4 reopens for the employee | System / acceptance | Test |
| TIM-TC-004 | TIM-UC-011 | TIM-CG-001 | TIM-US-040 | the employee corrects and resubmits line 4 | it reaches me | only line 4 is presented for approval | System / acceptance | Test |
| TIM-TC-005 | TIM-UC-011 | TIM-CG-001 | TIM-US-041 | approved lines totalling 120 hours on a project for September | I open the allocation view | I see 120 hours costed by cost centre at the rates effective on each worked date | System / acceptance | Test |
| TIM-TC-006 | TIM-UC-011 | TIM-CG-001 | TIM-US-041 | a line approved after the September costing period closed | allocation runs | the line appears in October as an adjustment referencing September | System / acceptance | Test |
| TIM-TC-007 | TIM-UC-012 | TIM-CG-002 | TIM-US-042 | a 200-metre geofence around a client site assigned to me | I punch IN 50 metres from its centre after a successful selfie | the punch is accepted with source mobile, my coordinates and a selfie reference | System / acceptance | Test |
| TIM-TC-008 | TIM-UC-012 | TIM-CG-002 | TIM-US-042 | I am 1.2 km from the nearest assigned geofence | I try to punch | the punch is refused and the app shows the distance to the nearest geofence | System / acceptance | Test |
| TIM-TC-009 | TIM-UC-012 | TIM-CG-002 | TIM-US-043 | a worker without a recorded consent for server-side matching | they punch from the app | only the match and liveness result is sent with the punch and no template is transmitted | System / acceptance | Test |
| TIM-TC-010 | TIM-UC-012 | TIM-CG-002 | TIM-US-043 | a worker who records consent | they punch | the event stores the consent reference used for server-side matching | System / acceptance | Test |
| TIM-TC-011 | TIM-UC-012 | TIM-CG-002 | TIM-US-044 | a worker fails liveness three times when the tenant limit is three | the third attempt fails | an exception appears on the attendance exception queue with the worker, time and reason | System / acceptance | Test |
| TIM-TC-012 | TIM-UC-012 | TIM-CG-002 | TIM-US-044 | the same worker later punches successfully | I view the exception | it links to the successful punch so I can close it | System / acceptance | Test |
| TIM-TC-013 | TIM-UC-012 | TIM-CG-002 | TIM-US-045 | I am inside the geofence with no signal at 07:58 | I complete the selfie and punch IN | the punch is queued on the phone with a signed 07:58 timestamp and its location and liveness result | System / acceptance | Test |
| TIM-TC-014 | TIM-UC-012 | TIM-CG-002 | TIM-US-045 | the phone regains signal at 09:10 | the queue replays | the platform stores the punch with punch_ts 07:58 and queues the day for derivation | System / acceptance | Test |
| TIM-TC-015 | TIM-UC-013 | TIM-CG-003 | TIM-US-046 | I am on shift A on 18 Sep and my colleague is on shift B the same day, both qualified for each other's line | I request a swap and she accepts | the request goes to our supervisor for approval | System / acceptance | Test |
| TIM-TC-016 | TIM-UC-013 | TIM-CG-003 | TIM-US-046 | the supervisor approves | the roster is republished | I am assigned B and she is assigned A on 18 Sep and both days are queued for recompute | System / acceptance | Test |
| TIM-TC-017 | TIM-UC-013 | TIM-CG-003 | TIM-US-047 | a worker whose approved overtime this week already reaches the weekly limit | they claim an open 12-hour shift | the claim is refused and the message names the weekly limit | System / acceptance | Test |
| TIM-TC-018 | TIM-UC-013 | TIM-CG-003 | TIM-US-047 | a worker without the forklift qualification | they claim an open shift that requires it | the claim is refused naming the missing qualification | System / acceptance | Test |
| TIM-TC-019 | TIM-UC-013 | TIM-CG-003 | TIM-US-048 | three valid claims for an open night shift on 20 Sep | I open the request | I see the claimants in claim order with each one's hours this week | System / acceptance | Test |
| TIM-TC-020 | TIM-UC-013 | TIM-CG-003 | TIM-US-048 | I approve the second claimant | the decision is saved | the other two claims are declined automatically and their claimants notified | System / acceptance | Test |
| TIM-TC-021 | TIM-UC-014 | TIM-CG-004 | TIM-US-049 | a daily target of 8h with core hours 10:00-16:00 | I work 09:00-18:30 on Monday with net 9h30m | 90 minutes are credited to my time bank | System / acceptance | Test |
| TIM-TC-022 | TIM-UC-014 | TIM-CG-004 | TIM-US-049 | I work 10:00-17:00 on Tuesday with net 7h | the day is computed | 60 minutes are debited and my balance shows 30 minutes | System / acceptance | Test |
| TIM-TC-023 | TIM-UC-014 | TIM-CG-004 | TIM-US-050 | core hours 10:00-16:00 | a team member arrives at 10:40 | the day is flagged as a core-hours breach and treated as a late arrival | System / acceptance | Test |
| TIM-TC-024 | TIM-UC-014 | TIM-CG-004 | TIM-US-050 | a team member arrives at 09:50 and leaves at 16:05 | the day is computed | no breach is flagged | System / acceptance | Test |
| TIM-TC-025 | TIM-UC-014 | TIM-CG-004 | TIM-US-051 | a balance of 8h and a policy converting 8h to one day of leave | I request conversion and my manager approves | one day of leave is credited and my bank balance becomes zero | System / acceptance | Test |
| TIM-TC-026 | TIM-UC-014 | TIM-CG-004 | TIM-US-051 | a balance of 5h | I request conversion of 8h | the request is refused and my available balance of 5h is shown | System / acceptance | Test |
| TIM-TC-027 | TIM-UC-015 | TIM-CG-005 | TIM-US-052 | demand of 40 operators on shift A and 25 on shift B for line 3 for a 4-week period | I generate the draft | the draft shows coverage per day against 40 and 25 and lists any unfilled positions | System / acceptance | Test |
| TIM-TC-028 | TIM-UC-015 | TIM-CG-005 | TIM-US-052 | a worker with approved leave on 22 Sep | the draft is generated | the worker is not rostered on 22 Sep | System / acceptance | Test |
| TIM-TC-029 | TIM-UC-015 | TIM-CG-005 | TIM-US-053 | demand that can only be met by planning some workers beyond the weekly limit | the draft is generated | those positions stay unfilled and are reported as shortfall | System / acceptance | Test |
| TIM-TC-030 | TIM-UC-015 | TIM-CG-005 | TIM-US-053 | a worker whose class has Sunday weekly off | the draft is generated | the worker is not rostered on Sundays | System / acceptance | Test |
| TIM-TC-031 | TIM-UC-015 | TIM-CG-005 | TIM-US-054 | a draft roster for my two lines | I open the coverage view | I see each shift's planned headcount by skill against demand | System / acceptance | Test |
| TIM-TC-032 | TIM-UC-015 | TIM-CG-005 | TIM-US-054 | I comment 'need one more welder on B shift, 15 Sep' | I send it back | the roster owner sees the comment against that line, shift and date | System / acceptance | Test |
| TIM-TC-033 | TIM-UC-016 | TIM-CG-006 | TIM-US-055 | Peenya Machining has 120 of 400 November OT hours left | I request 24 hours for 2026-11-14 | the request shows 96 hours remaining after approval and the projected cost | System / acceptance | Test |
| TIM-TC-034 | TIM-UC-016 | TIM-CG-006 | TIM-US-055 | E1030 is a trainee with no overtime eligibility | I include E1030 | E1030 is excluded from payable hours with the reason shown | System / acceptance | Test |
| TIM-TC-035 | TIM-UC-016 | TIM-CG-006 | TIM-US-056 | E1018 worked 3 hours overtime on 2026-11-16 with no pre-approval | I open the pre-lock check | E1018's 3 hours are listed as unapproved | System / acceptance | Test |
| TIM-TC-036 | TIM-UC-016 | TIM-CG-006 | TIM-US-056 | Plant HR marks it non-payable with a reason | I lock inputs | the hours are excluded from pay and retained for reporting | System / acceptance | Test |
| TIM-TC-037 | TIM-UC-016 | TIM-CG-006 | TIM-US-057 | E1019 already has 58 hours that week and the limit is 60 | a 4-hour pre-approval is requested | the approver sees the limit warning and must enter a reason | System / acceptance | Test |
| TIM-TC-038 | TIM-UC-016 | TIM-CG-006 | TIM-US-057 | the approver rejects it | the decision is saved | the rejection reason is recorded | System / acceptance | Test |
| TIM-TC-039 | TIM-UC-017 | TIM-CG-007 | TIM-US-058 | 1,180 meals served at Peenya on 2026-11-04 and 1,172 matched to present workers | reconciliation runs | 8 mismatches are listed for review | System / acceptance | Test |
| TIM-TC-040 | TIM-UC-017 | TIM-CG-007 | TIM-US-058 | a badge not linked to any active worker | the feed is processed | the entry is quarantined and no deduction is made | System / acceptance | Test |
| TIM-TC-041 | TIM-UC-017 | TIM-CG-007 | TIM-US-059 | I am E1029 with 22 meals and 22 bus trips in November | I open self-service | I see each date and the deduction per item | System / acceptance | Test |
| TIM-TC-042 | TIM-UC-017 | TIM-CG-007 | TIM-US-059 | a meal is recorded on a day I was on leave | I raise a query | it routes to Plant HR with the entry attached | System / acceptance | Test |
| TIM-TC-043 | TIM-UC-017 | TIM-CG-007 | TIM-US-060 | November reconciliation is closed | I open the subsidy summary | totals by vendor and cost centre exclude unresolved mismatches | System / acceptance | Test |
| TIM-TC-044 | TIM-UC-017 | TIM-CG-007 | TIM-US-060 | a vendor error is confirmed | the summary is regenerated | the vendor total is reduced accordingly | System / acceptance | Test |
| TIM-TC-045 | TIM-UC-018 | TIM-CG-008 | TIM-US-061 | a policy of 3 office days a week | I declare Monday, Wednesday and Thursday as office | the plan is accepted and I can book desks for those days | System / acceptance | Test |
| TIM-TC-046 | TIM-UC-018 | TIM-CG-008 | TIM-US-061 | I have used all home days for November | I declare another home day | it is routed to my manager for approval | System / acceptance | Test |
| TIM-TC-047 | TIM-UC-018 | TIM-CG-008 | TIM-US-062 | my team of 9 at Bengaluru Corporate Office | I view the week | I see each person's declared location by day | System / acceptance | Test |
| TIM-TC-048 | TIM-UC-018 | TIM-CG-008 | TIM-US-062 | Wednesday has 8 of 9 in the office | I view the week | Wednesday is highlighted as the best team day | System / acceptance | Test |
| TIM-TC-049 | TIM-UC-018 | TIM-CG-008 | TIM-US-063 | E1011 declared home on 2026-11-06 and logged on remotely | the day is derived | it is recorded as work from home, not absent | System / acceptance | Test |
| TIM-TC-050 | TIM-UC-018 | TIM-CG-008 | TIM-US-063 | E1011 declared home but punched in at the office | the day is derived | it is recorded as office presence with a note | System / acceptance | Test |
| TIM-TC-051 | TIM-UC-019 | TIM-CG-009 | TIM-US-064 | I am E1045 at Chakan Works | I opt in after reading the Marathi notice | my consent is recorded with the notice version | System / acceptance | Test |
| TIM-TC-052 | TIM-UC-019 | TIM-CG-009 | TIM-US-064 | I withdraw consent | I pass a gate beacon one minute later | no presence event is stored | System / acceptance | Test |
| TIM-TC-053 | TIM-UC-019 | TIM-CG-009 | TIM-US-065 | a wearable passes three undefined points and one gate beacon | signals are processed | one punch at the gate is stored and nothing else | System / acceptance | Test |
| TIM-TC-054 | TIM-UC-019 | TIM-CG-009 | TIM-US-065 | an audit request | I export beacon data for October | every event shows a defined point and a consent reference | System / acceptance | Test |
| TIM-TC-055 | TIM-UC-019 | TIM-CG-009 | TIM-US-066 | E1045 passes the gate beacon at 16:52 and the exit beacon at 03:05 next morning | the day is derived | the D-shift day shows first in 16:52 and last out 03:05 | System / acceptance | Test |
| TIM-TC-056 | TIM-UC-019 | TIM-CG-009 | TIM-US-066 | two gate beacon events 20 s apart | both are received | the second is marked duplicate and retained | System / acceptance | Test |

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
