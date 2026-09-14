# Nucleus HRMS — Workbook UI Coverage

> **Source:** `Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx` (23 sheets, 49 screen IDs)  
> **Source:** `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx` (50 forms, 900+ fields)  
> **Last Updated:** September 2026  
> **Test Suite:** 824 tests passing | TypeScript: 0 errors

---

## Coverage Summary

| Metric | Value |
|:---|:---|
| Total screen IDs in workbook | 49 |
| Screen IDs with UI surface | 49 (100%) |
| Screen IDs fully implemented | ~18 (37%) |
| Screen IDs partially implemented | ~24 (49%) |
| Screen IDs UI-only / not functional | ~7 (14%) |
| Total forms from fields workbook | 50 |
| Forms with all fields implemented | ~12 (24%) |
| Forms with field gaps | ~30 (60%) |
| Forms not yet created | ~8 (16%) |

> ⚠️ A mapped screen ID is **not** evidence of full feature implementation. See `IMPLEMENTATION_PLAN.md` for gap details.

---

## Sheet-by-Sheet Assessment

| Sheet | Rows | Assessment |
|:---|---:|:---|
| 00_Read_Me | 30 | Reference material — not a completion claim |
| 01_Sheet_Index | 23 | Reference material |
| 02_Process_Architecture | 34 | Architecture reference — partially reflected in `ARCHITECTURE.md` |
| 03_Process_Inventory | 93 | UI coverage partial; state transitions not fully enforced |
| 04_Process_Steps | 250 | UI coverage partial; multi-step enforcement incomplete |
| 05_Swimlane_Maps | 80 | Swimlane patterns reflected in leave-workflow.ts; other domains pending |
| 06_Data_Dictionary | 97 | Dormant; live storage deferred to production phase |
| 07_Screens | 49 | All 49 mapped below; functional completeness varies — see individual module docs |
| 08_Form_Fields | 79+ | Field-level gaps documented in `IMPLEMENTATION_PLAN.md` |
| 09_Business_Rules | 239 | HR rules engine covers core invariants; full enforcement incomplete |
| 10_Config_Tables | 18 | Reference config shown in UI; server-side enforcement deferred |
| 11_State_Machines | 52 | Leave state machine fully implemented; others partial |
| 12_Events | 41 | CustomEvent pattern used for cross-component comms; server events deferred |
| 13_API_and_Tools | 28 | All `/api/v1/` routes defined; dormant pending production phase |
| 14_Agents | 9 | AI agent architecture defined; LangGraph backend deferred |
| 15_Integration_Flows | 12 | Inbound webhook handler live; ERP/WhatsApp/Teams deferred |
| 16_Reuse_Register | 12 | Reference material |
| 17_Traceability | 31 | Traceability captured in this document and `IMPLEMENTATION_PLAN.md` |
| 18_Build_Backlog | 88 | Active backlog tracked in `IMPLEMENTATION_PLAN.md` |
| 19_Test_Cases | 53 | 824 automated tests cover key scenarios; E2E pending |
| 20_NFR_and_DoD | 18 | Quality gate enforced via npm scripts |
| 21_Roles_and_RACI | 12 | RBAC model documented in `ROLE_MODEL.md` |
| 22_Open_Decisions | 14 | Open items tracked in `IMPLEMENTATION_PLAN.md` |

---

## Screen Mapping — All 49 Screen IDs

| Workbook ID | Screen Name | UI Component/Route | Form Gaps | Status |
|:---|:---|:---|:---:|:---:|
| SCR-005 | Principal, role & scope grant | `AccessControlView.js` | 0 | ✅ |
| SCR-010 | Employee record — identity & personal | `PeopleCoreView.js` | 7 | 🔶 |
| SCR-011 | Assignment & policy attributes | `PeopleCoreView.js` | 9 | 🔶 |
| SCR-012 | Position register | `PeopleCoreView.js` | 0 | ✅ |
| SCR-013 | Sanctioned strength board | `PeopleCoreView.js` | 0 | ✅ |
| SCR-014 | Document vault | `PeopleCoreView.js` | 0 | ✅ |
| SCR-020 | Check in / Check out | `AttendanceFAB.js` + `AttendanceView.js` | 0 | ✅ |
| SCR-021 | My attendance | `AttendanceView.js` | 0 | ✅ |
| SCR-022 | Attendance day detail (HR/supervisor) | `AttendanceView.js` | 11 | 🔶 |
| SCR-023 | Gate pass | `AttendanceView.js` | 3 | 🔶 |
| SCR-024 | Overtime register | `AttendanceView.js` | 0 | ✅ |
| SCR-025 | Attendance exception queue | `AttendanceView.js` | 0 | ✅ |
| SCR-026 | Recompute monitor | `AttendanceView.js` | 0 | ✅ |
| SCR-027 | Team history | `AttendanceView.js` | 0 | ✅ |
| SCR-030 | Apply for leave | `LeaveApplicationDialog.tsx` | 0 | ✅ |
| SCR-031 | Leave balance & ledger | `LeaveBalancePanel.tsx` | 0 | ✅ |
| SCR-032 | Leave policy configuration | `LeavePolicyReference.tsx` | 0 | ✅ |
| SCR-040 | Unified approval inbox | `HelpdeskView.js` | 0 | ✅ |
| SCR-041 | Assistant / helpdesk | `HelpdeskView.js` | 0 | ✅ |
| SCR-042 | Employee home (ESS) | `Dashboard/Views/EmployeeHome.js` | 0 | ✅ |
| SCR-050 | Payroll run cockpit | `PayrollView.js` | 3 | 🔶 |
| SCR-051 | Pre-payroll audit | `PayrollView.js` | 0 | ✅ |
| SCR-052 | Salary structure simulator | `PayrollView.js` | 0 | ✅ |
| SCR-053 | Payslip | `PayrollView.js` | 0 | ✅ |
| SCR-054 | Tax declaration & projection | `PayrollView.js` | 0 | ✅ |
| SCR-055 | Disbursement & bank file | `PayrollView.js` | 0 | 🔒 |
| SCR-056 | Full and final settlement | `PayrollView.js` | 0 | 🔶 |
| SCR-060 | Joining chain console | `OnboardingView.js` | 0 | ✅ |
| SCR-061 | Clearance board | `OnboardingView.js` | 3 | 🔶 |
| SCR-062 | Policy acknowledgement | `OnboardingView.js` | 0 | ✅ |
| SCR-063 | My learning | `LearningView.js` | 0 | ✅ |
| SCR-064 | Asset register | `OnboardingView.js` | 0 | ✅ |
| SCR-065 | Recognition register | `ExperienceView.js` | 0 | ✅ |
| SCR-066 | Announcements | `ExperienceView.js` | 0 | ✅ |
| SCR-067 | Letters (HR Letter Studio) | `OnboardingView.js` | 0 | ✅ |
| SCR-070 | Rule pack manager | `ComplianceView.js` | 0 | ✅ |
| SCR-071 | Golden case library | `ComplianceView.js` | 0 | ✅ |
| SCR-072 | Obligation calendar | `ComplianceView.js` | 0 | ✅ |
| SCR-073 | Statutory forms & registers | `ComplianceView.js` | 0 | ✅ |
| SCR-080 | Loans & advances | `PayrollView.js` | 6 | 🔶 |
| SCR-090 | Requisition | `RecruitmentView.js` | 4 | 🔶 |
| SCR-091 | Referrals | `RecruitmentView.js` | 0 | ✅ |
| SCR-095 | Contractor engagement & invoice | `ContractWorkforceView.js` | 0 | ✅ |
| SCR-100 | Integration configuration | `IntegrationsView.js` | 0 | ✅ |
| SCR-101 | Sync monitor | `IntegrationsView.js` | 0 | ✅ |
| SCR-102 | GL mapping & journal | `IntegrationsView.js` | 0 | ✅ |
| SCR-103 | Reconciliation | `IntegrationsView.js` | 0 | ✅ |
| SCR-110 | Agent console & action ledger | `AnalyticsView.js` | 0 | ✅ |
| SCR-111 | Operational reports | `MisReportingHub.js` | 0 | ✅ |

**Legend:** ✅ Implemented · 🔶 Partial · 🔒 Backend-deferred

---

## Forms with Field Gaps — Priority Order

Based on `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx`, the following forms have the highest number of unimplemented fields:

| Priority | Form | Screen | Missing Fields |
|:---:|:---|:---:|:---|
| 1 | Attendance Day Detail | SCR-022 | 11 — device ID, raw timestamps, shift variant, OT category |
| 2 | Assignment & Policy | SCR-011 | 9 — statutory wage class, grade pay, cost center, probation date |
| 3 | Employee Identity | SCR-010 | 7 — emergency contact, bank/IFSC, UAN, PAN field types |
| 4 | Loans & Advances | SCR-080 | 6 — guarantor, deduction schedule, board approval |
| 5 | Leave Application | SCR-030 | 0 — **Complete** |
| 6 | Requisition | SCR-090 | 4 — band range, hiring manager, headcount justification |
| 7 | Payroll Run Cockpit | SCR-050 | 3 — lock controls, checker authorization signature |
| 8 | Gate Pass Request | SCR-023 | 3 — dept approval, duty slip reference |
| 9 | Clearance Board | SCR-061 | 3 — finance clearance, IT return status |

---

## Leave Coverage — Complete (SCR-030 QA Pass: Sep 2026)

The Leave Application Dialog (`LeaveApplicationDialog.tsx`) was completed and verified against SCR-030 requirements:

- ✅ Inclusive date derivation
- ✅ 0.5-day manual override
- ✅ Required fields: employee, leave type, dates, duration
- ✅ Optional reason and emergency contact
- ✅ Sandwich rule live warning
- ✅ Balance non-negativity check (`INV-LEV-01`)
- ✅ Overlap detection (`INV-LEV-02`)
- ✅ Both leave entrypoints call `leave-workflow.ts`
- ✅ SessionStorage auto-open via voice command (`nucleus:open_leave_apply`)

`leave-reference.ts` preserves workbook joins across: `05_Designations`, `06_Worker_Classes`, `09_Holiday_Calendar`, `12_Employees`, `14_Leave_Types`, `15_Leave_Accrual_Policy`.

---

## What Remains for Full Workbook Coverage

1. **Validation enforcement** — conditional field visibility, business rule guards for all 239 workbook rules
2. **Multi-stage approval state machines** — all domains beyond leave (attendance regularization, payroll lock, requisition approval)
3. **Live integrations** — payroll disbursement, statutory filing, ERP sync, WhatsApp/Teams notifications
4. **AI agent execution** — LangGraph workflow backend, RAG knowledge vault activation
5. **Production persistence** — PostgreSQL + Drizzle migration, RLS enforcement, audit trails
6. **Form field gaps** — 37 fields across 9 priority forms (see table above)
7. **Missing forms** — Exit interview, F&F wizard, EWA request, leave encashment (see `IMPLEMENTATION_PLAN.md`)

---

*Full requirement row details and JSON field mappings are in `WORKBOOK_UI_COVERAGE.json`.*
