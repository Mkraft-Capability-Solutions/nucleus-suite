/**
 * System-managed tenant roles and the permissions each one gets.
 *
 * Patterns use SQL LIKE syntax and are matched against `permissions.permission_key`, so a permission
 * added to the catalogue later is picked up by the matching templates. Migration
 * 0028_role_templates.sql applies the same templates to existing organisations; keep both in step.
 * The owner role is not listed: owners hold every permission (see tenant-context.ts).
 */
export type RoleTemplate = { code: string; name: string; include: readonly string[]; exclude: readonly string[] };

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    code: "hr-manager",
    name: "HR Manager",
    include: ["%"],
    exclude: ["payroll.%", "tenant.manage", "loan.director.approve", "integration.sync", "compliance.filing.approve"],
  },
  {
    code: "payroll-admin",
    name: "Payroll Admin",
    include: [
      "payroll.%", "loan.%", "compliance.%", "tenant.read", "employee.read", "employee.bank.read", "employee.tax.read",
      "attendance.read", "leave.read", "audit.read", "membership.read", "role.read", "workforce.travel.read",
      "workforce.travel.approve", "integration.sync",
    ],
    exclude: [],
  },
  {
    code: "manager",
    name: "Manager",
    include: [
      "tenant.read", "employee.read", "attendance.read", "attendance.self.%", "leave.read", "leave.approve",
      "hr.helpdesk.self.%", "hr.helpdesk.team.%", "workforce.%.self.%", "workforce.%.team.%",
    ],
    exclude: [],
  },
  {
    code: "employee",
    name: "Employee",
    include: ["tenant.read", "employee.read", "attendance.read", "leave.read", "attendance.self.%", "hr.helpdesk.self.%", "workforce.%.self.%"],
    exclude: [],
  },
];
