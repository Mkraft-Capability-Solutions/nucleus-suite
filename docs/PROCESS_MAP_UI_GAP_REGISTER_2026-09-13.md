# Nucleus process-map UI gap register

13 September 2026 | Product, design, frontend and backend handoff

## Implementation update

The 49 workbook screens in this register now have a dedicated, navigable operational workspace in the prototype. Each workspace provides a scoped work queue, record-detail surface, state timeline, audit-trail panel, required-field validation and a matching create form. The 15 screens marked **Missing** below are therefore no longer navigation or UI gaps: they are available through the relevant Core HR, Payroll & Finance, Compliance, Platform, or Intelligence sub-module menu.

The shared workspace uses the existing read APIs where a resource endpoint is already available, and retains the complete workflow surface when an endpoint is not available or returns no scoped records. Backend write commands remain the implementation handoff: each screen's form fields, state model and associated endpoint are defined in `src/lib/operational-module-registry.js` so backend teams can replace the local prototype write with its controlled command contract without redesigning the screen.

## Scope and method

This register compares the active NucleusUI application with **Nucleus Process Flows and Process Maps v1.0**. The workbook is treated as a requirements reference. Its operating instructions were not executed. This review inspects active React workspace routes, reusable components, client-side state usage, and the versioned API manifest.

The workbook requires **49 named screens**. The prototype has broad navigation and presentation coverage, but many required screens are represented only by a summary card, a demo component, or a generic workflow dialog. **34 screens have a related partial surface; 15 have no dedicated active surface.** “Partial” does not mean ready for production: it means there is an accessible related page or component from which the required screen can be built.

The largest structural gap is the gap between the API layer and the UI. The repository exposes resource families for people, attendance, payroll, lifecycle, loans, performance, learning, compliance, finance, integrations, privacy, agents and operations, while the active components mostly read `HRMSContext` demo state. The first integration work should create record-list, detail and work-queue pages around those already defined contracts.

## Current application inventory

The active workspace renders ten role consoles (S1–S10) and 19 specialised navigation tabs. Existing UI surfaces cover People Core, recruitment, onboarding, performance, attendance, leave, payroll, analytics, learning, compensation, experience, integrations, compliance, helpdesk, contract workforce, projects, team, settings and access control. The reference navigation catalogue additionally names organisation, engagement, loans and advances, readiness, inbox and assistant routes, but those are not active dedicated workspace pages.

The shared action modal added for the earlier form audit is useful for short request capture. It must not replace record pages, state timelines, approvals, evidence, rule explanations, or secure sensitive-data sections.

## Required screens and page gaps

| Workbook screen | Required page or purpose | Current related surface | Gap status | What must be added |
| --- | --- | --- | --- | --- |
| SCR-005 | Principal, role and scope grant | AccessControlView | Partial | Multi-entity and location grant editor, agent principal owner, revoke history, impersonation-with-audit, effective dates and field-level scope preview. |
| SCR-010 | Employee identity and personal record | PeopleCoreView | Partial | Employee dossier route/drawer with personal, statutory, bank, nominee and document tabs; sensitive-field masking and edit approval. |
| SCR-011 | Assignment and policy attributes | PeopleCoreView | Partial | Effective-dated assignment timeline, position/location/cost-centre lookups, class overrides with mandatory reason, retro-impact warning. |
| SCR-012 | Position register | PeopleCoreView | Partial | Position list with incumbent, vacancy history and actions to freeze, abolish, vacate and reopen. |
| SCR-013 | Sanctioned strength board | None | Missing | HR/Finance headcount board by org unit, designation and location with sanctioned, filled, open and headroom values. |
| SCR-014 | Document vault | PeopleCoreView / CMSModal | Partial | Employee-scoped vault, document verification state, expiry queue, replacement history and secure download audit. |
| SCR-020 | Check in / check out | AttendanceFAB / AttendanceView | Partial | Mobile/kiosk check-in journey with geofence, optional selfie/device status and offline queue/retry state. |
| SCR-021 | My attendance | AttendanceView | Partial | Self-only calendar/history with applied rules, late allowance, OT, gate-pass usage and entry point to regularisation. |
| SCR-022 | Attendance-day detail | None | Missing | Record-detail page with raw punches, segments, breaks, assigned versus applied shift, rule trace, provenance and guarded override/recompute actions. |
| SCR-023 | Gate pass | AttendanceView | Partial | Request/approval record view, ceiling and instance panel, approval history and credit-back result. |
| SCR-024 | Overtime register | PayrollView / AttendanceIntelligence | Missing | Filterable person/date register with eligibility basis, multiplier, approval, run tagging and export. |
| SCR-025 | Attendance exception queue | None | Missing | Queue for missing/unpaired punches, inferred shifts, device errors and agent proposals; bulk accept/amend/reject actions. |
| SCR-026 | Recompute monitor | None | Missing | Admin queue for jobs, deltas, retries, locked-period collision state and trace drill-through. |
| SCR-027 | Team history | ManagerCockpit | Missing | Scoped date-range/team member history that combines attendance, leave, OT, gate pass and late metrics with CSV/PDF export. |
| SCR-030 | Apply for leave | LeaveView | Partial | Complete rule messages, cancellation, live balance projection, half-day controls and approval status timeline. |
| SCR-031 | Leave balance and ledger | LeaveView | Partial | Immutable ledger with transaction source, expiry, projected balance at a selected date and export. |
| SCR-032 | Leave policy configuration | SettingsView | Missing | Versioned leave type, accrual, proration, cap, combination and expiry configuration with simulation. |
| SCR-040 | Unified approval inbox | ManagerCockpit / ApprovalActionModal | Partial | Cross-domain queue, delegation, SLA, rule context, filters and per-item audit timeline. |
| SCR-041 | Assistant and helpdesk | HelpdeskView / AIPanel | Partial | Grounded citations, own-data lookup permissions, action confirmation, ticket record lifecycle and Teams/Slack/WhatsApp channel states. |
| SCR-042 | Employee home | EmployeeHome | Partial | Mobile-first action hub with real statuses for punch, payslip, leave, gate pass, tickets and announcements; offline indicator. |
| SCR-050 | Payroll run cockpit | PayrollView / PayrollControlRoom | Partial | Run list with entity, group, period and run type selector; guarded lifecycle actions from DRAFT to CLOSED. |
| SCR-051 | Pre-payroll audit | PayrollControlRoom | Partial | Severity queue, rule/statistical separation, owner, evidence, resolution, waiver reason and approval gate. |
| SCR-052 | Salary structure simulator | CompensationView | Partial | Wage-base and 50-percent floor simulation, statutory cost/take-home comparison and adopt-with-approval flow. |
| SCR-053 | Payslip | PayrollView | Partial | Payslip by period and run, line-level rule explanation, secure download and mobile offline-last-12-months behaviour. |
| SCR-054 | Tax declaration and projection | None | Missing | Regime selection, declaration entries, proof upload, projected TDS and reviewer workflow. |
| SCR-055 | Disbursement and bank file | None | Missing | File totals, checksum, dual-control verification, release authority, bank response and failure/retry state. |
| SCR-056 | Full and final | PayrollView / OnboardingView | Partial | Settlement working, clearance blockers, recovery lines, approval state and last-working-day settlement. |
| SCR-060 | Joining chain console | OnboardingView | Partial | Per-hire readiness timeline, owner/SLA/blocker view, generated artefacts and chase/reassign actions. |
| SCR-061 | Clearance board | PayrollView / OnboardingView | Partial | Single leaver-centric clearance board with owner queue, blocking flags, waiver reason, recovery and F&F gate. |
| SCR-062 | Policy acknowledgement | CMSModal | Missing | Employee reading view with policy version, audience eligibility, acknowledgement capture, timestamp and acknowledgement history. |
| SCR-063 | My learning | LearningView | Partial | Assigned paths, due date, evidence, certificate, progress and completion workflow. |
| SCR-064 | Asset register | OnboardingView | Partial | Asset inventory, allocation history, condition, return and write-off flow linked to clearance. |
| SCR-065 | Recognition | ExperienceView | Partial | Nomination, approval, award history, citation and payroll-input status. |
| SCR-066 | Announcements | CMSModal | Partial | Audience rule builder, channel selection, draft/edit/publish state and delivery/read metrics. |
| SCR-067 | Letters | OnboardingView / ComplianceView | Partial | Template library, merge preview, approval, issue register, reprint and employee-document linkage. |
| SCR-070 | Rule-pack manager | None | Missing | Jurisdiction/effective-date rule-pack authoring, changelog, test run, reviewer and deployment history. |
| SCR-071 | Golden-case library | None | Missing | Payroll/attendance test case management, source inputs, expected values, comparisons and mismatch review. |
| SCR-072 | Obligation calendar | ComplianceView | Partial | Entity/state owner calendar, due-date evidence, preparation/filing/close states and overdue escalation. |
| SCR-073 | Statutory forms and registers | ComplianceView | Partial | Form library by act/state, generated instance list, filing acknowledgement and register export. |
| SCR-080 | Loans and advances | PayrollView | Partial | Eligibility explanation, application, guarantor acceptance, sanction chain, repayment schedule and foreclosure. |
| SCR-090 | Requisition | RecruitmentView | Partial | Replacement/addition form, live sanctioned-strength context, override reason, approval and position link. |
| SCR-091 | Referrals | RecruitmentView | Partial | Referral form, candidate link, stage timeline, award maturity and payroll handoff. |
| SCR-095 | Contractor engagement and invoice | ContractWorkforceView | Partial | Engagement/worker deployment, attendance variance, invoice reconciliation, hold/release and query log. |
| SCR-100 | Integration configuration | IntegrationsView | Partial | Master-data mode and field-ownership map editor, secret-reference management and connection validation. |
| SCR-101 | Sync monitor | None | Missing | Batch history, applied rows, conflicts, unmatched codes, duplicates, rematch and replay. |
| SCR-102 | GL mapping and journal | None | Missing | Pay-component account mapping, dimension validation, journal preview/post/download and run link. |
| SCR-103 | Reconciliation | None | Missing | Gross/net/statutory/dimension/loan reconciliation with drill-through and export. |
| SCR-110 | Agent console and action ledger | AIPanel / NucleusIntelligence | Partial | Runs, plan/diff, policy caps, approval, outcome verification, reversible-action handle and audit-only view. |
| SCR-111 | Operational reports | AnalyticsView | Partial | Configured operational reports, scope-aware filtering, schedules, exports and report-run history. |

## Missing modules and submodules

These are product modules that need a primary navigation entry and a dedicated list/detail flow. Several already have API routes, but no usable frontend module.

| Priority | Module or submodule | Missing structure |
| --- | --- | --- |
| P0 | Organisation administration | Org-unit editor, reporting-tree view, effective-dated reorganisation, designation and worker-class configuration. |
| P0 | Attendance operations | Exception queue, attendance-day trace, overtime register, recompute monitor and team-history reporting. |
| P0 | Payroll operations | Run lifecycle, pre-audit, input lock/snapshot viewer, anomaly resolution, disbursement control and reconciliation. |
| P0 | Finance operations | GL mapping, salary journal, ERP-sync conflict monitor and reconciliation. |
| P0 | Employee record and document vault | Dossier, protected statutory/bank/nominee sections, document verification and expiry work queue. |
| P0 | Configuration centre | Effective-dated configuration for shifts, holidays, leave rules, worker classes, approval chains, rule packs and field ownership. |
| P1 | Lifecycle administration | Joining chain, policy acknowledgement, clearance board, F&F settlement and alumni/offboarding record. |
| P1 | Loans and advances | Eligibility, guarantors, sanction, repayment, EWA and foreclosure. |
| P1 | Compliance engineering | Rule-pack manager, golden-case library, deployment state and statutory form library. |
| P1 | Platform administration | Tenant provisioning, SSO/SCIM setup, principal/agent ownership, location grants and audit search. |
| P1 | Integration operations | Connector configuration, inbound sync monitor, field conflict resolution, webhooks, delivery replay and secret references. |
| P2 | Intelligence governance | Governed-agent policy editor, action ledger, simulation approval, feedback/evaluations and reversal metrics. |
| P2 | Employee channels | Mobile, kiosk and WhatsApp/Teams/Slack workflow variants with pending-sync and recovery views. |
| P2 | Talent depth | Succession, skills evidence verification, calibration workbench, referral award maturity and structured interview debrief. |
| P3 | Analytics operations | Saved reports, schedule/distribution, metric definitions, snapshot history and scoped drill-through. |

## Required shared UI components

Build these once and configure them per module. They correspond to the workbook’s reuse register and prevent different modules from inventing incompatible approvals, status flows or audit trails.

1. **Server-driven data table**: pagination, saved filters, column selection, scope-aware export, bulk actions, empty/loading/error states and row drill-through.
2. **Record detail shell**: summary header, tabs, activity/audit timeline, linked documents, comments, owner/SLA and action bar.
3. **Effective-dated editor**: current versus future values, effective date, retro warning, mandatory change reason and version history.
4. **Workflow and approval panel**: sequential steps, assignee resolution, delegation, SLA countdown, approve/reject/return, mandatory reason and audit trail.
5. **Rules and calculation trace drawer**: input values, rule-pack version, applied rule IDs, calculated outputs, exceptions and recompute provenance.
6. **Evidence and document component**: drop zone, classification, scan/verification status, expiry date, version/replacement history, secure preview/download and access log.
7. **Scope selector and permission guard**: tenant, entity, location, payroll group and reporting-line context with field masking handled by the API response.
8. **State timeline**: allowed transition only, guard message, actor/timestamp and irreversible-state treatment for payroll, leave, loans, clearance, requisitions and agent actions.
9. **Operational queue**: assigned owner, severity, deadline, quick filters, bulk resolution and escalation state.
10. **Export and report runner**: requested format, scope, queued/running/ready/failed state, download, schedule and audit reference.
11. **Integration monitor**: batch rows, field-level conflict comparison, rematch, retry/replay and idempotency visibility.
12. **Mobile/offline shell**: cached data indicator, queued mutation count, signed timestamp/device evidence, retry and conflict-resolution screen.

## Field gaps in current forms

The recently added action forms capture short requests. They do not yet match the workbook’s field specification. These fields need record-level forms and validation rather than extra free-text fields.

| Form or screen | Missing field groups |
| --- | --- |
| Employee record (SCR-010) | Employee code source, gender, date of birth, joining date with backdate reason, mobile, personal email, address/PIN validation, emergency contact, tokenised Aadhaar/PAN, UAN, ESI IP, tokenised bank account and IFSC lookup. |
| Assignment (SCR-011) | Position vacancy lookup, org unit, designation/band, location, payroll group, reporting-manager cycle check, cost centre, worker class, shift group/default shift, all policy overrides with effective date and mandatory reason. |
| Position and headcount | Position state, sanctioned/filled/open counts, incumbent/vacancy history, budget owner, freeze/abolish/vacate reason and effective date. |
| Document vault | Owner, document type, issue/expiry date, verification state, access classification, replacement reason, scan result and expiry reminders. |
| Attendance day | Source punches, segments, breaks, applied shift, rule IDs, late allowance, status, provenance, override/recompute reason and payroll lock warning. |
| Gate pass | Shift-window validation, personal/official type, remaining minutes/instances, approver, decision reason and credit-back result. |
| Leave application | Half-day start/end, rule messages, balance at leave start, contact, cancellation reason, early-return date and full transaction ledger. |
| Payroll run | Entity, payroll group, period, run type, pay date, input snapshot hash, rule-pack versions, state guard, pre-audit flags and GL mapping status. |
| Tax declaration | Tax regime, declaration items, proof files, deduction caps, projected TDS and reviewer decision. |
| Bank disbursement | Bank file checksum, maker/checker identities, dual-control confirmation, bank response, release reference and retry/error state. |
| Clearance and F&F | Checklist template, owner, blocking flag, clear/waive reason, recovery amount, F&F calculation, settlement approval and payment reference. |
| Loan and advance | Eligibility calculation, purpose, principal, tenure, guarantors, guarantee acceptance, special terms/waiver reason, repayment schedule and foreclosure. |
| Requisition | Replacement/addition type, position link, sanctioned headroom, organisation/designation/location, approval chain and authorised override reason. |
| Integration configuration | Master-data ownership per field, system-of-record, conflict policy, schedule, secret reference, validation result and change history. |
| Agent action | Agent/tool, scope, policy limits, simulation diff, named approver, outcome evidence, reversal handle and reversal reason. |

## Process and flow gaps

The workbook expects the UI to expose control points in these flows. The prototype presents parts of many flows but does not expose the full path or state history.

| Flow | Required UI flow | Main missing controls |
| --- | --- | --- |
| Hire to assignment | Offer accepted → person → assignment → documents → onboarding | Dossier, assignment effective dating, duplicate review, document verification and onboarding readiness. |
| Attendance to payroll | Ingest → derive → exception/regularise → approve OT → tag run | Day trace, exception queue, rule explanation, recompute monitor, OT register and run selector. |
| Leave lifecycle | Accrual → validate → approval → availed/early return → ledger | Policy configuration, rule messages, reusable approval timeline, cancellation and immutable ledger. |
| Payroll lifecycle | Draft → inputs locked → pre-audit → calculated → review → approved → bank file → disbursed → posted → closed | Run state timeline, snapshot evidence, critical-flag gate, dual-control bank release, journal and reconciliation. |
| Joiner to exit | Joining chain → assets/forms/policies → exit clearance → F&F → alumni | Ownership/SLA queue, policy acknowledgement, asset registry, clearance board and blocking settlement gate. |
| Compliance | Rule pack → golden case → deploy → obligation → form/evidence → file | Rule-pack state machine, test library, obligation ownership, form instance and acknowledgement history. |
| ERP/integration | Configure ownership → ingest → validate → conflict → apply → replay | Ownership-map editor, batch monitor, conflict resolution and delivery replay. |
| Governed AI action | Plan → policy gate → simulate → approve → execute → reverse | Diff review, threshold configuration, approver separation, verified outcome and reversal-rate reporting. |

## Delivery order

### Wave 1 — make core operations navigable

1. Add first-class routes for employee dossier, attendance-day detail, exception queue, payroll runs/pre-audit, clearance board and unified inbox.
2. Add the shared data table, detail shell, state timeline, approval panel, audit timeline and evidence component.
3. Replace local `HRMSContext` reads/writes for those routes with the existing `/api/v1` families, retaining an explicit loading/error/offline state.
4. Build sensitive-field masking, entity/location/reporting-line scoping and write idempotency into each interaction before adding bulk actions.

### Wave 2 — complete controlled finance and compliance work

1. Add tax declaration, disbursement/bank control, GL mapping, journal and reconciliation pages.
2. Add rule-pack manager, golden-case library, obligation calendar and statutory form instance register.
3. Build integration configuration, sync monitor and conflict/replay journeys.

### Wave 3 — lifecycle, intelligence and channels

1. Complete joiner readiness, policy acknowledgement, letters, assets, clearance and full-and-final journey.
2. Build loans/advances, governed-agent console, agent policy configuration and report scheduling.
3. Deliver mobile/offline, kiosk and WhatsApp/Teams/Slack variants only after the web record flows use the same APIs and state guards.

## Acceptance criteria for every new page

- A permitted user can reach the page from navigation and direct URL; an unauthorised user receives no sensitive data.
- List, detail, create, edit, approval and state-transition views use the same API contract and reflect a refresh.
- Every write shows validation, pending, success and failure states. A retry cannot create duplicate records.
- Record details show current state, actor, timestamps, rule/configuration version and audit events where the workbook requires them.
- Each page works at narrow mobile width when the workbook marks it mobile, and clearly shows queued/offline status when marked offline-capable.
- Tests cover state guards, scope masking, high-risk calculations, approval reasons and one representative end-to-end flow per process.

## Reference sources

- [Nucleus Process Flows and Process Maps v1.0](C:/Users/singh/Downloads/Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx): `07_Screens`, `08_Form_Fields`, `10_Config_Tables`, `11_State_Machines`, `12_Events`, `13_API_and_Tools`, `16_Reuse_Register` and `18_Build_Backlog`.
- [Active workspace routing](C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/MainWorkspace.js), [sidebar navigation](C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/components/Clerio/SideNav.js) and [API manifest](C:/Users/singh/OneDrive/Documents/GitHub/NucleusUI/src/app/api/v1/route.ts).
