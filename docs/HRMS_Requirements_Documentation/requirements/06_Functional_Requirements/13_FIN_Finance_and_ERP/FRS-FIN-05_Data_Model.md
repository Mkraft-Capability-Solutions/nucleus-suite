<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-05 — Finance & ERP — Data Model

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-05 |
| Title | Finance & ERP — Data Model |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, RDM |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 06_Data_Dictionary<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 06_Enum_Values<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 65_Enum_Seed_Values |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Every object carries the platform envelope (`tenant_id`, `entity_id`), effective dating (`effective_from`, `effective_to`) where temporal, and audit columns. Sensitivity classes follow GOV-10.

## 2. Data objects

| Object | Fields | Type | Required | Owner / source | Temporal | Sensitivity | Notes | Dataset ref |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| gl_mapping | mapping_id, entity, component_code, dr_cr, gl_account_code, gl_account_name, cost_centre_source, dimensioned_by[] | mixed | Y | Finance | Yes | — | Validated: every component in a run must be mapped before APPROVED. | 35_GL_Mapping |
| gl_journal | journal_id, run_id, entity, period, run_type, total_dr, total_cr, status, posted_at, external_doc_no | mixed | Y | System | No | Confidential | One balanced journal per run per entity. | 35_GL_Mapping |
| gl_journal_line | line_id, journal_id, account_code, dr_cr, amount, cost_centre, department, location, project, custom_dims | mixed | Y | System | No | Confidential | Split at employee level BEFORE aggregation. |  |
| employee_sync_log | sync_id, batch, external_code, nucleus_code, field, erp_value, nucleus_value, field_owner, payload_hash, received_at, applied_at, status, error | mixed | Y | System | No | Personal | Idempotent on the external employee code; conflict policy explicit. | 36_ERP_Inbound_Master |
| field_ownership_map | field, owner(ERP\|Nucleus), mandatory, conflict_policy | mixed | Y | Config | Yes | — | No field owned by both; every mandatory field owned by one. | 36_ERP_Inbound_Master |
| reconciliation_report | report_id, run_id, check, expected, actual, variance, status | mixed | Y | System | No | Confidential | A product screen, not a support script. |  |

### Additional objects and attributes (Authored)

| Object | Fields | Type | Required | Owner / source | Temporal | Sensitivity | Notes | Defined in |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| reconciliation_report | interface_id, batch_ref, drill_ref | text | N | System | No | Confidential | Every interface writes its reconciliation here; universal assertion received = applied + held + rejected + duplicate (PLT-INT-106). | ICD-01 §5.6 |
| integration_config | master_mode(nucleus_owns\|erp_owns\|co_owned), erp_system, sync_frequency, match_key, unmatched_action, primary_mechanism, fallback_mechanisms[], connector_ref | mixed | Y | Implementation | Yes | — | Per tenant; source_system on an inbound batch must equal erp_system; every tenant has a primary and at least one fallback journal delivery mechanism. | FRS-FIN-01 FIN-01.1; ICD-01 §6.1, §7.1 |
| department_cross_reference | legal_entity_code, department_code, org_unit_code, effective_from, maintained_by | mixed | Y | Nucleus (implementation consultant) | Yes | — | Maps ERP departments to Nucleus org units; an unmapped department on an inbound record is held. | ICD-01 §6.2, §8.2, §8.4 |
| erp_reference_code | master_type(COST_CENTRE\|PROJECT\|DEPARTMENT\|GL_ACCOUNT), code, name, status(Active\|Inactive\|Blocked), parent_code, level, legal_entity_code, account_type, valid_from, valid_to | mixed | Y | ERP | Yes | — | Read-only reference store; deactivation is effective-dated so historic journals stay valid; unknown or inactive codes raise HIGH pre-audit flags and an unknown account blocks journal generation. | ICD-01 §8 |
| reference_sync_log | snapshot_id, master_type, snapshot_mode(FULL\|DELTA), code, payload_hash, received_at, applied_at, status(applied\|applied_no_change\|rejected\|held), error | mixed | Y | System | No | — | Reference sync report: received = applied + no change + rejected + held. | ICD-01 §8.2, §8.4 |
| gl_journal | journal_version, idempotency_key | mixed | Y | System | No | Confidential | Key {tenant_id}:{run_id}:{legal_entity_code}:{journal_version} travels in the ERP reference field; a posted journal is immutable. | ICD-01 §7.1, §7.4 |
| gl_posting_log | posting_id, journal_id, run_id, idempotency_key, mechanism(api\|xml_voucher\|csv\|staging_table\|manual_download), target_system, attempt_no, sent_at, result(posted\|rejected\|pending\|dead_lettered), external_doc_no, error | mixed | Y | System | No | Confidential | Records what was sent, when, where, with what result and what reference came back, whatever the mechanism (RL-523); source of RP-15. | FRS-FIN-01 FIN-03.4; ICD-01 §7 |
| bank_payment_line | payment_ref, file_ref, seq_no, person_id, amount, status(ACCEPTED\|PROCESSED\|REJECTED\|RETURNED), bank_txn_ref, reason_code, status_at, repaid_by_payment_ref | mixed | Y | System / Bank | No | Restricted | Rejected or returned lines form the returned-payment queue and are re-paid only through a separate file; account numbers never stored here. | ICD-01 §9.2, §9.4 |
| bank_layout_template | bank_code, layout_version, format(fixed_width\|csv\|credit_transfer_xml), effective_from, test_file_ref, approved_by_bank_on | mixed | Y | Finance | Yes | — | Switching layout is configuration with a test file approved by the bank. | ICD-01 §9.1, §9.4 |

## 3. Enumerations

| Enum code | Enum name | Module | System or Config | Complete value set | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| EN_MASTER_OWNER | Master owning system | INT | Config | ERP · Nucleus · Both with field-level ownership | R-15 |
| EN_SYNC_STATUS | Sync status | INT | System | Success · Failed · Pending · Skipped | R-15 |

### Enumeration seed values and tenant defaults

| Enum code | Enum name | Module | System or Config | Complete value set | Default in this tenant | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EN_MASTER_OWNER | Master owning system | INT | Config | ERP · Nucleus · Both with field-level ownership | ERP | R-15 |
| EN_SYNC_STATUS | Sync status | INT | System | Success · Failed · Pending · Skipped |  | R-15 |

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
| Size | 19 | specified items (table rows) | Counted automatically at generation |
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
