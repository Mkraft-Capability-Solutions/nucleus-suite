<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-00 — Payroll — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-00 |
| Title | Payroll — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `PAY` |
| Domain | Payroll |
| Scope | Run types, snapshot, pre-audit, gross-to-net DAG, statutory, recovery, disbursement, payslip, rollback |
| Blueprint reference | Module 3 |
| Delivery phase(s) | P1 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-4 | PAY | Inputs locked, audited, computed, approved, disbursed, posted, reconciled | R1 |
| L0-7 | EXIT | Resignation, notice, clearance, F&F on the last working day, alumni record | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-01 | TIM → PAY | attendance_day totals and disposition are payroll inputs. A late recompute after INPUTS_LOCKED must raise an exception, never silently change a locked run. | TIM-09, PAY-02 | P1 |
| S-03 | LVE → PAY | Loss of pay, encashment and re-credit all move money. The ledger is the only source. | LVE-08, PAY-04 | P1 |
| S-05 | CMB → PAY | Loan eligibility and outstanding balance are owned by CMB; payroll only recovers and reports back. | CMB-01, PAY-08 | P1 |
| S-06 | PAY → FIN | One balanced, dimensioned journal per run per entity. Run type is a journal dimension. | PAY-09, FIN-03 | P1 |
| S-08 | LCY → PAY | Clearance blocking items gate the F&F run using the same lock semantics as the payroll input lock. | LCY-06, PAY-12 | P1 |
| S-10 | EXP → PAY | Recognition and referral awards raise a payroll input in a named run, never a side payment. | EXP-01, PAY-01 | P2 |

## 4. Client requirements realised in this domain

_No entries in source for this scope._

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 14 |
| Process steps (DOM-nn.s) | 42 |
| Use cases (UC) | 25 |
| User stories (US) | 58 |
| Business rules (RL-nnn) | 42 |
| Client calculation rules (BS:RL-xx) | 0 |
| Forms (FRM-) | 8 |
| Form fields | 157 |
| Client form deltas (F-) | 2 |
| Client form-delta fields | 0 |
| Screens (SCR-) | 7 |
| Data objects | 11 |
| State-machine states | 10 |
| Domain events | 9 |
| APIs and agent tools | 5 |
| Integration flows | 2 |
| Agents | 1 |
| Test cases (TC-) | 8 |
| Authored test cases (<DOM>-TC) | 54 |
| Acceptance tests (T-) | 0 |
| Backlog stories (BL-) | 9 |
| Open decisions (OD-) | 1 |
| Open questions (Q-) | 0 |
| Client requirements (R-) | 0 |
| Reference / golden data sheets | 6 |
| Capability gaps — authored (CG) | 11 |
| Frontier features — authored (FX) | 7 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-PAY-01 | [Process Specifications](FRS-PAY-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-PAY-02 | [Business Rules](FRS-PAY-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-PAY-03 | [Forms and Fields](FRS-PAY-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-PAY-04 | [Screens, Reports and UX](FRS-PAY-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-PAY-05 | [Data Model](FRS-PAY-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-PAY-06 | [State Machines and Events](FRS-PAY-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-PAY-07 | [APIs, Integrations and Agents](FRS-PAY-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-PAY-08 | [Test Cases and Acceptance](FRS-PAY-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-PAY-09 | [Backlog and Open Decisions](FRS-PAY-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-PAY-10 | [Capability Coverage and Frontier Features](FRS-PAY-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-PAY-11 | [Reference Configuration and Golden Data](FRS-PAY-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-PAY-12 | [Use Case Specifications](FRS-PAY-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-PAY-13 | [User Stories](FRS-PAY-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 53 | specified items (table rows) | Counted automatically at generation |
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
