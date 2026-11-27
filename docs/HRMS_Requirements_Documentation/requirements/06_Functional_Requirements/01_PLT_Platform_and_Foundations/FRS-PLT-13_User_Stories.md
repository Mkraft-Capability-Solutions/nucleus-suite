<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-13 — Platform & Foundations — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-13 |
| Title | Platform & Foundations — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Platform & Foundations |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Derived from FRS-PLT-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

73 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 52, Should 21.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| PLT-US-001 | Implementation consultant | to provision a client tenant from a single request form with automated seeding and checks | Must | PLT-UC-001 |
| PLT-US-002 | Tenant admin | to receive an activation link for the first administrator account of my new tenant | Must | PLT-UC-001 |
| PLT-US-003 | Auditor | evidence that a newly provisioned tenant cannot read another tenant's rows | Must | PLT-UC-001 |
| PLT-US-004 | Tenant admin | to register an agent principal only together with a named accountable human owner | Must | PLT-UC-002 |
| PLT-US-005 | Tenant admin | to grant a plant HR user location scope for one site with time-edit rights | Must | PLT-UC-002 |
| PLT-US-006 | Plant HR / time office | to see attendance but never salary or rate data for head-office-payrolled employees at my site | Must | PLT-UC-002 |
| PLT-US-007 | Auditor | assurance that a failure in scope resolution never widens access | Must | PLT-UC-002 |
| PLT-US-008 | Implementation consultant | to publish a leave policy change that applies only from a future date | Must | PLT-UC-003 |
| PLT-US-009 | Implementation consultant | to simulate a configuration change against real employees before submitting it | Must | PLT-UC-003 |
| PLT-US-010 | Auditor | to read the configuration that applied on a given date | Should | PLT-UC-003 |
| PLT-US-011 | Implementation consultant | to publish a new chain version without disturbing requests already in progress | Must | PLT-UC-004 |
| PLT-US-012 | Implementation consultant | to simulate which approver each step would resolve to for a sample request | Must | PLT-UC-004 |
| PLT-US-013 | Tenant admin | every chain version to record who published it, when and why | Should | PLT-UC-004 |
| PLT-US-014 | Manager / supervisor | to decide every pending request from one inbox with the rule context shown | Must | PLT-UC-005 |
| PLT-US-015 | Employee / worker | to be told the reason when my request is rejected | Must | PLT-UC-005 |
| PLT-US-016 | HR operations | to edit or close a request at any stage with my reason on record | Must | PLT-UC-005 |
| PLT-US-017 | Director / approver | items queued against a departed approver to reach me as the successor | Must | PLT-UC-005 |
| PLT-US-018 | Auditor | to see agent actions in the same ledger as human actions with the owner named | Must | PLT-UC-006 |
| PLT-US-019 | Compliance owner | every view of an unmasked PAN or bank account to be logged | Must | PLT-UC-006 |
| PLT-US-020 | Tenant admin | the ledger to be impossible to edit even with my privileges | Must | PLT-UC-006 |
| PLT-US-021 | Finance | each approved payroll or approval event to reach the ERP system exactly once | Must | PLT-UC-007 |
| PLT-US-022 | Implementation consultant | to change the event transport without touching producing services | Should | PLT-UC-007 |
| PLT-US-023 | Auditor | a write that rolled back to leave no published event | Must | PLT-UC-007 |
| PLT-US-024 | Payroll manager | a rerun of a closed period to read data as known at that run's snapshot | Must | PLT-UC-008 |
| PLT-US-025 | HR operations | corrections to be stored as new versions rather than overwrites | Must | PLT-UC-008 |
| PLT-US-026 | Auditor | to query what the system believed about a record on a past date | Should | PLT-UC-008 |
| PLT-US-027 | Payroll manager | to confirm my identity again before approving a payroll | Must | PLT-UC-009 |
| PLT-US-028 | Tenant admin | to require MFA for all privileged roles | Must | PLT-UC-009 |
| PLT-US-029 | Employee / worker | a fresh verification before my bank account can be changed | Must | PLT-UC-009 |
| PLT-US-030 | Employee / worker | to set quiet hours and my preferred language | Must | PLT-UC-010 |
| PLT-US-031 | Manager / supervisor | a single daily digest for informational updates while approvals arrive immediately | Should | PLT-UC-010 |
| PLT-US-032 | Compliance owner | a searchable delivery log for every notification | Must | PLT-UC-010 |
| PLT-US-033 | Tenant admin | to add an amount-based director step to the loan chain myself | Must | PLT-UC-011 |
| PLT-US-034 | Tenant admin | to revert to the previous chain version in one action | Must | PLT-UC-011 |
| PLT-US-035 | Implementation consultant | to see an exact diff before promoting a package | Should | PLT-UC-012 |
| PLT-US-036 | Tenant admin | to roll back a promotion to its recorded rollback point | Should | PLT-UC-012 |
| PLT-US-037 | Manager / supervisor | to delegate my approvals to a colleague for my leave dates | Must | PLT-UC-013 |
| PLT-US-038 | Tenant admin | support engineers to act as a user only for a short, approved window | Must | PLT-UC-013 |
| PLT-US-039 | Auditor | to distinguish delegated decisions from direct ones | Should | PLT-UC-013 |
| PLT-US-040 | HR operations | a dry-run report before anything is saved | Must | PLT-UC-014 |
| PLT-US-041 | HR operations | to roll back a whole load batch | Must | PLT-UC-014 |
| PLT-US-042 | Implementation consultant | bulk loads to respect the loader's data scope | Must | PLT-UC-014 |
| PLT-US-043 | Tenant admin | to add a date field for safety induction to the assignment | Should | PLT-UC-015 |
| PLT-US-044 | Payroll manager | a custom allowance field classified as compensation to be hidden from plant users | Should | PLT-UC-015 |
| PLT-US-045 | Payroll manager | a reconciliation of YTD values against the legacy system before go-live | Must | PLT-UC-016 |
| PLT-US-046 | Implementation consultant | loads sequenced automatically by dependency | Must | PLT-UC-016 |
| PLT-US-047 | HR operations | leave balances migrated and reconciled per employee | Must | PLT-UC-016 |
| PLT-US-048 | Employee / worker | to request a copy of my personal data from the self-service app | Must | PLT-UC-017 |
| PLT-US-049 | Compliance owner | erasure to anonymise personal data while retaining statutory payroll records | Must | PLT-UC-017 |
| PLT-US-050 | Compliance owner | every request to carry an SLA clock with escalation | Must | PLT-UC-017 |
| PLT-US-051 | Tenant admin | leavers' directory accounts to be disabled automatically | Must | PLT-UC-018 |
| PLT-US-052 | Employee / worker | my company account to exist on my joining day | Must | PLT-UC-018 |
| PLT-US-053 | HR operations | manager and department changes to flow to the directory | Should | PLT-UC-018 |
| PLT-US-054 | Auditor | to see a record exactly as it was known on a past date | Must | PLT-UC-019 |
| PLT-US-055 | Payroll manager | a closed run's report to open at its snapshot timestamp by default | Must | PLT-UC-019 |
| PLT-US-056 | HR operations | the organisation chart of a site on a past date | Should | PLT-UC-019 |
| PLT-US-057 | Implementation consultant | every draft policy to be regression-tested automatically | Must | PLT-UC-020 |
| PLT-US-058 | Payroll manager | publication blocked while any difference is unexplained | Must | PLT-UC-020 |
| PLT-US-059 | HR operations | affected periods recomputed automatically when a policy goes live | Should | PLT-UC-020 |
| PLT-US-060 | Tenant admin | to see and narrow the scopes an extension requests before installing it | Should | PLT-UC-021 |
| PLT-US-061 | Implementation consultant | automated security review on every package I submit | Should | PLT-UC-021 |
| PLT-US-062 | Auditor | every extension action recorded in the action ledger | Should | PLT-UC-021 |
| PLT-US-063 | Finance | group workforce cost converted at the rate for each line's date | Must | PLT-UC-022 |
| PLT-US-064 | Director / approver | one consolidated cost view for both Vindhya entities | Must | PLT-UC-022 |
| PLT-US-065 | Payroll manager | each entity's payroll to stay in its functional currency | Should | PLT-UC-022 |
| PLT-US-066 | HR operations | extracted document fields presented for my confirmation | Must | PLT-UC-023 |
| PLT-US-067 | Employee / worker | reminders before my licence expires | Must | PLT-UC-023 |
| PLT-US-068 | Auditor | to see who confirmed each value taken from a document | Should | PLT-UC-023 |
| PLT-US-069 | Employee / worker | to pre-register a visitor and be told when they arrive | Should | PLT-UC-024 |
| PLT-US-070 | Plant HR / time office | a live list of every visitor on site | Should | PLT-UC-024 |
| PLT-US-071 | Compliance owner | proof that every visitor acknowledged the site safety induction | Should | PLT-UC-024 |
| PLT-US-072 | Employee / worker | to see my payslip, leave balance and safety notices in Kannada | Must | PLT-UC-025 |
| PLT-US-073 | Tenant admin | to enable a new language only after every string and tenant text has been reviewed | Must | PLT-UC-025 |

## 2. Stories with acceptance criteria

### PLT-US-001 · Provision a new client tenant

As a **Implementation consultant**, I want to provision a client tenant from a single request form with automated seeding and checks, so that configuration work can begin the same day the order is signed.

Priority: **Must** · Use case: PLT-UC-001 · Realises: PLT-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a signed order for Vindhya Precision Industries Pvt Ltd with tenant code vindhya and region set to a cloud region in India | the consultant submits the provisioning request | the tenant reaches status Ready in under 30 minutes and the audit ledger shows the run with its elapsed time |
| 2 | a tenant named vindhya already exists | the consultant submits another request with tenant code vindhya | the request is rejected with the message that the code is in use and no partition is allocated |

### PLT-US-002 · Provision a new client tenant

As a **Tenant admin**, I want to receive an activation link for the first administrator account of my new tenant, so that I can take ownership of users and scope without asking the vendor for access.

Priority: **Must** · Use case: PLT-UC-001 · Realises: PLT-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the tenant vindhya has just reached status Ready | the tenant admin opens the activation link within 72 hours | the account is activated, multi-factor enrolment is required before the first screen loads, and the event platform.principal.created is recorded |
| 2 | the activation link is older than 72 hours | the tenant admin opens it | activation is refused and the consultant can reissue a new link from the provisioning request |

### PLT-US-003 · Provision a new client tenant

As a **Auditor**, I want evidence that a newly provisioned tenant cannot read another tenant's rows, so that tenant isolation is proven at creation rather than assumed.

Priority: **Must** · Use case: PLT-UC-001 · Realises: PLT-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | tenants vindhya and a second demo tenant both hold employee records | the provisioning health check runs its isolation probe as a vindhya principal | zero rows from the second tenant are returned and the probe result is stored with the run |
| 2 | the isolation probe returns any foreign row | the health check completes | the run is marked Failed, the tenant is rolled back and an operations alert is raised |

### PLT-US-004 · Grant identity, role and data scope

As a **Tenant admin**, I want to register an agent principal only together with a named accountable human owner, so that every automated action can be traced to a person who answers for it.

Priority: **Must** · Use case: PLT-UC-002 · Realises: PLT-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the tenant admin is creating a principal of type agent | they save it with owner_principal_id empty | the save fails with the message that an accountable human owner is required and no principal is created |
| 2 | the same agent with owner_principal_id set to HR operations user E1006 | the tenant admin saves it | the principal is created and platform.principal.created is emitted with the owner recorded |

### PLT-US-005 · Grant identity, role and data scope

As a **Tenant admin**, I want to grant a plant HR user location scope for one site with time-edit rights, so that the user can run the site's time office without seeing other sites.

Priority: **Must** · Use case: PLT-UC-002 · Realises: PLT-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a plant HR user with entity grant LE-02 and location grant LOC-CHN with can_edit_time Y | the user opens attendance for LOC-HYD | no LOC-HYD records are returned |
| 2 | the same user | the user opens attendance for LOC-CHN | attendance for every LOC-CHN worker is listed and editable, including head-office-payrolled staff |

### PLT-US-006 · Grant identity, role and data scope

As a **Plant HR / time office**, I want to see attendance but never salary or rate data for head-office-payrolled employees at my site, so that I can run the time office without exposure to compensation outside my payroll group.

Priority: **Must** · Use case: PLT-UC-002 · Realises: PLT-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a plant HR user scoped to LOC-CHN and payroll group PLANT-CHN, and employee E1056 Anand Krishnan at LOC-CHN in payroll group HO | the user opens E1056's record, the salary register, an export and the API | attendance fields are populated and basic, da, hra, daily_rate, gross and ctc are null on all four surfaces |
| 2 | a payroll manager scoped to payroll group HO | they open E1056's salary structure | all compensation fields are shown with their values |

### PLT-US-007 · Grant identity, role and data scope

As a **Auditor**, I want assurance that a failure in scope resolution never widens access, so that a defect cannot silently expose an entire tenant.

Priority: **Must** · Use case: PLT-UC-002 · Realises: PLT-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a principal whose payroll group lookup fails during a request | the request lists employees | an empty list is returned and a scope-resolution failure is logged with the principal ID |
| 2 | a query issued with a defect that omits the tenant filter | it executes | row-level isolation still blocks every row from other tenants |

### PLT-US-008 · Author and effective-date configuration

As a **Implementation consultant**, I want to publish a leave policy change that applies only from a future date, so that current-year balances are untouched while next year's rules are ready in advance.

Priority: **Must** · Use case: PLT-UC-003 · Realises: PLT-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the active casual leave policy grants 6 days a year | the consultant publishes a version granting 8 days effective 2027-01-01 | a request dated 2026-12-15 reads the 6-day version and a request dated 2027-01-10 reads the 8-day version |
| 2 | the 8-day version is published | the version history is opened | the 6-day version is still listed with recorded_to set and no row has been deleted |

### PLT-US-009 · Author and effective-date configuration

As a **Implementation consultant**, I want to simulate a configuration change against real employees before submitting it, so that I catch side effects before they reach payslips or balances.

Priority: **Must** · Use case: PLT-UC-003 · Realises: PLT-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a draft accrual rule and a sample of 70 employees from LE-01 | the consultant runs the simulation | a per-employee before-and-after table is shown with differences highlighted |
| 2 | the simulation shows employee E1028 with a negative balance | the consultant tries to submit | the submit action is disabled until the error is fixed or acknowledged with a reason |

### PLT-US-010 · Author and effective-date configuration

As a **Auditor**, I want to read the configuration that applied on a given date, so that I can verify a past computation against the rules in force at that time.

Priority: **Should** · Use case: PLT-UC-003 · Realises: PLT-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | two versions of a policy effective 2026-04-01 and 2026-10-01 | the auditor requests the policy as at 2026-07-15 | the 2026-04-01 version is returned with its approver and change reason |
| 2 | the same request with recorded_at set to 2026-05-01 | the auditor runs it | only versions recorded on or before 2026-05-01 are considered |

### PLT-US-011 · Define and version an approval workflow

As a **Implementation consultant**, I want to publish a new chain version without disturbing requests already in progress, so that approvers and requesters never see a request change its route midway.

Priority: **Must** · Use case: PLT-UC-004 · Realises: PLT-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a two-step leave chain v1 and a leave request from E1018 pending at step 1 | a three-step v2 is published | E1018's request still shows two steps and completes on v1 |
| 2 | v2 is published | employee E1019 submits a new leave request | the new instance binds to v2 and shows three steps |

### PLT-US-012 · Define and version an approval workflow

As a **Implementation consultant**, I want to simulate which approver each step would resolve to for a sample request, so that I can confirm routing before the chain goes live.

Priority: **Must** · Use case: PLT-UC-004 · Realises: PLT-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a draft chain for leave at LOC-PLA with step 1 resolved by reporting manager | the consultant simulates a request from E1018 | step 1 resolves to E1017 Nikhil Iyer |
| 2 | a draft step resolved by a position with no incumbent at LOC-PUN | validation runs | publication is blocked and LOC-PUN is listed as uncovered |

### PLT-US-013 · Define and version an approval workflow

As a **Tenant admin**, I want every chain version to record who published it, when and why, so that routing changes can be reviewed after a dispute.

Priority: **Should** · Use case: PLT-UC-004 · Realises: PLT-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a chain version published on 2026-11-05 by the implementation consultant | the tenant admin opens the chain history | the version shows publisher, timestamp, effective_from and change reason |
| 2 | the consultant tries to publish without a change reason | they click publish | publication is refused with a message asking for the reason |

### PLT-US-014 · Execute an approval chain

As a **Manager / supervisor**, I want to decide every pending request from one inbox with the rule context shown, so that I do not have to visit each module to clear approvals.

Priority: **Must** · Use case: PLT-UC-005 · Realises: PLT-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | manager E1021 Rekha Deshpande has a leave request from E1022 and an overtime request from E1020 pending | she opens the unified approval inbox | both items are listed with request type, requester, SLA due time and the rule being applied |
| 2 | she chooses Reject on the leave request with the reason field empty | she submits | the decision is refused with a message that a reason is required |

### PLT-US-015 · Execute an approval chain

As a **Employee / worker**, I want to be told the reason when my request is rejected, so that I can correct and resubmit without chasing my manager.

Priority: **Must** · Use case: PLT-UC-005 · Realises: PLT-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1022's leave request is rejected at step 1 with reason 'Line audit on 12 Nov' | the decision is saved | the instance ends and E1022 receives a notification containing the reason text |
| 2 | a request returned for correction | the employee amends and resubmits it | the instance resumes at the same step and the earlier return is visible in its history |

### PLT-US-016 · Execute an approval chain

As a **HR operations**, I want to edit or close a request at any stage with my reason on record, so that operational corrections are possible without losing accountability.

Priority: **Must** · Use case: PLT-UC-005 · Realises: PLT-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | leave request LV-2026-0774 is approved | HR closes it on 14 Sep with reason 'Early return confirmed by supervisor' | the audit entry records HR's identity, timestamp, previous state and reason, and platform.approval.overridden is emitted |
| 2 | HR attempts an override with an empty reason | they submit | the service rejects the override and the request state is unchanged |

### PLT-US-017 · Execute an approval chain

As a **Director / approver**, I want items queued against a departed approver to reach me as the successor, so that no request is stranded when someone leaves.

Priority: **Must** · Use case: PLT-UC-005 · Realises: PLT-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a loan request pending at a step resolved to an approver whose exit was processed on 30 Sep | the exit becomes effective | the step reroutes to the named successor and appears in the successor's inbox |
| 2 | no successor is named | the reroute runs | the step resolves to the current role holder and the reroute is logged |

### PLT-US-018 · Write the audit and action ledger

As a **Auditor**, I want to see agent actions in the same ledger as human actions with the owner named, so that automated changes are reviewed with the same rigour as manual ones.

Priority: **Must** · Use case: PLT-UC-006 · Realises: PLT-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an agent principal owned by E1006 drafts a letter for E1043 | the auditor filters the ledger by object E1043 | the entry shows the agent as actor and E1006 as accountable owner |
| 2 | the auditor filters by actor type agent for October 2026 | the query runs | only agent-originated entries are returned, from the same ledger as human entries |

### PLT-US-019 · Write the audit and action ledger

As a **Compliance owner**, I want every view of an unmasked PAN or bank account to be logged, so that access to sensitive identifiers can be evidenced on request.

Priority: **Must** · Use case: PLT-UC-006 · Realises: PLT-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a payroll manager unmasks E1056's PAN on the employee record | the field is returned | a ledger entry records the reader, field class PAN, object E1056, channel and source IP |
| 2 | the same payroll manager views the masked value only | the record loads | no sensitive-read entry is written for PAN |

### PLT-US-020 · Write the audit and action ledger

As a **Tenant admin**, I want the ledger to be impossible to edit even with my privileges, so that the audit trail is credible to external auditors.

Priority: **Must** · Use case: PLT-UC-006 · Realises: PLT-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the tenant admin calls the delete operation on a ledger entry | the request is processed | it is refused and a new entry records the attempted deletion |
| 2 | the nightly integrity check | all entries are intact | the auditor dashboard shows the check as passed with the entry count verified |

### PLT-US-021 · Publish domain events through the outbox relay

As a **Finance**, I want each approved payroll or approval event to reach the ERP system exactly once, so that journals are never duplicated or missing.

Priority: **Must** · Use case: PLT-UC-007 · Realises: PLT-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an approval instance completes and platform.approval.completed is written to the outbox | the relay publishes it twice after a restart | the consumer processes it once and discards the second delivery by idempotency key |
| 2 | the transport is down for 20 minutes | it recovers | all events committed during the outage are published in commit order with none missing |

### PLT-US-022 · Publish domain events through the outbox relay

As a **Implementation consultant**, I want to change the event transport without touching producing services, so that a client's integration preference does not require code changes in every module.

Priority: **Should** · Use case: PLT-UC-007 · Realises: PLT-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | producers write outbox rows through the shared library | the relay is pointed at a different transport adapter | no producer code or configuration changes and publishing resumes from the oldest unpublished row |
| 2 | a configuration switch completed | the reconciliation report runs | committed and published counts match for the switch window |

### PLT-US-023 · Publish domain events through the outbox relay

As a **Auditor**, I want a write that rolled back to leave no published event, so that downstream systems never act on changes that did not happen.

Priority: **Must** · Use case: PLT-UC-007 · Realises: PLT-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a principal creation that fails validation after the outbox insert | the transaction rolls back | no platform.principal.created event is published |
| 2 | an event that fails 8 publish attempts | the eighth attempt fails | it is in the dead-letter store with its error and an alert is visible to operations |

### PLT-US-024 · Write bi-temporal versions and read as at a point in time

As a **Payroll manager**, I want a rerun of a closed period to read data as known at that run's snapshot, so that later corrections do not silently change a result already paid.

Priority: **Must** · Use case: PLT-UC-008 · Realises: PLT-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September 2026 run used snapshot 2026-09-28T18:00 and E1044's basic was corrected on 2026-10-05 with valid_from 2026-09-01 | the September run is reproduced with the same snapshot | the original basic is used and the result matches the paid run |
| 2 | the recompute service calls the as-at read without a snapshot timestamp | the call executes | it is rejected with an error naming the missing snapshot |

### PLT-US-025 · Write bi-temporal versions and read as at a point in time

As a **HR operations**, I want corrections to be stored as new versions rather than overwrites, so that the earlier value and the reason for the change stay visible.

Priority: **Must** · Use case: PLT-UC-008 · Realises: PLT-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's cost centre CC-2100 is corrected to CC-2200 effective 2026-10-01 with reason 'Moved to Assembly' | the change is saved | a new version exists with valid_from 2026-10-01 and the prior version has recorded_to set |
| 2 | any service issues an in-place update on the assignment table | it executes | the update is rejected and no row changes |

### PLT-US-026 · Write bi-temporal versions and read as at a point in time

As a **Auditor**, I want to query what the system believed about a record on a past date, so that I can verify decisions against the information available at the time.

Priority: **Should** · Use case: PLT-UC-008 · Realises: PLT-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's cost centre corrected on 2026-10-15 back-dated to 2026-10-01 | the auditor reads valid_at 2026-10-05 with recorded_at 2026-10-10 | CC-2100 is returned |
| 2 | the same read with recorded_at 2026-10-20 | it runs | CC-2200 is returned |

### PLT-US-027 · Enforce adaptive MFA and step-up authentication

As a **Payroll manager**, I want to confirm my identity again before approving a payroll, so that an unattended session cannot be used to release salaries.

Priority: **Must** · Use case: PLT-UC-009 · Realises: PLT-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the payroll manager last completed MFA 40 minutes ago and the step-up window is 5 minutes | they click Approve on the October 2026 run for payroll group HO | a step-up challenge is shown and approval proceeds only after it succeeds |
| 2 | the payroll manager completed step-up 2 minutes ago | they approve a second run | no new challenge is shown and the audit entry records the earlier authentication time |

### PLT-US-028 · Enforce adaptive MFA and step-up authentication

As a **Tenant admin**, I want to require MFA for all privileged roles, so that a leaked password alone cannot open payroll or role administration.

Priority: **Must** · Use case: PLT-UC-009 · Realises: PLT-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the payroll manager role is marked privileged and the user has no enrolled factor | the user signs in | payroll screens are blocked and factor enrolment is presented first |
| 2 | a user fails TOTP 5 times | the fifth failure occurs | the factor is locked for 15 minutes and the tenant admin receives an alert |

### PLT-US-029 · Enforce adaptive MFA and step-up authentication

As a **Employee / worker**, I want a fresh verification before my bank account can be changed, so that my salary cannot be redirected by someone using my open session.

Priority: **Must** · Use case: PLT-UC-009 · Realises: PLT-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | employee E1022 is signed in on the mobile app | he submits a new bank account number | a step-up challenge is required before the change is accepted for approval |
| 2 | he cancels the challenge | the screen closes | the bank account is unchanged and no approval request is created |

### PLT-US-030 · Deliver notifications through a channel matrix and preference centre

As a **Employee / worker**, I want to set quiet hours and my preferred language, so that I am not disturbed after my shift and I can read every message.

Priority: **Must** · Use case: PLT-UC-010 · Realises: PLT-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1033 has set quiet hours 21:00–07:00 and language Kannada | a non-mandatory announcement is published at 22:30 | it is held until 07:00 and delivered in Kannada |
| 2 | the same employee | a mandatory shift-change notice is issued at 22:30 | it is delivered immediately despite quiet hours |

### PLT-US-031 · Deliver notifications through a channel matrix and preference centre

As a **Manager / supervisor**, I want a single daily digest for informational updates while approvals arrive immediately, so that urgent items stand out from routine updates.

Priority: **Should** · Use case: PLT-UC-010 · Realises: PLT-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1021 has enabled a 09:00 digest | six team birthday and document-uploaded notices arrive on one day | they appear as one digest at 09:00 the next morning |
| 2 | the same day a leave approval step opens for E1021 | the event is processed | the approval notification is sent immediately on push and in-app |

### PLT-US-032 · Deliver notifications through a channel matrix and preference centre

As a **Compliance owner**, I want a searchable delivery log for every notification, so that I can evidence that a mandatory notice reached each worker.

Priority: **Must** · Use case: PLT-UC-010 · Realises: PLT-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a mandatory policy notice sent to all 71 employees of the tenant | the compliance owner searches the log by that notice | 71 entries are listed with channel, delivery status and timestamp |
| 2 | an SMS failed for E1061 | the log is opened | the failure reason and the fallback channel attempt are shown |

### PLT-US-033 · Design approval processes without code

As a **Tenant admin**, I want to add an amount-based director step to the loan chain myself, so that large loans get director sanction without waiting for a release.

Priority: **Must** · Use case: PLT-UC-011 · Realises: PLT-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the loan chain has HR and Finance steps | the tenant admin adds a director step for amounts above ₹2,00,000 and simulates a ₹3,00,000 request from E1044 | the simulation shows three steps ending with the director |
| 2 | the same chain | a ₹50,000 request is simulated | the director step is skipped and two steps are shown |

### PLT-US-034 · Design approval processes without code

As a **Tenant admin**, I want to revert to the previous chain version in one action, so that a faulty change can be undone quickly.

Priority: **Must** · Use case: PLT-UC-011 · Realises: PLT-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | version 3 of the leave chain went live on 2026-11-01 | the tenant admin reverts to version 2 with reason 'Approver list incomplete' | version 4, identical to version 2, applies to new submissions and versions 2 and 3 remain in history |
| 2 | requests submitted under version 3 | the reversal is published | they continue on version 3 until closed |

### PLT-US-035 · Promote configuration from sandbox to production

As a **Implementation consultant**, I want to see an exact diff before promoting a package, so that only intended changes reach production.

Priority: **Should** · Use case: PLT-UC-012 · Realises: PLT-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a package changing the overtime rule pack and one picklist | the diff is generated against production | exactly two objects are listed with field-level before-and-after values |
| 2 | the package references a new shift-group picklist value that does not exist in production | promotion is requested | it is blocked with the missing dependency named |

### PLT-US-036 · Promote configuration from sandbox to production

As a **Tenant admin**, I want to roll back a promotion to its recorded rollback point, so that a bad configuration can be withdrawn without manual edits.

Priority: **Should** · Use case: PLT-UC-012 · Realises: PLT-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | package promoted on 2026-11-05 at 10:00 | the tenant admin requests rollback with a reason | new versions restore the earlier configuration and the package shows status Rolled back |
| 2 | a post-promotion smoke check fails | the failure is detected | the rollback point is restored automatically and the tenant admin is alerted |

### PLT-US-037 · Delegate approval authority and act as a user

As a **Manager / supervisor**, I want to delegate my approvals to a colleague for my leave dates, so that my team's requests are not delayed while I am away.

Priority: **Must** · Use case: PLT-UC-013 · Realises: PLT-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1021 delegates leave and overtime approvals to E1016 from 2026-11-10 to 2026-11-20 with reason Annual leave | E1022 submits leave on 2026-11-12 | the item appears in E1016's inbox and the decision records E1016 as actor on behalf of E1021 |
| 2 | the delegation ends on 2026-11-20 | the date passes | any open items return to E1021's inbox automatically |

### PLT-US-038 · Delegate approval authority and act as a user

As a **Tenant admin**, I want support engineers to act as a user only for a short, approved window, so that diagnosis is possible without password sharing or unchecked access.

Priority: **Must** · Use case: PLT-UC-013 · Realises: PLT-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a support engineer requests a 30-minute act-as session for E1043 with a support ticket reference | the tenant admin approves it | a banner shows the act-as state and every action records the engineer as real actor |
| 2 | the act-as session is active | the engineer attempts to grant a role | the action is blocked and the attempt is logged |

### PLT-US-039 · Delegate approval authority and act as a user

As a **Auditor**, I want to distinguish delegated decisions from direct ones, so that I can check that delegations were used within their dates and scope.

Priority: **Should** · Use case: PLT-UC-013 · Realises: PLT-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | approvals in November 2026 | the auditor filters by on-behalf-of not empty | only delegated decisions are listed with delegate, delegator and delegation dates |
| 2 | a delegated decision dated outside the delegation window | the query runs | no such decision exists because the platform routes to the delegate only inside the window |

### PLT-US-040 · Load data in bulk with validation and rollback

As a **HR operations**, I want a dry-run report before anything is saved, so that I can fix errors without polluting live records.

Priority: **Must** · Use case: PLT-UC-014 · Realises: PLT-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a file of 500 assignment changes where 3 rows have no effective date | dry-run is executed | 497 rows show Valid and 3 show the error 'Effective date is required', and nothing is saved |
| 2 | a file with a column named DOJ instead of the template's date_of_joining | it is uploaded | the file is rejected with the mismatched column named |

### PLT-US-041 · Load data in bulk with validation and rollback

As a **HR operations**, I want to roll back a whole load batch, so that a wrong file can be undone in one step.

Priority: **Must** · Use case: PLT-UC-014 · Realises: PLT-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | batch B-20261105-01 committed 497 rows | HR operations requests rollback with reason 'Wrong increment file' | all 497 records return to their prior values as new versions and the batch shows Rolled back |
| 2 | the batch has been rolled back | the version history of any affected record is opened | both the loaded and the reversing versions are visible |

### PLT-US-042 · Load data in bulk with validation and rollback

As a **Implementation consultant**, I want bulk loads to respect the loader's data scope, so that bulk import cannot be used to bypass access controls.

Priority: **Must** · Use case: PLT-UC-014 · Realises: PLT-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a loader scoped to LOC-PLA uploads rows for LOC-PLA and LOC-HYD employees | dry-run runs | LOC-HYD rows are rejected with a scope error and LOC-PLA rows validate |
| 2 | partial commit is selected | the load is confirmed | only LOC-PLA rows are committed |

### PLT-US-043 · Add custom fields and custom objects

As a **Tenant admin**, I want to add a date field for safety induction to the assignment, so that plant HR can record induction without a spreadsheet.

Priority: **Should** · Use case: PLT-UC-015 · Realises: PLT-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the tenant admin adds field safety_induction_on of type date, classification general, on the assignment form | it is published | plant HR at LOC-PLA can enter 2026-11-03 for E1032 and the value appears in the attendance-site report |
| 2 | a field named location_id is added | publication is attempted | it is blocked because the name collides with a standard field |

### PLT-US-044 · Add custom fields and custom objects

As a **Payroll manager**, I want a custom allowance field classified as compensation to be hidden from plant users, so that extensions cannot become a leak of salary data.

Priority: **Should** · Use case: PLT-UC-015 · Realises: PLT-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | custom field site_hardship_allowance classified compensation | a plant HR user scoped to payroll group PLANT-CHN reads E1056 in payroll group HO | the field returns null |
| 2 | a payroll manager scoped to HO | they read E1056 | the field value is shown |

### PLT-US-045 · Migrate data from a legacy HRMS and payroll system

As a **Payroll manager**, I want a reconciliation of YTD values against the legacy system before go-live, so that the first live payroll's tax and statutory figures are right.

Priority: **Must** · Use case: PLT-UC-016 · Realises: PLT-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | legacy YTD gross for LE-01 from April to September 2026 is supplied | the reconciliation report runs after migration | per-employee and total YTD gross, PF and TDS show zero variance or list each variance by employee |
| 2 | variances exist for 4 employees | sign-off is attempted | sign-off is blocked until each variance is resolved or accepted with a reason |

### PLT-US-046 · Migrate data from a legacy HRMS and payroll system

As a **Implementation consultant**, I want loads sequenced automatically by dependency, so that I do not have to hand-order dozens of files.

Priority: **Must** · Use case: PLT-UC-016 · Realises: PLT-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | files for persons, positions and assignments are uploaded together | the migration starts | positions load before assignments and persons load before employments |
| 2 | the positions batch fails | the assignments batch is due | it is held with the message that its dependency has not loaded |

### PLT-US-047 · Migrate data from a legacy HRMS and payroll system

As a **HR operations**, I want leave balances migrated and reconciled per employee, so that no one loses earned leave at go-live.

Priority: **Must** · Use case: PLT-UC-016 · Realises: PLT-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | legacy closing EL balance for E1028 is 14.5 days | the balance reconciliation runs | E1028's opening EL in Nucleus is 14.5 days |
| 2 | a balance in the file for an employee not loaded | the balances batch is validated | the row is rejected with 'Employee not found' |

### PLT-US-048 · Handle a data-principal rights request

As a **Employee / worker**, I want to request a copy of my personal data from the self-service app, so that I know what the employer holds about me.

Priority: **Must** · Use case: PLT-UC-017 · Realises: PLT-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1043 submits an access request and passes the step-up challenge | the compliance owner approves fulfilment | E1043 receives a download of her personal data and the request closes with the date recorded |
| 2 | the step-up challenge fails | the request is submitted | it is held as Unverified and no data is compiled |

### PLT-US-049 · Handle a data-principal rights request

As a **Compliance owner**, I want erasure to anonymise personal data while retaining statutory payroll records, so that the request is honoured without breaking tax and audit obligations.

Priority: **Must** · Use case: PLT-UC-017 · Realises: PLT-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a former employee whose exit was in 2025 requests erasure | erasure runs | name, mobile, address and documents are anonymised and payroll register rows remain under a pseudonymous key |
| 2 | erasure completes | the compliance owner opens the erasure report | each retained record class is listed with its retention reason |

### PLT-US-050 · Handle a data-principal rights request

As a **Compliance owner**, I want every request to carry an SLA clock with escalation, so that no request is forgotten.

Priority: **Must** · Use case: PLT-UC-017 · Realises: PLT-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a configured SLA of 15 days for access requests | a request reaches 12 days without closure | it escalates to the compliance owner's manager |
| 2 | the SLA expires | the request is still open | the breach is counted on the compliance dashboard |

### PLT-US-051 · Provision identities to the enterprise directory

As a **Tenant admin**, I want leavers' directory accounts to be disabled automatically, so that no former employee keeps access to company systems.

Priority: **Must** · Use case: PLT-UC-018 · Realises: PLT-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1068's last working day is 2026-09-30 | the exit becomes effective at the end of that day | a SCIM deactivate request is sent and confirmed within 15 minutes and logged |
| 2 | the directory is unreachable for 20 minutes | the deactivation is pending | the item is retried and flagged as an SLA breach on the dashboard |

### PLT-US-052 · Provision identities to the enterprise directory

As a **Employee / worker**, I want my company account to exist on my joining day, so that I can sign in to systems from the first hour.

Priority: **Must** · Use case: PLT-UC-018 · Realises: PLT-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 has a joining date of 2026-09-01 recorded on 2026-08-20 | 2026-09-01 begins | a SCIM create request is sent and the account exists within 15 minutes |
| 2 | the user name is already taken in the directory | the create request returns a conflict | the item is held and the tenant admin is asked to resolve it |

### PLT-US-053 · Provision identities to the enterprise directory

As a **HR operations**, I want manager and department changes to flow to the directory, so that directory groups and approvals elsewhere stay accurate.

Priority: **Should** · Use case: PLT-UC-018 · Realises: PLT-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018 moves from OU-111 to OU-112 effective 2026-10-01 | the assignment change becomes effective | the directory record shows the new department within 15 minutes |
| 2 | the update succeeds | the provisioning dashboard is opened | the item shows Completed with the directory's response timestamp |

### PLT-US-054 · View any record, report or chart as at a past date

As a **Auditor**, I want to see a record exactly as it was known on a past date, so that I can test whether a decision used the information available at the time.

Priority: **Must** · Use case: PLT-UC-019 · Realises: PLT-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1020's shift group was corrected on 2026-09-10 with effect from 2026-09-01 | I view the record recorded-at 2026-09-05, valid-at 2026-09-04 | I see the shift group before the correction and a marker linking to the 2026-09-10 change |
| 2 | I hold read-only auditor scope for LE-01 | I open a time-travel view | no edit or save action is offered |

### PLT-US-055 · View any record, report or chart as at a past date

As a **Payroll manager**, I want a closed run's report to open at its snapshot timestamp by default, so that my figures always match what the run actually used.

Priority: **Must** · Use case: PLT-UC-019 · Realises: PLT-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September 2026 PLANT-BLR run was snapshotted at 2026-09-28 18:00 | I open its headcount report in as-at mode | both dates default to 2026-09-28 18:00 and the count equals the run's population |
| 2 | an assignment for E1022 was back-dated after the snapshot | I compare the snapshot view with today | E1022 is highlighted with the back-dated change named |

### PLT-US-056 · View any record, report or chart as at a past date

As a **HR operations**, I want the organisation chart of a site on a past date, so that I can answer who reported to whom when an incident happened.

Priority: **Should** · Use case: PLT-UC-019 · Realises: PLT-CG-011

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Rekha Deshpande (E1021) became Assembly manager at Peenya Works on 2026-08-01 | I view the Peenya chart valid-at 2026-07-15 | Assembly shows the previous manager and no node for E1021 in that role |
| 2 | my grant covers LE-01 only | I request the Medchal Works chart | the chart is refused and the message names the missing entity grant |

### PLT-US-057 · Publish a policy change through automated regression

As a **Implementation consultant**, I want every draft policy to be regression-tested automatically, so that I see the impact of a change before anyone is paid differently.

Priority: **Must** · Use case: PLT-UC-020 · Realises: PLT-CG-012

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a draft lowering PLANT12 grace from 15 to 10 minutes | I save the draft | the suite runs and lists the 12 golden days whose disposition changes from present to late |
| 2 | all 12 differences are explained | I submit | the draft enters the approval chain with the test run attached |

### PLT-US-058 · Publish a policy change through automated regression

As a **Payroll manager**, I want publication blocked while any difference is unexplained, so that a policy edit cannot quietly change pay.

Priority: **Must** · Use case: PLT-UC-020 · Realises: PLT-CG-012

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a draft with one unexplained change in overtime minutes for E1018 | the consultant tries to submit | submission is refused and E1018's case is shown as unexplained |
| 2 | a published version | I open its history | I see the test run identifier, explained differences and approver |

### PLT-US-059 · Publish a policy change through automated regression

As a **HR operations**, I want affected periods recomputed automatically when a policy goes live, so that attendance already derived reflects the new rule from its effective date.

Priority: **Should** · Use case: PLT-UC-020 · Realises: PLT-CG-012

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a grace change effective 2026-10-01 published on 2026-10-05 | publication completes | attendance days 2026-10-01 to 2026-10-04 for PLANT12 workers are queued for recompute |
| 2 | September 2026 is locked | a consultant chooses effective date 2026-09-15 | publication is refused and the message names the locked period |

### PLT-US-060 · Publish and install a governed extension

As a **Tenant admin**, I want to see and narrow the scopes an extension requests before installing it, so that an extension never gets more access than it needs.

Priority: **Should** · Use case: PLT-UC-021 · Realises: PLT-CG-013

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an extension requesting attendance for all locations | I approve it for LOC-PLA only | its principal can read Peenya Works attendance and nothing at Chakan Works |
| 2 | an extension principal with no named owner | I try to install | installation is blocked with a message citing the owner requirement |

### PLT-US-061 · Publish and install a governed extension

As a **Implementation consultant**, I want automated security review on every package I submit, so that I learn about problems before a client admin sees the package.

Priority: **Should** · Use case: PLT-UC-021 · Realises: PLT-CG-013

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a package making an undeclared outbound call | review runs | the verdict is fail and the call target is listed as a finding |
| 2 | a clean package | review runs | a pass verdict is issued with the requested scopes listed |

### PLT-US-062 · Publish and install a governed extension

As a **Auditor**, I want every extension action recorded in the action ledger, so that I can attribute any data access by an extension.

Priority: **Should** · Use case: PLT-UC-021 · Realises: PLT-CG-013

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the canteen extension read 340 attendance rows on 2026-10-12 | I filter the action ledger by that extension | I see the read with its principal, owner, scope and row count |
| 2 | an extension version is upgraded | I view installation history | both versions, approval dates and approvers are listed |

### PLT-US-063 · Consolidate multi-entity reporting across currencies

As a **Finance**, I want group workforce cost converted at the rate for each line's date, so that consolidated figures are accurate and auditable.

Priority: **Must** · Use case: PLT-UC-022 · Realises: PLT-CG-014

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an overseas service entity paid in another currency with a month-average rate loaded for October 2026 | I run the October group report in INR | each line shows the converted amount, the rate and the rate date |
| 2 | no rate is loaded for 2026-10-31 | I request the period-end rate type | the affected lines are listed as unconverted and the report is marked incomplete |

### PLT-US-064 · Consolidate multi-entity reporting across currencies

As a **Director / approver**, I want one consolidated cost view for both Vindhya entities, so that I can compare entity and site cost without manual spreadsheets.

Priority: **Must** · Use case: PLT-UC-022 · Realises: PLT-CG-014

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | LE-01 and LE-02 with posted September payrolls | I open the consolidated view | I see totals per entity, per site including Oragadam Works and a group total |
| 2 | an inter-entity recharge flagged for elimination | the report is built | the recharge does not inflate the group total |

### PLT-US-065 · Consolidate multi-entity reporting across currencies

As a **Payroll manager**, I want each entity's payroll to stay in its functional currency, so that statutory and payslip amounts are never affected by reporting conversion.

Priority: **Should** · Use case: PLT-UC-022 · Realises: PLT-CG-014

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the consolidated report converts LE-02 figures | I open the LE-02 payroll register | all amounts remain in INR exactly as computed |
| 2 | a rate is corrected after a report was exported | the report is regenerated | a new rate set version is recorded and the earlier export remains reproducible |

### PLT-US-066 · Classify, extract and confirm employee documents

As a **HR operations**, I want extracted document fields presented for my confirmation, so that I avoid retyping while staying in control of the record.

Priority: **Must** · Use case: PLT-UC-023 · Realises: PLT-CG-015

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a PAN card uploaded for E1066 Abhinav Rastogi with the number extracted at 0.97 confidence | I open the verification task | the number is pre-filled, matched against the record and awaits my confirmation |
| 2 | an extracted date of birth with 0.62 confidence | I view the task | the field is flagged low confidence and is not pre-selected for writing |

### PLT-US-067 · Classify, extract and confirm employee documents

As a **Employee / worker**, I want reminders before my licence expires, so that I renew it before it affects my duties.

Priority: **Must** · Use case: PLT-UC-023 · Realises: PLT-CG-015

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a forklift operator licence for E1035 expiring on 2026-12-31 with reminders at 60, 30 and 7 days | the date reaches 2026-11-01 | E1035 and Peenya HR receive the 60-day reminder |
| 2 | a renewed licence is uploaded and confirmed | the record updates | pending reminders for the old licence are cancelled |

### PLT-US-068 · Classify, extract and confirm employee documents

As a **Auditor**, I want to see who confirmed each value taken from a document, so that I can verify that extraction was reviewed by a person.

Priority: **Should** · Use case: PLT-UC-023 · Realises: PLT-CG-015

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a bank account number written from a cancelled cheque | I view the field history | I see the document, extraction confidence, confirmer and confirmation time |
| 2 | an agent extraction | I query the action ledger | the agent's extraction is listed as a proposal with no direct write to the record |

### PLT-US-069 · Register visitors and control gate entry and exit

As a **Employee / worker**, I want to pre-register a visitor and be told when they arrive, so that I can meet them at the gate without delay.

Priority: **Should** · Use case: PLT-UC-024 · Realises: PLT-CG-016

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I pre-registered a visitor for 10:00–13:00 on 2026-11-12 | the visitor's pass is scanned at Gate 1 at 09:52 | I receive an arrival notification naming the gate |
| 2 | the visitor's pass is valid only on 2026-11-12 | it is scanned on 2026-11-13 | entry is refused and the attempt is logged |

### PLT-US-070 · Register visitors and control gate entry and exit

As a **Plant HR / time office**, I want a live list of every visitor on site, so that I can account for everyone during an evacuation drill.

Priority: **Should** · Use case: PLT-UC-024 · Realises: PLT-CG-016

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 7 visitors entered and 2 exited Peenya Works today | I open the on-site register | it lists 5 visitors with host and entry time |
| 2 | a visitor's pass expired at 13:00 without an exit record | the time reaches 13:00 | the host and gate staff receive an overstay alert |

### PLT-US-071 · Register visitors and control gate entry and exit

As a **Compliance owner**, I want proof that every visitor acknowledged the site safety induction, so that a safety audit can be answered from records.

Priority: **Should** · Use case: PLT-UC-024 · Realises: PLT-CG-016

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a visitor who has not acknowledged the induction | gate staff try to record entry | entry cannot be recorded until acknowledgement is captured |
| 2 | a month of visits | I export the visit register | each row shows the acknowledgement time and the host employee |

### PLT-US-072 · Enable an additional Indian language for a tenant

As a **Employee / worker**, I want to see my payslip, leave balance and safety notices in Kannada, so that I understand my pay and entitlements without asking a supervisor to explain them.

Priority: **Must** · Use case: PLT-UC-025 · Realises: PLT-CG-017

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Kannada is enabled for site LOC-PLA and my language preference is Kannada | I open my September 2026 payslip | every label, earning and deduction name is shown in Kannada and amounts use Indian digit grouping |
| 2 | a tenant-specific announcement has no approved Kannada version | it is published | I see the English text with a 'translation pending' marker and the gap is logged for the reviewer |

### PLT-US-073 · Enable an additional Indian language for a tenant

As a **Tenant admin**, I want to enable a new language only after every string and tenant text has been reviewed, so that workers never see half-translated or wrong statutory terms.

Priority: **Must** · Use case: PLT-UC-025 · Realises: PLT-CG-017

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | interface string coverage for Odia is 97% | I try to enable Odia for a site | enablement is blocked and the 3% missing string keys are listed |
| 2 | all strings are covered and the reviewer has approved the tenant texts | the HR administrator approves the enablement | the language becomes selectable for the chosen sites and the audit trail records pack version, reviewer and approver |

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
| Size | 219 | specified items (table rows) | Counted automatically at generation |
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
