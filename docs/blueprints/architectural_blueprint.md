# Architectural Blueprint: Vertical Slice + Clean Architecture (DDD)

This blueprint outlines the target architecture for the HRMS application, combining the high cohesion of **Vertical Slice Architecture** with the strict dependency rules of **Clean Architecture / Domain-Driven Design (DDD)**.

## Core Philosophy

Pure Vertical Slice architecture groups everything by feature, but it can lead to spaghetti code if developers mix database queries, UI logic, and business rules in the same file. To prevent this, we enforce a **stratified Clean Architecture** *inside* each vertical slice.

Every feature (e.g., Payroll, Leave, Attendance) will follow this exact ring structure:

### 1. The Core (Inner Ring)
- **What it is:** Pure TypeScript files containing the absolute laws of the HRMS domain.
- **Rules:** Zero frameworks (no Next.js, no React), zero libraries (no external dependencies), and zero database queries or side effects. 
- **Examples:** 
  - `if (hours > 40) calculateOvertime(hours, rate)`
  - Leave accrual formulas
  - Statutory compliance checks

### 2. The Application / Use Case Layer (Middle Ring)
- **What it is:** The orchestrator that fetches data, passes it to the Core, and saves the result.
- **Rules:** Can use database clients (`sqlClient`) and DTOs, but NO web-specific frameworks (no HTTP request/response objects).
- **Examples:** 
  - `processPayrollRun(runId: string)`
  - `approveLeaveRequest(requestId: string)`

### 3. The Shell (Outer Ring)
- **What it is:** The delivery mechanism and infrastructure.
- **Rules:** Next.js Server Actions, API routes, React UI components, and HTTP handlers. It handles button clicks, parses HTTP payloads, and formats the output.

---

## Directory Structure Example

Here is how the `features/` directory will look when applied to the Payroll module:

```text
src/
└── features/
    └── payroll/
        ├── core/                  # [INNER RING] Pure Domain Logic
        │   ├── overtimeCalculator.ts
        │   ├── taxDeductionRules.ts
        │   └── types.ts           # Pure TS Interfaces/Entities
        │
        ├── application/           # [MIDDLE RING] Orchestration & DB
        │   ├── payrollService.ts  # Fetches employee DB records, calls Core, saves to DB
        │   └── repository.ts      # Specific SQL queries for Payroll
        │
        └── shell/                 # [OUTER RING] Delivery & UI
            ├── actions.ts         # Next.js Server Actions (e.g., "submitPayrollRun")
            ├── api/               # API Routes (/api/v1/payroll/...)
            └── components/        # React UI (Payroll Dashboard, Payslip Modals)
```

## Migration Strategy (Deprecating `src/services`)

To incrementally achieve this architecture and safely delete the legacy `src/services/` directory:

1. **Pick a Slice:** Select one module (e.g., Leave Management).
2. **Extract the Core:** Move the pure logic (currently tangled inside `src/services/leaveEngine.js`) into `src/features/leave/core/`.
3. **Build the Application Layer:** Create the database integration in `src/features/leave/application/` to replace the mock JSON reads.
4. **Wire the Shell:** Update the Next.js routes and React components to point to the new Application layer.
5. **Delete Legacy:** Once all components for that slice are migrated, delete the corresponding legacy service file.
6. **Repeat:** Move to the next slice until `src/services/` is completely empty and removed.
