<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-03 — People Core — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-03 |
| Title | People Core — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — People Core |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-PPL-01 | Add / Edit Employee — Identity and Personal | SCR-010 | HR Ops | 117 | Core HR > People & lifecycle > Employee record (SCR-010) | person_record | /api/v1/people |
| FRM-PPL-02 | Employment, Assignment and Policy | SCR-011 | HR Ops | 45 | Core HR > People & lifecycle > Assignment and policy attributes (SCR-011) | assignment_admin | /api/v1/organization/tree |
| FRM-PPL-03 | Position Master | SCR-012 | HR, Finance | 15 | Core HR > People & lifecycle > Position register (SCR-012) | position_register | /api/v1/organization/tree |
| FRM-PPL-04 | Sanctioned Strength | SCR-013 | HR, Finance | 11 | Core HR > People & lifecycle > Sanctioned strength board (SCR-013) | sanctioned_strength | /api/v1/organization/tree |
| FRM-PPL-05 | Document Upload and Verification | SCR-014 | Employee, HR | 10 | Core HR > People & lifecycle > Document vault (SCR-014) | document_vault | /api/v1/ops/modules/document_vault/records |
| FRM-PPL-06 | Asset Allocation and Return | SCR-064 | Admin, IT | 12 | Core HR > People & lifecycle > Asset register (SCR-064) | asset_register | /api/v1/assets |

## 2. Field specifications

### FRM-PPL-01 — Add / Edit Employee — Identity and Personal (SCR-010)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Identity | Employee code | employee_code | Text | Char(20) | Y | Auto per tenant ID policy | Unique per tenant | — | All | Read-only when ERP owns the field |
| Identity | Salutation | salutation | Select | Char(10) | N | — | From list | PL_SALUTATION | All | — |
| Identity | First name | first_name | Text | Char(60) | Y | — | Letters, spaces, dot, hyphen only | — | All | — |
| Identity | Middle name | middle_name | Text | Char(60) | N | — | — | — | All | — |
| Identity | Last name | last_name | Text | Char(60) | Y | — | — | — | All | Some regions supply a single name; validation allows it |
| Identity | Full name (as per Aadhaar) | full_name | Text (derived) | Char(180) | Y | Concatenation | 2-180 chars | — | All | Duplicate check on name + DOB + site |
| Identity | Name as per bank | name_as_per_bank | Text | Char(180) | Y | Copy of full name | — | — | HR, Payroll | Mismatch is the top bank-rejection cause |
| Identity | Former / maiden name | former_name | Text | Char(180) | N | — | — | — | HR | Kept for PF and background-check continuity |
| Identity | Gender | gender | Select | Char(20) | Y | — | From list | PL_GENDER | All | Drives gender-conditional leave types and registers |
| Identity | Date of birth | date_of_birth | Date | Date | Y | — | Age >= statutory minimum for establishment type | — | All | Feeds birthday announcement and retirement date |
| Identity | Age | age_years | Number (derived) | Int | — | Computed | — | — | All | Read-only |
| Identity | Blood group | blood_group | Select | Char(5) | Y | — | From list | PL_BLOOD_GROUP | All | Mandatory before shop-floor access; prints on ID card |
| Identity | Marital status | marital_status | Select | Char(15) | Y | Single | From list | PL_MARITAL_STATUS | All | Drives maternity, paternity and dependant eligibility |
| Identity | Date of marriage | marriage_date | Date | Date | Y if married | — | Not before DOB + 18 years | — | HR, self | — |
| Identity | Nationality | nationality | Select | Char(40) | Y | Indian | From list | PL_NATIONALITY | All | Non-Indian triggers International Worker PF rules |
| Identity | Place of birth | place_of_birth | Text | Char(60) | N | — | — | — | HR | Needed for passport and visa letters |
| Identity | Mother tongue | mother_tongue | Select | Char(30) | N | — | From list | PL_LANGUAGE | HR | Drives business messaging and notice language where enabled |
| Identity | Social category | social_category | Select | Char(15) | Y | General | From list | PL_SOCIAL_CATEGORY | HR only | Statutory reporting only; never used in decisions |
| Identity | Religion | religion | Select | Char(30) | N | — | From list | PL_RELIGION | HR only | Optional and suppressible per tenant under DPDP |
| Identity | Differently abled | is_differently_abled | Toggle | Bool | Y | No | — | — | HR | Drives Section 80U and accessibility flags |
| Identity | Disability type | disability_type | Select | Char(30) | Y if abled=Yes | — | From list | PL_DISABILITY_TYPE | HR | — |
| Identity | Disability percentage | disability_percent | Number | Int | Y if abled=Yes | — | 1-100 | — | HR | 40% and above drives the higher 80U deduction |
| Identity | Disability certificate | disability_cert_ref | File | Ref | Y if abled=Yes | — | PDF/JPG, max 5 MB | — | HR | — |
| Identity | Ex-serviceman | is_ex_serviceman | Toggle | Bool | Y | No | — | — | HR | Statutory reporting |
| Identity | Photograph | photo_ref | File | Ref | Y | — | JPG/PNG, 200x200 min, max 2 MB | — | All | Prints on ID card and appears on attendance screens |
| Identity | Specimen signature | signature_ref | File | Ref | N | — | JPG/PNG, max 1 MB | — | HR | Used on generated letters where configured |
| Identity | Identification mark | identification_mark | Text | Char(120) | N | — | — | — | HR | Required on some factory registers |
| Family | Father's name | father_name | Text | Char(120) | Y | — | — | — | All | Printed on PF and gratuity nomination |
| Family | Mother's name | mother_name | Text | Char(120) | Y | — | — | — | All | Used for background verification |
| Family | Spouse name | spouse_name | Text | Char(120) | Y if married | — | — | — | All | — |
| Contact | Mobile (primary) | mobile | Phone | Char(16) | Y | — | E.164; warn if shared with another active employee | — | All | The business messaging channel key |
| Contact | Alternate mobile | alt_mobile | Phone | Char(16) | N | — | E.164 | — | All | — |
| Contact | Personal email | personal_email | Email | Char(120) | N | — | RFC 5322 | — | All | Used for pre-boarding and alumni access |
| Contact | Official email | official_email | Email | Char(120) | N | — | Must be a tenant domain | — | All | Provisioned by the joining chain |
| Contact | Emergency contact name | emergency_name | Text | Char(120) | Y | — | — | — | All | Mandatory before shop-floor access |
| Contact | Emergency contact relation | emergency_relation | Select | Char(30) | Y | — | From list | PL_RELATION | All | — |
| Contact | Emergency contact phone | emergency_phone | Phone | Char(16) | Y | — | E.164; must differ from own mobile | — | All | — |
| Contact | Emergency contact alternate phone | emergency_alt_phone | Phone | Char(16) | N | — | E.164 | — | All | — |
| Address | Present address line 1 | present_addr_1 | Text | Char(120) | Y | — | — | — | All | — |
| Address | Present address line 2 | present_addr_2 | Text | Char(120) | N | — | — | — | All | — |
| Address | Present city | present_city | Text | Char(60) | Y | — | — | — | All | — |
| Address | Present district | present_district | Text | Char(60) | N | — | — | — | All | — |
| Address | Present state | present_state | Select | Char(2) | Y | — | From state master | PL_STATE | All | — |
| Address | Present PIN code | present_pin | Text | Char(6) | Y | — | 6 digits; must resolve to the selected state | — | All | PIN drives PT and LWF cross-checks |
| Address | Present country | present_country | Select | Char(40) | Y | India | From list | PL_COUNTRY | All | — |
| Address | Same as present | permanent_same_as_present | Toggle | Bool | Y | Yes | — | — | All | Copies the block on save |
| Address | Permanent address block | permanent_address | Address block | Composite | Y | Copy of present | Same validations as present | — | All | — |
| Address | Residing at present address since | present_since | Date | Date | N | — | Not in the future | — | HR | Used in background verification packs |
| Address | Accommodation type | accommodation_type | Select | Char(20) | N | Own | From list | PL_ACCOMMODATION | HR, Payroll | Company-provided triggers perquisite valuation |
| Statutory IDs | Aadhaar | aadhaar_token | Masked text | Token | N | — | 12 digits, Verhoeff checksum; stored tokenised | — | HR + self, masked | Mismatch blocks payroll, not joining |
| Statutory IDs | Aadhaar name match | aadhaar_name_verified | Toggle | Bool | N | No | — | — | HR | Set by verification, not by hand |
| Statutory IDs | PAN | pan_token | Masked text | Token | N | — | ABCDE1234F; 4th char P for individual | — | HR + self, masked | Absent PAN forces 20% TDS |
| Statutory IDs | UAN | uan | Text | Char(12) | N | — | 12 digits | — | HR + self | Generated at registration if absent |
| Statutory IDs | PF member ID | pf_member_id | Text | Char(22) | N | — | Establishment format | — | HR | — |
| Statutory IDs | ESI IP number | esi_ip | Text | Char(17) | N | — | 17 digits | — | HR + self | Only where ESI applies |
| Statutory IDs | Passport number | passport_token | Masked text | Token | N | — | 8-9 alphanumeric | — | HR + self, masked | Mandatory for international workers |
| Statutory IDs | Passport expiry | passport_expiry | Date | Date | Y if passport set | — | Future date | — | HR | Expiry tracked and alerted |
| Statutory IDs | Driving licence | driving_licence | Text | Char(20) | N | — | — | — | HR | Required for driver and material-handling roles |
| Statutory IDs | Voter ID | voter_id | Text | Char(15) | N | — | — | — | HR | — |
| Statutory IDs | NPS PRAN | nps_pran | Text | Char(12) | N | — | 12 digits | — | HR, Payroll | Needed for employer NPS contribution |
| Statutory IDs | International worker | is_international_worker | Toggle | Bool | Y | No | — | — | HR, Payroll | Removes the PF wage ceiling |
| Statutory IDs | Country of origin | country_of_origin | Select | Char(40) | Y if IW | — | From list | PL_COUNTRY | HR | Drives social security agreement treatment |
| Statutory IDs | Work permit / visa number | work_permit_no | Text | Char(30) | Y if IW | — | — | — | HR | — |
| Statutory IDs | Work permit valid till | work_permit_expiry | Date | Date | Y if IW | — | Future date | — | HR | Expiry blocks payroll when reached |
| Bank | Bank name | bank_name | Lookup | Ref | Y | — | From bank master | — | HR + self | — |
| Bank | Branch | bank_branch | Text | Char(100) | Y | From IFSC | — | — | HR + self | Auto-filled from the IFSC lookup |
| Bank | Account number | account_token | Masked text | Token | Y | — | Tokenised; 9-18 digits; last 4 shown | — | HR + self, masked | Change inside a payroll window raises an alert |
| Bank | Re-enter account number | account_confirm | Masked text | Token | Y | — | Must equal account number | — | HR + self | Not stored |
| Bank | IFSC | ifsc | Text | Char(11) | Y | — | 11 char; validated against bank master | — | HR + self | — |
| Bank | Account type | account_type | Select | Char(15) | Y | Savings | From list | PL_ACCOUNT_TYPE | HR + self | — |
| Bank | Payment mode | payment_mode | Select | Char(15) | Y | Bank transfer | From list | PL_PAYMENT_MODE | HR, Payroll | Cash and cheque still exist on some sites |
| Bank | Cancelled cheque / passbook proof | bank_proof_ref | File | Ref | Y | — | PDF/JPG, max 5 MB | — | HR | — |
| Bank | Effective from | bank_effective_from | Date | Date | Y | Today | — | — | HR | Prior account retained for reprints |
| Family & Nominee | Dependant name | dependant.name | Text (repeating) | Char(120) | N | — | — | — | HR + self | Repeating group; add as many rows as needed |
| Family & Nominee | Dependant relation | dependant.relation | Select | Char(30) | Y per row | — | From list | PL_RELATION | HR + self | — |
| Family & Nominee | Dependant date of birth | dependant.dob | Date | Date | Y per row | — | Not in the future | — | HR + self | Drives child-education allowance and insurance age bands |
| Family & Nominee | Dependant gender | dependant.gender | Select | Char(20) | Y per row | — | From list | PL_GENDER | HR + self | — |
| Family & Nominee | Covered under medical insurance | dependant.insured | Toggle | Bool | Y per row | No | — | — | HR | Feeds the GMC enrolment file |
| Family & Nominee | Nominee name | nominee.name | Text (repeating) | Char(120) | Y | — | At least one nominee before F&F | — | HR + self | Repeating group |
| Family & Nominee | Nominee relation | nominee.relation | Select | Char(30) | Y per row | — | From list | PL_RELATION | HR + self | — |
| Family & Nominee | Nominee date of birth | nominee.dob | Date | Date | Y per row | — | — | — | HR + self | Minor nominee forces a guardian |
| Family & Nominee | Nominee share % | nominee.share_percent | Number | Dec(5,2) | Y per row | — | Shares must total exactly 100 per scheme | — | HR + self | Save blocked if the total is not 100 |
| Family & Nominee | Applies to scheme | nominee.scheme | Multi-select | Char[] | Y per row | — | PF / Gratuity / Insurance / Superannuation | PL_NOMINEE_SCHEME | HR + self | One person may nominate differently per scheme |
| Family & Nominee | Guardian name (minor nominee) | nominee.guardian_name | Text | Char(120) | Y if nominee is a minor | — | — | — | HR + self | — |
| Family & Nominee | Nominee address | nominee.address | Address block | Composite | Y per row | Employee permanent address | — | — | HR + self | Printed on Form 2 and Form F |
| Education | Qualification level | education.level | Select (repeating) | Char(30) | Y | — | From list | PL_EDUCATION_LEVEL | HR + self | Highest qualification must be flagged |
| Education | Degree / course | education.degree | Text | Char(100) | Y per row | — | — | — | HR + self | — |
| Education | Specialisation | education.specialisation | Text | Char(100) | N | — | — | — | HR + self | — |
| Education | Institute | education.institute | Text | Char(150) | Y per row | — | — | — | HR + self | — |
| Education | University / board | education.university | Text | Char(150) | N | — | — | — | HR + self | — |
| Education | Year of passing | education.year_of_passing | Number | Int(4) | Y per row | — | 1950 to current year | — | HR + self | — |
| Education | Marks / CGPA | education.score | Text | Char(10) | N | — | — | — | HR + self | — |
| Education | Certificate | education.certificate_ref | File | Ref | N | — | PDF/JPG, max 5 MB | — | HR | Verification status tracked separately |
| Experience | Previous employer | experience.employer | Text (repeating) | Char(150) | N | — | — | — | HR + self | Repeating group |
| Experience | Designation held | experience.designation | Text | Char(100) | Y per row | — | — | — | HR + self | — |
| Experience | From / to | experience.from_date, to_date | Date range | Date | Y per row | — | From < To; no overlap with Nucleus service | — | HR + self | — |
| Experience | Last drawn CTC (annual) | experience.last_ctc | Money | Dec(12,2) | N | — | >= 0 | — | HR only | — |
| Experience | Reason for leaving | experience.reason_for_leaving | Text | Char(200) | N | — | — | — | HR | — |
| Experience | Previous UAN | experience.prev_uan | Text | Char(12) | N | — | 12 digits | — | HR, Payroll | Drives PF transfer-in request |
| Experience | PF transfer required | experience.pf_transfer_required | Toggle | Bool | N | No | — | — | HR, Payroll | Raises a task in the joining chain |
| Experience | Income from previous employer (this FY) | experience.prev_fy_income | Money | Dec(12,2) | N | — | >= 0 | — | Payroll, self | Form 12B input; changes projected TDS |
| Experience | TDS deducted by previous employer | experience.prev_fy_tds | Money | Dec(12,2) | N | — | >= 0 | — | Payroll, self | — |
| Experience | Relieving letter | experience.relieving_letter_ref | File | Ref | N | — | PDF, max 5 MB | — | HR | — |
| Medical & Safety | Pre-employment medical date | medical_exam_date | Date | Date | Y for factory establishments | — | Not after date of joining + 30 days | — | HR, EHS | Blocks shop-floor access if absent |
| Medical & Safety | Fitness status | fitness_status | Select | Char(20) | Y for factory establishments | — | Fit / Fit with restriction / Unfit / Pending | PL_FITNESS_STATUS | HR, EHS | Certificate of fitness under the Factories Act |
| Medical & Safety | Fitness certificate | fitness_cert_ref | File | Ref | Y if status is Fit | — | PDF/JPG | — | HR, EHS | — |
| Medical & Safety | Next medical due | next_medical_due | Date (derived) | Date | — | Exam date + periodicity | — | — | HR, EHS | Drives the periodic medical reminder |
| Medical & Safety | Safety induction completed on | safety_induction_date | Date | Date | Y for factory establishments | — | Not before joining | — | HR, EHS | Blocking item in the joining chain |
| Site & Facilities | Biometric enrolment ID | biometric_enrol_id | Text | Char(20) | N | — | Unique per device fleet | — | HR, IT | Links the person to device punch records |
| Site & Facilities | Access card number | access_card_no | Text | Char(20) | N | — | Unique; returned at exit | — | HR, Admin | Blocking clearance item |
| Site & Facilities | Transport route | transport_route | Lookup | Ref | N | — | Active route | — | Admin | Drives transport deduction where applicable |
| Site & Facilities | Canteen eligibility | canteen_eligible | Toggle | Bool | N | Yes | — | — | Admin | Feeds the canteen deduction input |
| Site & Facilities | Uniform / shoe size | uniform_size, shoe_size | Text | Char(10) | N | — | — | — | Admin | Issued as an asset at joining |
| Site & Facilities | Locker number | locker_no | Text | Char(10) | N | — | Unique per site | — | Admin | Blocking clearance item |
| Control | Record status | person_status | Select | Char(15) | Y | Draft | Draft / Active / Suspended / Exited | PL_PERSON_STATUS | HR | Draft records are excluded from payroll |
| Control | Change reason | change_reason | Text | Char(200) | Y on edit | — | Min 10 chars | — | HR | Every edit writes an audit entry |
| Control | Effective from | effective_from | Date | Date | Y | Today | Backdating allowed with reason | — | HR | Backdating past a closed payroll creates arrears |

### FRM-PPL-02 — Employment, Assignment and Policy (SCR-011)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Employment | Employment type | employment_type | Select | Char(25) | Y | — | From list | PL_EMPLOYMENT_TYPE | HR | Permanent, probation, contract, trainee, apprentice, intern, retainer, consultant |
| Employment | Worker class | worker_class | Lookup | Ref | Y | — | Active class | PL_WORKER_CLASS | HR | Supplies rest days, wage type, OT eligibility, statutory set |
| Employment | Date of joining | employment_start | Date | Date | Y | — | Not after today + 90 days; backdating needs a reason | — | All | Backdated joining after a run triggers arrears |
| Employment | Probation period (months) | probation_months | Number | Int | Y if applicable | 3 | 0-24 | — | HR | 0 means no probation |
| Employment | Confirmation due date | confirmation_due | Date (derived) | Date | — | Joining + probation | — | — | HR | Drives the confirmation reminder |
| Employment | Actual confirmation date | confirmation_date | Date | Date | N | — | Not before joining | — | HR | Set by the confirmation process, not typed here |
| Employment | Contract start / end | contract_start, contract_end | Date range | Date | Y for contract types | — | End > start | — | HR | Expiry raises a renewal task 30 days ahead |
| Employment | Notice period (days) | notice_period_days | Number | Int | Y | From worker class | 0-180 | — | HR | Overridable with reason |
| Employment | Retirement date | retirement_date | Date (derived) | Date | — | DOB + superannuation age | — | — | HR | Drives the superannuation exit chain |
| Employment | Rehire | is_rehire | Toggle | Bool | Y | No | — | — | HR | Links to the prior person_id for tenure continuity |
| Employment | Previous employee code | prior_employee_code | Lookup | Ref | Y if rehire | — | Must be an exited record | — | HR | Gratuity continuity depends on this link |
| Placement | Position | position_code | Lookup | Ref | Y | — | Must be vacant and not frozen | — | HR | Filling it flips position status |
| Placement | Org unit | org_unit | Lookup | Ref | Y | From position | Active unit | — | HR | ERP-owned in co-owned mode |
| Placement | Department | department | Lookup | Ref | Y | From org unit | Active | — | HR | — |
| Placement | Sub-department / section | sub_department | Lookup | Ref | N | — | Active | — | HR | Used on shop-floor rosters |
| Placement | Designation | designation_code | Lookup | Ref | Y | — | Active designation | — | HR | Carries band, grace exemption and leave band |
| Placement | Grade / band | band | Text (derived) | Char(10) | Y | From designation | — | — | HR | Read-only |
| Placement | Job level | job_level | Text (derived) | Char(10) | N | From designation | — | — | HR | — |
| Placement | Location | location_id | Lookup | Ref | Y | — | Active location | — | HR | Drives holidays, PT, LWF, forms and time visibility |
| Placement | Work site / plant area | work_area | Lookup | Ref | N | — | Belongs to the location | — | HR | Used for roster and evacuation lists |
| Placement | Cost centre | cost_centre | Lookup | Ref | Y | From position | Active in the client's chart | — | HR | Journal dimension |
| Placement | Business unit | business_unit | Lookup | Ref | N | From org unit | Active | — | HR | Second journal dimension |
| Placement | Project / WBS | project_code | Lookup | Ref | N | — | Active project | — | HR | Only where project costing is on |
| Placement | Payroll group | payroll_group | Lookup | Ref | Y | — | Active group; NOT defaulted from location | — | HR | Independent of location by design |
| Placement | Reporting manager | manager_assignment_id | Lookup | Ref | Y | — | Active assignment; no cycles | — | HR | Cycle check must run at save |
| Placement | Dotted-line manager | secondary_manager_id | Lookup | Ref | N | — | Active assignment | — | HR | Approvals stay with the primary manager |
| Placement | HR business partner | hrbp_id | Lookup | Ref | N | — | Active HR principal | — | HR | Escalation target for stuck chains |
| Policy | Has rest days (override) | override_has_rest_days | Toggle | Bool | N | From class | Reason required when set | — | HR | Temporal |
| Policy | Rest day pattern (override) | override_rest_day_pattern | Select | Char(20) | N | From class | Reason required | PL_REST_DAY_PATTERN | HR | Weekly day(s), rotating, or none |
| Policy | Wage type (override) | override_wage_type | Select | Char(15) | N | From class | Reason required | PL_WAGE_TYPE | HR | Monthly, daily, stipend, retainer |
| Policy | Overtime eligibility (override) | override_ot_eligibility | Select | Char(30) | N | From class | Reason required | PL_OT_ELIGIBILITY | HR | always / rest_day_and_holiday_only / none |
| Policy | Shift group | shift_group | Lookup | Ref | Y | From location | Active group | — | HR | Shift inference operates only inside the group |
| Policy | Default shift | default_shift | Lookup | Ref | Y | — | Shift must belong to the group | — | HR | — |
| Policy | Attendance capture mode | attendance_mode | Multi-select | Char[] | Y | Biometric | Biometric / Mobile / Kiosk / business messaging / Web / Exempt | PL_ATTENDANCE_MODE | HR | Exempt removes the person from the exception queue |
| Policy | Leave band | leave_band | Text (derived) | Char(10) | Y | From designation | — | — | HR | Drives accrual policy selection |
| Policy | PF applicable | pf_applicable | Toggle | Bool | Y | From class | — | — | HR, Payroll | — |
| Policy | ESI applicable | esi_applicable | Toggle | Bool | Y | Derived from wage and location | — | — | HR, Payroll | Recomputed when wages cross the threshold |
| Policy | PT applicable | pt_applicable | Toggle | Bool | Y | Derived from location state | — | — | HR, Payroll | — |
| Policy | Gratuity applicable | gratuity_applicable | Toggle | Bool | Y | From class | — | — | HR, Payroll | — |
| Policy | Union member | is_union_member | Toggle | Bool | N | No | — | — | HR | Drives union subscription deduction where applicable |
| Policy | Union / settlement reference | union_code | Lookup | Ref | N | — | Active union master | — | HR | Wage settlements attach here |
| Control | Effective from | effective_from | Date | Date | Y | Today | Past dates flagged as retro | — | HR | Retro into a closed period creates arrears, never a rewrite |
| Control | Change type | change_type | Select | Char(25) | Y | New hire | From list | PL_ASSIGNMENT_CHANGE | HR | Promotion, transfer, redesignation, class change, correction |
| Control | Change reason | override_reason | Text | Char(300) | Y when overriding | — | Min 10 chars | — | HR | No reason, no save |
| Control | Supporting document | change_document_ref | File | Ref | N | — | PDF, max 5 MB | — | HR | — |

### FRM-PPL-03 — Position Master (SCR-012)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Position | Position code | position_code | Text | Char(20) | Y | Auto | Unique per tenant | — | HR, Finance | — |
| Position | Position title | title | Text | Char(100) | Y | From designation | — | — | HR, Finance | — |
| Position | Org unit | org_unit | Lookup | Ref | Y | — | Active | — | HR, Finance | — |
| Position | Designation | designation_code | Lookup | Ref | Y | — | Active | — | HR, Finance | — |
| Position | Location | location_id | Lookup | Ref | Y | — | Active | — | HR, Finance | — |
| Position | Cost centre | cost_centre | Lookup | Ref | Y | — | Active | — | HR, Finance | — |
| Position | Worker class | worker_class | Lookup | Ref | Y | — | Active | — | HR | — |
| Position | Reports to position | reports_to_position | Lookup | Ref | N | — | No cycles | — | HR | — |
| Position | Full time equivalent | fte | Number | Dec(3,2) | Y | 1.00 | 0.25-1.00 | — | HR, Finance | Part-time positions prorate sanction counts |
| Position | Position status | position_status | Select | Char(15) | Y | Vacant | Vacant / Filled / Frozen / Abolished | PL_POSITION_STATUS | HR, Finance | Filled is set by assignment, never by hand |
| Position | Incumbent | incumbent_person_id | Lookup (derived) | Ref | — | From assignment | — | — | HR, Finance | Read-only |
| Position | Available for hire from | available_from | Date | Date | Y | Today | — | — | HR | A requisition cannot precede this date |
| Position | Budgeted annual cost | budget_cost | Money | Dec(12,2) | N | — | >= 0 | — | Finance | Compared against the offered CTC |
| Position | Freeze reason | freeze_reason | Text | Char(200) | Y when freezing | — | Min 10 chars | — | HR, Finance | A frozen position cannot be requisitioned |
| Position | Effective from | effective_from | Date | Date | Y | Today | — | — | HR | — |

### FRM-PPL-04 — Sanctioned Strength (SCR-013)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Sanction | Org unit | org_unit | Lookup | Ref | Y | — | Active | — | HR, Finance | Part of the sanction key |
| Sanction | Designation | designation_code | Lookup | Ref | Y | — | Active | — | HR, Finance | Part of the sanction key |
| Sanction | Location | location_id | Lookup | Ref | Y | — | Active | — | HR, Finance | Part of the sanction key |
| Sanction | Worker class | worker_class | Lookup | Ref | Y | — | Active | — | HR, Finance | Contract and permanent are sanctioned separately |
| Sanction | Sanctioned count | sanctioned_count | Number | Int | Y | — | 0-9999 | — | HR, Finance | — |
| Sanction | Filled count | filled_count | Number (derived) | Int | — | Computed from assignments | — | — | HR, Finance | Never stored |
| Sanction | Open requisitions | open_req_count | Number (derived) | Int | — | Computed from requisitions | — | — | HR, Finance | Never stored |
| Sanction | Headroom | headroom | Number (derived) | Int | — | Sanctioned minus filled minus open | — | — | HR, Finance | Negative headroom blocks a new requisition |
| Sanction | Sanction valid from / to | valid_from, valid_to | Date range | Date | Y | FY start / FY end | From <= To | — | HR, Finance | Sanctions are revised annually |
| Sanction | Approved by | approved_by | Lookup | Ref | Y | — | Authorised role | — | Finance | — |
| Sanction | Board / committee reference | approval_reference | Text | Char(60) | N | — | — | — | Finance | — |

### FRM-PPL-05 — Document Upload and Verification (SCR-014)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Document | Document class | document_class | Select | Char(40) | Y | — | From list | PL_DOCUMENT_CLASS | Self, HR | Drives the mandatory checklist per worker class |
| Document | Document name | document_name | Text | Char(120) | Y | From class | — | — | Self, HR | — |
| Document | File | file_ref | File | Ref | Y | — | PDF/JPG/PNG, max 10 MB | — | Self, HR | Encrypted at rest |
| Document | Document number | document_number | Text | Char(40) | N | — | Per class format | — | Self, HR | — |
| Document | Issue date | issue_date | Date | Date | N | — | Not in the future | — | Self, HR | — |
| Document | Expiry date | expiry_date | Date | Date | Y where the class expires | — | Future date | — | Self, HR | Expiry alert at 60, 30 and 7 days |
| Document | Verification status | verification_status | Select | Char(15) | Y | Pending | Pending / Verified / Rejected | PL_VERIFICATION_STATUS | HR | Only HR may set Verified |
| Document | Verified by / on | verified_by, verified_on | Text (derived) | Ref/Date | — | System | — | — | HR | — |
| Document | Rejection reason | rejection_reason | Text | Char(200) | Y if rejected | — | Min 10 chars | — | HR | Returned to the employee with the reason |
| Document | Replaces | replaces_document_id | Lookup | Ref | N | — | Same class | — | HR | Old version retained, never deleted |

### FRM-PPL-06 — Asset Allocation and Return (SCR-064)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Asset | Asset code | asset_code | Lookup | Ref | Y | — | Must be available | — | Admin | — |
| Asset | Asset type | asset_type | Select (derived) | Char(30) | Y | From asset | — | PL_ASSET_TYPE | Admin | Laptop, phone, tool, uniform, vehicle, access card |
| Asset | Serial / IMEI | serial_no | Text (derived) | Char(60) | N | From asset | — | — | Admin | — |
| Asset | Issued to | person_id | Lookup | Ref | Y | — | Active assignment | — | Admin | — |
| Asset | Issued on | issued_on | Date | Date | Y | Today | Not before joining | — | Admin | — |
| Asset | Condition at issue | condition_issue | Select | Char(20) | Y | New | New / Good / Fair | PL_ASSET_CONDITION | Admin | — |
| Asset | Acknowledgement | acknowledged_by_employee | Toggle | Bool | Y | Off | Employee must acknowledge on self-service | — | Self, Admin | Unacknowledged assets appear on the HR chase list |
| Asset | Expected return date | expected_return | Date | Date | N | — | — | — | Admin | Defaults to contract end for contract staff |
| Return | Returned on | returned_on | Date | Date | Y at exit | — | Not before issue date | — | Admin | Blocking clearance item |
| Return | Condition at return | condition_return | Select | Char(20) | Y at exit | — | Good / Damaged / Lost | PL_ASSET_RETURN_CONDITION | Admin | — |
| Return | Recovery amount | recovery_amount | Money | Dec(10,2) | Y if damaged or lost | — | >= 0 | — | Admin, Payroll | Raises a payroll input on full and final |
| Return | Remarks | return_remarks | Text | Char(200) | Y if damaged or lost | — | Min 10 chars | — | Admin | — |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACCOMMODATION | Accommodation type | Config | 5 | Own · Rented · Company provided · Parental · Hostel |
| PL_ACCOUNT_TYPE | Bank account type | System | 5 | Savings · Current · Salary · NRE · NRO |
| PL_ASSET_CONDITION | Asset condition at issue | System | 3 | New · Good · Fair |
| PL_ASSET_RETURN_CONDITION | Asset condition at return | System | 4 | Good · Damaged · Lost · Not returned |
| PL_ASSET_TYPE | Asset type | Config | 12 | Laptop · Desktop · Mobile phone · SIM card · Access card · Vehicle · Tool kit · Safety equipment · Uniform · Footwear · Locker key · Other |
| PL_ASSIGNMENT_CHANGE | Assignment change type | Config | 10 | New hire · Promotion · Transfer — location · Transfer — org unit · Redesignation · Worker class change · Manager change · Payroll group change · Data correction · Rehire |
| PL_ATTENDANCE_MODE | Attendance capture mode | Config | 6 | Biometric device · Mobile app · Kiosk · business messaging · Web · Exempt |
| PL_BLOOD_GROUP | Blood group | System | 9 | A+ · A- · B+ · B- · AB+ · AB- · O+ · O- · Not known |
| PL_COUNTRY | Country | System | 2 | India · (full ISO 3166-1 list seeded at install) |
| PL_DISABILITY_TYPE | Disability type | System | 7 | Locomotor · Visual · Hearing · Speech · Intellectual · Multiple · Other |
| PL_DOCUMENT_CLASS | Document class | Config | 17 | Aadhaar · PAN · Passport · Driving licence · Voter ID · Bank proof · Educational certificate · Experience letter · Relieving letter · Payslip (previous employer) · Medical fitness certificate · Disability certificate · Photograph · Signature · Police verification · Contract / agreement · Other |
| PL_EDUCATION_LEVEL | Qualification level | Config | 9 | Below 10th · 10th / SSLC · 12th / PUC · ITI · Diploma · Graduate · Post graduate · Doctorate · Professional certification |
| PL_EMPLOYMENT_TYPE | Employment type | Config | 10 | Permanent · Probation · Fixed term contract · Trainee · Apprentice (NAPS/NATS) · Intern · Retainer · Consultant · Contract (through vendor) · Part time |
| PL_FITNESS_STATUS | Medical fitness status | System | 4 | Fit · Fit with restriction · Unfit · Pending |
| PL_GENDER | Gender | System | 4 | Male · Female · Other · Prefer not to say |
| PL_LANGUAGE | Language | Config | 14 | English · Hindi · Kannada · Tamil · Telugu · Malayalam · Marathi · Gujarati · Bengali · Odia · Punjabi · Assamese · Urdu · Other |
| PL_MARITAL_STATUS | Marital status | System | 5 | Single · Married · Widowed · Divorced · Separated |
| PL_NATIONALITY | Nationality | System | 2 | Indian · (derived from the ISO 3166-1 country list) |
| PL_NOMINEE_SCHEME | Nominee scheme | System | 5 | Provident fund · Gratuity · Group insurance · Superannuation · ESI dependant |
| PL_OT_ELIGIBILITY | Overtime eligibility | Config | 4 | Always · Rest day and holiday only · Beyond weekly hours only · None |
| PL_PAYMENT_MODE | Payment mode | Config | 6 | Bank transfer (NEFT) · Bank transfer (IMPS) · Bank transfer (RTGS) · Cheque · Cash · Demand draft |
| PL_PERSON_STATUS | Person record status | System | 5 | Draft · Active · Suspended · On notice · Exited |
| PL_POSITION_STATUS | Position status | System | 4 | Vacant · Filled · Frozen · Abolished |
| PL_RELATION | Relationship | System | 14 | Spouse · Father · Mother · Son · Daughter · Brother · Sister · Father-in-law · Mother-in-law · Grandfather · Grandmother · Guardian · Friend · Other |
| PL_RELIGION | Religion | Config | 10 | Hindu · Muslim · Christian · Sikh · Buddhist · Jain · Parsi · Jewish · Other · Not disclosed |
| PL_REST_DAY_PATTERN | Rest day pattern | Config | 4 | Fixed weekly day · Two fixed days · Rotating · None |
| PL_SALUTATION | Salutation | Config | 7 | Mr. · Ms. · Mrs. · Dr. · Prof. · Shri · Smt. |
| PL_SOCIAL_CATEGORY | Social category | System | 6 | General · OBC · SC · ST · EWS · Not disclosed |
| PL_STATE | Indian state / union territory | System | 36 | Andhra Pradesh · Arunachal Pradesh · Assam · Bihar · Chhattisgarh · Goa · Gujarat · Haryana · Himachal Pradesh · Jharkhand · Karnataka · Kerala · Madhya Pradesh · Maharashtra · Manipur · Meghalaya · Mizoram · Nagaland · Odisha · Punjab · Rajasthan · Sikkim · Tamil Nadu · Telangana · Tripura · Uttar Pradesh · Uttarakhand · West Bengal · Andaman & Nicobar Islands · Chandigarh · Dadra & Nagar Haveli and Daman & Diu · Delhi · Jammu & Kashmir · Ladakh · Lakshadweep · Puducherry |
| PL_VERIFICATION_STATUS | Verification status | System | 3 | Pending · Verified · Rejected |
| PL_WAGE_TYPE | Wage type | Config | 6 | Monthly · Daily · Hourly · Piece rate · Stipend · Retainer |
| PL_WORKER_CLASS | Worker class | Config | 9 | Staff — monthly · Staff — probation · Workman — permanent · Workman — badli / substitute · Workman — temporary · Contract labour · Apprentice · Trainee · Retainer / consultant |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-EMP-01 | Employee Master | EMP | Master form | R-03, R-04, R-05, R-07, R-08, R-09 | The single record that carries employment category, rest-day entitlement, OT basis, leave scheme and payroll location. | N | Employee profile print | 18 |
| F-EMP-02 | Employment Category & Sub-category Master | EMP | Master form | R-03, R-04 | Defines Permanent, Contractual, Third-party and the Employee / Helper sub-category, each with its default rest-day and wage behaviour. | N | Register | 9 |
| F-EMP-03 | Leave Scheme Master | EMP | Master form | R-07, R-08 | Named leave schemes an employee is mapped to. Holds accrual rules, caps, combination restrictions, COFF lapse days and encashment behaviour. | N | Scheme print | 21 |
| F-EMP-04 | Designation & Grade Master | EMP | Master form | R-08, R-13 | Grade drives the AGM-and-above leave entitlement and the Assistant-Manager-and-above grace exemption. Both must read a grade rank, not a designation name. | N | Register | 2 |
| F-ORG-01 | Organisation Chart | ORG | Workbench | R-23 | Department-wise hierarchy derived from the reporting relationship on the employee record. | N | Chart export | 3 |

#### F-EMP-01 — Employee Master

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Employment | Employment category | employment_category | Select | Char(25) | Y | Permanent | Must exist and be active in the Employment Category Master | EN_EMPLOYMENT_CATEGORY | All roles | Yes — value set configurable per tenant | R-03 |
| Header | Employment | Employment sub-category | employment_subcategory | Select | Char(25) | Y when the category has sub-categories | — | Must be a sub-category of the selected employment category. Third-party resolves to Employee or Helper. | EN_EMPLOYMENT_SUBCATEGORY | All roles | Yes — value set configurable per tenant | R-04 |
| Header | Employment | Rest day applicable | rest_day_applicable | Toggle | Bool | Y | Defaulted from the employment sub-category, then the category | Where N, attendance processing must not generate a weekly off and must not treat the day as a rest day for OT | — | All roles | Yes — default per category, overridable per employee | R-03, R-04 |
| Header | Employment | Rest day pattern | rest_day_pattern | Lookup | Ref | Y when rest_day_applicable is Y | From the work calendar | Blank and not editable when rest_day_applicable is N | — | All roles | Yes | R-03, R-04 |
| Header | Employment | Wage basis | wage_basis | Select | Char(20) | Y | Monthly | Daily wage employees are paid on days present; the payroll run must read this, not the employment category | EN_WAGE_BASIS | Payroll and HR roles only | No — system value set | R-03 |
| Header | Overtime | OT eligible | ot_eligible | Toggle | Bool | Y | Y | Where N, OT computation produces no OT line for this employee at all | — | All roles | Yes | R-05 |
| Header | Overtime | OT eligibility basis | ot_eligibility_basis | Select | Char(30) | Y when ot_eligible is Y | All days | All days, or Rest days and holidays only. The second value suppresses OT on an ordinary working day however many hours are worked. | EN_OT_ELIGIBILITY_BASIS | All roles | Yes — value set configurable per tenant | R-05 |
| Header | Overtime | OT rate multiplier | ot_rate_multiplier | Number | Dec(5,2) | Y when ot_eligible is Y | From the leave and OT scheme | Greater than zero | — | Payroll and HR roles only | Yes | R-05 |
| Header | Leave | Leave scheme | leave_scheme_code | Lookup | Ref | Y | Defaulted from grade and employment category | Must be an active scheme in the Leave Scheme Master. Changing it mid-year must not retrospectively re-credit. | — | All roles | Yes | R-08 |
| Header | Leave | COFF lapse days | coff_lapse_days | Number | Int(3) | Y | 60 from the leave scheme | Between 1 and 365. Held here so a future policy change is a configuration change. | — | HR roles only | Yes — default 60 per the stated policy | R-07 |
| Header | Leave | Trainee type | trainee_type | Select | Char(20) | Y when employment_category is Trainee | — | DET or GET. Both are eligible for CL; the leave scheme reads this flag. | EN_TRAINEE_TYPE | All roles | Yes — value set configurable per tenant | R-08 |
| Header | Leave | EL eligibility start date | el_eligibility_from | Date (derived) | Date | Y | Date of joining plus six months | Read-only. No EL may accrue or be availed before this date. | — | All roles | No — system derived from the scheme rule | R-08 |
| Header | Payroll | Payroll processing location | payroll_processing_location | Lookup | Ref | Y | Employee work location | Where this differs from the attendance location, salary and rate structure are visible only to roles scoped to the payroll location | — | All roles | Yes | R-09 |
| Header | Payroll | Attendance location | attendance_location | Lookup | Ref | Y | Employee work location | Drives which plant users can see and regularise this employee's attendance | — | All roles | Yes | R-09 |
| Header | Service | Continuous service years | continuous_service_years | Number (derived) | Dec(5,2) | Y | Computed from date of joining | Read-only. The loan ceiling reads this: five years or more raises the multiple from four to six. | — | All roles | No — system derived | R-10 |
| Header | Service | Date of birth | date_of_birth | Date | Date | Y | — | Drives birthday leave entitlement and the birthday announcement | — | All roles | No — system derived | R-08, R-21 |
| Header | Gate pass | Gate pass entitlement hours per month | gatepass_hours_per_month | Number | Dec(4,2) | Y | 4.00 | Held on the employee so an exception can be granted without a code change | — | HR roles only | Yes — default 4 hours per the stated policy | R-12 |
| Header | Gate pass | Gate pass count limit per month | gatepass_count_per_month | Number | Int(2) | Y | 2 | Between 1 and 4 | — | HR roles only | Yes — default 2 per the stated policy | R-12 |

#### F-EMP-02 — Employment Category & Sub-category Master

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Identity | Category code | category_code | Text | Char(10) | Y | — | Unique within the tenant | — | All roles | Yes | R-03, R-04 |
| Header | Identity | Category name | category_name | Text | Char(60) | Y | — | Unique within the tenant | — | All roles | Yes | R-03, R-04 |
| Header | Identity | Is third party | is_third_party | Toggle | Bool | Y | N | Third-party categories must carry at least one sub-category | — | All roles | Yes | R-04 |
| Header | Defaults | Default rest day applicable | default_rest_day_applicable | Toggle | Bool | Y | Y | Seeds rest_day_applicable on a new employee in this category; the employee value may differ | — | All roles | Yes | R-03, R-04 |
| Header | Defaults | Default wage basis | default_wage_basis | Select | Char(20) | Y | Monthly | Contractual defaults to Daily per the stated policy | EN_WAGE_BASIS | All roles | Yes | R-03 |
| Header | Defaults | Default leave scheme | default_leave_scheme_code | Lookup | Ref | N | — | Must be an active leave scheme | — | All roles | Yes | R-08 |
| Line | Sub-categories | Sub-category code | subcategory_code | Text | Char(10) | Y per sub-category row | — | Unique within the category | — | All roles | Yes | R-04 |
| Line | Sub-categories | Sub-category name | subcategory_name | Text | Char(60) | Y per sub-category row | — | Employee and Helper are the two the source names | — | All roles | Yes | R-04 |
| Line | Sub-categories | Rest day applicable | subcategory_rest_day_applicable | Toggle | Bool | Y per sub-category row | Inherited from the category | This is the level the Employee-versus-Helper rule resolves at | — | All roles | Yes | R-04 |

#### F-EMP-03 — Leave Scheme Master

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Identity | Scheme code | scheme_code | Text | Char(15) | Y | — | Unique within the tenant | — | All roles | Yes | R-08 |
| Header | Identity | Scheme name | scheme_name | Text | Char(60) | Y | — | — | — | All roles | Yes | R-08 |
| Header | Applicability | Applies from grade rank | applies_from_grade_rank | Number | Int(3) | N | — | The AGM-and-above scheme is selected by grade rank, never by matching a designation string | — | All roles | Yes | R-08 |
| Header | Applicability | Applies to trainees | applies_to_trainees | Toggle | Bool | Y | N | Where Y, the trainee_type on the employee decides CL eligibility | — | All roles | Yes | R-08 |
| Header | Year end | EL treatment at year end | el_year_end_treatment | Select | Char(20) | Y | Encash | Encash, Carry forward or Lapse. The source states EL is encashed. | EN_YEAR_END_TREATMENT | All roles | Yes — value set configurable per tenant | R-08 |
| Header | Year end | CL treatment at year end | cl_year_end_treatment | Select | Char(20) | Y | Lapse | The source states CL lapses | EN_YEAR_END_TREATMENT | All roles | Yes — value set configurable per tenant | R-08 |
| Header | Year end | SL treatment at year end | sl_year_end_treatment | Select | Char(20) | Y | Lapse | The source states SL lapses | EN_YEAR_END_TREATMENT | All roles | Yes — value set configurable per tenant | R-08 |
| Header | COFF | COFF lapse days | scheme_coff_lapse_days | Number | Int(3) | Y | 60 | Seeds coff_lapse_days on the employee | — | All roles | Yes | R-07 |
| Line | Accrual rules | Leave type | accrual_leave_type | Lookup | Ref | Y per accrual row | — | Must exist in the Leave Type Master | — | All roles | Yes | R-08 |
| Line | Accrual rules | Accrual frequency | accrual_frequency | Select | Char(20) | Y per accrual row | Annual | Annual on a fixed date, or Monthly. EL for non-AGM staff is Monthly at 1.5; for AGM and above it is Annual at 18. | EN_ACCRUAL_FREQUENCY | All roles | Yes — value set configurable per tenant | R-08 |
| Line | Accrual rules | Accrual quantity | accrual_quantity | Number | Dec(5,2) | Y per accrual row | — | Two decimals because 1.5 days a month is a stated value | — | All roles | Yes | R-08 |
| Line | Accrual rules | Accrual date | accrual_date | Text | Char(5) | Y when frequency is Annual | 01-01 | The source credits the annual entitlement on 1 January | — | All roles | Yes | R-08 |
| Line | Accrual rules | Minimum service months before accrual | min_service_months | Number | Int(3) | Y per accrual row | 0 | EL is 6 for new joiners. On completing the period the employee receives the catch-up quantity, not the monthly rate. | — | All roles | Yes | R-08 |
| Line | Accrual rules | Catch-up quantity on completing minimum service | catchup_quantity | Number | Dec(5,2) | Y when min_service_months is above zero | — | The source states 9 EL on completing six months | — | All roles | Yes | R-08 |
| Line | Accrual rules | Maximum availed per month | max_availed_per_month | Number | Dec(5,2) | N | — | CL is capped at 2 a month and EL at 10 a month. Enforced at application, not at accrual. | — | All roles | Yes | R-08 |
| Line | Proration | Joining month from | proration_month_from | Number | Int(2) | Y per proration row | — | Between 1 and 12 | — | All roles | Yes | R-08 |
| Line | Proration | Joining month to | proration_month_to | Number | Int(2) | Y per proration row | — | Between 1 and 12, and not less than proration_month_from | — | All roles | Yes | R-08 |
| Line | Proration | Cut-off day in the last month | proration_cutoff_day | Number | Int(2) | N | — | The final band runs to 4 December in the source, so the band needs a day as well as a month | — | All roles | Yes | R-08 |
| Line | Proration | Quantity credited | proration_quantity | Number | Dec(5,2) | Y per proration row | — | Applies to CL and SL each | — | All roles | Yes | R-08 |
| Line | Restrictions | Leave type | restriction_leave_type | Lookup | Ref | Y per restriction row | — | Must exist in the Leave Type Master | — | All roles | Yes | R-08 |
| Line | Restrictions | Cannot be combined with | cannot_combine_with | Multi-select | Ref[] | Y per restriction row | — | CL cannot be combined with EL or SL. The check must fire across a contiguous absence, not only within one application. | — | All roles | Yes | R-08 |

#### F-EMP-04 — Designation & Grade Master

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Grade | Grade rank | grade_rank | Number | Int(3) | Y | — | A single numeric ladder. Every rule that says "and above" compares this, never a designation name. | — | All roles | Yes | R-08, R-13 |
| Header | Grade | Exempt from grace deduction | exempt_from_grace_deduction | Toggle | Bool | Y | N | Assistant Manager and above are exempt per the source. Set by grade rank, not per employee. | — | All roles | Yes | R-13 |

#### F-ORG-01 — Organisation Chart

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Hierarchy | Reporting manager | reporting_manager_code | Lookup | Ref | Y | — | The chart is generated from this field on the employee record. A separate hierarchy maintained by hand will drift. | — | All roles | No — system derived | R-23 |
| Header | Hierarchy | Department | department_code | Lookup | Ref | Y | — | Drives the department-wise view | — | All roles | Yes | R-23 |
| Header | Hierarchy | Functional reporting manager | functional_manager_code | Lookup | Ref | N | — | Where matrix reporting exists. Must not be used for approval routing unless the workflow says so. | — | All roles | Yes | R-23 |

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
| Size | 306 | specified items (table rows) | Counted automatically at generation |
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
