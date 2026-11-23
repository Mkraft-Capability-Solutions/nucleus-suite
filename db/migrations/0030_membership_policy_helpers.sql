-- 0030 Membership policies that work for a role subject to row-level security.
--
-- Three policies on `memberships` (bootstrap insert, owner insert, owner update) contain a sub-query
-- on `memberships` itself. A superuser or BYPASSRLS role never notices; the runtime role from 0029
-- does: PostgreSQL rejects every INSERT/UPDATE on memberships with
-- "infinite recursion detected in policy for relation memberships" (for example when the platform
-- operator creates an organisation). The membership look-ups move into SECURITY DEFINER functions,
-- which run as the migration (owner) role and therefore read memberships without re-entering the
-- policies. The checks themselves are unchanged.
--
-- The owner role must bypass RLS (a superuser locally; on Neon the project owner role, e.g.
-- neondb_owner, has BYPASSRLS). See db/MIGRATIONS.md.

CREATE OR REPLACE FUNCTION app.tenant_has_active_members(candidate_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = candidate_tenant_id AND m.status = 'active'
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.current_member_is_owner(candidate_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships actor
    WHERE actor.id = app.current_membership_id()
      AND actor.user_id = app.current_user_id()
      AND actor.tenant_id = candidate_tenant_id
      AND actor.role = 'owner'
      AND actor.status = 'active'
  )
$$;
--> statement-breakpoint

-- Same rule as 0013, evaluated as the owner so policies on other tables do not re-enter the
-- memberships policies for every row they check.
CREATE OR REPLACE FUNCTION app.current_tenant_is_authorized(candidate_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
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

REVOKE ALL ON FUNCTION app.tenant_has_active_members(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.current_member_is_owner(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.tenant_has_active_members(uuid), app.current_member_is_owner(uuid), app.current_tenant_is_authorized(uuid) TO app_runtime;
--> statement-breakpoint

DROP POLICY IF EXISTS memberships_bootstrap_insert ON memberships;
--> statement-breakpoint
CREATE POLICY memberships_bootstrap_insert ON memberships FOR INSERT WITH CHECK (
  tenant_id = app.current_tenant_id()
  AND user_id = app.current_user_id()
  AND role = 'owner'
  AND status = 'active'
  AND NOT app.tenant_has_active_members(tenant_id)
);
--> statement-breakpoint

DROP POLICY IF EXISTS memberships_owner_insert ON memberships;
--> statement-breakpoint
CREATE POLICY memberships_owner_insert ON memberships FOR INSERT WITH CHECK (
  tenant_id = app.current_tenant_id() AND app.current_member_is_owner(tenant_id)
);
--> statement-breakpoint

DROP POLICY IF EXISTS memberships_owner_update ON memberships;
--> statement-breakpoint
CREATE POLICY memberships_owner_update ON memberships FOR UPDATE
  USING (tenant_id = app.current_tenant_id() AND app.current_member_is_owner(tenant_id))
  WITH CHECK (tenant_id = app.current_tenant_id());
