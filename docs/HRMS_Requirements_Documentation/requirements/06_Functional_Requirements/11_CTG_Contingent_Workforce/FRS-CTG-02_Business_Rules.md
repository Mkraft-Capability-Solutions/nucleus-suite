<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CTG-02 — Contingent Workforce — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CTG-02 |
| Title | Contingent Workforce — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Contingent Workforce |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-CTG-00, FRS-CTG-01, FRS-CTG-02, FRS-CTG-03, FRS-CTG-04, FRS-CTG-05, FRS-CTG-06, FRS-CTG-07, FRS-CTG-08, FRS-CTG-09, FRS-CTG-10, FRS-CTG-11, FRS-CTG-12, FRS-CTG-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · processes CTG-01–CTG-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Talent, Contingent, Experience

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-480 | Contractor invoices are submitted against a deployed population by class and rate. | — | Per engagement | Product | CTG-02.1 | TC-G480 |
| RL-481 | Invoices reconcile against attendance the system already holds, with variance visible before payment. | — | Pre-payment | Product | CTG-02.2 | TC-G481 |
| RL-482 | Variance evidence is attached to the invoice decision. | — | Always | Product | CTG-02.3 | TC-G482 |

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
| Size | 3 | specified items (table rows) | Counted automatically at generation |
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
