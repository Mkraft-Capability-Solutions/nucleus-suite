CREATE TABLE countries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), iso_code text NOT NULL UNIQUE, name text NOT NULL, default_currency_code text NOT NULL, default_timezone text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE currencies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), alpha_code text NOT NULL UNIQUE, numeric_code text, name text NOT NULL, symbol text, minor_units integer NOT NULL DEFAULT 2 CHECK (minor_units BETWEEN 0 AND 6), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX currencies_numeric_code_uq ON currencies (numeric_code) WHERE numeric_code IS NOT NULL;
--> statement-breakpoint
CREATE TABLE jurisdictions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), country_id uuid NOT NULL REFERENCES countries(id) ON DELETE RESTRICT, code text NOT NULL, name text NOT NULL, kind text NOT NULL, valid_from date NOT NULL DEFAULT current_date, valid_to date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (country_id, code), CHECK (valid_to IS NULL OR valid_to > valid_from));
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN default_country_id uuid REFERENCES countries(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE memberships ADD COLUMN employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE tenant_domains (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, domain text NOT NULL, verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','failed','revoked')), verification_token_hash text, verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE UNIQUE INDEX tenant_domains_normalized_uq ON tenant_domains (lower(domain));
--> statement-breakpoint
CREATE INDEX tenant_domains_tenant_idx ON tenant_domains (tenant_id);
--> statement-breakpoint
CREATE TABLE tenant_features (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, feature_key text NOT NULL, enabled boolean NOT NULL DEFAULT false, config_schema_version integer NOT NULL DEFAULT 1, config jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, feature_key), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX tenant_features_tenant_idx ON tenant_features (tenant_id);
--> statement-breakpoint
CREATE TABLE resource_grants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, membership_id uuid NOT NULL, resource_type text NOT NULL, resource_id text NOT NULL, actions text[] NOT NULL, reason text NOT NULL, approved_by_membership_id uuid, valid_from timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE CASCADE, FOREIGN KEY (approved_by_membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE RESTRICT, CHECK (expires_at > valid_from), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX resource_grants_tenant_member_idx ON resource_grants (tenant_id, membership_id, expires_at);
--> statement-breakpoint
CREATE TABLE delegation_windows (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, delegator_membership_id uuid NOT NULL, delegate_membership_id uuid NOT NULL, permission_ceiling text[] NOT NULL, reason text NOT NULL, valid_from timestamptz NOT NULL, valid_to timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (delegator_membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE CASCADE, FOREIGN KEY (delegate_membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE CASCADE, CHECK (delegator_membership_id <> delegate_membership_id), CHECK (valid_to > valid_from), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX delegation_windows_tenant_delegate_idx ON delegation_windows (tenant_id, delegate_membership_id, valid_to);
--> statement-breakpoint
CREATE TABLE legal_entities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT, jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id) ON DELETE RESTRICT, code text NOT NULL, legal_name text NOT NULL, registration_ciphertext bytea, registration_blind_index text, currency_code text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','closed')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX legal_entities_tenant_status_idx ON legal_entities (tenant_id, status);
--> statement-breakpoint
CREATE TABLE workflow_definitions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, code text NOT NULL, name text NOT NULL, subject_type text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX workflow_definitions_tenant_status_idx ON workflow_definitions (tenant_id, status);
--> statement-breakpoint
CREATE TABLE workflow_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, workflow_definition_id uuid NOT NULL, version integer NOT NULL, schema_version integer NOT NULL DEFAULT 1, definition jsonb NOT NULL DEFAULT '{}'::jsonb, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (workflow_definition_id, tenant_id) REFERENCES workflow_definitions(id, tenant_id) ON DELETE CASCADE, UNIQUE (tenant_id, workflow_definition_id, version), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX workflow_versions_tenant_definition_idx ON workflow_versions (tenant_id, workflow_definition_id);
--> statement-breakpoint
CREATE TABLE workflow_steps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, workflow_version_id uuid NOT NULL, step_key text NOT NULL, name text NOT NULL, assignee_rule jsonb NOT NULL DEFAULT '{}'::jsonb, sla_minutes integer CHECK (sla_minutes IS NULL OR sla_minutes > 0), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (workflow_version_id, tenant_id) REFERENCES workflow_versions(id, tenant_id) ON DELETE CASCADE, UNIQUE (tenant_id, workflow_version_id, step_key), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX workflow_steps_tenant_version_idx ON workflow_steps (tenant_id, workflow_version_id);
--> statement-breakpoint
CREATE TABLE workflow_transitions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, workflow_version_id uuid NOT NULL, from_step_id uuid NOT NULL, to_step_id uuid, event text NOT NULL, condition jsonb NOT NULL DEFAULT '{}'::jsonb, priority integer NOT NULL DEFAULT 100, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (workflow_version_id, tenant_id) REFERENCES workflow_versions(id, tenant_id) ON DELETE CASCADE, FOREIGN KEY (from_step_id, tenant_id) REFERENCES workflow_steps(id, tenant_id) ON DELETE CASCADE, FOREIGN KEY (to_step_id, tenant_id) REFERENCES workflow_steps(id, tenant_id) ON DELETE RESTRICT, UNIQUE (tenant_id, workflow_version_id, from_step_id, event, priority), UNIQUE (id, tenant_id));
--> statement-breakpoint
CREATE INDEX workflow_transitions_tenant_version_idx ON workflow_transitions (tenant_id, workflow_version_id);