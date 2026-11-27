<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMB-08 — Compensation, Loans & Benefits — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMB-08 |
| Title | Compensation, Loans & Benefits — Test Cases and Acceptance |
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
| Related documents | FRS-CMB-00, FRS-CMB-01, FRS-CMB-02, FRS-CMB-03, FRS-CMB-04, FRS-CMB-05, FRS-CMB-06, FRS-CMB-07, FRS-CMB-08, FRS-CMB-09, FRS-CMB-10, FRS-CMB-11, FRS-CMB-12, FRS-CMB-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-05 · R-10 · processes CMB-01–CMB-06 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-CMB-13.


## Scope, Loan, Exit And Talent Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-M430 | Eligibility method is the single source | E1044, E1041, E1056, E1050, E1022 | Same answer from screen, guarantor lock, payroll node and agent tool | RL-430 | Golden |
| TC-M432 | Guarantor lock blocks an application | LN-APP-2026-0014, E1041 | Rejected with the guarantee named as the reason | RL-432 | Negative |
| TC-M433 | Ceiling rises after five years | E1056 Anand Krishnan, 8 years 8 months | 6x basic ceiling applied | RL-433 | Golden |
| TC-M443 | Director override on special terms | LN-2026-0012, E1022 | Sanctioned above ceiling with approver, reason and rules waived recorded | RL-443 | Golden |
| TC-M452 | Closure releases guarantors | LN-2025-0112, E1050 | Release rows written; guarantors eligible again | RL-452 | Golden |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-19 | R-10 | Second loan blocked until repayment | Apply for a loan while one is outstanding, and separately apply for a salary advance. | Both blocked with the same reason. Both clear when the first loan closes. |  |
| T-20 | R-10 | Guarantor interlock works both ways | Name an employee as guarantor, then have that employee apply for a loan and be named guarantor again. | Both blocked. Both clear when the guaranteed loan is fully repaid. |  |
| T-21 | R-10 | Loan ceiling by service | Apply with four years of service and with six years, on a basic of 40,000. | Ceilings of 160,000 and 240,000. Exceeding either requires a recorded Director approval. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-CMB-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMB-TC-001 | CMB-UC-007 | CMB-CG-001 | CMB-US-019 | grade M3 at Pune with minimum 9,00,000, midpoint 12,00,000 and maximum 15,00,000 | I publish effective 1 April | the range is active from 1 April and the previous range ends 31 March | System / acceptance | Test |
| CMB-TC-002 | CMB-UC-007 | CMB-CG-001 | CMB-US-019 | a row with minimum 12,00,000 and midpoint 11,00,000 | I validate | the row is rejected naming minimum above midpoint | System / acceptance | Test |
| CMB-TC-003 | CMB-UC-007 | CMB-CG-001 | CMB-US-020 | an employee in grade M3 at Pune earning 10,80,000 | the range above is published | compa-ratio shows 0.90 and penetration shows 30% | System / acceptance | Test |
| CMB-TC-004 | CMB-UC-007 | CMB-CG-001 | CMB-US-020 | an employee earning 8,50,000 in the same range | the out-of-range list is opened | the employee appears as below minimum by 50,000 | System / acceptance | Test |
| CMB-TC-005 | CMB-UC-007 | CMB-CG-001 | CMB-US-021 | I manage four employees in grade M3 | I open the team view | each card shows compa-ratio without showing employees outside my subtree | System / acceptance | Test |
| CMB-TC-006 | CMB-UC-007 | CMB-CG-001 | CMB-US-021 | an employee moves to grade M4 | the change is effective | compa-ratio is recomputed against the M4 midpoint | System / acceptance | Test |
| CMB-TC-007 | CMB-UC-008 | CMB-CG-002 | CMB-US-022 | a guideline of 8 to 10% for rating 4 with compa-ratio below 0.90 | an employee rated 4 with compa-ratio 0.85 appears on my worksheet | the recommendation pre-fills at 9% with the range 8 to 10% shown | System / acceptance | Test |
| CMB-TC-008 | CMB-UC-008 | CMB-CG-002 | CMB-US-022 | I enter 12% for that employee | I try to submit | submission requires a justification for exceeding the guideline | System / acceptance | Test |
| CMB-TC-009 | CMB-UC-008 | CMB-CG-002 | CMB-US-023 | a bonus pool of 50,00,000 | approved worksheets total 49,20,000 | utilisation shows 98.4% and the cycle can close | System / acceptance | Test |
| CMB-TC-010 | CMB-UC-008 | CMB-CG-002 | CMB-US-023 | worksheets total 51,00,000 | closure is attempted | closure is blocked pending a recorded budget exception | System / acceptance | Test |
| CMB-TC-011 | CMB-UC-008 | CMB-CG-002 | CMB-US-024 | approved bonuses for 320 employees targeting the March run | the cycle is closed | 320 bonus inputs appear in the March run | System / acceptance | Test |
| CMB-TC-012 | CMB-UC-008 | CMB-CG-002 | CMB-US-024 | the March run is already finalised | the cycle closes | inputs move to the April run and I am notified | System / acceptance | Test |
| CMB-TC-013 | CMB-UC-009 | CMB-CG-003 | CMB-US-025 | a grant of 1,000 options on 1 April 2025 vesting 25% yearly | I view my equity on 2 April 2026 | 250 options show vested and 750 unvested | System / acceptance | Test |
| CMB-TC-014 | CMB-UC-009 | CMB-CG-003 | CMB-US-025 | I exercised 100 options | I view my equity | 150 vested, 100 exercised and 750 unvested are shown | System / acceptance | Test |
| CMB-TC-015 | CMB-UC-009 | CMB-CG-003 | CMB-US-026 | 100 options exercised at price 50 with fair market value 210 | finance confirms the exercise | a perquisite input of 16,000 is raised in the exercise month | System / acceptance | Test |
| CMB-TC-016 | CMB-UC-009 | CMB-CG-003 | CMB-US-026 | no fair market value is recorded for the date | the exercise is submitted | it is held and finance receives a request for a value | System / acceptance | Test |
| CMB-TC-017 | CMB-UC-010 | CMB-CG-004 | CMB-US-027 | the window is open from 1 to 15 March and I have no dependants enrolled | I add a spouse and two children and submit on 10 March | enrolment is confirmed and all three dependants appear in the next insurer file | System / acceptance | Test |
| CMB-TC-018 | CMB-UC-010 | CMB-CG-004 | CMB-US-027 | I add a parent aged 82 where the limit is 80 | I submit | the parent is rejected with the age limit shown | System / acceptance | Test |
| CMB-TC-019 | CMB-UC-010 | CMB-CG-004 | CMB-US-028 | a top-up with annual premium 6,000 | I select it | the monthly deduction shows 500 and a payroll input is raised from the next run | System / acceptance | Test |
| CMB-TC-020 | CMB-UC-010 | CMB-CG-004 | CMB-US-028 | I remove the top-up during the window | I resubmit | the deduction input is withdrawn | System / acceptance | Test |
| CMB-TC-021 | CMB-UC-010 | CMB-CG-004 | CMB-US-029 | employee E1018 reports a birth on 5 July | the event is recorded | E1018 has a window until 4 August and others do not | System / acceptance | Test |
| CMB-TC-022 | CMB-UC-010 | CMB-CG-004 | CMB-US-029 | the window lapses without submission | the date passes | the newborn is not added and HR is notified | System / acceptance | Test |
| CMB-TC-023 | CMB-UC-011 | CMB-CG-005 | CMB-US-030 | allowed employer rates of 0%, 5% and 10% of basic and basic of 50,000 | I select 10% | the projection shows 5,000 per month from the next open period | System / acceptance | Test |
| CMB-TC-024 | CMB-UC-011 | CMB-CG-005 | CMB-US-030 | I have not entered an account identifier | I confirm | confirmation is blocked asking for the identifier | System / acceptance | Test |
| CMB-TC-025 | CMB-UC-011 | CMB-CG-005 | CMB-US-031 | an employee whose employer contribution would exceed the configured cap by 1,200 | the run is computed | the excess of 1,200 is treated per plan configuration and flagged | System / acceptance | Test |
| CMB-TC-026 | CMB-UC-011 | CMB-CG-005 | CMB-US-031 | a cap change effective 1 April | March is recomputed after 1 April | March uses the cap in force in March | System / acceptance | Test |
| CMB-TC-027 | CMB-UC-012 | CMB-CG-006 | CMB-US-032 | an annual flexi budget of 1,20,000 and a meal limit of 26,400 | I allocate 26,400 to meal and 93,600 across other items | the allocation is accepted | System / acceptance | Test |
| CMB-TC-028 | CMB-UC-012 | CMB-CG-006 | CMB-US-032 | I allocate 30,000 to meal | I save | the meal line is rejected naming the 26,400 limit | System / acceptance | Test |
| CMB-TC-029 | CMB-UC-012 | CMB-CG-006 | CMB-US-033 | an employee allocated 24,000 to fuel and proved 18,000 | year end reconciliation runs | 6,000 is raised as a taxable input | System / acceptance | Test |
| CMB-TC-030 | CMB-UC-012 | CMB-CG-006 | CMB-US-033 | all allocations are fully proved | reconciliation runs | no taxable residue input is raised | System / acceptance | Test |
| CMB-TC-031 | CMB-UC-013 | CMB-CG-007 | CMB-US-034 | fixed pay of 9,60,000, bonus of 80,000, employer PF of 21,600 and medical premium of 18,000 | I open my statement | each category shows the amount and the total shows 10,79,600 | System / acceptance | Test |
| CMB-TC-032 | CMB-UC-013 | CMB-CG-007 | CMB-US-034 | I joined on 1 October | I open my statement | it states the period October to March | System / acceptance | Test |
| CMB-TC-033 | CMB-UC-013 | CMB-CG-007 | CMB-US-035 | an employee whose statement total differs from payroll by 2,000 | generation runs | that employee is excluded and listed for investigation | System / acceptance | Test |
| CMB-TC-034 | CMB-UC-013 | CMB-CG-007 | CMB-US-035 | all totals reconcile | I publish | every employee in scope receives a statement | System / acceptance | Test |
| CMB-TC-035 | CMB-UC-014 | CMB-CG-008 | CMB-US-036 | a population of 1,200 employees with complete controls | I run the analysis by gender | both unadjusted and adjusted gaps are shown with the method note | System / acceptance | Test |
| CMB-TC-036 | CMB-UC-014 | CMB-CG-008 | CMB-US-036 | a grade-location group with 4 members and a minimum size of 10 | results are produced | that group is suppressed as insufficient size | System / acceptance | Test |
| CMB-TC-037 | CMB-UC-014 | CMB-CG-008 | CMB-US-037 | 12 remediation items totalling 9,60,000 | I approve the budget | items move to approved and are routed into the next revision cycle | System / acceptance | Test |
| CMB-TC-038 | CMB-UC-014 | CMB-CG-008 | CMB-US-037 | an approved item is applied in the revision cycle | the revision is effective | the item shows closed with the effective date | System / acceptance | Test |
| CMB-TC-039 | CMB-UC-015 | CMB-CG-009 | CMB-US-038 | E1056 accepted a ₹2,00,000 award on 2026-12-01 vesting 40% at 12 months and 60% at 24 months | she opens her rewards page | she sees ₹80,000 vesting on 2027-12-01 and ₹1,20,000 on 2028-12-01 with the clawback terms | System / acceptance | Test |
| CMB-TC-040 | CMB-UC-015 | CMB-CG-009 | CMB-US-038 | E1056 has not yet accepted the award | she opens the award letter | she must accept the clawback terms before the award shows as active | System / acceptance | Test |
| CMB-TC-041 | CMB-UC-015 | CMB-CG-009 | CMB-US-039 | E1056's first tranche of ₹80,000 vests on 2027-12-01 and the December run is open | vesting is evaluated | one payroll input of ₹80,000 appears in the December run | System / acceptance | Test |
| CMB-TC-042 | CMB-UC-015 | CMB-CG-009 | CMB-US-039 | vesting is evaluated again for the same date | the job reruns | no second input is raised | System / acceptance | Test |
| CMB-TC-043 | CMB-UC-015 | CMB-CG-009 | CMB-US-040 | ₹48,00,000 of awards with 24-month vesting are active | the November 2026 accrual is published | the accrual equals the earned portion of unvested tranches for the month | System / acceptance | Test |
| CMB-TC-044 | CMB-UC-015 | CMB-CG-009 | CMB-US-040 | a tranche of ₹60,000 is forfeited | the next accrual runs | the accrued liability for that tranche is reversed | System / acceptance | Test |
| CMB-TC-045 | CMB-UC-016 | CMB-CG-010 | CMB-US-041 | grade S3 has a midpoint of ₹3,60,000 a year and E1034 at Peenya Works earns ₹2,88,000 | I run the CNC machinist benchmark | E1034 is flagged with compa-ratio 0.80, below the 0.85 floor | System / acceptance | Test |
| CMB-TC-046 | CMB-UC-016 | CMB-CG-010 | CMB-US-041 | the cell S4 at Oragadam with 5+ years has 3 employees and a minimum size of 5 | results are produced | that cell is suppressed and shown as insufficient size | System / acceptance | Test |
| CMB-TC-047 | CMB-UC-016 | CMB-CG-010 | CMB-US-042 | E1068 joined Chakan Works in 2026 at ₹3,40,000 and E1021 with 6 years earns ₹3,20,000 in the same grade | the benchmark runs | the pair is flagged as an inversion | System / acceptance | Test |
| CMB-TC-048 | CMB-UC-016 | CMB-CG-010 | CMB-US-042 | I tag E1021 for correction with ₹30,000 | I save the run | a pre-cycle recommendation of ₹30,000 appears for E1021 in the revision worksheet | System / acceptance | Test |
| CMB-TC-049 | CMB-UC-016 | CMB-CG-010 | CMB-US-043 | I manage 12 machinists at Peenya Works | I open the revision worksheet | I see each team member's band position and no data for employees outside my team | System / acceptance | Test |
| CMB-TC-050 | CMB-UC-016 | CMB-CG-010 | CMB-US-043 | one of my team has a pre-cycle recommendation | I view that row | the recommendation and HR's reason are shown | System / acceptance | Test |
| CMB-TC-051 | CMB-UC-017 | CMB-CG-011 | CMB-US-044 | the rule pack for 2025-26 is published and Legal-validated with a minimum working-day requirement of 30 days | I run the bonus computation | E1022, who worked 24 days after joining, is listed ineligible with 24 days shown | System / acceptance | Test |
| CMB-TC-052 | CMB-UC-017 | CMB-CG-011 | CMB-US-044 | the director has declared a rate of 8.33% within the configured range | the computation completes | each eligible employee's working shows rate, capped salary and months, and payroll inputs are raised in the bonus run | System / acceptance | Test |
| CMB-TC-053 | CMB-UC-017 | CMB-CG-011 | CMB-US-045 | E1019 separates on 2026-11-30 after 7 years 8 months with last drawn basic plus DA of ₹26,000 | gratuity is computed | the working shows 15/26 × ₹26,000 × 8 years = ₹1,20,000 with the rounding of 8 months noted | System / acceptance | Test |
| CMB-TC-054 | CMB-UC-017 | CMB-CG-011 | CMB-US-045 | E1019 had 4 years 2 months of service and resigned | gratuity eligibility is tested | no gratuity is raised and the unmet service threshold is shown | System / acceptance | Test |
| CMB-TC-055 | CMB-UC-017 | CMB-CG-011 | CMB-US-046 | the 2025-26 bonus run has been paid | I open the bonus register | each row matches the paid payroll input to the rupee | System / acceptance | Test |
| CMB-TC-056 | CMB-UC-017 | CMB-CG-011 | CMB-US-046 | a payroll input is reversed after payment | the register is viewed | the reversal is shown with date and reason | System / acceptance | Test |

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
| Size | 64 | specified items (table rows) | Counted automatically at generation |
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
