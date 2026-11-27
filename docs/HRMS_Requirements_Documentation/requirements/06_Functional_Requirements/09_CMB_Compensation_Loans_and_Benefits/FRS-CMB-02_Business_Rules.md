<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMB-02 — Compensation, Loans & Benefits — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMB-02 |
| Title | Compensation, Loans & Benefits — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compensation, Loans & Benefits |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-CMB-00, FRS-CMB-01, FRS-CMB-02, FRS-CMB-03, FRS-CMB-04, FRS-CMB-05, FRS-CMB-06, FRS-CMB-07, FRS-CMB-08, FRS-CMB-09, FRS-CMB-10, FRS-CMB-11, FRS-CMB-12, FRS-CMB-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-05 · R-10 · processes CMB-01–CMB-06 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Loans

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-430 | Loan eligibility is one service method consumed by the application screen, the guarantor lock, the payroll node and the agent tool. | — | Single method | Code invariant | CMB-01.1, CMB-02.2 | TC-M430 (demo point 9) |
| RL-431 | A person with an outstanding loan is ineligible for another loan and for a salary advance until full repayment. | — | One at a time | Config | CMB-01.2 | TC-M431 |
| RL-432 | A person standing guarantor on an unreleased loan is ineligible for their own loan and to stand guarantor again. | — | Guarantor lock | Config | CMB-01.3 | TC-M432 |
| RL-433 | The ceiling is four times monthly basic, rising to six times for service above five years. | multiple_base, multiple_long, service_years | 4x, 6x, 5 years | Config | CMB-01.4 | TC-M433 |
| RL-434 | Eligibility returns a decision, a ceiling and the reasons, and the reasons are shown to the applicant. | — | Always | Product | CMB-01.5 | TC-M434 |
| RL-440 | A loan application names its proposed guarantors. | — | Required | Product | CMB-02.1 | TC-M440 |
| RL-441 | Two guarantors are mandatory; a third is optional above a configured amount threshold. | mandatory_count, third_threshold | 2, configurable | Config | CMB-02.3 | TC-M441 |
| RL-442 | Accepting a guarantee locks the guarantor until release. | — | Enforced | Code invariant | CMB-02.4 | TC-M442 |
| RL-443 | A director may sanction on special terms, bypassing eligibility, recorded with approver, reason and the rules waived. | override_role | Director | Config | CMB-03.2 | TC-M443 |
| RL-444 | Sanction creates the loan, the schedule and the payroll deduction node. | — | Automatic | Code invariant | CMB-03.3 | TC-M444 |
| RL-450 | Each recovery posts a repayment row and reduces outstanding. | — | Per run | Code invariant | CMB-04.1 | TC-M450 |
| RL-451 | Outstanding reaching zero closes the loan. | — | Automatic | Code invariant | CMB-04.2 | TC-M451 |
| RL-452 | Closure writes explicit guarantor release rows; release is an event, not an inference. | — | Explicit | Code invariant | CMB-04.3 | TC-M452 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

| Rule ID | Module | Rule | Requirement | Statement | Worked example | Where it is configured |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BS:RL-21 | LON | Loan eligibility | R-10 | An employee with an outstanding loan may not take another loan or a salary advance. An employee standing guarantor may not borrow and may not stand guarantor again. Both blocks clear when the guaranteed loan is fully repaid. A Director-approved special-terms record overrides the block and is stored as an approval. | An employee guaranteeing a colleague's loan is blocked from applying until that loan closes. | Not configurable — policy stated |
| BS:RL-22 | LON | Loan ceiling | R-10 | The maximum loan is four times basic salary, rising to six times where continuous service is five years or more. | Basic of 40,000 with six years of service gives a ceiling of 240,000. | Loan policy — eligible multiple |

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
| Size | 15 | specified items (table rows) | Counted automatically at generation |
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
