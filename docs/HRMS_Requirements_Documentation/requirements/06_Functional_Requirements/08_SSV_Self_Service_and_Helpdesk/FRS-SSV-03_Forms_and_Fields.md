<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-SSV-03 — Self-service & Helpdesk — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-SSV-03 |
| Title | Self-service & Helpdesk — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Self-service & Helpdesk |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-SSV-00, FRS-SSV-01, FRS-SSV-02, FRS-SSV-03, FRS-SSV-04, FRS-SSV-05, FRS-SSV-06, FRS-SSV-07, FRS-SSV-08, FRS-SSV-09, FRS-SSV-10, FRS-SSV-11, FRS-SSV-12, FRS-SSV-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-03 · processes SSV-01–SSV-05 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-SSV-01 | Helpdesk Ticket | SCR-043 | Employee, HR | 13 | Analytics & AI > Intelligence operations > Helpdesk ticket (SCR-043) | helpdesk_ticket | /api/v1/ops/modules/helpdesk_ticket/records |

## 2. Field specifications

### FRM-SSV-01 — Helpdesk Ticket (SCR-043)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Ticket | Category | category | Select | Char(30) | Y | — | From the ticket taxonomy | PL_TICKET_CATEGORY | Self | Payroll, attendance, leave, document, IT, facilities, grievance |
| Ticket | Sub-category | sub_category | Select | Char(40) | Y | — | Dependent on category | — | Self | — |
| Ticket | Subject | subject | Text | Char(150) | Y | — | 5-150 chars | — | Self | — |
| Ticket | Description | description | Text | Char(2000) | Y | — | Min 20 chars | — | Self | — |
| Ticket | Attachment | attachment_ref[] | File | Ref | N | — | Max 5 files, 10 MB each | — | Self | — |
| Ticket | Priority | priority | Select | Char(10) | Y | Normal | Low / Normal / High / Urgent | PL_PRIORITY | Self | Grievance category forces a confidential route |
| Ticket | Confidential | is_confidential | Toggle | Bool | Y | Off for most; on for grievance | — | — | Self | Confidential tickets bypass the reporting line |
| Routing | Assigned queue / owner | queue_id, assignee_id | Lookup (derived) | Ref | Y | From the routing rule | Active | — | HR | — |
| Routing | SLA due | sla_due_ts | Timestamp (derived) | Timestamp | Y | From the category SLA | — | — | Self, HR | Breach escalates automatically |
| Resolution | Status | status | Select | Char(20) | Y | Open | Open / In progress / Awaiting employee / Resolved / Closed / Reopened | PL_TICKET_STATUS | Self, HR | — |
| Resolution | Resolution note | resolution_note | Text | Char(1000) | Y on resolve | — | Min 20 chars | — | HR | — |
| Resolution | Assistant-suggested answer | suggested_answer | Panel (derived) | Text | N | Agent draft with citations | — | — | Self, HR | Grounded in policy with citations; never auto-sent |
| Resolution | Employee satisfaction | csat_rating, csat_comment | Mixed | Mixed | N | — | 1-5 | — | Self | Requested on closure |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_PRIORITY | Priority | System | 4 | Low · Normal · High · Urgent |
| PL_TICKET_CATEGORY | Helpdesk category | Config | 12 | Payroll · Attendance · Leave · Documents · Statutory / PF / ESI · IT · Facilities · Transport · Canteen · Policy query · Grievance · Other |
| PL_TICKET_STATUS | Ticket status | System | 6 | Open · In progress · Awaiting employee · Resolved · Closed · Reopened |

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
| Size | 17 | specified items (table rows) | Counted automatically at generation |
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
