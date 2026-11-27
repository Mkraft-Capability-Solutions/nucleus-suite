<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# QA-02 — Peer Review Procedure

| Attribute | Value |
| :--- | :--- |
| Document ID | QA-02 |
| Title | Peer Review Procedure |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | PQA Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | EPG Lead, Chief Architect, BA Lead — *pending* |
| Approved by | EPG Lead — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PR, VV, RDM, TS, MPM (base measures for PPBs) |
| Related documents | DOC-01, QA-01, QA-03, REQ-03, PCM-01, the peer review record (QA-02), MPM-01, MC-01, CAR-01, CM-01 |
| Quality & process-performance objectives | QPPO-02 (defect removal before system test), QPPO-03 (exact payroll), QPPO-05 |
| Process performance baseline used | PPB-01, PPB-02, PPB-03, PPB-04 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

Defines how work products are peer-reviewed to remove defects early and to confirm conformance with requirements, standards and the shared architecture. Peer review is the programme's cheapest defect-removal activity; review effectiveness is tracked as MET-09.

## 2. Scope — What Must Be Peer-Reviewed

| Work product | Minimum review type | Mandatory reviewers (roles) | When |
| :--- | :--- | :--- | :--- |
| Governance documents to be baselined (GOV, PLN, REQ, CM, RSK-01, QA, MPM, MC, DAR-01, PCM, SAM, OT) | Technical review | PQA + one role from the approving body | Before approval |
| Functional domain pack (FRS, use cases, business rules) | **Inspection** | Domain SME, Solution Architect, QA/Test Lead, one consuming-domain representative for each seam touched | Before G1 |
| NFR specification | Technical review | Chief Architect, Security Lead, QA/Test Lead | Before G1 |
| Data model / interface schema / API contract | Inspection | Data Architect, consuming-domain representative, Security Lead | Before G2 |
| Seam contract (S-01..S-12) | Inspection | Owner pair of both domains, Integration Lead | Before G2 |
| Architecture and design specifications | Technical review | ARB members (≥ 2) | Before G2 |
| UI/UX screen specification | Walkthrough + technical review | UX Lead, Accessibility reviewer, Localisation reviewer | Before build |
| Source code (every change) | Technical review (pull request) | ≥ 1 peer not the author; domain owner for statutory or security-relevant code | Before merge |
| Statutory rule configuration (PAY, CMP, TIM, LVE rules) | Inspection | Second statutory SME, QA/Test Lead | Before merge |
| Database migrations | Technical review | Data Architect + Security Lead | Before merge |
| AI prompts, system instructions, tool definitions, evaluation sets, model cards (AI feature specification and model card, GOV-11) | Inspection | Head of AI delegate, Security Lead (prompt-injection view), DPO for personal-data use | Before enabling feature flag |
| Test plans and test cases | Technical review | QA peer + Domain SME | Before G3 |
| Migration mappings and reconciliation rules | Inspection | Migration Lead, Domain SME | Before mock migration |
| Standard artefact formats and process assets | Walkthrough | EPG + PQA | Before publication |

Living registers (RSK-02, RSK-03, CM-03, DAR-02, REQ-02) are reviewed in their governance cadence, not via this procedure.

## 3. Review Types

| Type | Formality | Purpose | Roles | Records |
| :--- | :--- | :--- | :--- | :--- |
| **Walkthrough** | Low | Author presents; build shared understanding; early feedback | Author, participants | the peer review record (QA-02) short form (findings list) |
| **Technical review** | Medium | Evaluate technical correctness and conformance; reviewers prepare individually | Moderator (may be author's lead), reviewers, author | the peer review record (QA-02) full; defects logged |
| **Inspection** | High | Systematic defect detection with checklists, defined roles and preparation rates; measured | Moderator (trained, not author), reader, reviewers, scribe, author | the peer review record (QA-02) full; defect log; preparation time and size recorded |

Asynchronous reviews (pull requests, document comments) are allowed for technical reviews provided entry/exit criteria and records are met.

## 4. Roles

| Role | Responsibilities |
| :--- | :--- |
| Author | Prepares work product; meets entry criteria; fixes defects; requests follow-up |
| Moderator | Plans review; checks entry criteria; chairs; decides outcome; verifies rework; submits record |
| Reader (inspection) | Paraphrases work product section by section |
| Reviewer | Prepares individually using checklists; records defects with location and class |
| Scribe | Records defects, decisions, actions in the peer review record (QA-02) |
| PQA | Samples review records for conformance (QA-01 §7) |

## 5. Procedure

### 5.1 Entry Criteria

1. Work product is complete for the review scope and under version control with a draft version number (DOC-01 §9).
2. Author has self-checked against the applicable checklists (§7).
3. Header table, IDs and traceability fields are present (DOC-01 §3, §6).
4. Referenced documents are available to reviewers.
5. Automated checks have passed where applicable (lint, type check, unit tests, static analysis, link check, ID-scheme check).
6. Reviewers and moderator assigned; review package distributed ≥ 2 working days before an inspection meeting.

If entry criteria are not met, the moderator postpones the review and records the reason.

### 5.2 Steps

| Step | Activity | Output |
| :--- | :--- | :--- |
| 1 Plan | Moderator selects review type, reviewers, checklists, schedule | Review plan in the peer review record (QA-02) header |
| 2 Kick-off (inspection only) | Author gives context; roles confirmed | — |
| 3 Individual preparation | Reviewers examine work product at planned rate (§6), log candidate defects | Preparation log, time spent |
| 4 Review meeting / async thread | Defects confirmed, classified, de-duplicated; no solution design in meeting | Defect list |
| 5 Decide outcome | Accept / Accept with minor rework / Re-review required | Outcome in the peer review record (QA-02) |
| 6 Rework | Author fixes all Major and Critical defects; Minor fixed or justified | Revised version |
| 7 Follow-up | Moderator (or reviewers for re-review) verifies rework | Verification recorded |
| 8 Close | Record finalised; metrics captured; work product may proceed to approval | PR-NNNN record closed |

### 5.3 Exit Criteria

1. All Critical and Major defects resolved and verified.
2. Minor defects resolved or explicitly deferred with a tracking item (RSK-AC or backlog item).
3. Review record PR-NNNN complete, including size, effort, defect counts.
4. For inspections: preparation rate within guideline or deviation justified.
5. Outcome is "Accept" or "Accept with minor rework — verified".

## 6. Preparation and Review Rates (guidelines)

| Work product | Preparation rate | Meeting rate | Max meeting length |
| :--- | :--- | :--- | :--- |
| Requirements / FRS text | 5–8 pages per hour | 8–10 pages per hour | 2 hours |
| Use cases | 3–5 use cases per hour | 5 per hour | 2 hours |
| Data model / API contract | 10–15 entities or endpoints per hour | 15 per hour | 2 hours |
| Source code | 200–400 changed lines per hour | n/a (async) | Split PRs > 400 changed lines where possible |
| AI prompt / tool definitions | 2–4 prompts or tools per hour | 4 per hour | 1.5 hours |

These guideline ranges are **provisional priors**. Once ≥ 20 reviews of a work-product type are recorded, they are replaced by the organisational process performance baselines **PPB-02 (review rate)** and **PPB-01 (review defect density)** in MPM-01 §8, with natural-process (control) limits.

### 6.1 Rate Outside Baseline Limits → Re-review

When the measured preparation or meeting rate for an inspection or technical review falls **outside the PPB-02 control limits** for that work-product type (or outside the provisional range above before PPB-02 exists):

1. The moderator flags the review as a **special-cause signal** in the PR-NNNN record.
2. If the rate is **above** the upper limit (reviewed too fast), the review outcome cannot be "Accept"; a **re-review** of the unexamined or under-examined portion is mandatory at a rate within limits.
3. If defect density is **below** the PPB-01 lower limit while the rate is high, the work product is re-reviewed by a different reviewer before acceptance.
4. If the rate is **below** the lower limit (unusually slow), the moderator records the cause (e.g. complexity, unclear entry criteria); no re-review is required but the cause is logged for CAR-01 analysis.
5. Signals are aggregated monthly in MC-01 and the sub-process control chart (MPM-01 §9).

## 7. Checklists

Reviewers apply the general checklist plus the checklist(s) for the work-product type. Findings are referenced by checklist item (e.g. "R-5").

### 7.1 General (G)

| ID | Check |
| :--- | :--- |
| G-1 | DOC-01 header complete; status and version correct |
| G-2 | IDs follow DOC-01 §7; no reused or duplicate IDs |
| G-3 | Product named "Nucleus Suite (Nucleus HRMS Suite)" |
| G-4 | No secrets, credentials or environment values |
| G-5 | No placeholders; every unknown value is stated with its accountable role and gate and is logged as an RSK-03 action with owner and due date |
| G-6 | References resolve to existing document IDs |
| G-7 | Revision history updated |

### 7.2 Requirements Quality (Q) — see REQ-03 for full criteria

| ID | Check |
| :--- | :--- |
| Q-1 | Each requirement is singular, unambiguous, verifiable, and uses MUST/SHOULD/MAY correctly |
| Q-2 | Acceptance criteria present and testable; golden-dataset expected results referenced where they exist |
| Q-3 | Rationale, source, priority, owner, phase (P0–P5) present |
| Q-4 | No third-party product names or comparisons ("works like X"); our own behaviour is described directly |
| Q-5 | Quantitative targets reference NFR IDs in 05_System_Requirements rather than restating numbers |
| Q-6 | Business invariants (e.g. INV-LEV-01, INV-ATT-01, INV-SEC-02, INV-PAY-01) identified and enforced where applicable |
| Q-7 | Privacy: personal data elements, purpose and retention identified |
| Q-8 | Traceability links to BG/BO upwards and to TC downwards in REQ-02 |

### 7.3 Reuse and Seams (R)

| ID | Check |
| :--- | :--- |
| R-1 | Each cross-domain hand-off is identified against the seam catalogue S-01..S-12 |
| R-2 | Seam behaviour (ownership, timing, conflict rules, error handling) is specified in a seam contract, not assumed |
| R-3 | System-of-record for every shared data field is stated (e.g. ERP-owned vs PPL-owned fields, seam S-07) |
| R-4 | Post-lock / post-approval change behaviour is defined (e.g. TIM→PAY after payroll lock, seam S-01) |
| R-5 | **Anti-repeat-work rule:** the work product consumes the shared components CMP-nn (e.g. CMP-01 workflow & approval engine) and does **not** re-specify or re-implement them. Any local re-implementation is logged as a **Major design defect** unless an ARB-approved exception exists (PCM-01 §5.4) |
| R-6 | Agent-initiated actions (seam S-11) go through the same permission-checked services as user actions |
| R-7 | Blocking open decisions (OD-nn) referenced; the work product does not silently pre-empt an open decision |

### 7.4 Design, Data and API (D)

| ID | Check |
| :--- | :--- |
| D-1 | Tenant scoping applied to every data access path |
| D-2 | Effective-dating / history semantics specified |
| D-3 | Server-side authorisation stated; client checks treated as UX only |
| D-4 | Idempotency and concurrency handling for mutations |
| D-5 | Audit events defined (actor, role, previous state, new state, timestamp, comments) |
| D-6 | Error contracts and validation rules defined |
| D-7 | Backward compatibility / versioning of APIs and events |

### 7.5 Code (C)

| ID | Check |
| :--- | :--- |
| C-1 | Typecheck, lint and tests pass; new behaviour has tests |
| C-2 | No hard-coded colours, strings or statutory values (use tokens, i18n catalogues, effective-dated rule configuration) |
| C-3 | Uses the defined data boundary and service layers; no direct fixture imports in components |
| C-4 | Security: input validation, output encoding, no secrets, least privilege |
| C-5 | Accessibility attributes and keyboard support for UI |
| C-6 | Logging excludes personal and sensitive data |

### 7.6 AI Artefacts (A)

| ID | Check |
| :--- | :--- |
| A-1 | Intended use, users and prohibited uses stated (AI feature specification and model card, GOV-11) |
| A-2 | Grounding sources defined; numeric facts come from deterministic services |
| A-3 | Tool allow-list and confirmation step for write actions |
| A-4 | Prompt-injection and data-exfiltration scenarios considered |
| A-5 | Evaluation set and pass thresholds defined (accuracy, groundedness, fairness) |
| A-6 | Human-in-the-loop for employment-affecting outputs |
| A-7 | Personal data minimised in prompts; provider terms per SAM-01 |

## 8. Defect Classification

### 8.1 Severity

| Severity | Definition | Examples |
| :--- | :--- | :--- |
| **Critical** | Would cause legal/statutory non-compliance, data breach, wrong pay, or block a gate | Wrong PF ceiling rule; missing tenant scoping; agent write without permission check |
| **Major** | Would cause incorrect behaviour, significant rework or a design defect | Ambiguous requirement; missing seam conflict rule; **re-implemented shared component (R-5)** |
| **Minor** | Would not cause incorrect behaviour but reduces quality or maintainability | Inconsistent terminology; missing glossary link |
| **Observation** | Suggestion; no defect | Alternative wording |

### 8.2 Type

| Code | Type |
| :--- | :--- |
| MIS | Missing (content absent) |
| WRG | Wrong (incorrect content) |
| AMB | Ambiguous |
| INC | Inconsistent (with itself or another document) |
| STD | Standard or artefact-format non-conformance |
| TRC | Traceability gap |
| DUP | Duplication / reuse violation |
| SEC | Security or privacy |

### 8.3 Origin Phase

Each defect records where it was **introduced** (requirements, design, code, test, configuration) to support defect-leakage analysis (MET-08), defect removal efficiency (PPB-03) and causal analysis (CAR-01).

## 9. Records

- Every technical review and inspection produces a **PR-NNNN** record using the peer review record (QA-02), stored alongside the reviewed work product under configuration control (CM-01).
- Pull-request reviews are their own record provided the PR links to the requirement/backlog item and shows reviewer approval; a periodic export feeds MPM-01.
- PQA samples records monthly (QA-01 §7.1).

### 9.1 Mandatory Base Measures (feed PPBs and PPMs)

Every PR-NNNN record MUST capture the following, using the operational definitions in MPM-01 §7. Records missing any mandatory measure fail exit criterion 3.

| Base measure | Unit | Used by |
| :--- | :--- | :--- |
| Work-product type | Enumerated (FRS, use case, data model, API, seam contract, code, AI artefact, test, other) | Stratification of all PPBs |
| Domain(s) | PLT…INT | Stratification |
| Size reviewed | Pages / requirements / use cases / entities / changed LOC / prompts | PPB-01, PPB-02 |
| Individual preparation effort | Person-hours per reviewer | PPB-02 |
| Meeting / async review effort | Person-hours | PPB-02 |
| Number of reviewers | Count | PPM-01 |
| Defects by severity (Critical / Major / Minor) | Count | PPB-01, PPB-03 |
| Defects by type and origin phase | Count | CAR-01, PPB-03 |
| Review rate (derived) | Size ÷ preparation hours | PPB-02, §6.1 |
| Review defect density (derived) | (Critical + Major) ÷ size | PPB-01 |
| Rework effort | Person-hours | Cost of quality |
| Outcome and re-review flag | Enumerated | MC-01 signals |

## 10. Metrics

| Metric | Definition | Ref. |
| :--- | :--- | :--- |
| Review coverage | % of baselined work products with a closed PR record | MET-09 input |
| Review effectiveness | Defects found in review ÷ (defects found in review + later phases) for the same work product | MET-09 |
| Defect density (review) | Major+Critical defects per page / per 100 requirements / per KLOC changed | MET-07 input |
| Preparation rate | Size ÷ preparation hours | §6 calibration |
| Reuse violations | Count of R-5 findings per phase | QA-01 QO-10 |
| Out-of-limit review rate signals | Count per month, by work-product type | PPB-02, MC-01 |

## 11. Tailoring

Per PCM-01: review type may be lowered one level (e.g. inspection → technical review) for low-risk work products with EPG approval recorded in the tailoring record. Reviews of statutory rules, security-relevant code, seam contracts and AI artefacts **may not** be tailored below inspection.

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
