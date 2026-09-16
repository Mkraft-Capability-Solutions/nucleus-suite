# Client/Server Architectural Boundary Rule

> **Scope:** Architecture & Bundler Integrity  
> **Source:** Next.js 15 App Router Specification & Nucleus Dual-Engine Pattern

---

## 1. The Core Architectural Rule

In Nucleus HRMS, **`src/services/` and `src/server/` serve two fundamentally different execution contexts**:

```text
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER LAYER                     │
│  "use client" Components (AttendanceView, LeaveDialog, etc.)│
│                            │                                │
│                            ▼                                │
│                 src/services/ (CLIENT ONLY)                 │
│  • Instant calculation & math preview (<10ms)               │
│  • workspace-data.mjs (readData UI boundary)                │
│  • Pure TypeScript/JavaScript (NO Node.js/DB imports)       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP POST / PATCH via fetch()
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER RUNTIME LAYER                    │
│            Next.js Server Actions (src/app/actions/*)        │
│                            │                                │
│                            ▼                                │
│                  src/server/ (SERVER ONLY)                  │
│  • import "server-only";                                    │
│  • Neon PostgreSQL pooler connection (@neondatabase)        │
│  • tenantTx() multi-tenant transaction isolation            │
│  • Zod request validation, ACID persistence, audit logs     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Why `src/services/` Must NOT Be Merged into `src/server/`

1. **Next.js Bundler Crash (`server-only`)**:
   Modules in `src/server/` declare `import "server-only";` and import server database drivers (`@neondatabase/serverless`). If client components import from `src/server/`, the Next.js webpack/turbopack compiler throws a fatal error:
   ```text
   Error: You're importing a component that needs "server-only". That only works in a Server Component which is not supported in the client.
   ```
2. **Over 84 Client Components Depend on `src/services/`**:
   `workspace-data.mjs` (`readData()`), `timeOfficeEngine.js`, `leaveEngine.js`, and `autoLeaveCreditEngine.js` are imported across 84+ UI views. Moving them to `src/server/` breaks client bundle compilation across the entire application.
3. **Dual-Engine Competitive Superiority**:
   Workday HCM requires slow server roundtrips for basic calculations. Nucleus HRMS delivers instant client feedback (<10ms) for sandwich rules, punch pairing, and loan eligibility, followed by authoritative transactional persistence in `src/server/`.

---

## 3. Directory Conventions

- **`src/services/`**: Client calculation engines, UI data adapters, client fetchers, `workspace-data.mjs`.
- **`src/server/`**: Authoritative domain business logic, Neon PostgreSQL Drizzle queries, tenant isolation, and transactional workflows.
- **`src/app/actions/`**: Server Actions connecting client forms to `src/server/`.
