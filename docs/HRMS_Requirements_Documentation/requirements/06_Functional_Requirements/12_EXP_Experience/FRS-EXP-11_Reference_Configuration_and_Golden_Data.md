<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-EXP-11 — Experience — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-EXP-11 |
| Title | Experience — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Experience |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-EXP-00, FRS-EXP-01, FRS-EXP-02, FRS-EXP-03, FRS-EXP-04, FRS-EXP-05, FRS-EXP-06, FRS-EXP-07, FRS-EXP-08, FRS-EXP-09, FRS-EXP-10, FRS-EXP-11, FRS-EXP-12, FRS-EXP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-19, R-20, R-21, R-22 · processes EXP-01–EXP-03 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 30_Recognition_Referral, 31_Announcements, 32_Letter_Templates |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
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

## 2. Reference and golden data

### `30_Recognition_Referral` (8 rows)

| Record ID | Type | Employee / referrer | Name | Programme / requisition | Period | Citation / candidate | Award (INR) | Award status | Pay in run | Announced | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RC-2026-Q2-004 | Recognition | E1022 | Mohan Joseph | Star Employee of the Quarter | Q2 FY27 | Recovered the Assembly line after a jig failure without a shift loss | 15000 | Approved | PR-2026-09-01 | AN-2026-0089 | Point 18 |
| RC-2026-Q2-007 | Recognition | E1057 | Bhuvaneswari Raman | Star Employee of the Quarter | Q2 FY27 | Caught a dimensional drift in incoming stock before it reached the line | 15000 | Approved | PR-2026-09-01 | AN-2026-0090 | Point 18 |
| RC-2026-M09-002 | Recognition | E1036 | Lakshmi Rao | Safety Champion of the Month | Sep 2026 | Reported an unguarded conveyor nip point | 3000 | Pending approval |  |  | Point 18 |
| RF-2026-0021 | Referral | E1019 | Sneha Nair | REQ-2026-0033 |  | Ishita Chatterjee — joined 17 Aug 2026 | 25000 | Part paid — 50% on joining | PR-2026-08-01 | AN-2026-0092 | Point 19 |
| RF-2026-0021B | Referral | E1019 | Sneha Nair | REQ-2026-0033 |  | Balance due on confirmation, 17 Feb 2027 | 25000 | Balance pending confirmation |  |  | Point 19 |
| RF-2026-0026 | Referral | E1044 | Rahul Gaikwad | REQ-2026-0039 |  | Abhinav Rastogi — joined 01 Sep 2026 | 25000 | Part paid — 50% on joining | PR-2026-09-01 | AN-2026-0093 | Point 19 |
| RF-2026-0029 | Referral | E1013 | Tanvi Deshmukh | REQ-2026-0041 |  | Candidate at offer stage | 25000 | Not yet due |  |  | Point 19 |
| Recognition and referral awards raise a payroll input in a named run rather than being paid outside the system. The referral balance maturing on confirmation is the part most implementations drop, and the reason referral schemes quietly stop being paid. |  |  |  |  |  |  |  |  |  |  |  |

### `31_Announcements` (9 rows)

| Announcement ID | Type | Title | Audience rule | Channels | Publish from | Publish to | Source event | Created by | Status | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AN-2026-0088 | Birthday | Wishing Rekha Deshpande a happy birthday | Location = LOC-PLA | App, business messaging | 2026-12-16 | 2026-12-16 | Auto — date of birth | System | Scheduled | Point 20 |
| AN-2026-0089 | Recognition | Star Employee of the Quarter — Mohan Joseph | Entity = LE-01 | App, business messaging, Email | 2026-09-12 | 2026-09-26 | RC-2026-Q2-004 | E1006 | Published | Point 20 |
| AN-2026-0090 | Recognition | Star Employee of the Quarter — Bhuvaneswari Raman | Entity = LE-02 | App, business messaging, Email | 2026-09-12 | 2026-09-26 | RC-2026-Q2-007 | E1055 | Published | Point 20 |
| AN-2026-0091 | New joiner | Welcome to Abhinav Rastogi, Logistics | Location = LOC-PUN | App, Email | 2026-09-01 | 2026-09-08 | Joining chain, E1066 | System | Published | Point 20 |
| AN-2026-0092 | Referral | Referral award paid — thank you Sneha Nair | Org unit = OU-111 | App | 2026-08-31 | 2026-09-07 | RF-2026-0021 | System | Published | Point 20 |
| AN-2026-0093 | Referral | Referral award paid — thank you Rahul Gaikwad | Org unit = OU-112 | App | 2026-09-30 | 2026-10-07 | RF-2026-0026 | System | Scheduled | Point 20 |
| AN-2026-0094 | Management | Revised gate pass policy effective 01 October 2026 | All employees | App, business messaging, Email, Notice board | 2026-09-20 | 2026-10-05 | Manual | E1004 | Draft | Point 20 |
| AN-2026-0095 | Work anniversary | Five years with us — Mohan Joseph | Location = LOC-PLA | App | 2026-07-01 | 2026-07-01 | Auto — date of joining | System | Published | Point 20 |
| Announcements are a broadcast with an audience rule and a channel list, distinct from the activity feed, which is a log. Five of the eight are auto-generated from events with an editorial override before publish. |  |  |  |  |  |  |  |  |  |  |

### `32_Letter_Templates` (13 rows)

| Template / issue ID | Template | Version | Approval required | Issued to | Name | Issued on | Issued by | Merge fields used | Retained version | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TPL-APPT-02 | Appointment letter | v2.1 effective 2026-04-01 | Y |  |  |  |  | name, designation, band, ctc, doj, location, notice_days, probation_months |  | Point 21 |
| TPL-CONF-01 | Confirmation letter | v1.4 effective 2025-10-01 | Y |  |  |  |  | name, designation, doj, confirmation_date, revised_ctc |  | Point 21 |
| TPL-INCR-03 | Increment letter | v3.0 effective 2026-04-01 | Y |  |  |  |  | name, old_ctc, new_ctc, effective_date, components_table |  | Point 21 |
| TPL-TRFR-01 | Transfer letter | v1.2 effective 2024-07-01 | Y |  |  |  |  | name, from_location, to_location, effective_date, reporting_to |  | Point 21 |
| TPL-EXPR-02 | Experience certificate | v2.0 effective 2025-01-01 | N |  |  |  |  | name, designation, doj, lwd, conduct |  | Point 21 |
| TPL-RELV-01 | Relieving letter | v1.1 effective 2024-07-01 | Y |  |  |  |  | name, designation, lwd, dues_cleared |  | Point 21 |
| TPL-SALC-01 | Salary certificate | v1.0 effective 2023-04-01 | N |  |  |  |  | name, designation, gross, net, period |  | Point 21 |
| TPL-WARN-01 | Warning letter | v1.0 effective 2024-01-01 | Y |  |  |  |  | name, incident_date, incident, prior_warnings |  | Point 21 |
| LTR-2026-0341 | Appointment letter |  |  | E1066 | Abhinav Rastogi | 2026-09-01 | E1006 |  | TPL-APPT-02 v2.1 | Point 21 |
| LTR-2026-0342 | Appointment letter |  |  | E1065 | Ishita Chatterjee | 2026-08-17 | E1006 |  | TPL-APPT-02 v2.1 | Point 21 |
| LTR-2026-0338 | Confirmation letter |  |  | E1058 | Karthik Chidambaram | 2026-09-01 | E1055 |  | TPL-CONF-01 v1.4 | Point 21 |
| LTR-2026-0349 | Relieving letter |  |  | E1068 | Dinesh Vaidya | 2026-09-30 | E1006 |  | TPL-RELV-01 v1.1 | Points 16, 21 |
| Eight templates and four issued letters. Every issued letter retains the template version that produced it, which is what makes a reprint two years later defensible. |  |  |  |  |  |  |  |  |  |  |

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
| Size | 40 | specified items (table rows) | Counted automatically at generation |
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
