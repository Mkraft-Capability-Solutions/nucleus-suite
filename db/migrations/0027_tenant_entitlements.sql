-- 0027 Tenant entitlements: module → sub-module → feature switches and settings per organisation.
--
-- Reuses tenant_features (created in 0004 with RLS, never written until now). One row per key whose
-- value the organisation has chosen; keys without a row use the catalog default in
-- src/lib/entitlements/catalog.ts. Keys are hierarchical:
--   module      'leave'
--   sub-module  'leave.requests'
--   feature     'leave.requests.early_return'
-- See db/MIGRATIONS.md for verification queries and rollback.

ALTER TABLE tenant_features ADD COLUMN IF NOT EXISTS updated_by text REFERENCES "user"(id) ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE tenant_features ADD COLUMN IF NOT EXISTS scope text GENERATED ALWAYS AS (
  CASE length(feature_key) - length(replace(feature_key, '.', ''))
    WHEN 0 THEN 'module'
    WHEN 1 THEN 'submodule'
    ELSE 'feature'
  END
) STORED;
--> statement-breakpoint

ALTER TABLE tenant_features DROP CONSTRAINT IF EXISTS tenant_features_key_format;
--> statement-breakpoint
ALTER TABLE tenant_features ADD CONSTRAINT tenant_features_key_format
  CHECK (feature_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,2}$');
--> statement-breakpoint

ALTER TABLE tenant_features DROP CONSTRAINT IF EXISTS tenant_features_config_object;
--> statement-breakpoint
ALTER TABLE tenant_features ADD CONSTRAINT tenant_features_config_object CHECK (jsonb_typeof(config) = 'object');
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS tenant_features_tenant_scope_idx ON tenant_features (tenant_id, scope);
--> statement-breakpoint

-- Keep every existing organisation exactly as it is today: before this migration every screen was
-- available to every organisation. Switch on every non-core module and every sub-module/feature
-- that predates this migration but is off by default for new organisations.
-- (Core modules and locked sub-modules are always on and need no row. Features that are new
-- behaviour — attendance.punches.geofence_enforcement, attendance.punches.selfie_required — stay
-- at their default, off.)
DO $$
BEGIN
  PERFORM set_config('app.platform_admin', 'true', true);
  INSERT INTO tenant_features (tenant_id, feature_key, enabled, config)
  SELECT t.id, k.key, true, '{}'::jsonb
  FROM tenants t
  CROSS JOIN unnest(ARRAY[
    -- modules
    'attendance', 'leave', 'lifecycle', 'payroll', 'compensation', 'recruitment', 'performance',
    'learning', 'engagement', 'helpdesk', 'contract_workforce', 'projects', 'compliance',
    'analytics', 'ai', 'integrations',
    -- sub-modules and features that are off by default for new organisations
    'attendance.field_force', 'leave.encashment', 'payroll.runs.multi_currency',
    'recruitment.internal_mobility', 'performance.succession', 'engagement.social_feed',
    'compliance.golden_cases', 'compliance.erp_sync', 'analytics.custom_reports', 'ai.voice',
    'ai.agents', 'integrations.webhooks', 'administration.readiness'
  ]) AS k(key)
  ON CONFLICT (tenant_id, feature_key) DO NOTHING;
END $$;
--> statement-breakpoint

-- Defence in depth for the plan boundary. The application lets organisation administrators switch
-- features and edit settings, while switching modules and sub-modules on or off is reserved for the
-- platform operator. The same rule is enforced here for any session that is not marked as a
-- platform-administrator session.
CREATE OR REPLACE FUNCTION app.guard_tenant_features() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_scope text;
BEGIN
  IF app.is_platform_admin() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Only the platform operator can remove entitlement rows' USING ERRCODE = '42501';
  END IF;
  target_scope := CASE length(NEW.feature_key) - length(replace(NEW.feature_key, '.', ''))
    WHEN 0 THEN 'module' WHEN 1 THEN 'submodule' ELSE 'feature' END;
  IF TG_OP = 'UPDATE' AND (NEW.feature_key IS DISTINCT FROM OLD.feature_key OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) THEN
    RAISE EXCEPTION 'Entitlement keys cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF target_scope = 'module' AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only the platform operator can add modules' USING ERRCODE = '42501';
  END IF;
  IF target_scope IN ('module', 'submodule') AND TG_OP = 'UPDATE' AND NEW.enabled IS DISTINCT FROM OLD.enabled THEN
    RAISE EXCEPTION 'Only the platform operator can switch modules and sub-modules' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS tenant_features_guard ON tenant_features;
--> statement-breakpoint
CREATE TRIGGER tenant_features_guard
  BEFORE INSERT OR UPDATE OR DELETE ON tenant_features
  FOR EACH ROW EXECUTE FUNCTION app.guard_tenant_features();
