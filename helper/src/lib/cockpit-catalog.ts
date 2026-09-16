/**
 * Dashboard cockpit registry (S1 - S10).
 *
 * Each cockpit is a role-tailored console. The registry is the single source of
 * truth for which cockpits exist, who may open them, and which module id and
 * route they live behind.
 *
 * Audience rules
 * --------------
 * - `admin`    : the nine operational/executive consoles. Visible to an
 *                administrative principal (the Super Admin / owner role, or any
 *                principal holding the tenant-management permission).
 * - `employee` : the self-service console. Deliberately NOT shown to an
 *                administrative principal, so the employee home stays an
 *                employee surface.
 *
 * A cockpit still has to clear its own `requiredPermissions`; the audience rule
 * narrows visibility further, it never widens it.
 */

export type CockpitAudience = "admin" | "employee";

export type CockpitDefinition = {
  /** Module id, also the route segment: /<id> */
  id: string;
  /** Specification code, S1 - S10. */
  code: string;
  label: string;
  description: string;
  /** The audience this console is built for. */
  audience: CockpitAudience;
  /** Lucide icon name, resolved through navigation-icons. */
  icon: string;
  /** Permissions, any one of which admits the principal. */
  requiredPermissions: string[];
  /** The cockpit aggregation endpoint backing this console. */
  endpoint: string;
  keywords: string[];
};

export const cockpitCatalog: CockpitDefinition[] = [
  {
    id: "people-command-centre",
    code: "S1",
    label: "People Command Centre",
    description: "Org health, attrition, compensation parity and workforce forecasting",
    audience: "admin",
    icon: "layout-dashboard",
    requiredPermissions: ["employee.read"],
    endpoint: "/api/v1/cockpits/people-command-centre",
    keywords: ["executive", "chro", "attrition", "headcount", "org health"],
  },
  {
    id: "hr-operations-console",
    code: "S2",
    label: "HR Operations Console",
    description: "Approval queue, onboarding pipeline, absence density and helpdesk load",
    audience: "admin",
    icon: "users-round",
    requiredPermissions: ["employee.read"],
    endpoint: "/api/v1/cockpits/hr-operations-console",
    keywords: ["hr ops", "approvals", "onboarding", "helpdesk", "absence"],
  },
  {
    id: "attendance-intelligence",
    code: "S3",
    label: "Attendance Intelligence",
    description: "Attendance trend, punctuality by site, overtime burn and shift coverage",
    audience: "admin",
    icon: "clock-3",
    requiredPermissions: ["attendance.read"],
    endpoint: "/api/v1/cockpits/attendance-intelligence",
    keywords: ["time office", "punctuality", "overtime", "shift", "coverage"],
  },
  {
    id: "talent-acquisition-command",
    code: "S4",
    label: "Talent Acquisition Command",
    description: "Recruitment funnel, offer drop-off and candidate experience",
    audience: "admin",
    icon: "user-round-search",
    requiredPermissions: ["employee.read"],
    endpoint: "/api/v1/cockpits/talent-acquisition-command",
    keywords: ["ats", "recruiting", "funnel", "offers", "candidates"],
  },
  {
    id: "payroll-control-room",
    code: "S5",
    label: "Payroll Control Room",
    description: "Execution stepper, cost variance, composition and blocking exceptions",
    audience: "admin",
    icon: "indian-rupee",
    requiredPermissions: ["payroll.read"],
    endpoint: "/api/v1/cockpits/payroll-control-room",
    keywords: ["payroll", "finance", "cost", "variance", "exceptions"],
  },
  {
    id: "performance-calibration",
    code: "S6",
    label: "Performance & Calibration",
    description: "Rating distribution, competency profile and the nine-box grid",
    audience: "admin",
    icon: "target",
    requiredPermissions: ["employee.read"],
    endpoint: "/api/v1/cockpits/performance-calibration",
    keywords: ["performance", "calibration", "nine box", "ratings", "competency"],
  },
  {
    id: "manager-cockpit",
    code: "S7",
    label: "Manager Cockpit",
    description: "Team capacity, skill coverage and the triage approval queue",
    audience: "admin",
    icon: "users",
    requiredPermissions: ["employee.read"],
    endpoint: "/api/v1/cockpits/manager-cockpit",
    keywords: ["manager", "team", "capacity", "triage", "skills"],
  },
  {
    id: "employee-home",
    code: "S8",
    label: "Employee Home",
    description: "Shift status, leave balance, pay estimate, timesheet and goals",
    audience: "employee",
    icon: "home",
    requiredPermissions: ["employee.read"],
    endpoint: "/api/v1/cockpits/employee-home",
    keywords: ["self service", "my", "leave", "payslip", "timesheet"],
  },
  {
    id: "capability-intelligence",
    code: "S9",
    label: "Capability Intelligence",
    description: "Capability movement, learning conversion and hours by function",
    audience: "admin",
    icon: "graduation-cap",
    requiredPermissions: ["employee.read"],
    endpoint: "/api/v1/cockpits/capability-intelligence",
    keywords: ["learning", "l&d", "capability", "training", "magnetix"],
  },
  {
    id: "nucleus-intelligence",
    code: "S10",
    label: "Nucleus Intelligence",
    description: "Model detections, agent guardrails and AI model governance",
    audience: "admin",
    icon: "sparkles",
    requiredPermissions: ["tenant.read", "tenant.manage"],
    endpoint: "/api/v1/cockpits/nucleus-intelligence",
    keywords: ["ai", "governance", "model", "bias", "agents"],
  },
];

export const cockpitIds = cockpitCatalog.map((cockpit) => cockpit.id);

/** The permissions that mark a principal as administrative. */
export const ADMIN_PERMISSIONS = ["tenant.manage", "role.manage", "membership.manage"] as const;

/** The role codes that mark a principal as a Super Admin. */
export const ADMIN_ROLES = ["owner", "super_admin", "super-admin", "hr_admin"] as const;

/**
 * Whether the principal is administrative. Checked by permission first so the
 * result holds even where role codes are not carried on the context.
 */
export function isAdminPrincipal(permissions: readonly string[], roles: readonly string[] = []): boolean {
  if (ADMIN_PERMISSIONS.some((permission) => permissions.includes(permission))) return true;
  return ADMIN_ROLES.some((role) => roles.includes(role));
}

/** Whether this principal may open this cockpit. */
export function canAccessCockpit(
  cockpit: CockpitDefinition,
  permissions: readonly string[],
  roles: readonly string[] = [],
): boolean {
  const permitted =
    cockpit.requiredPermissions.length === 0 ||
    cockpit.requiredPermissions.some((permission) => permissions.includes(permission));
  if (!permitted) return false;
  const admin = isAdminPrincipal(permissions, roles);
  return cockpit.audience === "admin" ? admin : !admin;
}

/** The cockpits this principal may open, in specification order. */
export function authorizedCockpits(
  permissions: readonly string[],
  roles: readonly string[] = [],
): CockpitDefinition[] {
  return cockpitCatalog.filter((cockpit) => canAccessCockpit(cockpit, permissions, roles));
}

export function cockpitById(id: string): CockpitDefinition | undefined {
  return cockpitCatalog.find((cockpit) => cockpit.id === id);
}
