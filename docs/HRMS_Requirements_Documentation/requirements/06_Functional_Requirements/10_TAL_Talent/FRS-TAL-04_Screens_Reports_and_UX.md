<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TAL-04 — Talent — Screens, Reports and UX

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TAL-04 |
| Title | Talent — Screens, Reports and UX |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Talent |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS |
| Related documents | FRS-TAL-00, FRS-TAL-01, FRS-TAL-02, FRS-TAL-03, FRS-TAL-04, FRS-TAL-05, FRS-TAL-06, FRS-TAL-07, FRS-TAL-08, FRS-TAL-09, FRS-TAL-10, FRS-TAL-11, FRS-TAL-12, FRS-TAL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-25, R-26 · processes TAL-01–TAL-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 07_Screens, 21_Roles_and_RACI<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 08_Reports_and_Outputs<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 67_Reports_Register |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Screens

| Screen ID | Screen | Persona | Platform | Purpose | Key actions | Permission scope | Offline | Process refs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-063 | My learning | Employee | Mobile, web | Assigned paths, due dates, completion evidence | Start, complete, download certificate | Self only | Partial | LCY-02, TAL-05 |
| SCR-090 | Requisition | Hiring manager, recruiter | Web | Replacement vs addition with live headroom and blockers | Raise, override with reason, approve | Org unit + location | No | TAL-01 |
| SCR-091 | Referrals | Employee, HR | Mobile, web | Referral status through stages with award maturity | Refer, track | Self; HR all | No | TAL-03 |

## 2. Personas using these screens

_No entries in source for this scope._

## 3. Reports and outputs

_No entries in source for this scope._

### Report configuration

_No entries in source for this scope._

## 4. UX requirements for every screen in this domain (Authored)

- Screens MUST use the design-token system only and conform to WCAG 2.2 AA.
- Every label MUST be an i18n key; all 11 supported languages MUST render, including right-to-left for Arabic.
- Each screen MUST define empty, loading, error, success and, where marked, offline states.
- Masked fields MUST render masked for personas without the salary or identity scope; hiding in the browser is not authorisation — the server MUST enforce scope (SEC-01).
- Voice (Nucleus Talk) and AI-assist touchpoints MUST follow the risk tiering in GOV-11.

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
| Size | 3 | specified items (table rows) | Counted automatically at generation |
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
