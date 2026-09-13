# Nucleus HRMS — System Structure & Codebase Anatomy

**Version:** 2.0.0-PROD  
**Target Audience:** Frontend & Backend Engineers, Software Architects, Technical Product Managers  
**Framework:** Next.js 16 (App Router / Turbopack), React 19, ECharts, Lucide Icons, CSS Modules  

---

## 1. High-Level Architectural Anatomy

Nucleus HRMS is structured into three coordinated layers:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             1. NAVIGATION SHELL                                │
│   LeftDock (Side) │ TopNav (Header) │ DualPaneNav (Modal) │ RightSubNav (Drawer) │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             2. WORKSPACE ROUTER                                │
│                     MainWorkspace.js (Role Guard & Tab Router)                  │
├────────────────────────────────────────┬────────────────────────────────────────┤
│     A. Cockpit Dashboards (S1 - S10)   │      B. Deep Functional Modules        │
│  - S1: People Command Centre           │  - People Core (Employee Directory)    │
│  - S2: HR Operations Console           │  - Global Payroll & EWA                │
│  - S3: Attendance & Time Intelligence  │  - Talent Acquisition (ATS)            │
│  - S4: Talent Acquisition Command      │  - Onboarding & Lifecycle              │
│  - S5: Payroll & Statutory Room        │  - Performance, 9-Box & OKRs           │
│  - S6: Performance Talent Calibration  │  - Smart Attendance & Leave Management │
│  - S7: Manager Cockpit & Team Triage   │  - People Intelligence & Analytics     │
│  - S8: Employee Self-Service Home      │  - Learning & Magnetix Capability      │
│  - S9: Magnetix Capability Hub         │  - 2026 Statutory Labour Code Engine   │
│  - S10: Nucleus AI Governance          │  - Agile Projects, Helpdesk & Settings │
└────────────────────────────────────────┴────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    3. CONTEXT & STATE ENGINE (PERSISTENCE)                     │
│    HRMSContext.js (Workforce State) │ AuthContext.js (RBAC Personas)           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Tree & File Inventory

```
NucleusUI/
├── DEVELOPER_HANDOFF_SPEC.md     # Backend API contracts, Prisma schema & statutory rules
├── SYSTEM_STRUCTURE.md          # This complete codebase architecture document
├── package.json                 # Next.js 16.1.6, lucide-react, echarts, prisma
├── next.config.mjs              # Turbopack config & compiler settings
├── prisma/
│   ├── schema.prisma            # Relational database schema
│   ├── seed.js                  # Initial database seeding script
│   └── dev.db                   # Local SQLite dev database
├── public/                      # Static branding logos, badges, and avatars
└── src/
    ├── app/
    │   ├── layout.js            # HTML wrapper, fonts, metadata & CSS imports
    │   ├── page.js              # Application root shell, dock, header & drawers
    │   ├── page.module.css      # Core grid layout, dock expansion, fab stack
    │   ├── globals.css          # Global CSS variables, scrollbars & resets
    │   └── api/
    │       ├── agent/route.js   # AI Agent proxy endpoint
    │       └── auth/login/      # Auth login handler
    │
    ├── context/
    │   ├── AuthContext.js       # Active user session, currentRole, role switcher
    │   └── HRMSContext.js       # Attendance, leaves, projects, tasks, toasts
    │
    ├── components/
    │   ├── auth/
    │   │   └── RoleProtected.js # RBAC route guard component with switch buttons
    │   │
    │   ├── Navigation/
    │   │   ├── DualPaneNav.js   # Full-screen ⌘M / Ctrl+M module switcher
    │   │   └── DualPaneNav.module.css
    │   │
    │   ├── Charts/
    │   │   ├── NucleusChart.js  # ECharts React dynamic wrapper
    │   │   └── theme.js         # NUCLEUS_COLORS design tokens
    │   │
    │   ├── Dashboard/
    │   │   ├── DashboardShared.module.css # Universal dark-glass card & grid classes
    │   │   ├── Modals/
    │   │   │   ├── ApprovalActionModal.js     # Approve/Reject/Re-route dialog
    │   │   │   └── ApprovalActionModal.module.css
    │   │   └── Views/           # The 10 Specialized Dashboards (S1 - S10)
    │   │       ├── PeopleCommandCentre.js     # [S1] CXO Executive Command
    │   │       ├── HROpsConsole.js            # [S2] HR Operations & Funnel
    │   │       ├── AttendanceIntelligence.js  # [S3] Shift & Biometric Anomaly
    │   │       ├── TalentAcquisition.js       # [S4] Recruitment & Funnel
    │   │       ├── PayrollControlRoom.js      # [S5] Payroll & 50% Wage Floor
    │   │       ├── PerformanceTalent.js       # [S6] 9-Box Calibration
    │   │       ├── ManagerCockpit.js          # [S7] Manager Triage & Approvals
    │   │       ├── EmployeeHome.js            # [S8] Employee ESS & Timesheet
    │   │       ├── MagnetixCapability.js      # [S9] L&D Skill Gap Analysis
    │   │       └── NucleusIntelligence.js     # [S10] AI Models & Governance
    │   │
    │   └── Clerio/              # Functional Modules & Interactive Views
    │       ├── LeftDock.js            # Left vertical icon navigation dock
    │       ├── LeftDock.module.css
    │       ├── TopNav.js              # Global header with search, profile & consoles
    │       ├── TopNav.module.css
    │       ├── RightSubNav.js         # Contextual secondary submodule drawer
    │       ├── RightSubNav.module.css
    │       ├── MainWorkspace.js       # Central router & role-based dashboard view
    │       ├── MainWorkspace.module.css
    │       ├── CatalogGridView.js     # Visual feature catalog (all 45+ sub-modules)
    │       ├── CatalogGridView.module.css
    │       ├── AIPanel.js             # Slide-up Nucleus AI Copilot drawer
    │       ├── AIPanel.module.css
    │       ├── ChatPanel.js           # Slide-up Team Messages drawer
    │       ├── ChatPanel.module.css
    │       ├── CMSModal.js            # Broadcast announcements manager
    │       ├── CMSModal.module.css
    │       ├── WorkflowBuilderModal.js# Visual node-based workflow studio
    │       ├── WorkflowBuilderModal.module.css
    │       ├── Toast.js               # Global toast alert notification
    │       ├── Toast.module.css
    │       │
    │       └── [Module Views]         # 18 Full Functional Feature Views
    │           ├── PeopleCoreView.js        # Core HR & digital personnel files
    │           ├── PayrollView.js           # Payslips & tax computations
    │           ├── RecruitmentView.js       # ATS requisition pipeline
    │           ├── OnboardingView.js        # Pre-boarding, KYC & day-1 readiness
    │           ├── PerformanceView.js       # OKR goals & 360 review forms
    │           ├── AttendanceView.js        # Punch ledger & biometric logs
    │           ├── LeaveView.js             # Leave balance & application forms
    │           ├── AnalyticsView.js         # Headcount analytics & flight risk
    │           ├── LearningView.js          # Magnetix L&D course catalog
    │           ├── CompensationView.js      # Salary benchmarking & compa-ratios
    │           ├── ExperienceView.js        # Wellbeing index & pulse surveys
    │           ├── IntegrationsView.js      # ERP, Slack & Webhook connections
    │           ├── ComplianceView.js        # 2026 Labour Codes simulator
    │           ├── HelpdeskView.js          # Service desk & policy search
    │           ├── ContractWorkforceView.js # Gig & contingent workforce pools
    │           ├── ProjectView.js           # Agile sprint boards & timesheets
    │           ├── TeamView.js              # Org hierarchy chart & reporting
    │           └── SettingsView.js          # RBAC roles & security policies
```

---

## 3. The 10 Specialized Dashboard Consoles (S1 to S10)

Nucleus HRMS implements 10 purpose-built consoles designed for specific organizational roles:

| ID | Console Name | Target Role | Primary Source File | Key Data Capabilities & Visualizations |
| :---: | :--- | :--- | :--- | :--- |
| **S1** | **People Command Centre** | Super Admin / CXO | `src/components/Dashboard/Views/PeopleCommandCentre.js` | Macro headcount trends, attrition trajectory, workforce cost per FTE, gender diversity index. |
| **S2** | **HR Operations Console** | HR Manager / HRBP | `src/components/Dashboard/Views/HROpsConsole.js` | 5-stage Onboarding funnel (Offered $\rightarrow$ Day-1 Ready), statutory breaches, SLA approvals. |
| **S3** | **Attendance & Time Intelligence** | Workforce Ops / HR | `src/components/Dashboard/Views/AttendanceIntelligence.js` | Biometric turnstile sync, Paired Punching detector, Friday absence spikes, burnout warning signals. |
| **S4** | **Talent Acquisition Command** | Head of Talent / Recruiter | `src/components/Dashboard/Views/TalentAcquisition.js` | Hiring funnel (Applied $\rightarrow$ Joined), Avg. Time to Fill (34d), Offer-to-Join Leakage waterfall bridge. |
| **S5** | **Payroll & Statutory Control Room** | Finance / Payroll Admin | `src/components/Dashboard/Views/PayrollControlRoom.js` | 2026 Labour Code 50% basic wage floor simulator, EPFO/ESIC deductions, payout disbursement files. |
| **S6** | **Performance & Talent Calibration** | People & Talent Lead | `src/components/Dashboard/Views/PerformanceTalent.js` | 9-Box talent grid (Performance vs Potential), OKR goal cascade, compa-ratio alignment. |
| **S7** | **Manager Cockpit & Team Triage** | Team Lead / Engineering Lead | `src/components/Dashboard/Views/ManagerCockpit.js` | Pod punch status, pending leave/shift sign-offs, reject with compulsory remarks, re-route delegation. |
| **S8** | **Employee Self-Service Home** | Employee / Staff | `src/components/Dashboard/Views/EmployeeHome.js` | Daily punch-in/out, concentric leave balance rings, September payslip summary, Weekly Timesheet suite. |
| **S9** | **Magnetix Capability Hub** | L&D / Capability Lead | `src/components/Dashboard/Views/MagnetixCapability.js` | Nucleus Capability Index (NCI), skill gap radar, mandatory compliance completion trackers. |
| **S10**| **Nucleus AI Intelligence** | Platform Admin / IT | `src/components/Dashboard/Views/NucleusIntelligence.js` | Natural language query bar, enterprise model register, autonomous agent permissions matrix. |

---

## 4. Navigation Architecture & Shell Routing

The application navigation is coordinated across 4 components located in `src/app/page.js`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LeftDock (src/components/Clerio/LeftDock.js)                              │
│    - Fixed vertical icon dock on the left viewport margin.                  │
│    - Contains: Logo, Dashboard, Feature Catalog, Core HR, Talent,           │
│      Payroll & Finance, Workforce Ops, Analytics & AI, Settings.            │
│    - Expands on hover with labels, tooltip cues, and active indicators.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TopNav (src/components/Clerio/TopNav.js)                                 │
│    - Global search bar with autocomplete suggestions.                       │
│    - MultipliersKraft Console Switcher (Quick dropdown: S1 through S10).    │
│    - Dual-Pane Launcher button (⌘M / Ctrl+M).                               │
│    - Role Switcher (Super Admin, HR Mgr, Finance, Team Lead, Employee).     │
│    - Right drawer expand/collapse toggle.                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. DualPaneNav (src/components/Navigation/DualPaneNav.js)                   │
│    - Full-screen modal opened via header button or global shortcut (Ctrl+M). │
│    - Left Pane: 7 Primary Categories with module counts and icon badges.    │
│    - Right Pane: Grouped sub-modules with descriptions, tags, and 1-click.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. RightSubNav (src/components/Clerio/RightSubNav.js)                       │
│    - Contextual right-side panel showing sub-features of the active domain. │
│    - Sits beside MainWorkspace with smooth slide-out and zero overlap.      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. State Management & Data Flow Architecture

### Central Context Store: `src/context/HRMSContext.js`
Provides universal workforce data and dispatchers across all components:
- `attendance`: Active punch status (`present` | `absent`), `punchInTime`, `todayDuration`.
- `punchIn()`, `punchOut()`: Toggles attendance state, records timestamps, and emits audit toasts.
- `leaves`: Real-time balances for Earned, Casual, and Sick leaves.
- `applyLeave()`: Validates balance quotas, computes dates, and records requests.
- `focusTasks`: Priority checklist for daily employee triage.
- `projects`: Sprint tracking, progress percentages, and lead assignments.
- `announcements`: Global broadcast notices managed via `CMSModal.js`.
- `toasts`: Stack of toast notifications (`showToast(title, msg, type)`).

### Authentication & Persona Store: `src/context/AuthContext.js`
- `user`: Active profile (name, avatar, email, role).
- `currentRole`: Active role persona (`SUPER_ADMIN`, `HR_MANAGER`, `FINANCE_MANAGER`, `PROJECT_MANAGER`, `TEAM_LEAD`, `EMPLOYEE`).
- `switchRole(newRole)`: Instantly recalibrates permissions, dashboard screens, and navigation privileges.

---

## 6. Styling & Design Tokens Architecture

Nucleus uses a customized **Dark Glass Design System** configured in:
- `src/components/Dashboard/DashboardShared.module.css` (Universal widgets)
- `src/components/Charts/theme.js` (ECharts color palettes)
- `src/app/globals.css` (Root CSS variables)

### Color Tokens:
| Token Name | Hex Code | Primary Purpose |
| :--- | :--- | :--- |
| **Emerald Teal** | `#2DD4A8` | Positive metrics, approvals, clock-in status, Primary CTAs |
| **Sky Blue** | `#4FB6F5` | Billable hours, employee self-service, info chips |
| **Lumino Violet** | `#9B8CFF` | AI insights, Magnetix capability, executive tags |
| **Coral Red** | `#F43F5E` | Rejections, overdue SLA items, statutory warnings |
| **Warm Amber** | `#F2A93B` | Pending approvals, sick leave, warning badges |
| **Canvas Deep** | `#060D18` | Deepest background layer |
| **Glass Card** | `rgba(14, 23, 38, 0.75)` | Frosted cards with `backdrop-filter: blur(12px)` |
| **Border Stroke** | `rgba(255, 255, 255, 0.08)` | Subtle high-contrast card borders |

---

## 7. Modals & Interactive Overlay Architecture

1. **Quick Log Project Time Modal** (`src/components/Dashboard/Views/EmployeeHome.js`):
   - Opens on `[+ Log Project Time]`.
   - Allows logging tasks, hours, and client billability flags with immediate table update.
2. **Approval Action Modal** (`src/components/Dashboard/Modals/ApprovalActionModal.js`):
   - Reusable dialog for approving, declining (with compulsory remark), or re-routing requests to a peer lead.
3. **Workflow Builder Studio Modal** (`src/components/Clerio/WorkflowBuilderModal.js`):
   - Visual flowchart designer for HR onboarding and promotion DAG pipelines with live simulator.
4. **Broadcast CMS Modal** (`src/components/Clerio/CMSModal.js`):
   - Publish company-wide bulletins and emergency alerts.
5. **AI Assistant & Team Messages Drawers** (`AIPanel.js` & `ChatPanel.js`):
   - Docked to bottom-right floating action buttons with strict mutual exclusivity.

---
*Maintained by the Nucleus Engineering & Architecture Core Team.*
