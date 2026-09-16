-- Employee self-service: the permission split the employee surface needs.
--
-- WHY THIS IS NARROW
-- docs/PROPOSED_HRMS_ROLE_GRANTS.sql was reviewed and REJECTED (recorded in
-- docs/HRMS_WORKFLOW_DELIVERY.md:48) because it granted across employee,
-- manager, HR, payroll and compliance roles at once, matching every active role
-- in every existing tenant. This migration deliberately does far less:
--   * it touches ONE role code, 'employee';
--   * it grants ONLY named *.self.* keys, never a full or team key;
--   * it adds no approval capability of any kind.
-- A self key lets a principal act on their OWN record and nothing else. The
-- row-level scoping that enforces that already exists and is already tested
-- (src/server/workflows/operational-access.ts operationalScope + the service SQL).
--
-- WHAT WAS MISSING BEFORE
-- Attendance had NO requester/approver split at all: raising a punch, a
-- regularization, a gate pass or a shift swap and DECIDING one both enforced
-- plain 'attendance.write'. An employee therefore could not record their own
-- attendance without also being able to approve everyone else's. The new
-- attendance.self.write key closes that: it admits recording one's own time and
-- raising one's own request, and carries no decision rights.
INSERT INTO permissions(permission_key, field_domain, risk)
VALUES
  ('attendance.self.write','ordinary','standard'),
  ('attendance.self.read','ordinary','standard')
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
-- Grant the self keys to the employee role only.
-- Scope note: this applies to the 'employee' role in every tenant, which is the
-- intended meaning of employee self-service. It grants no read of another
-- person's record: every one of these keys resolves to scope 'self' and the
-- service refuses when the account has no linked employee profile.
DO $employee_self$ BEGIN
PERFORM set_config('app.platform_admin','true',true);
INSERT INTO role_permissions(tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'employee'
  AND r.status = 'active'
  AND p.status = 'active'
  AND p.permission_key IN (
    -- record my own attendance and raise my own attendance requests
    'attendance.self.read',
    'attendance.self.write',
    -- raise and track my own HR helpdesk tickets
    'hr.helpdesk.self.read',
    'hr.helpdesk.self.write',
    -- log and submit my own timesheets
    'workforce.timesheets.self.read',
    'workforce.timesheets.self.write',
    -- raise my own travel requests and expense claims
    'workforce.travel.self.read',
    'workforce.travel.self.write'
  )
ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;
END $employee_self$;
