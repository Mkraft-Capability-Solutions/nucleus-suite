-- 0039 Intra-group employment movement log (append-only audit trail).
--
-- 1. The employee's payroll currency is the existing employees.currency column (no new column).
-- 2. employment_movement_logs: one row per hire, inter-company transfer, promotion, role change or
--    corporate deputation, with the from/to company, designation, department and currency. Rows are
--    permanent: a trigger rejects UPDATE and DELETE for every role, and app_runtime has neither grant.
--    A movement dated in the future is applied to the employee record by the scheduled task
--    'people.apply_movement' (scheduled_tasks, 0005) on its effective date; applied_at is kept on the
--    task, never on the log row.
-- 3. employee_job_history (0031) keeps being written for each applied movement, so the existing
--    career history view stays complete.

CREATE TABLE IF NOT EXISTS employment_movement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  root_group_id uuid,
  employee_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('HIRE', 'INTER_COMPANY_TRANSFER', 'PROMOTION', 'ROLE_CHANGE', 'CORPORATE_DEPUTATION')),
  from_company_id uuid,
  to_company_id uuid NOT NULL,
  from_designation text,
  to_designation text,
  from_department text,
  to_department text,
  from_currency text CHECK (from_currency IS NULL OR from_currency ~ '^[A-Z]{3}$'),
  to_currency text CHECK (to_currency IS NULL OR to_currency ~ '^[A-Z]{3}$'),
  effective_date date NOT NULL,
  remarks text CHECK (remarks IS NULL OR length(remarks) <= 1000),
  approved_by uuid,
  created_by uuid,
  created_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK (movement_type <> 'INTER_COMPANY_TRANSFER' OR (from_company_id IS NOT NULL AND from_company_id <> to_company_id)),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (from_company_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (to_company_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (root_group_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employment_movement_logs_employee_idx
  ON employment_movement_logs (tenant_id, employee_id, effective_date DESC, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employment_movement_logs_to_company_idx ON employment_movement_logs (tenant_id, to_company_id);
--> statement-breakpoint
ALTER TABLE employment_movement_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE employment_movement_logs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS employment_movement_logs_isolate ON employment_movement_logs;
--> statement-breakpoint
CREATE POLICY employment_movement_logs_isolate ON employment_movement_logs
  USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT ON employment_movement_logs TO app_runtime;
    REVOKE UPDATE, DELETE, TRUNCATE ON employment_movement_logs FROM app_runtime;
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.forbid_movement_log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Employment movement logs are permanent. Record a new movement instead of changing or deleting one.'
    USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS employment_movement_logs_immutable ON employment_movement_logs;
--> statement-breakpoint
CREATE TRIGGER employment_movement_logs_immutable BEFORE UPDATE OR DELETE ON employment_movement_logs
  FOR EACH ROW EXECUTE FUNCTION app.forbid_movement_log_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS employment_movement_logs_no_truncate ON employment_movement_logs;
--> statement-breakpoint
CREATE TRIGGER employment_movement_logs_no_truncate BEFORE TRUNCATE ON employment_movement_logs
  FOR EACH STATEMENT EXECUTE FUNCTION app.forbid_movement_log_change();
