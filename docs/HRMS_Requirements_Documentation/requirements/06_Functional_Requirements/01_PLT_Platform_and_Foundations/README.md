<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-00 — Platform & Foundations — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-00 |
| Title | Platform & Foundations — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Platform & Foundations |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `PLT` |
| Domain | Platform & Foundations |
| Scope | Tenancy, identity, scope resolution, config, workflow engine, events, audit, bi-temporal write |
| Blueprint reference | Platform (blueprint §7, §8) |
| Delivery phase(s) | P0 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-8 | GOVERN | Tenancy, identity, scope, workflow, audit, action ledger, analytics | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-12 | PLT → all | Location scope sits alongside entity and reporting line. Plant users see time, not rate. | PLT-02 | P0 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-09 | 8 | Salary processed at head office, attendance at plant, salary hidden from plant users | SEC | P1 | A group of employees has salary generated at head office while attendance is generated at the plant. Plant users must not be able to access the salary and rate structure of those employees. | Confirm the employee record carries a payroll processing location, and that role plus data scope together hide salary and rate structure from plant users — including in reports, exports and the API. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 8 |
| Process steps (DOM-nn.s) | 14 |
| Use cases (UC) | 25 |
| User stories (US) | 73 |
| Business rules (RL-nnn) | 13 |
| Client calculation rules (BS:RL-xx) | 1 |
| Forms (FRM-) | 3 |
| Form fields | 58 |
| Client form deltas (F-) | 1 |
| Client form-delta fields | 4 |
| Screens (SCR-) | 1 |
| Data objects | 14 |
| State-machine states | 0 |
| Domain events | 0 |
| APIs and agent tools | 1 |
| Integration flows | 1 |
| Agents | 0 |
| Test cases (TC-) | 2 |
| Authored test cases (<DOM>-TC) | 94 |
| Acceptance tests (T-) | 1 |
| Backlog stories (BL-) | 12 |
| Open decisions (OD-) | 4 |
| Open questions (Q-) | 0 |
| Client requirements (R-) | 1 |
| Reference / golden data sheets | 5 |
| Capability gaps — authored (CG) | 17 |
| Frontier features — authored (FX) | 7 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-PLT-01 | [Process Specifications](FRS-PLT-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-PLT-02 | [Business Rules](FRS-PLT-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-PLT-03 | [Forms and Fields](FRS-PLT-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-PLT-04 | [Screens, Reports and UX](FRS-PLT-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-PLT-05 | [Data Model](FRS-PLT-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-PLT-06 | [State Machines and Events](FRS-PLT-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-PLT-07 | [APIs, Integrations and Agents](FRS-PLT-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-PLT-08 | [Test Cases and Acceptance](FRS-PLT-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-PLT-09 | [Backlog and Open Decisions](FRS-PLT-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-PLT-10 | [Capability Coverage and Frontier Features](FRS-PLT-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-PLT-11 | [Reference Configuration and Golden Data](FRS-PLT-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-PLT-12 | [Use Case Specifications](FRS-PLT-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-PLT-13 | [User Stories](FRS-PLT-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 48 | specified items (table rows) | Counted automatically at generation |
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
