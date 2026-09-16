-- Workforce Operations: field workforce capability.
-- Registers the workforce.field.* permission domain used by the Field Workforce module
-- (worker categories, plant calendars and statutory holiday rules) and grants it to the
-- owner role, matching the registration pattern established in 0016/0017.
-- No new tables: worker categories, plant calendars, holidays and project tasks are stored
-- as catalog-driven records in hrms_operation_records via src/lib/operational-catalog.ts.
INSERT INTO permissions(permission_key, field_domain, risk)
SELECT domain || '.' || action, 'ordinary', CASE WHEN action = 'read' THEN 'standard' ELSE 'high' END
FROM unnest(ARRAY['workforce.field']) domain
CROSS JOIN unnest(ARRAY['read','write','approve']) action
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO permissions(permission_key, field_domain, risk)
SELECT domain || '.' || action, 'ordinary', CASE WHEN action LIKE '%read' THEN 'standard' ELSE 'high' END
FROM unnest(ARRAY['workforce.projects','workforce.rosters','workforce.assets']) domain
CROSS JOIN unnest(ARRAY['self.read','self.write','team.read','team.approve']) action
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
DO $grant$ BEGIN
PERFORM set_config('app.platform_admin','true',true);
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='owner' AND r.status='active' AND p.status='active'
 AND p.permission_key LIKE 'workforce.%'
ON CONFLICT(tenant_id,role_id,permission_id) DO NOTHING;
END $grant$;
