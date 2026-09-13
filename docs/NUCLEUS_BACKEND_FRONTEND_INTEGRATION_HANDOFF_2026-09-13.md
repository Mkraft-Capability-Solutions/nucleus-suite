# Nucleus HRMS Backend and Frontend Integration Handoff

Engineering work allocation and acceptance plan

13 September 2026   |   Version 1   |   Audience Backend Frontend Integration QA and Platform teams

### Current status

Substantial backend code has been added to NucleusUI, but the active frontend still uses demo state. The immediate delivery objective is to establish real sessions and tenant context, reconcile API contracts, and connect the existing screens to persistent domain records.

| Layer | Observed status | Handoff implication |
| --- | --- | --- |
| Frontend | Existing React screens and 10 consoles; HRMSContext and AuthContext still drive demo data. | Preserve the UI, replace data access and complete placeholder flows. |
| Backend | 181 versioned route files, 212 HTTP handlers and 34 server directories are present. | Treat as implementation assets requiring contract and runtime verification. |
| Database | PostgreSQL/Neon and Drizzle code, 16 migration SQL files; canonical manifest declares 304 logical tables. | Verify applied schema and RLS in an isolated environment. Deployed state is unverified. |
| Integration | No /api/v1 calls or client-api/auth-client imports found in active component/context files. | The current UI is not connected to the added versioned backend. |
| Validation | Type checking fails on missing vitest imports and a shiftHours type mismatch. | Resolve baseline failures before claiming an integrated release. |

### How teams should use this handoff

Use workstreams M01 to M20 for feature ownership. Each table maps submodules and components to actual route methods, current frontend behavior and specific work. Backend owns contracts, transactions and authorization; Integration owns API adapters and component binding; QA owns cross-role and cross-tenant acceptance.

This status replaces the completion labels in the older integration documents. It is based on the current filesystem and a type-check run; live database, provider and browser acceptance remain release tasks. The previous 12 September prototype report predates the added backend.

Vision: an employee action is authenticated, persisted once, visible to the correct approver, reflected across dashboards and traceable through an audit record.

# Critical integration blockers

| ID | Finding | Owner and required work | Exit evidence |
| --- | --- | --- | --- |
| B01 P0 | Demo login does not create Better Auth sessions. No Better Auth catch-all handler is present. | BE expose auth handlers and logout; IN replace demo login and bootstrap tenant context. | Real session cookie; protected GET succeeds after login and fails after logout. |
| B02 P0 | All active module views retain local/sample records. | IN create adapters and query/mutation hooks; remove success-only actions per M01 to M20. | Mutation survives reload and appears in another authorized session. |
| B03 P0 | typecheck fails: vitest is missing; vp/service.ts line 96 passes optional shiftHours where required. | BE restore test configuration and fix type contract. Do not change product rules just to suppress errors. | Typecheck passes; intended unit tests execute with a documented runner. |
| B04 P0 | Punch ingestion requires 2 to 32 events; UI captures one click at a time. | BE define append-punch semantics; IN bind check-in/out to confirmed event state. | One check-in is durable before a later checkout. |
| B05 P0 | Frontend display IDs, leave codes, shift codes and salary shapes differ from API payloads. | BE and IN agree mapping/version contracts on the next pages. | Contract tests cover every mapped enum and missing/forbidden field. |
| B06 P0 | Replay outcomes are not short-circuited in selected create routes; version behavior varies. | BE verify transactional idempotency and concurrency across consequential writes. | Same key creates once; different body conflicts; stale version cannot mutate. |
| B07 P1 | Worker helpers exist, but no deployed tick/cron entry point was found; notification coverage is selective. | Platform and BE wire authenticated scheduling, event dispatch, retries and monitoring. | A real outbox event reaches its recipient; restart/retry produces no duplicate. |
| B08 P1 | Legacy docs declare complete integration, mislabel console IDs and reference absent routes. | BE and IN use source inventory and this handoff; update contract documentation. | Every documented method resolves to a handler and tested response. |

Additional foundation issue: schema generation references personal_docs/03-data/diagrams, which is absent in this workspace. Restore its source or select a maintained schema authority before regenerating migrations.

Evidence anchors: AuthContext.js:393; api/auth/login/route.js; lib/auth.ts; server/attendance/service.ts:178; server/vp/service.ts:96; api/v1/people/route.ts; server/jobs/worker.ts; scripts/generate-canonical-schema.ts:9.

# Architecture and ownership

### Active flow

React page and views -> AuthContext and HRMSContext -> browser state. Login calls POST /api/auth/login. AIPanel calls POST /api/agent. Both active routes still provide demo behavior.

### Target flow

React view -> typed domain adapter -> versioned route -> session and active tenant -> domain service -> tenant-scoped transaction -> audit and outbox -> response projection -> component refresh.

| Responsibility | Owner | Required outcome |
| --- | --- | --- |
| Identity and server policy | Backend | Use Better Auth identity, validated tenant membership, domain permissions, scope and field privacy. Never trust browser role or employee identity. |
| Data access and persistence | Backend | Keep one authoritative domain record, transactions, versions, idempotency, migrations and audit. Server owns final business calculations. |
| Component integration | Frontend Integration | Translate API data to UI view models, send commands, preserve server IDs, represent loading/error/conflict and refetch affected projections. |
| Async and external operations | Platform with Backend | Deploy workers and provider adapters; manage secrets, retries, recovery, observability and delivery evidence. |
| Product policy | Product with domain owners | Approve leave/shift/jurisdiction semantics, role scopes, workflow states and mandatory financial approvals. |
| Acceptance | QA with both engineering teams | Run isolated multi-user and multi-tenant flows, verify database effects and audit, exercise failures and release gates. |

### Implementation rules

Keep theme, navigation, drawer state and draft form input client-side. Move employees, balances, approvals, payroll, documents, tasks and permissions to server-backed stores. Use current tenant and membership in query keys; discard prior-tenant responses after switching.

Use Drizzle/Neon and the SQL migration history as the active backend path. prisma/schema.prisma is a legacy SQLite User-only schema; it is not the active HR schema. Several server services use typed columns alongside JSON attributes, so verify each row shape against migrations and service queries.

# API contracts and adapter requirements

| Concern | Current contract evidence | Work required |
| --- | --- | --- |
| Success and list envelopes | Most routes use data, meta.requestId and links.self. Collections use data arrays and meta.nextCursor. | Parse data through typed adapters. getJson returns the entire body as unknown; data.days is not a universal contract. |
| Special envelopes | identity/context returns memberships/context directly; workspace/bootstrap returns nested data; home exposes source availability. | Document each endpoint schema and normalize intentionally; preserve unavailable/error distinctions. |
| Authentication and tenant | Protected services resolve Better Auth session plus mkraft_active_tenant cookie. | Use same-origin session credentials; select tenant through POST identity/context; clear queries and reset all domain state after switch. |
| Writes and retry | Selected routes require Idempotency-Key. Shared helper reports replay/conflict; route behavior requires verification. | Add command helper; reuse a key for retry of the same logical write. Retry only with confirmed idempotent server semantics. |
| Concurrency | requireVersion reads If-Match; some transitions do not invoke it and responses sometimes return version 1. | Check per-route metadata in companion inventory. Standardize before financial or approval UI depends on it. |
| Errors | Most errors are error.code/message/details/retryable/requestId; identity errors may be strings. | Map field errors; show 401/403/409/422/503 distinctly; never silently replace failure with demo success. |
| Money and dates | Server uses UUIDs, integer minor units and decimal-string money views; punches need timestamp offsets. | Keep display code separate from ID; no formatted currency in payloads. Use tenant time zone and explicit units. |
| Read gaps | Several resources have POST only; people/[id] has GET only. | Add list/detail/update/archive methods required by actual screens instead of creating invisible server records. |

Recommended client additions: requestJson command helper; schema-checked response adapters; tenant-scoped query keys; explicit refresh after mutation; request-ID logging; stale-request cancellation. Existing client-api.ts only coalesces in-flight GETs and invalidates request generations; it is not a full data cache.

# First integration slice and payload mapping

Deliver the People directory first after identity. It exercises session, tenant scope, response mapping, create validation, idempotency, sensitive-field projection and a real reload without involving financial settlement.

| Step | Existing backend | Frontend integration and verification |
| --- | --- | --- |
| 1 Authenticate | Better Auth server configuration exists; public handler must be exposed. | LoginView obtains a real session. Bootstrap loads user and permitted memberships. |
| 2 Select tenant | POST /api/v1/identity/context with tenantId UUID. | Use authorized selection, then reload bootstrap. Do not send local SUPER_ADMIN as authority. |
| 3 Read directory | GET /api/v1/people?search=&page=1&pageSize=25 | Map data[].firstName/lastName to display name; designation to role label; department to dept; retain id and employeeCode separately. |
| 4 Create employee | POST /api/v1/people with Idempotency-Key. | Send firstName, lastName and optional employeeCode, workEmail, designation, department, location, joiningDate, basicSalaryMinor. Render server validation errors. |
| 5 Confirm persistence | GET /api/v1/people/[id] and refreshed collection. | Read returned data.id; refetch; reload; verify another authorized session sees the employee and an unauthorized tenant cannot. |
| 6 Extend safely | New PATCH/archive/manager commands are required. | Agree those contracts before replacing manager reassignment or profile Save. |

### Leave and attendance mapping decisions

| Frontend concept | Existing backend contract | Decision or implementation needed |
| --- | --- | --- |
| PRIVILEGE / SICK / CASUAL / COMP_OFF | EL / SL / CL / COFF | Explicit enum mapping. WELLNESS and LOP have no direct equivalent in requestLeaveSchema; do not silently substitute. |
| startDateStr / endDateStr / duration | startsOn / endsOn / days; employeeId UUID | API accepts days; backend must validate authoritative units against policy and calendar rather than trusting the form. |
| Supervisor HOD HR Head picker | decide endpoint accepts approve boolean and optional comment | Server determines actor/tier. UI displays permitted actions and sends the selected record ID. |
| One web punch / SHIFT-* | punches array min 2; shiftCode A/B/C | Add append-event contract and reconcile shift semantics; do not manufacture an OUT event to satisfy validation. |

# Console and shared component map

| ID | Component | Role purpose | Target data |
| --- | --- | --- | --- |
| S1 | PeopleCommandCentre.js | Leadership overview | home; analytics metrics; people/organization |
| S2 | HROpsConsole.js | HR operations | home; leave requests; lifecycle and action inbox |
| S3 | AttendanceIntelligence.js | Attendance and shifts | attendance days/team-summary; regularizations |
| S4 | TalentAcquisition.js | Recruitment overview | requisitions; applications; interview sessions |
| S5 | PayrollControlRoom.js | Payroll control | payroll runs; anomalies; input readiness |
| S6 | PerformanceTalent.js | Performance and talent | review cycles; responses; calibration; succession |
| S7 | ManagerCockpit.js | Team and approvals | scoped home; team summary; unified action projection |
| S8 | EmployeeHome.js | Employee self service | home; own attendance/leave; task and timesheet records |
| S9 | MagnetixCapability.js | Learning and skills | courses; enrollments; employee skills; capability index |
| S10 | NucleusIntelligence.js | AI and governance | AI runs/actions/evals; audit; integrations |

These mappings follow MainWorkspace and TopNav. Older status documents swap several console IDs; retain the mapping above when assigning integration tickets.

| Shared component | Integration work |
| --- | --- |
| HRMSContext and AuthContext | Replace domain arrays and local authority with typed server-backed adapters. Keep transient UI state local. |
| TopNav and navigation components | Use real session, tenant, notification count and authorized record search; maintain server-validated permissions. |
| ApprovalActionModal and domain forms | Supply real resource ID/type/version; map domain commands, pending state, required reason and conflict handling. |
| DataImportModal and CMSModal | Parse actual files; use server preview/upload; show individual failures and persistent results. |
| Toast and NucleusChart | Show success only after confirmation; charts consume server projections with source availability and drill links. |
| AIPanel and ChatPanel | Copilot must authenticate and ground answers. Team chat needs its own backend or chosen provider. |

# M01 Identity access and tenant settings

Priority P0   |   Backend owner BE 01   |   Integration owner IN 01   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M01 F1<br>Session and tenant selection | LoginView, AuthContext, TopNav<br>Demo login returns an object; local role switching remains active. | GET/POST /api/v1/identity/context<br>GET /api/v1/workspace/bootstrap<br>GET /api/v1/identity/memberships | Expose Better Auth handlers and session logout; replace demo identity with bootstrap data and server tenant selection. |
| M01 F2<br>Roles and memberships | AccessControlView, RoleProtected<br>Browser-stored role/module overrides; backend grants exist separately. | POST /api/v1/roles<br>POST /api/v1/roles/[id]/permissions<br>POST /api/v1/memberships/roles | Add read APIs for effective grants where required; replace browser authority with membership permissions and audited server mutations. |
| M01 F3<br>Workspace administration | SettingsView, AccessControlView<br>Settings Save reports success without committing the form. | GET/PATCH /api/v1/tenant/settings<br>POST /api/v1/invitations<br>GET/POST /api/v1/platform/tenants | Wire settings PATCH and invite commands; add real tenant/user administration and preserve permission-denied states. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Sign in, select a permitted tenant, reload and receive the same identity. Role changes are server-authorized, audited and reflected after refresh. An employee cannot self-elevate through local storage.

Source anchors: src/context/AuthContext.js; src/components/Clerio/LoginView.js; src/components/Clerio/AccessControlView.js; src/server/identity/authorization.ts; src/server/identity/provision.ts; src/server/admin/service.ts

Persistence anchors to verify: membership_roles, role_permissions, tenant_settings, tenants, invitations, account. Core audit and identity tables apply across workstreams.

# M02 People profiles and organization

Priority P0   |   Backend owner BE 02   |   Integration owner IN 02   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M02 F1<br>Directory and creation | PeopleCoreView, TeamView<br>Search is local; New Profile and dossier actions show toasts. | GET/POST /api/v1/people<br>GET /api/v1/people/[id] | Build create and profile forms; map employee UUID separately from display code; adapt firstName/lastName, department, designation and salaryMasked. |
| M02 F2<br>Profile lifecycle and reporting lines | PeopleCoreView manager modal<br>Manager changes affect local state; the chart is hard-coded. | GET /api/v1/organization/tree | Add PATCH/archive and manager-assignment commands with cycle prevention, sensitive-field rules and history. Render the chart from relationships. |
| M02 F3<br>Departments positions and import | DataImportModal, PeopleCoreView<br>Preset datasets and local position records. | POST /api/v1/organization/departments<br>POST /api/v1/organization/positions<br>POST /api/v1/people/import-preview<br>POST /api/v1/people/import-apply | Bind preview/apply to parsed user data; add reference selectors and validation summaries. Complete edit/read APIs needed by organization administration. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Create a person, find the UUID after reload, open the profile and see correct scoped fields. A duplicate employee code is rejected. Manager cycles are rejected and import errors identify individual rows.

Source anchors: src/components/Clerio/PeopleCoreView.js; src/components/Clerio/TeamView.js; src/context/HRMSContext.js; src/server/organization/import-apply.ts; src/server/organization/service.ts

Persistence anchors to verify: access_events, business_units, departments, document_versions, documents, grades, job_profiles, legal_entities, positions. Core audit and identity tables apply across workstreams.

# M03 Attendance shifts and holidays

Priority P0   |   Backend owner BE 03   |   Integration owner IN 03   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M03 F1<br>Daily punches and workday | AttendanceView, AttendanceFAB, AttendanceWidget<br>Punches update browser history; rich local calculations are separate. | POST /api/v1/attendance/punches<br>GET /api/v1/attendance/days<br>GET /api/v1/attendance/days/[id]/trace | Resolve single-punch capture first: current ingestion schema requires 2 to 32 punches. Add an append-event contract, then use authoritative day results and server time. |
| M03 F2<br>Corrections gate passes and swaps | AttendanceView and proposed correction drawer<br>Gate-pass demo exists; full correction and swap UI is absent. | POST /api/v1/regularizations<br>POST /api/v1/regularizations/[id]/decide<br>POST /api/v1/gate-passes<br>POST /api/v1/gate-passes/[id]/decide<br>POST /api/v1/shift-swaps | Wire request and decision forms; add read/list contracts for queues. Retain original events, reason, approver and revised computation. |
| M03 F3<br>Team shifts and calendars | AttendanceIntelligence, worker category tab<br>Seeded calendars and shift rules; no complete schedule editor. | GET /api/v1/attendance/team-summary<br>POST /api/v1/attendance/days/[id]/recompute<br>POST /api/v1/attendance/days/[id]/transition | Add effective-dated shift assignment and holiday administration APIs. Reconcile browser SHIFT-* codes with server A/B/C and tenant time zones. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Clock in and out as the authenticated employee; reload and view the same events and computed day. Verify an overnight shift, correction audit, hierarchy scope, and locked-day rejection. Holiday and leave calculations use the same calendar.

Source anchors: src/components/Clerio/AttendanceView.js; src/components/Clerio/AttendanceFAB.js; src/components/Dashboard/AttendanceWidget.js; src/server/attendance/regularizations.ts; src/server/attendance/service.ts; src/server/vp/policy.ts

Persistence anchors to verify: attendance_entries, attendance_policies, attendance_regularizations, gate_pass_policies, gate_passes, leave_requests, shift_swap_requests, shifts, tenants. Core audit and identity tables apply across workstreams.

# M04 Leave requests and approval workflows

Priority P0   |   Backend owner BE 04   |   Integration owner IN 04   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M04 F1<br>Balances and application | LeaveView balance cards and form<br>Local applications and deductions use prototype IDs and leave codes. | GET /api/v1/leave-balances<br>GET/POST /api/v1/leave-requests | Map PRIVILEGE to EL, SICK to SL, CASUAL to CL, COMP_OFF to COFF. WELLNESS and LOP need a policy decision. Calculate units server-side and reconcile balances after writes. |
| M04 F2<br>Approval and early return | LeaveView pipeline, ApprovalActionModal<br>Demo selects an approver role; manager inbox uses different records. | POST /api/v1/leave-requests/[id]/decide<br>POST /api/v1/leave-requests/[id]/early-return | Use authenticated approver identity and actual request IDs. Map decision to approve boolean plus comment; preserve tier/history and refresh all affected lists. |
| M04 F3<br>Comp off policy and cancellation | LeaveView policy and comp off tabs<br>Local expiry/FIFO/credits; configurable policies and cancellation incomplete. | POST /api/v1/coff-grants | Connect grant and ledger records; add policy read/edit, cancellation and reservation-release commands. Verify duplicate, overlapping, insufficient and half-day requests. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Employee submits one request; manager sees that exact request; approved/rejected/returned state survives reload and balance is reconciled. Cancellation and retries do not double debit or credit.

Source anchors: src/components/Clerio/LeaveView.js; src/components/Dashboard/Views/ManagerCockpit.js; src/components/Dashboard/Modals/ApprovalActionModal.js; src/server/leave/service.ts

Persistence anchors to verify: comp_off_grants, leave_ledger_entries, leave_requests, leave_types, transactional_outbox. Core audit and identity tables apply across workstreams.

# M05 Dashboards search notifications and approvals

Priority P0   |   Backend owner BE 05   |   Integration owner IN 05   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M05 F1<br>Role dashboards and drill through | MainWorkspace and S1 to S10 views<br>Most charts and headline numbers are static. | GET /api/v1/home<br>GET /api/v1/workspace/bootstrap<br>GET /api/v1/attendance/team-summary | Map home projections into console view models. Display source availability separately from zero; carry filters and scope into underlying records. |
| M05 F2<br>Notification center and preferences | TopNav bell, SettingsView<br>Two fixed notices plus local toasts and toggles. | GET /api/v1/notifications<br>POST /api/v1/notifications/[id]/read<br>POST /api/v1/notifications/preferences | Replace fixed notices; implement unread/read, deep links and preference writes; verify delivery worker and mandatory events. |
| M05 F3<br>Search and unified action inbox | TopNav, CatalogGridView, ManagerCockpit<br>Search currently finds feature catalog entries; approvals are local arrays. | GET /api/v1/search<br>GET/POST /api/v1/leave-requests | Wire authorized record search. Add a normalized approval projection for leave, corrections, payroll and lifecycle; route decisions to their domain commands. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

A real event updates the relevant count and opens its source record. Mark-read survives reload. Search never exposes another tenant. An unavailable source is explicitly shown as unavailable.

Source anchors: src/components/Clerio/MainWorkspace.js; src/components/Clerio/TopNav.js; src/components/Dashboard/Views/ManagerCockpit.js; src/server/notifications/service.ts; src/server/organization/import-apply.ts; src/server/organization/service.ts

Persistence anchors to verify: membership_roles, notification_preferences, notification_templates, notifications, role_permissions, access_events, business_units, departments, document_versions. Core audit and identity tables apply across workstreams.

# M06 Documents onboarding and asset handover

Priority P1   |   Backend owner BE 06   |   Integration owner IN 06   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M06 F1<br>Documents and letter generation | PeopleCoreView vault, CMSModal, letter preview<br>Document metadata and letter merge demos; upload/download mostly messages. | POST /api/v1/documents<br>POST /api/v1/documents/[id]/scan<br>GET /api/v1/documents/[id]/download | Add actual file read/base64 upload and download bytes. Add metadata listing and template rendering. Verify storage protection and use a trusted scan producer. |
| M06 F2<br>Onboarding templates and tasks | OnboardingView milestones and studio<br>Shared sample tasks with local completion. | GET/POST /api/v1/onboarding/templates<br>PATCH /api/v1/onboarding/templates/[id]<br>GET/POST /api/v1/onboarding/instances<br>POST /api/v1/onboarding/tasks/[id]/complete | Use per-employee instance and task IDs; expose owners, dependencies, due dates and progress. Bind templates and readiness projection. |
| M06 F3<br>Assets and handover | OnboardingView asset register and allocation modal<br>Local serial tracking, allocation and returns; no dedicated asset API. | GET /api/v1/onboarding/instances/[id]/readiness | Create asset/inventory/assignment/return contracts and immutable handover history. Link physical returns to clearance. Readiness route only reports lifecycle readiness. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

New hire has an independent task plan; completing a task changes only that instance. Pending-scan files cannot download. Asset assignment and return persist and update the linked clearance.

Source anchors: src/components/Clerio/OnboardingView.js; src/components/Clerio/CMSModal.js; src/components/Clerio/PeopleCoreView.js; src/server/organization/import-apply.ts; src/server/organization/service.ts; src/server/lifecycle/service.ts

Persistence anchors to verify: access_events, business_units, departments, document_versions, documents, grades, job_profiles, legal_entities, positions. Core audit and identity tables apply across workstreams.

# M07 Offboarding and final settlement

Priority P1   |   Backend owner BE 07   |   Integration owner IN 07   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M07 F1<br>Separation initiation and clearance | Proposed separation form, PayrollView no dues<br>Local final-settlement samples; no complete separation initiation screen. | POST /api/v1/offboarding/cases<br>POST /api/v1/offboarding/items/[id]/clear | Build case form, list/detail and departmental task views. Agree notice, reasons, retained history and required clearances. |
| M07 F2<br>Settlement and account closure | PayrollView final settlement tab<br>Local calculation gates status; success message claims payment. | POST /api/v1/offboarding/cases/[id]/settle | Map server settlement components and blockers. Add authorized access-revocation handoff and actual payment/reconciliation lifecycle. Keep settlement calculation distinct from bank confirmation. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

An uncleared case cannot settle. Settled amounts and clearance actors are auditable. Revoked login retains employment history. Payment completion is shown only after a provider-confirmed result.

Source anchors: src/components/Clerio/PayrollView.js; src/components/Clerio/OnboardingView.js; src/server/lifecycle/service.ts; src/server/lifecycle/templates.ts; src/server/payroll/service.ts

Persistence anchors to verify: clearance_items, employee_loans, employments, full_final_settlements, legal_entities, lifecycle_events, offboarding_cases, onboarding_instances, onboarding_tasks. Core audit and identity tables apply across workstreams.

# M08 Payroll loans and salary advances

Priority P1   |   Backend owner BE 08   |   Integration owner IN 08   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M08 F1<br>Payroll input calculation and approval | PayrollView, PayrollControlRoom<br>Demo runs, off-cycle calculations and country selector. | GET/POST /api/v1/payroll-runs<br>GET/POST /api/v1/payroll-inputs<br>POST /api/v1/payroll-runs/[id]/calculate<br>POST /api/v1/payroll-runs/[id]/approve | Bind run creation/input/calculation; source attendance, leave and rates from persisted data. Verify rule-pack jurisdiction and period locks. |
| M08 F2<br>Finalize corrections payslips and journal | PayrollView run and journal screens<br>Sample XML/NEFT files and simulated disbursement. | POST /api/v1/payroll-runs/[id]/finalize<br>POST /api/v1/payroll-runs/[id]/correct<br>GET /api/v1/payslips/[id]<br>GET /api/v1/payroll-runs/[id]/journal | Implement versioned transition UX, anomaly blockers and real artifact rendering. Verify payslip response format before treating it as PDF. Add payment adapter/reconciliation. |
| M08 F3<br>Loans and wage access | PayrollView loan form and EWA<br>Local guarantors, repayment and request state. | GET/POST /api/v1/loans<br>POST /api/v1/loans/[id]/approve<br>POST /api/v1/loans/[id]/disburse<br>POST /api/v1/loans/[id]/repay<br>GET/POST /api/v1/salary-advances | Map UUIDs and integer minor units; connect consent, approval, disbursement and deduction records. Complete schedule/detail reads and prevent duplicate financial writes. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

A payroll run uses approved inputs, blocks unresolved anomalies, finalizes once and preserves previous versions after correction. Guarantor and advance changes survive reload. Self users can access only permitted payslips.

Source anchors: src/components/Clerio/PayrollView.js; src/components/Dashboard/Views/PayrollControlRoom.js; src/services/payrollAdjacenciesService.js; src/server/payroll/service.ts; src/server/loans/service.ts; src/server/advances/service.ts

Persistence anchors to verify: countries, document_types, documents, employee_loans, employee_salary_assignments, jurisdictions, legal_entities, loan_transactions, pay_components. Core audit and identity tables apply across workstreams.

# M09 Recruitment and hiring

Priority P1   |   Backend owner BE 09   |   Integration owner IN 09   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M09 F1<br>Requisitions and postings | RecruitmentView establishment and requisition modal<br>Local quota checks and open positions. | POST /api/v1/requisitions<br>POST /api/v1/requisitions/[id]/approve<br>GET/POST /api/v1/job-postings<br>POST /api/v1/job-descriptions | Connect reference IDs, positions, approval and posting forms. Preserve approved hiring capacity; add missing edit/detail workflows and posting adapters. |
| M09 F2<br>Candidate pipeline and resume evidence | RecruitmentView pipeline and candidate cards<br>Local stage changes and seeded scores. | POST /api/v1/candidates<br>POST /api/v1/candidates/[id]/resume<br>GET/POST /api/v1/applications<br>POST /api/v1/applications/[id]/advance<br>POST /api/v1/applications/[id]/score | Separate candidate from application IDs; add candidate dossier, real resume upload, permitted transitions and evidence-led score review. |
| M09 F3<br>Interviews offers referrals and hiring | RecruitmentView interviews and referrals<br>Read-only interview examples; referral form changes local state. | POST /api/v1/interview-sessions<br>POST /api/v1/interview-scores<br>POST /api/v1/offers<br>POST /api/v1/offers/[id]/transition<br>POST /api/v1/referrals | Build schedules, scorecards and offer flow; connect calendar/email providers. Verify accepted offer links the employee and starts onboarding without duplication. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

One requisition can receive multiple applications without mixing stages. Interviewers see only authorized candidates. Accepting an offer creates or links one employee and produces auditable lifecycle results.

Source anchors: src/components/Clerio/RecruitmentView.js; src/components/Dashboard/Views/TalentAcquisition.js; src/server/talent/service.ts; src/server/interviews/service.ts; src/server/engagement/service.ts

Persistence anchors to verify: application_stage_history, applications, business_units, candidate_documents, candidate_employee_links, candidate_match_dispositions, candidate_match_results, candidate_match_rubric_versions, candidate_match_runs. Core audit and identity tables apply across workstreams.

# M10 Performance reviews and succession

Priority P2   |   Backend owner BE 10   |   Integration owner IN 10   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M10 F1<br>Goals and check ins | PerformanceView OKR section<br>Add Goal inserts a predefined local goal. | POST /api/v1/objectives<br>POST /api/v1/key-results<br>POST /api/v1/checkins | Build goal creation/edit/progress forms using persisted objective and KR IDs. Add read/update endpoints needed for the full cycle. |
| M10 F2<br>Reviews feedback and calibration | PerformanceView, PerformanceTalent<br>Static nine-box data and feedback success messages. | POST /api/v1/review-cycles<br>POST /api/v1/review-participants<br>GET/POST /api/v1/review-responses<br>GET/POST /api/v1/feedback<br>POST /api/v1/feedback/entries<br>POST /api/v1/calibration-sessions | Create self/manager review screens and feedback inbox; connect versioned responses, calibration and restricted ratings. |
| M10 F3<br>Succession and talent pools | PerformanceView succession section<br>Fixed critical role and successor candidates. | POST /api/v1/succession-plans | Bind plan creation, position/candidate IDs and readiness evidence; complete plan reads/updates, talent-pool management and human review. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

A participant submits one version of a review and a permitted reviewer sees it after reload. Calibration history is retained. Succession proposals remain attributable to human actors.

Source anchors: src/components/Clerio/PerformanceView.js; src/components/Dashboard/Views/PerformanceTalent.js; src/server/performance/service.ts; src/server/performance/reviews.ts

Persistence anchors to verify: calibration_sessions, checkins, feedback_entries, feedback_requests, goal_cycles, key_results, objectives, positions, review_cycles. Core audit and identity tables apply across workstreams.

# M11 Learning skills and capability

Priority P2   |   Backend owner BE 11   |   Integration owner IN 11   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M11 F1<br>Catalog enrollment and completion | LearningView course cards<br>Seeded progress; Continue Learning only shows a message. | GET/POST /api/v1/courses<br>POST /api/v1/learning-paths<br>GET/POST /api/v1/enrollments<br>POST /api/v1/enrollments/[id]/complete | Build enrollment/task state and course detail/player integration. Completion must come from actual assessment/content evidence. |
| M11 F2<br>Skills evidence and verification | TeamView skill chips, capability matrix<br>Sample tags and capability scores. | GET /api/v1/employee-skills<br>POST /api/v1/skill-evidence<br>POST /api/v1/skill-evidence/[id]/verify | Create taxonomy/role-requirement selectors and skill evidence forms; connect manager validation and certification expiry. |
| M11 F3<br>Capability measurement | MagnetixCapability charts<br>Fixed gaps, forecast and impact values. | POST /api/v1/analytics/capability-index<br>GET /api/v1/analytics/capability-index/[id] | Map actual model inputs and sources; separate missing data from computed scores and verify access to evidence. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Enrollment progress and skill evidence belong to the correct employee. Verification is permission-checked and auditable. Capability charts explain their source/version instead of showing fixed percentages.

Source anchors: src/components/Clerio/LearningView.js; src/components/Dashboard/Views/MagnetixCapability.js; src/components/Clerio/TeamView.js; src/server/learning/service.ts; src/server/skills/service.ts; src/server/analytics/service.ts

Persistence anchors to verify: courses, enrollments, learning_completions, learning_paths, employee_skills, skill_evidence, skills, capability_index_runs, capability_index_versions. Core audit and identity tables apply across workstreams.

# M12 Compensation planning and benefits

Priority P2   |   Backend owner BE 12   |   Integration owner IN 12   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M12 F1<br>Bands budgets and review cycles | CompensationView<br>Sample compensation and adjustment controls. | POST /api/v1/compensation/bands<br>POST /api/v1/compensation/cycles<br>POST /api/v1/compensation/budgets | Add configuration forms, list/detail queries, eligibility and currency mapping. Remove uncommitted Save messages. |
| M12 F2<br>Recommendations and approval | CompensationView adjustment action<br>Submit reports success without storing proposals. | GET/POST /api/v1/compensation/proposals<br>POST /api/v1/compensation/proposals/[id]/approve | Connect per-employee proposals with budget validation, approval separation, effective date and audit history. |
| M12 F3<br>Benefit enrollment and claims | CompensationView benefit controls<br>Local/static selections; no real enrollment lifecycle. | POST /api/v1/benefits/plans<br>POST /api/v1/benefits/options<br>GET/POST /api/v1/benefits/enrollments<br>POST /api/v1/benefits/claims | Build employee eligibility, plan selection and claim lifecycle. Treat benefit claims separately from business expense reimbursement. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Recommendations consume the correct budget and cannot silently exceed it. Final approval produces an attributable salary change. Employees can view and change only eligible enrollments.

Source anchors: src/components/Clerio/CompensationView.js; src/components/Clerio/PayrollView.js; src/server/compensation/service.ts; src/server/benefits/service.ts; src/server/fx/service.ts

Persistence anchors to verify: compensation_bands, compensation_budgets, compensation_cycles, compensation_proposals, employee_salary_assignments, grades, legal_entities, benefit_claims, benefit_enrollments. Core audit and identity tables apply across workstreams.

# M13 Employee experience and engagement

Priority P2   |   Backend owner BE 13   |   Integration owner IN 13   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M13 F1<br>Announcements recognition and referrals | CMSModal, ExperienceView social feed<br>Local announcements, kudos and award records. | GET/POST /api/v1/announcements<br>POST /api/v1/recognition-events<br>POST /api/v1/referrals<br>POST /api/v1/referrals/[id]/award | Replace context arrays with scoped feed records; add required edit/archive/acknowledge/like contracts and persistent outcomes. |
| M13 F2<br>Surveys and pulse | ExperienceView and AnalyticsView pulse tab<br>Sample sentiment metrics; no survey authoring/responding screen. | POST /api/v1/surveys<br>POST /api/v1/survey-runs<br>POST /api/v1/survey-responses<br>GET /api/v1/survey-runs/[id]/results | Build authoring, audience, response and results views; enforce anonymous-group thresholds and deduplicate responses. |
| M13 F3<br>Universal employee action center | EmployeeHome<br>Local tasks and separate module shortcuts. | GET /api/v1/home<br>GET /api/v1/notifications | Aggregate actual assigned tasks and approvals with deep links. Add policy acknowledgements, signature and learning-due projections. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Audience restrictions survive direct API access. Survey results suppress small groups. A completed employee action disappears only when its source record confirms completion.

Source anchors: src/components/Clerio/ExperienceView.js; src/components/Clerio/CMSModal.js; src/components/Dashboard/Views/EmployeeHome.js; src/server/engagement/service.ts; src/server/notifications/service.ts

Persistence anchors to verify: feed_posts, recognition_events, recognition_programs, referral_awards, referrals, survey_responses, survey_runs, surveys, membership_roles. Core audit and identity tables apply across workstreams.

# M14 HR service desk and knowledge center

Priority P2   |   Backend owner BE 14   |   Integration owner IN 14   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M14 F1<br>Request intake and ticket lifecycle | HelpdeskView ticket list and raise modal<br>Ticket creation and replies display alerts; samples are constant. | Gap<br>No dedicated route found | Create dedicated ticket/category/assignee/reply/attachment APIs and schema ownership. Build create, assign, waiting, resolve and reopen workflows. |
| M14 F2<br>SLA routing and internal notes | HelpdeskView detail drawer<br>Fixed SLA text; no real routing or timeline updates. | Gap<br>No dedicated route found | Implement SLA schedules, escalation jobs, internal-versus-public visibility and reply audit. Operations audit APIs are not a ticket backend. |
| M14 F3<br>Policies articles and search | HelpdeskView policy assistant<br>Scripted answers with fixed citation text. | GET/POST /api/v1/ai/knowledge | Use managed knowledge records with owner/review/version metadata; connect retrieval and source links. Add article feedback and lifecycle APIs. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Submitting a request creates a persistent ticket visible to its requester and assigned queue. Internal notes are excluded from employee responses. SLA timing and article citations derive from real records.

Source anchors: src/components/Clerio/HelpdeskView.js; src/components/Clerio/CMSModal.js; src/server/ai/evals.ts; src/server/ai/service.ts

Persistence anchors to verify: agent_action_outcomes, agent_action_reversals, agent_action_simulations, agent_actions, agent_principals, agent_tools, ai_artifacts, ai_feedback, ai_run_steps. Core audit and identity tables apply across workstreams.

# M15 Analytics reporting and workforce planning

Priority P2   |   Backend owner BE 15   |   Integration owner IN 15   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M15 F1<br>Metrics trends and drill through | AnalyticsView, PeopleCommandCentre<br>Seeded predictions and charts; MIS works locally. | GET/POST /api/v1/analytics/metrics<br>POST /api/v1/analytics/metric-snapshots<br>GET /api/v1/reports/team-history | Define source datasets and compute/populate metrics; align filters and date ranges with actual rows. Add scoped population drill-through. |
| M15 F2<br>Report builder exports and imports | AnalyticsView MIS, DataImportModal<br>CSV downloads local rows; XLSX is a toast; imports use presets. | GET/POST /api/v1/exports<br>GET /api/v1/exports/[id]<br>POST /api/v1/exports/[id]/build<br>POST /api/v1/people/import-preview | Wire durable export jobs and server filters. Fix truncated-content handling for jobs over 100 rows; add real full-file download and XLSX if required. |
| M15 F3<br>Headcount plans and scenarios | PeopleCoreView positions, RecruitmentView establishment<br>Local quotas and capacity calculations. | POST /api/v1/organization/positions<br>POST /api/v1/requisitions | Create planning-cycle, budget, scenario and plan-versus-actual APIs; position CRUD alone does not deliver scenario planning. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

The chart total reconciles with exported scoped records for the same filter. A large export remains downloadable. A proposed hiring position updates its plan variance after approval and actual hire.

Source anchors: src/components/Clerio/AnalyticsView.js; src/components/Clerio/DataImportModal.js; src/components/Dashboard/Views/PeopleCommandCentre.js; src/server/analytics/service.ts; src/server/exports/service.ts; src/server/organization/import-apply.ts

Persistence anchors to verify: capability_index_runs, capability_index_versions, metric_definitions, metric_snapshots, export_jobs, leave_requests, payroll_lines, payroll_run_employees, payroll_runs. Core audit and identity tables apply across workstreams.

# M16 External integrations and developer platform

Priority P2   |   Backend owner BE 16   |   Integration owner IN 16   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M16 F1<br>Catalog connections and secrets | IntegrationsView connector cards<br>Sync/config/key actions are messages; local ERP merge demo. | GET /api/v1/integrations/catalog<br>GET/POST /api/v1/integrations/connections<br>POST /api/v1/webhooks/secrets | Build real connection forms, secret references, status/errors and revocation. Verify a round trip server-side; a submitted boolean is insufficient evidence of Live. |
| M16 F2<br>Inbound and outbound webhooks | IntegrationsView proposed delivery detail<br>Server signature/intake and delivery records exist; no UI binding. | POST /api/v1/webhooks/inbound/[connectionId]<br>POST /api/v1/webhooks/endpoints<br>POST /api/v1/webhooks/subscriptions<br>GET /api/v1/webhooks/deliveries<br>POST /api/v1/webhooks/deliveries/[id]/replay | Connect delivery history and replay; wire actual worker transport, validate signatures/deduplication and safe outbound destinations. |
| M16 F3<br>Identity calendar email and ERP adapters | IntegrationsView partner/API tabs<br>Connector labels and format helpers; provider operation unverified. | GET/POST /api/v1/integrations/connections | Build provider-specific OAuth/SSO/SCIM, calendar, email and finance adapters; define mapping/conflict ownership. Add API client scopes, rotation and usage routes. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

A sandbox event creates the expected local record once and yields provider-confirmed delivery status. Secrets never return to the browser. Failed requests can be retried with traceable attempts.

Source anchors: src/components/Clerio/IntegrationsView.js; src/services/erpAndComplianceService.js; src/server/integrations/service.ts; src/server/integrations/inbound.ts; src/server/jobs/handlers.ts

Persistence anchors to verify: inbound_events, integration_catalog, integration_connections, integration_secrets, transactional_outbox, webhook_deliveries, webhook_endpoints, webhook_subscriptions, comp_off_grants. Core audit and identity tables apply across workstreams.

# M17 AI copilot and workflow automation

Priority P2   |   Backend owner BE 17   |   Integration owner IN 17   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M17 F1<br>Conversational copilot and retrieval | AIPanel, HelpdeskView<br>Active /api/agent is keyword/canned navigation; policy graph exists separately. | GET/POST /api/v1/ai/knowledge<br>POST /api/v1/ai/runs<br>GET /api/v1/ai/runs/[id]<br>POST /api/v1/ai/feedback | Create an authenticated conversation adapter or replace the demo route. ai/runs accepts workflow input and is not a drop-in chat endpoint. Ground answers in authorized data. |
| M17 F2<br>Action approval evaluation and audit | NucleusIntelligence and proposed review drawer<br>Sample execution ledger; backend action/run/review services exist. | POST /api/v1/ai/actions<br>POST /api/v1/ai/actions/[id]/approve<br>POST /api/v1/ai/actions/[id]/execute<br>POST /api/v1/ai/reviews<br>POST /api/v1/ai/evals | Build proposal, evidence, human confirmation and result views. Reuse domain authorization and preserve model/source version and outcome. |
| M17 F3<br>Visual workflows and durable jobs | WorkflowBuilderModal, OnboardingView studio<br>Node editing plus timer-driven success simulation. | GET/POST /api/v1/ops/scheduled-tasks<br>GET /api/v1/ops/outbox | Add generic workflow definitions/version/run APIs, real branches/waits and dispatcher. Existing scheduled tasks cover selected domain jobs, not arbitrary visual graphs. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

A factual answer includes permitted source records. Sensitive writes require explicit approval and execute once. A workflow run resumes after failure without repeating completed financial or identity actions.

Source anchors: src/components/Clerio/AIPanel.js; src/components/Clerio/WorkflowBuilderModal.js; src/lib/ai/policy-graph.ts; src/server/ai/evals.ts; src/server/ai/service.ts; src/server/jobs/handlers.ts

Persistence anchors to verify: agent_action_outcomes, agent_action_reversals, agent_action_simulations, agent_actions, agent_principals, agent_tools, ai_artifacts, ai_feedback, ai_run_steps. Core audit and identity tables apply across workstreams.

# M18 Governance audit privacy and global HR

Priority P1   |   Backend owner BE 18   |   Integration owner IN 18   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M18 F1<br>Audit access events and delegated access | SettingsView audit, AccessControlView<br>Seeded audit display and browser overrides. | GET /api/v1/ops/audit-events<br>GET /api/v1/ops/access-events<br>GET/POST /api/v1/delegations<br>POST /api/v1/delegations/[id]/revoke | Bind audited actor/object/result filters; add access reviews, temporary-grant visibility and separation-of-duties controls. |
| M18 F2<br>Privacy retention and holds | Proposed governance pages<br>No complete operational UI. | POST /api/v1/privacy/requests<br>POST /api/v1/privacy/requests/[id]/close<br>POST /api/v1/privacy/holds<br>POST /api/v1/privacy/holds/[id]/release | Create request/hold forms and guarded transitions; implement retention execution, export/deletion approvals and status evidence. |
| M18 F3<br>Global entity and locale | SettingsView tenant form, PayrollView country picker<br>UI selections do not establish entity/currency-specific processing. | GET/PATCH /api/v1/tenant/settings<br>GET/POST /api/v1/platform/tenants<br>GET/POST /api/v1/fx/rates | Add legal-entity administration and multiple employment views; use tenant-aware locale and policy assignment. Separate tenant access from country choice. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Audit history comes from durable events. An expired delegation cannot authorize a write. A legal hold blocks a conflicting deletion. Tenant switching clears all previous tenant data and pending requests.

Source anchors: src/components/Clerio/AccessControlView.js; src/components/Clerio/SettingsView.js; src/components/Dashboard/Views/NucleusIntelligence.js; src/server/admin/service.ts; src/server/delegation/service.ts; src/server/privacy/service.ts

Persistence anchors to verify: invitations, membership_roles, role_permissions, tenant_settings, delegation_windows, legal_holds, privacy_requests, access_events, scheduled_tasks. Core audit and identity tables apply across workstreams.

# M19 Compliance and contract workforce

Priority P2   |   Backend owner BE 19   |   Integration owner IN 19   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M19 F1<br>Compliance obligations evidence and forms | ComplianceView<br>Factory registers and local document/ERP helpers. | GET/POST /api/v1/compliance/obligations<br>POST /api/v1/compliance/evidence<br>GET /api/v1/compliance/forms<br>POST /api/v1/wage-simulations | Bind obligations, uploaded evidence and generated artifacts; verify jurisdiction/version. Add filing receipt and correction workflows; sample forms do not establish filing. |
| M19 F2<br>Agencies contracts and assignments | ContractWorkforceView<br>Sample contractor rosters and vendor views. | POST /api/v1/contractors/agencies<br>POST /api/v1/contractors/contracts<br>POST /api/v1/contractors/assignments | Build validated create/read/edit forms and map contractor person, assignment, entity and date IDs. |
| M19 F3<br>Contractor invoices and reconciliation | ContractWorkforceView invoice controls<br>Demo amounts and statuses. | GET/POST /api/v1/contractors/invoices | Connect approved attendance/rates to invoices; implement approval, variance review and ERP handoff with tenant-scoped evidence. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Each obligation links to its applicable jurisdiction and evidence. Contractor invoices reconcile to authorized rates and work records; transmitted/paid status has a verifiable external reference.

Source anchors: src/components/Clerio/ComplianceView.js; src/components/Clerio/ContractWorkforceView.js; src/services/erpAndComplianceService.js; src/server/compliance/service.ts; src/server/contractors/service.ts; src/server/payroll/service.ts

Persistence anchors to verify: compliance_calendar_items, compliance_evidence, legal_entities, statutory_forms, contract_worker_assignments, contractor_contracts, contractor_invoices, contractor_organizations, countries. Core audit and identity tables apply across workstreams.

# M20 Expenses projects and remaining product gaps

Priority P2   |   Backend owner BE 20   |   Integration owner IN 20   |   QA verifies the acceptance below

Current integration status: Unwired. Listed versioned endpoints are code-present assets; runtime and end-to-end acceptance are still required.

| Work item and submodule | Frontend components and current behavior | Existing backend methods and paths | Work to complete |
| --- | --- | --- | --- |
| M20 F1<br>Expenses and reimbursements | Claims navigation currently opens PayrollView<br>No dedicated claim/receipt/reimbursement implementation. | Gap<br>No dedicated route found | Create ExpenseClaim, lines, receipts, policy, approvals and batches; build a dedicated workspace. Do not reuse benefits claims as business expenses. |
| M20 F2<br>Projects timesheets and capacity | ProjectView, EmployeeHome time entry<br>Local projects, Kanban and time logs. | Gap<br>No dedicated route found | Create project/task/allocation/timesheet/entry/submit/approve APIs. Persist billable data and weekly lock/correction rules; add manager and payroll linkage. |
| M20 F3<br>Team chat and messages | ChatPanel<br>Local/demo messages and unread badge. | Gap<br>No dedicated route found | Decide provider integration or in-product messaging. Build conversation membership, persisted messages, delivery/unread and retention if in scope. |

### Ownership and acceptance

Backend: complete missing contracts, schema and business rules named above, enforce scope and persist audited transitions. Integration: implement the named forms/views, map IDs/enums/envelopes and replace local mutations with confirmed API outcomes.

Expense and time-entry submissions persist, route to the correct approver and are idempotent. Rejected or corrected items preserve history. Messages are scoped to actual conversation membership.

Source anchors: src/components/Clerio/ProjectView.js; src/components/Dashboard/Views/EmployeeHome.js; src/components/Clerio/ChatPanel.js

# Prioritized delivery backlog

Owners below are team responsibilities, not assigned individuals. Sequence is dependency-based; no unverified delivery dates are committed.

| Package | Owners | Work and dependencies | Acceptance to close |
| --- | --- | --- | --- |
| W00 Baseline P0 | BE + Platform | Fix B03; verify isolated schema, migrations and test harness; restore schema source; settle active ORM authority. | Typecheck and intended tests pass; schema/identity smoke evidence recorded. |
| W01 Identity P0 | BE 01 + IN 01 | B01 plus tenant selection, sessions, grants and bootstrap. Depends W00. | Real session and cross-tenant denial; logout invalidates access. |
| W02 Client bridge P0 | IN lead + BE platform | Adapters, command helper, idempotency/version rules, error mapping and tenant-safe refresh. Depends W01. | Contract fixtures and race/retry tests; no demo success fallback. |
| W03 Core operations P0 | BE/IN 02 to 05 | People slice, append punches, calendars, leave, scoped approvals and notifications. Depends W02. | Employee-to-manager flow persists and reconciles after reload. |
| W04 Lifecycle and money P1 | BE/IN 06 to 09 + 18 | Documents/onboarding/offboarding; payroll/loans; ATS handoff; governance basics. | Hire-to-employee and approved-input-to-payslip flows; financial retry tests. |
| W05 Extended HR P2 | BE/IN 10 to 15 + 20 | Reviews, learning, skills, compensation, engagement, helpdesk, expenses/timesheets. | Complete primary lifecycle for each feature; read/write/permission evidence. |
| W06 Platform intelligence P2 | BE/IN 16 to 19 + Platform | Providers, workers, AI, workflows, advanced reporting, contractor/compliance operations. | Verified sandbox delivery, grounded answers and durable job recovery. |
| W07 Release verification | QA + all owners | Execute page below; reconcile docs/inventory and retire legacy demo endpoints in live mode. | Release evidence bundle with failures resolved or explicitly deferred. |

Recommended initial tickets: BE01 auth handler and bootstrap; BE03 append-punch contract; BE02 people PATCH/archive/manager; IN01 session provider; IN02 people adapter and create/profile flows; QA01 tenant-safe employee lifecycle.

Every ticket should carry its Mxx F# feature ID, request/response example, schema/service anchor, permission, UI states, migration dependency and acceptance evidence. Backend and integration tickets can proceed separately only after the contract is frozen.

# Acceptance and release evidence

| Check | Minimum evidence | Owner |
| --- | --- | --- |
| Persistent operation | Create/change through UI; reload; second authorized session reads same server ID and state. | IN + QA |
| Identity and scope | Employee/manager/HR/payroll/admin cases; wrong-tenant IDs denied; self and team boundaries verified. | BE + QA |
| Contract and response | Actual request, headers, response envelope, types, money/date mapping and field errors captured. | BE + IN |
| State transitions | Allowed and forbidden transitions; archived/locked records; required actor and reason. | BE + QA |
| Retries and concurrency | Double-click, network timeout after commit, same-key replay, changed-body conflict and stale version. | BE + QA |
| Financial integrity | Calculated amounts reconcile to inputs; immutable finalization; corrections preserve earlier version. | Payroll BE + QA |
| Documents and reports | Real file bytes; scan/expiry behavior; authorized download; large export includes all selected rows. | BE + IN |
| Audit and notifications | Actor/object/before-after or delta/reason/request ID; delivery reflects actual domain event. | BE + Platform |
| Async and provider failure | Worker restart, retries/backoff, dead letter/replay, provider rejection and confirmed recovery. | Platform + QA |
| Frontend states | Loading, empty, permission denied, conflict, unavailable, partial data, validation and success on named components. | IN + QA |
| Accessibility and mobile | Keyboard dialog behavior, labels/focus/errors, readable tables and employee mobile workflows. | IN + QA |

### Evidence from this assessment

Executed npm run typecheck on 13 September 2026: failed because vitest is not installed and server/vp/service.ts:96 has a shiftHours type mismatch. Eighty TypeScript test files are present, but they are not evidence of passing tests. The prior 195 service/demo assertions were run before this backend handoff and do not validate the newly added stack.

No migration, seed, financial write or external-provider action was performed for this document. Use an isolated test tenant/database for the acceptance above; capture deployed migration versions and configuration separately.

# Environment setup and source authority

| Area | Configuration or source | Required handoff work |
| --- | --- | --- |
| Database | DATABASE_URL; lib/db/index.ts; db/migrations; db/schema/canonical-manifest.json | Configure isolated PostgreSQL/Neon; review existing migrations then db:status/db:migrate/db:verify as appropriate. Do not run demo seeds against operational tenants. |
| Session and bootstrap | BETTER_AUTH_URL; BETTER_AUTH_SECRET; ALLOW_INITIAL_ADMIN_SIGNUP; ADDITIONAL_TRUSTED_ORIGINS | Use environment-managed secrets and narrow allowed origins. Expose auth routes and establish a controlled initial administrator. |
| Platform access | PLATFORM_ADMIN_EMAILS; server/platform-admin/access.ts | Define approved platform operators separately from tenant roles; audit tenant/user administration. |
| AI | OPENAI_API_KEY; OPENAI_MODEL; lib/ai/policy-graph.ts | Choose approved model and data scope; connect actual request handling and evaluate grounded answers. A configured graph alone does not wire the chat UI. |
| Jobs and integrations | server/jobs; server/integrations; scheduled_tasks and transactional_outbox | Add worker invocation, service principal and secret configuration. Verify transport, retries and monitoring before enabling production schedules. |
| Schema source | scripts/generate-canonical-schema.ts expects personal_docs/03-data/diagrams | Restore missing source or replace generation authority. Keep the 304-table declaration distinct from verified deployed tables. |
| Legacy assets | prisma/schema.prisma; old demo auth/agent; older handoff documents | Retire or clearly isolate after verified cutover. Do not build new code against obsolete paths or prototype record IDs. |

### Repository handoff package

The editable Word document is the team-facing handoff. The Markdown companion contains the same workstreams plus a complete generated method/path inventory with source-file locations, header requirements and server imports. Paths are relative to the NucleusUI repository so they remain useful after transfer.

Product scope: the supplied HRMS V1, V2 and V3 specifications. Current implementation authority: src/app/page.js; src/components/Clerio/MainWorkspace.js; src/context; src/app/api/v1; src/server; src/lib/db; db/migrations.

Completion requires accepted evidence for both the backend command and its consuming frontend flow. Copied routes, sample screens, declared schema counts and success toasts are implementation artifacts rather than release evidence.

# Complete current route inventory

Generated from route source files on 13 September 2026. A method is code-present; no live result is implied. Headers indicate explicit helper usage in the route, not a full security audit.

| Method | Path | Explicit headers | Source | Server imports |
| --- | --- | --- | --- | --- |
| POST | /api/agent | Check route/service | src/app/api/agent/route.js |  |
| POST | /api/auth/login | Check route/service | src/app/api/auth/login/route.js |  |
| POST | /api/v1/ai/actions/[id]/approve | Check route/service | src/app/api/v1/ai/actions/[id]/approve/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/actions/[id]/execute | Idempotency-Key | src/app/api/v1/ai/actions/[id]/execute/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/actions/[id]/reverse | Check route/service | src/app/api/v1/ai/actions/[id]/reverse/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ai/actions/[id] | Check route/service | src/app/api/v1/ai/actions/[id]/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/actions | Check route/service | src/app/api/v1/ai/actions/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ai/evals/[id] | Check route/service | src/app/api/v1/ai/evals/[id]/route.ts | @/server/ai/evals, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/evals | Check route/service | src/app/api/v1/ai/evals/route.ts | @/server/ai/evals, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/feedback | Check route/service | src/app/api/v1/ai/feedback/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ai/knowledge | Check route/service | src/app/api/v1/ai/knowledge/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/knowledge | Check route/service | src/app/api/v1/ai/knowledge/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/reviews/[id]/decide | Check route/service | src/app/api/v1/ai/reviews/[id]/decide/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/reviews | Check route/service | src/app/api/v1/ai/reviews/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ai/runs/[id] | Check route/service | src/app/api/v1/ai/runs/[id]/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ai/runs | Check route/service | src/app/api/v1/ai/runs/route.ts | @/server/ai/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/analytics/capability-index/[id] | Check route/service | src/app/api/v1/analytics/capability-index/[id]/route.ts | @/server/analytics/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/analytics/capability-index | Check route/service | src/app/api/v1/analytics/capability-index/route.ts | @/server/analytics/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/analytics/metric-snapshots | Check route/service | src/app/api/v1/analytics/metric-snapshots/route.ts | @/server/analytics/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/analytics/metrics | Check route/service | src/app/api/v1/analytics/metrics/route.ts | @/server/analytics/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/analytics/metrics | Check route/service | src/app/api/v1/analytics/metrics/route.ts | @/server/analytics/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/announcements | Check route/service | src/app/api/v1/announcements/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/announcements | Check route/service | src/app/api/v1/announcements/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/applications/[id]/advance | Check route/service | src/app/api/v1/applications/[id]/advance/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/applications/[id]/dispose | Check route/service | src/app/api/v1/applications/[id]/dispose/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| GET | /api/v1/applications/[id] | Check route/service | src/app/api/v1/applications/[id]/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/applications/[id]/score | Check route/service | src/app/api/v1/applications/[id]/score/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| GET | /api/v1/applications | Check route/service | src/app/api/v1/applications/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/applications | Idempotency-Key | src/app/api/v1/applications/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/attendance/days/[id]/recompute | Check route/service | src/app/api/v1/attendance/days/[id]/recompute/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/attendance/days/[id]/trace | Check route/service | src/app/api/v1/attendance/days/[id]/trace/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/attendance/days/[id]/transition | Check route/service | src/app/api/v1/attendance/days/[id]/transition/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/attendance/days | Check route/service | src/app/api/v1/attendance/days/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/attendance/punches | Idempotency-Key | src/app/api/v1/attendance/punches/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/attendance/team-summary | Check route/service | src/app/api/v1/attendance/team-summary/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/auth/registration-state | Check route/service | src/app/api/v1/auth/registration-state/route.ts | @/server/identity/provision |
| POST | /api/v1/benefits/claims | Check route/service | src/app/api/v1/benefits/claims/route.ts | @/server/benefits/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/benefits/enrollments | Check route/service | src/app/api/v1/benefits/enrollments/route.ts | @/server/benefits/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/benefits/enrollments | Check route/service | src/app/api/v1/benefits/enrollments/route.ts | @/server/benefits/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/benefits/options | Check route/service | src/app/api/v1/benefits/options/route.ts | @/server/benefits/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/benefits/plans | Check route/service | src/app/api/v1/benefits/plans/route.ts | @/server/benefits/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/calibration-sessions/[id]/adjust | Check route/service | src/app/api/v1/calibration-sessions/[id]/adjust/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/calibration-sessions | Check route/service | src/app/api/v1/calibration-sessions/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/candidates/[id]/resume | Check route/service | src/app/api/v1/candidates/[id]/resume/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/candidates | Check route/service | src/app/api/v1/candidates/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/checkins | Check route/service | src/app/api/v1/checkins/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/coff-grants | Check route/service | src/app/api/v1/coff-grants/route.ts | @/server/leave/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/compensation/bands | Check route/service | src/app/api/v1/compensation/bands/route.ts | @/server/compensation/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/compensation/budgets | Check route/service | src/app/api/v1/compensation/budgets/route.ts | @/server/compensation/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/compensation/cycles | Check route/service | src/app/api/v1/compensation/cycles/route.ts | @/server/compensation/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/compensation/proposals/[id]/approve | Check route/service | src/app/api/v1/compensation/proposals/[id]/approve/route.ts | @/server/compensation/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/compensation/proposals | Check route/service | src/app/api/v1/compensation/proposals/route.ts | @/server/compensation/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/compensation/proposals | Check route/service | src/app/api/v1/compensation/proposals/route.ts | @/server/compensation/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/compliance/evidence | Check route/service | src/app/api/v1/compliance/evidence/route.ts | @/server/compliance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/compliance/forms | Check route/service | src/app/api/v1/compliance/forms/route.ts | @/server/compliance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/compliance/obligations | Check route/service | src/app/api/v1/compliance/obligations/route.ts | @/server/compliance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/compliance/obligations | Check route/service | src/app/api/v1/compliance/obligations/route.ts | @/server/compliance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/contractors/agencies | Check route/service | src/app/api/v1/contractors/agencies/route.ts | @/server/contractors/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/contractors/assignments | Check route/service | src/app/api/v1/contractors/assignments/route.ts | @/server/contractors/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/contractors/contracts | Check route/service | src/app/api/v1/contractors/contracts/route.ts | @/server/contractors/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/contractors/invoices | Check route/service | src/app/api/v1/contractors/invoices/route.ts | @/server/contractors/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/contractors/invoices | Check route/service | src/app/api/v1/contractors/invoices/route.ts | @/server/contractors/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/courses | Check route/service | src/app/api/v1/courses/route.ts | @/server/learning/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/courses | Check route/service | src/app/api/v1/courses/route.ts | @/server/learning/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/delegations/[id]/revoke | Check route/service | src/app/api/v1/delegations/[id]/revoke/route.ts | @/server/delegation/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/delegations | Check route/service | src/app/api/v1/delegations/route.ts | @/server/delegation/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/delegations | Check route/service | src/app/api/v1/delegations/route.ts | @/server/delegation/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/documents/[id]/download | Check route/service | src/app/api/v1/documents/[id]/download/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/documents/[id]/scan | Check route/service | src/app/api/v1/documents/[id]/scan/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/documents | Idempotency-Key | src/app/api/v1/documents/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/employee-skills | Check route/service | src/app/api/v1/employee-skills/route.ts | @/server/platform/access, @/server/platform/http, @/server/skills/service |
| POST | /api/v1/enrollments/[id]/complete | Check route/service | src/app/api/v1/enrollments/[id]/complete/route.ts | @/server/learning/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/enrollments | Check route/service | src/app/api/v1/enrollments/route.ts | @/server/learning/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/enrollments | Check route/service | src/app/api/v1/enrollments/route.ts | @/server/learning/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/exports/[id]/build | Check route/service | src/app/api/v1/exports/[id]/build/route.ts | @/server/exports/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/exports/[id] | Check route/service | src/app/api/v1/exports/[id]/route.ts | @/server/exports/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/exports | Check route/service | src/app/api/v1/exports/route.ts | @/server/exports/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/exports | Check route/service | src/app/api/v1/exports/route.ts | @/server/exports/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/feedback/entries | Check route/service | src/app/api/v1/feedback/entries/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/feedback | Check route/service | src/app/api/v1/feedback/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/feedback | Check route/service | src/app/api/v1/feedback/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/fx/rates | Check route/service | src/app/api/v1/fx/rates/route.ts | @/server/fx/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/fx/rates | Check route/service | src/app/api/v1/fx/rates/route.ts | @/server/fx/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/gate-passes/[id]/decide | Check route/service | src/app/api/v1/gate-passes/[id]/decide/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/gate-passes | Idempotency-Key | src/app/api/v1/gate-passes/route.ts | @/server/attendance/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/home | Check route/service | src/app/api/v1/home/route.ts | @/server/attendance/service, @/server/compliance/service, @/server/engagement/service, @/server/interviews/service, @/server/leave/service, @/server/notifications/service, @/server/organization/service, @/server/payroll/service, @/server/platform/access, @/server/platform/http, @/server/skills/service, @/server/talent/service |
| GET | /api/v1/identity/context | Check route/service | src/app/api/v1/identity/context/route.ts | @/server/identity/tenant-context, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/identity/context | Check route/service | src/app/api/v1/identity/context/route.ts | @/server/identity/tenant-context, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/identity/memberships | Check route/service | src/app/api/v1/identity/memberships/route.ts | @/server/identity/tenant-context, @/server/platform/http |
| GET | /api/v1/integrations/catalog | Check route/service | src/app/api/v1/integrations/catalog/route.ts | @/server/integrations/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/integrations/connections | Check route/service | src/app/api/v1/integrations/connections/route.ts | @/server/integrations/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/integrations/connections | Check route/service | src/app/api/v1/integrations/connections/route.ts | @/server/integrations/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/interview-plans | Check route/service | src/app/api/v1/interview-plans/route.ts | @/server/interviews/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/interview-scores | Check route/service | src/app/api/v1/interview-scores/route.ts | @/server/interviews/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/interview-sessions/[id]/debrief | Check route/service | src/app/api/v1/interview-sessions/[id]/debrief/route.ts | @/server/interviews/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/interview-sessions/[id]/scores | Check route/service | src/app/api/v1/interview-sessions/[id]/scores/route.ts | @/server/interviews/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/interview-sessions | Check route/service | src/app/api/v1/interview-sessions/route.ts | @/server/interviews/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/invitations/[id]/revoke | Check route/service | src/app/api/v1/invitations/[id]/revoke/route.ts | @/server/admin/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/invitations | Check route/service | src/app/api/v1/invitations/route.ts | @/server/admin/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/job-descriptions/[id]/approve | Check route/service | src/app/api/v1/job-descriptions/[id]/approve/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/job-descriptions | Check route/service | src/app/api/v1/job-descriptions/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| GET | /api/v1/job-postings | Check route/service | src/app/api/v1/job-postings/route.ts | @/server/interviews/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/job-postings | Check route/service | src/app/api/v1/job-postings/route.ts | @/server/interviews/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/key-results | Check route/service | src/app/api/v1/key-results/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/learning-paths | Check route/service | src/app/api/v1/learning-paths/route.ts | @/server/learning/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/leave-balances | Check route/service | src/app/api/v1/leave-balances/route.ts | @/server/leave/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/leave-requests/[id]/decide | Check route/service | src/app/api/v1/leave-requests/[id]/decide/route.ts | @/server/leave/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/leave-requests/[id]/early-return | Check route/service | src/app/api/v1/leave-requests/[id]/early-return/route.ts | @/server/leave/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/leave-requests | Check route/service | src/app/api/v1/leave-requests/route.ts | @/server/leave/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/leave-requests | Idempotency-Key | src/app/api/v1/leave-requests/route.ts | @/server/leave/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/loans/[id]/approve | Check route/service | src/app/api/v1/loans/[id]/approve/route.ts | @/server/loans/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/loans/[id]/consent | Check route/service | src/app/api/v1/loans/[id]/consent/route.ts | @/server/loans/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/loans/[id]/disburse | If-Match | src/app/api/v1/loans/[id]/disburse/route.ts | @/server/loans/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/loans/[id]/repay | Check route/service | src/app/api/v1/loans/[id]/repay/route.ts | @/server/loans/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/loans/[id] | Check route/service | src/app/api/v1/loans/[id]/route.ts | @/server/loans/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/loans | Check route/service | src/app/api/v1/loans/route.ts | @/server/loans/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/loans | Idempotency-Key | src/app/api/v1/loans/route.ts | @/server/loans/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/memberships/roles | Check route/service | src/app/api/v1/memberships/roles/route.ts | @/server/admin/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/notifications/[id]/read | Check route/service | src/app/api/v1/notifications/[id]/read/route.ts | @/server/notifications/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/notifications/preferences | Check route/service | src/app/api/v1/notifications/preferences/route.ts | @/server/notifications/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/notifications | Check route/service | src/app/api/v1/notifications/route.ts | @/server/notifications/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/objectives | Check route/service | src/app/api/v1/objectives/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/offboarding/cases/[id]/settle | Check route/service | src/app/api/v1/offboarding/cases/[id]/settle/route.ts | @/server/lifecycle/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/offboarding/cases | Check route/service | src/app/api/v1/offboarding/cases/route.ts | @/server/lifecycle/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/offboarding/items/[id]/clear | Check route/service | src/app/api/v1/offboarding/items/[id]/clear/route.ts | @/server/lifecycle/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/offers/[id]/transition | Check route/service | src/app/api/v1/offers/[id]/transition/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/offers | Check route/service | src/app/api/v1/offers/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| GET | /api/v1/onboarding/instances/[id]/readiness | Check route/service | src/app/api/v1/onboarding/instances/[id]/readiness/route.ts | @/server/lifecycle/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/onboarding/instances | Check route/service | src/app/api/v1/onboarding/instances/route.ts | @/server/lifecycle/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/onboarding/instances | Check route/service | src/app/api/v1/onboarding/instances/route.ts | @/server/lifecycle/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/onboarding/tasks/[id]/complete | Check route/service | src/app/api/v1/onboarding/tasks/[id]/complete/route.ts | @/server/lifecycle/service, @/server/platform/access, @/server/platform/http |
| PATCH | /api/v1/onboarding/templates/[id] | Check route/service | src/app/api/v1/onboarding/templates/[id]/route.ts | @/server/lifecycle/templates, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/onboarding/templates | Check route/service | src/app/api/v1/onboarding/templates/route.ts | @/server/lifecycle/templates, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/onboarding/templates | Check route/service | src/app/api/v1/onboarding/templates/route.ts | @/server/lifecycle/templates, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ops/access-events | Check route/service | src/app/api/v1/ops/access-events/route.ts | @/server/ops/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ops/audit-events | Check route/service | src/app/api/v1/ops/audit-events/route.ts | @/server/ops/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ops/outbox/[id]/retry | Check route/service | src/app/api/v1/ops/outbox/[id]/retry/route.ts | @/server/ops/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ops/outbox | Check route/service | src/app/api/v1/ops/outbox/route.ts | @/server/ops/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ops/scheduled-tasks/[id]/cancel | Check route/service | src/app/api/v1/ops/scheduled-tasks/[id]/cancel/route.ts | @/server/ops/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/ops/scheduled-tasks | Check route/service | src/app/api/v1/ops/scheduled-tasks/route.ts | @/server/jobs/handlers, @/server/jobs/worker, @/server/ops/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/ops/scheduled-tasks | Check route/service | src/app/api/v1/ops/scheduled-tasks/route.ts | @/server/jobs/handlers, @/server/jobs/worker, @/server/ops/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/organization/departments | Idempotency-Key | src/app/api/v1/organization/departments/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/organization/positions | Idempotency-Key | src/app/api/v1/organization/positions/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/organization/tree | Check route/service | src/app/api/v1/organization/tree/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/payroll-anomalies/[id]/resolve | Check route/service | src/app/api/v1/payroll-anomalies/[id]/resolve/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/payroll-anomalies | Check route/service | src/app/api/v1/payroll-anomalies/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/payroll-inputs | Check route/service | src/app/api/v1/payroll-inputs/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/payroll-inputs | Check route/service | src/app/api/v1/payroll-inputs/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/payroll-runs/[id]/approve | Check route/service | src/app/api/v1/payroll-runs/[id]/approve/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/payroll-runs/[id]/calculate | Idempotency-Key | src/app/api/v1/payroll-runs/[id]/calculate/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/payroll-runs/[id]/correct | Idempotency-Key | src/app/api/v1/payroll-runs/[id]/correct/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/payroll-runs/[id]/finalize | If-Match | src/app/api/v1/payroll-runs/[id]/finalize/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/payroll-runs/[id]/journal | Check route/service | src/app/api/v1/payroll-runs/[id]/journal/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/payroll-runs/[id] | Check route/service | src/app/api/v1/payroll-runs/[id]/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/payroll-runs | Check route/service | src/app/api/v1/payroll-runs/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/payroll-runs | Idempotency-Key | src/app/api/v1/payroll-runs/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/payslips/[id] | Check route/service | src/app/api/v1/payslips/[id]/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/people/[id] | Check route/service | src/app/api/v1/people/[id]/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/people/import-apply | Idempotency-Key | src/app/api/v1/people/import-apply/route.ts | @/server/organization/import-apply, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/people/import-preview | Check route/service | src/app/api/v1/people/import-preview/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/people | Check route/service | src/app/api/v1/people/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/people | Idempotency-Key | src/app/api/v1/people/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| PATCH | /api/v1/platform/tenants/[tenantId] | Check route/service | src/app/api/v1/platform/tenants/[tenantId]/route.ts | @/server/platform-admin/access, @/server/platform-admin/service, @/server/platform/http |
| GET | /api/v1/platform/tenants/[tenantId]/users | Check route/service | src/app/api/v1/platform/tenants/[tenantId]/users/route.ts | @/server/platform-admin/access, @/server/platform-admin/service, @/server/platform/http |
| POST | /api/v1/platform/tenants/[tenantId]/users | Check route/service | src/app/api/v1/platform/tenants/[tenantId]/users/route.ts | @/server/platform-admin/access, @/server/platform-admin/service, @/server/platform/http |
| GET | /api/v1/platform/tenants | Check route/service | src/app/api/v1/platform/tenants/route.ts | @/server/platform-admin/access, @/server/platform-admin/service, @/server/platform/http |
| POST | /api/v1/platform/tenants | Check route/service | src/app/api/v1/platform/tenants/route.ts | @/server/platform-admin/access, @/server/platform-admin/service, @/server/platform/http |
| POST | /api/v1/privacy/holds/[id]/release | Check route/service | src/app/api/v1/privacy/holds/[id]/release/route.ts | @/server/platform/access, @/server/platform/http, @/server/privacy/service |
| POST | /api/v1/privacy/holds | Check route/service | src/app/api/v1/privacy/holds/route.ts | @/server/platform/access, @/server/platform/http, @/server/privacy/service |
| POST | /api/v1/privacy/requests/[id]/close | Check route/service | src/app/api/v1/privacy/requests/[id]/close/route.ts | @/server/platform/access, @/server/platform/http, @/server/privacy/service |
| POST | /api/v1/privacy/requests | Check route/service | src/app/api/v1/privacy/requests/route.ts | @/server/platform/access, @/server/platform/http, @/server/privacy/service |
| POST | /api/v1/recognition-events | Check route/service | src/app/api/v1/recognition-events/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/referrals/[id]/award | Check route/service | src/app/api/v1/referrals/[id]/award/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/referrals | Check route/service | src/app/api/v1/referrals/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/regularizations/[id]/decide | Check route/service | src/app/api/v1/regularizations/[id]/decide/route.ts | @/server/attendance/regularizations, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/regularizations | Check route/service | src/app/api/v1/regularizations/route.ts | @/server/attendance/regularizations, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/reports/team-history | Check route/service | src/app/api/v1/reports/team-history/route.ts | @/server/platform/access, @/server/platform/http, @/server/vp/service |
| POST | /api/v1/requisitions/[id]/approve | Check route/service | src/app/api/v1/requisitions/[id]/approve/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/requisitions | Idempotency-Key | src/app/api/v1/requisitions/route.ts | @/server/platform/access, @/server/platform/http, @/server/talent/service |
| POST | /api/v1/review-cycles | Check route/service | src/app/api/v1/review-cycles/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/review-participants | Check route/service | src/app/api/v1/review-participants/route.ts | @/server/performance/reviews, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/review-responses | Check route/service | src/app/api/v1/review-responses/route.ts | @/server/performance/reviews, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/review-responses | Check route/service | src/app/api/v1/review-responses/route.ts | @/server/performance/reviews, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/roles/[id]/permissions | Check route/service | src/app/api/v1/roles/[id]/permissions/route.ts | @/server/admin/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/roles | Check route/service | src/app/api/v1/roles/route.ts | @/server/admin/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1 | Check route/service | src/app/api/v1/route.ts |  |
| POST | /api/v1/salary-advances/[id]/approve | Check route/service | src/app/api/v1/salary-advances/[id]/approve/route.ts | @/server/advances/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/salary-advances/[id]/pay | If-Match | src/app/api/v1/salary-advances/[id]/pay/route.ts | @/server/advances/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/salary-advances/[id] | Check route/service | src/app/api/v1/salary-advances/[id]/route.ts | @/server/advances/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/salary-advances | Check route/service | src/app/api/v1/salary-advances/route.ts | @/server/advances/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/salary-advances | Idempotency-Key | src/app/api/v1/salary-advances/route.ts | @/server/advances/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/search | Check route/service | src/app/api/v1/search/route.ts | @/server/organization/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/shift-swaps/[id]/decide | Check route/service | src/app/api/v1/shift-swaps/[id]/decide/route.ts | @/server/attendance/regularizations, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/shift-swaps | Check route/service | src/app/api/v1/shift-swaps/route.ts | @/server/attendance/regularizations, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/skill-evidence/[id]/verify | Check route/service | src/app/api/v1/skill-evidence/[id]/verify/route.ts | @/server/platform/access, @/server/platform/http, @/server/skills/service |
| POST | /api/v1/skill-evidence | Check route/service | src/app/api/v1/skill-evidence/route.ts | @/server/platform/access, @/server/platform/http, @/server/skills/service |
| POST | /api/v1/succession-plans | Check route/service | src/app/api/v1/succession-plans/route.ts | @/server/performance/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/survey-responses | Check route/service | src/app/api/v1/survey-responses/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/survey-runs/[id]/results | Check route/service | src/app/api/v1/survey-runs/[id]/results/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/survey-runs | Check route/service | src/app/api/v1/survey-runs/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/surveys | Check route/service | src/app/api/v1/surveys/route.ts | @/server/engagement/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/tenant/settings | Check route/service | src/app/api/v1/tenant/settings/route.ts | @/server/admin/service, @/server/platform/access, @/server/platform/http |
| PATCH | /api/v1/tenant/settings | Check route/service | src/app/api/v1/tenant/settings/route.ts | @/server/admin/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/vp/readiness | Check route/service | src/app/api/v1/vp/readiness/route.ts | @/server/platform/access, @/server/platform/http, @/server/vp/service |
| POST | /api/v1/vp/readiness | Check route/service | src/app/api/v1/vp/readiness/route.ts | @/server/platform/access, @/server/platform/http, @/server/vp/service |
| POST | /api/v1/wage-simulations | Check route/service | src/app/api/v1/wage-simulations/route.ts | @/server/payroll/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/webhooks/deliveries/[id]/replay | Check route/service | src/app/api/v1/webhooks/deliveries/[id]/replay/route.ts | @/server/integrations/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/webhooks/deliveries | Check route/service | src/app/api/v1/webhooks/deliveries/route.ts | @/server/integrations/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/webhooks/endpoints | Check route/service | src/app/api/v1/webhooks/endpoints/route.ts | @/server/integrations/service, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/webhooks/inbound/[connectionId] | Check route/service | src/app/api/v1/webhooks/inbound/[connectionId]/route.ts | @/server/integrations/inbound, @/server/platform/http |
| GET | /api/v1/webhooks/inbound | Check route/service | src/app/api/v1/webhooks/inbound/route.ts | @/server/integrations/inbound, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/webhooks/secrets | Check route/service | src/app/api/v1/webhooks/secrets/route.ts | @/server/integrations/inbound, @/server/platform/access, @/server/platform/http |
| POST | /api/v1/webhooks/subscriptions | Check route/service | src/app/api/v1/webhooks/subscriptions/route.ts | @/server/integrations/service, @/server/platform/access, @/server/platform/http |
| GET | /api/v1/workspace/bootstrap | Check route/service | src/app/api/v1/workspace/bootstrap/route.ts | @/server/admin/service, @/server/identity/tenant-context, @/server/notifications/service, @/server/platform-admin/access, @/server/platform/access, @/server/platform/http |