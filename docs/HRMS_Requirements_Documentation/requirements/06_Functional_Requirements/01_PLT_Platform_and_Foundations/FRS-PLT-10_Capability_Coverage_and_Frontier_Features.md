<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-10 — Platform & Foundations — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-10 |
| Title | Platform & Foundations — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Platform & Foundations |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| PLT-01 | Tenant provisioning | High | P0 | CMP-09 |
| PLT-02 | Identity, role and data-scope grant | Critical | P0 | CMP-08 |
| PLT-03 | Configuration authoring and effective dating | Critical | P0 | CMP-09, CMP-10 |
| PLT-04 | Workflow definition and versioning | High | P0 | CMP-01 |
| PLT-05 | Approval chain execution | Critical | P0 | CMP-01 |
| PLT-06 | Audit and action ledger write | Critical | P0 | CMP-06 |
| PLT-07 | Event publish and outbox relay | Critical | P0 | CMP-07 |
| PLT-08 | Bi-temporal write and as-at read | Critical | P0 | CMP-10 |

Forms specified: 3 with 58 fields; screens: 1; rules: 13.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-PLT-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| PLT-CG-001 | Adaptive MFA and step-up authentication | The system MUST enforce multi-factor authentication (TOTP, push, passkey/FIDO2) for all privileged roles and MUST require step-up re-authentication before viewing masked identifiers, changing bank details, approving payroll or granting roles. | Must | P0 |
| PLT-CG-002 | Notification matrix and preference centre | The system MUST deliver every workflow and system notification through a configurable channel matrix (in-app, email, push, SMS, business messaging) with per-user language, quiet hours, digest batching and an auditable delivery log. | Must | P1 |
| PLT-CG-003 | No-code business-process designer | Tenant administrators MUST be able to author, version, simulate and publish approval chains, conditions and SLAs on the shared approval engine (CMP-01) without a code release; every published version MUST be effective-dated and reversible. | Must | P2 |
| PLT-CG-004 | Configuration sandbox and promotion | The system MUST provide a sandbox tenant per production tenant and MUST support promoting configuration packages (rules, picklists, workflows, rule packs) between tenants with diff, approval and rollback. | Should | P2 |
| PLT-CG-005 | Proxy, delegation and act-as | Users MUST be able to delegate approval authority for a date range, and authorised support staff MAY act-as a user for diagnosis; both MUST be time-boxed, reason-coded and recorded in the audit trail with the real actor. | Must | P1 |
| PLT-CG-006 | Bulk data load with validation and rollback | The system MUST import any master or transaction object from spreadsheet/CSV/API in bulk with row-level validation against the same rules as the form, a dry-run report, partial-commit control and full rollback of a load batch. | Must | P1 |
| PLT-CG-007 | Custom objects and fields | Tenant administrators SHOULD be able to add custom fields and custom objects to core objects with type, validation, security classification and reporting exposure, without schema releases. | Should | P3 |
| PLT-CG-008 | Legacy HRMS data migration toolkit | The system MUST provide mapping templates, transformation rules, load sequencing and reconciliation reports (record counts, balances, YTD values) for migrating from legacy HRMS and payroll systems. | Must | P1 |
| PLT-CG-009 | Data subject rights workflow | The system MUST support DPDP/GDPR data-principal requests (access, correction, erasure, grievance) with identity verification, SLA tracking and erasure that anonymises PII while retaining statutory payroll records. | Must | P1 |
| PLT-CG-010 | Identity provisioning (SCIM/LDAP) | The system MUST provision, update and de-provision user identities in downstream enterprise directories (SCIM 2.0, LDAP) on hire, transfer and exit events within 15 minutes of the effective event. | Must | P2 |
| PLT-CG-011 | As-at time travel for every record | Authorised users MUST be able to view any record, report or organisation chart as it was known on a chosen past date (transaction time) and as effective on a chosen date (valid time), with differences highlighted. | Must | P2 |
| PLT-CG-012 | Policy-as-code with automated regression | Every configurable policy (leave, attendance, payroll, eligibility) MUST be stored as versioned, testable policy definitions; a policy change MUST run the golden test suite and block publication on any unexplained difference. | Must | P2 |
| PLT-CG-013 | Extension marketplace and low-code apps | The platform SHOULD allow tenants and partners to publish governed extensions (custom screens, workflows, tools) packaged with permissions, data scopes and automated security review before installation. | Should | P4 |
| PLT-CG-014 | Multi-currency and multi-entity consolidation | The system MUST support multiple legal entities and currencies within one tenant with consolidated, currency-converted reporting using dated exchange rates. | Must | P3 |
| PLT-CG-015 | Document management with AI extraction | The system MUST store employee documents with type classification, expiry tracking and OCR extraction of key fields (name, number, dates) that a human confirms before the data is written to the record. | Must | P2 |
| PLT-CG-016 | Visitor and gate management | Sites SHOULD register visitors, issue time-bound passes, record entry and exit at gates and link visits to the host employee for safety and security audit. | Should | P3 |
| PLT-CG-017 | Expanded Indian language coverage | The interface, notifications, letters and Nucleus Talk voice MUST support Kannada, Gujarati, Malayalam, Odia and Punjabi in addition to the 11 base languages, with each tenant enabling the languages of its sites and every translation reviewed before release. | Must | P2 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLT-FX-001 | Zero-trust continuous authorisation | Every request is evaluated against identity, device posture, location scope, time and behaviour risk; sensitive reads trigger step-up or are denied in real time. | Moves beyond static role security to continuous, context-aware access for frontline shared devices and remote work. | Scope resolver, policy gate | Tier 1 | P4 |
| PLT-FX-002 | Natural-language configuration | Admins describe a policy change in plain language (any of 11 languages); the system drafts the configuration change set, shows a diff and an impact simulation, and routes it for approval — nothing applies without a human. | Configuration becomes conversational and reviewable instead of consultant-driven. | Rule pack evaluator, CMP-01 approval engine | Tier 2 | P5 |
| PLT-FX-003 | Policy digital twin | Replays historical transactions against a proposed policy/rule change and reports affected people, pay deltas and compliance effects before deployment. | Eliminates trial-and-error policy changes in production. | Recompute worker, effective-dated write | Tier 1 | P5 |
| PLT-FX-004 | Tamper-evident audit ledger | Audit and agent action ledgers are hash-chained and periodically anchored, so any alteration is detectable during audits. | Gives auditors cryptographic evidence, not just logs. | Action ledger | No AI | P4 |
| PLT-FX-005 | Privacy vault and consent ledger | Identifiers and sensitive attributes are stored in a field-encrypted vault with purpose-based access and a per-person consent ledger exposed in self-service. | Privacy-by-design for DPDP/GDPR as a product feature. | Scope resolver | No AI | P3 |
| PLT-FX-006 | Offline-first edge for plants | Site edge nodes continue punch capture, roster and approvals during WAN loss and sync with deterministic conflict resolution. | Factory floors keep running without cloud connectivity. | Outbox, recompute worker | No AI | P4 |
| PLT-FX-007 | Autonomous configuration health check | An agent continuously scans tenant configuration for conflicts, unused rules and risky settings, and proposes fixes with impact simulation. | Keeps complex configurations clean as tenants grow. | Policy-as-code, policy digital twin | Tier 2 | P4 |

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
| Size | 32 | specified items (table rows) | Counted automatically at generation |
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
