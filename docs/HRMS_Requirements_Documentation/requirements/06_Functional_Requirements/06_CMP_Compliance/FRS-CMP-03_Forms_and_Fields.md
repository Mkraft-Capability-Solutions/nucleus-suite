<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-03 — Compliance — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-03 |
| Title | Compliance — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compliance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-CMP-01 | Obligation Calendar Entry | SCR-072 | Compliance owner | 12 | Workforce Operations > Compliance engineering > Obligation calendar (SCR-072) | obligation_calendar | /api/v1/compliance/obligations |

## 2. Field specifications

### FRM-CMP-01 — Obligation Calendar Entry (SCR-072)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Obligation | Obligation | obligation | Text | Char(150) | Y | From the rule pack | — | — | Compliance | — |
| Obligation | Act / authority | act, authority | Text | Char(120) | Y | From the rule pack | — | — | Compliance | — |
| Obligation | Legal entity / location | entity_code, location_id | Lookup | Ref | Y | — | Within the grant | — | Compliance | Applicability derived from registrations |
| Obligation | Frequency | frequency | Select | Char(15) | Y | Monthly | Monthly / Quarterly / Half-yearly / Annual / Event-based | PL_FREQUENCY | Compliance | — |
| Obligation | Due date | due_date | Date (derived) | Date | Y | From the rule pack | — | — | Compliance | Reminders at 15, 7, 3 and 1 day |
| Obligation | Owner | owner_id | Lookup | Ref | Y | — | Active principal | — | Compliance | — |
| Obligation | Status | status | Select | Char(20) | Y | Open | Open / In progress / Filed / Late filed / Not applicable | PL_OBLIGATION_STATUS | Compliance | — |
| Filing | Return / form reference | form_code | Lookup | Ref | Y | From the rule pack | Active form | — | Compliance | — |
| Filing | Filed on / acknowledgement number | filed_on, ack_number | Mixed | Mixed | Y on filing | — | — | — | Compliance | — |
| Filing | Evidence | evidence_ref | File | Ref | Y on filing | — | PDF, max 10 MB | — | Compliance, auditor | Challan or portal acknowledgement |
| Filing | Amount remitted | amount_remitted | Money | Dec(12,2) | N | From the statutory output | Must reconcile to the payroll run | — | Compliance, Finance | Variance flagged, not silently accepted |
| Filing | Late filing reason | late_reason | Text | Char(300) | Y if filed late | — | Min 20 chars | — | Compliance | — |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_FREQUENCY | Frequency | System | 5 | Monthly · Quarterly · Half-yearly · Annual · Event-based |
| PL_OBLIGATION_STATUS | Obligation status | System | 5 | Open · In progress · Filed · Filed late · Not applicable |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-STA-01 | Statutory Registers & Returns | STA | Report | R-18 | Form 28, Form 18, Form 36 and the periodic returns, generated from live data with the state variant applied. | N | Statutory forms | 5 |
| F-STA-02 | Form F — Joining Form | STA | Report | R-27 | The Factory Act joining form, generated from the employee record at joining. | N | Form F | 5 |

#### F-STA-01 — Statutory Registers & Returns

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Form | Statutory form code | statutory_form_code | Select | Char(20) | Y | — | Form 28, Form 18, Form 36 and the other applicable forms, each as a value rather than a separate hard-coded report | EN_STATE_VARIANT | HR roles only | Yes — value set configurable per tenant | R-18 |
| Header | Form | Establishment | establishment_code | Lookup | Ref | Y | — | Registers are per establishment, not per company | — | HR roles only | Yes | R-18 |
| Header | Form | Return period from | return_period_from | Date | Date | Y | — | — | — | HR roles only | No — system derived | R-18 |
| Header | Form | Return period to | return_period_to | Date | Date | Y | — | Not earlier than return_period_from | — | HR roles only | No — system derived | R-18 |
| Header | Form | State variant | form_state_variant | Select | Char(30) | Y | From the establishment state | The layout must follow the state rules, not a single national template | EN_STATE_VARIANT | HR roles only | Yes — value set configurable per tenant | R-18 |

#### F-STA-02 — Form F — Joining Form

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Form F | Serial number in the register | form_f_serial_no | Number (derived) | Int(6) | Y | — | Sequential and gapless per establishment, as a statutory register requires | — | HR roles only | No — system derived | R-27 |
| Header | Form F | Establishment registration number | establishment_reg_no | Lookup | Ref | Y | From the establishment master | — | — | HR roles only | Yes | R-27 |
| Header | Form F | State variant | state_variant | Select | Char(30) | Y | From the establishment state | Factory Act forms vary by state rules. The variant must be data, not a hard-coded layout. | EN_STATE_VARIANT | HR roles only | Yes — value set configurable per tenant | R-27 |
| Header | Form F | Nature of work | nature_of_work | Text | Char(120) | Y | From designation | — | — | HR roles only | Yes | R-27 |
| Header | Form F | Date of employment | date_of_employment | Date | Date | Y | Date of joining | — | — | HR roles only | No — system derived | R-27 |

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
| Size | 27 | specified items (table rows) | Counted automatically at generation |
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
