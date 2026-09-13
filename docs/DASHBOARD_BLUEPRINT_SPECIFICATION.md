# Nucleus HRMS — Master Dashboard & Component Architecture Specification

**Document Type:** Complete Analytics, Cockpit & Widget Blueprint  
**Application:** Nucleus HRMS (Enterprise Workforce & Operations Platform)  
**Version:** 2.0.0-PROD  
**Target Audience:** Backend Developers, Data Engineers, UI/UX Engineers, Product Managers  
**Visualization Engine:** Apache ECharts (`NucleusChart.js`), Custom SVG Gauges, CSS Glassmorphic Cards  

---

## Executive Summary & Cockpit Index

Nucleus HRMS provides **10 role-tailored Cockpits (S1 through S10)** alongside an **Adaptive Hero Launchpad** and **Grounded Operational Action Widgets**. Every cockpit is engineered around three guiding principles:
1. **Persona-Specific Density:** High-level strategic health indices for CXOs vs. zero-friction self-service for frontline employees.
2. **Deterministic & Grounded Data:** Visualizations represent real-world workforce states (statutory compliance, 8-stage payroll pipelines, sandwich rule leave ledgers, time-office muster rolls).
3. **Action-Oriented Workflows:** Every anomaly or metric connects directly to a 1-click mitigation modal or downstream module navigation.

| Cockpit Code | Cockpit / Dashboard Name | Primary Component Path | Target Persona | Primary Business Value |
|---|---|---|---|---|
| **Launchpad** | Adaptive Hero & Quick Launch | `MainWorkspace.js:125-345` | All Roles (Adaptive) | Contextual greetings, 1-click punch/leaves, live clock & weather |
| **S1** | People Command Centre | `Dashboard/Views/PeopleCommandCentre.js` | Super Admin, CXO, CHRO | Macro org health, talent flow, headcount forecasting, attrition risks |
| **S2** | HR Operations Console | `Dashboard/Views/HROpsConsole.js` | HR Manager, HR Ops | Daily attendance muster, SLA breach approvals, onboarding funnels |
| **S3** | Attendance Intelligence | `Dashboard/Views/AttendanceIntelligence.js` | HR, Time Office, Facility Leads | Punctuality radars, overtime burn, shift coverage gap auto-filling |
| **S4** | Talent Acquisition Command | `Dashboard/Views/TalentAcquisition.js` | Recruiters, TA Leads, HR | ATS funnel drop-off, offer-to-joining waterfalls, candidate CSAT |
| **S5** | Payroll Control Room | `Dashboard/Views/PayrollControlRoom.js` | Finance Manager, Payroll Ops | 8-stage run stepper, Aug-to-Sep cost variance waterfall, tax compliance |
| **S6** | Performance & Talent Calibration | `Dashboard/Views/PerformanceTalent.js` | HR, Department Heads, Leads | Bell curve calibration, competency radars, interactive 9-box grid |
| **S7** | Manager Cockpit | `Dashboard/Views/ManagerCockpit.js` | Team Leads, Engineering Managers | Team sprint capacity, skill gap radar, 1-click leave/expense triage |
| **S8** | Employee Home (Self-Service) | `Dashboard/Views/EmployeeHome.js` | All Employees, Contractors | Shift ring, leave rings, weekly timesheet logging, reporting pod line |
| **S9** | Magnetix Capability & L&D | `Dashboard/Views/MagnetixCapability.js` | L&D Leads, HR, People Dev | Pre/post training radar movement, programme funnels, skill index |
| **S10** | Nucleus Intelligence & AI | `Dashboard/Views/NucleusIntelligence.js` | Super Admin, System Architects | NL query synthesis, model registers, autonomous agent governance |
| **Widgets** | Grounded Daily Cards | `MainWorkspace.js:360-520` | All Roles | Today's Focus checklist, Company Broadcasts, Active Pod Sprints |

---

## 1. Global Shell & Adaptive Hero Launchpad

### 1.1 Header Launchpad (`MainWorkspace.js:125-345`)
* **Who it is for:** Every authenticated user. Renders dynamic copy, accents, and quick actions based on `authUser.role`.
* **Visual Representation:** Glassmorphic card (`#0E1726` to `#0A101C`) with user avatar, pulsing presence beacon, live time display, location weather (`Bengaluru, India • ☁️ 24°C Pleasant`), and primary action buttons.

| Persona Mode | Distinct UI Elements | Primary Action Buttons | Rationale / Why |
|---|---|---|---|
| **Super Admin / CXO** | Green neon badge `👑 SUPER ADMIN` or `🏛️ CXO & LEADERSHIP`, status: *Workforce health steady. 4 decisions need attention.* | `All locations` filter, `6 months` dropdown, `Org Directory`, `Broadcasts (CMS)`, `Configure Access (RBAC)` | Provides immediate access to org-wide governance, global directories, and security without digging into sub-menus. |
| **Employee (S8)** | Sky blue badge `👤 EMPLOYEE`, status: *Friday, 11 Sep • Clocked in at 9:18 AM • Target 8h 30m shift* | Dynamic Punch Button (`Punch In Now` / `Punch Out (In: 9:18 AM)`), `Apply Leave`, `Claim Expense`, `Team Directory`, `Broadcasts` | Zero-friction daily employee interactions: punch clock, balance checks, and reimbursement requests in < 2 seconds. |
| **Manager / Team Lead (S7)** | Emerald badge `🎯 TEAM LEAD`, status: *Team sprint velocity steady. 3 pending approvals, 1 shift coverage gap.* | `3 Approvals Pending`, `Team Roster`, `Broadcasts` | Immediate operational triage for team bottlenecks without manual queue searching. |
| **HR / Finance** | Purple badge with role title, status: *Workspace, 1-click actions, and data intelligence in sync.* | `Team Directory`, `Broadcasts` | High-frequency administrative shortcuts. |

---

## 2. Cockpit S1: People Command Centre (Executive CXO Suite)

**Primary File:** `src/components/Dashboard/Views/PeopleCommandCentre.js`  
**Target Audience:** Chief Executive Officer (CEO), Chief People Officer (CPO), Chief Human Resources Officer (CHRO), Super Admin.  
**Core Purpose:** Deliver a single-pane-of-glass macro analysis of organizational health, talent attrition, compensation parity, and workforce projections.

```
+----------------------------------------------------------------------------------------------------+
| S1: People Command Centre                                                 [Period: FY27 Q2 v]      |
+----------------------------------------------------------------------------------------------------+
|  [Headcount: 1,284]     [Attrition: 11.2%]     [Compa-Ratio: 96.4%]     [Org Health: 78/100]       |
+------------------------------------+---------------------------------------------------------------+
|  Org Health Index (6-Axis Radar)   |  Headcount Actual & Forecast (with 80% Violet Prediction Band)|
|  - Retention: 82                   |  - Apr-Aug Actual vs Plan                                     |
|  - Capability: 74                  |  - Sep-Dec Modelled Forecast Band                             |
+------------------------------------+---------------------------------------------------------------+
|  Talent Flow Sankey Diagram        |  Attrition by Function (Horizontal Bar)                       |
|  External Hires (186) -> Active    |  Support (19.4%) > Sales (14.2%) > Engineering (9.2%)         |
+------------------------------------+---------------------------------------------------------------+
|  Pay vs Performance Bubble Scatter |  Attrition Heatmap (6 Functions x 6 Geographic Campuses)      |
|  (Compa-Ratio x Rating x Headcount)|  Color ramp alert for high-attrition clusters                 |
+----------------------------------------------------------------------------------------------------+
```

### Component Breakdown:

#### 1. Strategic Metric KPI Strip
* **Representation:** 4 high-contrast KPI cards with positive/negative trend deltas.
* **Metrics:**
  * **Headcount Active:** `1,284` (+3.8% MoM, External: +186, Resignations: -118)
  * **Annualized Attrition:** `11.2%` (-1.4% vs FY25 target)
  * **Average Compa-Ratio:** `96.4%` (Benchmark range: 95% – 105%)
  * **Org Health Index:** `78 / 100` (+4 points QoQ)
* **Why it exists:** Provides C-suite leadership instant pulse verification before board or stakeholder meetings.

#### 2. Org Health Index Radar
* **Chart Type:** ECharts `radar` (`orgHealthRadarOption`)
* **Axes (6 Indicators):** Retention, Capability, Engagement, Mobility, Manager Quality, Diversity.
* **Series:** Current Quarter `Q2` (Teal `#2DD4A8`, area filled) vs. Previous Quarter `Q1` (Sky `#4FB6F5`, dashed line).
* **Why it exists:** Multi-dimensional view of company wellness beyond just financial metrics; identifies whether rapid hiring is degrading manager quality or culture.
* **Backend Source:** Aggregated score from exit surveys, pulse survey eNPS, internal transfer rates, and DEI demographic tables.

#### 3. Headcount Actual & Forecast with 80% Prediction Band
* **Chart Type:** ECharts dual-line with area envelope `line` (`headcountForecastOption`)
* **X-Axis:** Months (April through December)
* **Y-Axis:** Headcount (Range: 1,050 to 1,550)
* **Series:**
  1. `Actual`: Apr–Aug solid teal line (`1,109` to `1,284`).
  2. `Plan`: Apr–Dec dotted sky line (`1,100` to `1,530`).
  3. `Modelled (80% band)`: Sep–Dec dashed violet line (`1,318` to `1,430`) with soft purple confidence area fill (`rgba(155, 140, 255, 0.15)`).
* **Why it exists:** Prevents over-hiring or severe staffing shortfalls by combining confirmed offers with statistical attrition modeling.

#### 4. Talent Flow Sankey Diagram
* **Chart Type:** ECharts `sankey` (`talentFlowOption`)
* **Nodes:** External Hires (186), Internal Moves (74), Returning Alumni (12), Active Workforce (1,284), Resignations (118), End of Contract (26), Retirement (8).
* **Why it exists:** Visualizes the dynamic churn and migration of human capital in a single fluid graphic; pinpoints whether attrition is compensated by internal mobility vs expensive external sourcing.

#### 5. Attrition by Function (Sorted Horizontal Bar)
* **Chart Type:** ECharts horizontal `bar` (`attritionByFunctionOption`)
* **Categories:** HR (4.1%), Finance (6.4%), Engineering (9.2%), Operations (10.1%), Sales (14.2%), Support (19.4%).
* **Color Encoding:** Green/Teal for stable functions (<8%), Amber for moderate (8–12%), Coral/Red for high (>12%).
* **Why it exists:** Directly flags organizational stress centers requiring retention bonuses or workload balancing.

#### 6. Pay Position vs. Performance Bubble Scatter
* **Chart Type:** ECharts 3-variable `scatter` bubble (`payVsPerformanceOption`)
* **X-Axis:** Compa-Ratio (80% to 120%)
* **Y-Axis:** Performance Rating (2.5 to 5.0)
* **Bubble Size:** Headcount in department ($\text{symbolSize} \propto \sqrt{\text{Headcount}}$)
* **Series Data:** Engineering, Sales, Support, Finance, Operations.
* **Why it exists:** Audit tool for compensation equity. Highlights anomalies (e.g. low-performing pods with high compa-ratios, or high-performing pods at risk of flight due to below-market compensation).

#### 7. Attrition Matrix Heatmap: Function x Location
* **Chart Type:** ECharts matrix `heatmap` (`attritionHeatmapOption`)
* **X-Axis:** 6 Locations (Bengaluru, Pune, Hyderabad, Chennai, NCR, Remote)
* **Y-Axis:** 6 Functions (Engineering, Sales, Operations, Support, Finance, HR)
* **Value:** Percentage attrition per cell with continuous 5-step color ramp (`#122B36` to `#F2647E`).
* **Why it exists:** Isolates geographic leadership problems (e.g., Support in Hyderabad experiencing 22% attrition vs Bengaluru at 19%).

---

## 3. Cockpit S2: HR Operations Console

**Primary File:** `src/components/Dashboard/Views/HROpsConsole.js`  
**Target Audience:** HR Managers, People Operations Specialists, Employee Relations Leads.  
**Core Purpose:** Run daily operational execution: resolve SLA-breached approvals, monitor onboarding readiness, track unplanned absenteeism, and manage helpdesk request types.

```
+----------------------------------------------------------------------------------------------------+
| S2: HR Operations Console                       [Bengaluru + 5 sites]  [+ New Joiner Wizard]       |
+----------------------------------------------------------------------------------------------------+
| [Present: 1,048 (81.6%)]  [On Leave: 120]  [Absent: 80]  [Joining: 24]  [Exits: 17]  [Data: 94%]   |
+------------------------------------+---------------------------------------------------------------+
| Pending Approvals Queue (Actionable)| Onboarding Pipeline Funnel                                   |
| - Ravi Kulkarni (LOP Reversal) [!] | Offered (36) -> Accepted 31 -> Docs 28 -> Assets 22 -> Day-1 |
| - Sneha Nair (Relocation Claim)    +---------------------------------------------------------------+
| - Arjun Bhat (Comp-off carry)      | Requests by Category (Horizontal Bar)                         |
| [Approve] [Reject] [Re-route]      | Leaves (412) > Attendance (286) > Payslip (198)               |
+------------------------------------+---------------------------------------------------------------+
| Absence Density Calendar Heatmap (12 Weeks x 7 Days)                                               |
| Visualizes Monday/Friday absenteeism clustering across the organization                             |
+----------------------------------------------------------------------------------------------------+
```

### Component Breakdown:

#### 1. Operations KPI Strip (6 Key Operational Signals)
* **Tiles:**
  1. `Present Today`: 1,048 (81.6% Active Workforce)
  2. `On Leave`: 120 (32 Unplanned, 9.3% Rate)
  3. `Absent, No Record`: 80 (Needs immediate supervisor follow-up, 6.2% Rate)
  4. `Joining This Week`: 24 (18 Day-1 ready, 6 missing hardware assets)
  5. `Exits in Notice`: 17 (4 open clearances)
  6. `Data Completeness`: 94% (71 statutory records incomplete for PF/PAN)
* **Why it exists:** Provides frontline HR ops their daily morning checklist within 10 seconds of login.

#### 2. Interactive Pending Approvals Action Queue
* **Representation:** Interactive table with priority chips and action triggers.
* **Columns:** Candidate/Employee Name, Request Type (LOP reversal, Relocation claim, Comp-off carry, Maternity extension, Shift change), Age in queue, SLA Breach Warning Badge.
* **Interactions:** Clicking an item opens the `ApprovalActionModal.js` with full remarks input, re-routing target selector, and automated toast confirmation.
* **Why it exists:** Enforces zero SLA breaches for critical employee lifecycle requests.

#### 3. Onboarding Pipeline Funnel
* **Chart Type:** ECharts `funnel` (`onboardingFunnelOption`)
* **Stages:**
  1. `Offered`: 36 candidates
  2. `Offer Accepted`: 31 (86% conversion)
  3. `Docs Verified`: 28 (90% conversion)
  4. `Assets Ready`: 22 (79% conversion)
  5. `Day-1 Ready`: 19 candidates fully provisioned
* **Why it exists:** Immediately alerts IT and Facilities when candidates are accepted but lack laptops or ID badges before their start date.

#### 4. Absence Density Calendar Heatmap (12 Weeks x 7 Days)
* **Chart Type:** ECharts temporal `heatmap` (`calendarHeatmapOption`)
* **X-Axis:** 12 Rolling Weeks (`Wk 1` to `Wk 12`)
* **Y-Axis:** Days of the Week (`Mon` to `Sun`)
* **Data Pattern:** Demonstrates distinct Friday/Monday spikes (extended weekends) vs. midweek stability.
* **Why it exists:** Proves habitual absenteeism trends and helps calibrate sandwich-rule enforcement.

#### 5. Requests by Category Bar
* **Chart Type:** ECharts horizontal `bar` (`requestsByTypeOption`)
* **Categories:** Leave & Comp-off (412), Attendance Fix (286), Payslip & Tax (198), Letters & Proofs (144), Asset & Access (96), Policy Qs (74).
* **Why it exists:** Determines helpdesk staffing and drives automated self-service deflection for the most repetitive ticket categories.

---

## 4. Cockpit S3: Attendance Intelligence & Time Office

**Primary File:** `src/components/Dashboard/Views/AttendanceIntelligence.js`  
**Target Audience:** Time Office Administrators, Plant HR, Shift Schedulers, Operations Managers.  
**Core Purpose:** Continuous monitoring of on-time punctuality, overtime distribution, biometric reconciliation, and real-time shift gap mitigation.

### Component Breakdown:

#### 1. Dual-Axis Attendance vs. Absenteeism Trend
* **Chart Type:** ECharts multi-axis smoothed `line` (`attendanceTrendOption`)
* **Left Y-Axis:** Attendance Percentage (0% – 100%, Green gradient area)
* **Right Y-Axis:** Absenteeism Percentage (0% – 20%, Red dashed line)
* **X-Axis:** 6 Rolling Months (Apr to Sep)
* **Trend Shown:** Attendance climbing from 84.2% to 89.2% as absenteeism drops from 11.2% to 6.8%.
* **Why it exists:** Validates whether new flexible shift policies are improving daily presence.

#### 2. Site Punctuality Profile Radar
* **Chart Type:** ECharts `radar` (`punctualityRadarOption`)
* **Dimensions:** Bengaluru (94%), Pune (91%), Hyderabad (88%), Chennai (82%), NCR (89%), Remote (96%).
* **Why it exists:** Compares on-time clock-in rates across regional hubs; flags transport or transit bottlenecks affecting specific locations (e.g. Chennai at 82%).

#### 3. Department Overtime Hours (Horizontal Bar)
* **Chart Type:** ECharts horizontal `bar` (`overtimeBarOption`)
* **Categories:** Support (64h), Operations (48h), Engineering (36h), Field (28h), Finance (12h).
* **Why it exists:** Monitors adherence to statutory Factories Act overtime limits (quarterly caps) and prevents employee burnout.

#### 4. Shift Coverage Matrix with 1-Click Auto-Fill
* **Representation:** Live time-band tabular schedule (`06:00` to `22:00` in 2-hour increments).
* **Columns:** Time Slot, Required Headcount, Rostered Headcount, Coverage Gap Chip (`-6`, `-5`, `-3`).
* **Interactivity:** Clicking **"Auto-Fill Rosters"** invokes the heuristic scheduling algorithm, assigns standby staff, zeroes out gaps, and triggers a success toast.
* **Why it exists:** Eliminates factory/support line understaffing with autonomous schedule generation.

---

## 5. Cockpit S4: Talent Acquisition Command (ATS)

**Primary File:** `src/components/Dashboard/Views/TalentAcquisition.js`  
**Target Audience:** Talent Acquisition Heads, Lead Recruiters, Hiring Managers.  
**Core Purpose:** End-to-end recruitment funnel conversion analytics, offer rejection root-cause analysis, and candidate experience NPS tracking.

### Component Breakdown:

#### 1. Full Hiring Funnel Stage Conversion
* **Chart Type:** ECharts inverted `funnel` (`funnelOption`)
* **Stages:** Applied (1,240) $\rightarrow$ Screened (412, 33%) $\rightarrow$ Interviewed (168, 41%) $\rightarrow$ Offered (44, 26%) $\rightarrow$ Joined (31, 70%).
* **Why it exists:** Highlights pipeline bottlenecks (e.g., screening rejection vs. interview pass rates) to recalibrate recruiter sourcing criteria.

#### 2. Offer-to-Joining Drop-off Waterfall
* **Chart Type:** ECharts floating `waterfall` bar (`offerWaterfallOption`)
* **Steps:**
  1. Base: Offers Made (44)
  2. Drop: Compensation Declined (-6)
  3. Drop: Counter-Offer by Current Employer (-4)
  4. Drop: Candidate Ghosted / No Response (-3)
  5. End Result: Confirmed Joined (31)
* **Why it exists:** Informs C&B teams exactly why talent is walking away, driving timely revisions to salary benchmarks and sign-on incentives.

#### 3. Candidate Experience CSAT Radar (n=214)
* **Chart Type:** ECharts 6-axis `radar` (`candidateExpRadarOption`)
* **Dimensions:** Clarity (88%), Speed (76%), Panel Quality (92%), Respect (95%), Feedback (71%), Offer Process (84%).
* **Why it exists:** Protects employer branding on Glassdoor and LinkedIn by auditing interview panel behavior and feedback turnaround speed.

---

## 6. Cockpit S5: Payroll Control Room & Finance Operations

**Primary File:** `src/components/Dashboard/Views/PayrollControlRoom.js`  
**Target Audience:** Chief Financial Officer (CFO), Head of Payroll, Finance Controllers.  
**Core Purpose:** Zero-error execution of multi-crore payroll cycles, variance bridge auditing, cost distribution, and bank disbursement validation.

```
+----------------------------------------------------------------------------------------------------+
| S5: Payroll Control Room                               [Batch: September 2026] [Release Bank File] |
+----------------------------------------------------------------------------------------------------+
| 8-Stage Execution Stepper:                                                                        |
| [✓ Inputs] -> [✓ Attendance] -> [✓ Variables] -> [* Exceptions] -> [Approve] -> [Bank] -> [Slips] |
+------------------------------------+---------------------------------------------------------------+
| Aug to Sep Cost Variance Waterfall | Cost Composition Donut                                        |
| Aug Gross (290L) + Hires (14L)     | Fixed Pay (74.1%) | Variable (11.9%) | PF/ESI (8.4%)           |
| - Exits (11L) + Increments (9L)    | Allowances (3.8%) | Overtime (1.7%)                           |
| = Sep Gross (296L)                 | Center Label: ₹2.86 Cr Sep Gross                              |
+------------------------------------+---------------------------------------------------------------+
| Cost Per Employee by Function      | Blocking Payroll Exceptions Table                             |
| Eng (₹32L) > Sales (₹22L)          | 2 duplicate bank accounts, 4 unverified PANs [Clear All]       |
+----------------------------------------------------------------------------------------------------+
```

### Component Breakdown:

#### 1. 8-Stage Payroll Execution Timeline Stepper
* **Representation:** Interactive linear stepper with status rings and execution dates.
* **Steps:**
  1. `Inputs frozen` (05 Sep, completed)
  2. `Attendance locked` (08 Sep, completed)
  3. `Variables loaded` (09 Sep, completed)
  4. `Exceptions review` (Active today, requires clearance)
  5. `Approval` (26 Sep, upcoming)
  6. `Bank file generation` (28 Sep, upcoming)
  7. `Payslips released` (30 Sep, upcoming)
  8. `Statutory filed` (15 Oct, upcoming)
* **Why it exists:** Establishes rigorous segregation of duties (SoD) and prevents payroll execution before input freezes and attendance locks are certified.

#### 2. Aug-to-Sep Cost Variance Waterfall Bridge
* **Chart Type:** ECharts floating `waterfall` bar (`waterfallOption`)
* **Metrics (in ₹ Lakhs):**
  * `Aug Gross Base`: ₹290.0 L
  * `New Hires`: +₹14.0 L (Increase)
  * `Exits`: -₹11.0 L (Deduction)
  * `Mid-cycle Increments`: +₹9.0 L (Increase)
  * `Overtime Burn`: +₹4.0 L (Increase)
  * `LOP Deductions`: -₹3.0 L (Deduction)
  * `Bonus Reversals`: -₹7.0 L (Deduction)
  * `Sep Gross Total`: ₹296.0 L
* **Why it exists:** Directly answers the CFO's first question: *"Why did the wage bill increase by ₹6 Lakhs this month?"*

#### 3. Cost Composition Donut Chart
* **Chart Type:** ECharts donut `pie` (`costDonutOption`)
* **Center Metric:** `₹2.86 Cr Sep Gross`
* **Slices:**
  * Fixed Basic & HRA: `74.1%` (₹2.12 Cr)
  * Variable & Performance Incentives: `11.9%` (₹0.34 Cr)
  * Employer Statutory PF/ESI: `8.4%` (₹0.24 Cr)
  * Allowances & Reimbursements: `3.8%` (₹0.11 Cr)
  * Overtime Pay: `1.7%` (₹0.05 Cr)
* **Why it exists:** Visualizes fixed vs. variable liability ratios for financial runway planning.

#### 4. Cost Per Employee by Function
* **Chart Type:** ECharts vertical `bar` (`costByFunctionOption`)
* **Values:** Engineering (₹32L), Sales (₹22L), Finance (₹18L), HR (₹15L), Operations (₹14L), Support (₹12L).
* **Why it exists:** Normalizes payroll costs against departmental headcount to identify high-cost talent hubs.

---

## 7. Cockpit S6: Performance & Talent Calibration

**Primary File:** `src/components/Dashboard/Views/PerformanceTalent.js`  
**Target Audience:** HR Business Partners (HRBPs), Department Heads, Calibration Committees.  
**Core Purpose:** Mitigate manager grading bias, enforce equitable rating distributions, and calibrate high-potential talent across the 9-box matrix.

### Component Breakdown:

#### 1. Rating Distribution vs. Guided Bell Curve
* **Chart Type:** ECharts bar with dashed curve overlay (`ratingDistributionOption`)
* **Categories:** Below, Meets-, Meets, Exceeds, Outstanding.
* **Series:**
  1. `Actual Distribution` (Teal bars): `[14, 42, 118, 56, 18]`
  2. `Guided Curve (Reference)` (Dashed sky line): `[12, 37, 124, 62, 13]`
* **Why it exists:** Immediately reveals rating inflation or compression (e.g. too many managers rating "Outstanding" without evidence).

#### 2. Competency Profile Radar (Function Avg vs. Role Bar)
* **Chart Type:** ECharts 6-axis `radar` (`competencyRadarOption`)
* **Axes:** Delivery, Quality, Collaboration, Ownership, Craft, Coaching.
* **Series:** Function Average (Teal polygon) vs. Role Benchmark Bar (Dashed 80% baseline).
* **Why it exists:** Detects systematic skill deficits across entire engineering or sales cohorts.

#### 3. Interactive 9-Box Matrix Grid
* **Representation:** 3x3 CSS grid of performance (X-axis: Low, Med, High) vs. potential (Y-axis: Low, Med, High).
* **Quadrants:**
  * Top Row: Enigma (9), Growth (21), **Star (14)**
  * Mid Row: Dilemma (18), Core (64), High Impact (32)
  * Bottom Row: **Risk (11)**, Effective (42), Trusted Pro (37)
* **Interactions:** Clicking any quadrant highlights members, displays compensation compa-ratio overlays, and triggers PIP or leadership development tracks.
* **Why it exists:** Foundation for succession planning, stock grant allocation, and retention interventions.

---

## 8. Cockpit S7: Manager Team Cockpit & Triage

**Primary File:** `src/components/Dashboard/Views/ManagerCockpit.js`  
**Target Audience:** Engineering Managers, Pod Leads, Team Supervisors.  
**Core Purpose:** Real-time team velocity management, leave and expense approvals triage, upcoming capacity tracking, and 1:1 agenda builder.

### Component Breakdown:

#### 1. Team Capacity Next 4 Weeks (Stacked Bar)
* **Chart Type:** ECharts stacked `bar` (`capacityOption`)
* **X-Axis:** Rolling 4 Weeks (`Wk 37` to `Wk 40`)
* **Y-Axis:** Total Pod Days (Max 80 person-days)
* **Stacks:**
  1. `Delivering` (Teal `#2DD4A8`): Active project sprint bandwidth (64d, 58d, 62d, 60d).
  2. `On Leave` (Amber `#F2A93B`): Approved vacation/sick days (6d, 12d, 4d, 8d).
  3. `In Training` (Sky `#4FB6F5`): Mandatory upskilling/certifications (4d, 4d, 8d, 6d).
* **Why it exists:** Prevents sprint commitment failures by showing true effective capacity before sprint planning meetings.

#### 2. Team Skill Coverage Radar
* **Chart Type:** ECharts 6-axis `radar` (`skillRadarOption`)
* **Axes:** Backend (88%), Data (54%), Cloud (78%), Frontend (92%), Security (42%), Testing (70%).
* **Why it exists:** Identifies pod single points of failure (e.g., Security at 42% and Data at 54% indicates high vulnerability if the single data engineer is out on leave).

#### 3. Quick Triage Approvals Queue with Re-Routing
* **Representation:** Fast-action list with employee avatars, request types, and ages.
* **Items:**
  * Ravi K. (3 days planned leave, 6d old — SLA BREACH)
  * Sneha N. (₹18,400 client travel expense, 3d old)
  * Arjun B. (Comp-off application, 2d old)
  * Priya T. (WFH for 2 weeks, 1d old)
* **Actions:** 1-click Approve, Reject with note, or Re-route to secondary lead with undo toast timer.
* **Why it exists:** Empowers managers to clear approval debt in under 60 seconds directly from their morning dashboard.

---

## 9. Cockpit S8: Employee Home & Self-Service Hub

**Primary File:** `src/components/Dashboard/Views/EmployeeHome.js`  
**Target Audience:** All standard employees, contractors, and individual contributors.  
**Core Purpose:** Central daily workspace: punch in/out, monitor shift progress, track leave balances, log project timesheet hours, ask policy questions, and inspect the reporting hierarchy.

```
+----------------------------------------------------------------------------------------------------+
| S8: Employee Home                                             [Friday, 11 Sep] [Clocked: 9:18 AM]  |
+----------------------------------------------------------------------------------------------------+
|  [Apply / View Leaves]   [Assigned Tasks]   [Reporting Line & Pod]   [Payslip & Tax]   [OKRs]      |
+------------------------------------+------------------------------------+--------------------------+
|  Today's Shift Status Gauge        |  Concentric Rings Leave Balance    |  September Estimated Pay |
|  - Worked: 6h 12m (73% of target)  |  - Earned: 12d remaining (Teal)    |  Gross: ₹1,08,400        |
|  - In: 9:18 AM | Break: 42m        |  - Casual: 4d remaining (Sky)      |  Deductions: -₹18,260    |
|  - Target: 8h 30m                  |  - Sick: 6d remaining (Amber)      |  Net: ₹90,140            |
+------------------------------------+------------------------------------+--------------------------+
|  Ask Nucleus Policy Assistant (Grounded AI Search Bar)                                             |
|  "How many casual leaves can I carry into next year?" -> Direct citation from Leave Policy v4.2    |
+----------------------------------------------------------------------------------------------------+
|  Weekly Timesheet & Project Logging (Week 37: 07-11 Sep • Target 40h • Approver: Amit Verma)       |
|  - Mon: 8.5h | Tue: 8.2h | Wed: 8.8h | Thu: 8.5h | Fri: 6.2h  [Log Time Modal] [Submit Timesheet]  |
|  - Project Split: Project Alpha (63% Billable) | DevOps Pod (22%) | Platform Arch (15%)            |
+------------------------------------+------------------------------------+--------------------------+
|  My Goals (FY26 OKRs)              |  My Attendance Heatmap (8 Weeks)   |  Learning on Magnetix    |
|  - Ship migration API (74%)        |  Matrix heatmap of daily hours     |  - POSH Refresher [!]    |
|  - Cut p95 latency (46%)           |  worked Mon-Fri                    |  - System Design (62%)   |
+------------------------------------+------------------------------------+--------------------------+
|  My Reporting Line & Engineering Pod Architecture                                                  |
|  - Reporting Manager: Amit Verma (Director L6) • Approves Leaves, Timesheets, Expenses             |
|  - Pod Alpha Teammates: Trisha Khanna, Rahul Saxena, David Miller, Sarah Chen (Live Status)       |
+----------------------------------------------------------------------------------------------------+
```

### Detailed Component Breakdown:

#### 1. Self-Service Quick Navigation Hub
* **Representation:** Horizontal pill bar with colored glass borders and iconography.
* **Shortcuts:** `Apply / View Leaves`, `Assigned Tasks & Sprints`, `Reporting Line & Team Pod`, `Payslip & Tax 24Q`, `Monthly Attendance Log`, `My OKRs & Goals`, `Policy Helpdesk`.
* **Why it exists:** Keeps employees focused on their primary workflows without having to navigate deep sidebar hierarchies.

#### 2. Today's Shift Status Radial Circle Progress Meter
* **Representation:** Custom CSS radial ring gauge (Teal `#2DD4A8` border with dark slate `#1C3450` track).
* **Metrics:**
  * Active Worked Time: `6h 12m` (73% of shift target)
  * Punch-In Timestamp: `9:18 AM`
  * Break Duration: `42m`
  * Target Shift Duration: `8h 30m`
  * Weekly Accumulated: `34h 20m` of `42h 30m`
* **Why it exists:** Real-time visibility prevents unintentional shift shortages or excessive unapproved overtime.

#### 3. Concentric Rings Leave Balance Pie Chart
* **Chart Type:** ECharts multi-ring nested `pie` (`leaveRingsOption`)
* **Center Label:** `22 Days Left` (Total available balance)
* **Concentric Rings:**
  1. Outer Ring (Radius: 68%–82%): `Earned Leave` (12 days remaining, Teal `#2DD4A8`)
  2. Middle Ring (Radius: 50%–64%): `Casual Leave` (4 days remaining, Sky `#4FB6F5`)
  3. Inner Ring (Radius: 32%–46%): `Sick Leave` (6 days remaining, Amber `#F2A93B`)
* **Quick Action:** `Apply Leave →` button jumps directly into `LeaveView.js`.
* **Why it exists:** Compact, visually distinct representation of complex multi-category leave ledgers.

#### 4. September Payslip Estimated Summary Card
* **Representation:** Financial breakdown card with real-time deduction calculation.
* **Values:**
  * Gross Salary: `₹1,08,400`
  * Deductions (PF, PT, TDS): `-₹18,260` (Coral text)
  * Estimated Net Pay: `₹90,140` (Bold Teal highlight)
  * Tax Advisory Note: *Investment proofs due 15 Jan. Declared ₹1.2L of ₹1.5L 80C cap.*
* **Quick Action:** `View Payslip →` button navigates to `PayrollView.js`.
* **Why it exists:** Eliminates routine HR queries regarding upcoming month-end salary credits and tax deductions.

#### 5. Ask Nucleus Policy Assistant (Grounded RAG Search)
* **Representation:** AI search input bar with verified citation preview.
* **Sample Interaction:**
  * Query: *"How many casual leaves can I carry into next year?"*
  * Grounded Answer: *◆ Casual leave does not carry forward — your balance of 4.0 days lapses on 31 December. Earned leave carries up to 45 days. Recommended: Apply for 3 days between 26 and 31 December to utilize casual leave before expiry.*
  * Source Citation: *Leave policy v4.2, clauses 6.1 and 6.4 (Signed 12 Mar 2026).*
  * Direct Triggers: `Apply for those dates →` (opens pre-filled leave form) and `Open Policy in Helpdesk →`.
* **Why it exists:** Deflects up to 65% of repetitive policy inquiries from the HR operations queue.

#### 6. Weekly Timesheet & Project Logging Suite
* **Representation:** 
  * 5-Day Visual Status Strip (`Mon 8.5h`, `Tue 8.2h`, `Wed 8.8h`, `Thu 8.5h`, `Fri 6.2h`).
  * Detailed Task Log Table: Date, Project, Task description, Billability Badge (`Billable` vs `Internal`), Logged Hours, Approval Status.
  * Summary Bar: Total Logged Hours (`40.2h / 40.0h`), Billable Client Hours (`34.0h (85%)`).
  * Modal Launcher: `+ Log Project Time` opens project selector, task note, hours counter, and billable checkbox.
  * Submission Workflow: `Submit for Approval` button locks timesheet and dispatches it to manager Amit Verma.
* **Why it exists:** Provides enterprise-grade client billing tracking and attendance ledger alignment directly on the employee's homepage.

#### 7. Project & Client Allocation Breakdown
* **Representation:** Stacked progress bars with client names and percentages.
* **Pods:** Project Alpha (63%, Client: Asteria FinTech), DevOps Cloud Pod (22%), Platform Architecture (15%).
* **SLA Box:** Submissions close Friday 7:00 PM IST; supervisor sign-off completed before Monday 12:00 PM for payroll ingestion.
* **Why it exists:** Ensures engineering work corresponds directly to SOW deliverables and billable milestones.

#### 8. Personal Attendance 8-Week Matrix Heatmap
* **Chart Type:** ECharts matrix `heatmap` (`personalAttendanceOption`)
* **X-Axis:** Weeks 1 through 8
* **Y-Axis:** Monday through Friday
* **Value:** Hours logged per day (7.5h to 9.5h) with green saturation ramp.
* **Why it exists:** Self-monitoring tool for employees to track daily consistency and spot unregularized biometric anomalies.

#### 9. My Reporting Line & Engineering Pod Architecture
* **Representation:** Dual-card organizational hierarchy view.
* **Reporting Manager Card:**
  * Avatar: Amit Verma (Director of Engineering, L6)
  * Permissions Badge: *Approves Leave Requests, Weekly Timesheets & Expense Claims*
  * Campus: Bengaluru (Hybrid)
* **Pod Alpha Teammates Card:**
  * Live Presence List: Trisha Khanna (Lead Architect), Rahul Saxena (Senior UX), David Miller (DevOps), Sarah Chen (Lead PM).
* **Why it exists:** Ensures complete organizational clarity on who approves what and who is currently collaborating in the pod.

---

## 10. Cockpit S9: Magnetix Capability & L&D Intelligence

**Primary File:** `src/components/Dashboard/Views/MagnetixCapability.js`  
**Target Audience:** Chief Learning Officer (CLO), L&D Specialists, Functional Capability Leads.  
**Core Purpose:** Measure training efficacy, track skill gap closure, and monitor learning hours distribution.

### Component Breakdown:

#### 1. Capability Movement Radar (Pre vs. Post Programme)
* **Chart Type:** ECharts 6-axis `radar` (`capabilityMovementOption`)
* **Axes:** Coaching, Feedback, Planning, Delegation, Conflict Resolution, Technical Hiring.
* **Series:** Baseline Pre-training (Dashed Sky line) vs. Post-Programme (Solid Teal area `#2DD4A8`).
* **Why it exists:** Proves tangible ROI on training investments by charting measurable skill level elevation.

#### 2. Programme Conversion Funnel
* **Chart Type:** ECharts `funnel` (`programmeFunnelOption`)
* **Stages:** Assigned (1,284) $\rightarrow$ Started (1,042, 81%) $\rightarrow$ Completed (868, 83%) $\rightarrow$ Assessed (612, 71%) $\rightarrow$ Applied at Work (398, 65%).
* **Why it exists:** Pinpoints where learners disengage (e.g. completion vs formal assessment gap).

#### 3. Learning Hours by Function (Horizontal Bar)
* **Chart Type:** ECharts horizontal `bar` (`learningHoursOption`)
* **Data:** Engineering (1,420h), Support (980h), Sales (760h), Operations (640h), Finance (380h).
* **Why it exists:** Verifies whether departments are meeting annual continuous education mandates.

---

## 11. Cockpit S10: Nucleus Intelligence & Model Governance

**Primary File:** `src/components/Dashboard/Views/NucleusIntelligence.js`  
**Target Audience:** Super Admin, Data Protection Officer (DPO), AI System Architects.  
**Core Purpose:** Transparent governance of machine learning models, cross-module autonomous agent guardrails, natural language synthesis, and DPDP 2023 compliance auditing.

### Component Breakdown:

#### 1. Natural Language Synthesis Engine & Evidence Box
* **Representation:** Natural language prompt console with real-time semantic synthesis.
* **Example Query:** *"Which teams lost the most people in their first year, and did it get worse after we moved to the new shift pattern?"*
* **Synthesized Evidence:** Identifies 4 teams (Support Hyd, Support Blr, Field Ops, Sales SMB) accounting for 61% of exits; notes correlation with rotating shift notice periods under 72 hours.
* **Governance Actions:** `Save as Permanent Widget`, `Show SQL Query`, `Show Excluded Records`.
* **Why it exists:** Empowers executives to perform exploratory data analysis across disparate HR databases without custom SQL engineering.

#### 2. Overnight Autonomous Model Detections
* **Representation:** Severity-coded alert feed (03:00 IST batch run).
* **Detections:**
  * High: 2 employees share bank account number (Payroll fraud risk).
  * High: Attrition flight risk > 0.7 for 22 senior engineers.
  * Medium: Chennai attendance regularisation spike (4.2x norm).
  * Medium: Rating compression under 3 managers.
* **Why it exists:** Automated overnight pattern recognition that catches anomalies before humans detect them.

#### 3. Autonomous Agents & Allowed Actions (Zero-Trust Guardrails)
* **Representation:** Strict governance policy table defining agent boundaries.
* **Table Contracts:**
  * `Roster Balancer`: Proposes assignments $\rightarrow$ **Requires Human Sign-off**
  * `Query Assistant`: Answers from policy $\rightarrow$ **None Needed**
  * `Onboarding Runner`: Provisions hardware/tasks $\rightarrow$ **None Needed**
  * `Compensation or Exit Action`: Any trigger $\rightarrow$ <span style="color:#F2647E;font-weight:700;">BLOCKED (Not Permitted)</span>
* **Why it exists:** Guarantees no autonomous AI agent can unilaterally terminate an employee, alter compensation, or execute unreviewed bank payments.

#### 4. Model Register & Bias Audit Table
* **Representation:** Production ML model audit register.
* **Tracked Models:** Attrition Risk (0.81 AUC), Candidate Match (0.76 AUC, quarterly bias-tested), Attendance Anomaly (4% False Pos), Skill Inference (0.72 F1).
* **Why it exists:** Ensures full compliance with India's Digital Personal Data Protection (DPDP) Act 2023 and global algorithmic audit standards.

---

## 12. Grounded Daily Operational Widgets

**Rendered In:** `MainWorkspace.js:360-520`  
**Placement:** Direct sub-section below any active cockpit.

### 12.1 Today's Focus Checklist
* **Representation:** Interactive checkbox queue with pending counter chip (`3 Pending`).
* **Features:** Instant strike-through styling on complete, priority due badges (`Today`, `Urgent`, `EOD`), optimistic state update via `completeFocusTask(id)`.
* **Why it exists:** Keeps managers and staff accountable for high-priority operational items.

### 12.2 Company Broadcasts & Announcements Card
* **Representation:** Feed of active administrative notices with author, date, and `PINNED` badges.
* **Interactions:** Clicking any broadcast opens `CMSModal.js` to view full text, policy attachments, or compose new announcements.
* **Why it exists:** Organization-wide dissemination of holidays, statutory deadlines, and leadership news.

### 12.3 Active Pod Sprints & Projects Summary
* **Representation:** Pod sprint progress bars, milestone counters, and direct jump button to the `ProjectView.js` Kanban board.
* **Why it exists:** Maintains continuous alignment between daily HR tasks and active agile sprint deliverables.

---

## 13. Backend Integration & Data Contract Architecture

To power all 10 cockpits and widgets, backend engineers must implement the following REST/GraphQL endpoints and database queries:

```
                  +-----------------------------------+
                  |      Nucleus Frontend Views       |
                  +-----------------------------------+
                                    |
                    GET /api/dashboard/:consoleId
                                    |
                  +-----------------------------------+
                  |     Dashboard Aggregator API      |
                  +-----------------------------------+
                     /          |         |        \
                    /           |         |         \
         +------------+  +-----------+  +-------+  +------------+
         | TimeOffice |  |  Payroll  |  |  ATS  |  |   Talent   |
         |   Engine   |  |   Engine  |  | Model |  | 9-Box Calc |
         +------------+  +-----------+  +-------+  +------------+
```

| Endpoint Path | HTTP | Supporting Dashboard | Payload / Response Model |
|---|---|---|---|
| `/api/dashboards/command-centre` | `GET` | **S1** (People Command Centre) | `{ kpis, radarMetrics, headcountForecast, sankeyNodes, sankeyLinks, attritionByDept, scatterBubbles, heatmapMatrix }` |
| `/api/dashboards/hr-ops` | `GET` | **S2** (HR Ops Console) | `{ dailyMuster, approvalQueue, onboardingFunnel, absenceCalendarHeatmap, requestCategories }` |
| `/api/dashboards/attendance-intel` | `GET` | **S3** (Attendance Intel) | `{ attendanceTrend, sitePunctuality, overtimeByDept, shiftRosterSlots, anomalyAlerts }` |
| `/api/dashboards/recruitment` | `GET` | **S4** (Talent Acquisition) | `{ openRequisitions, funnelStages, offerWaterfall, csatRadar }` |
| `/api/dashboards/payroll-control` | `GET` | **S5** (Payroll Control Room) | `{ activeStage, stepperStages, varianceWaterfall, costDonut, deptAverages, blockingExceptions }` |
| `/api/dashboards/calibration` | `GET` | **S6** (Performance & Talent) | `{ ratingCurveActual, ratingCurveGuided, competencyRadar, nineBoxDistribution }` |
| `/api/dashboards/manager-team` | `GET` | **S7** (Manager Cockpit) | `{ directReports, capacityNext4Weeks, teamSkillRadar, pendingTriageItems, oneOnOneSchedule }` |
| `/api/dashboards/employee-home` | `GET` | **S8** (Employee Home) | `{ shiftStatus, leaveRings, payslipEstimate, weeklyTimesheet, goals, attendanceHeatmap, reportingLine, podTeammates }` |
| `/api/dashboards/magnetix-capability` | `GET` | **S9** (Magnetix Capability) | `{ capabilityRadar, funnelStages, functionHours, kpiCards }` |
| `/api/dashboards/ai-governance` | `GET` | **S10** (Nucleus Intelligence) | `{ modelRegister, overnightFindings, agentGuardrails, synthesisCache }` |
| `/api/dashboards/timesheet/log` | `POST` | **S8** (Timesheet Log Modal) | `Body: { project, task, hours, billable } -> Status 201` |
| `/api/dashboards/timesheet/submit` | `POST` | **S8** (Timesheet Submit) | `Body: { weekNumber, totalHours } -> Status 200` |
| `/api/dashboards/approvals/action` | `POST` | **S2, S7** (Approvals Triage) | `Body: { id, actionType: 'approve'|'reject'|'reroute', remarks, targetUserId } -> Status 200` |
| `/api/dashboards/shifts/autofill` | `POST` | **S3** (Shift Auto-Fill) | `Body: { siteId, date } -> Status 200 (Rebalanced Roster)` |

---

## 14. Verification & Implementation Sign-off

* **Component Source Codes:** Fully implemented in `src/components/Dashboard/Views/` and `src/components/Clerio/MainWorkspace.js`.
* **Theme Styling:** Integrated with `src/components/Charts/theme.js` (`NUCLEUS_COLORS`: Teal `#2DD4A8`, Sky `#4FB6F5`, Amber `#F2A93B`, Coral `#F2647E`, Violet `#9B8CFF`, Slate `#5F7691`).
* **Zero Runtime Overhead:** All chart instances utilize responsive SVG/Canvas renderers with unmount cleanup to prevent memory leaks during cockpit tab switching.
