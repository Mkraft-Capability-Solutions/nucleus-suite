INSERT INTO permissions(permission_key,field_domain,risk)
SELECT domain || '.' || action,'ordinary',CASE WHEN action LIKE '%read' THEN 'standard' ELSE 'high' END
FROM unnest(ARRAY['hr.helpdesk','workforce.travel','workforce.timesheets','workforce.projects','workforce.rosters','workforce.assets']) domain
CROSS JOIN unnest(ARRAY['self.read','self.write','team.read','team.approve']) action
ON CONFLICT(permission_key) DO NOTHING;
--> statement-breakpoint
DO $roles$ BEGIN
PERFORM set_config('app.platform_admin','true',true);
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.status='active' AND p.status='active' AND (
 (r.code IN ('owner','employee','manager') AND p.permission_key IN ('hr.helpdesk.self.read','hr.helpdesk.self.write','workforce.travel.self.read','workforce.travel.self.write','workforce.timesheets.self.read','workforce.timesheets.self.write'))
 OR (r.code IN ('owner','manager') AND p.permission_key IN ('hr.helpdesk.team.read','hr.helpdesk.team.approve','workforce.travel.team.read','workforce.travel.team.approve','workforce.timesheets.team.read','workforce.timesheets.team.approve'))
 OR (r.code='hr-manager' AND (p.permission_key IN ('employee.dossier.read','employee.dossier.write') OR p.permission_key IN ('hr.helpdesk.read','hr.helpdesk.write','hr.helpdesk.approve','workforce.projects.read','workforce.projects.write','workforce.projects.approve','workforce.assets.read','workforce.assets.write','workforce.assets.approve','workforce.rosters.read','workforce.rosters.write','workforce.rosters.approve','workforce.field.read','workforce.field.write','workforce.field.approve','talent.mobility.read','talent.mobility.write','talent.mobility.approve','workforce.travel.read','workforce.timesheets.read')))
 OR (r.code='payroll-admin' AND p.permission_key IN ('payroll.settlement.read','payroll.settlement.write','payroll.settlement.approve','payroll.accounting.read','payroll.accounting.write','payroll.accounting.approve','workforce.travel.read','workforce.travel.approve'))
 -- SCR-055 bank disbursement. Preparing a bank file reads employee bank details
 -- through the dossier, so it needs the dossier and bank field permissions.
 -- Dual control on release is enforced per person in the service (the releaser
 -- must differ from the preparer), not by splitting the key across roles.
 OR (r.code='payroll-admin' AND p.permission_key IN ('employee.dossier.read','employee.bank.read'))
 OR (r.code='owner' AND p.permission_key IN ('payroll.accounting.approve','payroll.accounting.read'))
 OR (r.code='compliance-officer' AND p.permission_key IN ('compliance.filing.read','compliance.filing.write','compliance.filing.approve','compliance.forms.generate'))
) ON CONFLICT(tenant_id,role_id,permission_id) DO NOTHING;
END $roles$;
