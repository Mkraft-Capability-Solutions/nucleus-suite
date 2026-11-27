<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-09 — Lifecycle — Backlog and Open Decisions

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-09 |
| Title | Lifecycle — Backlog and Open Decisions |
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
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 18_Build_Backlog, 22_Open_Decisions<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 11_Open_Questions |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## Phase 1 — Core Hrms (Weeks 9-24)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-060 | Lifecycle | Joining chain including statutory registrations and Form F generation | P1 | CMP-01 | BL-006, BL-090 | 8 | TC-C382 passes; Form F is produced inside the chain |
| BL-061 | Lifecycle | Clearance checklist templates with blocking semantics | P1 | CMP-05 | BL-006 | 6 | TC-X402 passes; F&F held while a blocking item is open |
| BL-062 | Lifecycle | F&F run on the last working day | P1 | CMP-03 | BL-061, BL-051 | 6 | TC-X340, TC-X341 pass, negative net handled |
| BL-063 | Lifecycle | Asset register and allocation-to-clearance link | P1 | CMP-01 | BL-020 | 4 | TC-X396 passes |

## Open decisions blocking this domain

| ID | Decision | Why it matters | Blocks | Must close by | Owner | Current lean |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OD-11 | Owner for the Form F joining-form item | Named as unassigned in the blueprint's traceability annexure | BL-060, BL-091 | Phase 1 week 12 | Deb | — |

## Open questions on client requirements

| Question ID | Requirement | Module | Question | Why the source does not answer it | What it affects | Who should answer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Q-16 | R-17 | FNF | Which departments must sign off on no dues, and who owns each? | The clearance checklist needs its department list before it can be built. | The checklist is the gate on same-day settlement. | HR product owner with the client |

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
| Size | 6 | specified items (table rows) | Counted automatically at generation |
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
