CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.current_membership_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.membership_id', true), '')::uuid
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.current_tenant_is_authorized(candidate_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT candidate_tenant_id = app.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.id = app.current_membership_id()
        AND m.tenant_id = candidate_tenant_id
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
    )
$$;
--> statement-breakpoint

CREATE TABLE tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en-IN',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency text NOT NULL DEFAULT 'INR',
  policy_schema_version integer NOT NULL DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_settings_tenant_uq UNIQUE (tenant_id)
);
--> statement-breakpoint

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  field_domain text NOT NULL DEFAULT 'ordinary',
  risk text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_status_check CHECK (status IN ('active', 'retired'))
);
--> statement-breakpoint

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  system_managed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_tenant_code_uq UNIQUE (tenant_id, code),
  CONSTRAINT roles_status_check CHECK (status IN ('active', 'retired'))
);
--> statement-breakpoint

CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_permissions_tenant_role_permission_uq UNIQUE (tenant_id, role_id, permission_id)
);
--> statement-breakpoint

CREATE TABLE membership_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_roles_valid_range CHECK (valid_to IS NULL OR valid_to > valid_from)
);
--> statement-breakpoint

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  invited_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  accepted_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
);
--> statement-breakpoint

CREATE INDEX roles_tenant_status_idx ON roles (tenant_id, status);
--> statement-breakpoint
CREATE INDEX role_permissions_tenant_role_idx ON role_permissions (tenant_id, role_id);
--> statement-breakpoint
CREATE INDEX membership_roles_tenant_membership_idx ON membership_roles (tenant_id, membership_id);
--> statement-breakpoint
CREATE INDEX invitations_tenant_status_idx ON invitations (tenant_id, status);
--> statement-breakpoint

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE membership_roles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_settings_isolate ON tenant_settings USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE POLICY roles_isolate ON roles USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE POLICY role_permissions_isolate ON role_permissions USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE POLICY membership_roles_isolate ON membership_roles USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE POLICY invitations_isolate ON invitations USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint

DROP POLICY tenants_isolate ON tenants;
--> statement-breakpoint
CREATE POLICY tenants_select_member ON tenants FOR SELECT USING (
  EXISTS (SELECT 1 FROM memberships m WHERE m.tenant_id = tenants.id AND m.user_id = app.current_user_id() AND m.status = 'active')
);
--> statement-breakpoint

DROP POLICY memberships_isolate ON memberships;
--> statement-breakpoint
CREATE POLICY memberships_select_self ON memberships FOR SELECT USING (user_id = app.current_user_id() AND status = 'active');
--> statement-breakpoint

DROP POLICY employees_isolate ON employees;
--> statement-breakpoint
CREATE POLICY employees_isolate ON employees USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY attendance_days_isolate ON attendance_days;
--> statement-breakpoint
CREATE POLICY attendance_days_isolate ON attendance_days USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY attendance_punches_isolate ON attendance_punches;
--> statement-breakpoint
CREATE POLICY attendance_punches_isolate ON attendance_punches USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY leave_balances_isolate ON leave_balances;
--> statement-breakpoint
CREATE POLICY leave_balances_isolate ON leave_balances USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY leave_requests_isolate ON leave_requests;
--> statement-breakpoint
CREATE POLICY leave_requests_isolate ON leave_requests USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY leave_approvals_isolate ON leave_approvals;
--> statement-breakpoint
CREATE POLICY leave_approvals_isolate ON leave_approvals USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY payroll_runs_isolate ON payroll_runs;
--> statement-breakpoint
CREATE POLICY payroll_runs_isolate ON payroll_runs USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY payroll_anomalies_isolate ON payroll_anomalies;
--> statement-breakpoint
CREATE POLICY payroll_anomalies_isolate ON payroll_anomalies USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY loans_isolate ON loans;
--> statement-breakpoint
CREATE POLICY loans_isolate ON loans USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY loan_guarantors_isolate ON loan_guarantors;
--> statement-breakpoint
CREATE POLICY loan_guarantors_isolate ON loan_guarantors USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DROP POLICY audit_events_read_insert ON audit_events;
--> statement-breakpoint
DROP POLICY audit_events_append ON audit_events;
--> statement-breakpoint
CREATE POLICY audit_events_read ON audit_events FOR SELECT USING (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE POLICY audit_events_append ON audit_events FOR INSERT WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
