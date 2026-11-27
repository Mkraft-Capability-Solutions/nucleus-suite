<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# REQ-03 — Requirements Quality Checklist

| Attribute | Value |
| :--- | :--- |
| Document ID | REQ-03 |
| Title | Requirements Quality Checklist |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | PQA Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | BA Lead, QA Lead — *pending* |
| Approved by | EPG Lead — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, PR, PQA, MPM |
| Related documents | DOC-01, REQ-01, QA-02, QA-04, the standard artefact formats (DOC-01 §4) |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |

---

## 1. Purpose and Use

This checklist is applied:
- by the author, as a self-check before submitting a requirement pack for review
- by peer reviewers during the requirements peer review (QA-02)
- by PQA during audits (QA-04)

Results are recorded on the Peer Review Record (peer review record, QA-02).

## 2. Universal Requirement Quality Criteria

Apply to every individual requirement (BR, FR, NFR, AI).

| # | Criterion | Check question | Typical defect |
| :--- | :--- | :--- | :--- |
| Q1 | Complete | Are all mandatory attributes (REQ-01 §6) filled? Is it free of placeholders, with any unknown value logged as an RSK-03 action with owner and due date (DOC-01 §10 rule 8)? | Missing acceptance criteria |
| Q2 | Correct | Does it accurately reflect the source (stakeholder, regulation)? Has an SME validated it? | Wrong statutory threshold |
| Q3 | Unambiguous | Can it be read only one way? No vague terms ("fast", "user-friendly", "etc.", "as appropriate")? | "System should respond quickly" |
| Q4 | Verifiable | Can a test, demo, inspection or analysis prove it? Are quantities stated with measurement conditions? | "150 ms" with no load or percentile |
| Q5 | Feasible | Achievable within technology, budget and regulatory constraints (architect confirmed)? | Real-time recalculation of unbounded org trees |
| Q6 | Necessary | Does it trace to a BG/BO, regulation or persona need? Would removing it lose value? | Gold-plating |
| Q7 | Prioritised | Has a MoSCoW priority (and WSJF score if in backlog)? | All items marked "Must" |
| Q8 | Traceable | Imported items keep their source ID (R-xx, DOM-nn, RL, SCR, FRM, TC, CMP, BL)? New items use `<DOM>-<TYPE>-nnn`? Parent link, source and (by test readiness) a TC link present? | Renumbered workbook IDs; duplicates of an existing RL |
| Q9 | Consistent | Free of conflicts with other requirements, invariants (INV-*), and DOC-01 terms? | Two different leave state machines |
| Q10 | Atomic | Expresses exactly one need (no "and/or" compound)? | "MUST validate and export and notify" |
| Q11 | Implementation-free | States *what*, not *how* (unless a mandated constraint)? | Names a specific library or vendor behaviour |
| Q12 | Compliant with DOC-01 / REQ-01 | Correct ID format? Document named `FRS-<DOM>-nn` (00..13)? MUST/SHOULD/MAY? ISO dates, currency format? No third-party product names or comparisons? No secrets? No client-tracker status (Implemented/WIP/Done) carried over? | "enterprise-grade tracking"; a requirement marked "Done" from the client tracker |

## 3. Artefact-Specific Checklists

### 3.0 Imported content and programme-specific types

- [ ] Imported text is kept verbatim. Clarifications are added as notes, not silent rewrites.
- [ ] Source reference (workbook, sheet, row) is present
- [ ] Status starts at Proposed regardless of the client-tracker status
- [ ] **CG (capability gap, `<DOM>-CG-nnn`):** cites the GOV-02 capability coverage row, describes our own behaviour without naming any third-party product, and is confirmed not already covered by an imported RL/DOM step
- [ ] **FX (frontier):** tagged phase P5, has a DAR record reference, has a GOV-11 risk class if AI is involved, and states its hypothesis and success measure
- [ ] Stories name the shared components (CMP-nn) they consume and do not re-implement them (anti-repeat-work rule)

### 3.1 Functional Requirements Specification (`FRS-<DOM>-00..13`, format per REQ-01 §5.3)

- [ ] Scope and context section names the in-scope and out-of-scope processes
- [ ] Every FR has an ID, statement, rationale, priority, acceptance criteria
- [ ] Business rules are separated from FRs and cite their source and jurisdiction
- [ ] Invariants that apply (e.g. INV-LEV-01, INV-PAY-01) are referenced
- [ ] State machines use only states defined in the source workbooks/process maps (no invented states)
- [ ] Error and exception handling is specified with error codes
- [ ] Role / permission impact is stated, noting that client-side gating is not authorisation
- [ ] Audit-trail and privacy implications are stated
- [ ] i18n impact is stated (strings externalised, 11 languages, RTL readiness)
- [ ] Reports/outputs are listed with RPT IDs

### 3.2 Use Case and User Story (use-case and user-story format, FRS-<DOM>-12/13)

- [ ] Primary actor is a GOV-08 persona (not a generic "user")
- [ ] Trigger, preconditions and postconditions are specific and testable
- [ ] Main flow has numbered actor/system steps
- [ ] Alternative and exception flows cover validation failures, permission denial, concurrency, offline (where relevant)
- [ ] Business rules referenced by ID, not restated
- [ ] User stories follow "As a <persona>, I want <goal>, so that <benefit>" and are INVEST
- [ ] Each story has Given/When/Then acceptance criteria
- [ ] Each story traces to an FR or UC

### 3.3 Data Model and Interface Schema (data model and interface format, DA-01, ICD-01)

- [ ] Each entity has a definition, owner, classification (Public/Internal/Confidential/Restricted)
- [ ] Attributes have type, length, nullability, validation, default and source
- [ ] Keys, relationships and cardinality are shown (ER diagram)
- [ ] Tenant scoping attribute is present on tenant data
- [ ] Effective-dating fields are present where the entity is time-variant
- [ ] Personal data and sensitive personal data are flagged, with lawful basis and retention (GOV-10)
- [ ] JSON schemas are valid (correct `$schema` draft URI) and **consistent with the attribute table**
- [ ] API contracts list versioning, idempotency, error model and pagination
- [ ] Sample payloads use synthetic data only

### 3.4 UI/UX Screen Specification (screen specification format, FRS-<DOM>-04)

- [ ] Screen ID, persona, entry points and navigation-catalog placement
- [ ] Field-level spec: control type matches data type (date picker, currency, phone, etc.)
- [ ] Required fields marked `*`; optional fields labelled
- [ ] Validation messages, disabled-submit, loading, success and error states specified
- [ ] Empty, loading and error states designed
- [ ] Colours referenced as design tokens only (no hex/named colours)
- [ ] Accessibility: keyboard order, labels, contrast, screen reader text
- [ ] All labels are i18n keys; layout tolerates long translations and RTL
- [ ] Breadcrumbs derived from navigation context, not hard-coded
- [ ] Wireframe or mockup attached (not text-only)

### 3.5 Non-Functional Requirements (NFR format, NFR-01)

- [ ] Category stated (performance, scalability, availability, security, privacy, accessibility, usability, i18n, maintainability, observability, portability, cost)
- [ ] Each NFR has a metric, target, measurement conditions (load, data volume, percentile, environment) and measurement method
- [ ] Applies-to scope (module, component, tenant tier) stated
- [ ] Conflicts with other NFRs are resolved or escalated via DAR-01
- [ ] Compliance-driven NFRs cite the regulation

### 3.6 AI Feature Specification (AI feature specification and model card, GOV-11)

- [ ] AI involvement level stated: Assistive / Agentic, and human-in-the-loop checkpoint defined
- [ ] GOV-11 risk classification assigned
- [ ] Inputs, outputs, tools/actions the AI may take, and actions it must never take
- [ ] Evaluation metrics with thresholds (accuracy, groundedness, refusal correctness, latency, cost)
- [ ] Fairness/bias tests defined for any people-impacting decision (hiring, calibration, pay)
- [ ] Explainability: what the user sees as the rationale
- [ ] Data used for prompts/training is classified; personal-data minimisation and consent addressed
- [ ] Fallback behaviour when the model is unavailable or low-confidence
- [ ] Model/prompt versioning and monitoring plan (CM-01 §10)
- [ ] Model card section completed

## 4. Scoring and Pass Threshold

### 4.1 Requirement-level scoring

For each requirement, each criterion Q1–Q12 is scored: **2** = fully met, **1** = partially met, **0** = not met.

- Maximum score = 24.
- **Pass:** score ≥ 20 **and** no zero on Q3 (Unambiguous), Q4 (Verifiable), Q8 (Traceable) or Q12 (DOC-01 compliance).

### 4.2 Pack-level scoring

| Measure | Pass threshold |
| :--- | :--- |
| Requirements passing §4.1 | ≥ 95% of requirements in pack |
| Artefact checklist items (§3) met | ≥ 90% for each artefact type present |
| Critical findings (any Q4/Q8 zero on a Must requirement) | 0 |
| Open major review findings | 0 before approval |

Outcomes:
- **Pass** → may move to Approved.
- **Conditional pass** → minor findings only, fixed and verified by the moderator before approval.
- **Fail** → returned to Draft; re-review required.

### 4.3 Recording

Record per-requirement scores and findings on the peer review record (QA-02). Findings are recorded **against the requirement ID**, with severity and cause category. This feeds the per-requirement review-finding and defect-injection data in REQ-01 §13.1, which builds the review-effectiveness and defect-injection PPBs (MPM-01). Pass thresholds in §4 are reviewed against those PPBs at each phase exit. If the data shows that packs passing at the current threshold still inject defects above the QPPO, the threshold is tightened through CAR-01 / DAR-01. The PQA Lead tracks pack first-pass rate as an RDM health metric (REQ-01 §13).

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
| Size | 5 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 5. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
