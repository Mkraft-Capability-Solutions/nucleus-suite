<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# MC-01 — Monitoring and Control Procedure

| Attribute | Value |
| :--- | :--- |
| Document ID | MC-01 |
| Title | Monitoring and Control Procedure (including Quantitative Management of Sub-Processes) |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Programme Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | EPG Lead, Measurement Analyst, PQA Lead — *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | MC, MPM (levels 4–5), PLAN, RSK, CAR |
| Related documents | PLN-01, PLN-02, MPM-01, RSK-01, RSK-02, RSK-03, CM-02, CAR-01, DAR-01, DAR-02, GOV-04, the meeting minutes record (GOV-04), the status report (MC-01) |
| Quality & process-performance objectives | QPPO-04 (predictable phase delivery), QPPO-01 (escaped defects) |
| Process performance baseline used | PPB-05, PPB-06 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

Defines how actual progress, performance and process behaviour are compared with the plan and with quality and process-performance objectives, and how deviations are corrected — both by **threshold-based (RAG) control** of plan attributes and by **quantitative management** of statistically managed sub-processes, where the team responds to **special-cause signals** rather than to every movement of a number.

## 2. What Is Monitored

| Attribute | Compared against | Source | Measures |
| :--- | :--- | :--- | :--- |
| Schedule and milestones | Baseline in PLN-02 (phases P0–P5, gates G0–G5) | Tracker | MET-01, MET-03, PPM-02 forecast |
| Effort and cost | Budget and estimates (PLN-03) | Timesheets, finance | MET-02 |
| Scope | Baselined requirements per phase | REQ-02, CM-03 | MET-04, MET-26 |
| Quality | QA-01 objectives, QPPOs | Defect tracker, PR records, reconciliation | MET-05..13, PPB-01..06 |
| Risks | RSK-02 | Risk register | MET-17, MET-18 |
| Issues, actions, dependencies | RSK-03 | RAID log | Age, overdue count |
| Open decisions (OD-nn) | Decision due dates; BL items blocked | DAR-02 | OD age; blocked BL count |
| Commitments | Stakeholder commitments (GOV-07, GOV-09) | Minutes | Commitments met/missed |
| Data management | Data plans, synthetic-only rule (GOV-10) | Audits | NCs |
| Stakeholder involvement | Communication plan (GOV-09) | Minutes | Attendance, decisions taken |
| Process performance | PPB control limits, QPPO targets | Measurement repository | Control charts, capability |
| NFR conformance | 05_System_Requirements | NFR tests, monitoring | MET-27 |

## 3. Cadence

| Forum | Frequency | Participants | Inputs | Outputs |
| :--- | :--- | :--- | :--- | :--- |
| Daily stand-up | Daily | Delivery team | Board, blockers | Blockers raised to RAID within 1 day if not resolved |
| Sprint review / retrospective | Per sprint (2 weeks) | Team, Product Owner | Sprint metrics, PPB-05 chart | Accepted increments; improvement items |
| Programme board | Fortnightly | Programme Manager, workstream/domain leads, PQA (observer) | the status report (MC-01) status reports, RSK-02, RSK-03, DAR-02 | Corrective actions, escalations |
| Quantitative management review | Monthly (from P1) | EPG Lead, Measurement Analyst, sub-process owners, PQA | PPB charts, signals, capability, PPM forecasts | Signal dispositions; CAR triggers; PPB recalculation requests |
| Steering Committee | Monthly | SteerCo | Performance report (MPM-01 §12), top risks, QPPO status | Decisions, re-plan approvals |
| Gate review | At G0–G5 | Gate authority (DOC-01 §12) | Gate pack, PQA statement | Go / conditional go / no-go |
| Phase retrospective | End of each phase | All leads | Phase data, CAR outcomes | Lessons learned (lessons-learned record, PCM-01); improvement proposals (PCM-01) |

## 4. Threshold-Based Control (Plan Attributes)

### 4.1 Tolerances

| Attribute | Tolerance (deviation from baseline) | Authority when exceeded |
| :--- | :--- | :--- |
| Phase end date | ± 1 week | Programme Manager corrects; beyond → SteerCo |
| Gate date | ± 2 weeks | SteerCo |
| Phase cost | ± 5% | SteerCo |
| Committed phase scope (Must-haves) | Any reduction | CCB → SteerCo |
| Quality | Any red MET or QPPO at risk | Programme board → SteerCo if unresolved |
| Statutory / privacy / security | Zero tolerance for known S1 at gate | Gate blocked |

### 4.2 Corrective Action Process

1. **Detect** — metric breaches threshold, milestone missed, or tolerance forecast to be exceeded (PPM-02 probability < 70%).
2. **Analyse** — owner determines cause and impact within 5 working days (Red) / 10 working days (Amber).
3. **Decide** — select corrective action; significant options evaluated with DAR-01.
4. **Act** — actions logged as RSK-AC-NNN with owner and due date.
5. **Track** — reviewed in each programme board until closed.
6. **Verify** — owner shows the metric/forecast back within tolerance; PQA samples closure evidence.
7. **Learn** — recurring or high-impact deviations trigger CAR-01.

## 5. Quantitative Management of Sub-Processes (ML4–ML5)

For each sub-process selected in MPM-01 §11, control is exercised through its PPB control chart, **not** through fixed RAG thresholds.

### 5.1 Principles

- **Common-cause variation** (points within limits, no pattern) is the voice of the process: do **not** react to individual points. If performance is not good enough, that is a capability problem handled by process improvement (PCM-01), not by pressuring the team.
- **Special-cause signals** (MPM-01 §9.2 rules) indicate something unusual has happened: they **must** be investigated and dispositioned.

### 5.2 Special-Cause Signal Handling

| Step | Action | Who | Time limit |
| :--- | :--- | :--- | :--- |
| 1 Record | Signal logged with chart, rule triggered, data point(s) | Measurement Analyst | Within 2 working days of data |
| 2 Investigate | Identify assignable cause (e.g. review rushed before deadline; inexperienced reviewer; unusually complex statutory rule; tool outage; data error) | Sub-process owner | 5 working days |
| 3 Disposition | One of: **(a) Remove** — harmful cause; act to prevent recurrence; **(b) Incorporate** — beneficial cause; propose as process improvement (PCM-01 §7.2); **(c) Data error** — correct data; **(d) No cause found** — keep watching; escalate if repeated | Sub-process owner + EPG | At monthly review |
| 4 Act | Containment for affected work products (e.g. re-review per QA-02 §6.1; extra tests for an increment predicted by PPM-01 to exceed escapes) | Owner | Per action |
| 5 Verify | Subsequent points return within limits / no repeat signal | Measurement Analyst | Next 3 data points |
| 6 Escalate | Repeated signals of the same type, or signal affecting a QPPO → CAR-01 | EPG Lead | — |

### 5.3 Capability Shortfall Handling

When a stable sub-process is **not capable** of meeting its QPPO (MPM-01 §9.3):

1. Quantify the gap (predicted proportion meeting QPPO vs required).
2. Use the relevant PPM to identify which controllable inputs could close the gap (e.g. PPM-01: increase inspection coverage or keep review rate within limits).
3. Raise an improvement proposal (PCM-01 §7.2) or CAR-01; pilot and evaluate statistically.
4. If no feasible improvement, the SteerCo revisits the QPPO or accepts the risk (RSK-02).

### 5.4 Using Predictions to Manage

| Point | Model | Decision supported |
| :--- | :--- | :--- |
| Phase planning | PPM-02 | Scope commitment that achieves ≥ 80% probability of completion |
| Mid-phase | PPM-02 re-run | Scope trade-offs via CCB if probability < 70% |
| G3 | PPM-01 | Additional reviews/tests if predicted escapes exceed QPPO-01 |
| Before payroll go-live | PPM-03 | Additional parallel cycle or targeted validation if variance predicted |

## 6. Status Reporting

- Each workstream/domain lead submits a **the status report (MC-01) Status Report** fortnightly: progress vs plan, metrics with RAG, special-cause signals and dispositions, risks/issues/decisions needing attention, next-period plan.
- The Programme Manager consolidates into the programme status and the monthly SteerCo report (MPM-01 §12).
- Status reports state facts and data; "green" requires evidence (metric value or chart reference).

## 7. Milestone and Gate Reviews

| Element | Requirement |
| :--- | :--- |
| Gate pack | Exit evidence per DOC-01 §12; measurement pack (MPM-01 §12); RSK-02 snapshot; DAR-02 open decisions; PQA conformance statement (QA-01 §10) |
| Decision | Go / Conditional go (with dated conditions logged as actions) / No-go |
| Record | Minutes (meeting minutes record, GOV-04) with decisions and actions; baselines recorded (CM-01) |
| Conditional items | Tracked in RSK-03; unmet conditions by due date revert decision to No-go |

## 8. Issue Management to Closure

1. Issues are logged in RSK-03 within one working day of identification.
2. P1 issues are escalated to the Programme Manager immediately and to the SteerCo chair if not resolved in 2 working days.
3. Each issue has an owner, resolution plan and target date.
4. Closure requires evidence; P1/P2 closures require a CAR-01 record or a documented reason why CAR is not needed.
5. Issue ageing is reported fortnightly.

## 9. Open-Decision Monitoring

Open decisions (OD-nn) frequently block backlog items (e.g. OD-01 Node framework choice blocks BL-001). Every OD in DAR-02 has a decision owner, due date, and list of blocked BL items. ODs due within 2 weeks of a blocked item's planned start are escalated at the programme board; overdue ODs go to the SteerCo (RSK-R-026).

## 10. Re-Planning Triggers

A formal re-plan (PLN-01/PLN-02 revision via CM-02) is required when:

- Any tolerance in §4.1 is exceeded and cannot be recovered within the phase.
- PPM-02 predicts < 50% probability of completing committed phase scope.
- A capability shortfall (§5.3) makes a QPPO unattainable without scope change.
- A Critical risk materialises.
- A regulatory change alters statutory scope (RSK-R-012).
- An open decision resolution invalidates planned work.

## 11. Records

| Record | Location |
| :--- | :--- |
| Status reports | the status report (MC-01) instances |
| Meeting minutes | the meeting minutes record (GOV-04) instances |
| Signal log and dispositions | Measurement repository (MPM-01 §6) |
| Corrective actions | RSK-03 |
| Gate decisions | Gate minutes; CM-01 baseline records |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Steering Committee | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 12 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 12. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
