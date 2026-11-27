<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-10 — Payroll — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-10 |
| Title | Payroll — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| PAY-01 | Period setup and run creation | Critical | P1 | CMP-10 |
| PAY-02 | Input lock and immutable snapshot | Critical | P1 | CMP-05, CMP-10 |
| PAY-03 | Pre-payroll audit | Critical | P1 | CMP-05 |
| PAY-04 | Gross-to-net DAG execution | Critical | P1 | CMP-03 |
| PAY-05 | Wage base and 50% floor add-back | Critical | P1 | CMP-03 |
| PAY-06 | Daily-wage earnings computation | Critical | P1 | CMP-03 |
| PAY-07 | Statutory computation (PF, ESI, PT, LWF, TDS) | Critical | P1 | CMP-03, CMP-09 |
| PAY-08 | Loan, advance and EWA recovery | High | P1 | CMP-03 |
| PAY-09 | Review, approval and disbursement | Critical | P1 | CMP-01, CMP-05 |
| PAY-10 | Off-cycle overtime run | High | P1 | CMP-03 |
| PAY-11 | Arrears and retro processing | Critical | P2 | CMP-03, CMP-10 |
| PAY-12 | Full-and-final run | Critical | P1 | CMP-03, CMP-05 |
| PAY-13 | Payslip publication and retrieval | High | P1 | CMP-08 |
| PAY-14 | Rollback and reversal | Critical | P1 | CMP-05 |

Forms specified: 8 with 157 fields; screens: 7; rules: 42.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-PAY-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| PAY-CG-001 | Multi-country payroll | The payroll engine MUST support country packs (earnings, deductions, taxes, statutory filings, payslip format) beyond India, delivered as versioned rule packs on the same DAG. | Should | P4 |
| PAY-CG-002 | Retroactive pay processing | The system MUST compute retro differences for back-dated changes to salary, attendance or leave across closed periods and pay them as arrears in the next open run with an itemised arrears statement. | Must | P1 |
| PAY-CG-003 | Tax declaration and proof management | Employees MUST be able to choose the income-tax regime, declare investments and upload proofs, with HR verification and TDS projection recalculation. | Must | P1 |
| PAY-CG-004 | Reimbursements and flexible benefit plan claims | The system MUST manage reimbursement claims (fuel, telephone, LTA, meal) with bill upload, limits, tax treatment and payroll integration. | Must | P2 |
| PAY-CG-005 | Garnishments and court orders | The system MUST support court-ordered deductions and recoveries with priority order and statutory protection of minimum net pay. | Should | P3 |
| PAY-CG-006 | Third-party payroll extracts | For countries not natively supported, the system MUST produce effective-dated change extracts for third-party payroll providers with acknowledgement and reconciliation. | Should | P4 |
| PAY-CG-007 | Year-end processing | The system MUST produce annual Form 16 / Form 12BA, investment reconciliation and quarterly 24Q returns, and lock the financial year with re-open control. | Must | P2 |
| PAY-CG-008 | Multi-frequency payroll | The engine MUST run monthly, semi-monthly, weekly and daily-wage payrolls side by side for different pay groups, each with its own calendar and locks. | Must | P2 |
| PAY-CG-009 | Employee net-pay what-if | Employees MUST be able to model the take-home effect of choices (tax regime, VPF, flexi-benefit allocation, loan) before submitting them. | Should | P3 |
| PAY-CG-010 | Payroll audit trail explorer | Payroll and auditors MUST be able to trace any payslip line back to its inputs, rules and rule versions, with the approval history of the run. | Must | P2 |
| PAY-CG-011 | Salary hold and release | Payroll MUST be able to hold an individual's net pay with a reason and release it in the same or a later run with full audit. | Must | P1 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PAY-FX-001 | Continuous payroll | Gross-to-net is recomputed on every relevant event so a current, explainable pay position exists at any moment; the period run becomes a lock-and-publish step. | Ends the month-end payroll crunch. | Recompute worker, gross-to-net DAG | No AI | P5 |
| PAY-FX-002 | Earned wage access | Employees can draw up to a configured share of earned net wages before payday within limits, recovered automatically in the next run. | Financial wellbeing without payday loans. | Eligibility service, ledger | No AI | P4 |
| PAY-FX-003 | Explainable payslip | 'Why did my pay change?' answers line by line in the employee's language, citing rules and inputs. | Fewer payroll queries; transparent pay. | Policy Assistant, rule registry | Tier 1 | P4 |
| PAY-FX-004 | Zero-touch pre-audit | The Payroll Preparer agent runs variance analysis, flags anomalies with likely causes and prepares the approval pack; humans approve. | Shifts payroll teams from checking to deciding. | Payroll Preparer agent | Tier 2 | P3 |
| PAY-FX-005 | Tax regime advisor | Shows employees the projected tax under each regime from their declarations, as advice with clear disclaimers. | Personal finance guidance inside HR. | Gross-to-net DAG | Tier 2 | P4 |
| PAY-FX-006 | Zero-day payroll close | With continuous payroll, approvals and statutory files are produced on the pay date itself with exception-only human review. | Payroll that closes the same day it pays. | Continuous payroll, Payroll Preparer agent | Tier 2 | P5 |
| PAY-FX-007 | Instant cross-border pay for global assignees | Splits and pays host and home components in local currencies with shadow-payroll tax handling. | Global mobility without manual payroll work. | Multi-country payroll | No AI | P5 |

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
| Size | 32 | specified items (table rows) | Counted automatically at generation |
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
