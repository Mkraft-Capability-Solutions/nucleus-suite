-- Every request transaction must set `app.tenant_id` after authorization:
-- SELECT set_config('app.tenant_id', '<tenant uuid>', true);
--> statement-breakpoint
-- FORCE ensures the table owner cannot accidentally bypass isolation.
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;
--> statement-breakpoint

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenants_isolate" ON "tenants"
  USING ("id" = app.current_tenant_id())
  WITH CHECK ("id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "memberships_isolate" ON "memberships"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "employees_isolate" ON "employees"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "attendance_days" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "attendance_days" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "attendance_days_isolate" ON "attendance_days"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "attendance_punches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "attendance_punches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "attendance_punches_isolate" ON "attendance_punches"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "leave_balances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "leave_balances" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "leave_balances_isolate" ON "leave_balances"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "leave_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "leave_requests_isolate" ON "leave_requests"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "leave_approvals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "leave_approvals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "leave_approvals_isolate" ON "leave_approvals"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "payroll_runs_isolate" ON "payroll_runs"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "payroll_anomalies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payroll_anomalies" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "payroll_anomalies_isolate" ON "payroll_anomalies"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "loans" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "loans_isolate" ON "loans"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "loan_guarantors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "loan_guarantors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "loan_guarantors_isolate" ON "loan_guarantors"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "audit_events_read_insert" ON "audit_events"
  FOR SELECT USING ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY "audit_events_append" ON "audit_events"
  FOR INSERT WITH CHECK ("tenant_id" = app.current_tenant_id());
--> statement-breakpoint

COMMENT ON TABLE "audit_events" IS 'Append-only evidence trail; UPDATE and DELETE intentionally have no RLS policy.';
--> statement-breakpoint
