<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CTG-11 — Contingent Workforce — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CTG-11 |
| Title | Contingent Workforce — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Contingent Workforce |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-CTG-00, FRS-CTG-01, FRS-CTG-02, FRS-CTG-03, FRS-CTG-04, FRS-CTG-05, FRS-CTG-06, FRS-CTG-07, FRS-CTG-08, FRS-CTG-09, FRS-CTG-10, FRS-CTG-11, FRS-CTG-12, FRS-CTG-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · processes CTG-01–CTG-03 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 45_Vendors_Contractors, 46_Contractor_Invoices |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

_No entries in source for this scope._

## 2. Reference and golden data

### `45_Vendors_Contractors` (6 rows)

| Vendor code | Vendor name | Engagement type | Sites served | Contract from | Contract to | CLRA licence | PF code | ESI code | Workers deployed | Worker classes | Invoice basis | PF / ESI verification | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| VN-01 | Sharada Manpower Services | Third party — deployed workforce | LOC-PLA | 2025-04-01 | 2027-03-31 | KA/CLRA/2025/00418 | KA/BLR/0051103 | 53000123450000801 | 4 | WC-3PE, WC-3PH | Monthly, per worker per day | Held — August challan not yet produced | Points 3, 4 |
| VN-02 | Prasanna Labour Contractors | Contractual — daily wage | LOC-PLA | 2025-07-01 | 2026-06-30 | KA/CLRA/2025/00522 | KA/BLR/0051290 | 53000123450000915 | 2 | WC-CONT | Monthly, per worker per day | Current | Point 2 |
| VN-03 | Sahyadri Staffing LLP | Contractual — daily wage | LOC-PUN | 2026-01-01 | 2026-12-31 | MH/CLRA/2026/01147 | MH/PUN/0033812 | 31000456780001204 | 1 | WC-CONT | Monthly, per worker per day | Current | Point 2 |
| VN-04 | Deccan Facility Services | Third party — deployed workforce | LOC-HYD | 2025-10-01 | 2026-09-30 | TS/CLRA/2025/00733 | TS/HYD/0024455 | 52000789010000617 | 1 | WC-3PH | Monthly, per worker per day | Current — contract expires 30 Sep, renewal not yet raised | Point 3 |
| VN-05 | Kaveri Industrial Services | Third party — deployed workforce | LOC-CHN | 2025-04-01 | 2027-03-31 | TN/CLRA/2025/00291 | TN/CHN/0041066 | 51000234560000723 | 2 | WC-CONT, WC-3PE | Monthly, per worker per day | Current | Points 3, 17 |
| ADDED v1.1 for form FRM-CTG-01. v1.0 referenced VN-01 to VN-05 on the employee record and in the contract-labour register without ever defining them, so the third-party population had no vendor behind it. Two things to point out on screen: VN-01 has an unverified PF challan, which is the principal employer's exposure and not the contractor's; and VN-04's contract expires on 30 September with no renewal raised, which is what the obligation calendar should be catching. Load before 12_Employees. |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `46_Contractor_Invoices` (5 rows)

| Invoice | Vendor | Period | Site | Worker days claimed | Worker days from attendance | Variance (days) | Rate per day | Claimed amount (INR) | Passed amount (INR) | Status | Reconciliation note | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| INV-VN01-2608 | VN-01 | Aug 2026 | LOC-PLA | 104 | 104 | 0 | 700 | 72800 | 72800 | Passed for payment | Matches attendance exactly | Point 3 |
| INV-VN01-2609 | VN-01 | Sep 2026 (part) | LOC-PLA | 56 | 53 | -3 | 700 | 39200 | 37100 | Query raised | Three days claimed for E1036 on 06, 07 and 13 Sep that attendance does not support. The system holds the difference rather than paying and reconciling later. | Points 3, 4 |
| INV-VN02-2608 | VN-02 | Aug 2026 | LOC-PLA | 52 | 52 | 0 | 650 | 33800 | 33800 | Passed for payment | Matches attendance exactly | Point 2 |
| INV-VN05-2608 | VN-05 | Aug 2026 | LOC-CHN | 51 | 51 | 0 | 635 | 32385 | 32385 | Passed for payment | Matches attendance exactly | Point 3 |
| ADDED v1.1 for form FRM-CTG-02. The reconciliation is the reason third-party attendance is captured in the same system as everyone else's. INV-VN01-2609 is the row to open: three claimed days with no attendance behind them, held automatically. Amounts are illustrative and are not carried into any payroll run in this dataset. |  |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 11 | specified items (table rows) | Counted automatically at generation |
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
