<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CTG-00 — Contingent Workforce — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CTG-00 |
| Title | Contingent Workforce — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Contingent Workforce |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-CTG-00, FRS-CTG-01, FRS-CTG-02, FRS-CTG-03, FRS-CTG-04, FRS-CTG-05, FRS-CTG-06, FRS-CTG-07, FRS-CTG-08, FRS-CTG-09, FRS-CTG-10, FRS-CTG-11, FRS-CTG-12, FRS-CTG-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · processes CTG-01–CTG-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `CTG` |
| Domain | Contingent Workforce |
| Scope | Contractor engagement, sub-populations by worker class, gate attendance, invoice reconciliation |
| Blueprint reference | Module 13 |
| Delivery phase(s) | P2/P3 |

## 2. Position in the value chain

_No entries in source for this scope._

## 3. Seams with other domains

_No entries in source for this scope._

## 4. Client requirements realised in this domain

_No entries in source for this scope._

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 3 |
| Process steps (DOM-nn.s) | 3 |
| Use cases (UC) | 8 |
| User stories (US) | 24 |
| Business rules (RL-nnn) | 3 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 2 |
| Form fields | 24 |
| Client form deltas (F-) | 0 |
| Client form-delta fields | 0 |
| Screens (SCR-) | 1 |
| Data objects | 2 |
| State-machine states | 0 |
| Domain events | 0 |
| APIs and agent tools | 0 |
| Integration flows | 1 |
| Agents | 0 |
| Test cases (TC-) | 0 |
| Authored test cases (<DOM>-TC) | 30 |
| Acceptance tests (T-) | 0 |
| Backlog stories (BL-) | 1 |
| Open decisions (OD-) | 0 |
| Open questions (Q-) | 0 |
| Client requirements (R-) | 0 |
| Reference / golden data sheets | 2 |
| Capability gaps — authored (CG) | 5 |
| Frontier features — authored (FX) | 4 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-CTG-01 | [Process Specifications](FRS-CTG-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-CTG-02 | [Business Rules](FRS-CTG-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-CTG-03 | [Forms and Fields](FRS-CTG-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-CTG-04 | [Screens, Reports and UX](FRS-CTG-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-CTG-05 | [Data Model](FRS-CTG-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-CTG-06 | [State Machines and Events](FRS-CTG-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-CTG-07 | [APIs, Integrations and Agents](FRS-CTG-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-CTG-08 | [Test Cases and Acceptance](FRS-CTG-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-CTG-09 | [Backlog and Open Decisions](FRS-CTG-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-CTG-10 | [Capability Coverage and Frontier Features](FRS-CTG-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-CTG-11 | [Reference Configuration and Golden Data](FRS-CTG-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-CTG-12 | [Use Case Specifications](FRS-CTG-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-CTG-13 | [User Stories](FRS-CTG-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 45 | specified items (table rows) | Counted automatically at generation |
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
