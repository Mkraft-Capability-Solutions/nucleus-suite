<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-11 — Lifecycle — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-11 |
| Title | Lifecycle — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Lifecycle |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 27_Exit_Clearance, 33_Assets, 34_Induction_Learning, 60_Confirmations, 61_Preboarding_Chain |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Settlement date | FNF | F-FNF-01 — Full & Final Settlement | Last working date | HR roles only | R-17 | Yes |
| No dues status | FNF | F-FNF-01 — Full & Final Settlement | Pending | HR roles only | R-17 | Yes — value set configurable per tenant |
| Department | FNF | F-FNF-02 — No Dues Clearance Checklist | — | All roles | R-17 | Yes |
| Clearance item | FNF | F-FNF-02 — No Dues Clearance Checklist | — | All roles | R-17 | Yes |
| Status | FNF | F-FNF-02 — No Dues Clearance Checklist | Pending | All roles | R-17 | Yes — value set configurable per tenant |
| Recovery amount | FNF | F-FNF-02 — No Dues Clearance Checklist | 0.00 | HR roles only | R-17 | Yes |
| Induction item | ONB | F-ONB-01 — Induction Checklist | — | All roles | R-24 | Yes |
| Completion status | ONB | F-ONB-01 — Induction Checklist | Pending | All roles | R-24 | Yes |
| Recovery value if not returned | ONB | F-ONB-02 — Asset Allocation | 0.00 | HR roles only | R-24, R-17 | Yes |

## 2. Reference and golden data

### `27_Exit_Clearance` (13 rows)

| Employee code | Name | Resigned on | Last working day | Notice served | Checklist item | Owner | Blocking | Status | Cleared on | F&F state | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E1068 | Dinesh Vaidya | 2026-08-31 | 2026-09-30 | 30 | Laptop and accessories returned | E1012 | Y | Cleared | 2026-09-24 | Ready to settle on LWD | Point 16 |
| E1068 | Dinesh Vaidya |  |  |  | Knowledge transfer signed off | E1039 | Y | Cleared | 2026-09-22 |  | Point 16 |
| E1068 | Dinesh Vaidya |  |  |  | Library and document return | E1009 | N | Cleared | 2026-09-18 |  |  |
| E1068 | Dinesh Vaidya |  |  |  | Advance and loan settlement | E1007 | Y | Cleared | 2026-09-25 |  |  |
| E1068 | Dinesh Vaidya |  |  |  | ID card and access revocation | E1012 | Y | Cleared | 2026-09-30 |  |  |
| E1068 | Dinesh Vaidya |  |  |  | Exit interview | E1006 | N | Cleared | 2026-09-26 |  |  |
| E1042 | Swapnil Kadam | 2026-08-19 | 2026-09-18 | 30 | Tool kit and locker key returned | E1040 | Y | Open |  | Held — two blocking items open | Point 16 |
| E1042 | Swapnil Kadam |  |  |  | Safety shoes and PPE returned | E1040 | N | Cleared | 2026-09-15 |  |  |
| E1042 | Swapnil Kadam |  |  |  | Knowledge transfer signed off | E1040 | Y | Open |  |  | Point 16 — this is what blocks same-day settlement |
| E1042 | Swapnil Kadam |  |  |  | Advance and loan settlement | E1007 | Y | Cleared | 2026-09-16 |  |  |
| E1042 | Swapnil Kadam |  |  |  | ID card and access revocation | E1012 | Y | Cleared | 2026-09-18 |  |  |
| E1042 | Swapnil Kadam |  |  |  | Exit interview | E1055 | N | Open |  |  |  |
| Clearance runs in parallel with notice, which is the only way full and final settles on the last working day. E1068 is fully cleared and settles on the LWD. E1042 has two open blocking items and F&F is held — demonstrate the block, clear the items, then release. |  |  |  |  |  |  |  |  |  |  |  |

### `33_Assets` (10 rows)

| Asset code | Type | Description | Serial | Status | Allocated to | Name | Issued on | Returned on | Condition | Clearance item at exit | Demo point | Recovery value if not returned (INR) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AST-L-0412 | Laptop | ThinkPad E14, 16GB | PF3XK220 | Allocated | E1066 | Abhinav Rastogi | 2026-09-01 |  | Good | Y | Point 23 | 58000 |
| AST-M-0908 | Mobile handset | Redmi Note 14 | RN14-889201 | Allocated | E1066 | Abhinav Rastogi | 2026-09-01 |  | Good | Y | Point 23 | 14000 |
| AST-A-1155 | Access card | Chakan Works, Zone B | CHK-B-1155 | Allocated | E1066 | Abhinav Rastogi | 2026-09-01 |  | Good | Y | Point 23 | 500 |
| AST-L-0298 | Laptop | ThinkPad E14, 8GB | PF2WQ118 | Returned | E1068 | Dinesh Vaidya | 2019-05-06 | 2026-09-24 | Good, battery replaced 2024 | Y | Point 16 | 0 |
| AST-T-0077 | Tool kit | Fitter kit, 42 pieces | TK-0077 | Allocated | E1042 | Swapnil Kadam | 2022-09-05 |  | Pending return | Y | Point 16 — open blocking clearance item | 12000 |
| AST-K-0231 | Locker key | Chakan Works, locker 231 | LK-231 | Allocated | E1042 | Swapnil Kadam | 2022-09-05 |  | Pending return | Y | Point 16 — open blocking clearance item | 500 |
| AST-P-0512 | PPE set | Safety shoes, helmet, goggles | PPE-0512 | Returned | E1042 | Swapnil Kadam | 2022-09-05 | 2026-09-15 | Worn, written off | N |  | 0 |
| AST-L-0388 | Laptop | ThinkPad L14 | PF3AB771 | Allocated | E1065 | Ishita Chatterjee | 2026-08-17 |  | Good | Y |  | 62000 |
| AST-A-1198 | Access card | Bengaluru Office | BLR-1198 | Allocated | E1065 | Ishita Chatterjee | 2026-08-17 |  | Good | Y |  | 500 |
| Assets allocated in the joining chain reappear as blocking clearance items at exit. E1042's unreturned tool kit and locker key are the same items that hold his F&F in sheet 27. ADDED v1.1: recovery value, which field spec F-ONB-02 requires and v1.0 omitted. E1042's unreturned tool kit and locker key are 12,500 between them, and that is the figure that appears as a deduction in 58_FnF_Settlement. Without it the clearance checklist blocks a settlement but cannot price it. |  |  |  |  |  |  |  |  |  |  |  |  |

### `34_Induction_Learning` (11 rows)

| Record | Employee code | Name | Item | Type | Assigned on | Due on | Completed on | Status | Trigger | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| IND-2026-0088 | E1066 | Abhinav Rastogi | Day 1 — welcome and organisation overview | Induction session | 2026-09-01 | 2026-09-01 | 2026-09-01 | Completed | Joining chain | Point 23 |
| IND-2026-0089 | E1066 | Abhinav Rastogi | Factory safety induction | Mandatory learning | 2026-09-01 | 2026-09-03 | 2026-09-02 | Completed | Joining chain | Point 23 |
| IND-2026-0090 | E1066 | Abhinav Rastogi | POSH awareness | Mandatory learning | 2026-09-01 | 2026-09-15 |  | In progress | Joining chain | Point 23 |
| IND-2026-0091 | E1066 | Abhinav Rastogi | Code of conduct acknowledgement | Policy acknowledgement | 2026-09-01 | 2026-09-05 | 2026-09-02 | Completed | Joining chain | Point 23 |
| IND-2026-0092 | E1066 | Abhinav Rastogi | Form F — particulars of worker | Statutory form | 2026-09-01 | 2026-09-01 | 2026-09-01 | Completed | Joining chain | Point 26 |
| IND-2026-0093 | E1066 | Abhinav Rastogi | Warehouse management systems, module 1 | Role learning path | 2026-09-01 | 2026-10-15 |  | Not started | Role assignment | Point 23 |
| IND-2026-0081 | E1065 | Ishita Chatterjee | Factory safety induction | Mandatory learning | 2026-08-17 | 2026-08-19 | 2026-08-18 | Completed | Joining chain |  |
| IND-2026-0082 | E1065 | Ishita Chatterjee | POSH awareness | Mandatory learning | 2026-08-17 | 2026-08-31 | 2026-08-26 | Completed | Joining chain |  |
| MND-2026-0455 | E1019 | Sneha Nair | POSH refresher | Mandatory learning | 2026-08-01 | 2026-09-07 |  | Overdue | Annual policy cycle |  |
| MND-2026-0461 | E1022 | Mohan Joseph | Machine guarding refresher | Mandatory learning | 2026-09-01 | 2026-09-30 |  | In progress | Annual policy cycle |  |
| Induction and the statutory joining form are both steps in the same joining chain, so Form F is produced as part of onboarding rather than chased in an audit week. |  |  |  |  |  |  |  |  |  |  |

### `60_Confirmations` (6 rows)

| Record | Employee code | Name | Date of joining | Probation months | Confirmation due | Mandatory induction complete | Manager recommendation | Action | Status | Blocked by | Letter issued | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CF-2026-0041 | E1058 | Karthik Chidambaram | 2026-03-01 | 6 | 2026-09-01 | Y | Confirm | Confirm | Confirmed 2026-09-01 |  | LTR-2026-0338 | Point 21 |
| CF-2026-0052 | E1066 | Abhinav Rastogi | 2026-09-01 | 6 | 2027-03-01 | N |  |  | Not due | POSH awareness IND-2026-0090 is still in progress. Confirmation cannot be actioned while a mandatory induction item is open, whatever the manager recommends. |  | Point 23 |
| CF-2026-0049 | E1065 | Ishita Chatterjee | 2026-08-17 | 6 | 2027-02-17 | Y |  |  | Not due | Nothing blocking. Her referral award balance matures on this date, which is why the two records have to agree. |  | Points 19, 23 |
| CF-2026-0047 | E1067 | Ankita Bhargava | 2026-03-16 | 6 | 2026-09-16 | Y | Confirm | Confirm | Pending HR action |  |  | Point 7 — her six-month EL credit and her confirmation fall on the same day, from the same date of joining |
| CF-2026-0038 | E1060 | Jayanthi Elangovan | 2026-04-06 | 6 | 2026-10-06 | Y | Extend probation | Extend probation | Recommended for extension | Performance below the line at the mid-probation review |  |  |
| ADDED v1.1 for form FRM-LCY-02. This is the sheet that makes the second half of demo point 23 real: the acceptance test says confirmation must be blocked while a mandatory induction item is pending, and CF-2026-0052 is that case sitting live in the tenant. E1067 is worth naming too — the same date of joining drives her leave catch-up and her confirmation, and a product that derives both from one field is making a point about itself. |  |  |  |  |  |  |  |  |  |  |  |  |

### `61_Preboarding_Chain` (10 rows)

| Record | Candidate | Name | Offer | Joining date | Location | Chain step | Owner | Due | Status | Blocks joining | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PB-2026-0071 | CN-2026-0211 | Basanti Naik | OF-2026-0071 | 2026-10-05 | LOC-PLA | Offer acceptance recorded | E1006 | 2026-09-20 | Waiting on the requisition block | Y | Points 24, 25 — the chain cannot start while the requisition is held at sanctioned strength |
| PB-2026-0071 | CN-2026-0211 | Basanti Naik | OF-2026-0071 | 2026-10-05 | LOC-PLA | Document collection | E1008 | 2026-09-28 | Not started | Y |  |
| PB-2026-0071 | CN-2026-0211 | Basanti Naik | OF-2026-0071 | 2026-10-05 | LOC-PLA | Medical fitness certificate | E1009 | 2026-09-30 | Not started | Y | Factory Act requirement, not an HR nicety |
| PB-2026-0071 | CN-2026-0211 | Basanti Naik | OF-2026-0071 | 2026-10-05 | LOC-PLA | Employee code and Form F generation | E1009 | 2026-10-05 | Not started | Y | Point 26 — Form F is produced inside this chain, not chased later. She is also the October joiner that proration rule PR-06 has no employee for: 1 CL and 1 SL on joining. |
| PB-2026-0066 | CN-2026-0188 | Abhinav Rastogi | OF-2026-0066 | 2026-09-01 | LOC-PUN | Offer acceptance recorded | E1006 | 2026-08-18 | Complete 2026-08-18 | Y |  |
| PB-2026-0066 | CN-2026-0188 | Abhinav Rastogi | OF-2026-0066 | 2026-09-01 | LOC-PUN | Document collection | E1008 | 2026-08-28 | Complete 2026-08-27 | Y | Point 23 |
| PB-2026-0066 | CN-2026-0188 | Abhinav Rastogi | OF-2026-0066 | 2026-09-01 | LOC-PUN | Employee code and Form F generation | E1009 | 2026-09-01 | Complete 2026-09-01 — FRM-F-2026-0112 | Y | Point 26 |
| PB-2026-0066 | CN-2026-0188 | Abhinav Rastogi | OF-2026-0066 | 2026-09-01 | LOC-PUN | Induction path and asset allocation | E1012 | 2026-09-01 | Complete 2026-09-01 — 3 assets issued | N | Point 23 |
| PB-2026-0066 | CN-2026-0188 | Abhinav Rastogi | OF-2026-0066 | 2026-09-01 | LOC-PUN | New joiner announcement | System | 2026-09-01 | Complete — AN-2026-0091 | N | Point 20 |
| ADDED v1.1 for form FRM-LCY-01. Run the two candidates in parallel. Abhinav Rastogi is the completed chain, and every downstream record in the dataset — the Form F instance, the three assets, the induction items, the announcement, the appointment letter — was raised by a step in it rather than typed afterwards. Basanti Naik is the same chain stopped at step one by a headcount control, and she is also the October joiner that the proration table in sheet 16 had no record for. |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 59 | specified items (table rows) | Counted automatically at generation |
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
