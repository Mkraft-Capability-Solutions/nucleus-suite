# Nucleus HRMS — Master Enterprise Plan & Architectural Catalog

> **Repository:** Nucleus HRMS (Private Enterprise HRMS SaaS)  
> **Current Phase:** LOCAL JSON UI VALIDATION PHASE (Governed by `AGENTS.md`)  
> **Primary Framework:** Next.js 16 (App Router), React 19, MUI v7 + TypeScript  
> **Authority:** This document consolidates all enterprise planning, domain services, service contracts, QA requirements, and architectural roadmaps.

---

## Table of Contents
1. [Executive Summary & Multi-Tenant Foundations](#1-executive-summary--multi-tenant-foundations)
2. [Target 3NF Architecture & Domain Seams](#2-target-3nf-architecture--domain-seams)
3. [35 Domain Services & Boundary Contracts](#3-35-domain-services--boundary-contracts)
4. [India & Global Statutory Payroll Engine](#4-india--global-statutory-payroll-engine)
5. [UI/UX Motion, Palette & Responsive Tokens](#5-uiux-motion-palette--responsive-tokens)
6. [Form Validation, Safety Guards & Invariants](#6-form-validation-safety-guards--invariants)
7. [Enterprise Quality Assurance, Matrix & Release Gates](#7-enterprise-quality-assurance-matrix--release-gates)
8. [Master Implementation Reference](#8-master-implementation-reference)

---

## 1. Executive Summary & Multi-Tenant Foundations

Nucleus HRMS is architected as an enterprise multi-tenant HRMS SaaS platform. In accordance with `AGENTS.md`, the platform operates strictly in the **LOCAL JSON UI VALIDATION PHASE**:
- **Data Boundary:** Asynchronous UI data contracts consume snapshot services (`src/services/workspace-data.mjs` / `readData`).
- **Dormant Infrastructure:** Backend databases (PostgreSQL/Drizzle), external payment gateways, SMS/Email delivery, and live cloud APIs remain dormant until explicit phase transition authorization.
- **Tenant Isolation:** All mutations and queries enforce tenant scoping (`tenantId`). Cross-tenant leakage is strictly blocked by code invariants (`INV-SEC-01`).

---

## 2. Target 3NF Architecture & Domain Seams

The platform architecture is structured across 14 decoupled domains:

```
src/
├── app/                    # App router routes & page layouts
│   ├── (website)/          # Public landing, pricing, docs, contact
│   ├── (auth)/             # Login, registration, SSO redirect
│   ├── (workspace)/        # Authenticated multi-tenant workspace
│   └── api/                # Dormant REST endpoints & contract routes
├── components/             # Reusable UI component layer
│   ├── Clerio/             # Core HR views, consoles, and wizards
│   ├── Leave/              # Leave application dialog, workflow panel, ledger
│   └── Dashboard/          # Dynamic customizable dashboard grid
├── context/                # React Contexts (HRMSContext, I18nContext, ThemeContext)
├── data/                   # JSON snapshot data & catalogs
│   └── ui/                 # Picklists catalog, navigation catalog, manifests
├── lib/                    # Shared pure business logic & helpers
└── server/                 # Domain services & dormant backend logic
```

---

## 3. 35 Domain Services & Boundary Contracts

Every feature boundary is encapsulated in dedicated server domain services:

| Domain | Service Path | Primary Scope & Functionality |
| :--- | :--- | :--- |
| **PLT** | `src/server/platform/` | Tenant provisioning, legal entities, licensing, branding |
| **ORG** | `src/server/organization/`| Business units, departments, positions, job bands, org trees |
| **PPL** | `src/server/organization/people.ts` | Employee 360 master profiles, personal identity, assignments |
| **ATT** | `src/server/attendance/` | Punch pairing, biometric ingestion, shift rosters, overtime |
| **LEV** | `src/server/leave/` | Leave requests, accrual engines, FIFO comp-off expiry |
| **PAY** | `src/server/payroll/` | Gross-to-net salary computation, bank NEFT disbursement files |
| **TAX** | `src/server/compliance/` | PF, ESI, PT, LWF, Income Tax Form 12BB, Section 115BAC |
| **BEN** | `src/server/benefits/` | Group medical insurance, flexi-benefits, claims |
| **LOA** | `src/server/loans/` | Employee company loans, salary advances, EMI deductions |
| **REC** | `src/server/talent/` | Requisitions, candidate pipelines, interview scorecards |
| **ONB** | `src/server/lifecycle/` | Digital pre-boarding, IT asset allocation, buddy tasks |
| **PMS** | `src/server/performance/` | OKRs, 9-box calibration, peer 360 reviews |
| **LRN** | `src/server/learning/` | Training catalogs, course assignments, certifications |
| **HLP** | `src/server/governance/` | Helpdesk ticketing, SLA escalation queues, POSH grievance |
| **AI**  | `src/server/ai/` | Sandboxed AI agents, policy assistant, audit ledgers |

---

## 4. India & Global Statutory Payroll Engine

The gross-to-net payroll engine adheres to statutory wage rules:
1. **Minimum Wage & Wage Floor (`INV-PAY-01`):** Basic + DA $\ge$ 50% of Total Remuneration under Code on Wages.
2. **Provident Fund (PF):** 12% of Basic + DA capped at ₹15,000 statutory limit unless VPF is opted.
3. **Employee State Insurance (ESI):** 0.75% employee and 3.25% employer contribution for gross wages $\le$ ₹21,000/month.
4. **Professional Tax (PT) & LWF:** State-specific slab calculation (e.g., Karnataka, Maharashtra, Delhi).
5. **Income Tax TDS:** Dual regime tax computation (New Regime Section 115BAC vs Old Regime with Chapter VI-A deductions).

---

## 5. UI/UX Motion, Palette & Responsive Tokens

The application design standard enforces rich aesthetics, fluid transitions, and WCAG AA accessibility:
- **4 Persistent Theme Palettes:** Pearl violet, Graphite night (dark mode), Slate blue, Sage teal.
- **Micro-Interactions:** Smooth CSS transforms, GPU-friendly opacity transitions, reduced-motion compliance (`prefers-reduced-motion`).
- **Responsive Layouts:** Adaptive multi-breakpoint grid supporting mobile, tablet, laptop, and 4K ultra-wide monitors.

---

## 6. Form Validation, Safety Guards & Invariants

All operational forms enforce strict validation schemas:
- **`INV-LEV-01`:** Paid leave balance non-negativity constraint.
- **`INV-LEV-02`:** Prohibition of overlapping active leave spans.
- **`INV-ATT-01`:** Chronological order of biometric In-Punch before Out-Punch.
- **`INV-SEC-02`:** Prohibition of self-approval for leaves, expenses, or salary revisions.

---

## 7. Enterprise Quality Assurance, Matrix & Release Gates

All code commits must pass the 5-step automated verification gate:
1. `npm run typecheck` — 0 TypeScript errors under strict compilation.
2. `npm run lint` — 0 ESLint errors and warnings with React 19 compiler.
3. `npm test` — Vitest unit & domain contract suite (806+ green tests).
4. `npm run test:ui` — UI contract & workbook mapping test suite (32/32 green tests).
5. `npm run build` — Next.js Turbopack optimized production build.

---

## 8. Master Implementation Reference

For the detailed 50-form breakdown, 909-field inventory, 119 picklists, 107 process lifecycles, and 9 cross-boundary swimlane maps, refer to:
👉 **[plan/implementation/MASTER_IMPLEMENTATION_PLAN V1.0.md](file:///Users/dhanraj/dhanraj/DFS/workspace/MKraft/nucleus-suite/plan/implementation/MASTER_IMPLEMENTATION_PLAN%20V1.0.md)**
