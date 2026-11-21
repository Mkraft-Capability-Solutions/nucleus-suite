import "server-only";

import { HttpError } from "@/server/platform/http";
import type { Access } from "@/server/platform/access";
import { attendanceBoard } from "./boards/attendance";
import { governanceBoard } from "./boards/governance";
import { hrOperations, peopleCommandCentre } from "./boards/people";
import { payrollBoard } from "./boards/payroll";
import { capabilityBoard, performanceBoard, talentAcquisition } from "./boards/talent";
import { employeeHome, managerCockpit } from "./boards/team";
import { canAny, organisationContext, plain, runAll, type Scope } from "./query";
import { BOARD_IDS, type Board, type BoardFilters, type BoardId, type FilterOptions, type Kpi, type Panel } from "./types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: string[]; employeesInScope: number | null; notice?: string; audience?: string };

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
  s1: { title: "People command centre", permissions: ["hr.lifecycle.read", "employee.write", "tenant.manage"], filters: true, audience: "The whole organisation", build: peopleCommandCentre },
  s2: { title: "HR operations console", permissions: ["hr.lifecycle.read", "employee.write"], filters: true, audience: "The whole organisation", build: hrOperations },
  s3: { title: "Attendance & shifts", permissions: ["attendance.write", "attendance.evaluate"], filters: true, audience: "The whole organisation", build: attendanceBoard },
  s4: { title: "Talent acquisition", permissions: ["recruitment.requisition.write", "employee.write"], filters: false, audience: "The whole organisation", build: talentAcquisition },
  s5: { title: "Payroll control room", permissions: ["payroll.read"], filters: false, audience: "The whole organisation", build: payrollBoard },
  s6: { title: "Performance & talent", permissions: ["employee.write", "hr.lifecycle.read"], filters: true, audience: "The whole organisation", build: performanceBoard },
  s7: { title: "Manager cockpit", permissions: "member", filters: false, audience: "Your direct reports", build: managerCockpit },
  s8: { title: "Employee home", permissions: "member", filters: false, audience: "Your own records", build: employeeHome },
  s9: { title: "Capability", permissions: ["employee.write", "hr.lifecycle.read"], filters: true, audience: "The whole organisation", build: capabilityBoard },
  s10: { title: "Workspace governance", permissions: ["tenant.manage", "role.manage", "audit.read"], filters: false, audience: "The whole organisation", build: governanceBoard },
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
