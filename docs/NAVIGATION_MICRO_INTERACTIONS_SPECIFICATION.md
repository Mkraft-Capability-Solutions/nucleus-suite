# Nucleus HRMS — Left Nav Modules & Right Sub-Modules: Micro-Interactions & Visual Effects Specification

**Document Version:** 2.4.0-PROD  
**Application:** Nucleus HRMS (Enterprise Autonomous Workforce OS)  
**Scope:** Navigation UX/UI Engineering, State Transitions, Micro-Interactions, Motion Tokens & Visual Effects  
**Target Audience:** Frontend Engineers, UI/UX Interaction Designers, Backend Architects, QA Automation Engineers  

---

## 1. Architectural Overview & Motion Philosophy

The Nucleus HRMS navigation system is engineered as an ultra-responsive, dual-tier command architecture designed for high-density enterprise operations. It couples a fixed **Left Navigation Dock** (`LeftDock.js`) for high-level domain switching with an adaptive, contextual **Right Sub-Navigation Pane** (`RightSubNav.js` / `DualPaneNav.js`) for granular feature triage.

```
+-------------------------------------------------------------------------------------------------------------------------------+
| TOPNAV (Sticky 56px | Glassmorphism: rgba(6,13,24,0.85) | blur(12px) | Border-B: rgba(255,255,255,0.08))                     |
| [N Logo] [⌘K Search Bar] [⌘M Modules Navigator] [S1..S10 Console Picker v] | [Theme] [Access Studio] [Notifs] [Role Switcher] |
+-----------+-----------------------------------------------------------------------------------------------+-------------------+
| LEFT DOCK | MAIN WORKSPACE ZONE (Dynamic Route View)                                                      | RIGHT SUB-NAV     |
| (64px ->  |                                                                                               | (Contextual Pane  |
|  240px    |  +-----------------------------------------------------------------------------------------+  |  260px fixed)     |
|  hover)   |  | Adaptive Hero Launchpad / Metric Bar                                                    |  |                   |
|           |  +-----------------------------------------------------------------------------------------+  | - Domain Heading  |
| - Dash    |  | Active Module View / Role Console (S1–S10)                                               |  | - Group 1 Header  |
| - Catalog |  | (e.g. S2 HROpsConsole, S4 TalentAcquisition, PeopleCoreView, GlobalPayrollView)          |  |   • Sub-Module 1  |
| - Core HR |  +-----------------------------------------------------------------------------------------+  |   • Sub-Module 2  |
| - Talent  |  | Grounded Operational Widgets (Live Funnels, Heatmaps, Action Ledgers, Data Tables)      |  | - Group 2 Header  |
| - Payroll |  +-----------------------------------------------------------------------------------------+  |   • Sub-Module 3  |
| - Ops     |                                                                                               |   • Sub-Module 4  |
| - Intel   |                                                                                               |                   |
| - Plat    |                                                                                               | [X Toggle Button] |
+-----------+-----------------------------------------------------------------------------------------------+-------------------+
| FLOATING LAYER (z-index 990-10000):                                                                                           |
| • Dual-Pane Nav Modal (⌘M: Left 280px Domains | Right 540px Sub-Modules with Real-Time Fuzzy Search)                         |
| • Sliding Drawers (420px Right Offcanvas: AI Reasoning Copilot & Live Team Chat Drawer)                                      |
| • Global Confined Tooltips (confine: true, glassmorphic dark backdrop, auto-flip edge boundary)                              |
+-------------------------------------------------------------------------------------------------------------------------------+
```

### 1.1 Motion System Tokens & Physics

Every interaction across the navigation system is calibrated to strict motion physics tokens:

| Token Name | Value | Easing Curve | Application |
|---|---|---|---|
| `--nav-instant` | `100ms` | `cubic-bezier(0, 0, 0.2, 1)` | Active state indicator snaps, button click downscales |
| `--nav-fast` | `180ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Sub-module hover highlights, icon color shifts, tooltips |
| `--nav-standard` | `260ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Left dock expansion, sub-nav slide collapse, tab crossfades |
| `--nav-deliberate`| `380ms` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Modal entrance scaling, drawer slide-in, floating action dial |
| `--nav-spring` | `450ms` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Active indicator glides, badge pulse animations |

---

## 2. Left Nav Module Specifications (The Master Left Dock)

The **LeftDock** is the primary navigation pillar anchored to the left viewport boundary. It operates in two physical states:
1. **Collapsed State (`64px`)**: Compact icon-only column with floating tooltips.
2. **Expanded Hover State (`240px`)**: Smooth slide-out drawer revealing labels and brand subtitles.

### 2.1 Left Dock Micro-Interactions & Visual Effects

- **Dock Expand/Collapse Physics**:
  - `transition: width 240ms cubic-bezier(0.16, 1, 0.3, 1)`
  - Background: `rgba(6, 13, 24, 0.85)` with `backdrop-filter: blur(16px)` and right border `1px solid rgba(255, 255, 255, 0.08)`.
  - On hover expansion, creates a subtle elevated drop-shadow: `box-shadow: 12px 0 32px rgba(0, 0, 0, 0.45)`.
- **Button Hover & Click Micro-Interactions**:
  - **Resting**: `background: transparent; color: #94A3B8; transform: scale(1)`.
  - **Hover**: `background: rgba(255, 255, 255, 0.05); color: #F1F5F9; transform: translateX(2px); transition: all 160ms ease`.
  - **Active / Pressed**: `transform: scale(0.96); transition: transform 60ms ease`.
  - **Active Selected State**:
    - Button background: `linear-gradient(90deg, rgba(45, 212, 168, 0.12) 0%, rgba(45, 212, 168, 0.02) 100%)`.
    - Text color: `#2DD4A8` (Nucleus Teal) with font weight `700`.
    - Icon color: `#2DD4A8` with stroke width expanded from `1.8px` to `2.3px`.
    - **Active Indicator Bar**: Vertical pill on left edge (`width: 3px`, `height: 22px`, `border-radius: 0 4px 4px 0`, `background: #2DD4A8`, `box-shadow: 0 0 10px rgba(45, 212, 168, 0.6)`).
- **Floating Tooltip (Collapsed State)**:
  - Appears on `:hover` after `120ms` delay at `left: calc(100% + 12px)`.
  - Animation: `opacity: 0 -> 1`, `transform: translateX(-4px) -> translateX(0)` over `140ms`.
  - Visuals: Dark glass pill (`rgba(10, 19, 32, 0.96)`), `border: 1px solid rgba(255, 255, 255, 0.14)`, `font-size: 0.72rem`, `font-weight: 600`, `letter-spacing: 0.02em`.

---

## 3. Left Nav Module & Right Sub-Module Interaction Matrix

Below is the exhaustive specification for each of the **8 Left Nav Modules** and their corresponding **Right Sub-Modules**.

---

### Module 1: Dashboard (`dashboard`)
*Role Consoles (S1–S10) • MultipliersKraft Executive & Operational Hub*

- **Left Dock Icon**: `LayoutGrid`
- **Default Trigger**: Opens active role's default console (`S1` for Super Admin, `S2` for HRBP, `S5` for Finance, `S8` for Employee).
- **Sub-Nav Header**: `Role Consoles` — *Universal Access • 10 Consoles Available*

#### Sub-Modules & Interaction Behaviors:

| Sub-Module ID | Sub-Module Label | Group Heading | Target Console | Hover & Micro-Interaction Effects |
|---|---|---|---|---|
| `s1` | **People Command Centre** | EXECUTIVE & LEADERSHIP | `S1` Console | Glow badge `CHRO`. Hover: Cyan neon glow border (`rgba(45, 212, 168, 0.25)`), `transform: translateX(4px)`. Click: 200ms crossfade to C-suite radar & flight risk forecast. |
| `s2` | **HR Operations Console** | EXECUTIVE & LEADERSHIP | `S2` Console | Badge `HRBP`. Hover: Glass tint background (`rgba(255,255,255,0.06)`). Click: Loads SLA approval queue, 2-column onboarding pipeline funnel & absence calendar. |
| `s3` | **Attendance & Shifts** | EXECUTIVE & LEADERSHIP | `S3` Console | Badge `Ops`. Hover: Blue glow accent. Click: Injects paired-punch biometric anomaly ledger and floor roster strip with live gap alerts. |
| `s4` | **Talent Acquisition** | EXECUTIVE & LEADERSHIP | `S4` Console | Badge `TA Lead`. Hover: Emerald glow. Click: Renders 2-column QTD hiring funnel with stage conversion breakdown and requisition blocker triage. |
| `s5` | **Payroll Control Room** | EXECUTIVE & LEADERSHIP | `S5` Console | Badge `Finance`. Hover: Amber highlight. Click: Renders 8-stage payroll cycle stepper, wage variance cost bridge & blocking statutory exceptions. |
| `s6` | **Performance & Talent** | MANAGERS, TALENT & AI | `S6` Console | Badge `Talent`. Hover: Violet tint. Click: Mounts dynamic 9-Box talent calibration matrix with bias-flag detection ribbons. |
| `s7` | **Manager Cockpit** | MANAGERS, TALENT & AI | `S7` Console | Badge `Lead`. Hover: Sky blue border glow. Click: Opens 90-second morning triage brief, 1-click team approval drawer & sprint allocation. |
| `s8` | **Employee Home** | MANAGERS, TALENT & AI | `S8` Console | Badge `Self-Service`. Hover: Emerald badge pulse. Click: Launches zero-surveillance shift clock ring, instant leave balance & Net Pay preview. |
| `s9` | **Magnetix Capability** | MANAGERS, TALENT & AI | `S9` Console | Badge `L&D`. Hover: Purple shimmer. Click: Renders NCI capability index, 2-column programme funnel and skill gap inference matrix. |
| `s10` | **Nucleus Intelligence** | MANAGERS, TALENT & AI | `S10` Console | Badge `Model Gov` (Violet Pill). Hover: Pulsing violet shadow (`rgba(155, 140, 255, 0.3)`). Click: Opens autonomous agent reasoning ledger & permission table. |

---

### Module 2: Core HR (`core_hr`)
*Foundation of Employee Management, Lifecycle, Compliance & Org Structures*

- **Left Dock Icon**: `Users`
- **Default Trigger**: Launches `PeopleCoreView` (`core_people`).
- **Sub-Nav Header**: `Core HR` — *Foundation of employee management*

#### Sub-Modules & Interaction Behaviors:

| Sub-Module ID | Sub-Module Label | Group Heading | Primary View | Micro-Interactions & Visual Effects |
|---|---|---|---|---|
| `core_people` | **People Core** | FOUNDATION & LIFECYCLE | `PeopleCoreView` | **Default Active**. Hover: Scale icon `1.08x`, background `rgba(255,255,255,0.04)`. Click: Crossfades employee directory with live search, filters & digital profiles. |
| `core_attendance`| **Smart Attendance** | FOUNDATION & LIFECYCLE | `AttendanceView` | Hover: Clock icon ticks forward 15deg via CSS transform. Click: Mounts biometric turnstile sync, live clock-in ring & punch paired reconciliation. |
| `core_leaves` | **Leave Management** | FOUNDATION & LIFECYCLE | `LeaveView` | Hover: Calendar icon turns `#38BDF8`. Click: Loads leave policy balance cards, sandwich deduction visualizer & approval workflow table. |
| `core_onboarding`| **Onboarding & Lifecycle**| FOUNDATION & LIFECYCLE | `OnboardingView` | Hover: Layer icon pulses. Click: Injects 30-60-90 day milestone checklist, candidate document vault & exit clearance tracker. |
| `core_org` | **Organization Management**| ORGANIZATION & GOVERNANCE| `TeamView` | Hover: Building icon glows white. Click: Renders dynamic SVG organization chart, reporting lines & department head allocations. |
| `core_workforce` | **Workforce Management** | ORGANIZATION & GOVERNANCE| `ContractWorkforceView`| Hover: Amber border accent. Click: Launches FTE vs contractor ratio monitor, staffing vendor performance cards & headcount quota gauges. |
| `core_operations`| **HR Operations** | ORGANIZATION & GOVERNANCE| `HelpdeskView` | Hover: Help circle rotates 10deg. Click: Loads SLA helpdesk queue, automated employee letter generator & query resolution timer. |
| `core_compliance`| **Compliance (2026 Codes)**| ORGANIZATION & GOVERNANCE| `ComplianceView` | **Highlighted Badge**. Shimmering teal border. Hover: Box-shadow `0 0 14px rgba(45,212,168,0.2)`. Click: 2026 Labour Code wage floor simulator & penalty auditor. |

---

### Module 3: Talent (`talent`)
*Acquisition, OKRs, Continuous Learning & Career Progression*

- **Left Dock Icon**: `UserPlus`
- **Default Trigger**: Launches `RecruitmentView` (`talent_ats`).
- **Sub-Nav Header**: `Talent` — *Hiring, growth and development*

#### Sub-Modules & Interaction Behaviors:

| Sub-Module ID | Sub-Module Label | Group Heading | Primary View | Micro-Interactions & Visual Effects |
|---|---|---|---|---|
| `talent_ats` | **Talent ATS** | ACQUISITION & PERFORMANCE | `RecruitmentView` | **Highlighted Badge**. Hover: Emerald border glow. Click: Mounts requisition pipeline, candidate Kanban swimlanes & AI resume parsing scorecards. |
| `talent_performance`| **Performance & OKRs** | ACQUISITION & PERFORMANCE | `PerformanceView` | Hover: Trending up icon shifts up-right `2px`. Click: Loads quarterly appraisal review cycles, goal cascade trees & 360 peer feedback. |
| `talent_learning` | **Learning & L&D** | ACQUISITION & PERFORMANCE | `LearningView` | Hover: Book icon flip effect. Click: Renders SCORM module catalog, mandatory compliance training tracks & digital skill certificates. |
| `talent_skills` | **Skills & Capability** | ACQUISITION & PERFORMANCE | `ExperienceView` | Hover: Sparkles icon glows `#C4B5FD`. Click: Displays enterprise skill taxonomy radar, autonomous gap inferencing & upskilling suggestions. |
| `talent_succession`| **Succession Planning** | GROWTH & RECOGNITION | `PerformanceView` | Hover: Scale `1.04x`. Click: Triggers 9-Box talent calibration view with high-potential bench strength metrics. |
| `talent_mobility` | **Internal Mobility (IJP)**| GROWTH & RECOGNITION | `RecruitmentView` | Hover: ArrowUpRight icon translates `+2px, -2px`. Click: Renders internal job posting portal, lateral skill matching & transfer approval pipeline. |
| `talent_recognition`| **Recognition & Feedback**| GROWTH & RECOGNITION | `ExperienceView` | Hover: Award icon glows amber. Click: Launches employee peer kudos ledger, reward points redeem center & cultural pulse feed. |

---

### Module 4: Payroll & Finance (`payroll_finance`)
*Gross-to-Net DAG, Statutory Liability, Compensation Bands & Claims*

- **Left Dock Icon**: `CreditCard`
- **Default Trigger**: Launches `PayrollView` (`payroll_global`).
- **Sub-Nav Header**: `Payroll & Finance` — *Salary, benefits and finance operations*

#### Sub-Modules & Interaction Behaviors:

| Sub-Module ID | Sub-Module Label | Group Heading | Primary View | Micro-Interactions & Visual Effects |
|---|---|---|---|---|
| `payroll_global` | **Global Payroll** | PAYROLL & COMPENSATION | `PayrollView` | **Highlighted Badge**. Hover: Card border glows teal. Click: Mounts multi-stage Gross-to-Net payroll processing DAG & bank file export. |
| `payroll_comp` | **Compensation & Benefits** | PAYROLL & COMPENSATION | `CompensationView` | Hover: Dollar icon color shifts to `#10B981`. Click: Renders salary band benchmarking, compa-ratio distribution curves & equity grant vesting. |
| `payroll_claims` | **Reimbursements & Claims** | PAYROLL & COMPENSATION | `PayrollView` | Hover: File icon elevates. Click: Loads OCR receipt upload portal, policy limit validation badges & manager payout approvals. |
| `payroll_ewa` | **Loans, Advances & EWA** | PAYROLL & COMPENSATION | `PayrollView` | Hover: TrendingUp icon green pulse. Click: Launches Earned Wage Access (EWA) liquidity slider with automated next-cycle EMI deductions. |
| `payroll_tax` | **Tax & Statutory** | STATUTORY & ACCOUNTING | `ComplianceView` | Hover: ShieldCheck turns `#38BDF8`. Click: Mounts PF ECR file generator, ESIC monthly return challans & TDS 24Q quarterly verification. |
| `payroll_accounting`| **Payroll Accounting (GL)** | STATUTORY & ACCOUNTING | `PayrollView` | Hover: Building icon scales. Click: Renders balanced double-entry salary journal vouchers with ERP cost-center mapping. |
| `payroll_fnf` | **Full & Final Settlement** | STATUTORY & ACCOUNTING | `OnboardingView` | Hover: CheckCircle turns coral `#F43F5E`. Click: Loads exit recovery DAG, gratuity entitlement calculator & asset surrender checklist. |

---

### Module 5: Workforce Operations (`workforce_ops`)
*Shift Rostering, Field Geo-Tracking, Project Pods & Contingent Workers*

- **Left Dock Icon**: `Briefcase`
- **Default Trigger**: Launches `AttendanceView` (`ops_rosters`).
- **Sub-Nav Header**: `Workforce Operations` — *Day-to-day workforce execution*

#### Sub-Modules & Interaction Behaviors:

| Sub-Module ID | Sub-Module Label | Group Heading | Primary View | Micro-Interactions & Visual Effects |
|---|---|---|---|---|
| `ops_rosters` | **Shift Planning & Rosters**| SCHEDULING & WORKFORCE | `AttendanceView` | Hover: Calendar rotates slightly. Click: Renders interactive multi-shift calendar grid with drag-and-drop roster swap and gap detection. |
| `ops_projects` | **Projects & Pod Allocation**| SCHEDULING & WORKFORCE | `ProjectView` | Badge `Sprints`. Hover: Briefcase icon pulses. Click: Launches Kanban sprint boards, pod velocity burndown charts & billable allocation. |
| `ops_field` | **Field Workforce** | SCHEDULING & WORKFORCE | `AttendanceView` | Hover: Clock icon glow. Click: Mounts geo-fenced mobile punch validator, field route map waypoints & live beat compliance tracker. |
| `ops_contract` | **Contract Workforce** | SCHEDULING & WORKFORCE | `ContractWorkforceView`| **Highlighted Badge**. Hover: Glow border. Click: Turnstile biometric logs vs staffing agency invoice reconciliation table. |
| `ops_assets` | **Assets & Gate Passes** | OPERATIONS & ASSETS | `OnboardingView` | Hover: Shield icon scales. Click: IT hardware serial number custody log, e-gate pass issuance & equipment return receipts. |
| `ops_travel` | **Travel & Duty Management** | OPERATIONS & ASSETS | `PayrollView` | Hover: FileText icon turns sky blue. Click: Business travel booking approval flow, hotel expense policy checker & per diem calculator. |
| `ops_timesheets` | **Timesheets & Productivity** | OPERATIONS & ASSETS | `ProjectView` | Hover: Timer ticks. Click: Weekly client timesheet approval matrix with automated billing export and idle-time flags. |

---

### Module 6: Analytics & AI (`analytics_ai`)
*Cross-Domain Intelligence, Predictive Attrition, Custom CMS Reports & Copilot*

- **Left Dock Icon**: `BarChart3`
- **Default Trigger**: Launches `AnalyticsView` (`analytics_exec`).
- **Sub-Nav Header**: `Analytics & AI` — *Insights, dashboards and AI intelligence*

#### Sub-Modules & Interaction Behaviors:

| Sub-Module ID | Sub-Module Label | Group Heading | Primary View | Micro-Interactions & Visual Effects |
|---|---|---|---|---|
| `analytics_exec` | **Executive Dashboards** | DASHBOARDS & INTELLIGENCE | `DashboardView` | Hover: LineChart icon animates upward. Click: Crossfades to C-Suite KPI summary pulse with predictive headcount variance. |
| `analytics_people` | **People Intelligence** | DASHBOARDS & INTELLIGENCE | `AnalyticsView` | Hover: Users icon glows `#38BDF8`. Click: Loads 90-day machine learning flight-risk predictions, demographic ratios & DEI metrics. |
| `analytics_workforce`| **Workforce Analytics** | DASHBOARDS & INTELLIGENCE | `AnalyticsView` | Hover: Clock icon glows amber. Click: Overtime cost anomaly heatmaps, shift utilization trends & absenteeism rate correlations. |
| `analytics_payroll` | **Payroll Analytics** | DASHBOARDS & INTELLIGENCE | `AnalyticsView` | Hover: CreditCard icon turns emerald. Click: Monthly wage bill waterfall bridge, bonus variance & future statutory liability projection. |
| `analytics_talent` | **Talent Analytics** | DASHBOARDS & INTELLIGENCE | `AnalyticsView` | Hover: UserPlus icon glows violet. Click: Recruitment pipeline funnel velocity, source-of-hire yield & cost-per-hire breakdown. |
| `analytics_copilot` | **AI Copilot & Agents** | AI & CUSTOM REPORTING | `AIPanel Drawer` | **Highlighted Badge (Violet)**. Hover: Pulsing violet shadow. Click: Slides in 420px right offcanvas reasoning agent with policy RAG citations. |
| `analytics_custom` | **Custom Reports** | AI & CUSTOM REPORTING | `AnalyticsView` | Hover: FileText rotates 5deg. Click: Dynamic CMS drag-and-drop report builder with scheduled CSV/PDF export cron dispatch. |

---

### Module 7: Platform & Admin (`platform`)
*Access Control (RBAC), Workflow Node Studio, Enterprise APIs & Audit Trail*

- **Left Dock Icon**: `Settings` (Anchored at bottom dock)
- **Default Trigger**: Launches `SettingsView` (`platform_integrations`).
- **Sub-Nav Header**: `Platform` — *Administration, integrations and platform settings*

#### Sub-Modules & Interaction Behaviors:

| Sub-Module ID | Sub-Module Label | Group Heading | Primary View | Micro-Interactions & Visual Effects |
|---|---|---|---|---|
| `platform_integrations`| **Integrations & API** | INTEGRATIONS & AUTOMATION | `IntegrationsView` | Hover: Settings gear rotates 45deg smoothly. Click: ERP connectors (SAP/Oracle), Slack webhooks & OpenAPI REST key management. |
| `platform_workflows` | **Workflow Automation** | INTEGRATIONS & AUTOMATION | `OnboardingView` | **Highlighted Badge**. Hover: Layer icon glows teal. Click: Launches visual node flowchart designer for automated employee lifecycle triggers. |
| `platform_roles` | **Roles & Permissions (RBAC)**| INTEGRATIONS & AUTOMATION| `AccessControlView` | Hover: ShieldCheck glows `#2DD4A8`. Click: Matrix editor for Super Admin, HRBP, Manager, and Employee permissions with field-level masking. |
| `platform_settings` | **Settings & Configuration** | INTEGRATIONS & AUTOMATION | `SettingsView` | Hover: Sliders icon adjusts. Click: Entity legal name setup, fiscal year parameters, operational site coordinates & holiday lists. |
| `platform_security` | **Security Center** | SECURITY & GOVERNANCE | `SettingsView` | Hover: Shield icon turns `#38BDF8`. Click: SAML SSO identity provider configuration, Google/Microsoft MFA enforcement & session timeout rules. |
| `platform_notifications`| **Notifications & Alerts** | SECURITY & GOVERNANCE | `SettingsView` | Hover: Bell icon rings (wiggles 12deg). Click: Multi-channel delivery rules (Push, Email, Slack) & SLA breach alert triggers. |
| `platform_audit` | **Audit Logs & Activity** | SECURITY & GOVERNANCE | `SettingsView` | Hover: FileText icon glows white. Click: Cryptographically verifiable immutable action ledger tracking every admin override and change. |

---

### Module 8: Feature Catalog (`catalog`)
*Global Instant Access Matrix & Directory*

- **Left Dock Icon**: `Layers`
- **Keyboard Shortcut**: `⌘M` or `Ctrl+M`
- **Micro-Interactions & Visual Effects**:
  - Clicking `catalog` opens the visual card matrix overlay (`showCatalog = true`).
  - Background: Full workspace glass scrim (`backdrop-filter: blur(12px)`).
  - Search input: Auto-focused on open; typing performs live instant fuzzy filtering across all 46 modules and sub-modules.
  - Category tabs: Filter by `All`, `Core HR`, `Talent`, `Payroll`, `Operations`, `Analytics`, `Platform`.
  - Cards: On hover, elevate `translateY(-3px)`, glow border `rgba(45, 212, 168, 0.35)`, reveal direct launch button.

---

## 4. Modal & Drawer Overlay Micro-Interactions

### 4.1 Dual-Pane Navigation Modal (`DualPaneNav.js`)
Triggered via `⌘M`, `Ctrl+M`, or the top header button.

- **Entrance Animation**:
  - Backdrop: `opacity: 0 -> 1` over `180ms ease-out`.
  - Modal Card (`820px` width): `transform: scale(0.96) translateY(8px) -> scale(1) translateY(0)` over `260ms cubic-bezier(0.16, 1, 0.3, 1)`.
- **Left Pane (Categories)**:
  - Width: `280px`. Vertical list of 6 categories.
  - Hovering or arrow-keying updates right pane sub-modules with zero latency.
- **Right Pane (Sub-Modules)**:
  - Width: `540px`. Two-column grid of sub-feature items.
  - Each item displays: Icon, bold title, two-line description, and role tags (`tagViolet`, `tagTeal`).
  - Clicking any item navigates directly to the target view and automatically dismisses the modal.

### 4.2 Sliding Drawers (`AIPanel.js` & `ChatPanel.js`)
Triggered via bottom-right floating action buttons (`Ask AI` & `Team Messages`).

- **Slide-In Physics**:
  - `transform: translateX(100%) -> translateX(0)` over `320ms cubic-bezier(0.16, 1, 0.3, 1)`.
  - Fixed dimensions: Width `420px`, Height `calc(100vh - 72px)`.
  - Zero layout reflow: Does not shift or resize the underlying dashboard or table view.
- **Mutual Exclusivity**:
  - Opening the AI Drawer automatically closes the Chat Drawer with a smooth 150ms cross-fade exit.

---

## 5. Universal Tooltip Confinement Algorithm

All chart hover popups and navigation tooltips in Nucleus HRMS implement strict boundary confinement:

```javascript
// Universal ECharts Tooltip Confinement (src/components/Charts/NucleusChart.js)
const defaultTooltip = {
    confine: true,                                // Keeps popup strictly within container boundaries
    backgroundColor: 'rgba(6, 13, 24, 0.96)',     // Ultra-dark glassmorphism
    borderColor: 'rgba(45, 212, 168, 0.35)',      // Cyan-teal highlight border
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: '#F1F5F9', fontSize: 12 },
    extraCssText: 'backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.5); border-radius: 8px;'
};
```

- **Auto-Flip Behavior**: When hovering over widgets near viewport edges (e.g. left-side funnels or right-side heatmaps), tooltips dynamically reverse their orientation (left-to-right or top-to-bottom), completely eliminating container overflow or clipping.

---

## 6. Accessibility (a11y) & Keyboard Matrix

| Key Combination | Scope | Triggered Action |
|---|---|---|
| `⌘K` / `Ctrl+K` | Global | Focuses universal search input in TopNav with live autocomplete. |
| `⌘M` / `Ctrl+M` | Global | Toggles Dual-Pane Navigation Modal. |
| `Escape` | Global | Closes open modals (DualPaneNav, CMSModal, AccessControl) or sliding drawers (AI/Chat). |
| `ArrowUp` / `ArrowDown` | Right Sub-Nav / DualPaneNav | Cycles focus through sub-module list items. |
| `Enter` / `Space` | Navigation Buttons | Activates selected sub-module and initiates view transition. |
| `Tab` / `Shift+Tab` | Navigation Components | Navigates between Left Dock, TopNav controls, and Sub-Nav pane in strict sequential DOM order. |

---

## 7. Developer & Implementation Checklist

- [x] LeftDock hover expand/collapse uses hardware-accelerated transforms (`transform: translateX()`).
- [x] All 8 primary domains mapped to specific default sub-modules without broken routes.
- [x] RightSubNav items feature active state visual indicator bars with glowing dropshadows.
- [x] Chart tooltips across all consoles (`S1`–`S10`) enforce `confine: true` to prevent clipping.
- [x] Sliding drawers (`AIPanel`, `ChatPanel`) operate on fixed offcanvas positioning with mutual exclusivity.
- [x] Keyboard shortcuts (`⌘K`, `⌘M`, `Esc`) bound globally with cleanup on unmount.
