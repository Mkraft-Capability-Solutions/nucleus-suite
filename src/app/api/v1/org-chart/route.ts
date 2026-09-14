import { requireAccess, enforce, tenantTx } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";


export const dynamic = "force-dynamic";

type OrgNode = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  location: string;
  status: string;
  managerId: string | null;
  children?: OrgNode[];
};

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });

    const params = new URL(request.url).searchParams;
    const rootId = params.get("rootId"); // optional: get subtree from specific employee

    // Fetch all active employees with manager relationships
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, employee_code, first_name, last_name, designation, department, location,
               status, manager_employee_id
        from employees
        where tenant_id = ${access.tenantId}
          and status in ('active', 'probation')
          ${rootId ? sqlClient`and (id = ${rootId} or manager_employee_id = ${rootId})` : sqlClient``}
        order by employee_code asc
      `,
    ]);

    const employees = rows as Array<{
      id: string; employee_code: string; first_name: string; last_name: string;
      designation: string; department: string; location: string; status: string;
      manager_employee_id: string | null;
    }>;

    // Build tree structure
    const nodeMap = new Map<string, OrgNode>();
    for (const emp of employees) {
      nodeMap.set(emp.id, {
        id: emp.id,
        employeeCode: emp.employee_code,
        firstName: emp.first_name,
        lastName: emp.last_name,
        designation: emp.designation,
        department: emp.department,
        location: emp.location,
        status: emp.status,
        managerId: emp.manager_employee_id,
        children: [],
      });
    }

    // Link children to parents
    const roots: OrgNode[] = [];
    for (const [, node] of nodeMap) {
      if (node.managerId && nodeMap.has(node.managerId)) {
        nodeMap.get(node.managerId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    // If rootId specified, return just that subtree
    if (rootId && nodeMap.has(rootId)) {
      return ok({ type: "org-chart", id: "org-chart", version: 1, attributes: { root: nodeMap.get(rootId), totalNodes: nodeMap.size }, requestId, self: "/api/v1/org-chart" });
    }

    return ok({
      type: "org-chart",
      id: "org-chart",
      version: 1,
      attributes: {
        roots,
        totalNodes: nodeMap.size,
        departments: [...new Set(employees.map((e) => e.department))].sort(),
        locations: [...new Set(employees.map((e) => e.location))].sort(),
      },
      requestId,
      self: "/api/v1/org-chart",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
