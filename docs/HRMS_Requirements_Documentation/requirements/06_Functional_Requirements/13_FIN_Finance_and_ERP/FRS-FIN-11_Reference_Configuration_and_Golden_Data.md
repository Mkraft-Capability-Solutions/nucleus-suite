<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-FIN-11 — Finance & ERP — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-FIN-11 |
| Title | Finance & ERP — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Finance & ERP |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-FIN-00, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-FIN-04, FRS-FIN-05, FRS-FIN-06, FRS-FIN-07, FRS-FIN-08, FRS-FIN-09, FRS-FIN-10, FRS-FIN-11, FRS-FIN-12, FRS-FIN-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-07 · R-15, R-16 · processes FIN-01–FIN-05 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 35_GL_Mapping, 36_ERP_Inbound_Master, 56_GL_Journal |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Master owner | INT | F-INT-01 — ERP Employee Master Sync | ERP | HR roles only | R-15 | Yes — value set configurable per tenant |
| Last sync status | INT | F-INT-01 — ERP Employee Master Sync | — | HR roles only | R-15 | Yes — value set configurable per tenant |
| Account code | INT | F-INT-02 — Payroll Account Posting | — | Payroll and HR roles only | R-16 | Yes |
| Cost centre | INT | F-INT-02 — Payroll Account Posting | From the employee department | Payroll and HR roles only | R-16 | Yes |

## 2. Reference and golden data

### `35_GL_Mapping` (28 rows)

| Mapping ID | Entity | Pay component / head | Dr / Cr | GL account code | GL account name | Cost centre source | Dimensioned by | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GL-001 | LE-01 | Basic | Dr | 5010100 | Salaries and Wages | Assignment cost centre | Cost centre, department, location, project | Point 15 |
| GL-002 | LE-01 | Dearness allowance | Dr | 5010100 | Salaries and Wages | Assignment cost centre | Cost centre, department, location, project |  |
| GL-003 | LE-01 | House rent allowance | Dr | 5010200 | Allowances | Assignment cost centre | Cost centre, department, location |  |
| GL-004 | LE-01 | Conveyance | Dr | 5010200 | Allowances | Assignment cost centre | Cost centre, department, location |  |
| GL-005 | LE-01 | Special allowance | Dr | 5010200 | Allowances | Assignment cost centre | Cost centre, department, location |  |
| GL-006 | LE-01 | Overtime | Dr | 5010300 | Overtime | Assignment cost centre | Cost centre, department, location, run type | Point 10, 15 |
| GL-007 | LE-01 | Employer PF contribution | Dr | 5010400 | Employer Contributions | Assignment cost centre | Cost centre, department |  |
| GL-008 | LE-01 | Employer ESI contribution | Dr | 5010400 | Employer Contributions | Assignment cost centre | Cost centre, department |  |
| GL-009 | LE-01 | Gratuity provision | Dr | 5010500 | Retirement Provisions | Entity | Entity |  |
| GL-010 | LE-01 | Leave encashment provision | Dr | 5010500 | Retirement Provisions | Entity | Entity |  |
| GL-011 | LE-01 | Recognition award | Dr | 5010600 | Rewards and Recognition | Assignment cost centre | Cost centre | Point 18 |
| GL-012 | LE-01 | Referral award | Dr | 5010600 | Rewards and Recognition | Assignment cost centre | Cost centre | Point 19 |
| GL-013 | LE-01 | Salary payable | Cr | 2010100 | Salary Payable | Entity | Entity |  |
| GL-014 | LE-01 | PF payable | Cr | 2010200 | Statutory Dues — PF | Entity | Entity |  |
| GL-015 | LE-01 | ESI payable | Cr | 2010300 | Statutory Dues — ESI | Entity | Entity |  |
| GL-016 | LE-01 | Professional tax payable — KA | Cr | 2010400 | Statutory Dues — PT | Entity | Entity, state | Point 17 |
| GL-017 | LE-01 | Professional tax payable — MH | Cr | 2010401 | Statutory Dues — PT | Entity | Entity, state | Point 17 |
| GL-018 | LE-01 | TDS payable | Cr | 2010500 | Statutory Dues — TDS | Entity | Entity |  |
| GL-019 | LE-01 | Labour welfare fund payable | Cr | 2010600 | Statutory Dues — LWF | Entity | Entity, state |  |
| GL-020 | LE-01 | Loan recovery | Cr | 1030100 | Employee Loans | Entity | Entity, employee | Point 9 |
| GL-021 | LE-01 | Advance recovery | Cr | 1030200 | Employee Advances | Entity | Entity, employee |  |
| GL-022 | LE-01 | Canteen recovery | Cr | 2010700 | Other Recoveries | Entity | Entity |  |
| GL-023 | LE-02 | Contractor labour charges | Dr | 5010700 | Contract Labour | Assignment cost centre | Cost centre, vendor | Point 3 |
| GL-024 | LE-01 | Gratuity payable | Cr | 2010800 | Retirement Benefits Payable | Entity | Entity | ADDED v1.1 — GL-009 debits the gratuity provision with no credit leg, so any journal containing it cannot balance |
| GL-025 | LE-01 | Leave encashment payable | Cr | 2010900 | Leave Encashment Payable | Entity | Entity | ADDED v1.1 — the credit leg for GL-010, missing for the same reason |
| GL-026 | LE-02 | Professional tax payable — TS | Cr | 2010402 | Statutory Dues — PT | Entity | Entity, state | ADDED v1.1 — Point 17. LE-02 runs Telangana and Tamil Nadu payroll and had no PT credit account of its own |
| GL-027 | LE-02 | Professional tax payable — TN | Cr | 2010403 | Statutory Dues — PT | Entity | Entity, state | ADDED v1.1 — Point 17, half-yearly levy |
| Every component in a run must be mapped before the run can reach APPROVED. Deliberately leave GL-023 unmapped in the demo tenant first, run the validation, show the block, then add it. CORRECTED v1.1. GL-009 and GL-010 were debit-only: the gratuity and leave-encashment provisions had no credit account anywhere in the map, so a journal that included them could never balance. GL-024 and GL-025 supply them. GL-026 and GL-027 do the same for LE-02, which runs two states of professional tax and had no PT credit line at all. Keep GL-023 unmapped in the tenant at first, as the original note says, so the validation block can be shown — then add it live. |  |  |  |  |  |  |  |  |

### `36_ERP_Inbound_Master` (9 rows)

| Sync row | Batch | External employee code | Nucleus code | Field | ERP value | Nucleus value | Field owner | Outcome | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SY-0001 | ERP-SYNC-2026-09-14 | VPI-1066 | E1066 | Department | Logistics | Logistics | ERP | Applied — no change | Point 14 |
| SY-0002 | ERP-SYNC-2026-09-14 | VPI-1066 | E1066 | Cost centre | CC-3200 | CC-3200 | ERP | Applied — no change | Point 14 |
| SY-0003 | ERP-SYNC-2026-09-14 | VPI-1051 | E1051 | Department | Assembly | Quality Assurance | ERP | Applied — Nucleus updated to Assembly | Point 14 |
| SY-0004 | ERP-SYNC-2026-09-14 | VPI-1020 | E1020 | Grade | B | B | Nucleus | Rejected — grade is Nucleus-owned; ERP value ignored and logged | Point 14 |
| SY-0005 | ERP-SYNC-2026-09-14 | VPI-1044 | E1044 | Manager | VPI-1039 | VPI-1040 | Nucleus | Held for review — ownership map marks manager as Nucleus-owned but the ERP value differs materially | Point 14 |
| SY-0006 | ERP-SYNC-2026-09-14 | VPI-9901 |  | Full record | New joiner from ERP |  | ERP | Rejected — employee code not found in Nucleus and auto-create is off for this tenant | Point 14 |
| SY-0007 | ERP-SYNC-2026-09-14 | VPI-1066 | E1066 | Department | Logistics | Logistics | ERP | Rejected — duplicate payload, identical hash to SY-0001 | Point 14 |
| SY-0008 | ERP-SYNC-2026-09-14 | VPI-1056 | E1056 | Location | LOC-CHN | LOC-CHN | ERP | Applied — no change. Payroll group stays HO, which is Nucleus-owned | Points 8, 14 |
| The ownership map decides every row. ERP owns employee code, name, joining date, department and cost centre; Nucleus owns grade, worker class, shift, leave policy and manager. Conflict policy is explicit configuration — never an implicit last-write-wins. |  |  |  |  |  |  |  |  |  |

### `56_GL_Journal` (28 rows)

| Journal | Run | Entity | Period | Line | Mapping ID | Pay component / head | Dr / Cr | GL account | Account name | Cost centre source | Debit (INR) | Credit (INR) | Posting status | ERP posting reference | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 1 | GL-001 | Basic | Dr | 5010100 | Salaries and Wages | Assignment cost centre | 15000000 | 0 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 2 | GL-002 | Dearness allowance | Dr | 5010100 | Salaries and Wages | Assignment cost centre | 1800000 | 0 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 3 | GL-003 | House rent allowance | Dr | 5010200 | Allowances | Assignment cost centre | 6000000 | 0 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 4 | GL-004 | Conveyance | Dr | 5010200 | Allowances | Assignment cost centre | 700000 | 0 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 5 | GL-005 | Special allowance | Dr | 5010200 | Allowances | Assignment cost centre | 5140000 | 0 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 6 | GL-007 | Employer PF contribution | Dr | 5010400 | Employer Contributions | Assignment cost centre | 2016000 | 0 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 7 | GL-008 | Employer ESI contribution | Dr | 5010400 | Employer Contributions | Assignment cost centre | 364000 | 0 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 8 | GL-009 | Gratuity provision | Dr | 5010500 | Retirement Provisions | Entity | 520000 | 0 | Posted 2026-09-02 | ERP-JV-88214 | Point 15 |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 9 | GL-010 | Leave encashment provision | Dr | 5010500 | Retirement Provisions | Entity | 180000 | 0 | Posted 2026-09-02 | ERP-JV-88214 | Point 15 |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 10 | GL-013 | Salary payable | Cr | 2010100 | Salary Payable | Entity | 0 | 24118000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 11 | GL-014 | PF payable — employee and employer | Cr | 2010200 | Statutory Dues — PF | Entity | 0 | 4032000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 12 | GL-015 | ESI payable — employee and employer | Cr | 2010300 | Statutory Dues — ESI | Entity | 0 | 448000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 13 | GL-016 | Professional tax payable — KA | Cr | 2010400 | Statutory Dues — PT | Entity | 0 | 52000 | Posted 2026-09-02 | ERP-JV-88214 | Point 15 |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 14 | GL-017 | Professional tax payable — MH | Cr | 2010401 | Statutory Dues — PT | Entity | 0 | 26000 | Posted 2026-09-02 | ERP-JV-88214 | Point 15 |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 15 | GL-018 | TDS payable | Cr | 2010500 | Statutory Dues — TDS | Entity | 0 | 1580000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 16 | GL-019 | Labour welfare fund payable | Cr | 2010600 | Statutory Dues — LWF | Entity | 0 | 62000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 17 | GL-020 | Loan recovery | Cr | 1030100 | Employee Loans | Entity | 0 | 420000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 18 | GL-021 | Advance recovery | Cr | 1030200 | Employee Advances | Entity | 0 | 110000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 19 | GL-022 | Canteen recovery | Cr | 2010700 | Other Recoveries | Entity | 0 | 172000 | Posted 2026-09-02 | ERP-JV-88214 |  |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 20 | GL-024 | Gratuity payable | Cr | 2010800 | Retirement Benefits Payable | Entity | 0 | 520000 | Posted 2026-09-02 | ERP-JV-88214 | Point 15 |
| JV-2026-08-0441 | PR-2026-08-01 | LE-01 | Aug 2026 | 21 | GL-025 | Leave encashment payable | Cr | 2010900 | Leave Encashment Payable | Entity | 0 | 180000 | Posted 2026-09-02 | ERP-JV-88214 | Point 15 |
| JV-2026-10-0007 | PR-2026-09-02 | LE-01 | Sep 2026 overtime | 1 | GL-006 | Overtime | Dr | 5010300 | Overtime | Assignment cost centre | 412000 | 0 | Not yet posted — run is in DRAFT |  | Points 10, 15 |
| JV-2026-10-0007 | PR-2026-09-02 | LE-01 | Sep 2026 overtime | 2 | GL-008 | Employer ESI contribution | Dr | 5010400 | Employer Contributions | Assignment cost centre | 13390 | 0 | Not yet posted — run is in DRAFT |  | Points 10, 15 |
| JV-2026-10-0007 | PR-2026-09-02 | LE-01 | Sep 2026 overtime | 3 | GL-013 | Salary payable | Cr | 2010100 | Salary Payable | Entity | 0 | 384190 | Not yet posted — run is in DRAFT |  | Points 10, 15 |
| JV-2026-10-0007 | PR-2026-09-02 | LE-01 | Sep 2026 overtime | 4 | GL-015 | ESI payable — employee and employer | Cr | 2010300 | Statutory Dues — ESI | Entity | 0 | 16480 | Not yet posted — run is in DRAFT |  | Points 10, 15 |
| JV-2026-10-0007 | PR-2026-09-02 | LE-01 | Sep 2026 overtime | 5 | GL-018 | TDS payable | Cr | 2010500 | Statutory Dues — TDS | Entity | 0 | 24720 | Not yet posted — run is in DRAFT |  | Points 10, 15 |
|  |  |  |  |  |  |  |  |  |  |  | 32145390 | 32145390 | Both journals balance. 31,720,000 against 31,720,000 for August and 425,390 each way for overtime. |  | Point 15 |
| ADDED v1.1 for form F-INT-02 and report RP-15. Demo point 15 asks for a balanced journal and its reconciliation to the bank file, and v1.0 had only the mapping table — no journal existed to show. Three things to do on screen: post once and show the ERP reference come back; re-run the same period and show no second posting created, which is what idempotency means here; and note that the overtime run carries its own journal with its own date, so overtime never reaches the ledger inside the salary journal. The gratuity and leave-encashment credit lines use the two accounts added to sheet 35 in v1.1 — without them this journal was short by 700,000 on the credit side. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 69 | specified items (table rows) | Counted automatically at generation |
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
