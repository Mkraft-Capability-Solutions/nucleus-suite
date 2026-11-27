<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# DA-02 — Picklist Catalogue

| Attribute | Value |
| :--- | :--- |
| Document ID | DA-02 |
| Title | Picklist Catalogue |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Data Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS |
| Related documents | DA-03, FRS-<DOM>-03 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 03_Picklists<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 66_Picklist_Seed_Values |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Picklist value sets

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACCOMMODATION | Accommodation type | Config | 5 | Own · Rented · Company provided · Parental · Hostel |
| PL_ACCOUNT_TYPE | Bank account type | System | 5 | Savings · Current · Salary · NRE · NRO |
| PL_ACCRUAL_DAY | Accrual timing | Config | 2 | Period start · Period end |
| PL_ACCRUAL_METHOD | Accrual method | Config | 4 | Annual credit · Monthly accrual · Per days worked · No accrual (entitlement based) |
| PL_ACTIVE_STATUS | Record status | System | 2 | Active · Inactive |
| PL_ANNOUNCEMENT_CHANNEL | Announcement channel | Config | 5 | Employee portal · Mobile push · Email · business messaging · Notice board display |
| PL_ANNOUNCEMENT_TYPE | Announcement type | Config | 5 | General · Policy · Emergency · Celebration · Statutory notice |
| PL_APPROVAL_STATUS | Approval status | System | 5 | Draft · Pending approval · Approved · Rejected · Withdrawn |
| PL_ASSET_CONDITION | Asset condition at issue | System | 3 | New · Good · Fair |
| PL_ASSET_RETURN_CONDITION | Asset condition at return | System | 4 | Good · Damaged · Lost · Not returned |
| PL_ASSET_TYPE | Asset type | Config | 12 | Laptop · Desktop · Mobile phone · SIM card · Access card · Vehicle · Tool kit · Safety equipment · Uniform · Footwear · Locker key · Other |
| PL_ASSIGNMENT_CHANGE | Assignment change type | Config | 10 | New hire · Promotion · Transfer — location · Transfer — org unit · Redesignation · Worker class change · Manager change · Payroll group change · Data correction · Rehire |
| PL_ATTENDANCE_MODE | Attendance capture mode | Config | 6 | Biometric device · Mobile app · Kiosk · business messaging · Web · Exempt |
| PL_ATTENDANCE_STATUS | Attendance day status | System | 9 | Present · Half day · Absent · Weekly off · Holiday · On leave · On duty · Work from home · Not scheduled |
| PL_AUTH_METHOD | Authentication method | Config | 5 | SSO (SAML) · SSO (OIDC) · Password · OTP · Biometric (device) |
| PL_AWARD_CATEGORY | Recognition category | Config | 8 | Star performer · Safety champion · Quality champion · Innovation · Long service · Team award · Customer delight · Spot award |
| PL_BANK_FORMAT | Bank file format | Config | 8 | HDFC ENet · ICICI CIB · SBI CINB · Axis Corporate · Kotak FYN · Yes Bank · NPCI NACH · Generic CSV |
| PL_BLOOD_GROUP | Blood group | System | 9 | A+ · A- · B+ · B- · AB+ · AB- · O+ · O- · Not known |
| PL_CALC_METHOD | Calculation method | Config | 6 | Fixed amount · Percentage of component · Formula · Slab table · Attendance driven · Rate x quantity |
| PL_CANDIDATE_STAGE | Candidate stage | Config | 11 | Applied · Screened · Interview scheduled · Interview complete · Selected · Offered · Offer accepted · Joined · Rejected · Withdrawn · On hold |
| PL_CAP_STATUS | Statutory cap status | System | 3 | Within limit · Approaching limit · Breach |
| PL_CLAIM_TYPE | Reimbursement claim type | Config | 9 | Fuel / conveyance · Telephone / internet · Medical · Books and periodicals · Travel · Relocation · Professional development · Meal · Other |
| PL_CLEARANCE_ITEM_STATUS | Clearance item status | System | 3 | Open · Cleared · Waived |
| PL_CLEARANCE_STATUS | Clearance status | System | 4 | Not started · In progress · Blocked · Cleared |
| PL_COMPONENT_TYPE | Pay component type | Config | 5 | Earning · Deduction · Employer contribution · Reimbursement · Information only |
| PL_CONFIRMATION_ACTION | Confirmation action | System | 3 | Confirm · Extend probation · Terminate |
| PL_CONFLICT_POLICY | Conflict policy | Config | 3 | Owner wins · Hold for review · Latest wins |
| PL_COUNTRY | Country | System | 2 | India · (full ISO 3166-1 list seeded at install) |
| PL_CURRENCY | Currency | System | 7 | INR · USD · EUR · GBP · AED · SGD · (full ISO 4217 list seeded at install) |
| PL_DAY_TYPE | Day type | System | 4 | Working day · Weekly off / rest day · Holiday · National holiday |
| PL_DECISION | Approval decision | System | 4 | Approve · Reject · Return for correction · Delegate |
| PL_DECLARATION_STATUS | Declaration status | System | 5 | Draft · Submitted · Proof pending · Verified · Partially verified |
| PL_DECLINE_REASON | Offer decline reason | Config | 8 | Compensation · Counter offer accepted · Role mismatch · Location · Joining date · Family reasons · Other offer · Not disclosed |
| PL_DISABILITY_TYPE | Disability type | System | 7 | Locomotor · Visual · Hearing · Speech · Intellectual · Multiple · Other |
| PL_DOCUMENT_CLASS | Document class | Config | 17 | Aadhaar · PAN · Passport · Driving licence · Voter ID · Bank proof · Educational certificate · Experience letter · Relieving letter · Payslip (previous employer) · Medical fitness certificate · Disability certificate · Photograph · Signature · Police verification · Contract / agreement · Other |
| PL_EDUCATION_LEVEL | Qualification level | Config | 9 | Below 10th · 10th / SSLC · 12th / PUC · ITI · Diploma · Graduate · Post graduate · Doctorate · Professional certification |
| PL_EMPLOYMENT_TYPE | Employment type | Config | 10 | Permanent · Probation · Fixed term contract · Trainee · Apprentice (NAPS/NATS) · Intern · Retainer · Consultant · Contract (through vendor) · Part time |
| PL_ENCASHMENT_BASIS | Encashment rate basis | Config | 3 | Basic · Basic + DA · Gross |
| PL_ENTITY_TYPE | Legal entity type | Config | 8 | Private Limited · Public Limited · LLP · Partnership · Proprietorship · Society · Trust · Branch Office |
| PL_ERP_SYSTEM | ERP system | Config | 6 | Cloud ERP · On-premise ERP · Accounting package · Custom / file based |
| PL_ESTB_TYPE | Establishment type | Config | 8 | Factory · Shops & Establishment · Mine · Plantation · Motor Transport · Construction · Beedi & Cigar · Contract Establishment |
| PL_EXCEPTION_ACTION | Exception resolution action | System | 4 | Accept proposal · Amend · Reject · Escalate |
| PL_EXCEPTION_TYPE | Attendance exception type | System | 8 | Unpaired punch · Missing attendance day · Device failure · Shift inferred · Geofence breach · Duplicate punch · Punch outside roster · Late beyond allowance |
| PL_EXEMPTION_SECTION | Tax exemption section | System | 8 | 10(5) LTA · 10(13A) HRA · 10(14) special allowance · 16(ia) standard deduction · 16(ii) entertainment · 16(iii) professional tax · 17(2) perquisite · Not exempt |
| PL_EXIT_REASON | Exit reason category | Config | 12 | Better opportunity · Compensation · Career growth · Relocation · Higher studies · Personal / family · Health · Work environment · Manager relationship · Performance · Disciplinary · Not disclosed |
| PL_EXIT_TYPE | Exit type | System | 7 | Resignation · Termination · Retirement · Contract end · Abandonment · Death in service · Redundancy |
| PL_FIELD_OWNER | Field owner | System | 2 | Nucleus · ERP |
| PL_FITNESS_STATUS | Medical fitness status | System | 4 | Fit · Fit with restriction · Unfit · Pending |
| PL_FLAG_DISPOSITION | Audit flag disposition | System | 3 | Resolve · Waive · Escalate |
| PL_FREQUENCY | Frequency | System | 5 | Monthly · Quarterly · Half-yearly · Annual · Event-based |
| PL_GATE_PASS_TYPE | Gate pass type | Config | 2 | Personal · Official |
| PL_GENDER | Gender | System | 4 | Male · Female · Other · Prefer not to say |
| PL_GEOFENCE_RESULT | Geofence result | System | 3 | Inside · Outside · Unavailable |
| PL_HALF_DAY_SESSION | Half day session | System | 2 | First half · Second half |
| PL_INTERVIEW_MODE | Interview mode | System | 3 | In person · Video · Telephone |
| PL_INTERVIEW_ROUND | Interview round | Config | 6 | Screening · Technical 1 · Technical 2 · Functional · HR · Final / leadership |
| PL_INTERVIEW_VERDICT | Interview verdict | System | 4 | Strong hire · Hire · Hold · No hire |
| PL_LANGUAGE | Language | Config | 14 | English · Hindi · Kannada · Tamil · Telugu · Malayalam · Marathi · Gujarati · Bengali · Odia · Punjabi · Assamese · Urdu · Other |
| PL_LEAVE_TYPE | Leave type | Config | 11 | Earned leave · Casual leave · Sick leave · Maternity leave · Paternity leave · Compensatory off · Leave without pay · Bereavement leave · Marriage leave · Birthday leave · Special leave |
| PL_LEAVE_UNIT | Leave unit | Config | 2 | Days · Hours |
| PL_LETTER_TYPE | Letter type | Config | 14 | Offer · Appointment · Confirmation · Salary revision · Promotion · Transfer · Warning · Show cause · Experience · Relieving · No objection certificate · Address proof · Bank introduction · Visa support |
| PL_LOAN_PURPOSE | Loan purpose | Config | 8 | Medical · Education · Housing · Marriage · Vehicle · Festival · Personal · Emergency |
| PL_LOCATION_TYPE | Location type | Config | 11 | Head office · Corporate office · Plant · Factory · Warehouse · Depot · Branch · Site · Project site · Retail outlet · Remote |
| PL_MARITAL_STATUS | Marital status | System | 5 | Single · Married · Widowed · Divorced · Separated |
| PL_MASTER_MODE | Master data mode | Config | 3 | Nucleus owns · ERP owns · Co-owned |
| PL_MATURITY_STATUS | Referral award maturity | System | 4 | Pending · Part matured · Fully matured · Forfeited |
| PL_MONTH | Month | System | 12 | January · February · March · April · May · June · July · August · September · October · November · December |
| PL_NATIONALITY | Nationality | System | 2 | Indian · (derived from the ISO 3166-1 country list) |
| PL_NOMINEE_SCHEME | Nominee scheme | System | 5 | Provident fund · Gratuity · Group insurance · Superannuation · ESI dependant |
| PL_OBLIGATION_STATUS | Obligation status | System | 5 | Open · In progress · Filed · Filed late · Not applicable |
| PL_OFFER_RESPONSE | Offer response | System | 5 | Pending · Accepted · Declined · Negotiating · Lapsed |
| PL_OT_BASIS | Overtime basis | Config | 2 | Gross minutes · Net minutes |
| PL_OT_ELIGIBILITY | Overtime eligibility | Config | 4 | Always · Rest day and holiday only · Beyond weekly hours only · None |
| PL_PAYMENT_MODE | Payment mode | Config | 6 | Bank transfer (NEFT) · Bank transfer (IMPS) · Bank transfer (RTGS) · Cheque · Cash · Demand draft |
| PL_PERSON_STATUS | Person record status | System | 5 | Draft · Active · Suspended · On notice · Exited |
| PL_POSITION_STATUS | Position status | System | 4 | Vacant · Filled · Frozen · Abolished |
| PL_PRINCIPAL_TYPE | Principal type | System | 3 | User · Service account · Agent |
| PL_PRIORITY | Priority | System | 4 | Low · Normal · High · Urgent |
| PL_PROOF_STATUS | Proof verification status | System | 4 | Pending · Accepted · Rejected · Partially accepted |
| PL_PRORATION_BASIS | Proration basis | Config | 3 | Calendar days · Payable days · Working days |
| PL_PUBLISH_STATUS | Roster publish status | System | 2 | Draft · Published |
| PL_PUNCH_DIRECTION | Punch direction | System | 2 | IN · OUT |
| PL_PUNCH_SOURCE | Punch source | System | 6 | Biometric device · Mobile app · Kiosk · business messaging · Web · Manual (regularised) |
| PL_RATING_SCALE | Rating scale | Config | 5 | Outstanding · Exceeds expectations · Meets expectations · Needs improvement · Unsatisfactory |
| PL_REFERRAL_RELATION | Referrer relationship | Config | 6 | Former colleague · Friend · Relative · Academic contact · Professional network · Other |
| PL_REGISTRATION_STATUS | Statutory registration status | System | 4 | Not required · Pending · Registered · Failed |
| PL_REGULARISATION_TYPE | Regularisation type | Config | 6 | Missing punch · Wrong shift applied · On duty · Work from home · Late waiver · Device failure |
| PL_REHIRE_ELIGIBILITY | Rehire eligibility | System | 3 | Yes · No · With approval |
| PL_REJECTION_REASON | Candidate rejection reason | Config | 9 | Skill mismatch · Experience mismatch · Compensation mismatch · Location constraint · Notice period · Failed assessment · Background check · Position closed · Other |
| PL_RELATION | Relationship | System | 14 | Spouse · Father · Mother · Son · Daughter · Brother · Sister · Father-in-law · Mother-in-law · Grandfather · Grandmother · Guardian · Friend · Other |
| PL_RELEASE_CHANNEL | Delivery channel | Config | 4 | Email · Employee portal · business messaging · Printed copy |
| PL_RELIGION | Religion | Config | 10 | Hindu · Muslim · Christian · Sikh · Buddhist · Jain · Parsi · Jewish · Other · Not disclosed |
| PL_REQUISITION_TYPE | Requisition type | System | 2 | Replacement · Addition |
| PL_REST_DAY_PATTERN | Rest day pattern | Config | 4 | Fixed weekly day · Two fixed days · Rotating · None |
| PL_REVISION_TYPE | Salary revision type | Config | 7 | Annual increment · Promotion · Market correction · Wage settlement · Data correction · Retention · Confirmation |
| PL_ROLE | Role | Config | 22 | Tenant admin · HR head · HR ops · HR business partner · Payroll manager · Payroll executive · Finance · Compliance owner · Compliance engineer · Implementation consultant · Plant HR · Supervisor · Manager · Employee · Security / gate · Admin / facilities · IT admin · Auditor (read only) · Director · Recruiter · Interviewer · Vendor coordinator |
| PL_ROUNDING | Rounding rule | Config | 4 | Nearest rupee · Round up · Round down · No rounding |
| PL_RUN_STATE | Payroll run state | System | 9 | Draft · Inputs locked · Calculated · Audited · Approved · Disbursement prepared · Disbursed · Posted to GL · Closed |
| PL_RUN_TYPE | Payroll run type | System | 6 | Regular · Off-cycle overtime · Arrears · Full and final · Bonus · Reimbursement |
| PL_SALUTATION | Salutation | Config | 7 | Mr. · Ms. · Mrs. · Dr. · Prof. · Shri · Smt. |
| PL_SANDWICH_RULE | Sandwich rule | Config | 4 | Exclude holidays and rest days · Include holidays · Include rest days · Include both |
| PL_SETTLEMENT_STATUS | Settlement status | System | 5 | Draft · Computed · Approved · Paid · Recovery pending |
| PL_SEVERITY | Severity | System | 3 | Critical · Warning · Info |
| PL_SOCIAL_CATEGORY | Social category | System | 6 | General · OBC · SC · ST · EWS · Not disclosed |
| PL_SOURCE_CHANNEL | Candidate source | Config | 9 | Employee referral · Job portal · Recruitment agency · Walk-in · Campus · Internal transfer · Social media · Direct application · Rehire |
| PL_STATE | Indian state / union territory | System | 36 | Andhra Pradesh · Arunachal Pradesh · Assam · Bihar · Chhattisgarh · Goa · Gujarat · Haryana · Himachal Pradesh · Jharkhand · Karnataka · Kerala · Madhya Pradesh · Maharashtra · Manipur · Meghalaya · Mizoram · Nagaland · Odisha · Punjab · Rajasthan · Sikkim · Tamil Nadu · Telangana · Tripura · Uttar Pradesh · Uttarakhand · West Bengal · Andaman & Nicobar Islands · Chandigarh · Dadra & Nagar Haveli and Daman & Diu · Delhi · Jammu & Kashmir · Ladakh · Lakshadweep · Puducherry |
| PL_SYNC_FREQUENCY | Sync frequency | Config | 4 | Real time · Hourly · Daily · On demand |
| PL_TASK_STATUS | Task status | System | 5 | Open · In progress · Done · Waived · Overdue |
| PL_TAX_REGIME | Tax regime | System | 2 | Old regime · New regime |
| PL_TEST_RESULT | Compliance test result | System | 2 | Pass · Fail |
| PL_TICKET_CATEGORY | Helpdesk category | Config | 12 | Payroll · Attendance · Leave · Documents · Statutory / PF / ESI · IT · Facilities · Transport · Canteen · Policy query · Grievance · Other |
| PL_TICKET_STATUS | Ticket status | System | 6 | Open · In progress · Awaiting employee · Resolved · Closed · Reopened |
| PL_TIMEZONE | Time zone | System | 2 | Asia/Kolkata · (full IANA tz database seeded at install) |
| PL_UNMATCHED_ACTION | Unmatched record action | Config | 3 | Hold · Create · Reject |
| PL_VARIANCE_ACTION | Invoice variance action | System | 3 | Accept · Query · Reduce |
| PL_VERIFICATION_STATUS | Verification status | System | 3 | Pending · Verified · Rejected |
| PL_WAGE_TYPE | Wage type | Config | 6 | Monthly · Daily · Hourly · Piece rate · Stipend · Retainer |
| PL_WEEKDAY | Day of week | System | 7 | Monday · Tuesday · Wednesday · Thursday · Friday · Saturday · Sunday |
| PL_WORKER_CLASS | Worker class | Config | 9 | Staff — monthly · Staff — probation · Workman — permanent · Workman — badli / substitute · Workman — temporary · Contract labour · Apprentice · Trainee · Retainer / consultant |

## 2. Picklist seed values (pilot tenant)

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACCOMMODATION | Accommodation type | Config | 5 | Own · Rented · Company provided · Parental · Hostel |
| PL_ACCOUNT_TYPE | Bank account type | System | 5 | Savings · Current · Salary · NRE · NRO |
| PL_ACCRUAL_DAY | Accrual timing | Config | 2 | Period start · Period end |
| PL_ACCRUAL_METHOD | Accrual method | Config | 4 | Annual credit · Monthly accrual · Per days worked · No accrual (entitlement based) |
| PL_ACTIVE_STATUS | Record status | System | 2 | Active · Inactive |
| PL_ANNOUNCEMENT_CHANNEL | Announcement channel | Config | 5 | Employee portal · Mobile push · Email · business messaging · Notice board display |
| PL_ANNOUNCEMENT_TYPE | Announcement type | Config | 5 | General · Policy · Emergency · Celebration · Statutory notice |
| PL_APPROVAL_STATUS | Approval status | System | 5 | Draft · Pending approval · Approved · Rejected · Withdrawn |
| PL_ASSET_CONDITION | Asset condition at issue | System | 3 | New · Good · Fair |
| PL_ASSET_RETURN_CONDITION | Asset condition at return | System | 4 | Good · Damaged · Lost · Not returned |
| PL_ASSET_TYPE | Asset type | Config | 12 | Laptop · Desktop · Mobile phone · SIM card · Access card · Vehicle · Tool kit · Safety equipment · Uniform · Footwear · Locker key · Other |
| PL_ASSIGNMENT_CHANGE | Assignment change type | Config | 10 | New hire · Promotion · Transfer — location · Transfer — org unit · Redesignation · Worker class change · Manager change · Payroll group change · Data correction · Rehire |
| PL_ATTENDANCE_MODE | Attendance capture mode | Config | 6 | Biometric device · Mobile app · Kiosk · business messaging · Web · Exempt |
| PL_ATTENDANCE_STATUS | Attendance day status | System | 9 | Present · Half day · Absent · Weekly off · Holiday · On leave · On duty · Work from home · Not scheduled |
| PL_AUTH_METHOD | Authentication method | Config | 5 | SSO (SAML) · SSO (OIDC) · Password · OTP · Biometric (device) |
| PL_AWARD_CATEGORY | Recognition category | Config | 8 | Star performer · Safety champion · Quality champion · Innovation · Long service · Team award · Customer delight · Spot award |
| PL_BANK_FORMAT | Bank file format | Config | 8 | HDFC ENet · ICICI CIB · SBI CINB · Axis Corporate · Kotak FYN · Yes Bank · NPCI NACH · Generic CSV |
| PL_BLOOD_GROUP | Blood group | System | 9 | A+ · A- · B+ · B- · AB+ · AB- · O+ · O- · Not known |
| PL_CALC_METHOD | Calculation method | Config | 6 | Fixed amount · Percentage of component · Formula · Slab table · Attendance driven · Rate x quantity |
| PL_CANDIDATE_STAGE | Candidate stage | Config | 11 | Applied · Screened · Interview scheduled · Interview complete · Selected · Offered · Offer accepted · Joined · Rejected · Withdrawn · On hold |
| PL_CAP_STATUS | Statutory cap status | System | 3 | Within limit · Approaching limit · Breach |
| PL_CLAIM_TYPE | Reimbursement claim type | Config | 9 | Fuel / conveyance · Telephone / internet · Medical · Books and periodicals · Travel · Relocation · Professional development · Meal · Other |
| PL_CLEARANCE_ITEM_STATUS | Clearance item status | System | 3 | Open · Cleared · Waived |
| PL_CLEARANCE_STATUS | Clearance status | System | 4 | Not started · In progress · Blocked · Cleared |
| PL_COMPONENT_TYPE | Pay component type | Config | 5 | Earning · Deduction · Employer contribution · Reimbursement · Information only |
| PL_CONFIRMATION_ACTION | Confirmation action | System | 3 | Confirm · Extend probation · Terminate |
| PL_CONFLICT_POLICY | Conflict policy | Config | 3 | Owner wins · Hold for review · Latest wins |
| PL_COUNTRY | Country | System | 2 | India · (full ISO 3166-1 list seeded at install) |
| PL_CURRENCY | Currency | System | 7 | INR · USD · EUR · GBP · AED · SGD · (full ISO 4217 list seeded at install) |
| PL_DAY_TYPE | Day type | System | 4 | Working day · Weekly off / rest day · Holiday · National holiday |
| PL_DECISION | Approval decision | System | 4 | Approve · Reject · Return for correction · Delegate |
| PL_DECLARATION_STATUS | Declaration status | System | 5 | Draft · Submitted · Proof pending · Verified · Partially verified |
| PL_DECLINE_REASON | Offer decline reason | Config | 8 | Compensation · Counter offer accepted · Role mismatch · Location · Joining date · Family reasons · Other offer · Not disclosed |
| PL_DISABILITY_TYPE | Disability type | System | 7 | Locomotor · Visual · Hearing · Speech · Intellectual · Multiple · Other |
| PL_DOCUMENT_CLASS | Document class | Config | 17 | Aadhaar · PAN · Passport · Driving licence · Voter ID · Bank proof · Educational certificate · Experience letter · Relieving letter · Payslip (previous employer) · Medical fitness certificate · Disability certificate · Photograph · Signature · Police verification · Contract / agreement · Other |
| PL_EDUCATION_LEVEL | Qualification level | Config | 9 | Below 10th · 10th / SSLC · 12th / PUC · ITI · Diploma · Graduate · Post graduate · Doctorate · Professional certification |
| PL_EMPLOYMENT_TYPE | Employment type | Config | 10 | Permanent · Probation · Fixed term contract · Trainee · Apprentice (NAPS/NATS) · Intern · Retainer · Consultant · Contract (through vendor) · Part time |
| PL_ENCASHMENT_BASIS | Encashment rate basis | Config | 3 | Basic · Basic + DA · Gross |
| PL_ENTITY_TYPE | Legal entity type | Config | 8 | Private Limited · Public Limited · LLP · Partnership · Proprietorship · Society · Trust · Branch Office |
| PL_ERP_SYSTEM | ERP system | Config | 6 | Cloud ERP · On-premise ERP · Accounting package · Custom / file based |
| PL_ESTB_TYPE | Establishment type | Config | 8 | Factory · Shops & Establishment · Mine · Plantation · Motor Transport · Construction · Beedi & Cigar · Contract Establishment |
| PL_EXCEPTION_ACTION | Exception resolution action | System | 4 | Accept proposal · Amend · Reject · Escalate |
| PL_EXCEPTION_TYPE | Attendance exception type | System | 8 | Unpaired punch · Missing attendance day · Device failure · Shift inferred · Geofence breach · Duplicate punch · Punch outside roster · Late beyond allowance |
| PL_EXEMPTION_SECTION | Tax exemption section | System | 8 | 10(5) LTA · 10(13A) HRA · 10(14) special allowance · 16(ia) standard deduction · 16(ii) entertainment · 16(iii) professional tax · 17(2) perquisite · Not exempt |
| PL_EXIT_REASON | Exit reason category | Config | 12 | Better opportunity · Compensation · Career growth · Relocation · Higher studies · Personal / family · Health · Work environment · Manager relationship · Performance · Disciplinary · Not disclosed |
| PL_EXIT_TYPE | Exit type | System | 7 | Resignation · Termination · Retirement · Contract end · Abandonment · Death in service · Redundancy |
| PL_FIELD_OWNER | Field owner | System | 2 | Nucleus · ERP |
| PL_FITNESS_STATUS | Medical fitness status | System | 4 | Fit · Fit with restriction · Unfit · Pending |
| PL_FLAG_DISPOSITION | Audit flag disposition | System | 3 | Resolve · Waive · Escalate |
| PL_FREQUENCY | Frequency | System | 5 | Monthly · Quarterly · Half-yearly · Annual · Event-based |
| PL_GATE_PASS_TYPE | Gate pass type | Config | 2 | Personal · Official |
| PL_GENDER | Gender | System | 4 | Male · Female · Other · Prefer not to say |
| PL_GEOFENCE_RESULT | Geofence result | System | 3 | Inside · Outside · Unavailable |
| PL_HALF_DAY_SESSION | Half day session | System | 2 | First half · Second half |
| PL_INTERVIEW_MODE | Interview mode | System | 3 | In person · Video · Telephone |
| PL_INTERVIEW_ROUND | Interview round | Config | 6 | Screening · Technical 1 · Technical 2 · Functional · HR · Final / leadership |
| PL_INTERVIEW_VERDICT | Interview verdict | System | 4 | Strong hire · Hire · Hold · No hire |
| PL_LANGUAGE | Language | Config | 14 | English · Hindi · Kannada · Tamil · Telugu · Malayalam · Marathi · Gujarati · Bengali · Odia · Punjabi · Assamese · Urdu · Other |
| PL_LEAVE_TYPE | Leave type | Config | 11 | Earned leave · Casual leave · Sick leave · Maternity leave · Paternity leave · Compensatory off · Leave without pay · Bereavement leave · Marriage leave · Birthday leave · Special leave |
| PL_LEAVE_UNIT | Leave unit | Config | 2 | Days · Hours |
| PL_LETTER_TYPE | Letter type | Config | 14 | Offer · Appointment · Confirmation · Salary revision · Promotion · Transfer · Warning · Show cause · Experience · Relieving · No objection certificate · Address proof · Bank introduction · Visa support |
| PL_LOAN_PURPOSE | Loan purpose | Config | 8 | Medical · Education · Housing · Marriage · Vehicle · Festival · Personal · Emergency |
| PL_LOCATION_TYPE | Location type | Config | 11 | Head office · Corporate office · Plant · Factory · Warehouse · Depot · Branch · Site · Project site · Retail outlet · Remote |
| PL_MARITAL_STATUS | Marital status | System | 5 | Single · Married · Widowed · Divorced · Separated |
| PL_MASTER_MODE | Master data mode | Config | 3 | Nucleus owns · ERP owns · Co-owned |
| PL_MATURITY_STATUS | Referral award maturity | System | 4 | Pending · Part matured · Fully matured · Forfeited |
| PL_MONTH | Month | System | 12 | January · February · March · April · May · June · July · August · September · October · November · December |
| PL_NATIONALITY | Nationality | System | 2 | Indian · (derived from the ISO 3166-1 country list) |
| PL_NOMINEE_SCHEME | Nominee scheme | System | 5 | Provident fund · Gratuity · Group insurance · Superannuation · ESI dependant |
| PL_OBLIGATION_STATUS | Obligation status | System | 5 | Open · In progress · Filed · Filed late · Not applicable |
| PL_OFFER_RESPONSE | Offer response | System | 5 | Pending · Accepted · Declined · Negotiating · Lapsed |
| PL_OT_BASIS | Overtime basis | Config | 2 | Gross minutes · Net minutes |
| PL_OT_ELIGIBILITY | Overtime eligibility | Config | 4 | Always · Rest day and holiday only · Beyond weekly hours only · None |
| PL_PAYMENT_MODE | Payment mode | Config | 6 | Bank transfer (NEFT) · Bank transfer (IMPS) · Bank transfer (RTGS) · Cheque · Cash · Demand draft |
| PL_PERSON_STATUS | Person record status | System | 5 | Draft · Active · Suspended · On notice · Exited |
| PL_POSITION_STATUS | Position status | System | 4 | Vacant · Filled · Frozen · Abolished |
| PL_PRINCIPAL_TYPE | Principal type | System | 3 | User · Service account · Agent |
| PL_PRIORITY | Priority | System | 4 | Low · Normal · High · Urgent |
| PL_PROOF_STATUS | Proof verification status | System | 4 | Pending · Accepted · Rejected · Partially accepted |
| PL_PRORATION_BASIS | Proration basis | Config | 3 | Calendar days · Payable days · Working days |
| PL_PUBLISH_STATUS | Roster publish status | System | 2 | Draft · Published |
| PL_PUNCH_DIRECTION | Punch direction | System | 2 | IN · OUT |
| PL_PUNCH_SOURCE | Punch source | System | 6 | Biometric device · Mobile app · Kiosk · business messaging · Web · Manual (regularised) |
| PL_RATING_SCALE | Rating scale | Config | 5 | Outstanding · Exceeds expectations · Meets expectations · Needs improvement · Unsatisfactory |
| PL_REFERRAL_RELATION | Referrer relationship | Config | 6 | Former colleague · Friend · Relative · Academic contact · Professional network · Other |
| PL_REGISTRATION_STATUS | Statutory registration status | System | 4 | Not required · Pending · Registered · Failed |
| PL_REGULARISATION_TYPE | Regularisation type | Config | 6 | Missing punch · Wrong shift applied · On duty · Work from home · Late waiver · Device failure |
| PL_REHIRE_ELIGIBILITY | Rehire eligibility | System | 3 | Yes · No · With approval |
| PL_REJECTION_REASON | Candidate rejection reason | Config | 9 | Skill mismatch · Experience mismatch · Compensation mismatch · Location constraint · Notice period · Failed assessment · Background check · Position closed · Other |
| PL_RELATION | Relationship | System | 14 | Spouse · Father · Mother · Son · Daughter · Brother · Sister · Father-in-law · Mother-in-law · Grandfather · Grandmother · Guardian · Friend · Other |
| PL_RELEASE_CHANNEL | Delivery channel | Config | 4 | Email · Employee portal · business messaging · Printed copy |
| PL_RELIGION | Religion | Config | 10 | Hindu · Muslim · Christian · Sikh · Buddhist · Jain · Parsi · Jewish · Other · Not disclosed |
| PL_REQUISITION_TYPE | Requisition type | System | 2 | Replacement · Addition |
| PL_REST_DAY_PATTERN | Rest day pattern | Config | 4 | Fixed weekly day · Two fixed days · Rotating · None |
| PL_REVISION_TYPE | Salary revision type | Config | 7 | Annual increment · Promotion · Market correction · Wage settlement · Data correction · Retention · Confirmation |
| PL_ROLE | Role | Config | 22 | Tenant admin · HR head · HR ops · HR business partner · Payroll manager · Payroll executive · Finance · Compliance owner · Compliance engineer · Implementation consultant · Plant HR · Supervisor · Manager · Employee · Security / gate · Admin / facilities · IT admin · Auditor (read only) · Director · Recruiter · Interviewer · Vendor coordinator |
| PL_ROUNDING | Rounding rule | Config | 4 | Nearest rupee · Round up · Round down · No rounding |
| PL_RUN_STATE | Payroll run state | System | 9 | Draft · Inputs locked · Calculated · Audited · Approved · Disbursement prepared · Disbursed · Posted to GL · Closed |
| PL_RUN_TYPE | Payroll run type | System | 6 | Regular · Off-cycle overtime · Arrears · Full and final · Bonus · Reimbursement |
| PL_SALUTATION | Salutation | Config | 7 | Mr. · Ms. · Mrs. · Dr. · Prof. · Shri · Smt. |
| PL_SANDWICH_RULE | Sandwich rule | Config | 4 | Exclude holidays and rest days · Include holidays · Include rest days · Include both |
| PL_SETTLEMENT_STATUS | Settlement status | System | 5 | Draft · Computed · Approved · Paid · Recovery pending |
| PL_SEVERITY | Severity | System | 3 | Critical · Warning · Info |
| PL_SOCIAL_CATEGORY | Social category | System | 6 | General · OBC · SC · ST · EWS · Not disclosed |
| PL_SOURCE_CHANNEL | Candidate source | Config | 9 | Employee referral · Job portal · Recruitment agency · Walk-in · Campus · Internal transfer · Social media · Direct application · Rehire |
| PL_STATE | Indian state / union territory | System | 36 | Andhra Pradesh · Arunachal Pradesh · Assam · Bihar · Chhattisgarh · Goa · Gujarat · Haryana · Himachal Pradesh · Jharkhand · Karnataka · Kerala · Madhya Pradesh · Maharashtra · Manipur · Meghalaya · Mizoram · Nagaland · Odisha · Punjab · Rajasthan · Sikkim · Tamil Nadu · Telangana · Tripura · Uttar Pradesh · Uttarakhand · West Bengal · Andaman & Nicobar Islands · Chandigarh · Dadra & Nagar Haveli and Daman & Diu · Delhi · Jammu & Kashmir · Ladakh · Lakshadweep · Puducherry |
| PL_SYNC_FREQUENCY | Sync frequency | Config | 4 | Real time · Hourly · Daily · On demand |
| PL_TASK_STATUS | Task status | System | 5 | Open · In progress · Done · Waived · Overdue |
| PL_TAX_REGIME | Tax regime | System | 2 | Old regime · New regime |
| PL_TEST_RESULT | Compliance test result | System | 2 | Pass · Fail |
| PL_TICKET_CATEGORY | Helpdesk category | Config | 12 | Payroll · Attendance · Leave · Documents · Statutory / PF / ESI · IT · Facilities · Transport · Canteen · Policy query · Grievance · Other |
| PL_TICKET_STATUS | Ticket status | System | 6 | Open · In progress · Awaiting employee · Resolved · Closed · Reopened |
| PL_TIMEZONE | Time zone | System | 2 | Asia/Kolkata · (full IANA tz database seeded at install) |
| PL_UNMATCHED_ACTION | Unmatched record action | Config | 3 | Hold · Create · Reject |
| PL_VARIANCE_ACTION | Invoice variance action | System | 3 | Accept · Query · Reduce |
| PL_VERIFICATION_STATUS | Verification status | System | 3 | Pending · Verified · Rejected |
| PL_WAGE_TYPE | Wage type | Config | 6 | Monthly · Daily · Hourly · Piece rate · Stipend · Retainer |
| PL_WEEKDAY | Day of week | System | 7 | Monday · Tuesday · Wednesday · Thursday · Friday · Saturday · Sunday |
| PL_WORKER_CLASS | Worker class | Config | 9 | Staff — monthly · Staff — probation · Workman — permanent · Workman — badli / substitute · Workman — temporary · Contract labour · Apprentice · Trainee · Retainer / consultant |

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
| Size | 238 | specified items (table rows) | Counted automatically at generation |
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
