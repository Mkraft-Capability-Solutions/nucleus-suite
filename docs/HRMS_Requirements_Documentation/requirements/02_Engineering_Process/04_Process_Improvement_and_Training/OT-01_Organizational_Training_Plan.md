<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# OT-01 — Organisational Training Plan (Delivery Team)

| Attribute | Value |
| :--- | :--- |
| Document ID | OT-01 |
| Title | Organisational Training Plan (Delivery Team) |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | EPG Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | Programme Manager, Chief Architect, PQA Lead, DPO, Head of AI — *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | OT, PCM, II |
| Related documents | PCM-01, QA-02, QA-03, MPM-01, CAR-01, GOV-10, GOV-11, OCM-02 |
| Quality & process-performance objectives | QPPO-05 (effective reviews), QPPO-02 |
| Process performance baseline used | PPB-01, PPB-02 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose and Scope

Defines how the **delivery organisation** (product, engineering, QA, architecture, governance roles and supplier staff working on the programme) acquires the skills and knowledge needed to perform its roles effectively and to follow the defined process up to CMMI ML5.

End-user (customer) training is **out of scope** and is covered by OCM-02.

## 2. Training Needs Identification

Needs are identified from:

1. Role definitions and responsibilities in governance documents (GOV-04, GOV-07).
2. The standard process set (PCM-01 §2.2) — each process lists roles requiring training.
3. Domain knowledge needed for the 14 process domains.
4. Technology stack and architecture decisions (DAR-02).
5. CAR root causes in category RC-KNOW (CAR-01 §4.1) and PQA findings.
6. Annual and phase-start skills self-assessments.

## 3. Training Catalogue

| ID | Course | Audience (roles) | Mandatory? | Format | Duration (indicative) | Due |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OT-C01 | Nucleus Suite process overview (standard process, gates, document control, ID scheme, tailoring, anti-repeat-work rule) | All | Yes | Workshop + PAL walkthrough | 3 h | Within 2 weeks of joining |
| OT-C02 | Requirements engineering (the standard artefact formats (DOC-01 §4), REQ-03 quality criteria, traceability, golden-dataset references) | BAs, Product Owners, domain SMEs | Yes | Workshop + exercise | 6 h | Before authoring |
| OT-C03 | Peer review and inspection (roles, checklists incl. R-5, base measures, review rates, re-review rule) | All reviewers and moderators | Yes (moderators: + practicum) | Workshop + supervised inspection | 4 h | Before first review |
| OT-C04 | Configuration and change management (CM-01, CM-02) | All | Yes | e-learning | 1.5 h | Within 2 weeks |
| OT-C05 | Risk, RAID and decision analysis (RSK-01, DAR-01) | Leads, managers | Yes | Workshop | 3 h | Before P0 |
| OT-C06 | Measurement and statistical process control (operational definitions, XmR/u-charts, special-cause rules, capability, PPMs, Monte Carlo forecasting) | Measurement Analyst, EPG, sub-process owners, leads | Yes for listed roles | Workshop + practice on programme data | 8 h | Before P1 |
| OT-C07 | Causal analysis facilitation (5 Whys, fishbone, Pareto, fault tree, evaluating effect) | CAR facilitators, EPG, QA leads | Yes for listed roles | Workshop | 4 h | Before P1 |
| OT-C08 | PQA auditing (QA-01, QA-04, objective evidence, rating) | PQA staff | Yes | Workshop + shadow audit | 6 h | Before first audit |
| OT-C09 | HCM domain foundations (worker lifecycle, organisation model, effective dating, approvals) | All product and engineering | Yes | Workshop series | 6 h | First month |
| OT-C10 | India statutory payroll and labour compliance (PF, ESI, PT, LWF, TDS regimes, Code on Wages, Factories Act registers, gratuity, F&F) | PAY, CMP, TIM, LVE, CMB, FIN teams; QA | Yes for listed teams | Workshop by statutory SME + golden-case exercises | 10 h | Before P1 |
| OT-C11 | Time, attendance and plant operations (shifts, cross-midnight, OT, gate passes, offline capture) | TIM, CTG, PAY teams | Yes for listed teams | Workshop + site visit where possible | 4 h | Before P1 |
| OT-C12 | Privacy by design (DPDP Act 2023, GDPR principles, data minimisation, synthetic data rule, logging hygiene) | All | Yes | e-learning + quiz | 2 h | Within 2 weeks |
| OT-C13 | Secure development (threat modelling, OWASP ASVS, tenant isolation, authorisation server-side, secrets handling) | Engineers, architects, QA | Yes | Workshop + labs | 6 h | Before P0 coding |
| OT-C14 | Responsible AI and AI safety (GOV-11, human-in-the-loop, bias, grounding, prompt injection, agent permission model seam S-11, evaluation) | INT team, all engineers touching AI, Product Owners | Yes for INT; awareness for all | Workshop + red-team exercise | 4 h (awareness 1 h) | Before P2 |
| OT-C15 | Accessibility (WCAG 2.2 AA, keyboard, screen readers, charts and data tables) | UX, front-end, QA | Yes | Workshop + labs | 3 h | Before P1 |
| OT-C16 | Internationalisation and localisation (11 languages, RTL Arabic, locale formats, string externalisation) | UX, front-end, QA | Yes | Workshop | 2 h | Before P1 |
| OT-C17 | Technology stack (server-rendered TypeScript web framework, component library, design tokens, data boundary, test tooling; backend framework per OD-01 outcome) | Engineers | Yes | Self-paced + pairing | Varies | Before first story |
| OT-C18 | Golden-dataset reconciliation and test automation (HRMS Demo Dataset v1.1, harness, triage rules) | QA, domain engineers | Yes | Workshop + lab | 3 h | Before P1 |
| OT-C19 | Shared components and seams (CMP-nn consumer guides, seam contracts S-01..S-12) | Engineers, architects, BAs | Yes | Workshop | 2 h | Before P0 build |

Courses are versioned process assets (PAL-10). When a process asset changes through a deployment (PCM-01 §7.4), affected courses are updated and delta training is scheduled.

## 4. Role-Based Curriculum (minimum)

| Role | Required courses |
| :--- | :--- |
| All team members | C01, C04, C09, C12, C19 |
| BA / Product Owner / domain SME | + C02, C03, C05; domain courses (C10/C11) as relevant |
| Engineer | + C03, C13, C15, C16, C17; C14 awareness |
| QA engineer | + C03, C13, C15, C16, C18 |
| Architect | + C03, C05, C13, C14 |
| Measurement Analyst / EPG | + C06, C07 |
| PQA | + C08, C06 (awareness) |
| Moderator | C03 with supervised practicum |
| INT (AI) team | + C14 full |
| Supplier staff | Same as equivalent internal role (SAM-01 §8) |

## 5. Delivery

- Mix of instructor-led workshops, self-paced material, labs on synthetic data, pairing and shadowing.
- Domain SMEs and statutory experts deliver C10/C11; external trainers may be engaged under SAM-01 (SC-07).
- No real personal data is used in training material.

## 6. Training Records

| Field | Content |
| :--- | :--- |
| Person (identifier) | Internal identifier |
| Role | |
| Course ID and version | |
| Date completed | |
| Assessment result (where applicable) | |
| Waiver (if any) | Reason, approver (EPG Lead) — e.g. demonstrated prior competence |

Records are kept by the EPG Lead for programme life + 3 years. Completion is tracked as MET-28.

## 7. Effectiveness Evaluation

| Level | Method | When |
| :--- | :--- | :--- |
| Reaction | Short participant feedback | End of course |
| Learning | Quiz or practical exercise (e.g. classify review defects; build an XmR chart from sample data; compute a statutory golden case) | End of course |
| Behaviour | PQA audit observations; peer review data (e.g. reviews within PPB-02 limits after C03); reduction in RC-KNOW causes | 1–3 months after |
| Results | Effect on related measures (e.g. MET-09 review effectiveness, MET-06 requirement defect rate) analysed by the Measurement Analyst | Quarterly |

Courses with weak effectiveness are revised through the improvement pipeline (PCM-01 §7.2).

## 8. Training Plan Schedule (initial)

| Window | Focus |
| :--- | :--- |
| R0 (now) – start of P0 | C01, C04, C05, C12, C13, C17, C19 for core team; C03 and C08 for moderators and PQA |
| P0 (wk 1–8) | C02, C09, C06, C07; C10/C11 for P1 domain teams |
| P1 (wk 9–24) | C15, C16, C18; refreshers from CAR/PQA findings |
| P2 (wk 25–40) | C14 full for INT; pilot-site familiarisation |
| Each phase start | Delta training for process changes; onboarding for new joiners |

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
| Size | 9 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 9. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
