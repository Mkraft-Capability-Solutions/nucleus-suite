<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# KI-01 — Source Data Conflicts

| Attribute | Value |
| :--- | :--- |
| Register | KI-01 |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Author | Dhanraj Dadhich |
| Date | 2026-11-05 |
| Scope | Contradictions between sheets of the source workbooks |

Each conflict needs one answer from the client or domain owner; the source workbook is then corrected and the requirements updated through a change request.

| ID | Issue | Evidence | Impact | Recommended resolution | Owner (role) | Needed by | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| KI-001 | Loan ceiling boundary differs between rules | RL-433 applies the six-times ceiling for service *above* five years; BS:RL-22 for *five years or more* | Eligibility differs for employees with exactly five years of service | Adopt five completed years or more (client wording) and amend RL-433 | Compensation Product Owner with client HR Head | P1 G1 | Open — client decision |
| KI-002 | Year-end leave expected result contradicts the rule | RL-220 encashes earned leave only above the 45-day carry-forward cap; acceptance test T-17 encashes all 7 days of an employee holding 7 | Year-end balances, encashment cost and payroll input | If RL-220 stands, change T-17 to 7 days carried forward and 5 days lapsed; otherwise change RL-220 | Leave Product Owner with client | P1 G1 | Open — client decision |
| KI-003 | Early-return example differs from its golden record | Build-sheet T-08: return on day 7 → 4 days credited; dataset LV-2026-0774 (7–16 Sep, back on 14 Sep) → 3 days | Test and data disagree although both are arithmetically correct | Rewrite T-08 setup to the dataset record (return on day 8, 3 days credited) | QA / Test Lead | P1 G1 | Open |
| KI-004 | Recompute reason count differs | RL-150 states 6 reasons; step TIM-09.1 lists 7 (late punch, regularisation, rule change, roster republish, policy/class change, gate pass, leave reversal) | Recompute triggers may be missed | Amend RL-150 to seven reasons | Time & Attendance Product Owner | P1 G1 | Open |
| KI-005 | Actor who closed the early return differs | Demo user U-005 (E1004, HR Head) closes LV-2026-0774; 18_Leave_Requests, workflow W-02 demo record and RG-2026-0214 name E1006 | Audit expectations in acceptance tests | Set the closer to E1004 in the three dataset rows, matching W-02 (HR Head, single level) | QA / Test Lead | P1 G1 | Open |
| KI-006 | Employee E1066 location differs | Form F record filed under Karnataka (LOC-PLA); all other sheets place E1066 at Chakan Works (LOC-PUN, Maharashtra) | Statutory form jurisdiction and golden-data reconciliation | Move the Form F record to LOC-PUN | QA / Test Lead | P0 G1 | Open |
| KI-007 | Contractor invoice passes despite a missing challan | INV-VN01-2608 passes while vendor VN-01's August challan is missing; capability gap CTG-CG-002 requires challans before approval | Invoice validation tests would accept an invalid invoice | Change the expected result to 'Held — challan missing' | Contingent Workforce Product Owner | P2 G1 | Open |
| KI-008 | Unmatched ERP employee picklist allows creation | PL_UNMATCHED_ACTION offers 'Create'; RL-516 forbids creating a person from an unmatched external code | Inbound master behaviour ambiguous | Remove 'Create'; unmatched records stay parked (decide with OD-07) | Integration Architect with Finance & ERP Product Owner | P1 G2 | Open |
| KI-009 | Same-day full-and-final has no escalation | W-08 (HR Head → Finance) has no escalation, yet R-17 requires settlement on the last working day; NOT-01 assumes hourly reminders from 12:00 | Same-day settlement commitment at risk | Add escalation on the last working day: HR Head 2 h → Finance 2 h → CFO; confirm reminder timing | Lifecycle Product Owner with client | P1 G1 | Open — client decision |
| KI-010 | Statutory form titles differ across sources | 29_Statutory_Forms names Form 18 the leave-with-wages register and Form 36 the muster roll; other material uses Form 18 for notice of accident and Form 36 for the inspection book; Form F used for both factory particulars and gratuity nomination | Wrong form generated or labelled | Confirm official titles per state rules (client question Q-13) and define each form separately | Compliance Product Owner with Legal | P1 G1 | Open — Legal |
| KI-011 | Peenya Works has no location holiday list | 09_Holiday_Calendar lists LOC-PLA only through 'ALL' holidays | Day-type resolution, sandwich rule and OT at LOC-PLA | Add the Karnataka festival holidays for LOC-PLA to the dataset | Leave Product Owner with client | P0 G1 | Open |
| KI-012 | Kannada absent from base interface languages | Two pilot sites (LOC-BLR, LOC-PLA) are in Karnataka | Adoption at the Karnataka sites | Delivered by capability gap PLT-CG-017 (expanded Indian language coverage) | Product Owner | P2 | Resolved in documentation — pending approval of PLT-CG-017 |
