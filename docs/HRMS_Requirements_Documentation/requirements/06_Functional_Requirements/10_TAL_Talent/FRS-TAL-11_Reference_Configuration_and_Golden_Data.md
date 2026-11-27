<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TAL-11 — Talent — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TAL-11 |
| Title | Talent — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Talent |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-TAL-00, FRS-TAL-01, FRS-TAL-02, FRS-TAL-03, FRS-TAL-04, FRS-TAL-05, FRS-TAL-06, FRS-TAL-07, FRS-TAL-08, FRS-TAL-09, FRS-TAL-10, FRS-TAL-11, FRS-TAL-12, FRS-TAL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-25, R-26 · processes TAL-01–TAL-05 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 37_Requisitions, 59_Candidates_and_Offers |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Position code | REC | F-REC-02 — Manpower Requisition | — | All roles | R-25 | Yes |
| Requisition reason | REC | F-REC-02 — Manpower Requisition | Replacement | All roles | R-25 | Yes — value set configurable per tenant |
| Sanctioned strength check | REC | F-REC-02 — Manpower Requisition | — | All roles | R-26 | Yes |

## 2. Reference and golden data

### `37_Requisitions` (8 rows)

| Requisition | Type | Against position | Org unit | Designation | Location | Raised on | Hiring manager | Sanctioned | Filled | Status | Blocker | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-2026-0037 | Replacement | POS-2214 | OU-111 | DES-08 | LOC-PLA | 2026-08-25 | E1017 | 4 | 3 | Open — panel round 2 | Panel availability | Point 24 — replacement against a vacated position, consumes no fresh sanction |
| REQ-2026-0041 | Addition |  | OU-111 | DES-13 | LOC-PLA | 2026-09-08 | E1017 | 24 | 24 | Blocked at approval | Sanctioned strength reached | Points 24, 25 — addition blocked because Machining is at full sanction; needs an override |
| REQ-2026-0044 | Replacement | POS-2225 | OU-112 | DES-13 | LOC-PUN | 2026-09-04 | E1040 | 18 | 16 | Open — screening | On track | Point 24 |
| REQ-2026-0045 | Replacement | POS-2226 | OU-112 | DES-13 | LOC-PUN | 2026-08-14 | E1040 | 18 | 16 | Open — offer | On track | Point 24 |
| REQ-2026-0039 | Replacement | POS-3210 | OU-122 | DES-11 | LOC-PUN | 2026-07-02 | E1039 | 3 | 3 | Closed — E1066 joined 01 Sep | On track | Points 19, 24 |
| REQ-2026-0033 | Addition |  | OU-130 | DES-09 | LOC-BLR | 2026-06-18 | E1005 | 6 | 5 | Closed — E1065 joined 17 Aug | On track | Point 19 |
| REQ-2026-0048 | Replacement | POS-2115 | OU-111 | DES-13 | LOC-CHN | 2026-08-04 | E1054 | 20 | 18 | Open — screening | Candidate supply | Point 24 |
| A replacement names the vacated position code and consumes no fresh sanctioned strength. An addition does, and REQ-2026-0041 is blocked because Machining at Peenya is at full sanction in sheet 10. This is what turns approved manpower from a review-meeting number into a control. |  |  |  |  |  |  |  |  |  |  |  |  |

### `59_Candidates_and_Offers` (9 rows)

| Candidate | Requisition | Name | Source | Referred by | Stage | Rounds completed | Verdict | Offer | Offered CTC (INR pa) | Offer status | Proposed joining date | Becomes employee | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CN-2026-0188 | REQ-2026-0039 | Abhinav Rastogi | Employee referral | E1044 Rahul Gaikwad | Joined | Screening, Technical 1, HR | Hire | OF-2026-0066 | 494400 | Accepted | 2026-09-01 | E1066 | Points 19, 24 — referral through to a joiner against a replacement requisition |
| CN-2026-0171 | REQ-2026-0033 | Ishita Chatterjee | Employee referral | E1019 Sneha Nair | Joined | Screening, Technical 1, Technical 2, HR | Strong hire | OF-2026-0058 | 585600 | Accepted | 2026-08-17 | E1065 | Point 19 — the referral whose balance award matures on confirmation in February |
| CN-2026-0204 | REQ-2026-0037 | Girish Kamat | Job portal |  | Interview complete | Screening, Technical 1 | Hold |  |  |  |  |  | Point 24 — the open replacement against vacated position POS-2214, at panel round 2 |
| CN-2026-0206 | REQ-2026-0037 | Sunil Marathe | Recruitment agency |  | Interview scheduled | Screening |  |  |  |  |  |  | Point 24 |
| CN-2026-0211 | REQ-2026-0041 | Basanti Naik | Employee referral | E1013 Tanvi Deshmukh | Offered | Screening, Technical 1, HR | Hire | OF-2026-0071 | 288000 | Pending | 2026-10-05 |  | Points 19, 24, 25 — the candidate is ready but the requisition is blocked because Machining is at sanctioned strength. Show the offer held by a headcount control rather than by a hiring decision. |
| CN-2026-0215 | REQ-2026-0044 | Pooja Sawant | Walk-in |  | Screened | Screening |  |  |  |  |  |  | Point 24 |
| CN-2026-0219 | REQ-2026-0045 | Imtiaz Sayed | Job portal |  | Offered | Screening, Technical 1 | Hire | OF-2026-0069 | 276000 | Negotiating | 2026-10-12 |  | Point 24 |
| CN-2026-0222 | REQ-2026-0048 | Kavitha Rajan | Campus |  | Rejected | Screening | No hire |  |  |  |  |  | Point 24 — rejection reason recorded so the requisition ageing is explainable |
| ADDED v1.1 for forms FRM-TAL-02, TAL-03 and TAL-04. v1.0 had requisitions and referral awards but no candidates, so the two ends of the story were joined by nothing — "Open, panel round 2" on REQ-2026-0037 pointed at no one. CN-2026-0211 is the row worth opening: a candidate with an accepted verdict and an offer that cannot issue because sanctioned strength is full. That is demo point 25 arriving where it actually bites, at the offer, rather than as a number on a budget screen. |  |  |  |  |  |  |  |  |  |  |  |  |  |

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
| Size | 20 | specified items (table rows) | Counted automatically at generation |
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
