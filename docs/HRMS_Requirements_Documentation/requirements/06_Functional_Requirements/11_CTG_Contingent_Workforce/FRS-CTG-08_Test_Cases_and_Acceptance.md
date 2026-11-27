<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CTG-08 — Contingent Workforce — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CTG-08 |
| Title | Contingent Workforce — Test Cases and Acceptance |
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
| Related documents | FRS-CTG-00, FRS-CTG-01, FRS-CTG-02, FRS-CTG-03, FRS-CTG-04, FRS-CTG-05, FRS-CTG-06, FRS-CTG-07, FRS-CTG-08, FRS-CTG-09, FRS-CTG-10, FRS-CTG-11, FRS-CTG-12, FRS-CTG-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · processes CTG-01–CTG-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-CTG-13.


The source has no TC- cases for this domain; verification is by the client acceptance tests below and the user-story criteria in FRS-CTG-13.

## Client acceptance tests (T-xx)

_No entries in source for this scope._

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-CTG-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CTG-TC-001 | CTG-UC-004 | CTG-CG-001 | CTG-US-010 | VN-01's licence at Peenya Works permits 20 workers | I set a cap of 25 for VN-01 at Peenya Works | the cap is refused and the licensed headcount of 20 is shown | System / acceptance | Test |
| CTG-TC-002 | CTG-UC-004 | CTG-CG-001 | CTG-US-010 | a cap of 4 for VN-01 at Peenya Works with 4 workers deployed | a fifth worker is registered | registration is refused and the cap is named | System / acceptance | Test |
| CTG-TC-003 | CTG-UC-004 | CTG-CG-001 | CTG-US-011 | VN-04 Deccan Facility Services' contract at Medchal Works ends on 30 Sep 2026 and no renewal has been raised | the configured 30-day lead time is reached on 31 Aug 2026 | I receive an alert naming VN-04, Medchal Works and the 30 Sep end date | System / acceptance | Test |
| CTG-TC-004 | CTG-UC-004 | CTG-CG-001 | CTG-US-011 | the contract is not renewed by 30 Sep | a VN-04 worker is submitted for deployment on 01 Oct | the deployment is blocked | System / acceptance | Test |
| CTG-TC-005 | CTG-UC-004 | CTG-CG-001 | CTG-US-012 | VN-01's rate is 700 rupees per worker per day from 01 Apr 2025 | I add a rate of 735 rupees effective 01 Oct 2026 | September 2026 invoices reconcile at 700 and October 2026 invoices at 735 | System / acceptance | Test |
| CTG-TC-006 | CTG-UC-004 | CTG-CG-001 | CTG-US-012 | the same rate card | I add a row effective 15 Sep 2026 that overlaps the existing rows | the row is refused with the overlapping period shown | System / acceptance | Test |
| CTG-TC-007 | CTG-UC-005 | CTG-CG-002 | CTG-US-013 | VN-01 has not produced its August 2026 PF challan | I try to approve INV-VN01-2608 | approval is blocked with the reason 'statutory verification incomplete for Aug 2026' | System / acceptance | Test |
| CTG-TC-008 | CTG-UC-005 | CTG-CG-002 | CTG-US-013 | VN-01's August challans are uploaded and the vendor-period is marked Verified | I open INV-VN01-2608 | approval is available | System / acceptance | Test |
| CTG-TC-009 | CTG-UC-005 | CTG-CG-002 | CTG-US-014 | VN-01 deployed 4 workers in August including E1034 and E1036 | the ESI contribution list omits E1036 | the reconciliation shows E1036 as missing and Verified cannot be selected | System / acceptance | Test |
| CTG-TC-010 | CTG-UC-005 | CTG-CG-002 | CTG-US-014 | the wage register shows 26 days for E1034 and attendance holds 26 | the reconciliation runs | E1034 is shown as covered with no day mismatch | System / acceptance | Test |
| CTG-TC-011 | CTG-UC-005 | CTG-CG-002 | CTG-US-015 | VN-01's August verification is incomplete and its invoice is blocked | I release the invoice with the reason 'Challan paid, upload delayed; evidence due 10 Oct' | the release records me, the time, the reason and the waived rule | System / acceptance | Test |
| CTG-TC-012 | CTG-UC-005 | CTG-CG-002 | CTG-US-015 | the release is recorded | an auditor views the invoice | the waiver and its reason are shown alongside the decision | System / acceptance | Test |
| CTG-TC-013 | CTG-UC-006 | CTG-CG-003 | CTG-US-016 | E1036 is registered at Peenya Works and has not completed the safety induction | she presents at the gate terminal | entry is refused, the attempt is logged and an exception is raised to the time office | System / acceptance | Test |
| CTG-TC-014 | CTG-UC-006 | CTG-CG-003 | CTG-US-016 | her induction is recorded as passed and safety shoes, helmet and goggles are issued and acknowledged | the checklist completes | gate access is activated and her next gate punch is accepted | System / acceptance | Test |
| CTG-TC-015 | CTG-UC-006 | CTG-CG-003 | CTG-US-017 | a helmet, safety shoes and goggles are issued to me on 02 Sep | I acknowledge receipt at the site kiosk | each item is recorded against me with the issue date and my acknowledgement | System / acceptance | Test |
| CTG-TC-016 | CTG-UC-006 | CTG-CG-003 | CTG-US-017 | only two of the three required items are issued | I acknowledge them | my gate access stays pending and the missing item is shown | System / acceptance | Test |
| CTG-TC-017 | CTG-UC-006 | CTG-CG-003 | CTG-US-018 | VN-01 has 4 active workers at Peenya Works | I open the site induction and PPE status list | each worker shows induction date, validity end, PPE items issued and gate access status | System / acceptance | Test |
| CTG-TC-018 | CTG-UC-006 | CTG-CG-003 | CTG-US-018 | one worker's induction validity has ended | the list is refreshed | that worker is flagged and their gate access shows Suspended | System / acceptance | Test |
| CTG-TC-019 | CTG-UC-007 | CTG-CG-004 | CTG-US-019 | worker CW-2231 at Chakan Works has 26 gate days in October 2026 and the register pays 24 | validation runs | CW-2231 is classified Days mismatch with 2 unpaid days | System / acceptance | Test |
| CTG-TC-020 | CTG-UC-007 | CTG-CG-004 | CTG-US-019 | the register pays CW-2240 a daily rate ₹35 below the applicable minimum wage | validation runs | CW-2240 is classified Underpaid with the shortfall per day and for the month | System / acceptance | Test |
| CTG-TC-021 | CTG-UC-007 | CTG-CG-004 | CTG-US-020 | vendor V-014 for October 2026 has 3 Underpaid workers | I open the invoice | it shows Held with reason wage verification incomplete | System / acceptance | Test |
| CTG-TC-022 | CTG-UC-007 | CTG-CG-004 | CTG-US-020 | the vendor uploads arrears proof and all 3 pass | validation re-runs | the vendor-period shows Wage verified and the invoice becomes payable | System / acceptance | Test |
| CTG-TC-023 | CTG-UC-007 | CTG-CG-004 | CTG-US-021 | the register includes CW-2299 who is not registered on the engagement | the file is validated | the row is rejected and I receive a flag naming CW-2299 and the vendor | System / acceptance | Test |
| CTG-TC-024 | CTG-UC-007 | CTG-CG-004 | CTG-US-021 | CW-2299 also has gate punches in October | I open the flag | the punch dates are shown for investigation | System / acceptance | Test |
| CTG-TC-025 | CTG-UC-008 | CTG-CG-005 | CTG-US-022 | the machining line plan rises 18% in October 2027 and absence historically rises 6% that month | the forecast is computed | October shows the higher requirement with both drivers explained | System / acceptance | Test |
| CTG-TC-026 | CTG-UC-008 | CTG-CG-005 | CTG-US-022 | the agent proposes 12 more helpers for October | I reduce it to 8 and accept | 8 is used in the forecast and my edit is recorded in the action ledger | System / acceptance | Test |
| CTG-TC-027 | CTG-UC-008 | CTG-CG-005 | CTG-US-023 | Chakan Works is licensed for 450 contract workers and October 2027 forecasts 472 | capacity is compared | 22 workers are shown as unallocatable and I am alerted | System / acceptance | Test |
| CTG-TC-028 | CTG-UC-008 | CTG-CG-005 | CTG-US-023 | the forecast is reduced to 445 | capacity is compared again | the alert is cleared | System / acceptance | Test |
| CTG-TC-029 | CTG-UC-008 | CTG-CG-005 | CTG-US-024 | the plan totals ₹6.8 crore for FY 2027-28 at Chakan Works | I open the approval | I see monthly cost by line and vendor | System / acceptance | Test |
| CTG-TC-030 | CTG-UC-008 | CTG-CG-005 | CTG-US-024 | the approved plan has 100 contract workers on the assembly line for May 2027 | actual deployment reaches 114 | Plant HR is alerted to a 14% variance on that line | System / acceptance | Test |

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
