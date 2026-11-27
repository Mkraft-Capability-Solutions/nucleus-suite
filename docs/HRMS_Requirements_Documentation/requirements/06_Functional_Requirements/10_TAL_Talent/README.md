<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TAL-00 — Talent — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TAL-00 |
| Title | Talent — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Talent |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-TAL-00, FRS-TAL-01, FRS-TAL-02, FRS-TAL-03, FRS-TAL-04, FRS-TAL-05, FRS-TAL-06, FRS-TAL-07, FRS-TAL-08, FRS-TAL-09, FRS-TAL-10, FRS-TAL-11, FRS-TAL-12, FRS-TAL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-25, R-26 · processes TAL-01–TAL-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `TAL` |
| Domain | Talent |
| Scope | Requisition and position control, candidate pipeline, referrals, goals and reviews, skills and learning |
| Blueprint reference | Modules 8, 9, 10 |
| Delivery phase(s) | P2/P3 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-1 | HIRE | Sanctioned strength to requisition to candidate to offer to accepted | R2 |
| L0-6 | GROW | Goals, reviews, skills, learning, capability index, recognition | R2/R3 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-09 | TAL → PPL | A requisition consumes sanctioned strength unless it names a vacated position code. | TAL-01, PPL-04 | P3 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-25 | 24 | Recruitment — position code for a replacement | REC | P2 | A position code for replacement hiring. | Confirm a requisition can be tied to the vacated position code so headcount does not double-count. |
| R-26 | 25 | Approved manpower, department-wise | REC | P2 | Approved manpower by department. | Confirm the sanctioned strength is held per department and that a requisition beyond it is blocked or escalated. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 5 |
| Process steps (DOM-nn.s) | 7 |
| Use cases (UC) | 22 |
| User stories (US) | 49 |
| Business rules (RL-nnn) | 7 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 5 |
| Form fields | 74 |
| Client form deltas (F-) | 2 |
| Client form-delta fields | 4 |
| Screens (SCR-) | 3 |
| Data objects | 3 |
| State-machine states | 5 |
| Domain events | 1 |
| APIs and agent tools | 2 |
| Integration flows | 1 |
| Agents | 1 |
| Test cases (TC-) | 2 |
| Authored test cases (<DOM>-TC) | 76 |
| Acceptance tests (T-) | 2 |
| Backlog stories (BL-) | 4 |
| Open decisions (OD-) | 2 |
| Open questions (Q-) | 0 |
| Client requirements (R-) | 2 |
| Reference / golden data sheets | 2 |
| Capability gaps — authored (CG) | 17 |
| Frontier features — authored (FX) | 7 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-TAL-01 | [Process Specifications](FRS-TAL-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-TAL-02 | [Business Rules](FRS-TAL-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-TAL-03 | [Forms and Fields](FRS-TAL-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-TAL-04 | [Screens, Reports and UX](FRS-TAL-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-TAL-05 | [Data Model](FRS-TAL-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-TAL-06 | [State Machines and Events](FRS-TAL-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-TAL-07 | [APIs, Integrations and Agents](FRS-TAL-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-TAL-08 | [Test Cases and Acceptance](FRS-TAL-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-TAL-09 | [Backlog and Open Decisions](FRS-TAL-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-TAL-10 | [Capability Coverage and Frontier Features](FRS-TAL-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-TAL-11 | [Reference Configuration and Golden Data](FRS-TAL-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-TAL-12 | [Use Case Specifications](FRS-TAL-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-TAL-13 | [User Stories](FRS-TAL-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
