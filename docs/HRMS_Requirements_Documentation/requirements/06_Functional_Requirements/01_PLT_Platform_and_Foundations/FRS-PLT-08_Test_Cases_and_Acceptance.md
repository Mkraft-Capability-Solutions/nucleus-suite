<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-08 — Platform & Foundations — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-08 |
| Title | Platform & Foundations — Test Cases and Acceptance |
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
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-PLT-13.


## Scope, Loan, Exit And Talent Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-P05 | Plant user reading a head-office-payrolled employee | E1056 Anand Krishnan, LOC-CHN, payroll group HO | Attendance fields populated; every compensation and rate field null | RL-005 | Golden — RUNS ON EVERY BUILD |

## Property Tests

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PR09 | No query escapes its tenant, including a query with a bug in it | Any query | RLS blocks | RL-004 | Property |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-18 | R-09 | Plant user cannot see head office salary | As a plant user, open the employee, the salary register, an export and the API for an employee paid at head office. | Attendance is visible. Salary and rate structure are not, in all four surfaces. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-PLT-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLT-TC-001 | PLT-UC-009 | PLT-CG-001 | PLT-US-027 | the payroll manager last completed MFA 40 minutes ago and the step-up window is 5 minutes | they click Approve on the October 2026 run for payroll group HO | a step-up challenge is shown and approval proceeds only after it succeeds | System / acceptance | Test |
| PLT-TC-002 | PLT-UC-009 | PLT-CG-001 | PLT-US-027 | the payroll manager completed step-up 2 minutes ago | they approve a second run | no new challenge is shown and the audit entry records the earlier authentication time | System / acceptance | Test |
| PLT-TC-003 | PLT-UC-009 | PLT-CG-001 | PLT-US-028 | the payroll manager role is marked privileged and the user has no enrolled factor | the user signs in | payroll screens are blocked and factor enrolment is presented first | System / acceptance | Test |
| PLT-TC-004 | PLT-UC-009 | PLT-CG-001 | PLT-US-028 | a user fails TOTP 5 times | the fifth failure occurs | the factor is locked for 15 minutes and the tenant admin receives an alert | System / acceptance | Test |
| PLT-TC-005 | PLT-UC-009 | PLT-CG-001 | PLT-US-029 | employee E1022 is signed in on the mobile app | he submits a new bank account number | a step-up challenge is required before the change is accepted for approval | System / acceptance | Test |
| PLT-TC-006 | PLT-UC-009 | PLT-CG-001 | PLT-US-029 | he cancels the challenge | the screen closes | the bank account is unchanged and no approval request is created | System / acceptance | Test |
| PLT-TC-007 | PLT-UC-010 | PLT-CG-002 | PLT-US-030 | E1033 has set quiet hours 21:00–07:00 and language Kannada | a non-mandatory announcement is published at 22:30 | it is held until 07:00 and delivered in Kannada | System / acceptance | Test |
| PLT-TC-008 | PLT-UC-010 | PLT-CG-002 | PLT-US-030 | the same employee | a mandatory shift-change notice is issued at 22:30 | it is delivered immediately despite quiet hours | System / acceptance | Test |
| PLT-TC-009 | PLT-UC-010 | PLT-CG-002 | PLT-US-031 | E1021 has enabled a 09:00 digest | six team birthday and document-uploaded notices arrive on one day | they appear as one digest at 09:00 the next morning | System / acceptance | Test |
| PLT-TC-010 | PLT-UC-010 | PLT-CG-002 | PLT-US-031 | the same day a leave approval step opens for E1021 | the event is processed | the approval notification is sent immediately on push and in-app | System / acceptance | Test |
| PLT-TC-011 | PLT-UC-010 | PLT-CG-002 | PLT-US-032 | a mandatory policy notice sent to all 71 employees of the tenant | the compliance owner searches the log by that notice | 71 entries are listed with channel, delivery status and timestamp | System / acceptance | Test |
| PLT-TC-012 | PLT-UC-010 | PLT-CG-002 | PLT-US-032 | an SMS failed for E1061 | the log is opened | the failure reason and the fallback channel attempt are shown | System / acceptance | Test |
| PLT-TC-013 | PLT-UC-011 | PLT-CG-003 | PLT-US-033 | the loan chain has HR and Finance steps | the tenant admin adds a director step for amounts above ₹2,00,000 and simulates a ₹3,00,000 request from E1044 | the simulation shows three steps ending with the director | System / acceptance | Test |
| PLT-TC-014 | PLT-UC-011 | PLT-CG-003 | PLT-US-033 | the same chain | a ₹50,000 request is simulated | the director step is skipped and two steps are shown | System / acceptance | Test |
| PLT-TC-015 | PLT-UC-011 | PLT-CG-003 | PLT-US-034 | version 3 of the leave chain went live on 2026-11-01 | the tenant admin reverts to version 2 with reason 'Approver list incomplete' | version 4, identical to version 2, applies to new submissions and versions 2 and 3 remain in history | System / acceptance | Test |
| PLT-TC-016 | PLT-UC-011 | PLT-CG-003 | PLT-US-034 | requests submitted under version 3 | the reversal is published | they continue on version 3 until closed | System / acceptance | Test |
| PLT-TC-017 | PLT-UC-012 | PLT-CG-004 | PLT-US-035 | a package changing the overtime rule pack and one picklist | the diff is generated against production | exactly two objects are listed with field-level before-and-after values | System / acceptance | Test |
| PLT-TC-018 | PLT-UC-012 | PLT-CG-004 | PLT-US-035 | the package references a new shift-group picklist value that does not exist in production | promotion is requested | it is blocked with the missing dependency named | System / acceptance | Test |
| PLT-TC-019 | PLT-UC-012 | PLT-CG-004 | PLT-US-036 | package promoted on 2026-11-05 at 10:00 | the tenant admin requests rollback with a reason | new versions restore the earlier configuration and the package shows status Rolled back | System / acceptance | Test |
| PLT-TC-020 | PLT-UC-012 | PLT-CG-004 | PLT-US-036 | a post-promotion smoke check fails | the failure is detected | the rollback point is restored automatically and the tenant admin is alerted | System / acceptance | Test |
| PLT-TC-021 | PLT-UC-013 | PLT-CG-005 | PLT-US-037 | E1021 delegates leave and overtime approvals to E1016 from 2026-11-10 to 2026-11-20 with reason Annual leave | E1022 submits leave on 2026-11-12 | the item appears in E1016's inbox and the decision records E1016 as actor on behalf of E1021 | System / acceptance | Test |
| PLT-TC-022 | PLT-UC-013 | PLT-CG-005 | PLT-US-037 | the delegation ends on 2026-11-20 | the date passes | any open items return to E1021's inbox automatically | System / acceptance | Test |
| PLT-TC-023 | PLT-UC-013 | PLT-CG-005 | PLT-US-038 | a support engineer requests a 30-minute act-as session for E1043 with a support ticket reference | the tenant admin approves it | a banner shows the act-as state and every action records the engineer as real actor | System / acceptance | Test |
| PLT-TC-024 | PLT-UC-013 | PLT-CG-005 | PLT-US-038 | the act-as session is active | the engineer attempts to grant a role | the action is blocked and the attempt is logged | System / acceptance | Test |
| PLT-TC-025 | PLT-UC-013 | PLT-CG-005 | PLT-US-039 | approvals in November 2026 | the auditor filters by on-behalf-of not empty | only delegated decisions are listed with delegate, delegator and delegation dates | System / acceptance | Test |
| PLT-TC-026 | PLT-UC-013 | PLT-CG-005 | PLT-US-039 | a delegated decision dated outside the delegation window | the query runs | no such decision exists because the platform routes to the delegate only inside the window | System / acceptance | Test |
| PLT-TC-027 | PLT-UC-014 | PLT-CG-006 | PLT-US-040 | a file of 500 assignment changes where 3 rows have no effective date | dry-run is executed | 497 rows show Valid and 3 show the error 'Effective date is required', and nothing is saved | System / acceptance | Test |
| PLT-TC-028 | PLT-UC-014 | PLT-CG-006 | PLT-US-040 | a file with a column named DOJ instead of the template's date_of_joining | it is uploaded | the file is rejected with the mismatched column named | System / acceptance | Test |
| PLT-TC-029 | PLT-UC-014 | PLT-CG-006 | PLT-US-041 | batch B-20261105-01 committed 497 rows | HR operations requests rollback with reason 'Wrong increment file' | all 497 records return to their prior values as new versions and the batch shows Rolled back | System / acceptance | Test |
| PLT-TC-030 | PLT-UC-014 | PLT-CG-006 | PLT-US-041 | the batch has been rolled back | the version history of any affected record is opened | both the loaded and the reversing versions are visible | System / acceptance | Test |
| PLT-TC-031 | PLT-UC-014 | PLT-CG-006 | PLT-US-042 | a loader scoped to LOC-PLA uploads rows for LOC-PLA and LOC-HYD employees | dry-run runs | LOC-HYD rows are rejected with a scope error and LOC-PLA rows validate | System / acceptance | Test |
| PLT-TC-032 | PLT-UC-014 | PLT-CG-006 | PLT-US-042 | partial commit is selected | the load is confirmed | only LOC-PLA rows are committed | System / acceptance | Test |
| PLT-TC-033 | PLT-UC-015 | PLT-CG-007 | PLT-US-043 | the tenant admin adds field safety_induction_on of type date, classification general, on the assignment form | it is published | plant HR at LOC-PLA can enter 2026-11-03 for E1032 and the value appears in the attendance-site report | System / acceptance | Test |
| PLT-TC-034 | PLT-UC-015 | PLT-CG-007 | PLT-US-043 | a field named location_id is added | publication is attempted | it is blocked because the name collides with a standard field | System / acceptance | Test |
| PLT-TC-035 | PLT-UC-015 | PLT-CG-007 | PLT-US-044 | custom field site_hardship_allowance classified compensation | a plant HR user scoped to payroll group PLANT-CHN reads E1056 in payroll group HO | the field returns null | System / acceptance | Test |
| PLT-TC-036 | PLT-UC-015 | PLT-CG-007 | PLT-US-044 | a payroll manager scoped to HO | they read E1056 | the field value is shown | System / acceptance | Test |
| PLT-TC-037 | PLT-UC-016 | PLT-CG-008 | PLT-US-045 | legacy YTD gross for LE-01 from April to September 2026 is supplied | the reconciliation report runs after migration | per-employee and total YTD gross, PF and TDS show zero variance or list each variance by employee | System / acceptance | Test |
| PLT-TC-038 | PLT-UC-016 | PLT-CG-008 | PLT-US-045 | variances exist for 4 employees | sign-off is attempted | sign-off is blocked until each variance is resolved or accepted with a reason | System / acceptance | Test |
| PLT-TC-039 | PLT-UC-016 | PLT-CG-008 | PLT-US-046 | files for persons, positions and assignments are uploaded together | the migration starts | positions load before assignments and persons load before employments | System / acceptance | Test |
| PLT-TC-040 | PLT-UC-016 | PLT-CG-008 | PLT-US-046 | the positions batch fails | the assignments batch is due | it is held with the message that its dependency has not loaded | System / acceptance | Test |
| PLT-TC-041 | PLT-UC-016 | PLT-CG-008 | PLT-US-047 | legacy closing EL balance for E1028 is 14.5 days | the balance reconciliation runs | E1028's opening EL in Nucleus is 14.5 days | System / acceptance | Test |
| PLT-TC-042 | PLT-UC-016 | PLT-CG-008 | PLT-US-047 | a balance in the file for an employee not loaded | the balances batch is validated | the row is rejected with 'Employee not found' | System / acceptance | Test |
| PLT-TC-043 | PLT-UC-017 | PLT-CG-009 | PLT-US-048 | E1043 submits an access request and passes the step-up challenge | the compliance owner approves fulfilment | E1043 receives a download of her personal data and the request closes with the date recorded | System / acceptance | Test |
| PLT-TC-044 | PLT-UC-017 | PLT-CG-009 | PLT-US-048 | the step-up challenge fails | the request is submitted | it is held as Unverified and no data is compiled | System / acceptance | Test |
| PLT-TC-045 | PLT-UC-017 | PLT-CG-009 | PLT-US-049 | a former employee whose exit was in 2025 requests erasure | erasure runs | name, mobile, address and documents are anonymised and payroll register rows remain under a pseudonymous key | System / acceptance | Test |
| PLT-TC-046 | PLT-UC-017 | PLT-CG-009 | PLT-US-049 | erasure completes | the compliance owner opens the erasure report | each retained record class is listed with its retention reason | System / acceptance | Test |
| PLT-TC-047 | PLT-UC-017 | PLT-CG-009 | PLT-US-050 | a configured SLA of 15 days for access requests | a request reaches 12 days without closure | it escalates to the compliance owner's manager | System / acceptance | Test |
| PLT-TC-048 | PLT-UC-017 | PLT-CG-009 | PLT-US-050 | the SLA expires | the request is still open | the breach is counted on the compliance dashboard | System / acceptance | Test |
| PLT-TC-049 | PLT-UC-018 | PLT-CG-010 | PLT-US-051 | E1068's last working day is 2026-09-30 | the exit becomes effective at the end of that day | a SCIM deactivate request is sent and confirmed within 15 minutes and logged | System / acceptance | Test |
| PLT-TC-050 | PLT-UC-018 | PLT-CG-010 | PLT-US-051 | the directory is unreachable for 20 minutes | the deactivation is pending | the item is retried and flagged as an SLA breach on the dashboard | System / acceptance | Test |
| PLT-TC-051 | PLT-UC-018 | PLT-CG-010 | PLT-US-052 | E1066 has a joining date of 2026-09-01 recorded on 2026-08-20 | 2026-09-01 begins | a SCIM create request is sent and the account exists within 15 minutes | System / acceptance | Test |
| PLT-TC-052 | PLT-UC-018 | PLT-CG-010 | PLT-US-052 | the user name is already taken in the directory | the create request returns a conflict | the item is held and the tenant admin is asked to resolve it | System / acceptance | Test |
| PLT-TC-053 | PLT-UC-018 | PLT-CG-010 | PLT-US-053 | E1018 moves from OU-111 to OU-112 effective 2026-10-01 | the assignment change becomes effective | the directory record shows the new department within 15 minutes | System / acceptance | Test |
| PLT-TC-054 | PLT-UC-018 | PLT-CG-010 | PLT-US-053 | the update succeeds | the provisioning dashboard is opened | the item shows Completed with the directory's response timestamp | System / acceptance | Test |
| PLT-TC-055 | PLT-UC-019 | PLT-CG-011 | PLT-US-054 | E1020's shift group was corrected on 2026-09-10 with effect from 2026-09-01 | I view the record recorded-at 2026-09-05, valid-at 2026-09-04 | I see the shift group before the correction and a marker linking to the 2026-09-10 change | System / acceptance | Test |
| PLT-TC-056 | PLT-UC-019 | PLT-CG-011 | PLT-US-054 | I hold read-only auditor scope for LE-01 | I open a time-travel view | no edit or save action is offered | System / acceptance | Test |
| PLT-TC-057 | PLT-UC-019 | PLT-CG-011 | PLT-US-055 | the September 2026 PLANT-BLR run was snapshotted at 2026-09-28 18:00 | I open its headcount report in as-at mode | both dates default to 2026-09-28 18:00 and the count equals the run's population | System / acceptance | Test |
| PLT-TC-058 | PLT-UC-019 | PLT-CG-011 | PLT-US-055 | an assignment for E1022 was back-dated after the snapshot | I compare the snapshot view with today | E1022 is highlighted with the back-dated change named | System / acceptance | Test |
| PLT-TC-059 | PLT-UC-019 | PLT-CG-011 | PLT-US-056 | Rekha Deshpande (E1021) became Assembly manager at Peenya Works on 2026-08-01 | I view the Peenya chart valid-at 2026-07-15 | Assembly shows the previous manager and no node for E1021 in that role | System / acceptance | Test |
| PLT-TC-060 | PLT-UC-019 | PLT-CG-011 | PLT-US-056 | my grant covers LE-01 only | I request the Medchal Works chart | the chart is refused and the message names the missing entity grant | System / acceptance | Test |
| PLT-TC-061 | PLT-UC-020 | PLT-CG-012 | PLT-US-057 | a draft lowering PLANT12 grace from 15 to 10 minutes | I save the draft | the suite runs and lists the 12 golden days whose disposition changes from present to late | System / acceptance | Test |
| PLT-TC-062 | PLT-UC-020 | PLT-CG-012 | PLT-US-057 | all 12 differences are explained | I submit | the draft enters the approval chain with the test run attached | System / acceptance | Test |
| PLT-TC-063 | PLT-UC-020 | PLT-CG-012 | PLT-US-058 | a draft with one unexplained change in overtime minutes for E1018 | the consultant tries to submit | submission is refused and E1018's case is shown as unexplained | System / acceptance | Test |
| PLT-TC-064 | PLT-UC-020 | PLT-CG-012 | PLT-US-058 | a published version | I open its history | I see the test run identifier, explained differences and approver | System / acceptance | Test |
| PLT-TC-065 | PLT-UC-020 | PLT-CG-012 | PLT-US-059 | a grace change effective 2026-10-01 published on 2026-10-05 | publication completes | attendance days 2026-10-01 to 2026-10-04 for PLANT12 workers are queued for recompute | System / acceptance | Test |
| PLT-TC-066 | PLT-UC-020 | PLT-CG-012 | PLT-US-059 | September 2026 is locked | a consultant chooses effective date 2026-09-15 | publication is refused and the message names the locked period | System / acceptance | Test |
| PLT-TC-067 | PLT-UC-021 | PLT-CG-013 | PLT-US-060 | an extension requesting attendance for all locations | I approve it for LOC-PLA only | its principal can read Peenya Works attendance and nothing at Chakan Works | System / acceptance | Test |
| PLT-TC-068 | PLT-UC-021 | PLT-CG-013 | PLT-US-060 | an extension principal with no named owner | I try to install | installation is blocked with a message citing the owner requirement | System / acceptance | Test |
| PLT-TC-069 | PLT-UC-021 | PLT-CG-013 | PLT-US-061 | a package making an undeclared outbound call | review runs | the verdict is fail and the call target is listed as a finding | System / acceptance | Test |
| PLT-TC-070 | PLT-UC-021 | PLT-CG-013 | PLT-US-061 | a clean package | review runs | a pass verdict is issued with the requested scopes listed | System / acceptance | Test |
| PLT-TC-071 | PLT-UC-021 | PLT-CG-013 | PLT-US-062 | the canteen extension read 340 attendance rows on 2026-10-12 | I filter the action ledger by that extension | I see the read with its principal, owner, scope and row count | System / acceptance | Test |
| PLT-TC-072 | PLT-UC-021 | PLT-CG-013 | PLT-US-062 | an extension version is upgraded | I view installation history | both versions, approval dates and approvers are listed | System / acceptance | Test |
| PLT-TC-073 | PLT-UC-022 | PLT-CG-014 | PLT-US-063 | an overseas service entity paid in another currency with a month-average rate loaded for October 2026 | I run the October group report in INR | each line shows the converted amount, the rate and the rate date | System / acceptance | Test |
| PLT-TC-074 | PLT-UC-022 | PLT-CG-014 | PLT-US-063 | no rate is loaded for 2026-10-31 | I request the period-end rate type | the affected lines are listed as unconverted and the report is marked incomplete | System / acceptance | Test |
| PLT-TC-075 | PLT-UC-022 | PLT-CG-014 | PLT-US-064 | LE-01 and LE-02 with posted September payrolls | I open the consolidated view | I see totals per entity, per site including Oragadam Works and a group total | System / acceptance | Test |
| PLT-TC-076 | PLT-UC-022 | PLT-CG-014 | PLT-US-064 | an inter-entity recharge flagged for elimination | the report is built | the recharge does not inflate the group total | System / acceptance | Test |
| PLT-TC-077 | PLT-UC-022 | PLT-CG-014 | PLT-US-065 | the consolidated report converts LE-02 figures | I open the LE-02 payroll register | all amounts remain in INR exactly as computed | System / acceptance | Test |
| PLT-TC-078 | PLT-UC-022 | PLT-CG-014 | PLT-US-065 | a rate is corrected after a report was exported | the report is regenerated | a new rate set version is recorded and the earlier export remains reproducible | System / acceptance | Test |
| PLT-TC-079 | PLT-UC-023 | PLT-CG-015 | PLT-US-066 | a PAN card uploaded for E1066 Abhinav Rastogi with the number extracted at 0.97 confidence | I open the verification task | the number is pre-filled, matched against the record and awaits my confirmation | System / acceptance | Test |
| PLT-TC-080 | PLT-UC-023 | PLT-CG-015 | PLT-US-066 | an extracted date of birth with 0.62 confidence | I view the task | the field is flagged low confidence and is not pre-selected for writing | System / acceptance | Test |
| PLT-TC-081 | PLT-UC-023 | PLT-CG-015 | PLT-US-067 | a forklift operator licence for E1035 expiring on 2026-12-31 with reminders at 60, 30 and 7 days | the date reaches 2026-11-01 | E1035 and Peenya HR receive the 60-day reminder | System / acceptance | Test |
| PLT-TC-082 | PLT-UC-023 | PLT-CG-015 | PLT-US-067 | a renewed licence is uploaded and confirmed | the record updates | pending reminders for the old licence are cancelled | System / acceptance | Test |
| PLT-TC-083 | PLT-UC-023 | PLT-CG-015 | PLT-US-068 | a bank account number written from a cancelled cheque | I view the field history | I see the document, extraction confidence, confirmer and confirmation time | System / acceptance | Test |
| PLT-TC-084 | PLT-UC-023 | PLT-CG-015 | PLT-US-068 | an agent extraction | I query the action ledger | the agent's extraction is listed as a proposal with no direct write to the record | System / acceptance | Test |
| PLT-TC-085 | PLT-UC-024 | PLT-CG-016 | PLT-US-069 | I pre-registered a visitor for 10:00–13:00 on 2026-11-12 | the visitor's pass is scanned at Gate 1 at 09:52 | I receive an arrival notification naming the gate | System / acceptance | Test |
| PLT-TC-086 | PLT-UC-024 | PLT-CG-016 | PLT-US-069 | the visitor's pass is valid only on 2026-11-12 | it is scanned on 2026-11-13 | entry is refused and the attempt is logged | System / acceptance | Test |
| PLT-TC-087 | PLT-UC-024 | PLT-CG-016 | PLT-US-070 | 7 visitors entered and 2 exited Peenya Works today | I open the on-site register | it lists 5 visitors with host and entry time | System / acceptance | Test |
| PLT-TC-088 | PLT-UC-024 | PLT-CG-016 | PLT-US-070 | a visitor's pass expired at 13:00 without an exit record | the time reaches 13:00 | the host and gate staff receive an overstay alert | System / acceptance | Test |
| PLT-TC-089 | PLT-UC-024 | PLT-CG-016 | PLT-US-071 | a visitor who has not acknowledged the induction | gate staff try to record entry | entry cannot be recorded until acknowledgement is captured | System / acceptance | Test |
| PLT-TC-090 | PLT-UC-024 | PLT-CG-016 | PLT-US-071 | a month of visits | I export the visit register | each row shows the acknowledgement time and the host employee | System / acceptance | Test |
| PLT-TC-091 | PLT-UC-025 | PLT-CG-017 | PLT-US-072 | Kannada is enabled for site LOC-PLA and my language preference is Kannada | I open my September 2026 payslip | every label, earning and deduction name is shown in Kannada and amounts use Indian digit grouping | System / acceptance | Test |
| PLT-TC-092 | PLT-UC-025 | PLT-CG-017 | PLT-US-072 | a tenant-specific announcement has no approved Kannada version | it is published | I see the English text with a 'translation pending' marker and the gap is logged for the reviewer | System / acceptance | Test |
| PLT-TC-093 | PLT-UC-025 | PLT-CG-017 | PLT-US-073 | interface string coverage for Odia is 97% | I try to enable Odia for a site | enablement is blocked and the 3% missing string keys are listed | System / acceptance | Test |
| PLT-TC-094 | PLT-UC-025 | PLT-CG-017 | PLT-US-073 | all strings are covered and the reviewer has approved the tenant texts | the HR administrator approves the enablement | the language becomes selectable for the chosen sites and the audit trail records pack version, reviewer and approver | System / acceptance | Test |

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
| Size | 97 | specified items (table rows) | Counted automatically at generation |
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
