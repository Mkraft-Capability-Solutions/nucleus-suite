<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-00 — Leave — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-00 |
| Title | Leave — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Leave |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `LVE` |
| Domain | Leave |
| Scope | Accrual, proration, ledger, application, validation, approval, early return, comp-off, year end |
| Blueprint reference | Module 2 |
| Delivery phase(s) | P1 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-3 | WORK | Roster, punch, attendance day, leave, gate pass, overtime — the daily engine | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-02 | LVE → TIM | An approved leave day and a biometric punch on the same date is a conflict, resolved by RL-063 before disposition. | LVE-04, TIM-05 | P1 |
| S-03 | LVE → PAY | Loss of pay, encashment and re-credit all move money. The ledger is the only source. | LVE-08, PAY-04 | P1 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-06 | 5 | Early return from leave — mark present and credit the balance back | LVE | P1 | An employee applies for 10 days and returns after 6 or 7. The system marks the unused days present and credits the unused leave back. Leave passes Supervisor, then HOD, then HR Head. HR can update the leave. | Confirm the cancellation/early-return path writes both an attendance correction and a leave ledger credit, and that the three-level approval chain and the HR override are both in place. |
| R-07 | 6 | COFF lapses 60 days from the COFF date | LVE | P1 | Compensatory off auto-lapses 60 days from the date the COFF was earned. | COFF ledger needs an earned date and an expiry date, a nightly lapse job, and the lapse window held on the employee or leave scheme rather than hard-coded. |
| R-08 | 7 | Automatic leave credit — grade-based, monthly accrual, new-joiner proration | LVE | P1 | AGM and above receive 18 EL, 6 CL and 6 SL on 1 January. Everyone else receives 6 CL and 6 SL in January and 1.5 EL each month from January to December. New joiners earn no EL for six months, then receive 9 EL on completing six months. New joiner CL and SL are prorated by joining month: January 6 each; February or March 5; April or May 4; June or July 3; August or September 2; October, November or up to 4 December 1. CL cannot be taken with EL or SL and cannot be merged with them. Maximum 2 CL a month and 10 EL a month. DET and GET trainees are eligible for CL. EL is encashed at year end; CL and SL lapse. Birthday leave applies. | This is the largest single item. It needs a leave scheme with accrual rules, a proration table, a combination-restriction matrix, per-month caps, a trainee eligibility flag, and year-end encashment and lapse processing. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 8 |
| Process steps (DOM-nn.s) | 29 |
| Use cases (UC) | 15 |
| User stories (US) | 40 |
| Business rules (RL-nnn) | 26 |
| Client calculation rules (BS:RL-xx) | 10 |
| Forms (FRM-) | 4 |
| Form fields | 72 |
| Client form deltas (F-) | 7 |
| Client form-delta fields | 27 |
| Screens (SCR-) | 3 |
| Data objects | 7 |
| State-machine states | 8 |
| Domain events | 4 |
| APIs and agent tools | 3 |
| Integration flows | 0 |
| Agents | 1 |
| Test cases (TC-) | 10 |
| Authored test cases (<DOM>-TC) | 34 |
| Acceptance tests (T-) | 10 |
| Backlog stories (BL-) | 6 |
| Open decisions (OD-) | 1 |
| Open questions (Q-) | 6 |
| Client requirements (R-) | 3 |
| Reference / golden data sheets | 11 |
| Capability gaps — authored (CG) | 7 |
| Frontier features — authored (FX) | 5 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-LVE-01 | [Process Specifications](FRS-LVE-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-LVE-02 | [Business Rules](FRS-LVE-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-LVE-03 | [Forms and Fields](FRS-LVE-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-LVE-04 | [Screens, Reports and UX](FRS-LVE-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-LVE-05 | [Data Model](FRS-LVE-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-LVE-06 | [State Machines and Events](FRS-LVE-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-LVE-07 | [APIs, Integrations and Agents](FRS-LVE-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-LVE-08 | [Test Cases and Acceptance](FRS-LVE-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-LVE-09 | [Backlog and Open Decisions](FRS-LVE-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-LVE-10 | [Capability Coverage and Frontier Features](FRS-LVE-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-LVE-11 | [Reference Configuration and Golden Data](FRS-LVE-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-LVE-12 | [Use Case Specifications](FRS-LVE-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-LVE-13 | [User Stories](FRS-LVE-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
