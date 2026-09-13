-- Prevent overlapping profiles even when concurrent transactions race.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE payroll_profiles ADD CONSTRAINT payroll_profiles_no_overlap
  EXCLUDE USING gist (tenant_id WITH =, employee_id WITH =, daterange(effective_from, effective_to, '[]') WITH &&);
--> statement-breakpoint
-- Application audit entries are append-only; administrative retention is a separate operation.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_runtime;
