-- ============================================================================
-- Migration: 0021_production_hr_features.sql
-- Purpose: Add missing columns and NEW tables for production HR features
-- Note: leave_types, leave_ledger_entries, attendance_regularizations, recognition_events
--       already exist from migration 0008_canonical_304_topology.sql
-- Date: September 2026
-- ============================================================================

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTEND employees table with all missing production fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS worker_category text NOT NULL DEFAULT 'PERM';
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_rest_days boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ot_eligibility text NOT NULL DEFAULT 'ALL_DAYS';
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_location_scope text NOT NULL DEFAULT 'PLANT';
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_trainee boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS trainee_type text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS designation_level integer NOT NULL DEFAULT 5;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS biometric_enrol_id text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS access_card_no text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS locker_no text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_no text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_ifsc text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan_number text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhaar_last4 text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS uan text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS esic_number text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth date;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_relation text;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_end_date date;
--> statement-breakpoint
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cost_center text;

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. recognition_events — Add missing columns (table already exists from 0008)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE recognition_events ADD COLUMN IF NOT EXISTS award_type text;
--> statement-breakpoint
ALTER TABLE recognition_events ADD COLUMN IF NOT EXISTS period text;
--> statement-breakpoint
ALTER TABLE recognition_events ADD COLUMN IF NOT EXISTS note text;
--> statement-breakpoint
ALTER TABLE recognition_events ADD COLUMN IF NOT EXISTS granted_by_membership_id uuid;

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fnf_settlements — NEW: Full & Final Settlement workflow (Demo Point #16)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnf_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  exit_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  department_clearances jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_ref text,
  disbursed_at timestamptz,
  disbursed_by_membership_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS fnf_settlements_tenant_emp_idx ON fnf_settlements (tenant_id, employee_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS fnf_settlements_status_idx ON fnf_settlements (tenant_id, status);
--> statement-breakpoint
ALTER TABLE fnf_settlements ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ot_requests — NEW: Overtime request and approval workflow (Demo Point #10)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ot_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  attendance_date date NOT NULL,
  ot_minutes integer NOT NULL,
  day_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ot_requests_tenant_emp_idx ON ot_requests (tenant_id, employee_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ot_requests_status_idx ON ot_requests (tenant_id, status);
--> statement-breakpoint
ALTER TABLE ot_requests ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 5. hr_letters — NEW: Generated HR letters archive (Demo Point #21)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  letter_type text NOT NULL,
  content text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by_membership_id uuid,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hr_letters_tenant_emp_idx ON hr_letters (tenant_id, employee_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hr_letters_type_idx ON hr_letters (tenant_id, letter_type);
--> statement-breakpoint
ALTER TABLE hr_letters ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 6. hardware_assets — NEW: Asset register + lifecycle (Demo Point #23)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hardware_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  asset_code text NOT NULL,
  asset_type text NOT NULL,
  brand text,
  model text,
  serial_number text,
  assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'available',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS hardware_assets_tenant_code_uq ON hardware_assets (tenant_id, asset_code);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hardware_assets_tenant_idx ON hardware_assets (tenant_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hardware_assets_employee_idx ON hardware_assets (tenant_id, assigned_to) WHERE assigned_to IS NOT NULL;
--> statement-breakpoint
ALTER TABLE hardware_assets ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 7. announcements — NEW: Org-wide + auto birthday/joiner announcements (#20)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'general',
  pinned boolean NOT NULL DEFAULT false,
  author_name text,
  created_by_membership_id uuid,
  target_employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS announcements_tenant_idx ON announcements (tenant_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS announcements_type_idx ON announcements (tenant_id, type);
--> statement-breakpoint
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 8. induction_tasks — NEW: New joiner induction checklist (Demo Point #23)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS induction_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  task_name text NOT NULL,
  category text NOT NULL,
  assigned_to text,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by_membership_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS induction_tasks_tenant_emp_idx ON induction_tasks (tenant_id, employee_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS induction_tasks_status_idx ON induction_tasks (tenant_id, status);
--> statement-breakpoint
ALTER TABLE induction_tasks ENABLE ROW LEVEL SECURITY;
