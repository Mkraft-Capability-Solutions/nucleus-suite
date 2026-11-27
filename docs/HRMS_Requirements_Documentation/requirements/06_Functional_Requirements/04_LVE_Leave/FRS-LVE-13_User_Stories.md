<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-13 — Leave — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-13 |
| Title | Leave — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Leave |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Derived from FRS-LVE-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

40 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 27, Should 11, Could 2.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| LVE-US-001 | HR operations | senior-grade employees to receive their full annual entitlement automatically on 1 January | Must | LVE-UC-001 |
| LVE-US-002 | Employee / worker | my earned leave to start with a single catch-up credit when I complete six months | Must | LVE-UC-001 |
| LVE-US-003 | Auditor | accrual re-runs to be provably incapable of double-crediting | Must | LVE-UC-001 |
| LVE-US-004 | HR operations | CL and SL for new joiners to be prorated from the joining-month table automatically | Must | LVE-UC-002 |
| LVE-US-005 | HR operations | workers in non-eligible classes to receive no leave credit at all | Must | LVE-UC-002 |
| LVE-US-006 | Implementation consultant | joining dates without a proration row to raise a task instead of guessing | Should | LVE-UC-002 |
| LVE-US-007 | Employee / worker | to see my balance as it will stand on my leave start date, including credits that will expire first | Must | LVE-UC-003 |
| LVE-US-008 | Employee / worker | a request that breaks the CL combination rule to be refused at once with the rule named | Must | LVE-UC-003 |
| LVE-US-009 | Employee / worker | monthly caps to be enforced at validation with the counted days shown | Must | LVE-UC-003 |
| LVE-US-010 | Director / approver | the chain to stop me approving before the Supervisor and HOD have acted | Must | LVE-UC-004 |
| LVE-US-011 | Manager / supervisor | to approve or reject a team member's leave from my inbox with a comment | Must | LVE-UC-004 |
| LVE-US-012 | HR operations | to edit or close a request at any stage with a recorded reason | Must | LVE-UC-004 |
| LVE-US-013 | HR operations | to record an early return and have the unused days credited back and marked present together | Must | LVE-UC-005 |
| LVE-US-014 | Payroll manager | an early return touching a closed payroll period to arrive as arrears | Must | LVE-UC-005 |
| LVE-US-015 | Employee / worker | to see the reversal in my leave ledger next to the original debit | Should | LVE-UC-005 |
| LVE-US-016 | Employee / worker | each comp-off day to carry its own 60-day expiry | Must | LVE-UC-006 |
| LVE-US-017 | Employee / worker | comp-off I take to use my earliest-expiring day first | Must | LVE-UC-006 |
| LVE-US-018 | Plant HR / time office | comp-off clocks to run past 31 December | Should | LVE-UC-006 |
| LVE-US-019 | HR operations | to preview year-end results before committing them | Must | LVE-UC-007 |
| LVE-US-020 | Payroll manager | EL encashment to arrive as a payroll input valued on the statutory wage base | Must | LVE-UC-007 |
| LVE-US-021 | Employee / worker | my birthday leave credited in its own window | Should | LVE-UC-007 |
| LVE-US-022 | Employee / worker | to see every transaction that makes up my balance | Must | LVE-UC-008 |
| LVE-US-023 | HR operations | to read an employee's balance as at a past date | Should | LVE-UC-008 |
| LVE-US-024 | Employee / worker | to apply for maternity leave with my medical certificate in one step | Must | LVE-UC-009 |
| LVE-US-025 | HR operations | the span to move when the actual delivery date differs from the planned one | Must | LVE-UC-009 |
| LVE-US-026 | Manager / supervisor | a reminder before my team member returns | Should | LVE-UC-009 |
| LVE-US-027 | Employee / worker | to see how a sabbatical affects my service and benefits before I submit | Must | LVE-UC-010 |
| LVE-US-028 | Payroll manager | pay to stop and restart automatically on the approved and actual return dates | Must | LVE-UC-010 |
| LVE-US-029 | Employee / worker | to donate EL to a colleague within policy limits | Could | LVE-UC-011 |
| LVE-US-030 | HR operations | donor and recipient entries to be written together and linked | Could | LVE-UC-011 |
| LVE-US-031 | Employee / worker | approved leave to appear as out-of-office on my calendar | Should | LVE-UC-012 |
| LVE-US-032 | Manager / supervisor | early returns to shorten the calendar entry | Should | LVE-UC-012 |
| LVE-US-033 | Employee / worker | to choose my optional holidays from my location's list | Must | LVE-UC-013 |
| LVE-US-034 | Plant HR / time office | to see how many people will be off on each optional holiday | Should | LVE-UC-013 |
| LVE-US-035 | HR operations | to replay last year's leave under a draft policy | Must | LVE-UC-014 |
| LVE-US-036 | Finance | the change in encashment liability valued in rupees | Must | LVE-UC-014 |
| LVE-US-037 | Manager / supervisor | to see whether a policy change will reduce coverage on my lines | Should | LVE-UC-014 |
| LVE-US-038 | Manager / supervisor | to set a minimum number of operators per shift on my line | Must | LVE-UC-015 |
| LVE-US-039 | Employee / worker | to know at the time of applying whether my dates are constrained | Must | LVE-UC-015 |
| LVE-US-040 | Plant HR / time office | notification of every approved coverage breach | Should | LVE-UC-015 |

## 2. Stories with acceptance criteria

### LVE-US-001 · Run the leave accrual job

As a **HR operations**, I want senior-grade employees to receive their full annual entitlement automatically on 1 January, so that they can plan the year without HR keying credits by hand.

Priority: **Must** · Use case: LVE-UC-001 · Realises: LVE-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1004 is in the AGM band and active on 1 January 2027 | the accrual run executes on 1 January 2027 | 18 EL, 6 CL and 6 SL are credited in one movement with source_ref naming the band policy |
| 2 | E1019 is in the standard band with more than six months of service | the monthly run executes on 1 February 2027 | 1.5 EL is credited and no further CL or SL is posted because both were credited in January |

### LVE-US-002 · Run the leave accrual job

As a **Employee / worker**, I want my earned leave to start with a single catch-up credit when I complete six months, so that I am not short-changed by the eligibility wait.

Priority: **Must** · Use case: LVE-UC-001 · Realises: LVE-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee joined on 1 March 2026 in the standard band | monthly runs execute from March to August 2026 | no EL credit is posted in any of those months |
| 2 | E1067 Ankita Bhargava completes six months on 16 September 2026 | the nightly run executes on 16 September 2026 | a single credit of 9 EL is posted and the October run posts 1.5 EL |

### LVE-US-003 · Run the leave accrual job

As a **Auditor**, I want accrual re-runs to be provably incapable of double-crediting, so that balances can be trusted without reconciliation spreadsheets.

Priority: **Must** · Use case: LVE-UC-001 · Realises: LVE-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September 2026 run has posted 1.5 EL for E1019 | the September run is triggered again | the ledger still holds exactly one September EL credit for E1019 and the run log marks the tuple as already posted |
| 2 | a run stopped after crediting 4,000 of 9,000 tuples | the run is restarted | the remaining 5,000 tuples are credited and the first 4,000 rows are unchanged |

### LVE-US-004 · Prorate casual and sick leave for a new joiner

As a **HR operations**, I want CL and SL for new joiners to be prorated from the joining-month table automatically, so that every joiner gets the same treatment without manual calculation.

Priority: **Must** · Use case: LVE-UC-002 · Realises: LVE-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1060 Jayanthi Elangovan joined on 06 April 2026 in a leave-eligible class | her assignment is activated | 4 CL and 4 SL are credited with source_ref citing the proration rule |
| 2 | employees join on 15 January and 2 December 2026 | their assignments are activated | they receive 6 CL and 6 SL, and 1 CL and 1 SL, respectively |

### LVE-US-005 · Prorate casual and sick leave for a new joiner

As a **HR operations**, I want workers in non-eligible classes to receive no leave credit at all, so that contract and gig workers are not shown balances they cannot use.

Priority: **Must** · Use case: LVE-UC-002 · Realises: LVE-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a worker joins on 10 June 2026 under the contract worker class | the assignment is activated | no CL or SL credit is written and the leave tab shows 'Not leave-eligible by worker class' |
| 2 | a GET trainee joins on 10 June 2026 | the assignment is activated | 3 CL is credited on the trainee scheme |

### LVE-US-006 · Prorate casual and sick leave for a new joiner

As a **Implementation consultant**, I want joining dates without a proration row to raise a task instead of guessing, so that no entitlement is granted that the client has not confirmed.

Priority: **Should** · Use case: LVE-UC-002 · Realises: LVE-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the proration table has no row after 4 December | an employee joins on 10 December 2026 | no CL or SL credit is posted and an HR operations task names the missing table row |
| 2 | the client's answer has been loaded as a row for 5 to 31 December | the task is re-processed | the credit from that row is posted once |

### LVE-US-007 · Apply for leave with rule validation

As a **Employee / worker**, I want to see my balance as it will stand on my leave start date, including credits that will expire first, so that I do not apply for days I will not have.

Priority: **Must** · Use case: LVE-UC-003 · Realises: LVE-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I hold 4 comp-off days of which 2 expire on 20 October 2026 | I start an application for comp-off from 25 October 2026 | the screen shows a projected balance of 2 days and flags the 2 expiring days |
| 2 | my projected EL on 1 November 2026 is 3 days | I apply for 4 EL days from 1 November | submission is blocked and the projected balance of 3 days is shown |

### LVE-US-008 · Apply for leave with rule validation

As a **Employee / worker**, I want a request that breaks the CL combination rule to be refused at once with the rule named, so that I can re-plan instead of waiting for an approver to reject it.

Priority: **Must** · Use case: LVE-UC-003 · Realises: LVE-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 2 CL for 10 and 11 June 2026 are approved for E1019 | E1019 applies for 3 EL from 12 to 14 June 2026 | the request is set to REJECTED_BY_RULE and the message names the CL combination rule |
| 2 | LV-2026-0802 for E1019 combines CL and EL | it is validated | no approval instance is created |

### LVE-US-009 · Apply for leave with rule validation

As a **Employee / worker**, I want monthly caps to be enforced at validation with the counted days shown, so that I understand exactly why the request failed.

Priority: **Must** · Use case: LVE-UC-003 · Realises: LVE-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 2 CL are already approved in June 2026 | I apply for 1 more CL day in June | the request is blocked at the third CL day and the message names the cap of 2 CL a month |
| 2 | 10 EL are already approved in July 2026 | I apply for 1 more EL day in July | the request is blocked at the eleventh EL day |

### LVE-US-010 · Approve leave through the three-level chain

As a **Director / approver**, I want the chain to stop me approving before the Supervisor and HOD have acted, so that the client's three-level policy cannot be bypassed.

Priority: **Must** · Use case: LVE-UC-004 · Realises: LVE-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a leave request is pending at the Supervisor step | the HR Head opens it and selects Approve | the action is blocked with the message 'Pending at Supervisor' |
| 2 | Supervisor and HOD have approved | the HR Head approves | the request is APPROVED and the history shows three entries, each with actor and timestamp |

### LVE-US-011 · Approve leave through the three-level chain

As a **Manager / supervisor**, I want to approve or reject a team member's leave from my inbox with a comment, so that my decision and reason reach the employee immediately.

Priority: **Must** · Use case: LVE-UC-004 · Realises: LVE-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a 3-day EL request from my direct report is at my step | I reject it with the comment 'Audit week' | the request becomes REJECTED, the employee is notified with the comment and no ledger debit exists |
| 2 | the same request is approved at all three steps | the final approval completes | the ledger shows a debit of 3 EL referencing the credits consumed |

### LVE-US-012 · Approve leave through the three-level chain

As a **HR operations**, I want to edit or close a request at any stage with a recorded reason, so that exceptions can be handled without losing the audit trail.

Priority: **Must** · Use case: LVE-UC-004 · Realises: LVE-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | LV-2026-0774 for E1043 Neha Mishra is approved | HR closes it on 14 September with the reason 'Returned early, recorded by HR' | the audit entry records the HR actor, timestamp and reason and leave.request.edited is emitted |
| 2 | an HR edit is attempted without a reason | HR selects Save | the save is refused and the reason field is marked required |

### LVE-US-013 · Record early return and re-credit unused leave

As a **HR operations**, I want to record an early return and have the unused days credited back and marked present together, so that the balance and the attendance never disagree on the payslip.

Priority: **Must** · Use case: LVE-UC-005 · Realises: LVE-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 10 days of EL from 1 to 10 October 2026 are approved | a return on 7 October is recorded | a reversal of 4 EL referencing the original debit is written and 7 to 10 October are marked Present |
| 2 | the recompute enqueue fails during the same transaction | the return is saved | no reversal row exists and the request remains APPROVED |

### LVE-US-014 · Record early return and re-credit unused leave

As a **Payroll manager**, I want an early return touching a closed payroll period to arrive as arrears, so that a run that has been paid is never reopened.

Priority: **Must** · Use case: LVE-UC-005 · Realises: LVE-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September 2026 run is closed and an early return releases 28 to 30 September | the return is recorded on 2 October | payroll.arrears.requested is raised for the October run and the September run totals are unchanged |
| 2 | no released date falls in a locked period | the return is recorded | no arrears request is raised |

### LVE-US-015 · Record early return and re-credit unused leave

As a **Employee / worker**, I want to see the reversal in my leave ledger next to the original debit, so that I can confirm the days came back.

Priority: **Should** · Use case: LVE-UC-005 · Realises: LVE-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | LV-2026-0774 for E1043 Neha Mishra has an early return recorded | she opens the leave balance and ledger | the original debit and the reversal credit appear as linked entries |
| 2 | the reversal is posted | the projected EL balance is read | it has increased by exactly the released days |

### LVE-US-016 · Credit, consume and lapse compensatory off

As a **Employee / worker**, I want each comp-off day to carry its own 60-day expiry, so that a later credit is not lost because an earlier one expired.

Priority: **Must** · Use case: LVE-UC-006 · Realises: LVE-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1028 holds CO-2026-0231 from July and CO-2026-0288 credited on 06 September 2026 | the lapse job runs on 10 September and on 05 November | the July credit lapses on 10 September and the September credit runs until 05 November |
| 2 | a comp-off is earned on 10 March 2026 with a 60-day window | the system date passes 9 May 2026 | the credit moves to Lapsed on 9 May with a ledger entry naming the lapse run |

### LVE-US-017 · Credit, consume and lapse compensatory off

As a **Employee / worker**, I want comp-off I take to use my earliest-expiring day first, so that I lose as little as possible to expiry.

Priority: **Must** · Use case: LVE-UC-006 · Realises: LVE-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I hold one credit expiring 20 November and one expiring 15 December 2026 | I avail 1 comp-off day on 12 November | the consumption row references the credit expiring 20 November |
| 2 | I hold 1 day expiring 20 November and 1 expiring 15 December | I avail 2 days on 12 and 13 November | two consumption rows are written, one against each credit |

### LVE-US-018 · Credit, consume and lapse compensatory off

As a **Plant HR / time office**, I want comp-off clocks to run past 31 December, so that December holiday working is not cut short by the year end.

Priority: **Should** · Use case: LVE-UC-006 · Realises: LVE-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | comp-off is credited on 15 December 2026 | year-end processing runs on 31 December | the credit remains open with expires_on 13 February 2027 |
| 2 | E1044 Rahul Gaikwad holds an unconsumed credit | its expiry date arrives | a Lapse row is written on that date and leave.compoff.lapsed is emitted |

### LVE-US-019 · Process leave year end and birthday leave

As a **HR operations**, I want to preview year-end results before committing them, so that errors are caught before any balance or payroll input is written.

Priority: **Must** · Use case: LVE-UC-007 · Realises: LVE-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee closes the year with 7 EL, 2 CL and 3 SL and the EL cap is 0 | year end is run in Preview and then Commit | both report 7 EL encashed and 5 days lapsed, and only Commit writes ledger rows |
| 2 | a preview has been produced | no Commit is made | the ledger holds no year-end rows for that year |

### LVE-US-020 · Process leave year end and birthday leave

As a **Payroll manager**, I want EL encashment to arrive as a payroll input valued on the statutory wage base, so that the encashment line is computed consistently with PF and gratuity.

Priority: **Must** · Use case: LVE-UC-007 · Realises: LVE-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee with 50 EL closing and a 45-day cap | year end is committed | 45 EL carry forward and a payroll input for 5 days is raised in the named run |
| 2 | the January 2027 regular run has locked inputs | the encashment input is raised | it is placed in the next open regular run and HR operations is notified |

### LVE-US-021 · Process leave year end and birthday leave

As a **Employee / worker**, I want my birthday leave credited in its own window, so that I can take it without using my EL.

Priority: **Should** · Use case: LVE-UC-007 · Realises: LVE-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my birthday is 14 March and the client's window is configured on the leave type | the window opens | one birthday leave day is credited with leave.credit.posted emitted |
| 2 | the window has closed without use | the balance is read the next day | the birthday leave day is no longer available |

### LVE-US-022 · View projected leave balance and its ledger trail

As a **Employee / worker**, I want to see every transaction that makes up my balance, so that I can verify it myself.

Priority: **Must** · Use case: LVE-UC-008 · Realises: LVE-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my EL ledger has credits of 13.5, a debit of 6 and a reversal of 2 for 2026 | I open the leave balance and ledger | the balance shows 9.5 and each of the three entries with its date and source |
| 2 | I select one debit | I open its detail | the leave request it came from is shown |

### LVE-US-023 · View projected leave balance and its ledger trail

As a **HR operations**, I want to read an employee's balance as at a past date, so that I can answer disputes about what was available when leave was applied.

Priority: **Should** · Use case: LVE-UC-008 · Realises: LVE-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee in my entity disputes a rejection on 3 August 2026 | I project the balance as at 3 August 2026 | only ledger rows effective on or before that date are counted |
| 2 | an employee outside my entity grant | I request the balance | the request is refused and an access event is logged |

### LVE-US-024 · Manage maternity and paternity leave

As a **Employee / worker**, I want to apply for maternity leave with my medical certificate in one step, so that I do not have to visit HR in person.

Priority: **Must** · Use case: LVE-UC-009 · Realises: LVE-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I attach a medical certificate and an expected delivery date of 20 January 2027 | I submit the application | the request is created with the document linked and HR operations receives a verification task |
| 2 | I submit without the required certificate | validation runs | submission is blocked with the message naming the missing evidence |

### LVE-US-025 · Manage maternity and paternity leave

As a **HR operations**, I want the span to move when the actual delivery date differs from the planned one, so that attendance and payroll match what actually happened.

Priority: **Must** · Use case: LVE-UC-009 · Realises: LVE-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | approved maternity leave starts on 10 January 2027 | HR records the actual delivery on 2 January 2027 | the span starts on 2 January and attendance from 2 January shows maternity leave |
| 2 | the change touches a locked December run | it is saved | an arrears request is raised for the next open run |

### LVE-US-026 · Manage maternity and paternity leave

As a **Manager / supervisor**, I want a reminder before my team member returns, so that I can plan the handover and nursing-break schedule.

Priority: **Should** · Use case: LVE-UC-009 · Realises: LVE-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the return date is 15 July 2027 | 1 July 2027 arrives | the manager and employee receive a return-to-work reminder |
| 2 | the employee confirms return on 15 July | the shift for July is read | the configured nursing-break minutes appear on her attendance days |

### LVE-US-027 · Grant and close a leave of absence

As a **Employee / worker**, I want to see how a sabbatical affects my service and benefits before I submit, so that I can decide with full information.

Priority: **Must** · Use case: LVE-UC-010 · Realises: LVE-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the sabbatical type is configured as service-continuous with benefits suspended | I select it with dates 1 February to 31 May 2027 | the form states service continues, benefits are suspended and pay stops for 120 days |
| 2 | I change the type to unpaid leave | the dates stay the same | the stated effects update to the unpaid leave configuration |

### LVE-US-028 · Grant and close a leave of absence

As a **Payroll manager**, I want pay to stop and restart automatically on the approved and actual return dates, so that no manual hold is needed.

Priority: **Must** · Use case: LVE-UC-010 · Realises: LVE-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a leave of absence from 1 February to 31 May 2027 is approved | the February run is calculated | the employee has zero earnings for February with the absence named as the reason |
| 2 | HR confirms the actual return on 20 May 2027 | the May run is calculated | pay is computed from 20 May |

### LVE-US-029 · Donate earned leave to a colleague or shared bank

As a **Employee / worker**, I want to donate EL to a colleague within policy limits, so that I can help them without breaching my own minimum balance.

Priority: **Could** · Use case: LVE-UC-011 · Realises: LVE-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my projected EL is 12, the minimum retained is 5 and the annual limit is 5 | I offer 5 days to a colleague | the request is created and routed to HR operations |
| 2 | the same balances | I offer 8 days | the request is blocked and 5 days is shown as the maximum |

### LVE-US-030 · Donate earned leave to a colleague or shared bank

As a **HR operations**, I want donor and recipient entries to be written together and linked, so that the ledgers always balance.

Priority: **Could** · Use case: LVE-UC-011 · Realises: LVE-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a 3-day donation is approved | posting completes | the donor shows a 3-day debit and the recipient a 3-day credit, each referencing the other |
| 2 | the recipient write fails | posting is attempted | neither entry exists |

### LVE-US-031 · Publish approved leave to the corporate calendar

As a **Employee / worker**, I want approved leave to appear as out-of-office on my calendar, so that colleagues do not book me while I am away.

Priority: **Should** · Use case: LVE-UC-012 · Realises: LVE-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my 2 to 4 December 2026 EL is approved and my calendar is linked | approval completes | an out-of-office entry for 2 to 4 December appears without the leave type |
| 2 | I cancel the leave on 28 November | cancellation completes | the entry is removed from my calendar |

### LVE-US-032 · Publish approved leave to the corporate calendar

As a **Manager / supervisor**, I want early returns to shorten the calendar entry, so that the team calendar shows when the person is actually back.

Priority: **Should** · Use case: LVE-UC-012 · Realises: LVE-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an entry runs 1 to 10 October 2026 | an early return on 7 October is recorded | the entry now ends on 6 October |
| 2 | the corporate calendar is unavailable during the update | the retry window is still open | the update is retried and succeeds when the calendar recovers |

### LVE-US-033 · Choose optional and restricted holidays

As a **Employee / worker**, I want to choose my optional holidays from my location's list, so that I take the days that matter to me.

Priority: **Must** · Use case: LVE-UC-013 · Realises: LVE-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my site list has 6 optional holidays and a quota of 2 | I select two of them | both are recorded and my remaining quota shows 0 |
| 2 | my quota is 0 | I try to select a third | the selection is refused with the two chosen holidays listed |

### LVE-US-034 · Choose optional and restricted holidays

As a **Plant HR / time office**, I want to see how many people will be off on each optional holiday, so that I can plan shift cover.

Priority: **Should** · Use case: LVE-UC-013 · Realises: LVE-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 14 employees at my site selected 12 November 2026 | I open the site's optional holiday view | 12 November shows 14 expected absences |
| 2 | one of them withdraws the selection | I refresh the view | 12 November shows 13 |

### LVE-US-035 · Simulate a leave policy change before publishing

As a **HR operations**, I want to replay last year's leave under a draft policy, so that I can show the impact of a change before asking for approval.

Priority: **Must** · Use case: LVE-UC-014 · Realises: LVE-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a draft raising LS-STD carry-forward from 30 to 45 days | I simulate leave year 2026 for LE-01 and LE-02 | the report shows lapse days avoided and balance change per site |
| 2 | the simulation has finished | I open E1043 Neha Mishra's sample | I see her ledger trail under both the live and the draft policy |

### LVE-US-036 · Simulate a leave policy change before publishing

As a **Finance**, I want the change in encashment liability valued in rupees, so that I can provide for it before the policy goes live.

Priority: **Must** · Use case: LVE-UC-014 · Realises: LVE-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the 45-day carry-forward scenario | the simulation completes | incremental liability is shown per entity and cost centre |
| 2 | I compare the 40-day and 45-day scenarios | both are displayed | the liability difference between them is stated |

### LVE-US-037 · Simulate a leave policy change before publishing

As a **Manager / supervisor**, I want to see whether a policy change will reduce coverage on my lines, so that I can plan staffing before the change takes effect.

Priority: **Should** · Use case: LVE-UC-014 · Realises: LVE-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the draft adds an average of 1.5 leave days per worker per year at Peenya Works | I view coverage impact | projected extra absence per line and month is shown |
| 2 | live balances | a simulation is run | no employee's balance screen changes |

### LVE-US-038 · Flag leave requests that breach team coverage

As a **Manager / supervisor**, I want to set a minimum number of operators per shift on my line, so that leave approvals never leave a line short.

Priority: **Must** · Use case: LVE-UC-015 · Realises: LVE-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I set Peenya Machining shift A minimum to 8 from 2026-11-01 | 11 operators are rostered and 3 have approved leave on 2026-11-21 | a new request for that date is flagged as a breach |
| 2 | a flagged request | I try to approve it without a reason | approval is refused until I enter a reason |

### LVE-US-039 · Flag leave requests that breach team coverage

As a **Employee / worker**, I want to know at the time of applying whether my dates are constrained, so that I can pick a date the line can spare me.

Priority: **Must** · Use case: LVE-UC-015 · Realises: LVE-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 2026-11-21 is at minimum coverage | I select it in the leave form | I see the coverage warning and 2026-11-24 suggested as having headroom |
| 2 | I change my dates to 2026-11-24 | validation reruns | no coverage warning is shown |

### LVE-US-040 · Flag leave requests that breach team coverage

As a **Plant HR / time office**, I want notification of every approved coverage breach, so that I can arrange cover before the shift.

Priority: **Should** · Use case: LVE-UC-015 · Realises: LVE-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a breach on Peenya Machining shift A on 2026-11-21 is approved | approval is recorded | I receive a notification naming the line, shift, date and shortfall of 1 |
| 2 | the roster for December is unpublished | a request for December is submitted | the verdict states coverage is not evaluable |

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
| Size | 120 | specified items (table rows) | Counted automatically at generation |
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
