<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-EXP-07 — Experience — APIs, Integrations and Agents

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-EXP-07 |
| Title | Experience — APIs, Integrations and Agents |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Experience |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI |
| Related documents | FRS-EXP-00, FRS-EXP-01, FRS-EXP-02, FRS-EXP-03, FRS-EXP-04, FRS-EXP-05, FRS-EXP-06, FRS-EXP-07, FRS-EXP-08, FRS-EXP-09, FRS-EXP-10, FRS-EXP-11, FRS-EXP-12, FRS-EXP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-19, R-20, R-21, R-22 · processes EXP-01–EXP-03 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 13_API_and_Tools, 14_Agents, 15_Integration_Flows<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Form CRUD endpoints

| Form ID | Form | Target object | Endpoint |
| :--- | :--- | :--- | :--- |
| FRM-EXP-01 | Letter Generation | letters_register | /api/v1/hr-letters |
| FRM-EXP-02 | Recognition Nomination | recognition_register | /api/v1/recognition-events |
| FRM-EXP-03 | Announcement | announcement_management | /api/v1/announcements |

## 2. Public REST and governed tool surface

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TOOL | draft_letter | propose | Render a letter draft from a template | experience.propose | propose | Yes | HR assistant | Human reviews before issue |

### Additional interfaces (Authored)

| Surface | Name | Method / class | Purpose | Permission | Side effect | Consumed by | Defined in |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| WEBHOOK | /v1/integration/esign/callback | POST | E-signature envelope status, signed document and audit certificate | Provider HMAC-SHA256 signature (no bearer scope) | write | E-signature provider | ICD-01 §14 (EXP-INT-001) |

## 3. Integration flows

| Flow | Direction | Mechanism | Cadence | Payload | Ownership / rules | Reconciliation | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E-signature | Nucleus → Vendor | Vendor API | Per document | Letters, policies, contracts | Signed artefact retained with the template version | Issued vs signed register | P2 |

Payload-level specifications are in ICD-01.

## 4. Agents operating in this domain

| Agent | Cadence | What it does | Tools used | Autonomy default | Approval threshold | Ledger fields | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Exit Coordinator | Per exit | Chases clearance, prepares F&F, tracks knowledge transfer | run_report, create_ticket, draft_letter | Prepare; a human releases | F&F release always human | person_id, items_chased, fnf_pack_ref | P3 |

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
| Size | 7 | specified items (table rows) | Counted automatically at generation |
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
