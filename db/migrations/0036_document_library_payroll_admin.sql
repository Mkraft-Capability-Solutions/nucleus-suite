-- 0036 Payroll administrators are employees too: they keep their own documents in the library
-- (document.self.*), like every other member. Matches the payroll-admin template in
-- src/server/identity/role-templates.ts. Additive; organisation-made roles are not touched.
DO $document_library_payroll$ BEGIN
PERFORM set_config('app.platform_admin', 'true', true);
INSERT INTO role_permissions(tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.status = 'active' AND p.permission_key IN ('document.self.read', 'document.self.write', 'document.self.delete')
WHERE r.system_managed AND r.code = 'payroll-admin'
ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;
END $document_library_payroll$;
