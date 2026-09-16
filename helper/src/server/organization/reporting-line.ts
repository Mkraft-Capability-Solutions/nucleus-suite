import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * R-23 — the organisation chart follows the employee record.
 *
 * `employees.manager_employee_id` is the one reporting line. It already feeds the directory,
 * the attendance hierarchy scope and team scoping in payroll and operations; this module
 * gives it a write path and derives the chart from it, so there is no second hierarchy to
 * maintain and nothing to keep in step.
 */

export type ReportingNode = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  location: string;
  managerEmployeeId: string | null;
  status: string;
  /** Everyone at or below this node, the node itself excluded. */
  reportCount: number;
  reports: ReportingNode[];
};

export type ReportingRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  location: string;
  manager_employee_id: string | null;
  status: string;
};

/**
 * Builds the tree from flat rows. A manager outside the returned set (separated, archived,
 * or filtered out) is treated as no manager, so their reports surface at the root rather
 * than disappearing from the chart.
 */
export function buildReportingTree(rows: readonly ReportingRow[]): { roots: ReportingNode[]; orphans: number } {
  const nodes = new Map<string, ReportingNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      employeeCode: row.employee_code,
      name: `${row.first_name} ${row.last_name}`.trim(),
      designation: row.designation,
      department: row.department,
      location: row.location,
      managerEmployeeId: row.manager_employee_id,
      status: row.status,
      reportCount: 0,
      reports: [],
    });
  }
  const roots: ReportingNode[] = [];
  let orphans = 0;
  for (const node of nodes.values()) {
    const manager = node.managerEmployeeId ? nodes.get(node.managerEmployeeId) : undefined;
    if (manager && manager.id !== node.id) {
      manager.reports.push(node);
    } else {
      if (node.managerEmployeeId) orphans += 1;
      roots.push(node);
    }
  }
  const count = (node: ReportingNode): number => {
    node.reports.sort((left, right) => left.employeeCode.localeCompare(right.employeeCode));
    node.reportCount = node.reports.reduce((total, report) => total + 1 + count(report), 0);
    return node.reportCount;
  };
  roots.sort((left, right) => left.employeeCode.localeCompare(right.employeeCode));
  roots.forEach(count);
  return { roots, orphans };
}

export async function assertManagerExists(access: Access, managerEmployeeId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${managerEmployeeId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "The reporting manager is not an employee of this tenant.",
      details: [{ field: "managerEmployeeId", issue: "Unknown employee reference." }],
    });
  }
}

/**
 * A reporting line that loops has no top, so the chart derived from it would never
 * terminate. The database already refuses self-reporting; this refuses the longer cycles it
 * cannot see, by walking the proposed manager's own chain before the write.
 */
export async function assertNoReportingCycle(
  access: Access,
  employeeId: string,
  managerEmployeeId: string,
): Promise<void> {
  if (employeeId === managerEmployeeId) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: "An employee cannot report to themselves.",
      details: [{ field: "managerEmployeeId", issue: "Self-reporting." }],
    });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`
      with recursive chain as (
        select id, manager_employee_id, 1 as depth from employees
        where tenant_id = ${access.tenantId} and id = ${managerEmployeeId}
        union all
        select e.id, e.manager_employee_id, chain.depth + 1 from employees e
        join chain on chain.manager_employee_id = e.id
        where e.tenant_id = ${access.tenantId} and chain.depth < 100
      )
      select 1 from chain where id = ${employeeId} limit 1
    `,
  ]);
  if ((rows as unknown[]).length > 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "That manager already reports to this employee, directly or indirectly, so the reporting line would loop.",
      details: [{ field: "managerEmployeeId", issue: "Cyclic reporting line." }],
    });
  }
}

/**
 * The organisation chart, derived live from the reporting line on the employee record.
 * Separated and archived people are left out: the chart shows who reports to whom now.
 */
export async function getReportingChart(access: Access, args: { department?: string | null } = {}) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const department = args.department?.trim() ?? "";
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code, first_name, last_name, designation, department, location,
             manager_employee_id, coalesce(status, 'active') as status
      from employees
      where tenant_id = ${access.tenantId}
        and coalesce(status, '') not in ('separated', 'exited', 'relieved', 'archived', 'inactive')
        and (${department} = '' or department = ${department})
      order by employee_code asc
      limit 2000
    `,
  ]);
  const employees = rows as ReportingRow[];
  const { roots, orphans } = buildReportingTree(employees);
  // The department-wise view the test asks for is the same population grouped a second way,
  // not a second hierarchy: both come from these rows.
  const managerIds = new Set(employees.map((row) => row.manager_employee_id).filter((id): id is string => id !== null));
  const byDepartment = new Map<string, { department: string; headcount: number; managers: number }>();
  for (const row of employees) {
    const key = row.department || "Unassigned";
    const entry = byDepartment.get(key) ?? { department: key, headcount: 0, managers: 0 };
    entry.headcount += 1;
    if (managerIds.has(row.id)) entry.managers += 1;
    byDepartment.set(key, entry);
  }
  return {
    roots,
    total: employees.length,
    /** Reports whose manager is not in the active population; they render at the root. */
    orphans,
    departments: [...byDepartment.values()].sort((left, right) => left.department.localeCompare(right.department)),
  };
}
