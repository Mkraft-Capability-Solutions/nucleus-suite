<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-INT-00 — Intelligence & Agents — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-INT-00 |
| Title | Intelligence & Agents — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Intelligence & Agents |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-INT-00, FRS-INT-01, FRS-INT-02, FRS-INT-03, FRS-INT-04, FRS-INT-05, FRS-INT-06, FRS-INT-07, FRS-INT-08, FRS-INT-09, FRS-INT-10, FRS-INT-11, FRS-INT-12, FRS-INT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-08 · processes INT-01–INT-04 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `INT` |
| Domain | Intelligence & Agents |
| Scope | Policy gate, tool surface, action ledger, analytics projections, predictive models |
| Blueprint reference | Blueprint §6 |
| Delivery phase(s) | P2/P3 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-8 | GOVERN | Tenancy, identity, scope, workflow, audit, action ledger, analytics | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-11 | INT → all | Every agent action passes the same permission model, approval workflow and audit trail as a human action, plus an agent identity dimension. | INT-01, PLT-06 | P2 |

## 4. Client requirements realised in this domain

_No entries in source for this scope._

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 4 |
| Process steps (DOM-nn.s) | 6 |
| Use cases (UC) | 12 |
| User stories (US) | 26 |
| Business rules (RL-nnn) | 6 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 0 |
| Form fields | 0 |
| Client form deltas (F-) | 0 |
| Client form-delta fields | 0 |
| Screens (SCR-) | 2 |
| Data objects | 0 |
| State-machine states | 6 |
| Domain events | 2 |
| APIs and agent tools | 1 |
| Integration flows | 1 |
| Agents | 9 |
| Test cases (TC-) | 0 |
| Authored test cases (<DOM>-TC) | 30 |
| Acceptance tests (T-) | 0 |
| Backlog stories (BL-) | 5 |
| Open decisions (OD-) | 0 |
| Open questions (Q-) | 0 |
| Client requirements (R-) | 0 |
| Reference / golden data sheets | 1 |
| Capability gaps — authored (CG) | 7 |
| Frontier features — authored (FX) | 7 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-INT-01 | [Process Specifications](FRS-INT-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-INT-02 | [Business Rules](FRS-INT-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-INT-03 | [Forms and Fields](FRS-INT-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-INT-04 | [Screens, Reports and UX](FRS-INT-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-INT-05 | [Data Model](FRS-INT-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-INT-06 | [State Machines and Events](FRS-INT-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-INT-07 | [APIs, Integrations and Agents](FRS-INT-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-INT-08 | [Test Cases and Acceptance](FRS-INT-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-INT-09 | [Backlog and Open Decisions](FRS-INT-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-INT-10 | [Capability Coverage and Frontier Features](FRS-INT-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-INT-11 | [Reference Configuration and Golden Data](FRS-INT-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-INT-12 | [Use Case Specifications](FRS-INT-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-INT-13 | [User Stories](FRS-INT-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 47 | specified items (table rows) | Counted automatically at generation |
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
