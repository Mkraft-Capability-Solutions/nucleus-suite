-- Explicit payroll master data. Legacy JSON payroll scaffolding is not a reader of these tables.
CREATE TABLE payroll_jurisdictions (
  code text PRIMARY KEY,
  country_code char(2) NOT NULL,
  region_code text,
  currency_code char(3) NOT NULL,
  UNIQUE (code, currency_code)
);
--> statement-breakpoint
CREATE TABLE payroll_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL,
  jurisdiction_code text NOT NULL REFERENCES payroll_jurisdictions(code) ON DELETE RESTRICT,
  pay_frequency text NOT NULL CHECK (pay_frequency IN ('weekly', 'fortnightly', 'semimonthly', 'monthly')),
  effective_from date NOT NULL,
  effective_to date,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, effective_from),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON DELETE RESTRICT,
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
CREATE TABLE payroll_component_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  code text NOT NULL,
  label_message_id uuid REFERENCES ui_messages(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('earning', 'deduction', 'employer_contribution')),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, code)
);
--> statement-breakpoint
CREATE TABLE payroll_profile_components (
  tenant_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  component_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  PRIMARY KEY (tenant_id, profile_id, component_id),
  FOREIGN KEY (tenant_id, profile_id) REFERENCES payroll_profiles(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, component_id) REFERENCES payroll_component_definitions(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX payroll_profiles_employee_dates_idx ON payroll_profiles(tenant_id, employee_id, effective_from, effective_to);
--> statement-breakpoint
ALTER TABLE payroll_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY payroll_profiles_isolation ON payroll_profiles USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
ALTER TABLE payroll_component_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_component_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY payroll_components_isolation ON payroll_component_definitions USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
ALTER TABLE payroll_profile_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_profile_components FORCE ROW LEVEL SECURITY;
CREATE POLICY payroll_profile_components_isolation ON payroll_profile_components USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
GRANT SELECT ON payroll_jurisdictions TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON payroll_profiles, payroll_component_definitions, payroll_profile_components TO app_runtime;
