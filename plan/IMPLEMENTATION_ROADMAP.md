# Implementation sequence and acceptance gates

This plan does not authorize treating existing previews as production services. Deliver vertical slices with evidence, retain the preview for comparison, and never silently route live errors back to fixtures.

## Milestone 0 — contract and inventory lock

Inputs: FEATURE_SERVICE_CATALOG.md, service-plan-coverage.json, workbook UI coverage, normalization gap register and role model. Confirm source ownership for each module; refine broad view actions against actual component callbacks. Review every shared-target menu alias for its distinct workflow. The generated catalog covers known source definitions, not undiscovered requirements inside external process documents.

Acceptance: coverage verifier finds every current navigation ID, operational screen, action, widget, page and route exactly once in its inventory. Each workbook requirement has source sheet/cells, intended feature, owner, acceptance case and honest implemented/prototype/gap status. A product owner reviews labels and policy semantics before activation. No orphan route or unassigned command owner.

## Milestone 1 — production identity and platform contracts

Implement restricted runtime DB access, durable sessions, scoped AccessContext, server permissions, transactional audit/outbox, typed configuration and shared error/idempotency/version contracts. Replace preview credential flows only behind explicit environment gates. Establish scoped repositories and permission test fixtures.

Acceptance: all five role models tested at service boundaries; unauthenticated, inactive, cross-tenant and revoked membership requests denied; no owner credentials in runtime; no secrets or unauthorized HR data in public content/session responses. Verify pooled transaction context isolation and rollback of both business/audit writes on failure.

## Milestone 2 — organization and reference data

Normalize person/employment/assignment, reporting hierarchy, legal entity/establishment, country/subdivision/currency catalogs and document ownership. Backfill with counts, uniqueness, FK and field parity checks; quarantine ambiguous mappings for review. Build employee directory/detail and assignment commands against these repositories.

Acceptance: current/historical assignment queries, employee-to-login linkage, scoped manager hierarchy, headcount slot concurrency and referenced record permissions tested. No database command can reference another tenant's employee. Country/subdivision setup rejects inconsistent relationships.

## Milestone 3 — leave and attendance vertical slice

Implement SCR-030 request DTO/half-day semantics, leave policy and ledger, approval/delegation, calendars, punches/rosters, gate passes, overtime and recomputation. Replace the corresponding JSON adapters only after domain tests pass. Retain preview requested-day behavior without confusing it with chargeable days.

Acceptance: required/type validation on both sides; all date/precision and balance edge cases; real persistence across reload; exactly-once submission and approval; transactional ledger/reversal; manager/employee scoping; desktop/mobile browser cases against the live test database. Recompute invalidation reaches payroll projections with version tracking.

## Milestone 4 — India payroll and finance

Depends on Milestones 1–3, approved establishment states and reviewed India rule packs. Implement compensation profiles, loans/advances/benefits, frozen payroll inputs, exact-money calculations, review/lock/correction, payslips, journal/bank instruction and reconciliation. Add Superadmin country configuration workflows before enabling further countries.

Acceptance: reviewer-approved golden cases with input/policy provenance; repeatable calculations; maker-checker enforcement; no partial/duplicate financial effects; balanced journal and beneficiary-level reconciliation; missing state or unverified country capability blocks statutory execution. No placeholder bank account or invented salary enters a live export.

## Milestone 5 — employee lifecycle and talent

Wire joining/probation/exits/assets/letters; requisitions/candidates/interviews/offers/referrals; performance/goals/feedback/calibration; learning/skills/recognition. Build workflow policies before connecting each create/approve button.

Acceptance: end-to-end hire-to-payroll eligibility and exit-to-final-settlement; task prerequisites and evidence; private candidate/feedback fields remain scoped; duplicate hire conversion prevented; completed/finalized records immutable except explicit corrections.

## Milestone 6 — workforce operations and platform administration

Wire projects/time/travel/expenses/helpdesk/contractors, integrations, notification preferences, rule packs, obligations, workflow builder and audit views. Add durable job monitoring, dead-letter repair and connector health.

Acceptance: duration/cost derivation, total allocation checks, attachment validation, retries and cancellation tested; public contact delivery is real and rate limited; integration secrets masked; signed webhook replay rejected; UI exposes genuine persisted status rather than optimistic success.

## Milestone 7 — localization, dashboards and analytics

Localization begins with schema/content classification in Milestone 1 and is required for each earlier vertical slice. This milestone closes remaining namespaces, interpolation/plurals, configuration-driven labels and dynamic report/dashboard data. Persist per-user console/device layouts and permission-filter widget queries. Build metric lineage/freshness and AI action approval adapters only over authorized domain commands.

Acceptance: scan shows no unclassified application labels or business snapshot reads on live routes; multilingual forms/notifications/exports and missing-key fallback tested; dashboard role/data scopes hold after permission changes; user preferences survive reload and conflict correctly; AI output cannot bypass normal command authorization.

## Milestone 8 — production qualification

Run lint, typecheck, unit/domain/integration tests, browser flows and deployment-runtime smoke tests. Conduct performance/load tests on agreed datasets, dependency/security review, permission matrix review, restore drills, retention/hold tests and business acceptance for every feature contract. Verify serverless connection behavior and worker scheduling on the chosen hosting platform.

Acceptance: no skipped required database tests; no uncontrolled mock fallback; every feature has a test evidence link and accepted owner sign-off; rollback and incident runbooks rehearsed; production environment gate passes. A green build alone does not pass this milestone.

## Data migration and rollback procedure

1. Inventory every legacy JSON business attribute and classify it as normalized field, relationship, immutable evidence or presentation preference.
2. Add constrained target tables/columns without dropping readers. Backfill in bounded restartable batches with mapping provenance and quarantine unresolved rows.
3. Compare source/target counts, normalized field values, aggregate totals, FK integrity and tenant scope. Reconcile ledger opening balances separately with approved evidence.
4. Run shadow reads and deterministic domain golden cases. Switch one feature's provider with an explicit feature flag after parity approval.
5. Monitor errors, latency and financial/ledger reconciliation. Roll back the reader flag if needed; never erase already accepted transactions. Reconcile writes made after cutover before any rollback.
6. Remove legacy writers/readers only after the retention window, restore proof and zero remaining dependencies. Migrations remain immutable and journaled.

## Definition of done per feature

A feature is complete only when its query/command schema, repository, permission scope, state policy, audit/outbox effects, UI loading/error/empty states, localization, migration mapping and automated acceptance evidence exist. A menu entry, generic table, matching endpoint or shared CRUD handler is insufficient. Track owner, status, dependencies, evidence and unresolved decisions alongside the feature ID in the coverage catalog.
