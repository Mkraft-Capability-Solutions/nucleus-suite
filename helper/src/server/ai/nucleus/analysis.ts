import "server-only";

import { z } from "zod";
import { isServerTool, type ServerTool } from "@/lib/ai/nucleus-tools";
import { dedupeExits, shiftMonths } from "@/server/cockpits/people-command-centre";
import { countBy, derived, ratio, round1, source, unsupported, type Source } from "@/server/cockpits/source";
import { summarizeAttendanceTeam } from "@/server/attendance/service";
import { getBalances, listLeaveRequests } from "@/server/leave/service";
import { listClearanceBoard, type ClearanceBoardRow } from "@/server/lifecycle/clearance-board";
import { listPeopleDirectory, getPeopleCoreSummary, type DirectoryRow } from "@/server/organization/directory";
import { getWorkforceOverview } from "@/server/organization/service";
import { listLatestRunAnomalies, listRuns } from "@/server/payroll/service";
import { enforce, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { capabilityByDepartment } from "@/server/skills/service";

/**
 * The read half of Nucleus AI.
 *
 * Everything here is a projection of feeds the cockpits already assemble, over
 * a window the caller names ("the last six months") instead of the fixed window
 * a cockpit page uses. The maths is not restated: `shiftMonths`, `ratio`,
 * `countBy` and `dedupeExits` are the same functions the People Command Centre
 * is measured by, so a figure spoken by the assistant and the same figure read
 * off the console cannot disagree.
 *
 * The one rule that governs every function below: a number with no source is
 * reported as missing with the reason named. `ratio` returns null rather than
 * dividing by zero, `source` degrades a failed feed to `available: false` with
 * a sentence the assistant can say out loud, and nothing here substitutes a
 * zero. A calculated zero asserts that nothing happened; an unavailable feed
 * asserts only that nobody has supplied the data. Those are different claims
 * and the assistant must not be able to confuse them.
 */

/* -------------------------------------------------------------------------- */
/* Window helpers (pure, unit-tested)                                          */
/* -------------------------------------------------------------------------- */

export const MIN_MONTHS = 1;
export const MAX_MONTHS = 24;

/** Keeps a spoken window inside a range the feeds can actually answer for. */
export function clampMonths(months: unknown): number {
  // `Number(null)` and `Number("")` are 0, which would clamp to one month and
  // quietly answer a different question than the one that was asked. An absent
  // window means unspecified, not zero.
  if (months === null || months === undefined || months === "") return 6;
  const value = Number(months);
  if (!Number.isFinite(value)) return 6;
  return Math.min(Math.max(Math.trunc(value), MIN_MONTHS), MAX_MONTHS);
}

/** The trailing `months` calendar months ending with the month of `today`, oldest first. */
export function trailingMonths(today: string, months: number): string[] {
  const labels: string[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    labels.push(shiftMonths(today, -offset).slice(0, 7));
  }
  return labels;
}

export type Window = { from: string; to: string; months: string[]; monthCount: number };

export function windowFor(today: string, months: number): Window {
  const monthCount = clampMonths(months);
  const labels = trailingMonths(today, monthCount);
  return {
    // Start at the first day of the oldest month in the window, so "six months"
    // means six whole months rather than a date-to-date span that clips one.
    from: `${labels[0]}-01`,
    to: today,
    months: labels,
    monthCount,
  };
}

/** Counts records into `YYYY-MM` buckets, ignoring anything without a usable date. */
export function bucketByMonth(values: readonly (string | null | undefined)[], months: readonly string[]): Record<string, number> {
  const allowed = new Set(months);
  const buckets: Record<string, number> = Object.fromEntries(months.map((month) => [month, 0]));
  for (const value of values) {
    const month = (value ?? "").slice(0, 7);
    if (month.length === 7 && allowed.has(month)) buckets[month] += 1;
  }
  return buckets;
}

/**
 * Re-creates closing headcount per month by walking today's roster backwards
 * through joiner and leaver records. The platform stores no historical
 * headcount snapshot, so this is a derivation; it is labelled as one in the
 * payload so the assistant can say so.
 */
export function headcountByMonth(
  months: readonly string[],
  joiners: Readonly<Record<string, number>>,
  leavers: Readonly<Record<string, number>>,
  closing: number,
): Array<{ month: string; headcount: number; joiners: number; leavers: number }> {
  const ordered = [...months].sort();
  const closings = new Array<number>(ordered.length);
  let running = closing;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    closings[index] = Math.max(0, running);
    running = running - (joiners[ordered[index]] ?? 0) + (leavers[ordered[index]] ?? 0);
  }
  return ordered.map((month, index) => ({
    month,
    headcount: closings[index],
    joiners: joiners[month] ?? 0,
    leavers: leavers[month] ?? 0,
  }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Directory sample the assistant is allowed to read back, trimmed for the wire. */
const DIRECTORY_MATCH_CAP = 10;
const LEAVE_PAGE_SIZE = 100;
const RUN_PAGE_SIZE = 50;

/* -------------------------------------------------------------------------- */
/* Tool arguments                                                              */
/* -------------------------------------------------------------------------- */

const monthsArgs = z.object({ months: z.unknown().optional() });
const scopedMonthsArgs = z.object({ months: z.unknown().optional(), employeeId: z.string().trim().min(1).max(100).optional() });
const findEmployeeArgs = z.object({ query: z.string().trim().min(1).max(120) });

/* -------------------------------------------------------------------------- */
/* Workforce                                                                   */
/* -------------------------------------------------------------------------- */

export async function workforceAnalysis(access: Access, months: number) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const window = windowFor(today(), months);

  const [core, overview, clearance] = await Promise.all([
    source(() => getPeopleCoreSummary(access), null, "People Core roster count"),
    source(() => getWorkforceOverview(access), { total: 0, joinerCounts: [], headcount: [], openPositions: 0 }, "Employee joining records"),
    source(() => listClearanceBoard(access, ""), [] as ClearanceBoardRow[], "Exit clearance board, last working day"),
  ]);

  const activeHeadcount = core.value ? core.value.activeEmployees : null;
  const joiners = bucketByMonth(
    overview.value.joinerCounts.flatMap((row) => Array.from({ length: row.count }, () => `${row.month}-01`)),
    window.months,
  );

  const exits = dedupeExits(clearance.value);
  const datedExits = exits.filter((exit) => (exit.lastWorkingDay ?? "").length >= 10);
  const leavers = bucketByMonth(datedExits.map((exit) => exit.lastWorkingDay), window.months);
  const exitsInWindow = Object.values(leavers).reduce((total, count) => total + count, 0);
  const joinersInWindow = Object.values(joiners).reduce((total, count) => total + count, 0);

  let separation: Source<number | null>;
  if (!clearance.available) {
    separation = unsupported<number | null>(null, clearance.message ?? "The exit clearance board is unavailable for your role.");
  } else if (exits.length === 0) {
    separation = unsupported<number | null>(null, "No exit clearance case exists for this tenant, so no leaver can be dated and a separation rate cannot be measured.");
  } else if (datedExits.length === 0) {
    separation = unsupported<number | null>(null, "Exit cases exist but none carries a last working day, so no leaver falls inside a measurable window.");
  } else if (activeHeadcount === null) {
    separation = unsupported<number | null>(null, "The active roster count is unavailable, so a separation rate has no denominator.");
  } else {
    separation = derived(
      round1(ratio(exitsInWindow, activeHeadcount + exitsInWindow)),
      `${exitsInWindow} dated exit(s) against ${activeHeadcount} active employees, ${window.from} to ${window.to}`,
    );
  }

  const trend = activeHeadcount === null && !overview.available
    ? unsupported<Array<{ month: string; headcount: number; joiners: number; leavers: number }>>([], "Neither the roster count nor the joining records resolved, so a headcount trend cannot be derived.")
    : derived(
      headcountByMonth(window.months, joiners, leavers, activeHeadcount ?? overview.value.total),
      "Derived by walking today's roster back through joining dates and dated exits; the platform stores no historical headcount snapshot.",
    );

  return {
    window,
    activeHeadcount: core.available ? derived(activeHeadcount, "People Core roster count") : core,
    joiners: derived(joinersInWindow, `Employee joining dates inside ${window.from} to ${window.to}`),
    leavers: clearance.available ? derived(exitsInWindow, "Dated last working days on exit clearance cases") : clearance,
    separationRatePercent: separation,
    headcountTrend: trend,
    byDepartment: overview.available
      ? derived(overview.value.headcount.map((row) => ({ department: row.name ?? "Unassigned", headcount: row.headcount })).slice(0, 12), "Employee department field")
      : overview,
    openPositions: overview.available ? derived(overview.value.openPositions, "Positions not filled, archived or inactive") : overview,
  };
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                  */
/* -------------------------------------------------------------------------- */

export async function attendanceAnalysis(access: Access, months: number, employeeId?: string) {
  const window = windowFor(today(), months);
  const team = await source(
    () => summarizeAttendanceTeam(access, { from: window.from, to: window.to }),
    null,
    `Attendance days, ${window.from} to ${window.to}`,
  );
  if (!team.available || team.value === null) {
    return { window, employeeId: employeeId ?? null, summary: team };
  }

  const scoped = employeeId ? team.value.employees.filter((employee) => employee.id === employeeId) : team.value.employees;
  if (employeeId && scoped.length === 0) {
    return {
      window,
      employeeId,
      summary: unsupported(null, "That employee is outside the attendance scope your role is granted, so no day can be counted."),
    };
  }

  const totals = scoped.reduce(
    (running, employee) => ({
      recordedDays: running.recordedDays + employee.recordedDays,
      present: running.present + employee.present,
      halfDay: running.halfDay + employee.halfDay,
      absent: running.absent + employee.absent,
      other: running.other + employee.other,
      productiveMinutes: running.productiveMinutes + employee.productiveMinutes,
      payableOtMinutes: running.payableOtMinutes + employee.payableOtMinutes,
    }),
    { recordedDays: 0, present: 0, halfDay: 0, absent: 0, other: 0, productiveMinutes: 0, payableOtMinutes: 0 },
  );

  return {
    window,
    employeeId: employeeId ?? null,
    scope: team.value.scope,
    employeesCounted: scoped.length,
    summary: derived(totals, `attendance_days rows between ${window.from} and ${window.to}`),
    // Null, not zero, when nothing was recorded: no attendance day at all is
    // not the same statement as a day recorded and marked absent.
    presentRatePercent: derived(round1(ratio(totals.present, totals.recordedDays)), `${totals.present} present of ${totals.recordedDays} recorded day(s)`),
    absenceRatePercent: derived(round1(ratio(totals.absent, totals.recordedDays)), `${totals.absent} absent of ${totals.recordedDays} recorded day(s)`),
    overtimeHours: derived(round1(totals.payableOtMinutes / 60), "Sum of payable overtime minutes on attendance days"),
  };
}

/* -------------------------------------------------------------------------- */
/* Leave                                                                       */
/* -------------------------------------------------------------------------- */

type LeaveRow = { leave_type: string | null; status: string | null; starts_on: string | null; requested_days: number | null };

export async function leaveAnalysis(access: Access, months: number, employeeId?: string) {
  const window = windowFor(today(), months);
  const requests = await source(
    () => listLeaveRequests(access, { employeeId: employeeId ?? null, status: null, page: 1, pageSize: LEAVE_PAGE_SIZE }),
    { items: [] as unknown, total: 0 },
    `Leave requests, most recent ${LEAVE_PAGE_SIZE}`,
  );
  if (!requests.available) return { window, employeeId: employeeId ?? null, requests };

  const rows = (requests.value.items as LeaveRow[]).filter((row) => (row.starts_on ?? "") >= window.from && (row.starts_on ?? "") <= window.to);
  const pending = rows.filter((row) => (row.status ?? "").toLowerCase() === "submitted" || (row.status ?? "").toLowerCase() === "pending");
  const daysRequested = rows.reduce((total, row) => total + (Number(row.requested_days) || 0), 0);

  const balances = employeeId
    ? await source(() => getBalances(access, employeeId), null, "Leave ledger balances as at today")
    : unsupported(null, "Balances are reported for one named employee; name the person to see them.");

  return {
    window,
    employeeId: employeeId ?? null,
    // The service returns a page, so say so: a tenant with more than the cap has
    // a truncated reading and the assistant must not present it as the total.
    sampleCapped: requests.value.total > LEAVE_PAGE_SIZE,
    totalRecorded: requests.value.total,
    inWindow: derived(rows.length, `Leave requests starting between ${window.from} and ${window.to}`),
    daysRequested: derived(round1(daysRequested), "Sum of requested days on those requests"),
    pending: derived(pending.length, "Requests still awaiting a decision"),
    byType: derived(countBy(rows, (row) => row.leave_type), "Leave type on the request"),
    byStatus: derived(countBy(rows, (row) => row.status), "Status on the request"),
    balances,
  };
}

/* -------------------------------------------------------------------------- */
/* Payroll                                                                     */
/* -------------------------------------------------------------------------- */

type RunRow = { period: string | null; status: string | null; employee_count: number | null };
type AnomalyRow = { rule_code: string | null; severity: string | null; status: string | null };

export async function payrollAnalysis(access: Access, months: number) {
  const window = windowFor(today(), months);
  const [runs, anomalies] = await Promise.all([
    source(() => listRuns(access, { period: null, status: null, scope: null, page: 1, pageSize: RUN_PAGE_SIZE }), { items: [] as unknown, total: 0 }, "Payroll runs"),
    source(() => listLatestRunAnomalies(access), [] as unknown, "Payroll anomalies on the most recent run"),
  ]);
  if (!runs.available) return { window, runs };

  const oldestMonth = window.months[0];
  const rows = (runs.value.items as RunRow[]).filter((row) => (row.period ?? "") >= oldestMonth);
  const anomalyRows = anomalies.available ? (anomalies.value as AnomalyRow[]) : [];

  return {
    window,
    runsInWindow: derived(rows.length, `Payroll runs with a period from ${oldestMonth} onward`),
    byStatus: derived(countBy(rows, (row) => row.status), "Payroll run status"),
    byPeriod: derived(rows.map((row) => ({ period: row.period, status: row.status, employees: row.employee_count })).slice(0, 12), "Payroll run header"),
    anomalies: anomalies.available
      ? derived(
        {
          total: anomalyRows.length,
          open: anomalyRows.filter((row) => (row.status ?? "").toLowerCase() === "open").length,
          bySeverity: countBy(anomalyRows, (row) => row.severity),
          byRule: countBy(anomalyRows, (row) => row.rule_code).slice(0, 8),
        },
        "payroll_anomalies on the most recent run (first 20)",
      )
      : anomalies,
  };
}

/* -------------------------------------------------------------------------- */
/* Capability                                                                  */
/* -------------------------------------------------------------------------- */

export async function capabilityAnalysis(access: Access) {
  const capability = await source(() => capabilityByDepartment(access), [] as unknown, "Verified skill evidence by department");
  return {
    byDepartment: capability.available
      ? derived(capability.value as Array<{ name: string | null; value: number }>, "Verified skill evidence rows grouped by employee department")
      : capability,
  };
}

/* -------------------------------------------------------------------------- */
/* Focus areas                                                                 */
/* -------------------------------------------------------------------------- */

export type FocusItem = { area: string; observation: string; measure: number; records: number; origin: string };
export type FocusGap = { area: string; reason: string };

/**
 * Ranks what deserves attention using only signals the platform recorded.
 *
 * A feed that did not resolve produces a `gap`, never a healthy-looking absence
 * of findings. That distinction is the whole point of the section: "nothing is
 * wrong here" and "nobody has told us anything about here" must not render the
 * same way, on screen or out loud.
 */
/**
 * Reads one availability envelope out of an analysis payload.
 *
 * Each analysis returns early with a smaller shape when its own feed failed, so
 * the payloads are unions. Rather than narrow each one at every use, this reads
 * the field if it is there and treats an absent field the same as an
 * unavailable one — which, for the purpose of ordering focus areas, it is.
 */
function readSource<T>(payload: unknown, key: string): Source<T> | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = (payload as Record<string, unknown>)[key];
  if (!candidate || typeof candidate !== "object" || !("available" in candidate)) return null;
  return candidate as Source<T>;
}

function numberFrom(entry: Source<number> | null): number {
  return entry?.available && typeof entry.value === "number" ? entry.value : 0;
}

export async function focusAreas(access: Access, months: number) {
  const window = windowFor(today(), months);
  const [workforce, attendance, leave, payroll] = await Promise.all([
    workforceAnalysis(access, window.monthCount).catch(() => null),
    attendanceAnalysis(access, window.monthCount).catch(() => null),
    leaveAnalysis(access, window.monthCount).catch(() => null),
    payrollAnalysis(access, window.monthCount).catch(() => null),
  ]);

  const items: FocusItem[] = [];
  const gaps: FocusGap[] = [];

  const separation = readSource<number | null>(workforce, "separationRatePercent");
  if (separation?.available && typeof separation.value === "number") {
    items.push({
      area: "Attrition",
      observation: `Separation rate of ${separation.value}% over the window`,
      measure: separation.value,
      records: numberFrom(readSource<number>(workforce, "leavers")),
      origin: separation.origin ?? "Exit clearance cases",
    });
  } else {
    gaps.push({ area: "Attrition", reason: separation?.message ?? "No separation rate could be measured for this window." });
  }

  const absence = readSource<number | null>(attendance, "absenceRatePercent");
  const attendanceSummary = readSource<{ recordedDays: number } | null>(attendance, "summary");
  if (absence?.available && typeof absence.value === "number") {
    items.push({
      area: "Absence",
      observation: `Absence on ${absence.value}% of recorded attendance days`,
      measure: absence.value,
      records: attendanceSummary?.value?.recordedDays ?? 0,
      origin: absence.origin ?? "Attendance days",
    });
  } else {
    gaps.push({
      area: "Absence",
      reason: attendanceSummary?.message ?? "No attendance day was recorded in the window, so absence cannot be measured.",
    });
  }

  const pending = readSource<number>(leave, "pending");
  if (pending?.available) {
    if (pending.value > 0) {
      items.push({
        area: "Leave queue",
        observation: `${pending.value} leave request(s) still awaiting a decision`,
        measure: pending.value,
        records: pending.value,
        origin: pending.origin ?? "Leave requests",
      });
    }
  } else {
    gaps.push({ area: "Leave queue", reason: "Leave requests are unavailable for your role, so the queue cannot be sized." });
  }

  const anomalies = readSource<{ open: number; total: number }>(payroll, "anomalies");
  if (anomalies?.available) {
    if (anomalies.value.open > 0) {
      items.push({
        area: "Payroll exceptions",
        observation: `${anomalies.value.open} open anomaly finding(s) on the most recent run`,
        measure: anomalies.value.open,
        records: anomalies.value.total,
        origin: anomalies.origin ?? "Payroll anomalies",
      });
    }
  } else {
    gaps.push({ area: "Payroll exceptions", reason: "Payroll anomalies are unavailable for your role, so open findings cannot be counted." });
  }

  const openPositions = readSource<number>(workforce, "openPositions");
  if (openPositions?.available && openPositions.value > 0) {
    items.push({
      area: "Open positions",
      observation: `${openPositions.value} sanctioned position(s) unfilled`,
      measure: openPositions.value,
      records: openPositions.value,
      origin: openPositions.origin ?? "Positions register",
    });
  }

  return {
    window,
    // Rank by the size of the recorded signal. There is no severity weighting
    // here on purpose: the platform records no severity for most of these, and
    // inventing one would be exactly the kind of figure this module refuses.
    items: items.sort((first, second) => second.measure - first.measure),
    gaps,
  };
}

/* -------------------------------------------------------------------------- */
/* Directory lookup                                                            */
/* -------------------------------------------------------------------------- */

export async function findEmployee(access: Access, query: string) {
  const directory = await source(() => listPeopleDirectory(access, query), [] as DirectoryRow[], "People Core directory");
  if (!directory.available) return { query, matches: directory };
  const matches = directory.value.slice(0, DIRECTORY_MATCH_CAP).map((row) => ({
    id: row.id,
    employeeCode: row.employee_code,
    name: `${row.first_name} ${row.last_name}`.trim(),
    designation: row.designation,
    department: row.department,
    status: row.status,
  }));
  return {
    query,
    matchCount: directory.value.length,
    // The model is told to ask rather than choose; saying so in the payload as
    // well keeps that behaviour when the instruction is far up the context.
    ambiguous: matches.length > 1,
    matches: derived(matches, "People Core directory search"),
  };
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                    */
/* -------------------------------------------------------------------------- */

export async function runNucleusTool(access: Access, tool: string, args: unknown): Promise<unknown> {
  if (!isServerTool(tool)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Tool '${tool}' is not a Nucleus AI analysis tool.` });
  }
  const named: ServerTool = tool;
  switch (named) {
    case "workforce_analysis":
      return workforceAnalysis(access, clampMonths(monthsArgs.parse(args ?? {}).months));
    case "attendance_analysis": {
      const parsed = scopedMonthsArgs.parse(args ?? {});
      return attendanceAnalysis(access, clampMonths(parsed.months), parsed.employeeId);
    }
    case "leave_analysis": {
      const parsed = scopedMonthsArgs.parse(args ?? {});
      return leaveAnalysis(access, clampMonths(parsed.months), parsed.employeeId);
    }
    case "payroll_analysis":
      return payrollAnalysis(access, clampMonths(monthsArgs.parse(args ?? {}).months));
    case "capability_analysis":
      return capabilityAnalysis(access);
    case "focus_areas":
      return focusAreas(access, clampMonths(monthsArgs.parse(args ?? {}).months));
    case "find_employee":
      return findEmployee(access, findEmployeeArgs.parse(args ?? {}).query);
  }
}
