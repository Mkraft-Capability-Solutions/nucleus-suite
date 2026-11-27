<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-02 — Leave — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-02 |
| Title | Leave — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Leave |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Leave

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-170 | Accrual is bound to the leave band through an accrual policy. | policy set | LP-01 to LP-12 | leave_accrual_policy | LVE-01.1 | TC-L170 |
| RL-171 | Standard-band employees accrue no earned leave for six months, then receive a single credit on completion. | wait_months, credit_on_completion | 6 months, 9 days | leave_accrual_policy | LVE-01.2 | TC-L171 (demo point 7) |
| RL-172 | Accrual and expiry jobs are idempotent per person, type, period and transaction type. | idempotency_key | Unique index | Schema | LVE-01.3, LVE-06.3 | TC-L172 |
| RL-173 | AGM and above receive 18 EL, 6 CL and 6 SL on 1 January; all others 1.5 EL per month plus 6 CL and 6 SL. | band values | As stated | leave_accrual_policy | LVE-01.4 | TC-L173 |
| RL-180 | Casual and sick leave for a new joiner are prorated by joining month from a table. | proration rows | Jan 6 · Feb-Mar 5 · Apr-May 4 · Jun-Jul 3 · Aug-Sep 2 · Oct-4 Dec 1 | leave_proration_rule | LVE-02.1 | TC-L180 (demo point 7) |
| RL-181 | Prorated credits post to the ledger citing the proration rule as source. | — | Always | Code invariant | LVE-02.2 | TC-L181 |
| RL-182 | Leave eligibility follows the worker class; ineligible classes accrue nothing. | leave_eligible | Contract, third-party, consultant, gig = N | worker_class | LVE-02.3 | TC-L182 |
| RL-190 | A leave request captures type, dates, half-day flags and reason. | — | Per type | Config | LVE-03.1 | TC-L190 |
| RL-191 | Balance is projected from the ledger as at the leave start date, honouring per-credit expiry. | — | Projection | Code invariant | LVE-03.2, LVE-08.1 | TC-L191 |
| RL-192 | Casual leave cannot be taken with, or merged into, earned or sick leave. | excluded_with | CL excludes EL and SL | leave_combination_rule | LVE-03.3 | TC-L192 (demo point 7) |
| RL-193 | Monthly caps: two casual leave days and ten earned leave days per calendar month. | max_per_month | CL 2, EL 10 | leave_type | LVE-03.4 | TC-L193 (demo point 7) |
| RL-194 | Validation runs before the approval chain starts and the message names the rule that blocked it. | — | Before chain | Code invariant | LVE-03.3, LVE-03.4 | TC-L194 |
| RL-195 | Approval debits the ledger against the specific credits consumed, so a reversal knows where to return days. | — | Credit-referenced | Code invariant | LVE-04.3 | TC-L195 |
| RL-200 | Early return records the actual return date inside the approved span. | — | Enforced | Code invariant | LVE-05.1 | TC-L200 (demo point 5) |
| RL-201 | The reversal row and the attendance recompute happen in ONE transaction. | — | Atomic | Code invariant | LVE-05.2 | TC-L201 |
| RL-202 | Days after the actual return become Present or their punch-derived status. | — | Recomputed | Code invariant | LVE-05.3 | TC-L202 |
| RL-203 | An early return affecting a locked period produces arrears, not a change to the closed run. | — | Arrears | Code invariant | LVE-05.4 | TC-Y203 |
| RL-210 | Each comp-off credit carries its own expiry clock from its own credit date. | expiry_days | 60 | leave_type | LVE-06.1 | TC-L210 (demo point 6) |
| RL-211 | Comp-off consumption draws from the earliest-expiring open credit first. | — | FEFO | Code invariant | LVE-06.2 | TC-L211 |
| RL-212 | Unconsumed comp-off lapses by a Lapse row on its own expiry date. | — | Nightly, idempotent | Code invariant | LVE-06.3 | TC-L212 |
| RL-213 | A comp-off clock may cross the leave-year boundary; the year end does not truncate it. | — | Crosses | Code invariant | LVE-06.4 | TC-L213 |
| RL-220 | At year end earned leave encashes above the carry-forward cap; casual and sick leave lapse. | carry_forward_cap | 45 days EL | leave_type | LVE-07.1 | TC-L220 |
| RL-221 | Encashment is raised as a payroll input computed on the statutory wage base. | — | Wage base | Code invariant | LVE-07.2 | TC-Y221 |
| RL-222 | Birthday leave is a separate credit with its own eligibility window. | window | Per client policy | leave_type | LVE-07.3 | TC-L222 |
| RL-230 | Balance = credits − debits − lapses − encashments + reversals, as at a date. | — | Projection | Code invariant | LVE-08.1 | TC-L230 |
| RL-231 | The balance screen exposes the transactions that produced it. | — | Always | Product | LVE-08.2 | TC-L231 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

| Rule ID | Module | Rule | Requirement | Statement | Worked example | Where it is configured |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BS:RL-06 | LVE | COFF expiry | R-07 | COFF expires on the earned date plus the lapse days held on the employee. A nightly job moves any COFF still Available on its expiry date to Lapsed and writes a ledger entry naming the run. | COFF earned 10 March with a 60-day window lapses on 9 May. | Employee Master and Leave Scheme Master — COFF lapse days |
| BS:RL-07 | LVE | Annual leave credit for senior grades | R-08 | Employees at or above the configured grade rank receive 18 EL, 6 CL and 6 SL credited on 1 January. | An AGM on the rolls on 1 January receives the full annual entitlement that day. | Leave Scheme Master — accrual rules |
| BS:RL-08 | LVE | Monthly EL accrual for other employees | R-08 | Employees below the senior grade receive 6 CL and 6 SL in January and 1.5 EL each month from January to December. | Twelve monthly accruals of 1.5 give 18 EL across the year. | Leave Scheme Master — accrual rules |
| BS:RL-09 | LVE | New joiner EL hold and catch-up | R-08 | A new joiner accrues no EL until six months of service are complete. On completing six months the employee receives 9 EL in one credit, not six monthly accruals. | Joining 1 March, EL eligibility begins 1 September with a 9-day credit. | Leave Scheme Master — minimum service months and catch-up quantity |
| BS:RL-10 | LVE | New joiner CL and SL proration | R-08 | CL and SL for a new joiner are credited by joining month: January 6 each; February or March 5; April or May 4; June or July 3; August or September 2; October, November or up to 4 December 1. The source does not state the entitlement for joining after 4 December. | Joining 20 April gives 4 CL and 4 SL. | Leave Scheme Master — proration table |
| BS:RL-11 | LVE | Leave combination restriction | R-08 | CL may not be taken with EL or SL and may not be merged with them. The check must run across a contiguous absence, including where the two leave types are applied for separately. | 2 CL immediately followed by 3 EL is one contiguous absence and must be blocked. | Leave Scheme Master — restriction matrix |
| BS:RL-12 | LVE | Monthly availing caps | R-08 | A maximum of 2 CL and 10 EL may be availed in a calendar month, counting days already approved in that month. | With 2 CL already approved in June, a third CL day in June is blocked. | Leave Scheme Master — maximum availed per month |
| BS:RL-13 | LVE | Trainee CL eligibility | R-08 | Trainees carrying a DET or GET trainee type are eligible for CL. Other trainee types are not, unless the scheme says otherwise. | A GET trainee accrues CL on the trainee scheme; an apprentice outside those two types does not. | Employee Master — trainee type; Leave Scheme Master |
| BS:RL-14 | LVE | Year-end treatment | R-08 | At year end EL is encashed and CL and SL lapse. The run has a preview mode that produces identical figures without writing. | A closing balance of 7 EL, 2 CL and 3 SL encashes 7 days and lapses 5. | Leave Scheme Master — year-end treatment per type |
| BS:RL-15 | LVE | Early return from leave | R-06 | Where an employee returns before the approved end date, the unused days are released: attendance for those days is marked present and the leave ledger receives a reversal against the original availing. | A 10-day leave with return on day 7 releases days 7 to 10 — 4 days back to balance and 4 days marked present. | Not configurable — policy stated |

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
| Size | 36 | specified items (table rows) | Counted automatically at generation |
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
