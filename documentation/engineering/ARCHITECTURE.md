# Nucleus HRMS — System Architecture

> **Phase:** Local JSON UI Validation  
> **Stack:** Next.js (App Router) · React 19 · MUI v7 · TypeScript · PostgreSQL (deferred) · Drizzle ORM · Better-Auth  
> **Test Coverage:** 824 tests passing across 74 files (Sep 2026)

---

## Application Shell Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TOPNAV (Header)                                   │
│  [Logo] [Search ⌘K] [S1-S10 Cockpit] [+ Quick Actions] [🎙️ Voice] [🔔] [👤]│
├───────┬─────────────────────────────────────────────────┬───────────────────┤
│ LEFT  │               MAIN WORKSPACE                   │  RIGHT DRAWER     │
│ DOCK  │  [Breadcrumb: Domain / Sub-module]              │  [AI Copilot /    │
│       │  [4-Filter Telemetry Bar]                       │   Live Chat]      │
│ [🏠]  │  ACTIVE VIEW (People Core / Payroll / etc.)     │                   │
│ [👥]  │  - KPI Metric Strip (4 Stat Cards)              │                   │
│ [💼]  │  - Sub-Tabs / Segmented Control                 │                   │
│ [💰]  │  - Data Grid / Kanban / Split Master-Detail     │                   │
│ [⚙️]  │                  [Attendance FAB] ─────────────►│                   │
└───────┴─────────────────────────────────────────────────┴───────────────────┘
```

---

## Source Directory Structure (Current)

```
src/
├── app/
│   ├── (website)/          # Public marketing pages (/, /about, /features, /docs, /contact, /why-nucleus)
│   ├── (workspace)/        # Authenticated workspace (/login, /workspace)
│   └── api/
│       └── v1/             # Dormant REST API routes (deferred — production phase)
│           ├── attendance/ ├── leave/    ├── payroll/   ├── people/
│           ├── ai/         ├── benefits/ ├── loans/     ├── candidates/
│           └── ... (60+ route handlers)
├── components/
│   ├── AnimatedNucleusLogo.js      # Pure CSS/SVG animated Nucleus logo (no PNG dep)
│   ├── VoiceNavigator.js           # Nucleus Talk voice modal — 14 commands + 1s silence trigger
│   ├── AppearanceToggle.tsx        # 4-theme switcher (Pearl Violet / Graphite Night / Slate Blue / Sage Teal)
│   ├── LanguageSelector.tsx        # 11-language picker with RTL flag
│   ├── FormValidationBoundary.tsx  # Reusable form error boundary
│   ├── BrandLogo.js                # Nucleus brand mark
│   ├── Charts/
│   │   └── NucleusChart.js         # ECharts wrapper with theming
│   ├── Clerio/                     # Core workspace views & modals
│   │   ├── TopNav.js               # Header (search, mic, notifications, profile)
│   │   ├── LeftDock.js             # 52px icon sidebar
│   │   ├── MainWorkspace.js        # View router + 4-filter telemetry bar
│   │   ├── SideNav.js / RightSubNav.js
│   │   ├── AIPanel.js              # Nucleus Assistant drawer (grounded copilot + 14 preloaded actions)
│   │   ├── ChatPanel.js            # Team messaging drawer
│   │   ├── AttendanceFAB.js        # Floating punch pill
│   │   ├── PeopleCoreView.js       # Module 1: Employee directory
│   │   ├── AttendanceView.js       # Module 2: Biometric + shifts
│   │   ├── LeaveView.js            # Module 3: Leave workflows
│   │   ├── OnboardingView.js       # Module 4: Lifecycle + assets
│   │   ├── TeamView.js             # Module 5: Org hierarchy
│   │   ├── PayrollView.js          # Module 6: Gross-to-net payroll
│   │   ├── CompensationView.js     # Module 7: Bands + benefits
│   │   ├── ComplianceView.js       # Module 8: Statutory compliance
│   │   ├── RecruitmentView.js      # Module 9: ATS pipeline
│   │   ├── PerformanceView.js      # Module 10: OKRs + 9-box
│   │   ├── LearningView.js         # Module 11: LMS + certifications
│   │   ├── ExperienceView.js       # Module 12: Experience + wellbeing
│   │   ├── ContractWorkforceView.js# Module 13: Contingent workforce
│   │   ├── ProjectView.js          # Module 14: Agile projects
│   │   ├── AnalyticsView.js        # Module 15: People analytics
│   │   ├── HelpdeskView.js         # Module 16: HR helpdesk
│   │   ├── IntegrationsView.js     # Module 17: ERP integrations
│   │   ├── AccessControlView.js    # Module 18: RBAC studio
│   │   ├── SettingsView.js         # Platform settings
│   │   ├── AdminOverview.tsx       # Admin governance console
│   │   ├── DataImportModal.js      # 4-step bulk CSV/Excel wizard
│   │   ├── WorkflowBuilderModal.js # Node-based workflow designer
│   │   ├── CMSModal.js             # Content management modal
│   │   ├── EmployeeCreationWizard.js
│   │   ├── BulkOnboardingModal.js
│   │   ├── LegalEntityModal.js
│   │   ├── LocationMasterModal.js
│   │   └── MisReportingHub.js
│   ├── Dashboard/
│   │   ├── Views/                  # 10 Executive Console dashboards (S1-S10)
│   │   ├── Modals/                 # ApprovalActionModal, CtcExceptionModal, AccessControlModal
│   │   └── Personalization/        # Drag-and-drop widget customization
│   ├── Leave/                      # Shared leave sub-components
│   │   ├── LeaveApplicationDialog.tsx
│   │   ├── LeaveBalancePanel.tsx
│   │   ├── LeaveCalendar.tsx
│   │   ├── LeaveEmployeeSelect.tsx
│   │   ├── LeavePolicyReference.tsx
│   │   └── LeaveWorkflowPanel.tsx
│   ├── Navigation/
│   │   └── DualPaneNav.js          # Full-screen dual-pane module catalog (⌘M)
│   └── Website/                    # Public landing page components
├── context/
│   ├── AuthContext.js              # Auth state + role detection (5 demo roles)
│   ├── HRMSContext.js              # Global HRMS state (active tab, console, employee data)
│   ├── I18nContext.tsx             # 11-language locale provider
│   └── AppearanceContext.tsx       # 4-theme palette + MUI theme
├── data/
│   └── ui/                         # JSON snapshot data catalogs
│       ├── navigation.catalog.json  # Navigation definitions for all 18 modules
│       ├── context.AuthContext.json # Demo persona profiles (MK-102, MK-104, MK-107)
│       ├── dashboard.widgets.json   # Dashboard widget registry
│       └── leave.workflow.json      # Leave workflow config & calendar rules
├── hooks/                           # Custom React hooks
├── lib/
│   ├── i18n.ts                     # Translation resolver with fallback chain
│   ├── hr-rules.ts                 # Business rule engine (73 tests)
│   ├── appearance.ts               # Theme catalog + palette registry
│   ├── form-validation.ts          # Zod/custom validation schemas (21 tests)
│   └── db/schema.ts                # Drizzle ORM PostgreSQL schema (dormant)
├── locales/                        # Translation catalogs (11 languages)
│   └── translations.ts             # Master translation file
├── server/                         # Server-only domain services (dormant in prototype)
│   ├── identity/                   # RBAC/ABAC, session, tenant isolation
│   ├── organization/               # People, org structure, reporting hierarchy
│   ├── attendance/                 # Biometric pairing, shift rosters, OT engine
│   ├── leave/                      # Leave ledger, accrual engine, FIFO comp-off
│   ├── payroll/                    # Gross-to-net, wage simulator, service.ts
│   ├── compliance/                 # PF/ESI/PT/TDS computation engine
│   ├── talent/                     # ATS, hiring schemas, OneScore
│   ├── performance/                # OKR, 9-box calibration, peer reviews
│   ├── learning/                   # Course catalog, enrollment, certifications
│   ├── lifecycle/                  # Onboarding, offboarding, checklist templates
│   ├── loans/                      # Employee company loans, advances, EMI
│   ├── benefits/                   # Group insurance, flexi-benefits, claims
│   ├── notifications/              # Notification delivery (dormant)
│   ├── analytics/                  # KPI metrics, flight risk
│   ├── governance/                 # Helpdesk SLA routing
│   ├── contractors/                # Agency master, invoicing
│   ├── skills/                     # Skill evidence, competency matrix
│   ├── ai/                         # LangGraph agent workflows, policy evals
│   ├── jobs/                       # Outbox worker, cron scheduler
│   └── platform/                   # Tenant provisioning, manifest, guards
├── services/                       # Frontend data adapters (UI phase boundary)
│   ├── leave-workflow.ts           # Leave mutation adapter (44 tests)
│   ├── leave-reference.ts          # Workbook join adapter (3 tests)
│   ├── recruitmentService.ts       # ATS frontend service
│   ├── performanceService.ts       # OKR/9-box frontend service
│   ├── learningService.ts          # LMS frontend service
│   ├── helpdeskService.ts          # Helpdesk frontend service
│   ├── contractWorkforceService.ts # Vendor/contractor frontend service
│   ├── onboardingService.ts        # Onboarding checklist service
│   ├── analyticsTelemetryService.ts# Analytics KPI service
│   ├── projectWorkforceService.ts  # Sprint/pod service
│   ├── dashboard-preferences.ts    # Browser-local dashboard layout store
│   └── localization.ts             # Published locale catalog adapter
├── types/                          # Shared TypeScript types
└── utils/
    ├── voiceCommandEngine.ts       # Voice command parser + speech synthesis + greeting
    ├── permissions.js              # RBAC permission helpers
    └── csv.ts                      # CSV parsing utilities
```

---

## Data Flow Architecture

```
Browser Request
      │
      ▼
AppearanceContext (theme CSS vars)
      │
      ▼
AuthContext (user identity, role, tenant)
      │
      ▼
HRMSContext (active tab, console, workspace snapshot)
      │
      ▼
readData() ──────────────────► JSON snapshot (src/data/ui/)
      │
      ▼
Module View Component
      │
      ├──► Service (leave-workflow.ts, etc.)
      │         │
      │         └──► In-memory state mutation (UI phase)
      │
      └──► Custom Event (nucleus:trigger_punch, nucleus:open_leave_apply)
                │
                └──► Cross-component communication (VoiceNavigator → AttendanceFAB)
```

---

## Authentication & Role Model

| Role | Email | Default Console | Persona |
|:---|:---|:---:|:---|
| `SUPER_ADMIN` | superadmin@nucleus.com | S10 | System administrator |
| `ADMIN` | admin@nucleus.com | S10 | Workspace owner |
| `HR_MANAGER` | hr@nucleus.com | S2 | Sunita Verma (MK-102) |
| `MANAGER` | manager@nucleus.com | S7 | Ramesh Nair (MK-104) |
| `EMPLOYEE` | employee@nucleus.com | S8 | Vikas Yadav (MK-107) |

**Demo Password (all accounts):** `Nucl3u$123$ecure` (local prototype only — never for production)

---

## The 10 Executive Consoles (S1–S10)

| Console | Title | Primary Role |
|:---:|:---|:---|
| S1 | People Command Centre | HR Leadership |
| S2 | HR Operations Console | HR Manager |
| S3 | Payroll Control Room | Finance Manager |
| S4 | Talent Acquisition Hub | Recruiter |
| S5 | Performance & Growth | HRBP |
| S6 | Attendance Intelligence | Time Office |
| S7 | Manager Cockpit | Reporting Manager |
| S8 | Employee Home (ESS) | Individual Employee |
| S9 | Workforce Analytics Radar | CHRO / Analytics |
| S10 | Nucleus Governance | Super Admin / CXO |

---

## Quality Gate

Every change must pass all 5 stages:

```bash
npm run typecheck    # 0 TypeScript errors
npm run lint         # 0 ESLint warnings
npm test             # 824+ tests passing
npm run test:ui      # UI contract tests
npm run build        # Next.js production build
```

---

## Key Architectural Constraints

1. **No production data** — all mutations are in-memory preview behaviors.
2. **No server activation** — backend services in `src/server/` are dormant unless explicitly authorized.
3. **JSON boundary** — business data flows only through `readData()` and explicit service adapters.
4. **Never commit secrets** — only the documented demo password is the narrow exception for local prototype.
5. **Design tokens only** — zero hardcoded hex colors; all CSS uses `var(--token-name)`.
6. **Theme adaptability** — all components must render correctly in all 4 themes.
7. **i18n mandatory** — new user-facing strings must use `readData()` or `translateText()`, not JSX literals.

---

## Leave Preview Architecture

`src/services/leave-workflow.ts` is the single source of truth for leave mutations. Both the `LeaveView.js` and the legacy SCR-030 path consume it through `HRMSContext`. It is **not** a database transaction or security boundary.

Leave identities (MK-102, MK-104, MK-107) are explicit synthetic fixtures in `src/data/ui/leave.workflow.json`. The reporting relationship `MK-107 → MK-104` is a preview contract only, not a verified FK mapping.

---

## Voice & AI Architecture

```
User Click on Mic (TopNav)
        │
        ├──► speakAloud(greeting)   [synchronous in click handler — browser audio unlock]
        │
        └──► CustomEvent('nucleus:voice_navigation')
                    │
                    ▼
           VoiceNavigator Modal Opens
                    │
                    ├──► AnimatedNucleusLogo (CSS/SVG) — listening/speaking states
                    │
                    ├──► SpeechRecognition API (continuous = true, interimResults = true)
                    │           │
                    │           └──► onresult → setTranscript → liveCommandBubble
                    │                         → 1000ms silence timer → executeCommand()
                    │
                    └──► executeCommand(text)
                                │
                                ├──► parseVoiceCommand(text) → VoiceCommandResult
                                │
                                ├──► speakAloud(result.speechText)
                                │
                                └──► Dispatch action (punch / navigate / modal / console)
```

**Speech synthesis reliability note:** `speakAloud()` must be called directly in the user's synchronous click event to unlock browser autoplay. Deferring to `useEffect` causes silent audio drop in Chrome and Safari.
