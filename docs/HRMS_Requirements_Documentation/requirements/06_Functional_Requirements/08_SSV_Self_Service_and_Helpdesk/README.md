<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-SSV-00 — Self-service & Helpdesk — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-SSV-00 |
| Title | Self-service & Helpdesk — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Self-service & Helpdesk |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-SSV-00, FRS-SSV-01, FRS-SSV-02, FRS-SSV-03, FRS-SSV-04, FRS-SSV-05, FRS-SSV-06, FRS-SSV-07, FRS-SSV-08, FRS-SSV-09, FRS-SSV-10, FRS-SSV-11, FRS-SSV-12, FRS-SSV-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-03 · processes SSV-01–SSV-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `SSV` |
| Domain | Self-service & Helpdesk |
| Scope | Employee and manager surfaces, business messaging channel, tickets, grounded policy assistant |
| Blueprint reference | Modules 4, 7 |
| Delivery phase(s) | P1/P2 |

## 2. Position in the value chain

_No entries in source for this scope._

## 3. Seams with other domains

_No entries in source for this scope._

## 4. Client requirements realised in this domain

_No entries in source for this scope._

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 5 |
| Process steps (DOM-nn.s) | 7 |
| Use cases (UC) | 12 |
| User stories (US) | 29 |
| Business rules (RL-nnn) | 7 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 1 |
| Form fields | 13 |
| Client form deltas (F-) | 0 |
| Client form-delta fields | 0 |
| Screens (SCR-) | 3 |
| Data objects | 0 |
| State-machine states | 0 |
| Domain events | 0 |
| APIs and agent tools | 1 |
| Integration flows | 1 |
| Agents | 3 |
| Test cases (TC-) | 0 |
| Authored test cases (<DOM>-TC) | 34 |
| Acceptance tests (T-) | 0 |
| Backlog stories (BL-) | 4 |
| Open decisions (OD-) | 1 |
| Open questions (Q-) | 0 |
| Client requirements (R-) | 0 |
| Reference / golden data sheets | 1 |
| Capability gaps — authored (CG) | 7 |
| Frontier features — authored (FX) | 5 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-SSV-01 | [Process Specifications](FRS-SSV-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-SSV-02 | [Business Rules](FRS-SSV-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-SSV-03 | [Forms and Fields](FRS-SSV-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-SSV-04 | [Screens, Reports and UX](FRS-SSV-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-SSV-05 | [Data Model](FRS-SSV-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-SSV-06 | [State Machines and Events](FRS-SSV-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-SSV-07 | [APIs, Integrations and Agents](FRS-SSV-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-SSV-08 | [Test Cases and Acceptance](FRS-SSV-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-SSV-09 | [Backlog and Open Decisions](FRS-SSV-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-SSV-10 | [Capability Coverage and Frontier Features](FRS-SSV-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-SSV-11 | [Reference Configuration and Golden Data](FRS-SSV-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-SSV-12 | [Use Case Specifications](FRS-SSV-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-SSV-13 | [User Stories](FRS-SSV-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
