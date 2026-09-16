-- PROPOSED MKraft HRMS schema; NOT reconstructed from application source.

-- Review business rules and migration strategy before deployment.

-- UUIDs and timestamps are supplied by the application; no extensions required.

BEGIN;

CREATE TABLE tenants (
  id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (code)
);

CREATE TABLE tenant_settings (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  author_user_id uuid,
  setting_key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, setting_key)
);

CREATE TABLE users (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid,
  email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, email)
);

CREATE TABLE user_credentials (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  credential_type text NOT NULL,
  secret_reference text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id, credential_type)
);

CREATE TABLE user_sessions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_digest text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, token_digest)
);

CREATE TABLE roles (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  parent_role_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE permissions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE role_permissions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  granted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, role_id, permission_id)
);

CREATE TABLE user_roles (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  membership_id uuid,
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE tenant_memberships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  legal_entity_id uuid,
  status text NOT NULL,
  joined_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE legal_entities (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  legal_name text NOT NULL,
  registration_number text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE legal_entity_relationships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  parent_entity_id uuid NOT NULL,
  child_entity_id uuid NOT NULL,
  relationship_type text NOT NULL,
  ownership_percent numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, parent_entity_id, child_entity_id, relationship_type),
  CHECK (ownership_percent BETWEEN 0 AND 100),
  CHECK (parent_entity_id <> child_entity_id)
);

CREATE TABLE jurisdictions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  parent_jurisdiction_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  country_code text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE entity_registrations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  registration_type text NOT NULL,
  registration_number text NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, legal_entity_id, jurisdiction_id, registration_type, registration_number)
);

CREATE TABLE entity_addresses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  address_type text NOT NULL,
  address_line text NOT NULL,
  postal_code text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE entity_bank_accounts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  account_token text NOT NULL,
  currency_code text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE access_scopes (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid,
  organization_unit_id uuid,
  author_user_id uuid,
  scope_type text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE role_scope_assignments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_role_id uuid NOT NULL,
  access_scope_id uuid NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_role_id, access_scope_id, valid_from),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE delegations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  delegator_id uuid NOT NULL,
  delegate_id uuid NOT NULL,
  role_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CHECK (delegator_id <> delegate_id)
);

CREATE TABLE service_accounts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  key_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE identity_provider_configs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid,
  author_user_id uuid,
  provider_type text NOT NULL,
  issuer_url text NOT NULL,
  secret_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE persons (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  given_name text NOT NULL,
  family_name text NOT NULL,
  birth_date date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE person_contacts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  contact_type text NOT NULL,
  value_token text NOT NULL,
  is_primary boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE person_addresses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  address_line text NOT NULL,
  postal_code text NOT NULL,
  valid_from date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE person_identifiers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  identifier_type text NOT NULL,
  identifier_token text NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE emergency_contacts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  name text NOT NULL,
  relationship text NOT NULL,
  phone_token text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE person_dependents (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  name text NOT NULL,
  relationship text NOT NULL,
  birth_date date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employees (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  employee_number text NOT NULL,
  hire_date date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  date_of_birth date,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_number)
);

CREATE TABLE employment_contracts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  document_id uuid,
  contract_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE employment_assignments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  position_id uuid NOT NULL,
  location_id uuid NOT NULL,
  cost_center_id uuid,
  starts_on date NOT NULL,
  ends_on date,
  allocation_percent numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (allocation_percent BETWEEN 0 AND 100)
);

CREATE TABLE employment_status_history (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  status text NOT NULL,
  effective_on date NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE organization_units (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  parent_unit_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE organization_unit_history (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  parent_unit_id uuid,
  name text NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, organization_unit_id, valid_from),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE departments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  head_employee_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE teams (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  department_id uuid NOT NULL,
  manager_employee_id uuid,
  author_user_id uuid,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE team_memberships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  team_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, team_id, employee_id, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE positions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  job_profile_id uuid NOT NULL,
  grade_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  title text NOT NULL,
  headcount integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE position_relationships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  position_id uuid NOT NULL,
  related_position_id uuid NOT NULL,
  relationship_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE job_families (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  parent_family_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE job_profiles (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_family_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE job_levels (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_family_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE grades (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  job_level_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE locations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE location_addresses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  location_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  address_line text NOT NULL,
  postal_code text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE cost_centers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  parent_cost_center_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE reporting_relationships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  manager_employee_id uuid NOT NULL,
  relationship_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (employee_id <> manager_employee_id)
);

CREATE TABLE employee_contacts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  contact_type text NOT NULL,
  value_token text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_bank_accounts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  account_token text NOT NULL,
  currency_code text NOT NULL,
  is_primary boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_qualifications (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  document_id uuid,
  qualification text NOT NULL,
  institution text NOT NULL,
  awarded_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_work_experience (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  employer_name text NOT NULL,
  job_title text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE document_types (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  retention_days integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (retention_days >= 0)
);

CREATE TABLE documents (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  document_type_id uuid NOT NULL,
  owner_person_id uuid,
  legal_entity_id uuid,
  title text NOT NULL,
  classification text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE document_versions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  version_number integer NOT NULL,
  storage_reference text NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, document_id, version_number),
  CHECK (version_number >= 0)
);

CREATE TABLE document_links (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  link_purpose text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, document_id, employee_id, link_purpose)
);

CREATE TABLE document_access_grants (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  user_id uuid,
  role_id uuid,
  access_level text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK ((user_id IS NOT NULL AND role_id IS NULL) OR (user_id IS NULL AND role_id IS NOT NULL))
);

CREATE TABLE document_signatures (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  signer_person_id uuid NOT NULL,
  signed_at timestamptz NOT NULL,
  signature_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, document_version_id, signer_person_id)
);

CREATE TABLE employee_custom_field_definitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid,
  author_user_id uuid,
  field_key text NOT NULL,
  label text NOT NULL,
  data_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, field_key)
);

CREATE TABLE employee_custom_field_values (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  field_definition_id uuid NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, field_definition_id)
);

CREATE TABLE workflow_definitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid,
  owner_role_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  version_number integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code, version_number),
  CHECK (version_number >= 0)
);

CREATE TABLE workflow_steps (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  workflow_definition_id uuid NOT NULL,
  approver_role_id uuid,
  author_user_id uuid,
  step_key text NOT NULL,
  sequence_number integer NOT NULL,
  step_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, workflow_definition_id, step_key),
  CHECK (sequence_number >= 0)
);

CREATE TABLE workflow_transitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  from_step_id uuid NOT NULL,
  to_step_id uuid NOT NULL,
  condition_expression text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, from_step_id, to_step_id)
);

CREATE TABLE workflow_instances (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  workflow_definition_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE workflow_step_instances (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  workflow_instance_id uuid NOT NULL,
  workflow_step_id uuid NOT NULL,
  assigned_to uuid,
  status text NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE approval_requests (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  workflow_step_instance_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  status text NOT NULL,
  requested_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE approval_decisions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  approval_request_id uuid NOT NULL,
  decided_by uuid NOT NULL,
  delegation_id uuid,
  decision text NOT NULL,
  decided_at timestamptz NOT NULL,
  comment text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE work_items (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  workflow_instance_id uuid,
  assigned_to uuid,
  assigned_role_id uuid,
  title text NOT NULL,
  status text NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE inbox_entries (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  work_item_id uuid NOT NULL,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id, work_item_id)
);

CREATE TABLE notification_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  channel text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE notifications (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  template_id uuid,
  recipient_user_id uuid NOT NULL,
  workflow_instance_id uuid,
  channel text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE notification_deliveries (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  notification_id uuid NOT NULL,
  attempt_number integer NOT NULL,
  attempted_at timestamptz NOT NULL,
  status text NOT NULL,
  provider_reference text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, notification_id, attempt_number),
  CHECK (attempt_number >= 0)
);

CREATE TABLE notification_preferences (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  template_id uuid NOT NULL,
  channel text NOT NULL,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id, template_id, channel)
);

CREATE TABLE work_calendars (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  location_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE calendar_days (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  work_calendar_id uuid NOT NULL,
  calendar_date date NOT NULL,
  day_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, work_calendar_id, calendar_date)
);

CREATE TABLE holidays (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  work_calendar_id uuid NOT NULL,
  jurisdiction_id uuid,
  name text NOT NULL,
  holiday_date date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE shift_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  start_minute integer NOT NULL,
  duration_minutes integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (duration_minutes >= 0)
);

CREATE TABLE shift_breaks (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  shift_template_id uuid NOT NULL,
  start_offset_minutes integer NOT NULL,
  duration_minutes integer NOT NULL,
  paid boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (duration_minutes >= 0)
);

CREATE TABLE shift_rosters (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  work_calendar_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE shift_assignments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  shift_roster_id uuid NOT NULL,
  shift_template_id uuid NOT NULL,
  location_id uuid NOT NULL,
  shift_date date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, shift_date, shift_template_id)
);

CREATE TABLE shift_swaps (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  original_assignment_id uuid NOT NULL,
  replacement_assignment_id uuid NOT NULL,
  approval_request_id uuid,
  status text NOT NULL,
  requested_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE attendance_devices (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  location_id uuid NOT NULL,
  code text NOT NULL,
  device_type text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE attendance_events (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  device_id uuid,
  location_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  event_type text NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, source_reference)
);

CREATE TABLE attendance_days (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  shift_assignment_id uuid,
  work_date date NOT NULL,
  worked_minutes integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, work_date)
);

CREATE TABLE attendance_segments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  attendance_day_id uuid NOT NULL,
  start_event_id uuid,
  end_event_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  segment_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE attendance_exceptions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  attendance_day_id uuid NOT NULL,
  work_item_id uuid,
  exception_type text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE attendance_regularizations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  attendance_day_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  approval_request_id uuid,
  reason text NOT NULL,
  proposed_start timestamptz NOT NULL,
  proposed_end timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE time_policies (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  rules jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE employee_time_policies (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  time_policy_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE leave_types (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  paid boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE leave_policies (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  accrual_rules jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE leave_policy_assignments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  leave_policy_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, leave_policy_id, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE leave_balances (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  leave_policy_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  balance_days numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, leave_policy_id, period_start, period_end),
  CHECK (period_end IS NULL OR period_end >= period_start)
);

CREATE TABLE leave_transactions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  leave_balance_id uuid NOT NULL,
  leave_request_id uuid,
  effective_on date NOT NULL,
  quantity_days numeric(18,4) NOT NULL,
  transaction_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE leave_requests (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  approval_request_id uuid,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  requested_days numeric(18,4) NOT NULL,
  status text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE leave_request_days (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  leave_request_id uuid NOT NULL,
  attendance_day_id uuid,
  leave_date date NOT NULL,
  quantity_days numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, leave_request_id, leave_date)
);

CREATE TABLE overtime_policies (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  rules jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE overtime_requests (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  overtime_policy_id uuid NOT NULL,
  approval_request_id uuid,
  work_date date NOT NULL,
  requested_minutes integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE overtime_entries (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  overtime_request_id uuid NOT NULL,
  attendance_day_id uuid NOT NULL,
  approved_minutes integer NOT NULL,
  effective_on date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE gate_pass_requests (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  location_id uuid NOT NULL,
  approval_request_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE gate_pass_events (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  gate_pass_request_id uuid NOT NULL,
  device_id uuid,
  occurred_at timestamptz NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE time_period_locks (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  locked_by uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  locked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE pay_groups (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE pay_periods (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  pay_group_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  pay_date date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, pay_group_id, starts_on, ends_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE employee_pay_group_assignments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  pay_group_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE payroll_runs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  pay_period_id uuid NOT NULL,
  approval_request_id uuid,
  run_type text NOT NULL,
  status text NOT NULL,
  version_number integer NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, pay_period_id, run_type, version_number),
  CHECK (version_number >= 0)
);

CREATE TABLE payroll_run_employees (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  status text NOT NULL,
  gross_amount numeric(18,4) NOT NULL,
  net_amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payroll_run_id, employee_id)
);

CREATE TABLE pay_components (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  component_type text NOT NULL,
  taxable boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE pay_component_rules (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  author_user_id uuid,
  expression text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE employee_pay_components (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  amount numeric(18,4) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE payroll_inputs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  quantity numeric(18,4) NOT NULL,
  amount numeric(18,4) NOT NULL,
  input_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payroll_attendance_inputs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_input_id uuid NOT NULL,
  attendance_day_id uuid NOT NULL,
  paid_minutes integer NOT NULL,
  unpaid_minutes integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payroll_input_id)
);

CREATE TABLE payroll_overtime_inputs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_input_id uuid NOT NULL,
  overtime_entry_id uuid NOT NULL,
  minutes integer NOT NULL,
  rate numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payroll_input_id)
);

CREATE TABLE payroll_leave_inputs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_input_id uuid NOT NULL,
  leave_request_day_id uuid NOT NULL,
  paid_days numeric(18,4) NOT NULL,
  unpaid_days numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payroll_input_id)
);

CREATE TABLE payroll_results (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  quantity numeric(18,4) NOT NULL,
  rate numeric(18,4) NOT NULL,
  amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payroll_adjustments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  approval_request_id uuid,
  amount numeric(18,4) NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payroll_arrears (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  original_result_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  amount numeric(18,4) NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payslips (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  document_id uuid,
  issued_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payroll_run_employee_id)
);

CREATE TABLE loan_types (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  annual_interest_rate numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE employee_loans (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  loan_type_id uuid NOT NULL,
  approval_request_id uuid,
  principal_amount numeric(18,4) NOT NULL,
  starts_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE loan_installments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_loan_id uuid NOT NULL,
  due_on date NOT NULL,
  principal_amount numeric(18,4) NOT NULL,
  interest_amount numeric(18,4) NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_loan_id, due_on)
);

CREATE TABLE loan_repayments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  loan_installment_id uuid NOT NULL,
  payroll_result_id uuid,
  paid_on date NOT NULL,
  amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE salary_advances (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  approval_request_id uuid,
  payroll_run_employee_id uuid,
  requested_amount numeric(18,4) NOT NULL,
  requested_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE statutory_schemes (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  scheme_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE statutory_rates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  statutory_scheme_id uuid NOT NULL,
  author_user_id uuid,
  effective_from date NOT NULL,
  effective_to date,
  employee_rate numeric(18,4) NOT NULL,
  employer_rate numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE employee_statutory_enrollments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  statutory_scheme_id uuid NOT NULL,
  registration_token text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, statutory_scheme_id, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE statutory_contributions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  statutory_rate_id uuid NOT NULL,
  employee_amount numeric(18,4) NOT NULL,
  employer_amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE tax_declarations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  tax_year integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, jurisdiction_id, tax_year)
);

CREATE TABLE tax_declaration_items (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  tax_declaration_id uuid NOT NULL,
  document_id uuid,
  category_code text NOT NULL,
  declared_amount numeric(18,4) NOT NULL,
  approved_amount numeric(18,4),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE tax_withholdings (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  tax_declaration_id uuid,
  jurisdiction_id uuid NOT NULL,
  taxable_amount numeric(18,4) NOT NULL,
  withheld_amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE statutory_filings (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  statutory_scheme_id uuid NOT NULL,
  evidence_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (period_end IS NULL OR period_end >= period_start)
);

CREATE TABLE statutory_filing_lines (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  statutory_filing_id uuid NOT NULL,
  statutory_contribution_id uuid NOT NULL,
  contribution_amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, statutory_filing_id, statutory_contribution_id)
);

CREATE TABLE statutory_form_serials (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid,
  issued_by_membership_id uuid,
  establishment_key text NOT NULL,
  form_code text NOT NULL,
  serial_number integer NOT NULL,
  statutory_instance_id uuid,
  issued_at timestamptz NOT NULL,
  voided_at timestamptz,
  void_reason text,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, establishment_key, form_code, serial_number),
  CHECK (serial_number > 0),
  CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);

CREATE TABLE gl_accounts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  parent_account_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE pay_component_gl_mappings (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  gl_account_id uuid NOT NULL,
  cost_center_id uuid,
  debit_credit text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payroll_journals (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  journal_date date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payroll_journal_lines (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_journal_id uuid NOT NULL,
  gl_account_id uuid NOT NULL,
  cost_center_id uuid,
  payroll_result_id uuid,
  debit_amount numeric(18,4) NOT NULL,
  credit_amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE disbursement_batches (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  entity_bank_account_id uuid NOT NULL,
  approval_request_id uuid,
  status text NOT NULL,
  payment_date date NOT NULL,
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE disbursement_items (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  disbursement_batch_id uuid NOT NULL,
  payroll_run_employee_id uuid NOT NULL,
  employee_bank_account_id uuid NOT NULL,
  amount numeric(18,4) NOT NULL,
  status text NOT NULL,
  provider_reference text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payment_reconciliations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  disbursement_item_id uuid NOT NULL,
  reconciled_by uuid NOT NULL,
  reconciled_at timestamptz NOT NULL,
  status text NOT NULL,
  bank_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payroll_cases (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  payroll_run_id uuid,
  work_item_id uuid,
  case_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE final_settlements (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  separation_id uuid NOT NULL,
  payroll_run_employee_id uuid,
  settlement_date date NOT NULL,
  amount numeric(18,4) NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, separation_id)
);

CREATE TABLE payroll_exports (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  integration_job_id uuid,
  document_id uuid,
  export_type text NOT NULL,
  status text NOT NULL,
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE payroll_audit_entries (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  audit_event_id uuid,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE requisition_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_profile_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE job_requisitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  position_id uuid NOT NULL,
  hiring_manager_id uuid NOT NULL,
  approval_request_id uuid,
  author_user_id uuid,
  requisition_number text NOT NULL,
  headcount integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE requisition_approvers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_requisition_id uuid NOT NULL,
  approver_id uuid NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, job_requisition_id, approver_id),
  CHECK (sequence_number >= 0)
);

CREATE TABLE job_postings (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_requisition_id uuid NOT NULL,
  location_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  published_at timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE posting_channels (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  channel_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE job_posting_publications (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_posting_id uuid NOT NULL,
  posting_channel_id uuid NOT NULL,
  external_reference text NOT NULL,
  published_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, job_posting_id, posting_channel_id)
);

CREATE TABLE candidate_sources (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE candidates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  candidate_source_id uuid,
  status text NOT NULL,
  consent_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE candidate_profiles (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  summary text NOT NULL,
  availability_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, candidate_id)
);

CREATE TABLE candidate_documents (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  document_id uuid NOT NULL,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, candidate_id, document_id, purpose)
);

CREATE TABLE candidate_consents (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  purpose text NOT NULL,
  granted boolean NOT NULL,
  recorded_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE applications (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  job_requisition_id uuid NOT NULL,
  job_posting_id uuid,
  applied_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE application_stage_definitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  requisition_template_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (sequence_number >= 0)
);

CREATE TABLE application_stage_history (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  application_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  entered_at timestamptz NOT NULL,
  exited_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE screening_questions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_requisition_id uuid NOT NULL,
  prompt text NOT NULL,
  response_type text NOT NULL,
  required boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE screening_answers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  application_id uuid NOT NULL,
  screening_question_id uuid NOT NULL,
  answer jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, application_id, screening_question_id)
);

CREATE TABLE interview_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_profile_id uuid NOT NULL,
  name text NOT NULL,
  instructions text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE interviews (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  application_id uuid NOT NULL,
  interview_template_id uuid,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (duration_minutes >= 0)
);

CREATE TABLE interview_panelists (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  interview_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  panel_role text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, interview_id, employee_id)
);

CREATE TABLE interview_feedback (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  interview_panelist_id uuid NOT NULL,
  rating numeric(18,4) NOT NULL,
  recommendation text NOT NULL,
  comments text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, interview_panelist_id)
);

CREATE TABLE assessment_definitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_profile_id uuid,
  name text NOT NULL,
  assessment_type text NOT NULL,
  passing_score numeric(18,4),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE candidate_assessments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  application_id uuid NOT NULL,
  assessment_definition_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL,
  completed_at timestamptz,
  score numeric(18,4),
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE offer_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  name text NOT NULL,
  terms_template text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE offers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  application_id uuid NOT NULL,
  offer_template_id uuid NOT NULL,
  approval_request_id uuid,
  offered_on date NOT NULL,
  expires_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE offer_components (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  pay_component_id uuid NOT NULL,
  amount numeric(18,4) NOT NULL,
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, offer_id, pay_component_id)
);

CREATE TABLE offer_acceptances (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  signed_document_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, offer_id)
);

CREATE TABLE background_check_types (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE background_checks (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  check_type_id uuid NOT NULL,
  evidence_document_id uuid,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE onboarding_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  job_profile_id uuid,
  author_user_id uuid,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE onboarding_template_tasks (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  onboarding_template_id uuid NOT NULL,
  owner_role_id uuid NOT NULL,
  title text NOT NULL,
  sequence_number integer NOT NULL,
  due_offset_days integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (sequence_number >= 0)
);

CREATE TABLE onboarding_cases (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  onboarding_template_id uuid NOT NULL,
  offer_id uuid,
  starts_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE onboarding_tasks (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  onboarding_case_id uuid NOT NULL,
  template_task_id uuid NOT NULL,
  work_item_id uuid,
  due_on date NOT NULL,
  status text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, onboarding_case_id, template_task_id)
);

CREATE TABLE probation_reviews (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  approval_request_id uuid,
  review_on date NOT NULL,
  outcome text,
  comments text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_transfers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  from_assignment_id uuid NOT NULL,
  to_assignment_id uuid NOT NULL,
  approval_request_id uuid,
  effective_on date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_promotions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  from_grade_id uuid NOT NULL,
  to_grade_id uuid NOT NULL,
  approval_request_id uuid,
  effective_on date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE separations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  approval_request_id uuid,
  last_working_on date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE exit_interviews (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  separation_id uuid NOT NULL,
  interviewer_id uuid NOT NULL,
  interviewed_at timestamptz NOT NULL,
  feedback jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, separation_id)
);

CREATE TABLE clearance_tasks (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  separation_id uuid NOT NULL,
  owner_employee_id uuid NOT NULL,
  work_item_id uuid,
  title text NOT NULL,
  status text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE alumni_profiles (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  separation_id uuid NOT NULL,
  contact_consent boolean NOT NULL,
  joined_on date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, separation_id)
);

CREATE TABLE rehire_cases (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  alumni_profile_id uuid NOT NULL,
  job_requisition_id uuid NOT NULL,
  approval_request_id uuid,
  requested_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE performance_cycles (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE performance_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_profile_id uuid,
  author_user_id uuid,
  name text NOT NULL,
  instructions text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE performance_template_sections (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  performance_template_id uuid NOT NULL,
  title text NOT NULL,
  weight numeric(18,4) NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, performance_template_id, sequence_number),
  CHECK (sequence_number >= 0)
);

CREATE TABLE performance_reviews (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  performance_cycle_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  performance_template_id uuid NOT NULL,
  workflow_instance_id uuid,
  status text NOT NULL,
  overall_rating numeric(18,4),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, performance_cycle_id, employee_id)
);

CREATE TABLE performance_reviewers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  performance_review_id uuid NOT NULL,
  reviewer_employee_id uuid NOT NULL,
  reviewer_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, performance_review_id, reviewer_employee_id, reviewer_type)
);

CREATE TABLE performance_ratings (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  performance_reviewer_id uuid NOT NULL,
  template_section_id uuid NOT NULL,
  rating numeric(18,4) NOT NULL,
  comment text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, performance_reviewer_id, template_section_id)
);

CREATE TABLE goals (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  performance_cycle_id uuid,
  parent_goal_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  starts_on date NOT NULL,
  due_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE goal_key_results (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  goal_id uuid NOT NULL,
  description text NOT NULL,
  target_value numeric(18,4) NOT NULL,
  current_value numeric(18,4) NOT NULL,
  unit text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE goal_checkins (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  goal_id uuid NOT NULL,
  author_employee_id uuid NOT NULL,
  checked_at timestamptz NOT NULL,
  progress numeric(18,4) NOT NULL,
  comment text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE feedback_requests (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  subject_employee_id uuid NOT NULL,
  requester_employee_id uuid NOT NULL,
  performance_review_id uuid,
  requested_at timestamptz NOT NULL,
  due_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE feedback_responses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  feedback_request_id uuid NOT NULL,
  responder_employee_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL,
  feedback jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, feedback_request_id, responder_employee_id)
);

CREATE TABLE calibration_sessions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  performance_cycle_id uuid NOT NULL,
  facilitator_id uuid NOT NULL,
  name text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE calibration_entries (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  calibration_session_id uuid NOT NULL,
  performance_review_id uuid NOT NULL,
  original_rating numeric(18,4) NOT NULL,
  calibrated_rating numeric(18,4) NOT NULL,
  rationale text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, calibration_session_id, performance_review_id)
);

CREATE TABLE skill_categories (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  parent_category_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE skills (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  skill_category_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE skill_levels (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  level_number integer NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, skill_id, level_number),
  UNIQUE (tenant_id, skill_id, id)
);

CREATE TABLE job_profile_skills (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_profile_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  required_level_id uuid NOT NULL,
  required boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, job_profile_id, skill_id)
);

CREATE TABLE employee_skills (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  skill_level_id uuid NOT NULL,
  assessed_on date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, skill_id, assessed_on)
);

CREATE TABLE skill_assessments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_skill_id uuid NOT NULL,
  assessor_id uuid,
  candidate_assessment_id uuid,
  assessed_at timestamptz NOT NULL,
  score numeric(18,4) NOT NULL,
  evidence text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE development_plans (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  mentor_employee_id uuid,
  performance_review_id uuid,
  title text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE development_actions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  development_plan_id uuid NOT NULL,
  skill_id uuid,
  work_item_id uuid,
  description text NOT NULL,
  due_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE succession_plans (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  position_id uuid NOT NULL,
  owner_employee_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE succession_candidates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  succession_plan_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  development_plan_id uuid,
  readiness text NOT NULL,
  assessment_date date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, succession_plan_id, employee_id)
);

CREATE TABLE talent_pools (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  owner_employee_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE talent_pool_members (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  talent_pool_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  joined_on date NOT NULL,
  rationale text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, talent_pool_id, employee_id)
);

CREATE TABLE learning_providers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  provider_type text NOT NULL,
  contact_reference text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE courses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  learning_provider_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  duration_minutes integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (duration_minutes >= 0)
);

CREATE TABLE course_modules (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  course_id uuid NOT NULL,
  title text NOT NULL,
  sequence_number integer NOT NULL,
  content_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, course_id, sequence_number),
  CHECK (sequence_number >= 0)
);

CREATE TABLE course_skills (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  course_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  target_level_id uuid,
  outcome_description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, course_id, skill_id)
);

CREATE TABLE learning_paths (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_profile_id uuid,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE learning_path_courses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  learning_path_id uuid NOT NULL,
  course_id uuid NOT NULL,
  sequence_number integer NOT NULL,
  required boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, learning_path_id, course_id),
  CHECK (sequence_number >= 0)
);

CREATE TABLE course_sessions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  course_id uuid NOT NULL,
  location_id uuid,
  instructor_employee_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CHECK (capacity >= 0)
);

CREATE TABLE learning_enrollments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  course_id uuid NOT NULL,
  course_session_id uuid,
  work_item_id uuid,
  enrolled_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE learning_completions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  learning_enrollment_id uuid NOT NULL,
  completed_at timestamptz NOT NULL,
  score numeric(18,4),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, learning_enrollment_id)
);

CREATE TABLE certifications (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  skill_id uuid,
  name text NOT NULL,
  issuing_body text NOT NULL,
  validity_months integer,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_certifications (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  certification_id uuid NOT NULL,
  document_id uuid,
  issued_on date NOT NULL,
  expires_on date,
  credential_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE learning_evaluations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  learning_enrollment_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL,
  rating numeric(18,4) NOT NULL,
  comments text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, learning_enrollment_id)
);

CREATE TABLE compensation_plans (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE salary_bands (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  compensation_plan_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  location_id uuid,
  minimum_amount numeric(18,4) NOT NULL,
  midpoint_amount numeric(18,4) NOT NULL,
  maximum_amount numeric(18,4) NOT NULL,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, compensation_plan_id, id),
  CHECK (minimum_amount <= midpoint_amount AND midpoint_amount <= maximum_amount)
);

CREATE TABLE employee_compensation (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  compensation_plan_id uuid NOT NULL,
  salary_band_id uuid,
  source_payroll_result_id uuid,
  annual_amount numeric(18,4) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE compensation_review_cycles (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  compensation_plan_id uuid NOT NULL,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE compensation_review_proposals (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  review_cycle_id uuid NOT NULL,
  employee_compensation_id uuid NOT NULL,
  approval_request_id uuid,
  proposed_amount numeric(18,4) NOT NULL,
  rationale text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, review_cycle_id, employee_compensation_id)
);

CREATE TABLE benefit_plans (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  plan_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE benefit_options (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  benefit_plan_id uuid NOT NULL,
  name text NOT NULL,
  employee_cost numeric(18,4) NOT NULL,
  employer_cost numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, benefit_plan_id, name)
);

CREATE TABLE benefit_eligibility_rules (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  benefit_plan_id uuid NOT NULL,
  grade_id uuid,
  location_id uuid,
  expression text NOT NULL,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE benefit_enrollments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  benefit_option_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE benefit_dependents (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  benefit_enrollment_id uuid NOT NULL,
  person_dependent_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, benefit_enrollment_id, person_dependent_id, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE benefit_claims (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  benefit_enrollment_id uuid NOT NULL,
  document_id uuid,
  approval_request_id uuid,
  claimed_on date NOT NULL,
  claimed_amount numeric(18,4) NOT NULL,
  approved_amount numeric(18,4),
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE survey_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE survey_questions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_template_id uuid NOT NULL,
  prompt text NOT NULL,
  response_type text NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, survey_template_id, sequence_number),
  CHECK (sequence_number >= 0)
);

CREATE TABLE survey_question_options (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_question_id uuid NOT NULL,
  label text NOT NULL,
  option_value text NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, survey_question_id, option_value),
  UNIQUE (tenant_id, survey_question_id, id),
  CHECK (sequence_number >= 0)
);

CREATE TABLE survey_campaigns (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_template_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (closes_at IS NULL OR closes_at >= opens_at)
);

CREATE TABLE survey_audiences (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_campaign_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  included boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, survey_campaign_id, organization_unit_id)
);

CREATE TABLE survey_invitations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_campaign_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  invited_at timestamptz NOT NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, survey_campaign_id, employee_id)
);

CREATE TABLE survey_responses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_invitation_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, survey_invitation_id)
);

CREATE TABLE survey_answers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_response_id uuid NOT NULL,
  survey_question_id uuid NOT NULL,
  selected_option_id uuid,
  answer jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, survey_response_id, survey_question_id)
);

CREATE TABLE pulse_campaigns (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  survey_template_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  cadence text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE pulse_responses (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  pulse_campaign_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL,
  score numeric(18,4) NOT NULL,
  comment text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE engagement_scores (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  survey_campaign_id uuid,
  measured_on date NOT NULL,
  score numeric(18,4) NOT NULL,
  population_size integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE recognition_programs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE recognition_badges (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  recognition_program_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE recognitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  recognition_badge_id uuid NOT NULL,
  giver_employee_id uuid NOT NULL,
  recipient_employee_id uuid NOT NULL,
  awarded_at timestamptz NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE recognition_reactions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  recognition_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  reaction text NOT NULL,
  reacted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, recognition_id, employee_id)
);

CREATE TABLE reward_catalog_items (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  recognition_program_id uuid NOT NULL,
  name text NOT NULL,
  points_cost integer NOT NULL,
  available_quantity integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE reward_redemptions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  reward_catalog_item_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  redeemed_at timestamptz NOT NULL,
  points_spent integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE employee_suggestions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE suggestion_votes (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_suggestion_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  voted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_suggestion_id, employee_id)
);

CREATE TABLE grievance_categories (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  restricted boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE grievances (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  grievance_category_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  assigned_to uuid,
  description text NOT NULL,
  filed_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE grievance_actions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  grievance_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action_type text NOT NULL,
  description text NOT NULL,
  performed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE wellbeing_programs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE wellbeing_enrollments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  wellbeing_program_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE analytics_datasets (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  classification text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE analytics_dataset_fields (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  analytics_dataset_id uuid NOT NULL,
  field_key text NOT NULL,
  data_type text NOT NULL,
  restricted boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, analytics_dataset_id, field_key)
);

CREATE TABLE metric_definitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  analytics_dataset_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  expression text NOT NULL,
  aggregation text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE metric_snapshots (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  metric_definition_id uuid NOT NULL,
  organization_unit_id uuid,
  measured_at timestamptz NOT NULL,
  metric_value numeric(18,4) NOT NULL,
  population_size integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE analytics_dashboards (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE dashboard_widgets (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  analytics_dashboard_id uuid NOT NULL,
  metric_definition_id uuid NOT NULL,
  title text NOT NULL,
  configuration jsonb NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, analytics_dashboard_id, sequence_number),
  CHECK (sequence_number >= 0)
);

CREATE TABLE analytics_report_definitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  analytics_dataset_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  configuration jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE analytics_report_runs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  report_definition_id uuid NOT NULL,
  background_job_id uuid,
  document_id uuid,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE workforce_forecast_models (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  analytics_dataset_id uuid NOT NULL,
  name text NOT NULL,
  version_number integer NOT NULL,
  configuration jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK (version_number >= 0)
);

CREATE TABLE workforce_forecast_runs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  forecast_model_id uuid NOT NULL,
  background_job_id uuid,
  horizon_months integer NOT NULL,
  started_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE workforce_forecast_values (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  forecast_run_id uuid NOT NULL,
  organization_unit_id uuid NOT NULL,
  metric_definition_id uuid NOT NULL,
  forecast_date date NOT NULL,
  predicted_value numeric(18,4) NOT NULL,
  lower_bound numeric(18,4),
  upper_bound numeric(18,4),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE ai_model_registry (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  integration_connection_id uuid,
  name text NOT NULL,
  provider text NOT NULL,
  model_version text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, provider, name, model_version)
);

CREATE TABLE ai_prompt_templates (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_model_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  version_number integer NOT NULL,
  template_text text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code, version_number),
  CHECK (version_number >= 0)
);

CREATE TABLE ai_runs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_model_id uuid NOT NULL,
  prompt_template_id uuid,
  requested_by uuid NOT NULL,
  background_job_id uuid,
  run_type text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE ai_run_inputs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  document_version_id uuid,
  input_type text NOT NULL,
  payload_reference text NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE ai_run_outputs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  output_type text NOT NULL,
  payload jsonb NOT NULL,
  confidence numeric(18,4),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE ai_evidence (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  document_version_id uuid,
  audit_event_id uuid,
  evidence_type text NOT NULL,
  excerpt_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE resume_parse_runs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  candidate_document_id uuid NOT NULL,
  parser_version text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, ai_run_id)
);

CREATE TABLE job_description_analysis_runs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  job_posting_id uuid NOT NULL,
  analysis_version text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, ai_run_id)
);

CREATE TABLE candidate_match_scores (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  application_id uuid NOT NULL,
  score numeric(18,4) NOT NULL,
  rationale text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, ai_run_id, application_id)
);

CREATE TABLE skill_recommendations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  rationale text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, ai_run_id, employee_id, skill_id)
);

CREATE TABLE learning_recommendations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  course_id uuid NOT NULL,
  rationale text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, ai_run_id, employee_id, course_id)
);

CREATE TABLE compensation_insight_runs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  compensation_plan_id uuid NOT NULL,
  access_scope_id uuid NOT NULL,
  analysis_period_start date NOT NULL,
  analysis_period_end date NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, ai_run_id)
);

CREATE TABLE ai_model_call_logs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  ai_run_id uuid NOT NULL,
  integration_job_id uuid,
  audit_event_id uuid,
  started_at timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE integration_providers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  provider_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE integration_connections (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  integration_provider_id uuid NOT NULL,
  legal_entity_id uuid,
  name text NOT NULL,
  status text NOT NULL,
  secret_reference text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE integration_mappings (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  integration_connection_id uuid NOT NULL,
  author_user_id uuid,
  name text NOT NULL,
  direction text NOT NULL,
  mapping jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE integration_jobs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  integration_connection_id uuid NOT NULL,
  background_job_id uuid,
  operation text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE integration_job_items (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  integration_job_id uuid NOT NULL,
  external_reference text NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE webhook_endpoints (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  integration_connection_id uuid NOT NULL,
  url text NOT NULL,
  secret_reference text NOT NULL,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE webhook_deliveries (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  webhook_endpoint_id uuid NOT NULL,
  outbox_event_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL,
  status text NOT NULL,
  response_code integer,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE inbound_events (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  integration_connection_id uuid NOT NULL,
  external_event_id text NOT NULL,
  received_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, integration_connection_id, external_event_id)
);

CREATE TABLE outbox_events (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  actor_id uuid,
  ai_run_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE outbox_delivery_attempts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  outbox_event_id uuid NOT NULL,
  integration_connection_id uuid NOT NULL,
  attempt_number integer NOT NULL,
  attempted_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, outbox_event_id, integration_connection_id, attempt_number),
  CHECK (attempt_number >= 0)
);

CREATE TABLE job_definitions (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  service_account_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  handler text NOT NULL,
  retry_limit integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (retry_limit >= 0)
);

CREATE TABLE job_schedules (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_definition_id uuid NOT NULL,
  cron_expression text NOT NULL,
  timezone text NOT NULL,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE background_jobs (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  job_definition_id uuid NOT NULL,
  job_schedule_id uuid,
  requested_by uuid,
  status text NOT NULL,
  queued_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE job_attempts (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  background_job_id uuid NOT NULL,
  attempt_number integer NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, background_job_id, attempt_number),
  CHECK (attempt_number >= 0)
);

CREATE TABLE job_dependencies (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  background_job_id uuid NOT NULL,
  prerequisite_job_id uuid NOT NULL,
  dependency_type text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, background_job_id, prerequisite_job_id),
  CHECK (background_job_id <> prerequisite_job_id)
);

CREATE TABLE dead_letter_entries (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  background_job_id uuid,
  inbound_event_id uuid,
  failed_at timestamptz NOT NULL,
  reason text NOT NULL,
  resolution text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  CHECK ((background_job_id IS NOT NULL AND inbound_event_id IS NULL) OR (background_job_id IS NULL AND inbound_event_id IS NOT NULL))
);

CREATE TABLE compliance_frameworks (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code, version)
);

CREATE TABLE compliance_controls (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  compliance_framework_id uuid NOT NULL,
  owner_role_id uuid NOT NULL,
  author_user_id uuid,
  code text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE compliance_obligations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  compliance_control_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  description text NOT NULL,
  due_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE compliance_evidence (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  compliance_obligation_id uuid NOT NULL,
  document_version_id uuid,
  collected_by uuid NOT NULL,
  title text NOT NULL,
  captured_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE compliance_assessments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  compliance_control_id uuid NOT NULL,
  assessor_id uuid NOT NULL,
  evidence_id uuid,
  assessed_at timestamptz NOT NULL,
  outcome text NOT NULL,
  findings text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE retention_policies (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  jurisdiction_id uuid NOT NULL,
  legal_entity_id uuid,
  author_user_id uuid,
  code text NOT NULL,
  resource_type text NOT NULL,
  retention_days integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (retention_days >= 0)
);

CREATE TABLE legal_holds (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  authorized_by uuid NOT NULL,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE legal_hold_documents (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  legal_hold_id uuid NOT NULL,
  document_id uuid NOT NULL,
  added_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, legal_hold_id, document_id)
);

CREATE TABLE data_subject_requests (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  assigned_to uuid,
  approval_request_id uuid,
  request_type text NOT NULL,
  received_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE audit_events (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  actor_id uuid,
  service_account_id uuid,
  legal_entity_id uuid,
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE audit_event_changes (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  audit_event_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, id)
);

ALTER TABLE tenant_settings ADD CONSTRAINT fk_tenant_settings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tenant_settings ADD CONSTRAINT fk_tenant_settings_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE users ADD CONSTRAINT fk_users_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE users ADD CONSTRAINT fk_users_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_credentials ADD CONSTRAINT fk_user_credentials_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_credentials ADD CONSTRAINT fk_user_credentials_user_id FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_sessions ADD CONSTRAINT fk_user_sessions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_sessions ADD CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE roles ADD CONSTRAINT fk_roles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE roles ADD CONSTRAINT fk_roles_parent_role_id FOREIGN KEY (tenant_id, parent_role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE roles ADD CONSTRAINT fk_roles_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE permissions ADD CONSTRAINT fk_permissions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE permissions ADD CONSTRAINT fk_permissions_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_role_id FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_permission_id FOREIGN KEY (tenant_id, permission_id) REFERENCES permissions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_user_id FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_role_id FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_membership_id FOREIGN KEY (tenant_id, membership_id) REFERENCES tenant_memberships (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tenant_memberships ADD CONSTRAINT fk_tenant_memberships_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tenant_memberships ADD CONSTRAINT fk_tenant_memberships_user_id FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tenant_memberships ADD CONSTRAINT fk_tenant_memberships_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_entities ADD CONSTRAINT fk_legal_entities_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_entities ADD CONSTRAINT fk_legal_entities_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_entities ADD CONSTRAINT fk_legal_entities_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_entity_relationships ADD CONSTRAINT fk_legal_entity_relationships_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_entity_relationships ADD CONSTRAINT fk_legal_entity_relationships_parent_entity_id FOREIGN KEY (tenant_id, parent_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_entity_relationships ADD CONSTRAINT fk_legal_entity_relationships_child_entity_id FOREIGN KEY (tenant_id, child_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE jurisdictions ADD CONSTRAINT fk_jurisdictions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE jurisdictions ADD CONSTRAINT fk_jurisdictions_parent_jurisdiction_id FOREIGN KEY (tenant_id, parent_jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE jurisdictions ADD CONSTRAINT fk_jurisdictions_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_registrations ADD CONSTRAINT fk_entity_registrations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_registrations ADD CONSTRAINT fk_entity_registrations_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_registrations ADD CONSTRAINT fk_entity_registrations_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_addresses ADD CONSTRAINT fk_entity_addresses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_addresses ADD CONSTRAINT fk_entity_addresses_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_addresses ADD CONSTRAINT fk_entity_addresses_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_bank_accounts ADD CONSTRAINT fk_entity_bank_accounts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_bank_accounts ADD CONSTRAINT fk_entity_bank_accounts_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE entity_bank_accounts ADD CONSTRAINT fk_entity_bank_accounts_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE access_scopes ADD CONSTRAINT fk_access_scopes_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE access_scopes ADD CONSTRAINT fk_access_scopes_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE access_scopes ADD CONSTRAINT fk_access_scopes_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE access_scopes ADD CONSTRAINT fk_access_scopes_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE role_scope_assignments ADD CONSTRAINT fk_role_scope_assignments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE role_scope_assignments ADD CONSTRAINT fk_role_scope_assignments_user_role_id FOREIGN KEY (tenant_id, user_role_id) REFERENCES user_roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE role_scope_assignments ADD CONSTRAINT fk_role_scope_assignments_access_scope_id FOREIGN KEY (tenant_id, access_scope_id) REFERENCES access_scopes (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE delegations ADD CONSTRAINT fk_delegations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE delegations ADD CONSTRAINT fk_delegations_delegator_id FOREIGN KEY (tenant_id, delegator_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE delegations ADD CONSTRAINT fk_delegations_delegate_id FOREIGN KEY (tenant_id, delegate_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE delegations ADD CONSTRAINT fk_delegations_role_id FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE service_accounts ADD CONSTRAINT fk_service_accounts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE service_accounts ADD CONSTRAINT fk_service_accounts_owner_user_id FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE service_accounts ADD CONSTRAINT fk_service_accounts_role_id FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE identity_provider_configs ADD CONSTRAINT fk_identity_provider_configs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE identity_provider_configs ADD CONSTRAINT fk_identity_provider_configs_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE identity_provider_configs ADD CONSTRAINT fk_identity_provider_configs_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE persons ADD CONSTRAINT fk_persons_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_contacts ADD CONSTRAINT fk_person_contacts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_contacts ADD CONSTRAINT fk_person_contacts_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_addresses ADD CONSTRAINT fk_person_addresses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_addresses ADD CONSTRAINT fk_person_addresses_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_addresses ADD CONSTRAINT fk_person_addresses_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_identifiers ADD CONSTRAINT fk_person_identifiers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_identifiers ADD CONSTRAINT fk_person_identifiers_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_identifiers ADD CONSTRAINT fk_person_identifiers_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE emergency_contacts ADD CONSTRAINT fk_emergency_contacts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE emergency_contacts ADD CONSTRAINT fk_emergency_contacts_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_dependents ADD CONSTRAINT fk_person_dependents_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE person_dependents ADD CONSTRAINT fk_person_dependents_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employees ADD CONSTRAINT fk_employees_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employees ADD CONSTRAINT fk_employees_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employees ADD CONSTRAINT fk_employees_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_contracts ADD CONSTRAINT fk_employment_contracts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_contracts ADD CONSTRAINT fk_employment_contracts_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_contracts ADD CONSTRAINT fk_employment_contracts_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_contracts ADD CONSTRAINT fk_employment_contracts_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_assignments ADD CONSTRAINT fk_employment_assignments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_assignments ADD CONSTRAINT fk_employment_assignments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_assignments ADD CONSTRAINT fk_employment_assignments_position_id FOREIGN KEY (tenant_id, position_id) REFERENCES positions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_assignments ADD CONSTRAINT fk_employment_assignments_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_assignments ADD CONSTRAINT fk_employment_assignments_cost_center_id FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_status_history ADD CONSTRAINT fk_employment_status_history_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_status_history ADD CONSTRAINT fk_employment_status_history_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employment_status_history ADD CONSTRAINT fk_employment_status_history_changed_by FOREIGN KEY (tenant_id, changed_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE organization_units ADD CONSTRAINT fk_organization_units_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE organization_units ADD CONSTRAINT fk_organization_units_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE organization_units ADD CONSTRAINT fk_organization_units_parent_unit_id FOREIGN KEY (tenant_id, parent_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE organization_units ADD CONSTRAINT fk_organization_units_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE organization_unit_history ADD CONSTRAINT fk_organization_unit_history_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE organization_unit_history ADD CONSTRAINT fk_organization_unit_history_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE organization_unit_history ADD CONSTRAINT fk_organization_unit_history_parent_unit_id FOREIGN KEY (tenant_id, parent_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE departments ADD CONSTRAINT fk_departments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE departments ADD CONSTRAINT fk_departments_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE departments ADD CONSTRAINT fk_departments_head_employee_id FOREIGN KEY (tenant_id, head_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE departments ADD CONSTRAINT fk_departments_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE teams ADD CONSTRAINT fk_teams_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE teams ADD CONSTRAINT fk_teams_department_id FOREIGN KEY (tenant_id, department_id) REFERENCES departments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE teams ADD CONSTRAINT fk_teams_manager_employee_id FOREIGN KEY (tenant_id, manager_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE teams ADD CONSTRAINT fk_teams_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE team_memberships ADD CONSTRAINT fk_team_memberships_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE team_memberships ADD CONSTRAINT fk_team_memberships_team_id FOREIGN KEY (tenant_id, team_id) REFERENCES teams (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE team_memberships ADD CONSTRAINT fk_team_memberships_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE positions ADD CONSTRAINT fk_positions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE positions ADD CONSTRAINT fk_positions_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE positions ADD CONSTRAINT fk_positions_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE positions ADD CONSTRAINT fk_positions_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES grades (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE positions ADD CONSTRAINT fk_positions_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE position_relationships ADD CONSTRAINT fk_position_relationships_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE position_relationships ADD CONSTRAINT fk_position_relationships_position_id FOREIGN KEY (tenant_id, position_id) REFERENCES positions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE position_relationships ADD CONSTRAINT fk_position_relationships_related_position_id FOREIGN KEY (tenant_id, related_position_id) REFERENCES positions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_families ADD CONSTRAINT fk_job_families_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_families ADD CONSTRAINT fk_job_families_parent_family_id FOREIGN KEY (tenant_id, parent_family_id) REFERENCES job_families (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_families ADD CONSTRAINT fk_job_families_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_profiles ADD CONSTRAINT fk_job_profiles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_profiles ADD CONSTRAINT fk_job_profiles_job_family_id FOREIGN KEY (tenant_id, job_family_id) REFERENCES job_families (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_profiles ADD CONSTRAINT fk_job_profiles_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_levels ADD CONSTRAINT fk_job_levels_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_levels ADD CONSTRAINT fk_job_levels_job_family_id FOREIGN KEY (tenant_id, job_family_id) REFERENCES job_families (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_levels ADD CONSTRAINT fk_job_levels_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grades ADD CONSTRAINT fk_grades_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grades ADD CONSTRAINT fk_grades_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grades ADD CONSTRAINT fk_grades_job_level_id FOREIGN KEY (tenant_id, job_level_id) REFERENCES job_levels (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grades ADD CONSTRAINT fk_grades_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE locations ADD CONSTRAINT fk_locations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE locations ADD CONSTRAINT fk_locations_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE locations ADD CONSTRAINT fk_locations_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE locations ADD CONSTRAINT fk_locations_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE location_addresses ADD CONSTRAINT fk_location_addresses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE location_addresses ADD CONSTRAINT fk_location_addresses_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE location_addresses ADD CONSTRAINT fk_location_addresses_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE cost_centers ADD CONSTRAINT fk_cost_centers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE cost_centers ADD CONSTRAINT fk_cost_centers_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE cost_centers ADD CONSTRAINT fk_cost_centers_parent_cost_center_id FOREIGN KEY (tenant_id, parent_cost_center_id) REFERENCES cost_centers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE cost_centers ADD CONSTRAINT fk_cost_centers_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reporting_relationships ADD CONSTRAINT fk_reporting_relationships_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reporting_relationships ADD CONSTRAINT fk_reporting_relationships_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reporting_relationships ADD CONSTRAINT fk_reporting_relationships_manager_employee_id FOREIGN KEY (tenant_id, manager_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_contacts ADD CONSTRAINT fk_employee_contacts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_contacts ADD CONSTRAINT fk_employee_contacts_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_bank_accounts ADD CONSTRAINT fk_employee_bank_accounts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_bank_accounts ADD CONSTRAINT fk_employee_bank_accounts_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_bank_accounts ADD CONSTRAINT fk_employee_bank_accounts_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_qualifications ADD CONSTRAINT fk_employee_qualifications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_qualifications ADD CONSTRAINT fk_employee_qualifications_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_qualifications ADD CONSTRAINT fk_employee_qualifications_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_work_experience ADD CONSTRAINT fk_employee_work_experience_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_work_experience ADD CONSTRAINT fk_employee_work_experience_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_types ADD CONSTRAINT fk_document_types_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_types ADD CONSTRAINT fk_document_types_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_types ADD CONSTRAINT fk_document_types_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE documents ADD CONSTRAINT fk_documents_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE documents ADD CONSTRAINT fk_documents_document_type_id FOREIGN KEY (tenant_id, document_type_id) REFERENCES document_types (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE documents ADD CONSTRAINT fk_documents_owner_person_id FOREIGN KEY (tenant_id, owner_person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE documents ADD CONSTRAINT fk_documents_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_versions ADD CONSTRAINT fk_document_versions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_versions ADD CONSTRAINT fk_document_versions_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_versions ADD CONSTRAINT fk_document_versions_uploaded_by FOREIGN KEY (tenant_id, uploaded_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_links ADD CONSTRAINT fk_document_links_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_links ADD CONSTRAINT fk_document_links_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_links ADD CONSTRAINT fk_document_links_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_access_grants ADD CONSTRAINT fk_document_access_grants_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_access_grants ADD CONSTRAINT fk_document_access_grants_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_access_grants ADD CONSTRAINT fk_document_access_grants_user_id FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_access_grants ADD CONSTRAINT fk_document_access_grants_role_id FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_signatures ADD CONSTRAINT fk_document_signatures_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_signatures ADD CONSTRAINT fk_document_signatures_document_version_id FOREIGN KEY (tenant_id, document_version_id) REFERENCES document_versions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE document_signatures ADD CONSTRAINT fk_document_signatures_signer_person_id FOREIGN KEY (tenant_id, signer_person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_custom_field_definitions ADD CONSTRAINT fk_employee_custom_field_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_custom_field_definitions ADD CONSTRAINT fk_employee_custom_field_definitions_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_custom_field_definitions ADD CONSTRAINT fk_employee_custom_field_definitions_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_custom_field_values ADD CONSTRAINT fk_employee_custom_field_values_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_custom_field_values ADD CONSTRAINT fk_employee_custom_field_values_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_custom_field_values ADD CONSTRAINT fk_employee_custom_field_values_field_definition_id FOREIGN KEY (tenant_id, field_definition_id) REFERENCES employee_custom_field_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_definitions ADD CONSTRAINT fk_workflow_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_definitions ADD CONSTRAINT fk_workflow_definitions_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_definitions ADD CONSTRAINT fk_workflow_definitions_owner_role_id FOREIGN KEY (tenant_id, owner_role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_definitions ADD CONSTRAINT fk_workflow_definitions_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_steps ADD CONSTRAINT fk_workflow_steps_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_steps ADD CONSTRAINT fk_workflow_steps_workflow_definition_id FOREIGN KEY (tenant_id, workflow_definition_id) REFERENCES workflow_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_steps ADD CONSTRAINT fk_workflow_steps_approver_role_id FOREIGN KEY (tenant_id, approver_role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_steps ADD CONSTRAINT fk_workflow_steps_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_transitions ADD CONSTRAINT fk_workflow_transitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_transitions ADD CONSTRAINT fk_workflow_transitions_from_step_id FOREIGN KEY (tenant_id, from_step_id) REFERENCES workflow_steps (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_transitions ADD CONSTRAINT fk_workflow_transitions_to_step_id FOREIGN KEY (tenant_id, to_step_id) REFERENCES workflow_steps (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_instances ADD CONSTRAINT fk_workflow_instances_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_instances ADD CONSTRAINT fk_workflow_instances_workflow_definition_id FOREIGN KEY (tenant_id, workflow_definition_id) REFERENCES workflow_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_instances ADD CONSTRAINT fk_workflow_instances_requested_by FOREIGN KEY (tenant_id, requested_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_step_instances ADD CONSTRAINT fk_workflow_step_instances_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_step_instances ADD CONSTRAINT fk_workflow_step_instances_workflow_instance_id FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_step_instances ADD CONSTRAINT fk_workflow_step_instances_workflow_step_id FOREIGN KEY (tenant_id, workflow_step_id) REFERENCES workflow_steps (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workflow_step_instances ADD CONSTRAINT fk_workflow_step_instances_assigned_to FOREIGN KEY (tenant_id, assigned_to) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE approval_requests ADD CONSTRAINT fk_approval_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE approval_requests ADD CONSTRAINT fk_approval_requests_workflow_step_instance_id FOREIGN KEY (tenant_id, workflow_step_instance_id) REFERENCES workflow_step_instances (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE approval_requests ADD CONSTRAINT fk_approval_requests_requester_id FOREIGN KEY (tenant_id, requester_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE approval_decisions ADD CONSTRAINT fk_approval_decisions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE approval_decisions ADD CONSTRAINT fk_approval_decisions_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE approval_decisions ADD CONSTRAINT fk_approval_decisions_decided_by FOREIGN KEY (tenant_id, decided_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE approval_decisions ADD CONSTRAINT fk_approval_decisions_delegation_id FOREIGN KEY (tenant_id, delegation_id) REFERENCES delegations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_items ADD CONSTRAINT fk_work_items_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_items ADD CONSTRAINT fk_work_items_workflow_instance_id FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_items ADD CONSTRAINT fk_work_items_assigned_to FOREIGN KEY (tenant_id, assigned_to) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_items ADD CONSTRAINT fk_work_items_assigned_role_id FOREIGN KEY (tenant_id, assigned_role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE inbox_entries ADD CONSTRAINT fk_inbox_entries_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE inbox_entries ADD CONSTRAINT fk_inbox_entries_user_id FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE inbox_entries ADD CONSTRAINT fk_inbox_entries_work_item_id FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notification_templates ADD CONSTRAINT fk_notification_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notification_templates ADD CONSTRAINT fk_notification_templates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notifications ADD CONSTRAINT fk_notifications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notifications ADD CONSTRAINT fk_notifications_template_id FOREIGN KEY (tenant_id, template_id) REFERENCES notification_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notifications ADD CONSTRAINT fk_notifications_recipient_user_id FOREIGN KEY (tenant_id, recipient_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notifications ADD CONSTRAINT fk_notifications_workflow_instance_id FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notification_deliveries ADD CONSTRAINT fk_notification_deliveries_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notification_deliveries ADD CONSTRAINT fk_notification_deliveries_notification_id FOREIGN KEY (tenant_id, notification_id) REFERENCES notifications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notification_preferences ADD CONSTRAINT fk_notification_preferences_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notification_preferences ADD CONSTRAINT fk_notification_preferences_user_id FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE notification_preferences ADD CONSTRAINT fk_notification_preferences_template_id FOREIGN KEY (tenant_id, template_id) REFERENCES notification_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_calendars ADD CONSTRAINT fk_work_calendars_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_calendars ADD CONSTRAINT fk_work_calendars_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_calendars ADD CONSTRAINT fk_work_calendars_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE work_calendars ADD CONSTRAINT fk_work_calendars_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calendar_days ADD CONSTRAINT fk_calendar_days_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calendar_days ADD CONSTRAINT fk_calendar_days_work_calendar_id FOREIGN KEY (tenant_id, work_calendar_id) REFERENCES work_calendars (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE holidays ADD CONSTRAINT fk_holidays_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE holidays ADD CONSTRAINT fk_holidays_work_calendar_id FOREIGN KEY (tenant_id, work_calendar_id) REFERENCES work_calendars (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE holidays ADD CONSTRAINT fk_holidays_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_templates ADD CONSTRAINT fk_shift_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_templates ADD CONSTRAINT fk_shift_templates_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_templates ADD CONSTRAINT fk_shift_templates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_breaks ADD CONSTRAINT fk_shift_breaks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_breaks ADD CONSTRAINT fk_shift_breaks_shift_template_id FOREIGN KEY (tenant_id, shift_template_id) REFERENCES shift_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_rosters ADD CONSTRAINT fk_shift_rosters_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_rosters ADD CONSTRAINT fk_shift_rosters_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_rosters ADD CONSTRAINT fk_shift_rosters_work_calendar_id FOREIGN KEY (tenant_id, work_calendar_id) REFERENCES work_calendars (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_assignments ADD CONSTRAINT fk_shift_assignments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_assignments ADD CONSTRAINT fk_shift_assignments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_assignments ADD CONSTRAINT fk_shift_assignments_shift_roster_id FOREIGN KEY (tenant_id, shift_roster_id) REFERENCES shift_rosters (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_assignments ADD CONSTRAINT fk_shift_assignments_shift_template_id FOREIGN KEY (tenant_id, shift_template_id) REFERENCES shift_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_assignments ADD CONSTRAINT fk_shift_assignments_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_swaps ADD CONSTRAINT fk_shift_swaps_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_swaps ADD CONSTRAINT fk_shift_swaps_requested_by FOREIGN KEY (tenant_id, requested_by) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_swaps ADD CONSTRAINT fk_shift_swaps_original_assignment_id FOREIGN KEY (tenant_id, original_assignment_id) REFERENCES shift_assignments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_swaps ADD CONSTRAINT fk_shift_swaps_replacement_assignment_id FOREIGN KEY (tenant_id, replacement_assignment_id) REFERENCES shift_assignments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE shift_swaps ADD CONSTRAINT fk_shift_swaps_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_devices ADD CONSTRAINT fk_attendance_devices_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_devices ADD CONSTRAINT fk_attendance_devices_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_events ADD CONSTRAINT fk_attendance_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_events ADD CONSTRAINT fk_attendance_events_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_events ADD CONSTRAINT fk_attendance_events_device_id FOREIGN KEY (tenant_id, device_id) REFERENCES attendance_devices (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_events ADD CONSTRAINT fk_attendance_events_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_days ADD CONSTRAINT fk_attendance_days_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_days ADD CONSTRAINT fk_attendance_days_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_days ADD CONSTRAINT fk_attendance_days_shift_assignment_id FOREIGN KEY (tenant_id, shift_assignment_id) REFERENCES shift_assignments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_segments ADD CONSTRAINT fk_attendance_segments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_segments ADD CONSTRAINT fk_attendance_segments_attendance_day_id FOREIGN KEY (tenant_id, attendance_day_id) REFERENCES attendance_days (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_segments ADD CONSTRAINT fk_attendance_segments_start_event_id FOREIGN KEY (tenant_id, start_event_id) REFERENCES attendance_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_segments ADD CONSTRAINT fk_attendance_segments_end_event_id FOREIGN KEY (tenant_id, end_event_id) REFERENCES attendance_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_exceptions ADD CONSTRAINT fk_attendance_exceptions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_exceptions ADD CONSTRAINT fk_attendance_exceptions_attendance_day_id FOREIGN KEY (tenant_id, attendance_day_id) REFERENCES attendance_days (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_exceptions ADD CONSTRAINT fk_attendance_exceptions_work_item_id FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_regularizations ADD CONSTRAINT fk_attendance_regularizations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_regularizations ADD CONSTRAINT fk_attendance_regularizations_attendance_day_id FOREIGN KEY (tenant_id, attendance_day_id) REFERENCES attendance_days (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_regularizations ADD CONSTRAINT fk_attendance_regularizations_requested_by FOREIGN KEY (tenant_id, requested_by) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE attendance_regularizations ADD CONSTRAINT fk_attendance_regularizations_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE time_policies ADD CONSTRAINT fk_time_policies_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE time_policies ADD CONSTRAINT fk_time_policies_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE time_policies ADD CONSTRAINT fk_time_policies_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_time_policies ADD CONSTRAINT fk_employee_time_policies_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_time_policies ADD CONSTRAINT fk_employee_time_policies_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_time_policies ADD CONSTRAINT fk_employee_time_policies_time_policy_id FOREIGN KEY (tenant_id, time_policy_id) REFERENCES time_policies (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_types ADD CONSTRAINT fk_leave_types_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_types ADD CONSTRAINT fk_leave_types_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_types ADD CONSTRAINT fk_leave_types_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_policies ADD CONSTRAINT fk_leave_policies_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_policies ADD CONSTRAINT fk_leave_policies_leave_type_id FOREIGN KEY (tenant_id, leave_type_id) REFERENCES leave_types (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_policies ADD CONSTRAINT fk_leave_policies_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_policies ADD CONSTRAINT fk_leave_policies_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_policy_assignments ADD CONSTRAINT fk_leave_policy_assignments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_policy_assignments ADD CONSTRAINT fk_leave_policy_assignments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_policy_assignments ADD CONSTRAINT fk_leave_policy_assignments_leave_policy_id FOREIGN KEY (tenant_id, leave_policy_id) REFERENCES leave_policies (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_balances ADD CONSTRAINT fk_leave_balances_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_balances ADD CONSTRAINT fk_leave_balances_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_balances ADD CONSTRAINT fk_leave_balances_leave_policy_id FOREIGN KEY (tenant_id, leave_policy_id) REFERENCES leave_policies (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_transactions ADD CONSTRAINT fk_leave_transactions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_transactions ADD CONSTRAINT fk_leave_transactions_leave_balance_id FOREIGN KEY (tenant_id, leave_balance_id) REFERENCES leave_balances (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_transactions ADD CONSTRAINT fk_leave_transactions_leave_request_id FOREIGN KEY (tenant_id, leave_request_id) REFERENCES leave_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_leave_type_id FOREIGN KEY (tenant_id, leave_type_id) REFERENCES leave_types (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_request_days ADD CONSTRAINT fk_leave_request_days_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_request_days ADD CONSTRAINT fk_leave_request_days_leave_request_id FOREIGN KEY (tenant_id, leave_request_id) REFERENCES leave_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE leave_request_days ADD CONSTRAINT fk_leave_request_days_attendance_day_id FOREIGN KEY (tenant_id, attendance_day_id) REFERENCES attendance_days (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_policies ADD CONSTRAINT fk_overtime_policies_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_policies ADD CONSTRAINT fk_overtime_policies_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_policies ADD CONSTRAINT fk_overtime_policies_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_requests ADD CONSTRAINT fk_overtime_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_requests ADD CONSTRAINT fk_overtime_requests_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_requests ADD CONSTRAINT fk_overtime_requests_overtime_policy_id FOREIGN KEY (tenant_id, overtime_policy_id) REFERENCES overtime_policies (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_requests ADD CONSTRAINT fk_overtime_requests_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_entries ADD CONSTRAINT fk_overtime_entries_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_entries ADD CONSTRAINT fk_overtime_entries_overtime_request_id FOREIGN KEY (tenant_id, overtime_request_id) REFERENCES overtime_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE overtime_entries ADD CONSTRAINT fk_overtime_entries_attendance_day_id FOREIGN KEY (tenant_id, attendance_day_id) REFERENCES attendance_days (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gate_pass_requests ADD CONSTRAINT fk_gate_pass_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gate_pass_requests ADD CONSTRAINT fk_gate_pass_requests_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gate_pass_requests ADD CONSTRAINT fk_gate_pass_requests_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gate_pass_requests ADD CONSTRAINT fk_gate_pass_requests_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gate_pass_events ADD CONSTRAINT fk_gate_pass_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gate_pass_events ADD CONSTRAINT fk_gate_pass_events_gate_pass_request_id FOREIGN KEY (tenant_id, gate_pass_request_id) REFERENCES gate_pass_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gate_pass_events ADD CONSTRAINT fk_gate_pass_events_device_id FOREIGN KEY (tenant_id, device_id) REFERENCES attendance_devices (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE time_period_locks ADD CONSTRAINT fk_time_period_locks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE time_period_locks ADD CONSTRAINT fk_time_period_locks_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE time_period_locks ADD CONSTRAINT fk_time_period_locks_locked_by FOREIGN KEY (tenant_id, locked_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_groups ADD CONSTRAINT fk_pay_groups_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_groups ADD CONSTRAINT fk_pay_groups_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_groups ADD CONSTRAINT fk_pay_groups_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_periods ADD CONSTRAINT fk_pay_periods_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_periods ADD CONSTRAINT fk_pay_periods_pay_group_id FOREIGN KEY (tenant_id, pay_group_id) REFERENCES pay_groups (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_pay_group_assignments ADD CONSTRAINT fk_employee_pay_group_assignments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_pay_group_assignments ADD CONSTRAINT fk_employee_pay_group_assignments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_pay_group_assignments ADD CONSTRAINT fk_employee_pay_group_assignments_pay_group_id FOREIGN KEY (tenant_id, pay_group_id) REFERENCES pay_groups (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_runs ADD CONSTRAINT fk_payroll_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_runs ADD CONSTRAINT fk_payroll_runs_pay_period_id FOREIGN KEY (tenant_id, pay_period_id) REFERENCES pay_periods (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_runs ADD CONSTRAINT fk_payroll_runs_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_run_employees ADD CONSTRAINT fk_payroll_run_employees_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_run_employees ADD CONSTRAINT fk_payroll_run_employees_payroll_run_id FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES payroll_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_run_employees ADD CONSTRAINT fk_payroll_run_employees_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_components ADD CONSTRAINT fk_pay_components_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_components ADD CONSTRAINT fk_pay_components_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_components ADD CONSTRAINT fk_pay_components_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_component_rules ADD CONSTRAINT fk_pay_component_rules_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_component_rules ADD CONSTRAINT fk_pay_component_rules_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_component_rules ADD CONSTRAINT fk_pay_component_rules_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_pay_components ADD CONSTRAINT fk_employee_pay_components_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_pay_components ADD CONSTRAINT fk_employee_pay_components_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_pay_components ADD CONSTRAINT fk_employee_pay_components_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_inputs ADD CONSTRAINT fk_payroll_inputs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_inputs ADD CONSTRAINT fk_payroll_inputs_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_inputs ADD CONSTRAINT fk_payroll_inputs_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_attendance_inputs ADD CONSTRAINT fk_payroll_attendance_inputs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_attendance_inputs ADD CONSTRAINT fk_payroll_attendance_inputs_payroll_input_id FOREIGN KEY (tenant_id, payroll_input_id) REFERENCES payroll_inputs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_attendance_inputs ADD CONSTRAINT fk_payroll_attendance_inputs_attendance_day_id FOREIGN KEY (tenant_id, attendance_day_id) REFERENCES attendance_days (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_overtime_inputs ADD CONSTRAINT fk_payroll_overtime_inputs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_overtime_inputs ADD CONSTRAINT fk_payroll_overtime_inputs_payroll_input_id FOREIGN KEY (tenant_id, payroll_input_id) REFERENCES payroll_inputs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_overtime_inputs ADD CONSTRAINT fk_payroll_overtime_inputs_overtime_entry_id FOREIGN KEY (tenant_id, overtime_entry_id) REFERENCES overtime_entries (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_leave_inputs ADD CONSTRAINT fk_payroll_leave_inputs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_leave_inputs ADD CONSTRAINT fk_payroll_leave_inputs_payroll_input_id FOREIGN KEY (tenant_id, payroll_input_id) REFERENCES payroll_inputs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_leave_inputs ADD CONSTRAINT fk_payroll_leave_inputs_leave_request_day_id FOREIGN KEY (tenant_id, leave_request_day_id) REFERENCES leave_request_days (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_results ADD CONSTRAINT fk_payroll_results_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_results ADD CONSTRAINT fk_payroll_results_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_results ADD CONSTRAINT fk_payroll_results_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_adjustments ADD CONSTRAINT fk_payroll_adjustments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_adjustments ADD CONSTRAINT fk_payroll_adjustments_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_adjustments ADD CONSTRAINT fk_payroll_adjustments_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_adjustments ADD CONSTRAINT fk_payroll_adjustments_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_arrears ADD CONSTRAINT fk_payroll_arrears_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_arrears ADD CONSTRAINT fk_payroll_arrears_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_arrears ADD CONSTRAINT fk_payroll_arrears_original_result_id FOREIGN KEY (tenant_id, original_result_id) REFERENCES payroll_results (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_arrears ADD CONSTRAINT fk_payroll_arrears_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payslips ADD CONSTRAINT fk_payslips_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payslips ADD CONSTRAINT fk_payslips_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payslips ADD CONSTRAINT fk_payslips_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_types ADD CONSTRAINT fk_loan_types_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_types ADD CONSTRAINT fk_loan_types_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_types ADD CONSTRAINT fk_loan_types_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_loans ADD CONSTRAINT fk_employee_loans_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_loans ADD CONSTRAINT fk_employee_loans_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_loans ADD CONSTRAINT fk_employee_loans_loan_type_id FOREIGN KEY (tenant_id, loan_type_id) REFERENCES loan_types (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_loans ADD CONSTRAINT fk_employee_loans_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_installments ADD CONSTRAINT fk_loan_installments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_installments ADD CONSTRAINT fk_loan_installments_employee_loan_id FOREIGN KEY (tenant_id, employee_loan_id) REFERENCES employee_loans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_repayments ADD CONSTRAINT fk_loan_repayments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_repayments ADD CONSTRAINT fk_loan_repayments_loan_installment_id FOREIGN KEY (tenant_id, loan_installment_id) REFERENCES loan_installments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE loan_repayments ADD CONSTRAINT fk_loan_repayments_payroll_result_id FOREIGN KEY (tenant_id, payroll_result_id) REFERENCES payroll_results (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_advances ADD CONSTRAINT fk_salary_advances_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_advances ADD CONSTRAINT fk_salary_advances_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_advances ADD CONSTRAINT fk_salary_advances_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_advances ADD CONSTRAINT fk_salary_advances_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_schemes ADD CONSTRAINT fk_statutory_schemes_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_schemes ADD CONSTRAINT fk_statutory_schemes_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_schemes ADD CONSTRAINT fk_statutory_schemes_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_rates ADD CONSTRAINT fk_statutory_rates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_rates ADD CONSTRAINT fk_statutory_rates_statutory_scheme_id FOREIGN KEY (tenant_id, statutory_scheme_id) REFERENCES statutory_schemes (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_rates ADD CONSTRAINT fk_statutory_rates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_statutory_enrollments ADD CONSTRAINT fk_employee_statutory_enrollments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_statutory_enrollments ADD CONSTRAINT fk_employee_statutory_enrollments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_statutory_enrollments ADD CONSTRAINT fk_employee_statutory_enrollments_statutory_scheme_id FOREIGN KEY (tenant_id, statutory_scheme_id) REFERENCES statutory_schemes (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_contributions ADD CONSTRAINT fk_statutory_contributions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_contributions ADD CONSTRAINT fk_statutory_contributions_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_contributions ADD CONSTRAINT fk_statutory_contributions_enrollment_id FOREIGN KEY (tenant_id, enrollment_id) REFERENCES employee_statutory_enrollments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_contributions ADD CONSTRAINT fk_statutory_contributions_statutory_rate_id FOREIGN KEY (tenant_id, statutory_rate_id) REFERENCES statutory_rates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_declarations ADD CONSTRAINT fk_tax_declarations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_declarations ADD CONSTRAINT fk_tax_declarations_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_declarations ADD CONSTRAINT fk_tax_declarations_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_declaration_items ADD CONSTRAINT fk_tax_declaration_items_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_declaration_items ADD CONSTRAINT fk_tax_declaration_items_tax_declaration_id FOREIGN KEY (tenant_id, tax_declaration_id) REFERENCES tax_declarations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_declaration_items ADD CONSTRAINT fk_tax_declaration_items_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_withholdings ADD CONSTRAINT fk_tax_withholdings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_withholdings ADD CONSTRAINT fk_tax_withholdings_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_withholdings ADD CONSTRAINT fk_tax_withholdings_tax_declaration_id FOREIGN KEY (tenant_id, tax_declaration_id) REFERENCES tax_declarations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE tax_withholdings ADD CONSTRAINT fk_tax_withholdings_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_filings ADD CONSTRAINT fk_statutory_filings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_filings ADD CONSTRAINT fk_statutory_filings_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_filings ADD CONSTRAINT fk_statutory_filings_statutory_scheme_id FOREIGN KEY (tenant_id, statutory_scheme_id) REFERENCES statutory_schemes (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_filings ADD CONSTRAINT fk_statutory_filings_evidence_id FOREIGN KEY (tenant_id, evidence_id) REFERENCES compliance_evidence (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_form_serials ADD CONSTRAINT fk_statutory_form_serials_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_form_serials ADD CONSTRAINT fk_statutory_form_serials_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_form_serials ADD CONSTRAINT fk_statutory_form_serials_issued_by_membership_id FOREIGN KEY (tenant_id, issued_by_membership_id) REFERENCES memberships (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_filing_lines ADD CONSTRAINT fk_statutory_filing_lines_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_filing_lines ADD CONSTRAINT fk_statutory_filing_lines_statutory_filing_id FOREIGN KEY (tenant_id, statutory_filing_id) REFERENCES statutory_filings (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE statutory_filing_lines ADD CONSTRAINT fk_statutory_filing_lines_statutory_contribution_id FOREIGN KEY (tenant_id, statutory_contribution_id) REFERENCES statutory_contributions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gl_accounts ADD CONSTRAINT fk_gl_accounts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gl_accounts ADD CONSTRAINT fk_gl_accounts_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gl_accounts ADD CONSTRAINT fk_gl_accounts_parent_account_id FOREIGN KEY (tenant_id, parent_account_id) REFERENCES gl_accounts (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE gl_accounts ADD CONSTRAINT fk_gl_accounts_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_component_gl_mappings ADD CONSTRAINT fk_pay_component_gl_mappings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_component_gl_mappings ADD CONSTRAINT fk_pay_component_gl_mappings_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_component_gl_mappings ADD CONSTRAINT fk_pay_component_gl_mappings_gl_account_id FOREIGN KEY (tenant_id, gl_account_id) REFERENCES gl_accounts (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pay_component_gl_mappings ADD CONSTRAINT fk_pay_component_gl_mappings_cost_center_id FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journals ADD CONSTRAINT fk_payroll_journals_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journals ADD CONSTRAINT fk_payroll_journals_payroll_run_id FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES payroll_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journals ADD CONSTRAINT fk_payroll_journals_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journal_lines ADD CONSTRAINT fk_payroll_journal_lines_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journal_lines ADD CONSTRAINT fk_payroll_journal_lines_payroll_journal_id FOREIGN KEY (tenant_id, payroll_journal_id) REFERENCES payroll_journals (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journal_lines ADD CONSTRAINT fk_payroll_journal_lines_gl_account_id FOREIGN KEY (tenant_id, gl_account_id) REFERENCES gl_accounts (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journal_lines ADD CONSTRAINT fk_payroll_journal_lines_cost_center_id FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_journal_lines ADD CONSTRAINT fk_payroll_journal_lines_payroll_result_id FOREIGN KEY (tenant_id, payroll_result_id) REFERENCES payroll_results (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_batches ADD CONSTRAINT fk_disbursement_batches_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_batches ADD CONSTRAINT fk_disbursement_batches_payroll_run_id FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES payroll_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_batches ADD CONSTRAINT fk_disbursement_batches_entity_bank_account_id FOREIGN KEY (tenant_id, entity_bank_account_id) REFERENCES entity_bank_accounts (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_batches ADD CONSTRAINT fk_disbursement_batches_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_items ADD CONSTRAINT fk_disbursement_items_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_items ADD CONSTRAINT fk_disbursement_items_disbursement_batch_id FOREIGN KEY (tenant_id, disbursement_batch_id) REFERENCES disbursement_batches (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_items ADD CONSTRAINT fk_disbursement_items_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE disbursement_items ADD CONSTRAINT fk_disbursement_items_employee_bank_account_id FOREIGN KEY (tenant_id, employee_bank_account_id) REFERENCES employee_bank_accounts (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payment_reconciliations ADD CONSTRAINT fk_payment_reconciliations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payment_reconciliations ADD CONSTRAINT fk_payment_reconciliations_disbursement_item_id FOREIGN KEY (tenant_id, disbursement_item_id) REFERENCES disbursement_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payment_reconciliations ADD CONSTRAINT fk_payment_reconciliations_reconciled_by FOREIGN KEY (tenant_id, reconciled_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_cases ADD CONSTRAINT fk_payroll_cases_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_cases ADD CONSTRAINT fk_payroll_cases_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_cases ADD CONSTRAINT fk_payroll_cases_payroll_run_id FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES payroll_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_cases ADD CONSTRAINT fk_payroll_cases_work_item_id FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE final_settlements ADD CONSTRAINT fk_final_settlements_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE final_settlements ADD CONSTRAINT fk_final_settlements_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE final_settlements ADD CONSTRAINT fk_final_settlements_separation_id FOREIGN KEY (tenant_id, separation_id) REFERENCES separations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE final_settlements ADD CONSTRAINT fk_final_settlements_payroll_run_employee_id FOREIGN KEY (tenant_id, payroll_run_employee_id) REFERENCES payroll_run_employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_exports ADD CONSTRAINT fk_payroll_exports_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_exports ADD CONSTRAINT fk_payroll_exports_payroll_run_id FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES payroll_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_exports ADD CONSTRAINT fk_payroll_exports_integration_job_id FOREIGN KEY (tenant_id, integration_job_id) REFERENCES integration_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_exports ADD CONSTRAINT fk_payroll_exports_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_audit_entries ADD CONSTRAINT fk_payroll_audit_entries_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_audit_entries ADD CONSTRAINT fk_payroll_audit_entries_payroll_run_id FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES payroll_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_audit_entries ADD CONSTRAINT fk_payroll_audit_entries_actor_id FOREIGN KEY (tenant_id, actor_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE payroll_audit_entries ADD CONSTRAINT fk_payroll_audit_entries_audit_event_id FOREIGN KEY (tenant_id, audit_event_id) REFERENCES audit_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE requisition_templates ADD CONSTRAINT fk_requisition_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE requisition_templates ADD CONSTRAINT fk_requisition_templates_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE requisition_templates ADD CONSTRAINT fk_requisition_templates_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE requisition_templates ADD CONSTRAINT fk_requisition_templates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_requisitions ADD CONSTRAINT fk_job_requisitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_requisitions ADD CONSTRAINT fk_job_requisitions_position_id FOREIGN KEY (tenant_id, position_id) REFERENCES positions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_requisitions ADD CONSTRAINT fk_job_requisitions_hiring_manager_id FOREIGN KEY (tenant_id, hiring_manager_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_requisitions ADD CONSTRAINT fk_job_requisitions_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_requisitions ADD CONSTRAINT fk_job_requisitions_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE requisition_approvers ADD CONSTRAINT fk_requisition_approvers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE requisition_approvers ADD CONSTRAINT fk_requisition_approvers_job_requisition_id FOREIGN KEY (tenant_id, job_requisition_id) REFERENCES job_requisitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE requisition_approvers ADD CONSTRAINT fk_requisition_approvers_approver_id FOREIGN KEY (tenant_id, approver_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_postings ADD CONSTRAINT fk_job_postings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_postings ADD CONSTRAINT fk_job_postings_job_requisition_id FOREIGN KEY (tenant_id, job_requisition_id) REFERENCES job_requisitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_postings ADD CONSTRAINT fk_job_postings_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE posting_channels ADD CONSTRAINT fk_posting_channels_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_posting_publications ADD CONSTRAINT fk_job_posting_publications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_posting_publications ADD CONSTRAINT fk_job_posting_publications_job_posting_id FOREIGN KEY (tenant_id, job_posting_id) REFERENCES job_postings (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_posting_publications ADD CONSTRAINT fk_job_posting_publications_posting_channel_id FOREIGN KEY (tenant_id, posting_channel_id) REFERENCES posting_channels (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_sources ADD CONSTRAINT fk_candidate_sources_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidates ADD CONSTRAINT fk_candidates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidates ADD CONSTRAINT fk_candidates_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidates ADD CONSTRAINT fk_candidates_candidate_source_id FOREIGN KEY (tenant_id, candidate_source_id) REFERENCES candidate_sources (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_profiles ADD CONSTRAINT fk_candidate_profiles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_profiles ADD CONSTRAINT fk_candidate_profiles_candidate_id FOREIGN KEY (tenant_id, candidate_id) REFERENCES candidates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_documents ADD CONSTRAINT fk_candidate_documents_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_documents ADD CONSTRAINT fk_candidate_documents_candidate_id FOREIGN KEY (tenant_id, candidate_id) REFERENCES candidates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_documents ADD CONSTRAINT fk_candidate_documents_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_consents ADD CONSTRAINT fk_candidate_consents_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_consents ADD CONSTRAINT fk_candidate_consents_candidate_id FOREIGN KEY (tenant_id, candidate_id) REFERENCES candidates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE applications ADD CONSTRAINT fk_applications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE applications ADD CONSTRAINT fk_applications_candidate_id FOREIGN KEY (tenant_id, candidate_id) REFERENCES candidates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE applications ADD CONSTRAINT fk_applications_job_requisition_id FOREIGN KEY (tenant_id, job_requisition_id) REFERENCES job_requisitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE applications ADD CONSTRAINT fk_applications_job_posting_id FOREIGN KEY (tenant_id, job_posting_id) REFERENCES job_postings (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE application_stage_definitions ADD CONSTRAINT fk_application_stage_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE application_stage_definitions ADD CONSTRAINT fk_application_stage_definitions_requisition_template_id FOREIGN KEY (tenant_id, requisition_template_id) REFERENCES requisition_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE application_stage_history ADD CONSTRAINT fk_application_stage_history_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE application_stage_history ADD CONSTRAINT fk_application_stage_history_application_id FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE application_stage_history ADD CONSTRAINT fk_application_stage_history_stage_id FOREIGN KEY (tenant_id, stage_id) REFERENCES application_stage_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE application_stage_history ADD CONSTRAINT fk_application_stage_history_changed_by FOREIGN KEY (tenant_id, changed_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE screening_questions ADD CONSTRAINT fk_screening_questions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE screening_questions ADD CONSTRAINT fk_screening_questions_job_requisition_id FOREIGN KEY (tenant_id, job_requisition_id) REFERENCES job_requisitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE screening_answers ADD CONSTRAINT fk_screening_answers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE screening_answers ADD CONSTRAINT fk_screening_answers_application_id FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE screening_answers ADD CONSTRAINT fk_screening_answers_screening_question_id FOREIGN KEY (tenant_id, screening_question_id) REFERENCES screening_questions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interview_templates ADD CONSTRAINT fk_interview_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interview_templates ADD CONSTRAINT fk_interview_templates_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interviews ADD CONSTRAINT fk_interviews_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interviews ADD CONSTRAINT fk_interviews_application_id FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interviews ADD CONSTRAINT fk_interviews_interview_template_id FOREIGN KEY (tenant_id, interview_template_id) REFERENCES interview_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interview_panelists ADD CONSTRAINT fk_interview_panelists_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interview_panelists ADD CONSTRAINT fk_interview_panelists_interview_id FOREIGN KEY (tenant_id, interview_id) REFERENCES interviews (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interview_panelists ADD CONSTRAINT fk_interview_panelists_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interview_feedback ADD CONSTRAINT fk_interview_feedback_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE interview_feedback ADD CONSTRAINT fk_interview_feedback_interview_panelist_id FOREIGN KEY (tenant_id, interview_panelist_id) REFERENCES interview_panelists (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE assessment_definitions ADD CONSTRAINT fk_assessment_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE assessment_definitions ADD CONSTRAINT fk_assessment_definitions_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_assessments ADD CONSTRAINT fk_candidate_assessments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_assessments ADD CONSTRAINT fk_candidate_assessments_application_id FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_assessments ADD CONSTRAINT fk_candidate_assessments_assessment_definition_id FOREIGN KEY (tenant_id, assessment_definition_id) REFERENCES assessment_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_templates ADD CONSTRAINT fk_offer_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_templates ADD CONSTRAINT fk_offer_templates_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_templates ADD CONSTRAINT fk_offer_templates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offers ADD CONSTRAINT fk_offers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offers ADD CONSTRAINT fk_offers_application_id FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offers ADD CONSTRAINT fk_offers_offer_template_id FOREIGN KEY (tenant_id, offer_template_id) REFERENCES offer_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offers ADD CONSTRAINT fk_offers_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_components ADD CONSTRAINT fk_offer_components_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_components ADD CONSTRAINT fk_offer_components_offer_id FOREIGN KEY (tenant_id, offer_id) REFERENCES offers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_components ADD CONSTRAINT fk_offer_components_pay_component_id FOREIGN KEY (tenant_id, pay_component_id) REFERENCES pay_components (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_acceptances ADD CONSTRAINT fk_offer_acceptances_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_acceptances ADD CONSTRAINT fk_offer_acceptances_offer_id FOREIGN KEY (tenant_id, offer_id) REFERENCES offers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE offer_acceptances ADD CONSTRAINT fk_offer_acceptances_signed_document_id FOREIGN KEY (tenant_id, signed_document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_check_types ADD CONSTRAINT fk_background_check_types_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_check_types ADD CONSTRAINT fk_background_check_types_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_checks ADD CONSTRAINT fk_background_checks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_checks ADD CONSTRAINT fk_background_checks_candidate_id FOREIGN KEY (tenant_id, candidate_id) REFERENCES candidates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_checks ADD CONSTRAINT fk_background_checks_check_type_id FOREIGN KEY (tenant_id, check_type_id) REFERENCES background_check_types (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_checks ADD CONSTRAINT fk_background_checks_evidence_document_id FOREIGN KEY (tenant_id, evidence_document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_templates ADD CONSTRAINT fk_onboarding_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_templates ADD CONSTRAINT fk_onboarding_templates_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_templates ADD CONSTRAINT fk_onboarding_templates_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_templates ADD CONSTRAINT fk_onboarding_templates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_template_tasks ADD CONSTRAINT fk_onboarding_template_tasks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_template_tasks ADD CONSTRAINT fk_onboarding_template_tasks_onboarding_template_id FOREIGN KEY (tenant_id, onboarding_template_id) REFERENCES onboarding_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_template_tasks ADD CONSTRAINT fk_onboarding_template_tasks_owner_role_id FOREIGN KEY (tenant_id, owner_role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_cases ADD CONSTRAINT fk_onboarding_cases_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_cases ADD CONSTRAINT fk_onboarding_cases_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_cases ADD CONSTRAINT fk_onboarding_cases_onboarding_template_id FOREIGN KEY (tenant_id, onboarding_template_id) REFERENCES onboarding_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_cases ADD CONSTRAINT fk_onboarding_cases_offer_id FOREIGN KEY (tenant_id, offer_id) REFERENCES offers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_tasks ADD CONSTRAINT fk_onboarding_tasks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_tasks ADD CONSTRAINT fk_onboarding_tasks_onboarding_case_id FOREIGN KEY (tenant_id, onboarding_case_id) REFERENCES onboarding_cases (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_tasks ADD CONSTRAINT fk_onboarding_tasks_template_task_id FOREIGN KEY (tenant_id, template_task_id) REFERENCES onboarding_template_tasks (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE onboarding_tasks ADD CONSTRAINT fk_onboarding_tasks_work_item_id FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE probation_reviews ADD CONSTRAINT fk_probation_reviews_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE probation_reviews ADD CONSTRAINT fk_probation_reviews_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE probation_reviews ADD CONSTRAINT fk_probation_reviews_reviewer_id FOREIGN KEY (tenant_id, reviewer_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE probation_reviews ADD CONSTRAINT fk_probation_reviews_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_transfers ADD CONSTRAINT fk_employee_transfers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_transfers ADD CONSTRAINT fk_employee_transfers_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_transfers ADD CONSTRAINT fk_employee_transfers_from_assignment_id FOREIGN KEY (tenant_id, from_assignment_id) REFERENCES employment_assignments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_transfers ADD CONSTRAINT fk_employee_transfers_to_assignment_id FOREIGN KEY (tenant_id, to_assignment_id) REFERENCES employment_assignments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_transfers ADD CONSTRAINT fk_employee_transfers_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_promotions ADD CONSTRAINT fk_employee_promotions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_promotions ADD CONSTRAINT fk_employee_promotions_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_promotions ADD CONSTRAINT fk_employee_promotions_from_grade_id FOREIGN KEY (tenant_id, from_grade_id) REFERENCES grades (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_promotions ADD CONSTRAINT fk_employee_promotions_to_grade_id FOREIGN KEY (tenant_id, to_grade_id) REFERENCES grades (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_promotions ADD CONSTRAINT fk_employee_promotions_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE separations ADD CONSTRAINT fk_separations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE separations ADD CONSTRAINT fk_separations_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE separations ADD CONSTRAINT fk_separations_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE exit_interviews ADD CONSTRAINT fk_exit_interviews_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE exit_interviews ADD CONSTRAINT fk_exit_interviews_separation_id FOREIGN KEY (tenant_id, separation_id) REFERENCES separations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE exit_interviews ADD CONSTRAINT fk_exit_interviews_interviewer_id FOREIGN KEY (tenant_id, interviewer_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE clearance_tasks ADD CONSTRAINT fk_clearance_tasks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE clearance_tasks ADD CONSTRAINT fk_clearance_tasks_separation_id FOREIGN KEY (tenant_id, separation_id) REFERENCES separations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE clearance_tasks ADD CONSTRAINT fk_clearance_tasks_owner_employee_id FOREIGN KEY (tenant_id, owner_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE clearance_tasks ADD CONSTRAINT fk_clearance_tasks_work_item_id FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE alumni_profiles ADD CONSTRAINT fk_alumni_profiles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE alumni_profiles ADD CONSTRAINT fk_alumni_profiles_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE alumni_profiles ADD CONSTRAINT fk_alumni_profiles_separation_id FOREIGN KEY (tenant_id, separation_id) REFERENCES separations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE rehire_cases ADD CONSTRAINT fk_rehire_cases_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE rehire_cases ADD CONSTRAINT fk_rehire_cases_alumni_profile_id FOREIGN KEY (tenant_id, alumni_profile_id) REFERENCES alumni_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE rehire_cases ADD CONSTRAINT fk_rehire_cases_job_requisition_id FOREIGN KEY (tenant_id, job_requisition_id) REFERENCES job_requisitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE rehire_cases ADD CONSTRAINT fk_rehire_cases_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_cycles ADD CONSTRAINT fk_performance_cycles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_cycles ADD CONSTRAINT fk_performance_cycles_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_cycles ADD CONSTRAINT fk_performance_cycles_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_templates ADD CONSTRAINT fk_performance_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_templates ADD CONSTRAINT fk_performance_templates_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_templates ADD CONSTRAINT fk_performance_templates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_template_sections ADD CONSTRAINT fk_performance_template_sections_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_template_sections ADD CONSTRAINT fk_performance_template_sections_performance_template_id FOREIGN KEY (tenant_id, performance_template_id) REFERENCES performance_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviews ADD CONSTRAINT fk_performance_reviews_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviews ADD CONSTRAINT fk_performance_reviews_performance_cycle_id FOREIGN KEY (tenant_id, performance_cycle_id) REFERENCES performance_cycles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviews ADD CONSTRAINT fk_performance_reviews_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviews ADD CONSTRAINT fk_performance_reviews_performance_template_id FOREIGN KEY (tenant_id, performance_template_id) REFERENCES performance_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviews ADD CONSTRAINT fk_performance_reviews_workflow_instance_id FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviewers ADD CONSTRAINT fk_performance_reviewers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviewers ADD CONSTRAINT fk_performance_reviewers_performance_review_id FOREIGN KEY (tenant_id, performance_review_id) REFERENCES performance_reviews (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_reviewers ADD CONSTRAINT fk_performance_reviewers_reviewer_employee_id FOREIGN KEY (tenant_id, reviewer_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_ratings ADD CONSTRAINT fk_performance_ratings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_ratings ADD CONSTRAINT fk_performance_ratings_performance_reviewer_id FOREIGN KEY (tenant_id, performance_reviewer_id) REFERENCES performance_reviewers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE performance_ratings ADD CONSTRAINT fk_performance_ratings_template_section_id FOREIGN KEY (tenant_id, template_section_id) REFERENCES performance_template_sections (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goals ADD CONSTRAINT fk_goals_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goals ADD CONSTRAINT fk_goals_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goals ADD CONSTRAINT fk_goals_performance_cycle_id FOREIGN KEY (tenant_id, performance_cycle_id) REFERENCES performance_cycles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goals ADD CONSTRAINT fk_goals_parent_goal_id FOREIGN KEY (tenant_id, parent_goal_id) REFERENCES goals (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goal_key_results ADD CONSTRAINT fk_goal_key_results_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goal_key_results ADD CONSTRAINT fk_goal_key_results_goal_id FOREIGN KEY (tenant_id, goal_id) REFERENCES goals (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goal_checkins ADD CONSTRAINT fk_goal_checkins_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goal_checkins ADD CONSTRAINT fk_goal_checkins_goal_id FOREIGN KEY (tenant_id, goal_id) REFERENCES goals (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE goal_checkins ADD CONSTRAINT fk_goal_checkins_author_employee_id FOREIGN KEY (tenant_id, author_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE feedback_requests ADD CONSTRAINT fk_feedback_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE feedback_requests ADD CONSTRAINT fk_feedback_requests_subject_employee_id FOREIGN KEY (tenant_id, subject_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE feedback_requests ADD CONSTRAINT fk_feedback_requests_requester_employee_id FOREIGN KEY (tenant_id, requester_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE feedback_requests ADD CONSTRAINT fk_feedback_requests_performance_review_id FOREIGN KEY (tenant_id, performance_review_id) REFERENCES performance_reviews (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE feedback_responses ADD CONSTRAINT fk_feedback_responses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE feedback_responses ADD CONSTRAINT fk_feedback_responses_feedback_request_id FOREIGN KEY (tenant_id, feedback_request_id) REFERENCES feedback_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE feedback_responses ADD CONSTRAINT fk_feedback_responses_responder_employee_id FOREIGN KEY (tenant_id, responder_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calibration_sessions ADD CONSTRAINT fk_calibration_sessions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calibration_sessions ADD CONSTRAINT fk_calibration_sessions_performance_cycle_id FOREIGN KEY (tenant_id, performance_cycle_id) REFERENCES performance_cycles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calibration_sessions ADD CONSTRAINT fk_calibration_sessions_facilitator_id FOREIGN KEY (tenant_id, facilitator_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calibration_entries ADD CONSTRAINT fk_calibration_entries_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calibration_entries ADD CONSTRAINT fk_calibration_entries_calibration_session_id FOREIGN KEY (tenant_id, calibration_session_id) REFERENCES calibration_sessions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE calibration_entries ADD CONSTRAINT fk_calibration_entries_performance_review_id FOREIGN KEY (tenant_id, performance_review_id) REFERENCES performance_reviews (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_categories ADD CONSTRAINT fk_skill_categories_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_categories ADD CONSTRAINT fk_skill_categories_parent_category_id FOREIGN KEY (tenant_id, parent_category_id) REFERENCES skill_categories (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skills ADD CONSTRAINT fk_skills_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skills ADD CONSTRAINT fk_skills_skill_category_id FOREIGN KEY (tenant_id, skill_category_id) REFERENCES skill_categories (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skills ADD CONSTRAINT fk_skills_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_levels ADD CONSTRAINT fk_skill_levels_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_levels ADD CONSTRAINT fk_skill_levels_skill_id FOREIGN KEY (tenant_id, skill_id) REFERENCES skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_profile_skills ADD CONSTRAINT fk_job_profile_skills_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_profile_skills ADD CONSTRAINT fk_job_profile_skills_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_profile_skills ADD CONSTRAINT fk_job_profile_skills_skill_id FOREIGN KEY (tenant_id, skill_id) REFERENCES skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_profile_skills ADD CONSTRAINT fk_job_profile_skills_required_level_id FOREIGN KEY (tenant_id, skill_id, required_level_id) REFERENCES skill_levels (tenant_id, skill_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_skills ADD CONSTRAINT fk_employee_skills_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_skills ADD CONSTRAINT fk_employee_skills_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_skills ADD CONSTRAINT fk_employee_skills_skill_id FOREIGN KEY (tenant_id, skill_id) REFERENCES skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_skills ADD CONSTRAINT fk_employee_skills_skill_level_id FOREIGN KEY (tenant_id, skill_id, skill_level_id) REFERENCES skill_levels (tenant_id, skill_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_assessments ADD CONSTRAINT fk_skill_assessments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_assessments ADD CONSTRAINT fk_skill_assessments_employee_skill_id FOREIGN KEY (tenant_id, employee_skill_id) REFERENCES employee_skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_assessments ADD CONSTRAINT fk_skill_assessments_assessor_id FOREIGN KEY (tenant_id, assessor_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_assessments ADD CONSTRAINT fk_skill_assessments_candidate_assessment_id FOREIGN KEY (tenant_id, candidate_assessment_id) REFERENCES candidate_assessments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_plans ADD CONSTRAINT fk_development_plans_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_plans ADD CONSTRAINT fk_development_plans_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_plans ADD CONSTRAINT fk_development_plans_mentor_employee_id FOREIGN KEY (tenant_id, mentor_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_plans ADD CONSTRAINT fk_development_plans_performance_review_id FOREIGN KEY (tenant_id, performance_review_id) REFERENCES performance_reviews (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_actions ADD CONSTRAINT fk_development_actions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_actions ADD CONSTRAINT fk_development_actions_development_plan_id FOREIGN KEY (tenant_id, development_plan_id) REFERENCES development_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_actions ADD CONSTRAINT fk_development_actions_skill_id FOREIGN KEY (tenant_id, skill_id) REFERENCES skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE development_actions ADD CONSTRAINT fk_development_actions_work_item_id FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE succession_plans ADD CONSTRAINT fk_succession_plans_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE succession_plans ADD CONSTRAINT fk_succession_plans_position_id FOREIGN KEY (tenant_id, position_id) REFERENCES positions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE succession_plans ADD CONSTRAINT fk_succession_plans_owner_employee_id FOREIGN KEY (tenant_id, owner_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE succession_candidates ADD CONSTRAINT fk_succession_candidates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE succession_candidates ADD CONSTRAINT fk_succession_candidates_succession_plan_id FOREIGN KEY (tenant_id, succession_plan_id) REFERENCES succession_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE succession_candidates ADD CONSTRAINT fk_succession_candidates_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE succession_candidates ADD CONSTRAINT fk_succession_candidates_development_plan_id FOREIGN KEY (tenant_id, development_plan_id) REFERENCES development_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE talent_pools ADD CONSTRAINT fk_talent_pools_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE talent_pools ADD CONSTRAINT fk_talent_pools_owner_employee_id FOREIGN KEY (tenant_id, owner_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE talent_pool_members ADD CONSTRAINT fk_talent_pool_members_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE talent_pool_members ADD CONSTRAINT fk_talent_pool_members_talent_pool_id FOREIGN KEY (tenant_id, talent_pool_id) REFERENCES talent_pools (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE talent_pool_members ADD CONSTRAINT fk_talent_pool_members_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_providers ADD CONSTRAINT fk_learning_providers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE courses ADD CONSTRAINT fk_courses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE courses ADD CONSTRAINT fk_courses_learning_provider_id FOREIGN KEY (tenant_id, learning_provider_id) REFERENCES learning_providers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE courses ADD CONSTRAINT fk_courses_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_modules ADD CONSTRAINT fk_course_modules_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_modules ADD CONSTRAINT fk_course_modules_course_id FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_skills ADD CONSTRAINT fk_course_skills_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_skills ADD CONSTRAINT fk_course_skills_course_id FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_skills ADD CONSTRAINT fk_course_skills_skill_id FOREIGN KEY (tenant_id, skill_id) REFERENCES skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_skills ADD CONSTRAINT fk_course_skills_target_level_id FOREIGN KEY (tenant_id, skill_id, target_level_id) REFERENCES skill_levels (tenant_id, skill_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_paths ADD CONSTRAINT fk_learning_paths_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_paths ADD CONSTRAINT fk_learning_paths_job_profile_id FOREIGN KEY (tenant_id, job_profile_id) REFERENCES job_profiles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_path_courses ADD CONSTRAINT fk_learning_path_courses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_path_courses ADD CONSTRAINT fk_learning_path_courses_learning_path_id FOREIGN KEY (tenant_id, learning_path_id) REFERENCES learning_paths (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_path_courses ADD CONSTRAINT fk_learning_path_courses_course_id FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_sessions ADD CONSTRAINT fk_course_sessions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_sessions ADD CONSTRAINT fk_course_sessions_course_id FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_sessions ADD CONSTRAINT fk_course_sessions_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE course_sessions ADD CONSTRAINT fk_course_sessions_instructor_employee_id FOREIGN KEY (tenant_id, instructor_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_enrollments ADD CONSTRAINT fk_learning_enrollments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_enrollments ADD CONSTRAINT fk_learning_enrollments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_enrollments ADD CONSTRAINT fk_learning_enrollments_course_id FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_enrollments ADD CONSTRAINT fk_learning_enrollments_course_session_id FOREIGN KEY (tenant_id, course_session_id) REFERENCES course_sessions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_enrollments ADD CONSTRAINT fk_learning_enrollments_work_item_id FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_completions ADD CONSTRAINT fk_learning_completions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_completions ADD CONSTRAINT fk_learning_completions_learning_enrollment_id FOREIGN KEY (tenant_id, learning_enrollment_id) REFERENCES learning_enrollments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE certifications ADD CONSTRAINT fk_certifications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE certifications ADD CONSTRAINT fk_certifications_skill_id FOREIGN KEY (tenant_id, skill_id) REFERENCES skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_certifications ADD CONSTRAINT fk_employee_certifications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_certifications ADD CONSTRAINT fk_employee_certifications_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_certifications ADD CONSTRAINT fk_employee_certifications_certification_id FOREIGN KEY (tenant_id, certification_id) REFERENCES certifications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_certifications ADD CONSTRAINT fk_employee_certifications_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_evaluations ADD CONSTRAINT fk_learning_evaluations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_evaluations ADD CONSTRAINT fk_learning_evaluations_learning_enrollment_id FOREIGN KEY (tenant_id, learning_enrollment_id) REFERENCES learning_enrollments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_plans ADD CONSTRAINT fk_compensation_plans_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_plans ADD CONSTRAINT fk_compensation_plans_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_plans ADD CONSTRAINT fk_compensation_plans_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_bands ADD CONSTRAINT fk_salary_bands_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_bands ADD CONSTRAINT fk_salary_bands_compensation_plan_id FOREIGN KEY (tenant_id, compensation_plan_id) REFERENCES compensation_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_bands ADD CONSTRAINT fk_salary_bands_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES grades (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE salary_bands ADD CONSTRAINT fk_salary_bands_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_compensation ADD CONSTRAINT fk_employee_compensation_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_compensation ADD CONSTRAINT fk_employee_compensation_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_compensation ADD CONSTRAINT fk_employee_compensation_compensation_plan_id FOREIGN KEY (tenant_id, compensation_plan_id) REFERENCES compensation_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_compensation ADD CONSTRAINT fk_employee_compensation_salary_band_id FOREIGN KEY (tenant_id, compensation_plan_id, salary_band_id) REFERENCES salary_bands (tenant_id, compensation_plan_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_compensation ADD CONSTRAINT fk_employee_compensation_source_payroll_result_id FOREIGN KEY (tenant_id, source_payroll_result_id) REFERENCES payroll_results (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_review_cycles ADD CONSTRAINT fk_compensation_review_cycles_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_review_cycles ADD CONSTRAINT fk_compensation_review_cycles_compensation_plan_id FOREIGN KEY (tenant_id, compensation_plan_id) REFERENCES compensation_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_review_proposals ADD CONSTRAINT fk_compensation_review_proposals_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_review_proposals ADD CONSTRAINT fk_compensation_review_proposals_review_cycle_id FOREIGN KEY (tenant_id, review_cycle_id) REFERENCES compensation_review_cycles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_review_proposals ADD CONSTRAINT fk_compensation_review_proposals_employee_compensation_id FOREIGN KEY (tenant_id, employee_compensation_id) REFERENCES employee_compensation (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_review_proposals ADD CONSTRAINT fk_compensation_review_proposals_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_plans ADD CONSTRAINT fk_benefit_plans_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_plans ADD CONSTRAINT fk_benefit_plans_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_plans ADD CONSTRAINT fk_benefit_plans_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_options ADD CONSTRAINT fk_benefit_options_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_options ADD CONSTRAINT fk_benefit_options_benefit_plan_id FOREIGN KEY (tenant_id, benefit_plan_id) REFERENCES benefit_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_eligibility_rules ADD CONSTRAINT fk_benefit_eligibility_rules_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_eligibility_rules ADD CONSTRAINT fk_benefit_eligibility_rules_benefit_plan_id FOREIGN KEY (tenant_id, benefit_plan_id) REFERENCES benefit_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_eligibility_rules ADD CONSTRAINT fk_benefit_eligibility_rules_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES grades (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_eligibility_rules ADD CONSTRAINT fk_benefit_eligibility_rules_location_id FOREIGN KEY (tenant_id, location_id) REFERENCES locations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_enrollments ADD CONSTRAINT fk_benefit_enrollments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_enrollments ADD CONSTRAINT fk_benefit_enrollments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_enrollments ADD CONSTRAINT fk_benefit_enrollments_benefit_option_id FOREIGN KEY (tenant_id, benefit_option_id) REFERENCES benefit_options (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_dependents ADD CONSTRAINT fk_benefit_dependents_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_dependents ADD CONSTRAINT fk_benefit_dependents_benefit_enrollment_id FOREIGN KEY (tenant_id, benefit_enrollment_id) REFERENCES benefit_enrollments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_dependents ADD CONSTRAINT fk_benefit_dependents_person_dependent_id FOREIGN KEY (tenant_id, person_dependent_id) REFERENCES person_dependents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_claims ADD CONSTRAINT fk_benefit_claims_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_claims ADD CONSTRAINT fk_benefit_claims_benefit_enrollment_id FOREIGN KEY (tenant_id, benefit_enrollment_id) REFERENCES benefit_enrollments (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_claims ADD CONSTRAINT fk_benefit_claims_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE benefit_claims ADD CONSTRAINT fk_benefit_claims_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_templates ADD CONSTRAINT fk_survey_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_templates ADD CONSTRAINT fk_survey_templates_owner_user_id FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_questions ADD CONSTRAINT fk_survey_questions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_questions ADD CONSTRAINT fk_survey_questions_survey_template_id FOREIGN KEY (tenant_id, survey_template_id) REFERENCES survey_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_question_options ADD CONSTRAINT fk_survey_question_options_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_question_options ADD CONSTRAINT fk_survey_question_options_survey_question_id FOREIGN KEY (tenant_id, survey_question_id) REFERENCES survey_questions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_campaigns ADD CONSTRAINT fk_survey_campaigns_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_campaigns ADD CONSTRAINT fk_survey_campaigns_survey_template_id FOREIGN KEY (tenant_id, survey_template_id) REFERENCES survey_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_campaigns ADD CONSTRAINT fk_survey_campaigns_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_audiences ADD CONSTRAINT fk_survey_audiences_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_audiences ADD CONSTRAINT fk_survey_audiences_survey_campaign_id FOREIGN KEY (tenant_id, survey_campaign_id) REFERENCES survey_campaigns (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_audiences ADD CONSTRAINT fk_survey_audiences_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_invitations ADD CONSTRAINT fk_survey_invitations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_invitations ADD CONSTRAINT fk_survey_invitations_survey_campaign_id FOREIGN KEY (tenant_id, survey_campaign_id) REFERENCES survey_campaigns (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_invitations ADD CONSTRAINT fk_survey_invitations_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_responses ADD CONSTRAINT fk_survey_responses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_responses ADD CONSTRAINT fk_survey_responses_survey_invitation_id FOREIGN KEY (tenant_id, survey_invitation_id) REFERENCES survey_invitations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_answers ADD CONSTRAINT fk_survey_answers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_answers ADD CONSTRAINT fk_survey_answers_survey_response_id FOREIGN KEY (tenant_id, survey_response_id) REFERENCES survey_responses (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_answers ADD CONSTRAINT fk_survey_answers_survey_question_id FOREIGN KEY (tenant_id, survey_question_id) REFERENCES survey_questions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE survey_answers ADD CONSTRAINT fk_survey_answers_selected_option_id FOREIGN KEY (tenant_id, survey_question_id, selected_option_id) REFERENCES survey_question_options (tenant_id, survey_question_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pulse_campaigns ADD CONSTRAINT fk_pulse_campaigns_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pulse_campaigns ADD CONSTRAINT fk_pulse_campaigns_survey_template_id FOREIGN KEY (tenant_id, survey_template_id) REFERENCES survey_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pulse_campaigns ADD CONSTRAINT fk_pulse_campaigns_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pulse_responses ADD CONSTRAINT fk_pulse_responses_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pulse_responses ADD CONSTRAINT fk_pulse_responses_pulse_campaign_id FOREIGN KEY (tenant_id, pulse_campaign_id) REFERENCES pulse_campaigns (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE pulse_responses ADD CONSTRAINT fk_pulse_responses_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE engagement_scores ADD CONSTRAINT fk_engagement_scores_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE engagement_scores ADD CONSTRAINT fk_engagement_scores_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE engagement_scores ADD CONSTRAINT fk_engagement_scores_survey_campaign_id FOREIGN KEY (tenant_id, survey_campaign_id) REFERENCES survey_campaigns (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognition_programs ADD CONSTRAINT fk_recognition_programs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognition_programs ADD CONSTRAINT fk_recognition_programs_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognition_badges ADD CONSTRAINT fk_recognition_badges_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognition_badges ADD CONSTRAINT fk_recognition_badges_recognition_program_id FOREIGN KEY (tenant_id, recognition_program_id) REFERENCES recognition_programs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognitions ADD CONSTRAINT fk_recognitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognitions ADD CONSTRAINT fk_recognitions_recognition_badge_id FOREIGN KEY (tenant_id, recognition_badge_id) REFERENCES recognition_badges (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognitions ADD CONSTRAINT fk_recognitions_giver_employee_id FOREIGN KEY (tenant_id, giver_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognitions ADD CONSTRAINT fk_recognitions_recipient_employee_id FOREIGN KEY (tenant_id, recipient_employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognition_reactions ADD CONSTRAINT fk_recognition_reactions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognition_reactions ADD CONSTRAINT fk_recognition_reactions_recognition_id FOREIGN KEY (tenant_id, recognition_id) REFERENCES recognitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE recognition_reactions ADD CONSTRAINT fk_recognition_reactions_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reward_catalog_items ADD CONSTRAINT fk_reward_catalog_items_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reward_catalog_items ADD CONSTRAINT fk_reward_catalog_items_recognition_program_id FOREIGN KEY (tenant_id, recognition_program_id) REFERENCES recognition_programs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reward_redemptions ADD CONSTRAINT fk_reward_redemptions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reward_redemptions ADD CONSTRAINT fk_reward_redemptions_reward_catalog_item_id FOREIGN KEY (tenant_id, reward_catalog_item_id) REFERENCES reward_catalog_items (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE reward_redemptions ADD CONSTRAINT fk_reward_redemptions_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_suggestions ADD CONSTRAINT fk_employee_suggestions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_suggestions ADD CONSTRAINT fk_employee_suggestions_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE employee_suggestions ADD CONSTRAINT fk_employee_suggestions_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE suggestion_votes ADD CONSTRAINT fk_suggestion_votes_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE suggestion_votes ADD CONSTRAINT fk_suggestion_votes_employee_suggestion_id FOREIGN KEY (tenant_id, employee_suggestion_id) REFERENCES employee_suggestions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE suggestion_votes ADD CONSTRAINT fk_suggestion_votes_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievance_categories ADD CONSTRAINT fk_grievance_categories_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievance_categories ADD CONSTRAINT fk_grievance_categories_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievances ADD CONSTRAINT fk_grievances_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievances ADD CONSTRAINT fk_grievances_grievance_category_id FOREIGN KEY (tenant_id, grievance_category_id) REFERENCES grievance_categories (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievances ADD CONSTRAINT fk_grievances_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievances ADD CONSTRAINT fk_grievances_assigned_to FOREIGN KEY (tenant_id, assigned_to) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievance_actions ADD CONSTRAINT fk_grievance_actions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievance_actions ADD CONSTRAINT fk_grievance_actions_grievance_id FOREIGN KEY (tenant_id, grievance_id) REFERENCES grievances (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE grievance_actions ADD CONSTRAINT fk_grievance_actions_actor_id FOREIGN KEY (tenant_id, actor_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE wellbeing_programs ADD CONSTRAINT fk_wellbeing_programs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE wellbeing_programs ADD CONSTRAINT fk_wellbeing_programs_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE wellbeing_enrollments ADD CONSTRAINT fk_wellbeing_enrollments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE wellbeing_enrollments ADD CONSTRAINT fk_wellbeing_enrollments_wellbeing_program_id FOREIGN KEY (tenant_id, wellbeing_program_id) REFERENCES wellbeing_programs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE wellbeing_enrollments ADD CONSTRAINT fk_wellbeing_enrollments_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_datasets ADD CONSTRAINT fk_analytics_datasets_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_datasets ADD CONSTRAINT fk_analytics_datasets_owner_user_id FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_dataset_fields ADD CONSTRAINT fk_analytics_dataset_fields_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_dataset_fields ADD CONSTRAINT fk_analytics_dataset_fields_analytics_dataset_id FOREIGN KEY (tenant_id, analytics_dataset_id) REFERENCES analytics_datasets (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE metric_definitions ADD CONSTRAINT fk_metric_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE metric_definitions ADD CONSTRAINT fk_metric_definitions_analytics_dataset_id FOREIGN KEY (tenant_id, analytics_dataset_id) REFERENCES analytics_datasets (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE metric_snapshots ADD CONSTRAINT fk_metric_snapshots_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE metric_snapshots ADD CONSTRAINT fk_metric_snapshots_metric_definition_id FOREIGN KEY (tenant_id, metric_definition_id) REFERENCES metric_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE metric_snapshots ADD CONSTRAINT fk_metric_snapshots_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_dashboards ADD CONSTRAINT fk_analytics_dashboards_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_dashboards ADD CONSTRAINT fk_analytics_dashboards_owner_user_id FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dashboard_widgets ADD CONSTRAINT fk_dashboard_widgets_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dashboard_widgets ADD CONSTRAINT fk_dashboard_widgets_analytics_dashboard_id FOREIGN KEY (tenant_id, analytics_dashboard_id) REFERENCES analytics_dashboards (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dashboard_widgets ADD CONSTRAINT fk_dashboard_widgets_metric_definition_id FOREIGN KEY (tenant_id, metric_definition_id) REFERENCES metric_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_report_definitions ADD CONSTRAINT fk_analytics_report_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_report_definitions ADD CONSTRAINT fk_analytics_report_definitions_analytics_dataset_id FOREIGN KEY (tenant_id, analytics_dataset_id) REFERENCES analytics_datasets (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_report_definitions ADD CONSTRAINT fk_analytics_report_definitions_owner_user_id FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_report_runs ADD CONSTRAINT fk_analytics_report_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_report_runs ADD CONSTRAINT fk_analytics_report_runs_report_definition_id FOREIGN KEY (tenant_id, report_definition_id) REFERENCES analytics_report_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_report_runs ADD CONSTRAINT fk_analytics_report_runs_background_job_id FOREIGN KEY (tenant_id, background_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE analytics_report_runs ADD CONSTRAINT fk_analytics_report_runs_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_models ADD CONSTRAINT fk_workforce_forecast_models_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_models ADD CONSTRAINT fk_workforce_forecast_models_analytics_dataset_id FOREIGN KEY (tenant_id, analytics_dataset_id) REFERENCES analytics_datasets (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_runs ADD CONSTRAINT fk_workforce_forecast_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_runs ADD CONSTRAINT fk_workforce_forecast_runs_forecast_model_id FOREIGN KEY (tenant_id, forecast_model_id) REFERENCES workforce_forecast_models (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_runs ADD CONSTRAINT fk_workforce_forecast_runs_background_job_id FOREIGN KEY (tenant_id, background_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_values ADD CONSTRAINT fk_workforce_forecast_values_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_values ADD CONSTRAINT fk_workforce_forecast_values_forecast_run_id FOREIGN KEY (tenant_id, forecast_run_id) REFERENCES workforce_forecast_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_values ADD CONSTRAINT fk_workforce_forecast_values_organization_unit_id FOREIGN KEY (tenant_id, organization_unit_id) REFERENCES organization_units (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE workforce_forecast_values ADD CONSTRAINT fk_workforce_forecast_values_metric_definition_id FOREIGN KEY (tenant_id, metric_definition_id) REFERENCES metric_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_model_registry ADD CONSTRAINT fk_ai_model_registry_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_model_registry ADD CONSTRAINT fk_ai_model_registry_integration_connection_id FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_prompt_templates ADD CONSTRAINT fk_ai_prompt_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_prompt_templates ADD CONSTRAINT fk_ai_prompt_templates_ai_model_id FOREIGN KEY (tenant_id, ai_model_id) REFERENCES ai_model_registry (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_prompt_templates ADD CONSTRAINT fk_ai_prompt_templates_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_runs ADD CONSTRAINT fk_ai_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_runs ADD CONSTRAINT fk_ai_runs_ai_model_id FOREIGN KEY (tenant_id, ai_model_id) REFERENCES ai_model_registry (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_runs ADD CONSTRAINT fk_ai_runs_prompt_template_id FOREIGN KEY (tenant_id, prompt_template_id) REFERENCES ai_prompt_templates (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_runs ADD CONSTRAINT fk_ai_runs_requested_by FOREIGN KEY (tenant_id, requested_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_runs ADD CONSTRAINT fk_ai_runs_background_job_id FOREIGN KEY (tenant_id, background_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_run_inputs ADD CONSTRAINT fk_ai_run_inputs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_run_inputs ADD CONSTRAINT fk_ai_run_inputs_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_run_inputs ADD CONSTRAINT fk_ai_run_inputs_document_version_id FOREIGN KEY (tenant_id, document_version_id) REFERENCES document_versions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_run_outputs ADD CONSTRAINT fk_ai_run_outputs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_run_outputs ADD CONSTRAINT fk_ai_run_outputs_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_evidence ADD CONSTRAINT fk_ai_evidence_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_evidence ADD CONSTRAINT fk_ai_evidence_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_evidence ADD CONSTRAINT fk_ai_evidence_document_version_id FOREIGN KEY (tenant_id, document_version_id) REFERENCES document_versions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_evidence ADD CONSTRAINT fk_ai_evidence_audit_event_id FOREIGN KEY (tenant_id, audit_event_id) REFERENCES audit_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE resume_parse_runs ADD CONSTRAINT fk_resume_parse_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE resume_parse_runs ADD CONSTRAINT fk_resume_parse_runs_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE resume_parse_runs ADD CONSTRAINT fk_resume_parse_runs_candidate_document_id FOREIGN KEY (tenant_id, candidate_document_id) REFERENCES candidate_documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_description_analysis_runs ADD CONSTRAINT fk_job_description_analysis_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_description_analysis_runs ADD CONSTRAINT fk_job_description_analysis_runs_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_description_analysis_runs ADD CONSTRAINT fk_job_description_analysis_runs_job_posting_id FOREIGN KEY (tenant_id, job_posting_id) REFERENCES job_postings (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_match_scores ADD CONSTRAINT fk_candidate_match_scores_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_match_scores ADD CONSTRAINT fk_candidate_match_scores_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE candidate_match_scores ADD CONSTRAINT fk_candidate_match_scores_application_id FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_recommendations ADD CONSTRAINT fk_skill_recommendations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_recommendations ADD CONSTRAINT fk_skill_recommendations_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_recommendations ADD CONSTRAINT fk_skill_recommendations_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE skill_recommendations ADD CONSTRAINT fk_skill_recommendations_skill_id FOREIGN KEY (tenant_id, skill_id) REFERENCES skills (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_recommendations ADD CONSTRAINT fk_learning_recommendations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_recommendations ADD CONSTRAINT fk_learning_recommendations_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_recommendations ADD CONSTRAINT fk_learning_recommendations_employee_id FOREIGN KEY (tenant_id, employee_id) REFERENCES employees (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE learning_recommendations ADD CONSTRAINT fk_learning_recommendations_course_id FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_insight_runs ADD CONSTRAINT fk_compensation_insight_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_insight_runs ADD CONSTRAINT fk_compensation_insight_runs_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_insight_runs ADD CONSTRAINT fk_compensation_insight_runs_compensation_plan_id FOREIGN KEY (tenant_id, compensation_plan_id) REFERENCES compensation_plans (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compensation_insight_runs ADD CONSTRAINT fk_compensation_insight_runs_access_scope_id FOREIGN KEY (tenant_id, access_scope_id) REFERENCES access_scopes (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_model_call_logs ADD CONSTRAINT fk_ai_model_call_logs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_model_call_logs ADD CONSTRAINT fk_ai_model_call_logs_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_model_call_logs ADD CONSTRAINT fk_ai_model_call_logs_integration_job_id FOREIGN KEY (tenant_id, integration_job_id) REFERENCES integration_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE ai_model_call_logs ADD CONSTRAINT fk_ai_model_call_logs_audit_event_id FOREIGN KEY (tenant_id, audit_event_id) REFERENCES audit_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_providers ADD CONSTRAINT fk_integration_providers_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_connections ADD CONSTRAINT fk_integration_connections_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_connections ADD CONSTRAINT fk_integration_connections_integration_provider_id FOREIGN KEY (tenant_id, integration_provider_id) REFERENCES integration_providers (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_connections ADD CONSTRAINT fk_integration_connections_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_integration_connection_id FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_jobs ADD CONSTRAINT fk_integration_jobs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_jobs ADD CONSTRAINT fk_integration_jobs_integration_connection_id FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_jobs ADD CONSTRAINT fk_integration_jobs_background_job_id FOREIGN KEY (tenant_id, background_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_job_items ADD CONSTRAINT fk_integration_job_items_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE integration_job_items ADD CONSTRAINT fk_integration_job_items_integration_job_id FOREIGN KEY (tenant_id, integration_job_id) REFERENCES integration_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE webhook_endpoints ADD CONSTRAINT fk_webhook_endpoints_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE webhook_endpoints ADD CONSTRAINT fk_webhook_endpoints_integration_connection_id FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE webhook_deliveries ADD CONSTRAINT fk_webhook_deliveries_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE webhook_deliveries ADD CONSTRAINT fk_webhook_deliveries_webhook_endpoint_id FOREIGN KEY (tenant_id, webhook_endpoint_id) REFERENCES webhook_endpoints (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE webhook_deliveries ADD CONSTRAINT fk_webhook_deliveries_outbox_event_id FOREIGN KEY (tenant_id, outbox_event_id) REFERENCES outbox_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE inbound_events ADD CONSTRAINT fk_inbound_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE inbound_events ADD CONSTRAINT fk_inbound_events_integration_connection_id FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE outbox_events ADD CONSTRAINT fk_outbox_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE outbox_events ADD CONSTRAINT fk_outbox_events_actor_id FOREIGN KEY (tenant_id, actor_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE outbox_events ADD CONSTRAINT fk_outbox_events_ai_run_id FOREIGN KEY (tenant_id, ai_run_id) REFERENCES ai_runs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE outbox_delivery_attempts ADD CONSTRAINT fk_outbox_delivery_attempts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE outbox_delivery_attempts ADD CONSTRAINT fk_outbox_delivery_attempts_outbox_event_id FOREIGN KEY (tenant_id, outbox_event_id) REFERENCES outbox_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE outbox_delivery_attempts ADD CONSTRAINT fk_outbox_delivery_attempts_integration_connection_id FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_definitions ADD CONSTRAINT fk_job_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_definitions ADD CONSTRAINT fk_job_definitions_service_account_id FOREIGN KEY (tenant_id, service_account_id) REFERENCES service_accounts (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_definitions ADD CONSTRAINT fk_job_definitions_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_schedules ADD CONSTRAINT fk_job_schedules_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_schedules ADD CONSTRAINT fk_job_schedules_job_definition_id FOREIGN KEY (tenant_id, job_definition_id) REFERENCES job_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_jobs ADD CONSTRAINT fk_background_jobs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_jobs ADD CONSTRAINT fk_background_jobs_job_definition_id FOREIGN KEY (tenant_id, job_definition_id) REFERENCES job_definitions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_jobs ADD CONSTRAINT fk_background_jobs_job_schedule_id FOREIGN KEY (tenant_id, job_schedule_id) REFERENCES job_schedules (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE background_jobs ADD CONSTRAINT fk_background_jobs_requested_by FOREIGN KEY (tenant_id, requested_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_attempts ADD CONSTRAINT fk_job_attempts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_attempts ADD CONSTRAINT fk_job_attempts_background_job_id FOREIGN KEY (tenant_id, background_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_dependencies ADD CONSTRAINT fk_job_dependencies_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_dependencies ADD CONSTRAINT fk_job_dependencies_background_job_id FOREIGN KEY (tenant_id, background_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_dependencies ADD CONSTRAINT fk_job_dependencies_prerequisite_job_id FOREIGN KEY (tenant_id, prerequisite_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dead_letter_entries ADD CONSTRAINT fk_dead_letter_entries_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dead_letter_entries ADD CONSTRAINT fk_dead_letter_entries_background_job_id FOREIGN KEY (tenant_id, background_job_id) REFERENCES background_jobs (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dead_letter_entries ADD CONSTRAINT fk_dead_letter_entries_inbound_event_id FOREIGN KEY (tenant_id, inbound_event_id) REFERENCES inbound_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_frameworks ADD CONSTRAINT fk_compliance_frameworks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_frameworks ADD CONSTRAINT fk_compliance_frameworks_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_controls ADD CONSTRAINT fk_compliance_controls_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_controls ADD CONSTRAINT fk_compliance_controls_compliance_framework_id FOREIGN KEY (tenant_id, compliance_framework_id) REFERENCES compliance_frameworks (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_controls ADD CONSTRAINT fk_compliance_controls_owner_role_id FOREIGN KEY (tenant_id, owner_role_id) REFERENCES roles (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_controls ADD CONSTRAINT fk_compliance_controls_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_obligations ADD CONSTRAINT fk_compliance_obligations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_obligations ADD CONSTRAINT fk_compliance_obligations_compliance_control_id FOREIGN KEY (tenant_id, compliance_control_id) REFERENCES compliance_controls (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_obligations ADD CONSTRAINT fk_compliance_obligations_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_evidence ADD CONSTRAINT fk_compliance_evidence_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_evidence ADD CONSTRAINT fk_compliance_evidence_compliance_obligation_id FOREIGN KEY (tenant_id, compliance_obligation_id) REFERENCES compliance_obligations (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_evidence ADD CONSTRAINT fk_compliance_evidence_document_version_id FOREIGN KEY (tenant_id, document_version_id) REFERENCES document_versions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_evidence ADD CONSTRAINT fk_compliance_evidence_collected_by FOREIGN KEY (tenant_id, collected_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_assessments ADD CONSTRAINT fk_compliance_assessments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_assessments ADD CONSTRAINT fk_compliance_assessments_compliance_control_id FOREIGN KEY (tenant_id, compliance_control_id) REFERENCES compliance_controls (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_assessments ADD CONSTRAINT fk_compliance_assessments_assessor_id FOREIGN KEY (tenant_id, assessor_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE compliance_assessments ADD CONSTRAINT fk_compliance_assessments_evidence_id FOREIGN KEY (tenant_id, evidence_id) REFERENCES compliance_evidence (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE retention_policies ADD CONSTRAINT fk_retention_policies_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE retention_policies ADD CONSTRAINT fk_retention_policies_jurisdiction_id FOREIGN KEY (tenant_id, jurisdiction_id) REFERENCES jurisdictions (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE retention_policies ADD CONSTRAINT fk_retention_policies_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE retention_policies ADD CONSTRAINT fk_retention_policies_author_user_id FOREIGN KEY (tenant_id, author_user_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_holds ADD CONSTRAINT fk_legal_holds_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_holds ADD CONSTRAINT fk_legal_holds_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_holds ADD CONSTRAINT fk_legal_holds_authorized_by FOREIGN KEY (tenant_id, authorized_by) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_hold_documents ADD CONSTRAINT fk_legal_hold_documents_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_hold_documents ADD CONSTRAINT fk_legal_hold_documents_legal_hold_id FOREIGN KEY (tenant_id, legal_hold_id) REFERENCES legal_holds (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE legal_hold_documents ADD CONSTRAINT fk_legal_hold_documents_document_id FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE data_subject_requests ADD CONSTRAINT fk_data_subject_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE data_subject_requests ADD CONSTRAINT fk_data_subject_requests_person_id FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE data_subject_requests ADD CONSTRAINT fk_data_subject_requests_assigned_to FOREIGN KEY (tenant_id, assigned_to) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE data_subject_requests ADD CONSTRAINT fk_data_subject_requests_approval_request_id FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_requests (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_actor_id FOREIGN KEY (tenant_id, actor_id) REFERENCES users (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_service_account_id FOREIGN KEY (tenant_id, service_account_id) REFERENCES service_accounts (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_legal_entity_id FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE audit_event_changes ADD CONSTRAINT fk_audit_event_changes_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE audit_event_changes ADD CONSTRAINT fk_audit_event_changes_audit_event_id FOREIGN KEY (tenant_id, audit_event_id) REFERENCES audit_events (tenant_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX ix_tenant_settings_author_user_id ON tenant_settings (tenant_id, author_user_id);

CREATE INDEX ix_users_person_id ON users (tenant_id, person_id);

CREATE INDEX ix_user_sessions_user_id ON user_sessions (tenant_id, user_id);

CREATE INDEX ix_roles_parent_role_id ON roles (tenant_id, parent_role_id);

CREATE INDEX ix_roles_author_user_id ON roles (tenant_id, author_user_id);

CREATE INDEX ix_permissions_author_user_id ON permissions (tenant_id, author_user_id);

CREATE INDEX ix_role_permissions_permission_id ON role_permissions (tenant_id, permission_id);

CREATE INDEX ix_user_roles_user_id ON user_roles (tenant_id, user_id);

CREATE INDEX ix_user_roles_role_id ON user_roles (tenant_id, role_id);

CREATE INDEX ix_user_roles_membership_id ON user_roles (tenant_id, membership_id);

CREATE INDEX ix_tenant_memberships_legal_entity_id ON tenant_memberships (tenant_id, legal_entity_id);

CREATE INDEX ix_legal_entities_jurisdiction_id ON legal_entities (tenant_id, jurisdiction_id);

CREATE INDEX ix_legal_entities_author_user_id ON legal_entities (tenant_id, author_user_id);

CREATE INDEX ix_legal_entity_relationships_child_entity_id ON legal_entity_relationships (tenant_id, child_entity_id);

CREATE INDEX ix_jurisdictions_parent_jurisdiction_id ON jurisdictions (tenant_id, parent_jurisdiction_id);

CREATE INDEX ix_jurisdictions_author_user_id ON jurisdictions (tenant_id, author_user_id);

CREATE INDEX ix_entity_registrations_jurisdiction_id ON entity_registrations (tenant_id, jurisdiction_id);

CREATE INDEX ix_entity_addresses_legal_entity_id ON entity_addresses (tenant_id, legal_entity_id);

CREATE INDEX ix_entity_addresses_jurisdiction_id ON entity_addresses (tenant_id, jurisdiction_id);

CREATE INDEX ix_entity_bank_accounts_legal_entity_id ON entity_bank_accounts (tenant_id, legal_entity_id);

CREATE INDEX ix_entity_bank_accounts_jurisdiction_id ON entity_bank_accounts (tenant_id, jurisdiction_id);

CREATE INDEX ix_access_scopes_legal_entity_id ON access_scopes (tenant_id, legal_entity_id);

CREATE INDEX ix_access_scopes_organization_unit_id ON access_scopes (tenant_id, organization_unit_id);

CREATE INDEX ix_access_scopes_author_user_id ON access_scopes (tenant_id, author_user_id);

CREATE INDEX ix_role_scope_assignments_access_scope_id ON role_scope_assignments (tenant_id, access_scope_id);

CREATE INDEX ix_delegations_delegator_id ON delegations (tenant_id, delegator_id);

CREATE INDEX ix_delegations_delegate_id ON delegations (tenant_id, delegate_id);

CREATE INDEX ix_delegations_role_id ON delegations (tenant_id, role_id);

CREATE INDEX ix_service_accounts_owner_user_id ON service_accounts (tenant_id, owner_user_id);

CREATE INDEX ix_service_accounts_role_id ON service_accounts (tenant_id, role_id);

CREATE INDEX ix_identity_provider_configs_legal_entity_id ON identity_provider_configs (tenant_id, legal_entity_id);

CREATE INDEX ix_identity_provider_configs_author_user_id ON identity_provider_configs (tenant_id, author_user_id);

CREATE INDEX ix_person_contacts_person_id ON person_contacts (tenant_id, person_id);

CREATE INDEX ix_person_addresses_person_id ON person_addresses (tenant_id, person_id);

CREATE INDEX ix_person_addresses_jurisdiction_id ON person_addresses (tenant_id, jurisdiction_id);

CREATE INDEX ix_person_identifiers_person_id ON person_identifiers (tenant_id, person_id);

CREATE INDEX ix_person_identifiers_jurisdiction_id ON person_identifiers (tenant_id, jurisdiction_id);

CREATE INDEX ix_emergency_contacts_person_id ON emergency_contacts (tenant_id, person_id);

CREATE INDEX ix_person_dependents_person_id ON person_dependents (tenant_id, person_id);

CREATE INDEX ix_employees_person_id ON employees (tenant_id, person_id);

CREATE INDEX ix_employees_legal_entity_id ON employees (tenant_id, legal_entity_id);

CREATE INDEX ix_employment_contracts_employee_id ON employment_contracts (tenant_id, employee_id);

CREATE INDEX ix_employment_contracts_legal_entity_id ON employment_contracts (tenant_id, legal_entity_id);

CREATE INDEX ix_employment_contracts_document_id ON employment_contracts (tenant_id, document_id);

CREATE INDEX ix_employment_assignments_employee_id ON employment_assignments (tenant_id, employee_id);

CREATE INDEX ix_employment_assignments_position_id ON employment_assignments (tenant_id, position_id);

CREATE INDEX ix_employment_assignments_location_id ON employment_assignments (tenant_id, location_id);

CREATE INDEX ix_employment_assignments_cost_center_id ON employment_assignments (tenant_id, cost_center_id);

CREATE INDEX ix_employment_status_history_employee_id ON employment_status_history (tenant_id, employee_id);

CREATE INDEX ix_employment_status_history_changed_by ON employment_status_history (tenant_id, changed_by);

CREATE INDEX ix_organization_units_legal_entity_id ON organization_units (tenant_id, legal_entity_id);

CREATE INDEX ix_organization_units_parent_unit_id ON organization_units (tenant_id, parent_unit_id);

CREATE INDEX ix_organization_units_author_user_id ON organization_units (tenant_id, author_user_id);

CREATE INDEX ix_organization_unit_history_parent_unit_id ON organization_unit_history (tenant_id, parent_unit_id);

CREATE INDEX ix_departments_organization_unit_id ON departments (tenant_id, organization_unit_id);

CREATE INDEX ix_departments_head_employee_id ON departments (tenant_id, head_employee_id);

CREATE INDEX ix_departments_author_user_id ON departments (tenant_id, author_user_id);

CREATE INDEX ix_teams_department_id ON teams (tenant_id, department_id);

CREATE INDEX ix_teams_manager_employee_id ON teams (tenant_id, manager_employee_id);

CREATE INDEX ix_teams_author_user_id ON teams (tenant_id, author_user_id);

CREATE INDEX ix_team_memberships_employee_id ON team_memberships (tenant_id, employee_id);

CREATE INDEX ix_positions_organization_unit_id ON positions (tenant_id, organization_unit_id);

CREATE INDEX ix_positions_job_profile_id ON positions (tenant_id, job_profile_id);

CREATE INDEX ix_positions_grade_id ON positions (tenant_id, grade_id);

CREATE INDEX ix_positions_author_user_id ON positions (tenant_id, author_user_id);

CREATE INDEX ix_position_relationships_position_id ON position_relationships (tenant_id, position_id);

CREATE INDEX ix_position_relationships_related_position_id ON position_relationships (tenant_id, related_position_id);

CREATE INDEX ix_job_families_parent_family_id ON job_families (tenant_id, parent_family_id);

CREATE INDEX ix_job_families_author_user_id ON job_families (tenant_id, author_user_id);

CREATE INDEX ix_job_profiles_job_family_id ON job_profiles (tenant_id, job_family_id);

CREATE INDEX ix_job_profiles_author_user_id ON job_profiles (tenant_id, author_user_id);

CREATE INDEX ix_job_levels_job_family_id ON job_levels (tenant_id, job_family_id);

CREATE INDEX ix_job_levels_author_user_id ON job_levels (tenant_id, author_user_id);

CREATE INDEX ix_grades_legal_entity_id ON grades (tenant_id, legal_entity_id);

CREATE INDEX ix_grades_job_level_id ON grades (tenant_id, job_level_id);

CREATE INDEX ix_grades_author_user_id ON grades (tenant_id, author_user_id);

CREATE INDEX ix_locations_legal_entity_id ON locations (tenant_id, legal_entity_id);

CREATE INDEX ix_locations_jurisdiction_id ON locations (tenant_id, jurisdiction_id);

CREATE INDEX ix_locations_author_user_id ON locations (tenant_id, author_user_id);

CREATE INDEX ix_location_addresses_location_id ON location_addresses (tenant_id, location_id);

CREATE INDEX ix_location_addresses_jurisdiction_id ON location_addresses (tenant_id, jurisdiction_id);

CREATE INDEX ix_cost_centers_legal_entity_id ON cost_centers (tenant_id, legal_entity_id);

CREATE INDEX ix_cost_centers_parent_cost_center_id ON cost_centers (tenant_id, parent_cost_center_id);

CREATE INDEX ix_cost_centers_author_user_id ON cost_centers (tenant_id, author_user_id);

CREATE INDEX ix_reporting_relationships_employee_id ON reporting_relationships (tenant_id, employee_id);

CREATE INDEX ix_reporting_relationships_manager_employee_id ON reporting_relationships (tenant_id, manager_employee_id);

CREATE INDEX ix_employee_contacts_employee_id ON employee_contacts (tenant_id, employee_id);

CREATE INDEX ix_employee_bank_accounts_employee_id ON employee_bank_accounts (tenant_id, employee_id);

CREATE INDEX ix_employee_bank_accounts_jurisdiction_id ON employee_bank_accounts (tenant_id, jurisdiction_id);

CREATE INDEX ix_employee_qualifications_employee_id ON employee_qualifications (tenant_id, employee_id);

CREATE INDEX ix_employee_qualifications_document_id ON employee_qualifications (tenant_id, document_id);

CREATE INDEX ix_employee_work_experience_employee_id ON employee_work_experience (tenant_id, employee_id);

CREATE INDEX ix_document_types_legal_entity_id ON document_types (tenant_id, legal_entity_id);

CREATE INDEX ix_document_types_author_user_id ON document_types (tenant_id, author_user_id);

CREATE INDEX ix_documents_document_type_id ON documents (tenant_id, document_type_id);

CREATE INDEX ix_documents_owner_person_id ON documents (tenant_id, owner_person_id);

CREATE INDEX ix_documents_legal_entity_id ON documents (tenant_id, legal_entity_id);

CREATE INDEX ix_document_versions_uploaded_by ON document_versions (tenant_id, uploaded_by);

CREATE INDEX ix_document_links_employee_id ON document_links (tenant_id, employee_id);

CREATE INDEX ix_document_access_grants_document_id ON document_access_grants (tenant_id, document_id);

CREATE INDEX ix_document_access_grants_user_id ON document_access_grants (tenant_id, user_id);

CREATE INDEX ix_document_access_grants_role_id ON document_access_grants (tenant_id, role_id);

CREATE INDEX ix_document_signatures_signer_person_id ON document_signatures (tenant_id, signer_person_id);

CREATE INDEX ix_employee_custom_field_definitions_legal_entity_id ON employee_custom_field_definitions (tenant_id, legal_entity_id);

CREATE INDEX ix_employee_custom_field_definitions_author_user_id ON employee_custom_field_definitions (tenant_id, author_user_id);

CREATE INDEX ix_employee_custom_field_values_field_definition_id ON employee_custom_field_values (tenant_id, field_definition_id);

CREATE INDEX ix_workflow_definitions_legal_entity_id ON workflow_definitions (tenant_id, legal_entity_id);

CREATE INDEX ix_workflow_definitions_owner_role_id ON workflow_definitions (tenant_id, owner_role_id);

CREATE INDEX ix_workflow_definitions_author_user_id ON workflow_definitions (tenant_id, author_user_id);

CREATE INDEX ix_workflow_steps_approver_role_id ON workflow_steps (tenant_id, approver_role_id);

CREATE INDEX ix_workflow_steps_author_user_id ON workflow_steps (tenant_id, author_user_id);

CREATE INDEX ix_workflow_transitions_to_step_id ON workflow_transitions (tenant_id, to_step_id);

CREATE INDEX ix_workflow_instances_workflow_definition_id ON workflow_instances (tenant_id, workflow_definition_id);

CREATE INDEX ix_workflow_instances_requested_by ON workflow_instances (tenant_id, requested_by);

CREATE INDEX ix_workflow_step_instances_workflow_instance_id ON workflow_step_instances (tenant_id, workflow_instance_id);

CREATE INDEX ix_workflow_step_instances_workflow_step_id ON workflow_step_instances (tenant_id, workflow_step_id);

CREATE INDEX ix_workflow_step_instances_assigned_to ON workflow_step_instances (tenant_id, assigned_to);

CREATE INDEX ix_approval_requests_workflow_step_instance_id ON approval_requests (tenant_id, workflow_step_instance_id);

CREATE INDEX ix_approval_requests_requester_id ON approval_requests (tenant_id, requester_id);

CREATE INDEX ix_approval_decisions_approval_request_id ON approval_decisions (tenant_id, approval_request_id);

CREATE INDEX ix_approval_decisions_decided_by ON approval_decisions (tenant_id, decided_by);

CREATE INDEX ix_approval_decisions_delegation_id ON approval_decisions (tenant_id, delegation_id);

CREATE INDEX ix_work_items_workflow_instance_id ON work_items (tenant_id, workflow_instance_id);

CREATE INDEX ix_work_items_assigned_to ON work_items (tenant_id, assigned_to);

CREATE INDEX ix_work_items_assigned_role_id ON work_items (tenant_id, assigned_role_id);

CREATE INDEX ix_inbox_entries_work_item_id ON inbox_entries (tenant_id, work_item_id);

CREATE INDEX ix_notification_templates_author_user_id ON notification_templates (tenant_id, author_user_id);

CREATE INDEX ix_notifications_template_id ON notifications (tenant_id, template_id);

CREATE INDEX ix_notifications_recipient_user_id ON notifications (tenant_id, recipient_user_id);

CREATE INDEX ix_notifications_workflow_instance_id ON notifications (tenant_id, workflow_instance_id);

CREATE INDEX ix_notification_preferences_template_id ON notification_preferences (tenant_id, template_id);

CREATE INDEX ix_work_calendars_legal_entity_id ON work_calendars (tenant_id, legal_entity_id);

CREATE INDEX ix_work_calendars_location_id ON work_calendars (tenant_id, location_id);

CREATE INDEX ix_work_calendars_author_user_id ON work_calendars (tenant_id, author_user_id);

CREATE INDEX ix_holidays_work_calendar_id ON holidays (tenant_id, work_calendar_id);

CREATE INDEX ix_holidays_jurisdiction_id ON holidays (tenant_id, jurisdiction_id);

CREATE INDEX ix_shift_templates_legal_entity_id ON shift_templates (tenant_id, legal_entity_id);

CREATE INDEX ix_shift_templates_author_user_id ON shift_templates (tenant_id, author_user_id);

CREATE INDEX ix_shift_breaks_shift_template_id ON shift_breaks (tenant_id, shift_template_id);

CREATE INDEX ix_shift_rosters_organization_unit_id ON shift_rosters (tenant_id, organization_unit_id);

CREATE INDEX ix_shift_rosters_work_calendar_id ON shift_rosters (tenant_id, work_calendar_id);

CREATE INDEX ix_shift_assignments_shift_roster_id ON shift_assignments (tenant_id, shift_roster_id);

CREATE INDEX ix_shift_assignments_shift_template_id ON shift_assignments (tenant_id, shift_template_id);

CREATE INDEX ix_shift_assignments_location_id ON shift_assignments (tenant_id, location_id);

CREATE INDEX ix_shift_swaps_requested_by ON shift_swaps (tenant_id, requested_by);

CREATE INDEX ix_shift_swaps_original_assignment_id ON shift_swaps (tenant_id, original_assignment_id);

CREATE INDEX ix_shift_swaps_replacement_assignment_id ON shift_swaps (tenant_id, replacement_assignment_id);

CREATE INDEX ix_shift_swaps_approval_request_id ON shift_swaps (tenant_id, approval_request_id);

CREATE INDEX ix_attendance_devices_location_id ON attendance_devices (tenant_id, location_id);

CREATE INDEX ix_attendance_events_employee_id ON attendance_events (tenant_id, employee_id);

CREATE INDEX ix_attendance_events_device_id ON attendance_events (tenant_id, device_id);

CREATE INDEX ix_attendance_events_location_id ON attendance_events (tenant_id, location_id);

CREATE INDEX ix_attendance_days_shift_assignment_id ON attendance_days (tenant_id, shift_assignment_id);

CREATE INDEX ix_attendance_segments_attendance_day_id ON attendance_segments (tenant_id, attendance_day_id);

CREATE INDEX ix_attendance_segments_start_event_id ON attendance_segments (tenant_id, start_event_id);

CREATE INDEX ix_attendance_segments_end_event_id ON attendance_segments (tenant_id, end_event_id);

CREATE INDEX ix_attendance_exceptions_attendance_day_id ON attendance_exceptions (tenant_id, attendance_day_id);

CREATE INDEX ix_attendance_exceptions_work_item_id ON attendance_exceptions (tenant_id, work_item_id);

CREATE INDEX ix_attendance_regularizations_attendance_day_id ON attendance_regularizations (tenant_id, attendance_day_id);

CREATE INDEX ix_attendance_regularizations_requested_by ON attendance_regularizations (tenant_id, requested_by);

CREATE INDEX ix_attendance_regularizations_approval_request_id ON attendance_regularizations (tenant_id, approval_request_id);

CREATE INDEX ix_time_policies_legal_entity_id ON time_policies (tenant_id, legal_entity_id);

CREATE INDEX ix_time_policies_author_user_id ON time_policies (tenant_id, author_user_id);

CREATE INDEX ix_employee_time_policies_time_policy_id ON employee_time_policies (tenant_id, time_policy_id);

CREATE INDEX ix_leave_types_legal_entity_id ON leave_types (tenant_id, legal_entity_id);

CREATE INDEX ix_leave_types_author_user_id ON leave_types (tenant_id, author_user_id);

CREATE INDEX ix_leave_policies_leave_type_id ON leave_policies (tenant_id, leave_type_id);

CREATE INDEX ix_leave_policies_legal_entity_id ON leave_policies (tenant_id, legal_entity_id);

CREATE INDEX ix_leave_policies_author_user_id ON leave_policies (tenant_id, author_user_id);

CREATE INDEX ix_leave_policy_assignments_leave_policy_id ON leave_policy_assignments (tenant_id, leave_policy_id);

CREATE INDEX ix_leave_balances_leave_policy_id ON leave_balances (tenant_id, leave_policy_id);

CREATE INDEX ix_leave_transactions_leave_balance_id ON leave_transactions (tenant_id, leave_balance_id);

CREATE INDEX ix_leave_transactions_leave_request_id ON leave_transactions (tenant_id, leave_request_id);

CREATE INDEX ix_leave_requests_employee_id ON leave_requests (tenant_id, employee_id);

CREATE INDEX ix_leave_requests_leave_type_id ON leave_requests (tenant_id, leave_type_id);

CREATE INDEX ix_leave_requests_approval_request_id ON leave_requests (tenant_id, approval_request_id);

CREATE INDEX ix_leave_request_days_attendance_day_id ON leave_request_days (tenant_id, attendance_day_id);

CREATE INDEX ix_overtime_policies_legal_entity_id ON overtime_policies (tenant_id, legal_entity_id);

CREATE INDEX ix_overtime_policies_author_user_id ON overtime_policies (tenant_id, author_user_id);

CREATE INDEX ix_overtime_requests_employee_id ON overtime_requests (tenant_id, employee_id);

CREATE INDEX ix_overtime_requests_overtime_policy_id ON overtime_requests (tenant_id, overtime_policy_id);

CREATE INDEX ix_overtime_requests_approval_request_id ON overtime_requests (tenant_id, approval_request_id);

CREATE INDEX ix_overtime_entries_overtime_request_id ON overtime_entries (tenant_id, overtime_request_id);

CREATE INDEX ix_overtime_entries_attendance_day_id ON overtime_entries (tenant_id, attendance_day_id);

CREATE INDEX ix_gate_pass_requests_employee_id ON gate_pass_requests (tenant_id, employee_id);

CREATE INDEX ix_gate_pass_requests_location_id ON gate_pass_requests (tenant_id, location_id);

CREATE INDEX ix_gate_pass_requests_approval_request_id ON gate_pass_requests (tenant_id, approval_request_id);

CREATE INDEX ix_gate_pass_events_gate_pass_request_id ON gate_pass_events (tenant_id, gate_pass_request_id);

CREATE INDEX ix_gate_pass_events_device_id ON gate_pass_events (tenant_id, device_id);

CREATE INDEX ix_time_period_locks_legal_entity_id ON time_period_locks (tenant_id, legal_entity_id);

CREATE INDEX ix_time_period_locks_locked_by ON time_period_locks (tenant_id, locked_by);

CREATE INDEX ix_pay_groups_legal_entity_id ON pay_groups (tenant_id, legal_entity_id);

CREATE INDEX ix_pay_groups_author_user_id ON pay_groups (tenant_id, author_user_id);

CREATE INDEX ix_employee_pay_group_assignments_pay_group_id ON employee_pay_group_assignments (tenant_id, pay_group_id);

CREATE INDEX ix_payroll_runs_approval_request_id ON payroll_runs (tenant_id, approval_request_id);

CREATE INDEX ix_payroll_run_employees_employee_id ON payroll_run_employees (tenant_id, employee_id);

CREATE INDEX ix_pay_components_legal_entity_id ON pay_components (tenant_id, legal_entity_id);

CREATE INDEX ix_pay_components_author_user_id ON pay_components (tenant_id, author_user_id);

CREATE INDEX ix_pay_component_rules_pay_component_id ON pay_component_rules (tenant_id, pay_component_id);

CREATE INDEX ix_pay_component_rules_author_user_id ON pay_component_rules (tenant_id, author_user_id);

CREATE INDEX ix_employee_pay_components_employee_id ON employee_pay_components (tenant_id, employee_id);

CREATE INDEX ix_employee_pay_components_pay_component_id ON employee_pay_components (tenant_id, pay_component_id);

CREATE INDEX ix_payroll_inputs_payroll_run_employee_id ON payroll_inputs (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_payroll_inputs_pay_component_id ON payroll_inputs (tenant_id, pay_component_id);

CREATE INDEX ix_payroll_attendance_inputs_attendance_day_id ON payroll_attendance_inputs (tenant_id, attendance_day_id);

CREATE INDEX ix_payroll_overtime_inputs_overtime_entry_id ON payroll_overtime_inputs (tenant_id, overtime_entry_id);

CREATE INDEX ix_payroll_leave_inputs_leave_request_day_id ON payroll_leave_inputs (tenant_id, leave_request_day_id);

CREATE INDEX ix_payroll_results_payroll_run_employee_id ON payroll_results (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_payroll_results_pay_component_id ON payroll_results (tenant_id, pay_component_id);

CREATE INDEX ix_payroll_adjustments_payroll_run_employee_id ON payroll_adjustments (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_payroll_adjustments_pay_component_id ON payroll_adjustments (tenant_id, pay_component_id);

CREATE INDEX ix_payroll_adjustments_approval_request_id ON payroll_adjustments (tenant_id, approval_request_id);

CREATE INDEX ix_payroll_arrears_payroll_run_employee_id ON payroll_arrears (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_payroll_arrears_original_result_id ON payroll_arrears (tenant_id, original_result_id);

CREATE INDEX ix_payroll_arrears_pay_component_id ON payroll_arrears (tenant_id, pay_component_id);

CREATE INDEX ix_payslips_document_id ON payslips (tenant_id, document_id);

CREATE INDEX ix_loan_types_legal_entity_id ON loan_types (tenant_id, legal_entity_id);

CREATE INDEX ix_loan_types_author_user_id ON loan_types (tenant_id, author_user_id);

CREATE INDEX ix_employee_loans_employee_id ON employee_loans (tenant_id, employee_id);

CREATE INDEX ix_employee_loans_loan_type_id ON employee_loans (tenant_id, loan_type_id);

CREATE INDEX ix_employee_loans_approval_request_id ON employee_loans (tenant_id, approval_request_id);

CREATE INDEX ix_loan_repayments_loan_installment_id ON loan_repayments (tenant_id, loan_installment_id);

CREATE INDEX ix_loan_repayments_payroll_result_id ON loan_repayments (tenant_id, payroll_result_id);

CREATE INDEX ix_salary_advances_employee_id ON salary_advances (tenant_id, employee_id);

CREATE INDEX ix_salary_advances_approval_request_id ON salary_advances (tenant_id, approval_request_id);

CREATE INDEX ix_salary_advances_payroll_run_employee_id ON salary_advances (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_statutory_schemes_jurisdiction_id ON statutory_schemes (tenant_id, jurisdiction_id);

CREATE INDEX ix_statutory_schemes_author_user_id ON statutory_schemes (tenant_id, author_user_id);

CREATE INDEX ix_statutory_rates_statutory_scheme_id ON statutory_rates (tenant_id, statutory_scheme_id);

CREATE INDEX ix_statutory_rates_author_user_id ON statutory_rates (tenant_id, author_user_id);

CREATE INDEX ix_employee_statutory_enrollments_statutory_scheme_id ON employee_statutory_enrollments (tenant_id, statutory_scheme_id);

CREATE INDEX ix_statutory_contributions_payroll_run_employee_id ON statutory_contributions (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_statutory_contributions_enrollment_id ON statutory_contributions (tenant_id, enrollment_id);

CREATE INDEX ix_statutory_contributions_statutory_rate_id ON statutory_contributions (tenant_id, statutory_rate_id);

CREATE INDEX ix_tax_declarations_jurisdiction_id ON tax_declarations (tenant_id, jurisdiction_id);

CREATE INDEX ix_tax_declaration_items_tax_declaration_id ON tax_declaration_items (tenant_id, tax_declaration_id);

CREATE INDEX ix_tax_declaration_items_document_id ON tax_declaration_items (tenant_id, document_id);

CREATE INDEX ix_tax_withholdings_payroll_run_employee_id ON tax_withholdings (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_tax_withholdings_tax_declaration_id ON tax_withholdings (tenant_id, tax_declaration_id);

CREATE INDEX ix_tax_withholdings_jurisdiction_id ON tax_withholdings (tenant_id, jurisdiction_id);

CREATE INDEX ix_statutory_filings_legal_entity_id ON statutory_filings (tenant_id, legal_entity_id);

CREATE INDEX ix_statutory_filings_statutory_scheme_id ON statutory_filings (tenant_id, statutory_scheme_id);

CREATE INDEX ix_statutory_filings_evidence_id ON statutory_filings (tenant_id, evidence_id);

CREATE INDEX ix_statutory_form_serials_register ON statutory_form_serials (tenant_id, form_code, establishment_key, serial_number);

CREATE UNIQUE INDEX ux_statutory_form_serials_instance ON statutory_form_serials (tenant_id, statutory_instance_id) WHERE statutory_instance_id IS NOT NULL;

CREATE INDEX ix_statutory_form_serials_employee_id ON statutory_form_serials (tenant_id, employee_id);

CREATE INDEX ix_statutory_filing_lines_statutory_contribution_id ON statutory_filing_lines (tenant_id, statutory_contribution_id);

CREATE INDEX ix_gl_accounts_legal_entity_id ON gl_accounts (tenant_id, legal_entity_id);

CREATE INDEX ix_gl_accounts_parent_account_id ON gl_accounts (tenant_id, parent_account_id);

CREATE INDEX ix_gl_accounts_author_user_id ON gl_accounts (tenant_id, author_user_id);

CREATE INDEX ix_pay_component_gl_mappings_pay_component_id ON pay_component_gl_mappings (tenant_id, pay_component_id);

CREATE INDEX ix_pay_component_gl_mappings_gl_account_id ON pay_component_gl_mappings (tenant_id, gl_account_id);

CREATE INDEX ix_pay_component_gl_mappings_cost_center_id ON pay_component_gl_mappings (tenant_id, cost_center_id);

CREATE INDEX ix_payroll_journals_payroll_run_id ON payroll_journals (tenant_id, payroll_run_id);

CREATE INDEX ix_payroll_journals_legal_entity_id ON payroll_journals (tenant_id, legal_entity_id);

CREATE INDEX ix_payroll_journal_lines_payroll_journal_id ON payroll_journal_lines (tenant_id, payroll_journal_id);

CREATE INDEX ix_payroll_journal_lines_gl_account_id ON payroll_journal_lines (tenant_id, gl_account_id);

CREATE INDEX ix_payroll_journal_lines_cost_center_id ON payroll_journal_lines (tenant_id, cost_center_id);

CREATE INDEX ix_payroll_journal_lines_payroll_result_id ON payroll_journal_lines (tenant_id, payroll_result_id);

CREATE INDEX ix_disbursement_batches_payroll_run_id ON disbursement_batches (tenant_id, payroll_run_id);

CREATE INDEX ix_disbursement_batches_entity_bank_account_id ON disbursement_batches (tenant_id, entity_bank_account_id);

CREATE INDEX ix_disbursement_batches_approval_request_id ON disbursement_batches (tenant_id, approval_request_id);

CREATE INDEX ix_disbursement_items_disbursement_batch_id ON disbursement_items (tenant_id, disbursement_batch_id);

CREATE INDEX ix_disbursement_items_payroll_run_employee_id ON disbursement_items (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_disbursement_items_employee_bank_account_id ON disbursement_items (tenant_id, employee_bank_account_id);

CREATE INDEX ix_payment_reconciliations_disbursement_item_id ON payment_reconciliations (tenant_id, disbursement_item_id);

CREATE INDEX ix_payment_reconciliations_reconciled_by ON payment_reconciliations (tenant_id, reconciled_by);

CREATE INDEX ix_payroll_cases_employee_id ON payroll_cases (tenant_id, employee_id);

CREATE INDEX ix_payroll_cases_payroll_run_id ON payroll_cases (tenant_id, payroll_run_id);

CREATE INDEX ix_payroll_cases_work_item_id ON payroll_cases (tenant_id, work_item_id);

CREATE INDEX ix_final_settlements_employee_id ON final_settlements (tenant_id, employee_id);

CREATE INDEX ix_final_settlements_payroll_run_employee_id ON final_settlements (tenant_id, payroll_run_employee_id);

CREATE INDEX ix_payroll_exports_payroll_run_id ON payroll_exports (tenant_id, payroll_run_id);

CREATE INDEX ix_payroll_exports_integration_job_id ON payroll_exports (tenant_id, integration_job_id);

CREATE INDEX ix_payroll_exports_document_id ON payroll_exports (tenant_id, document_id);

CREATE INDEX ix_payroll_audit_entries_payroll_run_id ON payroll_audit_entries (tenant_id, payroll_run_id);

CREATE INDEX ix_payroll_audit_entries_actor_id ON payroll_audit_entries (tenant_id, actor_id);

CREATE INDEX ix_payroll_audit_entries_audit_event_id ON payroll_audit_entries (tenant_id, audit_event_id);

CREATE INDEX ix_requisition_templates_job_profile_id ON requisition_templates (tenant_id, job_profile_id);

CREATE INDEX ix_requisition_templates_legal_entity_id ON requisition_templates (tenant_id, legal_entity_id);

CREATE INDEX ix_requisition_templates_author_user_id ON requisition_templates (tenant_id, author_user_id);

CREATE INDEX ix_job_requisitions_position_id ON job_requisitions (tenant_id, position_id);

CREATE INDEX ix_job_requisitions_hiring_manager_id ON job_requisitions (tenant_id, hiring_manager_id);

CREATE INDEX ix_job_requisitions_approval_request_id ON job_requisitions (tenant_id, approval_request_id);

CREATE INDEX ix_job_requisitions_author_user_id ON job_requisitions (tenant_id, author_user_id);

CREATE INDEX ix_requisition_approvers_approver_id ON requisition_approvers (tenant_id, approver_id);

CREATE INDEX ix_job_postings_job_requisition_id ON job_postings (tenant_id, job_requisition_id);

CREATE INDEX ix_job_postings_location_id ON job_postings (tenant_id, location_id);

CREATE INDEX ix_job_posting_publications_posting_channel_id ON job_posting_publications (tenant_id, posting_channel_id);

CREATE INDEX ix_candidates_person_id ON candidates (tenant_id, person_id);

CREATE INDEX ix_candidates_candidate_source_id ON candidates (tenant_id, candidate_source_id);

CREATE INDEX ix_candidate_documents_document_id ON candidate_documents (tenant_id, document_id);

CREATE INDEX ix_candidate_consents_candidate_id ON candidate_consents (tenant_id, candidate_id);

CREATE INDEX ix_applications_candidate_id ON applications (tenant_id, candidate_id);

CREATE INDEX ix_applications_job_requisition_id ON applications (tenant_id, job_requisition_id);

CREATE INDEX ix_applications_job_posting_id ON applications (tenant_id, job_posting_id);

CREATE INDEX ix_application_stage_definitions_requisition_template_id ON application_stage_definitions (tenant_id, requisition_template_id);

CREATE INDEX ix_application_stage_history_application_id ON application_stage_history (tenant_id, application_id);

CREATE INDEX ix_application_stage_history_stage_id ON application_stage_history (tenant_id, stage_id);

CREATE INDEX ix_application_stage_history_changed_by ON application_stage_history (tenant_id, changed_by);

CREATE INDEX ix_screening_questions_job_requisition_id ON screening_questions (tenant_id, job_requisition_id);

CREATE INDEX ix_screening_answers_screening_question_id ON screening_answers (tenant_id, screening_question_id);

CREATE INDEX ix_interview_templates_job_profile_id ON interview_templates (tenant_id, job_profile_id);

CREATE INDEX ix_interviews_application_id ON interviews (tenant_id, application_id);

CREATE INDEX ix_interviews_interview_template_id ON interviews (tenant_id, interview_template_id);

CREATE INDEX ix_interview_panelists_employee_id ON interview_panelists (tenant_id, employee_id);

CREATE INDEX ix_assessment_definitions_job_profile_id ON assessment_definitions (tenant_id, job_profile_id);

CREATE INDEX ix_candidate_assessments_application_id ON candidate_assessments (tenant_id, application_id);

CREATE INDEX ix_candidate_assessments_assessment_definition_id ON candidate_assessments (tenant_id, assessment_definition_id);

CREATE INDEX ix_offer_templates_legal_entity_id ON offer_templates (tenant_id, legal_entity_id);

CREATE INDEX ix_offer_templates_author_user_id ON offer_templates (tenant_id, author_user_id);

CREATE INDEX ix_offers_application_id ON offers (tenant_id, application_id);

CREATE INDEX ix_offers_offer_template_id ON offers (tenant_id, offer_template_id);

CREATE INDEX ix_offers_approval_request_id ON offers (tenant_id, approval_request_id);

CREATE INDEX ix_offer_components_pay_component_id ON offer_components (tenant_id, pay_component_id);

CREATE INDEX ix_offer_acceptances_signed_document_id ON offer_acceptances (tenant_id, signed_document_id);

CREATE INDEX ix_background_check_types_jurisdiction_id ON background_check_types (tenant_id, jurisdiction_id);

CREATE INDEX ix_background_checks_candidate_id ON background_checks (tenant_id, candidate_id);

CREATE INDEX ix_background_checks_check_type_id ON background_checks (tenant_id, check_type_id);

CREATE INDEX ix_background_checks_evidence_document_id ON background_checks (tenant_id, evidence_document_id);

CREATE INDEX ix_onboarding_templates_legal_entity_id ON onboarding_templates (tenant_id, legal_entity_id);

CREATE INDEX ix_onboarding_templates_job_profile_id ON onboarding_templates (tenant_id, job_profile_id);

CREATE INDEX ix_onboarding_templates_author_user_id ON onboarding_templates (tenant_id, author_user_id);

CREATE INDEX ix_onboarding_template_tasks_onboarding_template_id ON onboarding_template_tasks (tenant_id, onboarding_template_id);

CREATE INDEX ix_onboarding_template_tasks_owner_role_id ON onboarding_template_tasks (tenant_id, owner_role_id);

CREATE INDEX ix_onboarding_cases_employee_id ON onboarding_cases (tenant_id, employee_id);

CREATE INDEX ix_onboarding_cases_onboarding_template_id ON onboarding_cases (tenant_id, onboarding_template_id);

CREATE INDEX ix_onboarding_cases_offer_id ON onboarding_cases (tenant_id, offer_id);

CREATE INDEX ix_onboarding_tasks_template_task_id ON onboarding_tasks (tenant_id, template_task_id);

CREATE INDEX ix_onboarding_tasks_work_item_id ON onboarding_tasks (tenant_id, work_item_id);

CREATE INDEX ix_probation_reviews_employee_id ON probation_reviews (tenant_id, employee_id);

CREATE INDEX ix_probation_reviews_reviewer_id ON probation_reviews (tenant_id, reviewer_id);

CREATE INDEX ix_probation_reviews_approval_request_id ON probation_reviews (tenant_id, approval_request_id);

CREATE INDEX ix_employee_transfers_employee_id ON employee_transfers (tenant_id, employee_id);

CREATE INDEX ix_employee_transfers_from_assignment_id ON employee_transfers (tenant_id, from_assignment_id);

CREATE INDEX ix_employee_transfers_to_assignment_id ON employee_transfers (tenant_id, to_assignment_id);

CREATE INDEX ix_employee_transfers_approval_request_id ON employee_transfers (tenant_id, approval_request_id);

CREATE INDEX ix_employee_promotions_employee_id ON employee_promotions (tenant_id, employee_id);

CREATE INDEX ix_employee_promotions_from_grade_id ON employee_promotions (tenant_id, from_grade_id);

CREATE INDEX ix_employee_promotions_to_grade_id ON employee_promotions (tenant_id, to_grade_id);

CREATE INDEX ix_employee_promotions_approval_request_id ON employee_promotions (tenant_id, approval_request_id);

CREATE INDEX ix_separations_employee_id ON separations (tenant_id, employee_id);

CREATE INDEX ix_separations_approval_request_id ON separations (tenant_id, approval_request_id);

CREATE INDEX ix_exit_interviews_interviewer_id ON exit_interviews (tenant_id, interviewer_id);

CREATE INDEX ix_clearance_tasks_separation_id ON clearance_tasks (tenant_id, separation_id);

CREATE INDEX ix_clearance_tasks_owner_employee_id ON clearance_tasks (tenant_id, owner_employee_id);

CREATE INDEX ix_clearance_tasks_work_item_id ON clearance_tasks (tenant_id, work_item_id);

CREATE INDEX ix_alumni_profiles_person_id ON alumni_profiles (tenant_id, person_id);

CREATE INDEX ix_rehire_cases_alumni_profile_id ON rehire_cases (tenant_id, alumni_profile_id);

CREATE INDEX ix_rehire_cases_job_requisition_id ON rehire_cases (tenant_id, job_requisition_id);

CREATE INDEX ix_rehire_cases_approval_request_id ON rehire_cases (tenant_id, approval_request_id);

CREATE INDEX ix_performance_cycles_legal_entity_id ON performance_cycles (tenant_id, legal_entity_id);

CREATE INDEX ix_performance_cycles_author_user_id ON performance_cycles (tenant_id, author_user_id);

CREATE INDEX ix_performance_templates_job_profile_id ON performance_templates (tenant_id, job_profile_id);

CREATE INDEX ix_performance_templates_author_user_id ON performance_templates (tenant_id, author_user_id);

CREATE INDEX ix_performance_reviews_employee_id ON performance_reviews (tenant_id, employee_id);

CREATE INDEX ix_performance_reviews_performance_template_id ON performance_reviews (tenant_id, performance_template_id);

CREATE INDEX ix_performance_reviews_workflow_instance_id ON performance_reviews (tenant_id, workflow_instance_id);

CREATE INDEX ix_performance_reviewers_reviewer_employee_id ON performance_reviewers (tenant_id, reviewer_employee_id);

CREATE INDEX ix_performance_ratings_template_section_id ON performance_ratings (tenant_id, template_section_id);

CREATE INDEX ix_goals_employee_id ON goals (tenant_id, employee_id);

CREATE INDEX ix_goals_performance_cycle_id ON goals (tenant_id, performance_cycle_id);

CREATE INDEX ix_goals_parent_goal_id ON goals (tenant_id, parent_goal_id);

CREATE INDEX ix_goal_key_results_goal_id ON goal_key_results (tenant_id, goal_id);

CREATE INDEX ix_goal_checkins_goal_id ON goal_checkins (tenant_id, goal_id);

CREATE INDEX ix_goal_checkins_author_employee_id ON goal_checkins (tenant_id, author_employee_id);

CREATE INDEX ix_feedback_requests_subject_employee_id ON feedback_requests (tenant_id, subject_employee_id);

CREATE INDEX ix_feedback_requests_requester_employee_id ON feedback_requests (tenant_id, requester_employee_id);

CREATE INDEX ix_feedback_requests_performance_review_id ON feedback_requests (tenant_id, performance_review_id);

CREATE INDEX ix_feedback_responses_responder_employee_id ON feedback_responses (tenant_id, responder_employee_id);

CREATE INDEX ix_calibration_sessions_performance_cycle_id ON calibration_sessions (tenant_id, performance_cycle_id);

CREATE INDEX ix_calibration_sessions_facilitator_id ON calibration_sessions (tenant_id, facilitator_id);

CREATE INDEX ix_calibration_entries_performance_review_id ON calibration_entries (tenant_id, performance_review_id);

CREATE INDEX ix_skill_categories_parent_category_id ON skill_categories (tenant_id, parent_category_id);

CREATE INDEX ix_skills_skill_category_id ON skills (tenant_id, skill_category_id);

CREATE INDEX ix_skills_author_user_id ON skills (tenant_id, author_user_id);

CREATE INDEX ix_job_profile_skills_skill_id ON job_profile_skills (tenant_id, skill_id);

CREATE INDEX ix_job_profile_skills_required_level_id ON job_profile_skills (tenant_id, skill_id, required_level_id);

CREATE INDEX ix_employee_skills_skill_id ON employee_skills (tenant_id, skill_id);

CREATE INDEX ix_employee_skills_skill_level_id ON employee_skills (tenant_id, skill_id, skill_level_id);

CREATE INDEX ix_skill_assessments_employee_skill_id ON skill_assessments (tenant_id, employee_skill_id);

CREATE INDEX ix_skill_assessments_assessor_id ON skill_assessments (tenant_id, assessor_id);

CREATE INDEX ix_skill_assessments_candidate_assessment_id ON skill_assessments (tenant_id, candidate_assessment_id);

CREATE INDEX ix_development_plans_employee_id ON development_plans (tenant_id, employee_id);

CREATE INDEX ix_development_plans_mentor_employee_id ON development_plans (tenant_id, mentor_employee_id);

CREATE INDEX ix_development_plans_performance_review_id ON development_plans (tenant_id, performance_review_id);

CREATE INDEX ix_development_actions_development_plan_id ON development_actions (tenant_id, development_plan_id);

CREATE INDEX ix_development_actions_skill_id ON development_actions (tenant_id, skill_id);

CREATE INDEX ix_development_actions_work_item_id ON development_actions (tenant_id, work_item_id);

CREATE INDEX ix_succession_plans_position_id ON succession_plans (tenant_id, position_id);

CREATE INDEX ix_succession_plans_owner_employee_id ON succession_plans (tenant_id, owner_employee_id);

CREATE INDEX ix_succession_candidates_employee_id ON succession_candidates (tenant_id, employee_id);

CREATE INDEX ix_succession_candidates_development_plan_id ON succession_candidates (tenant_id, development_plan_id);

CREATE INDEX ix_talent_pools_owner_employee_id ON talent_pools (tenant_id, owner_employee_id);

CREATE INDEX ix_talent_pool_members_employee_id ON talent_pool_members (tenant_id, employee_id);

CREATE INDEX ix_courses_learning_provider_id ON courses (tenant_id, learning_provider_id);

CREATE INDEX ix_courses_author_user_id ON courses (tenant_id, author_user_id);

CREATE INDEX ix_course_skills_skill_id ON course_skills (tenant_id, skill_id);

CREATE INDEX ix_course_skills_target_level_id ON course_skills (tenant_id, skill_id, target_level_id);

CREATE INDEX ix_learning_paths_job_profile_id ON learning_paths (tenant_id, job_profile_id);

CREATE INDEX ix_learning_path_courses_course_id ON learning_path_courses (tenant_id, course_id);

CREATE INDEX ix_course_sessions_course_id ON course_sessions (tenant_id, course_id);

CREATE INDEX ix_course_sessions_location_id ON course_sessions (tenant_id, location_id);

CREATE INDEX ix_course_sessions_instructor_employee_id ON course_sessions (tenant_id, instructor_employee_id);

CREATE INDEX ix_learning_enrollments_employee_id ON learning_enrollments (tenant_id, employee_id);

CREATE INDEX ix_learning_enrollments_course_id ON learning_enrollments (tenant_id, course_id);

CREATE INDEX ix_learning_enrollments_course_session_id ON learning_enrollments (tenant_id, course_session_id);

CREATE INDEX ix_learning_enrollments_work_item_id ON learning_enrollments (tenant_id, work_item_id);

CREATE INDEX ix_certifications_skill_id ON certifications (tenant_id, skill_id);

CREATE INDEX ix_employee_certifications_employee_id ON employee_certifications (tenant_id, employee_id);

CREATE INDEX ix_employee_certifications_certification_id ON employee_certifications (tenant_id, certification_id);

CREATE INDEX ix_employee_certifications_document_id ON employee_certifications (tenant_id, document_id);

CREATE INDEX ix_compensation_plans_legal_entity_id ON compensation_plans (tenant_id, legal_entity_id);

CREATE INDEX ix_compensation_plans_author_user_id ON compensation_plans (tenant_id, author_user_id);

CREATE INDEX ix_salary_bands_grade_id ON salary_bands (tenant_id, grade_id);

CREATE INDEX ix_salary_bands_location_id ON salary_bands (tenant_id, location_id);

CREATE INDEX ix_employee_compensation_compensation_plan_id ON employee_compensation (tenant_id, compensation_plan_id);

CREATE INDEX ix_employee_compensation_salary_band_id ON employee_compensation (tenant_id, compensation_plan_id, salary_band_id);

CREATE INDEX ix_employee_compensation_source_payroll_result_id ON employee_compensation (tenant_id, source_payroll_result_id);

CREATE INDEX ix_compensation_review_cycles_compensation_plan_id ON compensation_review_cycles (tenant_id, compensation_plan_id);

CREATE INDEX ix_compensation_review_proposals_employee_compensation_id ON compensation_review_proposals (tenant_id, employee_compensation_id);

CREATE INDEX ix_compensation_review_proposals_approval_request_id ON compensation_review_proposals (tenant_id, approval_request_id);

CREATE INDEX ix_benefit_plans_legal_entity_id ON benefit_plans (tenant_id, legal_entity_id);

CREATE INDEX ix_benefit_plans_author_user_id ON benefit_plans (tenant_id, author_user_id);

CREATE INDEX ix_benefit_eligibility_rules_benefit_plan_id ON benefit_eligibility_rules (tenant_id, benefit_plan_id);

CREATE INDEX ix_benefit_eligibility_rules_grade_id ON benefit_eligibility_rules (tenant_id, grade_id);

CREATE INDEX ix_benefit_eligibility_rules_location_id ON benefit_eligibility_rules (tenant_id, location_id);

CREATE INDEX ix_benefit_enrollments_employee_id ON benefit_enrollments (tenant_id, employee_id);

CREATE INDEX ix_benefit_enrollments_benefit_option_id ON benefit_enrollments (tenant_id, benefit_option_id);

CREATE INDEX ix_benefit_dependents_person_dependent_id ON benefit_dependents (tenant_id, person_dependent_id);

CREATE INDEX ix_benefit_claims_benefit_enrollment_id ON benefit_claims (tenant_id, benefit_enrollment_id);

CREATE INDEX ix_benefit_claims_document_id ON benefit_claims (tenant_id, document_id);

CREATE INDEX ix_benefit_claims_approval_request_id ON benefit_claims (tenant_id, approval_request_id);

CREATE INDEX ix_survey_templates_owner_user_id ON survey_templates (tenant_id, owner_user_id);

CREATE INDEX ix_survey_campaigns_survey_template_id ON survey_campaigns (tenant_id, survey_template_id);

CREATE INDEX ix_survey_campaigns_legal_entity_id ON survey_campaigns (tenant_id, legal_entity_id);

CREATE INDEX ix_survey_audiences_organization_unit_id ON survey_audiences (tenant_id, organization_unit_id);

CREATE INDEX ix_survey_invitations_employee_id ON survey_invitations (tenant_id, employee_id);

CREATE INDEX ix_survey_answers_survey_question_id ON survey_answers (tenant_id, survey_question_id);

CREATE INDEX ix_survey_answers_selected_option_id ON survey_answers (tenant_id, survey_question_id, selected_option_id);

CREATE INDEX ix_pulse_campaigns_survey_template_id ON pulse_campaigns (tenant_id, survey_template_id);

CREATE INDEX ix_pulse_campaigns_organization_unit_id ON pulse_campaigns (tenant_id, organization_unit_id);

CREATE INDEX ix_pulse_responses_pulse_campaign_id ON pulse_responses (tenant_id, pulse_campaign_id);

CREATE INDEX ix_pulse_responses_employee_id ON pulse_responses (tenant_id, employee_id);

CREATE INDEX ix_engagement_scores_organization_unit_id ON engagement_scores (tenant_id, organization_unit_id);

CREATE INDEX ix_engagement_scores_survey_campaign_id ON engagement_scores (tenant_id, survey_campaign_id);

CREATE INDEX ix_recognition_programs_legal_entity_id ON recognition_programs (tenant_id, legal_entity_id);

CREATE INDEX ix_recognition_badges_recognition_program_id ON recognition_badges (tenant_id, recognition_program_id);

CREATE INDEX ix_recognitions_recognition_badge_id ON recognitions (tenant_id, recognition_badge_id);

CREATE INDEX ix_recognitions_giver_employee_id ON recognitions (tenant_id, giver_employee_id);

CREATE INDEX ix_recognitions_recipient_employee_id ON recognitions (tenant_id, recipient_employee_id);

CREATE INDEX ix_recognition_reactions_employee_id ON recognition_reactions (tenant_id, employee_id);

CREATE INDEX ix_reward_catalog_items_recognition_program_id ON reward_catalog_items (tenant_id, recognition_program_id);

CREATE INDEX ix_reward_redemptions_reward_catalog_item_id ON reward_redemptions (tenant_id, reward_catalog_item_id);

CREATE INDEX ix_reward_redemptions_employee_id ON reward_redemptions (tenant_id, employee_id);

CREATE INDEX ix_employee_suggestions_employee_id ON employee_suggestions (tenant_id, employee_id);

CREATE INDEX ix_employee_suggestions_organization_unit_id ON employee_suggestions (tenant_id, organization_unit_id);

CREATE INDEX ix_suggestion_votes_employee_id ON suggestion_votes (tenant_id, employee_id);

CREATE INDEX ix_grievance_categories_legal_entity_id ON grievance_categories (tenant_id, legal_entity_id);

CREATE INDEX ix_grievances_grievance_category_id ON grievances (tenant_id, grievance_category_id);

CREATE INDEX ix_grievances_employee_id ON grievances (tenant_id, employee_id);

CREATE INDEX ix_grievances_assigned_to ON grievances (tenant_id, assigned_to);

CREATE INDEX ix_grievance_actions_grievance_id ON grievance_actions (tenant_id, grievance_id);

CREATE INDEX ix_grievance_actions_actor_id ON grievance_actions (tenant_id, actor_id);

CREATE INDEX ix_wellbeing_programs_legal_entity_id ON wellbeing_programs (tenant_id, legal_entity_id);

CREATE INDEX ix_wellbeing_enrollments_wellbeing_program_id ON wellbeing_enrollments (tenant_id, wellbeing_program_id);

CREATE INDEX ix_wellbeing_enrollments_employee_id ON wellbeing_enrollments (tenant_id, employee_id);

CREATE INDEX ix_analytics_datasets_owner_user_id ON analytics_datasets (tenant_id, owner_user_id);

CREATE INDEX ix_metric_definitions_analytics_dataset_id ON metric_definitions (tenant_id, analytics_dataset_id);

CREATE INDEX ix_metric_snapshots_metric_definition_id ON metric_snapshots (tenant_id, metric_definition_id);

CREATE INDEX ix_metric_snapshots_organization_unit_id ON metric_snapshots (tenant_id, organization_unit_id);

CREATE INDEX ix_analytics_dashboards_owner_user_id ON analytics_dashboards (tenant_id, owner_user_id);

CREATE INDEX ix_dashboard_widgets_metric_definition_id ON dashboard_widgets (tenant_id, metric_definition_id);

CREATE INDEX ix_analytics_report_definitions_analytics_dataset_id ON analytics_report_definitions (tenant_id, analytics_dataset_id);

CREATE INDEX ix_analytics_report_definitions_owner_user_id ON analytics_report_definitions (tenant_id, owner_user_id);

CREATE INDEX ix_analytics_report_runs_report_definition_id ON analytics_report_runs (tenant_id, report_definition_id);

CREATE INDEX ix_analytics_report_runs_background_job_id ON analytics_report_runs (tenant_id, background_job_id);

CREATE INDEX ix_analytics_report_runs_document_id ON analytics_report_runs (tenant_id, document_id);

CREATE INDEX ix_workforce_forecast_models_analytics_dataset_id ON workforce_forecast_models (tenant_id, analytics_dataset_id);

CREATE INDEX ix_workforce_forecast_runs_forecast_model_id ON workforce_forecast_runs (tenant_id, forecast_model_id);

CREATE INDEX ix_workforce_forecast_runs_background_job_id ON workforce_forecast_runs (tenant_id, background_job_id);

CREATE INDEX ix_workforce_forecast_values_forecast_run_id ON workforce_forecast_values (tenant_id, forecast_run_id);

CREATE INDEX ix_workforce_forecast_values_organization_unit_id ON workforce_forecast_values (tenant_id, organization_unit_id);

CREATE INDEX ix_workforce_forecast_values_metric_definition_id ON workforce_forecast_values (tenant_id, metric_definition_id);

CREATE INDEX ix_ai_model_registry_integration_connection_id ON ai_model_registry (tenant_id, integration_connection_id);

CREATE INDEX ix_ai_prompt_templates_ai_model_id ON ai_prompt_templates (tenant_id, ai_model_id);

CREATE INDEX ix_ai_prompt_templates_author_user_id ON ai_prompt_templates (tenant_id, author_user_id);

CREATE INDEX ix_ai_runs_ai_model_id ON ai_runs (tenant_id, ai_model_id);

CREATE INDEX ix_ai_runs_prompt_template_id ON ai_runs (tenant_id, prompt_template_id);

CREATE INDEX ix_ai_runs_requested_by ON ai_runs (tenant_id, requested_by);

CREATE INDEX ix_ai_runs_background_job_id ON ai_runs (tenant_id, background_job_id);

CREATE INDEX ix_ai_run_inputs_ai_run_id ON ai_run_inputs (tenant_id, ai_run_id);

CREATE INDEX ix_ai_run_inputs_document_version_id ON ai_run_inputs (tenant_id, document_version_id);

CREATE INDEX ix_ai_run_outputs_ai_run_id ON ai_run_outputs (tenant_id, ai_run_id);

CREATE INDEX ix_ai_evidence_ai_run_id ON ai_evidence (tenant_id, ai_run_id);

CREATE INDEX ix_ai_evidence_document_version_id ON ai_evidence (tenant_id, document_version_id);

CREATE INDEX ix_ai_evidence_audit_event_id ON ai_evidence (tenant_id, audit_event_id);

CREATE INDEX ix_resume_parse_runs_candidate_document_id ON resume_parse_runs (tenant_id, candidate_document_id);

CREATE INDEX ix_job_description_analysis_runs_job_posting_id ON job_description_analysis_runs (tenant_id, job_posting_id);

CREATE INDEX ix_candidate_match_scores_application_id ON candidate_match_scores (tenant_id, application_id);

CREATE INDEX ix_skill_recommendations_employee_id ON skill_recommendations (tenant_id, employee_id);

CREATE INDEX ix_skill_recommendations_skill_id ON skill_recommendations (tenant_id, skill_id);

CREATE INDEX ix_learning_recommendations_employee_id ON learning_recommendations (tenant_id, employee_id);

CREATE INDEX ix_learning_recommendations_course_id ON learning_recommendations (tenant_id, course_id);

CREATE INDEX ix_compensation_insight_runs_compensation_plan_id ON compensation_insight_runs (tenant_id, compensation_plan_id);

CREATE INDEX ix_compensation_insight_runs_access_scope_id ON compensation_insight_runs (tenant_id, access_scope_id);

CREATE INDEX ix_ai_model_call_logs_ai_run_id ON ai_model_call_logs (tenant_id, ai_run_id);

CREATE INDEX ix_ai_model_call_logs_integration_job_id ON ai_model_call_logs (tenant_id, integration_job_id);

CREATE INDEX ix_ai_model_call_logs_audit_event_id ON ai_model_call_logs (tenant_id, audit_event_id);

CREATE INDEX ix_integration_connections_integration_provider_id ON integration_connections (tenant_id, integration_provider_id);

CREATE INDEX ix_integration_connections_legal_entity_id ON integration_connections (tenant_id, legal_entity_id);

CREATE INDEX ix_integration_mappings_integration_connection_id ON integration_mappings (tenant_id, integration_connection_id);

CREATE INDEX ix_integration_mappings_author_user_id ON integration_mappings (tenant_id, author_user_id);

CREATE INDEX ix_integration_jobs_integration_connection_id ON integration_jobs (tenant_id, integration_connection_id);

CREATE INDEX ix_integration_jobs_background_job_id ON integration_jobs (tenant_id, background_job_id);

CREATE INDEX ix_integration_job_items_integration_job_id ON integration_job_items (tenant_id, integration_job_id);

CREATE INDEX ix_webhook_endpoints_integration_connection_id ON webhook_endpoints (tenant_id, integration_connection_id);

CREATE INDEX ix_webhook_deliveries_webhook_endpoint_id ON webhook_deliveries (tenant_id, webhook_endpoint_id);

CREATE INDEX ix_webhook_deliveries_outbox_event_id ON webhook_deliveries (tenant_id, outbox_event_id);

CREATE INDEX ix_outbox_events_actor_id ON outbox_events (tenant_id, actor_id);

CREATE INDEX ix_outbox_events_ai_run_id ON outbox_events (tenant_id, ai_run_id);

CREATE INDEX ix_outbox_delivery_attempts_integration_connection_id ON outbox_delivery_attempts (tenant_id, integration_connection_id);

CREATE INDEX ix_job_definitions_service_account_id ON job_definitions (tenant_id, service_account_id);

CREATE INDEX ix_job_definitions_author_user_id ON job_definitions (tenant_id, author_user_id);

CREATE INDEX ix_job_schedules_job_definition_id ON job_schedules (tenant_id, job_definition_id);

CREATE INDEX ix_background_jobs_job_definition_id ON background_jobs (tenant_id, job_definition_id);

CREATE INDEX ix_background_jobs_job_schedule_id ON background_jobs (tenant_id, job_schedule_id);

CREATE INDEX ix_background_jobs_requested_by ON background_jobs (tenant_id, requested_by);

CREATE INDEX ix_job_dependencies_prerequisite_job_id ON job_dependencies (tenant_id, prerequisite_job_id);

CREATE INDEX ix_dead_letter_entries_background_job_id ON dead_letter_entries (tenant_id, background_job_id);

CREATE INDEX ix_dead_letter_entries_inbound_event_id ON dead_letter_entries (tenant_id, inbound_event_id);

CREATE INDEX ix_compliance_frameworks_jurisdiction_id ON compliance_frameworks (tenant_id, jurisdiction_id);

CREATE INDEX ix_compliance_controls_compliance_framework_id ON compliance_controls (tenant_id, compliance_framework_id);

CREATE INDEX ix_compliance_controls_owner_role_id ON compliance_controls (tenant_id, owner_role_id);

CREATE INDEX ix_compliance_controls_author_user_id ON compliance_controls (tenant_id, author_user_id);

CREATE INDEX ix_compliance_obligations_compliance_control_id ON compliance_obligations (tenant_id, compliance_control_id);

CREATE INDEX ix_compliance_obligations_legal_entity_id ON compliance_obligations (tenant_id, legal_entity_id);

CREATE INDEX ix_compliance_evidence_compliance_obligation_id ON compliance_evidence (tenant_id, compliance_obligation_id);

CREATE INDEX ix_compliance_evidence_document_version_id ON compliance_evidence (tenant_id, document_version_id);

CREATE INDEX ix_compliance_evidence_collected_by ON compliance_evidence (tenant_id, collected_by);

CREATE INDEX ix_compliance_assessments_compliance_control_id ON compliance_assessments (tenant_id, compliance_control_id);

CREATE INDEX ix_compliance_assessments_assessor_id ON compliance_assessments (tenant_id, assessor_id);

CREATE INDEX ix_compliance_assessments_evidence_id ON compliance_assessments (tenant_id, evidence_id);

CREATE INDEX ix_retention_policies_jurisdiction_id ON retention_policies (tenant_id, jurisdiction_id);

CREATE INDEX ix_retention_policies_legal_entity_id ON retention_policies (tenant_id, legal_entity_id);

CREATE INDEX ix_retention_policies_author_user_id ON retention_policies (tenant_id, author_user_id);

CREATE INDEX ix_legal_holds_legal_entity_id ON legal_holds (tenant_id, legal_entity_id);

CREATE INDEX ix_legal_holds_authorized_by ON legal_holds (tenant_id, authorized_by);

CREATE INDEX ix_legal_hold_documents_document_id ON legal_hold_documents (tenant_id, document_id);

CREATE INDEX ix_data_subject_requests_person_id ON data_subject_requests (tenant_id, person_id);

CREATE INDEX ix_data_subject_requests_assigned_to ON data_subject_requests (tenant_id, assigned_to);

CREATE INDEX ix_data_subject_requests_approval_request_id ON data_subject_requests (tenant_id, approval_request_id);

CREATE INDEX ix_audit_events_actor_id ON audit_events (tenant_id, actor_id);

CREATE INDEX ix_audit_events_service_account_id ON audit_events (tenant_id, service_account_id);

CREATE INDEX ix_audit_events_legal_entity_id ON audit_events (tenant_id, legal_entity_id);

CREATE INDEX ix_audit_event_changes_audit_event_id ON audit_event_changes (tenant_id, audit_event_id);

COMMIT;
