# HRMS prototype coverage against V1, V2 and V3

Assessment date: 12 September 2026
Project: NucleusUI / Nucleus HRMS

The prototype has broad product coverage and several useful calculation engines. Its strongest implemented areas are attendance rules, leave calculations and approval transitions, payroll adjacencies, requisition quotas, asset allocation, and MIS CSV exports. Many other features remain sample screens or simulated actions. The operational foundation required for a complete V1 release is still unfinished.

## Method and limits

Compared the three supplied specifications' module inventories and their supporting feature/acceptance sections against the current source, navigation, event handlers, state management, services and API routes. The specification documents were treated as reference requirements. No implementation instructions embedded in them were executed.

This is a source-based assessment with execution of the five existing service test suites. A browser walkthrough, full application build, accessibility audit, mobile testing and deployment/integration testing were not performed. “Working demo” below means implementation evidence exists; only the service assertions listed later were executed during this assessment.

Classification:

- **Partial demo:** a meaningful domain operation, local state change, calculation or actual export exists. Substantial specification requirements remain. This includes service logic connected to a demo screen, even when a full administration flow is absent.
- **UI/sample:** the principal requested capability is represented by sample content or controls whose actions are largely messages, navigation or presentation changes.
- **Missing:** no dedicated implementation of the module's principal workflow was found. A navigation label alone does not earn coverage.
- **Complete:** would require the specified end-to-end flows and shared acceptance controls. No module was verified at this level.

Counts use the **39 module entries** in V1 §1.2, V2 §1.1 and V3 §2. Some subjects recur across versions, such as workforce planning and reporting; these are specification entries, not 39 distinct products. Modules are counted equally regardless of size. The figures measure presence of implementation, not percentage of engineering work finished.

## Coverage totals

| Specification | Module entries | Partial demo | UI/sample | Missing | Entries containing some working demo logic |
| --- | ---: | ---: | ---: | ---: | ---: |
| V1 — operational foundation | 13 | 11 | 2 | 0 | 85% |
| V2 — employee lifecycle | 11 | 8 | 2 | 1 | 73% |
| V3 — intelligence and enterprise | 15 | 7 | 8 | 0 | 47% |
| Total | 39 | 26 | 12 | 1 | 67% |

**38/39 entries (97%) have some relevant representation. 26/39 (67%) contain at least some working demo logic.** Those numbers do not establish feature completion: several “partial” entries contain only a narrow slice of the specified module.

An overall completion percentage would require a more granular, agreed weighting of requirements and end-to-end acceptance tests. No complete module is verified against the supplied definition of done.

## V1 comparison

| Module | Status | Implemented evidence | Main missing functionality |
| --- | --- | --- | --- |
| Dashboard | Partial demo | Ten role-oriented consoles, role switching, navigation, local tasks and approval interactions. [Dashboard shell][shell], [manager][manager], [employee home][employeehome] | Many metrics and cohorts are seeded; consistent drill-through to scoped source records and shared live totals are incomplete. |
| Employee Directory | Partial demo | Employee list; search by name, department and role; reporting-manager reassignment updates local employee state. [People][people], [manager update][managerupdate] | Create/archive lifecycle, required ID/email search, rich filters, sorting, saved views, column selection, permitted bulk actions and real directory export. |
| Employee Profile | UI/sample | Work information in the directory; profile form in Settings; sample document metadata. [People][people], [settings][settings] | “View profile” only shows a toast. No complete employee dossier, section-level save/review, personal-field approval flow, or controlled sensitive-document access. |
| Organization Structure | Partial demo | Seeded departments/positions, static chart, local manager reassignment. [People][people], [manager update][managerupdate] | Entity management, expandable data-driven hierarchy, cycle prevention and effective-dated reporting relationships. The chart is hard-coded and does not derive its hierarchy from manager changes. |
| Attendance | Partial demo | Local punch-in/out history; raw-punch pairing and daily calculation engine; overnight work, breaks, grace, overtime and gate-pass quota logic. [Attendance][attendance], [punch handlers][punch], [engine][timeengine] | The punch buttons do not invoke the daily calculation engine. Correction request/review flows, immutable original-versus-corrected history, durable raw events and authenticated employee scoping are incomplete. |
| Shifts & Work Schedules | Partial demo | Defined shifts, shift inference, thresholds, overnight behavior and worker-category rules. [Shift rules][timeengine], [calendar engine][calendar] | No complete create/edit shift interface, employee/team schedule assignment, effective-date impact preview or historical schedule protection. |
| Leave Management | Partial demo | Request creation, balance mutation, three-tier approval transitions, early-return recredit, comp-off expiry/FIFO and entitlement calculations. [Leave UI][leaveui], [request handling][leaveapply], [leave engine][leaveengine] | Full policy validation, overlap checks, half-day/hour flows, cancellation, configurable reporting-line routing and reliable balance reconciliation. See specific gaps below. |
| Holiday Calendar | Partial demo | Location-specific holiday lists displayed in attendance; holiday/day-type resolution in the attendance service. [Attendance][attendance], [calendar engine][calendar] | Holiday create/edit/archive, recurrence and applicability configuration. Leave calculation uses weekends directly and does not consume the attendance holiday source. |
| Approvals | Partial demo | Local manager inbox with approve/reject/reroute interaction; leave-specific approval history and transitions. [Manager][manager], [leave engine][leaveengine] | One shared inbox across actual records, authenticated approver scope, consistent notifications/audit and synchronization of manager decisions with module records. Manager demo items are separate local data. |
| Notifications | UI/sample | Bell dropdown with two fixed notices; transient toasts; preference toggles. [Notification bell][notifications] | Persistent notification records, unread/read state, event-triggered delivery, contextual deep links and mandatory security notices. |
| Reports | Partial demo | MIS column selection, department/search filtering and a real CSV download. [Analytics][analytics] | Complete V1 operational reports, functioning date filtering, scoped/sensitive exports, export audit and saved reports. XLSX and several other export buttons show messages only. |
| Settings | Partial demo | In-memory preference toggles and editable form controls; separate browser-persisted permission controls. [Settings][settings], [auth state][auth] | Profile/company Save and Reset handlers only show messages. Attendance/leave/holiday/schedule policy editing, effective dates and central configuration persistence are absent. |
| RBAC & Audit | Partial demo | Role/module/console checks and user overrides; local scope settings; a compensation masking helper/demo. [Auth][auth], [permissions][permissions], [payroll helper][payrollengine] | Server-side authorization, tenant and record-scope enforcement, general field privacy, auditable permission changes and a central append-only audit store. People audit rows are seeded. |

### V1 function gaps that affect the demo

1. **Employee creation is still a placeholder.** “New Profile” reports that a wizard was initiated, but no creation wizard opens or employee record is created. The profile-view action likewise reports success without opening a full dossier. [People actions][peopleactions]
2. **Leave validation is incomplete.** Non-comp-off applications deduct the requested amount and clamp the balance to zero; there is no general insufficient-balance rejection or overlap check in the submit handler. Rejection updates the application without restoring its previously deducted balance. [Leave request and approval handlers][leaveapply]
3. **Holiday rules are inconsistent across modules.** Attendance reads location calendars; leave counts Saturday/Sunday directly. A company holiday can therefore be treated differently in the two flows. [Calendar service][calendar], [leave span][leavespan]
4. **Punch capture and attendance computation are separate.** The punch handlers update a local history array. The richer calculation engine is used in the time-office subsystem; the user-facing punch action does not automatically recalculate through that engine. [Punch handlers][punch], [time-office recalculation][recompute]
5. **Identity and records are not consistently joined.** AuthContext holds the logged-in demo identity, while HRMSContext initializes its own employee user and shared sample records. Changing the login role does not create properly isolated per-employee HR data. [Auth][auth], [HR context][hrcontext]
6. **A manager approval can clear a sample inbox without deciding a real leave application.** The manager cockpit uses its own approval array. [Manager cockpit][manager]

These are important because V1's own acceptance criteria require employee CRUD/lifecycle, scoped views, policy validation, correction history, configuration and enforced authorization.

## V2 comparison

| Module | Status | Implemented evidence | Main missing functionality |
| --- | --- | --- | --- |
| Recruitment / ATS | Partial demo | Candidate stage changes; requisition forms with manpower quota/replacement validation; referral creation. [Recruitment][recruitment], [establishment service][establishment] | Job publishing, actual interview scheduling, scorecards, candidate communications, offer generation/sending and accepted-candidate conversion into an employee. |
| Onboarding | Partial demo | Checklist completion, letter-template merging, workflow editing and asset assignment. [Onboarding][onboarding], [establishment service][establishment] | Per-new-hire plans with dependencies/owners, real document collection and signatures, reminders, account provisioning and completion-driven employee activation. |
| Payroll | Partial demo | OT/arrears off-cycle calculations, employee loan validation, F&F calculations and clearance blocking, local runs, downloadable sample bank/XML files. [Payroll][payroll], [payroll service][payrollengine] | Full recurring salary calculation from shared attendance/leave inputs, configurable jurisdiction rules, approved/versioned runs, lock/reopen controls, actual payslip generation and payment integration. Country selection is a UI choice. |
| Expenses & Reimbursements | Missing | Navigation labels and isolated sample travel-approval items exist. The navigation maps Claims back to Payroll. [Navigation mapping][navigation] | Claim entry, line items, receipts, policy validation, manager/finance review, reimbursement batches and payment status. |
| Asset Management | Partial demo | Serial-number register, allocation and return state changes. [Onboarding][onboarding], [asset state][assets] | Full procurement-to-retirement lifecycle, employee handover acknowledgement, repair/loss handling, durable custody history and clearance integration. |
| Performance Management | Partial demo | OKR display and local addition of a predefined goal; sample nine-box and succession views. [Performance][performance], [goal handler][goal] | User-authored goals/progress, cycles, check-ins, self/manager review forms, actual feedback, calibration, acknowledgement and development-plan lifecycle. |
| Learning & Development | UI/sample | Seeded course cards, progress and certification badges. [Learning][learning] | Course player, enrollment, assignments, tracked lesson/assessment completion, certification expiry and administered learning paths. “Continue Learning” only shows a message. |
| HR Service Desk | UI/sample | Sample ticket list, category filters, detail threads and ticket/reply forms. [Helpdesk][helpdesk] | Create/reply buttons only display alerts; no record mutation, assignment/routing, lifecycle, SLA clock, escalations or uploaded attachments. |
| Workforce Planning | Partial demo | Headcount/position quotas, capacity calculations and requisition controls. [Establishment][establishment], [recruitment][recruitment] | Planning cycles, editable budget assumptions, scenarios, manager proposals and approved-versus-actual plan tracking. |
| Advanced Analytics | Partial demo | MIS data preview, presets, selectable columns, actual CSV export and sample-data mapping/ingestion into local MIS state. [Analytics][analytics], [import wizard][importer] | Cross-module source aggregation, reliable KPI drill-down, real external-file ingestion, scheduled reports and governed sharing/export. Predictive claims use sample content. |
| Offboarding | Partial demo | Department no-dues changes, asset-return operation, F&F calculations and clearance-dependent local settlement status. [Payroll][payroll], [settlement handler][settlement] | Separation initiation, notice and approvals, coordinated clearance tasks, account revocation, exit interview, historical archive and actual settlement payment. |

### Cross-module lifecycle status

| Required flow | Assessment |
| --- | --- |
| Hire → employee → onboarding → schedule/leave → payroll | Separate pieces exist; accepted candidates are not automatically converted and connected across these modules. |
| Attendance + approved leave + compensation + expenses → payroll → payslip | Calculation helpers exist; the full shared-input regular payroll pipeline is absent. |
| Employee → goals → review → development → learning | Sample goals and learning screens exist; automated assignments and review lifecycle are absent. |
| Separation → clearance → asset return → access revocation → payroll → archive | F&F and asset operations exist locally; complete lifecycle orchestration is absent. |

## V3 comparison

| Module | Status | Implemented evidence | Main missing functionality |
| --- | --- | --- | --- |
| People Intelligence | UI/sample | Executive charts, risk/attrition/equity examples and evidence-style displays. [Executive console][executive], [analytics][analytics] | Source-derived metrics, population drill-down, real anomaly detection, confidence derived from analysis and analytical lineage. The operational MIS export is credited under Advanced Reporting. |
| Workforce Planning | Partial demo | Reusable quota/capacity calculations and requisition controls. [Establishment][establishment] | Scenarios, planning cycles, financial assumptions, proposal/approval workflow and actual-versus-plan reconciliation. |
| Workflow Automation | Partial demo | Add/edit/delete workflow nodes, status toggle and step simulation. [Workflow builder][workflow] | Real trigger dispatch, condition/branch execution, durable runs, versioned publication, waits, retries, idempotency and permission-aware actions. Simulation iterates through nodes and prints success text. |
| Employee Experience Hub | Partial demo | Role home, shortcuts, local timesheet/task interactions, announcements and social interactions. [Employee home][employeehome], [HR context][hrcontext] | Unified persistent action center and consistent profile/document/learning/approval records across modules. |
| People Help Center | UI/sample | Sample HR requests and scripted policy answers with citation-style text. [Helpdesk][helpdesk] | Managed searchable article content with ownership/reviews/feedback, actual retrieval, functioning request lifecycle and ticket routing. Basic CMS document metadata elsewhere is not a complete knowledge system. |
| Engagement & Pulse | UI/sample | Sample pulse metrics, wellbeing content and social feed. [Analytics][analytics], [experience][experience] | Survey authoring, audience selection, response collection, reminders, anonymity and minimum-group privacy rules. Social kudos do not implement survey workflows. |
| Compensation Planning | UI/sample | Compensation breakdown and adjustment/benefit controls. [Compensation][compensation] | Cycles, eligibility, budget pools, employee recommendations, budget validation, approval chains and immutable finalization. Submit only shows a message. |
| Succession & Talent | UI/sample | Sample nine-box, critical-role candidates and readiness descriptions. [Performance][performance] | Editable talent pools, succession plans, readiness evidence, development actions and governed review. |
| Skills & Workforce Graph | UI/sample | Skill tags and sample capability/gap matrices. [Capability console][capability], [team][team] | Skill taxonomy, employee skill records, evidence, manager validation, role requirements and calculated gap analysis. |
| AI HR Copilot | Partial demo | Text chat reaches a working keyword-based API that returns canned responses and navigation actions. [Agent route][agent], [AI panel][aipanel] | Authorized HR-data retrieval, live factual answers, source attribution, authenticated tools, high-impact action confirmation and conversation audit. No live LLM/RAG implementation is connected to the active route. |
| Integration Hub | Partial demo | Connector screens plus local ERP field-ownership merging, GL validation, export helpers and simulated acknowledgements. [Integrations][integrations], [ERP service][erp], [ERP state][erpstate] | Real connector authentication, SSO/SCIM, network sync, field mapping lifecycle, scheduler, error/retry handling and token revocation. |
| Developer Platform | UI/sample | API-key examples and documentation/create-key buttons. [Integrations][integrations] | Versioned HR resource APIs, OAuth/API-client lifecycle, real keys, signed webhooks, delivery history, replay and deduplication. |
| Enterprise Governance | Partial demo | Editable role/module/user-access controls and local compensation masking logic. [Auth][auth], [access UI][access], [payroll service][payrollengine] | Access reviews, temporary/delegated grants, privileged approval, separation of duties, retention/hold/deletion processes and central durable audit. |
| Multi-entity / Global HR | UI/sample | Location calendars, country/currency selectors and multi-location sample people. [Calendar][calendar], [payroll][payroll], [settings][settings] | Tenant/legal-entity hierarchy, global person with multiple employments, entity isolation, portable policy sets and effective locale/time-zone behavior. |
| Advanced Reporting | Partial demo | MIS presets/columns/search/department filter, real CSV download and sample mapping wizard. [Analytics][analytics], [import wizard][importer] | Dataset/measure/dimension builder, calculated fields, save/share, scheduled delivery, delivery-time permissions and real XLSX generation. Date-range selection changes export naming but is not applied to row filtering. |

## Shared foundations limiting completion

- **Persistence:** HRMSContext holds employees, leave requests, assets, workflows and other domain records in React state initialized from samples. These changes are lost on page reload. Browser storage is used for theme, login identity and permission configuration, not a shared HR database.
- **Backend:** The active application API routes found are demo login and keyword copilot. The Prisma schema defines only a User model. No persistent employee, attendance, leave, payroll or workflow data model/API was found.
- **Authentication:** The login route checks a fixed demo-user list and returns a user object. AuthContext stores that object locally and provides fallback/demo role switching. Real session, password recovery, email verification and invitation workflows are incomplete.
- **Authorization:** UI role checks and masking helpers exist. Required tenant, object and field permission checks on server-side HR operations are not implemented.
- **Audit:** There are seeded audit rows and some local workflow histories. A central append-only event record with actor, before/after, reason and request ID is absent.
- **Automation/integrations:** Workflow runs, ERP receipts, notifications and disbursement success messages often simulate outcomes. The existing local transformations should be retained, but external execution is still missing.
- **Quality acceptance:** Passing service assertions does not verify browser flows, concurrent users, persistence, security controls, accessibility or responsive behavior.

Evidence: [HR context][hrcontext], [auth state][auth], [login route][login], [database schema][schema], [agent route][agent], [workflow simulation][workflow], [ERP state handlers][erpstate].

## Actions that currently overstate completion in the UI

| Action or claim | Actual behavior found |
| --- | --- |
| New employee / view profile | Toast message; no employee wizard or full dossier. |
| People/attendance export | Toast message. MIS CSV export is separately implemented. |
| Excel report export | Toast message; no workbook generated. |
| HR ticket creation / reply | Alert message; ticket data is unchanged. |
| Continue Learning | Toast message; no lesson player or tracked progress. |
| Generate API key / connector sync | Messages in Integration Hub; ERP subsystem separately simulates a merge/acknowledgement locally. |
| F&F “net pay transferred” | Updates local settlement state after clearance validation; no payment request. |
| “Grounded” policy answers / AI balances | Scripted answers and static numbers. |
| Profile/company settings saved | Toast message; edited form values are not committed to a shared record. |
| Workflow “execution completed” | Simulated step log; no HR or external workflow actions executed. |

## Existing test results

All five service suites completed with zero failures:

| Suite | Assertions passed | What it supports |
| --- | ---: | --- |
| Time office | 48 | Punch pairing, overnight work, breaks, category calendars, gate-pass quota, grace and shift inference |
| Leave | 40 | Early return, tier transitions, comp-off expiry/FIFO, weekend handling and entitlement/proration |
| Payroll adjacencies | 54 | Masking helper, loans, off-cycle calculations and clearance-gated settlement |
| Establishment | 42 | Quotas, requisition validation, sample asset/reference data and letter merging |
| ERP/compliance | 11 | Field ownership, ledger balance, format generation and sample statutory forms |
| **Total** | **195** | **Service/demo assertions** |

Some assertions verify seeded data as well as calculations. These tests establish behavior for the covered scenarios; they do not validate complete module delivery or statutory correctness. Source: the five `scratch/test_*.mjs` suites.

## Recommended implementation order

1. **Connect the foundation:** durable HR records, real login/session identity, consistent employee IDs, server-side role/scope/field controls and audit events.
2. **Complete the V1 workflows:** employee create/edit/deactivate/profile, editable org structure, shift assignments, shared holiday policy, attendance corrections and complete leave validation/cancellation.
3. **Join the operating experience:** shared approval inbox, persistent notifications, consistent record drill-down and access-controlled reports.
4. **Complete V2 P0 workflows:** candidate-to-employee conversion, per-person onboarding, regular payroll calculation/approval/lock/payslip and coordinated offboarding. Add Expenses as its own workflow.
5. **Build on verified data for V3:** actual workflow execution, connectors, scheduled reports and permission-aware copilot retrieval; then surveys, compensation cycles, skills, succession and global-entity governance.

The immediate product milestone should be a complete employee → attendance/leave → approval → report loop on persistent, correctly scoped records.

## Specification references

- [V1 — Product Specification, Modules, UX Flows & RBAC](<C:/Users/singh/Desktop/HRMS V1 — Product Specification, Modules, UX Flows 3d9f3f657e9d812ba8e6f740b195e5b5.md>)
- [V2 — Product Specification, Advanced HR Operations & Enterprise Workflows](<C:/Users/singh/Desktop/HRMS V2 — Product Specification, Advanced HR Opera 3d9f3f657e9d8136b155f778a01b5bdd.md>)
- [V3 — Product Specification, Intelligence, Enterprise & Ecosystem](<C:/Users/singh/Desktop/HRMS V3 — Product Specification, Intelligence, Ent 3d9f3f657e9d81e391e7c19eab0022fe.md>)

[shell]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/MainWorkspace.js:66
[manager]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Dashboard/Views/ManagerCockpit.js:12
[employeehome]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Dashboard/Views/EmployeeHome.js:16
[people]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/PeopleCoreView.js:10
[peopleactions]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/PeopleCoreView.js:53
[managerupdate]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:1563
[settings]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/SettingsView.js:13
[attendance]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/AttendanceView.js:11
[punch]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:106
[recompute]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:375
[timeengine]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/services/timeOfficeEngine.js:13
[calendar]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/services/workCalendarService.js:45
[leaveui]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/LeaveView.js:11
[leaveapply]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:514
[leaveengine]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/services/leaveEngine.js:11
[leavespan]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/services/leaveEngine.js:232
[notifications]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/TopNav.js:297
[analytics]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/AnalyticsView.js:30
[auth]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/AuthContext.js:119
[permissions]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/utils/permissions.js:1
[hrcontext]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:42
[recruitment]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/RecruitmentView.js:11
[establishment]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/services/establishmentService.js:34
[onboarding]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/OnboardingView.js:12
[payroll]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/PayrollView.js:12
[payrollengine]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/services/payrollAdjacenciesService.js:61
[navigation]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/app/page.js:157
[assets]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:834
[performance]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/PerformanceView.js:10
[goal]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:1348
[learning]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/LearningView.js:91
[helpdesk]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/HelpdeskView.js:10
[importer]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/DataImportModal.js:29
[settlement]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:1262
[executive]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Dashboard/Views/PeopleCommandCentre.js:13
[workflow]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/WorkflowBuilderModal.js:93
[experience]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/ExperienceView.js:10
[compensation]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/CompensationView.js:11
[capability]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Dashboard/Views/MagnetixCapability.js:160
[team]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/TeamView.js:11
[agent]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/app/api/agent/route.js:3
[aipanel]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/AIPanel.js:43
[integrations]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/IntegrationsView.js:11
[erp]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/services/erpAndComplianceService.js:77
[erpstate]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/context/HRMSContext.js:2118
[access]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/AccessControlView.js
[login]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/app/api/auth/login/route.js:3
[schema]: C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/prisma/schema.prisma:1
