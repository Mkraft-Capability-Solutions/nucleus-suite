# Client acceptance — audit, build and replication guide

Source: `docs/Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx` — the client's own requirement
workbook. 27 requirements drawn from 26 demo points, 44 screens, 214 fields, 26 rules,
25 enums, 9 approval chains, 15 reports, 128 configuration items, 16 open questions, and
**40 acceptance tests**. The tests are the scenarios the client runs. This document records
what each one did before this pass, what was built, and how to run it.

Every verdict below was established by reading the code, not by reading a screen. Where a
scenario cannot be correct because the workbook never states a value, it is marked
**BLOCKED** and the open question is named — those need the client's HR product owner, not
a developer.

---

## 1. Where it stood

| Verdict | Count | Tests |
|---|---|---|
| PASS | 7 | T-05, T-16, T-19, T-22, T-23, T-39, T-40 |
| PARTIAL | 16 | T-01, T-04, T-08, T-09, T-10, T-12, T-14, T-20, T-21, T-24, T-27, T-28, T-29, T-30, T-33, T-38 |
| FAIL | 17 | T-02, T-03, T-06, T-07, T-11, T-13, T-15, T-17, T-18, T-25, T-26, T-31, T-32, T-34, T-35, T-36, T-37 |

The client's workbook marks 18 of the 27 requirements "Done" from the demo. Seven of the
40 tests held.

## 2. The four structural causes

Most individual failures traced to one of four things. They are worth stating separately,
because fixing a symptom without the cause would have left the next test failing.

**A rules library nothing called.** `src/lib/hr-rules.ts` implemented the grace period, the
late-mark allowance, the grade exemption, the night extension and the gross-hours overtime
basis correctly, with tests. The main attendance engine imported almost none of it. The
policy was right and unreachable.

**Configuration registers written and never read.** `policy-register.ts` persisted a
38-field leave configuration; no accrual, cap or combination path queried it. The shift
master stored `fullDayMinutes`, `halfDayMinutes`, `otBasis`, `earliestIn`/`latestIn`; no
engine read them. Every number the workbook calls configurable was a literal in code — which
is what RL-16 forbids in as many words: *"a new shift length needs configuration, not code."*

**Two engines for one policy.** Leave accrual, COFF expiry and year-end each existed twice —
in `jobs/handlers.ts` and in `vp/service.ts` — with different ledger `kind` values, different
date boundaries (180 days in one, 183 in the other) and no shared idempotency. Which answer
a demo produced depended on which route the operator used, and running both double-credited.

**Writes and reads pointing at different tables.** The attendance engine wrote
`attendance_days`; every register screen read `attendance_entries`. Computed days never
appeared. The same shape appeared in assets, where the register and full-and-final each
used a different store.

## 3. Security findings

Two defects found while auditing T-18. Neither was what the test was looking for. Both are fixed.

| | Defect | Fix |
|---|---|---|
| 1 | `POST /api/v1/exports/{id}/build` enforced **no permission at all** — it called `requireAccess` and nothing more, and looked the job up by tenant alone. Any authenticated member could build another member's queued export, and the `payroll-lines` branch returned every payroll line amount in the tenant, unscoped and unmasked. The check existed only on *create*. | The check moved inside `buildExport`; building another member's job additionally requires `audit.read`; payroll rows are filtered to the caller's data scope. |
| 2 | `getTeamHistory` **failed open on salary**: `compensationVisible = grants.length === 0 \|\| …`, so a caller with *no* location grant saw every location's rows with `basic_salary_minor` in clear. The route checked `employee.read` and never `payroll.rate.read`, handing raw salary to exactly the caller the employee screen masks. | No grant now means no compensation; the location filter no longer widens on an empty list; the endpoint gates on the same `payroll.rate.read` the employee screen uses. Three regression tests guard it — each defect was a single clause. |

## 4. Bugs found while auditing, unrelated to any test

| Bug | Effect |
|---|---|
| `waiveClearanceItem` wrote `'Waived'`; the finalize gate compared against `'cleared'` case-sensitively | A waived no-dues line never released the settlement. The board said ready; the API returned 409. |
| Asset status written `"Allocated"`, matched `'allocated'` | A register-issued asset returned through the workflow left its custody row open. |
| Loan exposure excluded `repaid/closed/rejected/cancelled` but payroll writes `recovered` | A fully recovered salary advance blocked every future loan, permanently. |
| The requisition under approval was counted in `open` *and* subtracted again | A requisition that exactly fitted the ceiling was refused as `SANCTION_EXCEEDED`. |
| `establishmentControlFor` returned inactive when a plan year had no approved line | The manpower control silently switched itself off. |
| `employees.manager_employee_id` read by the directory, attendance scoping and payroll team scoping | **No application code ever wrote it.** The only write in the repository was a test fixture. |
| `getBalances` added the new-joiner catch-up on top of the ledger, and `getUTCMonth()` is 0-based | Leave balances double-counted, and January's accrual was silently dropped. |

## 5. The 40 tests

Legend — **Built**: implemented and unit-tested. **Built / blocked**: the mechanism is in
place and refuses with a named error until the client supplies a value. **Not built**: a
missing feature rather than a broken field; recorded, not invented.

### Attendance and shifts (R-01, R-02, R-05, R-13, R-14)

| Test | Was | Now | To replicate |
|---|---|---|---|
| T-01 session crosses midnight | PARTIAL | Built | `POST /api/v1/attendance/punches` with IN 08:00, OUT 20:30, IN 21:15, OUT 03:20 next day. `GET /api/v1/attendance/days/{id}/trace` → gross 19:20, break 45, Present. The day now also appears on the Attendance day register. |
| T-02 break register | FAIL | Built | Same session, then the **Break register** screen or `GET /api/v1/reports/break-register`. One row 20:30→21:15, 45 min. Breaks are *reported, not deducted* (RL-03). |
| T-03 OT on gross hours | FAIL | Built | Same session → `trace.overtimeMinutes` = **440 (7:20)**. Was 395 (6:35): OT ran on net minutes and the threshold was the whole shift duration. |
| T-04 OT suppressed for rest-day-only | PARTIAL | Built | Set the worker category's OT eligibility to rest days and holidays only; run a working-day session → OT zero. A rest-day session earns normally. Eligibility now resolves from the employee, not a typed request field. |
| T-05 team calendar over a range | **PASS** | Unchanged | Team history, From 01 Jan To 15 Mar. A non-reportee returns 404. |
| T-24 shift thresholds | PARTIAL | Built | Record net 11:45 / 11:00 / 6:00 on a 12-hour shift → Present / Half day / Absent, **from the shift's own configured thresholds**. An 11-hour shift now works; an unseeded length is refused rather than silently scored on 8-hour numbers. |
| T-25 grace, late count, exemption | FAIL | Built / blocked | Arrive 08:10 (within grace), then 08:20 four times. Minutes late derive from the first punch against the shift start; the late counter is new. **Blocked on Q-06** — the exempt grade rank. |
| T-26 night extension | FAIL | Built / blocked | Work to 03:20, arrive 09:15, work to 20:00. The extension is now evaluated *before* the threshold verdict, so it can produce a full day. **Blocked on the trigger / permitted / minimum-departure hours and the Q-11 cap.** |
| T-27 shift detected from in-punch | PARTIAL | Built / blocked | Roster to A, punch in 20:05 → processed on B, `detected_shift` recorded and the rostered code preserved. Windows read from the shift master, may cross midnight, and overlap is refused on save. **Blocked on the window times** — detection stays off until configured. |

### Leave (R-06, R-07, R-08)

| Test | Was | Now | To replicate |
|---|---|---|---|
| T-08 early return | PARTIAL | Built | Approve 10 EL 1–10 June; `POST .../early-return {"actualReturnDate":"2026-06-07"}` → 4 credited back as a **reversal** linked to the original, days 7–10 marked present (the attendance rows are now created, not silently missed). Requires HR Head per W-02. |
| T-09 three-level approval | PARTIAL | Built | Submit, then try to approve as HR Head first → refused. Supervisor resolves from `manager_employee_id`, HOD from `departments.hod_position_id`, HR Head from the role. |
| T-10 COFF lapses | PARTIAL | Built / blocked | Earn a COFF on 10 March, run the lapse for 9 May → status `lapsed`, ledger entry naming the run. **Blocked on Q-07** — calendar or working days. |
| T-11 senior annual credit | FAIL | Built / blocked | Accrual on 1 January for an AGM+ → 18 EL, 6 CL, 6 SL in one movement. "On the rolls on 1 January" no longer means "joined that day". **Blocked on Q-06** — the senior grade rank. |
| T-12 monthly EL accrual | PARTIAL | Built | Monthly accrual → 1.5 EL, 18 across the year; CL and SL once in January, at full quantum for an established employee. |
| T-13 new joiner hold and catch-up | FAIL | Built | Join 1 March, run monthly → nothing through 31 August, a single **9 EL** credit on 1 September. Calendar months replace `6*30` and `183` days. |
| T-14 new joiner CL/SL proration | PARTIAL | Built / blocked | Join 15 Jan / 20 Apr / 2 Dec → 6 / 4 / 1, in the joining year only. **Blocked on Q-02** — joining after 4 December refuses rather than assuming zero. |
| T-15 CL cannot combine with EL/SL | FAIL | Built | Apply 2 CL for 10–11 June, then 3 EL for 12–14 June → the second is refused as a contiguous absence. Checks across separate applications and across types. An overlap guard was added; there was none. |
| T-16 monthly caps | **PASS** | Unchanged | 3 CL in a month and 11 EL in a month are both refused at the stated day. Caps now read from configuration. |
| T-17 year end | FAIL | Built | Preview then Commit → identical figures from one code path, counting **days** (7 encashed, 5 lapsed), not employees. Encash and lapse now reduce balances. |

### Employee, security and organisation (R-03, R-04, R-09, R-23, R-24, R-25, R-26)

| Test | Was | Now | To replicate |
|---|---|---|---|
| T-06 contractual — no rest day, daily wage | FAIL | Built / blocked | Set the employee's worker category to a daily-wage, no-rest-day row. `GET /api/v1/people/{id}/work-rules` shows the resolution. **Blocked**: the daily-rate divisor (÷26 / ÷30 / ÷days-in-month) is stated nowhere, so payroll refuses rather than paying a guessed rate. |
| T-07 Employee vs Helper | FAIL | Built | Create two `worker-categories` rows — one with a rest-day pattern, one without. **Two configuration rows, no code change**, which is the client's stated condition. Resolution is employee override → sub-category → category. |
| T-18 plant user cannot see head-office salary | FAIL | Built | As a plant-scoped role, open the employee, the register, an export and the API. The scope dimension now exists, `payroll_owner` has a reader and a writer, and masking is **per row**. Scopes only narrow — a role with no scope row behaves as before. |
| T-37 org chart follows the employee | FAIL | Built | `PATCH /api/v1/people/{id}` with `managerEmployeeId` (validated for existence and cycles), reopen the chart → it derives live from the employee record, not the parallel position graph. |
| T-38 induction gates confirmation | PARTIAL | Built | Leave one required induction item pending, `POST /api/v1/onboarding/confirmations` → `INDUCTION_INCOMPLETE` naming the items. `confirmationDate` was removed from the dossier form so it cannot bypass the gate. Issued assets reach F&F with a recovery value; an asset with no value stays *unpriced*, not zero. |
| T-39 replacement adds no headcount | **PASS** | Unchanged | Raise a Replacement against a vacated code → headroom unchanged. An Addition consumes it. |
| T-40 requisition beyond sanction | **PASS** | Unchanged | Raise past the ceiling → `422 SANCTION_EXCEEDED` naming the figures. Override needs `workforce.manpower.approve`, a different person from the ceiling's approver, and a 20-character reason. |

### Payroll, loans, gate pass, F&F, ERP, statutory (R-10, R-11, R-12, R-15, R-16, R-17, R-18, R-27)

| Test | Was | Now | To replicate |
|---|---|---|---|
| T-19 second loan blocked | **PASS** | Unchanged (bug fixed beside it) | Apply with one outstanding → refused; a salary advance is refused for the same reason. A *recovered* advance no longer blocks loans forever. |
| T-20 guarantor interlock | PARTIAL | Built | The block now attaches when the borrower **names** a guarantor, not only once that guarantor consents, and clears when the guaranteed loan reaches a terminal state. |
| T-21 loan ceiling by service | PARTIAL | Built / blocked | 40,000 basic → 160,000 at four years, **240,000 at exactly five** (RL-22 says "five years or more"; the old boundary gave 4× at 5.00). Over-ceiling applications are now recordable and require a separate `loan.director.approve` — a `payroll.run` user can no longer grant themselves the override. **Blocked on Q-08** (third-guarantor threshold) and **Q-09** (what "more than 5 years" counts). |
| T-22 OT cannot be paid with salary | **PASS** | Unchanged | Attempt the OT run before the regular run is finalized → refused; after, it posts separately. |
| T-23 gate pass entitlement | **PASS** | Unchanged | Two 2-hour passes, then a third → refused. Approved hours reach net work hours; a pending pass adds nothing. |
| T-28 ERP sync and failure queue | PARTIAL | Built | Sync, then force a failure → the record lands at `failed` with its reason and an attempt count, and can be retried. The replay guard is now status-aware, so a part-failed record is no longer short-circuited forever. |
| T-29 posting is idempotent | PARTIAL | Built | Post, then re-run → `unchanged`, no duplicate, debits equal credits. A **failed** post now records a row with its reason — that is RP-15. |
| T-30 no-dues gates settlement | PARTIAL | Built | Finalize with a line pending → refused; clear **or waive with a reason** → permitted. The `'Waived'` case bug is fixed and existing rows normalised. A waiver with no reason still blocks, per W-07. |
| T-31 Form F | FAIL | Built / blocked | Generate → values derive from the employee record, the dossier address and the establishment; the state variant resolves from the establishment, never typed. A gapless serial register was added (allocated under a lock; an unused serial is **voided with a reason, never deleted**). **Blocked on Q-13** — no state form layout was authored. |
| T-32 Forms 28 / 18 / 36 | FAIL | Built / blocked | Same generator: establishment, active headcount and the finalized payroll run supply the figures, each value carrying its source; anything without a source is absent so the template fails loudly rather than printing a blank. **Blocked on Q-13.** |

### Engagement and letters (R-19, R-20, R-21, R-22)

| Test | Was | Now | To replicate |
|---|---|---|---|
| T-33 star employee → announcement | PARTIAL | Built | Nominate, then approve as a different person → the announcement raises in the same command, now carrying the **award period and the criteria**, and a certificate is stamped once at publish with a deterministic credential reference. |
| T-34 referral award reaches payroll | FAIL | Built / blocked | Refer against an open requisition, convert, complete the period → the award raises a real `payroll_inputs` row for the referrer with the **position code** on it, and the joining and confirmation legs are separate. **Blocked**: the award amount and split are unset — it refuses with `REFERRAL_SCHEME_INCOMPLETE` rather than paying a guess. |
| T-35 birthday / joiner announcements | FAIL | Built | Set a date of birth to today and a joining date to today, run `engagement.announce_occasions` → both raise themselves, once per employee per year. Audience scope is per-type configuration (birthday defaults to location). `is_auto_generated` is **system-derived**, not settable from a request. |
| T-36 letter reproduces as sent | FAIL | Built | Issue, then reopen → the **snapshot** is read from the issue row, so editing the template no longer rewrites history. `POST /api/v1/letters/templates` is new; a template naming a field outside the catalogue is refused **on save**, as the workbook requires. |

## 6. Not built — missing features, recorded not invented

These have no implementation to repair. Building them is a scope decision, not a defect fix.

| From | What is missing |
|---|---|
| F-SHF-03 | Night Extension Rule Setup — no resource, route or screen. The five settings are configured through the attendance rule-set store instead. |
| F-ATT-06 | Grace & Late Policy Setup — same. |
| R-18 / R-27 | The statutory form layouts themselves. The derivation, the state resolution and the serial register are built; the per-state templates are client content (Q-13). |

## 7. Blocked on the client — the workbook's own open questions

Each is a value the workbook states is needed and never supplies. The mechanism is built in
every case; it refuses with a named error until the value exists. Nothing was guessed.

| Q | Needs | Blocks |
|---|---|---|
| Q-01 | Is the intermediate break deducted from paid hours? | Answered as stated in RL-03 — reported, **not** deducted. One constant to change if the client says otherwise. |
| Q-02 | What employees joining after 4 December receive | T-14 |
| Q-04 | Whether the 10 EL a month caps availing or accrual | T-16 (current behaviour: availing) |
| Q-06 | Which grade rank is "AGM and above" / "Assistant Manager and above" | T-11, T-25 |
| Q-07 | Whether the 60 COFF days are calendar or working days | T-10 |
| Q-08 | The loan amount that triggers a third guarantor | T-21 |
| Q-09 | Whether "more than 5 years" means continuous service | T-21 |
| Q-11 | How often the night extension may be used | T-26 |
| Q-12 | Whether the late counter resets on the calendar or payroll month | T-25 (default: calendar, as stated) |
| Q-13 | Which state's rules apply to Forms 28, 18, 36 and F | T-31, T-32 |
| Q-14 | Whether a rest day worked by a daily-wage employee attracts OT or a normal day's wage | T-06 |
| Q-15 | Which system owns which employee field | T-28 |
| — | The daily-rate divisor (÷26 / ÷30 / ÷days in month) | T-06's payroll half |
| — | The referral award amount, split and qualifying period | T-34 |
| — | Shift detection window times | T-27 |
| — | Night extension trigger / permitted / minimum-departure hours | T-26 |

## 8. Conflicts between the two client workbooks

| Fact | Forms workbook | Demo build sheet | Resolution |
|---|---|---|---|
| Overtime basis | `PL_OT_BASIS` defaults to **Net** (6:35) | RL-04: gross hours less the shift threshold (**7:20**), with acceptance test T-03 | Default follows the document with the test attached; recorded at the point of definition. A tenant wanting net sets the field. |
| Rest-day pattern | `PL_REST_DAY_PATTERN` — shape only (`fixed_weekly_day`), not which day | `worker-categories.restDayPattern` — `fixed_sunday`, `fixed_sunday_alt_saturday` | **Not merged.** Merging loses which day and would break rest-day derivation. Needs a decision: either the picklist gains a companion "which day", or the category vocabulary becomes authoritative. |
| OT eligibility | `PL_OT_ELIGIBILITY` has `beyond_weekly_hours_only` | `EN_OT_ELIGIBILITY_BASIS` has "Holidays only" | Neither set covers the other. A holidays-only employee currently resolves to all days. Needs reconciling, and the weekly cap `beyond_weekly_hours_only` refers to is stated nowhere. |

## 9. Two behaviours worth knowing before the demo

- **`fixed_sunday_alt_saturday`** — only the Sunday is derived as a rest day; which Saturdays
  alternate is not stated.
- **`rotational_weekly_off`** — needs the published roster to name the day, so such an
  employee's rest day is not inferred and the day is processed as working.

---

## 10. Live verification

Everything above was established by reading the code. This section records what happened
when the 40 scenarios were **executed** against a real database — the `mkraft` tenant on
Neon — which is a different and stricter question.

```bash
npx tsx scripts/seed-acceptance-demo.ts
MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/acceptance --no-file-parallelism
```

The seed is idempotent, refuses any tenant but `mkraft`, and prints every value it
configures with its workbook citation plus everything it leaves unset with the open
question number. The suites create their own employees under a `T-nn` code prefix and
remove them afterwards, so the run repeats.

| Suite | Scenarios | Result |
|---|---|---|
| Attendance | T-01 … T-05, T-24 … T-27 | 9 / 9 |
| Leave | T-08 … T-17 | 10 / 10 |
| People and org | T-06, T-07, T-18, T-37 … T-40 | 7 / 7 |
| Payroll | T-19 … T-23, T-28 … T-32 | 10 / 10 |
| Engagement | T-33 … T-36 | 4 / 4 |
| **Total** | | **40 / 40** |

Fourteen of those scenarios pass by asserting a **named refusal** rather than a figure,
because the workbook does not state the figure (section 7). The mechanism is built and
exercised; it declines to invent the number. T-10 is the clearest example: the comp-off
lapse runs, finds the grant, and refuses with `Q-07` in the message until somebody says
whether 60 days are calendar or working days.

### What running them found that reading them did not

Reading the code proved the logic; running it proved the wiring. Sixteen defects surfaced
only on execution, and they cluster into four kinds.

**Configuration that looked like a network fault.** `src/lib/db/index.ts` reads
`DATABASE_URL` once at module scope and falls back to a localhost placeholder, so the
connection a test got depended on which module imported `@/lib/db` first. A suite that
imported a service before its own dotenv-loading fixture built the client against
localhost; every `tenantTx` then failed with `ECONNREFUSED 127.0.0.1:443` while raw
fixture queries — built later — kept working. That split reads exactly like a flaky
network and is not one. Loading the environment in the vitest setup file fixes the order
for every suite. This single defect was masking all ten leave scenarios.

**Writes and reads pointing at different places.** Credited gate-pass minutes were written
as `gatepass_minutes_credited` and read as `gate_pass_minutes` by all six readers, so a
correctly computed figure displayed as blank everywhere. `coffCreditDays` looked up the
canonical `shifts` table, whose codes are `SH-A` where the engine's are `A` and which has
no half-day column at all, so a comp-off claim could only ever be refused. Team history
joined `employee_assignments` on a column that table does not have — invalid SQL that only
ran once a fail-open escape clause was removed.

**Silent data loss at a point of no return.** Attendance figures are written
`where locked_at is null`, `traceDay` computes without persisting, and only `approve`
recomputes. A day locked straight after ingestion therefore kept zero
`payable_ot_minutes` permanently — and payroll pays overtime off exactly that column, so a
worked overtime day that was locked without being approved paid nothing, irreversibly.
Locking a day that has never been computed is now refused by name.

**Permissions that nobody could hold.** `tenant.manage` guards fourteen administrative
entry points and no role in the tenant held it, not even the owner, so integration
connections and ERP settings were unreachable by everyone.

Also found: punch attribution consulted only punches already stored, so an overnight
IN/OUT pair filed its OUT onto day 2 and the next day's OUT then closed day 1 — a
19-hour session read as 12; leave `used` counted the submit-time reservation *and* the
approval debit, reporting ten days availed as twenty; the year-end run could never report
itself idempotent, because a committed run zeroes the balance and the re-run tested the
balance before the occurrence; a payslip hidden from the register was still served by id;
`basic_salary_minor` is a bigint and reached callers as a string while typed
`number | null`; and the recognition register compared a text column with a uuid, which
has no operator in Postgres and failed the whole query rather than returning an empty
audit trail.

### Forms

`src/server/acceptance/forms.acceptance.test.ts` covers the masters the workbook lists
that had no implementation, as round trips rather than as validation — created with every
field, read back field by field, then edited to prove a partial patch preserves what it
did not touch.

| Form | Covered |
|---|---|
| FRM-PLT-01 Legal Entity Master | 22 fields, both address blocks, GSTIN-to-state and entity-PAN rules |
| FRM-PLT-02 Location Master | 20 fields, geofence, PT-state derivation, stale-version refusal |
| FRM-PAY-01 Pay Component Master | 28 fields, percentage/formula/slab rules, GL account references |
| FRM-FIN-02 ERP Integration | exercised by T-28 |
| FRM-LVE-04 Leave Encashment, FRM-LCY-02 Confirmation | built; exercised through T-17 and T-38 |

Writing those found that the Location Master could not be used at all: `calendarId` is
required and no published `plant-calendars` record existed, so the form's own lookup came
back empty. The seed now publishes one calendar per location.

Migration `0023_legal_entity_attributes` was journalled but had never executed — the same
failure mode as 0018 earlier — so `legal_entities.attributes` did not exist and
FRM-PLT-01 would have failed on its first write.

### The twenty missing fields

All twenty are now implemented and read back. The two key-name drifts were fixed with the
acceptance work; the eighteen that remained were genuine gaps, and each is asserted in
`src/server/acceptance/fields.acceptance.test.ts` through the surface that reads it, not
through the write that produces it — which is exactly the failure mode they were.

| Form | Field | How it is answered |
|---|---|---|
| FRM-PAY-03 | `leave_locked` | Derived: no request overlapping the period is still awaiting a decision, so the leave days payroll is about to pay can no longer move. A period holding no leave passes the same test. It was hard-coded `null`. |
| FRM-TIM-02 | `rest_days_in_week` | The fewest rest days in any seven-day window of the roster — the worst week, not the average, because a roster is acceptable only if every week holds one. `null`, never `0`, where the pattern does not name a day: a rotational weekly off is set by the roster itself. |
| FRM-TIM-02 | `consecutive_days` | The longest run of consecutive working days, counting holidays as non-working. |
| FRM-TIM-04 | `early_out_minutes` | Minutes short of the shift end, the mirror of `minutes_late`, wrapped the same way so a shift ending after midnight measures against its own end. |
| FRM-TIM-04 | `applied_rule_ids` | The rules that actually fired, by identifier — shift, OT basis and eligibility, plus grace, late mark, night extension, gate pass, break register, overtime and day type where each applied. |
| FRM-TIM-04 | `attendance_segment[]` | One entry per IN/OUT pair with its own ordinal, clock times and worked minutes. Each punch also carries the segment it belongs to, derived from its position in the day, so punches already stored are segmented without being re-ingested. |
| FRM-TIM-04 | `ruleset_version` | Which configuration decided the day: the source each half of the policy pack came from and the newest publication stamp among the records actually used. A recompute months later can reach a different verdict, and the day could not previously say which policy judged it. |
| FRM-TIM-04 | `source_event_count` | How many punch events the verdict was built from, so a thin day reads as thin. |
| FRM-TIM-04 | `computed_at` | Was written and never projected; now on the register. |
| FRM-TIM-04 | `salary_structure.*` | Rate, monthly basic and the day's overtime amount, derived on read and never stored on the attendance row — salary is scope-gated compensation (RL-24) and an attendance record is not, so copying pay into it would put it in a store the scope cannot reach. The arithmetic is the payroll engine's own, from the same rule pack; where the pack does not state the OT basis or multiplier it reports that and names the missing rule. |
| FRM-TIM-05 | `current_status` | The day's verdict as it stood when the correction was raised, captured rather than looked up later — approving the correction changes the day, so a reader coming back afterwards could not otherwise tell what was being corrected. |
| FRM-TIM-05 | `document_ref` | Was accepted and stored and never read back; now projected on the day. |
| FRM-LVE-02 | `team_conflict_count` | How many of the applicant's peers already hold leave over the same dates. It informs the approver and decides nothing: the workbook states no limit on how many of a team may be away, so reporting the number is the whole of it. |
| FRM-LVE-02 | `cancel_reason` | A cancel route and service now exist. `cancelled` was a status filter nothing could set, with no way to give back the days a cancelled request was holding. Withdrawal is refused once the absence has begun — returning part-way through is an early return, which already settles the days properly. |
| FRM-LVE-03 | `approver_id`, `decision`, `decision_remarks` | A claim-and-decide pair. Only the HR-side grant existed and it credited the balance the moment it was called, so a claim had no approval step and the three fields had nowhere to live. A claim derives its days exactly as the grant does and credits nothing until somebody else approves it; a grant made directly by HR records the granter as the approver, because that is what it is. |

Two were fixed earlier, with the acceptance work: `gate_pass_minutes` (written under one name
and read under another by all six readers) and the comp-off credit's shift lookup (the
canonical `shifts` table, whose codes and columns can never match the shift master).

Writing the tests found one more defect that no field list named: the punch list ordered a
day's punches by their **displayed** time, which is a 12-hour clock string — so "1:00 PM"
sorted before "8:00 AM" and every day spanning morning and afternoon showed its punches out
of order, with the first punch of the day listed last. It orders by the instant now.
