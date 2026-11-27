<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-13 — Payroll — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-13 |
| Title | Payroll — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Derived from FRS-PAY-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

58 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 42, Should 16.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| PAY-US-001 | Payroll manager | to create a run with an explicit run type | Must | PAY-UC-001 |
| PAY-US-002 | Payroll manager | joiners, leavers and transfers to be included automatically | Must | PAY-UC-001 |
| PAY-US-003 | Payroll manager | locking inputs to stop late changes from altering the run | Must | PAY-UC-002 |
| PAY-US-004 | Auditor | to recompute a closed run from its snapshot | Must | PAY-UC-002 |
| PAY-US-005 | Payroll manager | rule checks to flag defects with the reason before calculation | Must | PAY-UC-003 |
| PAY-US-006 | Payroll manager | the agent to propose fixes that I accept or reject | Must | PAY-UC-003 |
| PAY-US-007 | Auditor | CRITICAL waivers to be limited to the configured role threshold | Must | PAY-UC-003 |
| PAY-US-008 | Payroll manager | every payslip line to drill down to its rule and inputs | Must | PAY-UC-004 |
| PAY-US-009 | Auditor | proration to be exact across month boundaries | Must | PAY-UC-004 |
| PAY-US-010 | Compliance owner | the 50% floor add-back to apply automatically | Must | PAY-UC-005 |
| PAY-US-011 | HR operations | to simulate a new structure before adopting it | Must | PAY-UC-005 |
| PAY-US-012 | Employee / worker | to be paid for the days I was present at my daily rate | Must | PAY-UC-006 |
| PAY-US-013 | Payroll manager | a missing daily rate to block approval | Must | PAY-UC-006 |
| PAY-US-014 | Compliance owner | PT to follow each location's state slab set on the same run | Must | PAY-UC-007 |
| PAY-US-015 | Employee / worker | ESI to continue to the end of the contribution period after my pay rise | Must | PAY-UC-007 |
| PAY-US-016 | Employee / worker | my TDS projection to update when I switch regime mid-year | Should | PAY-UC-007 |
| PAY-US-017 | Employee / worker | loan recovery to stop at the protected net-pay floor | Must | PAY-UC-008 |
| PAY-US-018 | Finance | the closing outstanding to be reported back after each run | Must | PAY-UC-008 |
| PAY-US-019 | Director / approver | approval to be blocked while any component is unmapped to the GL | Must | PAY-UC-009 |
| PAY-US-020 | Finance | bank file totals to be verified by a second person out of band | Must | PAY-UC-009 |
| PAY-US-021 | Payroll manager | variance against the prior period on the review screen | Should | PAY-UC-009 |
| PAY-US-022 | Payroll manager | overtime paid in its own run after salary | Must | PAY-UC-010 |
| PAY-US-023 | Finance | the overtime journal dimensioned by run type | Must | PAY-UC-010 |
| PAY-US-024 | Payroll manager | back-dated changes to arrive as arrears in the next run | Must | PAY-UC-011 |
| PAY-US-025 | Employee / worker | to see arrears itemised by month on my payslip | Should | PAY-UC-011 |
| PAY-US-026 | Payroll manager | the F&F to stay held until every blocking clearance item is closed or waived | Must | PAY-UC-012 |
| PAY-US-027 | Employee / worker | a settlement statement with each component listed | Must | PAY-UC-012 |
| PAY-US-028 | Employee / worker | to pick the run as well as the month | Must | PAY-UC-013 |
| PAY-US-029 | Employee / worker | to tap a payslip line and see how it was calculated | Should | PAY-UC-013 |
| PAY-US-030 | Payroll manager | to roll an approved run back to review when I find a defect | Must | PAY-UC-014 |
| PAY-US-031 | Finance | a voided bank file to be impossible to release | Must | PAY-UC-014 |
| PAY-US-032 | Implementation consultant | to bind a new entity to a country pack and map its components | Should | PAY-UC-015 |
| PAY-US-033 | Payroll manager | a non-India run to follow the same lock, audit and approval steps | Should | PAY-UC-015 |
| PAY-US-034 | Payroll manager | a back-dated revision across three closed months to produce one reviewed arrears batch | Must | PAY-UC-016 |
| PAY-US-035 | Employee / worker | an itemised arrears statement | Must | PAY-UC-016 |
| PAY-US-036 | Employee / worker | to compare TDS under both regimes before choosing | Must | PAY-UC-017 |
| PAY-US-037 | Payroll manager | to verify proofs and have TDS reprojected from verified amounts | Must | PAY-UC-017 |
| PAY-US-038 | Employee / worker | to submit a fuel claim with a photo of the bill | Must | PAY-UC-018 |
| PAY-US-039 | Payroll manager | only verified claims to reach payroll with tax treatment set | Must | PAY-UC-018 |
| PAY-US-040 | Payroll manager | court orders to deduct in priority order without breaching the floor | Should | PAY-UC-019 |
| PAY-US-041 | HR operations | an order to close automatically when satisfied | Should | PAY-UC-019 |
| PAY-US-042 | Payroll manager | every change to be acknowledged by the provider | Should | PAY-UC-020 |
| PAY-US-043 | Payroll manager | to reconcile provider results with our records | Should | PAY-UC-020 |
| PAY-US-044 | Compliance owner | 24Q data checked for PAN and challan mismatches before filing | Must | PAY-UC-021 |
| PAY-US-045 | Employee / worker | to download my Form 16 from self-service | Must | PAY-UC-021 |
| PAY-US-046 | Payroll manager | to lock the financial year with controlled re-open | Must | PAY-UC-021 |
| PAY-US-047 | Payroll manager | a weekly run for daily-wage workers alongside the monthly run | Must | PAY-UC-022 |
| PAY-US-048 | Compliance owner | monthly statutory contributions reconciled across weekly runs | Must | PAY-UC-022 |
| PAY-US-049 | Finance | a separate journal for every run | Should | PAY-UC-022 |
| PAY-US-050 | Employee / worker | to compare take-home under both tax regimes | Should | PAY-UC-023 |
| PAY-US-051 | Employee / worker | to see the effect of VPF and a loan EMI together | Should | PAY-UC-023 |
| PAY-US-052 | Payroll manager | simulations kept separate from live inputs | Should | PAY-UC-023 |
| PAY-US-053 | Auditor | to drill from a payslip line to its inputs and rule version | Must | PAY-UC-024 |
| PAY-US-054 | Payroll manager | the run's approval history on every trace | Must | PAY-UC-024 |
| PAY-US-055 | Payroll manager | to start from a register total and reach the lines behind it | Should | PAY-UC-024 |
| PAY-US-056 | Payroll manager | to hold one employee's net pay with a reason | Must | PAY-UC-025 |
| PAY-US-057 | Payroll manager | to release a held amount in a later run | Must | PAY-UC-025 |
| PAY-US-058 | Employee / worker | to be told when my pay is held and why | Should | PAY-UC-025 |

## 2. Stories with acceptance criteria

### PAY-US-001 · Create a payroll run for a period

As a **Payroll manager**, I want to create a run with an explicit run type, so that a period can carry a regular run and separate off-cycle runs.

Priority: **Must** · Use case: PAY-UC-001 · Realises: PAY-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | PR-2026-09-01 is a regular run for September 2026 | I create a run for September with run_type off_cycle_ot | PR-2026-09-02 is created in DRAFT and both runs appear under September |
| 2 | I omit run_type | I submit the form | creation is refused and run_type is marked required |

### PAY-US-002 · Create a payroll run for a period

As a **Payroll manager**, I want joiners, leavers and transfers to be included automatically, so that nobody is missed or paid twice.

Priority: **Must** · Use case: PAY-UC-001 · Realises: PAY-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee joined on 18 September 2026 and another left on 12 September | the September regular run is created | both appear in the population with their in-period dates |
| 2 | an employee moved from LE-01 to LE-02 on 16 September | both entities' runs are created | each run includes the employee for the days assigned to it |

### PAY-US-003 · Lock payroll inputs and take an immutable snapshot

As a **Payroll manager**, I want locking inputs to stop late changes from altering the run, so that the figures I review are the figures that get paid.

Priority: **Must** · Use case: PAY-UC-002 · Realises: PAY-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September 2026 regular run is INPUTS_LOCKED | a punch for 29 September arrives | the run's attendance input is unchanged and an exception names the late punch |
| 2 | inputs are locked | the snapshot is written | payroll.snapshot.taken carries the input hash and rule pack versions |

### PAY-US-004 · Lock payroll inputs and take an immutable snapshot

As a **Auditor**, I want to recompute a closed run from its snapshot, so that I can prove the paid figures were produced by the recorded rules.

Priority: **Must** · Use case: PAY-UC-002 · Realises: PAY-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a run closed eleven months ago | it is recomputed from its snapshot today | every payslip line matches to the paisa |
| 2 | a recomputation differs on one line | the comparison completes | a CRITICAL integrity alert lists the differing line |

### PAY-US-005 · Run the pre-payroll audit

As a **Payroll manager**, I want rule checks to flag defects with the reason before calculation, so that I fix inputs rather than correct payslips.

Priority: **Must** · Use case: PAY-UC-003 · Realises: PAY-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee in the September run has no UAN | the audit runs | a CRITICAL 'missing PF/UAN' flag names the employee |
| 2 | two employees share bank account number ending 4471 | the audit runs | a duplicate bank account flag lists both employees |

### PAY-US-006 · Run the pre-payroll audit

As a **Payroll manager**, I want the agent to propose fixes that I accept or reject, so that I save time without losing control of figures.

Priority: **Must** · Use case: PAY-UC-003 · Realises: PAY-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a mid-month joiner is not prorated | the agent classifies the flag | a draft resolution is shown and no payslip value has changed |
| 2 | I reject the proposal | I record my own resolution with a reason | the action ledger shows the proposal, my rejection and my resolution |

### PAY-US-007 · Run the pre-payroll audit

As a **Auditor**, I want CRITICAL waivers to be limited to the configured role threshold, so that no one can wave through a blocking defect.

Priority: **Must** · Use case: PAY-UC-003 · Realises: PAY-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the threshold is Payroll manager or above | an HR operations user tries to waive a CRITICAL flag | the waiver is refused |
| 2 | the payroll manager waives it with the reason 'UAN generation pending with EPFO' | the waiver is saved | the flag shows the actor, time and reason |

### PAY-US-008 · Execute gross-to-net calculation

As a **Payroll manager**, I want every payslip line to drill down to its rule and inputs, so that I can answer any employee query from the screen.

Priority: **Must** · Use case: PAY-UC-004 · Realises: PAY-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September run is calculated | I open an employee's HRA line | the trace shows the HRA node, its inputs, output and rule pack version |
| 2 | a component formula references a node that references it back | calculation starts | it stops before evaluation and names both nodes |

### PAY-US-009 · Execute gross-to-net calculation

As a **Auditor**, I want proration to be exact across month boundaries, so that no paisa is created or lost when a span crosses months.

Priority: **Must** · Use case: PAY-UC-004 · Realises: PAY-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a joiner on 16 September 2026 with basic of 30,000 rupees | September is calculated | basic is prorated on 15 of 30 days to 15,000 rupees |
| 2 | a property test splits a month at every day boundary | the parts are summed | the sum equals the full-month value for every component |

### PAY-US-010 · Compute the statutory wage base with the 50% floor

As a **Compliance owner**, I want the 50% floor add-back to apply automatically, so that contributions are not understated when allowances are high.

Priority: **Must** · Use case: PAY-UC-005 · Realises: PAY-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1014's excluded components exceed 50% of total remuneration in 13_Salary_Structure | the run is calculated | the excess is added back and the wage base trace shows the add-back amount |
| 2 | an employee's excluded components are exactly 50% | the run is calculated | no add-back is made |

### PAY-US-011 · Compute the statutory wage base with the 50% floor

As a **HR operations**, I want to simulate a new structure before adopting it, so that I can show statutory cost and take-home effects to management.

Priority: **Must** · Use case: PAY-UC-005 · Realises: PAY-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1049's structure is changed in the simulator to raise basic by 5,000 rupees | I run the simulation | the result shows the change in employer PF cost and in monthly take-home |
| 2 | a simulation has run | I close it without adopting | no salary structure has changed |

### PAY-US-012 · Compute daily-wage earnings

As a **Employee / worker**, I want to be paid for the days I was present at my daily rate, so that I can check my pay against my attendance.

Priority: **Must** · Use case: PAY-UC-006 · Realises: PAY-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1032 (WC-CONT) has 24 full days and 2 half days present at a daily rate of 700 rupees | the run is calculated | earnings are 17,500 rupees and the payslip shows 25 paid days |
| 2 | the same worker | the payslip is opened | the earnings line is labelled as daily wages, not as prorated monthly pay |

### PAY-US-013 · Compute daily-wage earnings

As a **Payroll manager**, I want a missing daily rate to block approval, so that no daily-wage worker is paid zero by mistake.

Priority: **Must** · Use case: PAY-UC-006 · Realises: PAY-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a daily-wage assignment has no rate | the run is calculated | a CRITICAL flag names the employee and no earnings line is written |
| 2 | the rate is entered and the employee recalculated | calculation completes | the flag is resolved automatically |

### PAY-US-014 · Compute statutory deductions and provisions

As a **Compliance owner**, I want PT to follow each location's state slab set on the same run, so that multi-state entities deduct correctly.

Priority: **Must** · Use case: PAY-UC-007 · Realises: PAY-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | LE-01 in Karnataka and LE-02 in Tamil Nadu are both in the September 2026 run | the run is calculated | PT amounts differ by state and each line cites its state slab set |
| 2 | an employee works in a state with no PT | the run is calculated | no PT line is written and the trace states 'not applicable in state' |

### PAY-US-015 · Compute statutory deductions and provisions

As a **Employee / worker**, I want ESI to continue to the end of the contribution period after my pay rise, so that my coverage does not stop mid-period.

Priority: **Must** · Use case: PAY-UC-007 · Realises: PAY-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my gross crosses the ESI threshold from August in a period ending September | August and September are calculated | ESI is deducted in both months |
| 2 | the next contribution period starts | the first month is calculated | no ESI is deducted |

### PAY-US-016 · Compute statutory deductions and provisions

As a **Employee / worker**, I want my TDS projection to update when I switch regime mid-year, so that the remaining months deduct the right tax.

Priority: **Should** · Use case: PAY-UC-007 · Realises: PAY-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I switch regime effective October 2026 where the pack permits | the October run is calculated | TDS for October to March is reprojected under the new regime, net of tax already deducted |
| 2 | I have not recorded a regime | the run is calculated | the pack's default regime is applied and I am notified |

### PAY-US-017 · Recover loans, advances and earned wage access

As a **Employee / worker**, I want loan recovery to stop at the protected net-pay floor, so that I always receive at least the minimum.

Priority: **Must** · Use case: PAY-UC-008 · Realises: PAY-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my net before recovery is 14,000 rupees, the floor is 12,000 and the instalment 5,000 | the run is calculated | 2,000 rupees is recovered, 3,000 is carried forward and the reduction is flagged |
| 2 | the next month has no shortfall | the run is calculated | the instalment plus the 3,000 carried forward is recovered up to the floor |

### PAY-US-018 · Recover loans, advances and earned wage access

As a **Finance**, I want the closing outstanding to be reported back after each run, so that the GL loan balance agrees with the loans module.

Priority: **Must** · Use case: PAY-UC-008 · Realises: PAY-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a loan has 2,500 rupees outstanding and a 5,000 instalment | the run is calculated | 2,500 is recovered, outstanding is zero and loan.closed is emitted |
| 2 | the run is posted | the loan control account is reconciled | it equals the loans module total |

### PAY-US-019 · Review, approve and disburse a payroll run

As a **Director / approver**, I want approval to be blocked while any component is unmapped to the GL, so that every rupee paid lands in a known account.

Priority: **Must** · Use case: PAY-UC-009 · Realises: PAY-09

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a new 'site allowance' component has no GL mapping | I select Approve | approval is refused and the component is named |
| 2 | the mapping is added | I approve again | the run moves to APPROVED and payroll.run.approved is emitted |

### PAY-US-020 · Review, approve and disburse a payroll run

As a **Finance**, I want bank file totals to be verified by a second person out of band, so that a tampered file cannot be released.

Priority: **Must** · Use case: PAY-UC-009 · Realises: PAY-09

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I generated the bank file | I try to verify its total | verification is refused because a different user must verify |
| 2 | an employee changed bank account two days before the pay date | the file is generated | an alert names the employee before release |

### PAY-US-021 · Review, approve and disburse a payroll run

As a **Payroll manager**, I want variance against the prior period on the review screen, so that I catch unexpected swings before approval.

Priority: **Should** · Use case: PAY-UC-009 · Realises: PAY-09

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | net pay for a department rose 18% against August with a 10% threshold | I open the review | the department is highlighted with the variance and contributing employees |
| 2 | headcount is 1,212 and the population is 1,211 | I open the reconciliation | the missing employee is listed with the reason |

### PAY-US-022 · Run off-cycle overtime payroll

As a **Payroll manager**, I want overtime paid in its own run after salary, so that salary is not held up by overtime approvals.

Priority: **Must** · Use case: PAY-UC-010 · Realises: PAY-10

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | PR-2026-09-01 is the September regular run paying on 30 September | I create PR-2026-09-02 as off_cycle_ot | it pays on 07 October with its own bank file and journal |
| 2 | an OT record is tagged to PR-2026-09-02 | PR-2026-09-01 is calculated | the record is not included in the regular run |

### PAY-US-023 · Run off-cycle overtime payroll

As a **Finance**, I want the overtime journal dimensioned by run type, so that overtime cost is reported separately.

Priority: **Must** · Use case: PAY-UC-010 · Realises: PAY-10

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | PR-2026-09-02 is disbursed | its journal is emitted | each line carries run type off_cycle_ot |
| 2 | both September runs are posted | I view September payroll cost | salary and overtime appear as separate lines |

### PAY-US-024 · Process retro changes as arrears

As a **Payroll manager**, I want back-dated changes to arrive as arrears in the next run, so that closed runs remain exactly as paid.

Priority: **Must** · Use case: PAY-UC-011 · Realises: PAY-11

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a revision effective 1 July 2026 is approved on 15 September after July and August are closed | the October run is created | it contains arrears lines for July and August, each referencing its original run |
| 2 | the July run is opened after the arrears are posted | its totals are compared | they are unchanged |

### PAY-US-025 · Process retro changes as arrears

As a **Employee / worker**, I want to see arrears itemised by month on my payslip, so that I can check each month's difference.

Priority: **Should** · Use case: PAY-UC-011 · Realises: PAY-11

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I receive arrears for July and August | I open the October payslip | an arrears section shows July and August separately with earnings and deduction differences |
| 2 | an over-payment occurred in August | arrears are computed | a recovery line is shown and net stays at or above the floor |

### PAY-US-026 · Settle full and final on the last working day

As a **Payroll manager**, I want the F&F to stay held until every blocking clearance item is closed or waived, so that no settlement is paid with assets or dues outstanding.

Priority: **Must** · Use case: PAY-UC-012 · Realises: PAY-12

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the IT asset return is open for an exiting employee | I start the F&F run | it is held and the IT item is listed |
| 2 | E1068 Dinesh Vaidya is fully cleared with LWD 30 September 2026 | I approve the F&F | settlement is made on 30 September and payroll.fnf.settled is emitted |

### PAY-US-027 · Settle full and final on the last working day

As a **Employee / worker**, I want a settlement statement with each component listed, so that I understand what I received or owe.

Priority: **Must** · Use case: PAY-UC-012 · Realises: PAY-12

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my settlement includes salary to LWD, 12 days EL encashment and a loan foreclosure | I open the statement | each component appears with its amount and source |
| 2 | my notice recovery exceeds my dues | the statement is produced | it shows the net amount payable by me and the recovery reference |

### PAY-US-028 · View and download payslips

As a **Employee / worker**, I want to pick the run as well as the month, so that I can find my overtime payslip separately from salary.

Priority: **Must** · Use case: PAY-UC-013 · Realises: PAY-13

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | September 2026 has PR-2026-09-01 and PR-2026-09-02 | I open September payslips | both runs are listed with type and pay date |
| 2 | I select PR-2026-09-02 | the payslip opens | only overtime lines appear |

### PAY-US-029 · View and download payslips

As a **Employee / worker**, I want to tap a payslip line and see how it was calculated, so that I understand deductions without asking HR.

Priority: **Should** · Use case: PAY-UC-013 · Realises: PAY-13

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my PF line is 1,800 rupees | I open its detail | the wage base, rate source and pack version are shown |
| 2 | I am offline and opened the payslip last week | I open it again | it displays with the last sync time |

### PAY-US-030 · Roll back a payroll run before disbursement

As a **Payroll manager**, I want to roll an approved run back to review when I find a defect, so that I correct it before anyone is paid.

Priority: **Must** · Use case: PAY-UC-014 · Realises: PAY-14

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September run is APPROVED and an HRA formula error is found | I roll back to CALCULATED with a reason | the run is CALCULATED, the approval is voided and the audit entry shows my reason |
| 2 | the September run is DISBURSED | I select Roll back | rollback is refused with the message to raise arrears |

### PAY-US-031 · Roll back a payroll run before disbursement

As a **Finance**, I want a voided bank file to be impossible to release, so that no stale file is paid.

Priority: **Must** · Use case: PAY-UC-014 · Realises: PAY-14

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the run is DISBURSEMENT_PREPARED with a generated bank file | the run is rolled back to APPROVED | the file is marked voided and its download is disabled |
| 2 | the run is regenerated | a new file is produced | it has a new hash and requires fresh dual-control verification |

### PAY-US-032 · Run payroll for another country on a country pack

As a **Implementation consultant**, I want to bind a new entity to a country pack and map its components, so that it can run payroll without engine changes.

Priority: **Should** · Use case: PAY-UC-015 · Realises: PAY-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an entity is created for a new country with pack version 1.0 effective 1 April 2027 | I bind the entity and map all components | validation passes and run creation is enabled |
| 2 | one component is unmapped | I attempt to bind | binding is refused naming the component |

### PAY-US-033 · Run payroll for another country on a country pack

As a **Payroll manager**, I want a non-India run to follow the same lock, audit and approval steps, so that controls are uniform across countries.

Priority: **Should** · Use case: PAY-UC-015 · Realises: PAY-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a run for the new entity is calculated | I open the cockpit | states, flags and approval gates match those of an India run |
| 2 | the run is recomputed from its snapshot | results are compared | they match to the minor currency unit |

### PAY-US-034 · Compute and pay retro differences with an arrears statement

As a **Payroll manager**, I want a back-dated revision across three closed months to produce one reviewed arrears batch, so that I approve the whole correction at once.

Priority: **Must** · Use case: PAY-UC-016 · Realises: PAY-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a revision effective 1 June 2026 is approved on 10 September | the October run audit opens | an arrears batch shows June, July and August differences by component |
| 2 | the batch is approved | the October run is calculated | arrears lines reference the June, July and August regular runs respectively |

### PAY-US-035 · Compute and pay retro differences with an arrears statement

As a **Employee / worker**, I want an itemised arrears statement, so that I can verify each month's back pay and deduction change.

Priority: **Must** · Use case: PAY-UC-016 · Realises: PAY-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my basic was revised by 2,000 rupees from 1 June | I open the October payslip | the statement shows 2,000 basic arrears for each of June, July and August with PF differences |
| 2 | no change affects me | I open the October payslip | no arrears section appears |

### PAY-US-036 · Declare tax regime and investments with proof verification

As a **Employee / worker**, I want to compare TDS under both regimes before choosing, so that I pick the regime that suits me.

Priority: **Must** · Use case: PAY-UC-017 · Realises: PAY-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my annual salary and declarations are loaded | I open tax declaration and projection | monthly TDS under each regime is shown side by side |
| 2 | I choose a regime and save | the next run is calculated | TDS follows the chosen regime |

### PAY-US-037 · Declare tax regime and investments with proof verification

As a **Payroll manager**, I want to verify proofs and have TDS reprojected from verified amounts, so that year-end tax is not under-deducted.

Priority: **Must** · Use case: PAY-UC-017 · Realises: PAY-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee declared 1,50,000 rupees and proved 1,00,000 | I accept 1,00,000 with a reason | the projection uses 1,00,000 and the employee sees the change |
| 2 | an employee submits no proof by the window close | the next run is calculated | the declared amount is treated as zero and TDS increases |

### PAY-US-038 · Claim reimbursements and flexible benefits

As a **Employee / worker**, I want to submit a fuel claim with a photo of the bill, so that I am reimbursed in the next run.

Priority: **Must** · Use case: PAY-UC-018 · Realises: PAY-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my remaining fuel limit is 18,000 rupees | I claim 3,200 rupees with a bill dated 4 November 2026 | the claim is created and routed to my manager |
| 2 | my remaining limit is 1,000 rupees | I claim 3,200 rupees | the claim is limited to 1,000 and I am told the excess |

### PAY-US-039 · Claim reimbursements and flexible benefits

As a **Payroll manager**, I want only verified claims to reach payroll with tax treatment set, so that taxable reimbursements are taxed correctly.

Priority: **Must** · Use case: PAY-UC-018 · Realises: PAY-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a 3,200 rupee fuel claim is approved by the manager | I verify it | a payroll input is raised for the next open run with exempt and taxable portions |
| 2 | the November run is calculated | the employee opens the payslip | the reimbursement appears as a separate line |

### PAY-US-040 · Apply court-ordered deductions

As a **Payroll manager**, I want court orders to deduct in priority order without breaching the floor, so that we comply with the order and protect the employee.

Priority: **Should** · Use case: PAY-UC-019 · Realises: PAY-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | net after statutory deductions is 20,000 rupees, the floor 12,000 and an order requires 10,000 | the run is calculated | 8,000 is deducted and 2,000 is carried forward |
| 2 | a loan instalment also applies and the order ranks higher | the run is calculated | the order is deducted first and the loan uses only what remains above the floor |

### PAY-US-041 · Apply court-ordered deductions

As a **HR operations**, I want an order to close automatically when satisfied, so that no deduction continues beyond the amount ordered.

Priority: **Should** · Use case: PAY-UC-019 · Realises: PAY-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an order has 3,000 rupees remaining | the next run deducts 3,000 | the order closes and I am notified |
| 2 | the order is closed | the following run is calculated | no deduction line is written for it |

### PAY-US-042 · Send change extracts to an external payroll provider

As a **Payroll manager**, I want every change to be acknowledged by the provider, so that nothing is lost between systems.

Priority: **Should** · Use case: PAY-UC-020 · Realises: PAY-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | extract 42 contains 37 changes | the provider acknowledges 37 records for sequence 42 | the extract is marked acknowledged |
| 2 | the provider acknowledges 35 records | matching runs | the extract is rejected and the 2 missing records are listed |

### PAY-US-043 · Send change extracts to an external payroll provider

As a **Payroll manager**, I want to reconcile provider results with our records, so that differences are found before the period closes.

Priority: **Should** · Use case: PAY-UC-020 · Realises: PAY-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | provider net for an employee differs from the expected net by 450 rupees | reconciliation runs | the employee is listed with both values |
| 2 | all differences are resolved | I close reconciliation | the period is marked reconciled |

### PAY-US-044 · Close the payroll financial year

As a **Compliance owner**, I want 24Q data checked for PAN and challan mismatches before filing, so that returns are accepted first time.

Priority: **Must** · Use case: PAY-UC-021 · Realises: PAY-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | one employee in Q2 has an invalid PAN | I prepare the 24Q return | filing is blocked and the employee is listed |
| 2 | all records are valid | I approve the return | it is marked filed with the filing date |

### PAY-US-045 · Close the payroll financial year

As a **Employee / worker**, I want to download my Form 16 from self-service, so that I can file my tax return.

Priority: **Must** · Use case: PAY-UC-021 · Realises: PAY-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | FY 2026-27 certificates are approved for publication | I open my tax documents | Form 16 and Form 12BA are available to download |
| 2 | a correction later revises my TDS | the year is re-opened and re-locked | a revised Form 16 replaces the earlier one, which remains in history |

### PAY-US-046 · Close the payroll financial year

As a **Payroll manager**, I want to lock the financial year with controlled re-open, so that closed-year figures cannot change silently.

Priority: **Must** · Use case: PAY-UC-021 · Realises: PAY-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | FY 2026-27 is locked | a user tries to create a run dated March 2027 | creation is refused |
| 2 | a re-open is requested | a second user approves with reason | the year is re-opened and the event is audited |

### PAY-US-047 · Run payrolls of different frequencies side by side

As a **Payroll manager**, I want a weekly run for daily-wage workers alongside the monthly run, so that contract workers are paid every week.

Priority: **Must** · Use case: PAY-UC-022 · Realises: PAY-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | PLANT-BLR-DW has a weekly calendar and PLANT-BLR is monthly | the weekly run for 2026-11-02 to 2026-11-08 is locked | attendance input for the monthly run remains editable |
| 2 | E1032 worked 6 days at a daily rate of 72,000 paise | the weekly run computes | gross earnings are 432,000 paise |

### PAY-US-048 · Run payrolls of different frequencies side by side

As a **Compliance owner**, I want monthly statutory contributions reconciled across weekly runs, so that returns match what was deducted.

Priority: **Must** · Use case: PAY-UC-022 · Realises: PAY-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | four weekly runs in November 2026 | the month closes | the PF wage base for each worker equals the sum of the four weekly bases |
| 2 | a worker whose weekly earnings cross the ESI threshold in week 3 | week 4 is computed | ESI continues and the case is flagged |

### PAY-US-049 · Run payrolls of different frequencies side by side

As a **Finance**, I want a separate journal for every run, so that weekly wage cost lands in the right accounting period.

Priority: **Should** · Use case: PAY-UC-022 · Realises: PAY-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a weekly run paid on 2026-11-10 | the run is approved | a journal for that run is emitted with posting date 2026-11-10 |
| 2 | two weekly runs in the same month | I open the GL interface | I see two journals with different run identifiers |

### PAY-US-050 · Model take-home pay before submitting a choice

As a **Employee / worker**, I want to compare take-home under both tax regimes, so that I choose the regime that leaves me better off.

Priority: **Should** · Use case: PAY-UC-023 · Realises: PAY-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am E1010 Nandita Bose with year-to-date results to October 2026 | I model the other regime | I see projected annual tax and monthly take-home for both regimes |
| 2 | the projected difference is ₹1,850 a month | I open the explanation | each line shows the component and rule that changed |

### PAY-US-051 · Model take-home pay before submitting a choice

As a **Employee / worker**, I want to see the effect of VPF and a loan EMI together, so that I know what I will actually receive each month.

Priority: **Should** · Use case: PAY-UC-023 · Realises: PAY-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a scenario with 5% VPF and a loan EMI of ₹6,000 | the scenario computes | monthly take-home shows both deductions applied |
| 2 | an EMI above my eligibility | the scenario computes | the maximum allowed EMI is shown |

### PAY-US-052 · Model take-home pay before submitting a choice

As a **Payroll manager**, I want simulations kept separate from live inputs, so that a what-if never alters a payroll run.

Priority: **Should** · Use case: PAY-UC-023 · Realises: PAY-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 500 employees ran scenarios during the November window | I lock November inputs | no input row originates from a scenario that was not submitted |
| 2 | a submitted declaration | I view its record | it references the scenario the employee chose |

### PAY-US-053 · Trace a payslip line to its inputs, rules and approvals

As a **Auditor**, I want to drill from a payslip line to its inputs and rule version, so that I can verify the figure independently.

Priority: **Must** · Use case: PAY-UC-024 · Realises: PAY-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1044's September loan recovery line of ₹8,400 | I open its trace | I see the loan schedule row, recovery node and rule pack version |
| 2 | I request recomputation | it completes | the recomputed value equals ₹8,400 to the paisa |

### PAY-US-054 · Trace a payslip line to its inputs, rules and approvals

As a **Payroll manager**, I want the run's approval history on every trace, so that I can show who authorised the figures.

Priority: **Must** · Use case: PAY-UC-024 · Realises: PAY-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September PLANT-PUN run | I open approval history from any of its payslips | lock, review, approval and disbursement steps show actor and timestamp |
| 2 | a recomputation mismatch | it is detected | I receive a critical discrepancy alert naming the line |

### PAY-US-055 · Trace a payslip line to its inputs, rules and approvals

As a **Payroll manager**, I want to start from a register total and reach the lines behind it, so that I can explain a variance quickly.

Priority: **Should** · Use case: PAY-UC-024 · Realises: PAY-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | PF employer contribution for PLANT-PUN rose 6% in September | I open the register total | contributing payslip lines are listed, largest first |
| 2 | I select one line | the trace opens | its inputs are shown as at the snapshot timestamp |

### PAY-US-056 · Hold and release an individual's net pay

As a **Payroll manager**, I want to hold one employee's net pay with a reason, so that pay is not released while an issue is open.

Priority: **Must** · Use case: PAY-UC-025 · Realises: PAY-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1022's October net pay is ₹27,640 and a hold is approved | the October bank file is prepared | E1022 is excluded and ₹27,640 is posted to held-salary liability |
| 2 | the October bank file is already prepared | I try to hold E1022 | the hold is refused and the message says to recall or use the next run |

### PAY-US-057 · Hold and release an individual's net pay

As a **Payroll manager**, I want to release a held amount in a later run, so that the employee is paid as soon as the issue is closed.

Priority: **Must** · Use case: PAY-UC-025 · Realises: PAY-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a ₹27,640 hold from October | I release it into the November run | November shows a release line referencing October and the liability is cleared |
| 2 | the release is urgent | I choose an off-cycle run | the amount is paid in that run with the same reference |

### PAY-US-058 · Hold and release an individual's net pay

As a **Employee / worker**, I want to be told when my pay is held and why, so that I can resolve the issue quickly.

Priority: **Should** · Use case: PAY-UC-025 · Realises: PAY-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a hold is approved on my October pay | the hold takes effect | I receive a notification with the reason category and HR contact |
| 2 | the hold is released | the release run is approved | I am notified of the pay date |

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
| Size | 174 | specified items (table rows) | Counted automatically at generation |
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
