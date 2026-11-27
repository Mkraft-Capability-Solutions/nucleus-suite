<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-00 — Time & Attendance — Domain Overview

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-00 |
| Title | Time & Attendance — Domain Overview |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, PLAN |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 02_Process_Architecture, 03_Process_Inventory<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 01_Requirement_Register, 02_Module_Index |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Domain scope

| Attribute | Value |
| :--- | :--- |
| Domain code | `TIM` |
| Domain | Time & Attendance |
| Scope | Ingestion, day derivation, shift inference, disposition, gate pass, overtime, regularisation, recompute |
| Blueprint reference | Module 2 |
| Delivery phase(s) | P1 |

## 2. Position in the value chain

| L0 ID | Stage | Scope | Tier |
| :--- | :--- | :--- | :--- |
| L0-3 | WORK | Roster, punch, attendance day, leave, gate pass, overtime — the daily engine | R1 |

## 3. Seams with other domains

| Seam | Direction | What must hold | Processes | Phase |
| :--- | :--- | :--- | :--- | :--- |
| S-01 | TIM → PAY | attendance_day totals and disposition are payroll inputs. A late recompute after INPUTS_LOCKED must raise an exception, never silently change a locked run. | TIM-09, PAY-02 | P1 |
| S-02 | LVE → TIM | An approved leave day and a biometric punch on the same date is a conflict, resolved by RL-063 before disposition. | LVE-04, TIM-05 | P1 |
| S-04 | PPL → TIM | worker_class and its assignment-level overrides supply rest days, wage type and OT eligibility as at the attendance date, read bi-temporally. | PPL-03, TIM-04 | P1 |

## 4. Client requirements realised in this domain

| Req ID | Source point | Requirement | Module | Priority | What is asked | What it changes in Nucleus |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-01 | 1 | Multi-punch work hours across midnight, with break captured separately | ATT | P1 | An employee punches in 08:00, out 20:30, in again 21:15, out 03:20 next day against a 12-hour shift (08:00–20:00). Total work hours are first-in to last-out — 19h20m. The 20:30–21:15 gap is a 45-minute dinner break reported separately. OT is 7h20m, which is total hours less shift hours. | Work-hour engine must pair punches across a calendar date boundary, derive intermediate breaks as the gaps between an OUT and the next IN, and compute OT on gross hours. A break register report is new. |
| R-02 | 1 | Team Calendar — date-range history and report for a manager's own team | ATT | P1 | From the remark on point 1: a manager needs a date-wise filter on Team Calendar, start and end date as a range, to see the history of an individual team member and produce a report. | Team Calendar gets a from/to date range, an employee selector scoped to the reporting line, and an export. |
| R-11 | 10 | OT is generated and paid after salary generation, in a separate run | OTM | P1 | OT is not paid along with salary. It is generated and paid after the salary run. | Confirm OT has its own payment run, its own period, and its own posting, and that it cannot be pulled into the salary run. |
| R-12 | 11 | Personal gate pass — 4 hours a month, maximum two passes, added to work hours | GPS | P2 | An employee is entitled to four hours of personal gate pass a month, taken as one pass of four hours or two of two hours. Not more than two passes are allowed. Approved gate pass time is added to work hours. | Confirm the monthly entitlement, the pass-count cap and the work-hour credit on approval. |
| R-13 | 12 | Attendance thresholds by shift length, grace period and late-mark rules | SHF | P1 | Half-day and absent thresholds by shift: 12-hour shift, half day under 11:30 and absent under 6:30; 10-hour, under 9:30 and 6:00; 9-hour, under 8:30 and 5:00; 8-hour, under 7:30 and 4:30. Fifteen minutes of in and out grace, allowed three times a month; from the fourth late beyond grace the day is a half day. Assistant Manager and above are not affected by the grace deduction. An employee on A shift who works until 03:00 or 04:00 may come in at 09:00 or 09:30 the next day, work till 20:00 and still be paid a full day. | Confirm the thresholds are configuration on the shift master rather than code, that the late counter resets monthly, that the designation exemption is data-driven, and that the night-extension rule exists at all. |
| R-14 | 13 | Auto shift detection from the in-punch time | SHF | P1 | An employee assigned to A shift may come in on B shift. The system should capture the shift automatically from the in-punch time. | Confirm each shift has a detection window, that windows do not overlap, and that the detected shift overrides the rostered shift with the change recorded. |

## 5. Requirement inventory

| Artefact | Count |
| :--- | ---: |
| Processes (DOM-nn) | 10 |
| Process steps (DOM-nn.s) | 56 |
| Use cases (UC) | 19 |
| User stories (US) | 66 |
| Business rules (RL-nnn) | 55 |
| Client calculation rules (BS:RL-xx) | 10 |
| Forms (FRM-) | 8 |
| Form fields | 107 |
| Client form deltas (F-) | 12 |
| Client form-delta fields | 62 |
| Screens (SCR-) | 8 |
| Data objects | 20 |
| State-machine states | 4 |
| Domain events | 8 |
| APIs and agent tools | 6 |
| Integration flows | 1 |
| Agents | 1 |
| Test cases (TC-) | 19 |
| Authored test cases (<DOM>-TC) | 56 |
| Acceptance tests (T-) | 10 |
| Backlog stories (BL-) | 11 |
| Open decisions (OD-) | 4 |
| Open questions (Q-) | 4 |
| Client requirements (R-) | 6 |
| Reference / golden data sheets | 12 |
| Capability gaps — authored (CG) | 9 |
| Frontier features — authored (FX) | 6 |

## 6. Document map

| Doc ID | Document | Content |
| :--- | :--- | :--- |
| FRS-TIM-01 | [Process Specifications](FRS-TIM-01_Process_Specifications.md) | Process inventory, step flows (Mermaid), swimlanes, approval workflows |
| FRS-TIM-02 | [Business Rules](FRS-TIM-02_Business_Rules.md) | RL-nnn rules and client calculation rules with worked examples |
| FRS-TIM-03 | [Forms and Fields](FRS-TIM-03_Forms_and_Fields.md) | Every form and field, picklists, menu path and CRUD endpoint |
| FRS-TIM-04 | [Screens, Reports and UX](FRS-TIM-04_Screens_Reports_and_UX.md) | Screens, personas, permission scope, offline, reports |
| FRS-TIM-05 | [Data Model](FRS-TIM-05_Data_Model.md) | Objects, ER diagram, enumerations |
| FRS-TIM-06 | [State Machines and Events](FRS-TIM-06_State_Machines_and_Events.md) | Lifecycle state diagrams, guards, domain events |
| FRS-TIM-07 | [APIs, Integrations and Agents](FRS-TIM-07_APIs_Integrations_and_Agents.md) | REST, governed tools, integration flows, agents |
| FRS-TIM-08 | [Test Cases and Acceptance](FRS-TIM-08_Test_Cases_and_Acceptance.md) | Golden and property tests, client acceptance tests |
| FRS-TIM-09 | [Backlog and Open Decisions](FRS-TIM-09_Backlog_and_Open_Decisions.md) | Build backlog, open decisions and questions |
| FRS-TIM-10 | [Capability Coverage and Frontier Features](FRS-TIM-10_Capability_Coverage_and_Frontier_Features.md) | Specified capabilities, capability gaps, frontier features |
| FRS-TIM-11 | [Reference Configuration and Golden Data](FRS-TIM-11_Reference_Configuration_and_Golden_Data.md) | Configuration register and golden reference data |
| FRS-TIM-12 | [Use Case Specifications](FRS-TIM-12_Use_Case_Specifications.md) | Formal use cases with diagrams and flows |
| FRS-TIM-13 | [User Stories](FRS-TIM-13_User_Stories.md) | User stories with Given / When / Then acceptance criteria |

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
| Size | 55 | specified items (table rows) | Counted automatically at generation |
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
