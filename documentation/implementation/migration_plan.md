# Nucleus HRMS — Comprehensive 3-Commit Comparative Analysis & Unified Migration Plan

> **Document Name:** `migration_plan.md`  
> **Location:** `plan/implementation/migration_plan.md`  
> **Repository:** Nucleus HRMS (Private Enterprise HRMS SaaS)  
> **Analyzed Git Commits:**  
> 1. `f3e7c83c039df8f3363db3550f7440419c3cbbe1` — *Fixed issued and page added and enhanced UI/UX and theme* (Dhanraj Dadhich)  
> 2. `a08c4ab6cd6bb385e5cf5d34b50e3bb3f138db36` — *feat(ui): implement form controls, bulk onboarding CSV wizard, section export, and picklist master catalog* (Vishal Singh)  
> 3. `ffdbf063cd1939536dd3f399b5bf5e44cebf748c` — *fix(ui): remove duplicate import block in SettingsView* (Vishal Singh)  
> **Date:** September 14, 2026  
> **Status:** Comparative Architecture & Migration Plan (No code changes executed)  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Commit-by-Commit Deep Feature & File Analysis](#2-commit-by-commit-deep-feature--file-analysis)
   - 2.1 Commit `f3e7c83`: Advanced Leave Subsystem, Public Motion, Form Boundaries & QA Matrix
   - 2.2 Commit `a08c4ab`: 12-Section Employee Wizard, Bulk Onboarding, Legal Entity Masters & Picklist Catalog
   - 2.3 Commit `ffdbf06`: Import Optimization & Cleanups
3. [Deep Comparative Analysis & Evolution (e.g. Leave Request Dialog vs Wizard Controls)](#3-deep-comparative-analysis--evolution)
   - 3.1 Leave Request Dialog: Old Simple Form vs `f3e7c83` Advanced Dialog
   - 3.2 Modal Form Engines: ActionFormModal vs Domain-Specific Wizards
   - 3.3 Data Layer & Manifest Sync: Picklists Catalog Integration
4. [Master Feature Matrix Across All 3 Commits](#4-master-feature-matrix-across-all-3-commits)
5. [Identified Regressions, Gaps & Synergies](#5-identified-regressions-gaps--synergies)
6. [Unified Consolidation & Migration Strategy](#6-unified-consolidation--migration-strategy)
7. [Step-by-Step Execution Plan for Final Unified Release](#7-step-by-step-execution-plan-for-final-unified-release)
8. [Quality Gates & Verification Protocols](#8-quality-gates--verification-protocols)

---

# 1. Executive Summary

This document provides a comparative analysis of three key git commits (`f3e7c83`, `a08c4ab`, and `ffdbf06`) to establish a clear architectural plan for unifying all advanced features, components, services, and bug fixes into the authoritative master build of **Nucleus HRMS**.

### Key Finding:
- **`f3e7c83`** is a major architectural milestone introducing the **Enterprise Leave Subsystem** (`LeaveApplicationDialog.tsx`, `LeaveBalancePanel.tsx`, `LeaveCalendar.tsx`, `LeaveWorkflowPanel.tsx`), the asynchronous `leave-workflow.ts` engine, formula-safe CSV security, Framer Motion public optimizations, and the master QA traceability matrix.
- **`a08c4ab`** builds directly on top of `f3e7c83`, introducing major **People Core & Administration Wizards** (`EmployeeCreationWizard.js` covering 12 sections of `FRM-PPL-01`, `BulkOnboardingModal.js`, `LegalEntityModal.js`, `LocationMasterModal.js`, `SettingsView.js` Picklists tab, and the 119 Seeded Picklists catalog).
- **`ffdbf06`** performs a minor cleanup on top of `a08c4ab`, removing 4 duplicate icon lines in `SettingsView.js`.
- **Working Tree State:** Resolves active compilation syntax errors (`TS1003`/`TS1005`), React 19 purity warnings, unescaped JSX quotes, and regenerates `workspace-manifest.ts` so that **all 806 Vitest tests and 32 UI contract tests pass with 100% success**.

---

# 2. Commit-by-Commit Deep Feature & File Analysis

```
  [b8784f0] (Base: Workspace unification & home experience)
      │
      ▼
  [f3e7c83] (Dhanraj Dadhich: +9,004 lines / 53 files)
      │  ├─ Advanced Leave Subsystem (LeaveApplicationDialog, WorkflowPanel, Ledger)
      │  ├─ Public Framer Motion Polish (PublicMotion.tsx, HomeStory.tsx)
      │  ├─ FormValidationBoundary & CSV Formula Sanitizer
      │  └─ Master QA Traceability Framework (MASTER_QA_REQUIREMENTS.json)
      │
      ▼
  [a08c4ab] (Vishal Singh: +2,631 lines / 20 files)
      │  ├─ 12-Section Employee Creation Wizard (FRM-PPL-01)
      │  ├─ Bulk Onboarding CSV Modal (Preview, Mapping, Validation)
      │  ├─ Legal Entity & Location Master Modals (FRM-PLT-01, FRM-PLT-02)
      │  ├─ 119 Seeded Master Picklists Catalog (picklist-catalog.js)
      │  └─ People Core Section Exports & Filtering
      │
      ▼
  [ffdbf06] (Vishal Singh: Cleanups)
      │  └─ Remove duplicate import lines in SettingsView.js
      │
      ▼
  [Current Working Tree: Consolidated & Verified Baseline]
         ├─ Fix SettingsView.js syntax error
         ├─ Fix EmployeeCreationWizard.js Math.random purity & unescaped quotes
         ├─ Synchronize workspace-manifest.ts with picklists.catalog.json
         └─ Verified 100% Green (Typecheck 0 errors, Lint 0 errors, 806 Vitest tests pass)
```

---

### 2.1 Commit `f3e7c83`: Advanced Leave Subsystem, Public Motion, Form Boundaries & QA Matrix
- **Author:** Dhanraj Dadhich
- **Date:** Sun Sep 13 22:25:53 2026
- **Files Modified/Added:** 53 files (`+9,004` lines, `-907` lines)

#### Key Architectural Additions:
1. **Enterprise Leave Management Subsystem (`src/components/Leave/`):**
   - `LeaveApplicationDialog.tsx`: Advanced MUI Dialog for leave applications. Supports full-day, first-half, second-half, and multi-day spans; auto-calculates chargeable calendar days; provides manual 0.5-day override controls; displays real-time balance debits; validates notice period and holiday overlaps.
   - `LeaveBalancePanel.tsx`: Interactive balance cards per leave type (Earned, Sick, Casual, Comp-off) tracking Accrued, Used, Pending, Available.
   - `LeaveCalendar.tsx`: Full-month visual leave calendar color-coded by status.
   - `LeaveEmployeeSelect.tsx`: Searchable employee selection component.
   - `LeavePolicyReference.tsx`: Complete policy matrix and sandwich rule explainer.
   - `LeaveWorkflowPanel.tsx`: Multi-stage approval queue, ledger transactions, and HR adjustment controls.
2. **Leave Service Engine (`src/services/`):**
   - `leave-workflow.ts`: Asynchronous workflow engine with UTC date drift prevention, FIFO comp-off debiting with expiration checks, exactly-once balance reservation/restoration, and manager hierarchy authorization.
   - `leave-reference.ts` & `leaveEngine.js`: Reference calculations for entitlements, carry-forwards, and pro-rata credits.
3. **Public Motion & Brand Experience (`src/components/Website/`):**
   - `PublicMotion.tsx` & `PublicMotion.module.css`: High-performance Framer Motion wrapper supporting 60fps parallax, mouse-follow glows, scale/stagger grids, reading progress bars, and strict `prefers-reduced-motion` compliance with 5-second ambient auto-settle.
4. **Security & Form Boundaries:**
   - `FormValidationBoundary.tsx` & `form-validation.ts`: Universal field constraint validator.
   - `src/utils/csv.ts`: Formula injection protection (`=`, `+`, `-`, `@`) on CSV export cells.
5. **Quality Assurance & Traceability:**
   - `plan/MASTER_QA_REQUIREMENTS.json`: Complete 47-group requirement coverage matrix.
   - `plan/MASTER_QA_REPORT.md` & `MASTER_QA_IMPLEMENTATION.md`: Implementation evidence and verification report.

---

### 2.2 Commit `a08c4ab`: 12-Section Employee Wizard, Bulk Onboarding, Legal Entity Masters & Picklist Catalog
- **Author:** Vishal Singh
- **Date:** Mon Sep 14 03:19:49 2026
- **Files Modified/Added:** 20 files (`+2,631` lines, `-22` lines)

#### Key Architectural Additions:
1. **Employee Creation Wizard (`src/components/Clerio/EmployeeCreationWizard.js`):**
   - Complete 12-tab wizard matching `FRM-PPL-01`: Identity, Address & Contact, Job Assignment, Family & Dependents, Education, Work History, Bank & Payment, Statutory (PAN/Aadhaar/PF/ESI), Nomination, Assets, Emergency Contact, and Document Attachments.
2. **Bulk Onboarding CSV Modal (`src/components/Clerio/BulkOnboardingModal.js`):**
   - Multi-step CSV upload with auto-column mapping, header preview, data type validation, row-by-row error detection, and batch import capability.
3. **Legal Entity & Location Master Modals:**
   - `LegalEntityModal.js`: Multi-field modal for legal company setup (`FRM-PLT-01`).
   - `LocationMasterModal.js`: Office, plant, and branch location master modal (`FRM-PLT-02`).
4. **Master Picklists Catalog (`src/data/ui/picklists.catalog.json` & `src/lib/picklist-catalog.js`):**
   - Catalog of 119 standard seeded picklists across all 11 HR modules.
   - Centralized search and lookup API (`getPicklist`, `getPicklistValues`, `getPicklistOptions`, `searchPicklists`).
   - Integrated Picklist Catalog viewer in `SettingsView.js` (Tab 7).
5. **People Core Enhancements (`PeopleCoreView.js`):**
   - Integrated trigger buttons for "New Employee" wizard, "Bulk Import" modal, and section-specific CSV/JSON exports (`exportUtils.js`).

---

### 2.3 Commit `ffdbf06`: Import Optimization & Cleanups
- **Author:** Vishal Singh
- **Date:** Mon Sep 14 12:55:39 2026
- **Files Modified:** 2 files (`+2` lines, `-32` lines)
- **Changes:** Removed 4 duplicate icon imports in `SettingsView.js` and truncated trailing sections in `AGENTS.md`.

---

# 3. Deep Comparative Analysis & Evolution

### 3.1 Leave Request Dialog: Old Simple Form vs `f3e7c83` Advanced Dialog

| Capability / Attribute | Old Leave Form (Prior to `f3e7c83`) | Advanced `LeaveApplicationDialog.tsx` (`f3e7c83`) |
| :--- | :--- | :--- |
| **UI Framework** | Plain inline HTML form / custom modal | Material UI v7 `<Dialog>` with responsive container |
| **Half-Day Support** | Full-day spans only | **Full Day, First Half, Second Half** with 0.5-day step derivation |
| **Day Span Calculation** | Basic date subtraction | Inclusive calendar day auto-calculation with manual override |
| **Real-time Balance Preview** | Static total text | Live balance deductions per leave type (Earned, Sick, Casual, Comp-off) |
| **Comp-Off Handling** | Simple credit counter | **FIFO Comp-off Debit** with grant expiration validation |
| **Policy Enforcement** | None | Overlap checks, backward date rejection, notice period rules |
| **Sandwich Rules** | Static label | Real-time sandwich rule detection & weekend inclusion check |
| **Employee Persona Scope** | Hardcoded user | Searchable employee picker with manager/HR authorization |
| **Workflow Engine** | Synchronous mock state | Asynchronous `leave-workflow.ts` with one-time reserve/restore |

---

### 3.2 Modal Form Engines: ActionFormModal vs Domain-Specific Wizards

| Component | Target Forms | Design Paradigm | Strengths & Synergies |
| :--- | :--- | :--- | :--- |
| **`ActionFormModal.js`** (`f3e7c83`) | Generic domain actions (41 actions across 11 modules) | Dynamic metadata-driven field rendering via `ActionFormModal.json` | Lightweight, unified validation via `form-validation.ts`, fast action dispatch |
| **`EmployeeCreationWizard.js`** (`a08c4ab`) | `FRM-PPL-01` (Employee Master) | 12-section structured wizard with tabular education/experience/nomination grids | Rich, exhaustive enterprise data intake for complete employee master records |
| **`BulkOnboardingModal.js`** (`a08c4ab`) | `FRM-PPL-02` (Bulk Intake) | Multi-step CSV wizard (File $\to$ Mapping $\to$ Preview $\to$ Import) | High-volume batch onboarding with column mapping and validation |
| **`LegalEntityModal.js` / `LocationMasterModal.js`** (`a08c4ab`) | `FRM-PLT-01` / `FRM-PLT-02` | Dedicated dialogs with legal registration & geolocation fields | Structured master data management for tenant configuration |

---

### 3.3 Data Layer & Manifest Sync: Picklists Catalog Integration
- In `a08c4ab`, `src/data/ui/picklists.catalog.json` was created with 119 master picklists, and `src/lib/picklist-catalog.js` was implemented.
- However, `npm run data:manifest` was not executed at commit time. This caused `workspaceResources['picklists.catalog']` to be missing from `src/data/workspace-manifest.ts`, breaking `tests/workspace-data.test.ts`.
- In our current working baseline, running `npm run data:manifest` regenerated both `workspace-manifest.ts` and `workspace-contract.mjs`, fully bridging the data layer and restoring 100% green test passes.

---

# 4. Master Feature Matrix Across All 3 Commits

| Feature / Subsystem | In `f3e7c83` | In `a08c4ab` | In `ffdbf06` | In Current Baseline |
| :--- | :---: | :---: | :---: | :---: |
| **Advanced Leave Dialog (`LeaveApplicationDialog.tsx`)** | ✅ Included | ✅ Retained | ✅ Retained | ✅ **Active & Verified** |
| **Leave Balance Panel & Monthly Calendar** | ✅ Included | ✅ Retained | ✅ Retained | ✅ **Active & Verified** |
| **Asynchronous FIFO Leave Workflow Engine** | ✅ Included | ✅ Retained | ✅ Retained | ✅ **Active & Verified** |
| **12-Section Employee Creation Wizard** | ❌ Not added | ✅ Included | ✅ Retained | ✅ **Active & Verified** |
| **Bulk Onboarding CSV Modal** | ❌ Not added | ✅ Included | ✅ Retained | ✅ **Active & Verified** |
| **Legal Entity & Location Master Modals** | ❌ Not added | ✅ Included | ✅ Retained | ✅ **Active & Verified** |
| **119 Master Picklists Catalog & Viewer Tab** | ❌ Not added | ✅ Included | ✅ Retained | ✅ **Active & Verified** |
| **Picklist Fast Search Engine (`picklist-catalog.js`)** | ❌ Not added | ✅ Included | ✅ Retained | ✅ **Active & Verified** |
| **Formula-Safe CSV Export Sanitizer (`csv.ts`)** | ✅ Included | ✅ Retained | ✅ Retained | ✅ **Active & Verified** |
| **Universal Form Validation Boundary** | ✅ Included | ✅ Retained | ✅ Retained | ✅ **Active & Verified** |
| **Accessible 60fps Public Motion Polish** | ✅ Included | ✅ Retained | ✅ Retained | ✅ **Active & Verified** |
| **Master QA Requirements Matrix (47 Groups)** | ✅ Included | ✅ Retained | ✅ Retained | ✅ **Active & Verified** |
| **SettingsView Duplicate Import Fix** | ❌ Broken | ❌ Broken | ⚠️ Partial | ✅ **Fully Resolved** |
| **EmployeeWizard React 19 Purity & Escaped Quotes** | ❌ Broken | ❌ Broken | ❌ Broken | ✅ **Fully Resolved** |
| **Workspace Manifest Synchronization** | ❌ Out of sync| ❌ Out of sync| ❌ Out of sync| ✅ **Fully Synchronized** |

---

# 5. Identified Regressions, Gaps & Synergies

### 1. Synergy: Leave Dialog + Picklists Engine
- `LeaveApplicationDialog.tsx` previously used hardcoded leave type lists.
- **Enhancement Synergy:** Connect `getPicklistOptions('PL_LEAVE_TYPE')` from `picklist-catalog.js` to dynamically feed `LeaveApplicationDialog.tsx` while preserving policy-based eligibility filtering.

### 2. Synergy: Employee Creation Wizard + Picklists Engine
- `EmployeeCreationWizard.js` contains dropdowns for Gender, Blood Group, Marital Status, Social Category, Education Level, Document Type, and Payment Mode.
- **Enhancement Synergy:** Wire all dropdowns in `EmployeeCreationWizard.js` directly to `getPicklistOptions()` for guaranteed single-source-of-truth consistency.

### 3. Synergy: Action Form Modal + Master Picklists
- Dynamic action modals in `ActionFormModal.js` can resolve picklist references directly from `picklist-catalog.js` when rendering field options.

---

# 6. Unified Consolidation & Migration Strategy

To consolidate all 3 commits and our current working tree into a rock-solid, production-grade master release:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          UNIFIED MASTER MIGRATION ARCHITECTURE                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Core Platform Foundation:                                                           │
│    • TypeScript 5 strict typechecking (zero compiler errors)                           │
│    • Next.js 16 App Router + MUI v7 theme integration                                  │
│    • Universal Form Validation Boundary & Security CSV Sanitizer                       │
│                                                                                        │
│ 2. Unified Leave & Time-Office Engine (from f3e7c83):                                  │
│    • Advanced LeaveApplicationDialog.tsx (0.5-day half-day, FIFO comp-off, balance)    │
│    • LeaveWorkflowPanel.tsx, LeaveBalancePanel.tsx, LeaveCalendar.tsx                  │
│    • Asynchronous leave-workflow.ts & leaveEngine.js with one-time reserve/restore     │
│                                                                                        │
│ 3. Enterprise Administration & Onboarding Wizards (from a08c4ab):                      │
│    • EmployeeCreationWizard.js (12-section FRM-PPL-01 wizard with React 19 purity)    │
│    • BulkOnboardingModal.js (CSV mapping & batch validation)                           │
│    • LegalEntityModal.js & LocationMasterModal.js                                      │
│    • PeopleCoreView.js section exports & directory filters                             │
│                                                                                        │
│ 4. Master 119 Picklists Catalog Engine (from a08c4ab + workspace-manifest sync):       │
│    • picklist-catalog.js API (getPicklist, getPicklistOptions, searchPicklists)        │
│    • Synchronized workspace-manifest.ts and workspace-contract.mjs                     │
│    • SettingsView.js Picklists Catalog management tab                                  │
│                                                                                        │
│ 5. Automated Quality Assurance & Verification Suite:                                   │
│    • 806 Vitest unit & domain tests passing                                            │
│    • 32 Node.js UI contract tests passing                                              │
│    • ESLint passing with zero errors and zero warnings                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. Step-by-Step Execution Plan for Final Unified Release

### Step 1: Lock Verified Baseline
- Ensure all 4 modified files (`SettingsView.js`, `EmployeeCreationWizard.js`, `workspace-manifest.ts`, `workspace-contract.mjs`) remain intact.
- Verify `picklists.catalog.json` and `picklist-catalog.js` are fully indexed in `workspace-manifest.ts`.

### Step 2: Unify Dropdowns with Picklist Engine
- In `LeaveApplicationDialog.tsx`, connect `PL_LEAVE_TYPE` and `PL_LEAVE_DURATION`.
- In `EmployeeCreationWizard.js`, connect `PL_GENDER`, `PL_BLOOD_GROUP`, `PL_MARITAL_STATUS`, `PL_SOCIAL_CAT`, `PL_EDU_LEVEL`, `PL_DOC_TYPE`.
- In `BulkOnboardingModal.js`, use picklist validation for incoming CSV column values.

### Step 3: Fast-Forward & Merge with `origin/main`
- Run `git pull --rebase` or standard fast-forward merge to incorporate `ffdbf06` from `origin/main`.
- Re-verify that our cleaner `SettingsView.js` and regenerated `workspace-manifest.ts` are preserved.

### Step 4: Run Complete Test & Quality Pipeline
- Execute `npm run typecheck`
- Execute `npm run lint`
- Execute `npm test`
- Execute `npm run test:ui`
- Execute `npm run build`

---

# 8. Quality Gates & Verification Protocols

Every delivery must pass the complete 5-stage verification gate without regressions:

```sh
# 1. Typecheck: Verify zero TypeScript errors
npm run typecheck

# 2. Linting: Verify zero ESLint errors or React 19 compiler warnings
npm run lint

# 3. Unit & Domain Tests: 806+ Vitest tests passing across all 73 test files
npm test

# 4. UI Contract & Workbook Tests: 32/32 tests passing
npm run test:ui

# 5. Production Next.js Build: Clean build output
npm run build
```

---
*End of Migration Plan.*
