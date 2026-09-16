# Nucleus HRMS — Blueprint Inventory

> **Version:** 2.1.0  
> **Updated:** September 2026  
> **Status:** Local JSON UI Validation Phase

---

## About This Directory

The `blueprints/` directory contains master architectural design documents that define the complete intended system — including features that are prototype, in-progress, or deferred to the production phase.

| Document | Purpose |
|:---|:---|
| [`COMPLETE_APPLICATION_BLUEPRINT.md`](./COMPLETE_APPLICATION_BLUEPRINT.md) | Full 18-module system specification with UI component hierarchy, API endpoints, and interaction flows |
| [`MASTER_ENTERPRISE_PLAN.md`](./MASTER_ENTERPRISE_PLAN.md) | Consolidated enterprise plan: domain seams, payroll engine, QA gates, and implementation reference |
| [`NAVIGATION_INVENTORY.md`](./NAVIGATION_INVENTORY.md) | Complete navigation catalog inventory — all domains, modules, and route IDs |

---

## Module Completion Overview

```
Core HR
  ├── [✅] Module 1:  People Core & Org Directory
  ├── [🔶] Module 2:  Attendance, Shifts & Time Office
  ├── [✅] Module 3:  Leave Engine & Workflows
  └── [🔶] Module 4:  Lifecycle, Onboarding & Hardware Assets

Organization
  └── [🔶] Module 5:  Organization Management & Team Hierarchy

Finance & Payroll
  ├── [🔶] Module 6:  Global Payroll, EWA & Loan Engine
  ├── [🔶] Module 7:  Compensation, Bands & Benefits
  └── [🔒] Module 8:  Statutory Compliance & Factories Act

Talent & Growth
  ├── [🔶] Module 9:  Talent Acquisition & ATS Pipeline
  ├── [🔶] Module 10: Performance, OKRs & 9-Box Calibration
  ├── [🔶] Module 11: Learning & Development (L&D)
  └── [🔶] Module 12: Employee Experience & Vedic Wellbeing

Workforce Operations
  ├── [🔶] Module 13: Contingent & Contract Workforce
  ├── [🔶] Module 14: Agile Projects, Sprints & Tasks
  └── [❌] Module 15: People Intelligence & Analytics (partial)

Platform & Governance
  ├── [🔶] Module 16: Grounded Policy Helpdesk
  ├── [🔒] Module 17: Enterprise Integrations & API Platform
  └── [✅] Module 18: Access Control & RBAC Studio

Voice & AI
  ├── [✅] Nucleus Talk — Voice Navigation & Command Engine
  ├── [🔶] Nucleus Assistant (AI Copilot) — 14 preloaded actions complete
  └── [🔒] LangGraph AI Backend — deferred to production phase
```

**Legend:** ✅ Complete · 🔶 Partial · 🔒 Backend-deferred · ❌ Not started

---

## The 10 Executive Consoles (S1–S10)

| Console | Name | Primary Persona | Status |
|:---:|:---|:---|:---:|
| S1 | People Command Centre | CHRO, HR Lead | ✅ |
| S2 | HR Operations Console | HR Manager | ✅ |
| S3 | Payroll Control Room | Finance Manager, CFO | 🔶 |
| S4 | Talent Acquisition Hub | TA Lead, Recruiter | 🔶 |
| S5 | Performance & Growth | HRBP, L&D Head | 🔶 |
| S6 | Attendance Intelligence | Time Office, Plant HR | ✅ |
| S7 | Manager Cockpit | Reporting Manager, Team Lead | ✅ |
| S8 | Employee Home (ESS) | Individual Contributor | ✅ |
| S9 | Workforce Analytics Radar | Analytics Head, CHRO | 🔶 |
| S10 | Nucleus Governance Console | Super Admin, CXO | ✅ |

---

## Design System Tokens

All UI components derive 100% from CSS design tokens defined in `src/app/globals.css` and `src/config/appearance.json`:

```css
/* Surfaces */
--bg, --paper, --card, --card-2, --surface, --surface-2

/* Typography */
--text, --text-2, --text-3, --hero-text, --hero-muted

/* Primary Actions */
--signal, --signal-ink, --signal-wash, --on-signal

/* Status */
--status-ok, --status-ok-wash   /* green */
--flag, --flag-wash              /* red/error */
--pending, --pending-wash        /* amber */
--info, --info-wash              /* blue */

/* Borders */
--line, --line-soft, --line-glow

/* Radii & Shadows */
--r-data, --r-control, --r-card, --r-pill
--shadow-raise, --shadow-overlay
```

**ZERO hardcoded hex colors are permitted** in any component file, CSS module, or inline style.

---

## API Contract Reference

All v1 Server Actions follow the pattern `src/app/actions/{domain}/{resource}`. Routes are defined and dormant. Full route inventory:

- `attendance/` — punches, days, recompute, team-summary
- `leave/` — requests, balances, allocations, coff-grants
- `payroll/` — runs, snapshots, payslips, wage-simulations
- `people/` — directory, profile, manager-reassign
- `compliance/` — forms, challans, registers
- `talent/` — requisitions, candidates, applications, scoring
- `performance/` — objectives, review-cycles, calibration
- `ai/` — runs, actions, evals, knowledge, reviews, feedback
- `benefits/` — plans, enrollments, claims
- `loans/` — advances, EMI schedule
- `integrations/` — configuration, sync, GL mapping
- `analytics/` — metrics, capability-index, metric-snapshots
- `announcements/`
- `bulk-import/`

*See `src/appsrc/app/actions/` for complete route file listing.*
