<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-08 — People Core — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-08 |
| Title | People Core — Test Cases and Acceptance |
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
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-PPL-13.


The source has no TC- cases for this domain; verification is by the client acceptance tests below and the user-story criteria in FRS-PPL-13.

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-04 | R-05 | OT suppressed on a working day for rest-day-only employees | Same session for an employee whose OT eligibility basis is rest days and holidays only, on a working day. | OT hours zero. The same employee working a rest day earns OT normally. |  |
| T-06 | R-03 | Contractual employee gets no rest day | Create a contractual employee and run attendance over a week containing the usual weekly off. | No weekly off is generated. Payroll pays on days present. |  |
| T-07 | R-04 | Helper and Employee differ within the same third-party category | Create one third-party Employee and one third-party Helper and run a week of attendance. | The Employee receives a rest day; the Helper does not. Neither required a code change. |  |
| T-37 | R-23 | Organisation chart follows the employee record | Change an employee's reporting manager and reopen the chart. | The chart reflects the change with no separate hierarchy maintenance. Department-wise view groups correctly. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-PPL-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PPL-TC-001 | PPL-UC-009 | PPL-CG-001 | PPL-US-025 | profile Senior Engineer — Machining with band B and competency CNC programming at level 3 | it is published and linked to POS-2214 and POS-2216 | both positions show the profile, band B and the competency requirement | System / acceptance | Test |
| PPL-TC-002 | PPL-UC-009 | PPL-CG-001 | PPL-US-025 | HR edits the profile to require level 4 effective 2027-04-01 | POS-2214 is viewed as at 2027-03-31 | level 3 is shown | System / acceptance | Test |
| PPL-TC-003 | PPL-UC-009 | PPL-CG-001 | PPL-US-026 | profile Operator — Assembly referenced by POS-2225 and POS-2226 | retirement is requested | it is blocked and both positions are listed | System / acceptance | Test |
| PPL-TC-004 | PPL-UC-009 | PPL-CG-001 | PPL-US-026 | both positions are moved to another profile | retirement is requested again | it is accepted with the end date recorded | System / acceptance | Test |
| PPL-TC-005 | PPL-UC-010 | PPL-CG-002 | PPL-US-027 | E1020 reports to E1021 and is assigned dotted-line manager E1018 for a tooling project from 2026-11-01 to 2027-01-31 | E1020 submits a project expense on 2026-12-05 | the project step routes to E1018 and the line step to E1021 | System / acceptance | Test |
| PPL-TC-006 | PPL-UC-010 | PPL-CG-002 | PPL-US-027 | the same request type on 2027-02-10 | it is submitted | the project step resolves to E1021 because the dotted line has ended | System / acceptance | Test |
| PPL-TC-007 | PPL-UC-010 | PPL-CG-002 | PPL-US-028 | E1018 is dotted-line manager for E1020 | E1018 opens E1020's profile | attendance and project data are visible and compensation fields are null | System / acceptance | Test |
| PPL-TC-008 | PPL-UC-010 | PPL-CG-002 | PPL-US-028 | E1021 is E1020's solid-line manager with compensation permission for PLANT-BLR | E1021 opens the profile | permitted compensation fields are shown | System / acceptance | Test |
| PPL-TC-009 | PPL-UC-011 | PPL-CG-003 | PPL-US-029 | E1009 is posted abroad from 2027-04-01 to 2028-03-31 with split payroll 40% home and 60% host | HR saves the host assignment | it is linked to E1009's LE-01 employment and both shares are stored | System / acceptance | Test |
| PPL-TC-010 | PPL-UC-011 | PPL-CG-003 | PPL-US-029 | split payroll is selected with no shares | HR saves | the save is refused with 'Enter the share for each country' | System / acceptance | Test |
| PPL-TC-011 | PPL-UC-011 | PPL-CG-003 | PPL-US-030 | E1009's work permit expires on 2027-12-31 and the posting ends on 2028-03-31 | the permit is uploaded | an immediate alert is raised to HR operations and the Compliance owner | System / acceptance | Test |
| PPL-TC-012 | PPL-UC-011 | PPL-CG-003 | PPL-US-030 | a renewed permit to 2028-06-30 is uploaded | it is verified | the alert closes and reminders are rescheduled from the new expiry | System / acceptance | Test |
| PPL-TC-013 | PPL-UC-012 | PPL-CG-004 | PPL-US-031 | E1028 adds spouse 60% and daughter 30% for gratuity Form F | she tries to submit | submit is disabled and the total shows 90% of 100% | System / acceptance | Test |
| PPL-TC-014 | PPL-UC-012 | PPL-CG-004 | PPL-US-031 | she changes the daughter's share to 40% | she submits | the nomination is accepted for HR approval | System / acceptance | Test |
| PPL-TC-015 | PPL-UC-012 | PPL-CG-004 | PPL-US-032 | E1028 has an approved PF nomination and submits a new one | HR has not yet decided | the approved nomination remains in force | System / acceptance | Test |
| PPL-TC-016 | PPL-UC-012 | PPL-CG-004 | PPL-US-032 | HR rejects the new nomination with reason 'Signed form missing' | the decision is saved | E1028 is notified with the reason and the earlier nomination stays in force | System / acceptance | Test |
| PPL-TC-017 | PPL-UC-012 | PPL-CG-004 | PPL-US-033 | plant HR scoped to LOC-PLA and E1026 has an emergency contact recorded | plant HR opens E1026's profile card | the emergency contact name and phone are shown | System / acceptance | Test |
| PPL-TC-018 | PPL-UC-012 | PPL-CG-004 | PPL-US-033 | plant HR scoped to LOC-PLA | they search for an employee at LOC-HYD | no emergency contact is returned | System / acceptance | Test |
| PPL-TC-019 | PPL-UC-013 | PPL-CG-005 | PPL-US-034 | a change set moving OU-114 Maintenance at LOC-PLA under a new head | the preview runs | each open request from OU-114 workers is listed with its current and future approver | System / acceptance | Test |
| PPL-TC-020 | PPL-UC-013 | PPL-CG-005 | PPL-US-034 | an open request whose future approver cannot be resolved | commit is attempted | commit is blocked and the request is listed | System / acceptance | Test |
| PPL-TC-021 | PPL-UC-013 | PPL-CG-005 | PPL-US-035 | a change set moving 40 workers from LOC-PLA to LOC-PUN | the preview runs | it lists the principals who gain or lose visibility of each worker | System / acceptance | Test |
| PPL-TC-022 | PPL-UC-013 | PPL-CG-005 | PPL-US-035 | commit of 40 moves where one fails validation | commit runs | none of the 40 moves is applied and the failing one is reported | System / acceptance | Test |
| PPL-TC-023 | PPL-UC-014 | PPL-CG-006 | PPL-US-036 | E1021 Rekha Deshpande manages assembly operators at LOC-PLA | she opens the chart | her node shows her direct reports, the headcount and span of control | System / acceptance | Test |
| PPL-TC-024 | PPL-UC-014 | PPL-CG-006 | PPL-US-036 | a vacant position POS-2225 at LOC-PUN in OU-112 | HR views OU-112 at LOC-PUN | POS-2225 appears as a vacancy node with last incumbent E1072 | System / acceptance | Test |
| PPL-TC-025 | PPL-UC-014 | PPL-CG-006 | PPL-US-037 | E1022's manager changes from E1021 to E1016 effective today | the chart is reopened | E1022 appears under E1016 | System / acceptance | Test |
| PPL-TC-026 | PPL-UC-014 | PPL-CG-006 | PPL-US-037 | the department-wise view is selected | the chart renders | workers are grouped by org unit with headcounts per unit | System / acceptance | Test |
| PPL-TC-027 | PPL-UC-014 | PPL-CG-006 | PPL-US-038 | plant HR scoped to LOC-CHN | they open the chart | only LOC-CHN workers and their reporting lines are shown | System / acceptance | Test |
| PPL-TC-028 | PPL-UC-014 | PPL-CG-006 | PPL-US-038 | the same user | they open the location filter | LOC-HYD is not offered | System / acceptance | Test |
| PPL-TC-029 | PPL-UC-015 | PPL-CG-007 | PPL-US-039 | E1069 holds a permanent assignment at LOC-PLA | I add a trainer assignment in LE-02 at LOC-HYD effective 2026-11-01 | E1069 shows two active assignments and one person identifier | System / acceptance | Test |
| PPL-TC-030 | PPL-UC-015 | PPL-CG-007 | PPL-US-039 | the selected position is frozen | I try to add the assignment | creation is blocked with the frozen status named | System / acceptance | Test |
| PPL-TC-031 | PPL-UC-015 | PPL-CG-007 | PPL-US-040 | E1069 has assignments in PLANT-BLR and PLANT-HYD | the November runs are created | E1069 appears in both run populations with the assignment identifier on each payslip | System / acceptance | Test |
| PPL-TC-032 | PPL-UC-015 | PPL-CG-007 | PPL-US-040 | the PF wage ceiling applies to the person | both assignments are computed | the payroll exception list shows the shared-ceiling check for E1069 | System / acceptance | Test |
| PPL-TC-033 | PPL-UC-015 | PPL-CG-007 | PPL-US-041 | I hold two assignments | I open my payslips for November 2026 | I see one payslip per assignment, each labelled with its entity | System / acceptance | Test |
| PPL-TC-034 | PPL-UC-015 | PPL-CG-007 | PPL-US-041 | I apply for leave | I choose the assignment | the request routes to that assignment's manager only | System / acceptance | Test |
| PPL-TC-035 | PPL-UC-016 | PPL-CG-008 | PPL-US-042 | Chakan Works Machining has 20 sanctioned, 17 filled and 1 open requisition | I create the FY 2027-28 plan | the line shows headroom of 2 | System / acceptance | Test |
| PPL-TC-036 | PPL-UC-016 | PPL-CG-008 | PPL-US-042 | a manager proposes +6 machinists from Q2 | the proposal is saved | planned Q2 headcount is 26 and planned cost updates | System / acceptance | Test |
| PPL-TC-037 | PPL-UC-016 | PPL-CG-008 | PPL-US-043 | a plan adding 6 band-B positions at Chakan | I open the cost view | the incremental annual cost per cost centre is shown | System / acceptance | Test |
| PPL-TC-038 | PPL-UC-016 | PPL-CG-008 | PPL-US-043 | a designation band with no cost rate | the plan is submitted | submission is blocked with the unpriced line named | System / acceptance | Test |
| PPL-TC-039 | PPL-UC-016 | PPL-CG-008 | PPL-US-044 | the approved plan for Peenya Assembly in October 2026 is 30 | 29 are filled and 2 requisitions are open | the variance view shows +1 against plan | System / acceptance | Test |
| PPL-TC-040 | PPL-UC-016 | PPL-CG-008 | PPL-US-044 | a requisition that would exceed sanctioned strength | it reaches approval | it is blocked and the excess is stated | System / acceptance | Test |
| PPL-TC-041 | PPL-UC-017 | PPL-CG-009 | PPL-US-045 | I am E1044 with posted payroll for July to September 2026 | I request a 3-month salary certificate | a signed PDF with a verification code is ready within 10 s | System / acceptance | Test |
| PPL-TC-042 | PPL-UC-017 | PPL-CG-009 | PPL-US-045 | September payroll is not yet posted | I request July to September | the certificate covers July and August and says so | System / acceptance | Test |
| PPL-TC-043 | PPL-UC-017 | PPL-CG-009 | PPL-US-046 | a bank enters the verification code of a genuine certificate | verification runs | it confirms LE-01 issued it on the stated date with the stated contents | System / acceptance | Test |
| PPL-TC-044 | PPL-UC-017 | PPL-CG-009 | PPL-US-046 | a tampered certificate with an altered amount | the bank verifies it | verification reports a mismatch | System / acceptance | Test |
| PPL-TC-045 | PPL-UC-017 | PPL-CG-009 | PPL-US-047 | I am an active employee at Chakan Works | I open the digital ID | it shows my photo, code, entity LE-01 and a code that refreshes every 60 s | System / acceptance | Test |
| PPL-TC-046 | PPL-UC-017 | PPL-CG-009 | PPL-US-047 | my assignment ended on 2026-09-30 | I open the digital ID on 2026-10-01 | it is marked inactive | System / acceptance | Test |
| PPL-TC-047 | PPL-UC-018 | PPL-CG-010 | PPL-US-048 | I am E1021 managing Peenya Assembly with 9 direct reports and one position vacant since 2026-07-15 | I open organisation health on 2026-11-05 | I see span 9, vacancy age 113 days and my layer count | System / acceptance | Test |
| PPL-TC-048 | PPL-UC-018 | PPL-CG-010 | PPL-US-048 | I request Chakan Works Machining | the view loads | the unit is refused as outside my reporting line | System / acceptance | Test |
| PPL-TC-049 | PPL-UC-018 | PPL-CG-010 | PPL-US-049 | my grant covers LE-01 and LE-02 | I open the site comparison | five sites are listed with span, layers, vacancy age and tenure mix | System / acceptance | Test |
| PPL-TC-050 | PPL-UC-018 | PPL-CG-010 | PPL-US-049 | a manager at Oragadam Works with span 22 and the threshold set at 15 | the comparison loads | that manager's unit is flagged above threshold | System / acceptance | Test |
| PPL-TC-051 | PPL-UC-018 | PPL-CG-010 | PPL-US-050 | a unit of 4 people and a minimum group size of 5 | a manager opens organisation health | flight-risk concentration is suppressed for that unit | System / acceptance | Test |
| PPL-TC-052 | PPL-UC-018 | PPL-CG-010 | PPL-US-050 | a unit of 30 people | the metric shows | it appears only as a band for the unit with no individual names | System / acceptance | Test |

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
| Size | 56 | specified items (table rows) | Counted automatically at generation |
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
