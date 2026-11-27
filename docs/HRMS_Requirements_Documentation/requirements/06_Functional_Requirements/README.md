<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-00 — Functional Requirements — Domain Index

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-00 |
| Title | Functional Requirements — Domain Index |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Head of Product |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM |
| Related documents | BRS-01, SRS-01, REQ-01, REQ-02, BA-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0<br>Nucleus HRMS — Complete Forms & Fields Specification v1.0<br>Nucleus HR Demo Points Build Sheet v1.0<br>Nucleus HRMS Demo Dataset v1.1<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Functional requirements are organised by the 14 process domains of the Nucleus process architecture (BA-01). Each domain pack contains FRS-<DOM>-00 to FRS-<DOM>-13.

| # | Domain | Code | Processes | Use cases | User stories | Business rules | Forms | Form fields | Screens | Test cases | Capability gaps | Frontier features |
| ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | [Platform & Foundations](01_PLT_Platform_and_Foundations/README.md) | `PLT` | 8 | 25 | 73 | 13 | 3 | 58 | 1 | 2 | 17 | 7 |
| 2 | [People Core](02_PPL_People_Core/README.md) | `PPL` | 8 | 18 | 50 | 23 | 6 | 210 | 6 | 0 | 10 | 6 |
| 3 | [Time & Attendance](03_TIM_Time_and_Attendance/README.md) | `TIM` | 10 | 19 | 66 | 55 | 8 | 107 | 8 | 19 | 9 | 6 |
| 4 | [Leave](04_LVE_Leave/README.md) | `LVE` | 8 | 15 | 40 | 26 | 4 | 72 | 3 | 10 | 7 | 5 |
| 5 | [Payroll](05_PAY_Payroll/README.md) | `PAY` | 14 | 25 | 58 | 42 | 8 | 157 | 7 | 8 | 11 | 7 |
| 6 | [Compliance](06_CMP_Compliance/README.md) | `CMP` | 6 | 15 | 41 | 12 | 1 | 12 | 4 | 1 | 9 | 4 |
| 7 | [Lifecycle](07_LCY_Lifecycle/README.md) | `LCY` | 8 | 16 | 40 | 12 | 4 | 51 | 3 | 2 | 8 | 4 |
| 8 | [Self-service & Helpdesk](08_SSV_Self_Service_and_Helpdesk/README.md) | `SSV` | 5 | 12 | 29 | 7 | 1 | 13 | 3 | 0 | 7 | 5 |
| 9 | [Compensation, Loans & Benefits](09_CMB_Compensation_Loans_and_Benefits/README.md) | `CMB` | 6 | 17 | 46 | 13 | 2 | 30 | 1 | 5 | 11 | 5 |
| 10 | [Talent](10_TAL_Talent/README.md) | `TAL` | 5 | 22 | 49 | 7 | 5 | 74 | 3 | 2 | 17 | 7 |
| 11 | [Contingent Workforce](11_CTG_Contingent_Workforce/README.md) | `CTG` | 3 | 8 | 24 | 3 | 2 | 24 | 1 | 0 | 5 | 4 |
| 12 | [Experience](12_EXP_Experience/README.md) | `EXP` | 3 | 9 | 20 | 6 | 3 | 35 | 3 | 1 | 6 | 4 |
| 13 | [Finance & ERP](13_FIN_Finance_and_ERP/README.md) | `FIN` | 5 | 10 | 24 | 14 | 2 | 17 | 4 | 3 | 5 | 4 |
| 14 | [Intelligence & Agents](14_INT_Intelligence_and_Agents/README.md) | `INT` | 4 | 12 | 26 | 6 | 0 | 0 | 2 | 0 | 7 | 7 |
| | **Total** | | **93** | **223** | **586** | **239** | **49** | **860** | **49** | **53** | **129** | **75** |

Catalogues: [UCC-01 Use Case Catalogue](UCC-01_Use_Case_Catalogue.md) · [USC-01 User Story Catalogue](USC-01_User_Story_Catalogue.md).

## Cross-domain backlog items (Domain = ALL)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-110 | QA | Golden-case library to 300 payroll and 120 attendance cases | P1 | — | BL-031, BL-051 | 12 | A single mismatch fails the build |
| BL-111 | QA | Shadow payroll and shadow attendance harness for design partners | P1 | — | BL-110 | 6 | Two full cycles reconciled to the rupee before go-live |
| BL-146 | Security | SOC 2 Type I | P3 | — | BL-008 | 10 | Evidence collection started in month 1, not month 11 |
| BL-150 | Capability | Capability Index and wellbeing, with the separate store and access control | P4 | CMP-08 | BL-141 | 16 | No individual wellbeing signal reaches a manager, ever |

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
| Size | 19 | specified items (table rows) | Counted automatically at generation |
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
