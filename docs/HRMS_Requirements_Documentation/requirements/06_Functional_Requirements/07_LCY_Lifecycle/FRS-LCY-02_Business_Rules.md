<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-02 — Lifecycle — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-02 |
| Title | Lifecycle — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Lifecycle |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### Lifecycle

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-390 | A workflow instance pins its definition version; in-flight instances finish on the version they started under. | — | Pinned | Code invariant | LCY-02.1 | TC-X390 |
| RL-391 | The joining chain creates or adopts the person and assignment. | — | Either path | Code invariant | LCY-02.2 | TC-X391 |
| RL-392 | Statutory registrations are steps in the joining chain with owners and SLAs. | — | In-chain | workflow_definition | LCY-02.3 | TC-X392 |
| RL-393 | A bank-detail capture or change inside a payroll window raises an alert. | — | Always | Code invariant | LCY-02.5 | TC-Y393 |
| RL-394 | Policy acknowledgements retain the policy version acknowledged. | — | Always | Code invariant | LCY-02.6 | TC-X394 |
| RL-395 | Induction learning paths are assigned by the joining chain using the standard assignment mechanism. | — | Same mechanism | Code invariant | LCY-02.7 | TC-X395 (demo point 23) |
| RL-396 | Every asset allocation becomes a clearance item at exit. | blocking | Y for high-value assets | clearance_checklist_template | LCY-02.8, LCY-08 | TC-X396 |
| RL-397 | Lifecycle events generate announcements subject to the audience rule and an editorial override. | — | Editorial override | Config | LCY-02.9, EXP-02 | TC-X397 |
| RL-400 | The clearance checklist is instantiated from a template resolved by worker class and location. | — | Per template | clearance_checklist_template | LCY-06.1 | TC-X400 |
| RL-401 | Clearance items run in parallel with the notice period, each with its own SLA. | — | Parallel | Code invariant | LCY-06.2 | TC-X401 |
| RL-402 | F&F is held while any blocking item is open. | — | Enforced | Code invariant | LCY-06.3 | TC-X402 |
| RL-403 | A blocking item may be waived by an authorised role with a reason, and any value becomes a recovery line. | waive_role | HR head or above | Config | LCY-06.4 | TC-X403 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

| Rule ID | Module | Rule | Requirement | Statement | Worked example | Where it is configured |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BS:RL-25 | FNF | No dues gate on settlement | R-17 | F&F cannot be released while any clearance line is Pending. A line may be Waived only with a reason, and any recovery amount flows into the settlement as a deduction. | IT access not surrendered leaves one line Pending and blocks release. | No Dues Clearance Checklist — department list |

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
