/** Pure helpers for the org chart built from GET /api/v1/org-chart (manager links stored in employees). */

export type OrgChartNode = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  location: string | null;
  status: string;
  managerId: string | null;
  children?: OrgChartNode[];
};

export type OrgChartPayload = {
  roots: OrgChartNode[];
  totalNodes: number;
  departments: Array<string | null>;
  locations: Array<string | null>;
};

export type DeptSummary = { name: string; count: number; employees: OrgChartNode[] };

export const ALL_DEPTS = "ALL";

export function fullName(node: OrgChartNode): string {
  return [node.firstName, node.lastName].filter(Boolean).join(" ").trim() || node.employeeCode;
}

export function initials(node: OrgChartNode): string {
  return fullName(node)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function flatten(roots: OrgChartNode[]): OrgChartNode[] {
  const out: OrgChartNode[] = [];
  const stack = [...roots];
  while (stack.length) {
    const node = stack.shift() as OrgChartNode;
    out.push(node);
    stack.push(...(node.children ?? []));
  }
  return out;
}

/** Groups by the recorded department; employees with none are grouped under the empty key, never relabelled. */
export function deptSummary(employees: OrgChartNode[]): DeptSummary[] {
  const map = new Map<string, DeptSummary>();
  for (const emp of employees) {
    const name = emp.department ?? "";
    const entry = map.get(name) ?? { name, count: 0, employees: [] };
    entry.count += 1;
    entry.employees.push(emp);
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function matches(node: OrgChartNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [fullName(node), node.designation, node.department, node.employeeCode]
    .some((value) => (value ?? "").toLowerCase().includes(q));
}

/** Keeps nodes that match the search and department, plus the managers on the path to them. */
export function filterTree(roots: OrgChartNode[], query: string, dept: string): OrgChartNode[] {
  const visit = (node: OrgChartNode): OrgChartNode | null => {
    const children = (node.children ?? []).map(visit).filter((c): c is OrgChartNode => c !== null);
    const self = matches(node, query) && (dept === ALL_DEPTS || (node.department ?? "") === dept);
    return self || children.length ? { ...node, children } : null;
  };
  return roots.map(visit).filter((n): n is OrgChartNode => n !== null);
}

/** Shape EmployeeDossierModal reads; only stored fields, no invented defaults. */
export function toDossier(node: OrgChartNode) {
  return {
    id: node.id,
    employeeCode: node.employeeCode,
    name: fullName(node),
    designation: node.designation ?? "",
    role: node.designation ?? "",
    department: node.department ?? "",
    dept: node.department ?? "",
    location: node.location ?? "",
    status: node.status,
  };
}
