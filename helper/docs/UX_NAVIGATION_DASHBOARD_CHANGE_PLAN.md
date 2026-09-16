# Nucleus HRMS — UX, Navigation and Dashboard Change Plan

**Status:** Proposed implementation baseline
**Document type:** Product plan, UX specification, developer handoff and QA checklist
**Applies to:** `mkraft-hrms` Next.js application
**Primary scope:** Visual-system refinement, dual-pane navigation, responsive application shell, full-width dashboard architecture and staged role-cockpit delivery
**Source material:** The six designer blueprints supplied in `dual_pane_navigation_layout_specification`
**Important:** The source documents are design inputs, not executable implementation instructions. This plan reconciles them with the current application.

---

## 1. Executive decision

The product will adopt the designer's core experience direction:

- a calmer, professional B2B visual language;
- Montserrat and Lato typography;
- a route-aware dual-pane module launcher;
- a full-width, rail-free dashboard;
- compact navigation inside operational modules;
- role-appropriate dashboard views;
- real, permission-scoped data with explicit loading, empty and unavailable states;
- safe, audited server workflows for consequential actions.

The product will not adopt the designer documents' proposed Prisma schema, NextAuth/JWT architecture, client-only `activeTab` router, unverified file paths, fake dashboard values, or client-side simulations of payroll, attendance, approvals and authorization.

### 1.1 Final design character

The target character is **calm enterprise intelligence**:

- confident rather than futuristic;
- data-dense without looking crowded;
- restrained color rather than neon saturation;
- clear hierarchy rather than decorative glow;
- purposeful motion rather than springy or playful animation;
- direct, operational language rather than marketing-heavy labels.

### 1.2 Non-negotiable technical constraints

- Preserve Next.js App Router and canonical URL navigation.
- Preserve Drizzle ORM, Better Auth, tenant isolation and current migrations.
- Preserve the `/api/v1` contract family unless an endpoint is intentionally versioned.
- Server authorization remains authoritative for every read and mutation.
- Never display invented HR, payroll, compliance or executive metrics as real data.
- No high-impact action may be represented as successful until the server confirms it.
- All additions must work in light and dark themes.
- WCAG 2.2 AA is the accessibility target.
- Existing unrelated application behavior must remain functional during rollout.

---

## 2. Current product baseline

The present application already includes:

- a 244px desktop sidebar;
- a 64px global header;
- authenticated global search;
- notification and workspace controls;
- a 292px intelligence rail on wide screens;
- mobile navigation and an on-demand mobile intelligence drawer;
- canonical routes such as `/people`, `/attendance`, `/leave`, `/payroll` and `/settings`;
- permission-filtered navigation;
- a live-data command centre;
- Drizzle/PostgreSQL persistence;
- Better Auth sessions and multi-tenant membership context;
- domain services and versioned API routes.

The existing implementation is the integration base. The proposed experience must be layered onto it rather than recreated as a second application shell.

---

## 3. Scope and exclusions

### 3.1 In scope

- Typography migration to Montserrat and Lato.
- Professional B2B color-token system.
- Removal of hard-coded presentation colors from product components.
- Application shell variants for dashboard and operational modules.
- Dual-pane module launcher and its mobile equivalent.
- Unified navigation catalogue and permission-aware route mapping.
- Global header refinements.
- Contextual module navigation.
- Dashboard view selection and staged S1–S10 cockpit delivery.
- Shared dashboard cards, charts, queues and operational widgets.
- Loading, empty, error, partial-data and access-denied states.
- Keyboard navigation, focus management and reduced-motion behavior.
- Responsive behavior from 320px mobile through large desktop.
- API aggregation where required for dashboards.
- Analytics, audit, performance and QA requirements.

### 3.2 Explicitly out of scope until separately approved

- Replacing Drizzle with Prisma.
- Replacing Better Auth with NextAuth.
- Replacing URL routing with a client-only tab state machine.
- Implementing statutory rules solely from the designer documents.
- Automatic bank-file release or payroll disbursement.
- Unreviewed employee termination or compensation mutation by AI.
- Production roster changes without preview and human approval.
- A role simulator exposed to ordinary production users.
- Fake forecast, attrition, pay-equity or model-governance data.
- New contractor, project, chat or helpdesk products without product/data acceptance.

---

## 4. Final information architecture

### 4.1 Navigation model

```text
Global header
├── Brand / Home
├── Global search
├── Modules launcher
├── Dashboard view selector (when permitted)
├── Quick create/action menu (permission filtered)
├── Notifications
└── Account and workspace menu

Dashboard route
└── Full-width dashboard; no persistent left or right rail

Operational module route
├── Compact 72px left rail on large desktop
├── Main module workspace
├── Contextual tabs in module header
└── Intelligence drawer opened on demand

Modules launcher
├── Left pane: domains
└── Right pane: authorized destinations for selected domain
```

### 4.2 Canonical route mapping

| Planned destination | Canonical route | Current disposition | Launcher domain |
|---|---|---|---|
| Command centre | `/` | Existing | Dashboard |
| My inbox | `/inbox` | Existing | Dashboard |
| Mira assistant | `/assistant` | Existing | Insights & AI |
| People core | `/people` | Existing | Core HR |
| Organization | `/organization` | Existing | Core HR |
| Lifecycle and onboarding | `/onboarding` | Existing | Core HR |
| Engagement and experience | `/engagement` | Existing | Core HR |
| Time office and attendance | `/attendance` | Existing | Workforce Operations |
| Leave and COFF | `/leave` | Existing | Workforce Operations |
| Payroll | `/payroll` | Existing | Payroll & Finance |
| Loans and advances | `/loans` | Existing | Payroll & Finance |
| Performance | `/performance` | Existing | Talent & Growth |
| Talent acquisition | `/talent` | Existing | Talent & Growth |
| Learning | `/learning` | Existing | Talent & Growth |
| Compensation | `/compensation` | Existing | Payroll & Finance |
| People intelligence | `/insights` | Existing | Insights & AI |
| Compliance | `/compliance` | Existing | Platform & Governance |
| Integrations | `/integrations` | Existing | Platform & Governance |
| VP readiness | `/readiness` | Existing | Platform & Governance |
| Settings and access | `/settings` | Existing | Platform & Governance |
| Platform administration | `/platform` | Existing; entitled users only | Platform & Governance |
| Contract workforce | Not approved | Exclude from launcher until route and ownership exist | Workforce Operations |
| Projects and timesheets | Not approved | Exclude until route, service and permission model exist | Workforce Operations |
| Dedicated helpdesk | Not approved | Keep assistant/inbox destinations; do not invent a route | Core HR |

### 4.3 Catalogue rules

- The navigation catalogue is the single source of truth for header search, compact rail, mobile menu and dual-pane launcher.
- Every catalogue entry contains `id`, `label`, `description`, `href`, `domain`, `icon`, `keywords`, `requiredPermissions`, `status` and optional `badge`.
- Counts are computed from visible entries; never hard-code “43 modules” or similar marketing counts.
- Unauthorized entries are omitted, not disabled, unless showing the entry has a clear access-request purpose.
- Planned but unavailable modules do not appear as clickable cards.
- Aliases such as “ATS”, “recruitment” and “talent acquisition” resolve to the same canonical route.
- Links use Next.js routing and preserve browser history, refresh behavior and deep linking.

---

## 5. Visual design system

## 5.1 Color direction

The current bright teal, cyan, violet, amber and coral treatments will be desaturated. Glows, luminous gradients and high-chroma accents will be removed from routine UI.

### Light-theme foundation

| Token | Value | Usage |
|---|---:|---|
| `color-canvas` | `#F4F7F8` | Application background |
| `color-surface` | `#FFFFFF` | Cards, panels and menus |
| `color-surface-subtle` | `#F8FAFB` | Secondary sections and table headers |
| `color-surface-selected` | `#E9F1F0` | Selected rows and soft primary background |
| `color-text-primary` | `#17232B` | Headings and primary content |
| `color-text-secondary` | `#4E5D68` | Body copy and supporting values |
| `color-text-muted` | `#6E7C86` | Metadata, placeholders and hints |
| `color-border` | `#D8E0E4` | Standard borders |
| `color-border-strong` | `#BBC8CE` | Emphasized boundaries and focused groupings |
| `color-primary` | `#2F6F68` | Primary actions, active navigation and links |
| `color-primary-hover` | `#275E58` | Primary hover |
| `color-primary-pressed` | `#204E49` | Primary pressed |
| `color-primary-soft` | `#E6F0EE` | Primary tint backgrounds |
| `color-focus` | `#315F7D` | Keyboard focus ring |

### Dark-theme foundation

| Token | Value | Usage |
|---|---:|---|
| `color-canvas` | `#0F1519` | Application background; charcoal navy, not pure black |
| `color-surface` | `#171F24` | Primary cards and navigation surfaces |
| `color-surface-raised` | `#1D272D` | Menus, dialogs and elevated cards |
| `color-surface-selected` | `#203330` | Selected rows and active navigation |
| `color-text-primary` | `#E7ECEF` | Headings and primary content |
| `color-text-secondary` | `#B8C2C8` | Body copy |
| `color-text-muted` | `#8D9AA3` | Metadata and placeholders |
| `color-border` | `#303D45` | Standard borders |
| `color-border-strong` | `#46555F` | Emphasized boundaries |
| `color-primary` | `#78AAA3` | Primary accent |
| `color-primary-hover` | `#8BB9B3` | Primary hover |
| `color-primary-pressed` | `#679A93` | Primary pressed |
| `color-primary-soft` | `#203330` | Primary tint backgrounds |
| `color-focus` | `#78A3BF` | Keyboard focus ring |

### Semantic colors

| Meaning | Main | Soft background | Guidance |
|---|---:|---:|---|
| Success | `#3F745F` | `#E8F1EC` | Completed, healthy, verified |
| Information | `#496D8C` | `#E9EFF4` | Neutral system information |
| Warning | `#916F36` | `#F5F0E6` | Pending, approaching SLA, review needed |
| Danger | `#A65353` | `#F6EAEA` | Failed, blocked, destructive |
| AI/Insight | `#6E6685` | `#EFEDF3` | AI content only; not general decoration |

Dark mode uses lighter foreground variants of the same hues while maintaining muted saturation. All semantic states require an icon or label in addition to color.

### Chart palette

| Series token | Light | Intended use |
|---|---:|---|
| `chart-teal` | `#527D78` | Primary/actual series |
| `chart-blue` | `#5C7894` | Comparison/information |
| `chart-olive` | `#71806B` | Stable/supporting category |
| `chart-amber` | `#94784E` | Pending/threshold |
| `chart-plum` | `#776E84` | Modelled/AI series |
| `chart-rose` | `#956A6E` | Risk/negative series |

Chart rules:

- Maximum six categorical colors on one view.
- Use direct labels, line styles, symbols or patterns in addition to color.
- Avoid rainbow heatmaps; use a single-hue scale or neutral-to-semantic scale.
- Reserve danger red for values that genuinely require action.
- Gridlines use the border token at 60% opacity.
- Tooltips use the raised surface, 8px radius and no glow.
- Forecast bands must be labelled “forecast” with confidence and source date.

## 5.2 Typography

Only Montserrat and Lato are used in normal product UI.

- **Montserrat:** headings, navigation labels, buttons, KPI labels and short section titles.
- **Lato:** body copy, table content, form controls, values, helper text, timestamps and long labels.
- Technical identifiers also use Lato with `font-variant-numeric: tabular-nums`; a third monospace family is not introduced.
- Fonts should be self-hosted or bundled through the Next.js font system to prevent layout shift and runtime third-party dependency.

| Token | Family | Size / line | Weight | Usage |
|---|---|---:|---:|---|
| `type-display` | Montserrat | 32 / 40px | 600 | Major dashboard greeting on large screens |
| `type-h1` | Montserrat | 28 / 36px | 600 | Page title |
| `type-h2` | Montserrat | 22 / 30px | 600 | Major section |
| `type-h3` | Montserrat | 18 / 26px | 600 | Card group title |
| `type-h4` | Montserrat | 15 / 22px | 600 | Card title |
| `type-nav` | Montserrat | 13 / 18px | 500 | Navigation and tabs |
| `type-button` | Montserrat | 13 / 18px | 600 | Buttons |
| `type-body` | Lato | 14 / 21px | 400 | Default body |
| `type-body-strong` | Lato | 14 / 21px | 700 | Emphasized body/value |
| `type-table` | Lato | 13 / 20px | 400 | Table cells |
| `type-small` | Lato | 12 / 18px | 400 | Metadata and helper copy |
| `type-caption` | Lato | 11 / 16px | 700 | Compact uppercase labels; sparingly |
| `type-kpi` | Lato | 28 / 34px | 700 | Primary metric values |

Typography rules:

- Routine UI text must not be smaller than 11px.
- Avoid excessive uppercase and wide tracking.
- Avoid ultra-bold weights; 700 is the maximum outside the logo.
- Headings use slight negative tracking only at 22px and above.
- Numeric columns use tabular numerals and right alignment.
- Long names and translated labels must not depend on fixed character width.

## 5.3 Spacing, radii and depth

Spacing uses a 4px base: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Element | Final rule |
|---|---|
| Button height | 36px compact, 40px default, 44px mobile primary |
| Input height | 40px desktop, 44px mobile |
| Card padding | 16px compact, 20px default, 24px prominent |
| Grid gap | 12px compact, 16px tablet, 20px desktop |
| Standard radius | 8px |
| Dialog/card radius | 10px |
| Pill radius | 999px only for badges/chips |
| Standard shadow | `0 6px 18px rgba(15, 23, 42, 0.08)` |
| Dialog shadow | `0 20px 50px rgba(15, 23, 42, 0.18)` |

No routine component receives neon bloom, scan lines, animated background grids or spotlight-follow effects. Elevation is communicated through surface tone, border and a restrained shadow.

---

## 6. Responsive application shell

### 6.1 Breakpoints

| Range | Name | Shell behavior |
|---:|---|---|
| `320–639px` | Mobile | 56px header, no persistent rails, full-screen launcher |
| `640–1023px` | Tablet | 60px header, no persistent rails, overlay navigation |
| `1024–1279px` | Compact desktop | 64px header, optional 72px compact rail on module pages |
| `1280–1599px` | Desktop | 64px header, 72px module rail, main workspace |
| `1600px+` | Wide desktop | Same shell; dashboard content capped at 1680px with centered gutters |

### 6.2 Dashboard shell

- Header remains visible and sticky.
- Left navigation and right intelligence rail are not mounted as persistent layout columns.
- Dashboard content width is `min(1680px, 100%)` with 24px desktop gutters and 16px tablet gutters.
- Dashboard uses a 12-column grid on desktop, 8 columns on tablet and 4 columns on mobile.
- The Modules button is always visible because the dashboard has no persistent navigation.
- Intelligence opens as a non-blocking drawer from the right, never as reserved dashboard width.
- The main content starts immediately below the header and retains normal document scrolling.

### 6.3 Operational-module shell

- Large desktop shows a 72px icon rail containing Home, Modules and authorized domain shortcuts.
- Hover does not expand the rail and reflow content.
- Each icon has a tooltip and accessible name.
- Module-specific destinations appear as horizontal tabs or an overflow menu below the page title.
- Intelligence remains an on-demand 360px drawer.
- Tablet and mobile remove the persistent rail and expose navigation through the header.

### 6.4 Header content priority

Desktop order:

1. Brand/Home.
2. Global search.
3. Modules launcher.
4. Dashboard selector when applicable.
5. Flexible spacer.
6. Quick action.
7. Notifications.
8. Intelligence button.
9. Account/workspace menu.

Mobile order:

1. Menu/Modules.
2. Compact brand.
3. Spacer.
4. Search icon.
5. Notifications.
6. Avatar.

Low-priority controls move into overflow; controls must not shrink below a 40px target.

---

## 7. Dual-pane module launcher handoff

### 7.1 Desktop layout

- Dialog width: 960px, maximum `calc(100vw - 48px)`.
- Dialog maximum height: `min(720px, calc(100vh - 48px))`.
- Left pane: 280px.
- Right pane: remaining 680px.
- Dialog surface: raised surface token.
- Backdrop: canvas color at 64% opacity with 6px blur.
- Header: 56px, containing title, optional search and Close.
- Footer: 40px, showing keyboard guidance only on pointer/keyboard desktop devices.
- Pane content scrolls independently only when necessary.

### 7.2 Tablet and mobile

- Tablet dialog uses 16px viewport margins; left pane is 240px.
- Mobile uses a full-screen two-step flow.
- Mobile step 1 lists domains; selecting a domain opens step 2 with a Back control.
- Mobile search may display results across all authorized modules.
- The bottom safe-area inset is respected.

### 7.3 Domain item

Required content:

- 18px icon;
- domain label, maximum two lines;
- computed visible-destination count;
- selection indicator.

States:

- default;
- hover;
- selected;
- keyboard focus;
- disabled only for a visible access-request use case.

Interaction:

- Click selects a domain without navigation.
- Pointer hover previews a domain after 100ms; leaving before 100ms does nothing.
- Keyboard focus changes preview immediately.
- Selection remains stable while the pointer moves into the right pane.

### 7.4 Destination card

Required content:

- icon;
- title, maximum two lines;
- description, maximum 110 characters or three lines;
- optional factual badge such as “Admin only” or “3 pending”;
- directional chevron.

States:

- default;
- hover with 1px lift and stronger border;
- active/pressed;
- keyboard focus;
- loading only when destination metadata is still resolving;
- unavailable cards are omitted rather than presented as dead links.

Selecting a card closes the dialog and navigates to its canonical `href`. Focus restoration is skipped when navigation moves to a new document view; otherwise focus returns to the launcher button.

### 7.5 Search behavior

- Search is permission scoped.
- Search covers label, aliases, description and domain.
- Results start after one character for local catalogue matching.
- Existing authorized record search begins at two characters and keeps its debounce/network behavior.
- Module results are visually separated from people/documents/tasks.
- Up to eight results display before scrolling.
- No result state says: “No accessible results for ‘query’.”
- Search text is cleared after successful navigation.

### 7.6 Keyboard and accessibility behavior

- `Ctrl/Cmd + M`: open launcher; repeat closes it.
- `Ctrl/Cmd + K`: focus/open global search.
- `Escape`: close launcher.
- Up/Down: move through domains or a card column.
- Left/Right: move between domain pane and card grid.
- Home/End: first/last item in active collection.
- Enter/Space: select.
- Tab/Shift+Tab: remain trapped inside the modal.
- Dialog has `aria-modal="true"`, an accessible title and description.
- Selected domain uses `aria-selected`; grid semantics must match actual keyboard behavior.
- Opening and result-count changes are announced politely.

### 7.7 Motion

| Element | Trigger | Motion | Duration | Easing |
|---|---|---|---:|---|
| Backdrop | Open/close | Opacity | 140ms | ease-out |
| Dialog | Open | Opacity + 6px upward settle | 160ms | cubic-bezier(.2,.8,.2,1) |
| Domain row | Hover/select | Background/border | 120ms | ease-out |
| Card | Hover | 1px lift + border | 120ms | ease-out |
| Card collection | Domain change | Crossfade; no bounce | 140ms | ease-out |

Reduced-motion mode removes translation and uses near-instant opacity changes.

---

## 8. Global header and utility features

### 8.1 Brand/Home

- Clicking returns to `/`.
- Logo treatment removes neon shadow.
- Product name uses Montserrat 600.
- Secondary “Workforce OS” copy is removed unless product explicitly approves it.

### 8.2 Global search

- Retain authorized remote search.
- Add module and cockpit destinations from the shared catalogue.
- Desktop field width: 320–520px depending on viewport.
- Mobile uses a dedicated full-screen search surface.
- Display loading, no-results, partial-error and offline states.
- Search result selection must expose its destination type and context.

### 8.3 Quick action menu

- Actions are permission filtered.
- Default candidates: add person, record attendance, request leave, open payroll action, create announcement.
- Do not expose an action merely because its page is readable.
- Each mutation opens its existing validated workflow rather than performing instantly from the menu.

### 8.4 Notifications

- Retain unread count and mark-as-read server behavior.
- Unread is indicated by weight/icon plus color.
- Panel width: 360px desktop; full-width sheet mobile.
- Maximum initial list: eight; provide “Open inbox”.
- Failure to mark as read retains the unread state and announces the failure.

### 8.5 Account/workspace menu

- Retain real workspace membership switching.
- Do not convert this into the designer's production role simulator.
- Show current workspace, user name, role summary, security link and sign out.
- Workspace switch shows progress, prevents duplicate submission and handles failure without losing the current workspace.

---

## 9. Dashboard framework

### 9.1 Shared dashboard anatomy

Every cockpit follows this order:

1. Page title, scope, freshness and primary filters.
2. Optional role-relevant quick actions.
3. KPI strip.
4. Primary decision-support visualization.
5. Supporting breakdowns.
6. Action or exception queue.
7. Shared daily operational widgets where relevant.
8. Data-source and refresh metadata.

### 9.2 Dashboard selector

- The URL is authoritative, using a stable query or segment such as `/?view=s1`.
- The selector lists only authorized views.
- The default view comes from server-resolved role/permission policy.
- An invalid or unauthorized view returns the user's default view and a clear access message.
- Selection survives refresh and can be shared as a URL if the recipient has permission.
- Cockpit labels use descriptive names; codes S1–S10 are secondary metadata.

### 9.3 Shared card states

Every dashboard component must implement:

- loading skeleton matching final dimensions;
- valid data;
- empty data with explanation and next action;
- source unavailable;
- partial data with unavailable-source names;
- stale data with last successful refresh;
- access restricted;
- recoverable error with Retry;
- destructive/action failure where applicable.

`0`, `null`, missing and unavailable are distinct states. Missing metrics never render as zero.

### 9.4 KPI card specification

- Minimum width: 180px desktop; two-up on mobile where content permits.
- Label: Montserrat 12/18, 600.
- Value: Lato 28/34, 700, tabular numerals.
- Context line: Lato 12/18.
- Delta always identifies period and direction.
- Tooltip defines calculation, time range and source.
- No decorative glow or unlabelled color-only trend.

---

## 10. Role cockpit feature plan

### 10.1 S1 — People Command Centre

Purpose: executive workforce health and planning.

- [ ] Active headcount with source date.
- [ ] Annualized attrition with documented formula and minimum history requirement.
- [ ] Compa-ratio only when normalized compensation benchmark data exists.
- [ ] Organization-health score only after product approves dimensions and weighting.
- [ ] Organization-health radar with accessible table alternative.
- [ ] Actual, plan and forecast headcount series.
- [ ] Forecast confidence band and model/version metadata.
- [ ] Talent inflow/outflow visualization; use Sankey only when it improves comprehension.
- [ ] Attrition by function with minimum cohort/privacy suppression.
- [ ] Pay-position vs performance plot with restricted access.
- [ ] Function/location heatmap with small-cohort protection.
- [ ] Drill-downs preserve filter scope.

Dependencies: employee history, exit reasons, approved workforce plan, compensation benchmarking, performance ratings and privacy policy.

### 10.2 S2 — HR Operations Console

Purpose: daily HR operational control.

- [ ] Present, leave, absent/no-record, joining, exits and data-completeness KPIs.
- [ ] Pending approvals ordered by SLA and risk.
- [ ] Approval detail opens existing workflow, never inline unaudited mutation.
- [ ] Onboarding funnel using real lifecycle states.
- [ ] 12-week absence density view.
- [ ] Request-category breakdown from inbox/helpdesk taxonomy.
- [ ] Site/location filter.
- [ ] New-joiner action visible only with create permission.

Dependencies: attendance day states, approvals, onboarding records, lifecycle dates and request categories.

### 10.3 S3 — Attendance Intelligence

Purpose: time-office monitoring and controlled roster remediation.

- [ ] Attendance vs absenteeism trend with consistent denominator.
- [ ] Site punctuality comparison.
- [ ] Overtime by department with configured legal/policy thresholds.
- [ ] Shift-coverage matrix.
- [ ] Roster suggestion preview.
- [ ] Human confirmation, conflict check and audit entry before roster mutation.
- [ ] Explanation for why each suggested assignment is eligible.
- [ ] Time-zone and overnight-shift handling.

Dependencies: attendance ledger, shift definitions, eligibility, leave, rest rules and approved policy configuration.

### 10.4 S4 — Talent Acquisition Command

Purpose: recruitment conversion and candidate experience.

- [ ] Hiring funnel with conversion rates and date-range controls.
- [ ] Offer-to-join waterfall based on structured decline reasons.
- [ ] Candidate-experience score with sample size and collection period.
- [ ] Requisition and role filters.
- [ ] Drill-down to authorized candidate records.
- [ ] No candidate-level AI score without model governance and explanation.

Dependencies: application stage history, offers, joining records, decline reasons and survey data.

### 10.5 S5 — Payroll Control Room

Purpose: controlled payroll-run preparation and review.

- [ ] Run-status stepper backed by server state.
- [ ] Explicit prerequisites for each transition.
- [ ] Period-over-period cost variance bridge.
- [ ] Cost composition.
- [ ] Cost per employee/function with permission controls.
- [ ] Blocking anomaly list.
- [ ] Individual anomaly resolution with reason and audit trail.
- [ ] Bulk resolution only for a homogeneous, reversible, prevalidated group.
- [ ] Maker-checker approval before bank-file generation.
- [ ] Bank release remains a separately protected workflow.

Dependencies: payroll runs, inputs, anomalies, journal, approvals and separation-of-duties policy.

### 10.6 S6 — Performance and Talent Calibration

Purpose: evidence-based calibration with privacy safeguards.

- [ ] Actual rating distribution and approved reference distribution.
- [ ] Competency comparison with calculation definitions.
- [ ] 9-box distribution.
- [ ] Authorized employee drill-down.
- [ ] Adjustment history and required rationale.
- [ ] Calibration-session lock/publish workflow.
- [ ] Accessibility alternative to drag-only interactions.

Dependencies: review cycles, ratings, potential assessment, calibration records and permission policy.

### 10.7 S7 — Manager Cockpit

Purpose: team planning and decision queue.

- [ ] Four-week capacity based on real assignments, leave and training.
- [ ] Skill coverage with evidence freshness.
- [ ] Approval queue scoped to delegated authority.
- [ ] Approve, reject and reroute through existing server workflows.
- [ ] Mandatory remarks for rejection/reroute when policy requires them.
- [ ] Undo only if the underlying workflow supports a reversible transition.
- [ ] 1:1 launcher only after calendar/meeting ownership is defined.

Dependencies: reporting hierarchy, delegation, leave, work allocation, learning and skill evidence.

### 10.8 S8 — Employee Home

Purpose: employee self-service and daily clarity.

- [ ] Today/shift status and punch action.
- [ ] Leave balance by category.
- [ ] Current/latest finalized payslip summary; estimates must be labelled prominently.
- [ ] Quick links to leave, attendance, payroll, performance and organization.
- [ ] Policy assistant with citations and an uncertainty/failure state.
- [ ] Timesheet summary only after the projects/timesheet product is approved.
- [ ] Goals summary.
- [ ] Personal attendance history.
- [ ] Reporting manager and team information.
- [ ] Data limited to self unless additional permission exists.

Dependencies: self-service permissions and the relevant attendance, leave, payroll, policy and organization services.

### 10.9 S9 — Learning and Capability Intelligence

Purpose: learning adoption and verified capability movement.

- [ ] Pre/post capability comparison with identical scales.
- [ ] Assignment-to-application learning funnel.
- [ ] Learning hours by function.
- [ ] Mandatory-course completion and expiry.
- [ ] Evidence/source freshness.
- [ ] Privacy threshold for small teams.

Dependencies: courses, enrollment events, assessments, skill evidence and organizational hierarchy.

### 10.10 S10 — AI and Model Governance

Purpose: transparent AI-system oversight.

- [ ] Natural-language analytics with displayed query scope.
- [ ] Evidence, source and excluded-record disclosure.
- [ ] Saved widget ownership and permission inheritance.
- [ ] Model register with owner, purpose, version, last evaluation and status.
- [ ] Findings queue with severity and review status.
- [ ] Agent action boundary table.
- [ ] Human-approval and reversal requirements.
- [ ] Bias/performance evaluation history.
- [ ] No raw sensitive model features exposed to unauthorized users.

Dependencies: approved models, evaluation records, AI action policy, audit events and privacy review.

---

## 11. Shared operational widgets

### Today's focus

- Personalized, permission-scoped tasks only.
- Completion is server persisted.
- Optimistic UI rolls back on failure.
- Completed items remain recoverable for the current session.
- Priority, due time and source are explicit.

### Company announcements

- Read access follows tenant scope.
- Authoring appears only for authorized roles.
- Pinned, active and expired states are distinct.
- Attachments use authorized download endpoints.
- Long content opens in an accessible dialog/page rather than expanding the dashboard indefinitely.

### Active work/projects

- Omit until the projects domain is approved and backed by current services.
- When added, display only projects visible to the current user.
- Progress must have a defined source and update time.

---

## 12. Functional module checklist

The module redesign is a navigation and visual-system migration first. New business capability is not implied merely by a card appearing in the designer documents.

- [ ] People core retains current directory, permissions, document and profile behavior.
- [ ] Organization retains hierarchy and tenant boundaries.
- [ ] Lifecycle/onboarding retains current state transitions and asset/document rules.
- [ ] Engagement becomes the approved home for experience/recognition features.
- [ ] Attendance retains traceability, transitions and recomputation behavior.
- [ ] Leave and COFF retain ledger-based calculations and policy configuration.
- [ ] Payroll retains staged calculate/approve/finalize controls.
- [ ] Loans and advances remain a distinct current destination.
- [ ] Performance retains review and calibration domain behavior.
- [ ] Talent acquisition retains requisition/application/interview lifecycle.
- [ ] Learning retains course/enrollment behavior.
- [ ] Compensation retains access restrictions and benefit data.
- [ ] People intelligence retains metric-definition and snapshot provenance.
- [ ] Compliance retains evidence and obligation tracking.
- [ ] Integrations retain secret handling, sync status and webhook security.
- [ ] VP readiness remains discoverable under Platform & Governance.
- [ ] Settings retains membership, role and tenant administration.
- [ ] Platform administration remains separately gated.
- [ ] Contract workforce receives no navigation entry until product approval.
- [ ] Projects/timesheets receive no navigation entry until product approval.
- [ ] Dedicated chat/helpdesk receives no navigation entry until product approval.

---

## 13. Data and API architecture

### 13.1 Integration pattern

The dashboards should compose existing domain services. A dashboard aggregation endpoint may be introduced to reduce client round trips, but it does not replace domain APIs.

Recommended read contract:

```json
{
  "data": {
    "view": "s2",
    "scope": { "tenantId": "...", "siteIds": [] },
    "generatedAt": "ISO-8601",
    "freshness": "live|cached|stale|partial",
    "widgets": {},
    "unavailableSources": []
  },
  "requestId": "..."
}
```

Rules:

- Use `/api/v1/...` conventions.
- Scope is resolved from the authenticated session, never trusted from arbitrary client tenant IDs.
- Widget-level errors may return partial data without failing the entire dashboard.
- Every metric defines numerator, denominator, period, inclusion/exclusion and refresh policy.
- Cache keys include tenant, authorization scope, filters and metric version.
- Sensitive dashboard responses use private/no-store or carefully scoped caching.
- Mutations remain in domain endpoints and services.
- All mutation endpoints require idempotency/replay protection where duplicate execution is harmful.
- Audit events record actor, tenant, target, previous state, new state, reason, request ID and timestamp.

### 13.2 No schema replacement

- Extend the current Drizzle schema only through additive, reviewed migrations.
- Never copy the designer's `schema.prisma` into the repository.
- Existing identity tables and tenant relations remain authoritative.
- New analytics tables should prefer metric definitions, versioned snapshots and provenance over denormalized demo payloads.
- Personal/statutory identifiers require encryption/masking and must not enter dashboard payloads unless essential.

### 13.3 Dashboard calculations

Before implementation, each calculated metric needs:

- product owner;
- business definition;
- effective date;
- source tables/events;
- data quality threshold;
- privacy threshold;
- update frequency;
- known exclusions;
- test fixtures;
- reconciliation owner.

Legal, payroll, leave and compliance calculations require policy/legal sign-off. The designer's formulas are examples, not an approved rule pack.

---

## 14. Authorization and safety

- Navigation filtering improves discoverability but is not a security boundary.
- Server routes and services enforce permissions independently.
- Dashboard selection cannot elevate data scope.
- Exports require their own permission and audit event.
- Sensitive compensation, performance and candidate data must be field scoped.
- Small cohorts are suppressed or grouped to reduce re-identification risk.
- Admin impersonation, if introduced, must be explicit, time-bound, bannered and audited.
- Destructive/high-impact actions require confirmation with consequence text.
- Payroll, compensation, termination, bank and identity actions use maker-checker control where applicable.
- AI outputs never directly mutate restricted HR records.
- AI-generated recommendations are visually distinguished from verified system facts.

---

## 15. Content and state specification

### 15.1 Product language

- Use direct labels: “Modules”, “Search”, “Approvals”, “Payroll run”.
- Avoid “elite”, “hyper-responsive”, “zero friction”, “autonomous” and similar promotional wording inside operational UI.
- Use sentence case.
- Show exact time zone when operational deadlines can be ambiguous.
- Use “estimated” and “forecast” in the label, not only the tooltip.
- Buttons state the outcome: “Submit timesheet”, “Approve request”, “Generate preview”.

### 15.2 Loading

- First load uses dimensionally stable skeletons.
- Inline refresh retains previous confirmed data and shows a subtle refreshing status.
- Disable only the affected control, not the entire dashboard.
- A loading state longer than ten seconds presents Retry and request ID if available.

### 15.3 Empty

- Explain whether there are no records, no records for filters, or insufficient history.
- Offer a meaningful next action only when the user is authorized.
- Never replace missing information with sample/demo values.

### 15.4 Errors and partial data

- Widget error: contained within the widget.
- Dashboard-wide error: page-level callout with Retry.
- Partial result: name unavailable sources and affected widgets.
- Mutation failure: retain user input when safe and announce failure.
- Access denied: explain requested area and safe destination; do not reveal sensitive record existence.

### 15.5 Long and international content

- Names truncate only in compact tables and retain full tooltip/accessibility name.
- Card descriptions clamp to three lines.
- Navigation allows two-line labels.
- Tables support horizontal overflow rather than compressing columns below readability.
- Currency and dates use locale-aware formatting.
- Layout tolerates at least 30% longer translated labels.

---

## 16. Accessibility requirements

- WCAG 2.2 AA color contrast for text, controls and focus indicators.
- Visible focus on every interactive element.
- Minimum 40×40px pointer target; 44×44px for primary mobile actions.
- Logical heading hierarchy with one page-level `h1`.
- Skip link to main content.
- Dialog focus trap and focus restoration.
- Screen-reader names for icon-only buttons.
- Live regions for async status and mutation results.
- Charts include summary text and a data table/download alternative where appropriate.
- Color is never the only indication of status or series.
- Tables expose headers, captions and sort state.
- Drag-and-drop interactions have button/keyboard equivalents.
- Reduced-motion preferences are honored globally.
- Zoom at 200% must not hide essential controls or require two-dimensional scrolling outside data tables.

---

## 17. Performance requirements

- Launcher opens from local catalogue data without a network dependency.
- Initial launcher JavaScript target: under 35KB compressed beyond shared UI dependencies.
- Charts load only for the active cockpit.
- Heavy visualization libraries are dynamically imported.
- Do not introduce ECharts merely because the source document names it; choose/reuse the current chart approach based on required chart types and bundle cost.
- Dashboard aggregation prevents N+1 client calls.
- Cancel stale searches and filter requests.
- Preserve stable card dimensions to minimize layout shift.
- Target LCP under 2.5s and INP under 200ms at the 75th percentile on supported production devices.
- Avoid continuous decorative animation and pointer-tracking effects.

---

## 18. Analytics and observability

Track only non-sensitive product events:

- launcher opened/closed;
- launcher opened by button or shortcut;
- domain selected;
- destination selected;
- search used and result type selected;
- cockpit selected;
- widget load failure;
- filter applied;
- workflow launched from dashboard;
- workflow success/failure using anonymized action type.

Never send query text, employee names, salary values, policy questions or record contents to general product analytics. Operational logs use request IDs and approved secure logging.

---

## 19. Implementation file plan

Expected changes are centered in the real application structure:

| Area | Planned action |
|---|---|
| `src/app/layout.tsx` | Bundle Montserrat/Lato and expose font variables |
| `src/app/globals.css` | Replace visual tokens; remove cyber/neon utilities; establish typography and semantic/chart tokens |
| `src/components/hrms/app-shell.tsx` | Add dashboard/module shell variants, header launcher, compact rail and drawer behavior |
| `src/lib/hrms-data.ts` | Migrate navigation data to the new canonical catalogue or re-export it for compatibility |
| `src/lib/navigation-catalog.ts` | New single source of truth for domains, routes, labels, aliases and permissions |
| `src/components/hrms/module-launcher.tsx` | New accessible desktop dual-pane/mobile two-step launcher |
| `src/components/hrms/integrated-right-rail.tsx` | Convert persistent rail behavior to an on-demand intelligence drawer |
| `src/components/hrms/dashboard.tsx` | Adopt full-width dashboard framework and shared cockpit selector/state patterns |
| `src/components/hrms/charts.tsx` | Tokenize colors and add accessible alternatives |
| `src/components/ui/*` | Refine shared button, card, sheet, table, tooltip and input variants |
| `src/app/api/v1/*` | Add only approved aggregation/read contracts and safe domain mutations |
| `src/server/*` | Compose existing domain services; add metric definitions and audited workflow behavior |
| `src/**/*.test.*` and `e2e/*` | Unit, integration, accessibility, permission and responsive tests |

Files named in the designer documents under `Clerio`, `Navigation`, `Dashboard/Views`, `AuthContext` and `HRMSContext` are not implementation destinations unless the current repository is intentionally reorganized in a separate approved refactor.

---

## 20. Delivery phases

### Phase 0 — Product and data alignment

- [ ] Approve this reconciled scope.
- [ ] Confirm final module labels and domain grouping.
- [ ] Confirm which cockpits are required for the first release.
- [ ] Identify owner/source/formula for every first-release metric.
- [ ] Obtain legal/payroll approval for regulated calculations.
- [ ] Decide whether light and dark themes launch together.
- [ ] Record unavailable/future modules explicitly.

Exit criterion: no first-release screen depends on an unnamed data source or unapproved workflow.

### Phase 1 — Design-system foundation

- [ ] Add Montserrat and Lato without layout shift.
- [ ] Implement light/dark token sets.
- [ ] Replace hard-coded colors in shell and dashboard.
- [ ] Remove glow, scan, cyber-grid and over-saturated styling.
- [ ] Update shared UI component states.
- [ ] Run automated and manual contrast checks.
- [ ] Capture baseline visual regression screenshots.

Exit criterion: existing pages render with the approved B2B visual system and no behavior regression.

### Phase 2 — Navigation catalogue and launcher

- [ ] Create canonical catalogue.
- [ ] Map permissions and aliases.
- [ ] Implement desktop dialog.
- [ ] Implement mobile flow.
- [ ] Integrate module search.
- [ ] Implement keyboard/focus behavior.
- [ ] Add analytics events.
- [ ] Add component and E2E tests.

Exit criterion: every authorized current route is reachable, deep links work, and the launcher is fully keyboard accessible.

### Phase 3 — Shell variants

- [ ] Full-width dashboard shell.
- [ ] Compact module rail.
- [ ] Contextual module tabs.
- [ ] On-demand intelligence drawer.
- [ ] Responsive header prioritization.
- [ ] Mobile navigation and search.
- [ ] Verify scroll locking and focus restoration.

Exit criterion: dashboard and operational modules use the correct responsive shell without layout shift or lost navigation.

### Phase 4 — Dashboard framework

- [ ] Dashboard URL/view selection.
- [ ] Authorized selector.
- [ ] Shared KPI, chart, queue and state primitives.
- [ ] Filter and freshness model.
- [ ] Partial-data API pattern.
- [ ] Accessibility alternatives for charts.
- [ ] Performance budgets and instrumentation.

Exit criterion: framework supports one live cockpit end-to-end with every state.

### Phase 5 — First-release cockpits

Recommended sequence:

1. S8 Employee Home.
2. S7 Manager Cockpit.
3. S2 HR Operations.
4. S5 Payroll Control Room.
5. S1 People Command Centre.

- [ ] Approve per-cockpit metric contracts.
- [ ] Implement reads and drill-downs.
- [ ] Integrate existing workflows.
- [ ] Validate privacy/permission boundaries.
- [ ] Reconcile displayed values against source records.
- [ ] Complete role-based E2E tests.

### Phase 6 — Specialist cockpits

- [ ] S3 Attendance Intelligence.
- [ ] S4 Talent Acquisition.
- [ ] S6 Performance Calibration.
- [ ] S9 Learning Intelligence.
- [ ] S10 AI Governance.

Each remains independently releasable behind a feature flag.

### Phase 7 — Cleanup and controlled rollout

- [ ] Remove superseded sidebar styles and unreachable code.
- [ ] Remove temporary compatibility adapters.
- [ ] Update product documentation and support material.
- [ ] Roll out to internal administrators.
- [ ] Roll out to pilot tenants.
- [ ] Compare navigation success/error metrics.
- [ ] Roll back individual features through flags if required.
- [ ] Complete general availability review.

---

## 21. QA matrix

### Functional

- [ ] Every catalogue card reaches the correct URL.
- [ ] Browser Back/Forward works after launcher navigation.
- [ ] Refresh preserves current route and dashboard view.
- [ ] Search returns only authorized records and destinations.
- [ ] Workspace switching refreshes navigation and dashboard scope.
- [ ] Notifications retain current behavior.
- [ ] Dashboard actions open the correct workflows.
- [ ] Failed mutations never display as successful.

### Permission and tenancy

- [ ] Employee cannot retrieve admin/payroll data via direct URL or API.
- [ ] Finance access is field scoped.
- [ ] Cross-tenant IDs cannot be used to retrieve data.
- [ ] Platform admin navigation appears only when entitled.
- [ ] Dashboard view parameters cannot bypass access control.
- [ ] Exports use independent permissions.

### Responsive

- [ ] 320px mobile.
- [ ] 375px mobile.
- [ ] 768px tablet portrait.
- [ ] 1024px compact desktop/tablet landscape.
- [ ] 1280px desktop.
- [ ] 1440px desktop.
- [ ] 1920px wide desktop.
- [ ] 200% browser zoom.
- [ ] Long labels and large datasets.

### Accessibility

- [ ] Keyboard-only complete navigation.
- [ ] Screen-reader dialog announcement.
- [ ] Focus trapped and restored.
- [ ] Visible focus in both themes.
- [ ] Reduced-motion mode.
- [ ] Chart summaries/tables.
- [ ] No color-only states.
- [ ] Automated axe checks on shell, launcher and each cockpit.

### Data integrity

- [ ] Zero is distinct from missing.
- [ ] Partial failures identify affected sources.
- [ ] Time zones and reporting periods are explicit.
- [ ] Totals reconcile with source modules.
- [ ] Filters produce consistent denominators.
- [ ] Stale/cached data displays freshness.
- [ ] Small cohorts follow privacy policy.

### Performance

- [ ] Launcher opens without network.
- [ ] No duplicate dashboard requests.
- [ ] Search requests cancel correctly.
- [ ] Chart packages are lazy loaded.
- [ ] No memory growth while changing cockpits repeatedly.
- [ ] Layout shift stays within the agreed budget.
- [ ] Core Web Vitals meet targets on pilot data volume.

### Visual regression

- [ ] Light and dark themes.
- [ ] All interactive states.
- [ ] Empty/loading/error/partial states.
- [ ] Modal and drawer layering.
- [ ] Long text and overflow.
- [ ] Dense tables and charts.

---

## 22. Release gates

The change is ready for general release only when:

- [ ] Product approves final information architecture.
- [ ] Design approves token implementation in both themes.
- [ ] Security approves authorization and audit behavior.
- [ ] Data owners approve every released metric.
- [ ] Payroll/legal owners approve regulated rules shown or executed.
- [ ] Accessibility checks pass without critical/high issues.
- [ ] Full lint, typecheck, unit, integration and E2E suites pass.
- [ ] Pilot tenant reconciliation shows no material data mismatch.
- [ ] Feature flags and rollback instructions are documented.
- [ ] No sample values appear in production data states.
- [ ] No dead destination is exposed in navigation.

---

## 23. Product decisions still requiring approval

The following do not block the design-system and launcher foundation, but they block their relevant feature:

1. Which S1–S10 cockpits ship first.
2. Whether cockpit codes remain visible to end users.
3. Whether the product keeps both light and dark themes.
4. Whether contractors, projects/timesheets and a dedicated helpdesk become products in this application.
5. Whether the right-side intelligence experience is a drawer, dedicated page, or both.
6. Whether role impersonation is needed for support/admin users.
7. Approved source and legal interpretation for payroll, wage, tax, leave and overtime rules.
8. Approved definitions for organization health, capability, attrition risk and AI model quality.
9. Data retention/privacy thresholds for executive analytics.
10. Chart-library decision after required chart types and bundle impact are tested.

---

## 24. Final definition of done

The project is complete when users can reach authorized work quickly through a calm, consistent shell; dashboards use the full available width; every metric is real and explainable; every operational action is safe and auditable; the design works across screen sizes and assistive technology; and the implementation continues to use the current application's proven routing, authentication, tenancy, database and service architecture.
