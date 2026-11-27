<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMB-13 — Compensation, Loans & Benefits — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMB-13 |
| Title | Compensation, Loans & Benefits — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compensation, Loans & Benefits |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-CMB-00, FRS-CMB-01, FRS-CMB-02, FRS-CMB-03, FRS-CMB-04, FRS-CMB-05, FRS-CMB-06, FRS-CMB-07, FRS-CMB-08, FRS-CMB-09, FRS-CMB-10, FRS-CMB-11, FRS-CMB-12, FRS-CMB-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-05 · R-10 · processes CMB-01–CMB-06 |
| Source of record | Derived from FRS-CMB-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

46 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 29, Should 17.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| CMB-US-001 | Employee / worker | to check my loan eligibility and ceiling before I fill in an application | Must | CMB-UC-001 |
| CMB-US-002 | Employee / worker | to see every reason I am ineligible in plain words | Must | CMB-UC-001 |
| CMB-US-003 | Payroll manager | the payroll deduction node and the agent tool to call the same eligibility method as the screen | Must | CMB-UC-001 |
| CMB-US-004 | Employee / worker | to apply for a loan naming my guarantors in one form | Must | CMB-UC-002 |
| CMB-US-005 | Guarantor (Employee / worker) | to accept a guarantee explicitly and see what it blocks for me | Must | CMB-UC-002 |
| CMB-US-006 | Employee / worker | to know immediately when my application is rejected and why | Must | CMB-UC-002 |
| CMB-US-007 | Director / approver | to sanction a loan above the ceiling on special terms with the waived rules recorded | Must | CMB-UC-003 |
| CMB-US-008 | Finance | applications routed automatically by amount band | Should | CMB-UC-003 |
| CMB-US-009 | Payroll manager | every sanctioned loan to register its payroll deduction automatically | Must | CMB-UC-003 |
| CMB-US-010 | Guarantor (Employee / worker) | my guarantor block lifted automatically when the loan I guaranteed is repaid | Must | CMB-UC-004 |
| CMB-US-011 | Employee / worker | my outstanding balance to drop after every payroll recovery | Must | CMB-UC-004 |
| CMB-US-012 | Auditor | guarantor release recorded as a dated event | Should | CMB-UC-004 |
| CMB-US-013 | Employee / worker | to see how much of my earned pay I can draw today | Should | CMB-UC-005 |
| CMB-US-014 | Employee / worker | a clear refusal when I hold an outstanding loan | Must | CMB-UC-005 |
| CMB-US-015 | Payroll manager | every advance recovered as an input in the same run | Must | CMB-UC-005 |
| CMB-US-016 | Manager / supervisor | to allocate increases across my team on one worksheet with budget remaining shown live | Must | CMB-UC-006 |
| CMB-US-017 | HR operations | revision letters drafted from the approved figures and reviewed before issue | Must | CMB-UC-006 |
| CMB-US-018 | Payroll manager | revisions with past effective dates to arrive with arrears computed | Should | CMB-UC-006 |
| CMB-US-019 | Payroll manager | to publish pay ranges per grade and location with effective dates | Must | CMB-UC-007 |
| CMB-US-020 | HR operations | to see compa-ratio and range penetration for every employee | Must | CMB-UC-007 |
| CMB-US-021 | Manager / supervisor | to see each team member's position in range on their profile card | Should | CMB-UC-007 |
| CMB-US-022 | Manager / supervisor | guideline ranges pre-filled for each person based on rating and compa-ratio | Must | CMB-UC-008 |
| CMB-US-023 | Finance | pool utilisation visible across all worksheets | Must | CMB-UC-008 |
| CMB-US-024 | Payroll manager | approved bonuses delivered as inputs to the named run | Must | CMB-UC-008 |
| CMB-US-025 | Employee / worker | to see my vested and unvested options at any time | Should | CMB-UC-009 |
| CMB-US-026 | Payroll manager | the perquisite value of an exercise raised as a payroll input | Should | CMB-UC-009 |
| CMB-US-027 | Employee / worker | to add my spouse and children to medical cover during the window | Must | CMB-UC-010 |
| CMB-US-028 | Employee / worker | to buy a top-up with the monthly cost shown before I confirm | Should | CMB-UC-010 |
| CMB-US-029 | HR operations | a life-event window opened only for the affected employee | Must | CMB-UC-010 |
| CMB-US-030 | Employee / worker | to choose my NPS contribution rate and see the monthly effect | Must | CMB-UC-011 |
| CMB-US-031 | Payroll manager | configured caps applied automatically every run | Must | CMB-UC-011 |
| CMB-US-032 | Employee / worker | to split my flexi budget across items within their limits | Should | CMB-UC-012 |
| CMB-US-033 | Payroll manager | unproven allocations taxed at year end automatically | Should | CMB-UC-012 |
| CMB-US-034 | Employee / worker | to see the full value of my pay and benefits in one statement | Should | CMB-UC-013 |
| CMB-US-035 | HR operations | statements withheld when totals do not reconcile | Should | CMB-UC-013 |
| CMB-US-036 | HR operations | to see the gender pay gap adjusted for grade, location and tenure | Must | CMB-UC-014 |
| CMB-US-037 | Director / approver | remediation items with cost and status | Must | CMB-UC-014 |
| CMB-US-038 | Employee / worker | to see my retention award, vesting dates and clawback terms in one place | Should | CMB-UC-015 |
| CMB-US-039 | Payroll manager | vested tranches to arrive as payroll inputs in the correct run | Should | CMB-UC-015 |
| CMB-US-040 | Finance | the deferred bonus liability accrued each month | Should | CMB-UC-015 |
| CMB-US-041 | HR operations | to see compa-ratio by grade, site and tenure for one role family | Must | CMB-UC-016 |
| CMB-US-042 | HR operations | to see pay inversions between new joiners and experienced staff | Must | CMB-UC-016 |
| CMB-US-043 | Manager / supervisor | to see where my team sits in the pay band during the cycle | Should | CMB-UC-016 |
| CMB-US-044 | Payroll manager | to compute statutory bonus for the whole entity in one run with eligibility shown | Must | CMB-UC-017 |
| CMB-US-045 | Employee / worker | to see how my gratuity was calculated at exit | Must | CMB-UC-017 |
| CMB-US-046 | Compliance owner | statutory registers produced from the same computation that paid employees | Should | CMB-UC-017 |

## 2. Stories with acceptance criteria

### CMB-US-001 · Evaluate loan eligibility through the single service method

As a **Employee / worker**, I want to check my loan eligibility and ceiling before I fill in an application, so that I only apply for an amount the policy allows.

Priority: **Must** · Use case: CMB-UC-001 · Realises: CMB-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee with monthly basic of 40,000, four years of service and no loans or guarantees | the employee opens eligibility on the loans screen | the result shows eligible with a ceiling of 160,000 |
| 2 | the same employee profile with six years of service | eligibility is evaluated | the result shows eligible with a ceiling of 240,000 and states that the 6x multiple was applied |

### CMB-US-002 · Evaluate loan eligibility through the single service method

As a **Employee / worker**, I want to see every reason I am ineligible in plain words, so that I know what has to change before I can borrow.

Priority: **Must** · Use case: CMB-UC-001 · Realises: CMB-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | employee E1041 stands guarantor on loan LN-2026-0041, which has no release date | E1041 checks eligibility | the result is ineligible and the reason names LN-2026-0041 as an unreleased guarantee |
| 2 | an employee with an outstanding loan balance | the employee checks eligibility for a salary advance | the advance is refused with the same outstanding-loan reason shown for a new loan |

### CMB-US-003 · Evaluate loan eligibility through the single service method

As a **Payroll manager**, I want the payroll deduction node and the agent tool to call the same eligibility method as the screen, so that no caller can reach a different answer for the same person.

Priority: **Must** · Use case: CMB-UC-001 · Realises: CMB-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | employees E1044, E1041, E1056, E1050 and E1022 from the demo dataset | eligibility is requested for each via the screen, the guarantor lock, the payroll node and the agent tool | all four callers return the same decision, ceiling and reasons for every employee |
| 2 | the implementation consultant changes multiple_base from 4 to 5 in loan policy configuration | eligibility is next evaluated for an employee with four years of service | every caller reflects the 5x ceiling without a code deployment |

### CMB-US-004 · Apply for a loan and secure guarantor acceptance

As a **Employee / worker**, I want to apply for a loan naming my guarantors in one form, so that I do not have to chase paperwork separately.

Priority: **Must** · Use case: CMB-UC-002 · Realises: CMB-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an eligible employee requests 150,000 over 24 months naming two eligible colleagues | the employee submits the application | the application is created in GUARANTORS_PENDING and both colleagues receive an acceptance request |
| 2 | the same form with only one guarantor named | the employee tries to submit | submission is refused with the message that two guarantors are mandatory |

### CMB-US-005 · Apply for a loan and secure guarantor acceptance

As a **Guarantor (Employee / worker)**, I want to accept a guarantee explicitly and see what it blocks for me, so that I make an informed commitment.

Priority: **Must** · Use case: CMB-UC-002 · Realises: CMB-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a colleague has named me as mandatory guarantor | I accept the request in my approvals inbox | my acceptance is timestamped and my status shows blocked from borrowing or guaranteeing until release |
| 2 | I am already locked as guarantor on another active loan | a new application names me | the application fails eligibility with a reason naming my existing guarantee |

### CMB-US-006 · Apply for a loan and secure guarantor acceptance

As a **Employee / worker**, I want to know immediately when my application is rejected and why, so that I can resolve the blocker or choose different guarantors.

Priority: **Must** · Use case: CMB-UC-002 · Realises: CMB-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | application LN-APP-2026-0014 is submitted by E1041, who guarantees LN-2026-0041 | eligibility runs | the application is REJECTED and the reason names the unreleased guarantee |
| 2 | one proposed guarantor is ineligible but the applicant is eligible | eligibility runs | the reason identifies which guarantor failed and why, without exposing that guarantor's salary |

### CMB-US-007 · Sanction a loan, including director special-terms override

As a **Director / approver**, I want to sanction a loan above the ceiling on special terms with the waived rules recorded, so that the exception is defensible at audit.

Priority: **Must** · Use case: CMB-UC-003 · Realises: CMB-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | loan LN-2026-0012 for E1022 requests more than the computed ceiling | the director sanctions on special terms citing the ceiling rule as waived and gives a reason | the loan becomes ACTIVE and the override record shows approver, reason and the ceiling rule in rules_waived |
| 2 | an HR operations user without the override role | the user attempts the same special-terms sanction | the action is refused and an audit entry records the attempt |

### CMB-US-008 · Sanction a loan, including director special-terms override

As a **Finance**, I want applications routed automatically by amount band, so that higher-value loans receive the extra scrutiny policy demands.

Priority: **Should** · Use case: CMB-UC-003 · Realises: CMB-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a chain where amounts above 200,000 need a second approver | an application for 240,000 is accepted by its guarantors | it routes to both approvers before sanction |
| 2 | an application for 120,000 | guarantors accept | it routes to the single first-band approver only |

### CMB-US-009 · Sanction a loan, including director special-terms override

As a **Payroll manager**, I want every sanctioned loan to register its payroll deduction automatically, so that no recovery is missed because someone forgot a manual input.

Priority: **Must** · Use case: CMB-UC-003 · Realises: CMB-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a loan of 120,000 over 12 months sanctioned on 10 March | sanction completes | a deduction input of 10,000 exists for the March run and the schedule lists 12 instalments |
| 2 | the deduction input cannot be written | sanction is attempted | the loan remains SANCTION_PENDING and no partial loan record exists |

### CMB-US-010 · Recover loan instalments, close the loan and release guarantors

As a **Guarantor (Employee / worker)**, I want my guarantor block lifted automatically when the loan I guaranteed is repaid, so that I can borrow again without raising a ticket.

Priority: **Must** · Use case: CMB-UC-004 · Realises: CMB-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | employee E1050 guarantees loan LN-2025-0112 with one instalment left | the run carrying the final recovery is finalised | the loan is CLOSED and E1050 has a release row dated that day |
| 2 | E1050 has been released | E1050 checks loan eligibility | no guarantee reason is returned |

### CMB-US-011 · Recover loan instalments, close the loan and release guarantors

As a **Employee / worker**, I want my outstanding balance to drop after every payroll recovery, so that my loans screen always matches my payslip.

Priority: **Must** · Use case: CMB-UC-004 · Realises: CMB-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an ACTIVE loan with 60,000 outstanding and a 10,000 instalment | the March run is finalised | a repayment row of 10,000 is posted and outstanding shows 50,000 |
| 2 | the March run is reversed after posting | reversal completes | the repayment is reversed and outstanding returns to 60,000 |

### CMB-US-012 · Recover loan instalments, close the loan and release guarantors

As a **Auditor**, I want guarantor release recorded as a dated event, so that I can prove when each block was lifted.

Priority: **Should** · Use case: CMB-UC-004 · Realises: CMB-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a loan closed on 31 May with two guarantors | I open the action history for the loan | two release rows dated 31 May are listed with loan.guarantor.released references |
| 2 | a loan with outstanding above zero | I inspect its guarantors | no release rows exist and both remain blocked |

### CMB-US-013 · Request a salary advance or earned wage access

As a **Employee / worker**, I want to see how much of my earned pay I can draw today, so that I can cover an urgent expense before payday.

Priority: **Should** · Use case: CMB-UC-005 · Realises: CMB-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee with accrued net of 18,000 on the 15th and nothing drawn | the employee opens the advance request | the available amount shows 9,000 with the calculation lines |
| 2 | the same employee has already drawn 4,000 this period | the employee opens the advance request | the available amount shows 5,000 |

### CMB-US-014 · Request a salary advance or earned wage access

As a **Employee / worker**, I want a clear refusal when I hold an outstanding loan, so that I understand the policy rather than guess.

Priority: **Must** · Use case: CMB-UC-005 · Realises: CMB-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee repaying an active loan | the employee requests an advance | the request is refused with the outstanding-loan reason |
| 2 | the loan closes in the May run | the employee requests an advance in June | the request proceeds to the available-amount step |

### CMB-US-015 · Request a salary advance or earned wage access

As a **Payroll manager**, I want every advance recovered as an input in the same run, so that net pay is correct without manual adjustments.

Priority: **Must** · Use case: CMB-UC-005 · Realises: CMB-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an advance of 6,000 drawn on 12 June | the June run is computed | the payslip shows a 6,000 advance recovery linked to the advance |
| 2 | the June run is finalised | recovery posts | the advance is cleared and the employee is eligible again |

### CMB-US-016 · Run the annual compensation revision cycle

As a **Manager / supervisor**, I want to allocate increases across my team on one worksheet with budget remaining shown live, so that I stay within budget while rewarding my strongest people.

Priority: **Must** · Use case: CMB-UC-006 · Realises: CMB-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a team budget of 3,00,000 and proposals totalling 2,80,000 | I add an 8% increase for one employee costing 30,000 | the worksheet shows budget remaining of -10,000 and flags the overrun |
| 2 | the overrun is flagged | I submit without a reason | submission is blocked until I reduce the proposal or add a budget exception reason |

### CMB-US-017 · Run the annual compensation revision cycle

As a **HR operations**, I want revision letters drafted from the approved figures and reviewed before issue, so that every employee receives a correct letter.

Priority: **Must** · Use case: CMB-UC-006 · Realises: CMB-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an approved revision for employee E1066 effective 1 April | I generate letters | a draft shows the new fixed pay and effective date and cannot be issued until reviewed |
| 2 | a letter was issued last year from template version 2 | I reprint it after version 3 is published | the reprint reproduces version 2 exactly |

### CMB-US-018 · Run the annual compensation revision cycle

As a **Payroll manager**, I want revisions with past effective dates to arrive with arrears computed, so that payroll does not hand-calculate back pay.

Priority: **Should** · Use case: CMB-UC-006 · Realises: CMB-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a revision effective 1 April approved on 20 May after April payroll is finalised | the cycle is locked | the May run receives the revision and an April arrears input |
| 2 | a revision effective in the open period | the cycle is locked | no arrears input is created |

### CMB-US-019 · Maintain salary structures and grade pay ranges

As a **Payroll manager**, I want to publish pay ranges per grade and location with effective dates, so that pay decisions reference a controlled range.

Priority: **Must** · Use case: CMB-UC-007 · Realises: CMB-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | grade M3 at Pune with minimum 9,00,000, midpoint 12,00,000 and maximum 15,00,000 | I publish effective 1 April | the range is active from 1 April and the previous range ends 31 March |
| 2 | a row with minimum 12,00,000 and midpoint 11,00,000 | I validate | the row is rejected naming minimum above midpoint |

### CMB-US-020 · Maintain salary structures and grade pay ranges

As a **HR operations**, I want to see compa-ratio and range penetration for every employee, so that I can target pay corrections fairly.

Priority: **Must** · Use case: CMB-UC-007 · Realises: CMB-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee in grade M3 at Pune earning 10,80,000 | the range above is published | compa-ratio shows 0.90 and penetration shows 30% |
| 2 | an employee earning 8,50,000 in the same range | the out-of-range list is opened | the employee appears as below minimum by 50,000 |

### CMB-US-021 · Maintain salary structures and grade pay ranges

As a **Manager / supervisor**, I want to see each team member's position in range on their profile card, so that my pay recommendations are grounded.

Priority: **Should** · Use case: CMB-UC-007 · Realises: CMB-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I manage four employees in grade M3 | I open the team view | each card shows compa-ratio without showing employees outside my subtree |
| 2 | an employee moves to grade M4 | the change is effective | compa-ratio is recomputed against the M4 midpoint |

### CMB-US-022 · Run merit, bonus and variable pay cycles

As a **Manager / supervisor**, I want guideline ranges pre-filled for each person based on rating and compa-ratio, so that my recommendations are consistent across the team.

Priority: **Must** · Use case: CMB-UC-008 · Realises: CMB-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a guideline of 8 to 10% for rating 4 with compa-ratio below 0.90 | an employee rated 4 with compa-ratio 0.85 appears on my worksheet | the recommendation pre-fills at 9% with the range 8 to 10% shown |
| 2 | I enter 12% for that employee | I try to submit | submission requires a justification for exceeding the guideline |

### CMB-US-023 · Run merit, bonus and variable pay cycles

As a **Finance**, I want pool utilisation visible across all worksheets, so that the cycle never overspends the approved pool.

Priority: **Must** · Use case: CMB-UC-008 · Realises: CMB-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a bonus pool of 50,00,000 | approved worksheets total 49,20,000 | utilisation shows 98.4% and the cycle can close |
| 2 | worksheets total 51,00,000 | closure is attempted | closure is blocked pending a recorded budget exception |

### CMB-US-024 · Run merit, bonus and variable pay cycles

As a **Payroll manager**, I want approved bonuses delivered as inputs to the named run, so that no spreadsheet upload is needed.

Priority: **Must** · Use case: CMB-UC-008 · Realises: CMB-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | approved bonuses for 320 employees targeting the March run | the cycle is closed | 320 bonus inputs appear in the March run |
| 2 | the March run is already finalised | the cycle closes | inputs move to the April run and I am notified |

### CMB-US-025 · Administer equity and ESOP grants

As a **Employee / worker**, I want to see my vested and unvested options at any time, so that I can plan an exercise.

Priority: **Should** · Use case: CMB-UC-009 · Realises: CMB-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a grant of 1,000 options on 1 April 2025 vesting 25% yearly | I view my equity on 2 April 2026 | 250 options show vested and 750 unvested |
| 2 | I exercised 100 options | I view my equity | 150 vested, 100 exercised and 750 unvested are shown |

### CMB-US-026 · Administer equity and ESOP grants

As a **Payroll manager**, I want the perquisite value of an exercise raised as a payroll input, so that tax is withheld in the correct month.

Priority: **Should** · Use case: CMB-UC-009 · Realises: CMB-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 100 options exercised at price 50 with fair market value 210 | finance confirms the exercise | a perquisite input of 16,000 is raised in the exercise month |
| 2 | no fair market value is recorded for the date | the exercise is submitted | it is held and finance receives a request for a value |

### CMB-US-027 · Enrol employees and dependants in group insurance

As a **Employee / worker**, I want to add my spouse and children to medical cover during the window, so that my family is protected from the policy start.

Priority: **Must** · Use case: CMB-UC-010 · Realises: CMB-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the window is open from 1 to 15 March and I have no dependants enrolled | I add a spouse and two children and submit on 10 March | enrolment is confirmed and all three dependants appear in the next insurer file |
| 2 | I add a parent aged 82 where the limit is 80 | I submit | the parent is rejected with the age limit shown |

### CMB-US-028 · Enrol employees and dependants in group insurance

As a **Employee / worker**, I want to buy a top-up with the monthly cost shown before I confirm, so that I know the impact on my net pay.

Priority: **Should** · Use case: CMB-UC-010 · Realises: CMB-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a top-up with annual premium 6,000 | I select it | the monthly deduction shows 500 and a payroll input is raised from the next run |
| 2 | I remove the top-up during the window | I resubmit | the deduction input is withdrawn |

### CMB-US-029 · Enrol employees and dependants in group insurance

As a **HR operations**, I want a life-event window opened only for the affected employee, so that mid-year additions are controlled.

Priority: **Must** · Use case: CMB-UC-010 · Realises: CMB-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | employee E1018 reports a birth on 5 July | the event is recorded | E1018 has a window until 4 August and others do not |
| 2 | the window lapses without submission | the date passes | the newborn is not added and HR is notified |

### CMB-US-030 · Manage NPS and superannuation contributions

As a **Employee / worker**, I want to choose my NPS contribution rate and see the monthly effect, so that I plan my retirement savings.

Priority: **Must** · Use case: CMB-UC-011 · Realises: CMB-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | allowed employer rates of 0%, 5% and 10% of basic and basic of 50,000 | I select 10% | the projection shows 5,000 per month from the next open period |
| 2 | I have not entered an account identifier | I confirm | confirmation is blocked asking for the identifier |

### CMB-US-031 · Manage NPS and superannuation contributions

As a **Payroll manager**, I want configured caps applied automatically every run, so that no contribution breaches the cap.

Priority: **Must** · Use case: CMB-UC-011 · Realises: CMB-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee whose employer contribution would exceed the configured cap by 1,200 | the run is computed | the excess of 1,200 is treated per plan configuration and flagged |
| 2 | a cap change effective 1 April | March is recomputed after 1 April | March uses the cap in force in March |

### CMB-US-032 · Allocate and reconcile a flexible benefits plan

As a **Employee / worker**, I want to split my flexi budget across items within their limits, so that I use the plan to my advantage.

Priority: **Should** · Use case: CMB-UC-012 · Realises: CMB-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an annual flexi budget of 1,20,000 and a meal limit of 26,400 | I allocate 26,400 to meal and 93,600 across other items | the allocation is accepted |
| 2 | I allocate 30,000 to meal | I save | the meal line is rejected naming the 26,400 limit |

### CMB-US-033 · Allocate and reconcile a flexible benefits plan

As a **Payroll manager**, I want unproven allocations taxed at year end automatically, so that annual tax computation is correct.

Priority: **Should** · Use case: CMB-UC-012 · Realises: CMB-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee allocated 24,000 to fuel and proved 18,000 | year end reconciliation runs | 6,000 is raised as a taxable input |
| 2 | all allocations are fully proved | reconciliation runs | no taxable residue input is raised |

### CMB-US-034 · View an annual total rewards statement

As a **Employee / worker**, I want to see the full value of my pay and benefits in one statement, so that I understand my total reward.

Priority: **Should** · Use case: CMB-UC-013 · Realises: CMB-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | fixed pay of 9,60,000, bonus of 80,000, employer PF of 21,600 and medical premium of 18,000 | I open my statement | each category shows the amount and the total shows 10,79,600 |
| 2 | I joined on 1 October | I open my statement | it states the period October to March |

### CMB-US-035 · View an annual total rewards statement

As a **HR operations**, I want statements withheld when totals do not reconcile, so that no employee receives a wrong statement.

Priority: **Should** · Use case: CMB-UC-013 · Realises: CMB-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee whose statement total differs from payroll by 2,000 | generation runs | that employee is excluded and listed for investigation |
| 2 | all totals reconcile | I publish | every employee in scope receives a statement |

### CMB-US-036 · Analyse pay equity and track remediation

As a **HR operations**, I want to see the gender pay gap adjusted for grade, location and tenure, so that I can distinguish structural gaps from unexplained ones.

Priority: **Must** · Use case: CMB-UC-014 · Realises: CMB-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a population of 1,200 employees with complete controls | I run the analysis by gender | both unadjusted and adjusted gaps are shown with the method note |
| 2 | a grade-location group with 4 members and a minimum size of 10 | results are produced | that group is suppressed as insufficient size |

### CMB-US-037 · Analyse pay equity and track remediation

As a **Director / approver**, I want remediation items with cost and status, so that I can approve a budget and see it applied.

Priority: **Must** · Use case: CMB-UC-014 · Realises: CMB-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 12 remediation items totalling 9,60,000 | I approve the budget | items move to approved and are routed into the next revision cycle |
| 2 | an approved item is applied in the revision cycle | the revision is effective | the item shows closed with the effective date |

### CMB-US-038 · Administer a retention bonus plan with vesting and clawback

As a **Employee / worker**, I want to see my retention award, vesting dates and clawback terms in one place, so that I understand what I will receive and what I would repay if I left.

Priority: **Should** · Use case: CMB-UC-015 · Realises: CMB-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1056 accepted a ₹2,00,000 award on 2026-12-01 vesting 40% at 12 months and 60% at 24 months | she opens her rewards page | she sees ₹80,000 vesting on 2027-12-01 and ₹1,20,000 on 2028-12-01 with the clawback terms |
| 2 | E1056 has not yet accepted the award | she opens the award letter | she must accept the clawback terms before the award shows as active |

### CMB-US-039 · Administer a retention bonus plan with vesting and clawback

As a **Payroll manager**, I want vested tranches to arrive as payroll inputs in the correct run, so that bonus payments follow the same controls as salary.

Priority: **Should** · Use case: CMB-UC-015 · Realises: CMB-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1056's first tranche of ₹80,000 vests on 2027-12-01 and the December run is open | vesting is evaluated | one payroll input of ₹80,000 appears in the December run |
| 2 | vesting is evaluated again for the same date | the job reruns | no second input is raised |

### CMB-US-040 · Administer a retention bonus plan with vesting and clawback

As a **Finance**, I want the deferred bonus liability accrued each month, so that the books reflect obligations that have been promised but not yet paid.

Priority: **Should** · Use case: CMB-UC-015 · Realises: CMB-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | ₹48,00,000 of awards with 24-month vesting are active | the November 2026 accrual is published | the accrual equals the earned portion of unvested tranches for the month |
| 2 | a tranche of ₹60,000 is forfeited | the next accrual runs | the accrued liability for that tranche is reversed |

### CMB-US-041 · Benchmark pay internally and flag outliers before a revision cycle

As a **HR operations**, I want to see compa-ratio by grade, site and tenure for one role family, so that I can spot inconsistent pay before the revision cycle opens.

Priority: **Must** · Use case: CMB-UC-016 · Realises: CMB-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | grade S3 has a midpoint of ₹3,60,000 a year and E1034 at Peenya Works earns ₹2,88,000 | I run the CNC machinist benchmark | E1034 is flagged with compa-ratio 0.80, below the 0.85 floor |
| 2 | the cell S4 at Oragadam with 5+ years has 3 employees and a minimum size of 5 | results are produced | that cell is suppressed and shown as insufficient size |

### CMB-US-042 · Benchmark pay internally and flag outliers before a revision cycle

As a **HR operations**, I want to see pay inversions between new joiners and experienced staff, so that I can correct compression created by recent hiring.

Priority: **Must** · Use case: CMB-UC-016 · Realises: CMB-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1068 joined Chakan Works in 2026 at ₹3,40,000 and E1021 with 6 years earns ₹3,20,000 in the same grade | the benchmark runs | the pair is flagged as an inversion |
| 2 | I tag E1021 for correction with ₹30,000 | I save the run | a pre-cycle recommendation of ₹30,000 appears for E1021 in the revision worksheet |

### CMB-US-043 · Benchmark pay internally and flag outliers before a revision cycle

As a **Manager / supervisor**, I want to see where my team sits in the pay band during the cycle, so that I can make fair merit proposals.

Priority: **Should** · Use case: CMB-UC-016 · Realises: CMB-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I manage 12 machinists at Peenya Works | I open the revision worksheet | I see each team member's band position and no data for employees outside my team |
| 2 | one of my team has a pre-cycle recommendation | I view that row | the recommendation and HR's reason are shown |

### CMB-US-044 · Compute statutory bonus and gratuity under the published rule pack

As a **Payroll manager**, I want to compute statutory bonus for the whole entity in one run with eligibility shown, so that I can pay bonus correctly and explain every exclusion.

Priority: **Must** · Use case: CMB-UC-017 · Realises: CMB-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the rule pack for 2025-26 is published and Legal-validated with a minimum working-day requirement of 30 days | I run the bonus computation | E1022, who worked 24 days after joining, is listed ineligible with 24 days shown |
| 2 | the director has declared a rate of 8.33% within the configured range | the computation completes | each eligible employee's working shows rate, capped salary and months, and payroll inputs are raised in the bonus run |

### CMB-US-045 · Compute statutory bonus and gratuity under the published rule pack

As a **Employee / worker**, I want to see how my gratuity was calculated at exit, so that I can trust the final settlement.

Priority: **Must** · Use case: CMB-UC-017 · Realises: CMB-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1019 separates on 2026-11-30 after 7 years 8 months with last drawn basic plus DA of ₹26,000 | gratuity is computed | the working shows 15/26 × ₹26,000 × 8 years = ₹1,20,000 with the rounding of 8 months noted |
| 2 | E1019 had 4 years 2 months of service and resigned | gratuity eligibility is tested | no gratuity is raised and the unmet service threshold is shown |

### CMB-US-046 · Compute statutory bonus and gratuity under the published rule pack

As a **Compliance owner**, I want statutory registers produced from the same computation that paid employees, so that inspections reconcile without manual rework.

Priority: **Should** · Use case: CMB-UC-017 · Realises: CMB-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the 2025-26 bonus run has been paid | I open the bonus register | each row matches the paid payroll input to the rupee |
| 2 | a payroll input is reversed after payment | the register is viewed | the reversal is shown with date and reason |

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
| Size | 138 | specified items (table rows) | Counted automatically at generation |
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
