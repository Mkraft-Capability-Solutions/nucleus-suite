<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-06 — Finance & ERP — State Machines and Events

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-06 |
| Title | Finance & ERP — State Machines and Events |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 11_State_Machines, 12_Events |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. State machines

No object in this domain has a governed lifecycle in the source; records follow the platform's effective-dated create / update / end-date pattern.

## 2. Domain events

Event names follow `domain.object.verb` in the past tense. Every event carries the envelope defined in IA-02.

| Event | Emitted by | Payload (beyond envelope) | Consumers | Idempotency key | Retention |
| :--- | :--- | :--- | :--- | :--- | :--- |
| integration.sync.applied | FIN-01 | sync_id, external_code, fields[] | People core, audit | payload_hash | Medium |
| integration.sync.conflict | FIN-01 | sync_id, field, erp_value, nucleus_value | HR review queue | payload_hash + field | Medium |

### Additional events (Authored)

| Event | Emitted by | Payload (beyond envelope) | Consumers | Idempotency key | Retention | Defined in |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| integration.sync.received | FIN-01.3 (FIN-INT-001) | sync_id, batch, external_code, payload_hash, received_at | Sync monitor (SCR-101), duplicate check FIN-01.4, sync reconciliation | batch + external_code + payload_hash | Medium | FRS-FIN-01 FIN-01.3; ICD-01 §6 |
| payroll.journal.blocked | FIN-03.2 | run_id, legal_entity_id, unmapped_component_codes[], blocked_at | Payroll run approval gate (SCR-050), GL mapping screen (SCR-102), Finance notifications | run_id + legal_entity_id + unmapped component set | Medium | FRS-FIN-01 FIN-03.2; ICD-01 §7.4 |
| integration.journal.posted | FIN-03.4 (FIN-INT-002) | journal_id, run_id, mechanism, target_system, attempt_no, result(posted\|rejected\|pending), external_doc_no | Posting log (RP-15), payroll run write-back FIN-03.5, Finance alerts, reconciliation | journal idempotency key ({tenant_id}:{run_id}:{legal_entity_code}:{journal_version}) + attempt_no | Long | FRS-FIN-01 FIN-03.4; ICD-01 §7 |
| finance.reconciliation.run | FIN-04.1 | report_id, run_id, checks_passed, checks_failed, failed_checks[] | Reconciliation screen (SCR-103), Finance, payroll period close, analytics | report_id | Long | FRS-FIN-01 FIN-04.1; ICD-01 §5.6, §7.4 |

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
| Size | 6 | specified items (table rows) | Counted automatically at generation |
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
