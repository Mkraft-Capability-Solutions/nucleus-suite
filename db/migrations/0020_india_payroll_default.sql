-- Initial jurisdiction selection only. This does not enable statutory calculations.
INSERT INTO payroll_jurisdictions (code, country_code, region_code, currency_code)
VALUES ('IN', 'IN', NULL, 'INR') ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
CREATE TABLE payroll_country_configuration (
  country_code char(2) PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  default_jurisdiction_code text NOT NULL REFERENCES payroll_jurisdictions(code),
  enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  CHECK (NOT is_default OR enabled)
);
--> statement-breakpoint
CREATE UNIQUE INDEX payroll_one_default_country ON payroll_country_configuration (is_default) WHERE is_default;
--> statement-breakpoint
INSERT INTO payroll_country_configuration (country_code, default_jurisdiction_code, enabled, is_default)
VALUES ('IN', 'IN', true, true);
--> statement-breakpoint
-- Catalog writes must use a privileged, audited superadmin service, never tenant runtime SQL.
GRANT SELECT ON payroll_country_configuration TO app_runtime;
