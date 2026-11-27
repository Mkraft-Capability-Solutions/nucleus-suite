<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-08 — Payroll — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-08 |
| Title | Payroll — Test Cases and Acceptance |
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
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-PAY-13.


## Payroll And Finance Golden Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Y281 | 50% floor add-back fires | E1014 and E1049 in 13_Salary_Structure | Excluded components exceed 50%; excess added back to the wage base | RL-281 | Golden |
| TC-Y290 | Daily-wage earnings node selected by class | E1032 (WC-CONT) | Paid on days present, not a prorated monthly rate; day count on the payslip | RL-290 | Golden |
| TC-Y302 | PT differs by state on one run | LE-01 Karnataka vs LE-02 Tamil Nadu, Sep 2026 | Different PT amounts; one state where it does not apply | RL-302 | Golden |
| TC-Y330 | Two runs against one period | PR-2026-09-01 and PR-2026-09-02 | Regular pays 30 Sep; off-cycle OT pays 07 Oct with its own bank file and journal | RL-330 | Golden |

## Property Tests

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PR01 | Net pay never exceeds gross | Any run | Invariant holds | — | Property |
| TC-PR02 | Deductions never produce negative net without an explicit flag | Any run | Invariant holds | RL-311 | Property |
| TC-PR03 | Recomputation is idempotent | Any closed run | Identical output from the snapshot | RL-251 | Property |
| TC-PR04 | Proration across any month boundary sums to the full-month value | Any month | Invariant holds | RL-272 | Property |

## Client acceptance tests (T-xx)

_No entries in source for this scope._

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-PAY-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PAY-TC-001 | PAY-UC-015 | PAY-CG-001 | PAY-US-032 | an entity is created for a new country with pack version 1.0 effective 1 April 2027 | I bind the entity and map all components | validation passes and run creation is enabled | System / acceptance | Test |
| PAY-TC-002 | PAY-UC-015 | PAY-CG-001 | PAY-US-032 | one component is unmapped | I attempt to bind | binding is refused naming the component | System / acceptance | Test |
| PAY-TC-003 | PAY-UC-015 | PAY-CG-001 | PAY-US-033 | a run for the new entity is calculated | I open the cockpit | states, flags and approval gates match those of an India run | System / acceptance | Test |
| PAY-TC-004 | PAY-UC-015 | PAY-CG-001 | PAY-US-033 | the run is recomputed from its snapshot | results are compared | they match to the minor currency unit | System / acceptance | Test |
| PAY-TC-005 | PAY-UC-016 | PAY-CG-002 | PAY-US-034 | a revision effective 1 June 2026 is approved on 10 September | the October run audit opens | an arrears batch shows June, July and August differences by component | System / acceptance | Test |
| PAY-TC-006 | PAY-UC-016 | PAY-CG-002 | PAY-US-034 | the batch is approved | the October run is calculated | arrears lines reference the June, July and August regular runs respectively | System / acceptance | Test |
| PAY-TC-007 | PAY-UC-016 | PAY-CG-002 | PAY-US-035 | my basic was revised by 2,000 rupees from 1 June | I open the October payslip | the statement shows 2,000 basic arrears for each of June, July and August with PF differences | System / acceptance | Test |
| PAY-TC-008 | PAY-UC-016 | PAY-CG-002 | PAY-US-035 | no change affects me | I open the October payslip | no arrears section appears | System / acceptance | Test |
| PAY-TC-009 | PAY-UC-017 | PAY-CG-003 | PAY-US-036 | my annual salary and declarations are loaded | I open tax declaration and projection | monthly TDS under each regime is shown side by side | System / acceptance | Test |
| PAY-TC-010 | PAY-UC-017 | PAY-CG-003 | PAY-US-036 | I choose a regime and save | the next run is calculated | TDS follows the chosen regime | System / acceptance | Test |
| PAY-TC-011 | PAY-UC-017 | PAY-CG-003 | PAY-US-037 | an employee declared 1,50,000 rupees and proved 1,00,000 | I accept 1,00,000 with a reason | the projection uses 1,00,000 and the employee sees the change | System / acceptance | Test |
| PAY-TC-012 | PAY-UC-017 | PAY-CG-003 | PAY-US-037 | an employee submits no proof by the window close | the next run is calculated | the declared amount is treated as zero and TDS increases | System / acceptance | Test |
| PAY-TC-013 | PAY-UC-018 | PAY-CG-004 | PAY-US-038 | my remaining fuel limit is 18,000 rupees | I claim 3,200 rupees with a bill dated 4 November 2026 | the claim is created and routed to my manager | System / acceptance | Test |
| PAY-TC-014 | PAY-UC-018 | PAY-CG-004 | PAY-US-038 | my remaining limit is 1,000 rupees | I claim 3,200 rupees | the claim is limited to 1,000 and I am told the excess | System / acceptance | Test |
| PAY-TC-015 | PAY-UC-018 | PAY-CG-004 | PAY-US-039 | a 3,200 rupee fuel claim is approved by the manager | I verify it | a payroll input is raised for the next open run with exempt and taxable portions | System / acceptance | Test |
| PAY-TC-016 | PAY-UC-018 | PAY-CG-004 | PAY-US-039 | the November run is calculated | the employee opens the payslip | the reimbursement appears as a separate line | System / acceptance | Test |
| PAY-TC-017 | PAY-UC-019 | PAY-CG-005 | PAY-US-040 | net after statutory deductions is 20,000 rupees, the floor 12,000 and an order requires 10,000 | the run is calculated | 8,000 is deducted and 2,000 is carried forward | System / acceptance | Test |
| PAY-TC-018 | PAY-UC-019 | PAY-CG-005 | PAY-US-040 | a loan instalment also applies and the order ranks higher | the run is calculated | the order is deducted first and the loan uses only what remains above the floor | System / acceptance | Test |
| PAY-TC-019 | PAY-UC-019 | PAY-CG-005 | PAY-US-041 | an order has 3,000 rupees remaining | the next run deducts 3,000 | the order closes and I am notified | System / acceptance | Test |
| PAY-TC-020 | PAY-UC-019 | PAY-CG-005 | PAY-US-041 | the order is closed | the following run is calculated | no deduction line is written for it | System / acceptance | Test |
| PAY-TC-021 | PAY-UC-020 | PAY-CG-006 | PAY-US-042 | extract 42 contains 37 changes | the provider acknowledges 37 records for sequence 42 | the extract is marked acknowledged | System / acceptance | Test |
| PAY-TC-022 | PAY-UC-020 | PAY-CG-006 | PAY-US-042 | the provider acknowledges 35 records | matching runs | the extract is rejected and the 2 missing records are listed | System / acceptance | Test |
| PAY-TC-023 | PAY-UC-020 | PAY-CG-006 | PAY-US-043 | provider net for an employee differs from the expected net by 450 rupees | reconciliation runs | the employee is listed with both values | System / acceptance | Test |
| PAY-TC-024 | PAY-UC-020 | PAY-CG-006 | PAY-US-043 | all differences are resolved | I close reconciliation | the period is marked reconciled | System / acceptance | Test |
| PAY-TC-025 | PAY-UC-021 | PAY-CG-007 | PAY-US-044 | one employee in Q2 has an invalid PAN | I prepare the 24Q return | filing is blocked and the employee is listed | System / acceptance | Test |
| PAY-TC-026 | PAY-UC-021 | PAY-CG-007 | PAY-US-044 | all records are valid | I approve the return | it is marked filed with the filing date | System / acceptance | Test |
| PAY-TC-027 | PAY-UC-021 | PAY-CG-007 | PAY-US-045 | FY 2026-27 certificates are approved for publication | I open my tax documents | Form 16 and Form 12BA are available to download | System / acceptance | Test |
| PAY-TC-028 | PAY-UC-021 | PAY-CG-007 | PAY-US-045 | a correction later revises my TDS | the year is re-opened and re-locked | a revised Form 16 replaces the earlier one, which remains in history | System / acceptance | Test |
| PAY-TC-029 | PAY-UC-021 | PAY-CG-007 | PAY-US-046 | FY 2026-27 is locked | a user tries to create a run dated March 2027 | creation is refused | System / acceptance | Test |
| PAY-TC-030 | PAY-UC-021 | PAY-CG-007 | PAY-US-046 | a re-open is requested | a second user approves with reason | the year is re-opened and the event is audited | System / acceptance | Test |
| PAY-TC-031 | PAY-UC-022 | PAY-CG-008 | PAY-US-047 | PLANT-BLR-DW has a weekly calendar and PLANT-BLR is monthly | the weekly run for 2026-11-02 to 2026-11-08 is locked | attendance input for the monthly run remains editable | System / acceptance | Test |
| PAY-TC-032 | PAY-UC-022 | PAY-CG-008 | PAY-US-047 | E1032 worked 6 days at a daily rate of 72,000 paise | the weekly run computes | gross earnings are 432,000 paise | System / acceptance | Test |
| PAY-TC-033 | PAY-UC-022 | PAY-CG-008 | PAY-US-048 | four weekly runs in November 2026 | the month closes | the PF wage base for each worker equals the sum of the four weekly bases | System / acceptance | Test |
| PAY-TC-034 | PAY-UC-022 | PAY-CG-008 | PAY-US-048 | a worker whose weekly earnings cross the ESI threshold in week 3 | week 4 is computed | ESI continues and the case is flagged | System / acceptance | Test |
| PAY-TC-035 | PAY-UC-022 | PAY-CG-008 | PAY-US-049 | a weekly run paid on 2026-11-10 | the run is approved | a journal for that run is emitted with posting date 2026-11-10 | System / acceptance | Test |
| PAY-TC-036 | PAY-UC-022 | PAY-CG-008 | PAY-US-049 | two weekly runs in the same month | I open the GL interface | I see two journals with different run identifiers | System / acceptance | Test |
| PAY-TC-037 | PAY-UC-023 | PAY-CG-009 | PAY-US-050 | I am E1010 Nandita Bose with year-to-date results to October 2026 | I model the other regime | I see projected annual tax and monthly take-home for both regimes | System / acceptance | Test |
| PAY-TC-038 | PAY-UC-023 | PAY-CG-009 | PAY-US-050 | the projected difference is ₹1,850 a month | I open the explanation | each line shows the component and rule that changed | System / acceptance | Test |
| PAY-TC-039 | PAY-UC-023 | PAY-CG-009 | PAY-US-051 | a scenario with 5% VPF and a loan EMI of ₹6,000 | the scenario computes | monthly take-home shows both deductions applied | System / acceptance | Test |
| PAY-TC-040 | PAY-UC-023 | PAY-CG-009 | PAY-US-051 | an EMI above my eligibility | the scenario computes | the maximum allowed EMI is shown | System / acceptance | Test |
| PAY-TC-041 | PAY-UC-023 | PAY-CG-009 | PAY-US-052 | 500 employees ran scenarios during the November window | I lock November inputs | no input row originates from a scenario that was not submitted | System / acceptance | Test |
| PAY-TC-042 | PAY-UC-023 | PAY-CG-009 | PAY-US-052 | a submitted declaration | I view its record | it references the scenario the employee chose | System / acceptance | Test |
| PAY-TC-043 | PAY-UC-024 | PAY-CG-010 | PAY-US-053 | E1044's September loan recovery line of ₹8,400 | I open its trace | I see the loan schedule row, recovery node and rule pack version | System / acceptance | Test |
| PAY-TC-044 | PAY-UC-024 | PAY-CG-010 | PAY-US-053 | I request recomputation | it completes | the recomputed value equals ₹8,400 to the paisa | System / acceptance | Test |
| PAY-TC-045 | PAY-UC-024 | PAY-CG-010 | PAY-US-054 | the September PLANT-PUN run | I open approval history from any of its payslips | lock, review, approval and disbursement steps show actor and timestamp | System / acceptance | Test |
| PAY-TC-046 | PAY-UC-024 | PAY-CG-010 | PAY-US-054 | a recomputation mismatch | it is detected | I receive a critical discrepancy alert naming the line | System / acceptance | Test |
| PAY-TC-047 | PAY-UC-024 | PAY-CG-010 | PAY-US-055 | PF employer contribution for PLANT-PUN rose 6% in September | I open the register total | contributing payslip lines are listed, largest first | System / acceptance | Test |
| PAY-TC-048 | PAY-UC-024 | PAY-CG-010 | PAY-US-055 | I select one line | the trace opens | its inputs are shown as at the snapshot timestamp | System / acceptance | Test |
| PAY-TC-049 | PAY-UC-025 | PAY-CG-011 | PAY-US-056 | E1022's October net pay is ₹27,640 and a hold is approved | the October bank file is prepared | E1022 is excluded and ₹27,640 is posted to held-salary liability | System / acceptance | Test |
| PAY-TC-050 | PAY-UC-025 | PAY-CG-011 | PAY-US-056 | the October bank file is already prepared | I try to hold E1022 | the hold is refused and the message says to recall or use the next run | System / acceptance | Test |
| PAY-TC-051 | PAY-UC-025 | PAY-CG-011 | PAY-US-057 | a ₹27,640 hold from October | I release it into the November run | November shows a release line referencing October and the liability is cleared | System / acceptance | Test |
| PAY-TC-052 | PAY-UC-025 | PAY-CG-011 | PAY-US-057 | the release is urgent | I choose an off-cycle run | the amount is paid in that run with the same reference | System / acceptance | Test |
| PAY-TC-053 | PAY-UC-025 | PAY-CG-011 | PAY-US-058 | a hold is approved on my October pay | the hold takes effect | I receive a notification with the reason category and HR contact | System / acceptance | Test |
| PAY-TC-054 | PAY-UC-025 | PAY-CG-011 | PAY-US-058 | the hold is released | the release run is approved | I am notified of the pay date | System / acceptance | Test |

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
| Size | 62 | specified items (table rows) | Counted automatically at generation |
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
