import "server-only";

import { summarizeAttendanceTeam } from "@/server/attendance/service";
import { listEnrollments } from "@/server/learning/service";
import { listLeaveRequests } from "@/server/leave/service";
import type { Access } from "@/server/platform/access";
import { employeeSkills } from "@/server/skills/service";
import { listOperationalRecords } from "@/server/workflows/operational-service";
import { countBy, derived, ratio, source, unsupported, type Source } from "./source";

/**
 * S7 Manager Cockpit aggregation.
 *
 * Everything on this cockpit is scoped to the signed-in manager's OWN direct
 * reports. The scoping is the server's, not this module's: the team roster is
 * read through `summarizeAttendanceTeam`, which already resolves the caller's
 * attendance hierarchy, and is then narrowed to rows whose
 * `managerEmployeeId` is the caller's own employee id. Nothing here widens a
 * scope, and an account with no employee link resolves to no team at all
 * rather than to the tenant.
 *
 * Per DESIGN_SYSTEM.md section 9 no figure is invented. Each feed reports
 * whether it resolved so the client can render an honest unavailable state.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** How many reports we will pull skill evidence for; keeps the fan-out bounded. */
export const SKILL_SAMPLE_LIMIT = 24;

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
/* Pure helpers (unit tested in manager-cockpit.test.ts)                      */
/* -------------------------------------------------------------------------- */

export type CapacityWindow = { label: string; start: string; end: string };

/** Adds `days` to an ISO date, in UTC, so no local timezone can shift the day. */
export function addDays(iso: string, days: number): string {
  if (!DATE_PATTERN.test(iso)) return iso;
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** The Monday on or before `iso`. Weeks run Monday to Sunday everywhere here. */
export function mondayOf(iso: string): string {
  if (!DATE_PATTERN.test(iso)) return iso;
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, weekday === 0 ? -6 : 1 - weekday);
}

export function weekLabel(iso: string): string {
  if (!DATE_PATTERN.test(iso)) return iso;
  const month = MONTH_LABELS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7);
  return `w/c ${Number(iso.slice(8, 10))} ${month}`;
}

/** The next `count` Monday-start windows, beginning with the current week. */
export function weekWindows(todayISO: string, count: number): CapacityWindow[] {
  if (!DATE_PATTERN.test(todayISO) || count <= 0) return [];
  const first = mondayOf(todayISO);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(first, index * 7);
    return { label: weekLabel(start), start, end: addDays(start, 6) };
  });
}

/** True when a stored [from, to] range touches the window at all. */
export function overlapsWindow(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  window: { start: string; end: string },
): boolean {
  const from = (startsOn ?? "").slice(0, 10);
  const to = (endsOn ?? startsOn ?? "").slice(0, 10);
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return false;
  return from <= window.end && to >= window.start;
}

export type CapacityBar = { label: string; delivering: number; onLeave: number; inTraining: number };

export type CapacityInputs = {
  teamIds: readonly string[];
  /** Approved leave only — a pending request is not a capacity commitment. */
  leaves: ReadonlyArray<{ employeeId: string; startsOn: string | null; endsOn: string | null }>;
  /** Open learning enrolments that carry a real due date. */
  training: ReadonlyArray<{ employeeId: string; dueOn: string | null }>;
  /** Approved or published roster rows covering part of the window. */
  rosters: ReadonlyArray<{ employeeId: string; startDate: string | null; endDate: string | null }>;
};

/**
 * Splits each window's team into delivering / on leave / in training.
 *
 * The denominator is the roster when the roster actually covers somebody in
 * that window, and the team head count otherwise — the two are the only
 * populations the records can speak to. A person counted as on leave is never
 * double counted as in training.
 */
export function buildCapacityBars(
  windows: readonly CapacityWindow[],
  inputs: CapacityInputs,
): CapacityBar[] {
  const team = new Set(inputs.teamIds);
  if (team.size === 0) return [];
  return windows.map((window) => {
    const onLeave = new Set(
      inputs.leaves
        .filter((row) => team.has(row.employeeId) && overlapsWindow(row.startsOn, row.endsOn, window))
        .map((row) => row.employeeId),
    );
    const inTraining = new Set(
      inputs.training
        .filter((row) => {
          const due = (row.dueOn ?? "").slice(0, 10);
          if (!DATE_PATTERN.test(due)) return false;
          return team.has(row.employeeId) && due >= window.start && due <= window.end && !onLeave.has(row.employeeId);
        })
        .map((row) => row.employeeId),
    );
    const rostered = new Set(
      inputs.rosters
        .filter((row) => team.has(row.employeeId) && overlapsWindow(row.startDate, row.endDate, window))
        .map((row) => row.employeeId),
    );
    const scheduled = rostered.size > 0 ? rostered.size : team.size;
    return {
      label: window.label,
      delivering: Math.max(0, scheduled - onLeave.size - inTraining.size),
      onLeave: onLeave.size,
      inTraining: inTraining.size,
    };
  });
}

export type TeamSkillRow = { employeeId: string; skill: string; verified: boolean };

export type SkillAxis = { axis: string; current: number; comparison: number };

/**
 * Team skill coverage. `comparison` (dashed) is the share of the team that has
 * the skill recorded at all; `current` (solid) is the share whose evidence has
 * actually been verified, so the gap between the two rings is the unverified
 * claim. Both are real percentages of the real team size.
 */
export function buildSkillAxes(
  rows: readonly TeamSkillRow[],
  teamSize: number,
  limit = 6,
): SkillAxis[] {
  if (teamSize <= 0) return [];
  const coverage = new Map<string, { recorded: Set<string>; verified: Set<string> }>();
  for (const row of rows) {
    const skill = row.skill.trim();
    if (skill === "") continue;
    const entry = coverage.get(skill) ?? { recorded: new Set<string>(), verified: new Set<string>() };
    entry.recorded.add(row.employeeId);
    if (row.verified) entry.verified.add(row.employeeId);
    coverage.set(skill, entry);
  }
  return [...coverage.entries()]
    .sort((left, right) => right[1].recorded.size - left[1].recorded.size || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([skill, entry]) => ({
      axis: skill,
      current: ratio(entry.verified.size, teamSize) ?? 0,
      comparison: ratio(entry.recorded.size, teamSize) ?? 0,
    }));
}

/** Leave statuses that still await a decision somewhere on the approval chain. */
const PENDING_LEAVE_STATUSES = new Set([
  "pending",
  "pending_supervisor",
  "pending_hod",
  "pending_hr",
  "submitted",
  "requested",
]);

export function isPendingLeave(status: unknown): boolean {
  return PENDING_LEAVE_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

export type TriageKind = "leave" | "comp-off" | "expense" | "timesheet";

export type TriageItem = {
  id: string;
  kind: TriageKind;
  kindLabel: string;
  /**
   * Operational resource for `/api/v1/operations/<resource>/<id>/<action>`.
   * Null for leave, which decides through `/api/v1/leave-requests/<id>/decide`.
   */
  resource: string | null;
  version: number;
  employeeId: string;
  employeeName: string;
  title: string;
  detail: string;
  status: string;
  amountMinor: number | null;
  currency: string | null;
  /** The operational engine rejects a transition without a reason of 3+ chars. */
  reasonRequired: boolean;
};

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

type TeamSummary = Awaited<ReturnType<typeof summarizeAttendanceTeam>>;

const EMPTY_TEAM: TeamSummary = {
  scope: { kind: "hierarchy", rootEmployeeId: null, visibleEmployees: 0 },
  summary: {
    visibleEmployees: 0,
    recordedDays: 0,
    present: 0,
    halfDay: 0,
    absent: 0,
    other: 0,
    productiveMinutes: 0,
    payableOtMinutes: 0,
  },
  employees: [],
};

export type TeamMember = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  presentToday: boolean;
  attendanceRecordedToday: boolean;
};

export type ManagerCockpitData = {
  manager: { employeeId: string | null; linked: boolean };
  today: string;
  team: Source<TeamMember[]>;
  kpis: {
    teamSize: Source<number>;
    presentToday: Source<number>;
    onLeaveToday: Source<number>;
    pendingApprovals: Source<number>;
  };
  capacity: Source<CapacityBar[]>;
  skills: Source<{ axes: SkillAxis[]; teamSize: number; sampled: number }>;
  triage: Source<TriageItem[]>;
  triageByKind: Array<{ label: string; value: number }>;
  unavailableSources: Array<{ name: string; message: string }>;
};

const NO_EMPLOYEE_LINK =
  "This account is not linked to an employee record, so no reporting line can be resolved for it.";

function nameOf(row: { firstName: string; lastName: string; employeeCode: string }): string {
  const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  return name === "" ? row.employeeCode : name;
}

function operationalRows(payload: { items: unknown[] }): UnknownRecord[] {
  return payload.items.map((item) => asRecord(item));
}

/** Pulls one operational resource, degrading to an empty list on refusal. */
function operationalSource(access: Access, resource: string) {
  return source(
    () => listOperationalRecords(access, resource, new URLSearchParams({ page: "1", pageSize: "100" })),
    { items: [] as unknown[], nextCursor: null as string | null },
    `/api/v1/operations/${resource}`,
  );
}

export async function buildManagerCockpit(
  access: Access,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<ManagerCockpitData> {
  const managerEmployeeId = access.context.employeeId ?? null;
  const windows = weekWindows(today, 4);

  const [teamFeed, leaveFeed, enrolmentFeed, rosterFeed, expenseFeed, timesheetFeed] = await Promise.all([
    source(() => summarizeAttendanceTeam(access, { from: today, to: today }), EMPTY_TEAM, "attendance team summary"),
    source(
      () => listLeaveRequests(access, { status: null, page: 1, pageSize: 200 }),
      { items: [] as unknown[], total: 0 },
      "leave requests",
    ),
    source(() => listEnrollments(access, null), [] as unknown[], "learning enrolments"),
    operationalSource(access, "rosters"),
    operationalSource(access, "expenses"),
    operationalSource(access, "timesheets"),
  ]);

  const reports = managerEmployeeId
    ? teamFeed.value.employees.filter((row) => row.managerEmployeeId === managerEmployeeId)
    : [];
  const reportIds = reports.map((row) => row.id);
  const reportIdSet = new Set(reportIds);
  const nameById = new Map(reports.map((row) => [row.id, nameOf(row)]));

  const members: TeamMember[] = reports.map((row) => ({
    employeeId: row.id,
    employeeCode: row.employeeCode,
    name: nameOf(row),
    designation: row.designation,
    department: row.department,
    presentToday: row.present > 0 || row.halfDay > 0,
    attendanceRecordedToday: row.recordedDays > 0,
  }));

  const team: Source<TeamMember[]> = managerEmployeeId
    ? teamFeed.available
      ? derived(members, "employees reporting to the signed-in manager")
      : { value: [], available: false, message: teamFeed.message, origin: teamFeed.origin }
    : unsupported([], NO_EMPLOYEE_LINK);

  /* ---------------------------------------------------------------------- */
  /* Leave rows, narrowed to this manager's reports                          */
  /* ---------------------------------------------------------------------- */

  const leaveRows = (leaveFeed.value.items as unknown[])
    .map((item) => asRecord(item))
    .filter((row) => reportIdSet.has(str(row.employee_id)));

  const approvedLeave = leaveRows
    .filter((row) => str(row.status).trim().toLowerCase() === "approved")
    .map((row) => ({
      employeeId: str(row.employee_id),
      startsOn: str(row.starts_on, "") || null,
      endsOn: str(row.ends_on, "") || null,
    }));

  const onLeaveToday = new Set(
    approvedLeave
      .filter((row) => overlapsWindow(row.startsOn, row.endsOn, { start: today, end: today }))
      .map((row) => row.employeeId),
  ).size;

  /* ---------------------------------------------------------------------- */
  /* Capacity                                                                */
  /* ---------------------------------------------------------------------- */

  const openEnrolments = (enrolmentFeed.value as unknown[])
    .map((item) => asRecord(item))
    .filter((row) => reportIdSet.has(str(row.employee_id)))
    .map((row) => ({ employeeId: str(row.employee_id), attributes: asRecord(row.attributes) }))
    .filter((row) => !["verified", "completed", "certified"].includes(str(row.attributes.status).toLowerCase()))
    .map((row) => ({ employeeId: row.employeeId, dueOn: str(row.attributes.due_date, "") || null }));

  const rosterRows = operationalRows(rosterFeed.value)
    .filter(
      (row) =>
        reportIdSet.has(str(row.employeeId)) &&
        ["approved", "published"].includes(str(row.status).toLowerCase()),
    )
    .map((row) => ({
      employeeId: str(row.employeeId),
      startDate: str(row.startDate, "") || null,
      endDate: str(row.endDate, "") || null,
    }));

  // A week is only drawn when the leave feed resolved: without it the split
  // between delivering and on leave would be a guess rather than a reading.
  const capacity: Source<CapacityBar[]> = !managerEmployeeId
    ? unsupported([], NO_EMPLOYEE_LINK)
    : reportIds.length === 0
      ? derived([], "no direct reports")
      : leaveFeed.available
        ? derived(
            buildCapacityBars(windows, {
              teamIds: reportIds,
              leaves: approvedLeave,
              training: openEnrolments,
              rosters: rosterRows,
            }),
            "approved leave, published rosters and open learning enrolments",
          )
        : unsupported(
            [],
            "Approved leave could not be read for this account, so the capacity split cannot be computed honestly.",
          );

  /* ---------------------------------------------------------------------- */
  /* Skill coverage                                                          */
  /* ---------------------------------------------------------------------- */

  const sampled = reportIds.slice(0, SKILL_SAMPLE_LIMIT);
  const skills: Source<{ axes: SkillAxis[]; teamSize: number; sampled: number }> = !managerEmployeeId
    ? unsupported({ axes: [], teamSize: 0, sampled: 0 }, NO_EMPLOYEE_LINK)
    : sampled.length === 0
      ? derived({ axes: [], teamSize: 0, sampled: 0 }, "no direct reports")
      : await source(
          async () => {
            const perEmployee = await Promise.all(
              sampled.map(async (employeeId) => ({
                employeeId,
                rows: (await employeeSkills(access, employeeId)) as unknown[],
              })),
            );
            const flat: TeamSkillRow[] = [];
            for (const entry of perEmployee) {
              for (const raw of entry.rows) {
                const row = asRecord(raw);
                const skill = str(asRecord(row.skill).name);
                if (skill === "") continue;
                flat.push({
                  employeeId: entry.employeeId,
                  skill,
                  verified: String(asRecord(row.proficiency).verified ?? "") === "true" ||
                    asRecord(row.proficiency).verified === true,
                });
              }
            }
            return {
              axes: buildSkillAxes(flat, sampled.length),
              teamSize: sampled.length,
              sampled: sampled.length,
            };
          },
          { axes: [], teamSize: 0, sampled: 0 },
          "employee_skills evidence",
        );

  /* ---------------------------------------------------------------------- */
  /* Triage queue                                                            */
  /* ---------------------------------------------------------------------- */

  const leaveTriage: TriageItem[] = leaveRows
    .filter((row) => isPendingLeave(row.status))
    .map((row) => {
      const leaveType = str(row.leave_type, "Leave").toUpperCase();
      const compOff = leaveType === "COFF" || leaveType === "COMP_OFF";
      const days = num(row.requested_days);
      return {
        id: str(row.id),
        kind: (compOff ? "comp-off" : "leave") as TriageKind,
        kindLabel: compOff ? "Comp-off" : "Leave",
        resource: null,
        version: 1,
        employeeId: str(row.employee_id),
        employeeName: nameById.get(str(row.employee_id)) ?? str(row.employee_id),
        title: `${leaveType} · ${days === null ? "days not stated" : `${days} day(s)`}`,
        detail: `${str(row.starts_on, "start not set")} → ${str(row.ends_on, "end not set")}`,
        status: str(row.status, "pending"),
        amountMinor: null,
        currency: null,
        reasonRequired: false,
      };
    });

  const expenseTriage: TriageItem[] = operationalRows(expenseFeed.value)
    .filter((row) => reportIdSet.has(str(row.employeeId)) && str(row.status).toLowerCase() === "submitted")
    .map((row) => ({
      id: str(row.id),
      kind: "expense" as TriageKind,
      kindLabel: "Expense",
      resource: "expenses",
      version: num(row.version) ?? 1,
      employeeId: str(row.employeeId),
      employeeName: nameById.get(str(row.employeeId)) ?? str(row.employeeId),
      title: str(row.category, "Expense claim").replace(/_/g, " "),
      detail: `${str(row.expenseDate, "date not set")} · ${str(row.description, "no description")}`,
      status: str(row.status, "submitted"),
      amountMinor: num(row.amountMinor),
      currency: str(row.currency, "INR"),
      reasonRequired: true,
    }));

  const timesheetTriage: TriageItem[] = operationalRows(timesheetFeed.value)
    .filter((row) => reportIdSet.has(str(row.employeeId)) && str(row.status).toLowerCase() === "submitted")
    .map((row) => {
      const minutes = num(row.minutes);
      return {
        id: str(row.id),
        kind: "timesheet" as TriageKind,
        kindLabel: "Timesheet",
        resource: "timesheets",
        version: num(row.version) ?? 1,
        employeeId: str(row.employeeId),
        employeeName: nameById.get(str(row.employeeId)) ?? str(row.employeeId),
        title: str(row.task, "Time entry"),
        detail: `${str(row.workDate, "date not set")} · ${minutes === null ? "minutes not stated" : `${minutes} min`} · ${str(row.billing, "billing not set").replace(/_/g, " ")}`,
        status: str(row.status, "submitted"),
        amountMinor: null,
        currency: null,
        reasonRequired: true,
      };
    });

  const triageRows = [...leaveTriage, ...expenseTriage, ...timesheetTriage];
  const triageAvailable = leaveFeed.available || expenseFeed.available || timesheetFeed.available;

  const triage: Source<TriageItem[]> = !managerEmployeeId
    ? unsupported([], NO_EMPLOYEE_LINK)
    : triageAvailable
      ? derived(triageRows, "leave requests plus the operational expense and timesheet queues")
      : unsupported([], "None of the approval queues could be read for this account.");

  /* ---------------------------------------------------------------------- */

  const feeds: Record<string, Source<unknown>> = {
    team: teamFeed,
    leave: leaveFeed,
    enrolments: enrolmentFeed,
    rosters: rosterFeed,
    expenses: expenseFeed,
    timesheets: timesheetFeed,
    skills,
  };
  const unavailableSources = Object.entries(feeds)
    .filter(([, feed]) => !feed.available)
    .map(([name, feed]) => ({ name, message: feed.message ?? "Permission or source unavailable." }));

  return {
    manager: { employeeId: managerEmployeeId, linked: managerEmployeeId !== null },
    today,
    team,
    kpis: {
      teamSize: team.available ? derived(members.length, "direct reports") : { ...team, value: 0 },
      presentToday: teamFeed.available && managerEmployeeId
        ? derived(members.filter((member) => member.presentToday).length, "attendance days recorded today")
        : { value: 0, available: false, message: team.message ?? NO_EMPLOYEE_LINK },
      onLeaveToday: leaveFeed.available && managerEmployeeId
        ? derived(onLeaveToday, "approved leave covering today")
        : { value: 0, available: false, message: leaveFeed.message ?? NO_EMPLOYEE_LINK },
      pendingApprovals: triage.available
        ? derived(triage.value.length, "pending items in the triage queue")
        : { value: 0, available: false, message: triage.message },
    },
    capacity,
    skills,
    triage,
    triageByKind: countBy(triageRows, (row) => row.kindLabel),
    unavailableSources,
  };
}
