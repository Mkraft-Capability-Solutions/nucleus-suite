-- Client acceptance remediation: loans, no-dues clearance and the statutory form register.
--
-- 1. RP-13 needs a gapless serial register per establishment for Form F.
--    `vp_statutory_instances` has no serial column and no place to record a serial
--    that was taken and never used, so the register gets its own table. A number is
--    allocated as max+1 under an advisory lock inside the allocating transaction and
--    is never deleted: a form that is not issued leaves a VOIDED row carrying its
--    reason, which is what keeps the sequence unbroken.
-- 2. W-06 names a Director as the approver of loan special terms. `payroll.run`
--    already sanctions a loan, so waiving a control needs its own permission -
--    otherwise any payroll user can grant themselves the override.
-- 3. The no-dues board wrote the waived status as 'Waived' while every gate compared
--    against lower case. The code now writes 'waived'; this normalises the rows the
--    defect already produced so the register reads consistently.

CREATE TABLE IF NOT EXISTS statutory_form_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  -- The establishment's own code where it has one, else its location id: the
  -- register is "per establishment" and must stay stable if a location is renamed.
  establishment_key text NOT NULL,
  form_code text NOT NULL,
  serial_number integer NOT NULL CHECK (serial_number > 0),
  -- Plain uuid, not a foreign key: `vp_statutory_instances` is created by 0014,
  -- which is not in the drizzle journal, so a hard reference would make this
  -- migration fail wherever that one has not run. The unique index below is what
  -- guarantees one serial per instance.
  statutory_instance_id uuid,
  employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT,
  issued_by_membership_id uuid REFERENCES memberships(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  void_reason text,
  CONSTRAINT statutory_form_serials_sequence_uq UNIQUE (tenant_id, establishment_key, form_code, serial_number),
  CONSTRAINT statutory_form_serials_void_reason_check CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);
--> statement-breakpoint

-- One serial per generated form: a form instance can never carry two numbers.
CREATE UNIQUE INDEX IF NOT EXISTS statutory_form_serials_instance_uq
  ON statutory_form_serials (tenant_id, statutory_instance_id)
  WHERE statutory_instance_id IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS statutory_form_serials_register_idx
  ON statutory_form_serials (tenant_id, form_code, establishment_key, serial_number);
--> statement-breakpoint

ALTER TABLE statutory_form_serials ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE statutory_form_serials FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS statutory_form_serials_isolate ON statutory_form_serials;
--> statement-breakpoint

CREATE POLICY statutory_form_serials_isolate ON statutory_form_serials
  USING (app.current_tenant_is_authorized(tenant_id))
  WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint

INSERT INTO permissions(permission_key, field_domain, risk)
VALUES ('loan.director.approve', 'ordinary', 'high')
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint

DO $grant$ BEGIN
PERFORM set_config('app.platform_admin','true',true);
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='owner' AND r.status='active' AND p.status='active'
 AND p.permission_key = 'loan.director.approve'
ON CONFLICT(tenant_id,role_id,permission_id) DO NOTHING;
END $grant$;
--> statement-breakpoint

UPDATE clearance_items
SET attributes = jsonb_set(attributes, '{status}', '"waived"'::jsonb)
WHERE attributes->>'status' IS NOT NULL
  AND attributes->>'status' <> lower(attributes->>'status')
  AND lower(attributes->>'status') = 'waived';
