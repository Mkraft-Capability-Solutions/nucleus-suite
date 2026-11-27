<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# DA-03 — Enumerations

| Attribute | Value |
| :--- | :--- |
| Document ID | DA-03 |
| Title | Enumerations |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Data Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS |
| Related documents | DA-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 06_Enum_Values<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 65_Enum_Seed_Values |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Enumerations

| Enum code | Enum name | Module | System or Config | Complete value set | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| EN_EMPLOYMENT_CATEGORY | Employment category | EMP | Config | Permanent · Probation · Contractual · Third party · Trainee · Retainer | R-03, R-04 |
| EN_EMPLOYMENT_SUBCATEGORY | Employment sub-category | EMP | Config | Employee · Helper · Supervisor · Skilled · Semi-skilled · Unskilled | R-04 |
| EN_WAGE_BASIS | Wage basis | EMP | System | Monthly · Daily · Hourly · Piece rate | R-03 |
| EN_OT_ELIGIBILITY_BASIS | OT eligibility basis | EMP | Config | All days · Rest days and holidays only · Holidays only · Not eligible | R-05 |
| EN_TRAINEE_TYPE | Trainee type | EMP | Config | DET · GET · Apprentice · Intern | R-08 |
| EN_DAY_STATUS | Day status | ATT | System | Present · Half day · Absent · Weekly off · Holiday · On leave · On gate pass · Not processed | R-13 |
| EN_DAY_TYPE | Day type | ATT | System | Working day · Rest day · Holiday · National holiday | R-05 |
| EN_BREAK_TYPE | Break type | ATT | Config | Meal · Personal · Gate pass · Shift break · Unclassified | R-01 |
| EN_LATE_CONSEQUENCE | Late mark consequence | ATT | Config | Half day · Leave deduction · Warning only · No action | R-13 |
| EN_COUNTER_RESET | Counter reset basis | ATT | Config | Calendar month · Payroll month · Quarter · Year | R-13 |
| EN_LEAVE_APPROVAL_LEVEL | Leave approval level | LVE | Config | Supervisor · HOD · HR Head · Director | R-06 |
| EN_ACCRUAL_FREQUENCY | Accrual frequency | LVE | Config | Annual · Half yearly · Quarterly · Monthly · On earning | R-08 |
| EN_YEAR_END_TREATMENT | Year end treatment | LVE | Config | Encash · Carry forward · Lapse · Carry forward with cap | R-08 |
| EN_LEAVE_DISPLAY_UNIT | Leave display unit | LVE | Config | Days · Months | R-08 |
| EN_COFF_STATUS | COFF status | LVE | System | Available · Availed · Lapsed · Encashed | R-07 |
| EN_EARLY_RETURN_ACTION | Early return attendance action | LVE | Config | Mark present · Leave unchanged · Mark as on duty | R-06 |
| EN_RUN_MODE | Processing run mode | LVE | Config | Preview · Commit · Rollback | R-08 |
| EN_GATEPASS_TYPE | Gate pass type | GPS | Config | Personal · Official · Medical · Emergency | R-12 |
| EN_GUARANTEE_STATUS | Guarantee status | LON | System | Active · Released | R-10 |
| EN_NO_DUES_STATUS | No dues status | FNF | Config | Pending · Cleared · Waived | R-17 |
| EN_STATE_VARIANT | Statutory state variant | STA | Config | Per state rules under the Factory Act — the value set is a jurisdiction pack, not a fixed list | R-18, R-27 |
| EN_SCOPE_DIMENSION | Data scope dimension | SEC | Config | Attendance location · Payroll processing location · Department · Legal entity | R-09 |
| EN_MASTER_OWNER | Master owning system | INT | Config | ERP · Nucleus · Both with field-level ownership | R-15 |
| EN_SYNC_STATUS | Sync status | INT | System | Success · Failed · Pending · Skipped | R-15 |
| EN_REQUISITION_REASON | Requisition reason | REC | Config | Replacement · New position · Temporary cover · Project | R-25 |

## 2. Seed values and tenant defaults

| Enum code | Enum name | Module | System or Config | Complete value set | Default in this tenant | Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EN_EMPLOYMENT_CATEGORY | Employment category | EMP | Config | Permanent · Probation · Contractual · Third party · Trainee · Retainer | Permanent | R-03, R-04 |
| EN_EMPLOYMENT_SUBCATEGORY | Employment sub-category | EMP | Config | Employee · Helper · Supervisor · Skilled · Semi-skilled · Unskilled |  | R-04 |
| EN_WAGE_BASIS | Wage basis | EMP | System | Monthly · Daily · Hourly · Piece rate | Monthly | R-03 |
| EN_OT_ELIGIBILITY_BASIS | OT eligibility basis | EMP | Config | All days · Rest days and holidays only · Holidays only · Not eligible | All days | R-05 |
| EN_TRAINEE_TYPE | Trainee type | EMP | Config | DET · GET · Apprentice · Intern |  | R-08 |
| EN_DAY_STATUS | Day status | ATT | System | Present · Half day · Absent · Weekly off · Holiday · On leave · On gate pass · Not processed |  | R-13 |
| EN_DAY_TYPE | Day type | ATT | System | Working day · Rest day · Holiday · National holiday | Working day | R-05 |
| EN_BREAK_TYPE | Break type | ATT | Config | Meal · Personal · Gate pass · Shift break · Unclassified | Unclassified | R-01 |
| EN_LATE_CONSEQUENCE | Late mark consequence | ATT | Config | Half day · Leave deduction · Warning only · No action | Half day | R-13 |
| EN_COUNTER_RESET | Counter reset basis | ATT | Config | Calendar month · Payroll month · Quarter · Year | Calendar month | R-13 |
| EN_LEAVE_APPROVAL_LEVEL | Leave approval level | LVE | Config | Supervisor · HOD · HR Head · Director | Supervisor | R-06 |
| EN_ACCRUAL_FREQUENCY | Accrual frequency | LVE | Config | Annual · Half yearly · Quarterly · Monthly · On earning | Annual | R-08 |
| EN_YEAR_END_TREATMENT | Year end treatment | LVE | Config | Encash · Carry forward · Lapse · Carry forward with cap |  | R-08 |
| EN_LEAVE_DISPLAY_UNIT | Leave display unit | LVE | Config | Days · Months | Days | R-08 |
| EN_COFF_STATUS | COFF status | LVE | System | Available · Availed · Lapsed · Encashed | Available | R-07 |
| EN_EARLY_RETURN_ACTION | Early return attendance action | LVE | Config | Mark present · Leave unchanged · Mark as on duty | Mark present | R-06 |
| EN_RUN_MODE | Processing run mode | LVE | Config | Preview · Commit · Rollback | Preview | R-08 |
| EN_GATEPASS_TYPE | Gate pass type | GPS | Config | Personal · Official · Medical · Emergency | Personal | R-12 |
| EN_GUARANTEE_STATUS | Guarantee status | LON | System | Active · Released | Active | R-10 |
| EN_NO_DUES_STATUS | No dues status | FNF | Config | Pending · Cleared · Waived | Pending | R-17 |
| EN_STATE_VARIANT | Statutory state variant | STA | Config | A jurisdiction pack per state, not a fixed list. Karnataka and Tamil Nadu are both seeded in this tenant. |  | R-18, R-27 |
| EN_SCOPE_DIMENSION | Data scope dimension | SEC | Config | Attendance location · Payroll processing location · Department · Legal entity | Attendance location | R-09 |
| EN_MASTER_OWNER | Master owning system | INT | Config | ERP · Nucleus · Both with field-level ownership | ERP | R-15 |
| EN_SYNC_STATUS | Sync status | INT | System | Success · Failed · Pending · Skipped |  | R-15 |
| EN_REQUISITION_REASON | Requisition reason | REC | Config | Replacement · New position · Temporary cover · Project | Replacement | R-25 |

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
| Size | 50 | specified items (table rows) | Counted automatically at generation |
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
