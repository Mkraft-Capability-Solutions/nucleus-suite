# Form validation audit — 13 September 2026

## Delivered behavior

- SCR-030 initializes From/To to 13 September 2026 and derives inclusive calendar days using UTC date arithmetic. Date changes replace the derived value; unrelated edits preserve the manual override. Invalid or cleared dates clear the derived quantity.
- Number of Days is required, positive, and adjustable in 0.5-day increments using the keyboard, native numeric input or 44px touch controls. A manual quantity may exceed the calendar span, as requested. Reason and contact are optional.
- Shared operational and action forms validate required text after trimming, available selection membership, finite numbers, bounds, precision, valid dates and paired date/time ordering before their workflow callbacks run. Zero is preserved where allowed.
- A root submit boundary enforces native constraints and rejects whitespace-only required values on native and dispatched submit events. This supplements per-form validation; it is not server authorization.
- Explicit numeric bounds/steps cover operational metadata and action dialog metadata, plus payroll EWA/loan values, tenure, onboarding asset/award values, accident lost days and employee time logs. Compliance sliders now declare their step explicitly. Enrollment years start at 1.
- The existing leave policy workflow also blocks reversed dates before execution. Its policy-derived chargeable-day calculation remains distinct from the SCR-030 operational record preview.
- New leave queue records display submitted employee, leave type, dates and adjusted quantity. Dialog focus is trapped by MUI; the mobile layout scrolls and uses theme foreground colors.

## Sweep method and practical bounds

Reviewed shared metadata form renderers, all seven direct numeric input locations and five range inputs, native form submit handling, date inputs, and calculation patterns in attendance, payroll, recruitment, compliance and onboarding. An AST heuristic checked directly adjacent required-star labels for missing required attributes; no additional candidates were found. No direct `.submit()` calls were found under components. Existing payroll eligibility, settlement, recruitment capacity and attendance quota calculations are already derived rather than editable totals.

This is a heuristic audit, not proof that every possible dynamic workflow is correct. Click-only actions, domain policy correctness, server-side validation, permission enforcement, and backend persistence require their own contracts and tests. The numeric maxima added here are defensive technical limits, not approved HR or statutory policies. Country/state-specific policy limits should replace them when reviewed business rules are supplied. Existing payroll statutory preview formulas are not certified calculations.

## Verification

- Unit suite: 748 passed, 21 skipped (database-dependent tests remain unverified by that suite).
- UI contracts: 32 passed.
- SCR-030 browser regression: desktop and mobile passed, covering defaults, required selections, invalid step submission, reversed/cleared dates, manual overrides, date-driven reset, touch steppers and reopen reset. Mobile screenshot inspected; button contrast corrected.
- Final lint, production build (including TypeScript) and `git diff --check` passed. After the final numeric metadata refinements, the targeted form/migration suite passed all 16 tests.
- Database: migration 0020 applied locally; fresh install and repeated migration passed. Live assertions confirm India is the enabled default and tenant runtime cannot update global payroll countries.

## Remaining enterprise work

India/INR is the initial relational payroll default. No state has been selected. An audited Superadmin country management API/UI and country-specific statutory adapters remain pending; the schema can hold additional countries. All-country availability is not equivalent to compliant payroll support.

The broader database-driven localization, full normalization and live workspace workflow migration remain open as described in ENTERPRISE_HRMS_PLAN.md. Operational record creation in this audit is still a browser preview and is not durably saved.

## Follow-up closure

`node scripts/audit-forms.mjs` now reproduces the sweep across 440 source files, 22 native forms, 13 numeric/range controls and 22 metadata numeric fields. No missing numeric constraints or directly adjacent required-label mismatches were found. SCR-030 employee/type controls remain dropdowns when options are unavailable and reject stale selections. Shared validation rejects malformed clock values. The global boundary re-evaluates programmatically corrected values without retaining stale errors. Shared action dialogs reset through a keyed request lifecycle rather than effect-driven state resets.

## Master QA follow-up — 13 September 2026

The previous split between SCR-030 and the legacy policy workflow is superseded by `LeaveApplicationDialog` and `leave-workflow.ts`. Both application entrypoints now share required employee/type/date/quantity validation, optional reason/contact, asynchronous error handling and a serialized balance/workflow update. MUI dialogs provide focus containment/restoration for application and generic action forms. Generic action forms await completion and retain values after failure.

The updated AST audit covers 460 JS/TS source files, 24 forms, 15 intrinsic/MUI numeric controls and 22 metadata numeric fields. Missing bounds/steps and adjacent required-label mismatches: zero. This does not prove business-rule correctness or server-side validation across all domain forms. Full coverage and unresolved acceptance criteria are tracked in `MASTER_QA_REQUIREMENTS.json` and `MASTER_QA_IMPLEMENTATION.md`.

Current-turn verification supersedes earlier counts above: 806 unit tests passed (21 skipped), 31 UI contracts passed. See `MASTER_QA_REPORT.md` for final browser/build evidence. No database migrations or live database checks were performed in this follow-up.
