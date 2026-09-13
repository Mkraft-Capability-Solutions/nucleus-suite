CREATE TABLE idempotency_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, membership_id uuid, operation text NOT NULL, idempotency_key text NOT NULL, request_hash text NOT NULL, response_status integer, response_locator text, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE SET NULL, UNIQUE (tenant_id, operation, idempotency_key), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX idempotency_keys_tenant_expiry_idx ON idempotency_keys (tenant_id, expires_at);
--> statement-breakpoint
CREATE TABLE transactional_outbox (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, event_type text NOT NULL, schema_version integer NOT NULL DEFAULT 1, aggregate_type text NOT NULL, aggregate_id text NOT NULL, payload jsonb NOT NULL, correlation_id uuid NOT NULL DEFAULT gen_random_uuid(), idempotency_key text, available_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','published','failed','dead')), lease_owner text, lease_expires_at timestamptz, attempts integer NOT NULL DEFAULT 0, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, idempotency_key), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX transactional_outbox_claim_idx ON transactional_outbox (tenant_id, status, available_at, lease_expires_at);
--> statement-breakpoint
CREATE TABLE scheduled_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, outbox_event_id uuid, task_type text NOT NULL, schema_version integer NOT NULL DEFAULT 1, payload jsonb NOT NULL, available_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','succeeded','failed','dead','cancelled')), lease_owner text, lease_expires_at timestamptz, attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 10 CHECK (max_attempts > 0), completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (outbox_event_id, tenant_id) REFERENCES transactional_outbox(id, tenant_id) ON DELETE SET NULL, UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX scheduled_tasks_claim_idx ON scheduled_tasks (tenant_id, status, available_at, lease_expires_at);
--> statement-breakpoint
CREATE TABLE task_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, scheduled_task_id uuid NOT NULL, attempt_number integer NOT NULL CHECK (attempt_number > 0), worker_id text NOT NULL, started_at timestamptz NOT NULL, ended_at timestamptz, outcome text CHECK (outcome IS NULL OR outcome IN ('succeeded','retry','failed','dead')), redacted_error text, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (scheduled_task_id, tenant_id) REFERENCES scheduled_tasks(id, tenant_id) ON DELETE CASCADE, UNIQUE (tenant_id, scheduled_task_id, attempt_number), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX task_attempts_tenant_task_idx ON task_attempts (tenant_id, scheduled_task_id);
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN membership_id uuid;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN request_id uuid;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN purpose text;
--> statement-breakpoint
ALTER TABLE audit_events ADD CONSTRAINT audit_events_membership_tenant_fk FOREIGN KEY (membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE audit_event_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, audit_event_id uuid NOT NULL REFERENCES audit_events(id) ON DELETE CASCADE, field_path text NOT NULL, classification text NOT NULL, old_value jsonb, new_value jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX audit_event_changes_tenant_event_idx ON audit_event_changes (tenant_id, audit_event_id);
--> statement-breakpoint
CREATE TABLE access_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, membership_id uuid, subject_type text NOT NULL, subject_id text NOT NULL, field_domain text NOT NULL, purpose text NOT NULL, decision text NOT NULL CHECK (decision IN ('allowed','denied')), reason_code text NOT NULL, request_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE SET NULL, UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX access_events_tenant_time_idx ON access_events (tenant_id, occurred_at DESC);
--> statement-breakpoint
CREATE TABLE retention_policies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, jurisdiction_id uuid REFERENCES jurisdictions(id) ON DELETE RESTRICT, data_class text NOT NULL, trigger_event text NOT NULL, duration_days integer NOT NULL CHECK (duration_days >= 0), terminal_action text NOT NULL CHECK (terminal_action IN ('delete','anonymize','archive','review')), legal_basis text NOT NULL, valid_from date NOT NULL, valid_to date, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), CHECK (valid_to IS NULL OR valid_to > valid_from), UNIQUE (tenant_id, data_class, version), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX retention_policies_tenant_class_idx ON retention_policies (tenant_id, data_class, valid_from);
--> statement-breakpoint
DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['tenant_domains','tenant_features','resource_grants','delegation_windows','legal_entities','workflow_definitions','workflow_versions','workflow_steps','workflow_transitions','idempotency_keys','transactional_outbox','scheduled_tasks','task_attempts','audit_event_changes','access_events','retention_policies'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', n); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', n); EXECUTE format('CREATE POLICY %I ON %I USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id))', n || '_isolate', n); END LOOP; END $$;
--> statement-breakpoint
INSERT INTO currencies (alpha_code, numeric_code, name, symbol, minor_units) VALUES ('INR','356','Indian Rupee','₹',2),('USD','840','US Dollar','$',2),('EUR','978','Euro','',2),('GBP','826','Pound Sterling','',2) ON CONFLICT (alpha_code) DO NOTHING;
--> statement-breakpoint
INSERT INTO countries (iso_code, name, default_currency_code, default_timezone) VALUES ('IN','India','INR','Asia/Kolkata') ON CONFLICT (iso_code) DO NOTHING;
--> statement-breakpoint
INSERT INTO jurisdictions (country_id, code, name, kind) SELECT id,'IN','India','country' FROM countries WHERE iso_code='IN' ON CONFLICT (country_id, code) DO NOTHING;