# 01 — Project Governance and Framework

**Nucleus Suite (Nucleus HRMS Suite)** — an AI-native, Workday-class Human Capital Management suite: India-first, global-ready.

| Attribute | Value |
| :--- | :--- |
| Folder owner (role) | Programme Manager |
| Process owner (role) | Engineering Process Group (EPG) Lead |
| Framework version | 0.1 (Draft — to be baselined at Gate G0) |
| Date | 2026-11-05 |
| Target process capability | CMMI V2.0/V3.0 Development — Maturity Level 3 (BG-09) |
| Conventions | [DOC-01 Document Control Standard](00_Document_Control/DOC-01_Document_Control_Standard.md) |
| Full register | [DOC-02 Master Document Register](00_Document_Control/DOC-02_Master_Document_Register.md) |

---

## 1. What this folder is for

This folder holds the **programme-level governance, planning, process and template assets** for every requirements folder (02–12). It answers:

- **Why and what** — vision, scope, business goals, competitive position (folder 01).
- **Who decides and how** — charter, governance bodies, decision rights, stakeholders (folders 02, 04).
- **What the business looks like** — capability model, value streams, glossary (folder 03).
- **What rules govern data and AI** — privacy, data governance, responsible AI (folder 05).
- **How work is planned, controlled, changed, assured and measured** — folders 06–14.
- **How module requirements must be written** — templates (folder 99).

> **Current phase:** R0 Foundation — local JSON UI validation prototype. Nothing in this folder authorises live backend, database, external API or payroll disbursement activity; that requires an explicit programme decision (see DAR-02).

## 2. Folder structure

```
01_Project_Governance_and_Framework/
├── README.md                                   ← this file
├── 00_Document_Control/                        DOC-01..02  conventions, register
├── 01_Vision_and_Scope/                        GOV-01..02  vision, scope, competitive benchmark
├── 02_Project_Charter_and_Governance/          GOV-03..04  charter, governance model, decision rights
├── 03_Business_Architecture_and_Glossary/      GOV-05..06  capability model, value streams, glossary
├── 04_Stakeholders_and_Personas/               GOV-07..09  stakeholder register & RACI, personas, comms
├── 05_Data_and_AI_Governance/                  GOV-10..11  data/privacy governance, responsible AI
├── 06_Planning_and_Estimation/                 PLN-01..03  PM plan, WBS & roadmap, estimation
├── 07_Requirements_Management/                 REQ-01..03  RM plan, traceability matrix, quality checklist
├── 08_Configuration_and_Change_Control/        CM-01..03   CM plan, change control & CCB, CR log
├── 09_Organizational_Change_Management/        OCM-01..02  adoption strategy, end-user training
├── 10_Risk_Issue_and_Dependency_Management/    RSK-01..03  risk plan, risk register, RAID log
├── 11_Quality_Assurance_and_Verification/      QA-01..04   QM plan, peer review, V&V, audit checklist
├── 12_Measurement_and_Monitoring/              MPM-01, MC-01  measurement plan, monitoring & control
├── 13_Decision_Management/                     DAR-01..02  DAR procedure, decision log
├── 14_Process_Supplier_and_Capability/         PCM-01, SAM-01, OT-01  process & tailoring, suppliers, team training
├── 99_Templates/                               TPL-00..14  templates for all module folders 02–12
└── _archive/v0.0_placeholder_templates/        superseded placeholder files (history only)
```

## 3. CMMI practice area coverage

| CMMI practice area | ML | Primary evidence | Supporting evidence |
| :--- | :---: | :--- | :--- |
| Governance (GOV) | 2–3 | GOV-03, GOV-04 | GOV-07, GOV-10, GOV-11 |
| Implementation Infrastructure (II) | 2–3 | PCM-01 | DOC-01, OT-01 |
| Planning (PLAN) | 2 | PLN-01, PLN-02 | GOV-07, GOV-09 |
| Estimating (EST) | 2 | PLN-03 | PLN-02 |
| Monitor and Control (MC) | 2 | MC-01 | TPL-12, RSK-03 |
| Requirements Development and Management (RDM) | 2–3 | REQ-01, REQ-02 | REQ-03, GOV-01, GOV-05, GOV-08, TPL-01..07 |
| Risk and Opportunity Management (RSK) | 2–3 | RSK-01, RSK-02 | RSK-03 |
| Configuration Management (CM) | 2 | CM-01, CM-02 | CM-03, DOC-01, DOC-02 |
| Process Quality Assurance (PQA) | 2 | QA-01, QA-04 | — |
| Peer Reviews (PR) | 2–3 | QA-02 | TPL-09 |
| Verification and Validation (VV) | 2–3 | QA-03 | TPL-13 |
| Managing Performance and Measurement (MPM) | 2–3 | MPM-01 | TPL-12 |
| Supplier Agreement Management (SAM) | 2 | SAM-01 | DAR-01 |
| Decision Analysis and Resolution (DAR) | 3 | DAR-01, DAR-02 | TPL-10 |
| Process Management (PCM) / Process Asset Development (PAD) | 3 | PCM-01 | DOC-01, 99_Templates |
| Organizational Training (OT) | 3 | OT-01 | OCM-02 |
| Technical Solution (TS) / Product Integration (PI) | 3 | Module folders 02–12 (via TPL-04..07), folder 10 | GOV-05 |
| Causal Analysis and Resolution (CAR) | 4–5 | PCM-01 §improvement, TPL-14 | MPM-01 |

> These documents define the **process**. CMMI appraisal also needs **evidence that the process was followed** (approved baselines, review records, CCB minutes, status reports, audit findings). Producing those records is tracked as actions in RSK-03.

## 4. Suggested reading order

1. **Everyone:** GOV-01 Vision and Scope → GOV-03 Project Charter → DOC-01 Conventions.
2. **Business analysts and module owners:** REQ-01 → TPL-01 → TPL-02..07 → REQ-03 → GOV-05, GOV-06, GOV-08.
3. **Leadership:** GOV-02 → GOV-04 → RSK-02 → MPM-01.
4. **Architects and AI team:** GOV-05 → GOV-10 → GOV-11 → DAR-01 → CM-01.
5. **QA and PMO:** QA-01..04 → MC-01 → PLN-01..03 → CM-02.

## 5. How module folders 02–12 use this framework

Each module folder MUST:

1. Follow the pack structure in **TPL-01** and the ID scheme in **DOC-01 §5–6**.
2. Trace every requirement up to a business goal (**BG-xx**) and down to test cases in **REQ-02**.
3. Be peer reviewed (**QA-02**) and pass **REQ-03** before baseline at Gate **G1**.
4. Change only through a change request (**CM-02**) once baselined.

## 6. Revision History

| Version | Date | Author | Change summary | Approved by |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 2026-11-05 | Governance Workstream | Folder restructured from 4 placeholder tracks into a CMMI-aligned governance framework (38 controlled documents + 15 templates) | *pending* |
