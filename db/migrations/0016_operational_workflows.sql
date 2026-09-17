CREATE TABLE IF NOT EXISTS hrms_operation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  resource text NOT NULL,
  employee_id uuid,
  parent_id uuid,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id),
  FOREIGN KEY (tenant_id, created_by_membership_id) REFERENCES memberships(tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES hrms_operation_records(tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hrms_operation_worklist_idx ON hrms_operation_records(tenant_id, resource, created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hrms_operation_employee_idx ON hrms_operation_records(tenant_id, employee_id, resource, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hrms_operation_parent_idx ON hrms_operation_records(tenant_id, parent_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS hrms_asset_tag_uq ON hrms_operation_records(tenant_id, (data->>'assetTag')) WHERE resource = 'assets';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS hrms_project_code_uq ON hrms_operation_records(tenant_id, (data->>'code')) WHERE resource = 'projects';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS hrms_operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  record_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  fingerprint text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, record_id) REFERENCES hrms_operation_records(tenant_id, id),
  FOREIGN KEY (tenant_id, actor_membership_id) REFERENCES memberships(tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hrms_operation_event_record_idx ON hrms_operation_events(tenant_id, record_id, created_at);
--> statement-breakpoint
ALTER TABLE hrms_operation_records ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE hrms_operation_records FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hrms_operation_records_isolate ON hrms_operation_records USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
ALTER TABLE hrms_operation_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE hrms_operation_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hrms_operation_events_isolate ON hrms_operation_events USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
INSERT INTO permissions(permission_key, field_domain, risk)
SELECT domain || '.' || action, 'ordinary', CASE WHEN action = 'read' THEN 'standard' ELSE 'high' END
FROM unnest(ARRAY['hr.helpdesk','workforce.projects','workforce.travel','workforce.timesheets','workforce.assets','workforce.rosters','talent.mobility']) domain
CROSS JOIN unnest(ARRAY['read','write','approve']) action
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS hrms_dossier_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 actor_membership_id uuid NOT NULL, idempotency_key text NOT NULL, fingerprint text NOT NULL,
 response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,idempotency_key), FOREIGN KEY(tenant_id,actor_membership_id) REFERENCES memberships(tenant_id,id)
);
--> statement-breakpoint
ALTER TABLE hrms_dossier_receipts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE hrms_dossier_receipts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hrms_dossier_receipts_isolate ON hrms_dossier_receipts USING(app.current_tenant_is_authorized(tenant_id)) WITH CHECK(app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
INSERT INTO permissions(permission_key,field_domain,risk) VALUES ('employee.dossier.read','ordinary','standard'),('employee.dossier.write','ordinary','high') ON CONFLICT(permission_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO permissions(permission_key,field_domain,risk)
SELECT domain || '.' || action, 'ordinary', CASE WHEN action='read' THEN 'standard' ELSE 'high' END
FROM unnest(ARRAY['payroll.settlement','payroll.accounting','compliance.filing']) domain CROSS JOIN unnest(ARRAY['read','write','approve']) action
ON CONFLICT(permission_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO permissions(permission_key,field_domain,risk)
SELECT permission,'ordinary','high' FROM unnest(ARRAY['policy.manage','role.scope.manage','attendance.evaluate','leave.maintain','integration.sync','compliance.forms.generate','hr.records.write','workforce.manpower.approve','recruitment.requisition.write']) permission
ON CONFLICT(permission_key) DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS hrms_command_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),actor_membership_id uuid NOT NULL,
 action text NOT NULL,idempotency_key text NOT NULL,fingerprint text NOT NULL,status text NOT NULL CHECK(status IN ('processing','completed','failed')),
 response jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(tenant_id,actor_membership_id) REFERENCES memberships(tenant_id,id)
);
--> statement-breakpoint
ALTER TABLE hrms_command_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE hrms_command_requests FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hrms_command_requests_isolate ON hrms_command_requests USING(app.current_tenant_is_authorized(tenant_id)) WITH CHECK(app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hrms_command_requests_worklist_idx ON hrms_command_requests(tenant_id,action,created_at DESC);
--> statement-breakpoint
DO $grant$ BEGIN
PERFORM set_config('app.platform_admin','true',true);
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='owner' AND r.status='active' AND p.status='active'
 AND (p.permission_key LIKE 'hr.%' OR p.permission_key LIKE 'workforce.%' OR p.permission_key LIKE 'talent.mobility.%'
 OR p.permission_key LIKE 'employee.dossier.%' OR p.permission_key LIKE 'payroll.settlement.%' OR p.permission_key LIKE 'payroll.accounting.%' OR p.permission_key LIKE 'compliance.filing.%'
 OR p.permission_key IN ('policy.manage','role.scope.manage','attendance.evaluate','leave.maintain','integration.sync','compliance.forms.generate','recruitment.requisition.write'))
ON CONFLICT(tenant_id,role_id,permission_id) DO NOTHING;
END $grant$;
