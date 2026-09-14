# Nucleus HRMS — Comprehensive System Analysis & Master Implementation Plan

> **File Location:** `plan/implementation/MASTER_IMPLEMENTATION_PLAN.md`  
> **Repository:** Private HRMS SaaS (Nucleus Suite)  
> **Current Phase:** Local JSON UI Validation / Prototype Phase  
> **Author:** Antigravity AI Pair Programming System  
> **Date:** September 14, 2026  
> **Status:** Active Engineering Document  

---

## Table of Contents

1. [Executive Summary & Scope](#1-executive-summary--scope)
2. [Deep Architectural Analysis of the Codebase](#2-deep-architectural-analysis-of-the-codebase)
   - 2.1 Technology Stack & Core Dependencies
   - 2.2 Directory Topology & Component Hierarchy
   - 2.3 Dual Navigation Paradigm & Role Consoles
   - 2.4 Data Architecture: Asynchronous Workspace Data Boundary
   - 2.5 35 Backend Domain Services & Outbox Architecture
   - 2.6 Security, Identity & Role-Based Access Control (RBAC)
3. [Exhaustive Audit of Discovered Issues & Technical Debt](#3-exhaustive-audit-of-discovered-issues--technical-debt)
   - 3.1 Critical Syntax & Typecheck Failures (TS1003 / TS1005)
   - 3.2 ESLint & React 19 Compiler Violations
   - 3.3 Out-of-Sync Data Manifest & Vitest Regression Failure
   - 3.4 Form Submission & Command Wiring Deficits
   - 3.5 Database Normalization Gaps (288 JSON Columns)
   - 3.6 Persona Linkage & Data Reconciliation Gaps
   - 3.7 Localization & Hardcoded UI Text Strings
4. [Master Implementation Roadmap & Phase-by-Phase Plan](#4-master-implementation-roadmap--phase-by-phase-plan)
   - Phase 0: Immediate Fixes & Quality Gate Restoration (Build & Test Green)
   - Phase 1: Local UI Validation, Navigation & Picklist Catalog Hardening
   - Phase 2: Leave Management & Time-Office Engine Complete Vertical Slice
   - Phase 3: Operational Workspaces & Governed MIS Reporting Hub
   - Phase 4: Domain Service Integration & Schema Normalization (Deferred Phase)
   - Phase 5: Localization, Accessibility & Enterprise Public Polish
5. [Requirement Traceability Matrix & Workbook Alignment](#5-requirement-traceability-matrix--workbook-alignment)
6. [Verification Protocol & Definition of Done](#6-verification-protocol--definition-of-done)

---

# 1. Executive Summary & Scope

Nucleus HRMS is an enterprise-grade Human Resource Management System (HRMS) SaaS platform designed for global multi-tenant deployments with an initial India-first statutory and compliance baseline. The application combines public brand storytelling, 10 executive/functional role consoles, 11 primary operational HR modules, AI copilots, and an extensive enterprise business process engine.

### Governing Rules & Development Phase (Per `AGENTS.md`)
- **Current Operational Mode:** **LOCAL JSON UI VALIDATION PHASE**.
- **Primary Objective:** Validate user journeys, information architecture, navigation, forms, field behaviors, validation rules, responsive UX, accessibility, and prototype data flows against the reference business process workbook (`Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx`).
- **Strict Boundary Constraint:** Production databases, cloud secrets, live migrations, live external APIs, payment processing, and SMS/Email dispatch remain **dormant/deferred** unless explicitly activated by environment flags. Live errors must never silently fall back to synthetic fixtures.

---

# 2. Deep Architectural Analysis of the Codebase

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                    Next.js 16 App                       │
                              │                 (App Router / Client)                   │
                              └────────────┬───────────────────────────────┬────────────┘
                                           │                               │
                       ┌───────────────────▼──────────────┐   ┌────────────▼──────────────────┐
                       │       Public Web Surface         │   │      Workspace Web Surface    │
                       │ (About, Contact, Features, Docs) │   │ (Consoles S01-S10, 11 Modules)│
                       └──────────────────────────────────┘   └────────────┬──────────────────┘
                                                                           │
                                            ┌──────────────────────────────┴──────────────────────┐
                                            │              Workspace Data Boundary                │
                                            │      (workspace-data.mjs / readData Snapshot)       │
                                            └──────────────────────────────┬──────────────────────┘
                                                                           │
                          ┌────────────────────────────────────────────────┼─────────────────────────────────┐
                          │                                                │                                 │
              ┌───────────▼─────────────┐                    ┌─────────────▼─────────────┐     ┌─────────────▼─────────────┐
              │   Demo Workbook Adapter │                    │   UI JSON Catalogs        │     │   35 Backend Services     │
              │  (Sheets / Live Rows)   │                    │ (Navigation, Picklists)   │     │ (src/server/* Drizzle)    │
              └─────────────────────────┘                    └───────────────────────────┘     └───────────────────────────┘
```

### 2.1 Technology Stack & Core Dependencies
- **Framework:** Next.js 16.3.5 (App Router with Server Components & `"use client"` boundaries).
- **Language:** TypeScript 5 + Modern ES Modules (`.mjs` / `.ts` / `.tsx`).
- **UI Components & Icons:** Material UI v7 (`@mui/material` v7.3.7), `@mui/icons-material`, Lucide React (`lucide-react` v0.563.0), `@base-ui/react`.
- **Motion & Visualization:** Framer Motion (`framer-motion` v12.29.2), Apache ECharts (`echarts` v6.1.0).
- **State & Context:** React 19 (`react` 19.2.3), React Context API (`HRMSContext`, `AuthContext`, `I18nContext`).
- **ORM & Data Layer:** Drizzle ORM (`drizzle-orm` v0.45.2), PostgreSQL driver (`pg` v8.23.0), `@better-auth/drizzle-adapter`.
- **AI & Automation:** LangChain (`langchain` v1.5.11, `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`).
- **Testing Suites:** Vitest (`vitest` v5.0.0), Node.js Test Runner (`node:test`), Playwright (`@playwright/test` v1.63.0).

### 2.2 Directory Topology & Component Hierarchy
```text
src/
├── app/                        # App Router entrypoints
│   ├── (website)/              # Public pages (about, contact, docs, features, why-nucleus)
│   ├── (workspace)/            # Authenticated workspace routes (/login, /workspace)
│   └── api/                    # Route handlers (auth, agent, v1 domain APIs, workspace-data)
├── components/                 # Reusable UI component libraries
│   ├── Clerio/                 # Core workspace views, forms, modals & drawer controllers
│   ├── Dashboard/              # 10 Role Consoles (S01–S10), widgets & focus cards
│   ├── Leave/                  # Leave calendar, request dialogs, balance cards & ledger
│   ├── Navigation/             # DualPaneNav, TopNav, LeftDock & SubNav components
│   ├── Website/                # Public marketing pages, hero animations & feature stories
│   ├── Charts/                 # ECharts wrappers and theme palettes
│   └── auth/                   # RoleProtected wrappers and login forms
├── context/                    # React Providers (AuthContext, HRMSContext, I18nContext)
├── data/                       # Prototype data fixtures, UI catalogs, workspace-manifest
│   └── ui/                     # 75+ JSON resource schemas for views and forms
├── hooks/                      # Custom hooks (useHRMS, useAuth, useTranslation, useAppearance)
├── lib/                        # Shared domain utilities, adapters, catalogs, validation
│   ├── db/                     # Drizzle schema definitions (332 tables across 20 migrations)
│   ├── form-validation.ts      # Enterprise form validation rules (length, bounds, dates)
│   ├── picklist-catalog.js     # Standardized 118+ Picklists master lookup engine
│   ├── demo-workbook-adapter.mjs # Excel-to-UI live data mapping adapter
│   └── operational-module-registry.js # Registry for operational screens and submodules
├── server/                     # 35 isolated backend domains (leave, attendance, payroll, talent, etc.)
├── services/                   # Service adapters (workspace-data, leave-workflow, leaveEngine, etc.)
└── utils/                      # Helper functions (CSV exporters, security sanitizer, permissions)
```

### 2.3 Dual Navigation Paradigm & Role Consoles
The application implements two distinct navigation models:
1. **10 Executive & Operational Consoles (S01–S10):**
   - `S01`: People Command Centre (CHRO / HR Executive overview)
   - `S02`: HR Operations Console (HR Specialist / Operations daily workflow)
   - `S03`: Attendance Intelligence (Shift roster, punches, biometric status)
   - `S04`: Talent Acquisition Hub (Recruiter, job pipeline, candidate stages)
   - `S05`: Payroll Control Room (Payroll specialist, batch runs, compliance)
   - `S06`: Performance & Talent Review (PMS, 9-box grid, OKR alignment)
   - `S07`: Manager Cockpit (Team approvals, 1-on-1s, leave sign-offs)
   - `S08`: Employee Self-Service Home (Attendance check-in, leaves, payslips)
   - `S09`: Magnetix Capability Matrix (Skills, training, certifications)
   - `S10`: Nucleus Intelligence / Superadmin (Tenant settings, audit, RBAC)
2. **11 Primary Operational Modules (with Submodules):**
   - People Core, Attendance & Shifts, Leave Management, Payroll & Finance, Recruitment, Onboarding & Lifecycle, Performance & Goals, Compensation & Benefits, Learning & Skills, Helpdesk & Service Desk, Compliance & Legal.

### 2.4 Data Architecture: Asynchronous Workspace Data Boundary
- Components read static and prototype data via the decoupled service `src/services/workspace-data.mjs`.
- The service loads a single immutable snapshot from `/api/workspace-data` and provides the `readData(resource, key)` accessor.
- All JSON schema files under `src/data/ui/` are compiled into `src/data/workspace-manifest.ts` and `src/data/workspace-contract.mjs` via `npm run data:manifest`.
- Direct imports of JSON fixtures into client components are strictly forbidden to ensure isolation.

### 2.5 35 Backend Domain Services & Outbox Architecture
Located in `src/server/`, each domain service (e.g., `leave`, `attendance`, `payroll`, `organization`, `talent`, `compliance`) is designed with:
- Strict input/output schema validation using **Zod**.
- Scoped tenant isolation (`tenantId` multi-tenancy enforcement).
- Transactional outbox event patterns (`src/server/jobs/outbox.ts`).
- Idempotency key tracking and deterministic seed generators.

### 2.6 Security, Identity & Role-Based Access Control (RBAC)
- Five primary role personas: `SUPER_ADMIN`, `HR_MANAGER`, `FINANCE_MANAGER`, `TEAM_LEAD`, and `EMPLOYEE`.
- Role configurations and permissions defined in `src/utils/permissions.js` and `src/lib/navigation-access.js`.
- Client-side menu filtering and component gating via `<RoleProtected>` component.
- Synthetic demo login personas: `MK001` (Super Admin), `MK002` (HR Manager), `MK003` (Finance Manager), `MK004` (Team Lead), `MK005` (Employee).

---

# 3. Exhaustive Audit of Discovered Issues & Technical Debt

During our deep automated and static codebase inspection, the following specific bugs, syntax errors, and architectural gaps were identified:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                DISCOVERED ISSUES SUMMARY                               │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│ Issue Category             │ Location                    │ Impact                      │
├────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ 1. Syntax / TS Compile     │ Clerio/SettingsView.js:11   │ Breaks 'npm run typecheck'  │
│ 2. ESLint / React Purity   │ EmployeeCreationWizard.js:18│ Impure Math.random() error  │
│ 3. ESLint / Escaped Entity │ EmployeeCreationWizard.js   │ Unescaped single quotes     │
│ 4. Test Suite Failure      │ tests/workspace-data.test.ts│ Out-of-sync picklists sync  │
│ 5. Manifest Sync           │ workspace-manifest.ts       │ Missing picklists.catalog   │
│ 6. DB Normalization Gaps   │ 286 DB Tables / 288 Columns │ 3NF migration backlog       │
│ 7. Persona Linkage Gap     │ MK001-MK005 vs E001+ / EMP  │ Prototype persona mismatch  │
│ 8. Hardcoded UI Strings    │ 69 Components / 4578 reads  │ Localization key gaps       │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

### 3.1 Critical Syntax & Typecheck Failures (TS1003 / TS1005)
- **File:** `src/components/Clerio/SettingsView.js` (Lines 7–16)
- **Root Cause:** A duplicate `import {` statement was accidentally inserted inside the existing Lucide icon import block:
  ```js
  // CURRENT BROKEN CODE:
  import {
      User, Bell, Shield, Lock, Globe, Building2,
      Key, CheckCircle2, Save, RotateCcw, Laptop,
      ShieldCheck, Sparkles, Smartphone, Eye,
  import {
      User, Bell, Shield, Lock, Globe, Building2,
      Key, CheckCircle2, Save, RotateCcw, Laptop,
      ShieldCheck, Sparkles, Smartphone, Eye,
      Users, CreditCard, Briefcase, List, Search
  } from 'lucide-react';
  ```
- **Consequence:** Causes `tsc --noEmit` and `eslint` to abort immediately with fatal syntax errors.

### 3.2 ESLint & React 19 Compiler Violations
- **File:** `src/components/Clerio/EmployeeCreationWizard.js`
  1. **Line 18 (Impure Function in Render):**
     `employeeCode: 'EMP-' + Math.floor(10000 + Math.random() * 90000)` inside `useState` initial value violates React 19 pure component rules.
  2. **Lines 312, 316, 529 (Unescaped Entities):**
     Raw single quotes in JSX: `Father's Name`, `Mother's Name`, `Bachelor's`, `Master's` trigger ESLint `react/no-unescaped-entities` errors.

### 3.3 Out-of-Sync Data Manifest & Vitest Regression Failure
- **File:** `tests/workspace-data.test.ts`
- **Root Cause:** Vitest test `"resolves every UI data reference against the server JSON manifest"` fails because `src/data/ui/picklists.catalog.json` was created or updated, but `npm run data:manifest` was not re-run. As a result, `src/data/workspace-manifest.ts` and `src/data/workspace-contract.mjs` lack the `picklists.catalog` key, causing `workspaceResources['picklists.catalog']` to be undefined during test validation.

### 3.4 Form Submission & Command Wiring Deficits
- Several buttons and operational forms (e.g. within `ComplianceView.js`, `ContractWorkforceView.js`, `HelpdeskView.js`) currently invoke generic `launchAction()` stubs instead of binding to the standardized `ActionFormModal.js` or dedicated service commands.
- Dependent dropdowns (e.g., Country $\to$ State $\to$ City, Legal Entity $\to$ Location $\to$ Department) in secondary modals need full bidirectional state resetting.

### 3.5 Database Normalization Gaps (288 JSON Columns)
- As cataloged in `plan/database-normalization-gaps.json`, 288 JSON/JSONB attributes across 286 database tables currently store nested objects that need 3NF relational normalization before activating the live PostgreSQL database phase.

### 3.6 Persona Linkage & Data Reconciliation Gaps
- The 5 synthetic login personas (`MK001`–`MK005`) are decoupled from the 1,000+ reference employee records in `Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx` (`E001`–`E1045`).
- Opening leave balances, attendance logs, and compensation structures need deterministic reconciliation across the demo adapter.

### 3.7 Localization & Hardcoded UI Text Strings
- `plan/frontend-live-gap-register.json` identifies 4,578 snapshot reads and 98 direct JSX label locations across 69 files that require semantic key classification in `src/data/ui/` namespaces.

---

# 4. Master Implementation Roadmap & Phase-by-Phase Plan

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                IMPLEMENTATION PHASES                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Phase 0: Immediate Fixes & Quality Gate Restoration (Compile, Lint & Test Green)       │
│ Phase 1: Local UI Validation, Navigation & Picklist Catalog Hardening                  │
│ Phase 2: Complete Leave & Attendance Vertical Slice (Ledger, FIFO, Half-Day)           │
│ Phase 3: Operational Workspaces & Governed MIS Reporting Hub                           │
│ Phase 4: Domain Service Integration & Schema Normalization (Deferred Live Phase)       │
│ Phase 5: Localization, Accessibility & Public Polish                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Immediate Fixes & Quality Gate Restoration

**Objective:** Clean all compilation errors, lint errors, and test failures to achieve a 100% green build baseline.

### Action Items:
1. **Fix Syntax in `src/components/Clerio/SettingsView.js`:**
   - Remove duplicate import block; consolidate Lucide icons into a single clean import.
2. **Fix React Compiler & ESLint Errors in `src/components/Clerio/EmployeeCreationWizard.js`:**
   - Replace impure `Math.random()` with deterministic default or static generator callback.
   - Escape quotes (`&apos;` or `&#39;`) in lines 312, 316, 529.
3. **Regenerate Workspace Manifest & Contracts:**
   - Run `node scripts/generate-workspace-manifest.mjs` to synchronize `src/data/workspace-manifest.ts` and `src/data/workspace-contract.mjs` with `picklists.catalog.json`.
4. **Execute & Verify Quality Gates:**
   - Run `npm run typecheck` $\to$ must exit 0.
   - Run `npm run lint` $\to$ must exit 0.
   - Run `npm test` (Vitest) $\to$ all 73 test files / 806+ tests must pass.
   - Run `npm run test:ui` $\to$ all 32 UI contract tests must pass.

---

## Phase 1: Local UI Validation, Navigation & Picklist Catalog Hardening

**Objective:** Ensure all 102 navigation items, 10 role consoles, and 118 picklists operate flawlessly in the local prototype.

### Action Items:
1. **Picklist Integration:**
   - Verify `src/lib/picklist-catalog.js` methods (`getPicklist`, `getPicklistOptions`, `searchPicklists`) feed all dropdowns across Clerio views and modals.
   - Verify the "System & Config Picklists Catalog" tab in `SettingsView.js` displays searchable picklists with accurate counts and previews.
2. **Role Console Routing & Access Control:**
   - Validate switching between S01–S10 consoles in `MainWorkspace.js` and `DualPaneNav.js`.
   - Verify `<RoleProtected>` correctly guards privileged consoles while keeping the default dashboard accessible.
3. **Dependent Field Reset Behaviors:**
   - Audit all 24 native forms to ensure parent field mutations (e.g. Country change) reset dependent children (State/City) without stale references.

---

## Phase 2: Complete Leave & Attendance Vertical Slice

**Objective:** Fully harden the end-to-end leave lifecycle and time-office calculations per `AGENTS.md` and Workbook specifications.

### Action Items:
1. **SCR-030 Leave Application Dialog:**
   - Ensure unified modal entrypoint (`src/components/Leave/LeaveApplyModal.tsx` and `LeaveView.js`).
   - Support full-day, half-day (First Half / Second Half), and multi-day spans.
   - Maintain 0.5-day step derivation with manual override capabilities.
2. **Leave Engine & Ledger Calculations:**
   - FIFO comp-off grant debiting with strict expiration validation.
   - Prevent overlapping leave spans, invalid backward dates, and unallocated debit requests.
   - One-time reserve on submit; one-time restoration on rejection/cancellation/withdrawal.
   - Enforce multi-tier manager approval hierarchy (`Employee` $\to$ `Reporting Manager` $\to$ `HR`).
3. **Monthly Leave Calendar & Exports:**
   - Real-time responsive calendar view with status color coding.
   - Formula-safe CSV export with neutralized formula prefixes (`=`, `+`, `-`, `@`).

---

## Phase 3: Operational Workspaces & Governed MIS Reporting Hub

**Objective:** Connect all 49 operational screens, 41 action dialogs, and the MIS reporting engine.

### Action Items:
1. **Operational Module Registry:**
   - Ensure every workbook screen in `src/lib/operational-module-registry.js` maps to a registered view in `OperationalModuleView.js`.
2. **Governed MIS Reporting Hub (`MisReportingHub.js`):**
   - Retain MTD column layout, KPI calculations, and multi-currency aggregate cards.
   - Implement role-based redaction on compensation, pan, and banking fields prior to CSV/XLSX export.
3. **Action Form Launcher (`ActionFormModal.js`):**
   - Ensure all action buttons display clear loading spinners, disable duplicate submissions, retain form state upon validation failure, and reset cleanly on modal re-open.

---

## Phase 4: Domain Service Integration & Schema Normalization (Deferred Phase)

**Objective:** Prepare 35 backend domain services and PostgreSQL schema for the future live migration phase (strictly behind feature flags).

### Action Items:
1. **3NF Schema Migration of 288 JSON Columns:**
   - Map JSON fields into typed relational tables (e.g., employee addresses, bank details, emergency contacts, statutory identity docs).
2. **Transactional Outbox & Audit Logging:**
   - Validate Drizzle transactions rollback both business mutations and audit writes on failure.
3. **Restricted Runtime DB Access:**
   - Ensure zero master credentials exist in client bundles; strictly enforce non-owner application connection roles.

---

## Phase 5: Localization, Accessibility & Enterprise Public Polish

**Objective:** Deliver enterprise-grade accessibility, smooth 60fps micro-animations, and full multi-language readiness.

### Action Items:
1. **Localization Namespacing:**
   - Structure all UI copy in `src/data/ui/` under categorized keys (`en`, `hi`, `ar`).
   - Wire `useTranslation` hook across all remaining operational components.
2. **Accessibility & WCAG 2.1 AA Compliance:**
   - Audit keyboard navigation tab orders, focus trapping in MUI modals, and aria-expanded attributes on accordions.
   - Maintain 4.5:1 color contrast ratio across all four workspace themes (Pearl Violet, Graphite Night, Slate Blue, Sage Teal).
3. **Public Page Motion Strategy:**
   - Optimize Framer Motion components in `src/components/Website/PublicMotion.tsx`.
   - Enforce `prefers-reduced-motion` media queries and cancel ambient animations after 5 seconds to prevent memory leaks.

---

# 5. Requirement Traceability Matrix & Workbook Alignment

| Requirement Code | Domain / Feature | UI Component / View | Service / Adapter | Status |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-NAV-001** | Dual Navigation & 10 Consoles | `DualPaneNav.js`, `MainWorkspace.js` | `navigation-catalog.ts` | **Implemented** |
| **REQ-NAV-002** | 11 Primary Operational Modules | `OperationalModuleView.js` | `operational-module-registry.js` | **Implemented** |
| **REQ-DAT-001** | Asynchronous Data Boundary | `WorkspaceDataBoundary.js` | `workspace-data.mjs` | **Implemented** |
| **REQ-DAT-002** | 118 Seeded Picklists Catalog | `SettingsView.js` (Tab 7) | `picklist-catalog.js` | **Implemented** |
| **REQ-LEV-001** | Unified Leave Application Modal | `LeaveApplyModal.tsx` | `leave-workflow.ts` | **Implemented** |
| **REQ-LEV-002** | FIFO Comp-Off & Ledger Engine | `LeaveView.js`, `leaveEngine.js` | `leave-ledger.ts` | **Implemented** |
| **REQ-REP-001** | Governed MIS Reporting Hub | `MisReportingHub.js` | `mis-reporting.mjs` | **Implemented** |
| **REQ-REP-002** | Formula-Safe CSV Export | `MisReportingHub.js`, `csv.ts` | `csv.ts` | **Implemented** |
| **REQ-SEC-001** | 5 Role Personas & RBAC | `AccessControlView.js`, `RoleProtected.js` | `permissions.js` | **Implemented** |
| **REQ-DB-001** | 3NF Schema Normalization | N/A (Server Schema) | `schema.ts`, Drizzle Migrations | **Deferred Phase** |
| **REQ-AUT-001** | Production Better-Auth DB Session | N/A (Auth Server) | `auth.ts` | **Deferred Phase** |

---

# 6. Verification Protocol & Definition of Done

To certify any work in this codebase as complete, the following verification pipeline must be executed sequentially and pass without warnings or errors:

```sh
# 1. Typecheck: Verify strict TypeScript compilation across all .ts, .tsx, .js files
npm run typecheck

# 2. Linting: Verify ESLint rules, React 19 compiler purity, and JSX entity formatting
npm run lint

# 3. Unit & Domain Tests: Run all 73 Vitest test suites (806+ tests)
npm test

# 4. UI Contract & Workbook Tests: Run Node.js test runner suite (32 tests)
npm run test:ui

# 5. Production Next.js Build: Verify zero build-time rendering or bundling errors
npm run build

# 6. End-to-End Regression Tests: Run Playwright browser suite
npm run test:e2e
```

### Definition of Done Checklist:
- [ ] No compilation errors (`tsc --noEmit` exits with 0).
- [ ] No ESLint errors or warnings (`eslint` exits with 0).
- [ ] All Vitest unit tests pass with zero unexpected failures.
- [ ] All UI contract tests pass.
- [ ] Production build (`next build`) completes successfully.
- [ ] Changes adhere strictly to `AGENTS.md` (no unapproved production database or live external API activations).
- [ ] All file modifications are clean, atomic, and documented.

---
*End of Master Implementation Plan.*
