-- 0034 Employee flag rules: what the organisation flags as a warning or an alert.
--
-- Each organisation's administrators choose which rules are on and when they fire, for example
-- "passport expires within 90 days = warning, within 30 days or already expired = alert". The rules
-- are evaluated against the employee records as they stand (src/lib/employee-flags.ts), so no flag
-- is stored: changing a record or a rule changes the flags at once.
--
-- rule_key: passport_expiry, visa_expiry, medical_exam_due, retirement_due.
-- warning_days / alert_days: how many days before the due date the rule turns into a warning and
-- then an alert (an alert never starts earlier than the warning).
-- settings: rule-specific values validated by the application, e.g. {"intervalMonths": 12} for the
-- periodic medical examination or {"retirementAge": 60}.
-- A missing row means the rule uses its defaults (see the application catalogue).
CREATE TABLE IF NOT EXISTS employee_flag_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  rule_key text NOT NULL CHECK (rule_key IN ('passport_expiry', 'visa_expiry', 'medical_exam_due', 'retirement_due')),
  enabled boolean NOT NULL DEFAULT true,
  warning_days integer NOT NULL CHECK (warning_days BETWEEN 0 AND 730),
  alert_days integer NOT NULL CHECK (alert_days BETWEEN 0 AND 730),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, rule_key),
  CHECK (alert_days <= warning_days)
);
--> statement-breakpoint
ALTER TABLE employee_flag_rules ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE employee_flag_rules FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS employee_flag_rules_tenant ON employee_flag_rules;
--> statement-breakpoint
CREATE POLICY employee_flag_rules_tenant ON employee_flag_rules
  USING (app.current_tenant_is_authorized(tenant_id))
  WITH CHECK (app.current_tenant_is_authorized(tenant_id));
