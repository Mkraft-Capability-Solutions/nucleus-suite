-- 0028 System-managed role templates for every organisation.
--
-- Until now the application granted every permission to HR and payroll users at request time
-- (an "is privileged" shortcut in tenant-context.ts). That shortcut is removed; what a role can do
-- now comes only from role_permissions. This migration gives the system-managed roles the
-- permission sets they need, using the same templates as src/server/identity/role-templates.ts
-- (patterns use SQL LIKE syntax). Owners keep every permission (handled in code).
--
-- Re-runnable: creates missing template roles per organisation and replaces the permissions of
-- system-managed template roles only. Roles an organisation created itself are not touched.

DO $$
DECLARE
  template record;
BEGIN
  PERFORM set_config('app.platform_admin', 'true', true);
  FOR template IN
    SELECT * FROM (VALUES
      ('hr-manager', 'HR Manager',
        ARRAY['%'],
        ARRAY['payroll.%', 'tenant.manage', 'loan.director.approve', 'integration.sync', 'compliance.filing.approve']),
      ('payroll-admin', 'Payroll Admin',
        ARRAY['payroll.%', 'loan.%', 'compliance.%', 'tenant.read', 'employee.read', 'employee.bank.read',
              'employee.tax.read', 'attendance.read', 'leave.read', 'audit.read', 'membership.read', 'role.read',
              'workforce.travel.read', 'workforce.travel.approve', 'integration.sync'],
        ARRAY[]::text[]),
      ('manager', 'Manager',
        ARRAY['tenant.read', 'employee.read', 'attendance.read', 'attendance.self.%', 'leave.read', 'leave.approve',
              'hr.helpdesk.self.%', 'hr.helpdesk.team.%', 'workforce.%.self.%', 'workforce.%.team.%'],
        ARRAY[]::text[]),
      ('employee', 'Employee',
        ARRAY['tenant.read', 'employee.read', 'attendance.read', 'leave.read', 'attendance.self.%',
              'hr.helpdesk.self.%', 'workforce.%.self.%'],
        ARRAY[]::text[])
    ) AS v(code, name, include_patterns, exclude_patterns)
  LOOP
    INSERT INTO roles (tenant_id, code, name, system_managed)
    SELECT t.id, template.code, template.name, true FROM tenants t
    ON CONFLICT (tenant_id, code) DO NOTHING;

    DELETE FROM role_permissions rp
    USING roles r
    WHERE rp.role_id = r.id AND rp.tenant_id = r.tenant_id AND r.code = template.code AND r.system_managed;

    INSERT INTO role_permissions (tenant_id, role_id, permission_id)
    SELECT r.tenant_id, r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.code = template.code
      AND r.system_managed
      AND p.status = 'active'
      AND p.permission_key LIKE ANY (template.include_patterns)
      AND NOT (p.permission_key LIKE ANY (template.exclude_patterns))
    ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;
  END LOOP;
END $$;
