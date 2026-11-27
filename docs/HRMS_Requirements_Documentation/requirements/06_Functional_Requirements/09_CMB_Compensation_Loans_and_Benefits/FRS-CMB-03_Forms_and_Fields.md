<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMB-03 — Compensation, Loans & Benefits — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMB-03 |
| Title | Compensation, Loans & Benefits — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compensation, Loans & Benefits |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-CMB-00, FRS-CMB-01, FRS-CMB-02, FRS-CMB-03, FRS-CMB-04, FRS-CMB-05, FRS-CMB-06, FRS-CMB-07, FRS-CMB-08, FRS-CMB-09, FRS-CMB-10, FRS-CMB-11, FRS-CMB-12, FRS-CMB-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-05 · R-10 · processes CMB-01–CMB-06 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-CMB-01 | Loan Application | SCR-080 | Employee, HR, Finance | 22 | Payroll & Finance > Payroll & finance operations > Loans and advances (SCR-080) | loans_advances | /api/v1/loans |
| FRM-CMB-02 | Salary Advance Request | SCR-081 | Employee | 8 | Payroll & Finance > Payroll & finance operations > Salary advance request (SCR-081) | salary_advance | /api/v1/ops/modules/salary_advance/records |

## 2. Field specifications

### FRM-CMB-01 — Loan Application (SCR-080)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Eligibility | Eligible / ceiling / reasons | eligibility_panel | Panel (derived) | Composite | — | Computed | — | — | Self, HR, Finance | Reasons shown verbatim; the same method the payroll node calls |
| Eligibility | Service completed | service_years | Number (derived) | Dec(4,2) | — | Computed | — | — | Self | Drives the 4x or 6x basic ceiling |
| Eligibility | Existing loan outstanding | existing_outstanding | Money (derived) | Dec(12,2) | — | From the loan ledger | — | — | Self, Finance | Reduces the ceiling |
| Application | Purpose | purpose | Select | Char(30) | Y | — | Configured purpose list | PL_LOAN_PURPOSE | Self | Medical, education, housing, marriage, vehicle, personal |
| Application | Principal requested | principal | Money | Dec(12,2) | Y | — | Within the ceiling unless an override is requested | — | Self | — |
| Application | Tenure (months) | tenure_months | Number | Int | Y | — | Within the configured minimum and maximum | — | Self | — |
| Application | Interest rate | interest_rate | Number (derived) | Dec(5,2) | Y | From the purpose configuration | — | — | Self, Finance | Concessional rates create a taxable perquisite |
| Application | Instalment | instalment_amount | Money (derived) | Dec(10,2) | Y | Computed | Instalment must not breach the net-pay floor | — | Self | Breach blocks submission with the floor named |
| Application | Repayment start month | repayment_start | Date | Date | Y | Next payroll period | Not before disbursement | — | Self, Payroll | — |
| Application | Supporting document | purpose_document_ref | File | Ref | Y for medical and education | — | PDF/JPG, max 5 MB | — | Self, HR | — |
| Guarantors | Guarantor 1 | guarantor_1_person_id | Lookup | Ref | Y | — | Must pass the same eligibility check | — | Self | Each accepts explicitly; no implied consent |
| Guarantors | Guarantor 2 | guarantor_2_person_id | Lookup | Ref | Y | — | Must differ from guarantor 1 | — | Self | — |
| Guarantors | Guarantor 3 | guarantor_3_person_id | Lookup | Ref | Y above the configured threshold | — | — | — | Self | — |
| Guarantors | Guarantor acceptance | guarantor_accepted, accepted_on | Toggle + timestamp | Mixed | Y | Off | Each guarantor accepts on their own login | — | Guarantor | Released explicitly on full repayment |
| Sanction | Sanctioned amount | sanctioned_amount | Money | Dec(12,2) | Y | Same as requested | Cannot exceed the ceiling without a waiver | — | Finance | — |
| Sanction | Special terms | special_terms | Text | Char(300) | N | — | Director role only | — | Director | — |
| Sanction | Rules waived | rules_waived[] | Multi-select | Char[] | N | — | Director role only; reason mandatory | — | Director | The waived rules are named, not implied |
| Sanction | Waiver reason | waiver_reason | Text | Char(300) | Y when waiving | — | Min 20 chars | — | Director | — |
| Disbursement | Disbursement mode / date | disbursement_mode, disbursement_date | Mixed | Mixed | Y | Bank transfer, next run | — | PL_PAYMENT_MODE | Finance | — |
| Schedule | Amortisation schedule | repayment_schedule[] | Table (derived) | Composite | Y | Computed | — | — | Self, Finance | Regenerated on part-payment or moratorium |
| Schedule | Moratorium months | moratorium_months | Number | Int | N | 0 | 0-6 | — | Finance | Interest accrual behaviour stated on the schedule |
| Schedule | Part payment | part_payment_amount, part_payment_date | Mixed | Mixed | N | — | >= one instalment | — | Self, Finance | Schedule regenerated, not patched |

### FRM-CMB-02 — Salary Advance Request (SCR-081)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Request | Advance amount | amount | Money | Dec(10,2) | Y | — | Within the earned-to-date ceiling | — | Self | Structurally an advance recovered in the same or next run |
| Request | Reason | reason | Text | Char(200) | Y | — | Min 10 chars | — | Self | — |
| Request | Recovery month | recovery_period | Select | Char(7) | Y | Current period | Current or next period only | — | Self, Payroll | — |
| Request | Number of instalments | instalments | Number | Int | Y | 1 | 1-3 | — | Self, Payroll | — |
| Context | Earned to date this period | earned_to_date | Panel (derived) | Dec(10,2) | — | From attendance and structure | — | — | Self | The ceiling for earned wage access |
| Context | Advances taken this year | advances_ytd | Panel (derived) | Int | — | Computed | Annual instance cap enforced | — | Self | — |
| Approval | Approver / decision / remarks | approver_id, decision, decision_remarks | Mixed | Mixed | Y | Reporting manager then Finance | Reason mandatory on reject | PL_DECISION | Approver | — |
| Payroll | Disbursement run / recovery run | disbursement_run_id, recovery_run_id | Lookup | Ref | Y | — | Open runs | — | Payroll | Unrecovered advances block full and final |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_DECISION | Approval decision | System | 4 | Approve · Reject · Return for correction · Delegate |
| PL_LOAN_PURPOSE | Loan purpose | Config | 8 | Medical · Education · Housing · Marriage · Vehicle · Festival · Personal · Emergency |
| PL_PAYMENT_MODE | Payment mode | Config | 6 | Bank transfer (NEFT) · Bank transfer (IMPS) · Bank transfer (RTGS) · Cheque · Cash · Demand draft |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-LON-01 | Loan Application | LON | Transaction form | R-10 | Eligibility, ceiling, guarantors and the Director override, all checked before submission rather than at disbursement. | N | Loan agreement | 10 |
| F-LON-02 | Guarantor Register | LON | Enquiry | R-10 | Who stands guarantor for whom, and therefore who is blocked from borrowing or guaranteeing again. | N | Guarantor register | 3 |
| F-LON-03 | Salary Advance | LON | Transaction form | R-10 | Blocked while a loan is outstanding, by the same eligibility service the loan uses. | N | Advance voucher | 1 |

#### F-LON-01 — Loan Application

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Eligibility | Outstanding loan exists | has_outstanding_loan | Read-only | Bool | Y | — | Where Y, the application is blocked. Cleared only on full repayment. | — | All roles | No — system derived | R-10 |
| Header | Eligibility | Is guarantor elsewhere | is_guarantor_elsewhere | Read-only | Bool | Y | — | Where Y, the applicant cannot borrow and cannot be named a guarantor again | — | All roles | No — system derived | R-10 |
| Header | Eligibility | Basic salary | basic_salary | Read-only | Dec(18,2) | Y | From the salary structure | — | — | Payroll and HR roles only | No — system derived | R-10 |
| Header | Eligibility | Eligible multiple | eligible_multiple | Read-only | Dec(4,2) | Y | 4.00 | Four times basic, or six where continuous_service_years is five or more | — | All roles | Yes — the multiples are policy values | R-10 |
| Header | Eligibility | Maximum eligible amount | max_eligible_amount | Read-only | Dec(18,2) | Y | Basic salary times eligible multiple | The requested amount may not exceed this without a Director override | — | Payroll and HR roles only | No — system derived | R-10 |
| Header | Guarantors | Guarantor 1 | guarantor_1_employee_code | Lookup | Ref | Y | — | Must not have an outstanding loan and must not already be a guarantor | — | All roles | No — system derived | R-10 |
| Header | Guarantors | Guarantor 2 | guarantor_2_employee_code | Lookup | Ref | Y | — | Same checks as guarantor 1, and must differ from guarantor 1 | — | All roles | No — system derived | R-10 |
| Header | Guarantors | Guarantor 3 | guarantor_3_employee_code | Lookup | Ref | Y when the amount exceeds the third-guarantor threshold | — | The source makes the third guarantor conditional on a higher loan amount but does not give the threshold — see the open questions | — | All roles | Yes | R-10 |
| Header | Override | Special terms applied | special_terms_applied | Toggle | Bool | Y | N | Where Y, a Director approval record is mandatory and the eligibility block is bypassed with the reason stored | — | HR roles only | Yes | R-10 |
| Header | Override | Director approval reference | director_approval_ref | Read-only | Ref | Y when special_terms_applied is Y | — | A recorded approval, not a free-text note or a direct edit | — | HR roles only | No — system derived | R-10 |

#### F-LON-02 — Guarantor Register

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Line | Register | Guarantor employee code | guarantor_employee_code | Lookup | Ref | Y | — | — | — | HR roles only | No — system derived | R-10 |
| Line | Register | Borrower employee code | borrower_employee_code | Lookup | Ref | Y | — | — | — | HR roles only | No — system derived | R-10 |
| Line | Register | Guarantee status | guarantee_status | Select (derived) | Char(20) | Y | Active | Active or Released. Released only when the guaranteed loan is fully repaid, which is what frees the guarantor. | EN_GUARANTEE_STATUS | HR roles only | Yes — value set configurable per tenant | R-10 |

#### F-LON-03 — Salary Advance

| Level | Section | Field label | field_name | Control | Data type | Mandatory | Default | Validation | Enum | Visibility | Configurable | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Eligibility | Advance blocked by loan | advance_blocked_by_loan | Read-only | Bool | Y | — | Reads the same eligibility service as the loan application so the two cannot drift apart | — | All roles | No — system derived | R-10 |

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
| Size | 52 | specified items (table rows) | Counted automatically at generation |
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
