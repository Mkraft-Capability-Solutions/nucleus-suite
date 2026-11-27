<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-EXP-03 — Experience — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-EXP-03 |
| Title | Experience — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Experience |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-EXP-00, FRS-EXP-01, FRS-EXP-02, FRS-EXP-03, FRS-EXP-04, FRS-EXP-05, FRS-EXP-06, FRS-EXP-07, FRS-EXP-08, FRS-EXP-09, FRS-EXP-10, FRS-EXP-11, FRS-EXP-12, FRS-EXP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-19, R-20, R-21, R-22 · processes EXP-01–EXP-03 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-EXP-01 | Letter Generation | SCR-067 | HR Ops | 13 | Core HR > People & lifecycle > Letters and issue register (SCR-067) | letters_register | /api/v1/hr-letters |
| FRM-EXP-02 | Recognition Nomination | SCR-065 | Manager, HR | 10 | Core HR > Talent & experience operations > Recognition register (SCR-065) | recognition_register | /api/v1/recognition-events |
| FRM-EXP-03 | Announcement | SCR-066 | HR | 12 | Core HR > Talent & experience operations > Announcements (SCR-066) | announcement_management | /api/v1/announcements |

## 2. Field specifications

### FRM-EXP-01 — Letter Generation (SCR-067)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Letter | Letter type | letter_type | Select | Char(30) | Y | — | From list | PL_LETTER_TYPE | HR | Offer, appointment, confirmation, revision, transfer, warning, experience, relieving, NOC |
| Letter | Template | template_id | Lookup | Ref | Y | By type, class and entity | Active template | — | HR | — |
| Letter | Template version | template_version | Read-only | Char(10) | Y | System | — | — | HR, auditor | Retaining the version is what makes a reprint honest |
| Letter | Employee | person_id | Lookup | Ref | Y | — | Active or exited record | — | HR | Bulk selection allowed for announcements-style letters |
| Letter | Merge preview | merge_preview | Panel (derived) | Text | — | Computed | Unresolved merge fields block issue | — | HR | — |
| Letter | Manual merge fields | manual_fields[] | Table | Composite | N | — | Every declared manual field must be filled | — | HR | — |
| Letter | Effective date | effective_date | Date | Date | Y | Today | — | — | HR | — |
| Letter | Signatory | signatory_id | Lookup | Ref | Y | From the entity default | Authorised signatory | — | HR | — |
| Letter | Approval status | approval_status | Panel (derived) | Char(15) | Y | Draft | From the chain | PL_APPROVAL_STATUS | HR | — |
| Issue | Issued on / reference number | issued_on, letter_reference | Read-only | Mixed | Y | System | Sequential per type and entity | — | HR | Register is the audit artefact |
| Issue | Delivery channel | delivery_channel | Multi-select | Char[] | Y | Email plus portal | — | PL_RELEASE_CHANNEL | HR | — |
| Issue | Acknowledgement required | ack_required | Toggle | Bool | Y | Yes | — | — | HR | Acknowledgement with version retained |
| Issue | Reprint reason | reprint_reason | Text | Char(200) | Y on reprint | — | Min 10 chars | — | HR | Reprints carry the original version, not the current one |

### FRM-EXP-02 — Recognition Nomination (SCR-065)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Nomination | Programme | programme_id | Lookup | Ref | Y | — | Active programme in the current cycle | — | Manager, HR | — |
| Nomination | Period | period | Select | Char(7) | Y | Current cycle | Open nomination window only | — | Manager, HR | — |
| Nomination | Nominee | person_id | Lookup | Ref | Y | — | Active assignment; self-nomination blocked | — | Manager, HR | — |
| Nomination | Category | award_category | Select | Char(30) | Y | — | From the programme configuration | PL_AWARD_CATEGORY | Manager, HR | — |
| Nomination | Citation | citation | Text | Char(1000) | Y | — | Min 50 chars | — | Manager, HR | Prints on the certificate |
| Nomination | Evidence | evidence_ref | File | Ref | N | — | PDF/JPG, max 5 MB | — | Manager, HR | — |
| Award | Award amount | award_amount | Money | Dec(10,2) | N | From the programme default | Within the programme ceiling | — | HR | Monetary component raises a payroll input |
| Award | Non-monetary award | non_monetary_award | Text | Char(120) | N | — | — | — | HR | — |
| Approval | Committee decision / remarks | decision, decision_remarks | Mixed | Mixed | Y | — | Reason mandatory on reject | PL_DECISION | HR | — |
| Award | Announcement | announce_on_publish | Toggle | Bool | Y | Yes | — | — | HR | Publishes to the configured audience |

### FRM-EXP-03 — Announcement (SCR-066)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Content | Announcement type | announcement_type | Select | Char(25) | Y | General | General / Policy / Emergency / Celebration / Statutory | PL_ANNOUNCEMENT_TYPE | HR | Emergency bypasses the quiet-hours rule |
| Content | Title | title | Text | Char(120) | Y | — | 5-120 chars | — | HR | — |
| Content | Body | body | Rich text | Text | Y | — | Min 20 chars | — | HR | — |
| Content | Attachment | attachment_ref | File | Ref | N | — | PDF/JPG, max 10 MB | — | HR | — |
| Content | Language variants | language_variants[] | Table | Composite | N | — | — | PL_LANGUAGE | HR | Delivered per the employee's preferred language |
| Audience | Audience rule | audience_rule | Rule builder | Composite | Y | All employees | Must resolve to at least one person | — | HR | Entity, location, org unit, class, band, individual list |
| Audience | Resolved audience count | audience_count | Panel (derived) | Int | — | Computed | — | — | HR | Shown before publish |
| Delivery | Channels | channels[] | Multi-select | Char[] | Y | Portal plus push | At least one | PL_ANNOUNCEMENT_CHANNEL | HR | Portal, push, email, business messaging, notice board display |
| Delivery | Publish at | publish_at | Timestamp | Timestamp | Y | Now | Not in the past | — | HR | Scheduled publishing supported |
| Delivery | Expires on | expires_on | Date | Date | N | Publish plus 30 days | After publish date | — | HR | — |
| Delivery | Acknowledgement required | ack_required | Toggle | Bool | Y | No | — | — | HR | Policy announcements retain the acknowledged version |
| Delivery | Read and acknowledgement counts | read_count, ack_count | Panel (derived) | Int | — | Computed | — | — | HR | — |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ANNOUNCEMENT_CHANNEL | Announcement channel | Config | 5 | Employee portal · Mobile push · Email · business messaging · Notice board display |
| PL_ANNOUNCEMENT_TYPE | Announcement type | Config | 5 | General · Policy · Emergency · Celebration · Statutory notice |
| PL_APPROVAL_STATUS | Approval status | System | 5 | Draft · Pending approval · Approved · Rejected · Withdrawn |
| PL_AWARD_CATEGORY | Recognition category | Config | 8 | Star performer · Safety champion · Quality champion · Innovation · Long service · Team award · Customer delight · Spot award |
| PL_DECISION | Approval decision | System | 4 | Approve · Reject · Return for correction · Delegate |
| PL_LANGUAGE | Language | Config | 14 | English · Hindi · Kannada · Tamil · Telugu · Malayalam · Marathi · Gujarati · Bengali · Odia · Punjabi · Assamese · Urdu · Other |
| PL_LETTER_TYPE | Letter type | Config | 14 | Offer · Appointment · Confirmation · Salary revision · Promotion · Transfer · Warning · Show cause · Experience · Relieving · No objection certificate · Address proof · Bank introduction · Visa support |
| PL_RELEASE_CHANNEL | Delivery channel | Config | 4 | Email · Employee portal · business messaging · Printed copy |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-ENG-01 | Star Employee Nomination | ENG | Transaction form | R-19 | Nomination, selection and publication of star employees. | N | Certificate | 4 |
| F-ENG-02 | Employee Referral | ENG | Transaction form | R-20 | Referral capture through to the award, linked to the requisition. | N | Referral record | 5 |
| F-ENG-03 | Announcements | ENG | Workbench | R-21 | Birthday, star employee, new joiner, referral and management announcements. | N | Notice | 3 |
| F-DOC-01 | Letter Template & Issue | DOC | Master + transaction | R-22 | Appointment and other HR letters produced from templates with merge fields. | N | Letter | 4 |

#### F-ENG-01 — Star Employee Nomination

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Nomination | Award period | award_period | Text | Char(20) | Y | Current month | — | — | All roles | Yes | R-19 |
| Header | Nomination | Nominee | nominee_employee_code | Lookup | Ref | Y | — | Active employee only | — | All roles | No — system derived | R-19 |
| Header | Nomination | Nomination criteria | nomination_criteria | Select | Char(40) | Y | — | Criteria list is configuration, not code | — | All roles | Yes | R-19 |
| Header | Result | Selected | is_selected | Toggle | Bool | Y | N | On selection the announcement is raised automatically | — | All roles | Yes | R-19 |

#### F-ENG-02 — Employee Referral

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Referral | Referring employee | referrer_employee_code | Lookup | Ref | Y | — | — | — | All roles | No — system derived | R-20 |
| Header | Referral | Candidate name | candidate_name | Text | Char(100) | Y | — | — | — | All roles | No — system derived | R-20 |
| Header | Referral | Linked requisition | requisition_ref | Lookup | Ref | Y | — | Ties the referral to an open position code | — | All roles | No — system derived | R-20, R-25 |
| Header | Award | Award amount | referral_award_amount | Money | Dec(18,2) | Y when the referral converts | — | Payable only after the candidate completes the qualifying period. The payout must reach payroll as an input, not a manual entry. | — | Payroll and HR roles only | Yes | R-20 |
| Header | Award | Award status | referral_award_status | Select | Char(20) | Y | Pending | — | — | All roles | Yes | R-20 |

#### F-ENG-03 — Announcements

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Announcement | Announcement type | announcement_type | Select | Char(30) | Y | — | Birthday, Star employee, New joiner, Referral, Management message | — | All roles | Yes — value set configurable per tenant | R-21 |
| Header | Announcement | Audience scope | audience_scope | Select | Char(30) | Y | All employees | All employees, Department, Location or Grade. Birthday announcements are usually location-scoped. | — | All roles | Yes | R-21 |
| Header | Announcement | Auto-generated | is_auto_generated | Toggle | Bool | Y | N | Birthday and new-joiner announcements should raise themselves from the employee record rather than being typed | — | All roles | Yes | R-21 |

#### F-DOC-01 — Letter Template & Issue

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Template | Letter template code | letter_template_code | Lookup | Ref | Y | — | Appointment, confirmation, transfer, increment, warning, relieving, experience | — | HR roles only | Yes | R-22 |
| Header | Template | Merge fields available | merge_fields | Read-only | Composite | Y | From the employee record | A template referencing a field that does not exist must fail validation on save, not at issue | — | HR roles only | Yes | R-22 |
| Header | Issue | Issued to employee | issued_to_employee_code | Lookup | Ref | Y | — | — | — | HR roles only | No — system derived | R-22 |
| Header | Issue | Issue date | letter_issue_date | Date | Date | Y | Today | The issue is recorded so the letter can be reproduced exactly as sent | — | HR roles only | No — system derived | R-22 |

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
| Size | 66 | specified items (table rows) | Counted automatically at generation |
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
