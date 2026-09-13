# Application audit and implementation checklist

Source: user master development request, 13 September 2026, reconciled with prior SCR-030 requirements. Detailed acceptance text and status for all 47 requirement groups is retained in MASTER_QA_REQUIREMENTS.json. Status advances only on evidence: DISCOVERED → ANALYZED → IMPLEMENTED → TESTED → VERIFIED.

## Execution order

1. Inventory routes, controls, services, data boundaries, security gates and existing tests.
2. Public motion: contextual reveals, stagger, pointer response, progress, keyboard equivalence, reduced motion and route lifecycle cleanup. Review Home, About, Features, Why Nucleus, Docs, Contact and Login.
3. Leave: shared date/policy calculations; atomic application, balance and workflow updates; explicit identity boundaries; unify duplicate form paths; preserve half-day override, optional reason/contact and default 2026-09-13.
4. Form sweep: metadata options, field derivation, validation constraints, accessible dialogs, submit error handling and duplicate prevention.
5. Sequential compiler, unit, contract and browser verification, followed by evidence reconciliation.

## Coverage dimensions

Public UI/UX; contextual motion; leave; forms/fields; validation; workflows; permissions; dashboards; responsive layout; accessibility; performance; errors; notifications; API/data mapping; security; regression tests.

## Initial confirmed gaps

- Two disconnected leave application paths. Legacy workflow clamps insufficient balances, fails to restore rejected balances, accepts out-of-sequence approvals and credits early return to privilege leave irrespective of type.
- Comp-off consumption does not sort FIFO or preserve partial credits. Local date conversion can shift leave dates in positive UTC offsets.
- Public reveal observer applies one animation and does not track route changes.
- Generic forms overwrite supplied dropdown options and numeric validation does not reject invalid constraint configuration.

## Delivery boundary

The current repository instructions keep JSON preview active and prohibit activating deferred database/production integrations. Review existing server contracts without running migrations or claiming live database authorization, transaction or delivery verification. Those requirements remain explicitly unverified until that phase is enabled. Synthetic records and local workflow outcomes must remain identified as preview behavior.

## Implemented boundaries and data contracts

- `PublicMotion` owns bounded Web Animations, staggered children, pointer position updates (one pending animation frame), reading progress and route lifecycle cleanup. Home comparison, product perspective, intelligence, timeline, FAQ, feature grids, docs and login use contextual variants. Ambient movement settles within five seconds. No numerical business claims were fabricated for counters.
- `leave-workflow.ts` is a serialized asynchronous **in-memory** service adapter with pure state transitions. Submission reserves the exact debit; approval changes status without double deduction; terminal rejection/withdrawal/cancellation restores once. Optimistic request versions prevent stale approvals. Requests, balances, comp-off allocations and audit events commit together within this adapter, not in a database transaction.
- `leave.workflow.json` explicitly assigns synthetic opening balances to the three configured employee-linked preview personas. These are separate preview accounts derived from the previous synthetic balance fixture, not verified production allocations. Superadmin has no personal employee account. Legacy EMP-prefixed examples have no validated relationship to MK-prefixed login personas; do not infer one.
- Both the SCR-030 route and the older leave screen use the same dialog and adapter. The requested inclusive quantity is displayed separately from the policy debit. An unchanged calendar quantity uses working-day/sandwich rules; a manual quantity is an explicit debit, including quantities above the calendar span as requested. This exception requires business review before production. A full non-working range with no explicit override cannot debit leave silently.
- Manager approval is limited to the explicit preview reporting relationship and first approval tier. HR/superadmin can review other employees sequentially. Self approval is rejected. These checks improve preview consistency and do not establish server authorization.
- Allocation/correction requires HR/superadmin, a known employee, nonzero half-day precision, nonnegative resulting availability and a reason. Dated comp-off grants are deliberately not emulated by a generic balance adjustment.
- Calendar and CSV reports use the same filtered requests. CSV cells neutralize spreadsheet formula prefixes. Activity notifications are session events only; no email, push, scheduled reminder or outbox delivery is claimed.
- All shared form numeric constraints now reject invalid step configuration. Derived fields support arbitrary date dependency keys. Length constraints, required checkboxes and translation-ready validation messages are supported. Action forms await completion, retain values on failure and prevent duplicate dispatch.

## Unresolved requirements (not silently counted as complete)

1. **Production data/API consistency and backend validation**: the active runtime only supports JSON. Existing deferred leave endpoints use UUID employee identifiers, EL/CL/SL/COFF/BIRTHDAY codes, lower-case statuses and a different schema; the active preview uses configured persona IDs and PRIVILEGE/CASUAL/SICK/COMP_OFF/WELLNESS/LOP. A reviewed translation/cutover contract, authenticated sessions, server authorization, transactions, idempotency, real database tests and durable audit/outbox delivery remain required. No migration or production activation was performed.
2. **Policy integration**: workbook sheets 09/14/15/16 provide location holidays, leave types, band eligibility, accrual and proration. Source employees use their location and worker-class calendars; band eligibility, birthday month and monthly caps are enforced. MK login personas have no approved link to E-prefixed workbook employees, so their default calendar/accounts remain explicitly synthetic. Notice-period restrictions, evidence requirements, maternity statutory eligibility, delegation and escalation configuration are not supplied. Technical request-window limits are not employment policy.
3. **Advanced leave operations**: configurable delegation/escalation, request-changes/resubmission, partial approval, scheduled accrual/carry-forward/encashment, dated credit-grant administration and reminder delivery are not implemented end to end in the preview. The workbook policy screen is reference data, not automatically posted balances.
4. **Source data reconciliation**: the seven workbook requests and legacy EMP examples retain their source IDs and are read-only pending ledger reconciliation. All workbook employee IDs remain searchable; HR can explicitly allocate a paid account. Dated workbook comp-off grants are evaluated against their own expiry dates. MK personas are never silently assigned EMP/E balances.
5. **Application-wide domain completion**: metadata CRUD outside the leave service remains temporary UI state. A static form inventory and browser route sweep do not verify every payroll, onboarding, recruitment, approval or integration invariant. Production KPI freshness, all-domain server validation and full CRUD/database consistency remain unverified.
6. **Quality claims**: no WCAG certification, load test, formal security audit, real-device/iOS matrix or customer deployment verification was performed. Browser emulation and reduced-motion checks are bounded evidence, not a claim of a flawless platform.

## Regression findings during the full run

- The 320px public check found the rotated intelligence artwork extending 18px beyond either edge. Containment is now applied only to the decorative art container, preserving content/focus overflow elsewhere.
- The public navigation test used an unscoped `summary` locator. Since the home FAQ correctly adds five more disclosure controls, the test now targets the banner's menu disclosure explicitly; the viewport assertion remains intact.
- The initial mobile role loop received a successful login response but returned to login during development refresh activity. Its stable-source rerun passed; no authentication guard or test assertion was weakened.

## Public-page interaction review

| Page | Contextual motion and interaction |
| --- | --- |
| Home | Lifecycle selection, bounded pointer tilt, perspective product reveal, comparison slide, staggered journey/timeline, finite ambient glow, FAQ disclosure |
| About | Heading entrance, staggered information cards, pointer-sensitive surfaces, navigation feedback |
| Features | Scale/stagger feature grid, icon/card hover, CTA feedback |
| Why Nucleus | Section entrances, staggered value cards, interactive surface glow |
| Docs | Lateral/staggered resource cards, anchor/link feedback |
| Contact | Section entrance, input focus feedback, download status entrance; enquiry remains an explicitly unsent draft |
| Login | Split introduction/form entrances, shared public header, visible busy and validation states |

All seven share route-aware lifecycle cleanup and reading progress. Pointer effects require a fine pointer; reduced motion cancels Web Animations and removes optional transforms. Decorative motion finishes within five seconds. These implementation constraints are not a measured FPS or Core Web Vitals certification.

## Workbook reference preservation

`leave-reference.ts` maps source sheets 05/06/09/12/14/15/18/19 through the existing workspace data boundary. The seven source requests retain their original status alongside the canonical preview status. Paid source ledger examples are partial and are not silently treated as reconciled opening accounts. Birthday leave is available to an eligible source employee with a recorded birth month and allocation; maternity remains visibly unavailable pending statutory configuration. Session comp-off availability is recomputed from dated grants before and after each mutation, and expiry never extends on restoration.

## Known-policy validation details

Source monthly caps and the standard-band six-month eligibility wait are checked before balance reservation. Incompatible CL/EL and CL/SL periods are rejected in either direction. A continuous absence is interpreted as adjacent requests or requests separated only by non-working days; this interpretation is explicit and needs policy-owner acceptance before production. Comp-off is allocated per chargeable date, so a grant cannot fund a day after its expiry or before it was earned.

The unused legacy `computeAnnualCredit` helper still projects annual values and is **not an entitlement posting service**. It is not called by the current leave UI. Replace it with a reviewed accrual schedule before enabling automated ledger posting; completion-month timing, mid-year executive proration and partial historical ledgers must be reconciled first.
