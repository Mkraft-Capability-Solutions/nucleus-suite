# Nucleus HRMS — Application Layout, Skeleton & Navigation Architecture

**Document Type:** Master Layout Structure, Navigation Hierarchy & Redirection Matrix  
**Application:** Nucleus HRMS (Enterprise Workforce & Operations Platform)  
**Version:** 2.0.0-PROD  
**Target Audience:** Frontend Engineers, Backend Developers, UI/UX Architects, QA Automation Engineers  

---

## 1. Master Layout & Skeleton Architecture

The application layout is structured as a zero-reflow, hardware-accelerated, single-page application (SPA) shell within Next.js App Router (`src/app/page.js`). It maintains persistent view states, avoids full-page browser reloads, and isolates modal/drawer overlays from the main workspace document flow.

```
+-----------------------------------------------------------------------------------------------------------------------------+
| TopNav (Fixed Header: 56px height, z-index 100)                                                                            |
| [Logo] [Search Bar: ⌘K] [Modules: ⌘M]  [Dashboards: S1..S10 v]  |  [Theme] [Access Control] [Notifs] [Role Switcher]        |
+----------+-----------------------------------------------------------------------------------------+------------------------+
| LeftDock | MainWorkspace Zone (Scrollable Container, flex: 1)                                      | RightSubNav (260px)    |
| (64px -> |                                                                                         | (Contextual Sub-Nav)   |
| 240px    |  +-----------------------------------------------------------------------------------+  |                        |
| hover)   |  | Adaptive Hero Launchpad (Dynamic greeting, live time, punch & quick actions)        |  | - Sub-module items     |
|          |  +-----------------------------------------------------------------------------------+  | - S1..S10 consoles     |
| - Dash   |  | Active Module View / Active Dashboard Screen (S1..S10 OR Module 1..18)              |  | - Status tags          |
| - Cat    |  | (e.g. S8 EmployeeHome, LeaveView, ProjectView, PayrollView, etc.)                   |  |                        |
| - Core   |  +-----------------------------------------------------------------------------------+  | [Toggle Button in      |
| - Talent |  | Grounded Daily Operational Cards (Today's Focus, Company Broadcasts, Pod Sprints)  |  |  TopNav: PanelRight]   |
| - Pay    |  +-----------------------------------------------------------------------------------+  |                        |
| - Ops    |                                                                                         |                        |
| - Intel  |                                                                                         |                        |
| - Plat   |                                                                                         |                        |
+----------+-----------------------------------------------------------------------------------------+------------------------+
| Fixed Overlays (z-index 990-10000):                                                                                         |
| - DualPaneNav Modal (⌘M: Left 6 Domains 260px | Right Sub-Modules 520px)                                                   |
| - Floating Action Stack (Bottom-Right: [Ask AI Assistant] [Team Messages]) -> Opens AIPanel / ChatPanel                   |
| - AttendanceFAB (Fixed Dial in AttendanceView)                                                                             |
| - CMSModal (Broadcasts & Announcements) & AccessControlModal                                                               |
| - Global Toast Notifications (Fixed Top-Right)                                                                             |
+-----------------------------------------------------------------------------------------------------------------------------+
```

### 1.1 Structural CSS Grid & Layout Dimensions

| Component | File Path | Width / Height | Position / Layer | Responsive & State Behavior |
|---|---|---|---|---|
| **Shell Container** | `src/app/page.module.css` | `100vw`, `100vh` | `relative`, `overflow: hidden` | Root viewport container; handles dark/light background gradient tokens. |
| **LeftDock** | `src/components/Clerio/LeftDock.js` | Width: `64px` (collapsed), `240px` (hovered) | Fixed Left, `z-index: 90` | Expands on hover with CSS transition (`cubic-bezier(0.4, 0, 0.2, 1)`). Displays tooltips when collapsed. |
| **TopNav** | `src/components/Clerio/TopNav.js` | Height: `56px`, Width: `calc(100% - 64px)` | Sticky Top, `z-index: 100` | Frosted glass background (`rgba(6, 13, 24, 0.85)`, `backdrop-filter: blur(12px)`). Contains search and role switcher. |
| **Workspace Zone** | `src/components/Clerio/MainWorkspace.js` | Flex: `1`, Height: `calc(100vh - 56px)` | Scrollable Body, `overflow-y: auto` | Hosts active view. Applies `padding: 1.25rem 2rem 5rem` for dashboard, `1.5rem 2rem 5rem` for functional modules. |
| **RightSubNav** | `src/components/Clerio/RightSubNav.js` | Width: `260px`, Height: `calc(100vh - 56px)` | Fixed Right / Flex, `z-index: 80` | Collapsible via `isRightNavOpen` state; renders contextual sub-features for the active domain. |
| **DualPaneNav** | `src/components/Navigation/DualPaneNav.js` | Width: `820px`, Max-Height: `85vh` | Centered Modal, `z-index: 9999` | Backdrop blur `rgba(6, 13, 24, 0.8)`. Left pane `280px` (6 categories), Right pane `540px` (search & sub-modules). |
| **Floating Action Stack** | `src/app/page.module.css:308-334` | Fixed Bottom-Right (`bottom: 1.5rem`, `right: 1.5rem`) | Fixed, `z-index: 990` | Vertical button pill stack: `Ask AI` (`Sparkles`) and `Messages` (`MessageSquare` with unread badge `2`). |
| **Floating Drawers (AI & Chat)** | `AIPanel.js` / `ChatPanel.js` | Width: `420px`, Height: `calc(100vh - 72px)` | Fixed Right Drawer, `z-index: 995` | Mutually exclusive sliding panels. Pushes neither layout nor scroll position. |
| **Toast Notifications** | `Toast.js` / `Toast.module.css` | Max-Width: `380px`, Top-Right | Fixed, `z-index: 10000` | Stacked floating toasts with auto-dismiss timers (3.5s – 5.0s). |

---

## 2. Global State & Navigation Controller

Navigation is centrally driven by React state in `src/app/page.js` and synchronized via `useAuth()` and `useHRMS()` contexts:

```javascript
// Central Routing State Machine (src/app/page.js)
const [activeDomain, setActiveDomain] = useState('dashboard');       // 'dashboard' | 'core_hr' | 'talent' | 'payroll_finance' | 'workforce_ops' | 'analytics_ai' | 'platform'
const [activeTab, setActiveTab] = useState('dashboard');             // Active Functional View (18 Modules + 'dashboard')
const [activeConsole, setActiveConsole] = useState('S1');            // Active Dashboard Console ('S1' through 'S10')
const [activeSubFeature, setActiveSubFeature] = useState('s1');       // Deep Sub-feature slug (e.g. 'core_people', 'ops_rosters')
const [showCatalog, setShowCatalog] = useState(false);               // Feature Catalog Grid overlay
const [isRightNavOpen, setIsRightNavOpen] = useState(true);          // Collapsible contextual right sidebar
const [isModulesOpen, setIsModulesOpen] = useState(false);           // Dual-Pane Navigation Modal (⌘M)
const [activeFloatingDrawer, setActiveFloatingDrawer] = useState(null); // 'ai' | 'chat' | null
```

---

## 3. Navigation Controls & Entry Points

### 3.1 LeftDock (Global High-Level Domains)
The LeftDock defines the 6 primary enterprise operational domains and global utilities:

| Dock Item ID | Display Label | Icon | Primary Default View | Contextual Domain Set | Redirection Action |
|---|---|---|---|---|---|
| `dashboard` | **Dashboard** | `LayoutGrid` | Active Console (`S1`..`S10`) | `dashboard` | Sets `activeTab = 'dashboard'`. Loads active persona's default console (`S1` for Super Admin, `S8` for Employee, etc.). |
| `catalog` | **Feature Catalog** | `Layers` | `CatalogGridView` | None | Toggles `showCatalog = !showCatalog`. Renders 18-module visual card matrix with search filter. |
| `core_hr` | **Core HR** | `Users` | `PeopleCoreView` | `core_hr` | Sets `activeTab = 'people_core'`, `activeSubFeature = 'core_people'`. Opens employee directory. |
| `talent` | **Talent** | `UserPlus` | `RecruitmentView` | `talent` | Sets `activeTab = 'recruitment'`, `activeSubFeature = 'talent_ats'`. Opens recruitment pipeline. |
| `payroll_finance`| **Payroll & Finance** | `CreditCard` | `PayrollView` | `payroll_finance` | Sets `activeTab = 'payroll'`, `activeSubFeature = 'payroll_global'`. Opens global payroll runs. |
| `workforce_ops` | **Workforce Operations**| `Briefcase` | `AttendanceView` | `workforce_ops` | Sets `activeTab = 'attendance'`, `activeSubFeature = 'ops_rosters'`. Opens muster roll. |
| `analytics_ai` | **Analytics & AI** | `BarChart3` | `AnalyticsView` | `analytics_ai` | Sets `activeTab = 'analytics'`, `activeSubFeature = 'analytics_exec'`. Opens exec reports. |
| `platform` | **Platform & Admin** | `Settings` | `SettingsView` | `platform` | Sets `activeTab = 'settings'`, `activeSubFeature = 'platform_integrations'`. Opens integrations & settings. |

---

### 3.2 TopNav Header Controls
The TopNav provides universal search, quick module access, console switching, and role simulation:

| UI Control | Element Type | Keyboard Shortcut | Target Redirection / Behavior |
|---|---|---|---|
| **Global Search** | Input text field | `⌘K` / `Ctrl+K` | Fuzzy searches employees, tasks, documents. Automatically triggers `showCatalog = true` on text input to display live search grid. |
| **Modules Launcher** | Teal outlined button | `⌘M` / `Ctrl+M` | Toggles `isModulesOpen = !isModulesOpen` to display the Dual-Pane Navigator overlay. |
| **Dashboards Selector**| Dropdown button | None | Opens menu of permitted consoles (`S1`–`S10`) based on user RBAC. Selecting a console switches `activeConsole`, sets `activeTab = 'dashboard'`, and displays confirmation toast. |
| **Access Control Button**| Shield button (Super Admin only)| None | Immediately navigates to `AccessControlView` (`activeTab = 'access_control'`). |
| **Theme Switcher** | Sun/Moon icon button | None | Toggles dark/light visual theme tokens across all CSS modules and ECharts themes. |
| **Right Nav Toggle** | `PanelRight` icon button | None | Collapses or expands `RightSubNav` (`isRightNavOpen = !isRightNavOpen`). |
| **Role Switcher** | User profile dropdown | None | Instantly swaps active persona (`SUPER_ADMIN`, `HR_MANAGER`, `PROJECT_MANAGER`, `TEAM_LEAD`, `FINANCE_MANAGER`, `EMPLOYEE`). Automatically re-routes user to their role's default console (`S1`, `S2`, `S5`, `S7`, `S8`) and re-filters visible modules. |

---

### 3.3 DualPaneNav (Two-Pane Modal Navigator — `⌘M`)
The Dual-Pane modal enables keyboard-driven navigation across all 6 domains and 18 functional modules:
* **Left Pane (Category Selector, 280px):**
  1. `Dashboard Consoles` (`badge: S1–S10`)
  2. `Core HR` (`badge: 8 Modules`)
  3. `Talent` (`badge: 7 Modules`)
  4. `Payroll & Finance` (`badge: 7 Modules`)
  5. `Workforce Operations` (`badge: 7 Modules`)
  6. `Analytics & AI` (`badge: 7 Modules`)
  7. `Platform & Admin` (`badge: 7 Modules`)
* **Right Pane (Sub-module Grid, 540px):**
  * Displays search input with auto-focus.
  * Shows sub-module cards with icon, description, and status tag (e.g. `2026 Code`, `Pipeline`, `Gross-to-Net`, `Studio`).
  * Clicking any card calls `onSelectTab(targetTab, domainId, subId)`, updates workspace, and closes the modal.

---

### 3.4 RightSubNav (Contextual Right Drawer)
When a domain is selected from LeftDock, `RightSubNav` displays its categorized sub-modules:

| Active Domain | Sub-Module Group 1 | Sub-Module Group 2 | Mapped `activeTab` Targets |
|---|---|---|---|
| **Dashboard** | Executive & Leadership (`S1`..`S5`) | Managers, Talent & AI (`S6`..`S10`) | `dashboard` (switches active console) |
| **Core HR** | Foundation & Lifecycle (`core_people`, `core_attendance`, `core_leaves`, `core_onboarding`) | Organization & Governance (`core_org`, `core_workforce`, `core_operations`, `core_compliance`) | `people_core`, `attendance`, `leaves`, `onboarding`, `team`, `contract_workforce`, `helpdesk`, `compliance` |
| **Talent** | Acquisition & Performance (`talent_ats`, `talent_performance`, `talent_learning`, `talent_skills`) | Growth & Recognition (`talent_succession`, `talent_mobility`, `talent_recognition`) | `recruitment`, `performance`, `learning`, `experience` |
| **Payroll & Finance** | Payroll & Compensation (`payroll_global`, `payroll_comp`, `payroll_claims`, `payroll_ewa`) | Statutory & Accounting (`payroll_tax`, `payroll_accounting`, `payroll_fnf`) | `payroll`, `compensation`, `compliance`, `onboarding` |
| **Workforce Ops** | Scheduling & Workforce (`ops_rosters`, `ops_projects`, `ops_field`, `ops_contract`) | Operations & Assets (`ops_assets`, `ops_travel`, `ops_timesheets`) | `attendance`, `projects`, `contract_workforce`, `onboarding`, `payroll` |
| **Analytics & AI** | Dashboards & Intelligence (`analytics_exec`, `analytics_people`, `analytics_workforce`, `analytics_payroll`, `analytics_talent`) | AI & Custom Reporting (`analytics_copilot`, `analytics_custom`) | `dashboard`, `analytics`, drawer: `'ai'` |
| **Platform** | Integrations & Automation (`platform_integrations`, `platform_workflows`, `platform_roles`, `platform_settings`) | Security & Governance (`platform_security`, `platform_notifications`, `platform_audit`) | `integrations`, `onboarding`, `access_control`, `settings` |

---

## 4. Master Redirection Matrix (From Where to Where)

This matrix maps every interactive click trigger in the application to its exact target view, state mutation, and result:

### 4.1 Dashboard Hero & Global Shell Redirections

```
[Adaptive Hero Card]
    |-- Click "Punch In / Out" ---------> Updates HRMSContext attendance state, emits notification toast
    |-- Click "Apply Leave" ------------> activeTab = 'leaves' (LeaveView)
    |-- Click "Claim Expense" ----------> activeTab = 'compensation' (CompensationView)
    |-- Click "Org / Team Directory" ---> activeTab = 'team' (OrganizationView)
    |-- Click "Broadcasts (CMS)" -------> Opens CMSModal (Announcements & Policy Broadcasts)
    |-- Click "Configure Access" -------> activeTab = 'access_control' (AccessControlView)
    |-- Click "3 Approvals Pending" ----> activeTab = 'leaves' (LeaveView Approvals Tab)
```

| Source Location | Trigger Element | Event / Handler | Target State Change | Destination View / Outcome |
|---|---|---|---|---|
| **Hero (Employee Mode)** | `Punch In Now` / `Punch Out` | `onClick={punchIn/punchOut}` | Mutates `attendance.status` | Updates radial clock ring, triggers attendance confirmation toast |
| **Hero (Employee Mode)** | `Apply Leave` button | `onClick={() => onTabChange('leaves')}` | `activeTab = 'leaves'` | Navigates to `LeaveView.js` with application form ready |
| **Hero (Employee Mode)** | `Claim Expense` button | `onClick={() => onTabChange('compensation')}` | `activeTab = 'compensation'` | Navigates to `CompensationView.js` expense claims tab |
| **Hero (Employee Mode)** | `Team Directory` button | `onClick={() => onTabChange('team')}` | `activeTab = 'team'` | Navigates to `TeamView.js` (Org chart & team directory) |
| **Hero (All Modes)** | `Broadcasts (N)` button | `onClick={() => setIsCMSModalOpen(true)}` | `isCMSModalOpen = true` | Opens `CMSModal.js` overlay to view or publish announcements |
| **Hero (Executive Mode)**| `Configure Access` button| `onClick={() => onTabChange('access_control')}`| `activeTab = 'access_control'`| Navigates to `AccessControlView.js` RBAC studio |
| **Hero (Manager Mode)** | `3 Approvals Pending` | `onClick={() => onTabChange('leaves')}` | `activeTab = 'leaves'` | Navigates to `LeaveView.js` filtered to manager approval queue |
| **TopNav** | Console Selector Item (`S1..S10`) | `onClick={() => onSelectConsole(id)}` | `activeConsole = id`, `activeTab = 'dashboard'` | Renders selected cockpit view in main workspace |
| **TopNav** | Profile Role Item (`HR_MANAGER`, etc.) | `onClick={() => switchRole(id)}` | Context user role updated, default console loaded | Re-renders entire UI with filtered permissions and role badge |
| **TopNav** | `Access Control` button | `onClick={() => onTabChange('access_control')}`| `activeTab = 'access_control'`| Navigates directly to Access Control studio |
| **LeftDock** | Logo Mark (`N`) | `onClick={() => onSelectDomain('dashboard')}` | `activeTab = 'dashboard'`, `activeDomain = 'dashboard'` | Returns to active cockpit home |
| **LeftDock** | `Feature Catalog` button | `onClick={onToggleCatalog}` | `showCatalog = !showCatalog` | Displays `CatalogGridView.js` card matrix |

---

### 4.2 Cockpit S8 (Employee Home) Redirections

```
[Cockpit S8: Employee Home]
    |-- Quick Nav "Apply / View Leaves" --------> activeTab = 'leaves'
    |-- Quick Nav "Assigned Tasks & Sprints" ---> activeTab = 'projects'
    |-- Quick Nav "Reporting Line & Team Pod" --> activeTab = 'team'
    |-- Quick Nav "Payslip & Tax 24Q" ----------> activeTab = 'payroll'
    |-- Quick Nav "Monthly Attendance Log" -----> activeTab = 'attendance'
    |-- Quick Nav "My OKRs & Goals" ------------> activeTab = 'performance'
    |-- Quick Nav "Policy Helpdesk" ------------> activeTab = 'helpdesk'
    |-- Shift Status: Click "Punch Button" -----> Mutates check-in/out timestamp
    |-- Leave Balance: Click "Apply Leave ->" --> activeTab = 'leaves'
    |-- Payslip Card: Click "View Payslip ->" --> activeTab = 'payroll'
    |-- Grounded AI: Click "Apply for dates" ----> activeTab = 'leaves' (pre-filled)
    |-- Grounded AI: Click "Open in Helpdesk" ---> activeTab = 'helpdesk'
    |-- Timesheet: Click "+ Log Project Time" --> Opens isLogModalOpen modal
    |-- Timesheet: Click "Submit for Approval" -> timesheetStatus = 'submitted' (dispatches to manager)
    |-- Reporting Pod: Click "View Full Org" ---> activeTab = 'team'
    |-- Reporting Pod: Click "My Profile" ------> activeTab = 'people_core'
```

| Source Widget | Trigger Element | Handler / Payload | Destination & State Effect |
|---|---|---|---|
| **Quick Nav Hub** | `Apply / View Leaves` | `onNavigate('leaves')` | Switches workspace to `LeaveView.js` |
| **Quick Nav Hub** | `Assigned Tasks & Sprints` | `onNavigate('projects')` | Switches workspace to `ProjectView.js` (Kanban Board) |
| **Quick Nav Hub** | `Reporting Line & Team Pod` | `onNavigate('team')` | Switches workspace to `TeamView.js` (Reporting Hierarchy) |
| **Quick Nav Hub** | `Payslip & Tax 24Q` | `onNavigate('payroll')` | Switches workspace to `PayrollView.js` (Payslip generator) |
| **Quick Nav Hub** | `Monthly Attendance Log` | `onNavigate('attendance')` | Switches workspace to `AttendanceView.js` (30-day calendar) |
| **Quick Nav Hub** | `My OKRs & Goals` | `onNavigate('performance')` | Switches workspace to `PerformanceView.js` (Goal cascade) |
| **Quick Nav Hub** | `Policy Helpdesk` | `onNavigate('helpdesk')` | Switches workspace to `HelpdeskView.js` (Policy documents) |
| **Leave Balance Ring** | `Apply Leave →` button | `onNavigate('leaves')` | Navigates to `LeaveView.js` with category pre-selected |
| **September Payslip Card**| `View Payslip →` button | `onNavigate('payroll')` | Navigates to `PayrollView.js` with latest payslip open |
| **Grounded AI Assistant** | `Apply for those dates →` | `onNavigate('leaves')` | Navigates to `LeaveView.js` with recommended dates |
| **Grounded AI Assistant** | `Open Policy in Helpdesk →` | `onNavigate('helpdesk')` | Navigates to `HelpdeskView.js` citing leave policy v4.2 |
| **Timesheet Suite** | `+ Log Project Time` | `setIsLogModalOpen(true)` | Opens modal: project select, task note, hours counter |
| **Timesheet Suite** | `Submit for Approval` | `handleSubmitTimesheet()` | Sets status to `'submitted'`, shows toast: *Dispatched to Amit Verma* |
| **Reporting Pod Card** | `View Full Org Chart →` | `onNavigate('team')` | Navigates to visual hierarchy in `TeamView.js` |
| **Reporting Pod Card** | `My Employee Profile →` | `onNavigate('people_core')` | Navigates to `PeopleCoreView.js` with self-profile open |

---

### 4.3 Operational Cockpit Triage Redirections (S2, S3, S5, S6, S7)

```
[Operational Cockpits]
    |-- S2 HR Ops: Click Approval Item ------------> Opens ApprovalActionModal (Approve / Reject / Reroute)
    |-- S2 HR Ops: Click "+ New Joiner" -----------> Opens Onboarding Wizard in OnboardingView
    |-- S3 Attendance: Click "Auto-Fill Rosters" --> Solves coverage gaps, triggers auto-fill toast
    |-- S4 Recruitment: Click "Offered Candidate" -> Routes to OnboardingView pre-boarding stage
    |-- S5 Payroll: Click "Release Bank File" -----> Triggers bank disbursement validation
    |-- S6 Performance: Click "Publish Ratings" ---> Navigates to PerformanceView rating publication
    |-- S6 Performance: Click "9-Box Quadrant" -----> Opens calibrated employee drilldown modal
    |-- S7 Manager: Click "Start a 1:1" -----------> Opens 1:1 agenda builder modal
    |-- S7 Manager: Click "Team Report" -----------> Downloads monthly team velocity PDF
```

| Source Cockpit | Action Element | Trigger Mechanism | Target Action & Result |
|---|---|---|---|
| **S2 (HR Ops)** | Approval Queue Item | `openApprovalModal(item, 'approve')` | Opens modal; on submit removes item from queue and emits toast |
| **S2 (HR Ops)** | `+ New Joiner` button | `alert()` / Navigation hook | Launches new joiner onboarding workflow |
| **S3 (Attendance)** | `Auto-Fill Rosters` | `setAutoFilled(true)` | Assigns reserve personnel to time-slots `-6`, `-5`, `-3`; clears gaps |
| **S5 (Payroll)** | Stepper Step Click | `setActiveStep(idx)` | Transitions active review stage (e.g. from inputs to exceptions) |
| **S5 (Payroll)** | `Clear All Exceptions` | `setBlockingExceptionsCleared(true)` | Resolves 2 duplicate bank accounts & 4 PAN errors; unblocks bank file |
| **S6 (Performance)**| 9-Box Quadrant Cell | `setSelectedCell(cell.id)` | Filters calibration candidate table to selected box (e.g. "Stars") |
| **S7 (Manager)** | `Start a 1:1` button | Modal trigger | Opens 1:1 collaborative agenda builder with direct report |
| **S7 (Manager)** | Triage Item Action | `openApprovalModal(item, 'approve')` | Clears manager approval debt with instant undo toast |
| **S10 (AI Governance)**| `Save as Widget` | `handleSaveWidget()` | Saves synthesized natural language query as permanent dashboard widget |

---

### 4.4 Grounded Daily Operational Cards Redirections
Rendered persistently at the bottom of the workspace below the active view:

| Card Component | User Interaction | Trigger Handler | Result / Destination |
|---|---|---|---|
| **Today's Focus** | Checkbox click on task | `onClick={() => completeFocusTask(t.id)}` | Toggles completion state with strikethrough styling; updates pending counter chip |
| **Company Broadcasts** | Click any announcement card | `onClick={() => setIsCMSModalOpen(true)}` | Opens `CMSModal.js` to view full announcement text, attachments, and links |
| **Company Broadcasts** | Click `View All (N) →` | `onClick={() => setIsCMSModalOpen(true)}` | Opens `CMSModal.js` master announcement archive |
| **Active Pod Sprints** | Click `Kanban Board →` | `onClick={() => onTabChange('projects')}` | Navigates to `ProjectView.js` with active sprint Kanban visible |

---

### 4.5 Floating Action Drawers (AI Assistant & Chat)
Positioned in the bottom-right corner (`styles.fabStack`):

| Floating Button | Active State | Associated Drawer | Drawer Capabilities & Redirections |
|---|---|---|---|
| **Ask AI (`Sparkles`)** | `isAIPanelOpen` | `AIPanel.js` (Slide-out Right, 420px) | Contextual prompt suggestions, grounded policy answers with citations, and `onNavigate(tab)` triggers that directly switch workspace tabs and close the drawer. |
| **Messages (`MessageSquare`)** | `isChatPanelOpen` | `ChatPanel.js` (Slide-out Right, 420px) | Real-time encrypted peer-to-peer and pod chat channels, file sharing, and direct employee message threads. |

---

## 5. Role-Based Access Control (RBAC) Redirection Gates

The application enforces strict client-side and server-side navigation guards via `RoleProtected.js`:

```javascript
// Access Gate Hierarchy
SUPER_ADMIN      --> Universal Access to all 18 Modules, Consoles S1..S10, and RBAC Studio
HR_MANAGER       --> Modules 1..10, Consoles S2, S3, S4, S6, S7, S8, S9 (Blocked from RBAC Studio)
FINANCE_MANAGER  --> Payroll, Comp, Compliance, Attendance, Consoles S5, S7, S8
PROJECT_MANAGER  --> Projects, Attendance, Team, Performance, Consoles S7, S8
TEAM_LEAD        --> Attendance, Projects, Team, Approvals, Consoles S7, S8
EMPLOYEE         --> Employee Home (S8), Leaves, Attendance Log, Payslip Preview, My OKRs, My Pod
```

* **Unauthorized Redirection:** If an `EMPLOYEE` attempts to navigate to `access_control`, `payroll`, or `compliance`, `RoleProtected.js` intercepts the route, displays an access denied banner with the required role scope, and provides a 1-click button to redirect back to `EmployeeHome` (`S8`).
* **Console Filtering:** Permitted consoles are dynamically filtered in `TopNav.js` via `ROLE_PERMITTED_CONSOLES[currentRole]`. Non-permitted consoles are hidden from the dropdown selector.

---

## 6. Implementation Sign-off & Verification

1. **Zero Infinite Loops:** Verified that all navigation state changes (`onTabChange`, `onNavigate`, `onSelectConsole`) update state outside of render cycles.
2. **Keyboard Accessibility:** Global shortcuts (`⌘K` for Search, `⌘M` for Modules, `ESC` to close modals) are registered with unmount listeners to prevent memory leaks.
3. **Deep Link Consistency:** All sub-features across `LeftDock`, `TopNav`, `DualPaneNav`, `RightSubNav`, and `CatalogGridView` resolve to canonical `activeTab` slugs.
