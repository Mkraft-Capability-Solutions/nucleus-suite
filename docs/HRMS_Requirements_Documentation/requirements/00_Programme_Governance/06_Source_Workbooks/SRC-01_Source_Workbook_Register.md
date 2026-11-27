<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# SRC-01 — Source Workbook Register

| Attribute | Value |
| :--- | :--- |
| Document ID | SRC-01 |
| Title | Source Workbook Register |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Configuration Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | CM, RDM |
| Related documents | DOC-02, CM-01, TR-04 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0<br>Nucleus HRMS — Complete Forms & Fields Specification v1.0<br>Nucleus HR Demo Points Build Sheet v1.0<br>Nucleus HRMS Demo Dataset v1.1<br>HR Demo Points (client tracker)<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Controlled source workbooks (configuration items under CM-01). A change to any of them follows CM-02, and every dependent requirement document is updated in the same change.

| Code | Workbook | File | Sheets |
| :--- | :--- | :--- | ---: |
| P | Nucleus — Process Flows & Process Maps v1.0 | `data-form-process-sheets/Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx` | 23 |
| F | Nucleus HRMS — Complete Forms & Fields Specification v1.0 | `data-form-process-sheets/Nucleus_Forms_and_Fields_Complete_MKraft.xlsx` | 4 |
| B | Nucleus HR Demo Points Build Sheet v1.0 | `data-form-process-sheets/Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx` | 12 |
| D | Nucleus HRMS Demo Dataset v1.1 | `data-form-process-sheets/Nucleus_HRMS_Demo_Dataset_v1_1.xlsx` | 71 |
| H | HR Demo Points (client tracker) | `data-form-process-sheets/HR Demo Points.xlsx` | 1 |
| C | Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) | `data-form-process-sheets/Field_Spec_Impl_Path.csv` | 1 |

`parsed_forms_spec.json` in the same folder is a machine-readable derivative of the Forms & Fields workbook and is not a separate source of record.

## Process workbook — read-me and conventions

| Topic | Detail |
| :--- | :--- |
| NUCLEUS — PROCESS FLOWS & PROCESS MAPS |  |
| Nucleus HRMS · Process Flows & Process Maps v1.0 · aligned to Blueprint v1.1 and Demo Dataset v1.0 · MKraft Capability Solutions LLP · Confidential |  |
| Topic | Detail |
| PURPOSE |  |
| What this workbook is | The build-side companion to the Nucleus Technical & Functional Blueprint v1.1 and the Nucleus HRMS Demo Dataset v1.0. It converts the blueprint's prose specification into process flows, process maps, field-level data and form definitions, rule registries, state machines and a build sequence that a product manager, a developer or a QA engineer can work from without re-reading either source document. |
| What it is not | It does not restate the blueprint's reasoning, market benchmark or architecture rationale. Where a decision is already argued in the blueprint, this workbook cites the section and moves on. Both source documents remain intact and authoritative. |
| Relationship to the two source files | Blueprint v1.1 = the WHAT and WHY. This workbook = the HOW, in sequence, with every field and form named. Demo Dataset v1.0 = the worked example and the expected results. Every process step, rule and field in here carries a pointer back to one or both. |
| HOW TO USE IT |  |
| Product managers | Start at 02_Process_Architecture, then 03_Process_Inventory. Use 17_Traceability to prove demo coverage and 18_Build_Backlog to sequence a sprint. Open decisions that block work are on 22_Open_Decisions. |
| Developers | Start at 04_Process_Steps for the process you are building, then 06_Data_Dictionary for the objects it touches, 09_Business_Rules for the rule IDs its steps cite, and 11_State_Machines for the transitions you must guard. Check 16_Reuse_Register BEFORE writing anything that looks like an approval chain, a ledger, an eligibility check, a template render or a recompute. |
| Designers / front end | 07_Screens and 08_Form_Fields carry every screen, every field, its validation and its persona. 21_Roles_and_RACI carries who sees what. |
| QA | 19_Test_Cases is seeded from the demo dataset's expected results. Every golden case names the employee record and the date from the dataset so the expected value is not invented here. |
| ID CONVENTIONS |  |
| Process ID | DOM-nn, e.g. TIM-02. Domain prefixes are listed on 02_Process_Architecture. |
| Step ID | DOM-nn.s, e.g. TIM-02.4 is step 4 of process TIM-02. |
| Rule ID | RL-nnn on 09_Business_Rules. Cited by process steps and by test cases. |
| Object / field | snake_case, matching the blueprint's object names exactly (person, assignment, attendance_day, leave_ledger...). |
| Screen ID | SCR-nnn on 07_Screens. Form field rows on 08_Form_Fields reference the screen ID. |
| Event | domain.object.verb, past tense, e.g. time.attendance_day.recomputed. |
| Component ID | CMP-nn on 16_Reuse_Register — a shared component built once and consumed by many processes. |
| Demo point | 1-26, the client's own requirement numbering, carried unchanged from Annexure A of the blueprint and from the dataset. |
| THE ANTI-REPEAT-WORK RULE |  |
| Read this before estimating anything | Eleven capabilities in this product look like eleven features and are one component each: the approval chain, the ledger, the eligibility service, the recompute worker, the template renderer, the rule pack evaluator, the blocking-item lock, the scope resolver, the outbox, the effective-dated write and the tool surface. 16_Reuse_Register lists each with every process that consumes it. A story that re-implements one of these is a defect at design time, not a delivery. If a process step says 'reuses CMP-nn', the story is a configuration of that component, not a build. |
| Second-order effect | Estimates on 18_Build_Backlog assume the component exists. A backlog item whose component has not shipped yet carries the component as a dependency, not as hidden scope. |
| LEGEND |  |
| Teal banded row | Section header inside a sheet. Not data. |
| Step type | TASK (human does it) · SYS (system does it unattended) · DEC (decision / branch) · APPR (approval gate) · INT (integration call) · WAIT (timer or external event) · AGENT (agent-executed, governed). |
| Phase | P0 Foundations (wk 1-8) · P1 Core HRMS (wk 9-24) · P2 Pilot & intelligence (wk 25-40) · P3 Depth (wk 41-64) · P4 Scale (wk 65-96). Matches blueprint §13. |
| CRUD | C create · R read · U update · D delete-by-end-dating. Nucleus never hard-deletes a temporal fact (blueprint §7.4). |
| Blank cell | Deliberately not applicable. Not an omission. |
| VERSION |  |
| This workbook | Nucleus — Process Flows & Process Maps v1.0, September 2026. Aligned to Blueprint v1.1 and Demo Dataset v1.0. |
| Revision rule | Revise at each phase exit, alongside the blueprint, with what the build actually taught us (blueprint §16). |

## Process workbook — sheet index

| Sheet | Purpose |
| :--- | :--- |
| SHEET INDEX |  |
| What each sheet holds, who it is for, and when to open it. |  |
| Sheet | What it holds · Primary audience · Open it when |
| 00_Read_Me | Purpose, ID conventions, the anti-repeat-work rule, legend · Everyone · First |
| 01_Sheet_Index | This sheet · Everyone · Navigation |
| 02_Process_Architecture | Level 0 value chain and Level 1 domain map with domain prefixes and owning modules · Product, architecture · Orientation, scope arguments |
| 03_Process_Inventory | Every process: trigger, actors, frequency, criticality, module, phase, reused components, demo points · Product, engineering leads · Sprint planning, ownership |
| 04_Process_Steps | Step-level flow for every process: actor, type, action, rules, objects and CRUD, screen, event, exception · Developers, QA · Building or testing a process |
| 05_Swimlane_Maps | Column-per-lane maps for the nine flows that cross the most boundaries · Product, client demo, design · Explaining a flow to a human |
| 06_Data_Dictionary | Every object and every field: type, required, owner, temporality, PII class, dataset mapping · Developers, data · Schema and migration work |
| 07_Screens | Screen and surface inventory: persona, platform, purpose, key actions, permissions, offline behaviour · Design, front end · UI build |
| 08_Form_Fields | Field-level form specification: label, control, source, mandatory, validation, default, visibility · Design, front end, QA · Building or testing a form |
| 09_Business_Rules | Every rule with its parameters, default values, scope, consuming steps and test case · Developers, implementation consultants · Any behaviour question |
| 10_Config_Tables | Configuration table schemas with the client's actual values carried from the demo dataset · Implementation, developers · Seeding a tenant, writing config UI |
| 11_State_Machines | States, guards, transitions and reversibility for every stateful object · Developers, QA · Workflow and status code |
| 12_Events | Event catalogue: emitter, payload, consumers, idempotency key, retention · Developers · Anything asynchronous |
| 13_API_and_Tools | REST surface and the governed agent tool surface, with permission and side-effect class · Developers, integrations · API and agent work |
| 14_Agents | Agent catalogue, autonomy defaults, tools used, approval thresholds, ledger fields · Product, developers · Intelligence layer |
| 15_Integration_Flows | ERP inbound master, GL outbound, banks, devices, business messaging, e-sign: mechanism, cadence, reconciliation · Integration engineer · Connector build |
| 16_Reuse_Register | The eleven shared components, what each owns and every process that consumes it · Everyone · BEFORE estimating or building anything |
| 17_Traceability | 26 demo points to process, module, screen, rule, dataset sheet, test case and phase · Product, client-facing · Proving coverage |
| 18_Build_Backlog | Epic and story backlog with phase, effort, dependencies and definition of done · Delivery lead · Sequencing and tracking |
| 19_Test_Cases | Golden cases from the demo dataset plus property tests and negative cases · QA, payroll engineer · Test library |
| 20_NFR_and_DoD | Non-functional targets with measurement method, and the definition of done per layer · Engineering, QA · Release gates |
| 21_Roles_and_RACI | Personas, permission scope, and RACI across process domains · Product, security · Permission model and ownership |
| 22_Open_Decisions | Decisions that gate work, with the phase they must close in and what they block · Deb, product lead · Weekly review |

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
| Size | 65 | specified items (table rows) | Counted automatically at generation |
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
