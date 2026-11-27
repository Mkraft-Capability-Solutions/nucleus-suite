<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMP-13 — Compliance — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMP-13 |
| Title | Compliance — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compliance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-CMP-00, FRS-CMP-01, FRS-CMP-02, FRS-CMP-03, FRS-CMP-04, FRS-CMP-05, FRS-CMP-06, FRS-CMP-07, FRS-CMP-08, FRS-CMP-09, FRS-CMP-10, FRS-CMP-11, FRS-CMP-12, FRS-CMP-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06 · R-18, R-27 · processes CMP-01p–CMP-06p |
| Source of record | Derived from FRS-CMP-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

41 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 31, Should 10.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| CMP-US-001 | Compliance engineer | to draft a rule pack with jurisdiction, effective date, supersedes link and a changelog citing the notification | Must | CMP-UC-001 |
| CMP-US-002 | Payroll SME (named reviewer) | a pack to be undeployable unless its golden suite is fully green and my name is recorded as reviewer | Must | CMP-UC-001 |
| CMP-US-003 | Payroll manager | state packs to layer over the central pack in a defined order | Must | CMP-UC-001 |
| CMP-US-004 | Compliance owner | an obligation calendar generated per entity and state with owner and due date | Must | CMP-UC-002 |
| CMP-US-005 | Compliance owner | the filing pack to be assembled only from posted records | Must | CMP-UC-002 |
| CMP-US-006 | Auditor | each closed obligation to carry its acknowledgement and the evidence file | Should | CMP-UC-002 |
| CMP-US-007 | Compliance owner | the form set to be resolved from each plant's own registration | Must | CMP-UC-003 |
| CMP-US-008 | HR operations | Form F to be generated from the employee record as a joining-chain step | Must | CMP-UC-003 |
| CMP-US-009 | Plant HR / time office | the overtime register to be generated only from approved overtime records | Must | CMP-UC-003 |
| CMP-US-010 | HR operations | to see whether a proposed structure passes the 50% wage floor before it is adopted | Must | CMP-UC-004 |
| CMP-US-011 | Finance | the employer statutory cost delta by cost centre | Must | CMP-UC-004 |
| CMP-US-012 | Director / approver | adopting a scenario to create a draft proposal rather than change live pay | Should | CMP-UC-004 |
| CMP-US-013 | Employee / worker | AI-generated content to be clearly labelled with a way to ask for a human | Must | CMP-UC-005 |
| CMP-US-014 | Manager / supervisor | the system to stop me from finalising an adverse decision that only an AI recommended | Must | CMP-UC-005 |
| CMP-US-015 | Auditor | to search the inference log by employee and period | Should | CMP-UC-005 |
| CMP-US-016 | Employee / worker | to request erasure of my personal data after I leave | Must | CMP-UC-006 |
| CMP-US-017 | Data protection officer | a proposed erasure plan that separates erasable, statute-retained and held data | Must | CMP-UC-006 |
| CMP-US-018 | Employee / worker | to withdraw consent for one optional purpose without affecting my employment records | Should | CMP-UC-006 |
| CMP-US-019 | Payroll manager | a shadow run of a closed period under the code packs | Must | CMP-UC-007 |
| CMP-US-020 | Compliance engineer | to schedule code packs to activate on the notified date | Must | CMP-UC-007 |
| CMP-US-021 | Employee / worker | to lodge a complaint that only the Internal Committee can see | Must | CMP-UC-008 |
| CMP-US-022 | Internal Committee member | timelines tracked with overdue alerts | Must | CMP-UC-008 |
| CMP-US-023 | Compliance owner | an annual report generated from closed and open cases | Should | CMP-UC-008 |
| CMP-US-024 | Plant HR / time office | deployment to be blocked when a contractor's licence has expired | Must | CMP-UC-009 |
| CMP-US-025 | Compliance owner | the register of workmen generated from deployment and attendance | Must | CMP-UC-009 |
| CMP-US-026 | Compliance owner | each disclosed metric to carry its lineage | Should | CMP-UC-010 |
| CMP-US-027 | Auditor | locked disclosures that cannot be changed silently | Should | CMP-UC-010 |
| CMP-US-028 | Compliance owner | mandatory training assigned automatically by rule | Must | CMP-UC-011 |
| CMP-US-029 | Manager / supervisor | escalation when a team member's mandatory training is overdue | Must | CMP-UC-011 |
| CMP-US-030 | Employee / worker | to report an injury or hazard from my phone with photos | Must | CMP-UC-012 |
| CMP-US-031 | Compliance owner | a notice prepared from the incident record with its due time | Must | CMP-UC-012 |
| CMP-US-032 | Manager / supervisor | corrective actions tracked to closure with reminders | Must | CMP-UC-012 |
| CMP-US-033 | Employee / worker | to raise a concern anonymously and still follow its progress | Must | CMP-UC-013 |
| CMP-US-034 | Compliance owner | people named in a case excluded from its access | Must | CMP-UC-013 |
| CMP-US-035 | Director / approver | aggregated grievance outcomes by category and site | Should | CMP-UC-013 |
| CMP-US-036 | Compliance owner | alerts well before any licence expires | Must | CMP-UC-014 |
| CMP-US-037 | Plant HR / time office | a renewal pack built from posted headcount | Must | CMP-UC-014 |
| CMP-US-038 | Director / approver | contractor deployments blocked when the contractor's licence has expired | Should | CMP-UC-014 |
| CMP-US-039 | Plant HR / time office | registers for the site produced instantly during an inspection | Must | CMP-UC-015 |
| CMP-US-040 | Compliance owner | each order turned into tracked actions with deadlines | Must | CMP-UC-015 |
| CMP-US-041 | Director / approver | open inspection actions across all sites | Should | CMP-UC-015 |

## 2. Stories with acceptance criteria

### CMP-US-001 · Author, test and deploy a statutory rule pack

As a **Compliance engineer**, I want to draft a rule pack with jurisdiction, effective date, supersedes link and a changelog citing the notification, so that every statutory figure Nucleus computes can be traced back to the legal source that introduced it.

Priority: **Must** · Use case: CMP-UC-001 · Realises: CMP-01p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a draft Maharashtra professional tax pack with effective_from 2026-10-01 and an empty changelog | the engineer submits it for testing | submission is blocked with the message that the changelog must cite the source notification |
| 2 | version 3 of the Maharashtra pack is EFFECTIVE | the engineer saves version 4 with supersedes = version 3 and effective_from 2026-10-01 | version 4 is saved in DRAFT and version 3 remains EFFECTIVE for all periods up to 2026-09-30 |

### CMP-US-002 · Author, test and deploy a statutory rule pack

As a **Payroll SME (named reviewer)**, I want a pack to be undeployable unless its golden suite is fully green and my name is recorded as reviewer, so that no untested or unreviewed statutory change can reach a payroll run.

Priority: **Must** · Use case: CMP-UC-001 · Realises: CMP-01p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a pack with 340 golden cases of which 339 pass | the CI run completes | the build fails, the pack returns to DRAFT and the single failing case is listed with expected and actual values |
| 2 | a pack with 340 of 340 cases passing and no reviewer recorded | deployment is requested | deployment is refused citing the missing reviewer and the pack stays TESTED |

### CMP-US-003 · Author, test and deploy a statutory rule pack

As a **Payroll manager**, I want state packs to layer over the central pack in a defined order, so that an employee at Chakan Works gets the Maharashtra slab while an employee at Peenya Works gets the Karnataka slab in the same run.

Priority: **Must** · Use case: CMP-UC-001 · Realises: CMP-01p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the central pack and the Maharashtra and Karnataka state packs are EFFECTIVE | the September 2026 run for LE-01 computes professional tax | employees at LOC-PUN are computed on the Maharashtra slab and employees at LOC-PLA on the Karnataka slab |
| 2 | version 3 of a pack was superseded on 2026-10-01 | a recompute of August 2026 is requested | the recompute uses version 3, the version effective in August 2026 |

### CMP-US-004 · Prepare, file and close a statutory obligation

As a **Compliance owner**, I want an obligation calendar generated per entity and state with owner and due date, so that I see on one screen every filing that falls due without maintaining a spreadsheet.

Priority: **Must** · Use case: CMP-UC-002 · Realises: CMP-02p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | LE-01 operates in Karnataka and Maharashtra | the August 2026 calendar is generated | separate professional tax obligations appear for KA due 2026-09-20 and MH due 2026-09-30, each with owner E1007 |
| 2 | LE-02's Tamil Nadu professional tax is half-yearly | the August 2026 calendar is generated | OB-2026-0917 shows Not applicable with the next due date 2026-09-30 |

### CMP-US-005 · Prepare, file and close a statutory obligation

As a **Compliance owner**, I want the filing pack to be assembled only from posted records, so that the figures I file always equal what was paid and posted.

Priority: **Must** · Use case: CMP-UC-002 · Realises: CMP-02p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | run PR-2026-09-01 is in PRE_AUDIT | I request the September 2026 PF ECR pack for LE-01 | the request is refused and PR-2026-09-01 is named as the blocking run |
| 2 | run PR-2026-08-01 is POSTED | the agent assembles the August PF pack | every line references a posted payslip line and no figure on the pack is editable |

### CMP-US-006 · Prepare, file and close a statutory obligation

As a **Auditor**, I want each closed obligation to carry its acknowledgement and the evidence file, so that I can verify a filing without asking the compliance team for screenshots.

Priority: **Should** · Use case: CMP-UC-002 · Realises: CMP-02p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | OB-2026-0912 was filed on 2026-09-12 | I open it on SCR-072 | I see filed_on 2026-09-12, the ECR acknowledgement reference and the evidence file, all read-only |
| 2 | an obligation has no acknowledgement reference | the owner attempts to close it | the closure is refused and the obligation remains Due |

### CMP-US-007 · Generate statutory forms and registers for a location

As a **Compliance owner**, I want the form set to be resolved from each plant's own registration, so that three plants in three states each file their own correct set.

Priority: **Must** · Use case: CMP-UC-003 · Realises: CMP-03p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Peenya Works (LOC-PLA, Karnataka) and Oragadam Works (LOC-CHN, Tamil Nadu) are both factories | the H1 2026 muster roll is generated for each | LOC-PLA produces FRM-36-2026-H1 on the Karnataka layout and LOC-CHN produces its Tamil Nadu equivalent on the Tamil Nadu layout |
| 2 | Bengaluru Corporate Office (LOC-BLR) has Factory Act applicability N | the September 2026 form set is resolved | no Factories Rules form appears in the set for LOC-BLR |

### CMP-US-008 · Generate statutory forms and registers for a location

As a **HR operations**, I want Form F to be generated from the employee record as a joining-chain step, so that the form is ready on day one and never chased during an audit week.

Priority: **Must** · Use case: CMP-UC-003 · Realises: CMP-03p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 joins on 2026-09-01 at a factory location | the joining chain reaches the statutory forms step | Form F instance FRM-F-2026-0112 is generated from the employee record with the next gapless serial in the register |
| 2 | the joiner's record lacks the nominee name | the Form F step runs | the step stays open on SCR-060 naming the missing field and no partial form is produced |

### CMP-US-009 · Generate statutory forms and registers for a location

As a **Plant HR / time office**, I want the overtime register to be generated only from approved overtime records, so that the register shown to an inspector always matches what was paid.

Priority: **Must** · Use case: CMP-UC-003 · Realises: CMP-03p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | September 2026 overtime for LOC-PLA has 12 records pending approval | Form 28 generation is requested | generation is refused and the 12 pending records are listed |
| 2 | all September overtime for LOC-PLA is approved | FRM-28-2026-09 is generated | each row traces to an approved overtime record and no cell can be edited by hand |

### CMP-US-010 · Simulate a salary structure against the Labour Codes wage base

As a **HR operations**, I want to see whether a proposed structure passes the 50% wage floor before it is adopted, so that we do not discover a statutory shortfall after payroll has run (to be validated by Legal).

Priority: **Must** · Use case: CMP-UC-004 · Realises: CMP-04p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a proposal for grade band B sets Basic plus DA at 40% of total remuneration | I run the simulation | the floor test fails for every affected employee and the amount treated as wages is shown per employee |
| 2 | a revised proposal sets Basic plus DA at 52% | I run the simulation | the floor test passes and no excess allowance is reclassified |

### CMP-US-011 · Simulate a salary structure against the Labour Codes wage base

As a **Finance**, I want the employer statutory cost delta by cost centre, so that I can budget the change before it is approved.

Priority: **Must** · Use case: CMP-UC-004 · Realises: CMP-04p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a scenario covers 418 LE-01 employees | I open the cost view | the monthly employer PF, ESI and gratuity deltas are shown per cost centre and their sum equals the total delta |
| 2 | Finance adds a comment to the scenario | HR reopens it | the comment is shown with Finance's name and timestamp |

### CMP-US-012 · Simulate a salary structure against the Labour Codes wage base

As a **Director / approver**, I want adopting a scenario to create a draft proposal rather than change live pay, so that no structure changes without the normal approval chain.

Priority: **Should** · Use case: CMP-UC-004 · Realises: CMP-04p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a scenario has passed the floor test | I adopt it | a draft structure-change proposal is created and the live structure for grade band B is unchanged |
| 2 | I reject a scenario with reason 'cost exceeds FY27 budget' | HR opens the scenario list | the scenario shows Rejected with that reason |

### CMP-US-013 · Log, label and disclose AI inferences

As a **Employee / worker**, I want AI-generated content to be clearly labelled with a way to ask for a human, so that I know when a machine was involved in something that affects me.

Priority: **Must** · Use case: CMP-UC-005 · Realises: CMP-05p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the assistant answers a leave policy question | the answer is shown in the mobile app | it carries an AI label and a link to request human review |
| 2 | I request human review of an AI-assisted gate-pass rejection | the request is submitted | a review task is created for HR operations and the rejection is held until a human decides |

### CMP-US-014 · Log, label and disclose AI inferences

As a **Manager / supervisor**, I want the system to stop me from finalising an adverse decision that only an AI recommended, so that accountability for decisions about people stays with a person.

Priority: **Must** · Use case: CMP-UC-005 · Realises: CMP-05p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an agent recommends issuing a warning to E1042 | I try to issue it without entering my own decision and reason | the action is refused and asks for my decision and reason |
| 2 | I record my decision and reason | the warning is issued | the record shows both the AI recommendation and my name as the decision maker |

### CMP-US-015 · Log, label and disclose AI inferences

As a **Auditor**, I want to search the inference log by employee and period, so that I can reconstruct what an agent saw and did.

Priority: **Should** · Use case: CMP-UC-005 · Realises: CMP-05p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the Policy Assistant answered 1,240 questions in September 2026 | I filter the log by employee E1019 and September 2026 | only her entries are returned, each with sources and any linked action ledger record |
| 2 | I export the filtered log | the export completes | the export is read-only and my access is itself recorded in the audit trail |

### CMP-US-016 · Manage DPDP consent, retention and erasure requests

As a **Employee / worker**, I want to request erasure of my personal data after I leave, so that data I no longer need the company to hold is removed.

Priority: **Must** · Use case: CMP-UC-006 · Realises: CMP-06p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | former employee E1068 submits an erasure request on 2026-11-02 and is verified | the DPO approves the plan | a pre-erasure intimation is sent at least 48 hours before erasure (to be validated by Legal) |
| 2 | erasure has completed | E1068 is notified | the notice lists erased categories and the payroll and PF records retained under statute |

### CMP-US-017 · Manage DPDP consent, retention and erasure requests

As a **Data protection officer**, I want a proposed erasure plan that separates erasable, statute-retained and held data, so that I approve a defensible decision rather than assembling it manually.

Priority: **Must** · Use case: CMP-UC-006 · Realises: CMP-06p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a request covers contact details, bank details, payslips and a grievance file under legal hold | the plan is drafted | contact details are erasable, payslips are statute-retained and the grievance file is held with its hold reference |
| 2 | the background verification processor has not confirmed erasure after 5 days | the SLA expires | the request is escalated to me and remains open |

### CMP-US-018 · Manage DPDP consent, retention and erasure requests

As a **Employee / worker**, I want to withdraw consent for one optional purpose without affecting my employment records, so that I stay in control of optional uses of my data.

Priority: **Should** · Use case: CMP-UC-006 · Realises: CMP-06p

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I consented to alumni communications | I withdraw that consent | alumni communications stop and no other records are changed |
| 2 | I have withdrawn alumni consent | HR searches the alumni list | my record does not appear |

### CMP-US-019 · Switch payroll to labour code rule packs by effective date

As a **Payroll manager**, I want a shadow run of a closed period under the code packs, so that I see every employee whose pay would change before the codes go live.

Priority: **Must** · Use case: CMP-UC-007 · Realises: CMP-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | August 2026 LE-01 payroll is closed for 412 employees | a shadow run under the code packs completes | a per-employee difference report is produced and live August results are unchanged |
| 2 | the shadow run shows 37 employees with a changed PF base | I open the report | each of the 37 shows the old base, new base and the rule that caused the change |

### CMP-US-020 · Switch payroll to labour code rule packs by effective date

As a **Compliance engineer**, I want to schedule code packs to activate on the notified date, so that payroll switches on the right day without a release.

Priority: **Must** · Use case: CMP-UC-007 · Realises: CMP-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the wages code pack is PUBLISHED with effective_from 2027-04-01 | the date arrives | the pack becomes EFFECTIVE and the replaced pack becomes SUPERSEDED |
| 2 | no effective date is notified | I try to activate the pack | activation is refused and the pack stays inactive |

### CMP-US-021 · Run a confidential workplace harassment case

As a **Employee / worker**, I want to lodge a complaint that only the Internal Committee can see, so that I can report without fear of exposure.

Priority: **Must** · Use case: CMP-UC-008 · Realises: CMP-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I lodge a complaint at 10:15 on 2026-10-12 | the case is created | I receive an acknowledgement with a case number and my manager cannot see the case |
| 2 | an HR operations user without the committee role searches for my case number | the search runs | no result is returned and the attempt is logged |

### CMP-US-022 · Run a confidential workplace harassment case

As a **Internal Committee member**, I want timelines tracked with overdue alerts, so that inquiries finish within the configured period.

Priority: **Must** · Use case: CMP-UC-008 · Realises: CMP-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the inquiry window is configured as 90 days and the inquiry started on 2026-10-15 | day 80 is reached with no findings recorded | the presiding officer receives a reminder showing 10 days remaining |
| 2 | the window passes with no findings | the deadline passes | the case is flagged overdue and escalated to the compliance owner |

### CMP-US-023 · Run a confidential workplace harassment case

As a **Compliance owner**, I want an annual report generated from closed and open cases, so that I can submit the annual report without compiling it by hand.

Priority: **Should** · Use case: CMP-UC-008 · Realises: CMP-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 4 cases were received in 2026, 3 closed and 1 open | the 2026 report is generated | it shows those counts with no names or identifying details |
| 2 | one case is overdue | the report is generated | the overdue case is counted in the pending column |

### CMP-US-024 · Maintain contract labour registers and returns

As a **Plant HR / time office**, I want deployment to be blocked when a contractor's licence has expired, so that we never use labour from an unlicensed contractor.

Priority: **Must** · Use case: CMP-UC-009 · Realises: CMP-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a contractor's licence for LOC-HYD expires on 2026-09-30 | I deploy one of its workers from 2026-10-01 | the deployment is blocked with the message that the licence has expired |
| 2 | the expiry is 30 days away | the daily check runs on 2026-08-31 | the compliance owner receives a renewal alert |

### CMP-US-025 · Maintain contract labour registers and returns

As a **Compliance owner**, I want the register of workmen generated from deployment and attendance, so that the register always matches who actually worked.

Priority: **Must** · Use case: CMP-UC-009 · Realises: CMP-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | two contractors have workers at LOC-PLA in September 2026 | the register is generated | it lists each worker under the right contractor with attendance days taken from the time records |
| 2 | the August challan of one contractor has not been uploaded | the verification runs | the contractor is flagged and its August invoice is held |

### CMP-US-026 · Produce workforce disclosures for sustainability reporting

As a **Compliance owner**, I want each disclosed metric to carry its lineage, so that I can defend every number to an auditor.

Priority: **Should** · Use case: CMP-UC-010 · Realises: CMP-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | FY 2025-26 payroll for LE-01 and LE-02 is POSTED | the disclosure is generated | each metric shows its definition, query version, record count and as-at timestamp |
| 2 | I drill into total wages for LE-02 | the drill-down opens | it lists the posted runs whose totals sum to the disclosed figure |

### CMP-US-027 · Produce workforce disclosures for sustainability reporting

As a **Auditor**, I want locked disclosures that cannot be changed silently, so that the published figures match the evidence.

Priority: **Should** · Use case: CMP-UC-010 · Realises: CMP-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the disclosure set is locked | a user edits the headcount figure | the edit is refused |
| 2 | a correction is needed after locking | a new version is created with a reason | both versions are retained and the difference is shown |

### CMP-US-028 · Assign and enforce mandatory compliance training

As a **Compliance owner**, I want mandatory training assigned automatically by rule, so that no new joiner is missed.

Priority: **Must** · Use case: CMP-UC-011 · Realises: CMP-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 joins Chakan Works on 2026-09-01 | the joining chain runs | harassment-prevention awareness is assigned due 2026-09-15 and factory safety due 2026-09-03 |
| 2 | a person moves from office to plant role | the change becomes effective | factory safety is assigned with a 2-day due date |

### CMP-US-029 · Assign and enforce mandatory compliance training

As a **Manager / supervisor**, I want escalation when a team member's mandatory training is overdue, so that I can follow up before it becomes a compliance finding.

Priority: **Must** · Use case: CMP-UC-011 · Realises: CMP-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | IND-2026-0090 for E1066 is due 2026-09-15 and incomplete | 2026-09-16 arrives | I receive an overdue escalation naming E1066 and the course |
| 2 | it is still incomplete 7 days later | 2026-09-23 arrives | HR operations receives the escalation |

### CMP-US-030 · Report, investigate and close a safety incident

As a **Employee / worker**, I want to report an injury or hazard from my phone with photos, so that it is recorded immediately and action starts.

Priority: **Must** · Use case: CMP-UC-012 · Realises: CMP-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am at Medchal Works line 2 | I report a hand injury with two photos at 14:20 | the incident is created with site, line and time and my supervisor is notified |
| 2 | I report a hazard anonymously | the report is saved | no identity is stored and the site EHS lead receives it |

### CMP-US-031 · Report, investigate and close a safety incident

As a **Compliance owner**, I want a notice prepared from the incident record with its due time, so that notifiable accidents are filed on time.

Priority: **Must** · Use case: CMP-UC-012 · Realises: CMP-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a lost-time injury classified as notifiable under the Telangana pack | classification is confirmed | an obligation is created with its due time and a prepared notice |
| 2 | the notice is filed with acknowledgement reference TS-ACC-88213 | I record it | the obligation closes and the reference is kept against the incident |

### CMP-US-032 · Report, investigate and close a safety incident

As a **Manager / supervisor**, I want corrective actions tracked to closure with reminders, so that the cause is actually removed.

Priority: **Must** · Use case: CMP-UC-012 · Realises: CMP-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an action 'install light curtain on press 4' due 2026-11-20 | the due date passes without closure | the action is escalated to the site head |
| 2 | all actions are verified | the compliance owner closes the incident | the incident shows closed with the verification date |

### CMP-US-033 · Raise and handle a grievance or protected disclosure

As a **Employee / worker**, I want to raise a concern anonymously and still follow its progress, so that I can speak up without fear of retaliation.

Priority: **Must** · Use case: CMP-UC-013 · Realises: CMP-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I submit an anonymous disclosure about falsified inspection records at Chakan Works | it is saved | I receive a case key and no identity is stored |
| 2 | the investigator posts a question | I log in with my case key | I can read and reply without revealing my identity |

### CMP-US-034 · Raise and handle a grievance or protected disclosure

As a **Compliance owner**, I want people named in a case excluded from its access, so that the investigation is not compromised.

Priority: **Must** · Use case: CMP-UC-013 · Realises: CMP-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a disclosure naming Peenya plant head E1016 | the case is routed | E1016 has no access to the case even though E1016 holds HR scope at the site |
| 2 | the case is not acknowledged within 7 days | the deadline passes | it escalates to the committee chair |

### CMP-US-035 · Raise and handle a grievance or protected disclosure

As a **Director / approver**, I want aggregated grievance outcomes by category and site, so that I can see patterns without exposing individuals.

Priority: **Should** · Use case: CMP-UC-013 · Realises: CMP-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 12 closed cases in Q3 2026 | I open the outcome report | counts by category, site and outcome are shown with no reporter details |
| 2 | a site with fewer than 3 cases in a category | the report is shown | that cell is combined into 'other' to avoid identification |

### CMP-US-036 · Track and renew licences and registrations

As a **Compliance owner**, I want alerts well before any licence expires, so that no site ever operates on an expired licence.

Priority: **Must** · Use case: CMP-UC-014 · Realises: CMP-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the Chakan Works factory licence MH/FAC/2015/03327 expires on 2026-12-31 | the date reaches 2026-10-02 | a renewal obligation is opened and I am alerted |
| 2 | the renewed licence is recorded with validity to 2027-12-31 | I save it | the old version is end-dated and the obligation closes |

### CMP-US-037 · Track and renew licences and registrations

As a **Plant HR / time office**, I want a renewal pack built from posted headcount, so that the figures in the application match our records.

Priority: **Must** · Use case: CMP-UC-014 · Realises: CMP-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Peenya Works has 23 permanent, 2 trainee and 5 third-party workers posted | the pack is prepared | the manpower statement shows those counts |
| 2 | headcount above the licensed capacity | the pack is prepared | the variance is flagged before filing |

### CMP-US-038 · Track and renew licences and registrations

As a **Director / approver**, I want contractor deployments blocked when the contractor's licence has expired, so that we are not exposed as principal employer.

Priority: **Should** · Use case: CMP-UC-014 · Realises: CMP-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | vendor VN-01's licence expired on 2026-10-31 | HR tries to deploy a new VN-01 worker on 2026-11-02 | deployment is blocked with the expired licence named |
| 2 | VN-01 uploads a renewed licence | the compliance owner verifies it | deployments are unblocked |

### CMP-US-039 · Record inspection visits and close resulting orders

As a **Plant HR / time office**, I want registers for the site produced instantly during an inspection, so that the inspector sees accurate records without delay.

Priority: **Must** · Use case: CMP-UC-015 · Realises: CMP-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an inspector at Oragadam Works asks for the October 2026 muster roll | I request it | the register for LOC-CHN and October is produced from posted records |
| 2 | records for two workers are incomplete | the register is produced | the gaps are listed and an action is created |

### CMP-US-040 · Record inspection visits and close resulting orders

As a **Compliance owner**, I want each order turned into tracked actions with deadlines, so that nothing an inspector asks for is missed.

Priority: **Must** · Use case: CMP-UC-015 · Realises: CMP-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an order to display the abstract of the Act in Tamil within 15 days | I record it on 2026-11-04 | an action due 2026-11-19 is assigned to the site HR |
| 2 | the action is overdue | the deadline passes | it is escalated to me and the site head |

### CMP-US-041 · Record inspection visits and close resulting orders

As a **Director / approver**, I want open inspection actions across all sites, so that I can see where we are exposed.

Priority: **Should** · Use case: CMP-UC-015 · Realises: CMP-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 3 open actions at Oragadam and 1 at Medchal | I open the dashboard | I see 4 open actions with sites and due dates |
| 2 | all actions for a visit are verified and the report is filed | the compliance owner closes it | the visit no longer appears as open |

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
| Size | 123 | specified items (table rows) | Counted automatically at generation |
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
