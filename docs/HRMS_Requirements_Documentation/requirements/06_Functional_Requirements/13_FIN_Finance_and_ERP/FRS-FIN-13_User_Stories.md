<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-13 — Finance & ERP — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-13 |
| Title | Finance & ERP — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Derived from FRS-FIN-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

24 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 19, Should 5.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| FIN-US-001 | Implementation consultant | the ownership map validated before it is saved | Must | FIN-UC-001 |
| FIN-US-002 | HR operations | conflicts on Nucleus-owned fields held for my review | Must | FIN-UC-001 |
| FIN-US-003 | HR operations | failed and unmatched rows in a queue with reasons and a retry | Must | FIN-UC-001 |
| FIN-US-004 | Finance | a list of unmapped components before payroll approval | Must | FIN-UC-002 |
| FIN-US-005 | Finance | validation that every provision has a credit leg | Must | FIN-UC-002 |
| FIN-US-006 | Finance | journal lines dimensioned by cost centre, department and location from employee-level data | Must | FIN-UC-003 |
| FIN-US-007 | Payroll manager | a re-run of posting not to create a duplicate entry in the ERP system | Must | FIN-UC-003 |
| FIN-US-008 | Payroll manager | approval blocked when a component is unmapped | Must | FIN-UC-003 |
| FIN-US-009 | Finance | all reconciliation assertions shown passing on one screen | Must | FIN-UC-004 |
| FIN-US-010 | Auditor | to drill a GL line to employees and payslip lines | Must | FIN-UC-004 |
| FIN-US-011 | Finance | release to require a second person who verifies the total independently | Must | FIN-UC-005 |
| FIN-US-012 | Payroll manager | accounts changed inside the payroll window flagged on the bank file | Must | FIN-UC-005 |
| FIN-US-013 | Finance | to split an employee's cost 60/40 across two projects | Must | FIN-UC-006 |
| FIN-US-014 | Manager / supervisor | timesheet-based allocation to use my approved timesheets | Should | FIN-UC-006 |
| FIN-US-015 | Finance | monthly leave encashment liability from actual balances | Should | FIN-UC-007 |
| FIN-US-016 | Auditor | accrual journals that always balance | Should | FIN-UC-007 |
| FIN-US-017 | Finance | headcount and cost variance by site | Should | FIN-UC-008 |
| FIN-US-018 | HR operations | to drill a headcount variance to positions | Should | FIN-UC-008 |
| FIN-US-019 | Employee / worker | to photograph receipts and have the lines filled for me to check | Must | FIN-UC-009 |
| FIN-US-020 | Manager / supervisor | policy deviations named on the claim I approve | Must | FIN-UC-009 |
| FIN-US-021 | Finance | advances netted and the journal posted with an ERP document number | Must | FIN-UC-009 |
| FIN-US-022 | Finance | employer contributions posted by cost centre as soon as the run is approved | Must | FIN-UC-010 |
| FIN-US-023 | Finance | accruals reversed automatically next period | Must | FIN-UC-010 |
| FIN-US-024 | Compliance owner | the liability cleared when I record the statutory payment | Must | FIN-UC-010 |

## 2. Stories with acceptance criteria

### FIN-US-001 · Synchronise the employee master from the ERP system

As a **Implementation consultant**, I want the ownership map validated before it is saved, so that no field is ever fought over by two systems.

Priority: **Must** · Use case: FIN-UC-001 · Realises: FIN-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I map Department to both ERP and Nucleus | I save the map | saving is refused and Department is listed as having two owners |
| 2 | Cost centre is mandatory and unmapped | I save the map | saving is refused and Cost centre is listed as having no owner |

### FIN-US-002 · Synchronise the employee master from the ERP system

As a **HR operations**, I want conflicts on Nucleus-owned fields held for my review, so that a nightly sync never silently overwrites my edits.

Priority: **Must** · Use case: FIN-UC-001 · Realises: FIN-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | batch ERP-SYNC-2026-09-14 sends manager VPI-1039 for E1044 while Nucleus holds VPI-1040 | the row is processed | it is held for review and E1044's manager is unchanged |
| 2 | the same batch sends department Assembly for E1051, an ERP-owned field | the row is processed | E1051's department becomes Assembly and the field is read-only in Nucleus |

### FIN-US-003 · Synchronise the employee master from the ERP system

As a **HR operations**, I want failed and unmatched rows in a queue with reasons and a retry, so that nothing fails silently.

Priority: **Must** · Use case: FIN-UC-001 · Realises: FIN-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | row SY-0006 carries external code VPI-9901 with no matching person | the batch is processed | the row is parked as unmatched and no person is created |
| 2 | row SY-0007 repeats the payload hash of SY-0001 | the batch is processed | it is rejected as a duplicate and shown on SCR-101 |

### FIN-US-004 · Maintain and validate the GL mapping

As a **Finance**, I want a list of unmapped components before payroll approval, so that I fix mappings before they block a run.

Priority: **Must** · Use case: FIN-UC-002 · Realises: FIN-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | contractor labour charges for LE-02 have no effective mapping | I open SCR-102 | the component is listed as unmapped for LE-02 |
| 2 | I map it to account 5010700 debit, dimensioned by cost centre and vendor, and it is approved | open draft runs revalidate | the mapping block is cleared |

### FIN-US-005 · Maintain and validate the GL mapping

As a **Finance**, I want validation that every provision has a credit leg, so that journals always balance.

Priority: **Must** · Use case: FIN-UC-002 · Realises: FIN-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | gratuity provision GL-009 is a debit with no credit leg | I validate | validation fails naming the missing credit leg |
| 2 | gratuity payable GL-024 is added as the credit leg | I validate | validation passes |

### FIN-US-006 · Generate and post the salary journal to the ERP system

As a **Finance**, I want journal lines dimensioned by cost centre, department and location from employee-level data, so that I never allocate a lump salary figure by hand.

Priority: **Must** · Use case: FIN-UC-003 · Realises: FIN-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | run PR-2026-08-01 for LE-01 has 412 employees across 9 cost centres | the journal is built | each line carries cost centre, department and location and the dimension totals sum to the journal total |
| 2 | an employee transferred cost centre on 2026-08-16 | the journal is built | their cost is split between both cost centres for August |

### FIN-US-007 · Generate and post the salary journal to the ERP system

As a **Payroll manager**, I want a re-run of posting not to create a duplicate entry in the ERP system, so that a retry after a failure is safe.

Priority: **Must** · Use case: FIN-UC-003 · Realises: FIN-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | journal JV-2026-08-0441 was posted and returned ERP-JV-88214 | the posting is retried | no second posting is created and the run keeps ERP-JV-88214 |
| 2 | the ERP system rejects a posting | the failure is logged | it appears in the posting log with the error and a retry action |

### FIN-US-008 · Generate and post the salary journal to the ERP system

As a **Payroll manager**, I want approval blocked when a component is unmapped, so that an unpostable run never gets approved.

Priority: **Must** · Use case: FIN-UC-003 · Realises: FIN-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a component in a draft run has no mapping for the entity | I try to approve the run | approval is refused and the component is named |
| 2 | the component is mapped | I approve | the run reaches APPROVED and the journal is built |

### FIN-US-009 · Reconcile payroll to the general ledger, bank and statutory payments

As a **Finance**, I want all reconciliation assertions shown passing on one screen, so that I close the month without arguments.

Priority: **Must** · Use case: FIN-UC-004 · Realises: FIN-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September 2026 journals for both LE-01 runs are posted | reconciliation runs | all seven assertions pass with zero dimension residue |
| 2 | the bank file total is 1,000 less than journal net | reconciliation runs | the net versus bank assertion fails with a variance of 1,000 |

### FIN-US-010 · Reconcile payroll to the general ledger, bank and statutory payments

As a **Auditor**, I want to drill a GL line to employees and payslip lines, so that I can verify any posted amount.

Priority: **Must** · Use case: FIN-UC-004 · Realises: FIN-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | line 1 of JV-2026-08-0441 debits Basic of 15,000,000 | I drill into it | the contributing employees and their payslip lines are listed and sum to 15,000,000 |
| 2 | I export the drill-down | the export completes | it contains the same lines and totals |

### FIN-US-011 · Generate and release the bank file under dual control

As a **Finance**, I want release to require a second person who verifies the total independently, so that no single person can send a payment file.

Priority: **Must** · Use case: FIN-UC-005 · Realises: FIN-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I generated BF-2026-08-0412 for 412 records totalling 24,118,000 | I try to release it myself as checker | release is refused |
| 2 | a second Finance user verifies 24,118,000 and the checksum | they release | the file is released and the release records both names |

### FIN-US-012 · Generate and release the bank file under dual control

As a **Payroll manager**, I want accounts changed inside the payroll window flagged on the bank file, so that a last-minute account change is checked before money moves.

Priority: **Must** · Use case: FIN-UC-005 · Realises: FIN-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1051's bank account changed on 2026-08-28 inside the August window | the file is generated | E1051 is flagged for the checker |
| 2 | no account changed in the window | the file is generated | no flags are shown |

### FIN-US-013 · Allocate labour cost to projects and grants

As a **Finance**, I want to split an employee's cost 60/40 across two projects, so that project budgets show real labour cost.

Priority: **Must** · Use case: FIN-UC-006 · Realises: FIN-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee's rule is 60% project A and 40% project B with monthly cost 100,000 | the journal is built | project A carries 60,000 and project B 40,000 |
| 2 | I enter 60% and 30% | I save | the rule is refused because it totals 90% |

### FIN-US-014 · Allocate labour cost to projects and grants

As a **Manager / supervisor**, I want timesheet-based allocation to use my approved timesheets, so that grant reporting matches recorded effort.

Priority: **Should** · Use case: FIN-UC-006 · Realises: FIN-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an approved timesheet shows 120 hours on a grant and 40 on operations | the journal is built | cost splits 75% to the grant and 25% to operations |
| 2 | no approved timesheet exists | the journal is built | cost goes to the default cost centre and the employee is flagged |

### FIN-US-015 · Accrue leave encashment and gratuity liabilities

As a **Finance**, I want monthly leave encashment liability from actual balances, so that the books carry the real obligation.

Priority: **Should** · Use case: FIN-UC-007 · Realises: FIN-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1068 has 9.5 encashable days and a daily wage base of 1,658.46 | the accrual runs | his leave liability is 15,755 |
| 2 | the prior month's liability was 14,100 | the movement is computed | a 1,655 accrual is posted |

### FIN-US-016 · Accrue leave encashment and gratuity liabilities

As a **Auditor**, I want accrual journals that always balance, so that provisions never post debit-only.

Priority: **Should** · Use case: FIN-UC-007 · Realises: FIN-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | gratuity provision and payable accounts are mapped | the accrual journal is built | total debits equal total credits |
| 2 | the payable account is missing | the journal is built | the build fails naming the missing account |

### FIN-US-017 · Compare workforce budget with actuals

As a **Finance**, I want headcount and cost variance by site, so that I can challenge over-budget sites early.

Priority: **Should** · Use case: FIN-UC-008 · Realises: FIN-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | LE-01 budgeted 410 for September and actual is 418 | I open the September view | a variance of +8 (2.0%) is shown |
| 2 | Peenya Works cost exceeds budget by 7% | I open the view | the line is highlighted as over the 5% threshold |

### FIN-US-018 · Compare workforce budget with actuals

As a **HR operations**, I want to drill a headcount variance to positions, so that I know which hires caused it.

Priority: **Should** · Use case: FIN-UC-008 · Realises: FIN-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a cost centre is 3 over budget | I drill in | the 3 positions and employees filled above budget are listed |
| 2 | I export the drill-down | the export completes | it lists the same positions |

### FIN-US-019 · Request travel, claim expenses and settle the advance

As a **Employee / worker**, I want to photograph receipts and have the lines filled for me to check, so that I can claim in minutes instead of typing every bill.

Priority: **Must** · Use case: FIN-UC-009 · Realises: FIN-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018 photographs a Medchal hotel bill for ₹9,600 for two nights | extraction completes | a draft line shows vendor, dates and ₹9,600 for her to confirm, and nothing is submitted until she does |
| 2 | she corrects the amount to ₹9,450 | she confirms | the line is saved with ₹9,450 and the correction is recorded |

### FIN-US-020 · Request travel, claim expenses and settle the advance

As a **Manager / supervisor**, I want policy deviations named on the claim I approve, so that I can decide with the facts in front of me.

Priority: **Must** · Use case: FIN-UC-009 · Realises: FIN-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the grade limit for a city-class B hotel is ₹4,500 per night | a claim includes ₹4,800 per night | the line shows Over limit by ₹300 per night and needs a justification |
| 2 | no justification is given | I try to approve | approval is blocked until the employee adds one |

### FIN-US-021 · Request travel, claim expenses and settle the advance

As a **Finance**, I want advances netted and the journal posted with an ERP document number, so that advances are cleared and the books match.

Priority: **Must** · Use case: FIN-UC-009 · Realises: FIN-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an advance of ₹15,000 and an approved claim of ₹21,400 | I approve the audit | ₹6,400 is scheduled for reimbursement and the advance shows settled |
| 2 | the ERP system returns document 5100004312 | posting completes | the claim batch shows posted with that document number |

### FIN-US-022 · Account for employer statutory contributions, benefit costs and liabilities

As a **Finance**, I want employer contributions posted by cost centre as soon as the run is approved, so that I see the true monthly people cost.

Priority: **Must** · Use case: FIN-UC-010 · Realises: FIN-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the November 2026 run for Vindhya Precision Industries Pvt Ltd is approved with employer PF of ₹38,40,000 | the cost journal is built | PF expense is debited by cost centre and the PF liability is credited ₹38,40,000 |
| 2 | the labour welfare fund component has no liability mapping | the journal is built | it is blocked and names the component |

### FIN-US-023 · Account for employer statutory contributions, benefit costs and liabilities

As a **Finance**, I want accruals reversed automatically next period, so that I do not double-count costs.

Priority: **Must** · Use case: FIN-UC-010 · Realises: FIN-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an accrual of ₹4,20,000 posted on 2026-11-30 | the period opens on 2026-12-01 | a reversal of ₹4,20,000 is posted dated 2026-12-01 |
| 2 | the reversal fails at the ERP system | the failure is shown | a retry with the same journal ID posts once |

### FIN-US-024 · Account for employer statutory contributions, benefit costs and liabilities

As a **Compliance owner**, I want the liability cleared when I record the statutory payment, so that the balance shows what is still owed.

Priority: **Must** · Use case: FIN-UC-010 · Realises: FIN-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the PF liability is ₹38,40,000 and I record a payment of ₹38,40,000 | the clearing journal posts | the reconciliation shows Pass with nil variance |
| 2 | I record a payment of ₹38,10,000 | reconciliation runs | it shows Fail with variance ₹30,000 and the period stays open |

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
| Size | 72 | specified items (table rows) | Counted automatically at generation |
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
