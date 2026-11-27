<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# OCM-02 — End-User Training and Enablement Plan

| Attribute | Value |
| :--- | :--- |
| Document ID | OCM-02 |
| Title | End-User Training and Enablement Plan |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | OCM Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | Capability / L&D Lead, Product Owners — *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | OT, PLAN, MPM, CAR |
| Related documents | GOV-08, GOV-10, OCM-01, OT-01, QA-03 |
| Quality & process-performance objectives | Adoption and training-effectiveness measures (MEA-OCM, MEA-TRN) feeding MPM-01 |
| Process performance baseline used | n/a until adoption data exists (P2) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03, BG-02 |

---

## 1. Purpose and Scope

This plan covers how **end users** of Nucleus Suite (personas PER-01 to PER-15) are trained and supported to work proficiently.

Training for the **delivery team** — engineers, BAs, testers — is covered separately in OT-01.

The plan covers phases P0–P5, with the first full rollout at the P2 pilot (reference tenant: fictional **Vindhya Precision Industries Pvt Ltd**, 5 sites, 4 states).

## 2. Training Needs Analysis (by Persona)

Proficiency levels: **Aware** (knows what exists) → **Operator** (does routine tasks) → **Expert** (handles exceptions, configures, coaches).

| Persona | Target proficiency | Core competencies | Priority domains |
| :--- | :--- | :--- | :--- |
| PER-01 CHRO | Aware → Operator | S1 console, analytics queries, scenario simulation, AI explanation reading | INT, EXP |
| PER-02 HRBP | Expert | Effective-dated lifecycle actions, case management, approvals, data privacy handling | PPL, LCY, LVE, SSV |
| PER-03 Plant Supervisor | Operator → Expert | Shift board, punch regularisation, gate passes, overtime approval, muster roll, offline mode | TIM, LVE, CTG, CMP |
| PER-04 TA Lead | Expert | Requisition-to-offer, AI-assisted screening with HITL, fairness flags | TAL |
| PER-05 Finance Controller | Operator | Payroll lock, variance review, ERP outbox, GL reconciliation | PAY, FIN |
| PER-06 Calibration Lead | Expert | 9-box session facilitation, distribution variance, bias flags | TAL |
| PER-07 Line Manager | Operator | Approvals inbox, team coverage, feedback, goals | TIM, LVE, TAL |
| PER-08 Employee | Operator | Self-service (punch, leave, payslip, profile), Policy Assistant, consent dashboard | SSV, LVE, PAY, EXP |
| PER-09 Capability Lead | Expert | Skills ontology, curricula, compliance assignments | TAL |
| PER-10 Super Admin | Expert | Access control, workflow designer, integrations, agent tool-permission configuration, kill-switch | PLT, INT |
| PER-11 Contract Worker | Operator (assisted) | Kiosk / voice / business messaging: check hours and wages, payslip, grievance | SSV, TIM, CTG |
| PER-13 Payroll Admin | Expert | 8-stage control room, statutory deductions, exceptions | PAY, CMP, CMB |
| PER-14 DPO | Expert | Rights requests, DPIA workflow, breach register, action-ledger review | PLT, INT |
| PER-15 Auditor | Aware | Read-only audit workspace, evidence export | PLT |

Mandatory for **all** personas who handle others' data: a privacy and data-handling module (GOV-10), and AI-use awareness (GOV-11) for anyone using copilot or agents.

## 3. Curricula and Learning Paths

| Path | Audience | Modules (duration) | Prerequisite |
| :--- | :--- | :--- | :--- |
| LP-01 Nucleus Essentials | All users | Navigation & consoles (15 min); Nucleus Talk basics (10 min); privacy essentials (15 min) | — |
| LP-02 Employee Self-Service | PER-08 | Punch, leave, payslip, profile, Policy Assistant (45 min micro-learning) | LP-01 |
| LP-03 Frontline Assisted | PER-11 | Kiosk / voice / business messaging walkthrough (20 min, audio-visual, classroom at shift start) | — |
| LP-04 Manager | PER-07 | Approvals, coverage, feedback, AI suggestions and when to override (90 min) | LP-01 |
| LP-05 Plant Operations | PER-03 | Shift board, exceptions, gate passes, overtime, offline sync, location scope and salary masking (3 h classroom + floor practice) | LP-01 |
| LP-06 HR Operations | PER-02 | Lifecycle, effective dating, case management, data privacy (1 day) | LP-01 |
| LP-07 Payroll Control Room | PER-13, PER-05 | 8 stages, statutory, exceptions, lock, ERP outbox (2 days, includes parallel-run practice) | LP-06 (core concepts) |
| LP-08 Talent & Calibration | PER-04, PER-06, PER-09 | ATS, AI screening with HITL, calibration, skills (1 day) | LP-01 |
| LP-09 Platform Administration | PER-10 | Access control, workflow designer, integrations, agent guardrail configuration (2 days) | LP-01 |
| LP-10 Privacy & AI Governance | PER-14, DAEB members | Rights handling, DPIA, action ledger, AI monitoring (1 day) | LP-01 |
| LP-11 Train-the-Trainer | Champions, super-users | Facilitation, troubleshooting, feedback capture (1 day) | Role path |

## 4. Modalities

| Modality | Use | Notes |
| :--- | :--- | :--- |
| In-app guidance | Contextual walkthroughs, tooltips, "what's new" tours | Configurable per tenant; localised |
| Nucleus Talk voice tutorials | Spoken step-by-step help ("How do I apply for leave?") | Primary for frontline and low-literacy users |
| Micro-learning | 2–5 minute videos and quizzes | Delivered through the TAL learning module, so completions are tracked |
| Classroom (plant floor) | Shift-start sessions, hands-on kiosk practice | Run by plant champions in the local language |
| Virtual instructor-led | HR, payroll, admin paths | Recorded for later joiners |
| Sandbox practice | Realistic scenarios on synthetic data | See §6 |
| Job aids | Pictorial one-pagers, laminated kiosk cards, quick-reference PDFs | Printed for the plant floor |
| Train-the-trainer | Cascades through champions | LP-11 |

## 5. Languages and Accessibility

- Content is delivered in the tenant-enabled subset of the 11 supported languages. Plant and frontline content is prioritised in the regional languages of the pilot sites.
- Native-speaker review is required for all frontline content.
- Videos have captions and transcripts. Screen-reader-compatible e-learning meets WCAG 2.2 AA.
- Audio-first options are provided for low-literacy users.

## 6. Training Environment and Data

- A dedicated training tenant per customer, refreshed before each training wave.
- **Synthetic data only** — modelled on the Vindhya reference organisation (legal entities, sites, shifts, contract workers). Production data must never be used (GOV-10 §13).
- Scripted scenarios for each learning path, e.g. a night-shift missed punch, a mid-month transfer, a payroll exception, or a Policy Assistant leave request with confirmation.
- AI features in training run with the same guardrails as production, so users practise confirmation and approval steps.

## 7. Schedule (Aligned to Phases)

| Phase | Training focus | Audiences | Timing |
| :--- | :--- | :--- | :--- |
| R0 (current prototype) | Demo walkthroughs for stakeholder validation only | SteerCo, Product Council, champions | Ongoing |
| P0 Foundations (wk 1–8) | Build curricula; train champions on platform basics | Champions, super-users | Wk 5–8 |
| P1 Core HRMS (wk 9–24) | LP-01, LP-06, LP-04, LP-05, LP-07 (pre-pilot), LP-09 | HR, payroll, managers, plant, admins at pilot entities | Final 4 weeks of P1 |
| P2 Pilot & Intelligence (wk 25–40) | Pilot rollout: LP-02, LP-03 at pilot sites; Policy Assistant and AI awareness; hypercare coaching | All pilot users | Before pilot go-live + hypercare |
| P3 Depth (wk 41–64) | LP-08, LP-10; advanced payroll / compliance; wave rollouts | Talent, DPO, further sites | Per wave |
| P4 Scale (wk 65–96) | Scaled cascade through champions; new-joiner onboarding embedded | All tenants / sites | Continuous |
| P5 Frontier | Enablement for new futuristic capabilities as approved | Per feature | Per feature release |

## 8. Assessment and Certification

| Path | Assessment | Pass mark | Certification |
| :--- | :--- | :--- | :--- |
| LP-02, LP-03 | Practical task check (assisted for LP-03) | Task completed | Completion badge |
| LP-04, LP-05 | Scenario quiz + observed task | 80% | Operator |
| LP-06, LP-07, LP-08 | Scenario-based assessment in sandbox | 85% | Expert |
| LP-09, LP-10 | Practical configuration / governance exercise | 90% | Expert (required before access to production admin functions) |
| LP-11 | Teach-back observed by OCM Lead | Pass | Certified trainer |

Access to high-risk functions (payroll lock, admin configuration, agent tool permissions) requires the relevant certification. This is enforced as an access prerequisite in the PLT requirements.

## 9. Effectiveness Measurement (Kirkpatrick)

| Level | Measure | Method | Target |
| :--- | :--- | :--- | :--- |
| 1 — Reaction | Satisfaction and relevance | Post-session survey | ≥ 4 / 5 |
| 2 — Learning | Knowledge and skill gain | Pre/post assessment | ≥ 20-point gain; pass marks in §8 |
| 3 — Behaviour | Correct use on the job | Product analytics (task success, error and rework rates), floor observation | Task success ≥ 90% at day 30 |
| 4 — Results | Business outcomes | Adoption KPIs (OCM-01 §9): helpdesk volume, approval SLA, punch coverage, payroll accuracy | Targets met at day 90 |

### 9.1 Quantitative Measure Specifications (Input to Process-Performance Baselines, MPM-01)

Training effectiveness is measured quantitatively to support CMMI Maturity Level 5 (BG-09). Each measure is registered in the MPM-01 catalogue. A PPB is set after at least 20 subgroups (cohort × path). Special-cause signals trigger CAR on content, delivery or trainer.

| Measure ID | Operational definition | Unit | Subgroup & frequency | Data source | Control chart | Target | Process-performance model (PPM) use |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MEA-TRN-01 Training completion before go-live | Users who completed the mandatory path by go-live − 1 day / users in scope | % | Path × site × wave | TAL learning records | p-chart | ≥ 95% | Readiness gate input (G4) |
| MEA-TRN-02 Learning gain | Post-assessment score − pre-assessment score, per learner | points | Path × cohort | Assessment engine | X̄-R chart | Mean ≥ 20 points | Predictor of MEA-TRN-03 |
| MEA-TRN-03 Day-30 task success | Successfully completed tasks without assistance or rework / attempted tasks, for trained users | % | Persona × site × week | Product analytics (anonymised) | p-chart | ≥ 90% | Model: task success = f(learning gain, modality, language) — used to choose modality per persona |
| MEA-TRN-04 Post-training how-to ticket rate | How-to tickets in the first 30 days / 100 trained users | tickets per 100 users | Cohort | SSV helpdesk | u-chart | ≤ 5 | Links to MEA-OCM-05 |
| MEA-TRN-05 First-attempt pass rate | Learners passing on first attempt / learners assessed | % | Path × trainer | Assessment engine | p-chart | ≥ 85% | Trainer / content quality signal for CAR |
| MEA-TRN-06 Reaction score | Mean post-session rating | score 1–5 | Session | Survey | X̄-S chart | ≥ 4.0 | Leading indicator only (not used alone for decisions) |

## 10. Support Model

| Tier | Provider | Channel | Scope |
| :--- | :--- | :--- | :--- |
| 0 — Self-help | In-app guides, Policy Assistant, Nucleus Talk | App, voice, business messaging | How-to and policy questions |
| 1 — Champions / super-users | Local champions | In person, chat | Usage help, triage |
| 2 — HR / SSV helpdesk | HR service desk | SSV tickets | Process and data issues |
| 3 — Product support | Nucleus Suite support team | Ticketing system with SLA | Defects, configuration |

Training material is refreshed for every phase release. Ownership: the OCM Lead, with domain Product Owners as content reviewers.

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Product Council | *pending* | | | |

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
