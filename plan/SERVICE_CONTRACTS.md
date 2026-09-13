# Service contracts and workflow correctness

All contracts below are proposed target behavior. Existing route files are indexed separately; a matching URL does not prove that these requirements already hold.

## Common transport contract

Queries: `GET /api/v1/<resource>?cursor=<opaque>&limit=50&sort=<allowlisted>&filter=<validated>`. Cap limit at 100; require stable `(sortKey,id)` cursor ordering. Response: `{data, page:{nextCursor,hasMore}, meta:{requestId,asOf,locale}}`. Return aggregates separately with filter scope and computation timestamp. Do not derive an organization total from a visible page.

Commands: `POST /api/v1/<resource>` or `POST /api/v1/<resource>/<id>/<intent>`; updates supply `expectedVersion` and `Idempotency-Key`. Identity, permissions and tenant are server-derived. Request schemas reject unknown writable fields and enforce lengths, enum membership, decimals and date order. Reused idempotency key with a different payload returns a conflict; same payload returns the stored outcome. Scope keys by tenant, actor and command; store a request hash and durable outcome reference.

Failures: `{error:{code,messageKey,fieldErrors:[{path,code,params}],requestId}}`. Distinguish validation (422), unauthenticated (401), forbidden (403), absent/inaccessible resource without disclosure (404), stale version/state (409), rate limit (429), dependency unavailable (503). Never return SQL, tokens or private identifiers in error messages. UI retains input after failure and focuses the first field error; it does not close or announce success before a confirmed response.

A command transaction: load current record/version and authorization scope → validate domain state and related records → lock or use a version-checked update → write domain changes → append audit record → enqueue outbox events → commit. Notifications and external calls happen after commit. Audit data records actor, delegation, tenant, intent, object, policy version, outcome and request ID with redacted changes. Rejection/security telemetry is recorded separately without committing a failed business mutation.

## SCR-030 leave command

Proposed request: `{employeeId,leaveTypeId,fromDate,toDate,requestedHalfDays,reason?,contactDuringLeave?,expectedPolicyVersion}`. The editable UI number converts exactly to integer half-day units (`2.5 → 5`); reject other fractions before conversion. Inclusive date span is derived independently. A manually adjusted request may exceed the calendar span as requested by the user; retain both quantities and require the relevant policy/approval decision instead of silently clamping the request.

Server checks employee belongs to the tenant and actor's permitted scope; selected leave type is effective and available; dates are real and ordered; half-day units are positive and bounded by configured policy; overlapping requests, balances, holidays, sandwich rules, negative-balance eligibility and delegation are evaluated from the policy version. Optional reason/contact must still have length limits and PII handling. Requested days and chargeable days are separate fields. Do not directly reuse the preview quantity as a final ledger deduction.

State machine: draft → submitted → awaiting approval → approved/rejected; cancellation and early return are explicit commands with rules for each state. Approval reserves/debits the ledger exactly once, according to the versioned leave policy. Reversals append linked compensating entries. Concurrent approvals/cancellations contend on the same aggregate and must not double debit. Leave calendars and payroll input projections consume committed events.

Acceptance: same-day, leap day, local DST boundary, cleared/reversed dates, 0/negative/quarter-day/NaN/infinite values, 1.5 and 2.5 overrides, stale option IDs, insufficient balance, unauthorized employee, duplicate submit, concurrent approval, cancellation after payroll cutoff and early-return reconciliation.

## Derived forms and numeric semantics

Form contracts are shared between UI and server through pure types/schema modules. Metadata may declare an allowlisted derivation (inclusive days, elapsed minutes, line amount), never executable formulas evaluated from untrusted configuration. Detect dependency cycles at catalog validation. Recompute when dependencies change; preserve manual overrides on unrelated edits. Persist requested and calculated values separately when overrides matter.

For elapsed time, store the time zone and dates to support overnight work; do not subtract naked time strings across midnight. For money, use currency-aware integer minor units and an explicit rounding policy; summation occurs before or after rounding only as specified by the policy. For percentages, constrain the denominator and validate totals where allocation must equal 100%. For quantity totals, server-side recomputation wins over client submitted aggregates.

Do not impose a legal maximum using a guessed frontend constant. Existing defensive form bounds are implementation guards pending approved domain policies. Validate all required fields again in commands even if React disabled a submit button. All click-only mutations must use the same command boundary. File uploads validate size, content type, scan status, owner and expiration before attachment.

## Dashboard and query contracts

`GET /api/v1/dashboard/widget-catalog` returns only authorized definitions. `GET /api/v1/dashboard/widgets/<id>/data` applies record scope, filter allowlists and limits. `GET/PUT /api/v1/dashboard/preferences` reads/writes the current user's versioned layout; reject unauthorized widget IDs, duplicate IDs and invalid grid coordinates. A privileged user cannot inject payroll widgets into an employee's layout.

Persist order, size and supported display settings independently per user/console/device class. Revalidate when permissions change. Support keyboard move/resize, touch controls, reset with undo, concurrent-edit conflict handling and invalid-import recovery. Grid mobile order must not be inferred from desktop absolute positions. Widget queries use a bounded parallel request budget and show local errors rather than blanking the entire dashboard.

## Localization and system configuration

`GET /api/v1/localization/<locale>?namespaces=...` returns only published, authorized messages with revision/ETag. Resolve user locale → tenant default → published English fallback. ICU-style plural/interpolation templates must be validated on publication; escape interpolation output and never render arbitrary translation HTML. Keep private business content out of shared language bundles. Date, money and number formatting use the selected locale plus record currency/time zone.

Superadmin manages global country/currency/locale catalogs; tenant admins manage explicitly overridable keys. A typed definition declares allowed values, min/max, scope, default, sensitivity and effective period. Draft → validate → approve if needed → publish → invalidate revision caches. Secrets are references to a secret store, never public configuration values. Every change records version/audit evidence and has a rollback path. The current unpublished string inventory is an input to classification, not a completed translation rollout.

## Async integrations and exports

A job has tenant, actor, type, input reference, idempotency key, progress, lease, attempts and terminal result. Workers check authorization/policy at scheduling and execution where rights may have changed. Use bounded exponential retries with jitter; distinguish permanent validation rejection from provider outage. Webhooks verify signatures and timestamps, deduplicate provider event IDs, and reconcile out-of-order events.

Exports use explicit schemas, currency/period metadata, data minimization and expiring authenticated downloads. A bank file must contain validated individual beneficiaries and approved run totals; never ship the current illustrative batch placeholder as a real bank artifact. Payroll release and bank acknowledgment are separate auditable transitions. No retry automatically executes a second payment.
