<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# CAR-01 — Causal Analysis and Resolution Procedure

| Attribute | Value |
| :--- | :--- |
| Document ID | CAR-01 |
| Title | Causal Analysis and Resolution Procedure |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | EPG Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | PQA Lead, Measurement Analyst, QA/Test Lead — *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | CAR, MPM, PCM, PAD |
| Related documents | MPM-01, MC-01, QA-01, QA-02, QA-03, PCM-01, RSK-01, RSK-03, the lessons-learned record (PCM-01), the causal analysis record (CAR-01) |
| Quality & process-performance objectives | QPPO-01 (escaped defects), QPPO-02 |
| Process performance baseline used | PPB-03, PPB-06 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

Defines how the Nucleus Suite programme identifies the **root causes** of selected outcomes — defects, problems, special-cause signals and also notably *good* outcomes — and takes action to prevent recurrence (or to replicate success), then **evaluates the effect of the action quantitatively**. CAR is a core high-maturity practice for the BG-09 target of CMMI ML5.

## 2. Triggers

| Trigger | Source | Mandatory? |
| :--- | :--- | :--- |
| Any S1 defect found after G3 or in pilot/production | Defect tracker (QA-03 §8) | Yes |
| Any escaped defect in PAY, CMP or PLT security | Defect tracker | Yes |
| Golden-dataset mismatch caused by a requirement or dataset defect (not code) | Reconciliation triage (QA-03 §5.2) | Yes |
| Repeated special-cause signal of the same type, or signal affecting a QPPO | MC-01 §5.2 step 6 | Yes |
| Stable but not capable sub-process | MC-01 §5.3 | Yes (or PCM-01 proposal) |
| P1 or P2 issue closure | RSK-03 | Yes, unless closure record justifies "not needed" |
| Realised risk with Impact ≥ 4 | RSK-01 §11 | Yes |
| Same PQA non-conformance type in 3 consecutive audits | QA-01 §9.3 | Yes |
| Monthly Pareto of defect categories | Defect data | Top category reviewed for selection |
| Exceptionally positive outcome (e.g. a review stream with markedly higher DRE) | Control charts | Optional — to replicate success |

## 3. Selection

Not every defect warrants full CAR. The EPG selects candidates monthly:

1. **Pareto analysis** of defects by type, origin phase, domain, root-cause category and seam over the last period (and cumulative). Categories covering ~80% of impact are candidates.
2. **Thresholds**: mandatory triggers in §2 are always selected.
3. **Impact weighting**: rank = frequency × severity weight (S1 = 10, S2 = 5, S3 = 2, S4 = 1) × cost-of-rework estimate.
4. **Capacity**: at most a manageable number of concurrent CAR investigations (set by EPG, default 5), so actions get done.

Selections and reasons are recorded in the CAR log.

## 4. Root-Cause Analysis Methods

| Method | Use when |
| :--- | :--- |
| **5 Whys** | Single defect or incident with a linear causal chain |
| **Fishbone (Ishikawa)** with categories People, Process, Requirements, Tools, Environment, Data, Seams/Integration, AI model | Multiple contributing causes suspected |
| **Pareto + stratification** | Many defects; find concentration by domain, seam, work-product type |
| **Fault tree** | Safety- or compliance-critical failures (statutory miscalculation, cross-tenant exposure, unauthorised agent action) |
| **Change / timeline analysis** | Special-cause signal coinciding with a change (new reviewer, tool, rule version) |
| **Defect origin analysis** | To locate the lifecycle phase where defects are introduced and where they should have been caught |
| **Scatter / regression** | To test whether a suspected factor (e.g. review rate) actually correlates with outcome (e.g. escaped defects) — feeds PPM-01 |

Root causes are stated so that an action can address them (e.g. "seam contract S-02 did not define precedence for half-day leave with punches", not "tester missed it").

### 4.1 Root-Cause Categories (for trend analysis)

| Code | Category |
| :--- | :--- |
| RC-REQ | Missing/ambiguous/incorrect requirement |
| RC-SEAM | Undefined or inconsistent cross-domain seam behaviour |
| RC-REUSE | Shared component bypassed or re-implemented (anti-repeat-work rule) |
| RC-DATA | Golden dataset, test data or migration data issue |
| RC-DES | Design error |
| RC-CODE | Coding error |
| RC-CFG | Configuration / statutory rule configuration error |
| RC-REV | Review not performed, rushed (rate outside PPB-02) or ineffective |
| RC-TEST | Missing or ineffective test |
| RC-ENV | Environment / tooling |
| RC-KNOW | Knowledge / training gap (feeds OT-01) |
| RC-AI | Model, prompt, grounding or evaluation-set issue |
| RC-PROC | Process definition gap or unclear procedure |

## 5. Action Proposals

For each root cause, the team proposes actions:

| Field | Content |
| :--- | :--- |
| Action | Specific change (process asset, checklist item, artefact-format field, test, automated check, training, design rule) |
| Type | Corrective (fix the cause) / Preventive (stop similar causes elsewhere) / Replicate (spread a positive cause) |
| Expected effect | Which measure should change and by how much (e.g. "reduce RC-SEAM defects per seam by half; PPB-01 centre line for seam contracts expected to drop") |
| Evaluation method | Measure, chart, comparison period, statistical test, minimum data needed |
| Scope | Single team / domain / organisation-wide |
| Owner, due date | Role, ISO date |
| Approval | EPG for programme-wide process changes; domain lead for local actions |

Organisation-wide actions that change process assets are raised as **improvement proposals** (PCM-01 §7.2) and may require a pilot.

## 6. Implementation

- Actions are tracked as RSK-AC-NNN (RSK-03) and linked to the CAR record.
- Process asset changes follow PCM-01 deployment and CM-01 versioning.
- Affected in-flight work products are re-checked (e.g. other seam contracts reviewed for the same gap).

## 7. Evaluation of Effect

Every CAR is closed only after its effect is evaluated:

1. **Collect** post-action data for the period defined in the action proposal.
2. **Compare** with the baseline using:
   - control-chart shift detection (MPM-01 §9.2 rule 2) for the affected PPB; and
   - an appropriate statistical test (e.g. Poisson rate test for defect densities, Mann–Whitney for durations, two-proportion test for rates) at the significance level stated in the proposal; and
   - effect size versus the expected effect.
3. **Conclude**: *Effective* (statistically and practically significant), *Inconclusive* (insufficient data — extend observation or accept with rationale), or *Not effective* (revise actions, re-analyse).
4. If effective and the process changed, request PPB recalculation (MPM-01 §8.2 rule 4).

Where data volumes are too low for statistical tests (e.g. rare S1 escapes), evaluation uses absence of recurrence over a defined exposure period, stated in advance.

## 8. Recording and Sharing

- Each CAR is recorded using **the causal analysis record defined in CAR-01**, ID `CAR-NNNN`.
- The CAR log (index of all CAR-NNNN) is kept by the EPG Lead.
- Completed CAR records — causes, actions, evaluation and data — are stored in the **process asset library (PAL)** (PCM-01 §4) and tagged by root-cause category, domain and seam, so other teams can search and reuse them.
- Quarterly, the EPG publishes a CAR summary: Pareto trends, effective actions, organisation-wide proposals raised.

## 9. Roles

| Role | Responsibility |
| :--- | :--- |
| EPG Lead | Owns procedure; selects CARs; approves organisation-wide actions |
| CAR facilitator (trained, rotating) | Leads root-cause sessions |
| Involved team members | Provide facts; propose actions |
| Measurement Analyst | Provides data, Pareto, charts; performs statistical evaluation |
| PQA Lead | Audits CAR process compliance (QA-04) |

## 10. Metrics

| Measure | Definition |
| :--- | :--- |
| CAR cycle time | Days from selection to closure |
| Effective-action rate | CARs concluded Effective ÷ CARs closed |
| Recurrence rate | Recurrence of same root-cause category within 2 phases after an Effective CAR |
| Defect Pareto shift | Change in share of top categories quarter-on-quarter |

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
| Size | 11 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 11. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
