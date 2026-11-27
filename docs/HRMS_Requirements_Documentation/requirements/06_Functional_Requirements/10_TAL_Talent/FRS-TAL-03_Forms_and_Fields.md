<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TAL-03 — Talent — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TAL-03 |
| Title | Talent — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Talent |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-TAL-00, FRS-TAL-01, FRS-TAL-02, FRS-TAL-03, FRS-TAL-04, FRS-TAL-05, FRS-TAL-06, FRS-TAL-07, FRS-TAL-08, FRS-TAL-09, FRS-TAL-10, FRS-TAL-11, FRS-TAL-12, FRS-TAL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-25, R-26 · processes TAL-01–TAL-05 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-TAL-01 | Manpower Requisition | SCR-090 | Hiring manager | 21 | Core HR > Talent & experience operations > Recruitment requisitions (SCR-090) | requisitions | /api/v1/requisitions |
| FRM-TAL-02 | Candidate Record and Application | SCR-092 | Recruiter | 19 | Core HR > Talent & experience operations > Candidate record and application (SCR-092) | candidate_application | /api/v1/ops/modules/candidate_application/records |
| FRM-TAL-03 | Interview Feedback | SCR-093 | Interviewer | 10 | Core HR > Talent & experience operations > Interview feedback (SCR-093) | interview_feedback | /api/v1/ops/modules/interview_feedback/records |
| FRM-TAL-04 | Offer | SCR-094 | Recruiter, HR | 14 | Core HR > Talent & experience operations > Offer management (SCR-094) | offer_management | /api/v1/ops/modules/offer_management/records |
| FRM-TAL-05 | Employee Referral | SCR-091 | Employee, HR | 10 | Core HR > Talent & experience operations > Referral tracking (SCR-091) | referrals | /api/v1/referrals |

## 2. Field specifications

### FRM-TAL-01 — Manpower Requisition (SCR-090)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Requisition | Requisition type | requisition_type | Select | Char(15) | Y | — | Replacement / Addition | PL_REQUISITION_TYPE | Hiring manager | Drives the sanction check |
| Requisition | Against position | against_position_code | Lookup | Ref | Y for replacement | — | Position must be vacant and not frozen | — | Hiring manager | Consumes no fresh sanction |
| Requisition | Replacing employee | replacing_person_id | Lookup | Ref | N | From the position | Must be an exited or serving-notice record | — | Hiring manager | — |
| Requisition | Org unit | org_unit | Lookup | Ref | Y | User's unit | Active | — | Hiring manager | Part of the sanction key |
| Requisition | Designation | designation_code | Lookup | Ref | Y | — | Active | — | Hiring manager | Part of the sanction key |
| Requisition | Location | location_id | Lookup | Ref | Y | User's location | Active | — | Hiring manager | Part of the sanction key |
| Requisition | Worker class | worker_class | Lookup | Ref | Y | — | Active | — | Hiring manager | — |
| Requisition | Number of positions | vacancy_count | Number | Int | Y | 1 | 1-99 | — | Hiring manager | Cannot exceed headroom without an override |
| Requisition | Required by date | required_by | Date | Date | Y | — | Not in the past | — | Hiring manager | Drives the recruiter SLA |
| Requisition | Employment type | employment_type | Select | Char(25) | Y | Permanent | From list | PL_EMPLOYMENT_TYPE | Hiring manager | — |
| Requisition | Budgeted CTC range | ctc_min, ctc_max | Money | Dec(12,2) | Y | From the grade band | Min <= Max; within the band unless overridden | — | Hiring manager, HR | Offers outside the range need approval |
| Requisition | Justification | justification | Text | Char(500) | Y for addition | — | Min 30 chars | — | Hiring manager | — |
| Requisition | Qualification required | qualification_required | Text | Char(200) | Y | From the designation | — | — | Hiring manager | — |
| Requisition | Experience required (years) | experience_min, experience_max | Number | Dec(3,1) | Y | From the designation | Min <= Max | — | Hiring manager | — |
| Requisition | Key skills | skills[] | Multi-select | Ref[] | N | — | Active skill master | — | Hiring manager | Used for ranking; never for auto-rejection |
| Requisition | Job description | job_description | Rich text | Text | Y | From the designation | Min 100 chars | — | Hiring manager | — |
| Context | Sanctioned / filled / open / headroom | sanction_panel | Panel (derived) | Composite | — | Computed | — | — | Hiring manager | Live, not a monthly report |
| Override | Override headroom | override_requested | Toggle | Bool | N | Off | Authorised role only | — | Authorised role | — |
| Override | Override reason | override_reason | Text | Char(500) | Y when overriding | — | Min 20 chars | — | Authorised role | — |
| Approval | Approval chain / status | approval_chain, approval_status | Panel (derived) | Mixed | Y | From configuration | — | PL_APPROVAL_STATUS | Hiring manager | — |
| Approval | Recruiter assigned | recruiter_id | Lookup | Ref | Y on approval | — | Active recruiter | — | HR | — |

### FRM-TAL-02 — Candidate Record and Application (SCR-092)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Candidate | Full name | name | Text | Char(180) | Y | — | 2-180 chars | — | Recruiter | — |
| Candidate | Mobile / email | mobile, email | Mixed | Char(16)/Char(120) | Y | — | E.164 and RFC email; duplicate check on both | — | Recruiter | Duplicate candidate warning, not a block |
| Candidate | Date of birth | date_of_birth | Date | Date | N | — | Age >= statutory minimum | — | Recruiter | — |
| Candidate | Gender | gender | Select | Char(20) | N | — | From list | PL_GENDER | Recruiter | Diversity reporting only |
| Candidate | Current location | current_location | Text | Char(60) | N | — | — | — | Recruiter | — |
| Candidate | Source channel | source_channel | Select | Char(25) | Y | — | Referral / Portal / Agency / Walk-in / Campus / Internal | PL_SOURCE_CHANNEL | Recruiter | Referral source links to the referral record |
| Candidate | Referred by | referrer_person_id | Lookup | Ref | Y if referral | — | Active assignment | — | Recruiter | Drives referral award maturity |
| Candidate | Agency / vendor | agency_id | Lookup | Ref | Y if agency | — | Active vendor | — | Recruiter | — |
| Candidate | Resume | resume_ref | File | Ref | Y | — | PDF/DOC, max 5 MB | — | Recruiter | Parsed into skills and experience where enabled |
| Candidate | Total experience (years) | total_experience | Number | Dec(4,1) | Y | From resume parse | 0-50 | — | Recruiter | — |
| Candidate | Current employer / designation | current_employer, current_designation | Text | Char(150) | N | — | — | — | Recruiter | — |
| Candidate | Current / expected CTC | current_ctc, expected_ctc | Money | Dec(12,2) | N | — | >= 0 | — | Recruiter, HR | — |
| Candidate | Notice period (days) | notice_period_days | Number | Int | N | — | 0-180 | — | Recruiter | Drives the expected joining date |
| Application | Applied against requisition | requisition_id | Lookup | Ref | Y | — | Open requisition | — | Recruiter | One candidate may apply to several |
| Application | Stage | stage | Select | Char(25) | Y | Applied | Applied / Screened / Interview / Selected / Offered / Joined / Rejected / Withdrawn | PL_CANDIDATE_STAGE | Recruiter | No automatic rejection; ranking assists, humans decide |
| Application | Rank score | rank_score | Number (derived) | Dec(5,2) | N | Computed | — | — | Recruiter | Advisory only; the basis is shown |
| Application | Rejection reason | rejection_reason | Select + text | Char(200) | Y on reject | — | From list plus free text | PL_REJECTION_REASON | Recruiter | — |
| Consent | Data processing consent | consent_given, consent_on | Toggle + timestamp | Mixed | Y | Off | Explicit, purpose-bound | — | Recruiter | DPDP: itemised notice before collection |
| Consent | Retention until | retention_until | Date (derived) | Date | Y | Per the retention policy | — | — | Recruiter | Purged automatically at expiry |

### FRM-TAL-03 — Interview Feedback (SCR-093)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Interview | Candidate / requisition | candidate_id, requisition_id | Read-only | Ref | Y | From the schedule | — | — | Interviewer | — |
| Interview | Round | round_no | Select | Char(20) | Y | — | Screening / Technical / Functional / HR / Final | PL_INTERVIEW_ROUND | Interviewer | — |
| Interview | Mode | interview_mode | Select | Char(15) | Y | In person | In person / Video / Telephone | PL_INTERVIEW_MODE | Interviewer | — |
| Interview | Scheduled on / duration | scheduled_ts, duration_minutes | Mixed | Mixed | Y | — | Future at scheduling | — | Interviewer | Calendar invite issued on save |
| Interview | Panel members | panel[] | Multi-select | Ref[] | Y | — | Active principals | — | Recruiter | — |
| Feedback | Competency ratings | competency_rating[] | Table | Composite | Y | From the designation's competency set | Every competency must be rated | — | Interviewer | Repeating: competency, rating 1-5, remark |
| Feedback | Overall rating | overall_rating | Select | Char(20) | Y | — | Strong hire / Hire / Hold / No hire | PL_INTERVIEW_VERDICT | Interviewer | — |
| Feedback | Strengths / concerns | strengths, concerns | Text | Char(500) | Y | — | Min 30 chars each | — | Interviewer | — |
| Feedback | Recommended band | recommended_band | Lookup | Ref | N | From the requisition | Active band | — | Interviewer, HR | — |
| Feedback | Submitted on | submitted_on | Timestamp (derived) | Timestamp | Y | System | Feedback locks on submission | — | Interviewer | Cannot be edited after submission |

### FRM-TAL-04 — Offer (SCR-094)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Offer | Candidate / requisition / position | candidate_id, requisition_id, position_code | Read-only | Ref | Y | From the application | Position must still be vacant | — | HR | — |
| Offer | Designation / band / location | designation_code, band, location_id | Lookup | Ref | Y | From the requisition | Active | — | HR | — |
| Offer | Worker class / employment type | worker_class, employment_type | Lookup | Ref | Y | From the requisition | Active | — | HR | — |
| Offer | Offered CTC | offered_ctc | Money | Dec(12,2) | Y | — | Within the requisition range unless approved | — | HR | Outside-range offers route to an extra approval |
| Offer | Salary structure preview | structure_preview | Panel (derived) | Composite | — | Computed from the CTC | Wage floor test must pass | — | HR | Shown before the offer is released |
| Offer | Joining bonus / retention | joining_bonus, clawback_months | Mixed | Mixed | N | 0 | Clawback terms named in the letter | — | HR | — |
| Offer | Proposed joining date | proposed_joining_date | Date | Date | Y | — | Not before the position availability date | — | HR | — |
| Offer | Offer validity | offer_valid_till | Date | Date | Y | Release date plus 7 days | Future date | — | HR | Lapsed offers close automatically |
| Offer | Letter template | letter_template_id | Lookup | Ref | Y | By worker class | Active template | — | HR | Template version retained on issue |
| Offer | Approval status | approval_status | Panel (derived) | Char(15) | Y | Draft | From the approval chain | PL_APPROVAL_STATUS | HR | — |
| Offer | Released on / channel | released_on, release_channel | Mixed | Mixed | Y | — | Email or portal | PL_RELEASE_CHANNEL | HR | — |
| Response | Candidate response | offer_response | Select | Char(15) | Y | Pending | Accepted / Declined / Lapsed / Negotiating | PL_OFFER_RESPONSE | HR | Acceptance starts the pre-boarding chain |
| Response | Decline reason | decline_reason | Select + text | Char(200) | Y on decline | — | From list plus free text | PL_DECLINE_REASON | HR | Feeds the offer-drop analysis |
| Response | Accepted on | accepted_on | Timestamp | Timestamp | Y on accept | — | — | — | HR | — |

### FRM-TAL-05 — Employee Referral (SCR-091)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Referral | Requisition | requisition_id | Lookup | Ref | Y | — | Open and referral-eligible | — | Self | — |
| Referral | Candidate name / mobile / email | candidate_name, mobile, email | Mixed | Mixed | Y | — | Duplicate check against existing candidates | — | Self | Prior application within the cooling period disqualifies the award |
| Referral | Relationship to candidate | relationship | Select | Char(30) | Y | — | From list | PL_REFERRAL_RELATION | Self | — |
| Referral | Resume | resume_ref | File | Ref | Y | — | PDF/DOC, max 5 MB | — | Self | — |
| Referral | Recommendation note | note | Text | Char(500) | N | — | — | — | Self | — |
| Award | Award scheme | award_scheme_id | Lookup (derived) | Ref | Y | By designation band | Active scheme | — | HR | — |
| Award | Award amount | award_amount | Money (derived) | Dec(10,2) | Y | From the scheme | — | — | Self, HR | — |
| Award | Payment split | award_split | Panel (derived) | Composite | Y | From the scheme | — | — | Self, HR | Part on joining, balance on confirmation |
| Award | Maturity status | maturity_status | Select (derived) | Char(20) | Y | Pending | Pending / Part matured / Fully matured / Forfeited | PL_MATURITY_STATUS | Self, HR | Forfeited if the referrer or referee exits early |
| Award | Payroll input raised | payroll_input_id | Read-only | Ref | N | System | — | — | HR, Payroll | Awards enter payroll here, never as a manual edit |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_APPROVAL_STATUS | Approval status | System | 5 | Draft · Pending approval · Approved · Rejected · Withdrawn |
| PL_CANDIDATE_STAGE | Candidate stage | Config | 11 | Applied · Screened · Interview scheduled · Interview complete · Selected · Offered · Offer accepted · Joined · Rejected · Withdrawn · On hold |
| PL_DECLINE_REASON | Offer decline reason | Config | 8 | Compensation · Counter offer accepted · Role mismatch · Location · Joining date · Family reasons · Other offer · Not disclosed |
| PL_EMPLOYMENT_TYPE | Employment type | Config | 10 | Permanent · Probation · Fixed term contract · Trainee · Apprentice (NAPS/NATS) · Intern · Retainer · Consultant · Contract (through vendor) · Part time |
| PL_GENDER | Gender | System | 4 | Male · Female · Other · Prefer not to say |
| PL_INTERVIEW_MODE | Interview mode | System | 3 | In person · Video · Telephone |
| PL_INTERVIEW_ROUND | Interview round | Config | 6 | Screening · Technical 1 · Technical 2 · Functional · HR · Final / leadership |
| PL_INTERVIEW_VERDICT | Interview verdict | System | 4 | Strong hire · Hire · Hold · No hire |
| PL_MATURITY_STATUS | Referral award maturity | System | 4 | Pending · Part matured · Fully matured · Forfeited |
| PL_OFFER_RESPONSE | Offer response | System | 5 | Pending · Accepted · Declined · Negotiating · Lapsed |
| PL_REFERRAL_RELATION | Referrer relationship | Config | 6 | Former colleague · Friend · Relative · Academic contact · Professional network · Other |
| PL_REJECTION_REASON | Candidate rejection reason | Config | 9 | Skill mismatch · Experience mismatch · Compensation mismatch · Location constraint · Notice period · Failed assessment · Background check · Position closed · Other |
| PL_RELEASE_CHANNEL | Delivery channel | Config | 4 | Email · Employee portal · business messaging · Printed copy |
| PL_REQUISITION_TYPE | Requisition type | System | 2 | Replacement · Addition |
| PL_SOURCE_CHANNEL | Candidate source | Config | 9 | Employee referral · Job portal · Recruitment agency · Walk-in · Campus · Internal transfer · Social media · Direct application · Rehire |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-REC-01 | Approved Manpower Budget | REC | Master form | R-26 | Sanctioned strength per department, against which a requisition is checked. | N | Manpower statement | 0 |
| F-REC-02 | Manpower Requisition | REC | Transaction form | R-25, R-26 | Requisition carrying a position code, and for a replacement the code of the position vacated. | N | Requisition print | 4 |

#### F-REC-02 — Manpower Requisition

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Position | Position code | position_code | Lookup | Ref | Y | — | Must exist in the approved manpower budget | — | All roles | Yes | R-25 |
| Header | Position | Requisition reason | requisition_reason | Select | Char(20) | Y | Replacement | Replacement or New position. A replacement must name the vacated position code. | EN_REQUISITION_REASON | All roles | Yes — value set configurable per tenant | R-25 |
| Header | Position | Replacing position code | replacing_position_code | Lookup | Ref | Y when the reason is Replacement | — | The position vacated. Prevents a replacement being counted as incremental headcount. | — | All roles | No — system derived | R-25 |
| Header | Budget | Sanctioned strength check | sanctioned_check_result | Read-only | Char(40) | Y | — | Within budget, or Exceeds sanctioned strength. The second must block or escalate rather than warn and pass. | — | All roles | Yes | R-26 |

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
| Size | 100 | specified items (table rows) | Counted automatically at generation |
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
