# Nucleus HRMS — Development Master Plan

> **This is the single authoritative file for the UX, navigation and dashboard programme.**
> Development decisions, task status, acceptance criteria and scope changes must be recorded here. Earlier designer blueprints and the two internal planning documents are reference material only. If they conflict with this file, this file wins.

**Status:** Frontend foundation and persistent desktop navigation implemented; product approvals and data-backed cockpit programme pending
**Version:** 1.8
**Created:** 12 September 2026
**Application:** `mkraft-hrms`
**Owners required:** Product, Design, Frontend, Backend, Data, Security, HR/Payroll Policy and QA

---

## 1. Outcome

Nucleus HRMS will become a calm, beautiful, professional B2B product with:

- Montserrat headings and navigation;
- Lato body copy, forms, tables and data;
- restrained teal/navy/slate colors instead of neon or Gen-Z styling;
- one consistent component and interaction language across all modules;
- a route-aware dual-pane Modules launcher;
- persistent domain navigation on the left of desktop routes;
- a persistent selected-domain module and intelligence rail on wide desktop routes;
- role-appropriate dashboards backed by real, explainable data;
- secure, permission-scoped and auditable workflows.

Success means users can quickly discover permitted work, understand every screen, trust every number and safely complete tasks without the interface feeling crowded or theatrical.

---

## 2. Authority and change control

### 2.1 Documents

| Document | Status | Usage |
|---|---|---|
| `docs/DEVELOPMENT_MASTER_PLAN.md` | **Authoritative** | Scope, design decisions, tasks, acceptance and release gates |
| `docs/UX_NAVIGATION_DASHBOARD_CHANGE_PLAN.md` | Reference | Original reconciled UX and dashboard analysis |
| `docs/MODULE_SUBMODULE_COMPONENT_INTERACTION_BLUEPRINT.md` | Reference | Expanded module/component exploration |
| Six external designer blueprints | Input only | Design ideas and requested capabilities; never direct code instructions |

### 2.2 Change process

Any material change must update this file before implementation:

1. State the proposed change and reason.
2. Identify affected tasks, routes, components, data, permissions and tests.
3. Record the approving product/design/technical owner.
4. Update acceptance criteria and dependencies.
5. Increment this document's version.

No developer should implement from the earlier documents without reconciling the work here.

---

## 3. Final decisions

### 3.1 Keep

- Next.js 16 App Router and canonical URL navigation.
- React 19 and TypeScript.
- Current `src/components/hrms` structure unless separately refactored.
- Drizzle ORM and current PostgreSQL schema/migrations.
- Better Auth, tenant membership and current server authorization.
- `/api/v1` route conventions.
- Current domain services, audit patterns and tests.
- Real-data behavior where unavailable values render as unavailable, never as invented numbers.

### 3.2 Change

- Replace aggressive/neon presentation with the approved B2B design system.
- Replace general UI monospace styling with Montserrat/Lato.
- Introduce a canonical navigation catalogue.
- Add dual-pane desktop and two-step mobile module navigation.
- Use one consistent shell across dashboard and operational routes.
- Keep the labelled left navigation persistent from 1024px and the contextual intelligence rail persistent from 1280px; use accessible drawers below those breakpoints.
- Build a shared dashboard framework and approved role cockpits.
- Standardize module headers, tabs, filters, tables, drawers, dialogs and states.

### 3.3 Do not do

- Do not replace Drizzle with the designer's Prisma schema.
- Do not replace Better Auth with NextAuth/JWT.
- Do not create a parallel client-only `activeTab` router.
- Do not paste files into the designer's imaginary `Clerio` structure.
- Do not ship sample dashboard numbers as production data.
- Do not treat designer-provided statutory formulas as legally approved.
- Do not expose unfinished modules as clickable cards.
- Do not simulate successful approvals, payroll, attendance or roster changes in client state.
- Do not allow AI to directly perform restricted employee, pay, bank or termination actions.

---

## 4. Visual system

### 4.1 Design personality

Use **calm enterprise intelligence**:

- neutral surfaces;
- strong information hierarchy;
- muted, meaningful accents;
- generous but efficient spacing;
- minimal shadows;
- small, purposeful motion;
- plain operational language;
- no glow, scan line, animated grid, confetti or spring bounce.

### 4.2 Typography

| Token | Family | Size / line | Weight | Use |
|---|---|---:|---:|---|
| Display | Montserrat | 32/40px | 600 | Large dashboard greeting |
| H1 | Montserrat | 28/36px | 600 | Page title |
| H2 | Montserrat | 22/30px | 600 | Major section |
| H3 | Montserrat | 18/26px | 600 | Group heading |
| H4 | Montserrat | 15/22px | 600 | Card title |
| Navigation | Montserrat | 13/18px | 500 | Rail, tabs and menus |
| Button | Montserrat | 13/18px | 600 | All button labels |
| Body | Lato | 14/21px | 400 | Default copy |
| Strong body | Lato | 14/21px | 700 | Emphasis/value |
| Table | Lato | 13/20px | 400 | Table cells |
| Small | Lato | 12/18px | 400 | Metadata/helper copy |
| Caption | Lato | 11/16px | 700 | Compact label, used sparingly |
| KPI | Lato | 28/34px | 700 | Primary metrics |

Rules:

- Bundle/self-host through the Next.js font system.
- No routine UI text below 11px.
- Avoid wide letter spacing and excessive uppercase.
- Maximum normal weight is 700 outside the brand mark.
- Numeric data uses Lato with tabular numerals and right alignment.
- Support labels at least 30% longer than the English baseline.

### 4.3 Light palette

| Token | Value | Usage |
|---|---:|---|
| Canvas | `#F4F7F8` | Application background |
| Surface | `#FFFFFF` | Cards, panels, dialogs |
| Subtle surface | `#F8FAFB` | Secondary regions/table headers |
| Selected surface | `#E9F1F0` | Selected rows/navigation |
| Primary text | `#17232B` | Headings and values |
| Secondary text | `#4E5D68` | Body text |
| Muted text | `#6E7C86` | Metadata/placeholders |
| Border | `#D8E0E4` | Standard boundary |
| Strong border | `#BBC8CE` | Emphasis/focus grouping |
| Primary | `#2F6F68` | Main actions, links, active state |
| Primary hover | `#275E58` | Hover |
| Primary pressed | `#204E49` | Pressed |
| Primary soft | `#E6F0EE` | Tinted background |
| Focus | `#315F7D` | Keyboard focus ring |

### 4.4 Dark palette

| Token | Value | Usage |
|---|---:|---|
| Canvas | `#0F1519` | Charcoal/navy background |
| Surface | `#171F24` | Cards and navigation |
| Raised surface | `#1D272D` | Menus and dialogs |
| Selected surface | `#203330` | Selected state |
| Primary text | `#E7ECEF` | Headings and values |
| Secondary text | `#B8C2C8` | Body text |
| Muted text | `#8D9AA3` | Metadata/placeholders |
| Border | `#303D45` | Standard boundary |
| Strong border | `#46555F` | Emphasis |
| Primary | `#78AAA3` | Primary accent |
| Primary hover | `#8BB9B3` | Hover |
| Primary pressed | `#679A93` | Pressed |
| Focus | `#78A3BF` | Keyboard focus ring |

### 4.5 Semantic and chart colors

| Meaning | Main | Soft |
|---|---:|---:|
| Success | `#3F745F` | `#E8F1EC` |
| Information | `#496D8C` | `#E9EFF4` |
| Warning | `#916F36` | `#F5F0E6` |
| Danger | `#A65353` | `#F6EAEA` |
| AI/Insight | `#6E6685` | `#EFEDF3` |

Charts use muted teal `#527D78`, blue `#5C7894`, olive `#71806B`, amber `#94784E`, plum `#776E84` and rose `#956A6E`. Use labels, shapes or patterns in addition to color. Red is reserved for actionable risk.

### 4.6 Spacing and elevation

- Base spacing: 4px.
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- Button heights: 36px compact, 40px default, 44px mobile primary.
- Inputs: 40px desktop, 44px mobile.
- Card padding: 16px compact, 20px default, 24px prominent.
- Standard radius: 8px; dialog radius: 10px; pills only for badges.
- Standard shadow: `0 6px 18px rgba(15,23,42,.08)`.
- Dialog shadow: `0 20px 50px rgba(15,23,42,.18)`.

---

## 5. Shell and navigation specification

### 5.1 Breakpoints

| Width | Shell |
|---:|---|
| 320–639px | 56px header, no fixed rails, full-screen module navigation and right-side work drawer |
| 640–1023px | 60px header, no fixed rails, modal module navigation and right-side work drawer |
| 1024–1279px | 56px header, persistent 184px domain rail; selected domain opens in the right drawer |
| 1280–1599px | 56px header, persistent 184px domain rail, fluid main workspace and persistent 272px module/work rail |
| 1600px+ | Same three-column shell; main content capped at 1680px within its available center column |

### 5.2 Dashboard shell

- Sticky global header.
- Same persistent desktop navigation as operational routes; rails never disappear because the current route is `/`.
- Main content width is `min(1680px, 100%)` inside the space reserved between the rails.
- 24px desktop, 16px tablet/mobile gutters.
- 12-column desktop, 8-column tablet, 4-column mobile grid.
- Modules launcher always visible.
- Right intelligence/work rail is fixed and independently scrollable at 1280px+; it opens as a focus-managed drawer below 1280px.
- Normal document scrolling; no nested main scroll trap.

### 5.3 Operational shell

- 184px domain rail from 1024px upward.
- The rail contains only Workspace, People, Work & pay, Talent & growth and Governance when the user has at least one permitted route in that domain.
- Selecting a domain uses text, background and a leading indicator; it updates the right module rail without changing the route.
- At 1024–1279px, selecting a left domain opens the right module rail as a drawer.
- Contextual sub-modules appear as tabs below the page header.
- Right rail remains visible at 1280px+ and opens as a bounded drawer below 1280px.
- Tablet/mobile access navigation from the header.

### 5.4 Left and right navigation feature inventory

Left rail, filtered by the signed-in user's permissions:

- **Workspace**
- **People**
- **Work & pay**
- **Talent & growth**
- **Governance**

Right rail:

- **Selected-domain modules:** permission-scoped routes for the domain selected on the left, including an active-page state.
- **Workspace:** Command centre, My inbox and Mira assistant.
- **People:** People core, Organisation, Lifecycle and Engagement.
- **Work & pay:** Time office, Leave & COFF, Payroll and Loans & advances.
- **Talent & growth:** Performance, Talent acquisition, Learning, Compensation and People intelligence.
- **Governance:** Compliance, Integrations, VP readiness and Settings.
- **My day:** unread total and up to four recent notifications; unread items can be marked read.
- **Inbox:** direct link to the complete work queue.
- **Ask Mira:** fixed bottom panel with inline policy/workforce question input and loading, answer and error states.

Interaction and layout contract:

- Route changes never remove either desktop rail and automatically restore the route's domain as the selected domain.
- Selecting a left domain navigates to the last authorized route visited in that domain; if none exists, it opens the first authorized route. Memory is tenant-scoped in browser storage and stored targets are revalidated against current permissions.
- Opening the Modules launcher keeps both rails visually present and constrains the modal/backdrop to the center workspace.
- The center workspace reserves exactly 184px on the left from 1024px and 272px on the right from 1280px, preventing either rail from overlaying page content.
- The right rail owns one full-height scroll viewport for its module links and work tools; its header and assistant shortcut stay fixed.
- The mobile/tablet right drawer closes automatically if the viewport is enlarged to the persistent-rail breakpoint.
- All navigation is native-link based, URL authoritative, keyboard reachable and permission scoped.

### 5.5 Header order

Desktop: Brand → Search → Modules → Dashboard selector → spacer → Quick action → Notifications → Intelligence → Account/workspace.

The title bar is 56px high and spans the complete viewport area to the right of the 184px domain rail. Search flexes within available width, lower-priority labels wait until wide desktop, and theme plus account controls align at the true viewport-right edge above the right module rail. The visible theme switch remains a 40px labelled control. Dark remains the first-load default; an explicit light selection is persisted.

Mobile: Modules → Compact brand → spacer → Search → Notifications → Avatar. Lower-priority controls move into overflow and never shrink below 40px.

### 5.6 Dual-pane launcher

Desktop dimensions:

- 820px wide where possible and constrained to the available center workspace;
- constant height `min(680px, calc(100vh - 112px))` when desktop rails are present; changing domains or result counts never resizes the dialog;
- 280px domain pane;
- fluid destination pane;
- 56px header and 40px keyboard-help footer.

Mobile uses a full-screen two-step flow: domain list → destination list, with Back and Search.

Interaction:

- Button or `Ctrl/Cmd + M` opens/closes.
- Click selects domain.
- Hover previews after 100ms; keyboard selection is immediate.
- Arrow keys move through domains/cards.
- Enter/Space selects.
- Escape closes.
- Tab remains trapped inside the modal.
- Navigation closes the launcher and opens the canonical route.
- Only authorized, available destinations appear.
- Counts are computed; no hard-coded “43 modules”.

### 5.7 Canonical navigation catalogue

Create `src/lib/navigation-catalog.ts` containing:

`id`, `label`, `description`, `href`, `domain`, `icon`, `keywords`, `requiredPermissions`, `status` and optional `badge`.

The catalogue powers:

- persistent desktop left rail;
- contextual right-rail shortcuts;
- mobile navigation;
- Modules launcher;
- global module search;
- dashboard/module quick links.

URL routing remains authoritative. Overlay selection is local state only.

---

## 6. Shared component system

| Component | Purpose | Required states |
|---|---|---|
| `ModulePageHeader` | Title, scope, freshness and actions | default, loading, partial, restricted |
| `ModuleTabs` | Contextual sub-module navigation | default, hover, active, focus, overflow, mobile |
| `FilterBar` | Search, filters, dates and saved views | idle, dirty, applied, loading, reset |
| `MetricCard` | Explainable value | loading, value, zero, missing, stale, restricted |
| `DataTable` | Sortable/filterable records | loading, empty, error, selectable, paginated |
| `StatusBadge` | Icon + text status | neutral, info, success, warning, danger |
| `DetailDrawer` | Read-first record inspection | loading, read, edit, dirty, save-error |
| `TaskDialog` | Short decision/confirmation | default, invalid, submitting, success, error |
| `Wizard` | Multi-step creation/import | active, complete, invalid, resumable, failed |
| `Timeline` | Workflow/audit history | empty, current, pending, failed, corrected |
| `ApprovalPanel` | Approve/reject/reroute | pending, submitting, complete, no-authority |
| `FileUploader` | Upload/scan/validation | idle, drag, upload, scan, accepted, rejected |
| `ChartPanel` | Visualization + data alternative | loading, data, empty, partial, error, restricted |
| `EmptyState` | Explain absence and next step | first-use, no-results, unavailable, no-access |
| `InlineNotice` | Scoped status | info, success, warning, error, partial |

Page anatomy: header → tabs → filters → optional metrics → primary content → drawer/dialog/wizard.

---

## 7. Module and sub-module build matrix

### 7.1 Dashboard and personal work

| Module/route | Sub-modules | Main components | Main interactions |
|---|---|---|---|
| Dashboard `/` | Cockpit selector, S1–S10, freshness, shared widgets | `CockpitSelector`, `MetricStrip`, `ChartPanel`, `ActionQueue`, `FreshnessBadge` | Change authorized view/filter, inspect definition, drill into module, retry source |
| Inbox `/inbox` | Queue, item detail, decision, read state | `InboxList`, `InboxDetailDrawer`, `ApprovalPanel`, `Timeline` | Search/filter, inspect, approve/reject/reroute, mark read |
| Mira `/assistant` | Conversation, grounded answer, action proposal, feedback, history | `ConversationPanel`, `CitationCard`, `ActionProposalCard`, `AnswerFeedback` | Ask/cancel/retry, open evidence, open prefilled normal workflow |
| Notifications | Popover, rows, preferences | `NotificationPopover`, `NotificationRow` | Open target, mark read, open inbox |
| Focus/announcements | Focus tasks, announcement feed, authoring | `FocusTaskList`, `AnnouncementCard`, `AnnouncementComposer` | Complete/reopen, read/acknowledge, authorized schedule/publish |

### 7.2 Core HR

| Module/route | Sub-modules | Main components | Main interactions |
|---|---|---|---|
| People `/people` | Directory, profile/dossier, positions/bands, documents, history, create | `PeopleTable`, `EmployeeDossierSheet`, `PositionTable`, `DocumentTable`, `CreatePersonWizard` | Search/filter/open, inspect the selected employee, edit permitted fields, upload/verify, create/invite |
| Organization `/organization` | Explorer, departments, reporting lines, positions, history | `OrgTree`, `DepartmentTable`, `ReportingLineEditor`, `PositionPlanTable`, `DiffPanel` | Explore/search, create/edit, preview manager change, schedule effective change |
| Lifecycle `/onboarding` | Pipeline, checklist, documents, assets, letters, probation, exit | `LifecycleBoard`, `ChecklistRun`, `AssetPicker`, `LetterMergeForm`, `ExitChecklist` | Filter journey, complete evidence-backed tasks, allocate/return, generate, clear exit |
| Engagement `/engagement` | Surveys, administration, trends, recognition, wellbeing | `SurveyResponseForm`, `SurveyBuilder`, `TrendChart`, `RecognitionFeed` | Save/submit survey, schedule, analyze permitted aggregates, recognize colleague |

Safety: field-level profile access, document scanning/retention, cycle-free reporting lines, anonymous survey thresholds and immutable employment history.

### 7.3 Workforce operations

| Module/route | Sub-modules | Main components | Main interactions |
|---|---|---|---|
| Attendance `/attendance` | Today/punch, calendar, day trace, regularization, team, rosters, OT | `PunchStatusCard`, `AttendanceCalendar`, `PunchTimeline`, `RegularizationForm`, `RosterMatrix` | Punch, inspect calculation, request correction, review team, preview/commit shift |
| Leave `/leave` | Balances, apply, requests, approvals, COFF, policy | `LeaveBalanceCards`, `LeaveRequestForm`, `ApprovalTimeline`, `LeaveApprovalQueue`, `CoffLedger` | Inspect ledger, calculate/apply, cancel if allowed, approve/reject/reroute |
| Contract workforce | Contractors, agencies, contracts, invoice reconciliation | Future components only | **Future: not routable until product/schema/service/permission approval** |
| Projects/timesheets | Projects, board, timesheets, allocation | Future components only | **Future: not routable until approved** |

Safety: server time, immutable raw punches, policy-versioned calculations, locked payroll periods, roster conflict validation and traceable COFF credits.

### 7.4 Payroll and finance

| Module/route | Sub-modules | Main components | Main interactions |
|---|---|---|---|
| Payroll `/payroll` | Runs, inputs, calculation, anomalies, approval, journal, payslips, finalization | `PayrollRunTable`, `InputImportWizard`, `RunStepper`, `AnomalyQueue`, `JournalPreview`, `FinalizeChecklist` | Create/resume, dry-run import, calculate/trace, resolve anomaly, approve, release/finalize |
| Loans `/loans` | My loans, apply, finance review, advances/EWA, repayments | `LoanSummaryCards`, `LoanApplicationWizard`, `LoanApprovalQueue`, `RepaymentLedger` | Inspect, apply, review, approve/reject, correct repayment |
| Compensation `/compensation` | Total rewards, bands, changes, benefits, history | `CompensationSummary`, `BandPositionChart`, `CompChangeForm`, `EnrollmentForm` | Review/download, compare, propose/approve change, enroll |

Safety: deterministic versioned calculation, no blanket anomaly clearing, maker-checker approval, protected bank/finalization actions, self-only pay access by default.

### 7.5 Talent and growth

| Module/route | Sub-modules | Main components | Main interactions |
|---|---|---|---|
| Talent `/talent` | Requisitions, candidate pipeline, applications, interviews, offers, insights | `RequisitionTable`, `CandidateBoard`, `CandidateDrawer`, `ScorecardForm`, `OfferWorkflow` | Create/approve requisition, advance stage, review resume, score interview, issue offer |
| Performance `/performance` | Cycles, goals, reviews, feedback, calibration, publish | `CycleTable`, `GoalTree`, `ReviewForm`, `CalibrationGrid`, `PublishSummary` | Configure/launch, update goals, draft/submit, calibrate with reason, publish |
| Learning `/learning` | My learning, catalogue, assignments, certificates, skills, analytics | `EnrollmentCards`, `CourseGrid`, `AssignmentTable`, `CertificateTable`, `SkillProfile` | Resume/enroll, assign, upload/verify, add skill evidence, inspect aggregate |

Safety: candidate consent/retention, controlled resume download, review confidentiality, calibration audit, accessible non-drag interactions and verified-vs-inferred skill distinction.

### 7.6 Insights and AI

| Module/route | Sub-modules | Main components | Main interactions |
|---|---|---|---|
| Insights `/insights` | Metric catalogue, snapshots, capability runs, custom analysis, exports | `MetricDefinitionTable`, `SnapshotChart`, `CapabilityRunTable`, `AnalysisBuilder`, `ExportConfigurator` | Inspect definition, compare periods, run authorized metric, preview/save, export |
| Mira `/assistant` | Conversation, evidence, proposed action, history | Shared assistant components | Ask, verify evidence, open standard workflow, manage history |
| Dedicated helpdesk | Tickets, messages, SLA, assignment, category routing | Future components | **Future: use Inbox + Mira until separately approved** |

Safety: metric version/provenance, query limits, small-cohort suppression, permission-aware dimensions, audited export and no AI bypass of workflows.

### 7.7 Platform and governance

| Module/route | Sub-modules | Main components | Main interactions |
|---|---|---|---|
| Compliance `/compliance` | Obligations, evidence, controls, filings, analytics | `ObligationCalendar`, `EvidenceUploader`, `ControlRegister`, `FilingChecklist` | Assign/review, upload/verify, test/remediate, record submission proof |
| Integrations `/integrations` | Connectors, sync runs, webhooks, API keys, inbound imports | `ConnectorGrid`, `SyncRunTable`, `WebhookTable`, `ApiKeyDialog`, `MappingEditor` | Configure, run/retry, rotate, generate/revoke, dry-run/activate |
| VP readiness `/readiness` | Feature coverage, guided operations, gates, history | `ReadinessSummary`, `FeatureCoverage`, `GuidedOperationForm`, `GateChecklist`, `RunComparison` | Choose operation, complete action-specific fields, validate inline, submit idempotently, inspect result |
| Settings `/settings` | Organization, members, roles, policies, notifications, audit, security | `TenantSettingsForm`, `MembershipTable`, `PermissionMatrix`, `PolicyVersionTable`, `AuditTable` | Configure, invite/change access, approve policy, inspect/export audit |
| Platform `/platform` | Tenants, system health, jobs, feature flags, access reviews | `TenantTable`, `ServiceStatusGrid`, `JobTable`, `FlagEditor`, `AccessReviewTable` | Provision/control, inspect, safe retry, staged rollout, certify access |

Safety: entity/jurisdiction clarity, evidence retention, no secret redisplay, webhook signing/replay protection, last-owner protection, reauthentication and full privileged-action audit.

---

## 8. Role cockpit build plan

### Release 1

| Order | Cockpit | Required features | Dependencies |
|---:|---|---|---|
| 1 | S8 Employee Home | Shift/punch, leave balance, payslip, quick links, policy answer, goals, attendance, manager/team | Self-service APIs and field permissions |
| 2 | S7 Manager Cockpit | Capacity, skill coverage, approval queue, approve/reject/reroute | Hierarchy, delegation, leave, skills |
| 3 | S2 HR Operations | Daily muster, joiners/exits, SLA approvals, onboarding funnel, absence/request trends | Attendance, lifecycle, inbox taxonomy |
| 4 | S5 Payroll Control | Run stages, anomalies, cost variance/mix, approvals | Payroll runs, inputs, anomalies, journal, SoD |
| 5 | S1 People Command | Headcount, attrition, plan/forecast, org health, talent flow, comp positioning | Historical and benchmark data, privacy review |

### Release 2

| Cockpit | Required features | Primary dependency |
|---|---|---|
| S3 Attendance Intelligence | Trends, punctuality, OT, coverage, roster proposal | Policy-approved roster/OT data |
| S4 Talent Acquisition | Funnel, offer loss, candidate experience | Stage history and structured reasons |
| S6 Performance Calibration | Distribution, competency, 9-box, publish | Review/calibration records |
| S9 Learning Intelligence | Capability movement, funnel, hours | Enrollment/evidence history |
| S10 AI Governance | NL analysis, evidence, findings, model/agent register | Approved models/evals/action policy |

Every cockpit implements loading, valid zero, empty, missing history, unavailable source, partial data, stale data, restricted access and recoverable error.

---

## 9. User interaction contracts

### 9.1 Record inspection

Route → stable skeleton → authorized data → select row → detail drawer → optional permitted action → close restores originating focus. Browser Back behaves predictably when drawer/filter state is represented in the URL.

### 9.2 Create/edit

Permission check → form → client guidance → server validation → conflict/version check → save → audit → refresh/focus record. Failed submissions retain safe input and never show success.

### 9.3 Approval

Open context/evidence → display valid transitions → require reason where applicable → state exact consequence → server validates tenant/role/version/SoD → audit → show confirmed state. Undo only for a real reverse transition.

### 9.4 Import

Template/select → upload progress → security scan → column mapping → dry-run summary → authorized confirmation → background status → error file/audit.

### 9.5 Export

Show scope/fields/sensitivity → independent authorization → asynchronous generation when large → short-lived protected download → audit.

### 9.6 AI proposal

Sourced fact/inference/proposal distinction → citations → prefilled standard workflow → user review → normal validation/approval. No direct sensitive mutation.

---

## 10. Data, API and security rules

- Existing services remain domain authorities.
- Dashboard aggregation may compose reads but never replaces domain mutation services.
- Use `/api/v1` conventions.
- Tenant/scope derives from authenticated session, not arbitrary request tenant IDs.
- Widget-level errors may produce a partial dashboard response.
- Metric definitions include owner, formula, source, period, exclusions, privacy threshold and version.
- Cache keys include tenant, permissions, filter set and metric version.
- Sensitive responses use private/no-store or properly scoped caching.
- Harmful duplicate mutations require idempotency/replay protection.
- Audit actor, tenant, target, before/after, reason, request ID and timestamp.
- Add schema only through reviewed Drizzle migrations.
- Legal/payroll/leave/compliance calculations require owner approval and effective versions.
- Small cohorts are suppressed/grouped.
- Exports have separate permissions.
- Admin impersonation, if approved, is explicit, time-bound, bannered and audited.

Recommended dashboard response shape:

```json
{
  "data": {
    "view": "s2",
    "scope": { "tenantId": "server-resolved", "siteIds": [] },
    "generatedAt": "ISO-8601",
    "freshness": "live|cached|stale|partial",
    "widgets": {},
    "unavailableSources": []
  },
  "requestId": "..."
}
```

---

## 11. Accessibility, responsive and performance acceptance

### Accessibility

- WCAG 2.2 AA contrast.
- Visible focus in both themes.
- 40×40px targets; 44×44px mobile primary.
- Logical headings and skip link.
- Dialog focus trap/restore.
- Screen-reader names for icon buttons.
- Live announcements for async status.
- Table headers/captions/sort state.
- Chart summary and data-table alternative.
- Color never sole status cue.
- Keyboard alternative for drag/gesture.
- Reduced motion globally.
- 200% zoom retains essential controls.

### Responsive

- Verify 320, 375, 768, 1024, 1280, 1440 and 1920px.
- Mobile filters open in a sheet.
- Tables use priority columns/cards or controlled horizontal scroll.
- Drawers become full-screen.
- Kanban shows one status column at a time.
- Charts stack with summary first.
- Forms become one column with safe sticky submit.

### Performance

- Launcher opens entirely from local catalogue data.
- Charts load only for active cockpit.
- Heavy chart packages dynamically import.
- Avoid N+1 dashboard requests.
- Cancel stale search/filter requests.
- Stable skeleton dimensions prevent layout shift.
- Target LCP <2.5s and INP <200ms at p75.
- No continuous decorative animation/pointer tracking.

---

## 12. Authoritative task backlog

Status notation: `[ ]` not started, `[-]` in progress, `[x]` complete, `[!]` blocked.

### EPIC 0 — Approval and inventory

- [ ] **P0-01 Approve this master plan** — Product, Design and Engineering sign off on single-source status.
- [ ] **P0-02 Approve module taxonomy** — Confirm domain labels, destination names and future exclusions.
- [ ] **P0-03 Select Release 1 cockpits** — Confirm S8, S7, S2, S5, S1 order.
- [x] **P0-04 Inventory current routes/components/services** — Existing Next routes, shared components, API contracts and permission sources mapped before refactor.
- [ ] **P0-05 Define metric ownership** — Owner/formula/source/freshness/privacy for Release 1.
- [ ] **P0-06 Obtain regulated-rule approval** — HR/payroll/legal owners approve displayed/executed rules.
- [ ] **P0-07 Confirm theme scope** — Approve launching light and dark together.

Exit: no Release 1 feature depends on unnamed data or unapproved policy.

### EPIC 1 — Design-system foundation

- [x] **DS-01 Bundle Montserrat and Lato** — Self-hosted by `next/font`; production build verified.
- [x] **DS-02 Implement semantic light/dark tokens** — Approved teal/navy/slate, semantic and chart tokens implemented.
- [x] **DS-03 Remove hard-coded shell/dashboard colors** — Active shell and dashboard migrated to semantic tokens.
- [x] **DS-04 Remove cyber/neon styling** — Glow, scan, animated grid and excessive gradient neutralized or removed from active surfaces.
- [-] **DS-05 Update shared UI components** — Buttons, cards and active HRMS surfaces migrated; full table/input/tooltip state audit remains.
- [x] **DS-06 Implement typography scale** — HRMS UI migrated to an 11px minimum with Montserrat headings/navigation and Lato body/data.
- [ ] **DS-07 Validate contrast** — Automated and manual in both themes.
- [ ] **DS-08 Add visual regression baselines** — Core components and existing routes.

Exit: all existing pages use the approved foundation without behavioral regression.

### EPIC 2 — Navigation catalogue and launcher

- [x] **NAV-01 Create canonical catalogue** — Route, domain, copy, aliases, status and permissions.
- [x] **NAV-02 Refactor existing sidebar/search to catalogue** — Persistent left rail, contextual right rail, launcher and global module search share one catalogue.
- [x] **NAV-03 Build desktop dual-pane launcher** — 280px domain pane, responsive destination pane and computed counts.
- [x] **NAV-04 Build tablet/mobile launcher** — Full-screen two-step domain/destination flow.
- [x] **NAV-05 Integrate module search** — Catalogue matches are merged into authorized global search; launcher has local search.
- [x] **NAV-06 Add keyboard/focus semantics** — Shortcut, arrows, native activation, Escape and Base UI focus trap/restore.
- [x] **NAV-07 Add unavailable/permission handling** — Unauthorized and non-ready destinations are omitted.
- [ ] **NAV-08 Add navigation analytics** — No sensitive payloads.
- [-] **NAV-09 Unit and E2E tests** — Catalogue/shell unit tests and unauthenticated desktop/mobile smoke tests pass; authenticated focus/history flow awaits smoke credentials.

Exit: every authorized current route is discoverable, deep-linkable and keyboard accessible.

### EPIC 3 — Shell variants

- [x] **SHELL-01 Unify route shells** — Dashboard and operational routes retain the same persistent desktop navigation.
- [x] **SHELL-02 Build persistent primary navigation** — 184px desktop rail containing only the five permitted domains; domain selection controls the right-side module list.
- [ ] **SHELL-03 Implement contextual tabs** — URL-aware with overflow/mobile behavior.
- [x] **SHELL-04 Build responsive module/intelligence rail** — Selected-domain routes and work tools in a full-height, scroll-correct 272px wide-desktop column plus a focus-managed drawer below 1280px.
- [x] **SHELL-05 Refine responsive header** — Priority order, 40px controls and mobile module/search access implemented.
- [-] **SHELL-06 Verify scroll/focus/layering** — Base UI dialog/sheet behavior and production build pass; authenticated manual matrix remains.
- [-] **SHELL-07 Regression test existing utilities** — Static/unit checks pass; authenticated search, notification, workspace switch and logout browser flow remains.

Exit: dashboard and module routes keep both desktop rails visible without lost functionality or content overlap.

### EPIC 4 — Shared module patterns

- [x] **CMP-01 Module page header** — Shared `PageIntro` migrated to the approved header anatomy and typography.
- [ ] **CMP-02 Contextual tabs**.
- [ ] **CMP-03 Filter bar and mobile filter sheet**.
- [x] **CMP-04 Metric card/strip states** — Value and genuinely-missing states use shared, toned components.
- [ ] **CMP-05 Data table states and accessibility**.
- [ ] **CMP-06 Detail drawer with URL/focus behavior**.
- [ ] **CMP-07 Task dialog and confirmation variants**.
- [ ] **CMP-08 Wizard/import framework**.
- [ ] **CMP-09 Timeline and audit presentation**.
- [ ] **CMP-10 Approval panel**.
- [ ] **CMP-11 File upload/scan states**.
- [ ] **CMP-12 Chart panel and data alternative**.
- [-] **CMP-13 Empty/partial/error/restricted primitives** — Existing dashboard and workspace states standardized; reusable restricted/stale variants remain.

Exit: patterns are documented, tested and reusable before broad module migration.

### EPIC 5 — Existing module migration

- [ ] **MOD-01 Dashboard/personal work** — Inbox, assistant, notifications, focus and announcements.
- [ ] **MOD-02 People core** — Directory, profile, documents, history and create.
- [ ] **MOD-03 Organization** — Explorer, departments, reporting lines, positions and history.
- [ ] **MOD-04 Lifecycle** — Pipeline, checklist, documents, assets, letters, probation and exit.
- [ ] **MOD-05 Engagement** — Surveys, trends, recognition and approved wellbeing resources.
- [ ] **MOD-06 Attendance** — Punch, calendar, trace, corrections, team, rosters and OT.
- [ ] **MOD-07 Leave/COFF** — Balances, apply, requests, approvals, ledger and policy.
- [ ] **MOD-08 Payroll** — Runs, inputs, calculation, anomalies, approval, journal, slips and finalize.
- [ ] **MOD-09 Loans/advances** — Summary, application, review, repayment and approved advances.
- [ ] **MOD-10 Compensation** — Rewards, bands, changes, benefits and history.
- [ ] **MOD-11 Talent acquisition** — Requisitions, pipeline, applications, interviews and offers.
- [ ] **MOD-12 Performance** — Cycles, goals, reviews, feedback, calibration and publish.
- [ ] **MOD-13 Learning** — Enrollments, catalogue, assignments, certificates and skills.
- [ ] **MOD-14 Insights** — Definitions, snapshots, runs, analysis and exports.
- [ ] **MOD-15 Compliance** — Obligations, evidence, controls, filings and analytics.
- [ ] **MOD-16 Integrations** — Connectors, runs, webhooks, keys and inbound mappings.
- [-] **MOD-17 VP readiness** — Summary and all 11 command workflows use guided, action-specific fields with inline validation, idempotency and audit messaging; expanded gate evidence and history presentation remain.
- [ ] **MOD-18 Settings/access** — Tenant, members, roles, policies, notifications, audit and security.
- [ ] **MOD-19 Platform admin** — Tenants, health, jobs, flags and access review.

Each task includes real services, every state, responsive behavior, accessibility, audit and tests. Future contract workforce, projects/timesheets and dedicated helpdesk are excluded.

### EPIC 6 — Dashboard framework

- [ ] **DASH-01 URL-based cockpit selection**.
- [ ] **DASH-02 Permission-aware cockpit selector/default**.
- [x] **DASH-03 Shared KPI/chart/queue/filter/freshness primitives** — Existing live dashboard migrated to shared enterprise presentation.
- [x] **DASH-04 Partial-data aggregation contract** — Existing unavailable-source and missing-value behavior preserved and visually standardized.
- [ ] **DASH-05 Metric definition/provenance presentation**.
- [ ] **DASH-06 Chart accessibility alternatives**.
- [ ] **DASH-07 Dashboard performance/instrumentation**.
- [ ] **DASH-08 Feature flags per cockpit**.

Exit: one live cockpit works end-to-end in every state.

### EPIC 7 — Release 1 cockpits

- [ ] **S8 Employee Home** — Self-service scope and workflows.
- [ ] **S7 Manager Cockpit** — Team capacity, skills and approvals.
- [ ] **S2 HR Operations** — Daily operations and SLA queue.
- [ ] **S5 Payroll Control Room** — Run/anomaly/reconciliation control.
- [ ] **S1 People Command Centre** — Approved executive analytics.

For every cockpit: approve metrics → implement services/API → build UI → drill-down → reconcile data → permission/privacy test → accessibility/performance test → pilot approval.

### EPIC 8 — Release 2 cockpits

- [ ] **S3 Attendance Intelligence**.
- [ ] **S4 Talent Acquisition Command**.
- [ ] **S6 Performance Calibration**.
- [ ] **S9 Learning Intelligence**.
- [ ] **S10 AI Governance**.

### EPIC 9 — QA, rollout and cleanup

- [-] **QA-01 Functional route/workflow regression** — 720 tests pass; authenticated browser workflow sweep awaits smoke credentials.
- [ ] **QA-02 Tenant and permission attack matrix**.
- [-] **QA-03 Responsive device/zoom matrix** — Desktop Chrome and Pixel 7 unauthenticated smoke pass; authenticated routes and 200% zoom remain.
- [-] **QA-04 Keyboard/screen-reader/axe testing** — Launcher keyboard semantics and focus-managed primitives implemented; screen-reader/axe audit remains.
- [ ] **QA-05 Data reconciliation and zero-vs-missing checks**.
- [ ] **QA-06 Performance and memory testing**.
- [-] **QA-07 Light/dark visual regression** — Dark login screenshots captured; full route/theme baselines remain.
- [ ] **REL-01 Internal admin rollout**.
- [ ] **REL-02 Pilot-tenant rollout**.
- [ ] **REL-03 Metrics/error review and fixes**.
- [ ] **REL-04 General availability approval**.
- [-] **CLEAN-01 Remove superseded styles/code/adapters** — Active neon effects removed and duplicate navigation deleted; final dead-style/component audit remains.
- [x] **CLEAN-02 Update support and operational documentation** — This authoritative plan records delivered frontend scope, verification and deferrals.

---

## 13. Implementation checkpoint — 12 September 2026

Delivered in the frontend foundation change:

- Montserrat and Lato through `next/font`, with no browser-side font CDN dependency.
- Approved professional light/dark semantic, state and chart tokens.
- Canonical permission-aware navigation catalogue and compatibility export.
- Dual-pane desktop launcher, full-screen two-step mobile launcher, local search, computed counts and keyboard navigation.
- Unified shell with a persistent 184px domain-only left navigation on desktop routes.
- Persistent 272px selected-domain module/intelligence rail on wide desktop and a focus-managed responsive drawer below 1280px.
- Compact 56px title bar with flexible search and restored theme switching.
- Viewport-right account placement above the module/intelligence rail.
- Tenant-scoped memory restores the last authorized module visited in each left-side domain.
- Redundant governed-assistant shortcut removed; Ask Mira is fixed at the bottom of the right rail.
- VP Readiness raw JSON command console replaced with a guided operation selector, action-specific fields, required/UUID/email validation, safe optional-field handling and plain-language outcomes.
- People Core desktop layout contained to the application viewport: the directory and dossier regions own their scrolling and no longer extend the page/right rail with blank space.
- People directory status column removed; the compact Active/Inactive tag is shown only beside the selected employee name.
- Employee dossier action connected to a focus-managed, permission-filtered detail sheet backed by the existing single-employee endpoint.
- Add Person basic salary accepts zero or a positive amount only, with native input constraints, client validation and the existing server-side minor-unit guard.
- Constant-height Modules launcher whose size does not jump as its contents change.
- Responsive priority header and catalog-backed global module search.
- Toned shared page headers, cards, KPIs, statuses, charts, login and security surfaces.
- 11px minimum for routine HRMS interface copy; no active neon grid, scan line or glow treatment.
- Navigation/shell regression tests and updated mobile Playwright flow.

Verification completed:

- `npm run typecheck` — pass.
- changed-frontend ESLint scope — pass.
- `npm run test` — 69 files passed, 720 tests passed, 17 files/21 tests skipped by their existing environment gates.
- `npm run build` — pass, 28 static pages generated.
- Playwright product smoke — desktop/mobile login and unauthenticated redirect pass; authenticated tests skipped because `MKRAFT_SMOKE_PASSWORD` is not configured.
- `git diff --check` — pass.

Repository-wide `npm run lint` is not currently a valid clean gate because unrelated, untracked `scripts/seeder/*` files contain existing `any`, unused-variable and `prefer-const` findings. Those user-owned backend/data scripts are excluded from this frontend change and commit.

**Database/backend impact:** none. No schema, migration, API route, domain service, authorization rule or response contract changed. The next cockpit/module tasks that require new metrics or workflow behavior remain unticked until product, data, policy and backend dependencies are approved.

---

## 14. Waiting-on register

| ID | Decision/input | Owner | Blocks |
|---|---|---|---|
| W-01 | Approve this master as authoritative | Product + Engineering | Cockpit scope and general release |
| W-02 | Final visual sign-off for both themes | Design | DS completion |
| W-03 | Confirm module labels/grouping | Product + Design | Navigation |
| W-04 | Confirm Release 1 cockpits | Product | Dashboard delivery |
| W-05 | Metric definitions/data owners | Data + Business owners | Individual widgets |
| W-06 | Payroll/leave/OT/statutory policies | HR/Payroll/Legal | Regulated UI/actions |
| W-07 | Privacy/small-cohort policy | Security/Privacy | Executive analytics |
| W-08 | Chart implementation choice | Frontend Architecture | Advanced visualizations |
| W-09 | Future-module decisions | Product | Contractors/projects/helpdesk |

---

## 15. QA and release gates

Release requires:

- [ ] Approved information architecture and module copy.
- [ ] Approved visual system in light and dark.
- [ ] No unauthorized route/API access.
- [ ] No cross-tenant data access.
- [ ] Every released metric reconciled and defined.
- [ ] Regulated logic approved by its owner.
- [ ] Loading, zero, empty, partial, stale, restricted and error states tested.
- [ ] Keyboard and screen-reader journeys pass.
- [ ] Responsive matrix and 200% zoom pass.
- [ ] Lint, typecheck, unit, service, route and E2E tests pass.
- [ ] Performance targets pass on pilot data volume.
- [ ] Feature flags and rollback instructions verified.
- [ ] No sample data appears as production data.
- [ ] No dead or future module appears as clickable navigation.
- [ ] Pilot tenant approves data and workflows.

---

## 16. Definition of complete

The programme is complete when:

1. The visual system is calm, professional and consistent across every released route.
2. All users can discover authorized work through the launcher, search and persistent permission-aware navigation.
3. Every module follows the shared component and interaction contracts.
4. Released dashboards use real, explainable and permission-scoped data.
5. Every mutation is server validated, conflict safe and audited.
6. Accessibility, responsiveness, tenancy, privacy and performance gates pass.
7. Future/unapproved products remain clearly excluded.
8. This file accurately reflects the shipped product and completed tasks.
