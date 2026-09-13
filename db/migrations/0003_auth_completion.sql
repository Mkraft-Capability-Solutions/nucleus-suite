ALTER TABLE "user" ADD COLUMN "status" text NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_status_check" CHECK ("status" IN ('active', 'suspended', 'disabled'));
--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_normalized_uq" ON "user" (lower("email"));
--> statement-breakpoint
ALTER TABLE memberships ADD CONSTRAINT memberships_id_tenant_uq UNIQUE (id, tenant_id);
--> statement-breakpoint
ALTER TABLE roles ADD CONSTRAINT roles_id_tenant_uq UNIQUE (id, tenant_id);
--> statement-breakpoint
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_tenant_fk FOREIGN KEY (role_id, tenant_id) REFERENCES roles(id, tenant_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE membership_roles ADD CONSTRAINT membership_roles_membership_tenant_fk FOREIGN KEY (membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE membership_roles ADD CONSTRAINT membership_roles_role_tenant_fk FOREIGN KEY (role_id, tenant_id) REFERENCES roles(id, tenant_id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE UNIQUE INDEX invitations_pending_email_uq ON invitations (tenant_id, lower(email)) WHERE status = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX membership_roles_active_uq ON membership_roles (tenant_id, membership_id, role_id) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE TABLE auth_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  target_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX auth_security_events_target_time_idx ON auth_security_events (target_user_id, created_at DESC);
--> statement-breakpoint
CREATE POLICY tenants_bootstrap_insert ON tenants FOR INSERT WITH CHECK (
  id = app.current_tenant_id()
  AND app.current_user_id() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = app.current_user_id() AND m.status = 'active'
  )
);
--> statement-breakpoint
CREATE POLICY memberships_bootstrap_insert ON memberships FOR INSERT WITH CHECK (
  tenant_id = app.current_tenant_id()
  AND user_id = app.current_user_id()
  AND role = 'owner'
  AND status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM memberships existing
    WHERE existing.tenant_id = memberships.tenant_id AND existing.status = 'active'
  )
);
--> statement-breakpoint
INSERT INTO permissions (permission_key, field_domain, risk) VALUES
  ('tenant.read', 'ordinary', 'standard'),
  ('tenant.manage', 'ordinary', 'elevated'),
  ('membership.read', 'ordinary', 'standard'),
  ('membership.manage', 'ordinary', 'elevated'),
  ('role.read', 'ordinary', 'standard'),
  ('role.manage', 'ordinary', 'elevated'),
  ('employee.read', 'ordinary', 'standard'),
  ('employee.write', 'ordinary', 'elevated'),
  ('employee.bank.read', 'bank', 'restricted'),
  ('employee.tax.read', 'tax', 'restricted'),
  ('employee.health.read', 'health', 'restricted'),
  ('attendance.read', 'ordinary', 'standard'),
  ('attendance.write', 'ordinary', 'elevated'),
  ('leave.read', 'ordinary', 'standard'),
  ('leave.approve', 'ordinary', 'elevated'),
  ('payroll.read', 'compensation', 'restricted'),
  ('payroll.run', 'compensation', 'restricted'),
  ('payroll.rate.read', 'compensation', 'restricted'),
  ('audit.read', 'ordinary', 'elevated')
ON CONFLICT (permission_key) DO UPDATE SET
  field_domain = excluded.field_domain,
  risk = excluded.risk,
  status = 'active',
  updated_at = now();