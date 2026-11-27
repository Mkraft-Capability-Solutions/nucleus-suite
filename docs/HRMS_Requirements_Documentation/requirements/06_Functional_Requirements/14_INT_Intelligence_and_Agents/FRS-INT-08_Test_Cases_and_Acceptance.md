<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-INT-08 — Intelligence & Agents — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-INT-08 |
| Title | Intelligence & Agents — Test Cases and Acceptance |
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
| Related documents | FRS-INT-00, FRS-INT-01, FRS-INT-02, FRS-INT-03, FRS-INT-04, FRS-INT-05, FRS-INT-06, FRS-INT-07, FRS-INT-08, FRS-INT-09, FRS-INT-10, FRS-INT-11, FRS-INT-12, FRS-INT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-08 · processes INT-01–INT-04 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-INT-13.


The source has no TC- cases for this domain; verification is by the client acceptance tests below and the user-story criteria in FRS-INT-13.

## Client acceptance tests (T-xx)

_No entries in source for this scope._

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-INT-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| INT-TC-001 | INT-UC-005 | INT-CG-001 | INT-US-010 | access to headcount data | I group by site | counts per site appear | System / acceptance | Test |
| INT-TC-002 | INT-UC-005 | INT-CG-001 | INT-US-010 | salary fields restricted for me | I browse fields | salary is not listed | System / acceptance | Test |
| INT-TC-003 | INT-UC-005 | INT-CG-001 | INT-US-011 | a recipient without salary access | the schedule runs | salary columns are masked | System / acceptance | Test |
| INT-TC-004 | INT-UC-005 | INT-CG-001 | INT-US-011 | the agent drafts a report | the user has not confirmed | the report is not saved | System / acceptance | Test |
| INT-TC-005 | INT-UC-006 | INT-CG-002 | INT-US-012 | annualised attrition of 14% at Peenya | I drill to departments | department rates appear | System / acceptance | Test |
| INT-TC-006 | INT-UC-006 | INT-CG-002 | INT-US-012 | a department with 3 women | I view gender split | it is suppressed | System / acceptance | Test |
| INT-TC-007 | INT-UC-006 | INT-CG-002 | INT-US-013 | OT data for six months | I open the OT dashboard | a monthly trend appears | System / acceptance | Test |
| INT-TC-008 | INT-UC-006 | INT-CG-002 | INT-US-013 | I select Pune only | I filter | only Pune data appears | System / acceptance | Test |
| INT-TC-009 | INT-UC-007 | INT-CG-003 | INT-US-014 | a headcount dataset with names | the export runs | names are removed and person IDs pseudonymised | System / acceptance | Test |
| INT-TC-010 | INT-UC-007 | INT-CG-003 | INT-US-014 | a schema change | the next run executes | a new schema version is documented | System / acceptance | Test |
| INT-TC-011 | INT-UC-007 | INT-CG-003 | INT-US-015 | an export of 25,000 rows | it completes | the log shows 25,000 rows and the definition version | System / acceptance | Test |
| INT-TC-012 | INT-UC-007 | INT-CG-003 | INT-US-015 | a failed export | retries exhaust | an alert is logged | System / acceptance | Test |
| INT-TC-013 | INT-UC-008 | INT-CG-004 | INT-US-016 | a monthly return due on the 15th | the agent prepares it on the 10th | I see it for review with the rule pack version | System / acceptance | Test |
| INT-TC-014 | INT-UC-008 | INT-CG-004 | INT-US-016 | I confirm and file | filing completes | evidence is stored with my identity | System / acceptance | Test |
| INT-TC-015 | INT-UC-008 | INT-CG-004 | INT-US-017 | a filed report | I open it | rule pack version is shown | System / acceptance | Test |
| INT-TC-016 | INT-UC-008 | INT-CG-004 | INT-US-017 | the agent attempted to file | I view the ledger | the refused attempt is listed | System / acceptance | Test |
| INT-TC-017 | INT-UC-009 | INT-CG-005 | INT-US-018 | the CNC programmer profile requires 5-axis programming at level 3 and 17 of 26 people are at level 1 or 2 | I open the analysis | the heatmap shows a gap of 17 for that skill at Peenya Works | System / acceptance | Test |
| INT-TC-018 | INT-UC-009 | INT-CG-005 | INT-US-018 | a manager has not confirmed an inferred skill | the heatmap is computed | the unconfirmed skill is excluded and counted separately | System / acceptance | Test |
| INT-TC-019 | INT-UC-009 | INT-CG-005 | INT-US-019 | the agent recommends the 5-axis path for 9 people, within the cap of 50 | I remove E1034 and confirm | 8 assignments are created and each appears in the action ledger with my confirmation | System / acceptance | Test |
| INT-TC-020 | INT-UC-009 | INT-CG-005 | INT-US-019 | a recommendation covers 60 learners against a cap of 50 | the policy gate evaluates it | it is denied and recorded with the reason | System / acceptance | Test |
| INT-TC-021 | INT-UC-009 | INT-CG-005 | INT-US-020 | requisition REQ-2026-131 was raised from a skills recommendation | I open its action ledger entry | I see the recommendation, the dry-run, the approver and the time of approval | System / acceptance | Test |
| INT-TC-022 | INT-UC-009 | INT-CG-005 | INT-US-020 | the requisition is later cancelled | I view the entry | the reversal is linked to the original action | System / acceptance | Test |
| INT-TC-023 | INT-UC-010 | INT-CG-006 | INT-US-021 | I receive the consent request for the design-production study | I open it | it states that only sender, recipient, time and count are used, never content, and that data is deleted after 90 days | System / acceptance | Test |
| INT-TC-024 | INT-UC-010 | INT-CG-006 | INT-US-021 | I withdraw consent on day 20 | the withdrawal is processed | my metadata is deleted within 24 hours | System / acceptance | Test |
| INT-TC-025 | INT-UC-010 | INT-CG-006 | INT-US-022 | the study covers 31 teams with at least 8 consenting members each | I open the map | design engineering Pune and production Medchal show a weak link with link strength in the bottom 10% | System / acceptance | Test |
| INT-TC-026 | INT-UC-010 | INT-CG-006 | INT-US-022 | a team has 6 consenting members | the map is built | that team is merged into its parent unit | System / acceptance | Test |
| INT-TC-027 | INT-UC-011 | INT-CG-007 | INT-US-023 | 3 team members are approved on leave on 2026-11-24 and shift A has 22 rostered | I open E1066's request | the widget shows 3 overlapping absences and coverage of 82% for that day | System / acceptance | Test |
| INT-TC-028 | INT-UC-011 | INT-CG-007 | INT-US-023 | the analytics projection is unavailable | I open the request | the widget shows Context unavailable and I can still approve | System / acceptance | Test |
| INT-TC-029 | INT-UC-011 | INT-CG-007 | INT-US-024 | I add monthly overtime hours per worker to the overtime approval screen | I preview it as a sample supervisor at Chakan Works | it shows only that supervisor's team | System / acceptance | Test |
| INT-TC-030 | INT-UC-011 | INT-CG-007 | INT-US-024 | I configure a wellbeing metric with minimum group size 5 | a manager of 4 opens the screen | the widget is suppressed | System / acceptance | Test |

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
| Size | 30 | specified items (table rows) | Counted automatically at generation |
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
