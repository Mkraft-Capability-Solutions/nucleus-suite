<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# DA-04 — Configuration Tables and Register

| Attribute | Value |
| :--- | :--- |
| Document ID | DA-04 |
| Title | Configuration Tables and Register |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Implementation Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, CM |
| Related documents | CM-01, FRS-<DOM>-11 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 10_Config_Tables<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Configuration tables

| Config table | Purpose | Key columns | Client's values (from the demo dataset) | Owned by | Changeable without a release |
| :--- | :--- | :--- | :--- | :--- | :--- |
| worker_class | Carries time and pay policy, not just statutory applicability | class_code, has_rest_days, rest_day_pattern, wage_type, ot_eligibility, leave_eligible, statutory_set, obligation_party | 9 classes: PERM, FTC, TRN, APP (stipend), CONT (daily, no rest day), 3PE (rest days, OT on rest/holiday only), 3PH (no rest day, daily), CONS (retainer), GIG | Implementation consultant | Yes |
| designation | Band, grace exemption, leave band and notice period | designation_code, band, grace_exempt, leave_band, ot_default, notice_days | 20 designations, bands E/D/C/B/A/T/H. grace_exempt = Y for Assistant Manager and above. Notice 7 to 90 days | Implementation consultant | Yes |
| shift | Shift definitions and inference windows | shift_code, shift_group, start, end, duration_min, break_recorded, break_deducted, earliest_in, latest_in, crosses_midnight | SH-A 08:00-20:00 12h · SH-B 20:00-08:00 12h · SH-C 07:00-17:00 10h · SH-D 17:00-03:00 10h · SH-E 09:00-18:00 9h · SH-F 09:30-17:30 8h. Breaks recorded, NOT deducted | Implementation consultant | Yes |
| attendance_rule_set | The entire disposition rule, as four rows | shift_hours, half_day_below_min, absent_below_min, grace_in, grace_out, late_allowance_per_month, long_night_after, relief_until | 12h: 690/390 · 10h: 570/360 · 9h: 510/300 · 8h: 450/270. Grace 15 in and out. 3 lates forgiven per month. Long night after 03:00, relief until 09:30 | Implementation consultant | Yes |
| attendance_rule_set (tenant switches) | Two switches that change every derived figure | deduct_breaks, ot_basis | deduct_breaks = NO (gate-to-gate). ot_basis = GROSS span. Both must be stated explicitly in configuration, never assumed | Implementation consultant | Yes |
| gate_pass_policy | Personal gate-pass ceiling | monthly_minutes, max_instances, official_consumes_ceiling | 240 minutes a month, maximum 2 instances, official passes excluded from the ceiling | Implementation consultant | Yes |
| work_calendar / holiday_calendar | Day type by location | location_id, date, day_type; holiday applicable_locations[] | 13 holidays across 4 states; 15 Sep 2026 is a holiday at Hyderabad and Chennai only. Multi-plant operations do not share one list | Implementation consultant | Yes |
| leave_type | Types, caps, exclusions, year-end action | leave_type, unit, accrual, carry_forward, year_end_action, max_per_month, excluded_with, expiry_rule, applies_to_bands | EL: carry forward to 45, encash, max 10/month, excludes CL. CL: lapse, max 2/month, excludes EL and SL. SL: lapse. COMPOFF: 60-day expiry. Birthday leave separate | Implementation consultant | Yes |
| leave_accrual_policy | Band-bound accrual | policy_code, leave_band, leave_type, annual_days, accrual_frequency, days_per_period, eligibility_wait_months, credit_on_completion, credit_date | AGM_AND_ABOVE: EL 18, CL 6, SL 6 on 1 Jan. STANDARD: EL 1.5/month with a 6-month wait then 9 days on completion; CL 6; SL 6. Trainee bands per policy | Implementation consultant | Yes |
| leave_proration_rule | Joining-month proration for CL and SL | joining_month_from, joining_month_to, cl_days, sl_days | Jan 6 · Feb-Mar 5 · Apr-May 4 · Jun-Jul 3 · Aug-Sep 2 · Oct to 4 Dec 1 | Implementation consultant | Yes |
| approval_chain | Who approves what, in what order | chain_id, request_type, applies_to, steps[], sla_hours | Leave: Supervisor → HOD → HR Head, sequential, HR edit right retained. Loan: sanction chain by amount with director override. Requisition: with sanction check | Implementation consultant | Yes |
| pay_component + gl_mapping | Components, their formulas and their accounts | component_code, type, formula, depends_on, taxable, pf/esi applicable; entity, dr_cr, gl_account_code, cost_centre_source, dimensioned_by | Basic, DA, HRA, conveyance, special allowance, OT, awards; employer PF and ESI, gratuity, bonus, encashment provisions; payables and recoveries. Every component mapped before a run can be approved | Finance + implementation | Yes |
| loan_policy | Eligibility and guarantor rules | ceiling_multiple_base, ceiling_multiple_long, long_service_years, mandatory_guarantors, third_guarantor_threshold, one_at_a_time, override_role | 4x basic, 6x above 5 years' service, 2 mandatory guarantors, third optional above a threshold, one loan at a time, guarantor lock until release, director override on special terms | Finance + implementation | Yes |
| clearance_checklist_template | Exit no-dues items by class and location | worker_class, location_id, item, owner_role, blocking, sla_days | Nine items in the demo tenant, four blocking. Plant template returns tools and locker key; head office returns laptop and corporate card | Implementation consultant | Yes |
| statutory_form | The form library | form_code, act, state, applicability_rule, frequency, due_rule, template_ref | Factories Rules Form F at joining (KA and TN sets differ), Form 28 overtime register, state registers and returns. The library is the deliverable, not any one form | Compliance engineer | Yes |
| rule_pack | Statutory computation, outside application code | pack_id, jurisdiction, state, effective_from, supersedes, rules[], tests, changelog | Central wages pack plus KA, MH, TS, TN state packs for PT and LWF. Deployed independently of the application, with a green suite and a named reviewer | Compliance engineer | Yes — independently deployable |
| field_ownership_map | Who owns which employee-master field | field, owner(ERP\|Nucleus), mandatory, conflict_policy | ERP owns employee code, name, joining date, department, cost centre. Nucleus owns grade, worker class, shift, leave policy, manager and all time and talent data | Implementation consultant | Yes |
| tenant_agent_policy | Agent autonomy per tenant | agent_id, tool, max_value, max_blast_radius, auto_approve_threshold, requires_human | Attendance Steward auto-resolves under a configured threshold; Payroll Preparer is propose-only always; disbursement, termination, offer release, statutory filing and loan sanction always require a named human | Tenant admin | Yes |

## 2. Configuration register — items that must be configuration, not code

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Employment category | EMP | F-EMP-01 — Employee Master | Permanent | All roles | R-03 | Yes — value set configurable per tenant |
| Employment sub-category | EMP | F-EMP-01 — Employee Master | — | All roles | R-04 | Yes — value set configurable per tenant |
| Rest day applicable | EMP | F-EMP-01 — Employee Master | Defaulted from the employment sub-category, then the category | All roles | R-03, R-04 | Yes — default per category, overridable per employee |
| Rest day pattern | EMP | F-EMP-01 — Employee Master | From the work calendar | All roles | R-03, R-04 | Yes |
| OT eligible | EMP | F-EMP-01 — Employee Master | Y | All roles | R-05 | Yes |
| OT eligibility basis | EMP | F-EMP-01 — Employee Master | All days | All roles | R-05 | Yes — value set configurable per tenant |
| OT rate multiplier | EMP | F-EMP-01 — Employee Master | From the leave and OT scheme | Payroll and HR roles only | R-05 | Yes |
| Leave scheme | EMP | F-EMP-01 — Employee Master | Defaulted from grade and employment category | All roles | R-08 | Yes |
| COFF lapse days | EMP | F-EMP-01 — Employee Master | 60 from the leave scheme | HR roles only | R-07 | Yes — default 60 per the stated policy |
| Trainee type | EMP | F-EMP-01 — Employee Master | — | All roles | R-08 | Yes — value set configurable per tenant |
| Payroll processing location | EMP | F-EMP-01 — Employee Master | Employee work location | All roles | R-09 | Yes |
| Attendance location | EMP | F-EMP-01 — Employee Master | Employee work location | All roles | R-09 | Yes |
| Gate pass entitlement hours per month | EMP | F-EMP-01 — Employee Master | 4.00 | HR roles only | R-12 | Yes — default 4 hours per the stated policy |
| Gate pass count limit per month | EMP | F-EMP-01 — Employee Master | 2 | HR roles only | R-12 | Yes — default 2 per the stated policy |
| Category code | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-03, R-04 | Yes |
| Category name | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-03, R-04 | Yes |
| Is third party | EMP | F-EMP-02 — Employment Category & Sub-category Master | N | All roles | R-04 | Yes |
| Default rest day applicable | EMP | F-EMP-02 — Employment Category & Sub-category Master | Y | All roles | R-03, R-04 | Yes |
| Default wage basis | EMP | F-EMP-02 — Employment Category & Sub-category Master | Monthly | All roles | R-03 | Yes |
| Default leave scheme | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-08 | Yes |
| Sub-category code | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-04 | Yes |
| Sub-category name | EMP | F-EMP-02 — Employment Category & Sub-category Master | — | All roles | R-04 | Yes |
| Rest day applicable | EMP | F-EMP-02 — Employment Category & Sub-category Master | Inherited from the category | All roles | R-04 | Yes |
| Scheme code | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Scheme name | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Applies from grade rank | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Applies to trainees | EMP | F-EMP-03 — Leave Scheme Master | N | All roles | R-08 | Yes |
| EL treatment at year end | EMP | F-EMP-03 — Leave Scheme Master | Encash | All roles | R-08 | Yes — value set configurable per tenant |
| CL treatment at year end | EMP | F-EMP-03 — Leave Scheme Master | Lapse | All roles | R-08 | Yes — value set configurable per tenant |
| SL treatment at year end | EMP | F-EMP-03 — Leave Scheme Master | Lapse | All roles | R-08 | Yes — value set configurable per tenant |
| COFF lapse days | EMP | F-EMP-03 — Leave Scheme Master | 60 | All roles | R-07 | Yes |
| Leave type | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Accrual frequency | EMP | F-EMP-03 — Leave Scheme Master | Annual | All roles | R-08 | Yes — value set configurable per tenant |
| Accrual quantity | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Accrual date | EMP | F-EMP-03 — Leave Scheme Master | 01-01 | All roles | R-08 | Yes |
| Minimum service months before accrual | EMP | F-EMP-03 — Leave Scheme Master | 0 | All roles | R-08 | Yes |
| Catch-up quantity on completing minimum service | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Maximum availed per month | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Joining month from | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Joining month to | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Cut-off day in the last month | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Quantity credited | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Leave type | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Cannot be combined with | EMP | F-EMP-03 — Leave Scheme Master | — | All roles | R-08 | Yes |
| Grade rank | EMP | F-EMP-04 — Designation & Grade Master | — | All roles | R-08, R-13 | Yes |
| Exempt from grace deduction | EMP | F-EMP-04 — Designation & Grade Master | N | All roles | R-13 | Yes |
| Rostered shift | ATT | F-ATT-01 — Daily Attendance Processing | From the shift roster | All roles | R-14 | Yes |
| Break type | ATT | F-ATT-03 — Break Register | Unclassified | All roles | R-01 | Yes — value set configurable per tenant |
| Include indirect reportees | ATT | F-ATT-05 — Team Calendar | N | Reporting manager and above | R-02 | Yes |
| Grace minutes on arrival | ATT | F-ATT-06 — Grace & Late Policy Setup | 15 | HR roles only | R-13 | Yes — default 15 per the stated policy |
| Grace minutes on departure | ATT | F-ATT-06 — Grace & Late Policy Setup | 15 | HR roles only | R-13 | Yes — default 15 per the stated policy |
| Lates allowed per month | ATT | F-ATT-06 — Grace & Late Policy Setup | 3 | HR roles only | R-13 | Yes — default 3 per the stated policy |
| Consequence beyond the allowance | ATT | F-ATT-06 — Grace & Late Policy Setup | Half day | HR roles only | R-13 | Yes — value set configurable per tenant |
| Counter reset basis | ATT | F-ATT-06 — Grace & Late Policy Setup | Calendar month | HR roles only | R-13 | Yes — value set configurable per tenant |
| Exempt from grade rank | ATT | F-ATT-06 — Grace & Late Policy Setup | Assistant Manager rank | HR roles only | R-13 | Yes |
| Shift code | SHF | F-SHF-01 — Shift Master | — | All roles | R-13, R-14 | Yes |
| Shift start time | SHF | F-SHF-01 — Shift Master | — | All roles | R-13 | Yes |
| Shift end time | SHF | F-SHF-01 — Shift Master | — | All roles | R-13 | Yes |
| Half day threshold hours | SHF | F-SHF-01 — Shift Master | Per the shift length | All roles | R-13 | Yes — configuration, not code |
| Absent threshold hours | SHF | F-SHF-01 — Shift Master | Per the shift length | All roles | R-13 | Yes — configuration, not code |
| Detection window from | SHF | F-SHF-01 — Shift Master | — | All roles | R-14 | Yes |
| Detection window to | SHF | F-SHF-01 — Shift Master | — | All roles | R-14 | Yes |
| Auto detect enabled | SHF | F-SHF-01 — Shift Master | Y | All roles | R-14 | Yes |
| OT starts after hours | SHF | F-SHF-01 — Shift Master | Shift duration | All roles | R-01 | Yes |
| Applies to shift | SHF | F-SHF-03 — Night Extension Rule Setup | — | HR roles only | R-13 | Yes |
| Triggered when previous session ends after | SHF | F-SHF-03 — Night Extension Rule Setup | 03:00 | HR roles only | R-13 | Yes |
| Permitted late arrival until | SHF | F-SHF-03 — Night Extension Rule Setup | 09:30 | HR roles only | R-13 | Yes |
| Minimum departure time to qualify | SHF | F-SHF-03 — Night Extension Rule Setup | 20:00 | HR roles only | R-13 | Yes |
| Day status when the rule applies | SHF | F-SHF-03 — Night Extension Rule Setup | Present | HR roles only | R-13 | Yes — value set configurable per tenant |
| Maximum uses per month | SHF | F-SHF-03 — Night Extension Rule Setup | — | HR roles only | R-13 | Yes |
| Leave type code | LVE | F-LVE-01 — Leave Type Master | — | All roles | R-08 | Yes |
| Is compensatory off | LVE | F-LVE-01 — Leave Type Master | N | All roles | R-07 | Yes |
| Is birthday leave | LVE | F-LVE-01 — Leave Type Master | N | All roles | R-08 | Yes |
| Encashable | LVE | F-LVE-01 — Leave Type Master | N | All roles | R-08 | Yes |
| Half day permitted | LVE | F-LVE-01 — Leave Type Master | Y | All roles | R-08 | Yes |
| Display unit | LVE | F-LVE-01 — Leave Type Master | Days | All roles | R-08 | Yes — value set configurable per tenant |
| Leave type | LVE | F-LVE-03 — Leave Application | — | All roles | R-08 | Yes |
| Current approval level | LVE | F-LVE-03 — Leave Application | Supervisor | All roles | R-06 | Yes — value set configurable per tenant |
| Attendance action | LVE | F-LVE-04 — Leave Cancellation & Early Return | Mark present | HR roles only | R-06 | Yes — value set configurable per tenant |
| COFF status | LVE | F-LVE-06 — COFF Register | Available | All roles | R-07 | Yes — value set configurable per tenant |
| Run mode | LVE | F-LVE-07 — Year End Leave Processing | Preview | HR roles only | R-08 | Yes — value set configurable per tenant |
| OT basis hours | OTM | F-OTM-01 — OT Computation & Approval | Gross work hours | All roles | R-01 | Yes |
| OT period from | OTM | F-OTM-02 — OT Payment Run | — | Payroll and HR roles only | R-11 | Yes |
| OT period to | OTM | F-OTM-02 — OT Payment Run | — | Payroll and HR roles only | R-11 | Yes |
| Gate pass type | GPS | F-GPS-01 — Gate Pass Request | Personal | All roles | R-12 | Yes — value set configurable per tenant |
| Credit to work hours on approval | GPS | F-GPS-01 — Gate Pass Request | Y | All roles | R-12 | Yes |
| Eligible multiple | LON | F-LON-01 — Loan Application | 4.00 | All roles | R-10 | Yes — the multiples are policy values |
| Guarantor 3 | LON | F-LON-01 — Loan Application | — | All roles | R-10 | Yes |
| Special terms applied | LON | F-LON-01 — Loan Application | N | HR roles only | R-10 | Yes |
| Guarantee status | LON | F-LON-02 — Guarantor Register | Active | HR roles only | R-10 | Yes — value set configurable per tenant |
| Settlement date | FNF | F-FNF-01 — Full & Final Settlement | Last working date | HR roles only | R-17 | Yes |
| No dues status | FNF | F-FNF-01 — Full & Final Settlement | Pending | HR roles only | R-17 | Yes — value set configurable per tenant |
| Department | FNF | F-FNF-02 — No Dues Clearance Checklist | — | All roles | R-17 | Yes |
| Clearance item | FNF | F-FNF-02 — No Dues Clearance Checklist | — | All roles | R-17 | Yes |
| Status | FNF | F-FNF-02 — No Dues Clearance Checklist | Pending | All roles | R-17 | Yes — value set configurable per tenant |
| Recovery amount | FNF | F-FNF-02 — No Dues Clearance Checklist | 0.00 | HR roles only | R-17 | Yes |
| Establishment registration number | STA | F-STA-02 — Form F — Joining Form | From the establishment master | HR roles only | R-27 | Yes |
| State variant | STA | F-STA-02 — Form F — Joining Form | From the establishment state | HR roles only | R-27 | Yes — value set configurable per tenant |
| Nature of work | STA | F-STA-02 — Form F — Joining Form | From designation | HR roles only | R-27 | Yes |
| Role code | SEC | F-SEC-01 — Role & Data Scope Setup | — | HR roles only | R-09 | Yes |
| Scope dimension | SEC | F-SEC-01 — Role & Data Scope Setup | Attendance location | HR roles only | R-09 | Yes — value set configurable per tenant |
| Can view salary structure | SEC | F-SEC-01 — Role & Data Scope Setup | N | HR roles only | R-09 | Yes |
| Can view rate structure | SEC | F-SEC-01 — Role & Data Scope Setup | N | HR roles only | R-09 | Yes |
| Master owner | INT | F-INT-01 — ERP Employee Master Sync | ERP | HR roles only | R-15 | Yes — value set configurable per tenant |
| Last sync status | INT | F-INT-01 — ERP Employee Master Sync | — | HR roles only | R-15 | Yes — value set configurable per tenant |
| Account code | INT | F-INT-02 — Payroll Account Posting | — | Payroll and HR roles only | R-16 | Yes |
| Cost centre | INT | F-INT-02 — Payroll Account Posting | From the employee department | Payroll and HR roles only | R-16 | Yes |
| Position code | REC | F-REC-02 — Manpower Requisition | — | All roles | R-25 | Yes |
| Requisition reason | REC | F-REC-02 — Manpower Requisition | Replacement | All roles | R-25 | Yes — value set configurable per tenant |
| Sanctioned strength check | REC | F-REC-02 — Manpower Requisition | — | All roles | R-26 | Yes |
| Statutory form code | STA | F-STA-01 — Statutory Registers & Returns | — | HR roles only | R-18 | Yes — value set configurable per tenant |
| Establishment | STA | F-STA-01 — Statutory Registers & Returns | — | HR roles only | R-18 | Yes |
| State variant | STA | F-STA-01 — Statutory Registers & Returns | From the establishment state | HR roles only | R-18 | Yes — value set configurable per tenant |
| Award period | ENG | F-ENG-01 — Star Employee Nomination | Current month | All roles | R-19 | Yes |
| Nomination criteria | ENG | F-ENG-01 — Star Employee Nomination | — | All roles | R-19 | Yes |
| Selected | ENG | F-ENG-01 — Star Employee Nomination | N | All roles | R-19 | Yes |
| Award amount | ENG | F-ENG-02 — Employee Referral | — | Payroll and HR roles only | R-20 | Yes |
| Award status | ENG | F-ENG-02 — Employee Referral | Pending | All roles | R-20 | Yes |
| Announcement type | ENG | F-ENG-03 — Announcements | — | All roles | R-21 | Yes — value set configurable per tenant |
| Audience scope | ENG | F-ENG-03 — Announcements | All employees | All roles | R-21 | Yes |
| Auto-generated | ENG | F-ENG-03 — Announcements | N | All roles | R-21 | Yes |
| Letter template code | DOC | F-DOC-01 — Letter Template & Issue | — | HR roles only | R-22 | Yes |
| Merge fields available | DOC | F-DOC-01 — Letter Template & Issue | From the employee record | HR roles only | R-22 | Yes |
| Department | ORG | F-ORG-01 — Organisation Chart | — | All roles | R-23 | Yes |
| Functional reporting manager | ORG | F-ORG-01 — Organisation Chart | — | All roles | R-23 | Yes |
| Induction item | ONB | F-ONB-01 — Induction Checklist | — | All roles | R-24 | Yes |
| Completion status | ONB | F-ONB-01 — Induction Checklist | Pending | All roles | R-24 | Yes |
| Recovery value if not returned | ONB | F-ONB-02 — Asset Allocation | 0.00 | HR roles only | R-24, R-17 | Yes |

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
| Size | 146 | specified items (table rows) | Counted automatically at generation |
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
