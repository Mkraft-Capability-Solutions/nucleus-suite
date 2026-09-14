# Military-Grade Enterprise Service Architecture

> **System:** Nucleus HRMS Enterprise SaaS Platform  
> **Security Classification:** Restricted / Enterprise Production Specification  
> **Architecture Style:** Hexagonal Domain-Driven Modular Services  
> **Primary Stack:** Next.js, TypeScript, MUI v7, PostgreSQL, Drizzle ORM, Better-Auth  
> **Target Reliability Budget:** 99.99% Availability | Zero-Trust Isolation | Deterministic Auditability

---

## 1. Architectural Philosophy & Guiding Principles

The Nucleus HRMS enterprise service architecture is engineered to military-grade standards, ensuring resilient operations, bulletproof tenant isolation, strict data consistency, and deterministic execution across high-volume human resource workflows.

```
                  +---------------------------------------+
                  |         Client Experience Layer       |
                  |  (Next.js App Router, MUI v7, i18n)   |
                  +-------------------+-------------------+
                                      |
                      Secure HTTPS / TLS 1.3 / mTLS
                                      |
                  +-------------------v-------------------+
                  |       Zero-Trust Security Gateway     |
                  |   Rate Limiting | WAF | CSP | CORS    |
                  +-------------------+-------------------+
                                      |
                  +-------------------v-------------------+
                  |     Authentication & ABAC Evaluator   |
                  | Better-Auth | Session Vault | Context |
                  +-------------------+-------------------+
                                      |
          +---------------------------+---------------------------+
          |                                                       |
+---------v---------+  +-------------------+  +-------------------v---+
|  Synchronous Core |  | Domain Operations |  | Asynchronous Services|
|  - People Core    |  |  - Compliance     |  |  - Outbox Dispatcher  |
|  - Attendance     |  |  - Recruitment    |  |  - Job Queue Worker   |
|  - Leave Engine   |  |  - Performance    |  |  - Webhook Replay     |
|  - Payroll Engine |  |  - Contractors    |  |  - AI Agent Workflows |
+---------+---------+  +---------+---------+  +-----------+-----------+
          |                      |                        |
          +----------------------+------------------------+
                                 |
                  +--------------v--------------+
                  |    Domain Data Access Layer |
                  |    Drizzle ORM Type-Safe DAL|
                  +--------------+--------------+
                                 |
                  +--------------v--------------+
                  |    PostgreSQL Multi-Tenant  |
                  |    Schema + RLS Policies    |
                  +-----------------------------+
```

### Core Architecture Axioms

1. **Zero-Trust Security**: No request is trusted implicitly. Every service boundary validates tenant context, actor authorization (RBAC & ABAC), and schema conformance before executing business logic.
2. **Deterministic State Transitions**: All business lifecycle transitions (e.g. Leave, Payroll Runs, Regularizations, Hiring Funnels) are implemented as strict finite state machines with guard conditions and immutable audit logs.
3. **Idempotency by Design**: All mutating operations accept or generate unique idempotency keys, guaranteeing safe replay and preventing duplicate actions or double disbursements.
4. **Transactional Outbox Pattern**: External side effects (webhooks, email dispatch, notification pushes, third-party ERP sync) are recorded transactionally with business state changes and dispatched asynchronously.
5. **Multi-Tenant Boundary Enforcement**: Tenant data is segregated at the PostgreSQL Row Level Security (RLS) and connection-context level. Cross-tenant leakage is architecturally impossible.

---

## 2. Comprehensive Domain Service Catalog

Nucleus HRMS is structured into **14 discrete domain service modules**, each maintaining encapsulated models, validation schemas, business logic engines, and API endpoints.

```
src/
├── modules/                        # Domain Module Packages
│   ├── platform/                   # Tenant, legal entity, location masters
│   ├── people/                     # Employee directory, assignments, dossier
│   ├── attendance/                 # Biometric pairing, shift roster, regularizations
│   ├── leave/                      # Leave policies, balance ledgers, sandwich rules
│   ├── payroll/                    # 8-stage payroll control room, formula engine
│   ├── tax-compliance/             # Statutory wage codes, Form 16, PF/ESI/PT returns
│   ├── recruitment/                # ATS requisition pipeline, candidate match
│   ├── onboarding/                 # Checklists, document verification, provisioning
│   ├── performance/                # 9-box calibration, OKR cascade, 360 feedback
│   ├── learning/                   # Skill evidence, certifications, LMS courses
│   ├── helpdesk/                   # SLA service desk, ticket routing, escalation
│   └── contractors/                # Agency master, rate cards, vendor compliance
├── server/                         # Server-Only Domain Services
│   ├── identity/                   # Auth lifecycle, session tokens, RBAC/ABAC
│   ├── jobs/                       # Outbox workers, scheduled tasks, cron runners
│   └── ai/                         # RAG knowledge base, policy evals, assistant
```

---

### Domain Service Matrix

| Module | Primary Service Responsibility | Invariants & Business Logic | Primary API Endpoints |
| :--- | :--- | :--- | :--- |
| **`platform`** | Multi-entity corporate topology, site masters, geofenced work sites. | Enforces valid incorporation records (CIN/LLPIN/PAN/TAN). | `/api/v1/platform/tenants`<br>`/api/v1/organization/tree` |
| **`people`** | Master employee registry, profile dossiers, department hierarchies. | Strict reporting hierarchy; prevents circular reporting loops. | `/api/v1/people`<br>`/api/v1/people/[id]` |
| **`attendance`** | Biometric punches, paired intervals, shift rosters, overtime computation. | Auto-deducts statutory meal breaks; enforces OT caps per jurisdiction. | `/api/v1/attendance/punches`<br>`/api/v1/attendance/days` |
| **`leave`** | Accrual ledger, 4-tier approval state machine, FIFO comp-off expiry. | Prevents overlapping leaves, sandwich-rule debit calculation. | `/api/v1/leave-requests`<br>`/api/v1/leave-balances` |
| **`payroll`** | 8-stage payroll control room, gross-to-net formulas, arrears. | Immutable calculation snapshot upon lock; blocking exception gates. | `/api/v1/payroll-runs`<br>`/api/v1/payslips/[id]` |
| **`tax-compliance`** | Central wage codes (50% wage floor), PF, ESI, PT, and TDS computation. | Real-time statutory ceiling check and remittance validation. | `/api/v1/compliance/forms`<br>`/api/v1/wage-simulations` |
| **`recruitment`** | Headcount requisitions, candidate stage progression, interview scoring. | Approval matrix for new reqs; encrypted candidate resume storage. | `/api/v1/requisitions`<br>`/api/v1/candidates` |
| **`onboarding`** | Pre-boarding checklist, asset allocation, statutory document collection. | Automated task dispatch and readiness gates before day 1. | `/api/v1/onboarding/instances`<br>`/api/v1/offers` |
| **`performance`** | OKR cascade, 9-box grid calibration, appraisal review cycles. | Bias-flag evaluation; multi-reviewer calibration sessions. | `/api/v1/objectives`<br>`/api/v1/review-cycles` |
| **`learning`** | Skill competency matrix, course enrollments, certification proofs. | Auto-verification of skill evidence and external LMS completion. | `/api/v1/courses`<br>`/api/v1/skill-evidence` |
| **`helpdesk`** | HR ticketing, SLA tracking, priority escalation, knowledge routing. | Deterministic SLA timer calculation based on work calendar. | `/api/v1/feedback`<br>`/api/v1/feedback/entries` |
| **`contractors`** | Contingent workforce management, vendor rate cards, billing invoices. | Third-party PF/ESIC proof verification prior to invoice clearance. | `/api/v1/contractors/agencies`<br>`/api/v1/contractors/invoices` |
| **`analytics`** | Governed MIS reporting, telemetry scoping, workforce metrics. | Role-scoped row and column redaction for sensitive compensation. | `/api/v1/analytics/metrics`<br>`/api/v1/reports/team-history` |
| **`ai`** | Enterprise policy assistant, automated document analysis, workflow routing. | RAG retrieval gated by user role permissions; prompt injection defense. | `/api/v1/ai/runs`<br>`/api/v1/ai/actions` |

---

## 3. Security, Authentication & ABAC Governance

### Authentication Architecture
* **Engine**: Better-Auth integrated with PostgreSQL persistence via Drizzle adapter.
* **Token Vault**: Cryptographically signed SHA-256 session tokens with strict SameSite cookie policies (`SameSite=Lax`, `HttpOnly`, `Secure`).
* **Session Lifetime**: 7-day maximum rolling session with explicit single-device and all-devices token revocation endpoints (`/api/auth/sign-out`).

### ABAC Evaluation Pipeline ([src/core/permissions/abac-engine.ts](file:///Users/dhanraj/dhanraj/DFS/workspace/MKraft/nucleus-suite/src/core/permissions/abac-engine.ts))

```mermaid
graph LR
    Req[Incoming Request] --> Auth[Authenticate Actor]
    Auth --> Role[Load Base RBAC Permissions]
    Role --> Tenant[Check Tenant Context ID]
    Tenant --> Scope[Evaluate Data Scopes (Dept / Location / Entity)]
    Scope --> State[Evaluate Entity Status & Owner]
    State --> Decision{Permitted?}
    Decision -- Yes --> Exec[Execute Domain Logic]
    Decision -- No --> Reject[403 Forbidden / Audit Log]
```

---

## 4. Internationalization (i18n) Engine

Nucleus HRMS implements a framework-wide localization engine with **11 supported languages** ([src/locales/](file:///Users/dhanraj/dhanraj/DFS/workspace/MKraft/nucleus-suite/src/locales)):

* **International Languages**: English (`en`), Spanish (`es`), French (`fr`), German (`de`), Japanese (`ja`), Arabic (`ar` — RTL enabled).
* **Indian Languages**: Hindi (`hi`), Tamil (`ta`), Telugu (`te`), Bengali (`bn`), Marathi (`mr`).

### Localization Resilience Guarantee
* **Modular Slices**: Translations are segmented by domain (`common`, `auth`, `leave`, `attendance`, `payroll`, `people`, `navigation`, `validation`).
* **Automatic Fallback Hierarchy**: `Requested Locale Key` $\rightarrow$ `Default Language (en) Key` $\rightarrow$ `Namespace.Key Identifier`.
* **Zero Runtime Crashes**: Missing keys or untranslated parameter values never throw runtime errors or render empty components.

---

## 5. Persistence, Migrations & Database Design

### Schema Standard ([src/lib/db/schema.ts](file:///Users/dhanraj/dhanraj/DFS/workspace/MKraft/nucleus-suite/src/lib/db/schema.ts))
* Built with PostgreSQL types (`uuid`, `timestamp with time zone`, `numeric(12,2)`, `jsonb`, `text`).
* Immutable timestamps (`created_at`, `updated_at`) on all tables.
* Foreign keys configured with explicit referential actions (`RESTRICT` on financial/payroll records, `CASCADE` on ephemeral sessions).

### Local & Enterprise PostgreSQL Topology
```env
# Local Database Configuration
DATABASE_URL=postgresql://root:H%40rH%40rMahad3v@localhost:5432/nucleus_hrms
MIGRATION_DATABASE_DRIVER=postgres
MIGRATION_DATABASE_URL=postgresql://root:H%40rH%40rMahad3v@localhost:5432/nucleus_hrms
```

* **Drizzle Kit Tooling**: Run `npm run db:generate` to generate incremental SQL migration files under `db/migrations/`.
* **Migration Runner**: Execute `npm run db:migrate` for deterministic schema updates with SHA-256 migration hash validation.

---

## 6. Asynchronous Jobs & Outbox Reliability

```mermaid
sequenceDiagram
    participant App as Domain Service
    participant DB as PostgreSQL Transaction
    participant Outbox as outbox_jobs Table
    participant Worker as Background Task Worker
    participant Ext as Webhook / Email Service

    App->>DB: BEGIN Transaction
    App->>DB: Mutate Business State (e.g., Approve Leave)
    App->>Outbox: INSERT Job (LEAVE_APPROVED_EVENT)
    DB-->>App: COMMIT
    Worker->>Outbox: Poll & Lock Pending Jobs (SKIP LOCKED)
    Worker->>Ext: Dispatch Webhook / Notification
    Ext-->>Worker: HTTP 200 OK
    Worker->>Outbox: UPDATE status = 'COMPLETED'
```

* **Reliability**: Guarantees at-least-once delivery of notifications and webhooks.
* **Dead-Letter Handling**: Automatic retry with exponential backoff up to 5 attempts before quarantine in `failed_jobs`.

---

## 7. Quality Gate Standards & Verification Matrix

Every change to the service layer must pass the full 5-stage automated quality gate:

```bash
# 1. Static Type Checking
npm run typecheck

# 2. Strict Linter Validation
npm run lint

# 3. Comprehensive Unit & Domain Service Tests
npm test

# 4. End-to-End Navigation & UI Integrity Tests
npm run test:ui

# 5. Production Compiler & Route Optimization
npm run build
```

* **Zero-Warning Tolerance**: Builds failing linter or TypeScript typecheck are rejected immediately.
* **Coverage Mandate**: 100% test pass rate across all 808+ unit/service tests and 32 UI integration suites.
