<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# GOV-08 — User Personas and Role Consoles

| Attribute | Value |
| :--- | :--- |
| Document ID | GOV-08 |
| Title | User Personas and Role Consoles |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | UX Research Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | Product Owners (all modules), DPO — *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM |
| Related documents | DOC-01, GOV-05, GOV-07, GOV-10, GOV-11, OCM-02, the use-case and user-story format (FRS-<DOM>-12/13) |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-03 |

---

## 1. Purpose

This document defines the canonical user personas (`PER-xx`) and the ten role consoles (S1–S10) of Nucleus Suite. Every use case, user story (use-case and user-story format, FRS-<DOM>-12/13) and screen specification (screen specification format, FRS-<DOM>-04) in the 14 domain requirement packs (PLT, PPL, TIM, LVE, PAY, CMP, LCY, SSV, CMB, TAL, CTG, EXP, FIN, INT) MUST name one or more `PER-xx` as its actor. Requirements without a persona fail the quality check in REQ-03.

> **Authoritative scope source:** The source requirements workbook (sheet `21_Roles_and_RACI`) defines each role's scope, what it can see, what it cannot see, and its key screens (`SCR-nnn`). That persona-to-scope matrix is imported into the Business Architecture section of the requirements set (the 03_Business_Requirements folder, maintained by the main documentation workstream). **If the default matrix in §4 of this document conflicts with the workbook-derived matrix, the workbook-derived matrix prevails** and §4 is corrected by change request (CM-02). This document adds the experience view: goals, jobs to be done, channels and AI expectations.
>
> **Reference tenant:** Personas are illustrated using the fictional demo client **Vindhya Precision Industries Pvt Ltd** — 2 legal entities, 5 sites, 4 states. It is the reference and pilot context for persona validation and phase P2 Pilot & Intelligence.

> **Security note:** Showing or hiding consoles, menus and buttons by role is a **UI convenience only**. Authorisation is always enforced server-side through the role-based and attribute-based access model (RBAC/ABAC, defined in the PLT Platform & Foundations requirements). A hidden control is never treated as an access control.

## 2. Persona Catalogue

| ID | Persona | Console | Population (typical tenant) | Primary channel |
| :--- | :--- | :--- | :--- | :--- |
| PER-01 | CHRO / People Strategy Executive | S1 | 1–5 | Desktop, tablet |
| PER-02 | HR Business Partner (HRBP) | S2 | 1 per 100–300 employees | Desktop |
| PER-03 | Plant Supervisor / Time Office | S3 | 1 per 30–80 workers | Shared plant terminal, rugged mobile device |
| PER-04 | Talent Acquisition Lead / Recruiter | S4 | Small team | Desktop |
| PER-05 | Finance Controller | S5 | 1–3 | Desktop |
| PER-06 | Talent Calibration Lead | S6 | 1–3 | Desktop |
| PER-07 | Line Manager | S7 | 1 per 6–12 employees | Mobile, desktop |
| PER-08 | Employee (knowledge worker) | S8 | Majority of corporate staff | Mobile, desktop, voice, business messaging (opt-in) |
| PER-09 | Capability / L&D Lead | S9 | 1–5 | Desktop |
| PER-10 | Super Admin / Platform Admin | S10 | 1–3 per tenant | Desktop |
| PER-11 | Contract / Frontline Worker | S8 (Lite / kiosk mode) | Large share in manufacturing tenants | Kiosk, shared device, entry-level smartphone, business messaging (opt-in), IVR/voice |
| PER-12 | Candidate | External careers portal | Many per opening | Mobile web |
| PER-13 | Payroll Administrator | S5 (Payroll Control Room) | 1 per 1,000–3,000 employees | Desktop |
| PER-14 | DPO / Compliance Officer | S10 (Privacy & Compliance workspace) | 1–2 | Desktop |
| PER-15 | External / Statutory Auditor | Read-only audit workspace | Periodic | Desktop |
| PER-16 | Integration / System User (non-human) | API only | Per integration | API, event bus |

## 3. Persona Profiles

### PER-01 — CHRO / People Strategy Executive (S1)
- **Goals:** align workforce with business strategy; control people cost; improve retention, diversity and capability.
- **Pain points:** data spread across systems; reports arrive weeks late; cannot model "what-if" restructures.
- **Jobs to be done:** "Show me where attrition risk is concentrated and what it will cost" · "Simulate a reorganisation before I announce it".
- **Key journeys:** executive dashboard → drill into attrition → organisation digital-twin simulation → board pack export.
- **Devices / channels:** desktop, tablet, Nucleus Talk voice briefings.
- **Language & accessibility:** English plus a preferred regional language; large-type executive view.
- **Data access scope:** aggregated, organisation-wide; individual-level drill-down only with a recorded purpose; compensation visible.
- **AI copilot expectations:** natural-language questions over people analytics; explainable predictions with confidence levels; no unexplained black-box scores.
- **Success metrics:** time to insight under 1 minute for standard questions; board pack produced in under 1 hour.

### PER-02 — HR Business Partner (S2)
- **Goals:** resolve employee cases quickly; run lifecycle events (transfers, promotions, exits) without errors.
- **Pain points:** effective-dating mistakes; approval chases; repetitive queries.
- **Jobs to be done:** "Process a transfer effective next month without breaking payroll" · "Find who has pending approvals over SLA".
- **Key journeys:** worker profile → lifecycle action (effective-dated) → approval routing → audit view.
- **Devices / channels:** desktop.
- **Language & accessibility:** English plus a regional language; keyboard-first operation.
- **Data access scope:** assigned business units/locations; personal and job data; compensation per policy; sensitive identifiers masked by default and revealed only with a logged purpose.
- **AI copilot expectations:** drafted letters and summaries; policy answers with citations; suggested next actions.
- **Success metrics:** lifecycle transaction under 3 minutes; first-time-right above 98%.

### PER-03 — Plant Supervisor / Time Office (S3)
- **Goals:** fully staffed shifts; accurate attendance and overtime; statutory registers ready for inspection.
- **Pain points:** missed punches; manual muster rolls; last-minute roster swaps; contractor headcount mismatches.
- **Jobs to be done:** "Fill tonight's shift gap" · "Approve a gate pass in 10 seconds" · "Correct a missed punch with proof".
- **Key journeys:** live shift board → exceptions (missed punch, late, overtime) → regularise / approve → muster-roll view.
- **Devices / channels:** shared plant terminal, rugged mobile device, voice; must work offline with later sync.
- **Language & accessibility:** regional language first (e.g. Hindi, Marathi, Tamil, Telugu, Bengali); icon-led UI; glove-friendly touch targets.
- **Data access scope:** **location-scoped.** Plant and location users see attendance, roster, gate pass, overtime, leave and contingent-worker data only for their assigned site(s) and shift(s), e.g. a single Vindhya plant. **Compensation, salary rates and CTC are masked (`***`)** — only Head Office HR/Finance roles may see salary.
- **AI copilot expectations:** voice commands ("mark Line 3 overtime approved"); anomaly alerts (buddy punching, overtime caps).
- **Success metrics:** exceptions cleared before shift end; zero register gaps at inspection.

### PER-04 — Talent Acquisition Lead / Recruiter (S4)
- **Goals:** fill requisitions faster with quality, fair hires.
- **Pain points:** manual screening; scheduling back-and-forth; offer approval delays.
- **Jobs to be done:** "Shortlist the best 20 of 800 applicants fairly" · "Auto-schedule panel interviews".
- **Key journeys:** requisition → sourcing → AI-assisted screening (with explanations) → interviews → offer → pre-boarding.
- **Devices / channels:** desktop; mobile for approvals.
- **Language & accessibility:** English.
- **Data access scope:** candidates for assigned requisitions; no access to current-employee compensation beyond approved offer bands.
- **AI copilot expectations:** job-description drafting, skills-based matching, bias flags. **AI may rank but never auto-reject** (GOV-11 Tier 4).
- **Success metrics:** time-to-fill; offer acceptance rate; adverse-impact ratio within threshold.

### PER-05 — Finance Controller (S5)
- **Goals:** payroll cost that ties to the general ledger; controlled payroll lock; clean audits.
- **Pain points:** reconciliation breaks; late adjustments after lock; ERP mapping errors.
- **Jobs to be done:** "Approve payroll lock with variance explained" · "Post a balanced journal to the ERP".
- **Key journeys:** payroll control room → variance review → lock authorisation → GL / ERP outbox (ERP system / ERP system / ERP system) → audit pack.
- **Devices / channels:** desktop.
- **Language & accessibility:** English.
- **Data access scope:** compensation and cost data at aggregate and individual level; bank details masked.
- **AI copilot expectations:** variance explanation; anomaly detection on gross-to-net; forecast of payroll cost.
- **Success metrics:** total debits equal total credits on 100% of exports; month-end close days reduced.

### PER-06 — Talent Calibration Lead (S6)
- **Goals:** fair, consistent performance and potential calibration.
- **Pain points:** rater bias; spreadsheets; forced-distribution disputes.
- **Jobs to be done:** "Run the 9-box calibration session with live distribution variance".
- **Key journeys:** cycle setup → rating intake → 9-box board → bias and distribution checks → finalise → feed into compensation.
- **Devices / channels:** desktop, large-screen session mode.
- **Language & accessibility:** English.
- **Data access scope:** ratings for the calibration population; compensation only if the cycle is linked.
- **AI copilot expectations:** bias detection across protected attributes; evidence summaries from goals and feedback; **no AI-generated final rating**.
- **Success metrics:** distribution variance within ±2% of quota; calibration time reduced.

### PER-07 — Line Manager (S7)
- **Goals:** a productive, engaged team; quick approvals.
- **Pain points:** approval overload; unclear policy; scattered team data.
- **Jobs to be done:** "Approve leave knowing team coverage" · "Prepare for a 1:1 in 2 minutes".
- **Key journeys:** manager cockpit → approvals inbox (leave, attendance, expenses) → team insights → goals and feedback.
- **Devices / channels:** mobile first; desktop; voice.
- **Language & accessibility:** English plus a regional language.
- **Data access scope:** direct and indirect reports; compensation of reports per tenant policy; cannot approve own requests (INV-SEC-02).
- **AI copilot expectations:** coverage-aware approval suggestions; 1:1 briefs; feedback-writing help.
- **Success metrics:** approval cycle time under 24 h; team engagement trend.

### PER-08 — Employee (S8)
- **Goals:** self-serve everything; get paid correctly; grow their career.
- **Pain points:** opaque payslips; slow leave approval; HR tickets for simple questions.
- **Jobs to be done:** "Apply for leave by voice" · "Explain my payslip deduction" · "Find an internal gig that builds my skills".
- **Key journeys:** home → punch / leave / payslip → profile and documents → learning → talent marketplace.
- **Devices / channels:** mobile, desktop, Nucleus Talk voice.
- **Language & accessibility:** any of the 11 supported languages; WCAG 2.2 AA; screen-reader support.
- **Data access scope:** own records only; own compensation; consent dashboard for personal data.
- **AI copilot expectations:** the **Policy Assistant** agent (INT domain) gives grounded policy answers with citations — reads run automatically, writes such as a leave application need the employee's confirmation, and every action is recorded in the action ledger. Also: payslip explanation; career suggestions they can opt out of.
- **Success metrics:** self-service resolution above 80%; app satisfaction score.

### PER-09 — Capability / L&D Lead (S9)
- **Goals:** close skill gaps; complete compliance training; measure learning impact.
- **Pain points:** content silos; no skills data; low completion rates.
- **Jobs to be done:** "Identify the skill gap for next year's plant automation" · "Assign mandatory POSH / safety training".
- **Key journeys:** skills heatmap → curriculum builder → assignments → completion analytics.
- **Devices / channels:** desktop.
- **Language & accessibility:** English; content authored in multiple languages.
- **Data access scope:** learning and skills data; no compensation.
- **AI copilot expectations:** skills inference with an employee confirmation step; content recommendations; course generation drafts.
- **Success metrics:** compliance completion 100% by due date; skill-gap closure rate.

### PER-10 — Super Admin / Platform Admin (S10)
- **Goals:** a secure, well-configured tenant.
- **Pain points:** risky bulk changes; unclear permission effects.
- **Jobs to be done:** "Grant a role with least privilege and see its effect before saving" · "Configure a workflow without code".
- **Key journeys:** tenant settings → access control (RBAC/ABAC) → workflow designer → integrations → audit logs.
- **Devices / channels:** desktop.
- **Language & accessibility:** English.
- **Data access scope:** configuration and metadata. **Business data access is not implied by the admin role** — it requires an explicit, time-boxed and logged break-glass grant.
- **AI copilot expectations:** configuration assistant; permission-impact explanation; misconfiguration detection.
- **Success metrics:** zero unauthorised privilege escalations; time to configure a workflow.

### PER-11 — Contract / Frontline Worker (S8 Lite / kiosk)
- **Goals:** be paid correctly for every hour worked; easy proof of attendance; access to entitlements.
- **Pain points:** low digital literacy; no personal smartphone; wage disputes; language barriers.
- **Jobs to be done:** "Check this week's hours and overtime" · "Download my payslip in my language" · "Raise a complaint".
- **Key journeys:** kiosk or face/biometric identification → hours and wage summary → voice query → grievance submission.
- **Devices / channels:** shared kiosk, feature phone (IVR/SMS where configured), entry-level smartphone.
- **Language & accessibility:** voice-first, icon-led, regional language; audio read-back; minimal text entry.
- **Data access scope:** own records only; session ends automatically on shared devices; no stored credentials on device.
- **AI copilot expectations:** spoken answers in their language; simple confirmations; escalation to a human.
- **Success metrics:** wage-dispute tickets reduced; kiosk task success above 90% without assistance.

### PER-12 — Candidate (careers portal)
- **Goals:** apply quickly; know where they stand; be assessed fairly.
- **Pain points:** long forms; no status updates; unexplained rejections.
- **Key journeys:** job search → résumé parse → apply → status tracker → interview scheduling → offer e-sign → pre-boarding.
- **Devices / channels:** mobile web.
- **Language & accessibility:** multilingual; WCAG 2.2 AA.
- **Data access scope:** own application only; notice and consent shown at collection; retention per GOV-10.
- **AI copilot expectations:** application help; transparent notice whenever AI is used in screening, with a route to human review.
- **Success metrics:** application completion rate; candidate satisfaction (candidate NPS).

### PER-13 — Payroll Administrator (S5 Payroll Control Room)
- **Goals:** error-free, on-time payroll and statutory filings.
- **Pain points:** late inputs; retroactive changes; statutory rule changes.
- **Jobs to be done:** "Run the 8-stage payroll control room" · "Explain why net pay changed for 42 employees".
- **Key journeys:** input validation → structure lock → attendance/leave integration → statutory deductions → gross-to-net → exceptions → lock → disbursement file (production phase).
- **Devices / channels:** desktop.
- **Language & accessibility:** English.
- **Data access scope:** compensation and statutory identifiers needed for processing; bank details revealed only in the disbursement stage with logging.
- **AI copilot expectations:** variance root-cause analysis; anomaly flags; statutory-change impact preview.
- **Success metrics:** zero statutory penalties; payroll accuracy above 99.9%.

### PER-14 — DPO / Compliance Officer
- **Goals:** demonstrable DPDP / GDPR compliance.
- **Pain points:** no data map; manual handling of data principal rights; unclear AI processing.
- **Key journeys:** records of processing → DPIA workflow → rights-request queue → breach register → consent analytics.
- **Data access scope:** metadata, logs, consent records; personal data only when needed for a request.
- **AI copilot expectations:** discovery of personal data in free text; DPIA drafting assistance.
- **Success metrics:** rights requests closed within statutory timelines; DPIA coverage 100% for high-risk processing.

### PER-15 — External / Statutory Auditor
- **Goals:** obtain sufficient, reliable evidence.
- **Key journeys:** time-boxed read-only workspace → sample selection → audit-trail viewer → evidence export.
- **Data access scope:** read-only, time-bound, scoped to the audit period; every access logged.
- **Success metrics:** evidence request turnaround time.

### PER-16 — Integration / System User (non-human)
- **Goals:** reliable, idempotent data exchange.
- **Characteristics:** service principal with scoped OAuth credentials (managed in a secrets vault, never in documents); rate-limited; every call attributed and audited.
- **Data access scope:** only the API scopes in its integration contract (`PLT-INT-xxx` / `FIN-INT-xxx`).
- **Success metrics:** delivery success rate; mean time to recover (MTTR) after failure.

## 4. Persona × Domain Access Matrix (Default Policy)

**Legend:**
- F = full (create / update / approve within scope)
- O = own records only
- T = team / assigned scope
- L = location-scoped (assigned sites / shifts)
- R = read-only
- A = aggregated / anonymised only
- M = visible with salary masked (`***`)
- C = configuration only (no business data)
- — = no access

This is the default governance view. The authoritative persona-to-scope matrix is the one imported from workbook sheet `21_Roles_and_RACI` (see §1). Tenants can tailor access through the access-control console; any tailoring is subject to the segregation-of-duties rules in the PLT requirements.

**Domain codes:** PLT Platform & Foundations · PPL People Core · TIM Time & Attendance · LVE Leave · PAY Payroll · CMP Compliance · LCY Lifecycle · SSV Self-service & Helpdesk · CMB Compensation, Loans & Benefits · TAL Talent · CTG Contingent Workforce · EXP Experience · FIN Finance & ERP · INT Intelligence & Agents.

| Persona | PLT | PPL | TIM | LVE | PAY | CMP | LCY | SSV | CMB | TAL | CTG | EXP | FIN | INT |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| PER-01 CHRO | — | R | A | A | A | R | R | A | R | R | A | A | A | F |
| PER-02 HRBP | — | F (T) | R (T) | F (T) | R (T) | R (T) | F (T) | F (T) | R (T) | F (T) | R (T) | F (T) | — | T |
| PER-03 Plant Supervisor | — | R (L) | F (L) | F (L) | M | R (L) | — | T | M | — | F (L) | — | — | L |
| PER-04 TA Lead | — | R | — | — | — | — | R (onboarding) | — | R (bands) | F | R | — | — | T |
| PER-05 Finance Controller | — | R | R | R | F | R | R | — | F | — | R | — | F | F |
| PER-06 Calibration Lead | — | R | — | — | — | — | — | — | R (linked cycle) | F | — | R | — | T |
| PER-07 Line Manager | — | R (T) | F (T) | F (T) | — | — | R (T) | T | R (T, policy) | F (T) | R (T) | T | — | T |
| PER-08 Employee | — | O | O | O | O | O | O | O | O | O | — | O | — | O |
| PER-09 Capability Lead | — | R | — | — | — | R (training) | — | — | — | F (learning) | — | R | — | T |
| PER-10 Super Admin | F | C | C | C | C | C | C | C | C | C | C | C | C | C |
| PER-11 Contract Worker | — | O | O | O | O | — | O | O | — | O (learning) | O | — | — | O |
| PER-12 Candidate | — | — | — | — | — | — | — | — | — | O | — | — | — | — |
| PER-13 Payroll Admin | — | R | R | R | F | F (statutory) | R | — | R | — | R | — | R | T |
| PER-14 DPO | R (logs) | Metadata | Metadata | Metadata | Metadata | R | Metadata | Metadata | Metadata | Metadata | Metadata | Metadata | Metadata | R (action ledger) |
| PER-15 Auditor | R (logs) | R | R | R | R | R | R | R | R | R | R | R | R | R (action ledger) |
| PER-16 Integration User | — | API | API | API | API | API | API | API | API | API | API | — | F (ERP outbox) | — |

**Mandatory constraints:**

1. Salary masking for PER-03 and other plant / location-scoped users applies in every channel: UI, export, voice, business messaging, copilot and agent output.
2. Every reveal of a sensitive identifier (PAN, Aadhaar, bank account) creates an access event (GOV-10 §9).
3. No persona may approve its own transaction (INV-SEC-02).
4. AI agents act **on behalf of** a persona and never exceed that persona's scope (GOV-11 §6).

## 5. Console Map

| Console | Persona | Purpose | Signature widgets |
| :--- | :--- | :--- | :--- |
| S1 | PER-01 | Executive people strategy | Headcount and cost trends, attrition risk, diversity, organisation digital twin |
| S2 | PER-02 | HR operations | Case queue, lifecycle actions, SLA breaches |
| S3 | PER-03 | Shift and floor operations | Live shift board, exceptions, overtime caps, gate passes, muster roll |
| S4 | PER-04 | Talent acquisition | Pipeline funnel, requisition aging, interview calendar |
| S5 | PER-05, PER-13 | Payroll and GL control room | 8-stage payroll tracker, variance, ERP outbox status |
| S6 | PER-06 | Talent calibration | 9-box board, distribution variance badges, bias flags |
| S7 | PER-07 | Manager cockpit | Approvals inbox, team coverage, 1:1 briefs |
| S8 | PER-08, PER-11 | Employee self-service | Punch, leave, payslip, learning, talent marketplace |
| S9 | PER-09 | Capability / L&D | Skills heatmap, compliance completion |
| S10 | PER-10, PER-14 | Platform administration and privacy | Access control, workflow designer, integrations, audit, DPIA, rights requests |

## 6. Persona Validation Plan

- Validate each persona with at least 5 real users per role (3 for executive roles) before G1. Use the Vindhya reference scenarios for walkthroughs of the key `SCR-nnn` screens. Record findings in the UX research repository, a controlled configuration item under CM-01 owned by the UX Research Lead, and link each finding to the persona ID (PER-xx).
- Re-validate after the P2 pilot and at G5 using adoption analytics (MPM-01).
- Accessibility validation for PER-08, PER-11 and PER-12 with assistive-technology users.

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
