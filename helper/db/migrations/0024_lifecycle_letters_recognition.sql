-- Onboarding and payroll sub-module surfaces: letter studio, recognition events,
-- workflow pipelines, lifecycle trigger chains, and the payroll adjacencies.
--
-- Storage note: letter_templates, generated_letters, recognition_events,
-- recognition_programs, workflow_definitions, workflow_instances and
-- workflow_steps ALREADY EXIST (created in 0008_canonical_304_topology) as
-- envelope + JSONB tables. This migration deliberately adds no new tables; the
-- services write to those.
--
-- The single genuine schema gap is date_of_birth. Recognition needs it to derive
-- birthdays, and no column anywhere in the schema records it. joining_date
-- already exists, so work anniversaries need no new column.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth date;
--> statement-breakpoint
-- Birthdays are looked up by month and day across the whole tenant, never by
-- full date, so the index is on the extracted parts.
CREATE INDEX IF NOT EXISTS employees_birthday_idx
  ON employees (tenant_id, (EXTRACT(MONTH FROM date_of_birth)), (EXTRACT(DAY FROM date_of_birth)))
  WHERE date_of_birth IS NOT NULL;
--> statement-breakpoint
-- Work anniversaries are looked up the same way against the existing column.
CREATE INDEX IF NOT EXISTS employees_joining_anniversary_idx
  ON employees (tenant_id, (EXTRACT(MONTH FROM joining_date)), (EXTRACT(DAY FROM joining_date)));
--> statement-breakpoint
INSERT INTO permissions(permission_key, field_domain, risk)
SELECT domain || '.' || action,
       CASE WHEN domain = 'hr.letters' THEN 'sensitive' ELSE 'ordinary' END,
       CASE WHEN action = 'read' THEN 'standard' ELSE 'high' END
FROM unnest(ARRAY['hr.letters','hr.recognition','hr.lifecycle']) domain
CROSS JOIN unnest(ARRAY['read','write','approve']) action
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
-- date_of_birth is personal data: reading it is gated behind the dossier
-- permission that already governs sensitive employee fields.
INSERT INTO permissions(permission_key, field_domain, risk)
VALUES ('employee.birthdate.read','sensitive','high')
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
DO $grant$ BEGIN
PERFORM set_config('app.platform_admin','true',true);
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='owner' AND r.status='active' AND p.status='active'
 AND (p.permission_key LIKE 'hr.letters.%' OR p.permission_key LIKE 'hr.recognition.%'
   OR p.permission_key LIKE 'hr.lifecycle.%' OR p.permission_key = 'employee.birthdate.read')
ON CONFLICT(tenant_id,role_id,permission_id) DO NOTHING;
END $grant$;
