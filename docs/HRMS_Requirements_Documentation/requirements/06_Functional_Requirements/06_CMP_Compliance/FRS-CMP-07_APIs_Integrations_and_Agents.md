<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-07 — Compliance — APIs, Integrations and Agents

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-07 |
| Title | Compliance — APIs, Integrations and Agents |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compliance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI |
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 13_API_and_Tools, 14_Agents, 15_Integration_Flows<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Form CRUD endpoints

| Form ID | Form | Target object | Endpoint |
| :--- | :--- | :--- | :--- |
| FRM-CMP-01 | Obligation Calendar Entry | obligation_calendar | /api/v1/compliance/obligations |

## 2. Public REST and governed tool surface

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REST | /v1/compliance/forms | GET, POST | Form library and generated instances | compliance.read/write | write | No | Compliance UI | State-scoped |
| TOOL | assemble_filing_pack | propose | Build a statutory pack from posted records | compliance.propose | propose | Yes | Compliance Watcher | A human files |

## 3. Integration flows

| Flow | Direction | Mechanism | Cadence | Payload | Ownership / rules | Reconciliation | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EPFO / ESIC / state portals | Nucleus → Authority | Generated files (ECR, contribution, PT, LWF, 24Q) filed by a human | Monthly / quarterly | Statutory returns and challans | Generated from posted records only; acknowledgement captured as evidence | Statutory liability in the journal = challan amount | P1 |

Payload-level specifications are in ICD-01.

## 4. Agents operating in this domain

| Agent | Cadence | What it does | Tools used | Autonomy default | Approval threshold | Ledger fields | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Compliance Watcher | Continuous | Tracks the obligation calendar, assembles filing packs and statutory forms from posted data, flags rule changes and tenant impact | assemble_filing_pack, run_report | Prepare and alert; a human files | Filing always human | obligation_id, pack_ref, impact_analysis | P3 |

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
| Size | 5 | specified items (table rows) | Counted automatically at generation |
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
