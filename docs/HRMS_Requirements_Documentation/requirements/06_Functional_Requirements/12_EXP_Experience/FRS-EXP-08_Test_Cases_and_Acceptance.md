<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-EXP-08 — Experience — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-EXP-08 |
| Title | Experience — Test Cases and Acceptance |
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
| Related documents | FRS-EXP-00, FRS-EXP-01, FRS-EXP-02, FRS-EXP-03, FRS-EXP-04, FRS-EXP-05, FRS-EXP-06, FRS-EXP-07, FRS-EXP-08, FRS-EXP-09, FRS-EXP-10, FRS-EXP-11, FRS-EXP-12, FRS-EXP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-19, R-20, R-21, R-22 · processes EXP-01–EXP-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-EXP-13.


## Scope, Loan, Exit And Talent Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-E502 | Issued letter retains its template version | TPL-APPT-02 issued to E1066 | Reprint two years later reproduces the original version | RL-502 | Golden |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-33 | R-19 | Star employee flows through to the announcement | Nominate, select and publish a star employee for a period. | The selection raises the announcement without a second manual step, and the certificate carries the period and criteria. |  |
| T-34 | R-20 | Referral award reaches payroll | Refer a candidate against an open requisition, convert the hire and complete the qualifying period. | The award becomes payable, appears as a payroll input rather than a manual entry, and the referral is linked to the position code. |  |
| T-35 | R-21 | Birthday and new joiner announcements raise themselves | Set a date of birth to today and create a joiner dated today. | Both announcements appear without anyone typing them, scoped to the configured audience. |  |
| T-36 | R-22 | Letter issues from a template and is reproducible | Issue an appointment letter, then reopen the issue record. | The letter reproduces exactly as sent. A template referencing a non-existent merge field fails on save, not at issue. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-EXP-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EXP-TC-001 | EXP-UC-004 | EXP-CG-001 | EXP-US-008 | a threshold of 5 | my team has 4 respondents | my manager sees results only at the next level | System / acceptance | Test |
| EXP-TC-002 | EXP-UC-004 | EXP-CG-001 | EXP-US-008 | I answer in Hindi | results are viewed | responses are aggregated with others | System / acceptance | Test |
| EXP-TC-003 | EXP-UC-004 | EXP-CG-001 | EXP-US-009 | 12 respondents in my team | results release | eNPS and question scores are shown | System / acceptance | Test |
| EXP-TC-004 | EXP-UC-004 | EXP-CG-001 | EXP-US-009 | I create an action plan | HR views progress | the plan appears with status | System / acceptance | Test |
| EXP-TC-005 | EXP-UC-005 | EXP-CG-002 | EXP-US-010 | I joined a step challenge | I withdraw consent | my step data is deleted | System / acceptance | Test |
| EXP-TC-006 | EXP-UC-005 | EXP-CG-002 | EXP-US-010 | I open EAP contacts | I view them | no access record is stored | System / acceptance | Test |
| EXP-TC-007 | EXP-UC-005 | EXP-CG-002 | EXP-US-011 | 80 participants | I open the report | only totals are shown | System / acceptance | Test |
| EXP-TC-008 | EXP-UC-005 | EXP-CG-002 | EXP-US-011 | a manager requests individual data | the request is made | it is refused | System / acceptance | Test |
| EXP-TC-009 | EXP-UC-006 | EXP-CG-003 | EXP-US-012 | a cricket community | I join | I see its posts | System / acceptance | Test |
| EXP-TC-010 | EXP-UC-006 | EXP-CG-003 | EXP-US-012 | I post a match update | it passes screening | members see it | System / acceptance | Test |
| EXP-TC-011 | EXP-UC-006 | EXP-CG-003 | EXP-US-013 | a reported post | I remove it with reason | it is hidden and the author is notified | System / acceptance | Test |
| EXP-TC-012 | EXP-UC-006 | EXP-CG-003 | EXP-US-013 | I keep a reported post | I record the decision | the report closes | System / acceptance | Test |
| EXP-TC-013 | EXP-UC-007 | EXP-CG-004 | EXP-US-014 | the minimum group size is 10 and women in grade band M at Medchal Works number 7 | I view representation by site and grade | that cell shows Suppressed and the derivable neighbour cell is also suppressed | System / acceptance | Test |
| EXP-TC-014 | EXP-UC-007 | EXP-CG-004 | EXP-US-014 | promotion data for Chakan Works covers 140 eligible employees | I view promotion rates by gender | rates are shown with group sizes and the 8-quarter trend | System / acceptance | Test |
| EXP-TC-015 | EXP-UC-007 | EXP-CG-004 | EXP-US-015 | an action targets 12% women shift supervisors at Medchal Works by 2027-12-31 from 6% | the Q1 2027 metric is computed at 8% | the action card shows 8% against the 12% target | System / acceptance | Test |
| EXP-TC-016 | EXP-UC-007 | EXP-CG-004 | EXP-US-015 | an action passes its due date unmet | the quarterly review runs | it is flagged overdue to its owner and to me | System / acceptance | Test |
| EXP-TC-017 | EXP-UC-007 | EXP-CG-004 | EXP-US-016 | the Q4 2026 pack is published | I open its suppression log | every suppressed cell is listed with the rule applied | System / acceptance | Test |
| EXP-TC-018 | EXP-UC-007 | EXP-CG-004 | EXP-US-016 | I re-run the pack against its recorded projection version | the run completes | the figures match the published pack | System / acceptance | Test |
| EXP-TC-019 | EXP-UC-008 | EXP-CG-005 | EXP-US-017 | E1032 has opted out of birthdays and kept anniversaries | his birthday on 2026-11-14 arrives | no card or manager prompt is generated | System / acceptance | Test |
| EXP-TC-020 | EXP-UC-008 | EXP-CG-005 | EXP-US-017 | E1032's 5-year anniversary falls on 2026-12-01 | the daily job runs | an anniversary card is posted and his manager is prompted | System / acceptance | Test |
| EXP-TC-021 | EXP-UC-008 | EXP-CG-005 | EXP-US-018 | E1066 works shift C 22:00–06:00 and her birthday is 2026-11-20 | the job runs on 2026-11-19 | I receive the reminder that day | System / acceptance | Test |
| EXP-TC-022 | EXP-UC-008 | EXP-CG-005 | EXP-US-018 | I tap send on the suggested message | it is sent | E1066 receives it in the app | System / acceptance | Test |
| EXP-TC-023 | EXP-UC-009 | EXP-CG-006 | EXP-US-019 | the campaign targets 1,180 production workers at Chakan and Oragadam Works | it launches | each worker receives the approved version in their preferred language | System / acceptance | Test |
| EXP-TC-024 | EXP-UC-009 | EXP-CG-006 | EXP-US-019 | 940 have acknowledged by day 3 | I open the campaign | I see 79.7% acknowledged with a breakdown by site and shift | System / acceptance | Test |
| EXP-TC-025 | EXP-UC-009 | EXP-CG-006 | EXP-US-020 | 32 workers on shift B at Oragadam Works attended the toolbox talk | I record bulk acknowledgement with the attendance sheet | all 32 show acknowledged with channel Toolbox talk | System / acceptance | Test |
| EXP-TC-026 | EXP-UC-009 | EXP-CG-006 | EXP-US-020 | the attendance sheet lists 33 workers and one is not in the campaign audience | I submit the bulk acknowledgement | that worker is rejected with a reason and the other 32 are recorded | System / acceptance | Test |

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
| Size | 31 | specified items (table rows) | Counted automatically at generation |
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
