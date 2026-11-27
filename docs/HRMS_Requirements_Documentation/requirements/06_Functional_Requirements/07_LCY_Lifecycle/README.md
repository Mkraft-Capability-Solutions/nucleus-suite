<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-00 — Lifecycle — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-00 |
| Title | Lifecycle — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Lifecycle |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `LCY` |
| Domain | Lifecycle |
| Scope | Pre-boarding, joining, confirmation, promotion, transfer, resignation, clearance, F&F, assets |
| Blueprint reference | Module 5 |
| Delivery phase(s) | P1 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-2 | ONBOARD | Offer accepted to person, assignment, statutory registration, forms, assets, induction | R1 |
| L0-7 | EXIT | Resignation, notice, clearance, F&F on the last working day, alumni record | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-08 | LCY → PAY | Clearance blocking items gate the F&F run using the same lock semantics as the payroll input lock. | LCY-06, PAY-12 | P1 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-17 | 16 | Full and final settlement on the same day, gated by no-dues | FNF | P1 | F&F should be generated on the same day, through a no-dues process. The remark records two things: a clearance checklist has to be added, and a bug that prevents the record from saving has to be investigated. | A no-dues clearance checklist with a department-wise sign-off, and the save defect on the existing F&F form. |
| R-24 | 23 | Induction training at joining, and asset issue | ONB | P2 | Induction training at the time of joining, and asset issue. | Confirm the induction checklist and asset allocation are part of the joining flow and block confirmation until complete. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 8 |
| Process steps (DOM-nn.s) | 13 |
| Use cases (UC) | 16 |
| User stories (US) | 40 |
| Business rules (RL-nnn) | 12 |
| Client calculation rules (BS:RL-xx) | 1 |
| Forms (FRM-) | 4 |
| Form fields | 51 |
| Client form deltas (F-) | 4 |
| Client form-delta fields | 16 |
| Screens (SCR-) | 3 |
| Data objects | 2 |
| State-machine states | 6 |
| Domain events | 2 |
| APIs and agent tools | 0 |
| Integration flows | 2 |
| Agents | 0 |
| Test cases (TC-) | 2 |
| Authored test cases (<DOM>-TC) | 40 |
| Acceptance tests (T-) | 2 |
| Backlog stories (BL-) | 4 |
| Open decisions (OD-) | 1 |
| Open questions (Q-) | 1 |
| Client requirements (R-) | 2 |
| Reference / golden data sheets | 5 |
| Capability gaps — authored (CG) | 8 |
| Frontier features — authored (FX) | 4 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-LCY-01 | [Process Specifications](FRS-LCY-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-LCY-02 | [Business Rules](FRS-LCY-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-LCY-03 | [Forms and Fields](FRS-LCY-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-LCY-04 | [Screens, Reports and UX](FRS-LCY-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-LCY-05 | [Data Model](FRS-LCY-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-LCY-06 | [State Machines and Events](FRS-LCY-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-LCY-07 | [APIs, Integrations and Agents](FRS-LCY-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-LCY-08 | [Test Cases and Acceptance](FRS-LCY-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-LCY-09 | [Backlog and Open Decisions](FRS-LCY-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-LCY-10 | [Capability Coverage and Frontier Features](FRS-LCY-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-LCY-11 | [Reference Configuration and Golden Data](FRS-LCY-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-LCY-12 | [Use Case Specifications](FRS-LCY-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-LCY-13 | [User Stories](FRS-LCY-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
