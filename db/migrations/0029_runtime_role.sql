-- 0029 Runtime database role.
--
-- Row-level security only protects tenants from each other when the application connects as a
-- role that is subject to it. Superusers and roles with BYPASSRLS — including the default owner role
-- on managed Postgres such as Neon — skip every policy. This migration completes the grants for the
-- NOLOGIN group role `app_runtime` (created in 0008), so the deployed application can connect as a
-- login role that is a member of it:
--
--   CREATE ROLE nucleus_app LOGIN PASSWORD '<generated>' IN ROLE app_runtime;   -- once per database
--
-- and DATABASE_URL uses nucleus_app, while MIGRATION_DATABASE_URL keeps the owner role.
-- See db/MIGRATIONS.md, step "Runtime role".

GRANT USAGE ON SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO app_runtime;
--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO app_runtime;
--> statement-breakpoint

-- Global reference catalogues are maintained by migrations, not by the application.
REVOKE INSERT, UPDATE, DELETE ON permissions, countries, currencies, jurisdictions FROM app_runtime;
--> statement-breakpoint

-- Platform operators create organisations and change their status. Members can already read their
-- own organisations (tenants_select_member); there was no write policy for the platform operator.
DROP POLICY IF EXISTS tenants_platform_admin_write ON tenants;
--> statement-breakpoint
CREATE POLICY tenants_platform_admin_write ON tenants
  FOR ALL USING (app.is_platform_admin()) WITH CHECK (app.is_platform_admin());
--> statement-breakpoint

-- Organisation owners update their own organisation's profile (name, timezone, currency).
DROP POLICY IF EXISTS tenants_member_update ON tenants;
--> statement-breakpoint
CREATE POLICY tenants_member_update ON tenants
  FOR UPDATE USING (app.current_tenant_is_authorized(id)) WITH CHECK (app.current_tenant_is_authorized(id));
