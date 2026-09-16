# Architecture Document: Bifurcated Modular Monolith HRMS

## 1. System Topology & Architectural Design

This architecture uses a Bifurcated Modular Monolith design pattern. The platform splits along technical deployment boundaries (Frontend vs. Backend) while grouping business capabilities together (Vertical Slicing) inside the server layer.

```text
[ NEXT.JS APP ROUTER ENGINE ] (src/app)
          │
     (Resolves Localisation & Multi-Tenant Middleware Routing)
          │
          ├──► Rendering Views (Server / Client Components)
          └──► Execution Entry Points (Next.js Server Actions / Route Handlers)
                    │
                    ▼
[ BIFURCATED BACKEND DOMAIN CORE ] (src/server)
          │
          ▼ (Tenant Feature Subscription Checks Applied Here)
          │
    ┌─────┴──────────────────────────────────────────────────────┐
    ▼ [Module 1: Core HR]        ▼ [Module 2: Payroll Add-on]    ▼ [Modules 3-10]
 ┌────────────────────────┐   ┌────────────────────────┐
 │ 📦 Application Layer   │   │ 📦 Application Layer   │
 │   └─ Orchestrates DB   │   │   └─ Orchestrates DB   │
 │         │              │   │         │              │
 │         ▼              │   │         ▼              │
 │ 🧠 Core Domain Layer   │   │ 🧠 Core Domain Layer   │
 │   └─ Pure Law / Rules  │   │   └─ Pure Law / Rules  │
 └────────────────────────┘   └────────────────────────┘
```

**Why this approach wins for a 10-Module Multi-Tenant SaaS:**
- **Absolute Security Boundaries:** By confining database queries, raw data calculations, and tenant validation logic exclusively to `src/server/`, it becomes impossible to accidentally import a server file into a "use client" web page. Next.js will catch and block any invalid compilation attempts at build time.
- **On-Demand Module Composition:** Because your modules are vertically sliced within `src/server/`, the main `src/app/` rendering layouts can inspect active subscriber flags from the tenant session and dynamically mount or unmount entire module engines cleanly.

## 2. Definitive Repository Architecture

```text
root/
├── public/
│   └── locales/                      # i18n Strategy: Split by Feature Namespace
│       ├── en/
│       │   ├── core-hr.json
│       │   └── payroll.json
│       └── es/
│
├── src/
│   ├── app/                          # FRONTEND SHELL: DELIVERY & ROUTING ONLY
│   │   ├── [locale]/                 # Dynamic Route Localisation Group
│   │   │   ├── layout.tsx            # Multi-Tenant Layout Engine (Injects Theme/Tenant Data)
│   │   │   ├── middleware.ts         # Edge Interceptor: Subdomains + SaaS Module Feature Flags
│   │   │   └── (dashboard)/          # Authenticated App Workspace
│   │   │       ├── core-hr/
│   │   │       │   ├── page.tsx      # Entry view: Triggers Server Actions / API
│   │   │       │   └── actions.ts    # Direct HTTP form handler; forwards strictly to server layer
│   │   │       └── payroll/
│   │   │           ├── page.tsx
│   │   │           └── actions.ts
│   │   └── api/                      # System Webhooks (Stripe / Auth0 / SAML Identity logs)
│   │
│   ├── components/                   # CONTEXT-FREE CLIENT DESIGN PARITY
│   │   ├── ui/                       # Atomic Design components (Buttons, Inputs, Modals)
│   │   └── shared/                   # Composite Data Tables, Multi-Tenant Shell sidebars
│   │
│   ├── hooks/                        # SWR / React Query Data Fetching Hooks
│   │
│   ├── server/                       # BACKEND ENGINE: THE ISOLATED SAAS VERTICAL SLICES
│   │   ├── core-hr/                  # Module 1 (The Core HR Foundation Base)
│   │   │   ├── core/                 # [INNER RING] Pure TypeScript Domain Logic & Zod Rules
│   │   │   │   ├── onboardingWorkflow.ts
│   │   │   │   └── employeeModel.ts
│   │   │   └── application/          # [MIDDLE RING] Services, Use-Cases, & Database Access
│   │   │       ├── employeeService.ts
│   │   │       └── repository.ts     # SQL / Prisma Data Mapper queries
│   │   │
│   │   ├── payroll/                  # Module 2 (Pluggable Premium Add-on Engine)
│   │   │   ├── core/                 # [INNER RING] Framework-Agnostic Calculations
│   │   │   │   ├── rule-pack.ts      # (e.g., "Overtime calculations, dynamic local tax laws")
│   │   │   │   └── simulator.ts
│   │   │   └── application/          # [MIDDLE RING] Execution layer Orchestrator
│   │   │       ├── payrollService.ts # Verifies subscription -> Runs tenant transaction
│   │   │       └── repository.ts     # Scoped SQL execution block
│   │   │
│   │   ├── [remaining-8-modules]/    # Modules 3 through 10 structured identically
│   │   │
│   │   └── shared/                   # Global Backend Core Extensions
│   │       ├── db/                   # Database Base Clients & Client Context Wrappers
│   │       │   ├── prisma.ts
│   │       │   └── rls-policy.ts     # Automated Row Level Security Tenant-Context Injection
│   │       └── security/
│   │           └── subscriptionGuard.ts # Centralized verification for SaaS Module Entitlements
│   │
│   └── shared/                       # Global Constants, Shared Interfaces, Error Classes
```

## 3. Structural Governance & Compliance Rules

To prevent this bifurcated setup from decaying into a messy structure over time, you must establish three unyielding rules within your codebase:

1. **The Server Isolation Rule:** Files located inside `src/server/` are prohibited from importing anything from `src/app/`, `src/components/`, or `src/hooks/`. The server layer should remain completely unaware of your application's UI.
2. **The Layered Execution Flow:** Data must only flow one way during a request cycle.
   `Page View (app) -> Server Action (app) -> Application Service (server) -> Core Domain Rule (server)`
   UI layers must never call `src/server/<module>/core/` functional calculations directly without passing through the containing `application/` service block. This ensures security and multi-tenant subscription validation logic run properly before any processing happens.
3. **The Base Dependency Inversion:** Optional addon slices inside `src/server/` (e.g., payroll) are permitted to read types and common schemas from the foundational `core-hr` slice. However, the foundational `core-hr` module must never import code from any optional add-on modules.
