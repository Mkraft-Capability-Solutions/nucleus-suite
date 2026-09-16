import "server-only";

import {
  SHIFT_DEFINITIONS,
  summarizeAttendanceTeam,
  summarizeToday,
} from "@/server/attendance/service";
import { listAttendanceDayRegister } from "@/server/attendance/day-register";
import { listOvertimeRegister } from "@/server/attendance/overtime-register";
import { listOperationalRecords } from "@/server/workflows/operational-service";
import type { Access } from "@/server/platform/access";
import { derived, ratio, round1, source, unsupported, type Source } from "./source";

/**
 * S3 — Attendance Intelligence.
 *
 * Every figure on this cockpit is read from a recorded attendance artefact: the
 * day rows behind `summarizeToday` / `summarizeAttendanceTeam`, the punch times
 * on the day register, the approved entries on the overtime register and the
 * published roster records. Where the platform does not record a quantity the
 * specification asks for — the required headcount per shift band is the one that
 * matters — this module reports the gap rather than deriving a number from a
 * rule nobody configured (DESIGN_SYSTEM.md section 9).
 */

/* -------------------------------------------------------------------------- */
/* Pure helpers (unit-tested in ./attendance-intelligence.test.ts)            */
/* -------------------------------------------------------------------------- */

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type MonthWindow = { key: string; label: string; from: string; to: string };

/**
 * The `count` calendar months ending with the month `today` falls in, oldest
 * first. Boundaries are calendar month starts and ends, so a window never
 * straddles two months and the trend's x-axis is comparable point to point.
 */
export function monthWindows(today: string, count: number): MonthWindow[] {
  const iso = today.slice(0, 10);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const windows: MonthWindow[] = [];
  for (let back = Math.max(0, count) - 1; back >= 0; back -= 1) {
    const first = new Date(Date.UTC(year, month - 1 - back, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const windowYear = first.getUTCFullYear();
    const windowMonth = first.getUTCMonth();
    windows.push({
      key: `${windowYear}-${String(windowMonth + 1).padStart(2, "0")}`,
      label: windowYear === year ? MONTH_LABELS[windowMonth] : `${MONTH_LABELS[windowMonth]} ${String(windowYear).slice(2)}`,
      from: first.toISOString().slice(0, 10),
      to: last.toISOString().slice(0, 10),
    });
  }
  return windows;
}

export type AttendanceCounts = { present: number; halfDay: number; absent: number };

/**
 * Attendance and absenteeism as percentages of the days that were actually
 * classified. Days nobody recorded are excluded from the denominator: an
 * unrecorded day is not an absence, and counting it as one would overstate
 * absenteeism. A half day counts as half a present day, matching the weighting
 * `summarizeToday` already applies.
 */
export function attendanceRates(counts: AttendanceCounts): {
  attendancePercent: number | null;
  absenteeismPercent: number | null;
  classifiedDays: number;
} {
  const classifiedDays = counts.present + counts.halfDay + counts.absent;
  return {
    attendancePercent: ratio(counts.present + counts.halfDay * 0.5, classifiedDays),
    absenteeismPercent: ratio(counts.absent, classifiedDays),
    classifiedDays,
  };
}

/**
 * Minutes since midnight from a stored clock reading. Accepts a bare `HH:MM`,
 * an `HH:MM:SS`, and a full timestamp, because the punch pipeline stores all
 * three shapes. An unreadable reading returns null so the caller drops the row
 * instead of treating it as midnight.
 */
export function clockMinutes(value: string | null | undefined): number | null {
  const raw = (value ?? "").trim();
  if (raw === "") return null;
  const match = /(?:^|[T ])(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export type Punctuality = "on_time" | "late";

/**
 * Whether a first-in punch beat its shift start plus the configured grace.
 *
 * The comparison is taken on the shorter way round the clock, so a night shift
 * that starts at 20:00 and is punched at 20:05 reads as five minutes late
 * rather than as most of a day early. Returns null when either clock is missing
 * or unreadable — an unknown punctuality is never counted as on time.
 */
export function punctualityOf(
  firstIn: string | null | undefined,
  shiftStart: string | null | undefined,
  graceMinutes = 0,
): Punctuality | null {
  const arrived = clockMinutes(firstIn);
  const starts = clockMinutes(shiftStart);
  if (arrived === null || starts === null) return null;
  let delta = arrived - starts;
  if (delta < -720) delta += 1440;
  if (delta > 720) delta -= 1440;
  const grace = Number.isFinite(graceMinutes) && graceMinutes > 0 ? graceMinutes : 0;
  return delta > grace ? "late" : "on_time";
}

/** Statutory watch bands for monthly overtime, per the cockpit specification. */
export const OVERTIME_WATCH_HOURS = 40;
export const OVERTIME_BREACH_HOURS = 60;

export type OvertimeBand = "within" | "watch" | "breach";

export function overtimeBand(hours: number): OvertimeBand {
  if (!Number.isFinite(hours)) return "within";
  if (hours > OVERTIME_BREACH_HOURS) return "breach";
  if (hours > OVERTIME_WATCH_HOURS) return "watch";
  return "within";
}

/** True when the roster record covers `day` and is live rather than a draft. */
export function rosterCoversDay(
  record: { status?: unknown; startDate?: unknown; endDate?: unknown },
  day: string,
): boolean {
  const status = String(record.status ?? "").toLowerCase();
  if (status !== "approved" && status !== "published") return false;
  const from = String(record.startDate ?? "").slice(0, 10);
  const to = String(record.endDate ?? "").slice(0, 10);
  if (from === "" || to === "") return false;
  return from <= day && to >= day;
}

/* -------------------------------------------------------------------------- */
/* Feed assembly                                                              */
/* -------------------------------------------------------------------------- */

const TREND_MONTHS = 6;

type UnknownRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? ""));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export type TrendPoint = { label: string; left: number; right: number };
export type RadarPoint = { axis: string; current: number; comparison: number };
export type OvertimeBurnRow = { label: string; hours: number; band: OvertimeBand; entries: number };
export type CoverageRow = {
  key: string;
  band: string;
  shiftCode: string;
  site: string;
  rostered: number;
  required: number | null;
  deficit: number | null;
};

export type AttendanceIntelligenceData = {
  period: { today: string; from: string; to: string; label: string; previousLabel: string };
  kpis: {
    presentToday: number | null;
    absentToday: number | null;
    notRecordedToday: number | null;
    headcount: number | null;
    lateToday: number | null;
    lateNote: string;
    overtimeHours: number | null;
    overtimeEntries: number;
    available: boolean;
    message?: string;
    origin: string;
  };
  trend: { points: TrendPoint[]; available: boolean; message?: string; origin: string; note: string };
  punctuality: {
    axes: RadarPoint[];
    groupedBy: "location" | "department";
    currentLabel: string;
    comparisonLabel: string;
    available: boolean;
    message?: string;
    origin: string;
    note: string;
  };
  overtime: { rows: OvertimeBurnRow[]; available: boolean; message?: string; origin: string; note: string };
  coverage: {
    rows: CoverageRow[];
    available: boolean;
    message?: string;
    origin: string;
    note: string;
    requirementNote: string;
  };
  unavailableSources: Array<{ name: string; message: string }>;
};

type ShiftReference = { startTime: string; graceInMinutes: number };

/** Shift start times: the tenant's own shift master first, the engine's built-in definitions after. */
function shiftReference(records: readonly UnknownRecord[]): Map<string, ShiftReference> {
  const reference = new Map<string, ShiftReference>();
  for (const [code, definition] of Object.entries(SHIFT_DEFINITIONS)) {
    reference.set(code.toUpperCase(), { startTime: definition.startsAt, graceInMinutes: 0 });
  }
  for (const record of records) {
    const code = text(record.shiftCode).toUpperCase();
    const startTime = text(record.startTime);
    if (code === "" || startTime === "") continue;
    reference.set(code, { startTime, graceInMinutes: Math.max(0, integer(record.graceInMinutes)) });
  }
  return reference;
}

type DayRow = { employee_id: string; shift_code: string | null; first_in: string | null; date: string | null };

type Tally = { onTime: number; late: number };

function punctualityByGroup(
  rows: readonly DayRow[],
  groupOf: (employeeId: string) => string | null,
  shifts: Map<string, ShiftReference>,
): Map<string, Tally> {
  const tallies = new Map<string, Tally>();
  for (const row of rows) {
    const group = groupOf(row.employee_id);
    if (!group) continue;
    const shift = shifts.get(text(row.shift_code).toUpperCase());
    if (!shift) continue;
    const verdict = punctualityOf(row.first_in, shift.startTime, shift.graceInMinutes);
    if (!verdict) continue;
    const tally = tallies.get(group) ?? { onTime: 0, late: 0 };
    if (verdict === "on_time") tally.onTime += 1;
    else tally.late += 1;
    tallies.set(group, tally);
  }
  return tallies;
}

export async function loadAttendanceIntelligence(
  access: Access,
  now: Date = new Date(),
): Promise<AttendanceIntelligenceData> {
  const todayIso = now.toISOString().slice(0, 10);
  const months = monthWindows(todayIso, TREND_MONTHS);
  const current = months[months.length - 1];
  const previous = months[months.length - 2] ?? current;
  const periodFrom = current?.from ?? todayIso;
  const periodTo = current?.to ?? todayIso;

  const emptyToday = { date: "", present: 0, halfDay: 0, onLeave: 0, absent: 0, notRecorded: 0, total: 0, percentPresent: null as number | null };
  const emptyTeam = {
    scope: { kind: "hierarchy" as const, rootEmployeeId: null as string | null, visibleEmployees: 0 },
    summary: { visibleEmployees: 0, recordedDays: 0, present: 0, halfDay: 0, absent: 0, other: 0, productiveMinutes: 0, payableOtMinutes: 0 },
    employees: [] as Array<{ id: string; department: string | null; location: string | null }>,
  };

  const [todaySource, monthlySource, teamSource, currentDaysSource, previousDaysSource, overtimeSource, shiftsSource, rostersSource] =
    await Promise.all([
      source(() => summarizeToday(access), emptyToday, "attendance_days for the current work date"),
      source(
        () => Promise.all(months.map((month) => summarizeAttendanceTeam(access, { from: month.from, to: month.to }))),
        [] as Array<Awaited<ReturnType<typeof summarizeAttendanceTeam>>>,
        `attendance_days, ${TREND_MONTHS} calendar months to ${periodTo}`,
      ),
      source(
        () => summarizeAttendanceTeam(access, { from: periodFrom, to: periodTo }),
        emptyTeam as unknown as Awaited<ReturnType<typeof summarizeAttendanceTeam>>,
        "employees in the caller's attendance scope",
      ),
      source(
        () => listAttendanceDayRegister(access, { employeeId: null, from: periodFrom, to: periodTo, search: "" }),
        [],
        `attendance_entries punches, ${periodFrom} to ${periodTo}`,
      ),
      source(
        () => listAttendanceDayRegister(access, { employeeId: null, from: previous.from, to: previous.to, search: "" }),
        [],
        `attendance_entries punches, ${previous.from} to ${previous.to}`,
      ),
      source(() => listOvertimeRegister(access, { search: "", location: null, orgUnit: null, period: null }), [], "overtime_entries approved register"),
      source(
        () => listOperationalRecords(access, "shifts", new URLSearchParams({ pageSize: "100" })),
        { items: [], nextCursor: null },
        "shift master (operations/shifts)",
      ),
      source(
        () => listOperationalRecords(access, "rosters", new URLSearchParams({ pageSize: "100" })),
        { items: [], nextCursor: null },
        "published rosters (operations/rosters)",
      ),
    ]);

  const shiftRecords = shiftsSource.value.items as unknown as UnknownRecord[];
  const rosterRecords = rostersSource.value.items as unknown as UnknownRecord[];
  const shifts = shiftReference(shiftRecords);

  /* --- KPI strip ------------------------------------------------------- */

  const currentDays = currentDaysSource.value as unknown as DayRow[];
  const todayRows = currentDays.filter((row) => text(row.date).slice(0, 10) === todayIso);
  let lateToday: number | null = null;
  let lateNote =
    "No punch rows are recorded for today, so lateness cannot be counted. It is derived from the first-in punch against the assigned shift start plus its configured grace.";
  if (currentDaysSource.available && todayRows.length > 0) {
    let late = 0;
    let assessed = 0;
    for (const row of todayRows) {
      const shift = shifts.get(text(row.shift_code).toUpperCase());
      if (!shift) continue;
      const verdict = punctualityOf(row.first_in, shift.startTime, shift.graceInMinutes);
      if (!verdict) continue;
      assessed += 1;
      if (verdict === "late") late += 1;
    }
    if (assessed > 0) {
      lateToday = late;
      lateNote = `First-in punch after shift start plus grace, across ${assessed} assessable punch row(s) dated ${todayIso}.`;
    } else {
      lateNote = `${todayRows.length} punch row(s) are dated ${todayIso} but none carries both a readable first-in time and a known shift start, so lateness cannot be counted.`;
    }
  }

  const overtimeRows = overtimeSource.value;
  const periodOvertime = overtimeRows.filter((row) => {
    const date = text(row.date).slice(0, 10);
    return date >= periodFrom && date <= periodTo;
  });
  const overtimeMinutes = periodOvertime.reduce((total, row) => total + Math.max(0, row.overtime_minutes ?? 0), 0);

  /* --- Trend ------------------------------------------------------------ */

  const monthly = monthlySource.value;
  const trendPoints: TrendPoint[] = [];
  monthly.forEach((summary, index) => {
    const window = months[index];
    if (!window) return;
    const rates = attendanceRates({
      present: summary.summary.present,
      halfDay: summary.summary.halfDay,
      absent: summary.summary.absent,
    });
    if (rates.classifiedDays === 0 || rates.attendancePercent === null || rates.absenteeismPercent === null) return;
    trendPoints.push({ label: window.label, left: rates.attendancePercent, right: rates.absenteeismPercent });
  });

  /* --- Punctuality radar ------------------------------------------------ */

  const employees = teamSource.value.employees;
  const locationOf = new Map<string, string>();
  const departmentOf = new Map<string, string>();
  for (const employee of employees) {
    const location = text(employee.location);
    const department = text(employee.department);
    if (location !== "") locationOf.set(employee.id, location);
    if (department !== "") departmentOf.set(employee.id, department);
  }
  const groupedBy: "location" | "department" = locationOf.size > 0 ? "location" : "department";
  const index = groupedBy === "location" ? locationOf : departmentOf;
  const groupOf = (employeeId: string) => index.get(employeeId) ?? null;

  const currentTallies = punctualityByGroup(currentDays, groupOf, shifts);
  const previousTallies = punctualityByGroup(previousDaysSource.value as unknown as DayRow[], groupOf, shifts);

  const axes: RadarPoint[] = [...currentTallies.entries()]
    .map(([label, tally]) => {
      const previousTally = previousTallies.get(label);
      const currentPercent = ratio(tally.onTime, tally.onTime + tally.late);
      const comparisonPercent = previousTally ? ratio(previousTally.onTime, previousTally.onTime + previousTally.late) : null;
      return { label, currentPercent, comparisonPercent, observations: tally.onTime + tally.late };
    })
    .filter((entry) => entry.currentPercent !== null && entry.comparisonPercent !== null)
    .sort((a, b) => b.observations - a.observations)
    .slice(0, 6)
    .map((entry) => ({ axis: entry.label, current: entry.currentPercent as number, comparison: entry.comparisonPercent as number }));

  const punctualityNote =
    groupedBy === "location"
      ? "Grouped by the site recorded on each employee record. On-time means the first-in punch fell at or before the assigned shift start plus its configured grace."
      : "Attendance rows carry no site or location, so punctuality is grouped by department instead. On-time means the first-in punch fell at or before the assigned shift start plus its configured grace.";

  /* --- Overtime burn by department -------------------------------------- */

  const burn = new Map<string, { minutes: number; entries: number }>();
  for (const row of periodOvertime) {
    const department = departmentOf.get(row.employee_id) ?? "Department not recorded";
    const bucket = burn.get(department) ?? { minutes: 0, entries: 0 };
    bucket.minutes += Math.max(0, row.overtime_minutes ?? 0);
    bucket.entries += 1;
    burn.set(department, bucket);
  }
  const overtimeBurn: OvertimeBurnRow[] = [...burn.entries()]
    .map(([label, bucket]) => {
      const hours = round1(bucket.minutes / 60) ?? 0;
      return { label, hours, band: overtimeBand(hours), entries: bucket.entries };
    })
    .sort((a, b) => b.hours - a.hours);

  /* --- Shift coverage --------------------------------------------------- */

  const coverage = new Map<string, { band: string; shiftCode: string; site: string; employees: Set<string> }>();
  for (const record of rosterRecords) {
    if (!rosterCoversDay(record, todayIso)) continue;
    const startTime = text(record.startTime);
    const endTime = text(record.endTime);
    const shiftCode = text(record.shiftCode) || "Not recorded";
    const site = text(record.site) || "Not recorded";
    const band = startTime && endTime ? `${startTime}–${endTime}` : "Times not recorded";
    const key = `${band}|${shiftCode}|${site}`;
    const bucket = coverage.get(key) ?? { band, shiftCode, site, employees: new Set<string>() };
    bucket.employees.add(text(record.employeeId) || text(record.id));
    coverage.set(key, bucket);
  }
  const coverageRows: CoverageRow[] = [...coverage.entries()]
    .map(([key, bucket]) => ({
      key,
      band: bucket.band,
      shiftCode: bucket.shiftCode,
      site: bucket.site,
      rostered: bucket.employees.size,
      required: null,
      deficit: null,
    }))
    .sort((a, b) => a.band.localeCompare(b.band));

  /* --- Envelope --------------------------------------------------------- */

  const feeds: Record<string, Source<unknown>> = {
    attendanceToday: todaySource,
    monthlyAttendance: monthlySource,
    attendanceScope: teamSource,
    punchesThisPeriod: currentDaysSource,
    punchesPreviousPeriod: previousDaysSource,
    overtimeRegister: overtimeSource,
    shiftMaster: shiftsSource,
    rosters: rostersSource,
  };
  const unavailableSources = Object.entries(feeds)
    .filter(([, feed]) => !feed.available)
    .map(([name, feed]) => ({ name, message: feed.message ?? "This source is unavailable for your role." }));

  const trendFeed = monthlySource.available
    ? derived(trendPoints, monthlySource.origin ?? "attendance_days")
    : unsupported(trendPoints, monthlySource.message ?? "Monthly attendance could not be read.");
  const punctualityAvailable = currentDaysSource.available && previousDaysSource.available && teamSource.available;
  const coverageAvailable = rostersSource.available;

  return {
    period: {
      today: todayIso,
      from: periodFrom,
      to: periodTo,
      label: current?.label ?? todayIso.slice(0, 7),
      previousLabel: previous?.label ?? "",
    },
    kpis: {
      presentToday: todaySource.available ? todaySource.value.present + todaySource.value.halfDay : null,
      absentToday: todaySource.available ? todaySource.value.absent : null,
      notRecordedToday: todaySource.available ? todaySource.value.notRecorded : null,
      headcount: todaySource.available ? todaySource.value.total : null,
      lateToday,
      lateNote,
      overtimeHours: overtimeSource.available ? round1(overtimeMinutes / 60) : null,
      overtimeEntries: periodOvertime.length,
      available: todaySource.available,
      message: todaySource.message,
      origin: todaySource.origin ?? "attendance_days",
    },
    trend: {
      points: trendFeed.value,
      available: trendFeed.available,
      message: trendFeed.message,
      origin: monthlySource.origin ?? "attendance_days",
      note: `Recorded attendance days, ${TREND_MONTHS} calendar months to ${periodTo}. Only months carrying classified day rows are plotted; a month with no records is omitted rather than drawn at zero.`,
    },
    punctuality: {
      axes,
      groupedBy,
      currentLabel: current?.label ?? "This period",
      comparisonLabel: previous?.label ?? "Previous period",
      available: punctualityAvailable,
      message: punctualityAvailable
        ? undefined
        : (currentDaysSource.message ?? previousDaysSource.message ?? teamSource.message ?? "Punch data could not be read."),
      origin: "attendance_entries first-in punches against the shift master",
      note: punctualityNote,
    },
    overtime: {
      rows: overtimeBurn,
      available: overtimeSource.available,
      message: overtimeSource.message,
      origin: overtimeSource.origin ?? "overtime_entries",
      note: `Approved and pending overtime entries dated ${periodFrom} to ${periodTo}, attributed to the department on each employee's record. Watch band above ${OVERTIME_WATCH_HOURS}h, breach above ${OVERTIME_BREACH_HOURS}h per month.`,
    },
    coverage: {
      rows: coverageRows,
      available: coverageAvailable,
      message: rostersSource.message,
      origin: rostersSource.origin ?? "operations/rosters",
      note: `Approved and published roster records covering ${todayIso}, counted by distinct rostered employee.`,
      requirementNote:
        "Required headcount per shift band has no source: neither the roster record nor the shift master carries a manning requirement, so no deficit is shown. Only the rostered figure is a measurement.",
    },
    unavailableSources,
  };
}
