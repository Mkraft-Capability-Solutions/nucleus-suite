<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-INT-07 — Intelligence & Agents — APIs, Integrations and Agents

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-INT-07 |
| Title | Intelligence & Agents — APIs, Integrations and Agents |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Intelligence & Agents |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI |
| Related documents | FRS-INT-00, FRS-INT-01, FRS-INT-02, FRS-INT-03, FRS-INT-04, FRS-INT-05, FRS-INT-06, FRS-INT-07, FRS-INT-08, FRS-INT-09, FRS-INT-10, FRS-INT-11, FRS-INT-12, FRS-INT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-08 · processes INT-01–INT-04 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 13_API_and_Tools, 14_Agents, 15_Integration_Flows<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Form CRUD endpoints

_No entries in source for this scope._

## 2. Public REST and governed tool surface

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TOOL | run_report | read | Governed query over the analytics model | analytics.read | read | — | Analyst agent | Returns chart and the SQL |

### Additional interfaces (Authored)

| Surface | Name | Method / class | Purpose | Permission | Side effect | Consumed by | Defined in |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TOOL | MCP server (initialize, tools/list, tools/call) | JSON-RPC 2.0 over streamable HTTPS | Expose the twelve governed tools of IA-01 to the client AI environment under the same policy gate, autonomy limits and action ledger as internal agents | OAuth 2.1 authorisation code with PKCE bound to a human principal; tool scopes equal the IA-01 permissions | read | Client AI environment | ICD-01 §17 (INT-INT-001) |

## 3. Integration flows

| Flow | Direction | Mechanism | Cadence | Payload | Ownership / rules | Reconciliation | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MCP server | Nucleus ↔ client AI environment | MCP over the governed tool surface | On demand | Scoped tool calls | Same policy gate and action ledger as internal agents | Every call in the ledger | P3 |

Payload-level specifications are in ICD-01.

## 4. Agents operating in this domain

| Agent | Cadence | What it does | Tools used | Autonomy default | Approval threshold | Ledger fields | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Policy Assistant | On demand | Grounded policy answers with citations, own-data retrieval, simple actions | read_employee, check_loan_eligibility, apply_leave, create_ticket | Auto for reads, confirm for writes | Any write confirms | question, retrieved_sources, tool, inputs, confirmation, outcome | P2 |
| Attendance Steward | Daily | Triages the exception queue, proposes regularisations, flags unpaired punches and inferred shifts, drafts manager nudges | list_exceptions, propose_regularisation, read_employee | Propose only; auto under the configured threshold | Tenant-set minutes threshold | exception_id, evidence, proposed_change, simulation, approver, outcome | P2 |
| Payroll Preparer | Per cycle | Assembles inputs, runs the pre-audit, classifies each flag, drafts resolutions, produces a signed readiness report | simulate_payroll, run_pre_audit, read_employee | Propose only. Always. | No autonomous payroll change, ever | run_id, flags_classified, drafts, readiness_report_hash | P3 |
| Compliance Watcher | Continuous | Tracks the obligation calendar, assembles filing packs and statutory forms from posted data, flags rule changes and tenant impact | assemble_filing_pack, run_report | Prepare and alert; a human files | Filing always human | obligation_id, pack_ref, impact_analysis | P3 |
| Recruiting Coordinator | Continuous | Screens against the ontology, schedules, chases scorecards, drafts communication | schedule_interview, run_report | Scheduling auto; all candidate decisions human | No auto-reject, ever | requisition_id, candidate_id, action, human_decision | P3 |
| Manager Coach | Weekly | One brief per manager: who needs attention and why, drawn from real signals, with a suggested action | run_report, read_employee | Read only | — | manager_id, signals_used, brief_ref | P3 |
| Onboarding Runner | Per hire | Drives the joining chain, chases blockers, escalates on SLA | run_report, create_ticket | Auto within the workflow definition | Escalation only | workflow_instance_id, steps_chased, escalations | P3 |
| Exit Coordinator | Per exit | Chases clearance, prepares F&F, tracks knowledge transfer | run_report, create_ticket, draft_letter | Prepare; a human releases | F&F release always human | person_id, items_chased, fnf_pack_ref | P3 |
| Analyst | On demand | Natural-language question to a governed query, returns a chart and the SQL | run_report | Read only | — | question, generated_sql, row_count | P3 |

## 5. API requirements (Authored)

- Public REST MUST be described in OpenAPI 3.1, versioned, with a sandbox tenant per partner (IA-01).
- Every write MUST accept an `Idempotency-Key` and return the effective-dated version it created.
- The tool surface is built once and exposed twice (internal agents and external MCP clients); every tool call MUST pass the policy gate and be recorded in the action ledger.

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
