-- 0033 Personal preferences, per member of an organisation.
--
-- Holds choices a person makes for themselves in the workspace, for example the actions pinned to
-- the quick-actions menu and the dashboard to open by default. One row per member and key; the
-- value is JSON validated by the application (src/server/preferences/service.ts).
--
-- Row-level security: rows belong to the organisation (as every table) AND to the member who owns
-- them, so a person reads and writes only their own preferences.
CREATE TABLE IF NOT EXISTS member_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  membership_id uuid NOT NULL,
  preference_key text NOT NULL CHECK (preference_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, membership_id, preference_key),
  FOREIGN KEY (tenant_id, membership_id) REFERENCES memberships(tenant_id, id) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE member_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE member_preferences FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS member_preferences_own ON member_preferences;
--> statement-breakpoint
CREATE POLICY member_preferences_own ON member_preferences
  USING (app.current_tenant_is_authorized(tenant_id) AND membership_id = app.current_membership_id())
  WITH CHECK (app.current_tenant_is_authorized(tenant_id) AND membership_id = app.current_membership_id());
