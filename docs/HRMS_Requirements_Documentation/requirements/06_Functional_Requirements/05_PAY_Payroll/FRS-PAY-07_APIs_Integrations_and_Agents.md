<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-07 — Payroll — APIs, Integrations and Agents

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-07 |
| Title | Payroll — APIs, Integrations and Agents |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 13_API_and_Tools, 14_Agents, 15_Integration_Flows<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Form CRUD endpoints

| Form ID | Form | Target object | Endpoint |
| :--- | :--- | :--- | :--- |
| FRM-PAY-01 | Pay Component Master | pay_component_master | /api/v1/ops/modules/pay_component_master/records |
| FRM-PAY-02 | Salary Structure | salary_simulator | /api/v1/wage-simulations |
| FRM-PAY-03 | Payroll Run | payroll_runs | /api/v1/payroll-runs |
| FRM-PAY-04 | Pre-Payroll Audit Resolution | pre_payroll_audit | /api/v1/payroll-anomalies |
| FRM-PAY-05 | Investment Declaration and Tax | tax_declarations | /api/v1/ops/modules/tax_declarations/records |
| FRM-PAY-06 | Reimbursement Claim | reimbursement_claim | /api/v1/ops/modules/reimbursement_claim/records |
| FRM-PAY-07 | Disbursement and Bank File | bank_disbursement | /api/v1/ops/modules/bank_disbursement/records |
| FRM-PAY-08 | Full and Final Settlement | full_and_final | /api/v1/fnf-settlements |

## 2. Public REST and governed tool surface

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REST | /v1/payroll/runs | GET, POST | Run lifecycle | payroll.admin | write | Yes on state change | Payroll UI | Run type mandatory |
| REST | /v1/payroll/payslips | GET | Payslip by period and run | payroll.self / payroll.admin | read | — | Apps | Run selector required |
| REST | /v1/payroll/journal | GET | Dimensioned salary journal per run | finance.read | read | — | ERP, finance | Blocked until every component is mapped |
| TOOL | simulate_payroll | read | Dry-run a run and return the diff | payroll.simulate | read | — | Payroll Preparer | Never mutates |
| TOOL | run_pre_audit | propose | Execute checks and classify flags | payroll.audit | propose | Yes | Payroll Preparer | Propose only. Always. |

## 3. Integration flows

| Flow | Direction | Mechanism | Cadence | Payload | Ownership / rules | Reconciliation | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Salary journal | Nucleus → ERP | API post to the connected ERP system, ERP-native XML voucher, CSV, staging table, manual download | Per run | Balanced journal dimensioned by cost centre, department, location, project and run type | Every component mapped before APPROVED; posting result and document number written back | Gross vs payslips, net vs bank file, statutory vs challans, dimension residue = 0 | P1 |
| Bank disbursement | Nucleus → Bank | Direct API with major Indian banks, plus a file fallback | Per run | Beneficiary, account token, IFSC, amount, narration | Dual control, out-of-band total verification, alert on bank-detail change inside the window | File total = journal net = sum of payslip nets | P1 |

Payload-level specifications are in ICD-01.

## 4. Agents operating in this domain

| Agent | Cadence | What it does | Tools used | Autonomy default | Approval threshold | Ledger fields | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Payroll Preparer | Per cycle | Assembles inputs, runs the pre-audit, classifies each flag, drafts resolutions, produces a signed readiness report | simulate_payroll, run_pre_audit, read_employee | Propose only. Always. | No autonomous payroll change, ever | run_id, flags_classified, drafts, readiness_report_hash | P3 |

## 5. API requirements (Authored)

- Public REST MUST be described in OpenAPI 3.1, versioned, with a sandbox tenant per partner (IA-01).
- Every write MUST accept an `Idempotency-Key` and return the effective-dated version it created.
- The tool surface is built once and exposed twice (internal agents and external MCP clients); every tool call MUST pass the policy gate and be recorded in the action ledger.

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
| Size | 16 | specified items (table rows) | Counted automatically at generation |
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
