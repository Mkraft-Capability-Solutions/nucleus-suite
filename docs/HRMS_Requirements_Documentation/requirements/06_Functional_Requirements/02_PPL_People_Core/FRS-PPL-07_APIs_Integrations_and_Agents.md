<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-07 — People Core — APIs, Integrations and Agents

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-07 |
| Title | People Core — APIs, Integrations and Agents |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — People Core |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI |
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 13_API_and_Tools, 14_Agents, 15_Integration_Flows<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Form CRUD endpoints

| Form ID | Form | Target object | Endpoint |
| :--- | :--- | :--- | :--- |
| FRM-PPL-01 | Add / Edit Employee — Identity and Personal | person_record | /api/v1/people |
| FRM-PPL-02 | Employment, Assignment and Policy | assignment_admin | /api/v1/organization/tree |
| FRM-PPL-03 | Position Master | position_register | /api/v1/organization/tree |
| FRM-PPL-04 | Sanctioned Strength | sanctioned_strength | /api/v1/organization/tree |
| FRM-PPL-05 | Document Upload and Verification | document_vault | /api/v1/ops/modules/document_vault/records |
| FRM-PPL-06 | Asset Allocation and Return | asset_register | /api/v1/assets |

## 2. Public REST and governed tool surface

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REST | /v1/people | GET, POST | List and create persons | people.read / people.write | write | No | Partners, ERP | Read-only fields rejected in ERP-owned mode |
| REST | /v1/assignments | GET, POST, PATCH | Assignment lifecycle with effective dating | people.write | write | No | Partners, HRIS | PATCH requires effective_from and reason |
| REST | /v1/integration/employee-master | POST | ERP inbound upsert | integration.write | write | No | ERP | Idempotent on external code; conflicts held |
| TOOL | read_employee | read | Employee record within the caller's scope | people.read | read | — | Policy Assistant, Manager Coach | Compensation fields obey RL-005 |

## 3. Integration flows

| Flow | Direction | Mechanism | Cadence | Payload | Ownership / rules | Reconciliation | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Employee master | ERP → Nucleus (configurable) | REST upsert through integration-svc, or scheduled file | Nightly + on-change | External code, name, DOB, DOJ, department, cost centre | Field ownership map; conflicts held; idempotent on external code; never last-write-wins | employee_sync_log: received vs applied vs held vs unmatched vs duplicate | P1 |
| Cost centre, project and department master | ERP → Nucleus | API or file | Weekly | Code, name, status, hierarchy | Nucleus does not maintain a second copy of the client's cost structure | Unmapped codes reported before a run | P1 |

Payload-level specifications are in ICD-01.

## 4. Agents operating in this domain

| Agent | Cadence | What it does | Tools used | Autonomy default | Approval threshold | Ledger fields | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Policy Assistant | On demand | Grounded policy answers with citations, own-data retrieval, simple actions | read_employee, check_loan_eligibility, apply_leave, create_ticket | Auto for reads, confirm for writes | Any write confirms | question, retrieved_sources, tool, inputs, confirmation, outcome | P2 |
| Attendance Steward | Daily | Triages the exception queue, proposes regularisations, flags unpaired punches and inferred shifts, drafts manager nudges | list_exceptions, propose_regularisation, read_employee | Propose only; auto under the configured threshold | Tenant-set minutes threshold | exception_id, evidence, proposed_change, simulation, approver, outcome | P2 |
| Payroll Preparer | Per cycle | Assembles inputs, runs the pre-audit, classifies each flag, drafts resolutions, produces a signed readiness report | simulate_payroll, run_pre_audit, read_employee | Propose only. Always. | No autonomous payroll change, ever | run_id, flags_classified, drafts, readiness_report_hash | P3 |
| Manager Coach | Weekly | One brief per manager: who needs attention and why, drawn from real signals, with a suggested action | run_report, read_employee | Read only | — | manager_id, signals_used, brief_ref | P3 |

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
| Size | 16 | specified items (table rows) | Counted automatically at generation |
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
