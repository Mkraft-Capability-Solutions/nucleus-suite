-- 0037 Employee master: multi-currency, visa / expatriate details, typed custom fields (module EMPLOYEE_MASTER).
-- Additive and idempotent: every column, constraint and index is guarded so the file can run twice.
-- The visa number is stored only as AES-256-GCM ciphertext (src/server/workflows/field-encryption.ts) plus its last 4 characters.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS base_currency char(3);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS payroll_currency char(3);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fx_rate_override numeric(18,6);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_expatriate boolean NOT NULL DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_country char(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS host_country char(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_residency_country char(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sponsor_entity_id uuid;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_type varchar(60);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_number_ciphertext bytea;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_number_last4 varchar(4);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_issuing_country char(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_issue_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_expiry_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_entry_type text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_permit_number varchar(60);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_permit_expiry_date date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_sponsor_entity_fk') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_sponsor_entity_fk
      FOREIGN KEY (sponsor_entity_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_currency_iso_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_currency_iso_check CHECK (
      (base_currency IS NULL OR base_currency ~ '^[A-Z]{3}$') AND (payroll_currency IS NULL OR payroll_currency ~ '^[A-Z]{3}$'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_fx_rate_positive_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_fx_rate_positive_check CHECK (fx_rate_override IS NULL OR fx_rate_override > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_country_iso_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_country_iso_check CHECK (
      (home_country IS NULL OR home_country ~ '^[A-Z]{2}$') AND (host_country IS NULL OR host_country ~ '^[A-Z]{2}$')
      AND (tax_residency_country IS NULL OR tax_residency_country ~ '^[A-Z]{2}$')
      AND (visa_issuing_country IS NULL OR visa_issuing_country ~ '^[A-Z]{2}$'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_visa_dates_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_visa_dates_check CHECK (
      visa_issue_date IS NULL OR visa_expiry_date IS NULL OR visa_expiry_date > visa_issue_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_visa_entry_type_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_visa_entry_type_check CHECK (visa_entry_type IS NULL OR visa_entry_type IN ('SINGLE', 'MULTIPLE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_visa_last4_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_visa_last4_check CHECK (
      (visa_number_ciphertext IS NULL AND visa_number_last4 IS NULL) OR (visa_number_ciphertext IS NOT NULL AND visa_number_last4 IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS employees_tenant_visa_expiry_idx ON employees (tenant_id, visa_expiry_date) WHERE visa_expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS employees_tenant_permit_expiry_idx ON employees (tenant_id, work_permit_expiry_date) WHERE work_permit_expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS employees_sponsor_entity_idx ON employees (tenant_id, sponsor_entity_id) WHERE sponsor_entity_id IS NOT NULL;

-- Typed custom fields on the existing catalog tables (RLS is already ENABLE + FORCE with the catalog_isolate policy).
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS field_key text;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS field_type text;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS value_text text;
ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS value_number numeric(20,6);
ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS value_date date;
ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS value_boolean boolean;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_field_definitions_type_check') THEN
    ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_type_check
      CHECK (field_type IS NULL OR field_type IN ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_field_definitions_key_check') THEN
    ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_key_check
      CHECK (field_key IS NULL OR field_key ~ '^[a-z][a-z0-9_]{0,62}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_field_values_employee_fk') THEN
    ALTER TABLE custom_field_values ADD CONSTRAINT custom_field_values_employee_fk
      FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS custom_field_definitions_module_key_uq
  ON custom_field_definitions (tenant_id, module, field_key) WHERE module IS NOT NULL AND field_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS custom_field_values_employee_uq
  ON custom_field_values (tenant_id, custom_field_definition_id, employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS custom_field_values_employee_idx
  ON custom_field_values (tenant_id, employee_id) WHERE employee_id IS NOT NULL;

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values FORCE ROW LEVEL SECURITY;
