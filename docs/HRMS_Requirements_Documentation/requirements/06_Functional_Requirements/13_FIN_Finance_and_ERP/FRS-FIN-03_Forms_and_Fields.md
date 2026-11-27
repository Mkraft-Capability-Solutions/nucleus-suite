<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-03 — Finance & ERP — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-03 |
| Title | Finance & ERP — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-FIN-01 | GL Mapping | SCR-102 | Finance | 8 | Payroll & Finance > Payroll & finance operations > GL mapping and journal (SCR-102) | gl_mapping | /api/v1/ops/modules/gl_mapping/records |
| FRM-FIN-02 | ERP Integration and Field Ownership | SCR-100 | Implementation consultant | 9 | Core HR > Integration operations > Integration configuration (SCR-100) | integration_config | /api/v1/integrations/connections |

## 2. Field specifications

### FRM-FIN-01 — GL Mapping (SCR-102)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Mapping | Legal entity | entity_code | Lookup | Ref | Y | — | Within the grant | — | Finance | — |
| Mapping | Pay component | component_code | Lookup | Ref | Y | — | Active component | — | Finance | Every component in a run must be mapped |
| Mapping | Debit account | dr_account | Lookup | Ref | Y | — | Active in the chart of accounts | — | Finance | — |
| Mapping | Credit account | cr_account | Lookup | Ref | Y | — | Active in the chart of accounts | — | Finance | — |
| Mapping | Dimension source | dimension_source[] | Multi-select | Char[] | Y | Cost centre from assignment | At least one | — | Finance | Split at employee level before aggregation |
| Mapping | Override by location | location_override[] | Table | Composite | N | — | — | — | Finance | Repeating: location, debit, credit |
| Mapping | Effective from | effective_from | Date | Date | Y | Today | — | — | Finance | — |
| Validation | Unmapped components | unmapped_panel | Panel (derived) | Ref[] | — | Computed | Must be empty before run approval | — | Finance, Payroll | Blocks approval, not calculation |

### FRM-FIN-02 — ERP Integration and Field Ownership (SCR-100)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Mode | Master data mode | master_mode | Select | Char(20) | Y | Co-owned | Nucleus owns / ERP owns / Co-owned | PL_MASTER_MODE | Implementation | Mode determines which fields are read-only in Nucleus |
| Mode | ERP system | erp_system | Select | Char(40) | Y | — | From the supported connector list | PL_ERP_SYSTEM | Implementation | — |
| Mode | Sync frequency | sync_frequency | Select | Char(20) | Y | Daily | Real time / Hourly / Daily / On demand | PL_SYNC_FREQUENCY | Implementation | — |
| Ownership | Field | field_name | Lookup (grid row) | Char(60) | Y | From the field catalogue | Every mandatory field must have exactly one owner | — | Implementation | No field may be owned by both systems |
| Ownership | Owner | owner | Select (grid cell) | Char(10) | Y | Per the mode default | Nucleus / ERP | PL_FIELD_OWNER | Implementation | — |
| Ownership | Conflict policy | conflict_policy | Select | Char(25) | Y | Hold for review | Owner wins / Hold for review / Latest wins | PL_CONFLICT_POLICY | Implementation | Held conflicts appear on the sync monitor |
| Matching | Match key | match_key | Select | Char(30) | Y | External employee code | Must be unique in both systems | — | Implementation | Idempotent on the external code |
| Matching | Unmatched record action | unmatched_action | Select | Char(25) | Y | Hold | Hold / Create / Reject | PL_UNMATCHED_ACTION | Implementation | — |
| Validation | Mandatory field coverage | coverage_panel | Panel (derived) | Composite | — | Computed | Save blocked if any mandatory field is unowned | — | Implementation | — |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_CONFLICT_POLICY | Conflict policy | Config | 3 | Owner wins · Hold for review · Latest wins |
| PL_ERP_SYSTEM | ERP system | Config | 6 | Cloud ERP · On-premise ERP · Accounting package · Custom / file based |
| PL_FIELD_OWNER | Field owner | System | 2 | Nucleus · ERP |
| PL_MASTER_MODE | Master data mode | Config | 3 | Nucleus owns · ERP owns · Co-owned |
| PL_SYNC_FREQUENCY | Sync frequency | Config | 4 | Real time · Hourly · Daily · On demand |
| PL_UNMATCHED_ACTION | Unmatched record action | Config | 3 | Hold · Create · Reject |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-INT-01 | ERP Employee Master Sync | INT | Integration | R-15 | API sync of the employee master between the ERP and Nucleus, with a failure queue. | N | Sync log | 3 |
| F-INT-02 | Payroll Account Posting | INT | Integration | R-16 | The payroll and OT journal pushed to the ERP, idempotent on re-run. | N | Posting log | 5 |

#### F-INT-01 — ERP Employee Master Sync

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Sync | Master owner | master_owner_system | Select | Char(20) | Y | ERP | Which system owns the employee master. Two-way ownership of the same field is the usual source of drift. | EN_MASTER_OWNER | HR roles only | Yes — value set configurable per tenant | R-15 |
| Header | Sync | ERP employee key | erp_employee_key | Text | Char(30) | Y | — | The key the ERP uses. Stored on the Nucleus employee record so the mapping survives a code change on either side. | — | HR roles only | No — system derived | R-15 |
| Header | Sync | Last sync status | last_sync_status | Read-only | Char(20) | Y | — | Success, Failed or Pending. A failed record must appear in a queue, not be silently skipped. | EN_SYNC_STATUS | HR roles only | Yes — value set configurable per tenant | R-15 |

#### F-INT-02 — Payroll Account Posting

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Posting | Posting reference | posting_ref | Read-only | Char(30) | Y | — | Returned by the ERP. Re-running the same payroll period must not create a second posting. | — | Payroll and HR roles only | No — system derived | R-16 |
| Line | Posting | Account code | posting_account_code | Lookup | Ref | Y | — | Must exist in the ERP chart of accounts | — | Payroll and HR roles only | Yes | R-16 |
| Line | Posting | Cost centre | posting_cost_centre | Lookup | Ref | Y | From the employee department | — | — | Payroll and HR roles only | Yes | R-16 |
| Line | Posting | Debit amount | posting_debit | Money | Dec(18,2) | Y | 0.00 | Total debits must equal total credits before the push | — | Payroll and HR roles only | No — system derived | R-16 |
| Line | Posting | Credit amount | posting_credit | Money | Dec(18,2) | Y | 0.00 | — | — | Payroll and HR roles only | No — system derived | R-16 |

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
| Size | 35 | specified items (table rows) | Counted automatically at generation |
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
