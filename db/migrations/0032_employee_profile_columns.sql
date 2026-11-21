-- 0032 Employee profile columns the Add/Edit employee service writes.
--
-- createPerson and updatePerson (src/server/organization/service.ts) write these columns, but no
-- earlier migration created them, so adding or editing an employee failed on a database built from
-- the migrations ("column worker_category of relation employees does not exist"). Every column is
-- added only if missing, so a database that already has them (added by hand) is unchanged.
--
-- Note: bank_account_no and pan_number are stored as entered. Moving them to the encrypted
-- field store is tracked separately; this migration only makes the existing service work.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS worker_category text,
  ADD COLUMN IF NOT EXISTS has_rest_days boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ot_eligibility text,
  ADD COLUMN IF NOT EXISTS salary_location_scope text,
  ADD COLUMN IF NOT EXISTS is_trainee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trainee_type text,
  ADD COLUMN IF NOT EXISTS biometric_enrol_id text,
  ADD COLUMN IF NOT EXISTS access_card_no text,
  ADD COLUMN IF NOT EXISTS locker_no text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS aadhaar_last4 text,
  ADD COLUMN IF NOT EXISTS uan text,
  ADD COLUMN IF NOT EXISTS esic_number text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text;
