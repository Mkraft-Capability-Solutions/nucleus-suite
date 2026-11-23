-- Tables that services already read and write but that no earlier migration
-- created. Each column set is the exact set referenced by its service:
--   hardware_assets   src/server/assets/service.ts (createAsset, listAssets)
--   fnf_settlements   src/server/fnf/service.ts
--   hr_letters        src/server/letters/service.ts
--   helpdesk_tickets  src/app/api/v1/helpdesk/tickets/**
-- Every table is tenant-scoped and isolated by the standard RLS policy.
CREATE TABLE IF NOT EXISTS hardware_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  asset_code text NOT NULL,
  asset_type text NOT NULL,
  brand text,
  model text,
  serial_number text,
  status text NOT NULL DEFAULT 'available',
  assigned_to uuid,
  assigned_at timestamptz,
  returned_at timestamptz,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, asset_code),
  FOREIGN KEY (tenant_id, assigned_to) REFERENCES employees(tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hardware_assets_filter_idx ON hardware_assets(tenant_id, asset_type, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hardware_assets_holder_idx ON hardware_assets(tenant_id, assigned_to);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS fnf_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  employee_id uuid NOT NULL,
  exit_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  department_clearances jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(department_clearances) = 'object'),
  payment_ref text,
  disbursed_at timestamptz,
  disbursed_by_membership_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id),
  FOREIGN KEY (tenant_id, disbursed_by_membership_id) REFERENCES memberships(tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS fnf_settlements_worklist_idx ON fnf_settlements(tenant_id, status, created_at DESC);
--> statement-breakpoint
-- One open settlement per employee; the service checks this, the index enforces it.
CREATE UNIQUE INDEX IF NOT EXISTS fnf_settlements_active_uq ON fnf_settlements(tenant_id, employee_id) WHERE status <> 'cancelled';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS hr_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  employee_id uuid NOT NULL,
  letter_type text NOT NULL,
  content text NOT NULL,
  generated_by_membership_id uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id),
  FOREIGN KEY (tenant_id, generated_by_membership_id) REFERENCES memberships(tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hr_letters_worklist_idx ON hr_letters(tenant_id, employee_id, letter_type, generated_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  employee_id uuid,
  status text NOT NULL DEFAULT 'OPEN',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS helpdesk_tickets_worklist_idx ON helpdesk_tickets(tenant_id, status, created_at DESC);
--> statement-breakpoint
ALTER TABLE hardware_assets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE hardware_assets FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS hardware_assets_isolate ON hardware_assets;
--> statement-breakpoint
CREATE POLICY hardware_assets_isolate ON hardware_assets USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
ALTER TABLE fnf_settlements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE fnf_settlements FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS fnf_settlements_isolate ON fnf_settlements;
--> statement-breakpoint
CREATE POLICY fnf_settlements_isolate ON fnf_settlements USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
ALTER TABLE hr_letters ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE hr_letters FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS hr_letters_isolate ON hr_letters;
--> statement-breakpoint
CREATE POLICY hr_letters_isolate ON hr_letters USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
ALTER TABLE helpdesk_tickets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE helpdesk_tickets FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS helpdesk_tickets_isolate ON helpdesk_tickets;
--> statement-breakpoint
CREATE POLICY helpdesk_tickets_isolate ON helpdesk_tickets USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
