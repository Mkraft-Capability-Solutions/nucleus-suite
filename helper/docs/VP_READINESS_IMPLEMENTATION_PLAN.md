# Nucleus HRMS VP readiness implementation plan

## Outcome

Close all 26 requirements from `Nucleus_HRMS_VP Readiness.pdf` in the existing
Next.js/PostgreSQL application. A requirement is complete only when its policy
is persisted, enforced by a tenant-scoped service, reachable through an API,
usable from the HRMS UI, audited where it changes business state, and covered by
automated tests.

## Scope and assumptions

- PostgreSQL remains the source of truth and tenant row-level security remains
  mandatory.
- Existing canonical tables are reused. The VP migration adds explicit columns,
  constraints, and operational tables only where the JSON-based canonical model
  cannot safely enforce a hard business rule.
- ERP communication is asynchronous. Inbound master records are idempotent;
  outbound GL batches remain retryable until an acknowledgement is recorded.
- Statutory forms are generated only from an approved, effective, state-specific
  template. An unavailable rule pack is a hard failure, not a silent fallback.
- Monetary values are stored as integer minor units and dates use the tenant's
  configured timezone at service boundaries.

## Delivery architecture

```text
HRMS UI
  -> /api/v1/vp/* command and query routes
      -> VP domain service (policy enforcement + audit + outbox)
          -> PostgreSQL VP policy/operational tables
          -> existing attendance, leave, payroll, lifecycle and talent tables
          -> transactional_outbox
              -> ERP/webhook workers and reconciliation
```

The VP service is deliberately an orchestration layer. Existing attendance,
leave, payroll, engagement, compliance, lifecycle and talent services continue
to own their aggregate data; the new layer closes cross-domain rules without
duplicating those services.

## Feature-to-implementation matrix

| # | Requirement | Persistent model | Enforced workflow/API | UI surface |
|---:|---|---|---|---|
| 1 | Multi-punch, overnight, breaks, OT | attendance sessions/breaks/day result | recompute with net-hours OT and rule version | Time office |
| 2 | Contract workers, no rest day, daily wage | worker categories, employment override | calendar and wage resolution | Workforce rules |
| 3 | Third-party employee/helper rest rules | worker categories | category resolver | Workforce rules |
| 4 | OT eligibility by day type | OT policy/employee override | attendance recompute eligibility | Time office |
| 5 | Early return and 3-stage leave approval | leave ledger/approvals | reversal plus attendance restore | Leave operations |
| 6 | COFF 60-day lapse | comp-off grant/ledger | idempotent expiry job | Leave operations |
| 7 | Accrual, proration, caps, year end | accrual/year-end policy, ledger | idempotent accrual/year-end jobs | Leave operations |
| 8 | Plant scope with salary masking | location grants | scoped team-history query | Access and reports |
| 9 | Loan and guarantor policy | existing loan tables | existing loan service | Loans |
| 10 | Post-salary OT run | payroll run kind/dependency | OT run requires finalized regular run | Payroll operations |
| 11 | Gate pass limits and credited time | existing gate-pass tables | existing attendance service | Time office |
| 12 | Thresholds, grace and late rules | attendance rule sets | recompute applies persisted rule | Time office |
| 13 | Shift inference | shift windows/inference trace | recompute records inferred shift/reason | Time office |
| 14 | ERP employee master inbound | ERP sync batches/rows/external ids | idempotent preview/apply/reconcile | ERP operations |
| 15 | ERP account posting | GL batches/lines/mapping | queue, acknowledge, retry, reconcile | ERP operations |
| 16 | Same-day F&F and no-dues | existing offboarding/F&F tables | existing lifecycle service | Offboarding |
| 17 | Factory forms and returns | statutory templates/instances | state/effective template generation | Compliance operations |
| 18 | Star employees | recognition events/programs | publish recognition into feed | Engagement operations |
| 19 | Referral workflow and award | referral/award/payroll input | award becomes payroll payable | Engagement operations |
| 20 | Automated announcements | feed posts and generation keys | idempotent lifecycle generator | Engagement operations |
| 21 | HR letters | templates/generated letters/documents | versioned merge and issue register | Documents operations |
| 22 | Org chart and hierarchy | existing departments/positions | existing organization tree | Organization |
| 23 | Induction and assets | induction/asset assignment | allocate/return and clearance link | Onboarding operations |
| 24 | Replacement position code | positions/requisitions | vacancy and replacement validation | Workforce planning |
| 25 | Approved manpower | manpower plans/lines | sanctioned-strength validation | Workforce planning |
| 26 | Joining Form F | statutory instance/onboarding task | generate and attach before readiness | Compliance/onboarding |

## API contract

The consolidated endpoint is `/api/v1/vp/readiness`.

- `GET` returns policy configuration, operational registers, readiness counts,
  and all 26 feature statuses for the current tenant.
- `POST` accepts a discriminated `action` command. Supported commands cover
  worker categories, work calendars, attendance rules and shift windows; leave
  accrual/expiry/year-end; team-history reporting; ERP inbound and GL posting;
  statutory forms; recognition, referrals and announcements; letters and assets;
  and manpower/position control.
- Every mutation requires an `Idempotency-Key`, is tenant scoped, records an
  audit event, and emits an outbox event when another system is affected.
- Policy failures return `422 POLICY_VIOLATION`; stale states return
  `409 VERSION_CONFLICT`; unavailable statutory packs return
  `422 RULE_PACK_NOT_APPROVED`.

## Data and reliability decisions

- Rule sets and templates are immutable once used. New behavior is a new
  version, preserving historical explanations.
- Idempotency uses a tenant/action/key unique constraint for batch jobs and ERP
  commands.
- ERP records store payload hashes, source identifiers, status, attempts and
  acknowledgements. Reconciliation compares expected debit/credit totals with
  acknowledged totals.
- Attendance calculations record assigned and inferred shifts, the selected rule
  version and a reason trace.
- Manpower validation locks a sanctioned line during requisition creation to
  prevent concurrent over-allocation.

## Verification plan

1. Migration/schema checks: required tables, foreign keys, unique keys, checks,
   tenant IDs and RLS policies.
2. Pure policy tests: worker categories, shift inference, OT eligibility,
   accrual/expiry/year-end, payroll ordering and manpower capacity.
3. Service tests: tenant isolation, idempotency, audits, outbox creation and
   negative paths.
4. API tests: validation and stable response envelopes.
5. UI tests: readiness dashboard rendering, command forms, loading/error/empty
   states and refresh after mutation.
6. Release checks: lint, TypeScript, unit tests, production build and canonical
   schema verification.

## Rollback and operational notes

- The migration is additive. Rollback disables the VP route and UI module first;
  tables are retained to avoid destroying HR, payroll or statutory records.
- ERP dispatch can be paused independently while local calculations continue.
- Statutory templates and attendance rules are retired with effective dates,
  never deleted after use.

## Growth path

At higher scale, split the orchestration service into time-office, policy-jobs,
ERP bridge and document-generation workers. Keep the current API contract and
outbox events stable so that split does not require a UI migration.

## Attendance supervisory scope

Time Office visibility is enforced by the backend and then projected into the UI:

```text
authenticated membership
        |
        +-- owner / super-admin / HR / time-office / payroll-admin --> active tenant workforce
        |
        +-- linked employee --> self + recursive direct/indirect reports
        |
        +-- unlinked non-admin --> denied
```

`GET /api/v1/attendance/team-summary` is the aggregate read-model endpoint. Individual attendance-day reads and attendance writes validate the requested employee against the same resolved scope, preventing a manager from bypassing the UI with another employee ID. The Time Office page defaults to the aggregate and uses employee selection only for drill-down and actions.

The hierarchy source of truth remains `employees.manager_employee_id`. Cycles terminate safely because the recursive query uses set semantics. At higher scale, materialize transitive reporting paths only if measured hierarchy-query latency justifies the additional write complexity.
