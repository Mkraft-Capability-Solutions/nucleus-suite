<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# TPL-02 — Functional Requirements Specification

| Attribute | Value |
| :--- | :--- |
| Document ID | TPL-02 |
| Title | Functional Requirements Specification |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Business Analysis (BA) Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | EPG Lead — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PAD, RDM, VV, MPM |
| Related documents | DOC-01, REQ-01, REQ-02, REQ-03, TPL-00, TPL-01, TPL-03, TPL-13 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (minimise defects reaching users) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 to BG-10 · R-nn · `<DOM>-nn` |

---

## 1. Purpose and Use

This template specifies authored functional requirements (`<DOM>-FR-nnn`) and the requirement statements of capability gaps (`<DOM>-CG-nnn`) inside a domain pack. Source rules, forms and screens are carried in FRS-<DOM>-02 to -04 with their workbook identifiers; this template is used where the domain needs a requirement that the sources do not state, or where one capability needs several related requirements specified together.

*Guidance: the resulting document takes the next free FRS-<DOM>-nn identifier only when the pack structure of TPL-01 has no matching document; otherwise the requirements are written into FRS-<DOM>-10 (capability gaps) or the relevant section of FRS-<DOM>-01 to -07. Delete guidance lines before submission.*

## 2. Document Skeleton

```markdown
[Logo and header — TPL-00]

## 1. Capability Summary
## 2. Scope
## 3. Functional Requirements
## 4. Business Rules Referenced
## 5. Messages
## 6. Audit and Events
## 7. Open Items
[Approval & Sign-off · Measurement Data Captured · Revision History — TPL-00]
```

### 2.1 Capability Summary

| Item | Value |
| :--- | :--- |
| Capability (GOV-05) | [Capability name and reference] |
| Business goals and objectives | [BG-nn, BO-nn.n] |
| Business and stakeholder requirements realised | [BRQ-nnn, STR-nnn] |
| System requirements constraining it | [SYS-nnn] |
| Personas | [PER-nn from GOV-08] |
| Processes | [`<DOM>-nn`] |
| Phase | [R0 / P0–P5] |
| Upstream dependencies | [Domains, objects or interfaces consumed] |
| Downstream consumers | [Domains, objects or interfaces that consume the output] |

### 2.2 Scope

| In scope | Out of scope (with owning domain or phase) |
| :--- | :--- |
| [Item] | [Item — owned by `<DOM>` or deferred to Pn] |

## 3. Requirement Attributes

| Attribute | Rule |
| :--- | :--- |
| ID | `<DOM>-FR-nnn` (or `<DOM>-CG-nnn` for a capability gap); unique, never reused |
| Title | At most eight words |
| Statement | One testable sentence using MUST, SHOULD or MAY |
| Rationale | The business or legal reason |
| Source and trace up | BG, BO, R-nn, BRQ, STR, SYS, process step, stakeholder (STK-nn), CR |
| Trace down | Form, screen, data object, event, API, use case, story, test case |
| Priority | MoSCoW |
| Phase | R0, P0–P5 |
| Business rules | `RL-nnn`, `BS:RL-nn`, `INV-xxx-nn` |
| Verification method | Inspection, Analysis, Demonstration or Test |
| Acceptance criterion | Given–When–Then with at least one positive and one negative scenario, plus a measurable threshold |
| Owner | Accountable role |
| Status | Proposed on entry (REQ-01) |
| Volatility counter | Approved CRs that changed the requirement since baseline |
| Defect injection and detection phase · CAR link | Recorded when a defect is traced to the requirement |

## 4. Requirement Block

```markdown
### [<DOM>-FR-nnn] — [Title]

| Attribute | Value |
| :--- | :--- |
| Statement | [The system MUST …] |
| Rationale | [Reason] |
| Source and trace up | [IDs] |
| Trace down | [IDs] |
| Priority | [Must / Should / Could / Won't] |
| Phase | [Pn] |
| Business rules | [RL-nnn] |
| Verification method | [Test] |
| Quantitative threshold | [Measurable pass condition] |
| Owner | [Role] |
| Status | Proposed |
| Volatility counter | 0 |
| Defect injection / detection phase | — |
| CAR link | none |

**Acceptance criteria**

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | [Context] | [Action] | [Observable outcome] |
| 2 | [Context] | [Invalid action] | [Rejection naming the rule and the value] |
```

### 4.1 Business Rules Referenced

| Rule | Statement | Source | Jurisdiction | Effective from |
| :--- | :--- | :--- | :--- | :--- |
| [RL-nnn] | [Rule] | [Workbook sheet or statute] | [IN / state / global] | [YYYY-MM-DD] |

### 4.2 Messages

Every blocked action names the rule and the offending value (FC-7). Messages are held as translation keys, never as literal text in code.

| Condition | Rule or invariant | Message key | Severity | User action offered |
| :--- | :--- | :--- | :--- | :--- |
| [Condition] | [RL-nnn] | [`domain.screen.key`] | [Blocking / Warning / Information] | [Action] |

### 4.3 Audit and Events

State which changes are audited (actor, role, before, after, timestamp, channel) and which domain events (`domain.object.verb`) are published, with their idempotency keys (TPL-04 §8).

### 4.4 Open Items

Open items are raised as `OD-nn` or `Q-nn` in FRS-<DOM>-09 with the accountable role and the gate by which each is closed, and logged in RSK-03.

## 5. Worked Example — PPL-FR-001 Effective-Dated Assignment Change

### PPL-FR-001 — Effective-dated assignment change with arrears

| Attribute | Value |
| :--- | :--- |
| Statement | The system MUST apply an approved change to an assignment's grade, manager, location, cost centre, shift group or worker class from a stated effective date, keeping both the effective date and the recorded date of every version. |
| Rationale | Changes are often approved after the date they take effect. Attendance and payroll must be recomputed from the correct effective date while audit shows when the change was recorded, and a closed payroll run must never be rewritten. |
| Source and trace up | BG-01 · PPL-02 (Assignment change, effective-dated, retro-capable) · PLT-FR-002 (bi-temporal mechanism) |
| Trace down | FRM-PPL-02 Employment, Assignment and Policy · SCR-011 · object `assignment` · event `people.assignment.changed` · PPL-UC-002 · TC-H40, TC-Y41, TC-T42 |
| Priority | Must |
| Phase | P1 |
| Business rules | RL-040 (effective date and reason mandatory), RL-041 (retro change into a closed period produces arrears in the next open run), RL-042 (change to class, rest days, shift group, grace exemption or location queues an attendance recompute) |
| Verification method | Test |
| Quantitative threshold | For 500 generated changes dated in the past, present and future, the assignment read as at every date in a 24-month window is correct in 100% of reads; 0 closed payroll runs altered |
| Owner | Domain Product Owner — People Core |
| Status | Proposed |
| Volatility counter | 0 |
| Defect injection / detection phase | — |
| CAR link | none |

**Acceptance criteria** (golden data: Vindhya Precision Industries Pvt Ltd, fictional)

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1052 Anjaneyulu Gadde works at Medchal Works (LOC-HYD) in shift group PLANT12 | HR operations records a move to Peenya Works (LOC-PLA) effective 2026-12-01, approved on 2026-11-10 | the assignment read as at 2026-11-30 shows LOC-HYD; as at 2026-12-01 it shows LOC-PLA; the version history shows recorded 2026-11-10 and effective 2026-12-01; `people.assignment.changed` is published once, keyed by assignment ID and version |
| 2 | September 2026 payroll run PR-2026-09-01 is closed | HR operations records a shift-group change for E1052 effective 2026-09-15 | the September run is unchanged; any pay difference for 15–30 September is queued as arrears for the next open run (RL-041); an attendance recompute is queued for 2026-09-15 onwards (RL-042) |
| 3 | Any assignment | HR operations saves a change without a reason | the save is blocked with "RL-040: an assignment change needs an effective date and a reason" |

**Field conventions applied:** effective-dated versions, never overwritten (FC-1); reason mandatory (FC-2); audit on every write (FC-3); records end-dated, never deleted (FC-5); blocked save names the rule (FC-7).

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
| Size | 5 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Review rate | *pending review* | sections / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | |

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
