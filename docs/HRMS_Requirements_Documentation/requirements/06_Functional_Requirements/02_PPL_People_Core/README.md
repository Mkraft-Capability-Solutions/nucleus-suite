<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-00 — People Core — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-00 |
| Title | People Core — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — People Core |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `PPL` |
| Domain | People Core |
| Scope | Person, position, assignment, employment, org unit, worker class, documents, position control |
| Blueprint reference | Module 1 |
| Delivery phase(s) | P0/P1 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-1 | HIRE | Sanctioned strength to requisition to candidate to offer to accepted | R2 |
| L0-2 | ONBOARD | Offer accepted to person, assignment, statutory registration, forms, assets, induction | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-04 | PPL → TIM | worker_class and its assignment-level overrides supply rest days, wage type and OT eligibility as at the attendance date, read bi-temporally. | PPL-03, TIM-04 | P1 |
| S-07 | FIN → PPL | ERP-owned master fields are read-only in Nucleus. The ownership map is the referee. | FIN-01, PPL-02 | P1 |
| S-09 | TAL → PPL | A requisition consumes sanctioned strength unless it names a vacated position code. | TAL-01, PPL-04 | P3 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-03 | 2 | Contractual employees have no rest days and are paid daily wages | EMP | P1 | Contractual employees are not entitled to rest days; they are paid daily wages. | Employee Master needs rest-day applicability and wage basis, and attendance must not generate a weekly off for these employees. |
| R-04 | 3 | Third-party group — Employees get rest days, Helpers do not | EMP | P1 | Within the third-party population, the Employee sub-category is entitled to rest days and the Helper sub-category is not. | Rest-day applicability must resolve at employee sub-category level, not just employment type. |
| R-05 | 4 | Some employees receive OT only on rest days or holidays | EMP | P1 | Certain employees earn OT only for hours worked on a rest day or a holiday, not on ordinary working days. | Employee Master needs an OT eligibility basis that the OT computation reads before generating any OT line. |
| R-23 | 22 | Organisation chart and department-wise hierarchy | ORG | P3 | An organisation chart with department-wise hierarchy. | Confirm the chart is generated from the reporting relationship on the employee record, not maintained separately. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 8 |
| Process steps (DOM-nn.s) | 24 |
| Use cases (UC) | 18 |
| User stories (US) | 50 |
| Business rules (RL-nnn) | 23 |
| Client calculation rules (BS:RL-xx) | 2 |
| Forms (FRM-) | 6 |
| Form fields | 210 |
| Client form deltas (F-) | 5 |
| Client form-delta fields | 53 |
| Screens (SCR-) | 6 |
| Data objects | 16 |
| State-machine states | 0 |
| Domain events | 4 |
| APIs and agent tools | 4 |
| Integration flows | 2 |
| Agents | 4 |
| Test cases (TC-) | 0 |
| Authored test cases (<DOM>-TC) | 52 |
| Acceptance tests (T-) | 4 |
| Backlog stories (BL-) | 4 |
| Open decisions (OD-) | 1 |
| Open questions (Q-) | 1 |
| Client requirements (R-) | 4 |
| Reference / golden data sheets | 8 |
| Capability gaps — authored (CG) | 10 |
| Frontier features — authored (FX) | 6 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-PPL-01 | [Process Specifications](FRS-PPL-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-PPL-02 | [Business Rules](FRS-PPL-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-PPL-03 | [Forms and Fields](FRS-PPL-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-PPL-04 | [Screens, Reports and UX](FRS-PPL-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-PPL-05 | [Data Model](FRS-PPL-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-PPL-06 | [State Machines and Events](FRS-PPL-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-PPL-07 | [APIs, Integrations and Agents](FRS-PPL-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-PPL-08 | [Test Cases and Acceptance](FRS-PPL-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-PPL-09 | [Backlog and Open Decisions](FRS-PPL-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-PPL-10 | [Capability Coverage and Frontier Features](FRS-PPL-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-PPL-11 | [Reference Configuration and Golden Data](FRS-PPL-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-PPL-12 | [Use Case Specifications](FRS-PPL-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-PPL-13 | [User Stories](FRS-PPL-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 54 | specified items (table rows) | Counted automatically at generation |
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
