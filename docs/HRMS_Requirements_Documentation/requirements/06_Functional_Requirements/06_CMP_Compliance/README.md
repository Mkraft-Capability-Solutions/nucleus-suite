<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-00 — Compliance — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-00 |
| Title | Compliance — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compliance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `CMP` |
| Domain | Compliance |
| Scope | Rule packs, obligation calendar, statutory forms and registers, Labour Codes simulation, AI and DPDP governance |
| Blueprint reference | Module 6 |
| Delivery phase(s) | P1/P2 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-2 | ONBOARD | Offer accepted to person, assignment, statutory registration, forms, assets, induction | R1 |
| L0-5 | COMPLY | Rule packs, obligations, returns, registers, statutory forms, AI and data governance | R1 |

## 3. Seams with other domains

_No entries in source for this scope._

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-18 | 17 | Statutory compliance — Factory Act forms and returns | STA | P1 | All applicable statutory compliance under the relevant act, naming Form 28, Form 18 and Form 36 among others, and the returns. | Confirm which forms are built, that the state variant is correct, and that each is generated from live data rather than typed. |
| R-27 | 26 | Joining form under the Factory Act — Form F | STA | P1 | A joining form as required by the Factory Act, named as Form F. | Form F has to be generated from the employee record at joining. Ownership moves to the HR product owner. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 6 |
| Process steps (DOM-nn.s) | 12 |
| Use cases (UC) | 15 |
| User stories (US) | 41 |
| Business rules (RL-nnn) | 12 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 1 |
| Form fields | 12 |
| Client form deltas (F-) | 2 |
| Client form-delta fields | 10 |
| Screens (SCR-) | 4 |
| Data objects | 6 |
| State-machine states | 6 |
| Domain events | 3 |
| APIs and agent tools | 2 |
| Integration flows | 1 |
| Agents | 1 |
| Test cases (TC-) | 1 |
| Authored test cases (<DOM>-TC) | 46 |
| Acceptance tests (T-) | 2 |
| Backlog stories (BL-) | 6 |
| Open decisions (OD-) | 3 |
| Open questions (Q-) | 1 |
| Client requirements (R-) | 2 |
| Reference / golden data sheets | 2 |
| Capability gaps — authored (CG) | 9 |
| Frontier features — authored (FX) | 4 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-CMP-01 | [Process Specifications](FRS-CMP-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-CMP-02 | [Business Rules](FRS-CMP-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-CMP-03 | [Forms and Fields](FRS-CMP-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-CMP-04 | [Screens, Reports and UX](FRS-CMP-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-CMP-05 | [Data Model](FRS-CMP-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-CMP-06 | [State Machines and Events](FRS-CMP-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-CMP-07 | [APIs, Integrations and Agents](FRS-CMP-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-CMP-08 | [Test Cases and Acceptance](FRS-CMP-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-CMP-09 | [Backlog and Open Decisions](FRS-CMP-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-CMP-10 | [Capability Coverage and Frontier Features](FRS-CMP-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-CMP-11 | [Reference Configuration and Golden Data](FRS-CMP-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-CMP-12 | [Use Case Specifications](FRS-CMP-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-CMP-13 | [User Stories](FRS-CMP-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 49 | specified items (table rows) | Counted automatically at generation |
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
