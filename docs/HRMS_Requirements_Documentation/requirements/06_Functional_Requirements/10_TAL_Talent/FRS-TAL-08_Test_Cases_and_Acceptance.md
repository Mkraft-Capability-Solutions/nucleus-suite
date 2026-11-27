<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TAL-08 — Talent — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TAL-08 |
| Title | Talent — Test Cases and Acceptance |
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
| Related documents | FRS-TAL-00, FRS-TAL-01, FRS-TAL-02, FRS-TAL-03, FRS-TAL-04, FRS-TAL-05, FRS-TAL-06, FRS-TAL-07, FRS-TAL-08, FRS-TAL-09, FRS-TAL-10, FRS-TAL-11, FRS-TAL-12, FRS-TAL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-25, R-26 · processes TAL-01–TAL-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-TAL-13.


## Scope, Loan, Exit And Talent Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-R461 | Replacement consumes no fresh sanction | REQ-2026-0037 against POS-2214 | Approved without consuming sanctioned strength | RL-461 | Golden |
| TC-R462 | Addition blocked at full sanction | REQ-2026-0041, OU-111 at Peenya, 24 of 24 | Blocked at approval; override required | RL-462 | Negative |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-39 | R-25 | Replacement does not add headcount | Raise a requisition with reason Replacement against a vacated position code. | Headcount against the department is unchanged. A New position requisition increases it. |  |
| T-40 | R-26 | Requisition beyond sanctioned strength is stopped | Raise a requisition that takes the department past its approved manpower. | The requisition is blocked or routed to the additional approval level. It does not pass with a warning alone. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-TAL-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TAL-TC-001 | TAL-UC-006 | TAL-CG-001 | TAL-US-012 | an approved requisition and three configured channels | I publish to all three | each channel shows live with its own tracked link | System / acceptance | Test |
| TAL-TC-002 | TAL-UC-006 | TAL-CG-001 | TAL-US-012 | the requisition is filled | the status changes | the posting is withdrawn from all three channels | System / acceptance | Test |
| TAL-TC-003 | TAL-UC-006 | TAL-CG-001 | TAL-US-013 | 40 applicants from the careers site and 60 from a job board with 2 and 1 hires | I open source effectiveness | conversion shows 5% and 1.7% respectively | System / acceptance | Test |
| TAL-TC-004 | TAL-UC-006 | TAL-CG-001 | TAL-US-013 | an applicant first came via a referral link | the applicant is hired | the hire is attributed to referral | System / acceptance | Test |
| TAL-TC-005 | TAL-UC-007 | TAL-CG-002 | TAL-US-014 | a candidate with mobile 9876543210 already exists | a new application uses the same mobile | a merge proposal is shown | System / acceptance | Test |
| TAL-TC-006 | TAL-UC-007 | TAL-CG-002 | TAL-US-014 | I reject the merge because they are different people | I confirm | two separate records remain | System / acceptance | Test |
| TAL-TC-007 | TAL-UC-007 | TAL-CG-002 | TAL-US-015 | I consent only for the current role | the requisition closes | my data is scheduled for purge | System / acceptance | Test |
| TAL-TC-008 | TAL-UC-007 | TAL-CG-002 | TAL-US-015 | I consent for future roles for 12 months | 12 months pass | my data is purged | System / acceptance | Test |
| TAL-TC-009 | TAL-UC-008 | TAL-CG-003 | TAL-US-016 | two other panelists have submitted | I open the candidate before submitting | their scores are hidden | System / acceptance | Test |
| TAL-TC-010 | TAL-UC-008 | TAL-CG-003 | TAL-US-016 | I submit my scorecard | I reopen the candidate | all three scorecards are visible | System / acceptance | Test |
| TAL-TC-011 | TAL-UC-008 | TAL-CG-003 | TAL-US-017 | a panel of three with one common free hour on Thursday | I request scheduling | Thursday's slot is proposed | System / acceptance | Test |
| TAL-TC-012 | TAL-UC-008 | TAL-CG-003 | TAL-US-017 | the candidate accepts the slot | acceptance is recorded | invitations go to all panelists and the candidate | System / acceptance | Test |
| TAL-TC-013 | TAL-UC-009 | TAL-CG-004 | TAL-US-018 | a range maximum of 15,00,000 | I create an offer at 16,00,000 | it routes to an additional approver with excess 1,00,000 shown | System / acceptance | Test |
| TAL-TC-014 | TAL-UC-009 | TAL-CG-004 | TAL-US-018 | an offer at 14,00,000 | I create it | it follows the standard chain | System / acceptance | Test |
| TAL-TC-015 | TAL-UC-009 | TAL-CG-004 | TAL-US-019 | an approved and released offer | I e-sign | pre-boarding tasks appear for me | System / acceptance | Test |
| TAL-TC-016 | TAL-UC-009 | TAL-CG-004 | TAL-US-019 | I do not sign before expiry | the expiry date passes | the offer shows expired | System / acceptance | Test |
| TAL-TC-017 | TAL-UC-010 | TAL-CG-005 | TAL-US-020 | team goal reduce scrap by 10% | I create a goal reduce scrap on line 3 by 15% weighted 40% | the goal shows linked to the team goal | System / acceptance | Test |
| TAL-TC-018 | TAL-UC-010 | TAL-CG-005 | TAL-US-020 | my goals total 90% | I submit | submission is blocked showing 90% | System / acceptance | Test |
| TAL-TC-019 | TAL-UC-010 | TAL-CG-005 | TAL-US-021 | an objective with no linked team goal | I open the alignment view | the objective is flagged as uncovered | System / acceptance | Test |
| TAL-TC-020 | TAL-UC-010 | TAL-CG-005 | TAL-US-021 | all objectives linked | I open the view | no flags are shown | System / acceptance | Test |
| TAL-TC-021 | TAL-UC-011 | TAL-CG-006 | TAL-US-022 | I request feedback from two colleagues | they respond | I see both responses | System / acceptance | Test |
| TAL-TC-022 | TAL-UC-011 | TAL-CG-006 | TAL-US-022 | a colleague chooses recipient-only visibility | my manager opens my feedback | that response is not shown | System / acceptance | Test |
| TAL-TC-023 | TAL-UC-011 | TAL-CG-006 | TAL-US-023 | I write a private note | the employee views their record | the note is not shown | System / acceptance | Test |
| TAL-TC-024 | TAL-UC-011 | TAL-CG-006 | TAL-US-023 | HR exports feedback | the export runs | my private note is excluded | System / acceptance | Test |
| TAL-TC-025 | TAL-UC-012 | TAL-CG-007 | TAL-US-024 | a proposed rating of 4 | I change it to 3 with reason | the change and reason are recorded | System / acceptance | Test |
| TAL-TC-026 | TAL-UC-012 | TAL-CG-007 | TAL-US-024 | I change a rating without a reason | I save | save is blocked | System / acceptance | Test |
| TAL-TC-027 | TAL-UC-012 | TAL-CG-007 | TAL-US-025 | five peers responded | I view my review | comments show without names | System / acceptance | Test |
| TAL-TC-028 | TAL-UC-012 | TAL-CG-007 | TAL-US-025 | only two peers responded | I view my review | peer responses are suppressed | System / acceptance | Test |
| TAL-TC-029 | TAL-UC-013 | TAL-CG-008 | TAL-US-026 | a critical plant head position with one successor ready in 3+ years | I open bench strength | it shows as high risk | System / acceptance | Test |
| TAL-TC-030 | TAL-UC-013 | TAL-CG-008 | TAL-US-026 | a ready-now successor is added | I refresh | risk shows low | System / acceptance | Test |
| TAL-TC-031 | TAL-UC-013 | TAL-CG-008 | TAL-US-027 | a slate of 12 critical positions | I endorse it | the slate is marked endorsed with my identity and date | System / acceptance | Test |
| TAL-TC-032 | TAL-UC-013 | TAL-CG-008 | TAL-US-027 | a nominee resigns | the exit is recorded | the nomination is removed and the position re-flagged | System / acceptance | Test |
| TAL-TC-033 | TAL-UC-014 | TAL-CG-009 | TAL-US-028 | I am a quality inspector targeting quality engineer | I open the path | three competency gaps are listed | System / acceptance | Test |
| TAL-TC-034 | TAL-UC-014 | TAL-CG-009 | TAL-US-028 | I add learning for a gap | I complete the course | the gap shows progress | System / acceptance | Test |
| TAL-TC-035 | TAL-UC-014 | TAL-CG-009 | TAL-US-029 | a submitted plan | I agree it | it shows agreed with the date | System / acceptance | Test |
| TAL-TC-036 | TAL-UC-014 | TAL-CG-009 | TAL-US-029 | I return it with comments | the employee opens it | the comments are visible | System / acceptance | Test |
| TAL-TC-037 | TAL-UC-015 | TAL-CG-010 | TAL-US-030 | a valid SCORM 2004 package | I upload | the course is registered | System / acceptance | Test |
| TAL-TC-038 | TAL-UC-015 | TAL-CG-010 | TAL-US-030 | a package with a broken manifest | I upload | validation errors are shown | System / acceptance | Test |
| TAL-TC-039 | TAL-UC-015 | TAL-CG-010 | TAL-US-031 | I finish an xAPI course with score 85 | completion is sent | My learning shows complete with 85 | System / acceptance | Test |
| TAL-TC-040 | TAL-UC-015 | TAL-CG-010 | TAL-US-031 | I exit midway | I return | I resume where I left off | System / acceptance | Test |
| TAL-TC-041 | TAL-UC-016 | TAL-CG-011 | TAL-US-032 | E1018's forklift licence expired yesterday | the supervisor assigns E1018 to forklift duty on shift A 08:00–20:00 | the assignment is blocked naming the expired licence | System / acceptance | Test |
| TAL-TC-042 | TAL-UC-016 | TAL-CG-011 | TAL-US-032 | E1018 uploads a renewed licence which is verified | the supervisor assigns again | the assignment succeeds | System / acceptance | Test |
| TAL-TC-043 | TAL-UC-016 | TAL-CG-011 | TAL-US-033 | my licence expires on 30 June | it is 31 May | I receive a 30-day reminder | System / acceptance | Test |
| TAL-TC-044 | TAL-UC-016 | TAL-CG-011 | TAL-US-033 | I renewed on 10 June | it is 23 June | no 7-day reminder is sent | System / acceptance | Test |
| TAL-TC-045 | TAL-UC-017 | TAL-CG-012 | TAL-US-034 | 312 past candidates match the CNC setter criteria and 41 have expired consent | I generate pool suggestions | 271 candidates are suggested and none with expired consent appears | System / acceptance | Test |
| TAL-TC-046 | TAL-UC-017 | TAL-CG-012 | TAL-US-034 | a suggested candidate is active in requisition REQ-2026-118 | I add her to the pool | she is flagged as in process and excluded from the campaign | System / acceptance | Test |
| TAL-TC-047 | TAL-UC-017 | TAL-CG-012 | TAL-US-035 | I consented to email only | the Chakan Works open-house campaign runs | I receive it by email and nothing on the messaging channel | System / acceptance | Test |
| TAL-TC-048 | TAL-UC-017 | TAL-CG-012 | TAL-US-035 | I select unsubscribe from any message | the request is processed | no further campaign message reaches me after 5 minutes | System / acceptance | Test |
| TAL-TC-049 | TAL-UC-017 | TAL-CG-012 | TAL-US-036 | my requisition for 4 CNC setters at Chakan Works is approved | the recruiter matches the pool | 12 engaged candidates appear in my pipeline with their nurture history | System / acceptance | Test |
| TAL-TC-050 | TAL-UC-017 | TAL-CG-012 | TAL-US-036 | a matched candidate's notice period is 90 days | I review the shortlist | the notice period is shown on the candidate card | System / acceptance | Test |
| TAL-TC-051 | TAL-UC-018 | TAL-CG-013 | TAL-US-037 | a drive with three slots of 40 | the 41st candidate selects slot 1 | slot 1 is shown as full and slot 2 is offered | System / acceptance | Test |
| TAL-TC-052 | TAL-UC-018 | TAL-CG-013 | TAL-US-037 | a candidate registers again with the same mobile number | the registration is submitted | it is merged with the earlier registration | System / acceptance | Test |
| TAL-TC-053 | TAL-UC-018 | TAL-CG-013 | TAL-US-038 | 120 offers are approved and 104 are accepted by 2026-12-20 | the deadline passes | the next 16 waitlisted candidates are proposed in rank order for my confirmation | System / acceptance | Test |
| TAL-TC-054 | TAL-UC-018 | TAL-CG-013 | TAL-US-038 | I confirm the 16 | the approval completes | 16 new offers are released | System / acceptance | Test |
| TAL-TC-055 | TAL-UC-018 | TAL-CG-013 | TAL-US-039 | 120 acceptances with joining date 2027-01-04 | the cohort is created | each joiner has induction and document tasks due before 2027-01-04 | System / acceptance | Test |
| TAL-TC-056 | TAL-UC-018 | TAL-CG-013 | TAL-US-039 | a joiner has not uploaded an address proof by 2027-01-02 | the reminder job runs | the joiner and Plant HR are reminded | System / acceptance | Test |
| TAL-TC-057 | TAL-UC-019 | TAL-CG-014 | TAL-US-040 | 40 candidates finish the CNC operator screen with cut-off 60% | scoring completes | the 23 candidates scoring 60% or more are proposed for my confirmation | System / acceptance | Test |
| TAL-TC-058 | TAL-UC-019 | TAL-CG-014 | TAL-US-040 | a candidate scoring 72% has a second-face proctoring flag | I uphold the flag with a note | the candidate is excluded and the note is kept with the attempt | System / acceptance | Test |
| TAL-TC-059 | TAL-UC-019 | TAL-CG-014 | TAL-US-041 | I have answered 14 questions with 11 minutes left | my connection drops and I reopen the link | I resume at question 15 with 11 minutes remaining | System / acceptance | Test |
| TAL-TC-060 | TAL-UC-019 | TAL-CG-014 | TAL-US-041 | I declared a disability and extra time was approved | I start the test | my timer shows 25% more time than standard | System / acceptance | Test |
| TAL-TC-061 | TAL-UC-020 | TAL-CG-015 | TAL-US-042 | the configured limit allows 32 more apprentices at Chakan Works | I create 30 engagements | all 30 are created and the remaining capacity shows 2 | System / acceptance | Test |
| TAL-TC-062 | TAL-UC-020 | TAL-CG-015 | TAL-US-042 | the configured limit allows 2 more apprentices | I try to create 5 | 3 engagements are blocked with the limit shown | System / acceptance | Test |
| TAL-TC-063 | TAL-UC-020 | TAL-CG-015 | TAL-US-043 | I am apprentice A-2026-014 and passed basic training on 2026-08-31 | I open my training plan | basic training shows Passed and the milling rotation shows In progress | System / acceptance | Test |
| TAL-TC-064 | TAL-UC-020 | TAL-CG-015 | TAL-US-043 | I attended 24 of 26 working days in October 2026 | the stipend is computed | my stipend reflects 24 attended days | System / acceptance | Test |
| TAL-TC-065 | TAL-UC-020 | TAL-CG-015 | TAL-US-044 | 6 apprentices complete on 2026-12-31 and 4 operator positions are open | I review the list | I can approve at most 4 conversions | System / acceptance | Test |
| TAL-TC-066 | TAL-UC-020 | TAL-CG-015 | TAL-US-044 | I approve the conversion of apprentice A-2026-009 | the approval completes | a hire is started with the apprenticeship record linked | System / acceptance | Test |
| TAL-TC-067 | TAL-UC-021 | TAL-CG-016 | TAL-US-045 | E1021 at Peenya Works sets the goal shift supervisor with Hindi as preferred language | suggestions load | three mentors appear, each with matched skills, language and free capacity | System / acceptance | Test |
| TAL-TC-068 | TAL-UC-021 | TAL-CG-016 | TAL-US-045 | a suggested mentor has capacity 0 | suggestions are ranked | that mentor is not shown | System / acceptance | Test |
| TAL-TC-069 | TAL-UC-021 | TAL-CG-016 | TAL-US-046 | I have logged 4 sessions with E1021 | HR opens the programme report | HR sees 4 sessions counted but none of the notes | System / acceptance | Test |
| TAL-TC-070 | TAL-UC-021 | TAL-CG-016 | TAL-US-046 | my capacity is 2 and I have 2 active mentees | a new request is sent to me | the request is not allowed and the mentee sees other suggestions | System / acceptance | Test |
| TAL-TC-071 | TAL-UC-022 | TAL-CG-017 | TAL-US-047 | the module is authored in English | I request translations | drafts for Hindi, Marathi, Tamil and Telugu are created with status Awaiting review | System / acceptance | Test |
| TAL-TC-072 | TAL-UC-022 | TAL-CG-017 | TAL-US-047 | only Hindi and Marathi are approved on the publish date | I publish | only Hindi, Marathi and English are released and Tamil and Telugu stay in review | System / acceptance | Test |
| TAL-TC-073 | TAL-UC-022 | TAL-CG-017 | TAL-US-048 | E1066 downloaded Lockout-tagout in five minutes | she completes it offline on 2026-11-10 | the app stores the completion locally with the timestamp | System / acceptance | Test |
| TAL-TC-074 | TAL-UC-022 | TAL-CG-017 | TAL-US-048 | her phone reconnects on 2026-11-12, after the due date of 2026-11-11 | sync runs | the completion is recorded as on time with the 2026-11-10 timestamp | System / acceptance | Test |
| TAL-TC-075 | TAL-UC-022 | TAL-CG-017 | TAL-US-049 | 18 of 22 technicians have completed the module | I open team learning | 4 names are listed as pending with the due date | System / acceptance | Test |
| TAL-TC-076 | TAL-UC-022 | TAL-CG-017 | TAL-US-049 | a technician completes it on the kiosk | the completion is recorded | the technician is removed from the pending list | System / acceptance | Test |

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
| Size | 80 | specified items (table rows) | Counted automatically at generation |
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
