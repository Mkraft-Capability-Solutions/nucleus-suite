<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-02 — Payroll — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-02 |
| Title | Payroll — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Payroll

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-240 | A payroll run carries a run type and a period may carry several runs. | run_type | regular, off_cycle_ot, arrears, fnf, bonus | payroll_run | PAY-01.1 | TC-Y240 (demo point 10) |
| RL-241 | The run population is resolved from assignments active in the period, including joiners, leavers and transfers. | — | Derived | Code invariant | PAY-01.2 | TC-Y241 |
| RL-242 | Inputs are pulled from attendance, leave, gate pass, overtime, claims, arrears and payroll_input rows. | — | All sources | Code invariant | PAY-01.3 | TC-Y242 |
| RL-250 | Locking inputs freezes the run against further input changes. | — | Enforced | Code invariant | PAY-02.1 | TC-Y250 |
| RL-251 | The snapshot hashes inputs, rule pack versions and configuration so the run can be recomputed and matched to the paisa. | — | Always | Code invariant | PAY-02.2 | TC-Y251 |
| RL-260 | Pre-payroll audit runs rule-based checks first and statistical checks second. | check list | 11 named checks | Config | PAY-03.1 | TC-Y260 |
| RL-261 | An agent may classify and draft resolutions but never change a payroll figure. | autonomy | Propose only. Always. | Tenant policy | PAY-03.2 | TC-A261 |
| RL-262 | A CRITICAL flag blocks approval and cannot be waived below its configured role threshold. | waive_role | Payroll manager or above | Config | PAY-03.3 | TC-Y262 |
| RL-270 | Pay components form a DAG evaluated in topological order, once per employee. | — | Always | Code invariant | PAY-04.1 | TC-Y270 |
| RL-271 | Money is held as integers in the smallest currency unit; no floating point anywhere in the engine. | — | Paise | Code invariant | PAY-04.2 | TC-Y271 |
| RL-272 | Proration across any month boundary sums to the full-month value. | — | Property | Property test | PAY-04.3 | TC-Y272 |
| RL-273 | Every payslip line stores the node, inputs, output and rule pack version that produced it. | — | Always | Code invariant | PAY-04.4 | TC-Y273 |
| RL-280 | Statutory wage base = basic + dearness allowance + retaining allowance. | — | Code on Wages | rule_pack | PAY-05.1 | TC-Y280 |
| RL-281 | Where excluded components exceed 50% of total remuneration, the excess is added back to the wage base. | floor_pct | 50% | rule_pack | PAY-05.2 | TC-Y281 |
| RL-282 | The wage base is one node, computed once, and consumed by PF, ESI, gratuity, bonus, overtime and encashment. | — | Single node | Code invariant | PAY-05.3 | TC-Y282 |
| RL-283 | A structure change can be simulated for statutory cost and take-home impact before adoption. | — | Per employee and aggregate | Product | PAY-05.4 | TC-Y283 |
| RL-290 | Daily-wage earnings are a separate DAG node selected by wage_type, not a proration parameter on the monthly node. | wage_type | daily | worker_class | PAY-06.1 | TC-Y290 (demo point 2) |
| RL-291 | Daily-wage earnings = days present × daily rate, with half days at the configured fraction. | half_day_fraction | 0.5 | Config | PAY-06.2 | TC-Y291 |
| RL-292 | The day count is shown on the payslip so a daily-wage worker can reconcile against attendance. | — | Always | Product | PAY-06.3 | TC-Y292 |
| RL-300 | PF and EPS are computed on the statutory wage base against the ceiling in the effective rule pack. | ceiling | Per pack version | rule_pack | PAY-07.1 | TC-Y300 |
| RL-301 | An employee crossing the ESI wage threshold mid-period continues contributing to the end of the contribution period. | — | Statutory | rule_pack | PAY-07.2 | TC-Y301 |
| RL-302 | Professional tax follows the location's state slab set; it does not apply in every state. | pt_slab_set | KA, MH, TS, TN sets | Config | PAY-07.3 | TC-Y302 (demo point 17) |
| RL-303 | TDS respects the regime choice and projects to year end; a mid-year switch is an expected case. | — | Both regimes | rule_pack | PAY-07.4 | TC-Y303 |
| RL-304 | Gratuity and bonus provisions accrue on the statutory wage base for the journal. | — | Monthly | rule_pack | PAY-07.5 | TC-Y304 |
| RL-310 | Payroll recovers loan instalments; it does not originate loans or judge eligibility. | — | Separation of duty | Code invariant | PAY-08.1 | TC-Y310 |
| RL-311 | A recovery that would drive net below the floor is reduced or skipped, flagged, and carried forward. | net_floor | Statutory minimum wage | Config | PAY-08.2 | TC-Y311 |
| RL-312 | Recovery stops when outstanding reaches zero. | — | Enforced | Code invariant | PAY-08.3 | TC-Y312 |
| RL-313 | The closing outstanding is reported back to the loans module and to the GL. | — | Per run | Code invariant | PAY-08.4 | TC-Y313 |
| RL-320 | Review shows variance against the prior period and a headcount reconciliation. | variance_threshold | Configurable % | Config | PAY-09.1 | TC-Y320 |
| RL-321 | A run cannot reach APPROVED with an open CRITICAL flag or an unmapped pay component. | — | Enforced | Code invariant | PAY-09.2, FIN-03.2 | TC-Y321 (demo point 15) |
| RL-322 | Bank file totals are verified out of band under dual control, and bank-detail changes inside a payroll window raise an alert. | — | Dual control | Code invariant | PAY-09.3 | TC-Y322 |
| RL-323 | After DISBURSEMENT_PREPARED, corrections happen only as arrears. | — | Enforced | State machine | PAY-09.4, PAY-14 | TC-Y323 |
| RL-324 | Each run emits its own journal. | — | Per run | Code invariant | PAY-09.5, FIN-03 | TC-F324 |
| RL-330 | An off-cycle overtime run is a second run against the same period, not a delayed line in the first. | — | Separate run | Code invariant | PAY-10.1 | TC-Y330 (demo point 10) |
| RL-331 | An off-cycle run pulls only the overtime records tagged to it. | — | Tagged only | Code invariant | PAY-10.2 | TC-Y331 |
| RL-332 | Overtime pay uses the statutory wage base and the state multiplier. | — | Per pack | rule_pack | PAY-10.3 | TC-Y332 |
| RL-333 | An off-cycle run produces its own payslip view, bank file and journal, with run type as a journal dimension. | — | Own artefacts | Code invariant | PAY-10.4 | TC-F333 |
| RL-340 | A full-and-final run cannot proceed while any blocking clearance item is open or unwaived. | — | Enforced | Code invariant | PAY-12.1 | TC-X340 (demo point 16) |
| RL-341 | F&F computes salary to the last working day, encashment, gratuity, notice recovery and loan foreclosure; negative net is a valid outcome. | — | Handled | Code invariant | PAY-12.2 | TC-X341 |
| RL-342 | F&F settles on the last working day when clearance has run in parallel with notice. | — | Target | Product | PAY-12.3 | TC-X342 |
| RL-350 | Payslip retrieval takes a period AND a run selector. | — | Always | Product | PAY-13.1 | TC-Y350 |
| RL-351 | Every payslip line drills to the rule and the inputs behind it. | — | Always | Product | PAY-13.2 | TC-Y351 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

_No entries in source for this scope._

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
| Size | 42 | specified items (table rows) | Counted automatically at generation |
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
