<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PAY-03 — Payroll — Forms and Fields

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PAY-03 |
| Title | Payroll — Forms and Fields |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Payroll |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-PAY-00, FRS-PAY-01, FRS-PAY-02, FRS-PAY-03, FRS-PAY-04, FRS-PAY-05, FRS-PAY-06, FRS-PAY-07, FRS-PAY-08, FRS-PAY-09, FRS-PAY-10, FRS-PAY-11, FRS-PAY-12, FRS-PAY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04 · processes PAY-01–PAY-14 |
| Source of record | Nucleus HRMS — Complete Forms & Fields Specification v1.0 — sheet(s) 01_Form_Index, 02_Field_Spec, 03_Picklists<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 03_Forms_and_Screens, 04_Field_Specification |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).

## 1. Form index

| Form ID | Form | Screen ID | Primary persona | Fields | Menu path | Target object | CRUD API endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FRM-PAY-01 | Pay Component Master | SCR-057 | Implementation, Payroll | 28 | Payroll & Finance > Payroll & finance operations > Pay component master (SCR-057) | pay_component_master | /api/v1/ops/modules/pay_component_master/records |
| FRM-PAY-02 | Salary Structure | SCR-052 | HR, Compensation | 25 | Core HR > Payroll & finance operations > Salary structure simulator (SCR-052) | salary_simulator | /api/v1/wage-simulations |
| FRM-PAY-03 | Payroll Run | SCR-050 | Payroll manager | 18 | Payroll & Finance > Payroll & finance operations > Payroll run cockpit (SCR-050) | payroll_runs | /api/v1/payroll-runs |
| FRM-PAY-04 | Pre-Payroll Audit Resolution | SCR-051 | Payroll manager | 8 | Payroll & Finance > Payroll & finance operations > Pre-payroll audit (SCR-051) | pre_payroll_audit | /api/v1/payroll-anomalies |
| FRM-PAY-05 | Investment Declaration and Tax | SCR-054 | Employee | 35 | Payroll & Finance > Payroll & finance operations > Tax declaration and projection (SCR-054) | tax_declarations | /api/v1/ops/modules/tax_declarations/records |
| FRM-PAY-06 | Reimbursement Claim | SCR-058 | Employee | 12 | Payroll & Finance > Payroll & finance operations > Reimbursement claim (SCR-058) | reimbursement_claim | /api/v1/ops/modules/reimbursement_claim/records |
| FRM-PAY-07 | Disbursement and Bank File | SCR-055 | Finance | 13 | Payroll & Finance > Payroll & finance operations > Bank disbursement control (SCR-055) | bank_disbursement | /api/v1/ops/modules/bank_disbursement/records |
| FRM-PAY-08 | Full and Final Settlement | SCR-056 | Payroll, HR | 18 | Payroll & Finance > Payroll & finance operations > Full and final settlement (SCR-056) | full_and_final | /api/v1/fnf-settlements |

## 2. Field specifications

### FRM-PAY-01 — Pay Component Master (SCR-057)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Component | Component code | component_code | Text | Char(15) | Y | — | Unique per tenant | — | Payroll | — |
| Component | Component name | name | Text | Char(60) | Y | — | — | — | All | Prints on the payslip |
| Component | Payslip label | payslip_label | Text | Char(40) | Y | Same as name | — | — | All | Local-language label where enabled |
| Component | Type | component_type | Select | Char(15) | Y | Earning | Earning / Deduction / Employer contribution / Reimbursement / Information | PL_COMPONENT_TYPE | Payroll | Information components print but do not affect net |
| Component | Calculation method | calc_method | Select | Char(20) | Y | Fixed | Fixed / Percentage / Formula / Slab / Attendance-driven | PL_CALC_METHOD | Payroll | — |
| Component | Percentage of | percent_of_component | Lookup | Ref | Y if percentage | — | Another component | — | Payroll | HRA as a percentage of basic, for example |
| Component | Percentage value | percent_value | Number | Dec(5,2) | Y if percentage | — | 0-100 | — | Payroll | — |
| Component | Formula | formula_expression | Text | Char(500) | Y if formula | — | Must reference only defined components | — | Payroll | Evaluated as a node in the gross-to-net graph |
| Component | Slab table | slab_table_ref | Lookup | Ref | Y if slab | — | Active slab table | — | Payroll | PT and TDS use slab tables |
| Component | Rounding | rounding_rule | Select | Char(15) | Y | Nearest rupee | Nearest / Up / Down / None | PL_ROUNDING | Payroll | Money stored as integer in the smallest unit |
| Component | Prorated on attendance | prorate_on_attendance | Toggle | Bool | Y | Yes | — | — | Payroll | Fixed allowances often do not prorate |
| Component | Proration basis | proration_basis | Select | Char(25) | Y if prorated | Calendar days | Calendar days / Payable days / Working days | PL_PRORATION_BASIS | Payroll | Choice changes February materially |
| Statutory | Part of PF wage | in_pf_wage | Toggle | Bool | Y | No | — | — | Payroll | Basic and DA by default |
| Statutory | Part of ESI wage | in_esi_wage | Toggle | Bool | Y | Yes | — | — | Payroll | — |
| Statutory | Part of gratuity wage | in_gratuity_wage | Toggle | Bool | Y | No | — | — | Payroll | — |
| Statutory | Part of bonus wage | in_bonus_wage | Toggle | Bool | Y | No | — | — | Payroll | — |
| Statutory | Counts toward the 50% wage floor | in_wage_floor_test | Toggle | Bool | Y | Yes | — | — | Payroll | Code on Wages basic-share test |
| Tax | Taxable | is_taxable | Toggle | Bool | Y | Yes | — | — | Payroll | — |
| Tax | Exemption section | exemption_section | Select | Char(15) | N | — | From list | PL_EXEMPTION_SECTION | Payroll | 10(13A), 10(14), 17(2) and so on |
| Tax | Exemption limit | exemption_limit | Money | Dec(10,2) | N | — | >= 0 | — | Payroll | Annual, monthly or per-instance as configured |
| Tax | Perquisite | is_perquisite | Toggle | Bool | Y | No | — | — | Payroll | Company accommodation and vehicle |
| GL | Debit account | gl_debit_account | Lookup | Ref | Y | — | Active in the chart of accounts | — | Finance | Unmapped components block run approval |
| GL | Credit account | gl_credit_account | Lookup | Ref | Y | — | Active in the chart of accounts | — | Finance | — |
| GL | Cost dimension | gl_dimensions[] | Multi-select | Char[] | Y | Cost centre | At least one | — | Finance | Split at employee level before aggregation |
| Control | Print on payslip when zero | print_when_zero | Toggle | Bool | Y | No | — | — | Payroll | — |
| Control | Sequence on payslip | display_sequence | Number | Int | Y | — | Unique within the type | — | Payroll | — |
| Control | Effective from | effective_from | Date | Date | Y | Today | — | — | Payroll | Changing a live component versions it |
| Control | Status | status | Select | Char(12) | Y | Active | — | PL_ACTIVE_STATUS | Payroll | — |

### FRM-PAY-02 — Salary Structure (SCR-052)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Employee | person_id | Lookup | Ref | Y | — | Active assignment | — | HR, Comp | — |
| Header | Effective from | effective_from | Date | Date | Y | Next month start | Backdating creates arrears, never a rewrite | — | HR, Comp | — |
| Header | Revision type | revision_type | Select | Char(25) | Y | — | Annual increment / Promotion / Correction / Market / Settlement | PL_REVISION_TYPE | HR, Comp | — |
| Header | Revision reason | revision_reason | Text | Char(300) | Y | — | Min 10 chars | — | HR, Comp | — |
| Header | CTC (annual) | annual_ctc | Money | Dec(12,2) | Y | — | >= statutory minimum wage for the state and skill | — | HR, Comp, self | Entry point: structure derives downward from CTC |
| Earnings | Basic | basic | Money | Dec(10,2) | Y | Per the structure template | Must satisfy the 50% wage floor test | — | HR, Comp, self | Floor test failure blocks save with the shortfall named |
| Earnings | Dearness allowance | da | Money | Dec(10,2) | N | From settlement or index | — | — | HR, Comp, self | Index-linked where a wage settlement applies |
| Earnings | House rent allowance | hra | Money | Dec(10,2) | N | Percentage of basic | — | — | HR, Comp, self | Metro and non-metro percentages differ |
| Earnings | Conveyance allowance | conveyance | Money | Dec(10,2) | N | — | — | — | HR, Comp, self | — |
| Earnings | Special allowance | special_allowance | Money | Dec(10,2) | N | Balancing figure | Cannot be negative | — | HR, Comp, self | Absorbs the residual after the floor test |
| Earnings | Other fixed allowances | other_allowances[] | Table | Composite | N | — | Component must be active | — | HR, Comp, self | Repeating: component, amount, taxability |
| Earnings | Gross (monthly) | gross_monthly | Money (derived) | Dec(10,2) | — | Sum of earnings | — | — | HR, Comp, self | Read-only |
| Employer cost | Employer PF | employer_pf | Money (derived) | Dec(10,2) | — | Per the rule pack | — | — | HR, Comp | Ceiling applied unless international worker |
| Employer cost | Employer ESI | employer_esi | Money (derived) | Dec(10,2) | — | Per the rule pack | — | — | HR, Comp | — |
| Employer cost | Gratuity provision | gratuity_provision | Money (derived) | Dec(10,2) | — | Per the rule pack | — | — | HR, Comp | — |
| Employer cost | Employer NPS | employer_nps | Money | Dec(10,2) | N | — | Within the 80CCD(2) limit | — | HR, Comp | Requires a PRAN on the person record |
| Employer cost | Insurance premium | insurance_premium | Money | Dec(10,2) | N | From the benefit plan | — | — | HR, Comp | — |
| Variable | Variable pay percentage | variable_percent | Number | Dec(5,2) | N | — | 0-50 | — | HR, Comp | Paid through a separate run type |
| Variable | Variable pay frequency | variable_frequency | Select | Char(15) | Y if variable | Annual | Monthly / Quarterly / Annual | PL_FREQUENCY | HR, Comp | — |
| Variable | Retention or joining bonus | retention_bonus | Money | Dec(10,2) | N | — | >= 0 | — | HR, Comp | Clawback terms recorded on the letter |
| Checks | Wage floor test result | wage_floor_status | Panel (derived) | Char(20) | — | Computed | Pass / Fail with shortfall | PL_TEST_RESULT | HR, Comp | Blocks save on failure |
| Checks | Minimum wage test result | min_wage_status | Panel (derived) | Char(20) | — | Computed per state and skill | Pass / Fail | PL_TEST_RESULT | HR, Comp | — |
| Checks | Take-home impact | takehome_delta | Panel (derived) | Dec(10,2) | — | Computed | — | — | HR, Comp | Shown before adoption, not after |
| Control | Approval status | approval_status | Select (derived) | Char(15) | Y | Draft | From the approval chain | PL_APPROVAL_STATUS | HR, Comp | — |
| Control | Letter to be issued | issue_letter | Toggle | Bool | Y | Yes | — | — | HR | Queues the revision letter on approval |

### FRM-PAY-03 — Payroll Run (SCR-050)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Run | Legal entity | legal_entity_id | Lookup | Ref | Y | — | Within the grant | — | Payroll | — |
| Run | Payroll group | payroll_group | Lookup | Ref | Y | — | Within the grant | — | Payroll | — |
| Run | Period | period | Select | Char(7) | Y | Current open period | Period must not be closed | — | Payroll | — |
| Run | Run type | run_type | Select | Char(20) | Y | Regular | Regular / Off-cycle OT / Arrears / Full and final / Bonus | PL_RUN_TYPE | Payroll | A period carries several runs |
| Run | Pay date | pay_date | Date | Date | Y | — | On or after period end unless off-cycle | — | Payroll | — |
| Run | Population filter | population_filter | Multi-select | Mixed | N | Whole group | Location, class or employee list | — | Payroll | Off-cycle runs are usually a named list |
| Run | Include arrears | include_arrears | Toggle | Bool | Y | Yes | — | — | Payroll | Retro deltas from attendance and structure changes |
| Inputs | Attendance period locked | attendance_locked | Panel (derived) | Bool | Y | Computed | Lock required before calculation | — | Payroll | Unlocked attendance blocks calculation |
| Inputs | Leave period locked | leave_locked | Panel (derived) | Bool | Y | Computed | Lock required before calculation | — | Payroll | — |
| Inputs | Ad-hoc payroll inputs | payroll_input[] | Table | Composite | N | — | Component must be active for the run type | — | Payroll | Awards, referral payouts and recoveries enter here |
| Inputs | Input upload | input_file_ref | File | Ref | N | — | CSV to the published template | — | Payroll | Row-level validation before commit |
| State | Run state | run_state | Panel (derived) | Char(25) | Y | Draft | Transitions guarded by the state machine | PL_RUN_STATE | Payroll | Rollback disabled past disbursement prepared |
| State | Snapshot / input hash | snapshot_id, input_hash | Text (derived) | Char(64) | Y | System | — | — | Payroll, auditor | Reproducibility to the paisa eleven months later |
| State | Rule pack version | rule_pack_version | Text (derived) | Char(20) | Y | System | — | — | Payroll, auditor | — |
| Validation | Unmapped components | unmapped_component_count | Panel (derived) | Int | — | Computed | Must be zero before approval | — | Payroll, Finance | Blocks approval |
| Validation | Critical audit flags | critical_flag_count | Panel (derived) | Int | — | Computed | Must be zero before approval | — | Payroll | — |
| Actions | Calculate / approve / rollback | action | Buttons | — | — | — | Role and state dependent | — | Payroll | Every action logged with actor and reason |
| Actions | Action reason | action_reason | Text | Char(300) | Y on rollback or waiver | — | Min 15 chars | — | Payroll | — |

### FRM-PAY-04 — Pre-Payroll Audit Resolution (SCR-051)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Flag | Check code / description | check_code, description | Read-only | Char(200) | Y | System | — | — | Payroll | — |
| Flag | Severity | severity | Read-only | Char(10) | Y | System | Critical / Warning / Info | PL_SEVERITY | Payroll | A critical flag blocks approval |
| Flag | Affected employees | affected_count | Read-only | Int | Y | System | — | — | Payroll | Drill-down to the list |
| Flag | Financial impact | impact_amount | Read-only | Dec(12,2) | N | System | — | — | Payroll | — |
| Flag | Agent-drafted resolution | suggested_resolution | Read-only | Char(400) | N | Agent draft | — | — | Payroll | A draft, never applied automatically |
| Action | Disposition | disposition | Select | Char(15) | Y | — | Resolve / Waive / Escalate | PL_FLAG_DISPOSITION | Payroll | — |
| Action | Waiver reason | waiver_reason | Text | Char(300) | Y on waive | — | Min 20 chars; authorised role only | — | Payroll manager | Waived critical flags are named on the approval record |
| Action | Resolved by / on | resolved_by, resolved_on | Read-only | Mixed | — | System | — | — | Payroll, auditor | — |

### FRM-PAY-05 — Investment Declaration and Tax (SCR-054)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Regime | Financial year | financial_year | Select | Char(7) | Y | Current FY | Open declaration window only | — | Self | — |
| Regime | Tax regime | tax_regime | Select | Char(10) | Y | New | Old / New | PL_TAX_REGIME | Self | Switchable once per year until the freeze date |
| Regime | Declaration status | declaration_status | Select (derived) | Char(15) | Y | Draft | Draft / Submitted / Proof pending / Verified | PL_DECLARATION_STATUS | Self, Payroll | — |
| 80C | Employee PF (auto) | sec80c_epf | Money (derived) | Dec(10,2) | — | From payroll | — | — | Self | Read-only |
| 80C | Public provident fund | sec80c_ppf | Money | Dec(10,2) | N | 0 | Combined 80C cap enforced | — | Self | — |
| 80C | Life insurance premium | sec80c_lic | Money | Dec(10,2) | N | 0 | — | — | Self | — |
| 80C | ELSS / mutual fund | sec80c_elss | Money | Dec(10,2) | N | 0 | — | — | Self | — |
| 80C | Tuition fees | sec80c_tuition | Money | Dec(10,2) | N | 0 | Maximum two children | — | Self | — |
| 80C | Principal repayment on housing loan | sec80c_housing_principal | Money | Dec(10,2) | N | 0 | — | — | Self | — |
| 80C | Sukanya Samriddhi / NSC / other | sec80c_other | Money | Dec(10,2) | N | 0 | — | — | Self | — |
| 80C | 80C total | sec80c_total | Money (derived) | Dec(10,2) | — | Capped at the statutory limit | — | — | Self | Excess shown but not allowed |
| Other deductions | 80CCD(1B) NPS self | sec80ccd1b | Money | Dec(10,2) | N | 0 | Within the statutory limit | — | Self | — |
| Other deductions | 80D health insurance — self and family | sec80d_self | Money | Dec(10,2) | N | 0 | Within the limit for the age band | — | Self | — |
| Other deductions | 80D health insurance — parents | sec80d_parents | Money | Dec(10,2) | N | 0 | Higher limit where parents are senior citizens | — | Self | — |
| Other deductions | 80DD / 80DDB / 80U | sec80dd, sec80ddb, sec80u | Money | Dec(10,2) | N | 0 | Certificate mandatory | — | Self | — |
| Other deductions | 80E education loan interest | sec80e | Money | Dec(10,2) | N | 0 | No cap; lender certificate required | — | Self | — |
| Other deductions | 80G donations | sec80g | Money | Dec(10,2) | N | 0 | Receipt with 80G registration number | — | Self | — |
| Other deductions | 80TTA / 80TTB interest | sec80tta | Money | Dec(10,2) | N | 0 | — | — | Self | — |
| House property | Rent paid (monthly) | hra_rent_monthly | Money | Dec(10,2) | N | 0 | — | — | Self | — |
| House property | Landlord name | landlord_name | Text | Char(120) | Y if rent declared | — | — | — | Self | — |
| House property | Landlord PAN | landlord_pan | Text | Char(10) | Y if annual rent exceeds the threshold | — | ABCDE1234F | — | Self, Payroll | Missing PAN above the threshold disallows the exemption |
| House property | Rented property address | rent_address | Address block | Composite | Y if rent declared | — | — | — | Self | Metro flag drives the 50% or 40% test |
| House property | Rent period from / to | rent_from, rent_to | Date range | Date | Y if rent declared | — | Inside the financial year | — | Self | — |
| House property | Housing loan interest — self occupied | housing_interest_self | Money | Dec(10,2) | N | 0 | Within the statutory limit | — | Self | Section 24(b) |
| House property | Housing loan interest — let out | housing_interest_letout | Money | Dec(10,2) | N | 0 | Set-off limit applied | — | Self | — |
| House property | Lender name and PAN | lender_name, lender_pan | Text | Char(120)/Char(10) | Y if interest declared | — | — | — | Self | — |
| Other income | Income from other sources | other_income | Money | Dec(10,2) | N | 0 | >= 0 | — | Self | Increases projected TDS |
| Other income | Previous employer income and TDS | prev_employer_income, prev_employer_tds | Money | Dec(10,2) | N | From the person record | >= 0 | — | Self, Payroll | Form 12B |
| Proofs | Proof document | proof_ref[] | File (repeating) | Ref | Y at proof submission | — | PDF/JPG, max 5 MB each | — | Self, Payroll | One per declared head |
| Proofs | Proof status per head | proof_status | Select (derived) | Char(15) | Y | Pending | Pending / Accepted / Rejected / Partially accepted | PL_PROOF_STATUS | Payroll | Rejected heads revert to zero and TDS recomputes |
| Proofs | Verifier remarks | verifier_remarks | Text | Char(300) | Y on reject | — | Min 10 chars | — | Payroll | — |
| Projection | Projected taxable income | projected_taxable | Money (derived) | Dec(12,2) | — | Computed | — | — | Self | Recomputed on every save |
| Projection | Projected annual tax | projected_tax | Money (derived) | Dec(12,2) | — | Computed | — | — | Self | — |
| Projection | Tax deducted so far | tds_to_date | Money (derived) | Dec(12,2) | — | From payslips | — | — | Self | — |
| Projection | Monthly TDS going forward | monthly_tds | Money (derived) | Dec(10,2) | — | Computed | — | — | Self | Regime comparison shown side by side |

### FRM-PAY-06 — Reimbursement Claim (SCR-058)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Claim | Claim type | claim_type | Select | Ref | Y | — | Active reimbursement components the person is eligible for | PL_CLAIM_TYPE | Self | Fuel, telephone, medical, books, travel, relocation |
| Claim | Expense date | expense_date | Date | Date | Y | — | Inside the claim window for the financial year | — | Self | — |
| Claim | Amount claimed | amount_claimed | Money | Dec(10,2) | Y | — | Within the remaining annual entitlement | — | Self | Entitlement balance shown live |
| Claim | Bill number | bill_number | Text | Char(40) | Y | — | Unique within the claim type and year | — | Self | Duplicate bill numbers are blocked |
| Claim | Vendor / merchant | vendor_name | Text | Char(120) | Y | — | — | — | Self | — |
| Claim | Vendor GSTIN | vendor_gstin | Text | Char(15) | N | — | 15 char | — | Self, Finance | — |
| Claim | Bill upload | bill_ref | File | Ref | Y | — | PDF/JPG, max 5 MB | — | Self, Payroll | OCR pre-fills amount and date where enabled |
| Claim | Description | description | Text | Char(300) | N | — | — | — | Self | — |
| Context | Annual entitlement / claimed / balance | entitlement, claimed_ytd, balance | Panel (derived) | Dec(10,2) | — | Computed | — | — | Self | — |
| Approval | Approver / decision / remarks | approver_id, decision, decision_remarks | Mixed | Mixed | Y | Reporting manager | Reason mandatory on reject | PL_DECISION | Approver | — |
| Payroll | Tag to payroll run | tagged_run_id | Lookup | Ref | Y | Next open run | Open run | — | Payroll | Tax-exempt portion determined by the component setup |
| Payroll | Amount passed | amount_passed | Money | Dec(10,2) | Y | Same as claimed | Cannot exceed claimed | — | Payroll | Reduction requires a reason |

### FRM-PAY-07 — Disbursement and Bank File (SCR-055)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| File | Payroll run | run_id | Lookup | Ref | Y | — | Approved runs only | — | Finance | — |
| File | Bank / format | bank_format | Select | Char(30) | Y | From entity default | Active bank format | PL_BANK_FORMAT | Finance | One format per disbursing bank |
| File | Disbursing account | disbursing_account | Lookup | Ref | Y | — | Active company account | — | Finance | — |
| File | Value date | value_date | Date | Date | Y | Pay date | Not before today | — | Finance | — |
| File | Total amount | total_amount | Money (derived) | Dec(14,2) | Y | Computed | Must equal the sum of net pay | — | Finance | — |
| File | Account count | account_count | Number (derived) | Int | Y | Computed | — | — | Finance | — |
| File | Checksum | file_checksum | Text (derived) | Char(64) | Y | System | — | — | Finance, auditor | Verified out of band before release |
| File | Excluded employees | excluded_list | Panel (derived) | Ref[] | — | Computed | — | — | Finance | Invalid IFSC, missing account, held salary |
| Release | Prepared by | prepared_by | Read-only | Ref | Y | System | — | — | Finance | — |
| Release | Released by | released_by | Lookup | Ref | Y | — | Must differ from prepared by | — | Finance | Dual control enforced at the service, not the screen |
| Release | Out-of-band verification done | otp_verified | Toggle | Bool | Y | Off | — | — | Finance | Total confirmed on a second channel |
| Release | Release remarks | release_remarks | Text | Char(200) | N | — | — | — | Finance | — |
| Return | Bank return file | return_file_ref | File | Ref | N | — | Bank return format | — | Finance | Failed credits raise a re-disbursement task |

### FRM-PAY-08 — Full and Final Settlement (SCR-056)

| Section | Field label | Field name | Control | Data type | Mandatory | Default | Validation | Picklist | Visibility | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Header | Employee / last working day | person_id, last_working_day | Read-only | Mixed | Y | From the exit record | — | — | Payroll, HR | — |
| Header | Exit type | exit_type | Read-only | Char(25) | Y | From the exit record | — | PL_EXIT_TYPE | Payroll, HR | Drives notice recovery and gratuity eligibility |
| Header | Clearance status | clearance_status | Panel (derived) | Char(20) | Y | Computed | All blocking items must be closed | PL_CLEARANCE_STATUS | Payroll, HR | Held while any blocking item is open |
| Earnings | Salary for the final period | final_period_salary | Money (derived) | Dec(10,2) | Y | Computed | — | — | Payroll | Prorated on payable days |
| Earnings | Leave encashment | leave_encashment | Money (derived) | Dec(10,2) | Y | From the leave ledger | — | — | Payroll | Ledger debited only when the run is approved |
| Earnings | Gratuity | gratuity_amount | Money (derived) | Dec(12,2) | Y if eligible | Per the rule pack | Service must meet the qualifying period | — | Payroll | Rehire linkage affects continuity |
| Earnings | Bonus / variable payable | bonus_payable | Money | Dec(10,2) | N | — | >= 0 | — | Payroll | — |
| Earnings | Notice pay payable | notice_pay_payable | Money (derived) | Dec(10,2) | N | Computed | — | — | Payroll | Where the employer waives notice |
| Recoveries | Notice period shortfall recovery | notice_recovery | Money (derived) | Dec(10,2) | N | Computed | Waivable with reason | — | Payroll, HR | — |
| Recoveries | Outstanding loan balance | loan_recovery | Money (derived) | Dec(12,2) | Y if a loan is open | From the loan ledger | — | — | Payroll, Finance | Guarantors released only on full repayment |
| Recoveries | Salary advance recovery | advance_recovery | Money (derived) | Dec(10,2) | N | From the advance ledger | — | — | Payroll | — |
| Recoveries | Asset recovery | asset_recovery | Money (derived) | Dec(10,2) | N | From clearance items | — | — | Payroll, Admin | Unreturned asset becomes a recovery line |
| Recoveries | Other recovery | other_recovery | Money | Dec(10,2) | N | 0 | Reason mandatory | — | Payroll | — |
| Recoveries | Recovery waiver | recovery_waived_amount, waiver_reason | Money + text | Mixed | N | 0 | Authorised role; min 20 chars | — | Authorised role | — |
| Tax | Tax on settlement | settlement_tax | Money (derived) | Dec(10,2) | Y | Computed | Gratuity and leave encashment exemptions applied | — | Payroll | — |
| Result | Net settlement | net_settlement | Money (derived) | Dec(12,2) | Y | Computed | May be negative (recoverable) | — | Payroll, HR, self | Negative settlement raises a recovery note |
| Result | Settlement status | settlement_status | Select (derived) | Char(20) | Y | Draft | Draft / Computed / Approved / Paid | PL_SETTLEMENT_STATUS | Payroll | — |
| Result | Approval and remarks | approved_by, settlement_remarks | Mixed | Mixed | Y | — | Min 10 chars | — | Payroll, HR | — |

## 3. Picklists used by this domain's forms

| Picklist code | Name | Seeded by | Values | Complete value set |
| :--- | :--- | :--- | :--- | :--- |
| PL_ACTIVE_STATUS | Record status | System | 2 | Active · Inactive |
| PL_APPROVAL_STATUS | Approval status | System | 5 | Draft · Pending approval · Approved · Rejected · Withdrawn |
| PL_BANK_FORMAT | Bank file format | Config | 8 | HDFC ENet · ICICI CIB · SBI CINB · Axis Corporate · Kotak FYN · Yes Bank · NPCI NACH · Generic CSV |
| PL_CALC_METHOD | Calculation method | Config | 6 | Fixed amount · Percentage of component · Formula · Slab table · Attendance driven · Rate x quantity |
| PL_CLAIM_TYPE | Reimbursement claim type | Config | 9 | Fuel / conveyance · Telephone / internet · Medical · Books and periodicals · Travel · Relocation · Professional development · Meal · Other |
| PL_CLEARANCE_STATUS | Clearance status | System | 4 | Not started · In progress · Blocked · Cleared |
| PL_COMPONENT_TYPE | Pay component type | Config | 5 | Earning · Deduction · Employer contribution · Reimbursement · Information only |
| PL_DECISION | Approval decision | System | 4 | Approve · Reject · Return for correction · Delegate |
| PL_DECLARATION_STATUS | Declaration status | System | 5 | Draft · Submitted · Proof pending · Verified · Partially verified |
| PL_EXEMPTION_SECTION | Tax exemption section | System | 8 | 10(5) LTA · 10(13A) HRA · 10(14) special allowance · 16(ia) standard deduction · 16(ii) entertainment · 16(iii) professional tax · 17(2) perquisite · Not exempt |
| PL_EXIT_TYPE | Exit type | System | 7 | Resignation · Termination · Retirement · Contract end · Abandonment · Death in service · Redundancy |
| PL_FLAG_DISPOSITION | Audit flag disposition | System | 3 | Resolve · Waive · Escalate |
| PL_FREQUENCY | Frequency | System | 5 | Monthly · Quarterly · Half-yearly · Annual · Event-based |
| PL_PROOF_STATUS | Proof verification status | System | 4 | Pending · Accepted · Rejected · Partially accepted |
| PL_PRORATION_BASIS | Proration basis | Config | 3 | Calendar days · Payable days · Working days |
| PL_REVISION_TYPE | Salary revision type | Config | 7 | Annual increment · Promotion · Market correction · Wage settlement · Data correction · Retention · Confirmation |
| PL_ROUNDING | Rounding rule | Config | 4 | Nearest rupee · Round up · Round down · No rounding |
| PL_RUN_STATE | Payroll run state | System | 9 | Draft · Inputs locked · Calculated · Audited · Approved · Disbursement prepared · Disbursed · Posted to GL · Closed |
| PL_RUN_TYPE | Payroll run type | System | 6 | Regular · Off-cycle overtime · Arrears · Full and final · Bonus · Reimbursement |
| PL_SETTLEMENT_STATUS | Settlement status | System | 5 | Draft · Computed · Approved · Paid · Recovery pending |
| PL_SEVERITY | Severity | System | 3 | Critical · Warning · Info |
| PL_TAX_REGIME | Tax regime | System | 2 | Old regime · New regime |
| PL_TEST_RESULT | Compliance test result | System | 2 | Pass · Fail |

## 4. Client form deltas

Additional fields and behaviour required by the client requirements (R-xx), extending the forms above.

| Form ID | Form / screen | Module | Form type | Requirements | Purpose | Offline capable | Print / Output | Fields in this sheet |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-PAY-01 | Salary Structure | PAY | Master form | R-09, R-10 | Basic salary is the base for the loan ceiling. Visibility is restricted by payroll processing location. | N | Structure print | 0 |
| F-PAY-02 | Payroll Run | PAY | Processing screen | R-09, R-11, R-16 | Salary processing scoped to the payroll location, excluding OT. | N | Salary register | 0 |

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
| Size | 190 | specified items (table rows) | Counted automatically at generation |
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
