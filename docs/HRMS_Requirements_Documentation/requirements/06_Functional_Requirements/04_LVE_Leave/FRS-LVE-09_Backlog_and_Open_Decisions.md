<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LVE-09 — Leave — Backlog and Open Decisions

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LVE-09 |
| Title | Leave — Backlog and Open Decisions |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Delivery Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PLAN, EST, DAR |
| Related documents | FRS-LVE-00, FRS-LVE-01, FRS-LVE-02, FRS-LVE-03, FRS-LVE-04, FRS-LVE-05, FRS-LVE-06, FRS-LVE-07, FRS-LVE-08, FRS-LVE-09, FRS-LVE-10, FRS-LVE-11, FRS-LVE-12, FRS-LVE-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01, BG-03 · R-06, R-07, R-08 · processes LVE-01–LVE-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 18_Build_Backlog, 22_Open_Decisions<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 11_Open_Questions |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## Phase 1 — Core Hrms (Weeks 9-24)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-040 | Leave | Leave ledger, accrual policies, proration, eligibility waits | P1 | CMP-02 | BL-021 | 10 | TC-L171 to TC-L182 pass; accrual is idempotent under re-run |
| BL-041 | Leave | Request validation: combination, caps, conflicts, with rule-naming messages | P1 | CMP-02 | BL-040 | 5 | TC-L192, TC-L193 pass before the chain starts |
| BL-042 | Leave | Sequential approval chain with HR edit right | P1 | CMP-01 | BL-006 | 4 | TC-L14, TC-L15 pass |
| BL-043 | Leave | Early return: reversal plus recompute in one transaction | P1 | CMP-02 | BL-038 | 5 | TC-L201 passes; ledger and attendance never disagree |
| BL-044 | Leave | Comp-off per-credit expiry and lapse job | P1 | CMP-02 | BL-040 | 4 | TC-L210 to TC-L213 pass |
| BL-045 | Leave | Balance projection service and screen | P1 | CMP-02 | BL-040 | 4 | No stored balance column exists anywhere |

## Open decisions blocking this domain

| ID | Decision | Why it matters | Blocks | Must close by | Owner | Current lean |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OD-09 | Which Phase 1 absorption option we take for the four to six engineer-weeks v1.1 added | Deciding late is how Phase 1 quietly becomes Phase 1 and a half | BL-034, BL-040, BL-132 | Phase 0 exit | Deb / delivery lead | Preference order: move Performance to P3; defer the second ingestion source; extend P1 by three weeks |

## Open questions on client requirements

| Question ID | Requirement | Module | Question | Why the source does not answer it | What it affects | Who should answer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Q-02 | R-08 | LVE | What do employees joining after 4 December receive? | The proration table ends at "up to 4th Dec — 1 each". The source is silent on 5 December onwards. | Leaves a gap in the accrual rule that will surface in the first December joining. | HR product owner with the client |
| Q-03 | R-08 | LVE | Birthday leave — how many days, and what are the rules? | The source names birthday leave without quantum, window, approval requirement or lapse behaviour. | Cannot be built from the line as written. | HR product owner with the client |
| Q-04 | R-08 | LVE | Is the 10 EL a month a cap on availing or on accrual? | Accrual is 1.5 a month, so a 10-day monthly figure can only be an availing cap. Confirm. | A wrong reading either blocks valid leave or lets an employee exhaust the year in two months. | HR product owner with the client |
| Q-05 | R-08 | LVE | Is monthly EL credited at the start or the end of the month? | Determines whether an employee can avail the month's accrual within that month. | Affects every leave balance on the first of the month. | HR product owner with the client |
| Q-06 | R-08 | LVE | Which grade rank is "AGM and above" and which is "Assistant Manager and above"? | Both rules are stated by designation name. The grade ladder has to be confirmed so the rules read a rank. | Designation-name matching breaks the first time a title changes. | HR product owner with the client |
| Q-07 | R-07 | LVE | Are the 60 COFF days calendar days or working days? | The source says 60 days from the COFF date without qualifying it. | Shifts the expiry date by around two weeks. | HR product owner with the client |

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
| Size | 13 | specified items (table rows) | Counted automatically at generation |
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
