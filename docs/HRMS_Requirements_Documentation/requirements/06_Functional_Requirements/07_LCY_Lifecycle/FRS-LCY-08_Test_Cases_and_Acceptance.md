<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-08 — Lifecycle — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-08 |
| Title | Lifecycle — Test Cases and Acceptance |
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
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-LCY-13.


## Scope, Loan, Exit And Talent Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-X402 | Blocking items hold F&F | E1042 Swapnil Kadam, two open blocking items | F&F held; clearing the items releases it | RL-402 | Golden |
| TC-X340 | F&F settles on the last working day | E1068 Dinesh Vaidya, LWD 30 Sep | Fully cleared; settlement on the LWD | RL-340 | Golden |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-30 | R-17 | No dues gates the settlement, and the save defect is gone | Open F&F with one clearance line Pending, then clear it. Save at each step. | Release blocked while Pending; permitted once Cleared or Waived with a reason. The record saves without error — the reported defect is closed. |  |
| T-38 | R-24 | Induction and asset issue gate confirmation | Join an employee, leave one mandatory induction item Pending and attempt confirmation. | Confirmation is blocked. Issued assets appear at F&F for return with their recovery value. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-LCY-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LCY-TC-001 | LCY-UC-009 | LCY-CG-001 | LCY-US-021 | Basanti Naik's package marks identity and previous employment as mandatory | previous employment is Pending on 2026-10-04 | her joining on 2026-10-05 is held | System / acceptance | Test |
| LCY-TC-002 | LCY-UC-009 | LCY-CG-001 | LCY-US-021 | both mandatory components are Clear | the check runs | the joining gate opens | System / acceptance | Test |
| LCY-TC-003 | LCY-UC-009 | LCY-CG-001 | LCY-US-022 | I have not consented | HR attempts to start checks | no request is sent | System / acceptance | Test |
| LCY-TC-004 | LCY-UC-009 | LCY-CG-001 | LCY-US-022 | I consent on 2026-09-21 | checks start | the consent timestamp is recorded with the request | System / acceptance | Test |
| LCY-TC-005 | LCY-UC-010 | LCY-CG-002 | LCY-US-023 | I have 14 months' tenure and the rule requires 12 | I open an internal opening | the Apply action is available | System / acceptance | Test |
| LCY-TC-006 | LCY-UC-010 | LCY-CG-002 | LCY-US-023 | a colleague has 8 months' tenure | they open the same opening | Apply is unavailable and the tenure rule is shown | System / acceptance | Test |
| LCY-TC-007 | LCY-UC-010 | LCY-CG-002 | LCY-US-024 | an employee moves from LE-01 to LE-02 on 2026-11-01 with 9.5 earned leave days | the transfer completes | the LE-02 assignment shows the original service date and 9.5 days earned leave | System / acceptance | Test |
| LCY-TC-008 | LCY-UC-010 | LCY-CG-002 | LCY-US-024 | the transfer completes | payroll looks for an exit | no F&F is created for the employee | System / acceptance | Test |
| LCY-TC-009 | LCY-UC-011 | LCY-CG-003 | LCY-US-025 | E1068 exits on 2026-09-30 | I record Eligible with reason 'voluntary, good standing' | the record shows Eligible and the reason is visible only to HR | System / acceptance | Test |
| LCY-TC-010 | LCY-UC-011 | LCY-CG-003 | LCY-US-025 | E1068 applies again in 2027 | a recruiter opens the application | a returning-employee flag links to his past record | System / acceptance | Test |
| LCY-TC-011 | LCY-UC-011 | LCY-CG-003 | LCY-US-026 | I decline consent | my exit completes | no alumni record exists for me | System / acceptance | Test |
| LCY-TC-012 | LCY-UC-011 | LCY-CG-003 | LCY-US-026 | I consent and later withdraw | the withdrawal is saved | my contact data is removed from the alumni list | System / acceptance | Test |
| LCY-TC-013 | LCY-UC-012 | LCY-CG-004 | LCY-US-027 | I interview E1068 | I record primary reason 'career growth' and secondary 'commute' | both codes are stored against his exit | System / acceptance | Test |
| LCY-TC-014 | LCY-UC-012 | LCY-CG-004 | LCY-US-027 | the exit interview for E1042 is still open on his last working day | F&F release is checked | the open interview does not hold F&F | System / acceptance | Test |
| LCY-TC-015 | LCY-UC-012 | LCY-CG-004 | LCY-US-028 | 3 people left the Assembly department at LOC-PLA in Q3 | I open the Q3 attrition report | the department cell is suppressed and counted under Other | System / acceptance | Test |
| LCY-TC-016 | LCY-UC-012 | LCY-CG-004 | LCY-US-028 | 12 people left LOC-PLA in Q3 | I open the report | reason counts for LOC-PLA are shown without names | System / acceptance | Test |
| LCY-TC-017 | LCY-UC-013 | LCY-CG-005 | LCY-US-029 | E1066 joined on 2026-09-01 with 6 months probation ending 2027-02-28 | the date reaches 2027-01-29 | I receive a review task due 2027-02-28 | System / acceptance | Test |
| LCY-TC-018 | LCY-UC-013 | LCY-CG-005 | LCY-US-029 | I have not submitted by 2027-02-28 | the due date passes | the task escalates to my manager and HR | System / acceptance | Test |
| LCY-TC-019 | LCY-UC-013 | LCY-CG-005 | LCY-US-030 | confirmation is approved | the outcome is recorded | the assignment shows confirmed from 2027-03-01 and the letter is sent for e-signature | System / acceptance | Test |
| LCY-TC-020 | LCY-UC-013 | LCY-CG-005 | LCY-US-030 | an extension of 3 months with a 3-month policy maximum | it is approved | the probation end date becomes 2027-05-31 and a new review is scheduled | System / acceptance | Test |
| LCY-TC-021 | LCY-UC-013 | LCY-CG-005 | LCY-US-031 | my confirmation is approved | the letter is generated | it appears in my documents and asks for my acknowledgement | System / acceptance | Test |
| LCY-TC-022 | LCY-UC-013 | LCY-CG-005 | LCY-US-031 | I acknowledge the letter | I sign | the acknowledgement time is recorded on the letter | System / acceptance | Test |
| LCY-TC-023 | LCY-UC-014 | LCY-CG-006 | LCY-US-032 | E1030 is a trainee entitled only to CL | I preview conversion to WC-PERM from 2026-12-01 | the preview shows EL, CL and SL entitlements, the permanent pay structure and the continuity date | System / acceptance | Test |
| LCY-TC-024 | LCY-UC-014 | LCY-CG-006 | LCY-US-032 | no permanent position is vacant at Peenya Machining | I preview | conversion is blocked with the position status named | System / acceptance | Test |
| LCY-TC-025 | LCY-UC-014 | LCY-CG-006 | LCY-US-033 | a continuity rule counting trainee service for WC-TRN | E1030 is converted on 2026-12-01 having joined on 2026-07-01 | the continuity date is 2026-07-01 | System / acceptance | Test |
| LCY-TC-026 | LCY-UC-014 | LCY-CG-006 | LCY-US-033 | the conversion completes | I open my profile | I see one employee code and worker class Permanent | System / acceptance | Test |
| LCY-TC-027 | LCY-UC-014 | LCY-CG-006 | LCY-US-034 | E1030 is converted | the chain runs | steps for the UAN update and nomination forms are created with owners and SLAs | System / acceptance | Test |
| LCY-TC-028 | LCY-UC-014 | LCY-CG-006 | LCY-US-034 | a step is not done within its SLA | the SLA lapses | it escalates to me | System / acceptance | Test |
| LCY-TC-029 | LCY-UC-015 | LCY-CG-007 | LCY-US-035 | I am E1051 at Medchal Works with 30 days notice, resigning on 2026-11-02 and requesting LWD 2026-11-19 | I view the computation | I see a 12-day shortfall and its buy-out amount | System / acceptance | Test |
| LCY-TC-030 | LCY-UC-015 | LCY-CG-007 | LCY-US-035 | I have 5 days of earned leave | I ask to offset 8 days | the offset is capped at 5 and 7 days are added to the buy-out | System / acceptance | Test |
| LCY-TC-031 | LCY-UC-015 | LCY-CG-007 | LCY-US-036 | a 7-day buy-out approved for E1051 | full and final is computed | a notice recovery line with the approved amount appears | System / acceptance | Test |
| LCY-TC-032 | LCY-UC-015 | LCY-CG-007 | LCY-US-036 | the shortfall is waived by the manager | full and final is computed | no notice recovery line appears and the waiver is referenced | System / acceptance | Test |
| LCY-TC-033 | LCY-UC-015 | LCY-CG-007 | LCY-US-037 | E1051 asks to leave on 2026-11-19 | I open the approval | I see the shortfall, buy-out amount and leave offset | System / acceptance | Test |
| LCY-TC-034 | LCY-UC-015 | LCY-CG-007 | LCY-US-037 | I approve | the decision is saved | the last working day is set to 2026-11-19 | System / acceptance | Test |
| LCY-TC-035 | LCY-UC-016 | LCY-CG-008 | LCY-US-038 | E1068 owns 3 open approvals and 12 engineering documents | the resignation is accepted | the plan lists all 15 items for successor assignment | System / acceptance | Test |
| LCY-TC-036 | LCY-UC-016 | LCY-CG-008 | LCY-US-038 | I approve the plan with successor E1005 for documents | items are completed | document ownership moves to E1005 | System / acceptance | Test |
| LCY-TC-037 | LCY-UC-016 | LCY-CG-008 | LCY-US-039 | my plan has 15 items | I record completion with successor acknowledgement | each item shows completed with the date | System / acceptance | Test |
| LCY-TC-038 | LCY-UC-016 | LCY-CG-008 | LCY-US-039 | a successor declines an item | the decline is recorded | my manager is asked to reassign it | System / acceptance | Test |
| LCY-TC-039 | LCY-UC-016 | LCY-CG-008 | LCY-US-040 | the knowledge-transfer item is configured as blocking for engineering roles | the plan is unsigned on LWD 2026-09-30 | full and final remains on hold | System / acceptance | Test |
| LCY-TC-040 | LCY-UC-016 | LCY-CG-008 | LCY-US-040 | an authorised HR head waives the item with a reason | the waiver is saved | the clearance item closes and settlement can proceed | System / acceptance | Test |

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
| Size | 44 | specified items (table rows) | Counted automatically at generation |
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
