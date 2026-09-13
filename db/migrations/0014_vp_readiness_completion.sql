-- 0014: operational model for the 26 VP-readiness requirements.
-- Additive by design: canonical domain rows remain the aggregate source of truth.

CREATE TABLE IF NOT EXISTS vp_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  domain text NOT NULL,
  code text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  effective_from date NOT NULL,
  effective_to date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_membership_id uuid REFERENCES memberships(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_rule_sets_dates_check CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT vp_rule_sets_tenant_domain_code_version_uq UNIQUE (tenant_id, domain, code, version)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS vp_rule_sets_active_idx ON vp_rule_sets (tenant_id, domain, code, effective_from DESC) WHERE status = 'approved';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_location_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  can_view_compensation boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_location_grants_dates_check CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT vp_location_grants_member_location_uq UNIQUE (tenant_id, membership_id, location_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_attendance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  attendance_day_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  attendance_date date NOT NULL,
  assigned_shift_code text NOT NULL,
  inferred_shift_code text,
  inference_reason text,
  rule_set_id uuid NOT NULL REFERENCES vp_rule_sets(id) ON DELETE RESTRICT,
  day_type text NOT NULL CHECK (day_type IN ('working','weekly_off','holiday','festival')),
  status text NOT NULL CHECK (status IN ('present','half_day','absent','weekly_off','holiday')),
  status_reason text NOT NULL,
  gross_minutes integer NOT NULL CHECK (gross_minutes >= 0),
  break_minutes integer NOT NULL CHECK (break_minutes >= 0),
  net_minutes integer NOT NULL CHECK (net_minutes >= 0),
  gate_pass_minutes integer NOT NULL DEFAULT 0 CHECK (gate_pass_minutes >= 0),
  payable_ot_minutes integer NOT NULL DEFAULT 0 CHECK (payable_ot_minutes >= 0),
  trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_attendance_results_day_uq UNIQUE (tenant_id, attendance_day_id)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS vp_attendance_results_employee_date_idx ON vp_attendance_results (tenant_id, employee_id, attendance_date DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_erp_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('inbound_employee','outbound_gl')),
  external_key text NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','validated','applied','queued','posted','failed','dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_message text,
  acknowledgement_ref text,
  applied_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_erp_records_idempotency_uq UNIQUE (tenant_id, direction, external_key, payload_hash)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS vp_erp_records_status_idx ON vp_erp_records (tenant_id, direction, status, created_at);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_gl_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','posted','failed','reconciled')),
  debit_minor bigint NOT NULL CHECK (debit_minor >= 0),
  credit_minor bigint NOT NULL CHECK (credit_minor >= 0),
  acknowledgement_ref text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_gl_batches_balanced_check CHECK (debit_minor = credit_minor),
  CONSTRAINT vp_gl_batches_run_uq UNIQUE (tenant_id, payroll_run_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_gl_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES vp_gl_batches(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  cost_centre text,
  department_code text,
  component_code text NOT NULL,
  debit_minor bigint NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor bigint NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  narration text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_gl_lines_one_side_check CHECK ((debit_minor = 0) <> (credit_minor = 0))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS vp_gl_lines_batch_idx ON vp_gl_lines (tenant_id, batch_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_statutory_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  form_code text NOT NULL,
  state_code text NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT,
  location_id uuid,
  period text NOT NULL,
  template_version integer NOT NULL CHECK (template_version > 0),
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','reviewed','filed','rejected')),
  data jsonb NOT NULL,
  rendered_html text NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  filed_at timestamptz,
  acknowledgement_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_statutory_instances_natural_uq UNIQUE (tenant_id, form_code, state_code, employee_id, period)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_manpower_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  plan_year integer NOT NULL CHECK (plan_year BETWEEN 2000 AND 2200),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  designation text NOT NULL,
  location_id uuid,
  sanctioned_count integer NOT NULL CHECK (sanctioned_count >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  approved_by_membership_id uuid REFERENCES memberships(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vp_manpower_lines_natural_uq UNIQUE (tenant_id, plan_year, department_id, designation, location_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS vp_feature_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  kind text NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT,
  reference_id uuid,
  external_key text,
  status text NOT NULL,
  effective_on date,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_membership_id uuid REFERENCES memberships(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS vp_feature_records_external_uq ON vp_feature_records (tenant_id, kind, external_key) WHERE external_key IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS vp_feature_records_kind_status_idx ON vp_feature_records (tenant_id, kind, status, created_at DESC);
--> statement-breakpoint

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'vp_rule_sets','vp_location_grants','vp_attendance_results','vp_erp_records',
    'vp_gl_batches','vp_gl_lines','vp_statutory_instances','vp_manpower_lines','vp_feature_records'
  ]::text[] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_isolate', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id))', table_name || '_isolate', table_name);
  END LOOP;
END $$;
