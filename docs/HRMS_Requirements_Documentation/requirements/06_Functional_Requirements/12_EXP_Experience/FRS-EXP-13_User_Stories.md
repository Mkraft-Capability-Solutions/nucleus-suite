<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-EXP-13 — Experience — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-EXP-13 |
| Title | Experience — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Experience |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-EXP-00, FRS-EXP-01, FRS-EXP-02, FRS-EXP-03, FRS-EXP-04, FRS-EXP-05, FRS-EXP-06, FRS-EXP-07, FRS-EXP-08, FRS-EXP-09, FRS-EXP-10, FRS-EXP-11, FRS-EXP-12, FRS-EXP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-19, R-20, R-21, R-22 · processes EXP-01–EXP-03 |
| Source of record | Derived from FRS-EXP-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

20 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Should 10, Must 8, Could 2.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| EXP-US-001 | Manager / supervisor | to nominate a star employee with a citation | Must | EXP-UC-001 |
| EXP-US-002 | Payroll manager | recognition cash awards as payroll inputs | Must | EXP-UC-001 |
| EXP-US-003 | Employee / worker | my award announced to colleagues automatically | Should | EXP-UC-001 |
| EXP-US-004 | HR operations | birthday and new joiner announcements raised automatically | Must | EXP-UC-002 |
| EXP-US-005 | Employee / worker | to see only announcements meant for my site | Should | EXP-UC-002 |
| EXP-US-006 | HR operations | letters drafted from templates with merge fields filled | Must | EXP-UC-003 |
| EXP-US-007 | Auditor | reprints to reproduce the original version | Must | EXP-UC-003 |
| EXP-US-008 | Employee / worker | to answer surveys knowing I cannot be identified | Must | EXP-UC-004 |
| EXP-US-009 | Manager / supervisor | team eNPS and an action plan | Should | EXP-UC-004 |
| EXP-US-010 | Employee / worker | to withdraw consent and have my data deleted | Should | EXP-UC-005 |
| EXP-US-011 | HR operations | aggregate participation only | Should | EXP-UC-005 |
| EXP-US-012 | Employee / worker | to join an interest community | Could | EXP-UC-006 |
| EXP-US-013 | HR operations | to remove posts violating policy with reason | Could | EXP-UC-006 |
| EXP-US-014 | HR operations | representation and promotion rates by site and grade with small groups hidden | Must | EXP-UC-007 |
| EXP-US-015 | Director / approver | each inclusion action tied to a metric with an owner and date | Must | EXP-UC-007 |
| EXP-US-016 | Auditor | to confirm suppression was applied to a published pack | Should | EXP-UC-007 |
| EXP-US-017 | Employee / worker | to opt out of birthday announcements but keep work anniversaries | Should | EXP-UC-008 |
| EXP-US-018 | Manager / supervisor | to be reminded of my team's celebrations a day early for night-shift staff | Should | EXP-UC-008 |
| EXP-US-019 | HR operations | to target a safety message by site, shift and language and see acknowledgement live | Should | EXP-UC-009 |
| EXP-US-020 | Plant HR / time office | to record acknowledgement for workers briefed in a toolbox talk | Should | EXP-UC-009 |

## 2. Stories with acceptance criteria

### EXP-US-001 · Nominate, approve and pay a recognition award

As a **Manager / supervisor**, I want to nominate a star employee with a citation, so that good work is recognised formally.

Priority: **Must** · Use case: EXP-UC-001 · Realises: EXP-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the star employee programme for June with a 5,000 award | I nominate E1018 with a citation | the nomination is created with period June |
| 2 | I leave the citation empty | I submit | submission is blocked |

### EXP-US-002 · Nominate, approve and pay a recognition award

As a **Payroll manager**, I want recognition cash awards as payroll inputs, so that they are taxed and paid properly.

Priority: **Must** · Use case: EXP-UC-001 · Realises: EXP-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an approved award of 5,000 for E1018 | the July run is computed | a recognition award input of 5,000 appears |
| 2 | an approved award with no cash | the run is computed | no input appears |

### EXP-US-003 · Nominate, approve and pay a recognition award

As a **Employee / worker**, I want my award announced to colleagues automatically, so that my recognition is visible.

Priority: **Should** · Use case: EXP-UC-001 · Realises: EXP-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my award is approved | approval completes | an announcement referencing my award appears to the programme audience |
| 2 | HR withholds the announcement with a reason | approval completes | no announcement is published and the reason is recorded |

### EXP-US-004 · Generate and publish announcements

As a **HR operations**, I want birthday and new joiner announcements raised automatically, so that no one has to type them daily.

Priority: **Must** · Use case: EXP-UC-002 · Realises: EXP-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's birthday is today and a joiner is dated today | the daily run executes | both announcements are drafted for the configured audience |
| 2 | I withhold one with a reason | publish time arrives | it is not published and the reason is recorded |

### EXP-US-005 · Generate and publish announcements

As a **Employee / worker**, I want to see only announcements meant for my site, so that my feed stays relevant.

Priority: **Should** · Use case: EXP-UC-002 · Realises: EXP-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an announcement targeted to the Pune site | I work at Peenya | I do not see it |
| 2 | an entity-wide announcement | I open my feed | I see it |

### EXP-US-006 · Generate, approve and issue HR letters

As a **HR operations**, I want letters drafted from templates with merge fields filled, so that I issue letters quickly and accurately.

Priority: **Must** · Use case: EXP-UC-003 · Realises: EXP-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an appointment template and employee E1066 | I generate the letter | the draft shows E1066's name, designation and joining date |
| 2 | a template referencing a missing field | I save it | save fails naming the field |

### EXP-US-007 · Generate, approve and issue HR letters

As a **Auditor**, I want reprints to reproduce the original version, so that issued letters remain defensible.

Priority: **Must** · Use case: EXP-UC-003 · Realises: EXP-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an appointment letter issued to E1066 from an earlier template version | I reprint two years later after the template changed | the reprint matches the original |
| 2 | I open the issue record | I view details | template version, issuer and date are shown |

### EXP-US-008 · Run pulse and engagement surveys

As a **Employee / worker**, I want to answer surveys knowing I cannot be identified, so that I give honest feedback.

Priority: **Must** · Use case: EXP-UC-004 · Realises: EXP-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a threshold of 5 | my team has 4 respondents | my manager sees results only at the next level |
| 2 | I answer in Hindi | results are viewed | responses are aggregated with others |

### EXP-US-009 · Run pulse and engagement surveys

As a **Manager / supervisor**, I want team eNPS and an action plan, so that I can improve engagement.

Priority: **Should** · Use case: EXP-UC-004 · Realises: EXP-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 12 respondents in my team | results release | eNPS and question scores are shown |
| 2 | I create an action plan | HR views progress | the plan appears with status |

### EXP-US-010 · Manage wellbeing programmes with consent

As a **Employee / worker**, I want to withdraw consent and have my data deleted, so that I stay in control.

Priority: **Should** · Use case: EXP-UC-005 · Realises: EXP-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I joined a step challenge | I withdraw consent | my step data is deleted |
| 2 | I open EAP contacts | I view them | no access record is stored |

### EXP-US-011 · Manage wellbeing programmes with consent

As a **HR operations**, I want aggregate participation only, so that programmes are measured without intruding.

Priority: **Should** · Use case: EXP-UC-005 · Realises: EXP-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 80 participants | I open the report | only totals are shown |
| 2 | a manager requests individual data | the request is made | it is refused |

### EXP-US-012 · Moderate communities and the social feed

As a **Employee / worker**, I want to join an interest community, so that I connect beyond my team.

Priority: **Could** · Use case: EXP-UC-006 · Realises: EXP-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a cricket community | I join | I see its posts |
| 2 | I post a match update | it passes screening | members see it |

### EXP-US-013 · Moderate communities and the social feed

As a **HR operations**, I want to remove posts violating policy with reason, so that the feed stays respectful.

Priority: **Could** · Use case: EXP-UC-006 · Realises: EXP-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a reported post | I remove it with reason | it is hidden and the author is notified |
| 2 | I keep a reported post | I record the decision | the report closes |

### EXP-US-014 · Analyse representation, pay and progression with privacy thresholds and track actions

As a **HR operations**, I want representation and promotion rates by site and grade with small groups hidden, so that I can see real patterns without exposing anyone.

Priority: **Must** · Use case: EXP-UC-007 · Realises: EXP-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the minimum group size is 10 and women in grade band M at Medchal Works number 7 | I view representation by site and grade | that cell shows Suppressed and the derivable neighbour cell is also suppressed |
| 2 | promotion data for Chakan Works covers 140 eligible employees | I view promotion rates by gender | rates are shown with group sizes and the 8-quarter trend |

### EXP-US-015 · Analyse representation, pay and progression with privacy thresholds and track actions

As a **Director / approver**, I want each inclusion action tied to a metric with an owner and date, so that commitments are tracked rather than forgotten.

Priority: **Must** · Use case: EXP-UC-007 · Realises: EXP-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an action targets 12% women shift supervisors at Medchal Works by 2027-12-31 from 6% | the Q1 2027 metric is computed at 8% | the action card shows 8% against the 12% target |
| 2 | an action passes its due date unmet | the quarterly review runs | it is flagged overdue to its owner and to me |

### EXP-US-016 · Analyse representation, pay and progression with privacy thresholds and track actions

As a **Auditor**, I want to confirm suppression was applied to a published pack, so that I can attest that the analysis protected individuals.

Priority: **Should** · Use case: EXP-UC-007 · Realises: EXP-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the Q4 2026 pack is published | I open its suppression log | every suppressed cell is listed with the rule applied |
| 2 | I re-run the pack against its recorded projection version | the run completes | the figures match the published pack |

### EXP-US-017 · Recognise birthdays, work anniversaries and milestones automatically

As a **Employee / worker**, I want to opt out of birthday announcements but keep work anniversaries, so that I control what is shared about me.

Priority: **Should** · Use case: EXP-UC-008 · Realises: EXP-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1032 has opted out of birthdays and kept anniversaries | his birthday on 2026-11-14 arrives | no card or manager prompt is generated |
| 2 | E1032's 5-year anniversary falls on 2026-12-01 | the daily job runs | an anniversary card is posted and his manager is prompted |

### EXP-US-018 · Recognise birthdays, work anniversaries and milestones automatically

As a **Manager / supervisor**, I want to be reminded of my team's celebrations a day early for night-shift staff, so that I can wish them before their shift.

Priority: **Should** · Use case: EXP-UC-008 · Realises: EXP-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 works shift C 22:00–06:00 and her birthday is 2026-11-20 | the job runs on 2026-11-19 | I receive the reminder that day |
| 2 | I tap send on the suggested message | it is sent | E1066 receives it in the app |

### EXP-US-019 · Run a targeted multilingual safety campaign with acknowledgement tracking

As a **HR operations**, I want to target a safety message by site, shift and language and see acknowledgement live, so that I know the instruction reached everyone on the floor.

Priority: **Should** · Use case: EXP-UC-009 · Realises: EXP-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the campaign targets 1,180 production workers at Chakan and Oragadam Works | it launches | each worker receives the approved version in their preferred language |
| 2 | 940 have acknowledged by day 3 | I open the campaign | I see 79.7% acknowledged with a breakdown by site and shift |

### EXP-US-020 · Run a targeted multilingual safety campaign with acknowledgement tracking

As a **Plant HR / time office**, I want to record acknowledgement for workers briefed in a toolbox talk, so that workers without phones are still covered.

Priority: **Should** · Use case: EXP-UC-009 · Realises: EXP-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 32 workers on shift B at Oragadam Works attended the toolbox talk | I record bulk acknowledgement with the attendance sheet | all 32 show acknowledged with channel Toolbox talk |
| 2 | the attendance sheet lists 33 workers and one is not in the campaign audience | I submit the bulk acknowledgement | that worker is rejected with a reason and the other 32 are recorded |

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
| Size | 60 | specified items (table rows) | Counted automatically at generation |
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
