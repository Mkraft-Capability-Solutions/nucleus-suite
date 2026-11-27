<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CTG-03 — Contingent Workforce — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CTG-03 |
| Title | Contingent Workforce — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Contingent Workforce |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-CTG-00, FRS-CTG-01, FRS-CTG-02, FRS-CTG-03, FRS-CTG-04, FRS-CTG-05, FRS-CTG-06, FRS-CTG-07, FRS-CTG-08, FRS-CTG-09, FRS-CTG-10, FRS-CTG-11, FRS-CTG-12, FRS-CTG-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · processes CTG-01–CTG-03 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-CTG-01 | Contractor Engagement | SCR-095 | Purchase, HR | 12 | Core HR > Compliance engineering > Contractor engagement and invoice (SCR-095) | contractor_reconciliation | /api/v1/contractors/invoices |
| FRM-CTG-02 | Contractor Invoice Reconciliation | SCR-096 | Finance, HR | 12 | Workforce Operations > Compliance engineering > Contractor invoice reconciliation (SCR-096) | contractor_invoice | /api/v1/ops/modules/contractor_invoice/records |

## 2. Field specifications

### FRM-CTG-01 — Contractor Engagement (SCR-095)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Engagement | Vendor | vendor_id | Lookup | Ref | Y | — | Active vendor with a valid licence | — | Purchase, HR | Expired labour licence blocks new deployment |
| Engagement | Contract reference | contract_ref | Text | Char(40) | Y | — | Unique per vendor | — | Purchase | — |
| Engagement | Contract start / end | start_date, end_date | Date range | Date | Y | — | End after start | — | Purchase, HR | Expiry raises a renewal task 30 days ahead |
| Engagement | Location / org unit | location_id, org_unit | Lookup | Ref | Y | — | Active | — | HR | — |
| Engagement | Scope of work | scope_of_work | Text | Char(1000) | Y | — | Min 50 chars | — | Purchase | — |
| Engagement | Vendor labour licence number / validity | licence_no, licence_valid_till | Mixed | Mixed | Y | — | Validity must cover the contract period | — | Compliance | Contract Labour Act compliance |
| Engagement | Vendor PF / ESI codes | vendor_pf_code, vendor_esi_code | Text | Char(22) | Y | — | Format validated | — | Compliance | Principal-employer liability check |
| Deployment | Worker class | worker_class | Lookup | Ref | Y | — | Contract classes only | — | HR | Policy attaches through the class |
| Deployment | Sanctioned deployment count | sanctioned_count | Number | Int | Y | — | Within the location's contract sanction | — | HR, Finance | — |
| Deployment | Rate card | rate_card[] | Table | Composite | Y | — | Must meet the state minimum wage for the skill | — | Purchase, Finance | Repeating: skill, daily rate, OT rate |
| Deployment | Attendance capture required | attendance_required | Toggle | Bool | Y | Yes | — | — | HR | Invoice is reconciled against captured attendance |
| Control | Status | status | Select | Char(15) | Y | Active | — | PL_ACTIVE_STATUS | Purchase | — |

### FRM-CTG-02 — Contractor Invoice Reconciliation (SCR-096)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Invoice | Engagement / period | engagement_id, period | Lookup | Ref | Y | — | Open engagement | — | Finance | — |
| Invoice | Invoice number / date | invoice_number, invoice_date | Mixed | Mixed | Y | — | Unique per vendor and year | — | Finance | — |
| Invoice | Claimed days by skill | claimed_days[] | Table | Composite | Y | — | >= 0 | — | Finance | Repeating: skill, days, rate, amount |
| Invoice | Claimed overtime hours | claimed_ot_hours | Number | Dec(8,2) | N | 0 | >= 0 | — | Finance | — |
| Invoice | Invoice amount | invoice_amount | Money | Dec(12,2) | Y | Computed from claimed lines | Must equal the line total | — | Finance | — |
| Invoice | GST | gst_amount | Money | Dec(12,2) | N | Computed | — | — | Finance | — |
| Reconciliation | Attendance days recorded | attendance_days | Panel (derived) | Dec(8,2) | — | From attendance | — | — | Finance, HR | — |
| Reconciliation | Variance (days, amount) | variance_days, variance_amount | Panel (derived) | Mixed | — | Computed | — | — | Finance, HR | Visible before payment rather than after |
| Reconciliation | Variance disposition | variance_action | Select | Char(20) | Y if variance | — | Accept / Query / Reduce | PL_VARIANCE_ACTION | Finance | — |
| Reconciliation | Query note | query_note | Text | Char(500) | Y on query | — | Min 20 chars | — | Finance | — |
| Compliance | Vendor PF / ESI remittance proof | vendor_remittance_ref | File | Ref | Y | — | PDF, max 10 MB | — | Compliance, Finance | Payment held without proof of statutory remittance |
| Approval | Approved amount / approver | approved_amount, approver_id | Mixed | Mixed | Y | Invoice amount minus variance | Cannot exceed the invoice amount | — | Finance | — |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACTIVE_STATUS | Record status | System | 2 | Active · Inactive |
| PL_VARIANCE_ACTION | Invoice variance action | System | 3 | Accept · Query · Reduce |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

_No entries in source for this scope._

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
| Size | 28 | specified items (table rows) | Counted automatically at generation |
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
