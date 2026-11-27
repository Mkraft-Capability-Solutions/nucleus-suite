<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# BA-05 — Approval Workflow Catalogue

| Attribute | Value |
| :--- | :--- |
| Document ID | BA-05 |
| Title | Approval Workflow Catalogue |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Business Analyst Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | BA-06, NOT-01, FRS-PLT-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 07_Approval_Workflows<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 64_Approval_Workflows |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

All approval chains run on the single shared approval engine (CMP-01); a per-module approval table is a design defect.

## 1. Workflow catalogue

| Workflow ID | Workflow | Form ID | Requirement | Approval chain | How it behaves | What must hold |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| W-01 | Leave application | F-LVE-03 | R-06 | Supervisor → HOD → HR Head | Each level records the actor and the timestamp. HR Head may return to the applicant with a reason. | HR can update an approved leave; the update is recorded against the HR user, not the original approver. |
| W-02 | Leave early return | F-LVE-04 | R-06 | HR Head | Single level, because the leave was already approved and this only releases unused days. | The attendance correction and the ledger credit must commit together or not at all. |
| W-03 | Overtime | F-OTM-01 | R-01, R-11 | Supervisor → HOD | OT is approved against computed hours; an approver may reduce but not increase them. | Approval must complete before the OT payment run picks the record up. |
| W-04 | Gate pass | F-GPS-01 | R-12 | Reporting manager | Only an approved pass credits work hours. | The entitlement check runs at submission and again at approval, since another pass may have been approved in between. |
| W-05 | Loan application | F-LON-01 | R-10 | HOD → HR Head → Finance | Eligibility, ceiling and guarantor checks run at submission, not at disbursement. | Where special terms are applied a Director approval step is inserted and cannot be skipped. |
| W-06 | Loan special terms | F-LON-01 | R-10 | Director | A separate recorded approval that carries the reason for the override. | Stored as an approval record so it survives an edit to the loan. |
| W-07 | No dues clearance | F-FNF-02 | R-17 | One sign-off per department | Parallel, not sequential — departments clear independently. | F&F release is blocked until every line is Cleared or Waived with a reason. |
| W-08 | Full and final settlement | F-FNF-01 | R-17 | HR Head → Finance | Runs after no dues is complete. | The source asks for same-day settlement, so the workflow must be short enough to close on the last working day. |
| W-09 | Manpower requisition | F-REC-02 | R-26 | HOD → HR Head | Where the sanctioned strength is exceeded, an additional approval level is required. | A replacement against a vacated position code does not consume incremental headcount. |

## 2. Workflow behaviour

| Workflow | Name | Form | Chain | Sequential or parallel | Recorded per level | Escalation | Delegation allowed | Return to applicant | Live demo record | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| W-01 | Leave application | F-LVE-03 / FRM-LVE-02 | Supervisor → HOD → HR Head | Sequential | Actor, decision, timestamp, comment | After 3 days to the next level | Y | HR Head only, with a reason | LV-2026-0774 — E1039, then E1039 as HOD, then E1004 on 06 Sep | Point 5 |
| W-02 | Leave early return | F-LVE-04 | HR Head | Single level | Actor, decision, timestamp, days released | None | N | N | LV-2026-0774 closed by E1006 on 14 Sep with 3 days credited back, and RG-2026-0214 written in the same commit | Point 5 |
| W-03 | Overtime | F-OTM-01 | Supervisor → HOD | Sequential | Actor, decision, timestamp, hours approved | After 2 days | Y | Y | OT-2026-0912 — E1017 approved 7h20m on 09 Sep | Points 1, 10 |
| W-04 | Gate pass | F-GPS-01 | Reporting manager | Single level | Actor, decision, timestamp | None | Y | N | GP-2026-0163 rejected by E1024 on the monthly ceiling. The entitlement is checked at submission and again at approval, because another pass may have been approved in between. | Point 11 |
| W-05 | Loan application | F-LON-01 | HOD → HR Head → Finance | Sequential | Actor, decision, timestamp, eligibility snapshot | After 5 days | N | Y | LN-APP-2026-0014 rejected at eligibility before the chain started | Point 9 |
| W-06 | Loan special terms | F-LON-01 | Director | Inserted step, cannot be skipped | Actor, decision, timestamp, override reason | None | N | N | LN-2026-0012 — E1001 sanctioned 150,000 against an 86,000 ceiling as a recorded approval, not an edit | Point 9 |
| W-07 | No dues clearance | F-FNF-02 | One sign-off per department | Parallel | Actor, decision, timestamp, recovery amount, waiver reason | After 5 days to HR | Y | N | E1042 — four cleared, two open, both blocking | Point 16 |
| W-08 | Full and final settlement | F-FNF-01 | HR Head → Finance | Sequential | Actor, decision, timestamp | None | N | Y | FF-2026-0021 released on the last working day; FF-2026-0018 held | Point 16 |
| W-09 | Manpower requisition | F-REC-02 | HOD → HR Head, plus a level when sanction is exceeded | Sequential | Actor, decision, timestamp, sanction check result | After 5 days | Y | Y | REQ-2026-0041 blocked at approval because Machining is at full sanction | Points 24, 25 |
| W-10 | Attendance regularisation | F-ATT-04 | Reporting manager | Single level | Actor, decision, timestamp, original and corrected status | After 3 days | Y | Y | RG-2026-0220 rejected — a regularisation cannot create a rest-day entitlement the worker class does not carry | Point 2 |

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
| Size | 19 | specified items (table rows) | Counted automatically at generation |
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
