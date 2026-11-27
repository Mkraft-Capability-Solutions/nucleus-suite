<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TAL-13 — Talent — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TAL-13 |
| Title | Talent — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Talent |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-TAL-00, FRS-TAL-01, FRS-TAL-02, FRS-TAL-03, FRS-TAL-04, FRS-TAL-05, FRS-TAL-06, FRS-TAL-07, FRS-TAL-08, FRS-TAL-09, FRS-TAL-10, FRS-TAL-11, FRS-TAL-12, FRS-TAL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-25, R-26 · processes TAL-01–TAL-05 |
| Source of record | Derived from FRS-TAL-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

49 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 28, Should 21.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| TAL-US-001 | Manager / supervisor (hiring manager) | to raise a replacement against the vacated position code | Must | TAL-UC-001 |
| TAL-US-002 | Finance | additions beyond sanctioned strength stopped at approval | Must | TAL-UC-001 |
| TAL-US-003 | Director / approver | to override a sanction block with a recorded reason | Should | TAL-UC-001 |
| TAL-US-004 | HR operations (recruiter) | a ranked list with the reason for each rank | Should | TAL-UC-002 |
| TAL-US-005 | Candidate | to be rejected only by a person with a recorded reason | Must | TAL-UC-002 |
| TAL-US-006 | Employee / worker | to track my referral through stages and see when my award becomes payable | Must | TAL-UC-003 |
| TAL-US-007 | Payroll manager | referral awards to reach me as payroll inputs | Must | TAL-UC-003 |
| TAL-US-008 | Manager / supervisor | an AI-drafted review summary I can edit before signing | Should | TAL-UC-004 |
| TAL-US-009 | Employee / worker | to acknowledge and comment on my signed review | Must | TAL-UC-004 |
| TAL-US-010 | Employee / worker | assigned learning paths with due dates in one place | Must | TAL-UC-005 |
| TAL-US-011 | Manager / supervisor | to confirm skills the system infers for my team | Should | TAL-UC-005 |
| TAL-US-012 | HR operations (recruiter) | to publish one posting to several channels at once | Must | TAL-UC-006 |
| TAL-US-013 | HR operations | hires per source channel | Should | TAL-UC-006 |
| TAL-US-014 | HR operations (recruiter) | duplicate candidates detected at application | Must | TAL-UC-007 |
| TAL-US-015 | Candidate | to choose whether my data is kept for future roles | Must | TAL-UC-007 |
| TAL-US-016 | Interview panel member | to submit my scorecard before seeing others | Must | TAL-UC-008 |
| TAL-US-017 | HR operations (recruiter) | slots proposed automatically from panel availability | Should | TAL-UC-008 |
| TAL-US-018 | HR operations (recruiter) | offers checked against the approved range | Must | TAL-UC-009 |
| TAL-US-019 | Candidate | to e-sign my offer and move to pre-boarding | Must | TAL-UC-009 |
| TAL-US-020 | Employee / worker | to link each goal to a team goal | Must | TAL-UC-010 |
| TAL-US-021 | Manager / supervisor | to see alignment from objectives to individual goals | Should | TAL-UC-010 |
| TAL-US-022 | Employee / worker | to request feedback after a project | Must | TAL-UC-011 |
| TAL-US-023 | Manager / supervisor | private notes only I can read | Should | TAL-UC-011 |
| TAL-US-024 | Director / approver | to adjust ratings in calibration with reasons recorded | Must | TAL-UC-012 |
| TAL-US-025 | Employee / worker | 360 feedback without knowing who said what | Must | TAL-UC-012 |
| TAL-US-026 | HR operations | bench strength for each critical position | Must | TAL-UC-013 |
| TAL-US-027 | Director / approver | to endorse the succession slate | Should | TAL-UC-013 |
| TAL-US-028 | Employee / worker | to see the competency gaps to my target role | Should | TAL-UC-014 |
| TAL-US-029 | Manager / supervisor | to agree my report's development plan | Should | TAL-UC-014 |
| TAL-US-030 | HR operations | to upload SCORM packages | Must | TAL-UC-015 |
| TAL-US-031 | Employee / worker | my completions recorded automatically | Must | TAL-UC-015 |
| TAL-US-032 | Plant HR / time office | assignments blocked when a mandatory certificate has expired | Must | TAL-UC-016 |
| TAL-US-033 | Employee / worker | reminders before my licence expires | Must | TAL-UC-016 |
| TAL-US-034 | HR operations (recruiter) | to fill a talent pool from past finalists who still have valid consent | Must | TAL-UC-017 |
| TAL-US-035 | Candidate | to choose which channels a recruiter may use and to stop all contact in one step | Must | TAL-UC-017 |
| TAL-US-036 | Manager / supervisor (hiring manager) | engaged pool candidates offered to me as soon as my requisition is approved | Should | TAL-UC-017 |
| TAL-US-037 | HR operations (recruiter) | to schedule a drive with fixed slots and phone registration | Must | TAL-UC-018 |
| TAL-US-038 | HR operations (recruiter) | to issue one batch of offers and backfill declines from the waitlist | Must | TAL-UC-018 |
| TAL-US-039 | Plant HR / time office | accepted candidates to arrive as one onboarding cohort | Should | TAL-UC-018 |
| TAL-US-040 | HR operations (recruiter) | a shortlist proposed from test scores that I confirm | Should | TAL-UC-019 |
| TAL-US-041 | Candidate | to resume my test if my connection drops | Should | TAL-UC-019 |
| TAL-US-042 | HR operations | to engage an apprentice batch within the establishment's configured limit | Must | TAL-UC-020 |
| TAL-US-043 | Employee / worker | as an apprentice, to see my milestones and stipend each month | Must | TAL-UC-020 |
| TAL-US-044 | Director / approver | to approve conversions of completing apprentices to operator roles | Should | TAL-UC-020 |
| TAL-US-045 | Employee / worker | to see three suitable mentors with the reasons they were suggested | Should | TAL-UC-021 |
| TAL-US-046 | Manager / supervisor | as a mentor, to keep session notes private to my mentee and me | Should | TAL-UC-021 |
| TAL-US-047 | HR operations | machine-drafted translations that I can send to reviewers before publishing | Should | TAL-UC-022 |
| TAL-US-048 | Employee / worker | to download a module and complete it without network | Should | TAL-UC-022 |
| TAL-US-049 | Manager / supervisor | to see which of my technicians have not completed mandatory safety learning | Should | TAL-UC-022 |

## 2. Stories with acceptance criteria

### TAL-US-001 · Raise a requisition with position control check

As a **Manager / supervisor (hiring manager)**, I want to raise a replacement against the vacated position code, so that the department headcount is not double-counted.

Priority: **Must** · Use case: TAL-UC-001 · Realises: TAL-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | position POS-2214 is vacant | I raise REQ-2026-0037 as a replacement against POS-2214 | it is submitted and sanctioned headroom for the unit is unchanged |
| 2 | I name a position that is currently filled | I submit | submission is refused stating the position must be vacant |

### TAL-US-002 · Raise a requisition with position control check

As a **Finance**, I want additions beyond sanctioned strength stopped at approval, so that approved manpower works as a control.

Priority: **Must** · Use case: TAL-UC-001 · Realises: TAL-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | OU-111 at Peenya has 24 sanctioned and 24 filled | REQ-2026-0041 is raised as an addition | it moves to BLOCKED with headroom 0 shown and does not pass with a warning |
| 2 | the same unit has 24 sanctioned, 22 filled and 1 open | an addition is raised | it is submitted and headroom shows 0 afterwards |

### TAL-US-003 · Raise a requisition with position control check

As a **Director / approver**, I want to override a sanction block with a recorded reason, so that urgent business needs can proceed with accountability.

Priority: **Should** · Use case: TAL-UC-001 · Realises: TAL-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | REQ-2026-0041 is BLOCKED | I override with reason new customer line ramp-up | it moves to SUBMITTED and the audit entry shows my identity and reason |
| 2 | a hiring manager without override rights | they try to override | the action is refused |

### TAL-US-004 · Move candidates through the pipeline to offer

As a **HR operations (recruiter)**, I want a ranked list with the reason for each rank, so that I review the strongest fits first.

Priority: **Should** · Use case: TAL-UC-002 · Realises: TAL-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 60 applicants for a CNC operator requisition | ranking completes | each candidate shows a rank and the matched and missing criteria |
| 2 | the agent's ranking places a candidate last | I view the candidate | the candidate is still in Applied stage and not rejected |

### TAL-US-005 · Move candidates through the pipeline to offer

As a **Candidate**, I want to be rejected only by a person with a recorded reason, so that I am treated fairly.

Priority: **Must** · Use case: TAL-UC-002 · Realises: TAL-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my application is under review | the recruiter rejects it | the rejection carries the recruiter's identity and a selected reason |
| 2 | no human has acted on my application | 30 days pass | my application remains open and is not auto-rejected |

### TAL-US-006 · Track a referral and pay the award through payroll

As a **Employee / worker**, I want to track my referral through stages and see when my award becomes payable, so that I know what I will receive and when.

Priority: **Must** · Use case: TAL-UC-003 · Realises: TAL-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a programme paying 20,000 split 50% on joining and 50% on confirmation | my referred candidate joins on 1 June | 10,000 shows as matured and payable in the June run |
| 2 | the candidate is confirmed on 1 December | confirmation is recorded | the balance of 10,000 matures and is raised in the December run |

### TAL-US-007 · Track a referral and pay the award through payroll

As a **Payroll manager**, I want referral awards to reach me as payroll inputs, so that awards are paid and taxed like any other earning.

Priority: **Must** · Use case: TAL-UC-003 · Realises: TAL-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a matured joining part of 10,000 | the June run is computed | a referral award input of 10,000 appears for the referrer |
| 2 | the June run is finalised before maturity | the award matures | the input is raised in the July run and I am notified |

### TAL-US-008 · Set goals, hold check-ins and complete the review cycle

As a **Manager / supervisor**, I want an AI-drafted review summary I can edit before signing, so that I write better reviews faster while remaining accountable.

Priority: **Should** · Use case: TAL-UC-004 · Realises: TAL-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee with four goals and three check-in notes | I request a draft | a summary marked AI draft appears referencing each goal |
| 2 | I edit two sections and sign | the review is saved | the record shows me as signer and which sections were AI-drafted |

### TAL-US-009 · Set goals, hold check-ins and complete the review cycle

As a **Employee / worker**, I want to acknowledge and comment on my signed review, so that my view is part of the record.

Priority: **Must** · Use case: TAL-UC-004 · Realises: TAL-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my manager signs my review | I open it | I can add comments and acknowledge |
| 2 | I acknowledge | the cycle report is run | my review shows acknowledged with the date |

### TAL-US-010 · Infer skills and assign learning paths

As a **Employee / worker**, I want assigned learning paths with due dates in one place, so that I know what to complete and by when.

Priority: **Must** · Use case: TAL-UC-005 · Realises: TAL-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I joined on 2 June and the induction path is due in 14 days | I open My learning | the induction path shows due 16 June |
| 2 | I complete the path | completion is recorded | a certificate is downloadable and the path shows complete |

### TAL-US-011 · Infer skills and assign learning paths

As a **Manager / supervisor**, I want to confirm skills the system infers for my team, so that skills data stays trustworthy.

Priority: **Should** · Use case: TAL-UC-005 · Realises: TAL-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a proposed skill CNC programming with evidence of a passed course | I confirm it | the skill is added to the employee's profile with the evidence link |
| 2 | a proposed skill I believe is wrong | I reject it | the skill is not stored and the rejection is recorded |

### TAL-US-012 · Publish requisitions to sourcing channels and measure source effectiveness

As a **HR operations (recruiter)**, I want to publish one posting to several channels at once, so that I save time and keep postings consistent.

Priority: **Must** · Use case: TAL-UC-006 · Realises: TAL-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an approved requisition and three configured channels | I publish to all three | each channel shows live with its own tracked link |
| 2 | the requisition is filled | the status changes | the posting is withdrawn from all three channels |

### TAL-US-013 · Publish requisitions to sourcing channels and measure source effectiveness

As a **HR operations**, I want hires per source channel, so that I invest in the channels that work.

Priority: **Should** · Use case: TAL-UC-006 · Realises: TAL-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 40 applicants from the careers site and 60 from a job board with 2 and 1 hires | I open source effectiveness | conversion shows 5% and 1.7% respectively |
| 2 | an applicant first came via a referral link | the applicant is hired | the hire is attributed to referral |

### TAL-US-014 · Manage candidates through a configurable applicant pipeline

As a **HR operations (recruiter)**, I want duplicate candidates detected at application, so that I do not contact the same person twice.

Priority: **Must** · Use case: TAL-UC-007 · Realises: TAL-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a candidate with mobile 9876543210 already exists | a new application uses the same mobile | a merge proposal is shown |
| 2 | I reject the merge because they are different people | I confirm | two separate records remain |

### TAL-US-015 · Manage candidates through a configurable applicant pipeline

As a **Candidate**, I want to choose whether my data is kept for future roles, so that I control my personal data.

Priority: **Must** · Use case: TAL-UC-007 · Realises: TAL-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I consent only for the current role | the requisition closes | my data is scheduled for purge |
| 2 | I consent for future roles for 12 months | 12 months pass | my data is purged |

### TAL-US-016 · Schedule interviews and capture independent scorecards

As a **Interview panel member**, I want to submit my scorecard before seeing others, so that my judgement is independent.

Priority: **Must** · Use case: TAL-UC-008 · Realises: TAL-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | two other panelists have submitted | I open the candidate before submitting | their scores are hidden |
| 2 | I submit my scorecard | I reopen the candidate | all three scorecards are visible |

### TAL-US-017 · Schedule interviews and capture independent scorecards

As a **HR operations (recruiter)**, I want slots proposed automatically from panel availability, so that I schedule interviews in minutes.

Priority: **Should** · Use case: TAL-UC-008 · Realises: TAL-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a panel of three with one common free hour on Thursday | I request scheduling | Thursday's slot is proposed |
| 2 | the candidate accepts the slot | acceptance is recorded | invitations go to all panelists and the candidate |

### TAL-US-018 · Generate, approve and release an offer

As a **HR operations (recruiter)**, I want offers checked against the approved range, so that I never send an unapproved salary.

Priority: **Must** · Use case: TAL-UC-009 · Realises: TAL-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a range maximum of 15,00,000 | I create an offer at 16,00,000 | it routes to an additional approver with excess 1,00,000 shown |
| 2 | an offer at 14,00,000 | I create it | it follows the standard chain |

### TAL-US-019 · Generate, approve and release an offer

As a **Candidate**, I want to e-sign my offer and move to pre-boarding, so that I can prepare to join.

Priority: **Must** · Use case: TAL-UC-009 · Realises: TAL-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an approved and released offer | I e-sign | pre-boarding tasks appear for me |
| 2 | I do not sign before expiry | the expiry date passes | the offer shows expired |

### TAL-US-020 · Set goals aligned to cascaded objectives

As a **Employee / worker**, I want to link each goal to a team goal, so that my contribution is visible.

Priority: **Must** · Use case: TAL-UC-010 · Realises: TAL-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | team goal reduce scrap by 10% | I create a goal reduce scrap on line 3 by 15% weighted 40% | the goal shows linked to the team goal |
| 2 | my goals total 90% | I submit | submission is blocked showing 90% |

### TAL-US-021 · Set goals aligned to cascaded objectives

As a **Manager / supervisor**, I want to see alignment from objectives to individual goals, so that gaps in coverage are visible.

Priority: **Should** · Use case: TAL-UC-010 · Realises: TAL-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an objective with no linked team goal | I open the alignment view | the objective is flagged as uncovered |
| 2 | all objectives linked | I open the view | no flags are shown |

### TAL-US-022 · Give and request continuous feedback

As a **Employee / worker**, I want to request feedback after a project, so that I learn what to improve.

Priority: **Must** · Use case: TAL-UC-011 · Realises: TAL-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I request feedback from two colleagues | they respond | I see both responses |
| 2 | a colleague chooses recipient-only visibility | my manager opens my feedback | that response is not shown |

### TAL-US-023 · Give and request continuous feedback

As a **Manager / supervisor**, I want private notes only I can read, so that I prepare honest reviews.

Priority: **Should** · Use case: TAL-UC-011 · Realises: TAL-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I write a private note | the employee views their record | the note is not shown |
| 2 | HR exports feedback | the export runs | my private note is excluded |

### TAL-US-024 · Run performance reviews with 360 input and calibration

As a **Director / approver**, I want to adjust ratings in calibration with reasons recorded, so that ratings are fair and defensible.

Priority: **Must** · Use case: TAL-UC-012 · Realises: TAL-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a proposed rating of 4 | I change it to 3 with reason | the change and reason are recorded |
| 2 | I change a rating without a reason | I save | save is blocked |

### TAL-US-025 · Run performance reviews with 360 input and calibration

As a **Employee / worker**, I want 360 feedback without knowing who said what, so that colleagues answer honestly.

Priority: **Must** · Use case: TAL-UC-012 · Realises: TAL-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | five peers responded | I view my review | comments show without names |
| 2 | only two peers responded | I view my review | peer responses are suppressed |

### TAL-US-026 · Plan succession for critical positions

As a **HR operations**, I want bench strength for each critical position, so that I focus on the riskiest gaps.

Priority: **Must** · Use case: TAL-UC-013 · Realises: TAL-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a critical plant head position with one successor ready in 3+ years | I open bench strength | it shows as high risk |
| 2 | a ready-now successor is added | I refresh | risk shows low |

### TAL-US-027 · Plan succession for critical positions

As a **Director / approver**, I want to endorse the succession slate, so that the plan is owned by leadership.

Priority: **Should** · Use case: TAL-UC-013 · Realises: TAL-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a slate of 12 critical positions | I endorse it | the slate is marked endorsed with my identity and date |
| 2 | a nominee resigns | the exit is recorded | the nomination is removed and the position re-flagged |

### TAL-US-028 · Build career paths and individual development plans

As a **Employee / worker**, I want to see the competency gaps to my target role, so that I know what to develop.

Priority: **Should** · Use case: TAL-UC-014 · Realises: TAL-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am a quality inspector targeting quality engineer | I open the path | three competency gaps are listed |
| 2 | I add learning for a gap | I complete the course | the gap shows progress |

### TAL-US-029 · Build career paths and individual development plans

As a **Manager / supervisor**, I want to agree my report's development plan, so that we share accountability.

Priority: **Should** · Use case: TAL-UC-014 · Realises: TAL-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a submitted plan | I agree it | it shows agreed with the date |
| 2 | I return it with comments | the employee opens it | the comments are visible |

### TAL-US-030 · Manage the learning catalogue and ingest content

As a **HR operations**, I want to upload SCORM packages, so that I reuse existing content.

Priority: **Must** · Use case: TAL-UC-015 · Realises: TAL-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a valid SCORM 2004 package | I upload | the course is registered |
| 2 | a package with a broken manifest | I upload | validation errors are shown |

### TAL-US-031 · Manage the learning catalogue and ingest content

As a **Employee / worker**, I want my completions recorded automatically, so that I get credit without paperwork.

Priority: **Must** · Use case: TAL-UC-015 · Realises: TAL-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I finish an xAPI course with score 85 | completion is sent | My learning shows complete with 85 |
| 2 | I exit midway | I return | I resume where I left off |

### TAL-US-032 · Track certifications and block assignments on expiry

As a **Plant HR / time office**, I want assignments blocked when a mandatory certificate has expired, so that we stay compliant.

Priority: **Must** · Use case: TAL-UC-016 · Realises: TAL-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's forklift licence expired yesterday | the supervisor assigns E1018 to forklift duty on shift A 08:00–20:00 | the assignment is blocked naming the expired licence |
| 2 | E1018 uploads a renewed licence which is verified | the supervisor assigns again | the assignment succeeds |

### TAL-US-033 · Track certifications and block assignments on expiry

As a **Employee / worker**, I want reminders before my licence expires, so that I can renew in time.

Priority: **Must** · Use case: TAL-UC-016 · Realises: TAL-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my licence expires on 30 June | it is 31 May | I receive a 30-day reminder |
| 2 | I renewed on 10 June | it is 23 June | no 7-day reminder is sent |

### TAL-US-034 · Build a consented talent pool and nurture it until a role opens

As a **HR operations (recruiter)**, I want to fill a talent pool from past finalists who still have valid consent, so that I can approach warm candidates before advertising.

Priority: **Must** · Use case: TAL-UC-017 · Realises: TAL-CG-012

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 312 past candidates match the CNC setter criteria and 41 have expired consent | I generate pool suggestions | 271 candidates are suggested and none with expired consent appears |
| 2 | a suggested candidate is active in requisition REQ-2026-118 | I add her to the pool | she is flagged as in process and excluded from the campaign |

### TAL-US-035 · Build a consented talent pool and nurture it until a role opens

As a **Candidate**, I want to choose which channels a recruiter may use and to stop all contact in one step, so that I control how my data is used.

Priority: **Must** · Use case: TAL-UC-017 · Realises: TAL-CG-012

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I consented to email only | the Chakan Works open-house campaign runs | I receive it by email and nothing on the messaging channel |
| 2 | I select unsubscribe from any message | the request is processed | no further campaign message reaches me after 5 minutes |

### TAL-US-036 · Build a consented talent pool and nurture it until a role opens

As a **Manager / supervisor (hiring manager)**, I want engaged pool candidates offered to me as soon as my requisition is approved, so that I can start interviews within the week.

Priority: **Should** · Use case: TAL-UC-017 · Realises: TAL-CG-012

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my requisition for 4 CNC setters at Chakan Works is approved | the recruiter matches the pool | 12 engaged candidates appear in my pipeline with their nurture history |
| 2 | a matched candidate's notice period is 90 days | I review the shortlist | the notice period is shown on the candidate card |

### TAL-US-037 · Run a bulk hiring drive from registration to batch onboarding

As a **HR operations (recruiter)**, I want to schedule a drive with fixed slots and phone registration, so that candidates arrive in manageable waves.

Priority: **Must** · Use case: TAL-UC-018 · Realises: TAL-CG-013

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a drive with three slots of 40 | the 41st candidate selects slot 1 | slot 1 is shown as full and slot 2 is offered |
| 2 | a candidate registers again with the same mobile number | the registration is submitted | it is merged with the earlier registration |

### TAL-US-038 · Run a bulk hiring drive from registration to batch onboarding

As a **HR operations (recruiter)**, I want to issue one batch of offers and backfill declines from the waitlist, so that the cohort reaches 120 joiners.

Priority: **Must** · Use case: TAL-UC-018 · Realises: TAL-CG-013

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 120 offers are approved and 104 are accepted by 2026-12-20 | the deadline passes | the next 16 waitlisted candidates are proposed in rank order for my confirmation |
| 2 | I confirm the 16 | the approval completes | 16 new offers are released |

### TAL-US-039 · Run a bulk hiring drive from registration to batch onboarding

As a **Plant HR / time office**, I want accepted candidates to arrive as one onboarding cohort, so that induction and document checks are planned for a single joining day.

Priority: **Should** · Use case: TAL-UC-018 · Realises: TAL-CG-013

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 120 acceptances with joining date 2027-01-04 | the cohort is created | each joiner has induction and document tasks due before 2027-01-04 |
| 2 | a joiner has not uploaded an address proof by 2027-01-02 | the reminder job runs | the joiner and Plant HR are reminded |

### TAL-US-040 · Assign an online assessment and shortlist on score

As a **HR operations (recruiter)**, I want a shortlist proposed from test scores that I confirm, so that I screen hundreds of applicants quickly without losing judgement.

Priority: **Should** · Use case: TAL-UC-019 · Realises: TAL-CG-014

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 40 candidates finish the CNC operator screen with cut-off 60% | scoring completes | the 23 candidates scoring 60% or more are proposed for my confirmation |
| 2 | a candidate scoring 72% has a second-face proctoring flag | I uphold the flag with a note | the candidate is excluded and the note is kept with the attempt |

### TAL-US-041 · Assign an online assessment and shortlist on score

As a **Candidate**, I want to resume my test if my connection drops, so that a network problem does not cost me the opportunity.

Priority: **Should** · Use case: TAL-UC-019 · Realises: TAL-CG-014

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I have answered 14 questions with 11 minutes left | my connection drops and I reopen the link | I resume at question 15 with 11 minutes remaining |
| 2 | I declared a disability and extra time was approved | I start the test | my timer shows 25% more time than standard |

### TAL-US-042 · Engage, train and convert apprentices and trainees

As a **HR operations**, I want to engage an apprentice batch within the establishment's configured limit, so that we stay within statutory engagement rules.

Priority: **Must** · Use case: TAL-UC-020 · Realises: TAL-CG-015

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the configured limit allows 32 more apprentices at Chakan Works | I create 30 engagements | all 30 are created and the remaining capacity shows 2 |
| 2 | the configured limit allows 2 more apprentices | I try to create 5 | 3 engagements are blocked with the limit shown |

### TAL-US-043 · Engage, train and convert apprentices and trainees

As a **Employee / worker**, I want as an apprentice, to see my milestones and stipend each month, so that I know how I am progressing and what I will be paid.

Priority: **Must** · Use case: TAL-UC-020 · Realises: TAL-CG-015

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am apprentice A-2026-014 and passed basic training on 2026-08-31 | I open my training plan | basic training shows Passed and the milling rotation shows In progress |
| 2 | I attended 24 of 26 working days in October 2026 | the stipend is computed | my stipend reflects 24 attended days |

### TAL-US-044 · Engage, train and convert apprentices and trainees

As a **Director / approver**, I want to approve conversions of completing apprentices to operator roles, so that we retain trained people against open positions.

Priority: **Should** · Use case: TAL-UC-020 · Realises: TAL-CG-015

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 6 apprentices complete on 2026-12-31 and 4 operator positions are open | I review the list | I can approve at most 4 conversions |
| 2 | I approve the conversion of apprentice A-2026-009 | the approval completes | a hire is started with the apprenticeship record linked |

### TAL-US-045 · Match a mentee with a mentor and track outcomes

As a **Employee / worker**, I want to see three suitable mentors with the reasons they were suggested, so that I can choose someone who fits my goal.

Priority: **Should** · Use case: TAL-UC-021 · Realises: TAL-CG-016

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1021 at Peenya Works sets the goal shift supervisor with Hindi as preferred language | suggestions load | three mentors appear, each with matched skills, language and free capacity |
| 2 | a suggested mentor has capacity 0 | suggestions are ranked | that mentor is not shown |

### TAL-US-046 · Match a mentee with a mentor and track outcomes

As a **Manager / supervisor**, I want as a mentor, to keep session notes private to my mentee and me, so that we can speak openly.

Priority: **Should** · Use case: TAL-UC-021 · Realises: TAL-CG-016

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I have logged 4 sessions with E1021 | HR opens the programme report | HR sees 4 sessions counted but none of the notes |
| 2 | my capacity is 2 and I have 2 active mentees | a new request is sent to me | the request is not allowed and the mentee sees other suggestions |

### TAL-US-047 · Author multilingual micro-learning and deliver it to plant workers offline

As a **HR operations**, I want machine-drafted translations that I can send to reviewers before publishing, so that workers get accurate safety content in their language quickly.

Priority: **Should** · Use case: TAL-UC-022 · Realises: TAL-CG-017

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the module is authored in English | I request translations | drafts for Hindi, Marathi, Tamil and Telugu are created with status Awaiting review |
| 2 | only Hindi and Marathi are approved on the publish date | I publish | only Hindi, Marathi and English are released and Tamil and Telugu stay in review |

### TAL-US-048 · Author multilingual micro-learning and deliver it to plant workers offline

As a **Employee / worker**, I want to download a module and complete it without network, so that I can learn in the hostel where the signal is weak.

Priority: **Should** · Use case: TAL-UC-022 · Realises: TAL-CG-017

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 downloaded Lockout-tagout in five minutes | she completes it offline on 2026-11-10 | the app stores the completion locally with the timestamp |
| 2 | her phone reconnects on 2026-11-12, after the due date of 2026-11-11 | sync runs | the completion is recorded as on time with the 2026-11-10 timestamp |

### TAL-US-049 · Author multilingual micro-learning and deliver it to plant workers offline

As a **Manager / supervisor**, I want to see which of my technicians have not completed mandatory safety learning, so that I can follow up before the due date.

Priority: **Should** · Use case: TAL-UC-022 · Realises: TAL-CG-017

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 18 of 22 technicians have completed the module | I open team learning | 4 names are listed as pending with the due date |
| 2 | a technician completes it on the kiosk | the completion is recorded | the technician is removed from the pending list |

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
| Size | 147 | specified items (table rows) | Counted automatically at generation |
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
