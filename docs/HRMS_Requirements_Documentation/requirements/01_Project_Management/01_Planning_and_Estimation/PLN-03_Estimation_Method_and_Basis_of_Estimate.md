<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# PLN-03 — Estimation Method and Basis of Estimate

| Attribute | Value |
| :--- | :--- |
| Document ID | PLN-03 |
| Title | Estimation Method and Basis of Estimate |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Delivery Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | Programme Manager, PMO Analyst, PQA Lead — *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | EST, PLAN, MPM, CAR |
| Related documents | PLN-01, PLN-02, MPM-01, CAR-01, RSK-01, CM-01 |
| Quality & process-performance objectives | QPPO-04 (predictable phase delivery) |
| Process performance baseline used | PPB-05 (story cycle time), PPM-02 (Monte Carlo phase forecast) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

This document sets the **repeatable method** used to estimate size, effort, duration and cost for Nucleus Suite work, and the **basis-of-estimate (BoE)** record that every baselined estimate must carry. Without a documented method and data basis, estimates cannot be compared, calibrated or audited (CMMI EST).

## 2. Estimation Levels

| Level | Purpose | Granularity | Method | When | Accuracy target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| L1 Rough Order of Magnitude (ROM) | Roadmap and funding | Phase / domain / epic | Analogy + T-shirt sizing | G0 | −25% / +75% |
| L2 Budgetary | Phase baseline | Epic / WBS level 3 | **Bottom-up roll-up of `18_Build_Backlog` effort-days**, cross-checked with function points or three-point PERT | G1 (P0–P1), each phase mini-cycle G1 | −15% / +30% |
| L3 Definitive | Sprint / PI commitment | Backlog story BL-nnn / task | Story points (planning poker), reconciled to BL effort-days | PI planning | −10% / +15% |

### 2.1 Bottom-up source: the build backlog

The source workbook's `18_Build_Backlog` (imported into `requirements/12_Release_and_Backlog`) is the **authoritative bottom-up estimate source**. Each `BL-nnn` story carries an epic, domain, phase, reusable component (CMP-nn), dependencies, **effort in days**, and a DoD.

Rules:
1. Phase budgets (L2) = Σ BL effort-days for that phase + add-ons (§4.5) + contingency (§7).
2. BL effort-days are **not** overwritten. Re-estimates are recorded alongside (`BL effort (source)` vs `BL effort (re-estimated)`) with a BoE reference, so calibration against the source stays visible.
3. New stories we author use `<DOM>-US-nnn` and are estimated with §4 methods.
4. **Anti-repeat-work rule (PLN-02 §2.2):** shared components (approval chain, ledger, eligibility service, recompute worker, document renderer, rule pack evaluator, blocking-item lock, scope resolver, outbox, effective-dated write, tool surface) are estimated **once**, under WBS 2.x. A domain story whose estimate includes re-implementing one of them is a design defect. It is sent back with the effort for that behaviour removed and the CMP-nn dependency added. Integration effort for *consuming* a component stays in the domain story.

## 3. Size Units

| Unit | Used for | Notes |
| :--- | :--- | :--- |
| Story points (SP) | User stories | Fibonacci scale 1, 2, 3, 5, 8, 13. Stories > 13 must be split. Relative to squad reference stories (§4.1). |
| Effort-days (source) | Backlog stories BL-nnn | As supplied in `18_Build_Backlog`; the primary bottom-up unit |
| Function points (FP, ISO/IEC 20926 counting) | Functional size of domain packs at G1 | Counted from processes (DOM-nn), forms (FRM-<MOD>-nn), screens (SCR-nnn) and rules (RL-nnn): external inputs, outputs, inquiries, internal logical files, external interface files |
| T-shirt (XS–XXL) | Epics at roadmap level | Mapped to SP ranges in §4.1 |
| Requirement count | Sanity check | FR + BR + NFR count per module |
| AI feature complexity class | AI features | Class A (prompted retrieval), B (fine-tuned / tool-using), C (autonomous agent with transactions). Adds evaluation and governance effort. |

## 4. Estimation Methods

### 4.1 Story points (relative estimation)

- Each squad keeps **reference stories** for 1, 3, 5 and 8 SP, recorded in the estimate repository (§10).
- Estimation is by planning poker with the whole squad. Large divergence (max/min > 3×) triggers discussion and re-vote.
- T-shirt to SP mapping for epics: XS ≤ 8, S 9–20, M 21–50, L 51–100, XL 101–200, XXL > 200 (must be split before G1).

### 4.2 Function point analysis

Used at G1 to size domain packs and to normalise productivity across squads and phases. Counting follows ISO/IEC 20926 rules with a fixed mapping to the source identifiers: each form (FRM-<MOD>-nn) counts as an external input, each report or output screen as an external output, each enquiry screen as an external inquiry, each data object in the domain data model as an internal logical file and each integration flow as an external interface file. The EPG keeps worked counting examples in the estimate repository (§10). Counts are peer reviewed (QA-02).

### 4.3 Three-point (PERT) estimation

For each WBS level-3 element, expected effort **E = (O + 4M + P) ÷ 6** and standard deviation **σ = (P − O) ÷ 6**, where:

- O = optimistic, M = most likely, P = pessimistic (effort in person-days)
- Estimates from at least **two independent estimators** are reconciled
- Phase-level σ is aggregated as √Σσ² (independence assumed; correlated risks are handled in contingency)

### 4.4 Analogy

Used for ROM and to cross-check L2 estimates. Comparable work is drawn from:
1. completed Nucleus Suite phases (once historical data exists)
2. the R0 prototype build effort as a calibration point for UI-only work

Adjustment factors (complexity, compliance, integration, AI) are recorded in the BoE.

### 4.5 Specialised effort add-ons

| Work type | Additional effort considered |
| :--- | :--- |
| Statutory / compliance logic (payroll, factory registers) | Rule research, golden test datasets, parallel-run effort |
| Integrations | Partner sandbox access delays, contract testing |
| AI features | Dataset curation, evaluation harness, red-teaming, model card, DAEB review (GOV-11) |
| Data migration | Profiling, mapping, mock loads ×3, reconciliation |
| i18n | 11-language string externalisation and translation review |
| Accessibility | WCAG verification |

### 4.6 Maturity evolution — from analogy/PERT to PPB-calibrated and Monte Carlo (ML4/ML5)

Estimation matures in three stages as data accumulates. The stage in use is recorded on every BoE.

| Stage | When | Effort method | Schedule method | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| E1 — Expert / analogy | R0, early P0 (no project history) | BL effort-days (source) + three-point PERT + analogy | Deterministic critical path + PERT σ | BoE with ranges |
| E2 — Calibrated | After ≥ 3 sprints of P0 actuals per squad | BL effort-days × **source-to-actual ratio from the PPB** (median and spread per domain and story type) | PERT with calibrated σ | PPB version cited on BoE |
| E3 — Predictive (quantitative) | When PPBs are stable (no special-cause signals over ≥ 2 PIs) | **PPM-based**: regression or distribution models from MPM-01 (e.g. effort ~ size + domain + CMP reuse count + volatility) | **Monte Carlo simulation** of the phase backlog | P50/P80/P90 dates and costs with probability of meeting each QPPO |

**Monte Carlo schedule prediction (E3):**
1. Inputs:
   - the BL backlog for the phase, with its dependency graph
   - per-story effort distributions sampled from the PPB (actual-to-source ratio distribution × BL effort-days)
   - squad velocity distribution from the PPB
   - a risk-event list from RSK-02, each with its probability and impact distribution
   - requirement-volatility injection drawn from the volatility PPB (REQ-01 §13)
2. Run ≥ 10,000 iterations, respecting dependencies and shared-component sequencing (CMP-nn before consumers).
3. Outputs: completion-date and effort distributions, P50/P80/P90, critical-path criticality index per BL/CMP, and the probability of meeting the schedule QPPO.
4. Commitments are made at the confidence level required by the QPPO (§7). If that probability is below target, re-plan before commitment (PLN-01 §9.1).
5. Re-run at every sprint review and whenever a re-estimation trigger (§8) fires. Prediction error (predicted vs actual) is itself tracked as a PPB, so the model's accuracy is known.

**Calibration governance:**
- PPB/PPM versions are configuration items (CM-01). Estimates cite the version used.
- A shift in a PPB, such as a process change from a CAR-01 action, triggers recalibration. Estimates made on the old baseline are flagged.
- Estimation error outside PPB limits for a domain is a CAR-01 trigger.

## 5. Productivity and Calibration Parameters

Initial values are planning assumptions derived from the RB-01 effort baseline (665 engineer-days across 79 stories for P0–P4, an average of 8.4 effort-days per story: P0 7.0, P1 7.1, P2 9.2, P3 13.1, P4 18.7). They are used only with the contingency in §7 until replaced by calibrated values.

| Parameter | Value | Source |
| :--- | :--- | :--- |
| Squad velocity (SP / sprint) | Initial 35 SP per two-week sprint for a five-engineer squad (50 person-days × focus factor 0.7, with 1 SP ≈ 1 BL effort-day for the reference stories) | RB-01; replaced by the median of the first 3 P0 sprints |
| Source-to-actual ratio (actual days ÷ BL effort-days) | Initial 1.0 (BL effort-days used as given; per-story averages above) | RB-01; replaced by the median P0 ratio per domain and story type |
| Effort per FP (person-hours / FP) | Initial value fixed at P0 G1 as (397 BL effort-days for P0–P1 × 8 person-hours) ÷ counted FP of the P0–P1 scope | RB-01 and G1 FP count; recalibrated with P0–P1 actuals |
| Defect injection rate (defects / FP) | Planning assumption 0.5 defects per FP | Replaced by the observed rate after the first P0 increment (PPB-06) |
| Test effort ratio (test : build) | Initial 0.35 added to BL effort-days, because RB-01 effort excludes QA (≈ 233 test effort-days across P0–P4) | Replaced by timesheet actuals after 3 sprints |
| AI evaluation effort per class A/B/C | Initial add-on to story effort: class A +10%, class B +25%, class C +40% | Replaced by AI squad actuals per class after the first P2 AI feature |
| Focus factor (productive hours / available hours) | Initial 0.7 | Delivery Lead planning assumption; replaced by measured capacity after 3 sprints |

Calibration rule: each initial value is replaced by the median of observed actuals once at least 3 sprints or 20 completed stories exist for the squad or domain; a change of more than ±20% from the value in use triggers a re-plan (§8) and an EPG review. These parameters become PPBs in MPM-01 (stage E2/E3, §4.6). The PMO Analyst recalculates them at each PI end and each G5 and records them in the estimate repository. Changes go to the EPG as process-asset updates (PCM-01).

## 6. Estimation Procedure

1. **Scope the item:** confirm the WBS element / epic, its BL-nnn stories, its sources (DOM-nn, RL-nnn, SCR-nnn, FRM) and its assumptions.
2. **Check reuse:** list the shared components (CMP-nn) consumed. Remove any re-implementation effort (§2.1 rule 4).
3. **Select the method** using §2 and §4.
4. **Size** the item (BL effort-days roll-up / SP / FP / T-shirt).
5. **Derive effort** from size and productivity parameters, or with three-point estimation.
6. **Apply add-ons** (§4.5) and complexity adjustments.
7. **Derive duration and cost:** effort ÷ capacity, and effort × blended rate (rate cards are held by the PMO Analyst under restricted access and are not reproduced here) + non-labour costs (cloud, AI inference, licences).
8. **Determine confidence and contingency** (§7).
9. **Peer review** the estimate (QA-02): an independent estimator compares it by analogy.
10. **Record the BoE** (§9) in the repository and place it under configuration control (CM-01).
11. **Commit:** the estimate is accepted by the owner and by the Programme Manager, then baselined at the gate.

## 7. Confidence Levels, Contingency and Management Reserve

| Confidence | Meaning (E1/E2: PERT approximation; E3: Monte Carlo percentile) | Use |
| :--- | :--- | :--- |
| P50 | 50% probability of not being exceeded (= PERT E) | Squad-level planning |
| P80 | E + 0.84σ | Phase baseline commitments |
| P90 | E + 1.28σ | Regulatory-deadline items (e.g. statutory changes) |

**Contingency (held by the Programme Manager):**
- Risk-based: Σ (probability × cost impact) of open risks in RSK-02 attributed to the phase
- Floor of 10% of baselined effort
- Released only through a documented PM decision, which is reported to the SteerCo

**Management reserve (held by the SteerCo):**
- For unknown-unknowns. Set at 10% of phase budget and confirmed by the SteerCo at each phase G1
- Drawn only through an approved CR (CM-02)

## 8. Re-estimation Triggers

- Approved CR changes scope by > 5% of FP, SP or BL effort-days for the phase
- Actual velocity differs from planned by > 20% over 2 sprints
- SPI or CPI < 0.90 for two reporting periods (MC-01)
- A materialised risk with exposure ≥ 15 (RSK-01)
- Technology or architecture decision changes (new DAR record)
- Transition from the R0 prototype to P0 Foundations (DEC-0002)
- New or changed `18_Build_Backlog` import
- Closure of an open decision (OD-nn) that changes the technical approach
- Regulatory change affecting payroll or statutory logic

## 9. Basis of Estimate (BoE) Record

| Field | Content |
| :--- | :--- |
| BoE ID | `BOE-<phase>-<WBS ID>` e.g. `BOE-P1-3.5` |
| WBS element / epic | |
| Sources covered | BL-nnn, DOM-nn, RL-nnn, SCR-nnn, FRM, new `<DOM>-FR-nnn` |
| Shared components consumed | CMP-nn list (no re-implementation) |
| BL effort (source) vs re-estimate | days / days |
| Estimator(s) | Roles |
| Method and maturity stage | SP / FP / PERT / analogy / PPB-calibrated / Monte Carlo; stage E1/E2/E3 (§4.6) |
| PPB / PPM version used | e.g. PPB-EFF-v2, PPM-SCHED-v1 (MPM-01) |
| Probability of meeting QPPO | E3 only |
| Size | Value + unit |
| Assumptions | List (each mirrored to RSK-03 as `RSK-A-nnn` if material) |
| Exclusions | |
| Productivity parameters used | Values + source/version |
| Add-ons | §4.5 items applied |
| Effort (O / M / P / E / σ) | person-days |
| Confidence level committed | P50 / P80 / P90 |
| Duration | weeks |
| Non-labour cost | cloud / AI inference / licences |
| Contingency | Value and rationale |
| Risks referenced | RSK-R IDs |
| Peer reviewer and result | PR record ID |
| Version / date | |

## 10. Estimate Repository

- Location: an `estimates/` folder beside this plan in `01_Project_Management/01_Planning_and_Estimation/`, opened with the first L2 estimate at P0 G1; BoE records are Markdown under configuration control (CM-01).
- Contents: BoE records, reference stories per squad, calibration parameters (§5), actuals vs estimates per phase (and vs BL source effort-days).
- Owner: PMO Analyst.
- Used by MPM-01 for estimation accuracy indicators (estimate vs actual variance).

## 11. Worked Example — ILLUSTRATIVE ONLY

> **Illustrative.** These numbers demonstrate the method. They are not an estimate for Nucleus Suite and must not be quoted or baselined.

**Item:** WBS 3.3 (TIM) — "Gate pass request and approval" (P1)

| Step | Illustrative value |
| :--- | :--- |
| Sources | e.g. process TIM-nn (gate pass), rule RL-nnn (quota 240 min / 2 instances per month), screen SCR-nnn, backlog BL-nnn |
| Shared components consumed | Approval chain, Ledger (quota), Rule pack evaluator — **not** re-implemented (anti-repeat-work rule) |
| BL effort (source) | e.g. 12 days (illustrative) |
| Estimator A (O / M / P) | 8 / 12 / 22 person-days |
| Estimator B (O / M / P) | 9 / 14 / 24 person-days |
| Reconciled (O / M / P) | 8 / 13 / 23 |
| E = (8 + 4×13 + 23) / 6 | 13.8 person-days |
| σ = (23 − 8) / 6 | 2.5 person-days |
| Add-ons: i18n (11 languages), approval-chain integration (consume, not rebuild) | +2.0 person-days |
| Adjusted E | 15.8 person-days |
| P80 = E + 0.84σ | 15.8 + 2.1 = **17.9 person-days** committed |
| Cross-check by analogy and vs BL source | Similar to "attendance regularisation request"; 15.8 vs 12 BL days = +32% → variance > 20% recorded in BoE with rationale, flagged for calibration |

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
