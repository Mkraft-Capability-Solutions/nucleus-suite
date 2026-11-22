import "server-only";

import { HttpError } from "@/server/platform/http";
import type { Access } from "@/server/platform/access";
import { attendanceBoard } from "./boards/attendance";
import { governanceBoard } from "./boards/governance";
import { hrOperations, peopleCommandCentre } from "./boards/people";
import { payrollBoard } from "./boards/payroll";
import { capabilityBoard, performanceBoard, talentAcquisition } from "./boards/talent";
import { employeeHome, managerCockpit } from "./boards/team";
import {
  attendanceExtras, capabilityExtras, employeeExtras, governanceExtras, hrOperationsExtras, managerExtras, payrollExtras, peopleExtras,
  performanceExtras, talentExtras,
} from "./boards/extras";
import { rankInsights } from "./compose";
import { canAny, organisationContext, plain, runAll, type Scope } from "./query";
import { BOARD_IDS, type Board, type BoardFilters, type BoardId, type FilterOptions, type Insight, type Kpi, type Panel } from "./types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: Array<string | Insight>; employeesInScope: number | null; notice?: string; audience?: string; evidence?: string[] };
type Extras = Panel[] | { panels: Panel[]; insights: Insight[] };


/**
 * A board plus the panels its classic console also had (./boards/extras), built in parallel.
 * `replaces` drops base panels an extra supersedes. Personal boards skip the extras when the
 * sign-in is not linked to an employee record (the base board explains why).
 */
function withExtras(base: (scope: Scope) => Promise<Built>, extras: (scope: Scope) => Promise<Extras>, layout: { order: string[]; replaces?: string[] }) {
  return async (scope: Scope): Promise<Built> => {
    const [built, extra] = await Promise.all([base(scope), extras(scope)]);
    if (built.notice) return built;
    const more = Array.isArray(extra) ? extra : extra.panels;
    const insights = rankInsights([...built.insights, ...(Array.isArray(extra) ? [] : extra.insights)]);
    // Panels in reading order (rows of the 12-column grid); anything not listed keeps its place at the end.
    const rank = (panel: Panel) => { const index = layout.order.indexOf(panel.id); return index < 0 ? layout.order.length : index; };
    const panels = [...built.panels.filter((panel) => !(layout.replaces ?? []).includes(panel.id)), ...more];
    return { ...built, insights, panels: panels.map((panel, index) => ({ panel, index })).sort((a, b) => rank(a.panel) - rank(b.panel) || a.index - b.index).map(({ panel }) => panel) };
  };
}

const personal = (extras: (scope: Scope, employeeId: string) => Promise<Panel[]>) => (scope: Scope) =>
  scope.access.context.employeeId ? extras(scope, scope.access.context.employeeId) : Promise.resolve([]);

/**
 * Each board: who may open it (any one of the permissions; owners and administrators hold all),
 * whether the workforce filters apply, and who the figures are about.
 */
export const BOARD_DEFINITIONS: Record<BoardId, {
  title: string;
  permissions: readonly string[] | "member";
  filters: boolean;
  audience: string;
  build: (scope: Scope) => Promise<Built>;
}> = {
  s1: { title: "People command centre", permissions: ["hr.lifecycle.read", "employee.write", "tenant.manage"], filters: true, audience: "The whole organisation", build: withExtras(peopleCommandCentre, peopleExtras, { order: ["headcount-trend", "org-health", "talent-flow", "attrition-department", "pay-performance", "attrition-heat", "joiners-leavers", "department", "location", "tenure", "category", "heat"] }) },
  s2: { title: "HR operations console", permissions: ["hr.lifecycle.read", "employee.write"], filters: true, audience: "The whole organisation", build: withExtras(hrOperations, hrOperationsExtras, { order: ["queue", "joining", "approvals", "onboarding", "absence", "tickets", "absence-calendar", "sla", "renewals", "ticket-categories", "moments", "missing"] }) },
  s3: { title: "Attendance & shifts", permissions: ["attendance.write", "attendance.evaluate"], filters: true, audience: "The whole organisation", build: withExtras(attendanceBoard, attendanceExtras, { order: ["daily", "status", "location", "overtime", "attendance-absenteeism", "punctuality", "coverage", "sources", "signals", "regularisations", "exceptions"] }) },
  s4: { title: "Talent acquisition", permissions: ["recruitment.requisition.write", "employee.write"], filters: false, audience: "The whole organisation", build: withExtras(talentAcquisition, talentExtras, { order: ["funnel", "sources", "requisitions", "offers", "source-yield", "shortlist", "leakage", "candidate-experience", "trend", "interviews"] }) },
  s5: { title: "Payroll control room", permissions: ["payroll.read"], filters: false, audience: "The whole organisation", build: withExtras(payrollBoard, payrollExtras, { order: ["cost", "severity", "cost-bridge", "composition", "exceptions", "rules", "statutory", "accuracy", "cost-per-employee", "deductions", "basic", "runs"] }) },
  s6: { title: "Performance & talent", permissions: ["employee.write", "hr.lifecycle.read"], filters: true, audience: "The whole organisation", build: withExtras(performanceBoard, performanceExtras, { replaces: ["ratings"], order: ["nine-box", "rating-distribution", "competencies", "calibration", "review-status", "progress", "recognition", "succession", "succession-cover"] }) },
  s7: { title: "Manager cockpit", permissions: "member", filters: false, audience: "Your direct reports", build: withExtras(managerCockpit, personal(managerExtras), { order: ["team", "leave", "my-approvals", "capacity", "goals", "overtime", "skill-coverage"] }) },
  s8: { title: "Employee home", permissions: "member", filters: false, audience: "Your own records", build: withExtras(employeeHome, personal(employeeExtras), { order: ["payslip", "my-goals", "allocation", "actions", "balances", "timesheet", "hours", "requests", "learning", "reporting"] }) },
  s9: { title: "Capability", permissions: ["employee.write", "hr.lifecycle.read"], filters: true, audience: "The whole organisation", build: withExtras(capabilityBoard, capabilityExtras, { order: ["skill-matrix", "skill-deficit", "gap-to-path", "skills", "proficiency", "capability-movement", "programme-funnel", "completions", "department", "learning-hours", "learning-impact", "overdue"] }) },
  s10: { title: "Workspace governance", permissions: ["tenant.manage", "role.manage", "audit.read"], filters: false, audience: "The whole organisation", build: withExtras(governanceBoard, governanceExtras, { order: ["activity", "roles", "actions", "recent", "modules", "integrations", "agents", "model-register", "ai"] }) },
};

export function isBoardId(value: string): value is BoardId {
  return (BOARD_IDS as readonly string[]).includes(value);
}

export function canOpenBoard(access: Access, board: BoardId): boolean {
  const permissions = BOARD_DEFINITIONS[board].permissions;
  return permissions === "member" || canAny(access, permissions);
}

/** Boards the caller may open (the module entitlements are checked by the route layer and the client). */
export function openableBoards(access: Access): BoardId[] {
  return BOARD_IDS.filter((board) => canOpenBoard(access, board));
}

export async function buildBoard(access: Access, board: BoardId, filters: BoardFilters): Promise<Board> {
  const definition = BOARD_DEFINITIONS[board];
  if (!canOpenBoard(access, board)) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: `Your role cannot open the ${definition.title} dashboard.` });
  }
  const organisation = await organisationContext(access);
  const applied: BoardFilters = definition.filters ? filters : { location: null, department: null, months: filters.months };
  const scope: Scope = { access, filters: applied, timezone: organisation.timezone };
  const built = await definition.build(scope);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: organisation.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return {
    board,
    generatedAt: new Date().toISOString(),
    scope: {
      organisation: organisation.name,
      timezone: organisation.timezone,
      currency: organisation.currency,
      today,
      filters: applied,
      employeesInScope: built.employeesInScope,
      audience: built.audience ?? definition.audience,
    },
    kpis: built.kpis,
    panels: built.panels,
    insights: built.insights,
    ...(built.evidence?.length ? { evidence: built.evidence } : {}),
    ...(built.notice ? { notice: built.notice } : {}),
  };
}

/** Locations and departments that employees actually carry, for the filter row. */
export async function boardFilterOptions(access: Access): Promise<FilterOptions & { boards: BoardId[]; mine: { location: string | null; department: string | null } }> {
  const organisation = await organisationContext(access);
  const scope: Scope = { access, filters: { location: null, department: null, months: 12 }, timezone: organisation.timezone };
  const boards = openableBoards(access);
  const none = { location: null, department: null };
  if (!boards.some((board) => BOARD_DEFINITIONS[board].filters)) return { locations: [], departments: [], boards, mine: none };
  // $3: the member's own employee record, for the "My location" and "My department" presets.
  const data = await runAll(access, {
    options: plain(scope, `
      select array(select distinct nullif(trim(location), '') from employees where tenant_id = $1::uuid and nullif(trim(location), '') is not null order by 1) as locations,
        array(select distinct nullif(trim(department), '') from employees where tenant_id = $1::uuid and nullif(trim(department), '') is not null order by 1) as departments,
        (select nullif(trim(location), '') from employees where tenant_id = $1::uuid and id = $3::uuid) as my_location,
        (select nullif(trim(department), '') from employees where tenant_id = $1::uuid and id = $3::uuid) as my_department`, [access.context.employeeId ?? null]),
  });
  const row = data.options?.[0] ?? {};
  return {
    locations: Array.isArray(row.locations) ? (row.locations as string[]) : [],
    departments: Array.isArray(row.departments) ? (row.departments as string[]) : [],
    boards,
    mine: { location: (row.my_location as string | null) ?? null, department: (row.my_department as string | null) ?? null },
  };
}
