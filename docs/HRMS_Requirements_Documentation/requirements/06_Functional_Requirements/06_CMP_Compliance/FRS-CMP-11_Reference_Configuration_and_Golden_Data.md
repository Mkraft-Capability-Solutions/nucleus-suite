<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-11 — Compliance — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-11 |
| Title | Compliance — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compliance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 28_Statutory_Calendar, 29_Statutory_Forms |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Establishment registration number | STA | F-STA-02 — Form F — Joining Form | From the establishment master | HR roles only | R-27 | Yes |
| State variant | STA | F-STA-02 — Form F — Joining Form | From the establishment state | HR roles only | R-27 | Yes — value set configurable per tenant |
| Nature of work | STA | F-STA-02 — Form F — Joining Form | From designation | HR roles only | R-27 | Yes |
| Statutory form code | STA | F-STA-01 — Statutory Registers & Returns | — | HR roles only | R-18 | Yes — value set configurable per tenant |
| Establishment | STA | F-STA-01 — Statutory Registers & Returns | — | HR roles only | R-18 | Yes |
| State variant | STA | F-STA-01 — Statutory Registers & Returns | From the establishment state | HR roles only | R-18 | Yes — value set configurable per tenant |

## 2. Reference and golden data

### `28_Statutory_Calendar` (13 rows)

| Obligation ID | Obligation | Authority | Entity | State | Period | Due date | Owner | Status | Evidence | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OB-2026-0912 | PF ECR and challan | EPFO | LE-01 | Central | Aug 2026 | 2026-09-15 | E1009 | Filed | ECR ack 2026-09-12 | Point 17 |
| OB-2026-0913 | ESI contribution | ESIC | LE-01 | Central | Aug 2026 | 2026-09-15 | E1009 | Filed | Challan 2026-09-13 | Point 17 |
| OB-2026-0914 | Professional tax remittance | Commercial Taxes, Karnataka | LE-01 | KA | Aug 2026 | 2026-09-20 | E1007 | Due |  | Point 17 |
| OB-2026-0915 | Professional tax remittance | Finance Dept, Maharashtra | LE-01 | MH | Aug 2026 | 2026-09-30 | E1007 | Due |  | Point 17 |
| OB-2026-0916 | Professional tax remittance | Commercial Taxes, Telangana | LE-02 | TS | Aug 2026 | 2026-09-15 | E1007 | Filed | Challan 2026-09-14 | Point 17 |
| OB-2026-0917 | Professional tax — not applicable | Tamil Nadu | LE-02 | TN | Aug 2026 |  | E1007 | Not applicable | Half-yearly, next due 2026-09-30 | Point 17 |
| OB-2026-0918 | TDS deposit | Income Tax | LE-01 | Central | Aug 2026 | 2026-09-07 | E1007 | Filed | BSR ack | Point 17 |
| OB-2026-0919 | TDS quarterly return 24Q | Income Tax | LE-01 | Central | Q2 FY27 | 2026-10-31 | E1007 | Not started |  | Point 17 |
| OB-2026-0920 | Labour welfare fund | Labour Dept, Karnataka | LE-01 | KA | H1 2026 | 2026-07-15 | E1009 | Filed | Receipt 2026-07-11 |  |
| OB-2026-0921 | Gratuity actuarial valuation | AS 15 | LE-01 | Central | FY27 H1 | 2026-10-31 | E1010 | Not started |  |  |
| OB-2026-0922 | Factory annual return | Factories Dept, Karnataka | LE-01 | KA | CY 2026 | 2027-01-31 | E1009 | Not started |  | Point 17 |
| OB-2026-0923 | Contract labour half-yearly return | Labour Dept, Tamil Nadu | LE-02 | TN | H1 2026 | 2026-07-30 | E1009 | Filed | Receipt 2026-07-24 | Point 17 |
| Professional tax differs by state on the same payroll run and is not applicable in one of them. This one screen is the strongest compliance demo in the product. |  |  |  |  |  |  |  |  |  |  |

### `29_Statutory_Forms` (9 rows)

| Form instance | Form | Act / Rules | State | Entity | Location | Period | Generated on | Filed on | Status | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-F-2026-0112 | Form F — particulars of workers | Factories Rules | KA | LE-01 | LOC-PLA | On joining | 2026-09-01 |  | Generated in the joining chain for E1066 | Point 26 |
| FRM-F-2026-0108 | Form F — particulars of workers | Factories Rules | TN | LE-02 | LOC-CHN | On joining | 2026-05-11 |  | Generated for E1061 | Point 26 |
| FRM-28-2026-09 | Form 28 — overtime register | Factories Rules | KA | LE-01 | LOC-PLA | Sep 2026 | 2026-09-15 |  | Open — generated from approved OT records | Point 17 |
| FRM-28-2026-08 | Form 28 — overtime register | Factories Rules | KA | LE-01 | LOC-PLA | Aug 2026 | 2026-09-01 | 2026-09-05 | Filed | Point 17 |
| FRM-18-2026-H1 | Form 18 — leave with wages register | Factories Rules | KA | LE-01 | LOC-PLA | H1 2026 | 2026-07-05 | 2026-07-12 | Filed | Point 17 |
| FRM-36-2026-H1 | Form 36 — muster roll | Factories Rules | KA | LE-01 | LOC-PLA | H1 2026 | 2026-07-05 | 2026-07-12 | Filed | Point 17 |
| FRM-36-2026-H1T | Form equivalent — muster roll | Factories Rules | TN | LE-02 | LOC-CHN | H1 2026 | 2026-07-08 | 2026-07-15 | Filed — different form set applies in Tamil Nadu | Point 17 |
| FRM-XIII-2026-09 | Register of workmen — contract labour | CLRA Rules | KA | LE-01 | LOC-PLA | Sep 2026 | 2026-09-01 |  | Open — covers VN-01 and VN-02 populations | Point 17 |
| Forms are state-specific and follow the plant's registration, not the company's. The Karnataka and Tamil Nadu register sets differ, which is the point to make on screen. Generation binds a declarative query to a template, so a state amendment is a configuration change. |  |  |  |  |  |  |  |  |  |  |

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
| Size | 28 | specified items (table rows) | Counted automatically at generation |
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
