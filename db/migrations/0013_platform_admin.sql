-- A platform operator is authenticated by the application and marked only for
-- the duration of a transaction. Tenant RLS remains the default for every
-- other request; this narrowly scoped escape hatch powers the control plane.
CREATE OR REPLACE FUNCTION app.is_platform_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.platform_admin', true) = 'true'
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.current_tenant_is_authorized(candidate_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app.is_platform_admin()
    OR (
      candidate_tenant_id = app.current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.id = app.current_membership_id()
          AND m.tenant_id = candidate_tenant_id
          AND m.user_id = app.current_user_id()
          AND m.status = 'active'
      )
    )
$$;
--> statement-breakpoint

DROP POLICY IF EXISTS tenants_select_member ON tenants;
--> statement-breakpoint
CREATE POLICY tenants_select_member ON tenants FOR SELECT USING (
  app.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.tenant_id = tenants.id AND m.user_id = app.current_user_id() AND m.status = 'active'
  )
);
--> statement-breakpoint

DROP POLICY IF EXISTS memberships_select_self ON memberships;
--> statement-breakpoint
CREATE POLICY memberships_select_self ON memberships FOR SELECT USING (
  app.is_platform_admin() OR (user_id = app.current_user_id() AND status = 'active')
);
