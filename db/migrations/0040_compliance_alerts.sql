-- 0040 Compliance alerts: stored, acknowledgeable warnings for expiring visas, work permits,
-- documents and date-type custom fields (engine: src/server/alerts/engine.ts).
--
-- Unlike the computed employee flags (0034), compliance alerts are stored so that a person can
-- acknowledge them and the acknowledgement is kept. The engine upserts one row per
-- (employee, category, source, trigger date) through unique_dedup_key and resolves rows whose date
-- has moved out of range. The daily scan runs from the cron tick; alert_scan_state records the last
-- scan day per tenant so the tick scans each tenant at most once a day.
--
-- alert_rules: per tenant and category, the day thresholds (default 90/60/30/7/0). The largest
-- threshold opens an alert; at or below the smallest non-zero threshold (and once the date has
-- passed) the alert is CRITICAL, at or below the middle thresholds WARNING, otherwise INFO.
CREATE TABLE IF NOT EXISTS compliance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  root_group_id uuid,
  company_id uuid,
  employee_id uuid NOT NULL,
  alert_category text NOT NULL CHECK (alert_category IN ('VISA_EXPIRY', 'WORK_PERMIT_EXPIRY', 'EXPAT_COMPLIANCE', 'CUSTOM_DATE_ALERT', 'DOCUMENT_EXPIRY')),
  severity text NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
  title text NOT NULL,
  source_ref text,
  trigger_date date NOT NULL,
  days_remaining integer NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
  acknowledged_by text,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  unique_dedup_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_alerts_dedup UNIQUE (tenant_id, unique_dedup_key),
  CHECK ((status = 'ACKNOWLEDGED') = (acknowledged_at IS NOT NULL) OR status = 'RESOLVED')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS compliance_alerts_tenant_status_idx ON compliance_alerts (tenant_id, status, severity, trigger_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS compliance_alerts_tenant_employee_idx ON compliance_alerts (tenant_id, employee_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS compliance_alerts_tenant_company_idx ON compliance_alerts (tenant_id, company_id);
--> statement-breakpoint
ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE compliance_alerts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS compliance_alerts_tenant ON compliance_alerts;
--> statement-breakpoint
CREATE POLICY compliance_alerts_tenant ON compliance_alerts
  USING (app.current_tenant_is_authorized(tenant_id))
  WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  alert_category text NOT NULL CHECK (alert_category IN ('VISA_EXPIRY', 'WORK_PERMIT_EXPIRY', 'EXPAT_COMPLIANCE', 'CUSTOM_DATE_ALERT', 'DOCUMENT_EXPIRY')),
  enabled boolean NOT NULL DEFAULT true,
  thresholds_days integer[] NOT NULL DEFAULT ARRAY[90, 60, 30, 7, 0]
    CHECK (cardinality(thresholds_days) BETWEEN 1 AND 10 AND 0 <= ALL (thresholds_days) AND 730 >= ALL (thresholds_days)),
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_rules_tenant_category UNIQUE (tenant_id, alert_category)
);
--> statement-breakpoint
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS alert_rules_tenant ON alert_rules;
--> statement-breakpoint
CREATE POLICY alert_rules_tenant ON alert_rules
  USING (app.current_tenant_is_authorized(tenant_id))
  WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS alert_scan_state (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  last_scan_on date NOT NULL,
  last_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE alert_scan_state ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE alert_scan_state FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS alert_scan_state_tenant ON alert_scan_state;
--> statement-breakpoint
CREATE POLICY alert_scan_state_tenant ON alert_scan_state
  USING (app.current_tenant_is_authorized(tenant_id))
  WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
DO $grants$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON compliance_alerts, alert_rules, alert_scan_state TO app_runtime;
  END IF;
END $grants$;
