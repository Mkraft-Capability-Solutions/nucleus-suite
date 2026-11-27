<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# VV-02 — Client Acceptance Tests

| Attribute | Value |
| :--- | :--- |
| Document ID | VV-02 |
| Title | Client Acceptance Tests |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | QA / Test Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | VV |
| Related documents | VV-01, UAT-01, TR-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Client acceptance tests derived from the 26 client demo points, with the golden-dataset records that prove each one.

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-01 | R-01 | Work session crossing midnight is one session | Punch IN 08:00, OUT 20:30, IN 21:15, OUT 03:20 next day against a 12-hour A shift. | One attendance record on day 1. Gross work hours 19:20. Break minutes 45. Day status Present. Day 2 is not marked absent. |  |
| T-02 | R-01 | Break appears in the break register | Run the break register for the same employee and date. | One row: start 20:30, end 21:15, 45 minutes, break type Meal or Unclassified. |  |
| T-03 | R-01 | OT is computed on gross hours | Same session, employee OT eligible on all days. | OT hours 7:20. |  |
| T-04 | R-05 | OT suppressed on a working day for rest-day-only employees | Same session for an employee whose OT eligibility basis is rest days and holidays only, on a working day. | OT hours zero. The same employee working a rest day earns OT normally. |  |
| T-05 | R-02 | Team calendar range spans more than one month | As a reporting manager, set from 01 January to 15 March and pick one team member. | History returns for the full range. Export matches the screen. A non-reportee cannot be selected. |  |
| T-06 | R-03 | Contractual employee gets no rest day | Create a contractual employee and run attendance over a week containing the usual weekly off. | No weekly off is generated. Payroll pays on days present. |  |
| T-07 | R-04 | Helper and Employee differ within the same third-party category | Create one third-party Employee and one third-party Helper and run a week of attendance. | The Employee receives a rest day; the Helper does not. Neither required a code change. |  |
| T-08 | R-06 | Early return credits the balance and marks present | Approve 10 days of EL from 1 to 10. Record an actual return on day 7. | 4 days credited back to the EL balance as a reversal. Days 7 to 10 marked present. Both visible in the leave ledger. |  |
| T-09 | R-06 | Three-level approval is enforced | Submit a leave application and attempt to approve as HR Head before the Supervisor acts. | Blocked. Each of Supervisor, HOD and HR Head is recorded with actor and timestamp. |  |
| T-10 | R-07 | COFF lapses on schedule | Earn a COFF on 10 March with a 60-day window. Advance the system date past 9 May. | Status moves to Lapsed on 9 May, a ledger entry is written naming the lapse run, and the balance drops. |  |
| T-11 | R-08 | Senior grade annual credit | Run accrual on 1 January for an employee at or above the configured grade rank. | 18 EL, 6 CL and 6 SL credited in one movement. |  |
| T-12 | R-08 | Monthly EL accrual for other employees | Run accrual monthly for a non-senior employee with more than six months of service. | 1.5 EL each month, 18 across the year. CL and SL credited once in January. |  |
| T-13 | R-08 | New joiner EL hold and catch-up | Join an employee on 1 March and run accrual monthly. | No EL until 31 August. On 1 September a single credit of 9 EL. |  |
| T-14 | R-08 | New joiner CL and SL proration | Join employees on 15 January, 20 April and 2 December. | 6, 4 and 1 CL and SL respectively. Joining after 4 December follows the answer to the open question, not an assumption. |  |
| T-15 | R-08 | CL cannot be combined with EL or SL | Apply 2 CL for 10 and 11 June, then 3 EL for 12 to 14 June. | The second application is blocked as a contiguous absence, not accepted because it is a separate application. |  |
| T-16 | R-08 | Monthly caps hold | Apply 3 CL in one month; separately apply 11 EL in one month. | Both blocked at the third CL day and the eleventh EL day. |  |
| T-17 | R-08 | Year end encashes EL and lapses CL and SL | Run year end in Preview, then Commit, for an employee with 7 EL, 2 CL and 3 SL. | Preview and Commit report identical figures. Commit encashes 7 EL and lapses 5 days. |  |
| T-18 | R-09 | Plant user cannot see head office salary | As a plant user, open the employee, the salary register, an export and the API for an employee paid at head office. | Attendance is visible. Salary and rate structure are not, in all four surfaces. |  |
| T-19 | R-10 | Second loan blocked until repayment | Apply for a loan while one is outstanding, and separately apply for a salary advance. | Both blocked with the same reason. Both clear when the first loan closes. |  |
| T-20 | R-10 | Guarantor interlock works both ways | Name an employee as guarantor, then have that employee apply for a loan and be named guarantor again. | Both blocked. Both clear when the guaranteed loan is fully repaid. |  |
| T-21 | R-10 | Loan ceiling by service | Apply with four years of service and with six years, on a basic of 40,000. | Ceilings of 160,000 and 240,000. Exceeding either requires a recorded Director approval. |  |
| T-22 | R-11 | OT cannot be paid with salary | Attempt to run OT payment before the linked payroll run is closed. | Blocked. After payroll closes, the OT run executes and posts separately. |  |
| T-23 | R-12 | Gate pass entitlement and credit | Take two passes of two hours in a month, then attempt a third. | The third is blocked. Approved hours are added to net work hours; a pending pass adds nothing. |  |
| T-24 | R-13 | Shift thresholds produce the right day status | On a 12-hour shift record net hours of 11:45, 11:00 and 6:00. | Present, Half day and Absent. Repeat on 10, 9 and 8-hour shifts against their own thresholds. |  |
| T-25 | R-13 | Grace, late count and grade exemption | Arrive 08:10 then 08:20 four times in a month, for a non-exempt employee and for an Assistant Manager. | 08:10 is within grace. The fourth late gives the non-exempt employee a half day; the Assistant Manager is unaffected. The counter resets on the first of the next month. |  |
| T-26 | R-13 | Night extension gives a full day | Work to 03:20, arrive 09:15 the next day and work to 20:00. | Full day, no late mark, no grace deduction. |  |
| T-27 | R-14 | Shift detected from the in-punch | An employee rostered to A shift punches in at 20:05. | Processed on B shift. The override is recorded. Detection windows across shifts do not overlap. |  |
| T-28 | R-15 | Employee master sync and failure handling | Change an employee in the ERP; then force a sync failure. | The change lands in Nucleus. The failed record appears in a queue with its reason and can be retried. |  |
| T-29 | R-16 | Payroll posting is idempotent | Post the payroll journal, then re-run the same period. | Debits equal credits. The second run does not create a duplicate posting. A failure is visible in the posting log. |  |
| T-30 | R-17 | No dues gates the settlement, and the save defect is gone | Open F&F with one clearance line Pending, then clear it. Save at each step. | Release blocked while Pending; permitted once Cleared or Waived with a reason. The record saves without error — the reported defect is closed. |  |
| T-31 | R-27 | Form F generates from the employee record | Join an employee and generate Form F. | Populated from the employee record, in the correct state variant, with a gapless serial in the register. |  |
| T-32 | R-18 | Statutory forms generate in the right state variant | Generate Form 28, Form 18 and Form 36 for an establishment, and repeat for an establishment in another state. | Each is populated from live data and follows that state's prescribed layout. No figure is typed in. |  |
| T-33 | R-19 | Star employee flows through to the announcement | Nominate, select and publish a star employee for a period. | The selection raises the announcement without a second manual step, and the certificate carries the period and criteria. |  |
| T-34 | R-20 | Referral award reaches payroll | Refer a candidate against an open requisition, convert the hire and complete the qualifying period. | The award becomes payable, appears as a payroll input rather than a manual entry, and the referral is linked to the position code. |  |
| T-35 | R-21 | Birthday and new joiner announcements raise themselves | Set a date of birth to today and create a joiner dated today. | Both announcements appear without anyone typing them, scoped to the configured audience. |  |
| T-36 | R-22 | Letter issues from a template and is reproducible | Issue an appointment letter, then reopen the issue record. | The letter reproduces exactly as sent. A template referencing a non-existent merge field fails on save, not at issue. |  |
| T-37 | R-23 | Organisation chart follows the employee record | Change an employee's reporting manager and reopen the chart. | The chart reflects the change with no separate hierarchy maintenance. Department-wise view groups correctly. |  |
| T-38 | R-24 | Induction and asset issue gate confirmation | Join an employee, leave one mandatory induction item Pending and attempt confirmation. | Confirmation is blocked. Issued assets appear at F&F for return with their recovery value. |  |
| T-39 | R-25 | Replacement does not add headcount | Raise a requisition with reason Replacement against a vacated position code. | Headcount against the department is unchanged. A New position requisition increases it. |  |
| T-40 | R-26 | Requisition beyond sanctioned strength is stopped | Raise a requisition that takes the department past its approved manpower. | The requisition is blocked or routed to the additional approval level. It does not pass with a warning alone. |  |

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
| Size | 40 | specified items (table rows) | Counted automatically at generation |
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
