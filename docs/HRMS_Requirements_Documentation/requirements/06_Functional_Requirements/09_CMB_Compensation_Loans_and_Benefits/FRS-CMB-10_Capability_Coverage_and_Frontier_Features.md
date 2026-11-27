<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMB-10 — Compensation, Loans & Benefits — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMB-10 |
| Title | Compensation, Loans & Benefits — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compensation, Loans & Benefits |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-CMB-00, FRS-CMB-01, FRS-CMB-02, FRS-CMB-03, FRS-CMB-04, FRS-CMB-05, FRS-CMB-06, FRS-CMB-07, FRS-CMB-08, FRS-CMB-09, FRS-CMB-10, FRS-CMB-11, FRS-CMB-12, FRS-CMB-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-05 · R-10 · processes CMB-01–CMB-06 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| CMB-01 | Loan eligibility evaluation | Critical | P1 | CMP-02 |
| CMB-02 | Loan application and guarantor acceptance | High | P2 | CMP-01, CMP-02 |
| CMB-03 | Loan sanction and director override | High | P2 | CMP-01 |
| CMB-04 | Repayment, closure and guarantor release | Critical | P2 | CMP-02 |
| CMB-05 | Salary advance and earned wage access | Medium | P3 | CMP-02, CMP-03 |
| CMB-06 | Compensation revision cycle | High | P3 | CMP-01, CMP-03r |

Forms specified: 2 with 30 fields; screens: 1; rules: 13.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-CMB-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| CMB-CG-001 | Salary structures and grade ranges | The system MUST maintain pay ranges (min/mid/max) per grade and location, with compa-ratio and range-penetration on every assignment. | Must | P1 |
| CMB-CG-002 | Merit, bonus and variable pay cycles | The system MUST run budgeted merit and bonus cycles with eligibility rules, guidelines matrix (performance × compa-ratio), manager worksheets, approvals and payroll hand-off. | Must | P3 |
| CMB-CG-003 | Equity and ESOP administration | The system SHOULD track ESOP grants, vesting schedules, exercises and perquisite tax valuation for payroll. | Should | P4 |
| CMB-CG-004 | Health insurance enrolment | The system MUST manage group medical/accident/life cover enrolment with dependants, top-ups, enrolment windows, life-event changes and insurer data exchange. | Must | P3 |
| CMB-CG-005 | Retirement plans (NPS, superannuation) | The system MUST manage NPS and superannuation contributions, employee choice and statutory caps, with payroll integration. | Must | P3 |
| CMB-CG-006 | Flexible benefits and perks | The system SHOULD support a flexi-benefit plan with points/budget, catalogue, tax-optimised allocation and year-end reconciliation. | Should | P3 |
| CMB-CG-007 | Total rewards statement | Employees MUST be able to view an annual total rewards statement (fixed, variable, benefits, statutory employer contributions, perks). | Should | P3 |
| CMB-CG-008 | Pay equity analysis | HR MUST be able to analyse pay gaps by gender and other permitted attributes controlling for grade, location and tenure, with remediation tracking. | Must | P3 |
| CMB-CG-009 | Long-term incentives and retention bonuses | The system SHOULD manage deferred and retention bonuses with vesting conditions, clawback rules and payroll scheduling. | Should | P4 |
| CMB-CG-010 | Internal pay benchmarking | Compensation teams MUST compare pay within role, grade, location and tenure bands using internal data, highlighting outliers before cycles. | Must | P3 |
| CMB-CG-011 | Statutory bonus and gratuity administration | The system MUST compute statutory bonus and gratuity eligibility and amounts with configurable rules and provisions (to be validated by Legal). | Must | P2 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMB-FX-001 | AI compensation advisor with equity guardrails | Recommends merit and offer amounts within ranges and budget, flags pay-equity risk before submission, and explains each recommendation. | Fair pay decisions at the point of decision. | Eligibility service | Tier 3 | P5 |
| CMB-FX-002 | Real-time total rewards wallet | A live view of earned pay, benefits, loans, EWA and perks with what-if for choices. | Makes total rewards tangible every day. | Ledger | Tier 1 | P4 |
| CMB-FX-003 | Personalised benefits recommender | Suggests benefit choices from life events and consented preferences. | Better benefit uptake and value. | Eligibility service | Tier 2 | P5 |
| CMB-FX-004 | Pay transparency readiness | Generates pay-range disclosures and gap reports for jurisdictions with pay-transparency obligations. | Global readiness for emerging regulation. | Analytics projections | Tier 1 | P5 |
| CMB-FX-005 | Fair-pay autopilot | Continuously monitors pay equity and proposes budgeted adjustments for HR approval each cycle. | Pay equity maintained continuously, not annually. | Pay equity analysis | Tier 3 | P5 |

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
| Size | 22 | specified items (table rows) | Counted automatically at generation |
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
