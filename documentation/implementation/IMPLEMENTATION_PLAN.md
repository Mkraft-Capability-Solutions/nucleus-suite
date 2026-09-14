# Nucleus HRMS — Master Implementation Plan

> **Source Authority:** `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx` · `Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx`  
> **Repository:** `MKraft/nucleus-suite`  
> **Phase:** LOCAL JSON UI VALIDATION — Production backend deferred  
> **Last Updated:** September 2026  
> **Test Coverage:** 824 tests passing (74 test files)

---

## Status Legend

| Symbol | Meaning |
|:---:|:---|
| ✅ | Implemented & tested |
| 🔶 | Partially implemented (UI exists, logic/validation incomplete) |
| ❌ | Missing — not yet implemented |
| 🔒 | Backend-only — deferred to production phase |
| 🧪 | Test cases defined but backend deferred |

---

## 1. Application Shell & Global Infrastructure

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| TopNav — Logo, Console Switcher (S1-S10) | ✅ | Complete |
| TopNav — Global Search (⌘K) | 🔶 | UI exists; real-time auto-suggest across employees, modules, policies not wired |
| TopNav — Mic / Nucleus Voice Assist | ✅ | Complete — synchronous greeting, 1s pause execution |
| TopNav — Nucleus Assistant (14 preloaded actions) | ✅ | Complete — all 14 action chips |
| TopNav — Notifications Bell with live badge | 🔶 | Static demo data; real-time push notification via WebSocket deferred |
| TopNav — Quick Action Launcher (+) | ✅ | Complete |
| TopNav — Language Selector (11 languages) | ✅ | Complete |
| TopNav — Appearance Toggle (4 themes) | ✅ | Complete |
| LeftDock — Feature Catalog button, Pinned icons | ✅ | Complete |
| DualPaneNav — Full-screen module catalog | ✅ | Complete |
| AttendanceFAB — Floating punch pill | ✅ | Complete |
| Toast Notifications (success/info/warning/error) | ✅ | Complete |
| WorkflowBuilderModal — Node-based canvas | 🔶 | Basic UI rendered; dynamic logic deferred |
| DataImportModal — 4-step CSV/Excel wizard | ✅ | Complete |
| CMSModal — Content management modal | 🔶 | UI exists; CMS backend deferred |
| Breadcrumb navigation — dynamic per active tab | 🔶 | Some views hardcode labels; needs audit |
| Global keyboard shortcuts (⌘K, ⌘M, ESC) | 🔶 | ⌘K opens search, ⌘M opens catalog; ESC needs all-modal audit |
| Responsive layout (mobile/tablet/desktop/4K) | 🔶 | Desktop primary; mobile left-dock collapses but full audit pending |

---

## 2. Module 1 — People Core & Org Directory

**Component:** `src/components/Clerio/PeopleCoreView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Employee Directory — filterable table | ✅ | Complete |
| Employee Directory — avatar, code, band, manager, status | ✅ | Complete |
| Employee Directory — CSV export | 🔶 | Button exists; file generation deferred |
| Employee record — identity & personal (SCR-010) | 🔶 | 7 form label gaps vs workbook spec |
| Assignment & policy attributes (SCR-011) | 🔶 | 9 form label gaps vs workbook spec |
| Position register (SCR-012) | ✅ | Mapped to `position_register` |
| Sanctioned strength board (SCR-013) | ✅ | Mapped to `sanctioned_strength` |
| Document vault — KYC/Aadhaar/Passport (SCR-014) | ✅ | Mapped to `document_vault`; OCR pipeline deferred |
| Reassign Reporting Manager modal | ✅ | Complete |
| Immutable Audit Log — every change with actor/timestamp | 🔶 | UI exists; server-side immutable ledger deferred |
| Band architecture (L1–L6), salary bands | 🔶 | Reference data shown; mutation and approval deferred |
| Bulk Employee Import (CSV/Excel) | ✅ | DataImportModal complete |
| Employee Creation Wizard | ✅ | `EmployeeCreationWizard.js` complete |
| Employee self-service profile edit | 🔶 | ESS form exists; change approval workflow incomplete |
| Org chart / hierarchical tree view | 🔶 | Pod directory exists; interactive org chart not rendered |
| Position Strength Headcount vs Filled | 🔶 | Strength board partially complete; forecasting not wired |

**Missing from Workbook (Nucleus_Forms_and_Fields):**
- ❌ Emergency contact information sub-form (Workbook: SCR-010 field rows 45–52)
- ❌ Bank account details form with IFSC validation (SCR-010 rows 53–60)
- ❌ Probation period tracking widget (SCR-011)
- ❌ Statutory wage classification (code on wages category) picker (SCR-011)
- ❌ Worker class selector (Daily Wage / Monthly Rated / Piece Rate) — leave eligibility depends on this

---

## 3. Module 2 — Attendance, Shifts & Time Office

**Component:** `src/components/Clerio/AttendanceView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Check in / Check out (SCR-020) | ✅ | Complete via FAB and Attendance view |
| My Attendance monthly ledger (SCR-021) | ✅ | Complete |
| Attendance day detail — HR/Supervisor view (SCR-022) | 🔶 | 11 form label gaps vs workbook spec |
| Gate Pass application (SCR-023) | 🔶 | 3 form label gaps; quota enforcement deferred |
| Overtime register (SCR-024) | ✅ | Mapped |
| Attendance exception queue (SCR-025) | ✅ | Mapped |
| Recompute monitor (SCR-026) | ✅ | Mapped |
| Team history view (SCR-027) | ✅ | Mapped |
| Shift Roster assignment & configuration | 🔶 | Shift types displayed; roster builder not implemented |
| Biometric device pairing configuration | 🔶 | Device IDs shown in data; configuration UI deferred |
| Regularization request form | 🔶 | Basic form; approval chain and deduction logic deferred |
| Attendance Anomaly queue | 🔶 | Listed but not filterable by anomaly type |
| Worker grace period rules (supervisor vs operator) | 🔶 | Rules documented; enforcement logic deferred |
| Geofence verification indicator | 🔶 | Badge shown; GPS validation deferred |
| OT computation — auto-break deduction | 🔶 | Calculation defined in tests; UI representation deferred |
| Cross-midnight shift detection | 🔶 | Implemented in server tests; UI badge deferred |

**Missing from Workbook:**
- ❌ Shift Master configuration form (Shift code, Start/End time, Break duration, Weekly off pattern)
- ❌ Roaster assignment wizard (Employee + Shift + Date range)
- ❌ Comp-off grant from overtime approval (auto-credit to leave balance)
- ❌ Biometric device health dashboard
- ❌ Regularization approval workflow (multi-stage: Manager → HR)

---

## 4. Module 3 — Leave Engine & Workflows

**Component:** `src/components/Clerio/LeaveView.js` + `src/components/Leave/`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Apply for leave (SCR-030) | ✅ | `LeaveApplicationDialog.tsx` complete |
| Leave balance & ledger (SCR-031) | ✅ | `LeaveBalancePanel.tsx` complete |
| Leave policy configuration (SCR-032) | ✅ | `LeavePolicyReference.tsx` complete |
| Sandwich rule live calculation | ✅ | Complete — leave-workflow.ts enforces |
| Half-day leave option | 🔶 | Manual 0.5 override; calendar validation deferred |
| Leave calendar (team view) | ✅ | `LeaveCalendar.tsx` complete |
| Multi-tier approval (Manager → HR) | 🔶 | UI stepper rendered; server-side state machine complete in tests |
| Comp-off ledger — FIFO expiry after 60 days | 🔶 | Data structure complete; auto-expiry daemon deferred |
| Early return from leave workflow | 🔶 | Form exists; balance re-credit logic deferred |
| Leave cancellation & withdrawal | 🔶 | UI action present; workflow state transitions incomplete |
| Leave type eligibility (worker class / probation) | 🔶 | Reference data available; enforcement rules partial |
| Holiday calendar integration | ✅ | `09_Holiday_Calendar` integrated in leave-reference.ts |
| Leave encashment form | ❌ | Not implemented — workbook SCR-032 field rows 80–95 |
| Accrual policy simulator | 🔶 | Policy reference shown; accrual schedule simulation UI missing |
| WFH request workflow | ❌ | Not implemented — referenced in process flows |
| Leave approval delegation | ❌ | Not implemented — deputy approval for manager absence |
| Leave without pay (LWP) computation | 🔶 | Data exists; payroll deduction integration deferred |

**Missing from Workbook:**
- ❌ Maternity Leave / Paternity Leave / Adoption Leave request forms (statutory benefit tracking)
- ❌ Leave encashment request form (with tax computation toggle)
- ❌ Leave approval delegation (when manager is on leave)
- ❌ Restricted holiday election (from optional holiday list)
- ❌ Leave opening balance import wizard (for mid-year go-live)

---

## 5. Module 4 — Lifecycle, Onboarding & Hardware Assets

**Component:** `src/components/Clerio/OnboardingView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Joining chain console (SCR-060) | ✅ | Mapped |
| Clearance board (SCR-061) | 🔶 | 3 form label gaps vs workbook |
| Policy acknowledgement (SCR-062) | ✅ | Mapped |
| My learning / learning paths (SCR-063) | ✅ | Mapped |
| Asset register (SCR-064) | ✅ | Mapped |
| Recognition register (SCR-065) | ✅ | Mapped |
| Announcements (SCR-066) | ✅ | Mapped |
| Letters — HR Letter Studio (SCR-067) | ✅ | Mapped |
| Hardware asset allocation modal | ✅ | Complete |
| Mark Asset Returned (F&F clearance) | 🔶 | Button exists; F&F linking deferred |
| 30-60-90 Day milestone checklist | 🔶 | Checklist items displayed; completion tracking deferred |
| Onboarding workflow state machine | ✅ | `src/server/lifecycle/` complete |
| BGV background verification tracker | 🔶 | Status displayed; third-party API integration deferred |
| Pre-boarding document collection | 🔶 | Form exists; document OCR verification deferred |
| Offer letter generation & digital signature | 🔶 | Letter template studio exists; e-signature integration deferred |
| Exit interview form | ❌ | Not implemented |
| Full & Final settlement calculation | 🔶 | Referenced in payroll; standalone F&F UI not rendered |

**Missing from Workbook:**
- ❌ Exit Interview questionnaire form with scoring
- ❌ Full & Final settlement wizard (last month salary, gratuity, encashment, notice recovery)
- ❌ PF withdrawal assistance form
- ❌ Digital offer letter with counter-signature capture

---

## 6. Module 5 — Organization Management & Team Hierarchy

**Component:** `src/components/Clerio/TeamView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Pod directory — filterable by pod type | ✅ | Complete |
| Teammate card — avatar, status, contact | ✅ | Complete |
| Org hierarchy tree view | 🔶 | List view only; interactive SVG/tree canvas not implemented |
| Department creation & management | 🔶 | Departments shown; CRUD admin panel deferred |
| Cost center assignment | ❌ | Not implemented — referenced in payroll workbook |
| Location master management | 🔶 | `LocationMasterModal.js` exists; list/edit/delete deferred |
| Legal entity management | 🔶 | `LegalEntityModal.js` exists; CIN/LLPIN validation deferred |
| Business unit configuration | ❌ | Not implemented |
| Reporting line bulk-update | ❌ | Individual reassign exists; bulk CSV update not implemented |

---

## 7. Module 6 — Global Payroll, EWA & Loan Engine

**Component:** `src/components/Clerio/PayrollView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Payroll run cockpit (SCR-050) | 🔶 | 3 form label gaps; cockpit stages UI partial |
| Pre-payroll audit (SCR-051) | ✅ | Mapped |
| Salary structure simulator (SCR-052) | ✅ | `wage-simulator` server tests complete |
| Payslip generation (SCR-053) | ✅ | Mapped |
| Tax declaration & projection (SCR-054) | ✅ | Mapped |
| Disbursement & bank file (SCR-055) | ✅ | Mapped |
| Full and final settlement (SCR-056) | 🔶 | Reference data; standalone workflow deferred |
| Loans & Advances (SCR-080) | 🔶 | 6 form label gaps vs workbook |
| 8-stage payroll control room | 🔶 | UI stages shown; lock/unlock/finalize logic deferred |
| Gross-to-net formula engine | ✅ | `src/server/payroll/service.ts` complete |
| PF/ESI/PT/TDS computation | ✅ | `src/server/compliance/` complete |
| Earned Wage Access (EWA) micro-payout | 🔶 | Feature referenced; UI form not implemented |
| Off-cycle payroll run | 🔶 | UI button exists; computation flow deferred |
| Arrears calculation engine | 🔶 | Referenced in server; UI deferred |
| Bank NEFT disbursement file generation | 🔒 | Backend deferred — requires bank API |
| Form 12BB / Form 16 generation | 🔒 | Backend deferred — statutory filing |

**Missing from Workbook:**
- ❌ EWA (Earned Wage Access) request form — employee self-service micro-payout
- ❌ Payroll exception approval form (CTC exception modal is partial — needs full approval chain)
- ❌ Salary revision / increment letter generation workflow
- ❌ Bonus payout configuration panel (performance-linked bonus slabs)
- ❌ Payroll lock authorization chain (HRBP → CFO → CXO signature flow)

---

## 8. Module 7 — Compensation, Bands & Benefits

**Component:** `src/components/Clerio/CompensationView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Compensation bands matrix (L1–L6) | 🔶 | Reference view; edit/save deferred |
| FBP (Flexi Benefit Plan) declaration | 🔶 | Panel exists; tax impact simulation deferred |
| Benefits enrollment — medical/insurance | 🔶 | `src/server/benefits/` complete; enrollment UI partial |
| Benefit claims form | 🔶 | Basic form; document upload and approval deferred |
| CTC exception approval | 🔶 | `CtcExceptionModal.js` exists; approval chain incomplete |
| Merit pay & increment cycle | ❌ | Not implemented |
| Market compensation benchmarking | ❌ | Not implemented |

---

## 9. Module 8 — Statutory Compliance & Factories Act

**Component:** `src/components/Clerio/ComplianceView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Rule pack manager (SCR-070) | ✅ | Mapped |
| Golden case library (SCR-071) | ✅ | Mapped |
| Obligation calendar (SCR-072) | ✅ | Mapped |
| Statutory forms and registers (SCR-073) | ✅ | Mapped |
| PF Form 12A / Form 5 generation | 🔒 | Deferred — requires production DB |
| ESI Challan generation | 🔒 | Deferred — requires production DB |
| Professional Tax challan | 🔒 | Deferred |
| Factories Act muster roll | 🔒 | Deferred |
| Form F (Labour Welfare Fund) | 🔒 | Deferred |
| Compliance deadline alert calendar | 🔶 | Obligation calendar shows dates; email reminder deferred |

---

## 10. Module 9 — Talent Acquisition & ATS Pipeline

**Component:** `src/components/Clerio/RecruitmentView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Requisition creation (SCR-090) | 🔶 | 4 form label gaps vs workbook |
| Referrals (SCR-091) | ✅ | Mapped |
| Contractor engagement & invoice (SCR-095) | ✅ | Mapped |
| ATS candidate stage pipeline | ✅ | `src/services/recruitmentService.ts` complete |
| Interview scorecard form | 🔶 | `src/server/interviews/service.ts` complete; UI form partial |
| Offer letter generation from ATS | 🔶 | Referenced; letter studio integration deferred |
| Job board posting integration | 🔒 | Deferred — external API |
| Background verification vendor integration | 🔒 | Deferred — external API |
| Candidate resume parsing (AI-powered) | 🔶 | AI agent exists; resume OCR deferred |
| Referral reward tracking | ❌ | Not implemented |

---

## 11. Module 10 — Performance, OKRs & 9-Box Calibration

**Component:** `src/components/Clerio/PerformanceView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| OKR goal setting — cascade from org to individual | 🔶 | `src/services/performanceService.ts` complete; cascade UI deferred |
| 9-box calibration grid | ✅ | Interactive grid implemented |
| 360-degree feedback form | 🔶 | Server `reviews.ts` complete; multi-reviewer UI partial |
| Performance review cycle configuration | 🔶 | Cycle config shown; start/end/finalize deferred |
| PIP (Performance Improvement Plan) tracker | 🔶 | Referenced in service; dedicated UI deferred |
| Bias flag evaluation | 🔶 | Server logic exists; UI indicator deferred |
| Appraisal letter generation | ❌ | Not implemented — referenced in process flows |
| Rating normalization / forced distribution | ❌ | Not implemented |
| Manager calibration session | ✅ | `src/server/performance/reviews.ts` complete |

---

## 12. Module 11 — Learning & Development (L&D)

**Component:** `src/components/Clerio/LearningView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| LMS catalog — browse courses | ✅ | `src/services/learningService.ts` complete |
| Course enrollment | 🔶 | Enrollment action; completion tracking deferred |
| Mandatory compliance certification tracking | 🔶 | Listed; due-date enforcement deferred |
| Skill competency matrix | 🔶 | `src/server/skills/service.ts` complete; visualization deferred |
| External LMS sync (LTI / SCORM) | 🔒 | Deferred — external API |
| Learning path assignment | 🔶 | Paths defined; assignment workflow deferred |
| Training needs identification | ❌ | Not implemented |
| Certification renewal alerts | ❌ | Not implemented |

---

## 13. Module 12 — Employee Experience & Vedic Wellbeing

**Component:** `src/components/Clerio/ExperienceView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Nomination awards engine (Star of Month, Spot Award) | 🔶 | Form exists; bonus payout integration deferred |
| Recognition badge wall | 🔶 | UI displayed; peer nominations deferred |
| Wellbeing check-in (Vedic MCI assessment) | ❌ | Not implemented — referenced in blueprint |
| Announcements management | ✅ | `src/app/api/v1/announcements` complete |
| Employee pulse surveys | ❌ | Not implemented |
| Engagement score dashboard | 🔶 | `src/server/engagement/` tests complete; UI visualization deferred |

---

## 14. Module 13 — Contingent & Contract Workforce

**Component:** `src/components/Clerio/ContractWorkforceView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Contractor engagement & invoice (SCR-095) | ✅ | Mapped |
| Vendor agency master | ✅ | `src/services/contractWorkforceService.ts` complete |
| Rate card configuration | 🔶 | Data model complete; UI edit form deferred |
| Vendor compliance verification (PF/ESIC proof) | 🔶 | Referenced; document upload deferred |
| Invoice reconciliation | 🔶 | `src/server/contractors/service.ts` complete; UI reconciliation table deferred |
| Third-party payroll integration | 🔒 | Deferred |

---

## 15. Module 14 — Agile Projects, Sprints & Tasks

**Component:** `src/components/Clerio/ProjectView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Pod resource allocation | ✅ | `src/services/projectWorkforceService.ts` complete |
| Sprint board (Kanban) | 🔶 | Board UI rendered; drag-and-drop persistence deferred |
| Timesheet entry | 🔶 | Form exists; approval and billing integration deferred |
| Billable headcount utilization | 🔶 | Data model complete; visualization deferred |
| SOW deliverable tracking | ❌ | Not implemented |
| Project P&L dashboard | ❌ | Not implemented |

---

## 16. Module 15 — People Intelligence & Analytics

**Component:** `src/components/Clerio/AnalyticsView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Agent console & action ledger (SCR-110) | ✅ | Mapped |
| Operational reports (SCR-111) | ✅ | Mapped |
| Workforce KPI dashboard | ✅ | `src/services/analyticsTelemetryService.ts` complete |
| Flight risk scoring | 🔶 | Algorithm in service; visualization deferred |
| Executive 4-filter telemetry (Location/Dept/Tenure/Branch) | ✅ | Complete with 4 symmetrical filter cards |
| People analytics — attrition forecasting | 🔶 | Data model complete; forecast chart deferred |
| MIS Reporting Hub | ✅ | `MisReportingHub.js` complete |
| Headcount planning | 🔶 | Referenced; scenario simulator deferred |
| Custom report builder | ❌ | Not implemented |

---

## 17. Module 16 — Grounded Policy Helpdesk

**Component:** `src/components/Clerio/HelpdeskView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Assistant / helpdesk (SCR-041) | ✅ | Mapped |
| Unified approval inbox (SCR-040) | ✅ | Mapped |
| SLA ticketing system | ✅ | `src/services/helpdeskService.ts` complete |
| P1-P4 priority escalation | ✅ | Routing logic complete |
| POSH grievance tracking | 🔶 | Referenced; dedicated POSH module not implemented |
| Knowledge base article management | ❌ | Not implemented |
| SLA breach alerts | 🔶 | Logic complete; notification delivery deferred |

---

## 18. Module 17 — Enterprise Integrations & API Platform

**Component:** `src/components/Clerio/IntegrationsView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Integration configuration (SCR-100) | ✅ | Mapped |
| Sync monitor (SCR-101) | ✅ | Mapped |
| GL mapping & journal (SCR-102) | ✅ | Mapped |
| Reconciliation (SCR-103) | ✅ | Mapped |
| ERP sync (SAP, Oracle, Tally) | 🔒 | Deferred — live API |
| WhatsApp / SMS notification gateway | 🔒 | Deferred |
| Teams / Slack integration | 🔒 | Deferred |
| Inbound webhook handler | ✅ | `src/server/integrations/inbound.ts` complete |
| Outbound webhook dispatcher | ✅ | Outbox pattern implemented |

---

## 19. Module 18 — Access Control & RBAC Studio

**Component:** `src/components/Clerio/AccessControlView.js`

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Principal, role & scope grant (SCR-005) | ✅ | Mapped |
| RBAC studio — role assignment | ✅ | `AccessControlView.js` complete |
| ABAC policy engine | ✅ | `src/server/identity/authorization.ts` complete |
| Tenant isolation enforcement | ✅ | `src/server/identity/tenant-isolation.test.ts` — 23 tests pass |
| Multi-tenant provisioning | 🔒 | Server deferred — `src/server/platform/access.ts` exists |
| Row-Level Security (RLS) enforcement | 🔒 | Deferred — production DB phase |
| Audit log for access changes | 🔶 | UI shows changes; immutable server audit deferred |
| Privileged access management (PAM) | ❌ | Not implemented |

---

## 20. Voice & AI Features (Nucleus Talk + AI Copilot)

| Feature | Status | Gap / Notes |
|:---|:---:|:---|
| Nucleus Talk voice recognition | ✅ | Complete — Web Speech API |
| Spoken greeting on mic click | ✅ | Synchronous audio in TopNav click handler |
| 1-second pause auto-execution | ✅ | 1000ms debounce timer |
| Live transcript bubble | ✅ | Real-time speech display |
| Animated Nucleus CSS/SVG logo | ✅ | Complete — no static PNG dependency |
| 14 preloaded voice action shortcuts | ✅ | All chips in Nucleus Assistant |
| Voice command engine — 30+ command patterns | ✅ | `voiceCommandEngine.ts` complete |
| Nucleus AI Copilot (RAG-grounded) | 🔶 | `AIPanel.js` chat UI complete; LangChain/LangGraph backend deferred |
| AI policy assistant | 🔶 | `src/server/ai/` tests complete; production LLM deferred |
| Autonomous biometric anomaly healer | ❌ | AI feature planned; not implemented |
| Predictive flight-risk radar | 🔶 | Data model complete; ML model deferred |
| Multi-lingual AI intent parsing | 🔶 | English only; multilingual NLU deferred |

---

## 21. Bulk Data Import / Export — All Modules

| Entity | Import Status | Export Status | Gap |
|:---|:---:|:---:|:---|
| Employee master | ✅ | 🔶 | CSV download button; server generation deferred |
| Attendance records | 🔶 | ❌ | Import modal exists; validation rules partial |
| Leave requests | ❌ | ❌ | Not implemented |
| Payroll inputs | 🔶 | 🔶 | Modal exists; field mapping deferred |
| Candidates (ATS) | ❌ | ❌ | Not implemented |
| Asset register | ❌ | ❌ | Not implemented |
| Training completions | ❌ | ❌ | Not implemented |
| Salary structures | ❌ | ❌ | Not implemented |

---

## 22. i18n — Translation Completeness

| Language | Code | Status | Gap |
|:---|:---:|:---:|:---|
| English | `en` | ✅ | Complete — source of truth |
| Hindi | `hi` | 🔶 | Public pages translated; workspace strings partial |
| Marathi | `mr` | 🔶 | Partial — needs workspace audit |
| Tamil | `ta` | 🔶 | Partial |
| Telugu | `te` | 🔶 | Partial |
| Bengali | `bn` | 🔶 | Partial |
| Spanish | `es` | 🔶 | Partial |
| French | `fr` | 🔶 | Partial |
| German | `de` | 🔶 | Partial |
| Japanese | `ja` | 🔶 | Partial — RTL not applicable |
| Arabic | `ar` | 🔶 | Partial — RTL support requires dedicated layout audit |

**Key Missing:**
- ❌ Workspace operational strings (form labels, table headers, error messages) are hardcoded in English in most component files
- ❌ RTL layout flip for Arabic not implemented
- ❌ Number/currency/date formatting per locale not applied in all views

---

## 23. Critical Priority Backlog

The following items are **highest priority** for the next development sprint — they represent core workflows from the workbook that have UI surfaces but are functionally incomplete:

1. **Leave encashment form** — Complete statutory benefit workflow
2. **Exit interview + F&F settlement wizard** — Critical for employee lifecycle
3. **EWA (Earned Wage Access) UI** — High employee value feature
4. **Shift master + roster builder** — Core attendance workflow
5. **Org chart interactive tree** — Key navigation/hierarchy visualization
6. **Regularization approval chain** — Attendance exception handling
7. **Global search auto-suggest** — UX critical feature
8. **Arabic RTL layout** — Internationalization completeness
9. **Bulk import for all entities** — Data operations completeness
10. **Payroll lock authorization chain** — Payroll control room completeness

---

## 24. Forms from `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx` — Coverage Matrix

| Form | Screen ID | Status | Missing Fields |
|:---|:---:|:---:|:---|
| Employee Identity Form | SCR-010 | 🔶 | Emergency contact, IFSC/bank, UAN, PAN |
| Assignment & Policy Form | SCR-011 | 🔶 | Statutory wage class, grade pay, cost center |
| Attendance Day Detail | SCR-022 | 🔶 | Device ID, raw timestamps, shift variant |
| Gate Pass Request | SCR-023 | 🔶 | Department approval, duty slip reference |
| Leave Application | SCR-030 | ✅ | Complete |
| Payroll Run Cockpit | SCR-050 | 🔶 | Stage lock controls, checker signature |
| Loans & Advances | SCR-080 | 🔶 | Guarantor field, deduction schedule, approval |
| Requisition Form | SCR-090 | 🔶 | Band range, hiring manager, justification |
| Clearance Board | SCR-061 | 🔶 | Finance clearance, IT asset return status |

---

*This plan is a living document. Update status columns as features are implemented and verified against the workbook specifications.*
