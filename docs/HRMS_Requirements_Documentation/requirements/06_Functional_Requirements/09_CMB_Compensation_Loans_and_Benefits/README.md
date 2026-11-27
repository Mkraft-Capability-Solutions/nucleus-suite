<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMB-00 — Compensation, Loans & Benefits — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMB-00 |
| Title | Compensation, Loans & Benefits — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compensation, Loans & Benefits |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-CMB-00, FRS-CMB-01, FRS-CMB-02, FRS-CMB-03, FRS-CMB-04, FRS-CMB-05, FRS-CMB-06, FRS-CMB-07, FRS-CMB-08, FRS-CMB-09, FRS-CMB-10, FRS-CMB-11, FRS-CMB-12, FRS-CMB-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-05 · R-10 · processes CMB-01–CMB-06 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `CMB` |
| Domain | Compensation, Loans & Benefits |
| Scope | Structures, revision cycle, loan eligibility, guarantors, sanction, recovery, EWA |
| Blueprint reference | Module 12 |
| Delivery phase(s) | P1 (loans) / P3 |

## 2. Position in the value chain

_No entries in source for this scope._

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-05 | CMB → PAY | Loan eligibility and outstanding balance are owned by CMB; payroll only recovers and reports back. | CMB-01, PAY-08 | P1 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-10 | 9 | Loan policy — one active loan, guarantor interlock, multiple-of-basic ceiling | LON | P2 | No second loan until the first is fully repaid, and no salary advance during that period. Each loan carries three guarantors: two mandatory, a third when the loan amount is higher. An employee who stands guarantor cannot take a loan himself and cannot stand guarantor again. A special-terms override is approved by a Director. The ceiling is four times basic salary, rising to six times after five years of service. | Confirm eligibility checks fire at application, the guarantor interlock is enforced both ways, and the Director override is a recorded approval rather than an edit. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 6 |
| Process steps (DOM-nn.s) | 15 |
| Use cases (UC) | 17 |
| User stories (US) | 46 |
| Business rules (RL-nnn) | 13 |
| Client calculation rules (BS:RL-xx) | 2 |
| Forms (FRM-) | 2 |
| Form fields | 30 |
| Client form deltas (F-) | 3 |
| Client form-delta fields | 14 |
| Screens (SCR-) | 1 |
| Data objects | 4 |
| State-machine states | 7 |
| Domain events | 4 |
| APIs and agent tools | 2 |
| Integration flows | 0 |
| Agents | 1 |
| Test cases (TC-) | 5 |
| Authored test cases (<DOM>-TC) | 56 |
| Acceptance tests (T-) | 3 |
| Backlog stories (BL-) | 3 |
| Open decisions (OD-) | 0 |
| Open questions (Q-) | 2 |
| Client requirements (R-) | 1 |
| Reference / golden data sheets | 3 |
| Capability gaps — authored (CG) | 11 |
| Frontier features — authored (FX) | 5 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-CMB-01 | [Process Specifications](FRS-CMB-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-CMB-02 | [Business Rules](FRS-CMB-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-CMB-03 | [Forms and Fields](FRS-CMB-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-CMB-04 | [Screens, Reports and UX](FRS-CMB-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-CMB-05 | [Data Model](FRS-CMB-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-CMB-06 | [State Machines and Events](FRS-CMB-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-CMB-07 | [APIs, Integrations and Agents](FRS-CMB-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-CMB-08 | [Test Cases and Acceptance](FRS-CMB-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-CMB-09 | [Backlog and Open Decisions](FRS-CMB-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-CMB-10 | [Capability Coverage and Frontier Features](FRS-CMB-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-CMB-11 | [Reference Configuration and Golden Data](FRS-CMB-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-CMB-12 | [Use Case Specifications](FRS-CMB-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-CMB-13 | [User Stories](FRS-CMB-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
