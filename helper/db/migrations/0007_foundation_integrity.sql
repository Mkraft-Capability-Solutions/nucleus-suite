CREATE INDEX loan_guarantors_tenant_idx ON loan_guarantors (tenant_id);
--> statement-breakpoint
ALTER TABLE employees ADD CONSTRAINT employees_id_tenant_uq UNIQUE (id, tenant_id);
--> statement-breakpoint
ALTER TABLE memberships DROP CONSTRAINT memberships_employee_id_fkey;
--> statement-breakpoint
ALTER TABLE memberships ADD CONSTRAINT memberships_employee_tenant_fk FOREIGN KEY (employee_id, tenant_id) REFERENCES employees(id, tenant_id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE audit_events ADD CONSTRAINT audit_events_id_tenant_uq UNIQUE (id, tenant_id);
--> statement-breakpoint
ALTER TABLE audit_event_changes DROP CONSTRAINT audit_event_changes_audit_event_id_fkey;
--> statement-breakpoint
ALTER TABLE audit_event_changes ADD CONSTRAINT audit_event_changes_event_tenant_fk FOREIGN KEY (audit_event_id, tenant_id) REFERENCES audit_events(id, tenant_id) ON DELETE CASCADE;