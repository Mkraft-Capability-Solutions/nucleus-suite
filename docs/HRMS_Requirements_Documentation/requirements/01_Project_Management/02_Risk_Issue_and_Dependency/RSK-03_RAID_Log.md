<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# RSK-03 — RAID Log (Issues, Actions, Assumptions, Dependencies)

| Attribute | Value |
| :--- | :--- |
| Document ID | RSK-03 |
| Title | RAID Log — Issues, Actions, Assumptions, Dependencies |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Programme Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | Workstream leads — *pending* |
| Approved by | Not baselined (living register) |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | MC, RSK, PLAN |
| Related documents | RSK-01, RSK-02, MC-01, CM-02, DAR-02, SAM-01 |
| Quality & process-performance objectives | QPPO-04 (predictable phase delivery) |
| Process performance baseline used | PPM-02 (schedule risk input) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

Records the non-risk elements of RAID. **Risks** are held in RSK-02. This log holds:

- **Issues (RSK-I-NNN)** — problems that exist now and need resolution.
- **Actions (RSK-AC-NNN)** — assigned tasks arising from risks, issues, reviews, audits and meetings.
- **Assumptions (RSK-A-NNN)** — things held to be true for planning without proof; each must be validated or converted into a risk.
- **Dependencies (RSK-D-NNN)** — things the programme relies on from parties or work outside its direct control.

## 2. Rules

1. IDs are never reused. Closed items remain in the log.
2. Every item has an **owner role** and, where actionable, a **due date**.
3. Controlled documents contain no placeholders; unknowns are logged here as Actions with owner and due date until resolved (DOC-01 §10 rule 8).
4. Issues are prioritised P1 (blocking a gate or live service) / P2 (blocking a workstream) / P3 (degrades progress) / P4 (minor).
5. An assumption that is shown false becomes an issue; an assumption that is uncertain and material becomes a risk in RSK-02.
6. Dependencies with a delivery date are tracked against the plan (PLN-02); late dependencies are escalated per MC-01.
7. Items are reviewed in the fortnightly programme board (MC-01 §3).

## 3. Issues

### 3.1 Fields

| Field | Description |
| :--- | :--- |
| ID | RSK-I-NNN |
| Title / description | What is wrong, observed evidence |
| Raised by / date | Role, ISO date |
| Priority | P1–P4 |
| Impact | Objectives / releases / goals affected |
| Owner | Role |
| Resolution plan | Actions (RSK-AC links) |
| Target date | |
| Status | Open / In progress / Resolved / Closed |
| Root cause / CAR | Required for P1/P2 (CAR-01) |

### 3.2 Log

| ID | Title | Raised | Pri. | Impact | Owner | Resolution | Target | Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| RSK-I-001 | Governance documents v0.0 were cloned placeholders: 16 sub-documents across GOV-01..04 were identical apart from titles/IDs; no document control; duplicated requirement IDs | 2026-11-05 · Governance Workstream | P1 | G0 cannot be passed; no CMMI evidence for GOV/PLAN/RDM/CM | Programme Manager | Restructure into the full governance set registered in DOC-02; v0.0 content withdrawn and superseded through CR-0001 (CM-03); FR/BR-GOV-0x IDs retired | 2026-11-05 | **Resolved** — pending verification by PQA (RSK-AC-006) |
| RSK-I-002 | Functional domain packs (14 domains under 06_Functional_Requirements) not yet assessed against the domain pack structure (DOC-01 §3) | 2026-11-05 · Governance Workstream | P2 | G1 readiness for all domains | BA Lead | Gap assessment per domain (RSK-AC-007) | Before P0 G1 | Open |
| RSK-I-003 | Governance roles (owners, approvers, deputies) not yet assigned to named individuals | 2026-11-05 · Governance Workstream | P1 | No document can be approved; G0 blocked | Executive Sponsor | RSK-AC-001 | G0 | Open |

## 4. Actions

### 4.1 Fields

| Field | Description |
| :--- | :--- |
| ID | RSK-AC-NNN |
| Action | Verb-first, specific, verifiable |
| Source | RSK-R / RSK-I / NC / PR / meeting reference |
| Owner | Role |
| Due date | ISO date or named gate (for example G0, P1 G2) |
| Status | Open / In progress / Done / Cancelled |
| Evidence of completion | Document ID / link |

### 4.2 Log

| ID | Action | Source | Owner | Due | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RSK-AC-001 | Appoint named individuals and deputies to every governance role (SteerCo, PC, ARB, CCB, DAEB, EPG, PQA, Configuration Manager, DPO, risk owners) and record in GOV-07 | RSK-I-003, RSK-R-013 | Executive Sponsor | G0 | Open |
| RSK-AC-002 | Conduct G0 review of DOC-01, DOC-02, GOV-01, GOV-03, GOV-04, GOV-07, PLN-01, REQ-01, CM-01, CM-02, RSK-01, QA-01, QA-02, MPM-01, MC-01, DAR-01, PCM-01, SAM-01, OT-01 and baseline at v1.0.0 | Gate G0 | Programme Manager | G0 | Open |
| RSK-AC-003 | Confirm before each gate that controlled documents contain no placeholders and that every open sign-off (`*pending*`) and every unknown value is logged here as an action with owner and due date | DOC-01 §10 rule 8 | Configuration Manager | Before each gate | Open |
| RSK-AC-004 | Validate seed risks RSK-R-001..034 with named owners; re-score and add missing risks | RSK-02 | Programme Manager | First fortnightly review | Open |
| RSK-AC-005 | SteerCo to approve risk appetite statements (RSK-01 §7.1) and set contingency reserve approach | RSK-01 | Executive Sponsor | G0 | Open |
| RSK-AC-006 | PQA to verify closure of RSK-I-001 (audit restructured folder against QA-04 GOV/CM/PAD items) | RSK-I-001 | PQA Lead | Before G0 | Open |
| RSK-AC-007 | Assess the 14 domain packs (PLT, PPL, TIM, LVE, PAY, CMP, LCY, SSV, CMB, TAL, CTG, EXP, FIN, INT) against the domain pack structure (DOC-01 §3) and produce a per-domain gap list | RSK-I-002 | BA Lead | Before G1 plan baseline | Open |
| RSK-AC-008 | Identify authoritative sources for every statutory rule family (PF, ESI, PT per state, LWF, TDS, Code on Wages, Factories Act registers) and record in RSK-D-001 | RSK-R-001, RSK-R-012 | Payroll Domain Lead | Before PAY domain pack G1 | Open |
| RSK-AC-009 | Draft DPIA scope list (biometrics, AI recommendations, analytics, health-related leave data) | RSK-R-002, RSK-R-009 | Data Protection Officer | Before G1 | Open |
| RSK-AC-010 | Define fairness metrics and thresholds per AI feature and record in MPM-01 MET-14 | RSK-R-003 | Head of AI | Before P2 G1 | Open |
| RSK-AC-011 | Shortlist LLM providers using DAR-01 with SAM-01 AI contract terms as mandatory criteria | RSK-R-018, RSK-D-003 | Vendor Manager | Before P2 G1 | Open |
| RSK-AC-012 | Run first PQA process audit against QA-04 | QA-01 | PQA Lead | 30 days after G0 | Open |
| RSK-AC-013 | Log every open decision OD-nn in DAR-02 with decision owner, due date and the BL-nnn items it blocks (starting with OD-01 Node framework NestJS vs Fastify → BL-001) | RSK-R-026 | Programme Manager | Before P0 start | Open |
| RSK-AC-014 | Assign an owner pair and contract for each domain seam S-01..S-12; prioritise S-01, S-02, S-06, S-07, S-11 | RSK-R-004, RSK-R-014, RSK-R-023..025, RSK-R-028 | Chief Architect | Before G2 | Open |
| RSK-AC-015 | Publish the shared component consumer map (CMP-nn → consuming domains) and add the reuse check to the peer review checklist | RSK-R-027 | Chief Architect / PQA Lead | Before P0 start | Open |

## 5. Assumptions

### 5.1 Fields

| Field | Description |
| :--- | :--- |
| ID | RSK-A-NNN |
| Assumption | Statement held true |
| Basis | Why it is believed |
| Impact if false | Consequence |
| Validation method / owner / by when | |
| Status | Unvalidated / Validated / Invalid (→ issue) / Converted to risk |

### 5.2 Log

| ID | Assumption | Basis | Impact if false | Validation (owner, by) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RSK-A-001 | The current R0 stage remains a local JSON UI-validation prototype: all mutations in-memory, no production database, no external APIs, no live payroll or statutory filing | Current programme phase direction | Untested production behaviour enters customer use; privacy and security exposure | Programme Manager — re-confirmed at every SteerCo until G2 | Validated (current) |
| RSK-A-002 | Statutory scope for P0–P3 is India-first (central and state rules); other countries from P4 Scale | GOV-01 scope | Payroll and compliance scope expands; estimate invalid | Product Owner — G1 | Unvalidated |
| RSK-A-003 | Only synthetic data is used in R0 and in non-production environments | Data governance principle (GOV-10) | Personal data exposure in test environments | DPO — continuous, audited by PQA | Validated (current) |
| RSK-A-004 | Client-side role checks in the prototype are UX conveniences only; authorisation will be enforced server-side from P0 Foundations | Architecture principle | Security model rework | Chief Architect — G2 | Unvalidated |
| RSK-A-005 | Target customers accept a multi-tenant SaaS deployment model (with data residency in India for Indian tenants) | Market positioning | Need for single-tenant / on-premise variant; cost model change | Product Owner — G1 | Unvalidated |
| RSK-A-006 | Employment-affecting AI outputs will always be recommendations requiring human decision | GOV-11 principle | Legal and ethical exposure; RSK-R-003 escalates | Head of AI — G1 | Unvalidated |
| RSK-A-007 | Eleven interface languages (en, hi, mr, ta, te, bn, es, fr, de, ja, ar) are sufficient for P0–P3 | Current localisation scope | Additional language effort | Localisation Lead — G1 | Unvalidated |
| RSK-A-008 | Customer pilot site with plant workforce will be available for P2 Pilot & Intelligence | Programme intent | Frontline validation (BG-03) cannot be evidenced | Product Owner — before P2 start (week 25) | Unvalidated |
| RSK-A-009 | The expected results in the HRMS Demo Dataset v1.1 (fictional client Vindhya Precision Industries Pvt Ltd), including 21_Expected_Attendance, 68_Acceptance_Test_Data and 10_Acceptance_Tests, are correct and can serve as the golden reference for validation | Source workbooks authored with domain input | Golden reconciliation would certify wrong behaviour | Domain leads — SME re-verification of a sample per domain before P1 G3 | Unvalidated |

## 6. Dependencies

### 6.1 Fields

| Field | Description |
| :--- | :--- |
| ID | RSK-D-NNN |
| Dependency | What is needed |
| Direction | Inbound (we depend on) / Outbound (others depend on us) |
| Provider / consumer | Party (role or organisation type) |
| Needed by | Release / gate / date |
| Status | On track / At risk / Late / Delivered |
| Linked risk | RSK-R-xxx |

### 6.2 Log

| ID | Dependency | Dir. | Provider / consumer | Needed by | Status | Linked risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RSK-D-001 | Authoritative, current statutory rule sources (central and state labour/payroll notifications, tax rules) and a regulatory watch process | In | Statutory content provider or in-house compliance function | P1 G1 | At risk (source not yet named) | RSK-R-001, RSK-R-012 |
| RSK-D-002 | ERP partner sandboxes and voucher/journal format specifications (ERP system) | In | ERP partners / customer finance teams | P1 G2 | Not started | RSK-R-014 |
| RSK-D-003 | LLM / speech model provider with acceptable contractual AI terms and Indian-language support | In | AI provider(s) | P1 (navigation), P2 (agents) | Not started | RSK-R-005, RSK-R-017, RSK-R-018 |
| RSK-D-004 | Biometric device integration specifications supporting on-device matching | In | Biometric hardware vendors | P1 G2 | Not started | RSK-R-009 |
| RSK-D-005 | Messaging gateways (SMS, business messaging channel, email) for notifications | In | Gateway providers | P1 G3 | Not started | — |
| RSK-D-006 | Cloud hosting region in India with required compliance certifications | In | Cloud provider | P0 G2 | Not started | RSK-R-002, RSK-R-007 |
| RSK-D-007 | Approved functional domain packs (14 domains) for design | Out | Architecture, development, QA | Each phase G1 | At risk (RSK-I-002) | RSK-R-006, RSK-R-016 |
| RSK-D-008 | Legal review of DPDP / GDPR obligations and AI regulation applicability | In | Legal counsel | G1 | Not started | RSK-R-002, RSK-R-003 |
| RSK-D-009 | Background-verification provider API | In | BGV vendor | P3 G2 | Not started | — |
| RSK-D-010 | HRMS Demo Dataset v1.1 and acceptance sources (68_Acceptance_Test_Data, 10_Acceptance_Tests) kept under configuration control as the golden validation baseline | In | Requirements / QA workstream | P0 G1 | On track | RSK-R-001, RSK-R-023 |
| RSK-D-011 | Sponsor go signal for live backend and database work (current stage R0 is local JSON only) | In | Executive Sponsor | P0 start | Not started | — |
| RSK-D-012 | Closure of OD-01 (Node framework NestJS vs Fastify), which blocks BL-001 | In | Engineering lead | P0 wk 2 | At risk | — |
| RSK-D-013 | Import of the build backlog and process/rule/screen catalogues into the requirements set | Out | Requirements workstream → planning | P0 G1 | Delivered | — |
| RSK-D-014 | DAEB approval before any agentic (AGENT-step) or frontier AI feature is built | In | Data & AI Ethics Board | P2 G2 / P5 | Not started | — |
| RSK-D-015 | Pilot tenant availability and legacy HRMS/payroll data extracts for migration rehearsal | In | Pilot customer | P2 G3 | Not started | — |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Not baselined (living register) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 7 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 7. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
