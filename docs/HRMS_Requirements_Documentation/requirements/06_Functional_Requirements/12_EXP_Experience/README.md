<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-EXP-00 — Experience — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-EXP-00 |
| Title | Experience — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Experience |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-EXP-00, FRS-EXP-01, FRS-EXP-02, FRS-EXP-03, FRS-EXP-04, FRS-EXP-05, FRS-EXP-06, FRS-EXP-07, FRS-EXP-08, FRS-EXP-09, FRS-EXP-10, FRS-EXP-11, FRS-EXP-12, FRS-EXP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-19, R-20, R-21, R-22 · processes EXP-01–EXP-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `EXP` |
| Domain | Experience |
| Scope | Recognition, referral awards, announcements, letters and the issue register |
| Blueprint reference | Module 15 |
| Delivery phase(s) | P2 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-6 | GROW | Goals, reviews, skills, learning, capability index, recognition | R2/R3 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-10 | EXP → PAY | Recognition and referral awards raise a payroll input in a named run, never a side payment. | EXP-01, PAY-01 | P2 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-19 | 18 | Star employees | ENG | P3 | A star employee process. | Confirm nomination, selection and publication exist and feed the announcement. |
| R-20 | 19 | Referral process and awards | ENG | P3 | An employee referral process with awards. | Confirm referral capture through to award payout, and where the payout posts. |
| R-21 | 20 | Announcements — birthday, star employee, new joiner, referral, management messages | ENG | P3 | Announcements covering birthdays, star employees, new joiners, referrals and other management messages. | Confirm the announcement types, the audience targeting and the delivery channels. |
| R-22 | 21 | Appointment letter and other HR letters | DOC | P3 | Appointment letters and other letters related to HR. | Confirm the template library, the merge fields and the issue record. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 3 |
| Process steps (DOM-nn.s) | 8 |
| Use cases (UC) | 9 |
| User stories (US) | 20 |
| Business rules (RL-nnn) | 6 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 3 |
| Form fields | 35 |
| Client form deltas (F-) | 4 |
| Client form-delta fields | 16 |
| Screens (SCR-) | 3 |
| Data objects | 6 |
| State-machine states | 0 |
| Domain events | 2 |
| APIs and agent tools | 1 |
| Integration flows | 1 |
| Agents | 1 |
| Test cases (TC-) | 1 |
| Authored test cases (<DOM>-TC) | 26 |
| Acceptance tests (T-) | 4 |
| Backlog stories (BL-) | 1 |
| Open decisions (OD-) | 0 |
| Open questions (Q-) | 0 |
| Client requirements (R-) | 4 |
| Reference / golden data sheets | 3 |
| Capability gaps — authored (CG) | 6 |
| Frontier features — authored (FX) | 4 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-EXP-01 | [Process Specifications](FRS-EXP-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-EXP-02 | [Business Rules](FRS-EXP-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-EXP-03 | [Forms and Fields](FRS-EXP-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-EXP-04 | [Screens, Reports and UX](FRS-EXP-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-EXP-05 | [Data Model](FRS-EXP-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-EXP-06 | [State Machines and Events](FRS-EXP-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-EXP-07 | [APIs, Integrations and Agents](FRS-EXP-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-EXP-08 | [Test Cases and Acceptance](FRS-EXP-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-EXP-09 | [Backlog and Open Decisions](FRS-EXP-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-EXP-10 | [Capability Coverage and Frontier Features](FRS-EXP-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-EXP-11 | [Reference Configuration and Golden Data](FRS-EXP-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-EXP-12 | [Use Case Specifications](FRS-EXP-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-EXP-13 | [User Stories](FRS-EXP-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 51 | specified items (table rows) | Counted automatically at generation |
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
