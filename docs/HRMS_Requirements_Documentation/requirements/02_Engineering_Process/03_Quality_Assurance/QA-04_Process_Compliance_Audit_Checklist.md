<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# QA-04 — Process Compliance Audit Checklist

| Attribute | Value |
| :--- | :--- |
| Document ID | QA-04 |
| Title | Process Compliance Audit Checklist (CMMI ML2–ML5) |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | PQA Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | EPG Lead, Programme Manager — *pending* |
| Approved by | EPG Lead — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PQA (and evaluation of all practice areas listed) |
| Related documents | QA-01, DOC-01, DOC-02, PCM-01, MPM-01, MC-01, CAR-01 and the documents cited per item |
| Quality & process-performance objectives | QPPO-02 (defect removal before system test), QPPO-03 (exact payroll), QPPO-05 |
| Process performance baseline used | PPB-01, PPB-02, PPB-03, PPB-04 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

Provides PQA auditors with a structured checklist to evaluate, objectively and repeatably, whether the Nucleus Suite programme performs its defined processes and produces the expected evidence — from Maturity Level 2 through **high maturity (ML4–ML5)**, in line with the BG-09 target of CMMI ML5. The same checklist is used for internal readiness checks before any external appraisal (PCM-01 §9).

## 2. How to Use

1. Select the practice areas in scope for the audit (QA-01 §8 calendar).
2. For each item, collect **objective evidence** (§3) — not verbal assurance.
3. Rate each item using the scale in §4.
4. Record findings in the form in §6; Major/Minor NCs are raised per QA-01 §9.
5. Summarise ratings per practice area (§7).

## 3. Objective-Evidence Expectations

| Evidence type | Description | Examples |
| :--- | :--- | :--- |
| **Artefact** (direct) | Work product that results from performing the practice | Baselined plan; CR record; PR-NNNN; control chart with limits; CAR-NNNN |
| **Affirmation** | Oral or written statement by a practitioner confirming how the practice is performed | Interview notes with a domain lead |
| **Indirect** | Side-effect of performing the practice | Meeting minutes showing a decision; tracker history; CI logs |

Rules:

- Each rated item needs at least one **artefact** plus corroboration (affirmation or indirect evidence).
- Evidence must be from the **audit period** and from **actual project work**, not blank formats or examples.
- For high-maturity items, evidence must show **use of data in decisions** (e.g. a special-cause disposition that led to an action), not merely the existence of charts.
- Evidence must sample across at least two domains (or all, if fewer than two are active).

## 4. Rating Scale

| Rating | Meaning |
| :--- | :--- |
| **FI** — Fully implemented | Practice performed; adequate evidence; no weaknesses |
| **LI** — Largely implemented | Performed; evidence adequate; one or more minor weaknesses |
| **PI** — Partially implemented | Some aspects performed; significant weaknesses |
| **NI** — Not implemented | Not performed or no evidence |
| **NY** — Not yet | Practice not yet expected in current phase (e.g. ML5 items during P0) |
| **NA** — Not applicable | Out of scope with documented rationale |

## 5. Checklist

Item format: `<PA>-<n>` · question · expected evidence (doc IDs).

### 5.1 Governance (GOV)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| GOV-1 | Has senior management defined and communicated process expectations (policy) and the ML5 objective? | GOV-03, GOV-04, QA-01 §2, SteerCo minutes |
| GOV-2 | Are resources and roles for process work (EPG, PQA, Measurement Analyst) funded and assigned? | GOV-07, PCM-01 §6, RSK-AC-001 closure |
| GOV-3 | Does senior management review process performance and improvement results periodically? | SteerCo minutes with MPM-01 reports, PCM-01 §7.1 reviews |
| GOV-4 | Are decision rights followed (approvals by the right body)? | Approval records vs DOC-01 §8 |

### 5.2 Planning (PLAN)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| PLAN-1 | Is there an approved, current plan covering scope, schedule, resources, stakeholders, data management, risks? | PLN-01, PLN-02, baseline record |
| PLAN-2 | Is the plan based on the standard process tailored per PCM-01? | Tailoring record (PAL-4) |
| PLAN-3 | Have stakeholders committed to the plan? | Signed/approved minutes |
| PLAN-4 | Are phase plans (P0–P5) re-planned when triggers occur? | MC-01 §10 re-plan records |

### 5.3 Estimating (EST)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| EST-1 | Are size and effort estimates documented with method and basis? | PLN-03 basis of estimate |
| EST-2 | Do estimates use historical data (PPB-05 throughput) where available? | Estimate records citing PPB/PPM-02 |
| EST-3 | Are estimate vs actual compared and used to improve estimation? | Phase retrospectives, the lessons-learned record (PCM-01) |

### 5.4 Monitor and Control (MC)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| MC-1 | Is actual performance compared to plan at defined cadence? | the status report (MC-01) reports, programme board minutes |
| MC-2 | Are corrective actions taken and tracked to closure? | RSK-03 actions with evidence |
| MC-3 | Are gates conducted with required evidence? | Gate packs, minutes |
| MC-4 | Are open decisions (OD-nn) monitored against blocked backlog items? | DAR-02, MC-01 §9 escalations |

### 5.5 Requirements Development and Management (RDM)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| RDM-1 | Are stakeholder needs elicited and transformed into requirements in the standard format, from business (BRS-01) through stakeholder (STRS-01) and system (SRS-01) to functional requirements? | BRS-01, STRS-01, SRS-01, domain packs (standard artefact formats, DOC-01 §4) |
| RDM-2 | Do requirements meet the quality checklist? | REQ-03 completed checklists, PR records |
| RDM-3 | Is bidirectional traceability maintained (BG → FR → TC; seams; golden-dataset rows)? | REQ-02 |
| RDM-4 | Are requirement changes controlled and impact-assessed? | CM-03 CRs with impact |
| RDM-5 | Are inconsistencies between requirements, plans and work products identified and resolved? | Review defects type INC, CR records |

### 5.6 Risk and Opportunity Management (RSK)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| RSK-1 | Are risks identified, analysed and prioritised per RSK-01? | RSK-02 entries with P/I/score |
| RSK-2 | Do Red/Amber risks have response plans, triggers, owners? | RSK-02, RSK-03 actions |
| RSK-3 | Is the register reviewed at cadence and snapshot at gates? | Minutes, baselines |

### 5.7 Configuration Management (CM)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| CM-1 | Are configuration items identified and baselined? | CM-01 CI list, baseline records, DOC-02 |
| CM-2 | Are changes to baselines controlled through CCB? | CM-03 CRs, CCB minutes |
| CM-3 | Is baseline integrity verified (audits)? | CM audit records |
| CM-4 | Are measurement repository, PPBs, PPMs, golden dataset and evaluation sets under CM? | CI list entries, version history |

### 5.8 Process Quality Assurance (PQA)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| PQA-1 | Are processes and work products objectively evaluated by independent PQA? | Audit reports, independence in GOV-04/QA-01 §5 |
| PQA-2 | Are NCs communicated, tracked and resolved; escalated when needed? | NC log, MET-25 |
| PQA-3 | Are quality trends analysed and fed to improvement? | Quarterly NC analysis to EPG |

### 5.9 Peer Reviews (PR)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| PR-1 | Are required work products peer-reviewed with the right type? | PR-NNNN records vs QA-02 §2 |
| PR-2 | Are entry/exit criteria met and defects resolved? | the peer review record (QA-02) records |
| PR-3 | Are mandatory base measures captured (size, effort, defects by severity)? | QA-02 §9.1 fields complete |
| PR-4 | Are out-of-limit review rates acted upon (re-review)? | QA-02 §6.1 flags and re-review records |
| PR-5 | Is the reuse check (R-5) applied and violations dispositioned? | Review findings DUP/R-5; ARB exceptions |

### 5.10 Verification and Validation (VV)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| VV-1 | Are V&V methods, environments and criteria defined and followed? | QA-03, test plans |
| VV-2 | Is golden-dataset reconciliation performed and mismatches triaged? | Reconciliation reports, defect links |
| VV-3 | Are results analysed and requirements coverage demonstrated? | MET-05, REQ-02 |
| VV-4 | Is validation performed with personas / pilot users? | UAT sign-offs, usability results |
| VV-5 | Are AI features evaluated (accuracy, fairness, groundedness, red-team)? | Evaluation reports, DAEB approvals |

### 5.11 Technical Solution (TS) and Product Integration (PI)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| TS-1 | Are alternative solutions evaluated for significant design decisions? | DEC-NNNN (DAR-02), ARB minutes |
| TS-2 | Are designs documented and reviewed (incl. NFR and security)? | Design specs, threat models |
| PI-1 | Are seam contracts (S-01..S-12) defined and verified? | Seam contracts, contract test results |
| PI-2 | Are shared components (CMP-nn) integrated via published interfaces (anti-repeat-work rule)? | Consumer map, PR-5 evidence |
| PI-3 | Is integration sequence planned and executed? | Integration plan, INT results |

### 5.12 Decision Analysis and Resolution (DAR)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| DAR-1 | Are decisions requiring formal analysis identified per DAR-01 criteria? | DAR-02 entries |
| DAR-2 | Are criteria, alternatives and evaluation recorded? | DEC-NNNN (decision record, DAR-01) |
| DAR-3 | Are open decisions resolved by due date? | OD ageing in DAR-02 |

### 5.13 Supplier Agreement Management (SAM)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| SAM-1 | Are suppliers selected via documented criteria? | DAR-01 records, SAM-01 |
| SAM-2 | Do agreements contain required clauses (DPA, security, AI terms, exit)? | Agreement checklist (SAM-01 §6) |
| SAM-3 | Are supplier deliverables accepted against criteria and performance monitored? | Acceptance records, supplier reviews |

### 5.14 Organisational Training (OT)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| OT-1 | Are training needs identified and a plan maintained? | OT-01 |
| OT-2 | Is training delivered and recorded? | Training records, MET-28 |
| OT-3 | Is training effectiveness evaluated? | OT-01 §7 evaluations |

### 5.15 Process Management (PCM) and Process Asset Development (PAD) — levels 2–3

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| PCM-1 | Is there a standard process set and PAL? | PCM-01 §2, §4 |
| PCM-2 | Are tailoring records approved and followed? | PAL-4 |
| PAD-1 | Are process assets maintained under CM with owners? | DOC-02, CM-01 |
| PCM-3 | Are lessons learned captured and used? | PAL-6, G1 checks |

### 5.16 Managing Performance and Measurement (MPM) — levels 2–3

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| MPM-1 | Are measurement objectives derived from business goals? | MPM-01 §3 |
| MPM-2 | Are measures defined operationally, collected and stored? | MPM-01 §7, repository |
| MPM-3 | Are data quality checks performed? | MPM-01 §6.1 results |
| MPM-4 | Are analyses reported and used? | Reports, minutes with decisions |

### 5.17 High Maturity — MPM Levels 4–5

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| HM-MPM-1 | Are QPPOs defined, traceable to business objectives, and approved? | MPM-01 §4, SteerCo approval |
| HM-MPM-2 | Are sub-processes selected for statistical management with documented rationale? | MPM-01 §11, DAR-02 |
| HM-MPM-3 | Are PPBs established from stable data with ≥ 20 points, stratified where needed, versioned? | PPB records (PAL-5): data range, exclusions, limits |
| HM-MPM-4 | Are control charts maintained and special-cause signals dispositioned with actions? | Charts; signal log; MC-01 §5.2 dispositions |
| HM-MPM-5 | Is capability against QPPOs analysed and shortfalls acted upon? | Capability reports; improvement proposals/CARs raised |
| HM-MPM-6 | Are PPMs documented, validated (back-tested), and used to predict and to guide decisions (planning, G3, payroll go-live)? | PPM records; prediction vs actual; decisions citing PPM-01/02/03 |
| HM-MPM-7 | Are PPBs/PPMs updated after verified process changes only? | Recalculation records linked to deployments |

### 5.18 High Maturity — Causal Analysis and Resolution (CAR)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| CAR-1 | Are outcomes selected for analysis using Pareto/thresholds/mandatory triggers? | CAR log with selection rationale |
| CAR-2 | Are root causes determined with an appropriate method? | CAR-NNNN (causal analysis record, CAR-01) |
| CAR-3 | Are actions proposed, implemented and tracked? | Action records |
| CAR-4 | Is the effect of actions evaluated quantitatively (shift detection, statistical test, effect size)? | Evaluation section of CAR records |
| CAR-5 | Are CAR results recorded in the PAL and shared? | PAL-7, quarterly summaries |

### 5.19 High Maturity — PCM Levels 4–5 (Organisational Improvement)

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| HM-PCM-1 | Is organisational performance reviewed against business objectives and QPPOs, with gaps identified? | PCM-01 §7.1 review records |
| HM-PCM-2 | Is there an improvement proposal pipeline with analysis of expected benefit (using PPMs where possible)? | IMP-nnn records, pipeline metrics |
| HM-PCM-3 | Are improvements piloted with pre-defined statistical success criteria and evaluated? | Pilot plans and evaluations (PAL-8) |
| HM-PCM-4 | Are successful improvements deployed with training and post-deployment monitoring? | Deployment plans, OT records, PPB shift confirmation |
| HM-PCM-5 | Is innovation scanning (incl. AI-assisted engineering) performed and fed to the pipeline? | Quarterly innovation scans |

### 5.20 Institutionalisation (II) — all practice areas

| ID | Question | Expected evidence |
| :--- | :--- | :--- |
| II-1 | Are processes performed consistently across domains and phases (not only by individuals)? | Evidence sampled across ≥ 2 domains |
| II-2 | Are process descriptions followed and kept current? | PQA audits, PAL versions |
| II-3 | Are resources, training and tools provided for the processes? | OT records, tool inventory |

## 6. Findings Form

| Field | Content |
| :--- | :--- |
| Audit ID / date / auditor | |
| Scope (practice areas, domains, period) | |
| Item ID | e.g. HM-MPM-4 |
| Evidence examined | Doc IDs, records, interviews |
| Rating | FI / LI / PI / NI / NY / NA |
| Finding | Strength / Weakness / NC (Major / Minor) / Observation |
| Description | What was observed |
| NC reference | NC-NNNN (QA-01 §9) |
| Owner / due date | |

## 7. Summary Form

| Practice area | Items | FI | LI | PI | NI | NY | NA | Overall | Comments |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| GOV | 4 | | | | | | | | |
| PLAN | 4 | | | | | | | | |
| … | | | | | | | | | |
| CAR | 5 | | | | | | | | |

**Readiness rule (internal):** a maturity level is considered ready for external appraisal only when every in-scope item is FI or LI with no open Major NC.

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| EPG Lead | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 8 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 8. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
