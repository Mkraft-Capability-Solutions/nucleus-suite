<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# MPM-01 — Measurement, Analysis and Statistical Management Plan

| Attribute | Value |
| :--- | :--- |
| Document ID | MPM-01 |
| Title | Measurement, Analysis and Statistical Management Plan |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Measurement Analyst (PMO) with EPG Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | Programme Manager, QA/Test Lead, PQA Lead, Head of AI — *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | MPM (levels 2–5), MC, PQA, CAR, PCM |
| Related documents | DOC-01, GOV-01, MC-01, QA-01, QA-02, QA-03, CAR-01, PCM-01, RSK-01, PLN-02, PLN-03, 05_System_Requirements |
| Quality & process-performance objectives | QPPO-01 – QPPO-07 (owner of all QPPOs) |
| Process performance baseline used | PPB-01 – PPB-07, PPM-01 – PPM-03 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

Defines **what the programme measures, why, how data is collected and analysed, and how selected sub-processes are managed statistically** so that the Nucleus Suite programme can (a) steer delivery with objective data, (b) meet quality and process-performance objectives, and (c) evidence CMMI Maturity Level 5 (target in BG-09) through quantitative management, process performance baselines, process performance models and causal analysis.

## 2. Scope and Maturity Staging

| Level of practice | What it means here | Starts |
| :--- | :--- | :--- |
| ML2–3 measurement | Defined metrics (MET-xx), collected and reported with RAG thresholds | R0 / P0 |
| ML4 quantitative management | QPPOs set; sub-processes selected; PPBs with control limits; special-cause signals acted on (MC-01) | Data collection from P0; first stable PPBs targeted during P2 |
| ML5 optimising | PPMs used to predict and to evaluate improvements; improvements piloted and evaluated statistically (PCM-01, CAR-01) | From P3 |

Product NFR targets (availability, performance, security etc.) are **owned by 05_System_Requirements** (imported from the workbook's 20_NFR_and_DoD with target, how measured, gate and owner). This plan references those NFRs by ID and does not restate or alter their targets.

## 3. Measurement Objectives (GQM)

The Goal–Question–Metric approach links business goals to measures.

| Goal | Question | Metrics |
| :--- | :--- | :--- |
| BG-09 Delivery maturity | Are we delivering to plan? | MET-01, MET-02, MET-03, PPB-05, PPM-02 |
| BG-09 | Are we finding defects early and cheaply? | MET-07, MET-09, PPB-01, PPB-02, PPB-03 |
| BG-09 / BG-06 | How many defects reach users? | MET-08, PPB-06, PPM-01 |
| BG-01 / BG-09 | Is scope stable and fully verified? | MET-04, MET-05, MET-26 |
| BG-04 Continuous compliant payroll | Are calculations exactly right? | MET-12, MET-13, PPB-04, PPM-03 |
| BG-02 / BG-06 AI and trust | Is AI fair, grounded and stable? | MET-14, MET-15, MET-16 |
| BG-03 Frontline excellence | Do frontline users succeed with voice and mobile? | MET-19, MET-20 |
| BG-01 / BG-06 | Is the product accessible and secure? | MET-23, MET-24 |
| BG-10 / BG-01 | Does the product meet its NFRs? | MET-27 (by NFR ID) |
| BG-09 | Is the process being followed and improved? | MET-25, MET-28, CAR and improvement metrics (PCM-01) |
| Customer and team | Are users and the team satisfied? | MET-21, MET-22 |

## 4. Quality and Process-Performance Objectives (QPPOs)

QPPOs are the quantitative objectives that drive statistical management. Targets are **provisional** until the supporting PPB is stable (§8.2); the SteerCo re-confirms them at each phase gate.

| ID | Objective | Traces to | Measure | Provisional target | Supported by | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| QPPO-01 | Minimise defects reaching users | BG-09, BG-06; QA-01 QO-03 | Escaped defects (S1+S2) per phase per 100 function points or per 100 FRs delivered | Downward trend phase-on-phase; no S1 escapes in PAY, CMP, PLT security | PPB-06, PPM-01 | QA/Test Lead |
| QPPO-02 | Remove defects before system test | BG-09; QA-01 QO-02 | Defect removal efficiency before system test | ≥ 60% (P1), rising each phase as capability allows | PPB-03, PPB-01 | QA/Test Lead |
| QPPO-03 | Exact payroll at go-live | BG-04; QA-01 QO-04 | Golden-dataset match rate; parallel-run variance per cycle | 100% golden match; parallel-run unexplained variance = 0 lines at go-live | PPB-04, PPM-03 | Payroll Domain Lead |
| QPPO-04 | Predictable phase delivery | BG-09 | Probability of completing committed phase scope by phase end (from PPM-02) | ≥ 80% probability at each phase mid-point | PPB-05, PPM-02 | Programme Manager |
| QPPO-05 | Effective requirements reviews | BG-09, BG-01 | Review rate within PPB-02 limits; defect density within PPB-01 limits | ≥ 90% of reviews within limits | PPB-01, PPB-02 | PQA Lead |
| QPPO-06 | Fast, controlled change | BG-09 | CR cycle time (submission → CCB decision) | Stable process; 85th percentile within CM-02 SLA | PPB-07 | Configuration Manager |
| QPPO-07 | Fair and grounded AI | BG-02, BG-06 | MET-14, MET-15 lower confidence bounds | Within DAEB-approved thresholds per feature | AI evaluation runs (QA-03 §5.9) | Head of AI |

## 5. Roles

| Role | Responsibilities |
| :--- | :--- |
| Steering Committee | Approves QPPOs; reviews quarterly performance against QPPOs |
| Measurement Analyst | Owns measure repository, data quality, PPB/PPM computation, charts and reports |
| EPG Lead | Owns sub-process selection, PPB/PPM approval, links to improvement (PCM-01) and CAR (CAR-01) |
| Sub-process owners | Act on special-cause signals (MC-01 §5); keep process stable |
| Data providers (all roles) | Record base measures accurately and on time |
| PQA Lead | Audits measurement process and data integrity (QA-04) |

## 6. Data Collection and Storage

| Principle | Implementation |
| :--- | :--- |
| Automate collection | Base measures harvested from the tracker (story states and timestamps), version control (PR metadata, changed lines, review approvals), CI (test results, coverage), reconciliation harness (golden match), PR-NNNN review records (QA-02 §9.1) |
| Single repository | Measurement repository (versioned data store) holds raw base measures, derived measures, PPB snapshots and PPM versions; a configuration item under CM-01 |
| Collection frequency | Event-driven where possible (on merge, on review close, on state change); otherwise weekly |
| Access | Programme-wide read access to aggregated data; raw data access limited to Measurement Analyst and EPG |
| Ethical use | Measures are used to manage and improve **processes**, never to rate individuals. Individual-level data is aggregated before reporting |
| Retention | Programme life + 3 years; PPB history retained permanently in the process asset library (PCM-01) |

### 6.1 Data Quality Controls

| Dimension | Check | Frequency | Threshold |
| :--- | :--- | :--- | :--- |
| Completeness | % of records with all mandatory base measures | Monthly | ≥ 95% (below → RSK-R-034 trigger) |
| Validity | Values in allowed range/enumeration; derived values recomputed | Each load | 100% |
| Consistency | Same measure from two sources agrees (e.g. PR size from VCS vs record) | Monthly sample | ≥ 98% |
| Timeliness | Data available within 2 working days of event | Monthly | ≥ 95% |
| Operational definition adherence | Sample audit by PQA | Quarterly | No Major NC |

Records failing quality checks are flagged and excluded from PPB computation until corrected; exclusions are logged.

## 7. Metric Definitions (MET-xx)

Thresholds G/A/R are **provisional** and recalibrated once PPBs exist; where a metric corresponds to an NFR, the NFR target governs.

| ID | Metric | Formula / operational definition | Unit | Source | Freq. | Owner | Green | Amber | Red |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MET-01 | Schedule Performance Index (SPI) | Earned value ÷ planned value (story points or WBS value completed vs planned, to date) | ratio | Tracker, PLN-02 | Sprint / monthly | Programme Manager | ≥ 0.95 | 0.85–0.94 | < 0.85 |
| MET-02 | Cost Performance Index (CPI) | Earned value ÷ actual cost | ratio | Tracker, finance | Monthly | Programme Manager | ≥ 0.95 | 0.85–0.94 | < 0.85 |
| MET-03 | Milestone on-time rate | Milestones met on baseline date ÷ milestones due | % | PLN-02 | Monthly | Programme Manager | ≥ 90% | 75–89% | < 75% |
| MET-04 | Requirements volatility | (Added + changed + deleted baselined requirements) ÷ baselined requirements, per month | % | REQ-02, CM-03 | Monthly | BA Lead | ≤ 5% | 6–10% | > 10% |
| MET-05 | Requirements verification coverage | Must-have requirements with ≥ 1 passing TC ÷ Must-have requirements | % | REQ-02 | Weekly in test | QA/Test Lead | 100% at G4 | 95–99% | < 95% |
| MET-06 | Requirements quality defect rate | Critical + Major review defects ÷ requirements reviewed | defects/req | PR records | Per review | BA Lead | Within PPB-01 limits | — | Outside limits |
| MET-07 | Defect density | Confirmed defects ÷ size (KLOC changed or FRs delivered) | defects/unit | Defect tracker | Per phase | QA/Test Lead | Within PPB | — | Outside PPB |
| MET-08 | Defect leakage | Defects found after a level ÷ total defects for that level's scope | % | Defect tracker (origin + found phase) | Per phase | QA/Test Lead | ≤ 5% post-release | 6–10% | > 10% |
| MET-09 | Review effectiveness | Defects found in review ÷ (review + later-found defects originating in reviewed product) | % | PR records + tracker | Monthly | PQA Lead | ≥ 60% | 45–59% | < 45% |
| MET-10 | Test pass rate | Passed ÷ executed test cases (per cycle) | % | Test management | Per cycle | QA/Test Lead | ≥ 95% at exit | 85–94% | < 85% |
| MET-11 | Automated test share | Automated TCs ÷ total TCs in regression | % | Test management | Monthly | QA/Test Lead | ≥ 80% | 60–79% | < 60% |
| MET-12 | Golden-dataset match rate | Matched expected-result rows ÷ in-scope expected-result rows (HRMS Demo Dataset v1.1) | % | Reconciliation harness | Nightly | Domain leads | 100% (gate) | 98–99.9% (pre-gate) | < 98% |
| MET-13 | Parallel-run variance | Payroll lines differing between Nucleus Suite and the client's existing payroll without approved explanation, per cycle | count | Parallel-run report | Per cycle | Payroll Domain Lead | 0 | 1–5 under analysis | > 5 or any S1 |
| MET-14 | AI fairness ratio | Ratio of favourable-outcome rates between groups (lowest ÷ highest) on evaluation populations; plus counterfactual flip rate | ratio / % | AI evaluation harness | Per release + monthly | Head of AI | Within DAEB threshold | Near threshold | Outside threshold |
| MET-15 | AI groundedness | Answers fully supported by cited sources ÷ answers evaluated (lower 95% confidence bound) | % | AI evaluation harness | Per release + weekly sample | Head of AI | ≥ DAEB threshold | — | Below threshold |
| MET-16 | Model / data drift index | Distance between current and reference input/output distributions (method fixed per model card) | index | Monitoring | Weekly | Head of AI | Below alert level | Alert | Action level |
| MET-17 | Risk exposure trend | Sum of P × I for open threats | score | RSK-02 | Fortnightly | Programme Manager | Decreasing | Flat | Increasing 2 periods |
| MET-18 | Overdue risk actions | Red/Amber risk actions past due | count | RSK-03 | Fortnightly | Programme Manager | 0 | 1–3 | > 3 |
| MET-19 | Active adoption | Weekly active users ÷ provisioned users, by persona | % | Product analytics (pilot+) | Weekly | Product Owner | Per OCM-01 target | — | — |
| MET-20 | Voice command success | Voice commands executed as intended (confirmed, not corrected) ÷ voice commands, by language | % | Product analytics, evaluation sets | Weekly | Head of AI | Per NFR / feature target | — | — |
| MET-21 | Net Promoter Score (users) | % promoters − % detractors | score | Survey | Quarterly (pilot+) | Product Owner | Trend up | Flat | Down |
| MET-22 | Team engagement (eNPS) | % promoters − % detractors (delivery team) | score | Anonymous survey | Quarterly | Programme Manager | Trend up | Flat | Down |
| MET-23 | Accessibility conformance | In-scope screens passing WCAG 2.2 AA checks ÷ in-scope screens | % | A11y tests | Per sprint | UX Lead | 100% at G4 | 90–99% | < 90% |
| MET-24 | Security vulnerability age | Age of open Critical/High vulnerabilities vs remediation SLA | days | Scanners, pen test | Weekly | Security Lead | All within SLA | Any High near SLA | Any past SLA / any Critical open at gate |
| MET-25 | NC closure on time | PQA NCs closed by due date ÷ NCs due | % | NC log (QA-01) | Monthly | PQA Lead | ≥ 90% | 75–89% | < 75% |
| MET-26 | CR cycle time | Working days from CR submission to CCB decision | days | CM-03 | Monthly | Configuration Manager | Within PPB-07 | — | Outside |
| MET-27 | NFR conformance | NFRs measured within target ÷ NFRs measured (per 05_System_Requirements, using each NFR's own "how measured") | % | NFR test / monitoring | Per gate; monthly in pilot | Chief Architect | 100% at gate | — | Any Must-have NFR failing |
| MET-28 | Training completion | Required OT-01 courses completed ÷ required | % | Training records | Monthly | EPG Lead | ≥ 95% | 80–94% | < 80% |

### 7.1 Base Measure Operational Definitions (excerpt — full catalogue in the measurement repository)

| Base measure | Definition | Counting rule |
| :--- | :--- | :--- |
| Requirement | One uniquely identified FR/BR/NFR/AI statement in a domain pack | Count IDs, not sentences |
| Page | 400 words of normative text excluding header and revision history | Rounded up to 0.5 |
| Changed LOC | Lines added + modified in a PR, excluding generated files, lock files and fixtures | From VCS diff stats with exclusion list |
| Defect | Confirmed deviation from requirement/standard, recorded with severity and origin phase | Duplicates and "not a defect" excluded |
| Story cycle time | Working days from "In progress" to "Done" (DoD met) | Excludes blocked time only if flagged as blocked with OD/dependency reference |
| Review effort | Reviewer preparation hours + meeting/async hours | Self-reported in the peer review record (QA-02); PR tools time as cross-check |

## 8. Process Performance Baselines (PPB-xx)

### 8.1 Baseline Catalogue

| ID | Sub-process | Measure | Chart | Stratification | Data source | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PPB-01 | Requirements / design inspection | Review defect density — (Critical + Major) defects per page (or per 10 requirements) | **u-chart** (varying size per review) | Work-product type; domain group (statutory: PAY/CMP/TIM/LVE vs other) | PR records | Collecting (provisional) |
| PPB-02 | Peer review (all types) | Review rate — size per preparation hour (pages/hr, LOC/hr) | **XmR** (log-transformed if skewed) | Work-product type | PR records | Collecting (provisional; priors in QA-02 §6) |
| PPB-03 | Verification across lifecycle | Defect removal efficiency before system test — defects removed pre-system-test ÷ total defects for the scope | **XmR** per phase increment / per domain release | Domain | Defect tracker | Collecting |
| PPB-04 | Payroll parallel run | Unexplained variance lines per 1,000 payslips per cycle | **u-chart** | Pay group; state | Parallel-run reports | Starts with first parallel run (P2) |
| PPB-05 | Story delivery | Story cycle time (working days) | **XmR** on individual stories (or log-transformed); percentile plot | Story size class; domain | Tracker | Collecting from P0 |
| PPB-06 | Release / phase quality | Escaped defects (S1+S2) per 100 FRs delivered, per phase increment | **u-chart** | Domain | Defect tracker | First point at end of P0 |
| PPB-07 | Change control | CR cycle time (working days) | **XmR** | CR class (minor/major/emergency) | CM-03 | Collecting |

### 8.2 Baseline Rules

1. **Minimum data:** a PPB is *provisional* with 8–19 data points and may be used only for indication; it becomes *established* at ≥ 20 rational subgroups/points from a stable process.
2. **Stability first:** limits are computed only from data without special-cause signals (§9.2); points with assignable, removed causes are excluded with a logged rationale.
3. **Homogeneity:** data from materially different contexts (e.g. statutory vs non-statutory domains) are stratified into separate baselines when a stratified chart shows different centre lines.
4. **Recalculation:** limits are recomputed only after (a) a verified process change (PCM-01 deployment record) or (b) a sustained shift (≥ 8 points same side) confirmed by CAR-01 as a real change — never to "make data fit".
5. **Versioning:** each PPB version (centre line, limits, data range, exclusions) is stored as a configuration item and published in the process asset library (PCM-01).
6. **Priors:** industry or guideline ranges may seed provisional limits but are labelled as such and never presented as organisational capability.

## 9. Statistical Analysis Methods

### 9.1 Control Charts

| Chart | Use when | Limits |
| :--- | :--- | :--- |
| **XmR** (individuals and moving range) | One value per event/period (cycle time, review rate, DRE per increment) | Centre = mean; limits = mean ± 2.66 × average moving range; mR upper limit = 3.268 × average mR |
| **u-chart** | Count of defects per variable-sized unit of opportunity (defects per page, per 1,000 payslips, per 100 FRs) | Centre ū = Σdefects ÷ Σunits; limits = ū ± 3√(ū ÷ nᵢ) for each subgroup size nᵢ (lower bound floored at 0) |
| p-chart (if needed) | Proportion defective with varying sample size (e.g. % stories reopened) | p̄ ± 3√(p̄(1−p̄) ÷ nᵢ) |

Skewed duration data (cycle times) are log-transformed or analysed with percentile-based run charts; the method chosen is recorded in the PPB definition.

### 9.2 Special-Cause Detection Rules

A signal is raised when any of the following occur:

1. One point outside the control limits.
2. Eight consecutive points on the same side of the centre line.
3. Six consecutive points steadily increasing or decreasing.
4. Two of three consecutive points beyond two-sigma on the same side.

Signals are handled per MC-01 §5 (investigate → assign cause → act → record).

### 9.3 Capability Analysis

Once a sub-process is stable, its **capability** is assessed against the QPPO (the "voice of the customer"):

- Compare natural process limits with the QPPO target/specification limits.
- Report the estimated proportion of outcomes meeting the QPPO (from the empirical distribution or a fitted distribution if goodness-of-fit is acceptable); report Cpk only where the normality assumption is reasonable.
- **Capable** = predicted proportion meeting QPPO ≥ the confidence the SteerCo requires (default 90%).
- **Stable but not capable** → improvement needed (PCM-01 proposal or CAR-01), not a stricter target on the team.

### 9.4 Statistical Evaluation of Changes

Process changes and CAR actions are evaluated by comparing before/after data:

- Shift detection on the control chart (rule 2) plus a hypothesis test appropriate to the data (e.g. Mann–Whitney for skewed durations, Poisson rate comparison for defect densities, two-proportion test for rates), with significance level and minimum sample sizes stated in the pilot plan (PCM-01 §7.3).
- Practical significance (effect size vs QPPO gap) is reported alongside statistical significance.

## 10. Process Performance Models (PPM-xx)

| ID | Predicts (outcome) | Controllable inputs (x) | Uncontrollable / context inputs | Method | Used for | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PPM-01 | Escaped defects per 100 FRs for a phase increment (QPPO-01) | Review coverage (% of work products inspected), review rate within PPB-02 limits (%), automated test coverage of changed code, golden-dataset match rate at G3 | Domain complexity class, team experience, requirements volatility (MET-04) | Regression model (Poisson / negative binomial) built from PPB-01/02/03/06 history; prediction interval reported | At G3: predict escapes; if prediction interval exceeds QPPO, add reviews/tests before G4 | Design; fit when ≥ 2 phase increments of data exist |
| PPM-02 | Probability of completing committed phase scope by phase end (QPPO-04) | Committed scope size, WIP limits, story slicing (size class mix) | Historical throughput / velocity distribution (PPB-05), unplanned work rate, blocked-time from open decisions (OD-nn) | **Monte Carlo simulation** (≥ 10,000 trials) sampling from empirical weekly throughput distribution | Phase planning; mid-phase forecast; scope negotiation via CCB | Provisional from P0 with first 6 weeks of data |
| PPM-03 | Parallel-run unexplained variance for next cycle (QPPO-03) | Golden-dataset match rate, statutory rule changes in cycle (count), retro changes after lock (seam S-01 events) | Pay-group size, number of states | Regression / classification model on PPB-04 history | Go/no-go for payroll go-live; extra validation when risk predicted | Design; data from P2 |

### 10.1 PPM Requirements

Each PPM:

- Is documented with purpose, inputs (with operational definitions), method, assumptions, validity range and version.
- Includes at least one **controllable** input so it can guide action, and represents **variation** (prediction intervals or simulated distributions, not single-point estimates).
- Is validated before use: back-tested on held-out data; prediction accuracy recorded.
- Is recalibrated when its inputs' PPBs are recomputed or when prediction error exceeds the documented tolerance.
- Is approved by the EPG Lead and stored in the process asset library (PCM-01).

## 11. Sub-Process Selection for Statistical Management

| Criterion | Question |
| :--- | :--- |
| Relevance | Does the sub-process significantly influence a QPPO? |
| Frequency | Is it executed often enough to produce ≥ 20 data points within a phase? |
| Controllability | Can the team change how it is performed? |
| Measurability | Can base measures be captured automatically and reliably? |
| Risk | Is the outcome high-impact (statutory, security, AI fairness)? |

**Selected sub-processes (initial):** requirements/design inspection (PPB-01, PPB-02), code review (PPB-02), pre-system-test verification (PPB-03), payroll parallel run (PPB-04), story delivery (PPB-05), change control (PPB-07). Release quality (PPB-06) is monitored as an outcome. Selection is reviewed by the EPG at each phase gate and recorded in DAR-02.

## 12. Analysis and Reporting

| Report | Content | Audience | Frequency |
| :--- | :--- | :--- | :--- |
| Sprint dashboard | MET-01, 05, 10, 12, 18; PPB-05 chart | Delivery teams | Per sprint |
| Programme status (status report, MC-01) | MET RAG summary; special-cause signals and actions (MC-01) | Programme board | Fortnightly |
| SteerCo performance report | QPPO status with capability; PPM-02 forecast; top signals; improvement and CAR outcomes | SteerCo | Monthly |
| Quantitative management review | All PPB charts; stability/capability; PPM validation; sub-process selection | EPG, PQA | Monthly from P1; mandatory quarterly |
| Gate measurement pack | Snapshot of all metrics, PPB versions, PPM predictions for next phase | Gate reviewers | Each gate |

All charts show the data range, PPB version and any excluded points.

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
| Size | 13 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 13. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
