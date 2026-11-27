<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# TPL-09 — Peer Review Record

| Attribute | Value |
| :--- | :--- |
| Document ID | TPL-09 |
| Title | Peer Review Record |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | PQA Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | EPG Lead — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PAD, PR, PQA, MPM |
| Related documents | DOC-01, QA-02, REQ-03, MPM-01, TPL-15 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-02 (remove defects before system test) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 · MET-06, MET-09 |

---

## 1. Purpose and Use

The moderator records every peer review held under QA-02 with this form. Its effort, size and defect data feed PPB-01 and PPB-02; a review whose density or rate falls outside the control limits is examined for special cause.

*Guidance: the record is identified `PR-nnnn`; the identifier is written into the reviewed document's header. Delete guidance lines before use.*

## 2. Review Identification

| Field | Value |
| :--- | :--- |
| Review ID | [PR-nnnn] |
| Work product | [Document ID, title] |
| Version reviewed | [Version] |
| Size | [Pages / requirements / lines changed] |
| Review type | [Inspection / Walkthrough / Desk check / Pair review] |
| Moderator | [Name] |
| Author | [Name] |
| Reviewers and perspectives | [Name — perspective: testability, compliance, UX, security, domain] |
| Checklist used | [REQ-03 or QA-02 checklist] |
| Planned date / held date | [YYYY-MM-DD / YYYY-MM-DD] |

## 3. Effort

| Activity | Person-hours |
| :--- | ---: |
| Preparation (individual) | [n] |
| Review meeting | [n] |
| Rework | [n] |
| Total | [n] |

## 4. Defect Log

| # | Location (section or requirement ID) | Description | Type | Severity | Raised by | Disposition | Fixed in version | Verified by |
| ---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [n] | [Location] | [Description] | [Missing / Wrong / Ambiguous / Untestable / Inconsistent / Non-compliant / Editorial] | [Critical / Major / Minor] | [Name] | [Accept / Reject with reason / Defer to CR-nnnn] | [Version] | [Name] |

Severity follows QA-02 §8.1: **Critical** would cause statutory non-compliance, a data breach, wrong pay or a blocked gate; **Major** would cause a wrong or untestable implementation; **Minor** affects clarity only.

## 5. Summary Measures

| Measure | Value | Compared with |
| :--- | :--- | :--- |
| Critical defects | [n] | |
| Major defects | [n] | |
| Minor defects | [n] | |
| Review defect density — (Critical + Major) ÷ size | [value] | PPB-01 control limits |
| Review rate — size ÷ preparation hour | [value] | PPB-02 control limits |
| Within limits? | [Yes / No — special cause noted, or CAR-nnnn] | |

## 6. Outcome

| Field | Value |
| :--- | :--- |
| Result | [Accepted / Accepted after rework without re-review / Re-review required] |
| Exit criteria met | [All Critical and Major defects resolved and verified: Y/N] |
| Moderator sign-off | [Name, YYYY-MM-DD] |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| EPG Lead | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 6 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Review rate | *pending review* | sections / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | |

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
