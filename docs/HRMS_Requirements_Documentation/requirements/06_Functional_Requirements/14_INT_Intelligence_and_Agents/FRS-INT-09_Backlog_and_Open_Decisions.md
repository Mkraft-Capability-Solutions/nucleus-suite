<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-INT-09 — Intelligence & Agents — Backlog and Open Decisions

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-INT-09 |
| Title | Intelligence & Agents — Backlog and Open Decisions |
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
| Related documents | FRS-INT-00, FRS-INT-01, FRS-INT-02, FRS-INT-03, FRS-INT-04, FRS-INT-05, FRS-INT-06, FRS-INT-07, FRS-INT-08, FRS-INT-09, FRS-INT-10, FRS-INT-11, FRS-INT-12, FRS-INT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-08 · processes INT-01–INT-04 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 18_Build_Backlog, 22_Open_Decisions<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 11_Open_Questions |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## Phase 2 — Pilot And Intelligence (Weeks 25-40)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-122 | Intelligence | Model gateway, prompt versioning, cost attribution | P2 | CMP-11 | BL-001 | 8 | No vendor SDK call from domain code |
| BL-123 | Intelligence | Policy gate, tool registry, action ledger, reversal | P2 | CMP-11 | BL-122, BL-008 | 10 | No non-tool path from an agent to data |
| BL-129 | Analytics | Operational reports shipped configured | P2 | CMP-08 | BL-031 | 8 | Break, OT register, late summary, gate-pass utilisation, team history |

## Phase 3 — Depth And Differentiation (Weeks 41-64)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-142 | Intelligence | Payroll Preparer and Compliance Watcher agents | P3 | CMP-11 | BL-123 | 12 | Both propose only; filing and payroll changes stay human |
| BL-145 | Platform | MCP surface over the governed tool registry | P3 | CMP-11 | BL-123 | 6 | Build the tool layer once, expose it twice |

## Open decisions blocking this domain

_No entries in source for this scope._

## Open questions on client requirements

_No entries in source for this scope._

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
| Size | 5 | specified items (table rows) | Counted automatically at generation |
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
