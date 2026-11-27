<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-02 — Compliance — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-02 |
| Title | Compliance — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compliance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Compliance

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-360 | A rule pack is versioned, effective-dated, jurisdiction-scoped and carries a changelog citing its source notification. | — | Always | rule_pack | CMP-01p.1 | TC-C360 |
| RL-361 | Every rule in a pack has golden cases verified by hand against the statute. | min_cases | 340 in the illustrative pack | Test library | CMP-01p.2 | TC-C361 |
| RL-362 | A single golden-case mismatch fails the build. | — | Enforced | CI | CMP-01p.3 | TC-C362 |
| RL-363 | A pack cannot deploy without a green suite and a named reviewer. | reviewer_role | Payroll SME | Process control | CMP-01p.4 | TC-C363 |
| RL-364 | State packs layer on the central pack in a defined order. | layer_order | Central then state | rule_pack | CMP-01p.5 | TC-C364 |
| RL-370 | The obligation calendar is generated per entity and state from the applicability matrix. | — | Automatic | Config | CMP-02p.1 | TC-C370 |
| RL-371 | Filing packs are assembled from posted records only, never from typed figures. | — | Enforced | Code invariant | CMP-02p.2 | TC-C371 |
| RL-372 | A human files; the system prepares, records the acknowledgement and closes the obligation. | — | Human files | Tenant policy | CMP-02p.3 | TC-C372 |
| RL-380 | The applicable statutory form set follows the plant's registration, not the company's. | — | Per location | statutory_form | CMP-03p.1 | TC-C380 (demo point 17) |
| RL-381 | Form generation binds a declarative query to a template so a state amendment is a configuration change. | — | Declarative | Code invariant | CMP-03p.2 | TC-C381 |
| RL-382 | Statutory joining forms including Form F are generated inside the joining chain. | — | In-chain | workflow_definition | CMP-03p.3, LCY-02.4 | TC-C382 (demo point 26) |
| RL-383 | A filed form retains its acknowledgement reference against the period. | — | Always | Code invariant | CMP-03p.4 | TC-C383 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

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
| Size | 12 | specified items (table rows) | Counted automatically at generation |
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
