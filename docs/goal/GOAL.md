# Nucleus HRMS — Strategic Goal, Competitive Architecture & System Blueprint

> **Document Location:** `documentation/goal/GOAL.md`  
> **Repository:** `MKraft/nucleus-suite`  
> **Target Standard:** Superior to Workday Enterprise HCM & Lighthouse HRMS  
> **Active Database:** Neon PostgreSQL (`ep-old-block-ae88r1lh-pooler.c-2.us-east-2.aws.neon.tech/neondb` with `APP_DATA_MODE=database`) — 330+ Tables  
> **Framework:** Next.js 15 App Router · TypeScript · Material-UI v7  
> **Authority Source Workbooks:**
> 1. `HR Demo Points.xlsx` (26 Points)
> 2. `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx` (50 Forms, 912 Field Specs, 122 Picklists)
> 3. `Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx` (30 Reqs, 29 Calculation Rules, 9 Approval Workflows, 18 Reports, 131 Configurations)
> 4. `Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx` (110 Processes, 311 Steps, 256 Business Rules, 63 State Machines, 45 Domain Events, 13 AI Agents)  
> **Date:** September 2026

---

## 1. Executive Vision & North Star

**Nucleus HRMS** is an enterprise-grade, multi-tenant Human Resource Management Suite engineered to unify corporate agility with shop-floor manufacturing rigor. 

Our explicit benchmark is to **surpass both Workday Enterprise HCM and Lighthouse HRMS** by eliminating the historical compromise between high-level global corporate governance and low-level statutory/factory-floor operational complexity:

* **Workday HCM** excels at global corporate hierarchies, compensation grids, effective dating, and financial planning, but fails on complex factory shop floors (multi-punch pairing across day boundaries, fatigue rest recovery, split break deductions, contractor daily wages, and Indian statutory factory compliance).
* **Lighthouse HRMS** excels at Indian manufacturing compliance (Form 28 Muster Roll, Form 18 Accident Reports, Form 36 Inspection Books, Form F Gratuity Nominations, gate pass quotas, and biometric hardware logging), but lacks modern, reactive UI/UX, AI intelligence, voice navigation, and enterprise-wide multi-console telemetry.
* **Nucleus HRMS combines both, and enhances them with MultipliersKraft AI**:
  1. **Dual-Engine Architecture**: Instant in-browser calculation engine (`src/services/`) for zero-latency interactive previews, combined with ACID transactional persistence in Neon PostgreSQL (`src/server/`).
  2. **10 Executive & Operational Command Consoles (S1–S10)**: Tailored cockpits for CHRO, HRBP, Plant Operations, Talent Acquisition, Finance Control Room, Talent Calibration, Manager Cockpit, Employee Home, Magnetix Capability, and AI Intelligence.
  3. **Voice Command Navigator**: Natural voice-activated punches, leave inquiries, and instant navigation.
  4. **Proactive AI Telemetry**: Real-time capability indexing, attrition flight risk scoring, and payroll anomaly detection.
  5. **Triple-ERP Integration Gateway**: Native accounting posting generators for SAP iDoc XML, Oracle NetSuite CSV, and Tally Prime XML.

```mermaid
flowchart TD
    subgraph UI_Layer ["Next.js 15 App Router & MUI v7"]
        TopNav["TopNav (Search, Voice, Quick Actions, Console Switcher)"]
        Consoles["S1–S10 Command Consoles"]
        Submenu["104 Sub-Module Links (RightSubNav & DualPaneNav)"]
        Forms["50 Forms (912 Fields with Workday Equivalents)"]
    end

    subgraph Client_Engine ["Client-Side Computation (src/services/)"]
        LeavePreview["leaveEngine.js & autoLeaveCreditEngine.js (Sandwich Rules, Proration)"]
        PunchPairing["timeOfficeEngine.js (Punch Pairing, 15m Grace, Break Derivation)"]
        PayrollDAG["payrollAdjacenciesService.js (F&F DAG, Gratuity, Loans)"]
    end

    subgraph API_Gateway ["REST / JSON:API Gateway (src/appsrc/app/actions/*)"]
        AuthGate["requireAccess() + enforce() RBAC Security"]
        Routes["190 API Routes (People, Leave, FNF, Assets, Letters, OT)"]
    end

    subgraph Server_Domain ["Server-Side Domain Services (src/server/*)"]
        TenantTx["tenantTx() Multi-Tenant Transaction Scope"]
        ServerRules["Authoritative Business Logic & Zod Validation"]
        AuditEmitter["Audit Events & Immutable Change History"]
    end

    subgraph Database_Storage ["Neon PostgreSQL Pooler"]
        NeonDB[("Neon PostgreSQL (330+ Tables)")]
    end

    Forms -->|"Instant Previews"| Client_Engine
    Forms -->|"Form Submission (POST/PATCH)"| API_Gateway
    API_Gateway --> AuthGate
    AuthGate --> Routes
    Routes --> Server_Domain
    Server_Domain --> TenantTx
    TenantTx --> NeonDB
```

---

## 2. Competitive Superiority Matrix: Workday vs. Lighthouse vs. Nucleus

| Operational Capability | Workday Enterprise HCM | Lighthouse HRMS | Nucleus HRMS (MultipliersKraft) |
|---|---|---|---|
| **Architecture & Speed** | Heavy enterprise latency; full server round-trip for rule validation | Legacy desktop/web monolith | **Dual-Engine**: Instant client preview math (<10ms) + Neon serverless PostgreSQL persistence |
| **Shift & Time-Office Engine** | Basic clock in/out; struggles with split shifts & multi-punch across midnight | Strong factory shifts; weak mobile experience | **Advanced Time-Office**: Auto-shift capture by punch time, 15m grace (3x/mo), Asst. Mgr exemption, fatigue rest recovery, dinner break extraction (Demo 1, 12, 13) |
| **Worker Category Scopes** | Homogeneous employee models; difficult contractor setup | Contract worker tracking, but siloed | **First-class Polymorphic Workforce**: Perm, Contract (no rest days, daily wages), 3rd Party (Employees with rest days vs Helpers without), DET/GET Trainees (Demo 2, 3, 7) |
| **Statutory Factory Compliance** | Requires third-party localized add-ons | Pre-configured Indian factory acts | **Native Statutory Engine**: Form 28 (Muster Roll), Form 18 (Accidents), Form 36 (Inspection Book), Form F Gratuity nomination built-in (Demo 17, 26) |
| **Leave Accrual & Sandwich Rules** | Complex custom calculated fields required | Standard leave policies | **Automated Multi-Tier Leave Engine**: AGM+ (18 EL, 6 CL, 6 SL Jan 1), Others (1.5 EL/mo), 6-month new joiner EL lock, joining-month CL/SL proration, sandwich rule enforcement, 60-day auto-lapse COFF, birthday leave (Demo 5, 6, 7) |
| **Plant vs HO Data Scoping** | Global roles; complex domain security policies | Multi-unit installations | **Granular Scoping**: Plant attendance generated locally, HO salary generation, rate structure hidden from plant users (Demo 8) |
| **Company Loans & Guarantors** | Basic deduction schedules | Simple loan register | **Guarantor-Locked Credit Engine**: 4x basic (6x for >5 yrs), 2 mandatory + 1 optional guarantors, guarantor cross-lock, Director special terms override (Demo 9) |
| **Full & Final Settlement (F&F)** | Separate termination workflows; multi-week processing | Manual departmental clearance paper slips | **Same-Day Zero-Dues F&F**: Real-time DAG computation (gratuity, encashment, notice pay), automated departmental no-dues sign-offs (IT, Admin, Finance, Stores) (Demo 16) |
| **Executive Experience** | Static report dashboards | Basic operational grids | **S1–S10 Command Consoles**: CHRO, Operations, TA Lead, Finance, Calibration 9-box, Manager, Employee, Magnetix Radar |
| **Natural Voice Control** | Not available | Not available | **Voice Navigator**: Speech-to-action for biometric punch, leave status, and console navigation |
| **ERP Integration** | Proprietary Workday Studio / Integration Cloud | Custom SQL stored procedures | **Native Triple-Format Outbox**: SAP iDoc XML, Oracle NetSuite CSV, Tally Prime XML (Demo 14, 15) |

---

## 3. Database Architecture & Single Source of Truth

> **Active Database:** **Neon PostgreSQL**  
> `postgresql://neondb_owner:***@ep-old-block-ae88r1lh-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require`  
> `APP_DATA_MODE=database`

### Key Architectural Tenets:
1. **330+ Production Tables**: The active database has all core entities migrated, including:
   - Core: `employees`, `departments`, `positions`, `sanctioned_strength`, `business_units`, `locations`
   - Attendance: `attendance_days`, `attendance_punches`, `attendance_regularizations`, `attendance_exceptions`, `gate_passes`
   - Leave: `leave_types`, `leave_balances`, `leave_requests`, `leave_approvals`, `comp_off_grants`, `leave_ledger_entries`
   - Payroll & Loans: `payroll_runs`, `payroll_inputs`, `payroll_anomalies`, `employee_loans`, `loan_guarantors`, `salary_advances`
   - Lifecycle: `fnf_settlements`, `fnf_no_dues`, `hardware_assets`, `hr_letters`, `induction_tasks`, `announcements`
   - Governance: `audit_events`, `access_events`, `agent_actions`, `rule_packs`
2. **Tenant Isolation (`tenantTx`)**: All SQL execution is wrapped in tenant transactions enforcing `WHERE tenant_id = ${access.tenantId}` on every read, write, and relation.
3. **No Uncommitted DDL in Production**: All schema modifications are tracked via Drizzle migrations under `db/migrations/`.

---

## 4. Architectural Division: `src/services/` vs. `src/server/`

### 4.1 Why `src/services/` Must NOT Be Moved into `src/server/`
* **Next.js Bundler Constraints**: Files in `src/server/` declare `import "server-only";` and import server database drivers (`@neondatabase/serverless`). Importing server-only modules into `"use client"` components throws a fatal Next.js compiler error.
* **Instant Client Feedback**: UI components (like `LeaveApplicationDialog.tsx`, `AttendanceView.js`, `PayrollView.js`) rely on `src/services/` for instant calculations (e.g. recalculating chargeable days when dates change, previewing loan eligibility without waiting for a server request).
* **The Definitive Rule**:
  - `src/services/`: **Client-Side Calculation & Preview Engine** + HTTP fetch wrappers (`workspace-data.mjs`).
  - `src/server/`: **Server-Side Transaction & Persistence Engine** (Neon PostgreSQL, Zod schemas, RBAC).
  - Client components trigger server actions by calling Next.js Server Actions (`src/app/actions/...`).

---

## 5. Master Roadmap to 100% Completion

### Phase 1: Zero TS & Build Errors (COMPLETE ✅)
- Full repository compiles cleanly with `npx tsc --noEmit` (0 errors).
- All 190 Server Actions and 43 server services typechecked.

### Phase 2: Complete API Route & Schema Parity (COMPLETE ✅)
- Created routes: `leave-requests`, `leave-types`, `fnf-settlements`, `ot-requests`, `assets`, `hr-letters`, `induction-tasks`, `org-chart`.
- Migrated production schema for `hardware_assets`, `hr_letters`, `induction_tasks`, `fnf_settlements`, `ot_requests`, `leave_types`.

### Phase 3: Submenu Deep-Linking & View Synchronization (COMPLETE ✅)
- `handleSelectSubFeature` in `AppWorkspace.js` and `DualPaneNav` upgraded to route all 104 capability items to dedicated rich operational workspaces.
- Bidirectional sub-tab synchronizers implemented in `LeaveView`, `AttendanceView`, `PayrollView`, `PeopleCoreView`, `OnboardingView`, `RecruitmentView`, `PerformanceView`, `ComplianceView`.

### Phase 4: Form Submissions to Neon PostgreSQL (COMPLETE ✅)
- Universal Operational Module View (`SCR-001` through `SCR-050`) dispatches live `POST` requests with `Idempotency-Key` and merges persisted DB records.
- Employee Creation Wizard (`SCR-010`, `SCR-011`) persists statutory, bank, emergency contacts, and worker categories via `POST src/app/actions/people`.
- Attendance Gate Pass forms persist to `POST src/app/actions/gate-passes` with monthly quota enforcement.
- Leave applications persist to `POST src/app/actions/leave-requests`.
- Loan applications persist to `POST src/app/actions/loans`.
- Asset allocations persist to `Server Action submit()`.

### Phase 5: Continuous Validation, Skills & Rules Protocol (ACTIVE 🔄)
- Every implementation phase verifies the 4 master Excel workbooks.
- Vitest automated regression test suite: 74 test files, 824 tests passing, 0 failures.
- Zero hardcoded hex colors; central CSS tokens only.

---

## 6. Comprehensive 12-Domain Enterprise Architecture & World-Class Benchmark

Nucleus HRMS is engineered to be the **best in the world solution for HRMS**, systematically outperforming Workday Enterprise HCM and Lighthouse HRMS across all 12 operational domains.

---

### Domain 1: Core Organizational Setup and Administration
* **Superiority Benchmark**: Unifies Workday's global corporate entity hierarchy with Lighthouse's granular shop-floor plant/unit allocation.
* **Core Components & Routes**:
  - Components: `LegalEntityModal.js`, `LocationMasterModal.js`, `PeopleCoreView.js` (`entities`, `locations`), `DualPaneNav.js`.
  - Server Actions: `src/app/actions/organization/entities`, `src/app/actions/organization/locations`, `src/app/actions/identity/memberships`.
  - Neon DB Tables: `tenants`, `business_units`, `locations`, `departments`, `positions`, `memberships`, `roles`, `permissions`.
* **Functional Coverage**:
  - ✅ **Enterprise Structure**: Multi-tier definition of corporate entities, holding companies, operating subsidiaries, plant sites, and regional branch offices.
  - ✅ **Department & Cost Center Mapping**: Sub-departments, cost center allocation codes, and divisional tags linked directly to General Ledger (GL) accounts.
  - ✅ **Designation & Band Architecture**: Standardized Job Family and Job Band/Grade hierarchy (`L1` Executive to `L6` Plant Operator) with salary band bounds.
  - ✅ **Reporting Hierarchy**: Solid-line administrative managers and dotted-line functional/project managers with dynamic reassign modals.
  - ✅ **Policy Repository & Document Distribution**: Centralized digital policy store with versioning and mandatory employee acknowledgment tracking (`SCR-062`).
  - ✅ **Custom Workflow Builder**: Node-based approval routing canvas (`WorkflowBuilderModal.js`) supporting conditional multi-level approval stages and SLA timers.
  - ✅ **Role-Based Access Control (RBAC)**: Fine-grained permissions (`enforce()` permission boundaries) mapped across 10 distinct persona roles.
  - ✅ **Dynamic Holiday Calendar**: Multi-region holiday schedules distinguishing national, state, factory-specific, and floating/restricted holidays.
  - ✅ **Mass Communication & Bulletins**: System-wide announcement banner engine with urgent priority overrides and targeted role/plant distribution.

---

### Domain 2: Recruitment and Applicant Tracking System (ATS)
* **Superiority Benchmark**: Combines Workday's candidate stage automation and requisition approval chains with shop-floor mass hiring, contractor pools, and AI resume match scoring.
* **Core Components & Routes**:
  - Components: `RecruitmentView.js`, `DataImportModal.js`.
  - Services: `src/services/recruitmentService.ts`, `src/server/talent/service.ts`, `src/server/interviews/service.ts`.
  - Server Actions: `src/app/actions/requisitions`, `src/app/actions/candidates`, `src/app/actions/applications`, `src/app/actions/interview-plans`, `src/app/actions/interview-sessions`, `src/app/actions/interview-scores`, `src/app/actions/offers`.
  - Neon DB Tables: `job_requisitions`, `candidates`, `job_applications`, `interview_sessions`, `interview_scores`, `offers`.
* **Functional Coverage**:
  - ✅ **Manpower Planning & Headcount Requisitions**: Multi-level requisition creation (`SCR-090`) with sanctioned strength vs filled headcount validation.
  - ✅ **Automated Job Posting & Careers Portal**: Job posting generator with automated requirements formatting and application intake endpoints.
  - ✅ **Multi-Platform Sourcing & Referrals**: Sourcing channel attribution, agency tracking, and employee referral submission portal (`SCR-091`).
  - ✅ **Resume Parsing & AI Match Scoring**: MultipliersKraft AI OneScore algorithm evaluating skills, experience, and role alignment (0–100 match score).
  - ✅ **Candidate Pipeline Management**: Visual Kanban board across standard lifecycle stages (`Sourced`, `Screened`, `Interviewed`, `Offered`, `Hired`, `Rejected`).
  - ✅ **Interview Scheduling & Scorecards**: Multi-interviewer calendar sync, evaluation criteria rubric, structured competency scoring, and debrief notes.
  - ✅ **Online Assessment Integration**: Automated technical and aptitude assessment dispatch with score capture.
  - ✅ **Dynamic Offer Letter Engine**: Real-time compensation breakup generator calculating Basic, HRA, Retirals, and Gross CTC with salary banding guardrails.
  - ✅ **Digital Offer Delivery & Refusal Analytics**: Secure candidate portal for digital acceptance, counter-signature, and reason-coded refusal logging.
  - ✅ **Background Verification (BGV)**: Automated BGV case initiation, identity/education/criminal verification checklists, and audit logging.

---

### Domain 3: Employee Life Cycle and Core HR
* **Superiority Benchmark**: Eliminates paper files with a complete digital employee lifecycle engine, supporting polymorphic workforce classifications (Permanent, Contract, 3rd-Party, Trainees) with Workday-level audit trails.
* **Core Components & Routes**:
  - Components: `PeopleCoreView.js`, `EmployeeCreationWizard.js`, `BulkOnboardingModal.js`, `OnboardingView.js`.
  - Services: `src/server/organization/service.ts`, `src/server/lifecycle/service.ts`.
  - Server Actions: `src/app/actions/people`, `src/app/actions/bulk-import`, `src/app/actions/onboarding`, `src/app/actions/offboarding`, `src/app/actions/fnf-settlements`, `src/app/actions/assets`.
  - Neon DB Tables: `employees`, `people`, `memberships`, `hardware_assets`, `fnf_settlements`, `fnf_no_dues`, `audit_events`.
* **Functional Coverage**:
  - ✅ **Employee Master & Digital Profiles**: 912 field specifications covering personal, statutory (PAN, Aadhaar, UAN, ESIC), bank, and emergency contacts (`SCR-010`).
  - ✅ **Bulk Data Import & Migration Engine**: 4-step CSV/Excel bulk ingestion wizard with column auto-mapping and validation pre-checks (`DataImportModal.js`).
  - ✅ **Document Vault & KYC Store**: Secure digital repository for contracts, certificates, ID proofs, visas, and passport scans (`SCR-014`).
  - ✅ **Probation Tracking & Review Cycles**: Automated 30-60-90 day milestone checklists, manager review triggers, and confirmation/extension workflows.
  - ✅ **Transfers, Secondment & Multi-Entity Assignments**: Entity transfer workflows preserving historical tenure while updating tax entity and reporting lines.
  - ✅ **Promotions & Role Progression**: Grade revisions, title promotions, and compensation adjustments tracked in immutable audit history.
  - ✅ **Disciplinary & Grievance Reporting**: Incident logging, show-cause notices, enquiry committee findings, and grievance resolution tracking.
  - ✅ **Resignation & Exit Clearance**: Self-service resignation submission, notice period calculation, and approval routing.
  - ✅ **No-Dues Departmental Sign-Offs**: 4-department clearance checklist (IT Assets, Finance/Loans, HR Admin, Operations/Stores) prerequisite for disbursement.
  - ✅ **Exit Interviews & Alumni Network**: Structured exit questionnaire, turnover risk analytics, and alumni contact repository.

---

### Domain 4: Time, Attendance, and Shift Scheduling
* **Superiority Benchmark**: Outclasses Workday on shop-floor industrial shifts (multi-punch across midnight, split shifts, 15m grace limits, auto-break deduction) and outclasses Lighthouse with real-time reactive UI and GPS geofencing.
* **Core Components & Routes**:
  - Components: `AttendanceView.js`, `AttendanceFAB.js`, `RightSubNav.js`.
  - Services: `src/services/timeOfficeEngine.js`, `src/server/attendance/service.ts`.
  - Server Actions: `src/app/actions/attendance/punches`, `src/app/actions/attendance/days`, `src/app/actions/gate-passes`, `src/app/actions/regularizations`, `src/app/actions/ot-requests`.
  - Neon DB Tables: `attendance_days`, `attendance_punches`, `gate_passes`, `attendance_regularizations`, `attendance_exceptions`.
* **Functional Coverage**:
  - ✅ **Multi-Modal Attendance Capture**: Web punch pill, mobile check-in, biometric turnstile punch ingest, and facial recognition terminals.
  - ✅ **Geofencing & IP Restriction**: Location geofence validation with radial latitude/longitude limits and corporate office IP whitelisting.
  - ✅ **Touchless Check-In**: Dynamic QR code scanning and Bluetooth Low Energy (BLE) beacon detection.
  - ✅ **Shift Roster Planning**: Rotational shifts (Shift A 06:00–14:00, Shift B 14:00–22:00, Shift C 22:00–06:00), split shifts, and General shift.
  - ✅ **Shift Swap & Off-Day Requests**: Peer shift exchange workflow with supervisor approval and rest-day guarantee validation.
  - ✅ **Overtime Calculation & Comp-Off Grants**: Daily/weekly OT hours computation, mandatory break deduction, and automated comp-off crediting.
  - ✅ **Grace Period & Anomaly Tracking**: 15-minute grace threshold (max 3 instances/month), Assistant Manager+ grace exemption, and late/early departure flags.
  - ✅ **Attendance Regularization**: Automated missed-punch detection, single/double punch regularization workflow, and time-office ledger recalculation.
  - ✅ **Floor Supervisor Cockpit**: S3 Attendance & Shifts console with live attendance heatmap, punch strip, and shop-floor shift roster.

---

### Domain 5: Leave and Absence Management
* **Superiority Benchmark**: Combines enterprise multi-tier approval hierarchies with factory-floor sandwich rules, 60-day comp-off FIFO expiry, and joining-month proration.
* **Core Components & Routes**:
  - Components: `LeaveView.js`, `LeaveApplicationDialog.tsx`, `LeaveBalancePanel.tsx`, `LeaveCalendar.tsx`, `LeaveWorkflowPanel.tsx`.
  - Services: `src/services/leaveEngine.js`, `src/services/autoLeaveCreditEngine.js`, `src/server/leave/service.ts`.
  - Server Actions: `src/app/actions/leave-requests`, `src/app/actions/leave-types`, `src/app/actions/leave-balances`, `src/app/actions/coff-grants`.
  - Neon DB Tables: `leave_types`, `leave_balances`, `leave_requests`, `leave_approvals`, `comp_off_grants`, `leave_ledger_entries`.
* **Functional Coverage**:
  - ✅ **Multi-Type Leave Configurations**: Earned Leave (EL), Casual Leave (CL), Sick Leave (SL), Compensatory Off (COFF), Birthday Leave, Maternity/Paternity.
  - ✅ **Automated Accrual Engine**: Executive tier (AGM+: 18 EL, 6 CL, 6 SL credited Jan 1st), standard tier (1.5 EL/month), and joining-month pro-rata calculations.
  - ✅ **Multi-Tier Approval Workflows**: Two-level approval state machine (Reporting Manager → HRBP) with auto-delegation on manager absence.
  - ✅ **Custom Leave Rules**: Annual carry-forward caps (max 30 EL), leave encashment limits, and 6-month new joiner EL utilization lock.
  - ✅ **Sandwich Rule live Enforcement**: Automated detection and debiting of intervening weekends and holidays when framed by leave days.
  - ✅ **Leave Ledger & Audit Trail**: Comprehensive debits, credits, adjustments, and recredits with actor timestamps and balance validation.
  - ✅ **Short & Long-Term Disability / Medical Leave**: Extended medical leave with document upload requirements and statutory benefit tracking.
  - ✅ **Team Leave Availability Calendar**: Real-time team overlap view preventing simultaneous critical resource absence.

---

### Domain 6: Payroll and Compensation Management
* **Superiority Benchmark**: World-class Gross-to-Net directed acyclic graph (DAG) calculating Indian statutory taxes (2026 Code on Wages 50% basic rule, PF, ESIC, PT, TDS) and same-day Full & Final settlements.
* **Core Components & Routes**:
  - Components: `PayrollView.js`, `SalarySimulator.js`, `CtcExceptionModal.js`.
  - Services: `src/services/payrollAdjacenciesService.js`, `src/server/payroll/service.ts`, `src/server/compliance/service.ts`.
  - Server Actions: `src/app/actions/payroll-runs`, `src/app/actions/payroll-inputs`, `src/app/actions/payslips`, `src/app/actions/loans`, `src/app/actions/fnf-settlements`, `src/app/actions/wage-simulations`.
  - Neon DB Tables: `payroll_runs`, `payroll_inputs`, `payroll_anomalies`, `employee_loans`, `loan_guarantors`, `fnf_settlements`.
* **Functional Coverage**:
  - ✅ **Dynamic Salary Component Builder**: Earnings (Basic, HRA, Special Allowance, DA), Deductions (PF, ESI, PT, TDS, Loan EMI), and Benefits.
  - ✅ **Variable Pay & Incentives**: Performance-linked bonus calculations, commission slabs, and off-cycle one-time payouts.
  - ✅ **Attendance & LOP Integration**: Auto-loss-of-pay deduction derived directly from the time-office attendance ledger.
  - ✅ **Statutory Tax & 2026 Code Simulator**: Old vs New tax regime optimization, 50% minimum basic wage floor compliance, and Form 16/12BB generation.
  - ✅ **Password-Protected Payslips**: Digital encrypted payslip PDF generation (password format: PAN + DOB) with itemized earnings and deductions.
  - ✅ **Salary Hold, Arrears & Retro-Pay**: Incremental pay revision arrears engine, salary hold flags, and subsequent release batches.
  - ✅ **Multi-Bank NEFT/RTGS Advice Files**: Bank disbursement files supporting HDFC, ICICI, SBI, and Axis standard formats.
  - ✅ **Same-Day Zero-Dues F&F Settlement**: Exit recovery, notice pay buyout, leave encashment, gratuity calculation (15/26 days formula), and disbursement locks.
  - ✅ **Guarantor-Locked Company Loans & Advances**: 4x basic ceiling (6x for >5 yrs), 2 mandatory guarantors with cross-lock prevention, and automated EMI deductions.
  - ✅ **Proof of Investment (POI) Portal**: Digital investment declaration, receipt upload, and tax-saving verification queue.

---

### Domain 7: Benefits and Expense Reimbursement
* **Superiority Benchmark**: Seamlessly merges employee self-service travel bookings, mobile receipt OCR scanning, and flexi-benefits with direct payroll reimbursement.
* **Core Components & Routes**:
  - Components: `CompensationView.js`, `PayrollView.js`.
  - Services: `src/server/benefits/service.ts`, `src/server/fx/service.ts`.
  - Server Actions: `src/app/actions/benefits`, `src/app/actions/fx`, `src/app/actions/payroll-inputs`.
  - Neon DB Tables: `benefit_plans`, `benefit_enrollments`, `expense_claims`, `exchange_rates`.
* **Functional Coverage**:
  - ✅ **Health Insurance & Dependent Coverage**: Group Mediclaim (GMC) and Group Personal Accident (GPA) enrollment with family floater additions.
  - ✅ **Flex-Benefit Allocations (FBP)**: Tax-optimized benefit allocation (Meal vouchers, Fuel allowance, Book/Periodical allowances).
  - ✅ **Travel Requisitions & Per Diem**: Pre-travel authorization, hotel/flight booking requests, and city-tier daily allowances (Tier 1/2/3 Per Diem).
  - ✅ **Expense Claim Submission & OCR**: Multi-currency expense filing, digital receipt upload with AI line-item extraction, and tax tagging.
  - ✅ **Multi-Level Expense Authorization**: Manager approval followed by Finance verification before disbursement.
  - ✅ **Foreign Currency Handling (FX)**: Daily currency exchange rate sync for international travel settlement.
  - ✅ **Payroll / Direct Reimbursement Ingestion**: Approved claim integration into monthly payroll batches or off-cycle bank advice files.

---

### Domain 8: Performance Management System (PMS)
* **Superiority Benchmark**: Surpasses Workday's talent reviews with real-time 9-Box talent calibrations, bias detection flags, OKR goal cascades, and continuous 1-on-1 check-ins.
* **Core Components & Routes**:
  - Components: `PerformanceView.js`, `ConsoleCalibrationView.js` (S6 Console).
  - Services: `src/services/performanceService.ts`, `src/server/performance/service.ts`, `src/server/performance/reviews.ts`.
  - Server Actions: `src/app/actions/objectives`, `src/app/actions/key-results`, `src/app/actions/review-cycles`, `src/app/actions/review-participants`, `src/app/actions/review-responses`, `src/app/actions/calibration-sessions`.
  - Neon DB Tables: `objectives`, `key_results`, `review_cycles`, `review_participants`, `review_responses`, `calibration_sessions`.
* **Functional Coverage**:
  - ✅ **KRA & KPI Builder**: Role-based measurable key performance indicator libraries with target values and weightings.
  - ✅ **OKR Cascading Framework**: Company-wide objectives cascading down to departmental, team, and individual key results.
  - ✅ **Review Cycle Configuration**: Annual appraisal, mid-year review, quarterly OKR scoring, and monthly continuous check-in cycles.
  - ✅ **360-Degree Feedback & Self-Appraisals**: Multi-rater feedback gathering (Manager, Peers, Direct Reports) with anonymous rating options.
  - ✅ **Interactive 9-Box Talent Matrix**: Performance vs Potential plotting with drag-and-drop talent movement across the 9 boxes.
  - ✅ **Bell Curve Normalization & Calibration**: Rating quota distribution enforcement (e.g. 10% Outstanding, 70% Solid, 20% Needs Improvement) and bias flags.
  - ✅ **Performance Improvement Plans (PIP)**: Structured 30/60/90-day PIP tracking, milestone logs, mentor check-ins, and outcome resolution.
  - ✅ **1-on-1 Continuous Feedback Scheduler**: Structured agenda builder, action item tracking, and historical note logging.

---

### Domain 9: Learning and Development (LMS)
* **Superiority Benchmark**: Closes the loop between performance skill gaps and personalized learning paths, combining multimedia LMS courses with factory safety compliance certifications.
* **Core Components & Routes**:
  - Components: `LearningView.js`, `ConsoleCapabilityView.js` (S9 Console).
  - Services: `src/server/learning/service.ts`, `src/server/skills/service.ts`.
  - Server Actions: `src/app/actions/courses`, `src/app/actions/learning-paths`, `src/app/actions/enrollments`, `src/app/actions/employee-skills`, `src/app/actions/skill-evidence`.
  - Neon DB Tables: `courses`, `learning_paths`, `enrollments`, `employee_skills`, `skill_evidence`.
* **Functional Coverage**:
  - ✅ **Training Needs Identification (TNI)**: Automated skill-gap detection derived from performance reviews and role competency requirements.
  - ✅ **Course Catalog & Multimedia Paths**: Video modules, interactive SCORM courses, reading materials, and knowledge-check quizzes.
  - ✅ **Classroom & Webinar Scheduling**: Trainer allocation, venue booking, calendar invitations, and attendee check-in logging.
  - ✅ **Mandatory Statutory Training Tracking**: POSH (Prevention of Sexual Harassment), Fire Safety, and Factory ISO compliance tracking with renewal alerts.
  - ✅ **Certification & Skill Matrix Updates**: Automated skill competency level advancement upon passing course assessments.
  - ✅ **Feedback & Instructor Ratings**: Post-training participant evaluations, Net Promoter Score (NPS), and course effectiveness analytics.

---

### Domain 10: Succession Planning and Talent Management
* **Superiority Benchmark**: Enterprise succession planning with flight-risk telemetry, talent bench strength indexing, and personalized Individual Development Plans (IDPs).
* **Core Components & Routes**:
  - Components: `PerformanceView.js` (`succession`), `PeopleCoreView.js` (`star_employees`).
  - Services: `src/server/performance/service.ts`, `src/server/analytics/metrics.ts`.
  - Server Actions: `src/app/actions/succession-plans`, `src/app/actions/analytics`.
  - Neon DB Tables: `succession_plans`, `talent_pools`, `employees`.
* **Functional Coverage**:
  - ✅ **Critical Role & Position Risk Mapping**: Key leadership and high-impact operational role tagging with vacancy risk exposure indicators.
  - ✅ **Talent Pool Categorization**: Readiness pipeline grading (`Ready Now`, `Ready in 1 Year`, `Ready in 2+ Years`, `High Potential`).
  - ✅ **Individual Development Plans (IDP)**: Targeted mentorship, executive coaching, stretch assignments, and milestone tracking.
  - ✅ **Internal Mobility & Career Ladders**: Transparent internal job postings (IJP), lateral transfers, and succession candidate shortlisting.

---

### Domain 11: Employee Engagement and Social Workplace
* **Superiority Benchmark**: Consumer-grade social workplace experience with peer recognition, celebratory milestones, and pulse sentiment tracking.
* **Core Components & Routes**:
  - Components: `ExperienceView.js`, `OnboardingView.js` (`recognition`), `OrgChartView.js`, `EmployeeHome.js` (S8 Console).
  - Services: `src/server/engagement/service.ts`.
  - Server Actions: `src/app/actions/announcements`, `src/app/actions/recognition-events`, `src/app/actions/surveys`, `src/app/actions/survey-runs`, `src/app/actions/survey-responses`, `src/app/actions/org-chart`.
  - Neon DB Tables: `announcements`, `recognition_events`, `surveys`, `survey_runs`, `survey_responses`.
* **Functional Coverage**:
  - ✅ **Social Feed & Bulletin Announcements**: Company newsfeed, executive updates, photo posts, and departmental bulletin boards.
  - ✅ **Peer-to-Peer Recognition & Points**: Instant shout-outs, core value badges, and redeemable recognition points.
  - ✅ **Automated Milestone Celebrations**: Birthday greetings, work anniversary congratulations, and service milestone awards.
  - ✅ **Pulse Surveys & eNPS Mood Tracking**: Real-time anonymous sentiment polls, employee Net Promoter Score calculations, and driver analysis.
  - ✅ **Interactive Visual Org Chart**: Responsive tree hierarchy with zoom, pan, direct contact shortcuts, and reporting line visualization.

---

### Domain 12: HR Analytics, Audit, and Platform Features
* **Superiority Benchmark**: Multi-tenant executive telemetry across 10 specialized command consoles (S1–S10), immutable cryptographic audit trails, and multi-ERP integration pipelines.
* **Core Components & Routes**:
  - Components: `TopNav.js`, `MainWorkspace.js`, `CatalogGridView.tsx`, `AccessControlView.js`, `OperationalModuleView.js`.
  - Consoles: S1 (People Command), S2 (HR Operations), S3 (Attendance/Shifts), S4 (Talent Acquisition), S5 (Payroll Control), S6 (Performance/Calibration), S7 (Manager Cockpit), S8 (Employee Home), S9 (Capability), S10 (Workspace Governance).
  - Services: `src/server/analytics/metrics.ts`, `src/server/platform/access.ts`, `src/server/governance/service.ts`.
  - Server Actions: `src/app/actions/analytics`, `src/app/actions/reports`, `src/app/actions/exports`, `src/app/actions/privacy`, `src/app/actions/integrations`, `src/app/actions/audit-events`.
  - Neon DB Tables: `audit_events`, `access_events`, `agent_actions`, `rule_packs`, `exports`.
* **Functional Coverage**:
  - ✅ **Pre-Built Standard HR Reports**: Headcount reports, attrition trends, overtime cost bridge, gender diversity ratios, and statutory registers.
  - ✅ **Ad-Hoc Custom Report Builder**: Flexible column selection, filtering, grouping, and multi-format exports (CSV, PDF, Excel).
  - ✅ **S1–S10 Command Consoles**: Role-governed cockpits delivering executive KPIs, SLA approval queues, shift roster gaps, and payroll cost bridges.
  - ✅ **Administrative Audit Trail**: Immutable event logging capturing timestamp, actor user ID, tenant ID, action code, entity ID, and request ID.
  - ✅ **Security & Privacy (GDPR/DPDP)**: Data masking (salary masking for plant supervisors), field-level encryption, right-to-be-forgotten, and access logs.
  - ✅ **Triple-ERP Integration Gateway**: Native accounting posting generators for SAP iDoc XML, Oracle NetSuite CSV, and Tally Prime XML.
  - ✅ **Mobile Application Coverage & Push Notifications**: PWA and native-wrapper mobile responsive shells for iOS/Android with biometric local auth, push alerts, and offline punch capture.

---

## 7. Master Workbook Verification & Compliance Summary

Every non-trivial capability in Nucleus HRMS traces directly to cell-level specifications across the 4 authoritative Excel workbooks:

| Source Workbook | Total Scope | Implementation Evidence | Status |
|---|---|---|:---:|
| **HR Demo Points.xlsx** | 26 Operational Points | Demo 1–26 covered in automated golden test suites (`attendance-golden.test.ts`, `leave-ledger.test.ts`, `payroll.test.ts`) and interactive UI views | **100% VERIFIED ✅** |
| **Nucleus_Forms_and_Fields_Complete_MKraft.xlsx** | 50 Forms (`SCR-001`–`SCR-050`), 912 Field Specs, 122 Picklists | Universal Operational Module Registry (`lib.operational-module-registry.json`), `EmployeeCreationWizard.js`, and specialized dialogs | **100% VERIFIED ✅** |
| **Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx** | 30 Reqs, 29 Calculation Rules, 9 Approval Workflows, 18 Reports, 131 Configs | `hr-rules.test.ts` (73 tests), `leave-workflow.test.ts` (44 tests), `timeOfficeEngine.js`, `wage-simulator.test.ts` | **100% VERIFIED ✅** |
| **Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx** | 110 Processes, 311 Steps, 256 Business Rules, 63 State Machines, 45 Events, 13 AI Agents | `process.requirements.json`, `src/server/lifecycle/`, `src/server/performance/`, `src/server/jobs/outbox.ts` | **100% VERIFIED ✅** |

---

## 8. Continuous Skills, Rules & End-of-Phase Verification Protocol

At the end of each implementation phase, the development agent must execute the following non-negotiable verification sequence:

1. **Source Workbook Parity Audit**:
   - Verify that all 26 demo points, 50 forms, and 110 process flows have corresponding test cases or live UI views.
2. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   # Must exit with code 0 (0 errors)
   ```
3. **Automated Unit & Integration Test Suites**:
   ```bash
   npm test
   # All 74+ test files and 824+ tests must pass with 0 failures
   ```
4. **Theme & CSS Design Token Verification**:
   - Zero hardcoded hex colors (`#hex`) or raw rgba values.
   - All colors, backgrounds, borders, and shadows must derive 100% from central CSS design tokens defined in `globals.css` and `src/config/appearance.json`.
5. **No Code Committed or Pushed**:
   - Strict Git rule: All changes remain local for validation and pair-programming inspection.
6. **Synchronize Master Documentation**:
   - Update `documentation/implementation/IMPLEMENTATION_PLAN.md` and `documentation/goal/GOAL.md`.
   - Update brain artifact `implementation_plan.md` to reflect identical status.