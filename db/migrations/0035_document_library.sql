-- 0035 Document library: who may read, upload and delete documents.
--
-- The document library (Documents in the side menu) files every employee document under
-- company > department > person. Two kinds of access:
--   * document.read / document.write / document.delete: every employee's documents (HR and
--     administrators; the hr-manager template matches them with '%', owners hold everything);
--   * document.self.read / document.self.write / document.self.delete: one's own documents only
--     (employee and manager roles). The service scopes every self key to the account's own
--     employee record and refuses when the account has no linked record.
-- Self delete is limited further in the service: a person may delete only what they uploaded.
INSERT INTO permissions(permission_key, field_domain, risk)
VALUES
  ('document.read', 'sensitive', 'standard'),
  ('document.write', 'sensitive', 'high'),
  ('document.delete', 'sensitive', 'high'),
  ('document.self.read', 'ordinary', 'standard'),
  ('document.self.write', 'ordinary', 'standard'),
  ('document.self.delete', 'ordinary', 'standard')
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
-- Grant them to the system-managed roles, as src/server/identity/role-templates.ts now describes.
-- Additive only: nothing is removed from any role, and roles an organisation created itself are
-- not touched.
DO $document_library$ BEGIN
PERFORM set_config('app.platform_admin', 'true', true);
INSERT INTO role_permissions(tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.status = 'active' AND (
  (r.code = 'hr-manager' AND p.permission_key IN ('document.read', 'document.write', 'document.delete', 'document.self.read', 'document.self.write', 'document.self.delete'))
  OR (r.code IN ('manager', 'employee') AND p.permission_key IN ('document.self.read', 'document.self.write', 'document.self.delete'))
)
WHERE r.system_managed
ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;
END $document_library$;
