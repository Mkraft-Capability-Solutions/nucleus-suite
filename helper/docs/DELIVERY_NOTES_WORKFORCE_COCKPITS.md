# Delivery notes — Workforce Operations, Design System, Cockpits and Sub-modules

Branch: `feat/nucleus-hrms-delivery`
Base: `main`

This branch consolidates four pieces of work. Everything below was verified with
`tsc --noEmit`, `eslint`, the full `vitest` suite and a production `next build`.

**Verified on this branch:** 2,805 unit tests passing · build successful (95 pages,
10 cockpit API routes) · no lint problem in any file added here · the reference
repo `nucleus-suite` untouched throughout.

---

## 1. Workforce Operations — seven module pages

Five modules (`rosters`, `projects`, `assets`, `travel`, `timesheets`) rendered a
generic placeholder; `field-workforce` and `approval-inbox` did not exist.

- **Shift Planning & Rosters** — roster plan, shift master, coverage. Detects
  overlapping punch-in windows among published shifts, including windows that
  cross midnight. That overlap is what silently shadows longer shifts during
  shift inference and inflates overtime.
- **Projects & Pod Allocation** — projects, task board, pod allocation. Progress
  is computed from real task counts; a project with no tasks says so rather than
  drawing a default bar.
- **Field Workforce** — worker categories, plant calendars, statutory holidays.
  A stored wage multiplier is visually distinguished from a policy default.
- **Assets & Gate Passes** — register, custody, gate-pass quota scoped to the
  current calendar month.
- **Travel & Duty Management** — requests, expense claims, advance reconciliation.
- **Timesheets & Productivity** — entries, productivity, approvals queue.
- **Unified Approval Inbox** — two-pane queue with transitions derived from each
  record's own catalog definition.

Five new catalog resources (`shifts`, `tasks`, `worker-categories`,
`plant-calendars`, `holidays`) ride the existing `hrms_operation_records` engine,
inheriting CRUD, transitions, optimistic locking, segregation of duties, audit
and permission scoping. **No new tables.**

`src/lib/workforce-policy.ts` holds the gate-pass, lateness, overtime, holiday,
loan, settlement and earned-wage rules as **tenant-overridable defaults**, not
constants, so a policy change needs no code release.

---

## 2. Nucleus UI Design System v2.0.0

`src/app/globals.css` is now layered: design-system tokens (`--ink`, `--paper`,
`--signal`, `--line`, `--rail*`, spacing, radii, elevation, motion) are the
source of truth, and the shadcn/Tailwind names (`--background`, `--card`,
`--primary`, …) are **aliases over them**. Every component inherited the palette
without being rewritten.

Dark mode is carried by both `.dark` and `[data-theme="dark"]`.

**Contrast is enforced, not asserted.** `src/lib/theme-contrast.test.ts` parses
the real token values, follows `var()` aliases, composites translucent surfaces
over their backdrop and checks WCAG ratios in both themes — 4.5:1 for body text,
3:1 for UI text and solid fills. A token edit that breaks a pairing fails the suite.

### Deviations from the published specification

Each was corrected because the specified value was legible in only one theme.

| Specified | Problem | Resolution |
| --- | --- | --- |
| Primary button text `#FFFFFF` both themes | White on dark-mode `--signal` `#38BDF8` is ~1.9:1 | `--signal-on` is dark ink in dark mode |
| Accent badges fixed to `#F59E0B` / `#F43F5E` / `#A855F7` / `#38BDF8` | Illegible on their own light-mode washes | Theme-paired `--accent-*` inks |
| Table rule `rgba(28,52,80,0.4)`, row hover `rgba(255,255,255,0.02)` | Dark-mode-only values | `--table-rule`, `--row-hover` |
| `--slate-2` `#8395A1`; dark `--text-3` `#64748B` | 3.0:1 and 3.4:1 — both fail AA | Darkened / lightened |
| Glass `--card` reused for popovers | Page bleeds through, stacking text on text | `--popover` opaque in dark |

`--font-mono` pointed at **Lato**, so every `font-mono tabular-nums` figure in the
product rendered in a proportional sans. IBM Plex Mono is now actually loaded.

No Tailwind palette class or colour literal remains in `src` outside
`src/components/ui`.

---

## 3. Responsive pass

No horizontal page scroll at 375px or 768px — measured in a browser
(`scrollWidth === clientWidth`, zero offending elements), not inferred.

Bug classes found and fixed:

1. **A bare `fr` track takes min-content from its widest child.**
   `grid-cols-[1.25fr_0.75fr]` around a 620px table pushed whole pages past the
   viewport despite looking responsive. Now `minmax(0,…)`.
2. **`SectionHeading` wraps actions in `shrink-0`**, so a `flex-wrap` toolbar
   sizes to max-content and `w-full` on its controls does nothing — a filter bar
   overflowed by 103px at 375px. Toolbars now `flex-col` at base.
3. **`TabsList` was height-clamped** by `group-data-horizontal/tabs:h-8`, making
   `flex-wrap` dead and clipping tab rows.
4. **Charts** — the donut used fixed pixel radii that spill out of narrow columns,
   and `ResponsiveContainer`s had no `min-height`, so they could collapse to zero
   height and render nothing at all.
5. **Hidden nav sheets** left a live backdrop and scroll lock when the viewport
   crossed their hide breakpoint.

`StatusPill` was an `inline-flex` that could never shrink — the reported defect
where a status overflowed its column and painted over the adjacent button. It now
truncates inside `min-w-0 max-w-full`, so no pill anywhere can overflow again.

---

## 4. Dashboard cockpits S1–S10

Ten role-tailored consoles, each with an aggregation service, an API route and a page.

### Access

`src/lib/cockpit-catalog.ts` carries an `audience` per cockpit:

| Principal | Cockpits |
| --- | --- |
| Super Admin (`owner`, or `tenant.manage`) | S1–S7, S9, S10 — **not** S8 |
| Employee | S8 only |

Permissions alone cannot express that exclusion, because the owner role holds
every permission. Enforced **twice**: navigation visibility, and server-side in
every cockpit route via `canAccessCockpit`. S10 re-enforces `tenant.read` inside
each of its database reads. A test asserts that a principal holding every
permission still cannot reach S8.

### Data honesty

`src/server/cockpits/source.ts` gives every feed an availability envelope, so one
broken feed does not take a cockpit down. The specification's figures are
illustrative and are never hardcoded. Panels that cannot be sourced say so and
name what is missing:

- **Compa-ratio and pay-vs-performance** — `compensation_bands` is written but no
  read service exposes band midpoints, and nothing returns a per-employee rating.
- **Headcount forecast band** — no manpower plan and no forecasting model exists;
  the actual line is real, the prediction band is not drawn.
- **Candidate CSAT** — survey responses resolve a respondent from an active
  membership, which a candidate does not have.
- **Offer decline reasons** — offers store status, amount, currency and joining
  date only, so the drop-off bridge decomposes by stage, not by reason.
- **Required shift headcount** — not modelled, so coverage deficit is not derivable.
- **Time-to-hire** — applications carry an applied date but no hire date.

S5 withholds the cost-variance bridge entirely when the movements do not
reconcile the two run totals, rather than balancing it with a plug, and keeps the
platform's own stage names instead of asserting stages the run never stored.

### S10 finding worth acting on

**A blocked agent action leaves no trace.** `proposeAction` rejects a
non-allowlisted tool and `approveAction` rejects self-approval *before* any row
or audit event is written. The guardrail table can therefore only show actions
that were permitted — an empty table is not evidence that nothing was refused.
The page states this rather than letting the absence imply compliance.

Governance fields the platform does not record, named on the page rather than
invented as columns: bias/fairness audit, DPDP assessment, model provider and
version pin, model owner and approver, risk tier and intended-use restrictions,
drift monitoring, retention schedule, and blocked attempts.

---

## 5. Onboarding and Payroll sub-modules

- **HR Letter Studio** — a real merge studio over the existing `letter_templates`
  and `generated_letters` tables. Each token names its source field; an
  unresolvable token prints `[no value: token]`. **CTC is deliberately not
  derived** — only basic pay is stored, and inferring a CTC would put an
  unapproved figure in an offer letter. A saved draft persists the server-merged
  body, its reference and the merge provenance. No Export PDF button, because no
  PDF renderer exists in the repo.
- **Recognition & Events** — birthdays, anniversaries, new joiners, hall of fame.
  `date_of_birth` is read as month and day only and is **never selected as a
  column**, so no birth year leaves the database; it is gated on
  `employee.birthdate.read`, and a refusal degrades that one panel rather than the
  endpoint. "No birth dates recorded" is distinguished from "no birthdays in this
  window" — a data gap is not an answer of none.
- **Workflow Pipelines / Lifecycle Trigger Chains** — read the real columnar
  `workflow_definitions` / `versions` / `steps` / `transitions` tables.

  **These are a catalogue, not a feature.** Nothing in `src/` read those tables
  before this change; the only writer is a demo seeder; the engine that actually
  runs approvals never consults them; all `workflow_instances` rows still have
  `started_by_user_id = NULL`. Nothing re-provisions access on a transfer or
  triggers payroll on a promotion. Both surfaces say so on every card, and the
  claim lives in one `PIPELINE_EXECUTION` constant so it can only change alongside
  a real executor.
- **Payroll** gains a tab strip; the existing run console is the default `runs`
  tab, moved verbatim. New tabs: Gross-to-Net & EWA, Off-Cycle Runs, Company Loans
  & Guarantor Lock, Same-Day F&F & No-Dues, Plant Location Scoping.
  - The **earned-wage 50% cap is enforced server-side**; the existing advance
    service capped at the whole earned wage.
  - The specification's premise on run types was wrong: **six scopes exist, not four**.
  - **Pay masking is enforced server-side** — a denied row carries no pay keys at
    all, so there is nothing in the network response to un-hide. It uses the real
    RL-24 data-scope mechanism (`DataScopeGrant` on `tenant_settings`), not the
    reference's non-existent `HQ_HR_ADMIN` role.
  - No settle button, because there is no settle endpoint.

---

## 6. Create forms open in a dialog

Creating a record used to navigate to `/<module>?section=operations/<resource>`,
which lost the reader's place and never refreshed the list they came from.

`OperationCreateDialog` wraps the **existing** `OperationForm` — the same
schema-driven renderer the section workspace uses — so field definitions,
validation, the `Idempotency-Key` and the version precondition stay in one
implementation and cannot drift. The trigger renders only when the principal
holds that create permission. 29 create affordances across seven pages were
converted, including the empty-state calls to action.

Left as navigation on purpose: links that open an **existing** record,
cross-module links, and the approval-inbox row links.

---

## 7. Schema

- `0018_workforce_field_operations.sql` — registers `workforce.field.*` and
  self/team scopes for projects, rosters and assets. No DDL.
- `0023_lifecycle_letters_recognition.sql` — adds `employees.date_of_birth` (the
  one genuine gap; birthdays could not be derived at all without it) with
  month/day indexes for birthdays and joining anniversaries, and registers
  `hr.letters.*`, `hr.recognition.*`, `hr.lifecycle.*`, `employee.birthdate.read`.
  **No new tables** — `letter_templates`, `generated_letters`,
  `recognition_events` and the `workflow_*` tables already existed and were unused.

`db/script/schema.sql` is updated.

> **`0023` is not yet applied to the connected database.** Until `npm run db:migrate`
> runs, `employees.date_of_birth` does not exist and the birthday panel will
> correctly report that no birth dates are recorded.

---

## 8. Known limitations

- **Authenticated screens have not been verified visually.** The login page was
  checked at 375 / 768 / 1440 in both themes; everything behind auth is verified
  structurally and by test only.
- **A build fix for `main` is included here.** `app-shell.tsx` was missing a
  closing brace on `main` (`TS1005` at line 481), so that tree did not compile. It
  arrived with a merge, not with this work.
- `main` has 42 pre-existing lint errors in `scripts/seeder/*` and in test files
  that arrived with recent merges. None are in files added here.
