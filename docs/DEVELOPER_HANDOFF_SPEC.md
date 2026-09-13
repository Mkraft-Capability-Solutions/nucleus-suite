# Nucleus HRMS — Master Developer Handoff Specification
**Version:** 2.0.0-PROD  
**Target Audience:** Backend Engineers, Full-Stack Developers, Database Architects, API Integration Teams  
**Platform Scope:** Next.js 16 (App Router), PostgreSQL / Prisma ORM, REST / Server Actions, JWT / NextAuth  

---

## Table of Contents
1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Role-Based Access Control (RBAC) Permissions Matrix](#2-role-based-access-control-rbac-permissions-matrix)
3. [Production Database Schema (`schema.prisma`)](#3-production-database-schema-schemaprisma)
4. [Complete REST API Specification & Contracts](#4-complete-rest-api-specification--contracts)
5. [Core Calculation Engines & Business Logic Rules](#5-core-calculation-engines--business-logic-rules)
6. [Frontend State & API Integration Map](#6-frontend-state--api-integration-map)
7. [Environment Configuration & Seed Guide](#7-environment-configuration--seed-guide)

---

## 1. Executive Summary & System Architecture

Nucleus HRMS is an enterprise-grade Human Resource Management System built on Next.js 16 (Turbopack). The frontend presentation layer, role switchers, data charts, and design tokens are completely established.

### Tech Stack Recommendation for Backend
- **Runtime:** Node.js 20+ / Next.js 16 App Router API Routes (`/src/app/api/...`)
- **Database:** PostgreSQL (AWS RDS / Supabase / Neon)
- **ORM:** Prisma ORM 5.x (`prisma/schema.prisma`)
- **Authentication:** NextAuth.js v5 (Auth.js) with JWT Session Strategy & Google/Microsoft Entra SSO
- **Storage:** AWS S3 or Cloudflare R2 for Resumes, KYC PDFs, and Generated Payslips
- **Background Jobs / Workers:** Inngest or BullMQ (Redis) for midnight punch calculation, SLA escalation, and month-end payroll batching

```
 ┌────────────────────────────────────────────────────────┐
 │               Next.js 16 UI Presentation               │
 │  (LeftDock, TopNav, DualPaneNav, MainWorkspace, S1-S10)│
 └───────────────────────────┬────────────────────────────┘
                             │ REST / Server Actions
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │           Next.js API Gateway & Auth Middleware        │
 │     (Session verification, RBAC Guard, Audit Logger)   │
 └─────────────┬───────────────────────────┬──────────────┘
               │                           │
               ▼                           ▼
 ┌───────────────────────────┐ ┌──────────────────────────┐
 │ Calculation Engines       │ │ Prisma ORM Data Layer    │
 │ - Attendance & Punch DAG  │ │ - PostgreSQL Relational  │
 │ - Sandwich Leave Evaluator│ │ - Multi-Tenant Indexed   │
 │ - 2026 Wage Code & Tax    │ │ - Foreign Key Cascades   │
 └───────────────────────────┘ └──────────────────────────┘
```

---

## 2. Role-Based Access Control (RBAC) Permissions Matrix

| Endpoint Group | Super Admin (`SUPER_ADMIN`) | HR Manager (`HR_MANAGER`) | Finance Lead (`FINANCE_MANAGER`) | Team Lead (`TEAM_LEAD`) | Employee (`EMPLOYEE`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Auth & Profile (`/api/me`)** | Full | Full | Full | Full | Read/Self |
| **Attendance Punch (`/api/attendance/punch`)** | Override | Team / Org | View | Team | Self Only |
| **Weekly Timesheet (`/api/timesheets`)** | Full | Full | Read Audit | Approve Team | Log & Submit |
| **Leaves & Balance (`/api/leaves`)** | Full | Full | Read | Approve Team | Request & View |
| **Payroll & Payslips (`/api/payroll`)** | Full | Read Summary | Full Run | Restricted | Self Payslip |
| **Talent Acquisition (`/api/recruitment`)** | Full | Full Manage | View Offers | Interviewer | Job Portal |
| **Org & Employees (`/api/employees`)** | Full | Full Manage | Read Comp | Team Read | Directory Read |
| **System Settings & Audit (`/api/admin`)** | Full | Restricted | Restricted | Denied | Denied |

---

## 3. Production Database Schema (`schema.prisma`)

Replace `prisma/schema.prisma` with this relational model:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  SUPER_ADMIN
  HR_MANAGER
  FINANCE_MANAGER
  PROJECT_MANAGER
  TEAM_LEAD
  EMPLOYEE
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERN
}

enum PunchType {
  IN
  OUT
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum TimesheetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

enum PayrollStatus {
  DRAFT
  CALCULATED
  LOCKED
  DISBURSED
}

model Tenant {
  id          String       @id @default(uuid())
  name        String
  domain      String       @unique
  createdAt   DateTime     @default(now())
  users       User[]
  departments Department[]
  projects    Project[]
}

model User {
  id            String          @id @default(uuid())
  tenantId      String
  tenant        Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email         String          @unique
  passwordHash  String?
  role          UserRole        @default(EMPLOYEE)
  isActive      Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  profile       EmployeeProfile?
  managedTeams  Department[]    @relation("DeptManager")
  approvals     ApprovalItem[]  @relation("ApproverUser")
  assignedAudit AuditLog[]
}

model EmployeeProfile {
  id             String          @id @default(uuid())
  userId         String          @unique
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  employeeCode   String          @unique // e.g. AST-0142
  firstName      String
  lastName       String
  phone          String?
  avatarUrl      String?
  designation    String
  departmentId   String
  department     Department      @relation(fields: [departmentId], references: [id])
  managerId      String?
  manager        EmployeeProfile? @relation("ReportingLine", fields: [managerId], references: [id])
  reportees      EmployeeProfile[] @relation("ReportingLine")
  
  joiningDate    DateTime
  employmentType EmploymentType  @default(FULL_TIME)
  workLocation   String          @default("Bengaluru, India")
  
  // Banking & Statutory
  panNumber      String?
  aadhaarNumber  String?
  uanNumber      String?         // EPFO
  bankAccountNumber String?
  bankIfscCode   String?
  taxRegime      String          @default("NEW") // "NEW" (115BAC) | "OLD"

  // Relations
  punches        AttendancePunch[]
  leaveAllocations LeaveAllocation[]
  leaveRequests  LeaveRequest[]
  timesheets     Timesheet[]
  payslips       Payslip[]
  goals          Goal[]
}

model Department {
  id          String            @id @default(uuid())
  tenantId    String
  tenant      Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  code        String
  managerId   String?
  manager     User?             @relation("DeptManager", fields: [managerId], references: [id])
  employees   EmployeeProfile[]
}

model Project {
  id          String            @id @default(uuid())
  tenantId    String
  tenant      Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  clientName  String
  code        String            // e.g. PROJ-ALPHA
  isBillable  Boolean           @default(true)
  leadName    String
  status      String            @default("ACTIVE") // ACTIVE | COMPLETED
  entries     TimesheetEntry[]
}

model AttendancePunch {
  id          String            @id @default(uuid())
  employeeId  String
  employee    EmployeeProfile   @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  punchTime   DateTime          @default(now())
  punchType   PunchType         // IN | OUT
  deviceType  String            @default("WEB") // WEB | MOBILE | BIOMETRIC
  ipAddress   String?
  latitude    Float?
  longitude   Float?
  notes       String?

  @@index([employeeId, punchTime])
}

model LeaveAllocation {
  id          String            @id @default(uuid())
  employeeId  String
  employee    EmployeeProfile   @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  leaveType   String            // EARNED | CASUAL | SICK
  year        Int               @default(2026)
  allocated   Float             // e.g. 18.0
  availed     Float             @default(0.0)
  pending     Float             @default(0.0)

  @@unique([employeeId, leaveType, year])
}

model LeaveRequest {
  id          String            @id @default(uuid())
  employeeId  String
  employee    EmployeeProfile   @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  leaveType   String            // EARNED | CASUAL | SICK
  startDate   DateTime
  endDate     DateTime
  daysCount   Float
  isSandwich  Boolean           @default(false)
  reason      String
  status      LeaveStatus       @default(PENDING)
  actionNotes String?
  approverId  String?
  approvedAt  DateTime?
  createdAt   DateTime          @default(now())
}

model Timesheet {
  id          String            @id @default(uuid())
  employeeId  String
  employee    EmployeeProfile   @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  weekNumber  Int               // e.g. 37
  year        Int               @default(2026)
  startDate   DateTime
  endDate     DateTime
  totalHours  Float             @default(0.0)
  billableHours Float           @default(0.0)
  status      TimesheetStatus   @default(DRAFT)
  submittedAt DateTime?
  approvedAt  DateTime?
  approverId  String?
  entries     TimesheetEntry[]

  @@unique([employeeId, weekNumber, year])
}

model TimesheetEntry {
  id          String            @id @default(uuid())
  timesheetId String
  timesheet   Timesheet         @relation(fields: [timesheetId], references: [id], onDelete: Cascade)
  projectId   String
  project     Project           @relation(fields: [projectId], references: [id])
  date        DateTime
  taskDescription String
  hours       Float
  isBillable  Boolean           @default(true)
}

model PayrollCycle {
  id          String            @id @default(uuid())
  tenantId    String
  month       Int               // 1 - 12
  year        Int               // e.g. 2026
  status      PayrollStatus     @default(DRAFT)
  totalGross  Float             @default(0.0)
  totalDeductions Float         @default(0.0)
  totalNet    Float             @default(0.0)
  lockedAt    DateTime?
  payslips    Payslip[]

  @@unique([tenantId, month, year])
}

model Payslip {
  id             String         @id @default(uuid())
  cycleId        String
  cycle          PayrollCycle   @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  employeeId     String
  employee       EmployeeProfile @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  
  // Earnings
  basicSalary    Float
  hra            Float
  specialAllowance Float
  grossSalary    Float

  // Deductions
  epfDeduction   Float          // 12% Basic
  esiDeduction   Float          // 0.75% Gross (if applicable)
  profTax        Float          // ₹200 standard
  tdsDeduction   Float          // Income tax
  lopDeduction   Float          @default(0.0) // Loss of Pay
  totalDeductions Float
  netSalary      Float

  pdfUrl         String?
  paidAt         DateTime?
}

model Goal {
  id          String            @id @default(uuid())
  employeeId  String
  employee    EmployeeProfile   @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  title       String
  quarter     String            // Q1, Q2, Q3, Q4
  year        Int               @default(2026)
  progress    Int               @default(0) // 0 to 100
  isCompleted Boolean           @default(false)
  category    String            @default("ENGINEERING")
}

model ApprovalItem {
  id          String            @id @default(uuid())
  type        String            // LEAVE | TIMESHEET | EXPENSE | SHIFT_CHANGE
  referenceId String            // ID of LeaveRequest or Timesheet
  title       String
  requestedBy String
  approverId  String
  approver    User              @relation("ApproverUser", fields: [approverId], references: [id])
  slaDeadline DateTime
  status      String            @default("PENDING") // PENDING | APPROVED | REJECTED | REROUTED
  remarks     String?
  rerouteTo   String?
  createdAt   DateTime          @default(now())
}

model AuditLog {
  id          String            @id @default(uuid())
  userId      String?
  user        User?             @relation(fields: [userId], references: [id])
  action      String            // e.g. "TIMESHEET_SUBMITTED", "PAYROLL_LOCKED"
  module      String
  details     Json
  ipAddress   String?
  createdAt   DateTime          @default(now())
}
```

---

## 4. Complete REST API Specification & Contracts

All endpoints live under `/api/...` and require a valid Bearer Token / Session Cookie.

### A. Authentication & Session
- `POST /api/auth/login`
  - **Body:** `{ email: string, password: string }`
  - **Response 200:** `{ user: { id, email, role, name, avatarUrl }, token: string }`
- `GET /api/me`
  - **Response 200:** Complete employee profile, department, active role, permissions.

---

### B. Shift & Attendance Operations
- `POST /api/attendance/punch`
  - **Description:** Clock in or clock out for the logged-in user.
  - **Headers:** `Authorization: Bearer <token>`
  - **Body:**
    ```json
    {
      "punchType": "IN", // "IN" | "OUT"
      "deviceType": "WEB",
      "latitude": 12.9716,
      "longitude": 77.5946
    }
    ```
  - **Response 200:**
    ```json
    {
      "success": true,
      "punch": {
        "id": "punch-uuid",
        "punchTime": "2026-09-11T09:18:24.000Z",
        "punchType": "IN",
        "todayHours": "0h 0m",
        "status": "present"
      }
    }
    ```
- `GET /api/attendance/summary`
  - **Query:** `?month=9&year=2026`
  - **Response 200:** Total days worked, shifts completed, net break hours, 8-week heatmap matrix.

---

### C. Weekly Timesheets & Project Logging
- `GET /api/timesheets/active`
  - **Description:** Fetches current sprint/week timesheet for logged-in user.
  - **Response 200:**
    ```json
    {
      "id": "ts-uuid-001",
      "weekNumber": 37,
      "startDate": "2026-09-07",
      "endDate": "2026-09-11",
      "totalHours": 40.2,
      "billableHours": 34.0,
      "status": "DRAFT", // "DRAFT" | "SUBMITTED" | "APPROVED"
      "entries": [
        {
          "id": "te-01",
          "date": "2026-09-07",
          "projectName": "Project Alpha (Core HRMS)",
          "taskDescription": "GraphQL Auth & RBAC Security Engine",
          "hours": 8.5,
          "isBillable": true
        }
      ]
    }
    ```
- `POST /api/timesheets/entries`
  - **Description:** Records a project time log (triggers when user submits the "Log Project Time" modal).
  - **Body:**
    ```json
    {
      "timesheetId": "ts-uuid-001",
      "projectId": "proj-alpha-uuid",
      "date": "2026-09-11",
      "taskDescription": "Implemented timesheet table UI & approval workflow",
      "hours": 2.5,
      "isBillable": true
    }
    ```
  - **Response 201:** Created entry and recalculated timesheet summary.
- `POST /api/timesheets/[id]/submit`
  - **Description:** Submits the timesheet to the line manager for sign-off.
  - **Response 200:**
    ```json
    {
      "success": true,
      "status": "SUBMITTED",
      "approver": { "name": "Amit Verma", "role": "TEAM_LEAD" },
      "slaDeadline": "2026-09-14T12:00:00.000Z"
    }
    ```

---

### D. Approvals, Rejections & Re-routing (Manager Cockpit S7 & S2)
- `GET /api/approvals/pending`
  - **Description:** Returns pending items for manager review.
- `POST /api/approvals/[id]/action`
  - **Description:** Executes approval, rejection (with compulsory reason), or re-routing.
  - **Body:**
    ```json
    {
      "actionType": "reroute", // "approve" | "reject" | "reroute"
      "remarks": "Project hours belong to Cloud Pod budget, re-routing to Sarah Chen",
      "rerouteTargetUserId": "user-sarah-uuid"
    }
    ```
  - **Response 200:**
    ```json
    {
      "success": true,
      "actionType": "reroute",
      "item": { "id": "app-01", "name": "Priya Nair", "type": "Timesheet" }
    }
    ```

---

### E. Payroll Ingestion & Calculation Engine (S5)
- `POST /api/payroll/cycles/generate`
  - **Role Required:** `SUPER_ADMIN`, `FINANCE_MANAGER`
  - **Body:** `{ "month": 9, "year": 2026 }`
  - **Engine Steps:**
    1. Ingests all approved timesheets and biometric attendance for 01-Sep to 30-Sep.
    2. Computes LOP days (`unpaidLeavesCount + unregularizedAbsence`).
    3. Calculates Gross Salary: `Basic + HRA + SpecialAllowance - LOP`.
    4. Computes Statutory:
       - EPF: `12% of Basic` (capped at ₹1,800 or full depending on wage ceiling).
       - ESI: `0.75% of Gross` (if Gross $\le$ ₹21,000/mo).
       - PT: `₹200`.
       - TDS: Automated slab based on Section 115BAC (New Tax Regime).
    5. Stores `Payslip` records and sets cycle status to `CALCULATED`.
- `GET /api/payroll/payslip/current`
  - **Description:** Returns the active employee's latest payslip breakdown.

---

## 5. Core Calculation Engines & Business Logic Rules

### 1. Indian Statutory Deductions (2026 Wage Code & Tax Law)
- **50% Wage Floor Rule:**
  $$\text{Basic Salary} + \text{DA} \ge 0.50 \times \text{Total Cost to Company (CTC)}$$
  If Basic is less than 50% of CTC, the excess allowance is reallocated to Basic to prevent statutory evasion.
- **EPFO Contribution:**
  $$\text{Employee PF} = 12\% \times \text{Basic}$$
  $$\text{Employer PF} = 3.67\% \text{ (EPF)} + 8.33\% \text{ (EPS)}$$
- **Loss of Pay (LOP) Formula:**
  $$\text{Daily Wage} = \frac{\text{Monthly Gross}}{\text{Days in Month}}$$
  $$\text{LOP Deduction} = \text{Unapproved Absent Days} \times \text{Daily Wage}$$

### 2. Sandwich Leave Rule
If an employee applies for Friday and Monday leave, Saturday and Sunday are automatically counted as leave days:
$$\text{Total Days Deducted} = 4 \text{ days (Fri, Sat, Sun, Mon)}$$

### 3. Approval SLA Escalation
Every approval has a `slaDeadline` set to:
$$\text{slaDeadline} = \text{CreatedAt} + 24\text{ hours}$$
If unaddressed within 24h, the item triggers an automatic warning toast and escalates to the HRBP.

---

## 6. Frontend State & API Integration Map

Backend developers should update the following frontend files to replace local in-memory states with real API calls:

| Frontend File Path | Current Mock State / Function | Target API Endpoint |
| :--- | :--- | :--- |
| `src/context/HRMSContext.js` | `punchIn()`, `punchOut()`, `attendance` | `POST /api/attendance/punch`, `GET /api/attendance/today` |
| `src/context/HRMSContext.js` | `leaves`, `applyLeave()` | `POST /api/leaves/apply`, `GET /api/leaves/balance` |
| `src/components/Dashboard/Views/EmployeeHome.js` | `dailyEntries`, `handleAddLog()` | `POST /api/timesheets/entries` |
| `src/components/Dashboard/Views/EmployeeHome.js` | `handleSubmitTimesheet()` | `POST /api/timesheets/:id/submit` |
| `src/components/Dashboard/Modals/ApprovalActionModal.js`| `handleSubmit()` | `POST /api/approvals/:id/action` |
| `src/components/Dashboard/Views/PayrollControlRoom.js`| `payrollCycles`, `handleRunPayroll()`| `POST /api/payroll/cycles/generate` |
| `src/context/AuthContext.js` | `login()`, `switchRole()` | `POST /api/auth/login`, `GET /api/me` |

---

## 7. Environment Configuration & Seed Guide

Create `.env` in the project root:

```env
# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/nucleus_hrms?schema=public"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="nucleus_super_secret_jwt_key_2026"

# Cloud Storage (AWS S3 or Cloudflare R2)
S3_BUCKET_NAME="nucleus-hrms-documents"
S3_REGION="ap-south-1"
S3_ACCESS_KEY_ID="your_access_key"
S3_SECRET_ACCESS_KEY="your_secret_key"

# AI Inference (Gemini / Claude API)
GEMINI_API_KEY="your_gemini_api_key"
```

### Initial Database Migration & Seeding Command
```bash
# 1. Install Prisma Client
npm install @prisma/client
npm install prisma --save-dev

# 2. Push schema to Database
npx prisma db push

# 3. Seed initial personas and departments
node prisma/seed.js
```

---
*Document approved for distribution to engineering and implementation teams.*
