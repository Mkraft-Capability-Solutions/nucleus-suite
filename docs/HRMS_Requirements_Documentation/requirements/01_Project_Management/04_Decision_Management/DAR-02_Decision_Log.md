<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# DAR-02 — Decision Log

| Attribute | Value |
| :--- | :--- |
| Document ID | DAR-02 |
| Title | Decision Log |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Programme Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | EPG Lead, Enterprise Architect — *pending* |
| Approved by | Not baselined (living) |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | DAR, CM, MC |
| Related documents | DAR-01, the decision record (DAR-01), CM-03, PLN-01, PLN-02, GOV-04 |
| Quality & process-performance objectives | QPPO-04, QPPO-06 |
| Process performance baseline used | n/a — decision procedure; uses PPM outputs as evaluation inputs |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

The index of all significant Nucleus Suite decisions:
- formal DAR decisions (DAR-01)
- recorded decisions taken in the normal course of governance
- open decisions awaiting closure

## 2. Status Definitions

| Status | Meaning |
| :--- | :--- |
| **Proposed** | Recommendation prepared; awaiting the approving body |
| **Recorded** | Decision already in effect, documented here for traceability. It was not subject to a formal DAR evaluation (a retrospective DAR may be required where a DAR-01 trigger applies). |
| **Approved** | Approved through DAR-01 by the authority named |
| **Superseded** | Replaced by a later decision (reference given) |
| **Reversed** | Withdrawn after review |

## 3. Decision Index

| DEC ID | Title | Date | Status | Decision owner / approver | DAR trigger | Summary and rationale | Consequences / constraints | Review trigger | Links |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DEC-0001 | Adopt a CMMI-aligned governance framework targeting Maturity Level 5 | 2026-11-05 | **Proposed** — awaiting SteerCo ratification | Programme Manager / SteerCo | T8, T9 | The gap analysis found the governance folder held only cloned placeholder documents. The proposal is to adopt the full document set (DOC, GOV, PLN, REQ, CM, OCM, RSK, QA, MPM, MC, DAR, CAR, PCM, SAM, OT, TPL), build ML2/ML3 practices first, and then add quantitative management (QPPO, PPB, PPM) and CAR toward ML5. | All requirement documentation follows DOC-01. The source-workbook ID schemes are adopted (REQ-01). Measurement data is collected from P0. | SteerCo decision; first internal readiness assessment | CR-0001 (CM-03) |
| DEC-0002 | Current phase is local JSON UI validation; live backend and database work only on an explicit signal | 2026-11-05 (recorded) | **Recorded** | Executive Sponsor | — | The prototype stage (R0) validates screens, flows and role consoles with in-memory JSON data through a single data boundary. No production database, external API, production authentication, live payroll disbursement or statutory filing is active. | P0 week 1 begins only on the sponsor's signal. The server domain and migrations remain dormant/reference-only in R0. Mutations reset on refresh by design. | Sponsor go signal for P0 | PLN-01 §2, PLN-02 §1 |
| DEC-0003 | Front-end stack: server-rendered TypeScript (strict) web framework with a design-token component library | 2026-11-05 (recorded) | **Recorded** | Enterprise Architect | T1 (retrospective DAR to be considered at G2) | This is the stack in use for the R0 prototype. Strict TypeScript, design tokens (no hard-coded colours), externalised i18n strings (11 languages) and a navigation catalog as single source of truth are the established conventions. | Quality gates: typecheck, lint, tests, build. RTL support for Arabic is deferred. | G2 architecture baseline | PLN-01 §11 |
| DEC-0004 | Target persistence: multi-tenant relational database with tenant-scoped transactions | 2026-11-05 | **Proposed** | Enterprise Architect / ARB | T1, T4 | The target design scopes every database operation through a tenant transaction wrapper, versions all schema changes as migrations, makes transactional endpoints idempotent, and protects concurrent balance deductions with row locks or atomic conditional updates. | Must be confirmed by a formal DAR before G2. It is dormant in R0 (DEC-0002). Data-residency implications go to the DPO (GOV-10). | G2; data-residency decision | PLN-02 §6 |
| DEC-0005 | Dual-engine pattern: client calculation engines in the client services layer, authoritative domain logic in the server layer | 2026-11-05 (recorded) | **Recorded** | Enterprise Architect | — | Client-side engines give instant previews (e.g. sandwich rule, punch pairing, eligibility). The authoritative server domain owns persistence, validation and audit. Server-only modules must never be imported into client components (this would break the bundle). | Client-side role checks are UI convenience only, never authorisation. Server enforcement is required from P0. The rules in client previews and the server domain must stay consistent; shared components (CMP-nn) define the authoritative behaviour. | G2 architecture baseline | PLN-02 §2.2 |

## 4. Open Decisions from the Source Workbooks (OD-nn)

The source workbooks carry a list of **open decisions `OD-nn`**, each with an owner and a closure point. They are **tracked through this log by reference**. The authoritative OD list is the imported catalogue in the `requirements/` tree (REQ-01 §3), and it is not copied here.

Tracking rules:
1. Each OD-nn is a DAR-01 trigger (T12).
2. When an OD is closed, a DEC-nnnn record is created here that cites the OD ID. The imported OD entry is updated with the DEC reference.
3. An OD past its closure point is escalated in the weekly status report (MC-01) and logged as an issue in RSK-03.

| OD ref | Example (from source) | Owner | Close by | DEC | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| OD-01 | Node framework: NestJS vs Fastify | Engineering lead | P0 week 2 | — | Open (tracked) |
| OD-02 … OD-nn | See imported open-decision catalogue | Per source | Per source | — | Tracked by reference |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Not baselined (living) | *pending* | | | |

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
