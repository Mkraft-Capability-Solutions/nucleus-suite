<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-SSV-08 — Self-service & Helpdesk — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-SSV-08 |
| Title | Self-service & Helpdesk — Test Cases and Acceptance |
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
| Related documents | FRS-SSV-00, FRS-SSV-01, FRS-SSV-02, FRS-SSV-03, FRS-SSV-04, FRS-SSV-05, FRS-SSV-06, FRS-SSV-07, FRS-SSV-08, FRS-SSV-09, FRS-SSV-10, FRS-SSV-11, FRS-SSV-12, FRS-SSV-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-03 · processes SSV-01–SSV-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-SSV-13.


The source has no TC- cases for this domain; verification is by the client acceptance tests below and the user-story criteria in FRS-SSV-13.

## Client acceptance tests (T-xx)

_No entries in source for this scope._

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-SSV-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SSV-TC-001 | SSV-UC-006 | SSV-CG-001 | SSV-US-013 | an article's review date is 2026-10-01 | the date passes without review | it is flagged stale and excluded from grounding | System / acceptance | Test |
| SSV-TC-002 | SSV-UC-006 | SSV-CG-001 | SSV-US-013 | I review and republish it | the new version is indexed | the assistant cites the new version | System / acceptance | Test |
| SSV-TC-003 | SSV-UC-006 | SSV-CG-001 | SSV-US-014 | the gate pass article has a published Marathi variant | I search in Marathi | the Marathi article is returned | System / acceptance | Test |
| SSV-TC-004 | SSV-UC-006 | SSV-CG-001 | SSV-US-014 | the overtime article has no Marathi variant | I open it | the English version is shown with a note that a translation is not available | System / acceptance | Test |
| SSV-TC-005 | SSV-UC-007 | SSV-CG-002 | SSV-US-015 | a new-parent journey triggers on maternity leave approval | an employee's maternity leave from 2026-11-01 is approved | the journey starts with the benefits checklist task | System / acceptance | Test |
| SSV-TC-006 | SSV-UC-007 | SSV-CG-002 | SSV-US-015 | the leave is cancelled | the cancellation is saved | the journey is cancelled and pending nudges withdrawn | System / acceptance | Test |
| SSV-TC-007 | SSV-UC-007 | SSV-CG-002 | SSV-US-016 | a return-to-work task is due on 2027-05-02 | the date arrives | the task appears in my unified inbox | System / acceptance | Test |
| SSV-TC-008 | SSV-UC-007 | SSV-CG-002 | SSV-US-016 | I complete it | the journey refreshes | the step shows Complete with my name | System / acceptance | Test |
| SSV-TC-009 | SSV-UC-008 | SSV-CG-003 | SSV-US-017 | a screen reader is active | I tab through the leave form | every field announces its label and required state | System / acceptance | Test |
| SSV-TC-010 | SSV-UC-008 | SSV-CG-003 | SSV-US-017 | I submit with the end date empty | validation runs | the error is announced and focus moves to the end date field | System / acceptance | Test |
| SSV-TC-011 | SSV-UC-008 | SSV-CG-003 | SSV-US-018 | I select high contrast | I open My attendance | all text meets a contrast ratio of at least 4.5:1 | System / acceptance | Test |
| SSV-TC-012 | SSV-UC-008 | SSV-CG-003 | SSV-US-018 | I sign in on another device | the app loads | my theme choice is kept | System / acceptance | Test |
| SSV-TC-013 | SSV-UC-009 | SSV-CG-004 | SSV-US-019 | biometric unlock is enabled | I open the app | it unlocks after a fingerprint match without a password | System / acceptance | Test |
| SSV-TC-014 | SSV-UC-009 | SSV-CG-004 | SSV-US-019 | five failed fingerprint attempts occur | the sixth attempt starts | the app asks for my PIN | System / acceptance | Test |
| SSV-TC-015 | SSV-UC-009 | SSV-CG-004 | SSV-US-020 | E1023 reports her phone lost on 2026-10-03 | I revoke the device | the tokens are invalidated immediately | System / acceptance | Test |
| SSV-TC-016 | SSV-UC-009 | SSV-CG-004 | SSV-US-020 | the lost phone is opened later | the app launches | the cache is wiped and sign-in is required | System / acceptance | Test |
| SSV-TC-017 | SSV-UC-010 | SSV-CG-005 | SSV-US-021 | E1018 asked about her earned leave balance on the messaging channel at 09:10 | she opens the mobile app at 09:25 | the same thread shows her question and the answer citing the leave policy clause | System / acceptance | Test |
| SSV-TC-018 | SSV-UC-010 | SSV-CG-005 | SSV-US-021 | an unconfirmed 2-day leave draft exists in the messaging thread | E1018 resumes in the mobile app | the draft is shown and must be confirmed again in the app before it is submitted | System / acceptance | Test |
| SSV-TC-019 | SSV-UC-010 | SSV-CG-005 | SSV-US-022 | E1066 at Chakan Works has tapped her badge and entered her PIN | she asks in Marathi for tomorrow's shift | the kiosk replies in Marathi on screen and by voice with shift A 08:00–20:00 | System / acceptance | Test |
| SSV-TC-020 | SSV-UC-010 | SSV-CG-005 | SSV-US-022 | the kiosk session has had no input for 60 seconds | the timer expires | the session ends and no personal data remains on screen | System / acceptance | Test |
| SSV-TC-021 | SSV-UC-010 | SSV-CG-005 | SSV-US-023 | the assistant's confidence is 0.52 against a threshold of 0.70 | an employee asks about night-shift allowance eligibility | a ticket is raised with the transcript attached and the employee is given the ticket number | System / acceptance | Test |
| SSV-TC-022 | SSV-UC-010 | SSV-CG-005 | SSV-US-023 | HR operations resolves that ticket | the resolution is saved | the reply is posted to the channel the employee used most recently | System / acceptance | Test |
| SSV-TC-023 | SSV-UC-011 | SSV-CG-006 | SSV-US-024 | E1042 raises a complaint naming her line manager E1019 | the case is created | neither E1019 nor E1019's manager can see, search or be notified about the case | System / acceptance | Test |
| SSV-TC-024 | SSV-UC-011 | SSV-CG-006 | SSV-US-024 | the case is under inquiry | E1042 checks its status | she sees the status Under inquiry and the next hearing date but not committee notes | System / acceptance | Test |
| SSV-TC-025 | SSV-UC-011 | SSV-CG-006 | SSV-US-025 | an investigator is granted access for 14 days from 2026-11-05 | 2026-11-19 00:00 passes | the grant has expired and both the grant and the expiry appear in the case audit | System / acceptance | Test |
| SSV-TC-026 | SSV-UC-011 | SSV-CG-006 | SSV-US-025 | a payroll manager with entity-wide HR access opens the case link | the request is evaluated | access is denied and the case owner receives an alert within 5 minutes | System / acceptance | Test |
| SSV-TC-027 | SSV-UC-011 | SSV-CG-006 | SSV-US-026 | I hold the case-audit grant for Vindhya Precision Industries | I open the audit for a closed harassment case | I see each access with principal, action and timestamp but no notes or evidence | System / acceptance | Test |
| SSV-TC-028 | SSV-UC-011 | SSV-CG-006 | SSV-US-026 | I hold only the general audit grant | I search the action ledger | confidential case entries are not listed | System / acceptance | Test |
| SSV-TC-029 | SSV-UC-012 | SSV-CG-007 | SSV-US-027 | E1018's September 2026 payroll run is finalised | she requests a salary certificate addressed to her bank | a signed PDF with a verification QR code is ready within 10 seconds showing September 2026 gross and net pay | System / acceptance | Test |
| SSV-TC-030 | SSV-UC-012 | SSV-CG-007 | SSV-US-027 | E1018 has already generated 3 salary certificates in November 2026 | she requests a fourth | the request is refused and the next eligible date 2026-12-01 is shown | System / acceptance | Test |
| SSV-TC-031 | SSV-UC-012 | SSV-CG-007 | SSV-US-028 | address-proof template version 3 is approved and version 2 is withdrawn | any employee requests address proof | only version 3 is used and the issue log records version 3 | System / acceptance | Test |
| SSV-TC-032 | SSV-UC-012 | SSV-CG-007 | SSV-US-028 | a visa letter request contains free-text addressee details | the employee submits it | it waits in the HR operations queue and is signed only after HR approves | System / acceptance | Test |
| SSV-TC-033 | SSV-UC-012 | SSV-CG-007 | SSV-US-029 | E1032's last working day was 2026-10-31 and the final settlement is complete | he requests an experience letter through alumni access | a signed letter is issued showing his service dates and last designation | System / acceptance | Test |
| SSV-TC-034 | SSV-UC-012 | SSV-CG-007 | SSV-US-029 | E1032's final settlement is still pending | he requests the letter | the request is held and he is told the letter will be available once the settlement completes | System / acceptance | Test |

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
| Size | 34 | specified items (table rows) | Counted automatically at generation |
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
