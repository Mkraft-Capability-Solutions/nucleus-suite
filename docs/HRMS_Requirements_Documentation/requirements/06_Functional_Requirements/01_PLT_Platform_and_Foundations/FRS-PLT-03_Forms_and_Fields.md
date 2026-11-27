<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-03 — Platform & Foundations — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-03 |
| Title | Platform & Foundations — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Platform & Foundations |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-PLT-01 | Legal Entity Master | SCR-001 | Tenant admin | 22 | Platform & Admin > People & lifecycle > Legal entity master (SCR-001) | legal_entity | /api/v1/organization/entities |
| FRM-PLT-02 | Location / Work Site Master | SCR-002 | Tenant admin | 20 | Platform & Admin > People & lifecycle > Location / Work site master (SCR-002) | location_master | /api/v1/organization/locations |
| FRM-PLT-03 | User, Role and Scope Grant | SCR-005 | Tenant admin | 16 | Core HR > People & lifecycle > Access scope administration (SCR-005) | access_scope | /api/v1/identity/memberships |

## 2. Field specifications

### FRM-PLT-01 — Legal Entity Master (SCR-001)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Entity | Entity code | entity_code | Text | Char(10) | Y | — | Unique; uppercase, no spaces | — | Tenant admin | Immutable after first payroll run |
| Entity | Registered name | registered_name | Text | Char(200) | Y | — | 2-200 chars | — | Tenant admin | As per incorporation certificate |
| Entity | Trade / brand name | trade_name | Text | Char(200) | N | — | — | — | Tenant admin | Prints on letters if set |
| Entity | Entity type | entity_type | Select | Char(20) | Y | Private Limited | From list | PL_ENTITY_TYPE | Tenant admin | Drives which statutory registrations appear |
| Entity | CIN / LLPIN | cin_llpin | Text | Char(21) | Y | — | 21 char CIN or 8 char LLPIN format | — | Tenant admin | Validated by format, not by MCA lookup |
| Entity | PAN | entity_pan | Text | Char(10) | Y | — | ABCDE1234F; 4th char must be C/F/A/T | — | Tenant admin | Used on Form 24Q |
| Entity | TAN | tan | Text | Char(10) | Y | — | ABCD12345E | — | Tenant admin | Mandatory before first TDS filing |
| Entity | GSTIN | gstin | Text | Char(15) | N | — | 15 char, state code must match address | — | Tenant admin | One per state of registration |
| Entity | PF establishment code | pf_code | Text | Char(22) | N | — | Region/Office/Estb/Extn format | — | Tenant admin | Blank = PF not applicable to this entity |
| Entity | ESI employer code | esi_code | Text | Char(17) | N | — | 17 digits | — | Tenant admin | — |
| Entity | PT registration no | pt_reg_no | Text | Char(30) | N | — | Per state format | — | Tenant admin | One per state where PT applies |
| Entity | LWF registration no | lwf_reg_no | Text | Char(30) | N | — | Per state format | — | Tenant admin | — |
| Entity | Shops & Establishment / Factory licence | establishment_licence | Text | Char(40) | N | — | — | — | Tenant admin | Drives which registers are generated |
| Entity | Establishment type | establishment_type | Select | Char(20) | Y | Factory | From list | PL_ESTB_TYPE | Tenant admin | Factory vs Shop changes the statutory form set |
| Address | Registered address | registered_address | Address block | Composite | Y | — | PIN validated against state master | — | Tenant admin | Prints on payslip and all statutory forms |
| Address | Communication address | comm_address | Address block | Composite | N | Same as registered | — | — | Tenant admin | — |
| Fiscal | Financial year start month | fy_start_month | Select | Char(3) | Y | April | From list | PL_MONTH | Tenant admin | Drives tax year and accrual year |
| Fiscal | Base currency | currency_code | Select | Char(3) | Y | INR | ISO 4217 | PL_CURRENCY | Tenant admin | Locked after first run |
| Fiscal | Signing authority | signatory_name | Text | Char(100) | Y | — | — | — | Tenant admin | Appears on Form 16 and letters |
| Fiscal | Signatory designation | signatory_designation | Text | Char(60) | Y | — | — | — | Tenant admin | — |
| Control | Status | entity_status | Select | Char(12) | Y | Active | From list | PL_ACTIVE_STATUS | Tenant admin | Inactive entity blocks new runs, keeps history |
| Control | Effective from | effective_from | Date | Date | Y | Today | Not before incorporation date | — | Tenant admin | Effective-dated record |

### FRM-PLT-02 — Location / Work Site Master (SCR-002)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Identity | Location code | location_code | Text | Char(10) | Y | — | Unique per tenant | — | Admin | Used on every attendance and payroll record |
| Identity | Location name | location_name | Text | Char(100) | Y | — | 2-100 chars | — | Admin | — |
| Identity | Legal entity | entity_code | Lookup | Ref | Y | — | Active entity | — | Admin | A location belongs to exactly one entity |
| Identity | Location type | location_type | Select | Char(20) | Y | Plant | From list | PL_LOCATION_TYPE | Admin | — |
| Identity | Parent location | parent_location | Lookup | Ref | N | — | No cycles | — | Admin | For plant-within-campus structures |
| Address | Address | address | Address block | Composite | Y | — | PIN must resolve to the selected state | — | Admin | PIN drives PT and LWF applicability |
| Address | State | state_code | Select | Char(2) | Y | — | From state master | PL_STATE | Admin | Drives the statutory rule pack applied |
| Address | District | district | Text | Char(60) | Y | — | — | — | Admin | Needed on several state registers |
| Config | Holiday calendar | calendar_id | Lookup | Ref | Y | — | Active calendar | — | Admin | Multi-plant sites do not share one calendar |
| Config | Shift group | shift_group | Lookup | Ref | Y | — | Active group | — | Admin | Shift inference operates only inside the group |
| Config | Week start day | week_start_day | Select | Char(3) | Y | Monday | From list | PL_WEEKDAY | Admin | Affects weekly OT and rest-day computation |
| Config | Geofence centre (lat, long) | geofence_point | Geo | Decimal(9,6) | N | — | Valid coordinates | — | Admin | Required if mobile punch is enabled |
| Config | Geofence radius (metres) | geofence_radius_m | Number | Int | N | 200 | 50-5000 | — | Admin | — |
| Config | Time zone | time_zone | Select | Char(40) | Y | Asia/Kolkata | IANA tz | PL_TIMEZONE | Admin | Punch timestamps stored UTC, displayed here |
| Statutory | PT state | pt_state | Select | Char(2) | N | From address state | — | PL_STATE | Admin | Overridable where work state differs |
| Statutory | LWF applicable | lwf_applicable | Toggle | Bool | Y | Derived from state | — | — | Admin | — |
| Statutory | ESI covered | esi_covered | Toggle | Bool | Y | Derived from PIN | — | — | Admin | Implementation may override with reason |
| Statutory | Factory licence no | factory_licence_no | Text | Char(40) | N | — | — | — | Admin | Drives Form registers for this site |
| Control | Status | status | Select | Char(12) | Y | Active | From list | PL_ACTIVE_STATUS | Admin | — |
| Control | Effective from | effective_from | Date | Date | Y | Today | — | — | Admin | — |

### FRM-PLT-03 — User, Role and Scope Grant (SCR-005)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Principal | Principal type | principal_type | Select | Char(10) | Y | User | user / service / agent | PL_PRINCIPAL_TYPE | Tenant admin | Agent principals must name a human owner |
| Principal | Linked employee | person_id | Lookup | Ref | N | — | Active assignment | — | Tenant admin | Blank for service accounts |
| Principal | Display name | display_name | Text | Char(100) | Y | From employee | — | — | Tenant admin | — |
| Principal | Login ID | login_id | Text | Char(60) | Y | Official email | Unique per tenant | — | Tenant admin | — |
| Principal | Owner (for agent / service) | owner_principal_id | Lookup | Ref | Y for agent/service | — | Must be a human user | — | Tenant admin | An unowned agent cannot be saved |
| Access | Authentication method | auth_method | Select | Char(20) | Y | SSO | From list | PL_AUTH_METHOD | Tenant admin | — |
| Access | MFA required | mfa_required | Toggle | Bool | Y | On | — | — | Tenant admin | Cannot be switched off for payroll roles |
| Roles | Role | role_code | Multi-select | Ref[] | Y | — | At least one active role | PL_ROLE | Tenant admin | RBAC gives shape, not data scope |
| Scope | Legal entity grant | entity_grant[] | Multi-select | Ref[] | Y | — | At least one entity | — | Tenant admin | — |
| Scope | Location grant | location_grant[] | Multi-select | Ref[] | Y | — | Locations inside granted entities | — | Tenant admin | This is what lets a plant user see only that plant |
| Scope | Can edit time at location | can_edit_time | Toggle | Bool | Y | Off | — | — | Tenant admin | Read vs write split on the same grant |
| Scope | Payroll group grant | payroll_group_grant[] | Multi-select | Ref[] | N | — | — | — | Tenant admin | Pay fields return NULL outside the grant |
| Scope | Reporting-line scope | include_reporting_line | Toggle | Bool | Y | On | — | — | Tenant admin | Evaluated at query time, never cached |
| Control | Valid from / to | grant_from, grant_to | Date range | Date | Y | Today / blank | From <= To | — | Tenant admin | Temporary grants expire automatically |
| Control | Delegation | delegate_to_principal | Lookup | Ref | N | — | Active principal; cannot chain twice | — | Tenant admin | For approvals during leave |
| Control | Status | status | Select | Char(12) | Y | Active | From list | PL_ACTIVE_STATUS | Tenant admin | Revoking keeps the audit trail |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACTIVE_STATUS | Record status | System | 2 | Active · Inactive |
| PL_AUTH_METHOD | Authentication method | Config | 5 | SSO (SAML) · SSO (OIDC) · Password · OTP · Biometric (device) |
| PL_CURRENCY | Currency | System | 7 | INR · USD · EUR · GBP · AED · SGD · (full ISO 4217 list seeded at install) |
| PL_ENTITY_TYPE | Legal entity type | Config | 8 | Private Limited · Public Limited · LLP · Partnership · Proprietorship · Society · Trust · Branch Office |
| PL_ESTB_TYPE | Establishment type | Config | 8 | Factory · Shops & Establishment · Mine · Plantation · Motor Transport · Construction · Beedi & Cigar · Contract Establishment |
| PL_LOCATION_TYPE | Location type | Config | 11 | Head office · Corporate office · Plant · Factory · Warehouse · Depot · Branch · Site · Project site · Retail outlet · Remote |
| PL_MONTH | Month | System | 12 | January · February · March · April · May · June · July · August · September · October · November · December |
| PL_PRINCIPAL_TYPE | Principal type | System | 3 | User · Service account · Agent |
| PL_ROLE | Role | Config | 22 | Tenant admin · HR head · HR ops · HR business partner · Payroll manager · Payroll executive · Finance · Compliance owner · Compliance engineer · Implementation consultant · Plant HR · Supervisor · Manager · Employee · Security / gate · Admin / facilities · IT admin · Auditor (read only) · Director · Recruiter · Interviewer · Vendor coordinator |
| PL_STATE | Indian state / union territory | System | 36 | Andhra Pradesh · Arunachal Pradesh · Assam · Bihar · Chhattisgarh · Goa · Gujarat · Haryana · Himachal Pradesh · Jharkhand · Karnataka · Kerala · Madhya Pradesh · Maharashtra · Manipur · Meghalaya · Mizoram · Nagaland · Odisha · Punjab · Rajasthan · Sikkim · Tamil Nadu · Telangana · Tripura · Uttar Pradesh · Uttarakhand · West Bengal · Andaman & Nicobar Islands · Chandigarh · Dadra & Nagar Haveli and Daman & Diu · Delhi · Jammu & Kashmir · Ladakh · Lakshadweep · Puducherry |
| PL_TIMEZONE | Time zone | System | 2 | Asia/Kolkata · (full IANA tz database seeded at install) |
| PL_WEEKDAY | Day of week | System | 7 | Monday · Tuesday · Wednesday · Thursday · Friday · Saturday · Sunday |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-SEC-01 | Role & Data Scope Setup | SEC | Configuration | R-09 | Which role sees salary and rate structure, and at which location. Applies to screens, reports, exports and the API alike. | N | Role matrix | 4 |

#### F-SEC-01 — Role & Data Scope Setup

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Line | Data scope | Role code | role_code | Lookup | Ref | Y | — | — | — | HR roles only | Yes | R-09 |
| Line | Data scope | Scope dimension | scope_dimension | Select | Char(30) | Y | Attendance location | Attendance location or Payroll processing location. The salary restriction is scoped on the payroll location. | EN_SCOPE_DIMENSION | HR roles only | Yes — value set configurable per tenant | R-09 |
| Line | Data scope | Can view salary structure | can_view_salary_structure | Toggle | Bool | Y | N | Must be enforced in the API and in exports, not only by hiding the screen | — | HR roles only | Yes | R-09 |
| Line | Data scope | Can view rate structure | can_view_rate_structure | Toggle | Bool | Y | N | Same enforcement as salary structure | — | HR roles only | Yes | R-09 |

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
| Size | 78 | specified items (table rows) | Counted automatically at generation |
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
