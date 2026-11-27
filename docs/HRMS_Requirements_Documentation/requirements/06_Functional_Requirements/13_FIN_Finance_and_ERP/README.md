<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-00 — Finance & ERP — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-00 |
| Title | Finance & ERP — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `FIN` |
| Domain | Finance & ERP |
| Scope | Employee master inbound, GL mapping, salary journal, posting, reconciliation, bank file |
| Blueprint reference | Blueprint §9 |
| Delivery phase(s) | P1/P2 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-4 | PAY | Inputs locked, audited, computed, approved, disbursed, posted, reconciled | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-06 | PAY → FIN | One balanced, dimensioned journal per run per entity. Run type is a journal dimension. | PAY-09, FIN-03 | P1 |
| S-07 | FIN → PPL | ERP-owned master fields are read-only in Nucleus. The ownership map is the referee. | FIN-01, PPL-02 | P1 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-15 | 14 | Link the ERP employee master to Nucleus | INT | P1 | The ERP employee master is linked to the HR software through an API. | Confirm the direction of ownership, the sync frequency, the key mapping, and what happens to a record that fails to sync. |
| R-16 | 15 | Show and generate account posting in the ERP from Nucleus | INT | P1 | Account posting is shown and generated in the ERP from the HR software. | Confirm the payroll journal is produced with account, cost centre and amount, that it is idempotent on re-run, and that a posting failure is visible rather than silent. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 5 |
| Process steps (DOM-nn.s) | 14 |
| Use cases (UC) | 10 |
| User stories (US) | 24 |
| Business rules (RL-nnn) | 14 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 2 |
| Form fields | 17 |
| Client form deltas (F-) | 2 |
| Client form-delta fields | 8 |
| Screens (SCR-) | 4 |
| Data objects | 6 |
| State-machine states | 0 |
| Domain events | 2 |
| APIs and agent tools | 2 |
| Integration flows | 3 |
| Agents | 0 |
| Test cases (TC-) | 3 |
| Authored test cases (<DOM>-TC) | 24 |
| Acceptance tests (T-) | 2 |
| Backlog stories (BL-) | 5 |
| Open decisions (OD-) | 1 |
| Open questions (Q-) | 1 |
| Client requirements (R-) | 2 |
| Reference / golden data sheets | 3 |
| Capability gaps — authored (CG) | 5 |
| Frontier features — authored (FX) | 4 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-FIN-01 | [Process Specifications](FRS-FIN-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-FIN-02 | [Business Rules](FRS-FIN-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-FIN-03 | [Forms and Fields](FRS-FIN-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-FIN-04 | [Screens, Reports and UX](FRS-FIN-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-FIN-05 | [Data Model](FRS-FIN-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-FIN-06 | [State Machines and Events](FRS-FIN-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-FIN-07 | [APIs, Integrations and Agents](FRS-FIN-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-FIN-08 | [Test Cases and Acceptance](FRS-FIN-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-FIN-09 | [Backlog and Open Decisions](FRS-FIN-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-FIN-10 | [Capability Coverage and Frontier Features](FRS-FIN-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-FIN-11 | [Reference Configuration and Golden Data](FRS-FIN-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-FIN-12 | [Use Case Specifications](FRS-FIN-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-FIN-13 | [User Stories](FRS-FIN-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 50 | specified items (table rows) | Counted automatically at generation |
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
