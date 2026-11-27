<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-08 — Compliance — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-08 |
| Title | Compliance — Test Cases and Acceptance |
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
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-CMP-13.


## Scope, Loan, Exit And Talent Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-C382 | Form F generated in the joining chain | FRM-F-2026-0112 for E1066 | Produced as a joining step, not chased afterwards | RL-382 | Golden |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-31 | R-27 | Form F generates from the employee record | Join an employee and generate Form F. | Populated from the employee record, in the correct state variant, with a gapless serial in the register. |  |
| T-32 | R-18 | Statutory forms generate in the right state variant | Generate Form 28, Form 18 and Form 36 for an establishment, and repeat for an establishment in another state. | Each is populated from live data and follows that state's prescribed layout. No figure is typed in. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-CMP-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMP-TC-001 | CMP-UC-007 | CMP-CG-001 | CMP-US-019 | August 2026 LE-01 payroll is closed for 412 employees | a shadow run under the code packs completes | a per-employee difference report is produced and live August results are unchanged | System / acceptance | Test |
| CMP-TC-002 | CMP-UC-007 | CMP-CG-001 | CMP-US-019 | the shadow run shows 37 employees with a changed PF base | I open the report | each of the 37 shows the old base, new base and the rule that caused the change | System / acceptance | Test |
| CMP-TC-003 | CMP-UC-007 | CMP-CG-001 | CMP-US-020 | the wages code pack is PUBLISHED with effective_from 2027-04-01 | the date arrives | the pack becomes EFFECTIVE and the replaced pack becomes SUPERSEDED | System / acceptance | Test |
| CMP-TC-004 | CMP-UC-007 | CMP-CG-001 | CMP-US-020 | no effective date is notified | I try to activate the pack | activation is refused and the pack stays inactive | System / acceptance | Test |
| CMP-TC-005 | CMP-UC-008 | CMP-CG-002 | CMP-US-021 | I lodge a complaint at 10:15 on 2026-10-12 | the case is created | I receive an acknowledgement with a case number and my manager cannot see the case | System / acceptance | Test |
| CMP-TC-006 | CMP-UC-008 | CMP-CG-002 | CMP-US-021 | an HR operations user without the committee role searches for my case number | the search runs | no result is returned and the attempt is logged | System / acceptance | Test |
| CMP-TC-007 | CMP-UC-008 | CMP-CG-002 | CMP-US-022 | the inquiry window is configured as 90 days and the inquiry started on 2026-10-15 | day 80 is reached with no findings recorded | the presiding officer receives a reminder showing 10 days remaining | System / acceptance | Test |
| CMP-TC-008 | CMP-UC-008 | CMP-CG-002 | CMP-US-022 | the window passes with no findings | the deadline passes | the case is flagged overdue and escalated to the compliance owner | System / acceptance | Test |
| CMP-TC-009 | CMP-UC-008 | CMP-CG-002 | CMP-US-023 | 4 cases were received in 2026, 3 closed and 1 open | the 2026 report is generated | it shows those counts with no names or identifying details | System / acceptance | Test |
| CMP-TC-010 | CMP-UC-008 | CMP-CG-002 | CMP-US-023 | one case is overdue | the report is generated | the overdue case is counted in the pending column | System / acceptance | Test |
| CMP-TC-011 | CMP-UC-009 | CMP-CG-003 | CMP-US-024 | a contractor's licence for LOC-HYD expires on 2026-09-30 | I deploy one of its workers from 2026-10-01 | the deployment is blocked with the message that the licence has expired | System / acceptance | Test |
| CMP-TC-012 | CMP-UC-009 | CMP-CG-003 | CMP-US-024 | the expiry is 30 days away | the daily check runs on 2026-08-31 | the compliance owner receives a renewal alert | System / acceptance | Test |
| CMP-TC-013 | CMP-UC-009 | CMP-CG-003 | CMP-US-025 | two contractors have workers at LOC-PLA in September 2026 | the register is generated | it lists each worker under the right contractor with attendance days taken from the time records | System / acceptance | Test |
| CMP-TC-014 | CMP-UC-009 | CMP-CG-003 | CMP-US-025 | the August challan of one contractor has not been uploaded | the verification runs | the contractor is flagged and its August invoice is held | System / acceptance | Test |
| CMP-TC-015 | CMP-UC-010 | CMP-CG-004 | CMP-US-026 | FY 2025-26 payroll for LE-01 and LE-02 is POSTED | the disclosure is generated | each metric shows its definition, query version, record count and as-at timestamp | System / acceptance | Test |
| CMP-TC-016 | CMP-UC-010 | CMP-CG-004 | CMP-US-026 | I drill into total wages for LE-02 | the drill-down opens | it lists the posted runs whose totals sum to the disclosed figure | System / acceptance | Test |
| CMP-TC-017 | CMP-UC-010 | CMP-CG-004 | CMP-US-027 | the disclosure set is locked | a user edits the headcount figure | the edit is refused | System / acceptance | Test |
| CMP-TC-018 | CMP-UC-010 | CMP-CG-004 | CMP-US-027 | a correction is needed after locking | a new version is created with a reason | both versions are retained and the difference is shown | System / acceptance | Test |
| CMP-TC-019 | CMP-UC-011 | CMP-CG-005 | CMP-US-028 | E1066 joins Chakan Works on 2026-09-01 | the joining chain runs | harassment-prevention awareness is assigned due 2026-09-15 and factory safety due 2026-09-03 | System / acceptance | Test |
| CMP-TC-020 | CMP-UC-011 | CMP-CG-005 | CMP-US-028 | a person moves from office to plant role | the change becomes effective | factory safety is assigned with a 2-day due date | System / acceptance | Test |
| CMP-TC-021 | CMP-UC-011 | CMP-CG-005 | CMP-US-029 | IND-2026-0090 for E1066 is due 2026-09-15 and incomplete | 2026-09-16 arrives | I receive an overdue escalation naming E1066 and the course | System / acceptance | Test |
| CMP-TC-022 | CMP-UC-011 | CMP-CG-005 | CMP-US-029 | it is still incomplete 7 days later | 2026-09-23 arrives | HR operations receives the escalation | System / acceptance | Test |
| CMP-TC-023 | CMP-UC-012 | CMP-CG-006 | CMP-US-030 | I am at Medchal Works line 2 | I report a hand injury with two photos at 14:20 | the incident is created with site, line and time and my supervisor is notified | System / acceptance | Test |
| CMP-TC-024 | CMP-UC-012 | CMP-CG-006 | CMP-US-030 | I report a hazard anonymously | the report is saved | no identity is stored and the site EHS lead receives it | System / acceptance | Test |
| CMP-TC-025 | CMP-UC-012 | CMP-CG-006 | CMP-US-031 | a lost-time injury classified as notifiable under the Telangana pack | classification is confirmed | an obligation is created with its due time and a prepared notice | System / acceptance | Test |
| CMP-TC-026 | CMP-UC-012 | CMP-CG-006 | CMP-US-031 | the notice is filed with acknowledgement reference TS-ACC-88213 | I record it | the obligation closes and the reference is kept against the incident | System / acceptance | Test |
| CMP-TC-027 | CMP-UC-012 | CMP-CG-006 | CMP-US-032 | an action 'install light curtain on press 4' due 2026-11-20 | the due date passes without closure | the action is escalated to the site head | System / acceptance | Test |
| CMP-TC-028 | CMP-UC-012 | CMP-CG-006 | CMP-US-032 | all actions are verified | the compliance owner closes the incident | the incident shows closed with the verification date | System / acceptance | Test |
| CMP-TC-029 | CMP-UC-013 | CMP-CG-007 | CMP-US-033 | I submit an anonymous disclosure about falsified inspection records at Chakan Works | it is saved | I receive a case key and no identity is stored | System / acceptance | Test |
| CMP-TC-030 | CMP-UC-013 | CMP-CG-007 | CMP-US-033 | the investigator posts a question | I log in with my case key | I can read and reply without revealing my identity | System / acceptance | Test |
| CMP-TC-031 | CMP-UC-013 | CMP-CG-007 | CMP-US-034 | a disclosure naming Peenya plant head E1016 | the case is routed | E1016 has no access to the case even though E1016 holds HR scope at the site | System / acceptance | Test |
| CMP-TC-032 | CMP-UC-013 | CMP-CG-007 | CMP-US-034 | the case is not acknowledged within 7 days | the deadline passes | it escalates to the committee chair | System / acceptance | Test |
| CMP-TC-033 | CMP-UC-013 | CMP-CG-007 | CMP-US-035 | 12 closed cases in Q3 2026 | I open the outcome report | counts by category, site and outcome are shown with no reporter details | System / acceptance | Test |
| CMP-TC-034 | CMP-UC-013 | CMP-CG-007 | CMP-US-035 | a site with fewer than 3 cases in a category | the report is shown | that cell is combined into 'other' to avoid identification | System / acceptance | Test |
| CMP-TC-035 | CMP-UC-014 | CMP-CG-008 | CMP-US-036 | the Chakan Works factory licence MH/FAC/2015/03327 expires on 2026-12-31 | the date reaches 2026-10-02 | a renewal obligation is opened and I am alerted | System / acceptance | Test |
| CMP-TC-036 | CMP-UC-014 | CMP-CG-008 | CMP-US-036 | the renewed licence is recorded with validity to 2027-12-31 | I save it | the old version is end-dated and the obligation closes | System / acceptance | Test |
| CMP-TC-037 | CMP-UC-014 | CMP-CG-008 | CMP-US-037 | Peenya Works has 23 permanent, 2 trainee and 5 third-party workers posted | the pack is prepared | the manpower statement shows those counts | System / acceptance | Test |
| CMP-TC-038 | CMP-UC-014 | CMP-CG-008 | CMP-US-037 | headcount above the licensed capacity | the pack is prepared | the variance is flagged before filing | System / acceptance | Test |
| CMP-TC-039 | CMP-UC-014 | CMP-CG-008 | CMP-US-038 | vendor VN-01's licence expired on 2026-10-31 | HR tries to deploy a new VN-01 worker on 2026-11-02 | deployment is blocked with the expired licence named | System / acceptance | Test |
| CMP-TC-040 | CMP-UC-014 | CMP-CG-008 | CMP-US-038 | VN-01 uploads a renewed licence | the compliance owner verifies it | deployments are unblocked | System / acceptance | Test |
| CMP-TC-041 | CMP-UC-015 | CMP-CG-009 | CMP-US-039 | an inspector at Oragadam Works asks for the October 2026 muster roll | I request it | the register for LOC-CHN and October is produced from posted records | System / acceptance | Test |
| CMP-TC-042 | CMP-UC-015 | CMP-CG-009 | CMP-US-039 | records for two workers are incomplete | the register is produced | the gaps are listed and an action is created | System / acceptance | Test |
| CMP-TC-043 | CMP-UC-015 | CMP-CG-009 | CMP-US-040 | an order to display the abstract of the Act in Tamil within 15 days | I record it on 2026-11-04 | an action due 2026-11-19 is assigned to the site HR | System / acceptance | Test |
| CMP-TC-044 | CMP-UC-015 | CMP-CG-009 | CMP-US-040 | the action is overdue | the deadline passes | it is escalated to me and the site head | System / acceptance | Test |
| CMP-TC-045 | CMP-UC-015 | CMP-CG-009 | CMP-US-041 | 3 open actions at Oragadam and 1 at Medchal | I open the dashboard | I see 4 open actions with sites and due dates | System / acceptance | Test |
| CMP-TC-046 | CMP-UC-015 | CMP-CG-009 | CMP-US-041 | all actions for a visit are verified and the report is filed | the compliance owner closes it | the visit no longer appears as open | System / acceptance | Test |

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
| Size | 49 | specified items (table rows) | Counted automatically at generation |
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
