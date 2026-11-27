<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# BA-06 — Shared Component Reuse Register

| Attribute | Value |
| :--- | :--- |
| Document ID | BA-06 |
| Title | Shared Component Reuse Register |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Chief Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Architecture Review Board — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PAD |
| Related documents | BA-01, SRS-01, RB-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 16_Reuse_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

> REUSE REGISTER — THE ELEVEN SHARED COMPONENTS
> READ THIS BEFORE ESTIMATING ANYTHING. Each row is one component with many consumers. A story that re-implements one of these is a design defect, not a delivery.

**Build-once rule.** Eleven capabilities that look like separate features are each one shared component. A story that re-implements one of them is a design defect, checked in peer review (QA-02).

| Component | Component name | What it owns | Consumed by | Built in | Owner | Anti-pattern to avoid |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMP-01 | Workflow & approval engine | Chain definition, step resolution, SLA, escalation, delegation, versioning, HR override | Leave, gate pass, overtime, regularisation, loan sanction, guarantor acceptance, requisition, letters, recognition, clearance, assignment change, payroll approval, agent approval | P0 | Platform | Do NOT write a per-module approval table. Thirteen consumers, one engine. |
| CMP-02 | Ledger pattern | Append-only transaction rows with credit, debit, reversal, lapse and an idempotency key; balance as a projection | Leave balance, comp-off, loan outstanding, gate-pass minutes used, EWA accrual, late-instance counting | P1 | Time & Leave | Do NOT add a running-balance column anywhere. v1.0 did and v1.1 removed it. |
| CMP-03 | Calculation DAG & rule evaluator | Topological node evaluation, versioned rule packs, intermediate value capture, explainability trace | Payroll gross-to-net, wage-base simulation, F&F, arrears, off-cycle OT, gratuity and bonus provisioning, encashment | P1 | Payroll | Do NOT hand-code a formula in a module. Every computation is a node. |
| CMP-03r | Template renderer | Merge fields, version pinning, draft-then-human-review, issue register, file retention | Letters, statutory forms, announcements, payslip PDF, offer letters, certificates, filing packs | P2 | Experience | Do NOT build a second renderer for statutory forms. Same engine, different templates. |
| CMP-04 | Derivation & recompute worker | Idempotent projection over immutable events with as-at policy reads, delta output, isolated execution | Attendance day, disposition, overtime, gate-pass credit, leave-linked days, contractor attendance, analytics projections | P1 | Time | Do NOT recompute inline in the request path, and do NOT edit derived rows by hand. |
| CMP-05 | Lock & blocking-item semantics | A gate that holds an operation while named prerequisites are open, with explicit waiver and reason | Payroll input lock, clearance blocking F&F, GL mapping blocking approval, CRITICAL audit flag blocking approval, guarantor lock blocking eligibility | P1 | Payroll | Five features, one mechanism. Implement the lock once and configure the prerequisites. |
| CMP-06 | Audit & action ledger | Append-only record of actor, agent, before, after, reason, IP; sensitive-read logging; reversal handles | Every write in the product, every sensitive read, every agent action, every override and waiver | P0 | Platform | Do NOT scatter module-specific history tables. |
| CMP-07 | Outbox & event bus | Transactional outbox, relay worker, idempotent consumers, CloudEvents envelope | Recompute triggers, notifications, analytics projections, webhooks, integration dispatch, learning assignment, announcements | P0 | Platform | Do NOT call another module synchronously for a side effect. |
| CMP-08 | Scope resolver | Tenant ∩ entity ∩ location ∩ reporting line ∩ payroll group, evaluated at query time, with field-level nulling | Every list, every report, every export, every API read, every tool call, team history, payslip visibility | P0 | Platform | Do NOT filter in the UI. The plant-user test (RL-005) runs on every build. |
| CMP-09 | Rule pack interface | Versioned, effective-dated, jurisdiction-scoped declarative packs with their own test suites and changelog | PF, ESI, PT, LWF, TDS, gratuity, bonus, overtime multipliers, leave statutory minima, form applicability | P1 | Compliance | Do NOT branch on state inside application code. Ever. |
| CMP-10 | Effective-dated configuration & temporal read | Config objects with validity, the as-at reader, and the override-with-reason pattern | Worker class, designation, shift, rule sets, leave policy, calendars, GL mapping, ownership map, sanctioned strength, approval chains | P0 | Platform | Do NOT read today's configuration when computing a past date. |
| CMP-11 | Model gateway & policy gate | Provider-neutral LLM calls, prompt versioning, cost attribution, caching, plus the agent policy gate and tool registry | Policy assistant, document extraction, duplicate detection, review drafting, candidate matching, anomaly detection, every agent | P2 | Intelligence | Do NOT call a vendor SDK from domain code, and do NOT give an agent a non-tool path to data. |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| Approval authority (DOC-01 §7) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 12 | specified items (table rows) | Counted automatically at generation |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | items / hour | Compare with PPB control limits |
| Requirement volatility (changes since baseline) | 0 | CRs touching this artefact | Not yet baselined (CM-03) |

**Defects found, by detection phase and severity**

| Detection phase | Major | Minor | Editorial | Injected in phase (major) |
| :--- | :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 | — |
| Peer review | *pending* | | | |
| Design / build | | | | |
| System / integration test | | | | |
| UAT | | | | |
| Production (escaped) | | | | each escaped major opens a CAR record (CAR-01) |

Within control limits of the review-rate PPB? *To be assessed at peer review.*

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
