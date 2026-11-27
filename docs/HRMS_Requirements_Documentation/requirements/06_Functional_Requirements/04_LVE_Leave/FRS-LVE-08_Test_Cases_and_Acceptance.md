<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-08 — Leave — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-08 |
| Title | Leave — Test Cases and Acceptance |
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
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-LVE-13.


## Leave Golden Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-L171 | Six-month EL wait then a single credit | E1067 Ankita Bhargava, completes six months 16 Sep 2026 | 9 EL days credited on completion, then 1.5/month | RL-171 | Golden |
| TC-L173 | Band-based annual credit | E1004 (AGM band) vs E1019 (standard) | 18 EL on 1 Jan vs 1.5 EL per month | RL-173 | Golden |
| TC-L180 | Joining-month proration | E1060 Jayanthi Elangovan, joined 06 Apr 2026 | 4 CL and 4 SL | RL-180 | Golden |
| TC-L192 | Combination rule blocks CL with EL | LV-2026-0802, E1019 | Rejected at validation before the chain, message names the rule | RL-192 | Golden |
| TC-L193 | Monthly cap on EL | 11th EL day in one month | Rejected at validation with the cap named | RL-193 | Golden |
| TC-L200 | Early return marks present and re-credits | LV-2026-0774, E1043 Neha Mishra | Original debit plus a reversal credit for the unused days | RL-200, RL-201 | Golden |
| TC-L15 | HR edit on an approved request is logged | LV-2026-0774, HR closed on 14 Sep | Actor, timestamp and reason recorded | RL-015 | Golden |
| TC-L210 | Two comp-off credits on separate clocks | CO-2026-0231 and CO-2026-0288, E1028 | July credit lapses 10 Sep; 06 Sep credit runs to 05 Nov | RL-210 | Golden |
| TC-L212 | Unconsumed comp-off lapses | E1044 Rahul Gaikwad's lapsed credit | Lapse row written on its own expiry date | RL-212 | Golden |

## Property Tests

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PR08 | Accrual re-run produces no second credit | Any period | Idempotency key holds | RL-172 | Property |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
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

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-LVE-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LVE-TC-001 | LVE-UC-009 | LVE-CG-001 | LVE-US-024 | I attach a medical certificate and an expected delivery date of 20 January 2027 | I submit the application | the request is created with the document linked and HR operations receives a verification task | System / acceptance | Test |
| LVE-TC-002 | LVE-UC-009 | LVE-CG-001 | LVE-US-024 | I submit without the required certificate | validation runs | submission is blocked with the message naming the missing evidence | System / acceptance | Test |
| LVE-TC-003 | LVE-UC-009 | LVE-CG-001 | LVE-US-025 | approved maternity leave starts on 10 January 2027 | HR records the actual delivery on 2 January 2027 | the span starts on 2 January and attendance from 2 January shows maternity leave | System / acceptance | Test |
| LVE-TC-004 | LVE-UC-009 | LVE-CG-001 | LVE-US-025 | the change touches a locked December run | it is saved | an arrears request is raised for the next open run | System / acceptance | Test |
| LVE-TC-005 | LVE-UC-009 | LVE-CG-001 | LVE-US-026 | the return date is 15 July 2027 | 1 July 2027 arrives | the manager and employee receive a return-to-work reminder | System / acceptance | Test |
| LVE-TC-006 | LVE-UC-009 | LVE-CG-001 | LVE-US-026 | the employee confirms return on 15 July | the shift for July is read | the configured nursing-break minutes appear on her attendance days | System / acceptance | Test |
| LVE-TC-007 | LVE-UC-010 | LVE-CG-002 | LVE-US-027 | the sabbatical type is configured as service-continuous with benefits suspended | I select it with dates 1 February to 31 May 2027 | the form states service continues, benefits are suspended and pay stops for 120 days | System / acceptance | Test |
| LVE-TC-008 | LVE-UC-010 | LVE-CG-002 | LVE-US-027 | I change the type to unpaid leave | the dates stay the same | the stated effects update to the unpaid leave configuration | System / acceptance | Test |
| LVE-TC-009 | LVE-UC-010 | LVE-CG-002 | LVE-US-028 | a leave of absence from 1 February to 31 May 2027 is approved | the February run is calculated | the employee has zero earnings for February with the absence named as the reason | System / acceptance | Test |
| LVE-TC-010 | LVE-UC-010 | LVE-CG-002 | LVE-US-028 | HR confirms the actual return on 20 May 2027 | the May run is calculated | pay is computed from 20 May | System / acceptance | Test |
| LVE-TC-011 | LVE-UC-011 | LVE-CG-003 | LVE-US-029 | my projected EL is 12, the minimum retained is 5 and the annual limit is 5 | I offer 5 days to a colleague | the request is created and routed to HR operations | System / acceptance | Test |
| LVE-TC-012 | LVE-UC-011 | LVE-CG-003 | LVE-US-029 | the same balances | I offer 8 days | the request is blocked and 5 days is shown as the maximum | System / acceptance | Test |
| LVE-TC-013 | LVE-UC-011 | LVE-CG-003 | LVE-US-030 | a 3-day donation is approved | posting completes | the donor shows a 3-day debit and the recipient a 3-day credit, each referencing the other | System / acceptance | Test |
| LVE-TC-014 | LVE-UC-011 | LVE-CG-003 | LVE-US-030 | the recipient write fails | posting is attempted | neither entry exists | System / acceptance | Test |
| LVE-TC-015 | LVE-UC-012 | LVE-CG-004 | LVE-US-031 | my 2 to 4 December 2026 EL is approved and my calendar is linked | approval completes | an out-of-office entry for 2 to 4 December appears without the leave type | System / acceptance | Test |
| LVE-TC-016 | LVE-UC-012 | LVE-CG-004 | LVE-US-031 | I cancel the leave on 28 November | cancellation completes | the entry is removed from my calendar | System / acceptance | Test |
| LVE-TC-017 | LVE-UC-012 | LVE-CG-004 | LVE-US-032 | an entry runs 1 to 10 October 2026 | an early return on 7 October is recorded | the entry now ends on 6 October | System / acceptance | Test |
| LVE-TC-018 | LVE-UC-012 | LVE-CG-004 | LVE-US-032 | the corporate calendar is unavailable during the update | the retry window is still open | the update is retried and succeeds when the calendar recovers | System / acceptance | Test |
| LVE-TC-019 | LVE-UC-013 | LVE-CG-005 | LVE-US-033 | my site list has 6 optional holidays and a quota of 2 | I select two of them | both are recorded and my remaining quota shows 0 | System / acceptance | Test |
| LVE-TC-020 | LVE-UC-013 | LVE-CG-005 | LVE-US-033 | my quota is 0 | I try to select a third | the selection is refused with the two chosen holidays listed | System / acceptance | Test |
| LVE-TC-021 | LVE-UC-013 | LVE-CG-005 | LVE-US-034 | 14 employees at my site selected 12 November 2026 | I open the site's optional holiday view | 12 November shows 14 expected absences | System / acceptance | Test |
| LVE-TC-022 | LVE-UC-013 | LVE-CG-005 | LVE-US-034 | one of them withdraws the selection | I refresh the view | 12 November shows 13 | System / acceptance | Test |
| LVE-TC-023 | LVE-UC-014 | LVE-CG-006 | LVE-US-035 | a draft raising LS-STD carry-forward from 30 to 45 days | I simulate leave year 2026 for LE-01 and LE-02 | the report shows lapse days avoided and balance change per site | System / acceptance | Test |
| LVE-TC-024 | LVE-UC-014 | LVE-CG-006 | LVE-US-035 | the simulation has finished | I open E1043 Neha Mishra's sample | I see her ledger trail under both the live and the draft policy | System / acceptance | Test |
| LVE-TC-025 | LVE-UC-014 | LVE-CG-006 | LVE-US-036 | the 45-day carry-forward scenario | the simulation completes | incremental liability is shown per entity and cost centre | System / acceptance | Test |
| LVE-TC-026 | LVE-UC-014 | LVE-CG-006 | LVE-US-036 | I compare the 40-day and 45-day scenarios | both are displayed | the liability difference between them is stated | System / acceptance | Test |
| LVE-TC-027 | LVE-UC-014 | LVE-CG-006 | LVE-US-037 | the draft adds an average of 1.5 leave days per worker per year at Peenya Works | I view coverage impact | projected extra absence per line and month is shown | System / acceptance | Test |
| LVE-TC-028 | LVE-UC-014 | LVE-CG-006 | LVE-US-037 | live balances | a simulation is run | no employee's balance screen changes | System / acceptance | Test |
| LVE-TC-029 | LVE-UC-015 | LVE-CG-007 | LVE-US-038 | I set Peenya Machining shift A minimum to 8 from 2026-11-01 | 11 operators are rostered and 3 have approved leave on 2026-11-21 | a new request for that date is flagged as a breach | System / acceptance | Test |
| LVE-TC-030 | LVE-UC-015 | LVE-CG-007 | LVE-US-038 | a flagged request | I try to approve it without a reason | approval is refused until I enter a reason | System / acceptance | Test |
| LVE-TC-031 | LVE-UC-015 | LVE-CG-007 | LVE-US-039 | 2026-11-21 is at minimum coverage | I select it in the leave form | I see the coverage warning and 2026-11-24 suggested as having headroom | System / acceptance | Test |
| LVE-TC-032 | LVE-UC-015 | LVE-CG-007 | LVE-US-039 | I change my dates to 2026-11-24 | validation reruns | no coverage warning is shown | System / acceptance | Test |
| LVE-TC-033 | LVE-UC-015 | LVE-CG-007 | LVE-US-040 | a breach on Peenya Machining shift A on 2026-11-21 is approved | approval is recorded | I receive a notification naming the line, shift, date and shortfall of 1 | System / acceptance | Test |
| LVE-TC-034 | LVE-UC-015 | LVE-CG-007 | LVE-US-040 | the roster for December is unpublished | a request for December is submitted | the verdict states coverage is not evaluable | System / acceptance | Test |

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
| Size | 54 | specified items (table rows) | Counted automatically at generation |
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
