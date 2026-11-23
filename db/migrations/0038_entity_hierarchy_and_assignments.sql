-- 0038 Multi-entity organisation structure: group roots, industry verticals, employee ↔ company assignments.
--
-- Extends the v2 group structure (0031) instead of adding a second company table:
--   legal_entities already has id, parent_legal_entity_id (parent_id), legal_name, currency_code
--   (default currency) and status. This adds:
--   1. root_group_id NOT NULL: the top company of the tree the row belongs to (itself for a root),
--      maintained by triggers whenever a company is created or moved; index (tenant_id, root_group_id,
--      parent_legal_entity_id).
--   2. industry_vertical: HOSPITALITY, MANUFACTURING, CORPORATE, ... (nullable, checked).
--   3. employee_entity_assignments: which companies an employee belongs to over time (primary,
--      secondary, secondment, shared service), with effective dates. Backfilled from
--      employees.legal_entity_id. Used to scope the entity switcher for non-group-admins.
-- Additive and idempotent.

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS root_group_id uuid;
--> statement-breakpoint
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS industry_vertical text;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_entities_industry_vertical_check') THEN
    ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_industry_vertical_check CHECK (industry_vertical IS NULL OR industry_vertical IN (
      'HOSPITALITY', 'MANUFACTURING', 'CORPORATE', 'RETAIL', 'HEALTHCARE', 'TECHNOLOGY', 'FINANCIAL_SERVICES',
      'EDUCATION', 'LOGISTICS', 'CONSTRUCTION', 'ENERGY', 'OTHER'));
  END IF;
END $$;
--> statement-breakpoint

-- Backfill root_group_id by walking each tree from its roots.
WITH RECURSIVE tree AS (
  SELECT le.id, le.tenant_id, le.id AS root_id FROM legal_entities le WHERE le.parent_legal_entity_id IS NULL
  UNION ALL
  SELECT c.id, c.tenant_id, tree.root_id FROM legal_entities c
  JOIN tree ON c.parent_legal_entity_id = tree.id AND c.tenant_id = tree.tenant_id
)
UPDATE legal_entities le SET root_group_id = tree.root_id
FROM tree WHERE le.id = tree.id AND le.tenant_id = tree.tenant_id AND le.root_group_id IS DISTINCT FROM tree.root_id;
--> statement-breakpoint
UPDATE legal_entities SET root_group_id = id WHERE root_group_id IS NULL;
--> statement-breakpoint
ALTER TABLE legal_entities ALTER COLUMN root_group_id SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_entities_root_group_fk') THEN
    ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_root_group_fk
      FOREIGN KEY (root_group_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_entities_root_group_idx ON legal_entities(tenant_id, root_group_id, parent_legal_entity_id);
--> statement-breakpoint

-- New or moved company: root is the parent's root, or itself.
CREATE OR REPLACE FUNCTION app.set_legal_entity_root() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.parent_legal_entity_id IS NULL THEN
    NEW.root_group_id := NEW.id;
  ELSE
    SELECT coalesce(p.root_group_id, p.id) INTO NEW.root_group_id
    FROM legal_entities p WHERE p.id = NEW.parent_legal_entity_id AND p.tenant_id = NEW.tenant_id;
    IF NEW.root_group_id IS NULL THEN NEW.root_group_id := NEW.id; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_entities_root_group ON legal_entities;
--> statement-breakpoint
CREATE TRIGGER legal_entities_root_group BEFORE INSERT OR UPDATE OF parent_legal_entity_id ON legal_entities
  FOR EACH ROW EXECUTE FUNCTION app.set_legal_entity_root();
--> statement-breakpoint

-- A moved company carries its subtree to the new root.
CREATE OR REPLACE FUNCTION app.cascade_legal_entity_root() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.root_group_id IS DISTINCT FROM OLD.root_group_id THEN
    WITH RECURSIVE sub AS (
      SELECT c.id FROM legal_entities c WHERE c.tenant_id = NEW.tenant_id AND c.parent_legal_entity_id = NEW.id
      UNION ALL
      SELECT c.id FROM legal_entities c JOIN sub ON c.parent_legal_entity_id = sub.id WHERE c.tenant_id = NEW.tenant_id
    )
    UPDATE legal_entities le SET root_group_id = NEW.root_group_id
    WHERE le.tenant_id = NEW.tenant_id AND le.id IN (SELECT id FROM sub);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_entities_root_cascade ON legal_entities;
--> statement-breakpoint
CREATE TRIGGER legal_entities_root_cascade AFTER UPDATE OF parent_legal_entity_id ON legal_entities
  FOR EACH ROW EXECUTE FUNCTION app.cascade_legal_entity_root();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS employee_entity_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  employee_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  assignment_kind text NOT NULL DEFAULT 'primary' CHECK (assignment_kind IN ('primary', 'secondary', 'secondment', 'shared_service')),
  effective_from date NOT NULL,
  effective_to date,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('backfill', 'manual', 'move', 'import')),
  created_by_membership_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employee_entity_assignments_employee_idx ON employee_entity_assignments(tenant_id, employee_id, effective_from);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employee_entity_assignments_entity_idx ON employee_entity_assignments(tenant_id, legal_entity_id, effective_from);
--> statement-breakpoint
-- At most one open primary assignment per employee.
CREATE UNIQUE INDEX IF NOT EXISTS employee_entity_assignments_open_primary_uq ON employee_entity_assignments(tenant_id, employee_id)
  WHERE assignment_kind = 'primary' AND effective_to IS NULL;
--> statement-breakpoint
ALTER TABLE employee_entity_assignments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE employee_entity_assignments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS employee_entity_assignments_isolate ON employee_entity_assignments;
--> statement-breakpoint
CREATE POLICY employee_entity_assignments_isolate ON employee_entity_assignments
  USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
INSERT INTO employee_entity_assignments (tenant_id, employee_id, legal_entity_id, assignment_kind, effective_from, source)
SELECT e.tenant_id, e.id, e.legal_entity_id, 'primary', coalesce(e.joining_date, current_date), 'backfill'
FROM employees e
WHERE e.legal_entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employee_entity_assignments a WHERE a.tenant_id = e.tenant_id AND a.employee_id = e.id);
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON employee_entity_assignments TO app_runtime;
    GRANT EXECUTE ON FUNCTION app.set_legal_entity_root(), app.cascade_legal_entity_root() TO app_runtime;
  END IF;
END $$;
