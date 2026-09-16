# Nucleus HRMS — Backend & Data Integrity Audit Report

> **Date**: 2026-09-16  
> **Scope**: `src/` codebase + Neon PostgreSQL database  
> **Mandate**: ENTERPRISE PRODUCTION READINESS — no mock/JSON/session/localStorage state; all data via real `/api/v1/` REST endpoints backed by PostgreSQL.

---

## Executive Summary

The codebase has a **split-brain architecture**: a well-built server layer (`src/server/`) with real DB-backed services exists **in parallel** with a large legacy context file (`HRMSContext.js`) that still uses in-memory `useState`, `localStorage`, and `readData()` (workspace JSON manifest) as the primary state store for most of the UI. The real `/api/v1/` endpoints are **called as secondary "sync" fire-and-forget**, not as the authoritative data source.

---

## 1. Database — Tables Available in Neon PostgreSQL

The canonical migration `0008_canonical_304_topology.sql` created **260+ tables** using a generic `IF NOT EXISTS` pattern. All tables share a minimal schema:
```sql
id uuid, record_status text, attributes jsonb, version bigint, created_at, updated_at
```

### Tables confirmed to exist (from migration + service code):
| Domain | Tables |
|---|---|
| **Auth/Identity** | `user`, `session`, `account`, `verification`, `tenants`, `memberships` |
| **Organization** | `employees`, `people`, `departments`, `positions`, `business_units`, `locations`, `cost_centers`, `legal_entities`, `grades`, `job_profiles` |
| **Attendance** | `attendance_days`, `attendance_punches`, `attendance_regularizations`, `gate_passes`, `shift_assignments`, `shifts` |
| **Leave** | `leave_requests`, `leave_approvals`, `leave_balances`, `leave_ledger_entries`, `leave_types`, `comp_off_grants`, `leave_policies` |
| **Payroll** | `payroll_runs`, `payroll_anomalies`, `payroll_inputs`, `payroll_lines`, `payslips`, `salary_advances`, `loans`, `loan_guarantors`, `loan_transactions` |
| **Recruitment** | `requisitions`, `candidates`, `applications`, `job_descriptions`, `job_postings`, `offers`, `interview_sessions`, `interview_scores` |
| **Performance** | `review_cycles`, `objectives`, `key_results`, `checkins`, `feedback_requests`, `feedback_entries`, `calibration_sessions`, `succession_plans` |
| **Learning** | `courses`, `learning_paths`, `enrollments`, `learning_completions` |
| **Engagement** | `feed_posts`, `recognition_events`, `referrals`, `surveys`, `survey_runs`, `survey_responses`, `announcements` |
| **Compliance** | `compliance_calendar_items`, `compliance_evidence`, `statutory_forms` |
| **Assets** | `asset_catalog`, `asset_assignments` |
| **Platform** | `audit_events`, `idempotency_keys`, `transactional_outbox`, `notification_templates`, `notifications` |

> [!NOTE]  
> The 260+ tables created by migration 0008 used a **generic JSONB-attribute pattern** (`id, record_status, attributes, version, created_at, updated_at`). Most domain-specific columns live inside the `attributes` JSONB blob, not as typed columns. Only core tables (`employees`, `attendance_days`, etc.) have normalized typed columns from migrations 0000–0007.

---

## 2. Server-Side Services — What Has Real DB Implementations

These files in `src/server/` perform **actual SQL queries** against PostgreSQL via `sqlClient`:

| Domain | Service File | Status |
|---|---|---|
| **People/Org** | `src/server/organization/service.ts` | ✅ Full CRUD — create/list/update employees, departments, positions |
| **Leave** | `src/server/leave/service.ts` | ✅ Full workflow — submit, multi-level approve/reject, early return, COFF grants, balance ledger |
| **Payroll** | `src/server/payroll/service.ts` | ✅ 83KB — run creation, calculation, GL, payslips, tax, reimbursements, FnF |
| **Attendance** | `src/server/attendance/` | ✅ Punch recording, day recompute, regularizations |
| **Identity/Auth** | `src/server/identity/` | ✅ Session via better-auth, tenant context, memberships |
| **Recruitment** | `src/server/jobs/`, `src/server/talent/` | ✅ Requisitions, candidates, pipeline |
| **Performance** | `src/server/performance/` | ✅ Review cycles, OKRs, feedback |
| **Learning** | `src/server/learning/` | ✅ Courses, enrollments, progress |
| **Delegation** | `src/server/delegation/service.ts` | ✅ Real DB with anti-proxy-self-approval logic |
| **Loans** | `src/server/loans/` | ✅ Full lifecycle — apply, consent, approve, disburse, repay |
| **Contractors** | `src/server/contractors/` | ✅ Agency, contracts, invoices |
| **Analytics** | `src/server/analytics/` | ✅ Metric snapshots, capability index |
| **Platform/Admin** | `src/server/platform/` | ✅ Access, audit, idempotency, HTTP helpers |

### API Routes — Implementation Status

All routes under `src/app/api/v1/` call their corresponding `src/server/` service:

| Route | Has Route File | Calls Real Service |
|---|---|---|
| `GET/POST /api/v1/people` | ✅ | ✅ `organization/service.ts → listEmployees/createPerson` |
| `GET/POST /api/v1/leave-requests` | ✅ | ✅ `leave/service.ts → listLeaveRequests/requestLeave` |
| `POST /api/v1/leave-requests/:id/decide` | ✅ | ✅ `leave/service.ts → decideLeave` |
| `GET /api/v1/leave-balances` | ✅ | ✅ `leave/service.ts → getBalances` |
| `GET/POST /api/v1/payroll-runs` | ✅ | ✅ `payroll/service.ts` |
| `GET/POST /api/v1/loans` | ✅ | ✅ `loans service` |
| `POST /api/v1/regularizations` | ✅ | ✅ `attendance service` |
| `GET /api/v1/people/:id` | ✅ | ✅ `organization/service.ts → getEmployee` |
| `POST /api/v1/people/import-apply` | ✅ | ✅ `organization/import-apply.ts` |
| All 118 route families | Defined in route.ts manifest | Varies (see section 3) |

---

## 3. 🔴 Critical Issues — Mock/JSON/LocalStorage Data Violations

### ISSUE 1: `HRMSContext.js` — The Main Violation (CRITICAL)

**File**: [`src/context/HRMSContext.js`](file:///run/media/thedhanraj/2TB-Part1/DhanrajWorkspace/MKraft/nucleus-suite/src/context/HRMSContext.js)

This is a 1,631-line React context that is the **primary data provider** for most UI components. It violates the enterprise mandate in multiple ways:

#### a) `readData()` from workspace JSON manifest as primary state:
```js
const [attendance, setAttendance] = useState(readData("context.HRMSContext", "attendance_2"));
const [gatePasses, setGatePasses] = useState(readData("context.HRMSContext", "gatePasses_10"));
const [timeOfficeLedger, setTimeOfficeLedger] = useState(readData("context.HRMSContext", "timeOfficeLedger_15"));
const [employees, setEmployees] = useState(() => readData("context.HRMSContext", "employees_28") || []);
const [positions, setPositions] = useState(readData("context.HRMSContext", "positions_30"));
const [teamMembers, setTeamMembers] = useState(readData("context.HRMSContext", "teamMembers_29"));
```
`readData()` reads from the workspace JSON manifest (a 135KB `contract.mjs` static file), **not the database**.

#### b) `localStorage` as data persistence layer:
```js
// Lines 372–382 — employees initialized from localStorage
const stored = localStorage.getItem('nucleus_custom_employees');
// Lines 392–394 — employees written to localStorage on mutation
localStorage.setItem('nucleus_custom_employees', JSON.stringify(updated));
```

#### c) Hardcoded mock records in `useState`:
```js
// Lines 133–163 — hardcoded attendance regularization records
const [attendanceRegularizations, setAttendanceRegularizations] = useState([
    { id: 'REG-2026-001', employee_id: 'EMP-101', employee_name: 'Arjun Sharma', ... },
    { id: 'REG-2026-002', employee_id: 'EMP-102', employee_name: 'Priya Nair', ... }
]);
```

#### d) DB API called as secondary fire-and-forget (not primary source of truth):
```js
// Pattern throughout: local state updated first, DB called as optional sync
setAttendanceRegularizations(prev => [...]);
try {
    const res = await fetch('/api/v1/regularizations', { ... }); // secondary
    if (res.ok) { newReg.dbId = json.data.id; }
} catch (e) { console.warn('...'); } // silently ignored
```

#### e) In-memory leave state (`createLeavePreviewService`):
The entire leave workflow in `HRMSContext.js` runs through `src/services/leave-workflow.ts` which is an **in-memory state machine** (`createLeavePreviewService`). DB persist is fire-and-forget:
```js
// Line 304-343: applyLeaveWithWorkflow
const result = await runLeave(state => createLeave(state, leaveActor, input)); // in-memory
try {
    const res = await fetch('/api/v1/leave-requests', ...); // secondary persist
} catch (err) { console.warn('Backend leave persist:', err); } // silently ignored
```

---

### ISSUE 2: `AuthContext.js` — localStorage Session Storage

**File**: [`src/context/AuthContext.js`](file:///run/media/thedhanraj/2TB-Part1/DhanrajWorkspace/MKraft/nucleus-suite/src/context/AuthContext.js)

```js
// Lines 82–99 — session restored from localStorage on mount
const raw = localStorage.getItem(SESSION_KEY); // 'nucleus_session'
// Lines 383–389 — session persisted to localStorage on login
localStorage.setItem(SESSION_KEY, JSON.stringify({ userData: nextUser, ... }));
```

> [!WARNING]  
> The auth session is stored as plain JSON in `localStorage`, bypassing the `better-auth` session infrastructure (which stores sessions in the `session` table in PostgreSQL). Role data, permissions, and user identity are read from this localStorage blob — a security boundary violation.

The actual `better-auth` server session (`src/lib/auth.ts`) is correctly implemented but the client is NOT using it as the session source of truth.

---

### ISSUE 3: `src/services/leave-workflow.ts` — Pure In-Memory Leave Engine

**File**: [`src/services/leave-workflow.ts`](file:///run/media/thedhanraj/2TB-Part1/DhanrajWorkspace/MKraft/nucleus-suite/src/services/leave-workflow.ts)

The comment on line 568 explicitly acknowledges:
```js
/** A single serialized in-memory adapter. Replace this port with authenticated HTTP after backend approval. */
export function createLeavePreviewService(initial: LeaveState) {
```

This is used directly by `HRMSContext.js` as the leave state engine. All balance deductions and approvals run in-memory and are lost on page refresh unless the DB sync succeeds.

---

### ISSUE 4: `src/services/establishmentService.js` — Hardcoded Data Constants

**File**: [`src/services/establishmentService.js`](file:///run/media/thedhanraj/2TB-Part1/DhanrajWorkspace/MKraft/nucleus-suite/src/services/establishmentService.js)

Contains exported constants used directly in `HRMSContext.js`:
```js
export const INITIAL_ASSET_REGISTER = [...]; // hardcoded asset records
export const LETTER_TEMPLATES = {...}; // hardcoded letter templates  
export const INITIAL_RECOGNITIONS = [...]; // hardcoded recognition records
export const INITIAL_REFERRALS = [...]; // hardcoded referral records
export const DEFAULT_SANCTIONED_QUOTAS = {...}; // hardcoded dept quotas
```

---

### ISSUE 5: `src/services/erpAndComplianceService.js` — Hardcoded Mock Data

**File**: [`src/services/erpAndComplianceService.js`](file:///run/media/thedhanraj/2TB-Part1/DhanrajWorkspace/MKraft/nucleus-suite/src/services/erpAndComplianceService.js)

Contains:
```js
export const INITIAL_ERP_SYNC_LOGS = [...]; // mock ERP sync history
export const INITIAL_ERP_POSTING_QUEUE = [...]; // mock posting queue
export const INITIAL_STATUTORY_ACCIDENTS_FORM18 = {...}; // mock form data
export const INITIAL_INSPECTION_BOOK_FORM36 = {...}; // mock inspection data
```

---

### ISSUE 6: Workspace Contract — 135KB Static JSON Manifest

**File**: [`src/server/workspace/contract.mjs`](file:///run/media/thedhanraj/2TB-Part1/DhanrajWorkspace/MKraft/nucleus-suite/src/server/workspace/contract.mjs)  
**Size**: 135,173 bytes

This is the data source for all `readData()` calls across the entire context layer. The `getWorkspaceData()` function in `repository.ts` does augment it with live DB data, but the static manifest still provides most of the default/fallback values that populate React `useState()` on first render.

---

## 4. Service Coverage Gap Map

The 118 API route families defined in the manifest have implementations, but the **frontend components are NOT consistently calling them**. Instead they rely on `HRMSContext.js` which reads from the workspace JSON manifest.

| Module | Has API Route | Has Server Service | Frontend Uses DB API |
|---|---|---|---|
| People/Employees | ✅ | ✅ | ⚠️ Partial (sync only) |
| Leave Requests | ✅ | ✅ | ⚠️ Fire-and-forget |
| Leave Balances | ✅ | ✅ | ❌ Still in-memory |
| Attendance | ✅ | ✅ | ⚠️ Partial (regularizations) |
| Gate Passes | ✅ | ✅ | ⚠️ Fire-and-forget |
| Payroll Runs | ✅ | ✅ | ❌ Not wired to UI |
| Loans | ✅ | ✅ | ⚠️ Partial (sync only) |
| Requisitions/Positions | ✅ | ✅ | ⚠️ Partial (sync only) |
| Assets | ✅ | ✅ | ⚠️ Fire-and-forget |
| Announcements | ✅ | ✅ | ⚠️ Partial (sync only) |
| Recognition/Referrals | ✅ | ✅ | ❌ Using hardcoded constants |
| Time Office Ledger | ❌ N/A | ❌ | ❌ Pure in-memory |
| Compensation | ✅ | ✅ | ❌ Not wired |
| Recruitment Pipeline | ✅ | ✅ | ❌ Not wired |
| Performance/OKRs | ✅ | ✅ | ❌ Not wired |
| Learning | ✅ | ✅ | ❌ Not wired |

---

## 5. What IS Working Correctly (DB-First)

These flows are fully real-DB-backed end-to-end:

1. **Authentication**: `better-auth` → sessions stored in `session` table
2. **Tenant provisioning**: Platform admin → `tenants` + `memberships` tables
3. **Employee Create** via the "Add Person" form → calls `POST /api/v1/people` → `employees` table insert with audit event
4. **Leave submit** via API clients using Idempotency-Key → `leave_requests` + `leave_ledger_entries` + `transactional_outbox`
5. **Leave decision** → `leave_approvals` update, ledger debit/release
6. **Payroll run** create → `payroll_runs` table
7. **Org tree** → live query of `departments`, `positions`, `locations`
8. **Import preview/apply** → bulk employees table inserts

---

## 6. Priority Remediation Plan

### P0 — Critical (Must Fix for Production)

1. **Replace `HRMSContext.js` leave state** with a proper data-fetching layer:
   - Remove `createLeavePreviewService` from the frontend
   - Replace with `useSWR` or `React Query` calls to `GET /api/v1/leave-requests` and `GET /api/v1/leave-balances`
   - All mutations should call the API first, then revalidate

2. **Replace `AuthContext.js` localStorage session** with `better-auth` client session:
   - Use `useSession()` from `@/lib/auth-client` (already exists at `src/lib/auth-client.ts`)
   - Remove `SESSION_KEY` / `ACTIVITY_KEY` localStorage pattern

3. **Remove hardcoded mock records** from `HRMSContext.js` lines 133–163 (regularizations)

4. **Remove `localStorage.setItem('nucleus_custom_employees', ...)`** — employee state must come from the DB exclusively

### P1 — High (Required for Real Data)

5. Wire attendance/time-office to real API endpoints instead of in-memory `useState`
6. Wire recognition awards, referrals to `POST /api/v1/recognition-events`, `POST /api/v1/referrals`
7. Wire compensation, recruitment pipeline, performance pages to their respective real API routes

### P2 — Medium

8. Remove `INITIAL_ASSET_REGISTER`, `INITIAL_RECOGNITIONS`, `INITIAL_REFERRALS` from `establishmentService.js` — replace with API-fetched data
9. Remove `INITIAL_ERP_SYNC_LOGS`, `INITIAL_ERP_POSTING_QUEUE` from `erpAndComplianceService.js`
10. Audit `src/server/workspace/contract.mjs` to identify fields still not backed by real DB queries and migrate them

---

## 7. Database Schema Gaps

The following tables are referenced in service code but were created with the generic JSONB-only pattern (not typed normalized columns). They need proper column migrations for production performance:

- `requisitions` — `department_id`, `hiring_manager_employee_id`, `attributes` only
- `courses`, `enrollments`, `learning_paths` — JSONB only
- `feed_posts`, `recognition_events`, `referrals` — JSONB only
- `leave_types` — only `id`, `tenant_id`, `attributes`
- `asset_catalog`, `asset_assignments` — JSONB only

The `leave` service already works around this by storing typed data as JSONB keys (e.g., `attributes->>'code'`), which works but is slower and harder to query/index.
