# Feature flow audit — the client's 26 demo points

Source: `docs/Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx`. The workbook draws **27
requirements from 26 demo points** and attaches **40 acceptance tests** to them. This
document traces each requirement through the code that implements it — the screen a user
operates, the route it calls, the service that does the work, the function that holds the
rule, the tables it touches, and the test that proves it.

Every path below was verified by reading the code. Where something is absent it is named as
absent rather than glossed; section 3 lists every gap found.

**Verdict: all 27 requirements are implemented end to end and all 40 acceptance tests pass
against a live database.** Six gaps remain, every one of them at the configuration or
console layer rather than in a rule, and five workbook values are still unanswered — those
paths refuse by name rather than assume a figure.

---

## 1. How to read a row

| Column | Meaning |
|---|---|
| **Screen** | What a user operates. All screens are served by `src/app/(workspace)/[module]/page.tsx` and selected by key in `src/components/hrms/module-view.tsx`. |
| **Route** | The HTTP entry point under `src/app/api/v1/`. |
| **Service** | The exported server function that performs the work. |
| **Rule** | The function holding the decision — usually pure, usually unit-tested apart from the database. |
| **Tables** | What is written and read. |
| **Test** | The live acceptance scenario. Run with `MKRAFT_LIVE_VERIFY=1`. |

A rule function is listed separately from the service on purpose: it is the part that must
be right, and keeping it apart from the SQL is what lets the same decision be tested
without a database.

---

## 2. The 27 requirements

### Attendance and shifts

**R-01 — Multi-punch work hours across midnight, break captured separately**
- **Screen** Check in / out, Attendance day detail (`attendance-punch-registers.tsx`), Break register (`attendance-break-register.tsx`)
- **Route** `POST /api/v1/attendance/punches` · `POST /api/v1/attendance/days/[id]/recompute` · `GET /api/v1/reports/break-register`
- **Service** `ingestPunches` (`attendance/service.ts:374`) → `calculateDay` (`:726`) → `persistComputedDay` (`:1007`)
- **Rule** `analyzePunchDay` (`lib/hr-rules.ts:114`) — midnight roll-over, break accumulation from OUT→IN pairs, gross span. Session attribution: `attributeSessionDate` (`service.ts:284`) keeps the session on day 1 and keeps day 2 out of the register. Breaks are **reported, not deducted** — `DEDUCTED_BREAK_MINUTES = 0` (`:668`).
- **Tables** `attendance_days`, `attendance_punches`, `attendance_events`, `attendance_entries`, `attendance_sessions`, `attendance_breaks`
- **Test** T-01/T-02/T-03 — `attendance.acceptance.test.ts:174/200/218`. Asserts gross 1160 minutes, one 45-minute break row, OT 440.

**R-02 — Team calendar over a date range, for a manager's own team**
- **Screen** Team history (`attendance-ops-registers.tsx:987`), with CSV export
- **Route** `GET /api/v1/reports/team-history/register` (+ `/[id]`)
- **Service** `listTeamHistory` / `getTeamHistoryRecord` (`team-history-register.ts:133/177`)
- **Rule** `resolveAttendanceScope` (`attendance/service.ts:60`) — a recursive `manager_employee_id` CTE; a non-reportee is a 404, not an empty list. Aggregation in `HISTORY_SELECT` (`:88`).
- **Tables** reads `employees`, `attendance_entries`, `leave_requests`, `overtime_entries`, `gate_passes`; writes nothing
- **Test** T-05 — `attendance.acceptance.test.ts:276`

**R-13 — Attendance thresholds by shift length, grace and late marks**
- **Screen** Attendance day detail; shift master and grace/late policy through the generic record workspace (`workflow-workspace.tsx:187`)
- **Route** `POST /api/v1/attendance/days/[id]/recompute` · `POST /api/v1/operations/grace-late-policies`
- **Service** `calculateDay` (`attendance/service.ts:726`); policy via `loadAttendancePolicy` (`attendance-policy.ts:392`)
- **Rule** `attendanceStatus` (`hr-rules.ts:210`) — thresholds come from the shift's own record and an unconfigured shift **throws instead of defaulting**. `evaluateLateArrival` (`:242`) applies grace, the monthly allowance and the grade exemption; `lateCounterWindow` (`attendance-policy.ts:450`).
- **Tables** `attendance_days`, `attendance_entries`, `hrms_operation_records` (shifts, grace-late-policies, night-extension-rules)
- **Test** T-24/T-25/T-26 — `attendance.acceptance.test.ts:306/336/390`

**R-14 — Auto shift detection from the in-punch**
- **Screen** Attendance day detail (shows rostered vs detected vs applied); shift master
- **Route** `POST /api/v1/attendance/days/[id]/recompute` · `POST /api/v1/operations/shifts`
- **Service** `calculateDay`; `listShiftMaster` / `resolveShift` (`shift-master.ts:133/158`)
- **Rule** `detectShift` (`shift-master.ts:193`) — the first record whose window contains the first in-punch wins and **overrides the roster**, recording why. `assertDetectionWindowsDoNotOverlap` (`:217`) refuses an overlapping pair on save, because otherwise the detected shift would depend on read order.
- **Tables** `hrms_operation_records` (shifts), `attendance_days`, `attendance_entries`
- **Test** T-27 — `attendance.acceptance.test.ts:427`

**R-12 — Personal gate pass: 4 hours a month, at most two, added to work hours**
- **Screen** Gate pass register (`attendance-punch-registers.tsx:756`), gate-pass tab on Attendance
- **Route** `POST /api/v1/gate-passes` · `POST /api/v1/gate-passes/[id]/decide`
- **Service** `requestGatePass` (`attendance/service.ts:1371`), `decideGatePass` (`:1447`)
- **Rule** `gatePassEligibility` (`hr-rules.ts:552`) — two passes, 240 minutes, and the 240 option only as the month's single pass. The credit is added to the threshold figure in `calculateDay` (`:779`), so it counts toward the day's status.
- **Tables** `gate_passes`, `gate_pass_policies`, `attendance_days`, `attendance_entries`
- **Test** T-23 — `payroll.acceptance.test.ts:478`. Approved pass credits 120 minutes; a pending pass credits nothing.

### Employee classification

**R-03 — Contractual employees: no rest days, paid daily wages**
**R-04 — Third-party group: Employees get rest days, Helpers do not**
**R-05 — OT only on rest days or holidays for some employees**
- **Screen** Worker categories (`workforce/field-workforce-page.tsx`), resolved rules shown per person on the employee dossier (`people-pages.tsx:783`)
- **Route** `GET|POST /api/v1/operations/worker-categories` · `GET /api/v1/people/[id]/work-rules`
- **Service** `getEmployeeWorkRules` (`organization/work-rules.ts:190`)
- **Rule** `resolveWorkRules` (`work-rules.ts:120`) — a three-level resolution, employee → sub-category → category, that reports *which level answered*. `hasRestDaysFromPattern` (`:109`) returns **null** when no level states a pattern, so the caller cannot assume either way. `resolveDayType` (`attendance/service.ts:567`) never claims a rest day the configuration did not state. `isOvertimeEligible` (`hr-rules.ts:317`) is the R-05 rule; `overtimeBasisOf` (`attendance/service.ts:546`) resolves the basis from the employee, not from the request.
- **Tables** `worker_categories`, `hrms_operation_records` (worker-categories), `employments`, `employee_assignments`
- **Test** T-06 `people.acceptance.test.ts:264` · T-07 `:301` · T-04 `attendance.acceptance.test.ts:231`

### Leave

**R-06 — Early return from leave: mark present and credit the balance back**
- **Screen** Leave requests (`attendance-leave-registers.tsx:149`)
- **Route** `POST /api/v1/leave-requests/[id]/early-return` · `POST /api/v1/leave-requests/[id]/decide`
- **Service** `recordEarlyReturn` (`leave/service.ts:402`), `decideLeave` (`:202`)
- **Rule** `reconcileEarlyLeaveReturn` (`hr-rules.ts:538`). The credit is written with `reverses_entry_id` pointing at the debit it undoes, and the attendance days are **inserted** where none exist — a leave day has no attendance row, which is why an UPDATE alone silently did nothing.
- **Tables** `leave_requests`, `attendance_days`, `leave_ledger_entries`
- **Test** T-08 `leave.acceptance.test.ts:120` · T-09 `:180` (three-level approval, no self-approval, no proxy self-approval through delegation)

**R-07 — Comp-off lapses 60 days from the earned date**
- **Screen** Comp-off clock on the Leave console; the run is triggered from the readiness command page
- **Route** `POST /api/v1/coff-grants` · `POST /api/v1/leave/coff-lapse-runs`
- **Service** `grantCoff` (`leave/service.ts:643`), `runCoffLapse` (`leave/coff.ts:72`)
- **Rule** `coffLapseDate` (`leave/scheme.ts:445`). The lapse date is **recomputed from the scheme** on every run rather than trusted from the grant row, so a configuration change cannot leave two stores disagreeing; the stored value is kept only to expose drift.
- **Tables** `comp_off_grants`, `leave_ledger_entries`
- **Test** T-10 — `leave.acceptance.test.ts:210`. Earned 10 March, lapses 9 May; nothing lapses on the 8th.

**R-08 — Automatic leave credit: grade-based annual, monthly accrual, joiner proration**
- **Screen** Leave policy configuration (`attendance-leave-registers.tsx:1005`) for the per-type rules; runs from the readiness command page (accrual / expiry / year end)
- **Route** `POST /api/v1/leave/accrual-runs` · `POST /api/v1/leave/year-end-runs` · `POST /api/v1/leave-policies/register/[id]/configure`
- **Service** `runLeaveAccrual` (`leave/accrual.ts:139`), `runLeaveYearEnd` (`year-end.ts:82`)
- **Rule** `planLeaveAccrual` (`leave/scheme.ts:270`) — one function deciding one employee's credit for one run date: the senior annual 18/6/6 as a single movement, monthly 1.5 EL, the six-month EL hold with a single 9-day catch-up, and CL/SL proration in the joining year only. Idempotent by `occurrence` (`ledger.ts:142`), so the scheduled job and a manual run cannot double-credit.
- **Tables** `leave_ledger_entries`, `leave_types`, `accrual_rules`, `tenant_settings`
- **Test** T-11…T-17 — `leave.acceptance.test.ts:271/302/334/365/406/426/471`

### Security

**R-09 — Salary processed at head office, attendance at plant, salary hidden from plant users**
- **Screen** Employee dossier (`people-pages.tsx:783`, renders "Restricted for your role"), Payslips register, Team history
- **Route** `GET /api/v1/people` · `GET /api/v1/payslips` · `GET /api/v1/reports/team-history` · `POST /api/v1/exports`
- **Service** `listEmployees` / `getEmployee` (`organization/service.ts:90/119`), `listPayslips` (`payroll/payslips.ts:410`), `getTeamHistory` (`vp/service.ts:370`), `buildExport` (`exports/service.ts`)
- **Rule** `dataScopeAllows` (`identity/authorization.ts:113`) with two dimensions — `attendance_location` (`employees.location`) and `payroll_location` (`employees.payroll_owner`). That split *is* the requirement: the same person is at the plant for attendance and owned by head office for pay. **Fail-closed**: a record whose dimension value is unresolved is masked, never shown.
- **Tables** reads `employees`, `tenant_settings.dataScopes`, `payslips`; writes `access_events` (compensation views are audited)
- **Test** T-18 — `people.acceptance.test.ts:327`. Four surfaces asserted: employee record, salary register, export, team history — with a control that the plant-paid colleague *is* fully visible.

### Payroll, loans and finance

**R-10 — Loan policy: one active loan, guarantor interlock, multiple-of-basic ceiling**
- **Screen** Loans & advances (`loans-advances-page.tsx`)
- **Route** `POST /api/v1/loans` · `/[id]/approve` · `/[id]/consent` · `/[id]/disburse` · `/[id]/repay`
- **Service** `applyForLoan` (`loans/service.ts:293`), `approveLoan` (`:558`), `consentGuarantee` (`:440`)
- **Rule** `resolveLoanCeiling` (`loans/ceiling.ts:63`) — 4× under five years, 6× at five years or more, the band inclusive at exactly five. `loanEligibility` (`hr-rules.ts:587`) holds the one-active-loan and guarantor interlock, which runs **both ways**: a guarantor can neither borrow nor stand again until the guaranteed loan closes.
- **Tables** `employee_loans`, `loans`, `loan_guarantors`, `loan_schedules`, `salary_advances`
- **Test** T-19 `payroll.acceptance.test.ts:252` · T-20 `:298` · T-21 `:337` (₹160,000 at 4×, ₹240,000 at 6×, Director override recorded)

**R-11 — OT generated and paid after salary, in a separate run**
- **Screen** Payroll run cockpit (`payroll-run-cockpit-page.tsx`), Overtime register
- **Route** `POST /api/v1/payroll-runs` · `/[id]/calculate` · `/[id]/finalize`
- **Service** `createRun` (`payroll/service.ts:314`), `calculateRun` (`:505`)
- **Rule** `assertOtRunAllowed` (`vp/policy.ts:137`) — an OT run is refused until the regular run for that period is **finalized**, not merely approved. The OT branch (`payroll/service.ts:559`) reads `payable_ot_minutes` from **locked** days only and writes a single `ot` line, so an OT run can never carry regular components.
- **Tables** `payroll_runs`, `payroll_run_employees`, `payroll_lines`, `attendance_days` (read)
- **Test** T-22 — `payroll.acceptance.test.ts:412`

**R-15 — Link the ERP employee master to Nucleus**
- **Screen** ERP field ownership (`erp-integration-page.tsx:168`) inside Integrations; sync issued from the readiness command page
- **Route** `GET|PUT /api/v1/integrations/erp-settings` · `POST /api/v1/commands/sync_erp_employee`
- **Service** `syncErpEmployee` (`integrations/erp-sync.ts:430`), `retryErpRecord` (`:516`), `saveErpSettings` (`erp-settings.ts:81`)
- **Rule** `planErpFieldWrites` (`lib/erp-field-ownership.ts:183`) — per field, the configured owner decides; a field with **no recorded owner throws** rather than defaulting to either system, and `latest_wins` without a change timestamp refuses by name (Q-15). Writes apply through a single `coalesce` UPDATE so unwritten fields are untouched.
- **Tables** `employees`, `vp_erp_records`, `integration_connections`
- **Test** T-28 — `payroll.acceptance.test.ts:515`. A failed sync is queued with its reason, retried after correction, and the attempt count is asserted 1→2→3.

**R-16 — Show and generate account posting in the ERP**
- **Screen** GL mapping & journal (`gl-mapping-page.tsx:242`), Payroll accounting (read model)
- **Route** `GET|POST /api/v1/payroll-runs/[id]/journal` · `POST /api/v1/gl-accounts` · `POST /api/v1/operations/ledger`
- **Service** `postJournal` (`payroll/gl.ts:1151`), `buildJournal` (`:978`), `unmappedComponents` (`:933`)
- **Rule** `composeJournal` (`gl.ts:367`) derives the net-pay leg from the same lines that produced the component legs, so the journal balances by construction; `assertBalanced` (`:328`) still checks and names the residual. Re-posting is decided by `journalFingerprint` (`:483`) — an unchanged run posts `unchanged`, not a duplicate.
- **Tables** `payroll_exports`, `payroll_export_lines`, `gl_accounts`, `gl_mappings`
- **Test** T-29 — `payroll.acceptance.test.ts:595`. Balanced, idempotent, and a retired mapping leaves a `failed` export carrying `GL_MAPPING_MISSING`.

**R-17 — Full and final on the same day, gated by no dues**
- **Screen** Full & final (`full-final-page.tsx:150`), Clearance board (`people-lifecycle-registers.tsx:869`)
- **Route** `POST /api/v1/operations/settlements/[id]/finalize` · `POST /api/v1/offboarding/items/[id]/waive`
- **Service** `mutateOperationalRecord` (settlements state machine), `waiveClearanceItem` (`lifecycle/clearance-board.ts:204`)
- **Rule** `clearanceBlockingSql` (`clearance-board.ts:49`) — an item blocks unless cleared or waived, **and a waiver with an empty reason still blocks in SQL**, so the gate cannot be talked past from the application layer. The finalize guard (`operational-service.ts:135`) additionally requires no asset still allocated and outstanding loans covered by the recovery figure.
- **Tables** `hrms_operation_records` (settlements), `full_final_settlements`, `offboarding_cases`, `clearance_items`
- **Test** T-30 — `payroll.acceptance.test.ts:709`

### Statutory

**R-18 — Factory Act forms and returns (Forms 28, 18, 36)**
- **Screen** Statutory (`statutory-page.tsx:329`) — derivation preview then generate
- **Route** `GET|POST /api/v1/compliance/statutory-forms` · `POST /api/v1/commands/generate_statutory_form`
- **Service** `deriveStatutoryFormValues` (`compliance/statutory-forms.ts:257`), `generateStatutoryForm` (`vp/service.ts:272`)
- **Rule** The state variant comes from the **establishment's own master row** and is never typed (`statutory-forms.ts:263`); a missing state refuses with `ESTABLISHMENT_STATE_MISSING`. Every figure is derived from the finalized run and recorded **with its source**; anything not derivable lands in `missing` rather than being substituted.
- **Tables** `vp_statutory_instances`; reads `payroll_runs`, `payroll_run_employees`, `locations`, `legal_entities`
- **Test** T-32 — `payroll.acceptance.test.ts:846`. Gross, deductions and net each equal the run's own totals.

**R-27 — Joining form under the Factory Act (Form F)**
- **Screen** Statutory — Form F requires an employee, enforced in the UI (`statutory-page.tsx:302`)
- **Route** `GET /api/v1/compliance/statutory-forms?view=derivation&formCode=FORM_F&employeeId=…`
- **Service** `allocateFormSerial` (`statutory-forms.ts:459`), `confirmFormSerial` (`:482`), `voidFormSerial` (`:496`)
- **Rule** Serial allocation takes a `pg_advisory_xact_lock` per establishment and form, then `max(serial)+1` inside the same transaction, so concurrent allocations serialise rather than collide. A spoiled number is **voided, never deleted**, which is what keeps the register gapless; `findSerialGaps` (`:522`) proves it.
- **Tables** `statutory_form_serials`, `vp_statutory_instances`
- **Test** T-31 — `payroll.acceptance.test.ts:777`. The voided number is not reused: `second === first + 2`.

### Engagement, documents and organisation

**R-19 — Star employees**
- **Screen** Recognition register (`recognition-register-page.tsx:334`)
- **Route** `GET|POST /api/v1/recognition-register`
- **Service** `executeRecognitionCommand` (`engagement/recognition-register.ts:1206`)
- **Rule** `publishFor` (`:1124`) raises the announcement **inside** the approval, so selection and announcement are one step and cannot drift apart. The certificate reference is derived deterministically (`certificateReferenceFor` `:691`) and stamped once — a re-publish does not reissue it.
- **Tables** `recognition_events`, `recognition_programs`, `feed_posts`, `reward_transactions`
- **Test** T-33 — `engagement.acceptance.test.ts:130`

**R-20 — Referral process and awards**
- **Screen** Referral tracking (`referral-tracking-page.tsx:212`)
- **Route** `POST /api/v1/referrals` · `POST /api/v1/referrals/[id]/award`
- **Service** `referCandidate` (`engagement/service.ts:192`), `awardReferral` (`:282`)
- **Rule** The award writes a `payroll_inputs` row carrying the `referral_id`, the milestone and the **position code** taken from the referral's requisition, and back-links `referral_awards.payroll_input_id` — the award reaches payroll as an input, not as a note. A per-leg guard refuses paying the same milestone twice.
- **Tables** `referrals`, `referral_awards`, `payroll_inputs`, `requisitions`, `positions`
- **Test** T-34 — `engagement.acceptance.test.ts:208`. See §4: the award amount is a workbook gap.

**R-21 — Announcements: birthday, star, new joiner, referral, management**
- **Screen** Announcements (`announcements-page.tsx:264`) with audience preview
- **Route** `GET|POST /api/v1/announcements` · `GET /api/v1/announcement-register`; the birthday/joiner sweep runs as job `engagement.announce_occasions`
- **Service** `publishAnnouncement` (`engagement/service.ts:69`), `announceOccasions` (`jobs/handlers.ts:103`)
- **Rule** `planOccasions` (`occasion-announcements.ts:204`) is pure and keyed by `occasionKey` (`:130`) — one per employee per year, so a re-run raises nothing. `is_auto_generated` is **system-derived and deliberately absent from the request schema**, so a hand-typed post cannot claim to be automatic.
- **Tables** `feed_posts`, `tenant_settings` (audience scope)
- **Test** T-35 — `engagement.acceptance.test.ts:374`. Second sweep raises zero.

**R-22 — Appointment letter and other HR letters**
- **Screen** Letters issue register (`people-lifecycle-registers.tsx:1436`)
- **Route** `GET|POST /api/v1/letters/register` · `GET|POST /api/v1/letters/templates`
- **Service** `issueLetter` (`letters/service.ts:468`), `saveLetterTemplate` (`:371`)
- **Rule** Merge fields are validated against a catalogue **when the template is saved** (`merge-fields.ts:120`), so an unknown field is refused at authoring rather than at issue. The rendered subject and body are stamped into the issued row and read back from there, so revising a template cannot rewrite a letter already sent.
- **Tables** `letter_templates`, `generated_letters`, `documents`, `document_versions`
- **Test** T-36 — `engagement.acceptance.test.ts:454`. The snapshot is identical after the template is revised to v2.

**R-23 — Organisation chart and department-wise hierarchy**
- **Screen** People (`people-pages.tsx:1066`), reporting chart rendered by `ReportingBranch` (`:1035`)
- **Route** `GET /api/v1/organization/reporting-chart` · `PATCH /api/v1/people/[id]`
- **Service** `getReportingChart` (`organization/reporting-line.ts:142`), `updateEmployee` (`employee-update.ts:35`)
- **Rule** `buildReportingTree` (`reporting-line.ts:47`) builds in one pass; the department view is **the same population grouped a second way**, not a second hierarchy, which is why the two can never disagree. `assertNoReportingCycle` (`:103`) refuses a cycle or a self-report before the write.
- **Tables** `employees`
- **Test** T-37 — `people.acceptance.test.ts:429`. `chart.total` equals the department headcount, proving one population.

**R-24 — Induction training at joining, and asset issue**
- **Screen** Joining chain console (`people-lifecycle-registers.tsx:577`), Asset register (`:1114`)
- **Route** `POST /api/v1/onboarding/confirmations` · `POST /api/v1/assets/register/[id]/allocate`
- **Service** `confirmEmployment` (`lifecycle/service.ts:399`), `allocateAsset` (`assets/service.ts:299`)
- **Rule** `confirmationBlockers` (`lifecycle/service.ts:131`) reads the template's own `blocksConfirmation` flags and **falls back to required items**, so a legacy template still gates. An unpriced asset keeps a `null` recovery value rather than zero — nil would silently write off the asset at settlement.
- **Tables** `onboarding_instances`, `onboarding_tasks`, `employments`, `asset_assignments`, `asset_catalog`
- **Test** T-38 — `people.acceptance.test.ts:473`

**R-25 — Recruitment: position code for a replacement**
- **Screen** Requisitions (`requisitions-page.tsx:277`) — the against-position field appears only for replacements
- **Route** `POST /api/v1/requisitions` · `POST /api/v1/requisitions/[id]/approve`
- **Service** `createRequisition` (`talent/service.ts:227`), `approveRequisition` (`:294`)
- **Rule** `decideRequisition` (`talent/establishment.ts:97`) — a replacement returns `consumesSanction: false` and the **unchanged** headroom, and the establishment check is skipped entirely. The vacated code must be named and must actually be vacant.
- **Tables** `requisitions`, `positions`, `vp_manpower_lines` (addition path only)
- **Test** T-39 — `people.acceptance.test.ts:556`. Headroom after a replacement equals headroom before.

**R-26 — Approved manpower, department-wise**
- **Screen** Talent acquisition → Approved manpower tab (`talent-acquisition-page.tsx:550`), Sanctioned strength board (`org-registers.tsx:398`)
- **Route** `GET /api/v1/establishment` · `POST /api/v1/commands/approve_manpower` · `POST /api/v1/requisitions/[id]/approve`
- **Service** `listEstablishment` (`talent/establishment.ts:199`), `approveManpower` (`vp/service.ts:344`)
- **Rule** `decideRequisition` (`establishment.ts:97`) — filled and open are **derived live**, never stored, so the ceiling cannot drift from reality. An unsanctioned key is refused (`SANCTION_MISSING`), not treated as unlimited. An override requires the permission, a **different person from the approver**, and a reason of at least 20 characters.
- **Tables** `vp_manpower_lines`, `requisitions`, `employees`, `departments`
- **Test** T-40 — `people.acceptance.test.ts:601`

---

## 3. Gaps found by this audit

Every requirement's rule is implemented and tested. These six are at the configuration and
console layer — each is a place where the engine is complete but the way to operate or
configure it from a screen is missing.

| # | Gap | Effect | Where |
|---|---|---|---|
| 1 | **Nothing writes `overtime_entries`** | The overtime register and approval screen (FRM-TIM-07) read a table no application path populates, so it shows only seeded rows. OT *payment* is unaffected — the payroll OT run reads `attendance_days.payable_ot_minutes`. | no `insert into overtime_entries` anywhere in `src/` |
| 2 | **Scheme-level leave settings have no writer** | `seniorGradeRank`, `coffLapseDays`/`Basis`, `joiningProration`, `joiningAfterCutoffDays` live only in `tenant_settings.settings->'leave_scheme'` and are written **only by the seed script** — no route, no screen. Per-leave-type configuration (36 fields) does have a screen. | `scripts/seed-acceptance-demo.ts:381` is the sole writer |
| 3 | **Employee-level policy overrides have no field** | `overrideHasRestDays`, `overrideRestDayPattern`, `overrideWageType`, `overrideOtEligibility` exist in the dossier schema and the API, but the assignment form does not send them. Category-level configuration — which is how R-03/R-04/R-05 are actually stated — does have a screen. | `org-registers.tsx:699` body omits them |
| 4 | **ERP sync queue is not visible** | `listErpQueue` has no route and no screen; `retry_erp_record` and `abandon_erp_record` have routes but no UI control. A failed sync can be retried through the API, not from a screen. | `integrations/erp-sync.ts:606` has no consumer outside tests |
| 5 | **Referral announcements are never raised** | R-21 names referral among the announcement triggers. Birthday, joiner (job) and star (recognition approval) raise themselves; nothing raises a referral announcement. `management` is by definition typed by a person. | no writer of `kind: "referral"` |
| 6 | **Letter template authoring is API-only** | `POST /api/v1/letters/templates` has no screen; templates must be created through the API. Issuing from an existing template is fully served by the register. | no component references `letters/templates` |

None of these changes a verdict in §2: in every case the rule is implemented, tested and
reachable — what is missing is a maintenance surface.

---

## 4. The five values the client still owes

These are not defects. The mechanism is built in each case and **refuses by name** rather
than assuming a figure, because a guessed constant would turn the scenario green and make
the product quietly wrong.

| Question | What is missing | Where it refuses |
|---|---|---|
| **Q-02** | What an employee joining after 4 December receives | `leave/scheme.ts:222` — T-14's late joiner is blocked with `LEAVE_SCHEME_INCOMPLETE`, and **nothing is credited, not even a zero** |
| **Q-04** | Whether the 10 EL a month caps availing or accrual | current behaviour is availing, stated in the configuration |
| **Q-11** | How often the night extension may be used | `attendance-policy.ts:78` — the cap is simply not enforced |
| **Q-14** | Whether a rest day worked by a daily-wage employee attracts OT or a normal day's wage | `organization/work-rules.ts:162` |
| **Q-15** | The ERP change timestamp a latest-wins policy needs | `integrations/erp-settings.ts:133` |
| — | The referral award amount, split and qualifying period | `engagement/service.ts:256` — T-34 asserts the refusal first, then installs a scheme explicitly labelled `T-34-DEMO-SCHEME-NOT-CLIENT-POLICY` |
| — | The loan third-guarantor threshold | `rule-pack.ts:245` — reported as an unenforced configuration gap, not silently enforced at a guess |

Everything else the workbook states is configured and cited to its source — the seed prints
each value with the rule or worked example it comes from, and prints the ones above as
deliberately unset.

---

## 5. Verifying this yourself

```bash
npx tsx scripts/seed-acceptance-demo.ts
MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/acceptance --no-file-parallelism
```

The seed refuses any tenant but `mkraft`, is idempotent, and prints every value it
configures with its workbook citation. Each suite creates its own employees under a `T-nn`
code prefix and removes them afterwards, so the run repeats without a reset. Without
`MKRAFT_LIVE_VERIFY=1` the suites skip, leaving the ordinary gate unchanged.

| Suite | Scenarios | Result |
|---|---|---|
| Attendance | T-01…T-05, T-24…T-27 | 9 / 9 |
| Leave | T-08…T-17 | 10 / 10 |
| People and organisation | T-06, T-07, T-18, T-37…T-40 | 7 / 7 |
| Payroll | T-19…T-23, T-28…T-32 | 10 / 10 |
| Engagement | T-33…T-36 | 4 / 4 |
| **Client scenarios** | | **40 / 40** |
| Forms (round trips) | FRM-PLT-01, PLT-02, PAY-01 | 4 / 4 |
| Workbook fields | FRM-TIM-02/04/05, LVE-02/03, PAY-03 | 6 / 6 |

Gate: `npx tsc --noEmit` clean · `npx eslint src/` 0 errors · 2,715 unit tests · `npx next
build` succeeds.
