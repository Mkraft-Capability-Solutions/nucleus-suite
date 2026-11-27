<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-08 — Finance & ERP — Test Cases and Acceptance

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-08 |
| Title | Finance & ERP — Test Cases and Acceptance |
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
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 19_Test_Cases<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 10_Acceptance_Tests<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 68_Acceptance_Test_Data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-FIN-13.


## Payroll And Finance Golden Cases

| Case ID | Scenario | Source record (demo dataset) | Expected result | Rule | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-F521 | Unmapped component blocks approval | GL-023 deliberately unmapped | Run cannot reach APPROVED; message names the component | RL-521 | Negative |
| TC-F530 | Reconciliation assertions | Sep 2026 journal, both runs | All seven assertions pass with zero dimension residue | RL-530 | Golden |
| TC-F510 | ERP inbound outcomes | Batch ERP-SYNC-2026-09-14, six rows | Three clean upserts, one conflict held, one unmatched, one duplicate rejected on hash | RL-513, RL-514, RL-516 | Golden |

## Client acceptance tests (T-xx)

| Test ID | Requirement | Test | Setup | Expected result | Demo records to use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-28 | R-15 | Employee master sync and failure handling | Change an employee in the ERP; then force a sync failure. | The change lands in Nucleus. The failed record appears in a queue with its reason and can be retried. |  |
| T-29 | R-16 | Payroll posting is idempotent | Post the payroll journal, then re-run the same period. | Debits equal credits. The second run does not create a duplicate posting. A failure is visible in the posting log. |  |

## Test cases for capability gaps (Authored)

One test case per acceptance criterion of the capability-gap user stories in FRS-FIN-13; expected results are the stated outcomes.

| Test ID | Use case | Capability gap | User story | Given | When | Then (expected result) | Level | Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-TC-001 | FIN-UC-006 | FIN-CG-001 | FIN-US-013 | an employee's rule is 60% project A and 40% project B with monthly cost 100,000 | the journal is built | project A carries 60,000 and project B 40,000 | System / acceptance | Test |
| FIN-TC-002 | FIN-UC-006 | FIN-CG-001 | FIN-US-013 | I enter 60% and 30% | I save | the rule is refused because it totals 90% | System / acceptance | Test |
| FIN-TC-003 | FIN-UC-006 | FIN-CG-001 | FIN-US-014 | an approved timesheet shows 120 hours on a grant and 40 on operations | the journal is built | cost splits 75% to the grant and 25% to operations | System / acceptance | Test |
| FIN-TC-004 | FIN-UC-006 | FIN-CG-001 | FIN-US-014 | no approved timesheet exists | the journal is built | cost goes to the default cost centre and the employee is flagged | System / acceptance | Test |
| FIN-TC-005 | FIN-UC-007 | FIN-CG-002 | FIN-US-015 | E1068 has 9.5 encashable days and a daily wage base of 1,658.46 | the accrual runs | his leave liability is 15,755 | System / acceptance | Test |
| FIN-TC-006 | FIN-UC-007 | FIN-CG-002 | FIN-US-015 | the prior month's liability was 14,100 | the movement is computed | a 1,655 accrual is posted | System / acceptance | Test |
| FIN-TC-007 | FIN-UC-007 | FIN-CG-002 | FIN-US-016 | gratuity provision and payable accounts are mapped | the accrual journal is built | total debits equal total credits | System / acceptance | Test |
| FIN-TC-008 | FIN-UC-007 | FIN-CG-002 | FIN-US-016 | the payable account is missing | the journal is built | the build fails naming the missing account | System / acceptance | Test |
| FIN-TC-009 | FIN-UC-008 | FIN-CG-003 | FIN-US-017 | LE-01 budgeted 410 for September and actual is 418 | I open the September view | a variance of +8 (2.0%) is shown | System / acceptance | Test |
| FIN-TC-010 | FIN-UC-008 | FIN-CG-003 | FIN-US-017 | Peenya Works cost exceeds budget by 7% | I open the view | the line is highlighted as over the 5% threshold | System / acceptance | Test |
| FIN-TC-011 | FIN-UC-008 | FIN-CG-003 | FIN-US-018 | a cost centre is 3 over budget | I drill in | the 3 positions and employees filled above budget are listed | System / acceptance | Test |
| FIN-TC-012 | FIN-UC-008 | FIN-CG-003 | FIN-US-018 | I export the drill-down | the export completes | it lists the same positions | System / acceptance | Test |
| FIN-TC-013 | FIN-UC-009 | FIN-CG-004 | FIN-US-019 | E1018 photographs a Medchal hotel bill for ₹9,600 for two nights | extraction completes | a draft line shows vendor, dates and ₹9,600 for her to confirm, and nothing is submitted until she does | System / acceptance | Test |
| FIN-TC-014 | FIN-UC-009 | FIN-CG-004 | FIN-US-019 | she corrects the amount to ₹9,450 | she confirms | the line is saved with ₹9,450 and the correction is recorded | System / acceptance | Test |
| FIN-TC-015 | FIN-UC-009 | FIN-CG-004 | FIN-US-020 | the grade limit for a city-class B hotel is ₹4,500 per night | a claim includes ₹4,800 per night | the line shows Over limit by ₹300 per night and needs a justification | System / acceptance | Test |
| FIN-TC-016 | FIN-UC-009 | FIN-CG-004 | FIN-US-020 | no justification is given | I try to approve | approval is blocked until the employee adds one | System / acceptance | Test |
| FIN-TC-017 | FIN-UC-009 | FIN-CG-004 | FIN-US-021 | an advance of ₹15,000 and an approved claim of ₹21,400 | I approve the audit | ₹6,400 is scheduled for reimbursement and the advance shows settled | System / acceptance | Test |
| FIN-TC-018 | FIN-UC-009 | FIN-CG-004 | FIN-US-021 | the ERP system returns document 5100004312 | posting completes | the claim batch shows posted with that document number | System / acceptance | Test |
| FIN-TC-019 | FIN-UC-010 | FIN-CG-005 | FIN-US-022 | the November 2026 run for Vindhya Precision Industries Pvt Ltd is approved with employer PF of ₹38,40,000 | the cost journal is built | PF expense is debited by cost centre and the PF liability is credited ₹38,40,000 | System / acceptance | Test |
| FIN-TC-020 | FIN-UC-010 | FIN-CG-005 | FIN-US-022 | the labour welfare fund component has no liability mapping | the journal is built | it is blocked and names the component | System / acceptance | Test |
| FIN-TC-021 | FIN-UC-010 | FIN-CG-005 | FIN-US-023 | an accrual of ₹4,20,000 posted on 2026-11-30 | the period opens on 2026-12-01 | a reversal of ₹4,20,000 is posted dated 2026-12-01 | System / acceptance | Test |
| FIN-TC-022 | FIN-UC-010 | FIN-CG-005 | FIN-US-023 | the reversal fails at the ERP system | the failure is shown | a retry with the same journal ID posts once | System / acceptance | Test |
| FIN-TC-023 | FIN-UC-010 | FIN-CG-005 | FIN-US-024 | the PF liability is ₹38,40,000 and I record a payment of ₹38,40,000 | the clearing journal posts | the reconciliation shows Pass with nil variance | System / acceptance | Test |
| FIN-TC-024 | FIN-UC-010 | FIN-CG-005 | FIN-US-024 | I record a payment of ₹38,10,000 | reconciliation runs | it shows Fail with variance ₹30,000 and the period stays open | System / acceptance | Test |

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
| Size | 29 | specified items (table rows) | Counted automatically at generation |
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
