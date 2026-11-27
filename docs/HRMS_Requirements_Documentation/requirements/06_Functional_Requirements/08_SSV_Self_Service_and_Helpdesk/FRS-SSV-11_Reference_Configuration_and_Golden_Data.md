<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-SSV-11 — Self-service & Helpdesk — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-SSV-11 |
| Title | Self-service & Helpdesk — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Self-service & Helpdesk |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-SSV-00, FRS-SSV-01, FRS-SSV-02, FRS-SSV-03, FRS-SSV-04, FRS-SSV-05, FRS-SSV-06, FRS-SSV-07, FRS-SSV-08, FRS-SSV-09, FRS-SSV-10, FRS-SSV-11, FRS-SSV-12, FRS-SSV-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-03 · processes SSV-01–SSV-05 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 63_Helpdesk_Tickets |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

_No entries in source for this scope._

## 2. Reference and golden data

### `63_Helpdesk_Tickets` (7 rows)

| Ticket | Raised by | Name | Category | Subject | Priority | Raised on | SLA due | Assigned to | Status | Resolution | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TK-2026-0912 | E1019 | Sneha Nair | Attendance | Half day marked on 10 September | Normal | 2026-09-11 | 2026-09-15 | E1017 | Resolved | Fourth late in the month beyond the 15-minute grace. The late history was shown from her own record and the half day stands. | Point 12 |
| TK-2026-0918 | E1044 | Rahul Gaikwad | Payroll | Comp-off credit from 31 May has disappeared | Normal | 2026-08-04 | 2026-08-08 | E1006 | Resolved | It lapsed unconsumed on 30 July, 60 days from the credit date. The ledger movement and the lapse run reference were shown to him. This ticket is the argument for report RP-06, the expiry forecast. | Point 6 |
| TK-2026-0925 | E1023 | Kavya Venkatesh | Attendance | Third gate pass request rejected | Low | 2026-09-12 | 2026-09-16 | E1024 | Resolved | Four hours and two instances already used in September. The entitlement counter was shown against her record. | Point 11 |
| TK-2026-0931 | E1041 | Mahesh Shinde | Payroll | Loan application rejected without explanation | High | 2026-09-09 | 2026-09-10 | E1007 | Resolved | He is an active guarantor on LN-2026-0041 and is therefore blocked from borrowing until that loan closes. The reason was in the rejection; the ticket exists because nobody had told him he was a guarantor. | Point 9 |
| TK-2026-0940 | E1032 | Shivanna Muniyappa | Attendance | No weekly off shown for September | Normal | 2026-09-14 | 2026-09-18 | E1017 | Awaiting employee | Working as configured — his worker class carries no rest day and he is paid on days present. Referred to HR as a policy question rather than closed as a defect. | Point 2 |
| TK-2026-0944 | E1056 | Anand Krishnan | Payroll | Payslip not visible to plant HR | Low | 2026-09-12 | 2026-09-16 | E1007 | Closed | Working as configured. He is payrolled at head office, so plant roles cannot see compensation on his record. | Point 8 |
| ADDED v1.1 for form FRM-SSV-01. Every ticket here is a question the demo itself raises, answered from the record rather than from a policy document — which is the only argument for a helpdesk sitting inside the HRMS instead of beside it. TK-2026-0918 is the best of them: a worker asking where his comp-off went, answered by a ledger movement with a lapse run reference against it. |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 7 | specified items (table rows) | Counted automatically at generation |
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
