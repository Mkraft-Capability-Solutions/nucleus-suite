import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ACCEPTANCE_DEPARTMENT,
  accessFor,
  addDays,
  at,
  createScenarioEmployee,
  db,
  DESIGNATIONS,
  LIVE,
  removeScenarioRows,
  SHIFTS,
  tenantId,
  type ScenarioEmployee,
} from "@/server/acceptance/fixture";
import type { Access } from "@/server/platform/access";

/**
 * Client acceptance scenarios T-01 … T-05 and T-24 … T-27 (attendance, RL-01 … RL-04 and
 * RL-16 … RL-19), run live against the seeded `mkraft` tenant.
 *
 * Every scenario does its own setup through the real service functions, using employees
 * created under its own `T-nn` code prefix, and asserts the workbook's Expected result
 * as stated. Where a scenario depends on a value the seed leaves unset (Q-06 exempt grade
 * rank, F-SHF-03 night-extension times) the test asserts the engine's named refusal
 * instead of a guessed outcome.
 *
 * Run: MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/acceptance/attendance.acceptance.test.ts
 * after `npx tsx scripts/seed-acceptance-demo.ts`.
 */

// The db client reads DATABASE_URL when its module is first evaluated and the fixture's
// dotenv call only runs after static imports resolve, so the services load lazily.
type Services = {
  attendance: typeof import("@/server/attendance/service");
  breaks: typeof import("@/server/attendance/break-register");
  history: typeof import("@/server/attendance/team-history-register");
  shifts: typeof import("@/server/attendance/shift-master");
  policy: typeof import("@/server/attendance/attendance-policy");
  dossier: typeof import("@/server/workflows/dossier-service");
  operational: typeof import("@/server/workflows/operational-service");
  lifecycle: typeof import("@/server/lifecycle/service");
  rules: typeof import("@/lib/hr-rules");
};

const TIMEOUT = 120_000;
const PREFIXES = ["T-01", "T-02", "T-03", "T-04", "T-05", "T-24", "T-25", "T-26", "T-27"] as const;
/**
 * Scenario dates sit after the seed's run date: the grace and night-extension
 * policies are read as in force on the day processed, so a policy published today
 * must already be effective on every scenario day. T-05 keeps the workbook's own
 * January-to-March range, which reads no policy beyond the stated grace.
 */
const GOLDEN_DAY = "2026-10-08";
/** Shift code the T-27 overlap probe tries to save; removed afterwards if the save was not refused. */
const OVERLAP_PROBE_SHIFT = "T27X";

const BIOMETRIC = "biometric_device" as const;

let api: Services;
let owner: Access;

type Punch = { at: string; type: "in" | "out"; source: typeof BIOMETRIC };
const punch = (type: "in" | "out", date: string, time: string): Punch => ({ at: at(date, time), type, source: BIOMETRIC });

/** A punch at a minute-of-day on `date`, rolling to the next date when the minute passes midnight. */
function punchAtMinute(type: "in" | "out", date: string, minute: number): Punch {
  const dayOffset = Math.floor(minute / 1440);
  const clock = minute % 1440;
  const time = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
  return punch(type, addDays(date, dayOffset), time);
}

/** The golden RL-01 session: IN 08:00, OUT 20:30, IN 21:15, OUT 03:20 next day. */
function goldenSession(day1: string): Punch[] {
  const day2 = addDays(day1, 1);
  return [punch("in", day1, "08:00"), punch("out", day1, "20:30"), punch("in", day1, "21:15"), punch("out", day2, "03:20")];
}

async function ingest(employee: ScenarioEmployee, workDate: string, shiftCode: string, punches: Punch[]) {
  return api.attendance.ingestPunches(owner, { employeeId: employee.id, workDate, shiftCode, punches }, crypto.randomUUID());
}

/** The attendance day row for one date, found through the service rather than assumed from ingest. */
async function dayIdFor(employee: ScenarioEmployee, date: string): Promise<string> {
  const days = await api.attendance.listDays(owner, { employeeId: employee.id, from: date, to: date, page: 1, pageSize: 5 });
  const found = (days.items as Array<{ id: string; work_date: string }>).find((row) => row.work_date === date);
  if (!found) throw new Error(`No attendance day was opened for ${employee.code} on ${date}; ingest attributed the punches elsewhere.`);
  return found.id;
}

/** Ingests one full-length day and recomputes it, returning the persisted trace. */
async function recordDay(employee: ScenarioEmployee, date: string, shiftCode: string, punches: Punch[]) {
  await ingest(employee, date, shiftCode, punches);
  const dayId = await dayIdFor(employee, date);
  return api.attendance.recomputeDay(owner, dayId, crypto.randomUUID());
}

type EntryRow = { date: string; status: string; shift_assigned: string | null; shift_applied: string | null; detected_shift: string | null; shift_override_reason: string | null; late_mark_applied: string | null };

async function attendanceEntries(employee: ScenarioEmployee): Promise<EntryRow[]> {
  return (await db()`
    select attributes->>'date' as date, attributes->>'status' as status, attributes->>'shift_assigned' as shift_assigned,
      attributes->>'shift_applied' as shift_applied, attributes->>'detected_shift' as detected_shift,
      attributes->>'shift_override_reason' as shift_override_reason, attributes->>'late_mark_applied' as late_mark_applied
    from attendance_entries where tenant_id = ${await tenantId()} and employee_id = ${employee.id}
    order by attributes->>'date'
  `) as EntryRow[];
}

async function attendanceDayRows(employee: ScenarioEmployee): Promise<Array<{ date: string; status: string; detected_shift: string | null }>> {
  return (await db()`
    select attendance_date::text as date, status, detected_shift from attendance_days
    where tenant_id = ${await tenantId()} and employee_id = ${employee.id} order by attendance_date
  `) as Array<{ date: string; status: string; detected_shift: string | null }>;
}

/**
 * Rows the fixture's `removeScenarioRows` cannot reach: `attendance_breaks` and
 * `employee_assignments` carry no `employee_id`, and their RESTRICT foreign keys would
 * otherwise stop the session, event and employment deletes it attempts.
 */
async function removeScenarioChildren(test: string): Promise<void> {
  const tenant = await tenantId();
  const client = db();
  const prefix = `${test}-%`;
  await client`
    delete from attendance_breaks b using attendance_sessions s, employees e
    where b.tenant_id = ${tenant} and s.tenant_id = ${tenant} and s.id = b.attendance_session_id
      and e.tenant_id = ${tenant} and e.id = s.employee_id and e.employee_code like ${prefix}
  `;
  await client`
    delete from employee_assignments a using employments em, employees e
    where a.tenant_id = ${tenant} and em.tenant_id = ${tenant} and em.id = a.employment_id
      and e.tenant_id = ${tenant} and e.id = em.employee_id and e.employee_code like ${prefix}
  `;
}

async function removeOverlapProbeShift(): Promise<void> {
  const tenant = await tenantId();
  const client = db();
  await client`
    delete from hrms_operation_events where tenant_id = ${tenant} and record_id in (
      select id from hrms_operation_records where tenant_id = ${tenant} and resource = 'shifts' and data->>'shiftCode' = ${OVERLAP_PROBE_SHIFT})
  `;
  await client`delete from hrms_operation_records where tenant_id = ${tenant} and resource = 'shifts' and data->>'shiftCode' = ${OVERLAP_PROBE_SHIFT}`;
}

describe.skipIf(!LIVE)("Attendance acceptance scenarios — live (opt-in)", () => {
  beforeAll(async () => {
    const [attendance, breaks, history, shifts, policy, dossier, operational, lifecycle, rules] = await Promise.all([
      import("@/server/attendance/service"),
      import("@/server/attendance/break-register"),
      import("@/server/attendance/team-history-register"),
      import("@/server/attendance/shift-master"),
      import("@/server/attendance/attendance-policy"),
      import("@/server/workflows/dossier-service"),
      import("@/server/workflows/operational-service"),
      import("@/server/lifecycle/service"),
      import("@/lib/hr-rules"),
    ]);
    api = { attendance, breaks, history, shifts, policy, dossier, operational, lifecycle, rules };
    owner = await accessFor("owner");
  }, TIMEOUT);

  afterAll(async () => {
    await removeOverlapProbeShift();
    for (const prefix of PREFIXES) {
      await removeScenarioChildren(prefix);
      await removeScenarioRows(prefix);
    }
  }, TIMEOUT);

  it("T-01 Work session crossing midnight is one session", { timeout: TIMEOUT }, async () => {
    const employee = await createScenarioEmployee({ test: "T-01" });
    const day1 = GOLDEN_DAY;
    const day2 = addDays(day1, 1);

    const ingested = await ingest(employee, day1, SHIFTS.A, goldenSession(day1));
    expect(ingested.attributedDates).toContain(day1);

    const computed = await api.attendance.recomputeDay(owner, await dayIdFor(employee, day1), crypto.randomUUID());
    expect(computed.trace, computed.reason).not.toBeNull();
    // Gross work hours 19:20, break 45 minutes, day status Present.
    expect(computed.trace?.grossSpanMinutes).toBe(1160);
    expect(computed.trace?.breakMinutes).toBe(45);
    expect(computed.day.computedStatus).toBe("Present");

    // One attendance record, on day 1.
    const entries = await attendanceEntries(employee);
    expect(entries.map((row) => row.date)).toEqual([day1]);
    expect(entries[0].status).toBe("Present");
    const days = await attendanceDayRows(employee);
    expect(days.find((row) => row.date === day1)?.status).toBe("present");
    // Day 2 is not marked absent.
    const secondDay = days.find((row) => row.date === day2);
    if (secondDay) expect(secondDay.status).not.toBe("absent");
  });

  it("T-02 Break appears in the break register", { timeout: TIMEOUT }, async () => {
    const employee = await createScenarioEmployee({ test: "T-02" });
    const day1 = GOLDEN_DAY;
    await ingest(employee, day1, SHIFTS.A, goldenSession(day1));
    await api.attendance.recomputeDay(owner, await dayIdFor(employee, day1), crypto.randomUUID());

    const rows = await api.breaks.listBreakRegister(owner, { employeeId: employee.id, from: day1, to: day1, breakType: null, search: "" });
    // One row: start 20:30, end 21:15, 45 minutes, break type Meal or Unclassified.
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.attendance_date).toBe(day1);
    expect(api.rules.punchClockToMinutes(row.break_start_time ?? "")).toBe(20 * 60 + 30);
    expect(api.rules.punchClockToMinutes(row.break_end_time ?? "")).toBe(21 * 60 + 15);
    expect(row.break_minutes).toBe(45);
    expect(row.break_label).toBe("0:45");
    expect(["Meal", "Unclassified"]).toContain(row.break_type);
  });

  it("T-03 OT is computed on gross hours", { timeout: TIMEOUT }, async () => {
    const employee = await createScenarioEmployee({ test: "T-03" });
    const day1 = GOLDEN_DAY;
    await ingest(employee, day1, SHIFTS.A, goldenSession(day1));
    const computed = await api.attendance.recomputeDay(owner, await dayIdFor(employee, day1), crypto.randomUUID());
    expect(computed.trace, computed.reason).not.toBeNull();
    // OT hours 7:20 for an employee eligible on all days.
    expect(computed.trace?.otPolicy).toBe("all-days");
    expect(computed.trace?.otEligible).toBe(true);
    expect(computed.trace?.overtimeMinutes).toBe(440);
    expect(computed.trace?.payableOtMinutes).toBe(440);
  });

  it("T-04 OT suppressed on a working day for rest-day-only employees", { timeout: TIMEOUT }, async () => {
    // Rest-day applicability comes from the employment category (RL-05 second level);
    // the OT eligibility basis is set on the employee record (RL-05 first level).
    const employee = await createScenarioEmployee({ test: "T-04", workerCategory: "regular" });
    const tenant = await tenantId();
    const client = db();
    const employmentId = await api.lifecycle.ensureEmployment(owner, employee.id);
    const [department] = (await client`select id from departments where tenant_id = ${tenant} order by created_at limit 1`) as Array<{ id: string }>;
    const [position] = (await client`select id from positions where tenant_id = ${tenant} order by created_at limit 1`) as Array<{ id: string }>;
    const [location] = (await client`select id from locations where tenant_id = ${tenant} order by created_at limit 1`) as Array<{ id: string }>;
    expect(department && position && location, "the tenant needs a department, a position and a location for an assignment").toBeTruthy();
    await api.dossier.saveDossier(owner, "assignments", {
      key: crypto.randomUUID(),
      input: {
        employmentId,
        departmentId: department.id,
        positionId: position.id,
        locationId: location.id,
        overrideOtEligibility: "rest_day_and_holiday_only",
        effectiveFrom: "2024-01-15",
        reason: `T-04 acceptance: OT eligibility basis rest days and holidays only (${ACCEPTANCE_DEPARTMENT})`,
      },
    });

    // The golden session on a working day (Thursday): OT hours zero.
    const workingDay = GOLDEN_DAY;
    await ingest(employee, workingDay, SHIFTS.A, goldenSession(workingDay));
    const working = await api.attendance.recomputeDay(owner, await dayIdFor(employee, workingDay), crypto.randomUUID());
    expect(working.trace, working.reason).not.toBeNull();
    expect(working.trace?.dayType).toBe("working");
    expect(working.trace?.otPolicy).toBe("rest-holiday-only");
    expect(working.trace?.overtimeMinutes).toBe(440);
    expect(working.trace?.otEligible).toBe(false);
    expect(working.trace?.payableOtMinutes).toBe(0);

    // The same employee working a rest day (Sunday) earns OT normally.
    const restDay = "2026-10-11";
    await ingest(employee, restDay, SHIFTS.A, goldenSession(restDay));
    const rest = await api.attendance.recomputeDay(owner, await dayIdFor(employee, restDay), crypto.randomUUID());
    expect(rest.trace, rest.reason).not.toBeNull();
    expect(rest.trace?.dayType).toBe("rest_day");
    expect(rest.trace?.otEligible).toBe(true);
    expect(rest.trace?.payableOtMinutes).toBe(440);
  });

  it("T-05 Team calendar range spans more than one month", { timeout: TIMEOUT }, async () => {
    const reportee = await createScenarioEmployee({ test: "T-05", firstName: "Reportee" });
    const outsider = await createScenarioEmployee({ test: "T-05", firstName: "Outsider", managerCode: null });
    const from = "2026-01-01";
    const to = "2026-03-15";
    const recorded = ["2026-01-05", "2026-03-10"];
    for (const date of recorded) {
      const computed = await recordDay(reportee, date, SHIFTS.A, [punch("in", date, "08:00"), punch("out", date, "20:00")]);
      expect(computed.day.computedStatus).toBe("Present");
    }

    // As the reporting manager, from 01 January to 15 March.
    const manager = await accessFor("supervisor");
    const rows = await api.history.listTeamHistory(manager, { from, to, search: "" });
    const teamRow = rows.find((row) => row.employee_id === reportee.id);
    expect(teamRow, "the reportee is listed for the manager").toBeDefined();
    expect(teamRow?.present_days).toBe(2);
    // A non-reportee cannot be selected.
    expect(rows.some((row) => row.employee_id === outsider.id)).toBe(false);
    await expect(api.history.getTeamHistoryRecord(manager, outsider.id, { from, to })).rejects.toMatchObject({ code: "NOT_FOUND" });

    // History returns for the full range, and the export (the record's aggregate) matches the screen (its day rows).
    const detail = await api.history.getTeamHistoryRecord(manager, reportee.id, { from, to });
    expect(detail.range).toEqual({ from, to });
    expect(detail.days.map((day) => day.date)).toEqual(recorded);
    expect(detail.record.present_days).toBe(detail.days.filter((day) => String(day.status).toLowerCase() === "present").length);
    expect(detail.record).toMatchObject({ employee_id: reportee.id, present_days: 2, absent_days: 0 });
    expect(detail.record.present_days).toBe(teamRow?.present_days);
  });

  it("T-24 Shift thresholds produce the right day status", { timeout: TIMEOUT }, async () => {
    // RL-16: 12-hour half day below 11:30, absent below 6:30; 10-hour 9:30 / 6:00;
    // 9-hour 8:30 / 5:00; 8-hour 7:30 / 4:30. The 12-hour round uses the workbook's own
    // 11:45, 11:00 and 6:00; the other rounds use the same offsets against their thresholds.
    const rounds: Array<{ code: string; halfDayBelow: number; absentBelow: number; net: [number, number, number] }> = [
      { code: SHIFTS.A, halfDayBelow: 11 * 60 + 30, absentBelow: 6 * 60 + 30, net: [11 * 60 + 45, 11 * 60, 6 * 60] },
      { code: SHIFTS.D10, halfDayBelow: 9 * 60 + 30, absentBelow: 6 * 60, net: [9 * 60 + 45, 9 * 60, 5 * 60 + 30] },
      { code: SHIFTS.E9, halfDayBelow: 8 * 60 + 30, absentBelow: 5 * 60, net: [8 * 60 + 45, 8 * 60, 4 * 60 + 30] },
      { code: SHIFTS.C, halfDayBelow: 7 * 60 + 30, absentBelow: 4 * 60 + 30, net: [7 * 60 + 45, 7 * 60, 4 * 60] },
    ];
    const expected = ["Present", "Half day", "Absent"] as const;
    const dates = ["2026-10-06", "2026-10-07", "2026-10-08"];

    for (const round of rounds) {
      const shift = await api.shifts.resolveShift(owner, round.code);
      expect(shift.thresholds, `thresholds on shift ${round.code}`).toEqual({ halfDayBelowMinutes: round.halfDayBelow, absentBelowMinutes: round.absentBelow });
      const start = shift.startMinute ?? 8 * 60;
      const employee = await createScenarioEmployee({ test: "T-24", lastName: `T-24 ${round.code}` });
      for (const [index, net] of round.net.entries()) {
        const date = dates[index];
        await ingest(employee, date, round.code, [punchAtMinute("in", date, start), punchAtMinute("out", date, start + net)]);
        const traced = await api.attendance.traceDay(owner, await dayIdFor(employee, date));
        expect(traced.trace, `${round.code} at ${net} minutes: ${traced.reason ?? ""}`).not.toBeNull();
        expect(traced.trace?.shiftCode, `${round.code} was processed on its own shift`).toBe(round.code);
        expect(traced.trace?.netMinutes).toBe(net);
        expect(traced.day.computedStatus, `${round.code} at ${net} net minutes`).toBe(expected[index]);
      }
    }
  });

  it("T-25 Grace, late count and grade exemption (refuses ATTENDANCE_POLICY_INCOMPLETE while the Q-06 exempt rank is unset)", { timeout: TIMEOUT }, async () => {
    const operator = await createScenarioEmployee({ test: "T-25", designation: "operator", lastName: "Operator" });
    const assistantManager = await createScenarioEmployee({ test: "T-25", designation: "assistantManager", lastName: "AsstMgr" });
    const graceDay = "2026-10-01";
    const lateDays = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
    const nextMonthDay = "2026-11-02";
    // The pack the engine reads for these days: policies are in force from their effective date.
    const policy = await api.policy.loadAttendancePolicy(owner, lateDays[0]);
    const fullDay = (date: string, arrival: string) => [punch("in", date, arrival), punch("out", date, "20:30")];

    // 08:10 on an 08:00 shift is within grace for both.
    for (const employee of [operator, assistantManager]) {
      const computed = await recordDay(employee, graceDay, SHIFTS.A, fullDay(graceDay, "08:10"));
      expect(computed.trace?.minutesLate).toBe(10);
      expect(computed.trace?.lateMarkApplied).toBe(false);
      expect(computed.day.computedStatus).toBe("Present");
    }

    if (policy.graceLate.exemptFromGradeRank === null) {
      // Q-06: the exempt grade rank has no approved value, so a late beyond grace is refused
      // rather than judged against a guessed rank — for the non-exempt employee too.
      for (const employee of [operator, assistantManager]) {
        await ingest(employee, lateDays[0], SHIFTS.A, fullDay(lateDays[0], "08:20"));
        await expect(api.attendance.recomputeDay(owner, await dayIdFor(employee, lateDays[0]), crypto.randomUUID()))
          .rejects.toMatchObject({ code: "ATTENDANCE_POLICY_INCOMPLETE" });
      }
      return;
    }

    expect(DESIGNATIONS.operator.level).toBeLessThan(policy.graceLate.exemptFromGradeRank);
    expect(DESIGNATIONS.assistantManager.level).toBeGreaterThanOrEqual(policy.graceLate.exemptFromGradeRank);

    // 08:20 four times: the fourth late gives the non-exempt employee a half day.
    for (const [index, date] of lateDays.entries()) {
      const computed = await recordDay(operator, date, SHIFTS.A, fullDay(date, "08:20"));
      expect(computed.trace?.minutesLate).toBe(20);
      expect(computed.trace?.lateMarkApplied).toBe(true);
      expect(computed.trace?.lateCountInMonth).toBe(index + 1);
      expect(computed.day.computedStatus, `operator late ${index + 1}`).toBe(index < 3 ? "Present" : "Half day");
    }
    // The Assistant Manager is unaffected by the same four lates.
    for (const date of lateDays) {
      const computed = await recordDay(assistantManager, date, SHIFTS.A, fullDay(date, "08:20"));
      expect(computed.trace?.minutesLate).toBe(20);
      expect(computed.trace?.lateMarkApplied).toBe(false);
      expect(computed.day.computedStatus).toBe("Present");
    }
    // The counter resets on the first of the next month.
    const reset = await recordDay(operator, nextMonthDay, SHIFTS.A, fullDay(nextMonthDay, "08:20"));
    expect(reset.trace?.lateMarkApplied).toBe(true);
    expect(reset.trace?.lateCountInMonth).toBe(1);
    expect(reset.day.computedStatus).toBe("Present");
  });

  it("T-26 Night extension gives a full day (refuses ATTENDANCE_POLICY_INCOMPLETE while the F-SHF-03 times are unset)", { timeout: TIMEOUT }, async () => {
    const employee = await createScenarioEmployee({ test: "T-26" });
    const day1 = "2026-10-14";
    const day2 = addDays(day1, 1);
    // F-SHF-03 rules are published per shift; the one covering A on day 2 is what the engine reads.
    const rule = api.policy.nightExtensionForShift(await api.policy.loadAttendancePolicy(owner, day2), SHIFTS.A);
    expect(rule, `a published night extension rule must cover shift ${SHIFTS.A}`).not.toBeNull();

    // Work to 03:20; then arrive 09:15 the next day and work to 20:00.
    await ingest(employee, day1, SHIFTS.A, [punch("in", day1, "08:00"), punch("out", day2, "03:20")]);
    await ingest(employee, day2, SHIFTS.A, [punch("in", day2, "09:15"), punch("out", day2, "20:00")]);
    const firstDay = await api.attendance.recomputeDay(owner, await dayIdFor(employee, day1), crypto.randomUUID());
    expect(firstDay.trace, firstDay.reason).not.toBeNull();
    expect(firstDay.trace?.grossSpanMinutes).toBe(1160);
    const secondDayId = await dayIdFor(employee, day2);

    const configured = rule !== null
      && rule.triggerAfterMinute !== null
      && rule.permittedArrivalUntilMinute !== null
      && rule.minimumDepartureMinute !== null;
    if (!configured) {
      await expect(api.attendance.recomputeDay(owner, secondDayId, crypto.randomUUID())).rejects.toMatchObject({ code: "ATTENDANCE_POLICY_INCOMPLETE" });
      return;
    }

    const secondDay = await api.attendance.recomputeDay(owner, secondDayId, crypto.randomUUID());
    expect(secondDay.trace, secondDay.reason).not.toBeNull();
    expect(secondDay.trace?.grossSpanMinutes).toBe(10 * 60 + 45);
    // Full day, no late mark, no grace deduction.
    expect(secondDay.trace?.nightExtensionApplied).toBe(true);
    expect(secondDay.trace?.minutesLate).toBe(75);
    expect(secondDay.trace?.lateMarkApplied).toBe(false);
    expect(secondDay.day.computedStatus).toBe("Present");
    const entries = await attendanceEntries(employee);
    expect(entries.find((row) => row.date === day2)).toMatchObject({ status: "Present", late_mark_applied: "false" });
  });

  it("T-27 Shift detected from the in-punch", { timeout: TIMEOUT }, async () => {
    const employee = await createScenarioEmployee({ test: "T-27" });
    const day1 = "2026-10-20";
    const day2 = addDays(day1, 1);

    // Rostered to A, punches in at 20:05.
    await ingest(employee, day1, SHIFTS.A, [punch("in", day1, "20:05"), punch("out", day2, "08:05")]);
    const computed = await api.attendance.recomputeDay(owner, await dayIdFor(employee, day1), crypto.randomUUID());
    expect(computed.trace, computed.reason).not.toBeNull();
    // Processed on B shift.
    expect(computed.trace?.rosteredShift).toBe(SHIFTS.A);
    expect(computed.trace?.detectedShift).toBe(SHIFTS.B);
    expect(computed.trace?.shiftCode).toBe(SHIFTS.B);
    expect(computed.day.computedStatus).toBe("Present");
    // The override is recorded.
    expect(computed.trace?.detectionReason).toContain(`${SHIFTS.B} detection window`);
    const days = await attendanceDayRows(employee);
    expect(days.find((row) => row.date === day1)?.detected_shift).toBe(SHIFTS.B);
    const entry = (await attendanceEntries(employee)).find((row) => row.date === day1);
    expect(entry).toMatchObject({ shift_assigned: SHIFTS.A, shift_applied: SHIFTS.B, detected_shift: SHIFTS.B });
    expect(entry?.shift_override_reason).toBeTruthy();

    // Detection windows across shifts do not overlap.
    const records = await api.shifts.listShiftMaster(owner);
    const windowed = records.filter((record) => record.detectionLabel !== null);
    expect(windowed.map((record) => record.code)).toEqual(expect.arrayContaining([SHIFTS.A, SHIFTS.B]));
    const candidates = windowed.map((record) => {
      const [earliestIn, latestIn] = (record.detectionLabel ?? "").split("–");
      return { code: record.code, earliestIn, latestIn };
    });
    expect(() => api.shifts.assertDetectionWindowsDoNotOverlap(candidates)).not.toThrow();

    // A shift whose window overlaps B's is refused on save.
    const nightWindow = candidates.find((candidate) => candidate.code === SHIFTS.B);
    expect(nightWindow).toBeDefined();
    await expect(api.operational.mutateOperationalRecord(owner, "shifts", {
      action: "create",
      key: crypto.randomUUID(),
      input: {
        shiftCode: OVERLAP_PROBE_SHIFT,
        name: "T-27 overlap probe",
        shiftGroup: ACCEPTANCE_DEPARTMENT,
        startTime: "20:00",
        endTime: "08:00",
        durationMinutes: 720,
        graceInMinutes: 15,
        graceOutMinutes: 15,
        breakMinutes: 45,
        fullDayMinutes: 720,
        halfDayMinutes: 690,
        absentBelowMinutes: 390,
        earliestIn: nightWindow?.earliestIn,
        latestIn: nightWindow?.latestIn,
        autoDetectEnabled: true,
        otEligible: "yes",
        otBasis: "gross_minutes",
        otAfterMinutes: 720,
        nightAllowanceEligible: false,
        status: "active",
      },
    })).rejects.toMatchObject({ code: "SHIFT_WINDOW_OVERLAP" });
  });
});
