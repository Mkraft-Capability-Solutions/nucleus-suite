<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-INT-13 — Intelligence & Agents — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-INT-13 |
| Title | Intelligence & Agents — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Intelligence & Agents |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-INT-00, FRS-INT-01, FRS-INT-02, FRS-INT-03, FRS-INT-04, FRS-INT-05, FRS-INT-06, FRS-INT-07, FRS-INT-08, FRS-INT-09, FRS-INT-10, FRS-INT-11, FRS-INT-12, FRS-INT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-08 · processes INT-01–INT-04 |
| Source of record | Derived from FRS-INT-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

26 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 14, Should 10, Could 2.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| INT-US-001 | Tenant admin | every agent to act under its own scoped identity and owner | Must | INT-UC-001 |
| INT-US-002 | Director / approver | to approve the dry-run diff before a write executes | Must | INT-UC-001 |
| INT-US-003 | Auditor | every agent action in the ledger with plan, simulation, approval and outcome | Must | INT-UC-001 |
| INT-US-004 | Tenant admin | to reverse a wrong agent action after previewing the reversal | Must | INT-UC-002 |
| INT-US-005 | Auditor | the reversal rate per agent | Should | INT-UC-002 |
| INT-US-006 | Plant HR / time office | an OT register for my site ready to use | Must | INT-UC-003 |
| INT-US-007 | Manager / supervisor | to ask a question in plain words and get a governed answer | Should | INT-UC-003 |
| INT-US-008 | HR operations | attrition risk with the reasons behind it | Should | INT-UC-004 |
| INT-US-009 | Tenant admin | manager exposure off by default | Should | INT-UC-004 |
| INT-US-010 | HR operations | to build a headcount report by site | Must | INT-UC-005 |
| INT-US-011 | Tenant admin | scheduled reports masked per recipient | Must | INT-UC-005 |
| INT-US-012 | Director / approver | attrition by site with drill-down | Must | INT-UC-006 |
| INT-US-013 | HR operations | overtime cost trend by month | Should | INT-UC-006 |
| INT-US-014 | Tenant admin | exports de-identified automatically | Should | INT-UC-007 |
| INT-US-015 | Auditor | each export logged with row counts | Should | INT-UC-007 |
| INT-US-016 | Compliance owner | statutory reports prepared for my review | Must | INT-UC-008 |
| INT-US-017 | Auditor | reports traceable to rule pack version | Must | INT-UC-008 |
| INT-US-018 | HR operations | a heatmap of required versus current skills for a role at one site | Must | INT-UC-009 |
| INT-US-019 | HR operations | to confirm agent-recommended learning assignments from a dry-run | Must | INT-UC-009 |
| INT-US-020 | Auditor | to trace a requisition back to the recommendation and approval that raised it | Should | INT-UC-009 |
| INT-US-021 | Employee / worker | to consent to the network study knowing exactly what is collected | Could | INT-UC-010 |
| INT-US-022 | Director / approver | a team-level map showing isolated and bridging teams | Could | INT-UC-010 |
| INT-US-023 | Manager / supervisor | team absence and coverage shown beside a leave request | Should | INT-UC-011 |
| INT-US-024 | Implementation consultant | to add a context widget to a screen through configuration | Should | INT-UC-011 |
| INT-US-025 | Tenant admin | to expose only selected tools to our enterprise AI assistant | Must | INT-UC-012 |
| INT-US-026 | Data Protection Officer | every external AI tool call recorded with both the service identity and the human on whose behalf it ran | Must | INT-UC-012 |

## 2. Stories with acceptance criteria

### INT-US-001 · Invoke an agent through the policy gate

As a **Tenant admin**, I want every agent to act under its own scoped identity and owner, so that an agent can never do more than a human could.

Priority: **Must** · Use case: INT-UC-001 · Realises: INT-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an agent principal without a named owner | a run is scheduled | the run is refused |
| 2 | the attendance agent's scope excludes payroll tools | its plan includes a payroll tool | the policy gate denies it and records the reason |

### INT-US-002 · Invoke an agent through the policy gate

As a **Director / approver**, I want to approve the dry-run diff before a write executes, so that I know exactly what will change.

Priority: **Must** · Use case: INT-UC-001 · Realises: INT-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the agent proposes a 3-hour regularisation for E1018 above the 120-minute threshold | the diff is produced | I see before and after punch times and must approve |
| 2 | a 45-minute regularisation | the gate evaluates | it auto-approves and records the threshold used |

### INT-US-003 · Invoke an agent through the policy gate

As a **Auditor**, I want every agent action in the ledger with plan, simulation, approval and outcome, so that I can answer what the AI did.

Priority: **Must** · Use case: INT-UC-001 · Realises: INT-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an executed regularisation | I open the ledger | I see agent_id, human approver, inputs, diff, outcome and reversal handle |
| 2 | an agent tries to sanction a loan | no human approves | nothing executes and the attempt is ledgered |

### INT-US-004 · Write the action ledger and reverse an agent action

As a **Tenant admin**, I want to reverse a wrong agent action after previewing the reversal, so that mistakes are corrected safely.

Priority: **Must** · Use case: INT-UC-002 · Realises: INT-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an executed regularisation for E1018 | I request reversal with reason and confirm the preview | the punch returns to its prior state and the action shows REVERSED |
| 2 | an executed statutory filing | I request reversal | reversal is refused as irreversible |

### INT-US-005 · Write the action ledger and reverse an agent action

As a **Auditor**, I want the reversal rate per agent, so that I can judge agent quality.

Priority: **Should** · Use case: INT-UC-002 · Realises: INT-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 100 actions with 4 reversals | I open the metric | the rate shows 4% |
| 2 | I view a reversed action | I open it | reversed_by and reason are shown |

### INT-US-006 · Project analytics and produce operational reports

As a **Plant HR / time office**, I want an OT register for my site ready to use, so that I need not build it.

Priority: **Must** · Use case: INT-UC-003 · Realises: INT-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | shift A 08:00–20:00 OT records at Peenya | I open the OT register for June | rows for Peenya only appear |
| 2 | I schedule weekly delivery | Monday arrives | the report is delivered |

### INT-US-007 · Project analytics and produce operational reports

As a **Manager / supervisor**, I want to ask a question in plain words and get a governed answer, so that I get insights fast.

Priority: **Should** · Use case: INT-UC-003 · Realises: INT-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I ask how many late arrivals my team had in May | the agent answers | a chart and the query appear and the ledger records it |
| 2 | I ask about another team | the agent runs | rows outside my scope are excluded |

### INT-US-008 · Score predictive risk with explanations

As a **HR operations**, I want attrition risk with the reasons behind it, so that I can act early and appropriately.

Priority: **Should** · Use case: INT-UC-004 · Realises: INT-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee scored high risk | I open the score | top factors are listed |
| 2 | I record an intervention | I save | the decision is ledgered with my identity |

### INT-US-009 · Score predictive risk with explanations

As a **Tenant admin**, I want manager exposure off by default, so that scores are handled carefully.

Priority: **Should** · Use case: INT-UC-004 · Realises: INT-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | opt-in disabled | a manager opens team view | no scores are shown |
| 2 | I enable opt-in | the manager reopens | subtree scores appear with guidance |

### INT-US-010 · Build and schedule self-service reports

As a **HR operations**, I want to build a headcount report by site, so that I answer leadership quickly.

Priority: **Must** · Use case: INT-UC-005 · Realises: INT-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | access to headcount data | I group by site | counts per site appear |
| 2 | salary fields restricted for me | I browse fields | salary is not listed |

### INT-US-011 · Build and schedule self-service reports

As a **Tenant admin**, I want scheduled reports masked per recipient, so that distribution cannot leak data.

Priority: **Must** · Use case: INT-UC-005 · Realises: INT-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a recipient without salary access | the schedule runs | salary columns are masked |
| 2 | the agent drafts a report | the user has not confirmed | the report is not saved |

### INT-US-012 · View executive dashboards and people analytics

As a **Director / approver**, I want attrition by site with drill-down, so that I can find hotspots.

Priority: **Must** · Use case: INT-UC-006 · Realises: INT-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | annualised attrition of 14% at Peenya | I drill to departments | department rates appear |
| 2 | a department with 3 women | I view gender split | it is suppressed |

### INT-US-013 · View executive dashboards and people analytics

As a **HR operations**, I want overtime cost trend by month, so that I can manage cost.

Priority: **Should** · Use case: INT-UC-006 · Realises: INT-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | OT data for six months | I open the OT dashboard | a monthly trend appears |
| 2 | I select Pune only | I filter | only Pune data appears |

### INT-US-014 · Export de-identified data to a customer data warehouse

As a **Tenant admin**, I want exports de-identified automatically, so that we share data safely.

Priority: **Should** · Use case: INT-UC-007 · Realises: INT-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a headcount dataset with names | the export runs | names are removed and person IDs pseudonymised |
| 2 | a schema change | the next run executes | a new schema version is documented |

### INT-US-015 · Export de-identified data to a customer data warehouse

As a **Auditor**, I want each export logged with row counts, so that I can verify data leaving.

Priority: **Should** · Use case: INT-UC-007 · Realises: INT-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an export of 25,000 rows | it completes | the log shows 25,000 rows and the definition version |
| 2 | a failed export | retries exhaust | an alert is logged |

### INT-US-016 · Produce statutory and regulatory reports from rule packs

As a **Compliance owner**, I want statutory reports prepared for my review, so that I file on time.

Priority: **Must** · Use case: INT-UC-008 · Realises: INT-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a monthly return due on the 15th | the agent prepares it on the 10th | I see it for review with the rule pack version |
| 2 | I confirm and file | filing completes | evidence is stored with my identity |

### INT-US-017 · Produce statutory and regulatory reports from rule packs

As a **Auditor**, I want reports traceable to rule pack version, so that I can verify correctness.

Priority: **Must** · Use case: INT-UC-008 · Realises: INT-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a filed report | I open it | rule pack version is shown |
| 2 | the agent attempted to file | I view the ledger | the refused attempt is listed |

### INT-US-018 · Analyse skills gaps and act on recommended learning and hiring

As a **HR operations**, I want a heatmap of required versus current skills for a role at one site, so that I can plan training before the new line starts.

Priority: **Must** · Use case: INT-UC-009 · Realises: INT-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the CNC programmer profile requires 5-axis programming at level 3 and 17 of 26 people are at level 1 or 2 | I open the analysis | the heatmap shows a gap of 17 for that skill at Peenya Works |
| 2 | a manager has not confirmed an inferred skill | the heatmap is computed | the unconfirmed skill is excluded and counted separately |

### INT-US-019 · Analyse skills gaps and act on recommended learning and hiring

As a **HR operations**, I want to confirm agent-recommended learning assignments from a dry-run, so that nothing is assigned without my decision.

Priority: **Must** · Use case: INT-UC-009 · Realises: INT-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the agent recommends the 5-axis path for 9 people, within the cap of 50 | I remove E1034 and confirm | 8 assignments are created and each appears in the action ledger with my confirmation |
| 2 | a recommendation covers 60 learners against a cap of 50 | the policy gate evaluates it | it is denied and recorded with the reason |

### INT-US-020 · Analyse skills gaps and act on recommended learning and hiring

As a **Auditor**, I want to trace a requisition back to the recommendation and approval that raised it, so that I can verify the agent acted within policy.

Priority: **Should** · Use case: INT-UC-009 · Realises: INT-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | requisition REQ-2026-131 was raised from a skills recommendation | I open its action ledger entry | I see the recommendation, the dry-run, the approver and the time of approval |
| 2 | the requisition is later cancelled | I view the entry | the reversal is linked to the original action |

### INT-US-021 · Analyse collaboration networks from consented, aggregated metadata

As a **Employee / worker**, I want to consent to the network study knowing exactly what is collected, so that my privacy is respected.

Priority: **Could** · Use case: INT-UC-010 · Realises: INT-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I receive the consent request for the design-production study | I open it | it states that only sender, recipient, time and count are used, never content, and that data is deleted after 90 days |
| 2 | I withdraw consent on day 20 | the withdrawal is processed | my metadata is deleted within 24 hours |

### INT-US-022 · Analyse collaboration networks from consented, aggregated metadata

As a **Director / approver**, I want a team-level map showing isolated and bridging teams, so that I can fix handover problems between sites.

Priority: **Could** · Use case: INT-UC-010 · Realises: INT-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the study covers 31 teams with at least 8 consenting members each | I open the map | design engineering Pune and production Medchal show a weak link with link strength in the bottom 10% |
| 2 | a team has 6 consenting members | the map is built | that team is merged into its parent unit |

### INT-US-023 · Show context metrics embedded in transactional screens

As a **Manager / supervisor**, I want team absence and coverage shown beside a leave request, so that I can approve without opening another report.

Priority: **Should** · Use case: INT-UC-011 · Realises: INT-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 3 team members are approved on leave on 2026-11-24 and shift A has 22 rostered | I open E1066's request | the widget shows 3 overlapping absences and coverage of 82% for that day |
| 2 | the analytics projection is unavailable | I open the request | the widget shows Context unavailable and I can still approve |

### INT-US-024 · Show context metrics embedded in transactional screens

As a **Implementation consultant**, I want to add a context widget to a screen through configuration, so that the tenant gets relevant metrics without custom development.

Priority: **Should** · Use case: INT-UC-011 · Realises: INT-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I add monthly overtime hours per worker to the overtime approval screen | I preview it as a sample supervisor at Chakan Works | it shows only that supervisor's team |
| 2 | I configure a wellbeing metric with minimum group size 5 | a manager of 4 opens the screen | the widget is suppressed |

### INT-US-025 · Connect a client AI environment through the governed MCP tool surface

As a **Tenant admin**, I want to expose only selected tools to our enterprise AI assistant, so that the assistant can help HR staff without any wider access than our own users have.

Priority: **Must** · Use case: INT-UC-012 · Realises: IA-03 MCP server flow

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the connection exposes read_employee, apply_leave and draft_letter | the assistant lists tools for an HR user at LOC-PUN | exactly those three tools are returned and each shows its permission scope |
| 2 | a tool is classified above the connection's ceiling | I try to add it to the connection | the platform blocks it and names the ceiling |

### INT-US-026 · Connect a client AI environment through the governed MCP tool surface

As a **Data Protection Officer**, I want every external AI tool call recorded with both the service identity and the human on whose behalf it ran, so that I can answer any access question from the ledger.

Priority: **Must** · Use case: INT-UC-012 · Realises: IA-03 MCP server flow

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the assistant reads E1043's record for an HR user | I open the action ledger | the entry shows the connection, the HR user, the tool, the policy decision and that masked fields stayed masked |
| 2 | the assistant requests an employee outside the HR user's scope | the call is evaluated | it is refused, no data is returned and the refusal is in the ledger |

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
| Size | 78 | specified items (table rows) | Counted automatically at generation |
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
