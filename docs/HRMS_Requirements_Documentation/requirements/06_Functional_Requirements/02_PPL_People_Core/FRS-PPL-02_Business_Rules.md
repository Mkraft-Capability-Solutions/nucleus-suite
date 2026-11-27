<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-02 — People Core — Business Rules

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-02 |
| Title | People Core — Business Rules |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — People Core |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, TS, VV |
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 09_Business_Rules<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 05_Rules_and_Calculations |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Business rules (RL-nnn)

### People Core

| Rule ID | Rule | Parameters | Client value / default | Configured in | Consumed by | Test case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RL-030 | Search for an existing person before creating one. | match keys: name, DOB, mobile, PAN, Aadhaar | Mandatory step | Code invariant | PPL-01.1 | TC-H30 |
| RL-031 | A duplicate candidate above the confidence threshold is presented to HR for a decision, never auto-merged or auto-rejected. | match_threshold | 0.85 | Config | PPL-01.2 | TC-H31 |
| RL-032 | A person record is created once and survives rehire, conversion and entity transfer. | — | Always | Code invariant | PPL-01.3 | TC-H32 |
| RL-033 | An Aadhaar or PAN mismatch does not block joining; it raises a payroll-blocking flag. | — | Blocking at payroll, not at hire | Config | PPL-01.3, PAY-03.1 | TC-H33 |
| RL-034 | An assignment can only be created against a vacant, non-frozen, non-abolished position. | position.status | Enforced | Code invariant | PPL-01.4 | TC-H34 |
| RL-035 | An assignment belongs to an employment, which belongs to a legal entity. | — | Always | Schema | PPL-01.5 | TC-H35 |
| RL-036 | Payroll group and location are independent attributes of an assignment; neither defaults from the other. | — | Independent | Code invariant | PPL-01.6 | TC-H36 (demo point 8) |
| RL-037 | Worker class supplies policy defaults; the assignment may override any of them with a reason and an effective date. | override fields | Override allowed | assignment | PPL-01.7, PPL-03.2 | TC-H37 |
| RL-038 | Creating an assignment triggers the joining chain. | chain_id | Automatic | workflow_definition | PPL-01.8 | TC-H38 |
| RL-040 | Any assignment change carries an effective date and a reason. | — | Mandatory | Code invariant | PPL-02.1 | TC-H40 |
| RL-041 | A retro change effective inside a closed payroll period produces arrears in the next open run; the closed run is never rewritten. | — | Arrears only | Code invariant | PPL-02.5, PAY-11 | TC-Y41 |
| RL-042 | A change to class, rest days, shift group, grace exemption or location queues an attendance recompute for the affected range. | — | Automatic | Code invariant | PPL-02.4, TIM-09 | TC-T42 |
| RL-050 | Worker class attributes are read as at the reference date, not as at today. | — | Always | Code invariant | PPL-03.1 | TC-H50 |
| RL-051 | An assignment-level override without a reason fails validation at write time. | — | Enforced | Code invariant | PPL-03.2 | TC-H51 |
| RL-052 | Grace exemption is an attribute of the designation band, never a hardcoded grade string. | grace_exempt | Assistant Manager and above = Y | designation | PPL-03.3, TIM-05.6 | TC-T52 |
| RL-053 | Policy resolution for a date outside the assignment span returns 'not employed', not defaults. | — | Enforced | Code invariant | PPL-03.4 | TC-H53 |
| RL-055 | Sanctioned strength is recorded by org unit, designation and location with an effective date and an approver. | — | Per client | sanctioned_position | PPL-04.1 | TC-R55 |
| RL-056 | Filled and open counts are derived from assignments and requisitions; neither is stored. | — | Derived | Code invariant | PPL-04.2 | TC-R56 |
| RL-057 | Headroom = sanctioned − filled − open requisitions. | — | Derived | Code invariant | PPL-04.3, TAL-01.3 | TC-R57 |
| RL-058 | On separation the position is marked vacant with last incumbent and vacated date. | — | Automatic | Code invariant | PPL-04.4 | TC-R58 |
| RL-060 | Every uploaded document carries a class and, where applicable, an expiry date. | document_class set | Per client | Config | PPL-06.1 | TC-H60 |
| RL-061 | Extraction never overwrites a verified value; low confidence routes to a verification queue. | confidence_threshold | 0.80 | Config | PPL-06.2 | TC-H61 |
| RL-062 | Document expiry generates reminders at configured intervals. | remind_days[] | 60, 30, 7 | Config | PPL-06.3 | TC-H62 |

## 2. Client calculation rules with worked examples (BS:RL-xx)

These rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.

| Rule ID | Module | Rule | Requirement | Statement | Worked example | Where it is configured |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BS:RL-05 | EMP | Rest day entitlement resolution | R-03, R-04 | Rest-day applicability resolves in this order: the value on the employee record, then the employment sub-category default, then the employment category default. The first non-empty value wins. | A third-party Helper resolves to no rest day while a third-party Employee resolves to a rest day, under the same category. | Employment Category & Sub-category Master |
| BS:RL-26 | EMP | Daily wage payment basis | R-03 | Where wage basis is Daily, payroll pays on days present rather than a monthly salary, and no weekly off is generated. | A contractual employee present 24 days in a 30-day month is paid for 24 days. | Employee Master — wage basis |

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
| Size | 25 | specified items (table rows) | Counted automatically at generation |
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
