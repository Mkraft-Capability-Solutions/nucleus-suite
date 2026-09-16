import "server-only";

import {
  getActiveShiftAssignment,
  getCurrentSession,
  listMonthlyTimesheet,
} from "@/server/attendance/engine-console";
import { sqlClient } from "@/lib/db";
import { listDays, summarizeAttendanceTeam } from "@/server/attendance/service";
import { listBalanceCards } from "@/server/leave/engine-console";
import { getBalances } from "@/server/leave/service";
import { listMyLearning } from "@/server/learning/my-learning";
import { getEmployee } from "@/server/organization/service";
import { listPayslips } from "@/server/payroll/payslips";
import { loadObjectiveTree } from "@/server/performance/okr";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { listOperationalRecords } from "@/server/workflows/operational-service";
import { addDays, mondayOf, weekLabel } from "./manager-cockpit";
import { derived, ratio, round1, source, unsupported, type Source } from "./source";

/**
 * S8 Employee Home aggregation.
 *
 * S8 is the only `audience: "employee"` cockpit and every figure on it is SELF
 * scoped: the subject is always `access.context.employeeId` and never a value
 * supplied by the caller, so this endpoint cannot be pointed at a colleague.
 * An account with no employee link gets an explicit, non-crashing answer
 * rather than a tenant-wide view.
 *
 * The one place another person appears is the reporting line, and it is drawn
 * from the caller's OWN employee record: the manager is `manager_employee_id`,
 * and the pod is the colleagues who share that manager. Presence is attached
 * to a pod member only where the attendance service already makes that
 * person's attendance visible to this account; everybody else reads as no
 * reading rather than as absent.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Weeks drawn on the personal attendance heatmap. */
export const ATTENDANCE_WEEKS = 8;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* -------------------------------------------------------------------------- */
/* Pure helpers (unit tested in employee-home.test.ts)                        */
/* -------------------------------------------------------------------------- */

/**
 * Normalises a stored punch instant into a real ISO instant.
 *
 * `getCurrentSession` formats its timestamp with postgres `OF`, which emits a
 * two-digit offset ("+05"). `new Date()` rejects that, so the missing minutes
 * are restored before parsing. Anything unparseable returns null so the caller
 * disables the punch action instead of posting a bad instant.
 */
export function toInstant(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (raw === "") return null;
  const normalised = /[+-]\d{2}$/.test(raw) ? `${raw}:00` : raw;
  const parsed = new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Length of an assigned shift in minutes, from its stored "HH:MM" boundaries. */
export function shiftTargetMinutes(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): number | null {
  const clock = /^(\d{1,2}):(\d{2})/;
  const start = clock.exec((startsAt ?? "").trim());
  const end = clock.exec((endsAt ?? "").trim());
  if (!start || !end) return null;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  const endMinutes = Number(end[1]) * 60 + Number(end[2]);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
  // Identical boundaries carry no length. Reading them as a 24-hour shift would
  // quietly halve the gauge, so they are reported as no target at all.
  if (endMinutes === startMinutes) return null;
  const span = endMinutes > startMinutes ? endMinutes - startMinutes : endMinutes + 1440 - startMinutes;
  return span > 0 && span < 1440 ? span : null;
}

/** The seven ISO dates of the week beginning `monday`. */
export function weekDates(monday: string): string[] {
  return WEEKDAYS.map((_, index) => addDays(monday, index));
}

export type AttendanceMatrix = { rows: string[]; columns: string[]; values: Array<Array<number | null>> };

/**
 * Weeks down, weekdays across, hours worked in each cell. A day with no
 * attendance reading stays null — the heatmap prints an em dash rather than a
 * zero that would read as "worked nothing".
 */
export function buildAttendanceMatrix(
  firstMonday: string,
  weekCount: number,
  hoursByDate: ReadonlyMap<string, number>,
): AttendanceMatrix {
  if (!DATE_PATTERN.test(firstMonday) || weekCount <= 0) {
    return { rows: [], columns: [], values: [] };
  }
  const rows: string[] = [];
  const values: Array<Array<number | null>> = [];
  for (let week = 0; week < weekCount; week += 1) {
    const monday = addDays(firstMonday, week * 7);
    rows.push(weekLabel(monday));
    values.push(weekDates(monday).map((date) => hoursByDate.get(date) ?? null));
  }
  return { rows, columns: [...WEEKDAYS], values };
}

export type PeriodPick<T> = { payslip: T | null; isCurrentPeriod: boolean };

/**
 * The payslip to show. The current period wins when the engine has produced
 * it; otherwise the most recent released period is shown and the caller must
 * label it. Nothing is ever extrapolated onto a period the engine has not run.
 */
export function pickPayslip<T extends { period: string }>(
  payslips: readonly T[],
  currentPeriod: string,
): PeriodPick<T> {
  const current = payslips.find((row) => row.period === currentPeriod);
  if (current) return { payslip: current, isCurrentPeriod: true };
  const newest = [...payslips].sort((left, right) => right.period.localeCompare(left.period))[0];
  return { payslip: newest ?? null, isCurrentPeriod: false };
}

/** The `YYYY-MM` periods a date range touches, oldest first. */
export function periodsCovering(fromISO: string, toISO: string): string[] {
  if (!DATE_PATTERN.test(fromISO) || !DATE_PATTERN.test(toISO) || fromISO > toISO) return [];
  const periods: string[] = [];
  let year = Number(fromISO.slice(0, 4));
  let month = Number(fromISO.slice(5, 7));
  const last = toISO.slice(0, 7);
  for (let guard = 0; guard < 24; guard += 1) {
    const period = `${year}-${String(month).padStart(2, "0")}`;
    periods.push(period);
    if (period >= last) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return periods;
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                    */
/* -------------------------------------------------------------------------- */

export type ShiftPanel = {
  shiftCode: string | null;
  shiftName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  targetMinutes: number | null;
  workedMinutes: number | null;
  breakMinutes: number | null;
  punchedInAt: string | null;
  sessionOpen: boolean;
};

export type LeaveRing = { label: string; value: number; max?: number };

export type PayPanel = {
  period: string;
  periodLabel: string;
  isCurrentPeriod: boolean;
  displayCode: string;
  currency: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  state: string;
};

export type WeekPanel = {
  weekStart: string;
  days: Array<{ date: string; weekday: string; minutes: number | null }>;
  totalMinutes: number;
  targetMinutes: number | null;
  targetBasis: string | null;
  projects: Array<{ label: string; minutes: number }>;
};

export type GoalRow = {
  id: string;
  title: string;
  progressPct: number | null;
  health: string;
  keyResultCount: number;
};

export type LearningRow = {
  id: string;
  courseTitle: string;
  stateLabel: string;
  dueDate: string | null;
  overdue: boolean;
  daysOverdue: number | null;
  pathLabel: string;
};

export type PodMember = {
  employeeId: string;
  name: string;
  designation: string;
  /**
   * null when this account may not see that colleague's attendance, or when
   * attendance has recorded nothing for them today. Never false by default:
   * an unknown reading must not render as "not present".
   */
  presentToday: boolean | null;
};

/** One colleague sharing the caller's reporting manager. */
type PeerRow = {
  id: string;
  employee_code: string;
  first_name: string | null;
  last_name: string | null;
  designation: string | null;
};

type ManagerRow = { id: string; name: string | null; employee_code: string };

/** The caller's peer group has a ceiling; a very wide span is truncated, not invented. */
export const POD_LIMIT = 60;

/**
 * The caller's reporting manager and their PEERS — the colleagues reporting to
 * the same manager.
 *
 * This used to reuse the attendance team scope, which is the recursive
 * SUBORDINATE set: always empty for an individual contributor, and for a
 * manager it is their team rather than their pod. Peers are derived from the
 * caller's own `manager_employee_id`, so an employee with no manager recorded
 * has no derivable peer group and gets an empty list rather than a wrong one.
 *
 * Only directory-level fields are read (name, code, designation). No peer's
 * attendance, pay or leave is read here.
 */
async function loadReportingLine(
  access: Access,
  employeeId: string,
): Promise<{ manager: { employeeId: string | null; name: string } | null; peers: PeerRow[] }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [managerRows, peerRows] = await tenantTx(access, [
    sqlClient`
      select manager.id,
             nullif(trim(coalesce(manager.first_name, '') || ' ' || coalesce(manager.last_name, '')), '') as name,
             manager.employee_code
      from employees self
      join employees manager on manager.tenant_id = self.tenant_id and manager.id = self.manager_employee_id
      where self.tenant_id = ${access.tenantId} and self.id = ${employeeId}
      limit 1
    `,
    sqlClient`
      select peer.id, peer.employee_code, peer.first_name, peer.last_name, peer.designation
      from employees peer
      join employees self on self.tenant_id = peer.tenant_id and self.id = ${employeeId}
      where peer.tenant_id = ${access.tenantId}
        and peer.status = 'active'
        and peer.id <> ${employeeId}
        and self.manager_employee_id is not null
        and peer.manager_employee_id = self.manager_employee_id
      order by peer.employee_code asc
      limit ${POD_LIMIT}
    `,
  ]);
  const manager = (managerRows as ManagerRow[])[0];
  return {
    manager: manager ? { employeeId: manager.id, name: manager.name ?? manager.employee_code } : null,
    peers: peerRows as PeerRow[],
  };
}

export type EmployeeHomeData = {
  linked: boolean;
  message: string | null;
  employeeId: string | null;
  today: string;
  period: string;
  profile: Source<{ name: string; employeeCode: string; designation: string; department: string; location: string } | null>;
  shift: Source<ShiftPanel>;
  leave: Source<{ rings: LeaveRing[]; totalAvailable: number }>;
  pay: Source<PayPanel | null>;
  week: Source<WeekPanel>;
  attendance: Source<AttendanceMatrix>;
  goals: Source<GoalRow[]>;
  learning: Source<LearningRow[]>;
  reportingLine: Source<{ manager: { employeeId: string | null; name: string } | null; pod: PodMember[] }>;
  unavailableSources: Array<{ name: string; message: string }>;
};

const NO_LINK_MESSAGE =
  "No employee record is linked to this account, so there is nothing personal to show. Ask your HR administrator to link the account to your employee profile.";

function unlinked(today: string, period: string): EmployeeHomeData {
  const reason = unsupported(null, NO_LINK_MESSAGE);
  return {
    linked: false,
    message: NO_LINK_MESSAGE,
    employeeId: null,
    today,
    period,
    profile: reason,
    shift: unsupported(
      {
        shiftCode: null,
        shiftName: null,
        startsAt: null,
        endsAt: null,
        targetMinutes: null,
        workedMinutes: null,
        breakMinutes: null,
        punchedInAt: null,
        sessionOpen: false,
      },
      NO_LINK_MESSAGE,
    ),
    leave: unsupported({ rings: [], totalAvailable: 0 }, NO_LINK_MESSAGE),
    pay: unsupported(null, NO_LINK_MESSAGE),
    week: unsupported(
      { weekStart: mondayOf(today), days: [], totalMinutes: 0, targetMinutes: null, targetBasis: null, projects: [] },
      NO_LINK_MESSAGE,
    ),
    attendance: unsupported({ rows: [], columns: [], values: [] }, NO_LINK_MESSAGE),
    goals: unsupported([], NO_LINK_MESSAGE),
    learning: unsupported([], NO_LINK_MESSAGE),
    reportingLine: unsupported({ manager: null, pod: [] }, NO_LINK_MESSAGE),
    unavailableSources: [{ name: "employee link", message: NO_LINK_MESSAGE }],
  };
}

type PayslipPage = Awaited<ReturnType<typeof listPayslips>>;
type MyLearningQueue = Awaited<ReturnType<typeof listMyLearning>>;
type ObjectiveTree = Awaited<ReturnType<typeof loadObjectiveTree>>;
type TeamSummary = Awaited<ReturnType<typeof summarizeAttendanceTeam>>;

export async function buildEmployeeHome(
  access: Access,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<EmployeeHomeData> {
  const period = today.slice(0, 7);
  const employeeId = access.context.employeeId ?? null;
  if (!employeeId) return unlinked(today, period);

  const weekStart = mondayOf(today);
  const firstMonday = addDays(weekStart, -7 * (ATTENDANCE_WEEKS - 1));

  const [
    profileFeed,
    sessionFeed,
    shiftFeed,
    daysFeed,
    timesheetFeed,
    balanceFeed,
    payslipFeed,
    weekEntriesFeed,
    allocationFeed,
    goalFeed,
    learningFeed,
    teamFeed,
    reportingFeed,
  ] = await Promise.all([
    source(() => getEmployee(access, employeeId), null as Awaited<ReturnType<typeof getEmployee>> | null, "employees"),
    source(
      () => getCurrentSession(access, employeeId),
      { employeeId, checkedInAt: null as string | null, elapsedMinutes: null as number | null, open: false },
      "attendance_sessions",
    ),
    source(
      () => getActiveShiftAssignment(access, employeeId),
      { shiftCode: null as string | null, shiftName: null as string | null, startsAt: null as string | null, endsAt: null as string | null, graceMinutes: null as number | null },
      "shift_assignments",
    ),
    source(
      () => listDays(access, { employeeId, from: firstMonday, to: today, page: 1, pageSize: 100 }),
      { items: [] as unknown[], total: 0 },
      "attendance_days",
    ),
    source(() => listMonthlyTimesheet(access, employeeId, period), [] as Array<{ date: string; grossMinutes: number | null }>, "attendance_entries"),
    source(() => listBalanceCards(access, employeeId), [] as Awaited<ReturnType<typeof listBalanceCards>>, "leave_ledger_entries"),
    source(
      () => listPayslips(access, { employeeId, page: 1, pageSize: 12 }),
      { items: [], total: 0, scope: "self" } as unknown as PayslipPage,
      "payslips",
    ),
    source(
      () => listOperationalRecords(access, "timesheets", new URLSearchParams({ page: "1", pageSize: "100", employeeId })),
      { items: [] as unknown[], nextCursor: null as string | null },
      "/api/v1/operations/timesheets",
    ),
    source(
      () => listOperationalRecords(access, "allocations", new URLSearchParams({ page: "1", pageSize: "100", employeeId })),
      { items: [] as unknown[], nextCursor: null as string | null },
      "/api/v1/operations/allocations",
    ),
    source(() => loadObjectiveTree(access), { nodes: [], keyResults: [], weightChecks: [], thresholdsConfigured: false, thresholds: null, healthNote: "" } as unknown as ObjectiveTree, "objectives"),
    source(
      () => listMyLearning(access, { page: 1, pageSize: 25, today }),
      { items: [], total: 0 } as unknown as MyLearningQueue,
      "enrollments",
    ),
    source(
      () => summarizeAttendanceTeam(access, { from: today, to: today }),
      { scope: { kind: "hierarchy", rootEmployeeId: null, visibleEmployees: 0 }, summary: { visibleEmployees: 0, recordedDays: 0, present: 0, halfDay: 0, absent: 0, other: 0, productiveMinutes: 0, payableOtMinutes: 0 }, employees: [] } as TeamSummary,
      "attendance this account may already see",
    ),
    source(
      () => loadReportingLine(access, employeeId),
      { manager: null as { employeeId: string | null; name: string } | null, peers: [] as PeerRow[] },
      "your employee record's reporting manager and the colleagues who share it",
    ),
  ]);

  /* ---------------------------------------------------------------------- */
  /* 1. Today's shift                                                        */
  /* ---------------------------------------------------------------------- */

  const dayRows = (daysFeed.value.items as unknown[]).map((item) => asRecord(item));
  const todayRow = dayRows.find((row) => str(row.work_date).slice(0, 10) === today);
  const monthRow = (timesheetFeed.value as Array<{ date: string; grossMinutes: number | null }>).find(
    (row) => row.date === today,
  );

  const targetMinutes = shiftTargetMinutes(shiftFeed.value.startsAt, shiftFeed.value.endsAt);
  const workedMinutes =
    num(todayRow?.productive_minutes) ??
    (monthRow ? monthRow.grossMinutes : null) ??
    (sessionFeed.value.open ? sessionFeed.value.elapsedMinutes : null);

  const shift: Source<ShiftPanel> = {
    value: {
      shiftCode: shiftFeed.value.shiftCode,
      shiftName: shiftFeed.value.shiftName,
      startsAt: shiftFeed.value.startsAt,
      endsAt: shiftFeed.value.endsAt,
      targetMinutes,
      workedMinutes,
      breakMinutes: num(todayRow?.break_minutes),
      punchedInAt: toInstant(sessionFeed.value.checkedInAt),
      sessionOpen: sessionFeed.value.open,
    },
    available: sessionFeed.available && shiftFeed.available,
    message: sessionFeed.message ?? shiftFeed.message,
    origin: "attendance sessions, shift assignment and today's attendance day",
  };

  /* ---------------------------------------------------------------------- */
  /* 2. Leave balances                                                       */
  /* ---------------------------------------------------------------------- */

  const cards = balanceFeed.value.filter((card) => card.allocated !== 0 || card.available !== 0 || card.availed !== 0);
  let leave: Source<{ rings: LeaveRing[]; totalAvailable: number }>;
  if (balanceFeed.available && cards.length > 0) {
    const rings = cards.map((card) => ({
      label: str(card.leaveTypeName, card.leaveType),
      value: Math.max(0, round1(card.available) ?? 0),
      ...(card.allocated > 0 ? { max: round1(card.allocated) ?? card.allocated } : {}),
    }));
    leave = derived(
      { rings, totalAvailable: rings.reduce((sum, ring) => sum + ring.value, 0) },
      "leave ledger movements for this employee",
    );
  } else {
    // The ledger is the preferred source; the entitlement service is the
    // fallback so a tenant that has not posted ledger rows still sees its real
    // credited balances rather than an empty ring.
    const fallback = await source(() => getBalances(access, employeeId), null as Awaited<ReturnType<typeof getBalances>> | null, "leave entitlement");
    if (fallback.available && fallback.value) {
      const rings = Object.entries(fallback.value.balances)
        .map(([code, value]) => ({ label: code, value: Math.max(0, round1(Number(value)) ?? 0) }))
        .filter((ring) => ring.value > 0);
      leave = rings.length
        ? derived({ rings, totalAvailable: rings.reduce((sum, ring) => sum + ring.value, 0) }, "credited leave entitlement")
        : derived({ rings: [], totalAvailable: 0 }, "credited leave entitlement");
    } else {
      leave = {
        value: { rings: [], totalAvailable: 0 },
        available: balanceFeed.available,
        message: balanceFeed.message ?? fallback.message,
        origin: "leave ledger",
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 3. Pay                                                                  */
  /* ---------------------------------------------------------------------- */

  const payslips = payslipFeed.value.items;
  const picked = pickPayslip(payslips, period);
  const pay: Source<PayPanel | null> = payslipFeed.available
    ? derived(
        picked.payslip
          ? {
              period: picked.payslip.period,
              periodLabel: picked.payslip.periodLabel,
              isCurrentPeriod: picked.isCurrentPeriod,
              displayCode: picked.payslip.displayCode,
              currency: picked.payslip.currency,
              grossMinor: picked.payslip.grossMinor,
              deductionsMinor: picked.payslip.deductionsMinor,
              netMinor: picked.payslip.netMinor,
              state: picked.payslip.state,
            }
          : null,
        "payslips produced by the payroll engine",
      )
    : { value: null, available: false, message: payslipFeed.message, origin: "payslips" };

  /* ---------------------------------------------------------------------- */
  /* 4. This week's timesheet                                                */
  /* ---------------------------------------------------------------------- */

  const weekWindow = weekDates(weekStart);
  const entries = (weekEntriesFeed.value.items as unknown[])
    .map((item) => asRecord(item))
    .filter((row) => str(row.employeeId) === employeeId)
    .filter((row) => weekWindow.includes(str(row.workDate).slice(0, 10)))
    .filter((row) => !["cancelled", "rejected"].includes(str(row.status).toLowerCase()));

  const minutesByDate = new Map<string, number>();
  for (const entry of entries) {
    const date = str(entry.workDate).slice(0, 10);
    const minutes = num(entry.minutes) ?? 0;
    minutesByDate.set(date, (minutesByDate.get(date) ?? 0) + minutes);
  }

  const allocations = (allocationFeed.value.items as unknown[])
    .map((item) => asRecord(item))
    .filter((row) => str(row.employeeId) === employeeId && str(row.status).toLowerCase() === "approved");
  const projectRole = new Map(allocations.map((row) => [str(row.projectId), str(row.role, "Allocated project")]));

  const projectMinutes = new Map<string, number>();
  for (const entry of entries) {
    const projectId = str(entry.projectId);
    if (projectId === "") continue;
    projectMinutes.set(projectId, (projectMinutes.get(projectId) ?? 0) + (num(entry.minutes) ?? 0));
  }

  const week: Source<WeekPanel> = weekEntriesFeed.available
    ? derived(
        {
          weekStart,
          days: weekWindow.map((date, index) => ({
            date,
            weekday: WEEKDAYS[index],
            minutes: minutesByDate.has(date) ? (minutesByDate.get(date) as number) : null,
          })),
          totalMinutes: [...minutesByDate.values()].reduce((sum, value) => sum + value, 0),
          targetMinutes: targetMinutes === null ? null : targetMinutes * 5,
          targetBasis: targetMinutes === null ? null : "five days at the assigned shift length",
          // The project split is shown only where an approved allocation
          // actually names the project the time was booked to.
          projects: [...projectMinutes.entries()]
            .filter(([projectId]) => projectRole.has(projectId))
            .map(([projectId, minutes]) => ({ label: projectRole.get(projectId) as string, minutes }))
            .sort((left, right) => right.minutes - left.minutes),
        },
        "submitted and approved timesheet entries for this employee",
      )
    : {
        value: { weekStart, days: [], totalMinutes: 0, targetMinutes: null, targetBasis: null, projects: [] },
        available: false,
        message: weekEntriesFeed.message,
        origin: "timesheets",
      };

  /* ---------------------------------------------------------------------- */
  /* 5. Eight-week attendance heatmap                                        */
  /* ---------------------------------------------------------------------- */

  const hoursByDate = new Map<string, number>();
  for (const row of dayRows) {
    const date = str(row.work_date).slice(0, 10);
    const minutes = num(row.productive_minutes) ?? num(row.gross_span_minutes);
    if (!DATE_PATTERN.test(date) || minutes === null) continue;
    hoursByDate.set(date, round1(minutes / 60) ?? 0);
  }
  if (hoursByDate.size === 0 && timesheetFeed.available) {
    // Fallback to the monthly timesheet read model when the attendance-day
    // table is empty or barred; it covers the current period only, which is
    // why the heatmap can legitimately come back partly blank.
    for (const row of timesheetFeed.value as Array<{ date: string; grossMinutes: number | null }>) {
      if (row.grossMinutes === null) continue;
      hoursByDate.set(row.date, round1(row.grossMinutes / 60) ?? 0);
    }
  }

  const attendance: Source<AttendanceMatrix> =
    daysFeed.available || timesheetFeed.available
      ? derived(
          hoursByDate.size === 0
            ? { rows: [], columns: [], values: [] }
            : buildAttendanceMatrix(firstMonday, ATTENDANCE_WEEKS, hoursByDate),
          `attendance readings from ${firstMonday} to ${today}`,
        )
      : { value: { rows: [], columns: [], values: [] }, available: false, message: daysFeed.message, origin: "attendance_days" };

  /* ---------------------------------------------------------------------- */
  /* 6. Goals and learning                                                   */
  /* ---------------------------------------------------------------------- */

  const myObjectives = goalFeed.value.nodes.filter((node) => node.ownerEmployeeId === employeeId);
  const goals: Source<GoalRow[]> = goalFeed.available
    ? derived(
        myObjectives.map((node) => ({
          id: node.id,
          title: node.title,
          progressPct: node.derivedProgressPct,
          health: String(node.health),
          keyResultCount: node.keyResultCount,
        })),
        "objectives owned by this employee",
      )
    : { value: [], available: false, message: goalFeed.message, origin: "objectives" };

  const learning: Source<LearningRow[]> = learningFeed.available
    ? derived(
        (learningFeed.value.items ?? []).map((item) => ({
          id: item.id,
          courseTitle: item.courseTitle,
          stateLabel: item.stateLabel,
          dueDate: item.due.dueDate,
          overdue: item.due.band === "overdue",
          daysOverdue: item.due.daysOverdue,
          pathLabel: item.learningPathLabel,
        })),
        "this employee's learning enrolments",
      )
    : { value: [], available: false, message: learningFeed.message, origin: "enrollments" };

  /* ---------------------------------------------------------------------- */
  /* 7. Reporting line and pod                                               */
  /* ---------------------------------------------------------------------- */

  // Presence is only ever attached to a colleague whose attendance this
  // account can already see. Everyone else carries null, which the surface
  // prints as "no reading" — never as "not present".
  const presenceById = new Map<string, boolean | null>(
    teamFeed.available
      ? teamFeed.value.employees.map((row) => [
          row.id,
          row.recordedDays > 0 ? row.present > 0 || row.halfDay > 0 : null,
        ])
      : [],
  );

  const pod: PodMember[] = reportingFeed.value.peers.map((row) => ({
    employeeId: row.id,
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.employee_code,
    designation: row.designation ?? "",
    presentToday: presenceById.get(row.id) ?? null,
  }));

  const reportingLine: Source<{ manager: { employeeId: string | null; name: string } | null; pod: PodMember[] }> =
    reportingFeed.available
      ? derived(
          { manager: reportingFeed.value.manager, pod },
          "your own employee record: its reporting manager, and the active colleagues who report to that same manager",
        )
      : { value: { manager: null, pod: [] }, available: false, message: reportingFeed.message, origin: "reporting line" };

  /* ---------------------------------------------------------------------- */

  const feeds: Record<string, Source<unknown>> = {
    profile: profileFeed,
    shift,
    leave,
    pay,
    week,
    attendance,
    goals,
    learning,
    reportingLine,
  };
  const unavailableSources = Object.entries(feeds)
    .filter(([, feed]) => !feed.available)
    .map(([name, feed]) => ({ name, message: feed.message ?? "Permission or source unavailable." }));

  const employee = profileFeed.value;

  return {
    linked: true,
    message: null,
    employeeId,
    today,
    period,
    profile: profileFeed.available && employee
      ? derived(
          {
            name: `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || employee.employee_code,
            employeeCode: employee.employee_code,
            designation: employee.designation,
            department: employee.department,
            location: employee.location,
          },
          "employees",
        )
      : { value: null, available: false, message: profileFeed.message, origin: "employees" },
    shift,
    leave,
    pay,
    week,
    attendance,
    goals,
    learning,
    reportingLine,
    unavailableSources,
  };
}

/** Share of the week's target that has actually been logged, or null. */
export function weekCompletionPct(totalMinutes: number, targetMinutes: number | null): number | null {
  if (targetMinutes === null || targetMinutes <= 0) return null;
  return ratio(totalMinutes, targetMinutes);
}
