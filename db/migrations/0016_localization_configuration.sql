-- Relational UI language and configuration catalogs; no personnel data belongs here.
CREATE TABLE ui_locales (
  code text PRIMARY KEY CHECK (code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  native_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('ltr', 'rtl')),
  enabled boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE TABLE ui_namespaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE);
--> statement-breakpoint
CREATE TABLE ui_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id uuid NOT NULL REFERENCES ui_namespaces(id) ON DELETE RESTRICT,
  message_key text NOT NULL,
  source_file text NOT NULL,
  source_pointer text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  UNIQUE (namespace_id, message_key)
);
--> statement-breakpoint
CREATE TABLE ui_translations (
  message_id uuid NOT NULL REFERENCES ui_messages(id) ON DELETE CASCADE,
  locale_code text NOT NULL REFERENCES ui_locales(code) ON DELETE RESTRICT,
  content text NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, locale_code)
);
--> statement-breakpoint
CREATE INDEX ui_translations_locale_idx ON ui_translations(locale_code, message_id);
--> statement-breakpoint
CREATE TABLE configuration_definitions (
  key text PRIMARY KEY,
  value_type text NOT NULL CHECK (value_type IN ('text', 'boolean', 'integer', 'decimal')),
  public_readable boolean NOT NULL DEFAULT false,
  description_message_id uuid REFERENCES ui_messages(id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE system_configuration_values (
  key text PRIMARY KEY REFERENCES configuration_definitions(key) ON DELETE RESTRICT,
  value text NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE tenant_configuration_values (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key text NOT NULL REFERENCES configuration_definitions(key) ON DELETE RESTRICT,
  value text NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);
--> statement-breakpoint
CREATE FUNCTION app.validate_configuration_value() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text;
BEGIN
  SELECT value_type INTO STRICT kind FROM configuration_definitions WHERE key = NEW.key;
  IF (kind = 'boolean' AND NEW.value NOT IN ('true','false'))
     OR (kind = 'integer' AND NEW.value !~ '^-?[0-9]+$')
     OR (kind = 'decimal' AND NEW.value !~ '^-?[0-9]+(\.[0-9]+)?$') THEN
    RAISE EXCEPTION 'Configuration value does not match its declared type' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER system_configuration_type BEFORE INSERT OR UPDATE ON system_configuration_values FOR EACH ROW EXECUTE FUNCTION app.validate_configuration_value();
--> statement-breakpoint
CREATE TRIGGER tenant_configuration_type BEFORE INSERT OR UPDATE ON tenant_configuration_values FOR EACH ROW EXECUTE FUNCTION app.validate_configuration_value();
--> statement-breakpoint
ALTER TABLE tenant_configuration_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configuration_values FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_configuration_isolation ON tenant_configuration_values
  USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
GRANT SELECT ON ui_locales, ui_namespaces, ui_messages, ui_translations, configuration_definitions, system_configuration_values TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_configuration_values TO app_runtime;
