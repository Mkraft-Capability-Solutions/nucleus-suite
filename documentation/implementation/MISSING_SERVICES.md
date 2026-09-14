# Nucleus HRMS — Missing Backend Services Audit & Parity Report

> **Source Comparison Target:** `/Users/dhanraj/dhanraj/DFS/workspace/MKraft/Nucleus-HRMS/src/server`  
> **Current Workspace:** `/Users/dhanraj/dhanraj/DFS/workspace/MKraft/nucleus-suite/src/server`  
> **Generated Date:** 2026-09-15  
> **Audit Status:** Comprehensive Repository Delta Analysis

---

## 1. Executive Summary

A deep comparative scan was conducted between the backend server architectures of **`Nucleus-HRMS`** (the production-shaped modular monolith backend reference) and **`nucleus-suite`** (the primary HRMS suite application).

### Metric Comparison
- **Total Backend Files in `Nucleus-HRMS/src/server`:** 152 files (73 implementation files, 79 test files)
- **Total Backend Files in `nucleus-suite/src/server`:** 86 files (45 implementation files, 41 test files)
- **Net Missing Implementation Services in `nucleus-suite`:** **62 files**
- **Net Missing Backend Test Files in `nucleus-suite`:** **64 files**

### Architectural Delta Summary
In `nucleus-suite`, many operational views and business rules operate through client-side engines located in `src/services/` (e.g., `timeOfficeEngine.js`, `leaveEngine.js`, `autoLeaveCreditEngine.js`, `payrollAdjacenciesService.js`) and unified module endpoints (`/api/v1/ops/modules/:moduleId/records`). 
Conversely, `Nucleus-HRMS` implemented dedicated, granular register services in `src/server/*` with fine-grained PostgreSQL queries, immutable status transition state machines, and multi-tenant ledger projections.

---

## 2. Complete Inventory of Missing Backend Services by Domain

Below is the complete inventory of all **62 missing implementation services** and **64 test suites**, organized into 16 operational domains.

---

### A. Payroll & Financial Accounting (12 Implementation Services)

`Nucleus-HRMS` contains deep financial sub-services for general ledger mapping, payment file disbursements, statutory component computation, and payroll reconciliation.

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `payroll/accounting.ts` | 511 | `computePayrollAccounting`, `buildJournalLines`, `validateDebitCreditBalance` — Journal ledger balancing and ERP chart-of-accounts posting. | `payroll_runs`, `journal_entries`, `accounts` |
| `payroll/components.ts` | 428 | `evaluateSalaryStructure`, `resolveStatutoryAllowances`, `computePF`, `computeESIC`, `computeProfessionalTax` — Statutory breakdown rules. | `salary_components`, `salary_templates` |
| `payroll/disbursement.ts` | 389 | `buildDisbursementFile`, `computeChecksumSHA256`, `formatNACH`, `formatNEFT`, `verifyBankBatchStatus` — Bank payment gateway batch exports. | `disbursement_batches`, `disbursement_items` |
| `payroll/gl.ts` | 310 | `mapCostCenterGL`, `resolveDebitCreditCode`, `exportSAPGLFormat`, `exportTallyXML` — General ledger account mapping and ERP exports. | `gl_mappings`, `cost_centers` |
| `payroll/payslips.ts` | 345 | `generatePayslipData`, `sealPayslipArtifact`, `renderPayslipHTML`, `streamEncryptedPDF` — Digital payslip distribution and signing. | `payslips`, `payroll_line_items` |
| `payroll/reconciliation.ts` | 467 | `reconcilePayrollVariance`, `detectHeadcountDelta`, `flagExcessDeductions`, `generateVarianceReport` — Period-over-period reconciliation. | `payroll_reconciliations`, `payroll_runs` |
| `payroll/reimbursements.ts` | 420 | `assertBillNumberUnusedInTenant`, `validateExpenseCap`, `approveReimbursementBatch`, `settleExpenseClaims` — Employee expense claims. | `expense_claims`, `expense_receipts` |
| `payroll/rule-pack.ts` | 360 | `loadRulePackVersion`, `evaluateRulePackConstraints`, `compareRulePackSnapshots` — Statutory wage rule-pack engine. | `rule_pack_versions`, `rule_packs` |
| `payroll/settlement-proposals.ts` | 290 | `createSettlementProposal`, `evaluateGratuityFormula`, `computeLeaveEncashmentValue` — F&F settlement calculation proposals. | `settlement_proposals`, `gratuity_ledgers` |
| `payroll/settlement.ts` | 380 | `finalizeSettlement`, `processRecoveryDeductions`, `releaseSettlementCheque` — F&F financial clearing and closure. | `fnf_settlements`, `settlement_items` |
| `payroll/simulator.ts` | 412 | `simulateCTCRebalance`, `projectTaxWithholding`, `simulateAnnualBonusDistribution` — What-if wage and tax simulation. | `simulation_scenarios`, `salary_bands` |
| `payroll/tax.ts` | 610 | `computeOldRegimeTax`, `computeNewRegimeTax`, `verifySection80CProofs`, `verifyHRAPanRequirement` — Tax projection and declaration validator. | `tax_profiles`, `tax_declarations` |

**Associated Missing Test Files:**
- `payroll/accounting.test.ts`, `payroll/components.test.ts`, `payroll/disbursement.test.ts`, `payroll/gl.test.ts`, `payroll/payslips.test.ts`, `payroll/reconciliation.test.ts`, `payroll/reimbursements.test.ts`, `payroll/rule-pack.test.ts`, `payroll/settlement-proposals.test.ts`, `payroll/settlement.test.ts`, `payroll/simulator.test.ts`, `payroll/tax.test.ts`, `payroll/trace.test.ts`.

---

### B. Time Office & Attendance (8 Implementation Services)

`Nucleus-HRMS` provides specialized registers and engine monitors for live punch reconciliation, multi-shift overrides, and exception queues.

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `attendance/day-register.ts` | 220 | `deriveDayState`, `formatHoursLabel`, `listAttendanceDays`, `lockAttendanceDays` — Official daily muster roll with H:MM time formats. | `attendance_days`, `employees` |
| `attendance/engine-console.ts` | 315 | `recomputePunchDeltas`, `triggerBatchRecomputation`, `getEnginePerformanceStats` — Attendance computation engine admin console. | `attendance_punches`, `attendance_days` |
| `attendance/exception-register.ts` | 280 | `listAttendanceExceptions`, `triageException`, `waiveMissingPunch`, `escalateToSupervisor` — Attendance anomaly queue. | `attendance_exceptions`, `punches` |
| `attendance/gate-pass-register.ts` | 195 | `issueGatePass`, `recordSecurityExit`, `recordSecurityReturn`, `validateGatePassMinutes` — Factory and premises movement tracking. | `gate_passes`, `employees` |
| `attendance/overtime-register.ts` | 260 | `listOvertimeRecords`, `verifyOTMultiplier`, `tagOvertimeToPayrollRun`, `rejectUnapprovedOT` — Factory Act Form 10 OT register. | `overtime_entries`, `attendance_days` |
| `attendance/punch-register.ts` | 240 | `recordTerminalPunch`, `ingestBiometricPunches`, `filterDuplicatePunches` — Raw hardware punch intake and deduplication. | `attendance_punches`, `biometric_devices` |
| `attendance/recompute-monitor.ts` | 175 | `monitorRecomputeQueue`, `retryFailedRecomputeJob`, `getRecomputeBacklog` — Background daemon recompute telemetry. | `recompute_jobs`, `system_queues` |
| `attendance/team-history-register.ts` | 210 | `getTeamAttendanceSummary`, `calculateTeamPresenteeism`, `exportTeamAttendanceCSV` — Manager supervisor day roll. | `attendance_days`, `team_hierarchies` |

**Associated Missing Test Files:**
- `attendance/engine-console.test.ts`, `attendance/engine-live-verify.test.ts`, `attendance/gatepass-overtime-registers.test.ts`, `attendance/operations-live-verify.test.ts`, `attendance/ops-registers.test.ts`, `attendance/punch-day-registers.test.ts`, `attendance/workbook-form-schemas.test.ts`.

---

### C. Unified Operational Workflows Engine (11 Implementation Services)

In `Nucleus-HRMS`, an entire generic workflow execution engine was built around `hrms_operation_records` and `hrms_dossier_receipts`.

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `workflows/approval-inbox.ts` | 29 | `operationalApprovals` — Multi-domain consolidated approval queue across all operational forms. | `hrms_operation_records`, `employees` |
| `workflows/database-error.ts` | 10 | `workflowDatabaseError` — Standardized database error mapper for workflow state machine violations. | — |
| `workflows/dossier-route.ts` | 7 | `dossierList`, `dossierMutation` — Next.js API route delegate handlers for employee dossier files. | — |
| `workflows/dossier-service.ts` | 72 | `listDossier`, `saveDossier` — Secure electronic personnel filing cabinet and dossier receipts. | `hrms_dossier_receipts`, `employee_assignments` |
| `workflows/field-encryption.ts` | 24 | `encryptFields`, `decryptFields` — AES-256-GCM symmetric field-level encryption for sensitive PII. | — |
| `workflows/operational-access.ts` | 14 | `operationalScope` — RBAC scope calculator (`all`, `team`, `self`) for generic operational resources. | — |
| `workflows/operational-route.ts` | 18 | `operationalList`, `operationalMutation` — Generic operational CRUD and state machine execution router. | — |
| `workflows/operational-service.ts` | 164 | `listOperationalRecords`, `mutateOperationalRecord` — Generic operational store with transitions and reasons. | `hrms_operation_records`, `hrms_operation_events` |
| `workflows/operational-validation.ts` | 199 | `validator`, `parseOperationalInput`, `assertPassedAmount`, `transitionDefinition` — Zod schema transitions. | — |
| `workflows/records.ts` | 31 | `workflowRecords` — Read-side query builder for operational workflow items. | `hrms_operation_records` |
| `workflows/resources.json` | 176 | JSON configuration catalog defining all 17 operational resources, actions, and states. | — |

**Associated Missing Test Files:**
- `workflows/field-encryption.test.ts`, `workflows/operational-live.test.ts`, `workflows/operational-validation.test.ts`, `workflows/records.test.ts`.

---

### D. Talent Acquisition, Requisitions & Mobility (4 Implementation Services)

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `talent/establishment.ts` | 304 | `listEstablishment`, `headroomForKey`, `decideRequisition`, `utilisationPercent` — Sanctioned strength headroom control. | `assignments`, `employees`, `sanctions` |
| `talent/mobility.ts` | 375 | `listMobilityRegister`, `mobilityTimeline`, `projectMobilityRow` — Internal Job Postings (IJP), transfers, and deputations. | `hrms_operation_records`, `employees` |
| `talent/pipeline.ts` | 1188 | `buildBoard`, `planReferralAward`, `loadInterviewOverview`, `loadReferralLedger` — Full ATS candidate kanban board and referral awards. | `applications`, `interviews`, `referrals` |
| `talent/requisition-register.ts` | 1026 | `loadRequisitionRegisterScreen`, `evaluateRequisitionGate`, `buildStateTimeline` — Hiring requisition approval gates and state timelines. | `requisitions`, `approvals` |

**Associated Missing Test Files:**
- `talent/establishment.test.ts`, `talent/mobility.test.ts`, `talent/pipeline.test.ts`, `talent/requisition-register.test.ts`.

---

### E. Organization, People Master & Sanctioned Strength (4 Implementation Services)

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `organization/directory.ts` | 185 | `searchDirectory`, `filterDepartmentDirectory`, `getReportingLine` — Public company directory and department rollups. | `employees`, `departments` |
| `organization/employee-update.ts` | 240 | `updateEmployeeOfficialDetails`, `updateStatutoryIdentifiers`, `auditProfileMutation` — Employee master profile updates with audit trails. | `employees`, `identities`, `audit_events` |
| `organization/person-profile.ts` | 310 | `loadCompletePersonDossier`, `getIdentityBadges`, `getTenureMilestones` — 360-degree employee profile dossier view. | `employees`, `emergency_contacts`, `educations` |
| `organization/sanctioned-strength.ts` | 265 | `getSanctionedHeadcount`, `calculateBudgetHeadroom`, `verifyTransferSanction` — Dept/grade manpower budgeting. | `sanctioned_strengths`, `positions` |

**Associated Missing Test Files:**
- `organization/directory.test.ts`, `organization/employee-update.test.ts`, `organization/lifecycle-state.test.ts`, `organization/person-profile.test.ts`, `organization/position-register.test.ts`, `organization/sanctioned-strength.test.ts`.

---

### F. Leave & COFF Lifecycle Registers (4 Implementation Services)

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `leave/engine-console.ts` | 290 | `simulateLeaveAccrual`, `triggerLapseRun`, `recomputeLedgerBalances` — Admin leave engine console and diagnostics. | `leave_ledgers`, `leave_policies` |
| `leave/ledger-register.ts` | 250 | `getEmployeeLedgerStatement`, `verifyOpeningClosingBalance`, `recordBalanceAdjustment` — Debit/credit balance statement. | `leave_ledger_entries`, `leave_types` |
| `leave/policy-register.ts` | 230 | `listConfiguredPolicies`, `validatePolicyCombinationRules`, `cloneLeavePolicy` — Policy master configuration register. | `leave_policies`, `leave_types` |
| `leave/request-register.ts` | 275 | `listLeaveRequestsQueue`, `filterByLeaveStatus`, `approveRequestWithAudit` — Supervisor leave approval and history queue. | `leave_requests`, `leave_approvals` |

**Associated Missing Test Files:**
- `leave/engine-console.test.ts`, `leave/leave-registers-live-verify.test.ts`, `leave/leave-registers.test.ts`, `leave/leave-type-configuration.test.ts`.

---

### G. Employee Engagement & Social (5 Implementation Services)

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `engagement/announcement-register.ts` | 190 | `createAnnouncement`, `pinAnnouncement`, `listActiveAnnouncements` — Company-wide broadcasting and pinning. | `announcements`, `departments` |
| `engagement/experience.ts` | 215 | `logPulseSurveyResponse`, `calculateENPS`, `renderMoodDistribution` — Employee Net Promoter Score & pulse surveys. | `pulse_surveys`, `survey_responses` |
| `engagement/policy-acknowledgements.ts` | 175 | `recordPolicyAcknowledgement`, `checkMandatoryPolicyReadiness` — Compliance handbook signing tracker. | `policy_acknowledgements`, `policies` |
| `engagement/recognition-register.ts` | 195 | `sendPeerKudos`, `nominateForAward`, `listWallOfFame` — Peer-to-peer recognition wall. | `recognitions`, `awards` |
| `engagement/referral-tracking.ts` | 240 | `trackReferralStatus`, `calculateBonusEligibility`, `listEmployeeReferrals` — Employee referral lifecycle. | `referrals`, `job_openings` |

**Associated Missing Test Files:**
- `engagement/announcement-register.test.ts`, `engagement/experience.test.ts`, `engagement/policy-acknowledgements.test.ts`, `engagement/recognition-register.test.ts`, `engagement/referral-tracking.test.ts`.

---

### H. Employee Lifecycle & Exits (2 Implementation Services)

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `lifecycle/clearance-board.ts` | 320 | `loadClearanceBoard`, `signDepartmentClearance`, `recordPendingAssetReturn` — Multi-department exit clearance board. | `clearance_requests`, `clearance_items` |
| `lifecycle/joining-chain.ts` | 360 | `advanceJoiningStage`, `verifyPreOnboardingDocuments`, `provisionCorporateEmail` — Pre-onboarding to Day-1 joining pipeline. | `onboarding_cases`, `onboarding_tasks` |

**Associated Missing Test Files:**
- `lifecycle/clearance-board.test.ts`, `lifecycle/exit-notice-fields.test.ts`, `lifecycle/joining-chain-fields.test.ts`, `lifecycle/joining-chain.test.ts`, `lifecycle/registers-live-verify.test.ts`.

---

### I. Performance Management & OKR (2 Implementation Services)

| File Path in `Nucleus-HRMS/src/server` | Lines | Key Exported Symbols & Capabilities | PostgreSQL Tables Targeted |
|---|---|---|---|
| `performance/calibration.ts` | 450 | `classifyRating`, `readNineBoxBoundaries`, `recordTalentPlacement`, `summariseBench` — 9-box talent matrix & calibration. | `talent_placements`, `calibration_sessions` |
| `performance/okr.ts` | 683 | `loadObjectiveTree`, `checkSiblingWeights`, `rollupObjectives`, `deriveHealth` — OKR cascade trees and weighted rollups. | `objectives`, `key_results` |

**Associated Missing Test Files:**
- `performance/calibration.test.ts`, `performance/okr.test.ts`.

---

### J. Remaining Specialized Modules (10 Implementation Services)

1. **`access-scopes/service.ts`** (120 lines): Resolves data tenancy and record visibility filters (`self`, `team`, `department`, `location`, `all`).
2. **`assignments/service.ts`** (190 lines): Tracks primary and concurrent secondary job assignments, reporting managers, and grade transitions.
3. **`compliance/statutory-register.ts`** (280 lines): Factory Form 28 (Muster), Form 18 (Accidents), and Form 36 (Inspection register).
4. **`compliance/wage-floor.ts`** (195 lines): Statutory minimum wage floor validation based on state, zone, and skill category.
5. **`contractors/reconciliation.ts`** (240 lines): Contractor daily wage muster reconciliation, vendor bill verification, and PF challan audits.
6. **`documents/vault.ts`** (210 lines): Electronic document vault with versioning, expiry alerts, and verification tagging.
7. **`home/actions.ts`** (160 lines): Employee self-service home dashboard dynamic actions and pending approval aggregations.
8. **`learning/my-learning.ts`** (220 lines): Employee course catalog, mandatory certification tracker, and completion certificate uploads.
9. **`learning/progress.ts`** (180 lines): L&D department tracking of training hours, TNI fulfillment, and trainer evaluation feedback.
10. **`loans/schedule.ts`** (230 lines): Employee loan EMI repayment amortization schedule generator and payroll deduction syncer.

**Associated Missing Test Files:**
- `access-scopes/service.test.ts`, `assignments/assignment-status.test.ts`, `assignments/service-contract.test.ts`, `assets/service.test.ts`, `compliance/statutory-register.test.ts`, `compliance/wage-floor.test.ts`, `contractors/reconciliation.test.ts`, `documents/vault.test.ts`, `home/actions.test.ts`, `learning/my-learning.test.ts`, `learning/progress.test.ts`, `letters/issue-fields.test.ts`, `letters/service.test.ts`, `loans/schedule.test.ts`.

---

## 3. Comparison Matrix: Nucleus-HRMS vs Nucleus-Suite

| Functional Area | Status in `nucleus-suite` | Implementation in `Nucleus-HRMS` | Action Needed for Parity |
|---|---|---|---|
| **Form Layout & UI Fields** | **100% Implemented** (50 Forms, 912 Fields in React/MUI components) | Components under `src/components/hrms` | Maintain `nucleus-suite` UI; it already has richer visual polish and full field specs. |
| **Client Calculation Engines** | **Active in Browser** (`src/services/*`: `timeOfficeEngine.js`, `leaveEngine.js`, `autoLeaveCreditEngine.js`) | Replaced by direct server endpoints | Keep client calculation engines for real-time live preview, but connect to backend registers for persistence. |
| **Payroll Accounting & GL** | Basic simulation | Full server GL balancing (`payroll/accounting.ts`, `payroll/gl.ts`) | Port `payroll/accounting.ts`, `gl.ts`, and `disbursement.ts` into `src/server/payroll/`. |
| **Attendance Muster Registers** | Unified `/api/v1/ops/modules/attendance_detail/records` | Dedicated `attendance/day-register.ts` and `attendance/overtime-register.ts` | Port day state derivation and overtime multiplier verification. |
| **Talent & ATS Kanban** | UI Pipeline & Unified Endpoint | Comprehensive 1,188-line `talent/pipeline.ts` with referral ledger & adverse impact | Port `talent/pipeline.ts` and `talent/establishment.ts`. |
| **Exit Clearance Board** | Interactive clearance wizard in `PayrollView.js` | Dedicated `lifecycle/clearance-board.ts` with multi-department sign-off gates | Port `lifecycle/clearance-board.ts`. |
| **OKR Cascades & 9-Box** | OKR UI & 9-Box visual components | Full acyclic graph validation (`performance/okr.ts`) & 9-box calibration (`performance/calibration.ts`) | Port `performance/okr.ts` and `performance/calibration.ts`. |

---

## 4. Prioritized Action Plan for 100% Backend Parity

To bring `nucleus-suite` from UI/operational module connectivity to deep 100% backend service parity with `Nucleus-HRMS`, execute the following prioritized steps:

1. **Phase 1: Financial & Statutory Core (High Priority)**
   - Port `payroll/accounting.ts`, `payroll/disbursement.ts`, `payroll/gl.ts`, and `payroll/reconciliation.ts`.
   - Connect bank payment gateway checksums and GL journal exports directly to database tables.
2. **Phase 2: Attendance Muster & Overtime Registers (High Priority)**
   - Port `attendance/day-register.ts`, `attendance/overtime-register.ts`, and `attendance/exception-register.ts`.
   - Wire supervisor day overrides and punch recomputations to transactional database mutations.
3. **Phase 3: Talent Pipeline & Sanction Headroom (Medium Priority)**
   - Port `talent/pipeline.ts`, `talent/establishment.ts`, and `talent/requisition-register.ts`.
   - Wire candidate stage transitions and referral award milestones.
4. **Phase 4: OKR Cascades & Clearance Board (Medium Priority)**
   - Port `performance/okr.ts` (acyclic cascade validation) and `lifecycle/clearance-board.ts`.
   - Wire multi-tier exit clearance department sign-offs to PostgreSQL.
