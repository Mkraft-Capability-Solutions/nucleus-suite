-- 0031 Group structure and employee job history.
--
-- 1. Companies form a tree. An organisation in the app is a group (e.g. "Tata Industries"); its
--    registered companies (legal_entities) can now sit under a parent company, with a kind
--    (holding, company, subsidiary, division, branch) and an industry.
-- 2. Every employee carries the company they currently work for (employees.legal_entity_id).
-- 3. employee_job_history keeps every position an employee has held in the group: company,
--    location, department, designation, grade, category and manager, from an effective date, with
--    the kind of move (joined, promotion, transfer, move to a sister company, ...) and the reason.
--    Rows are never changed or deleted by the application: a mistake is corrected by a new row
--    that supersedes the old one.
-- 4. A trigger on employees writes a history row whenever any of those fields change by any route
--    (profile edit, import, workflow). The "Record a move" service writes its own fully described
--    row and tells the trigger to stand aside for that transaction (app.job_history_recorded).
-- 5. Existing employees get one "joined" row built from their current record (source 'backfill').

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS parent_legal_entity_id uuid;
--> statement-breakpoint
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS entity_kind text NOT NULL DEFAULT 'company';
--> statement-breakpoint
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS industry text;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_entities_entity_kind_check') THEN
    ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_entity_kind_check
      CHECK (entity_kind IN ('holding', 'company', 'subsidiary', 'division', 'branch'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_entities_parent_not_self') THEN
    ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_parent_not_self CHECK (parent_legal_entity_id IS NULL OR parent_legal_entity_id <> id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_entities_parent_fk') THEN
    ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_parent_fk
      FOREIGN KEY (parent_legal_entity_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_entities_parent_idx ON legal_entities(tenant_id, parent_legal_entity_id);
--> statement-breakpoint

-- A company cannot sit under one of its own descendants.
CREATE OR REPLACE FUNCTION app.guard_legal_entity_cycle() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  cursor_id uuid := NEW.parent_legal_entity_id;
  steps int := 0;
BEGIN
  WHILE cursor_id IS NOT NULL LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'A company cannot be placed under itself or one of its own subsidiaries.' USING ERRCODE = 'check_violation';
    END IF;
    steps := steps + 1;
    IF steps > 50 THEN
      RAISE EXCEPTION 'The company structure is deeper than 50 levels.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_legal_entity_id INTO cursor_id FROM legal_entities WHERE id = cursor_id AND tenant_id = NEW.tenant_id;
  END LOOP;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_entities_cycle_guard ON legal_entities;
--> statement-breakpoint
CREATE TRIGGER legal_entities_cycle_guard BEFORE INSERT OR UPDATE OF parent_legal_entity_id ON legal_entities
  FOR EACH ROW EXECUTE FUNCTION app.guard_legal_entity_cycle();
--> statement-breakpoint

ALTER TABLE employees ADD COLUMN IF NOT EXISTS legal_entity_id uuid;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_legal_entity_fk') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_legal_entity_fk
      FOREIGN KEY (legal_entity_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employees_legal_entity_idx ON employees(tenant_id, legal_entity_id);
--> statement-breakpoint
-- Current company from the latest employment that names one.
UPDATE employees e SET legal_entity_id = latest.legal_entity_id
FROM (
  SELECT DISTINCT ON (em.tenant_id, em.employee_id) em.tenant_id, em.employee_id, em.legal_entity_id
  FROM employments em WHERE em.legal_entity_id IS NOT NULL
  ORDER BY em.tenant_id, em.employee_id, em.created_at DESC
) latest
WHERE e.tenant_id = latest.tenant_id AND e.id = latest.employee_id AND e.legal_entity_id IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS employee_job_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  employee_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN (
    'joined', 'promotion', 'demotion', 'transfer', 'group_transfer', 'redesignation',
    'secondment', 'reporting_change', 'updated'
  )),
  effective_from date NOT NULL,
  legal_entity_id uuid,
  -- Names as they were at the time, so renaming a company or manager never rewrites history.
  legal_entity_name text,
  location text,
  department text,
  designation text,
  grade text,
  category text,
  manager_employee_id uuid,
  manager_name text,
  reason text CHECK (reason IS NULL OR length(reason) <= 1000),
  source text NOT NULL CHECK (source IN ('backfill', 'record_created', 'profile_edit', 'move', 'history', 'correction')),
  supersedes_id uuid,
  recorded_by_membership_id uuid,
  recorded_by_user_id text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supersedes_id) REFERENCES employee_job_history(tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employee_job_history_employee_idx ON employee_job_history(tenant_id, employee_id, effective_from, recorded_at);
--> statement-breakpoint
-- A row can be superseded once; corrections chain.
CREATE UNIQUE INDEX IF NOT EXISTS employee_job_history_supersedes_uq ON employee_job_history(tenant_id, supersedes_id) WHERE supersedes_id IS NOT NULL;
--> statement-breakpoint
ALTER TABLE employee_job_history ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE employee_job_history FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS employee_job_history_isolate ON employee_job_history;
--> statement-breakpoint
CREATE POLICY employee_job_history_isolate ON employee_job_history
  USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
-- History is append-only for the application: no updates, no deletes.
REVOKE UPDATE, DELETE ON employee_job_history FROM app_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.forbid_job_history_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Job history is permanent. Record a correction instead of changing a row.' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS employee_job_history_immutable ON employee_job_history;
--> statement-breakpoint
CREATE TRIGGER employee_job_history_immutable BEFORE UPDATE ON employee_job_history
  FOR EACH ROW EXECUTE FUNCTION app.forbid_job_history_update();
--> statement-breakpoint

-- Captures job changes made outside the "Record a move" service.
CREATE OR REPLACE FUNCTION app.record_employee_job_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  kind text;
  local_today date;
  previous_joined uuid;
  carried_grade text;
BEGIN
  IF coalesce(current_setting('app.job_history_recorded', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT (now() AT TIME ZONE coalesce(
      (SELECT s.timezone FROM tenant_settings s WHERE s.tenant_id = NEW.tenant_id LIMIT 1), 'UTC'))::date
    INTO local_today;

  IF TG_OP = 'INSERT' THEN
    kind := 'joined';
  ELSIF NEW.joining_date IS DISTINCT FROM OLD.joining_date
    AND NEW.legal_entity_id IS NOT DISTINCT FROM OLD.legal_entity_id
    AND NEW.designation IS NOT DISTINCT FROM OLD.designation
    AND NEW.department IS NOT DISTINCT FROM OLD.department
    AND NEW.location IS NOT DISTINCT FROM OLD.location
    AND NEW.manager_employee_id IS NOT DISTINCT FROM OLD.manager_employee_id
    AND NEW.category IS NOT DISTINCT FROM OLD.category THEN
    -- Only the joining date moved: supersede the current "joined" row with the corrected date.
    SELECT h.id INTO previous_joined FROM employee_job_history h
    WHERE h.tenant_id = NEW.tenant_id AND h.employee_id = NEW.id AND h.movement_type = 'joined'
      AND NOT EXISTS (SELECT 1 FROM employee_job_history s WHERE s.tenant_id = h.tenant_id AND s.supersedes_id = h.id)
    ORDER BY h.effective_from, h.recorded_at LIMIT 1;
    IF previous_joined IS NULL OR NEW.joining_date IS NULL THEN
      RETURN NEW;
    END IF;
    INSERT INTO employee_job_history (tenant_id, employee_id, movement_type, effective_from, legal_entity_id, legal_entity_name,
      location, department, designation, grade, category, manager_employee_id, manager_name, reason, source, supersedes_id,
      recorded_by_membership_id, recorded_by_user_id)
    SELECT h.tenant_id, h.employee_id, 'joined', NEW.joining_date, h.legal_entity_id, h.legal_entity_name,
      h.location, h.department, h.designation, h.grade, h.category, h.manager_employee_id, h.manager_name,
      'Joining date corrected on the employee record', 'correction', h.id,
      app.current_membership_id(), app.current_user_id()
    FROM employee_job_history h WHERE h.id = previous_joined;
    RETURN NEW;
  ELSIF NEW.legal_entity_id IS DISTINCT FROM OLD.legal_entity_id AND OLD.legal_entity_id IS NOT NULL THEN
    kind := 'group_transfer';
  ELSIF NEW.designation IS DISTINCT FROM OLD.designation THEN
    kind := 'redesignation';
  ELSIF NEW.department IS DISTINCT FROM OLD.department OR NEW.location IS DISTINCT FROM OLD.location THEN
    kind := 'transfer';
  ELSIF NEW.manager_employee_id IS DISTINCT FROM OLD.manager_employee_id THEN
    kind := 'reporting_change';
  ELSIF NEW.legal_entity_id IS DISTINCT FROM OLD.legal_entity_id OR NEW.category IS DISTINCT FROM OLD.category THEN
    kind := 'updated';
  ELSE
    RETURN NEW;
  END IF;

  -- The grade is not a column on employees: carry it over from the latest position in the history.
  IF kind <> 'joined' THEN
    SELECT h.grade INTO carried_grade FROM employee_job_history h
    WHERE h.tenant_id = NEW.tenant_id AND h.employee_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM employee_job_history s WHERE s.tenant_id = h.tenant_id AND s.supersedes_id = h.id)
    ORDER BY h.effective_from DESC, h.recorded_at DESC LIMIT 1;
  END IF;

  INSERT INTO employee_job_history (tenant_id, employee_id, movement_type, effective_from, legal_entity_id, legal_entity_name,
    location, department, designation, grade, category, manager_employee_id, manager_name, reason, source,
    recorded_by_membership_id, recorded_by_user_id)
  VALUES (
    NEW.tenant_id, NEW.id, kind,
    CASE WHEN kind = 'joined' THEN coalesce(NEW.joining_date, local_today) ELSE local_today END,
    NEW.legal_entity_id,
    (SELECT le.legal_name FROM legal_entities le WHERE le.id = NEW.legal_entity_id AND le.tenant_id = NEW.tenant_id),
    NEW.location, NEW.department, NEW.designation, carried_grade, NEW.category, NEW.manager_employee_id,
    (SELECT nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), '')
       FROM employees m WHERE m.id = NEW.manager_employee_id AND m.tenant_id = NEW.tenant_id),
    CASE WHEN kind = 'joined' THEN NULL ELSE 'Changed on the employee record' END,
    CASE WHEN kind = 'joined' THEN 'record_created' ELSE 'profile_edit' END,
    app.current_membership_id(), app.current_user_id()
  );
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS employees_job_history_capture ON employees;
--> statement-breakpoint
CREATE TRIGGER employees_job_history_capture
  AFTER INSERT OR UPDATE OF legal_entity_id, designation, department, location, manager_employee_id, category, joining_date ON employees
  FOR EACH ROW EXECUTE FUNCTION app.record_employee_job_change();
--> statement-breakpoint

-- One "joined" row for every employee who has no history yet.
INSERT INTO employee_job_history (tenant_id, employee_id, movement_type, effective_from, legal_entity_id, legal_entity_name,
  location, department, designation, category, manager_employee_id, manager_name, reason, source)
SELECT e.tenant_id, e.id, 'joined', coalesce(e.joining_date, e.created_at::date), e.legal_entity_id, le.legal_name,
  e.location, e.department, e.designation, e.category, e.manager_employee_id,
  nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), ''),
  'Position on the employee record when job history started', 'backfill'
FROM employees e
LEFT JOIN legal_entities le ON le.id = e.legal_entity_id AND le.tenant_id = e.tenant_id
LEFT JOIN employees m ON m.id = e.manager_employee_id AND m.tenant_id = e.tenant_id
WHERE NOT EXISTS (SELECT 1 FROM employee_job_history h WHERE h.tenant_id = e.tenant_id AND h.employee_id = e.id);
