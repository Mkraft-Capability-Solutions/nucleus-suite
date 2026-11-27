<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TAL-10 — Talent — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TAL-10 |
| Title | Talent — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Talent |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-TAL-00, FRS-TAL-01, FRS-TAL-02, FRS-TAL-03, FRS-TAL-04, FRS-TAL-05, FRS-TAL-06, FRS-TAL-07, FRS-TAL-08, FRS-TAL-09, FRS-TAL-10, FRS-TAL-11, FRS-TAL-12, FRS-TAL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-05 · R-25, R-26 · processes TAL-01–TAL-05 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| TAL-01 | Requisition raise and position control check | High | P3 | CMP-01, CMP-02 |
| TAL-02 | Candidate pipeline to offer | Medium | P3 | CMP-01 |
| TAL-03 | Referral tracking and award payout | Medium | P2 | CMP-02 |
| TAL-04 | Goal, check-in and review cycle | Medium | P2 | CMP-01, CMP-11 |
| TAL-05 | Skills inference and learning assignment | Medium | P3 | CMP-07, CMP-11 |

Forms specified: 5 with 74 fields; screens: 3; rules: 7.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-TAL-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| TAL-CG-001 | Sourcing and job-board multiposting | Recruiters MUST be able to publish requisitions to the careers site, job boards and social channels and track source effectiveness. | Must | P2 |
| TAL-CG-002 | Applicant tracking pipeline | The system MUST manage candidates through configurable stages with duplicate detection, consent capture, communications and dispositioning. | Must | P2 |
| TAL-CG-003 | Interview scheduling and scorecards | The system MUST schedule interviews against panel calendars and capture structured scorecards per competency before feedback of other panelists is visible. | Must | P2 |
| TAL-CG-004 | Offer management | The system MUST generate offers from approved compensation ranges with approval routing, e-signature and automatic hand-off to pre-boarding. | Must | P2 |
| TAL-CG-005 | Goals and OKR cascade | Employees and managers MUST be able to set goals aligned to cascaded organisational objectives with weights totalling 100% and progress check-ins. | Must | P3 |
| TAL-CG-006 | Continuous feedback and check-ins | The system MUST support ongoing feedback (requested, given, private notes) and periodic manager check-ins. | Must | P3 |
| TAL-CG-007 | Performance reviews and 360 | The system MUST run configurable review templates (self, manager, peer, upward/360) with rating scales and calibration. | Must | P3 |
| TAL-CG-008 | Succession planning and talent pools | HR MUST be able to identify critical positions, nominate successors with readiness levels and manage talent pools. | Must | P3 |
| TAL-CG-009 | Career frameworks and development plans | The system MUST provide career paths, competency frameworks and individual development plans linked to learning. | Should | P3 |
| TAL-CG-010 | Learning catalogue and content ingestion | The LMS MUST provide a course catalogue, curricula, enrolment, classroom sessions and ingestion of SCORM 1.2/2004 and xAPI content with completion tracking. | Must | P3 |
| TAL-CG-011 | Certifications and licence tracking | The system MUST track certifications/licences with expiry, renewal reminders and work-assignment blocking when an expired mandatory certification is detected. | Must | P3 |
| TAL-CG-012 | Candidate relationship management | Recruiters MUST maintain talent pools, nurture campaigns and consent-based communication with past and prospective candidates. | Must | P3 |
| TAL-CG-013 | Campus and bulk hiring | The system MUST support campus drives and bulk frontline hiring with event scheduling, mass assessment, batch offers and batch onboarding. | Must | P3 |
| TAL-CG-014 | Assessments and skill tests | Recruiters SHOULD assign online assessments (aptitude, trade skill, language) with proctoring options and score-based shortlisting. | Should | P3 |
| TAL-CG-015 | Apprenticeship and trainee programmes | The system MUST manage apprentices and trainees with stipend, training milestones, statutory apprenticeship records and conversion outcomes (to be validated by Legal). | Must | P2 |
| TAL-CG-016 | Mentoring and coaching | Employees SHOULD be matched with mentors by skills and goals, with session logging and outcome tracking. | Should | P3 |
| TAL-CG-017 | Learning experience and content authoring | The learning module SHOULD provide personalised feeds, micro-learning authoring, virtual classrooms and multilingual content with offline viewing for plant workers. | Should | P3 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TAL-FX-001 | Skills cloud and inferred skills | Builds a skills ontology and infers skills from roles, learning and projects (with consent), editable by the employee. | Skills-based organisation rather than job-title based. | Analytics projections | Tier 2 | P4 |
| TAL-FX-002 | Internal talent marketplace | Matches people to gigs, projects, mentors and roles by skills and aspirations. | Internal mobility at scale. | Eligibility service | Tier 3 | P5 |
| TAL-FX-003 | Bias-audited recruiting copilot | Drafts job descriptions, screens against must-have criteria with explanations, and runs adverse-impact checks; humans decide every hire. | Faster hiring with fairness evidence. | Recruiting Coordinator agent | Tier 4 | P5 |
| TAL-FX-004 | Adaptive learning paths | Generates personalised learning paths from skill gaps and career goals, re-planned as progress is made. | Learning that adapts to each person. | Template renderer | Tier 2 | P4 |
| TAL-FX-005 | Calibration bias detection | Flags rating distribution anomalies and potential bias patterns during calibration sessions. | Fairer performance outcomes. | Analytics projections | Tier 3 | P4 |
| TAL-FX-006 | Skills-based job architecture generator | Proposes job families, levels and skill requirements from current roles and market-neutral skills taxonomy for HR review. | Builds a skills-based organisation quickly. | Skills cloud | Tier 3 | P5 |
| TAL-FX-007 | AI interview scheduling and panel balancing | Schedules panels across calendars and time zones, balancing interviewer load and panel diversity. | Faster, fairer interview logistics. | Recruiting Coordinator agent | Tier 2 | P4 |

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
| Size | 29 | specified items (table rows) | Counted automatically at generation |
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
