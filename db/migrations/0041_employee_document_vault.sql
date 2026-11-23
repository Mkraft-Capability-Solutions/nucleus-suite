-- 0041 Employee document vault: person-wise documents with a scoped storage key and an access log.
--
-- 1. employee_documents: the vault's metadata for one employee document. Every row points at the
--    library's `documents` row (src/server/documents/library.ts), so the file is stored once (in
--    document_versions, v2's storage layer) and shows in both the library and the vault. The row
--    carries the employee's company and the root of that company's group at upload time, the
--    category (PASSPORT, VISA, WORK_PERMIT, TRANSFER_ORDER, CONTRACT, OTHER) and the storage key
--    group/{groupId}/company/{companyId}/employees/{employeeId}/{uuid}.
-- 2. document_access_log: one row per view or download through a signed link. Append-only: the
--    application role may not change or delete rows and a trigger refuses it for everyone else.
-- Additive and idempotent; both tables are tenant scoped with forced row-level security.

CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  root_group_id uuid NOT NULL,
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_category text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  storage_key text NOT NULL,
  expiry_date date,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_documents_category_check CHECK (document_category IN ('PASSPORT', 'VISA', 'WORK_PERMIT', 'TRANSFER_ORDER', 'CONTRACT', 'OTHER')),
  CONSTRAINT employee_documents_mime_check CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT employee_documents_size_check CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  CONSTRAINT employee_documents_file_name_check CHECK (length(file_name) BETWEEN 1 AND 200),
  CONSTRAINT employee_documents_storage_key_check CHECK (storage_key ~ '^group/[0-9a-f-]{36}/company/[0-9a-f-]{36}/employees/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  CONSTRAINT employee_documents_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT employee_documents_storage_key_uq UNIQUE (tenant_id, storage_key),
  CONSTRAINT employee_documents_document_uq UNIQUE (tenant_id, document_id),
  CONSTRAINT employee_documents_employee_fk FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT employee_documents_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT employee_documents_company_fk FOREIGN KEY (company_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT employee_documents_root_group_fk FOREIGN KEY (root_group_id, tenant_id) REFERENCES legal_entities(id, tenant_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employee_documents_scope_idx ON employee_documents(tenant_id, company_id, employee_id, document_category);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employee_documents_expiry_idx ON employee_documents(tenant_id, expiry_date) WHERE expiry_date IS NOT NULL;
--> statement-breakpoint
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE employee_documents FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS employee_documents_isolate ON employee_documents;
--> statement-breakpoint
CREATE POLICY employee_documents_isolate ON employee_documents
  USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  employee_document_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  company_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  membership_id uuid,
  access_mode text NOT NULL,
  request_id uuid,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_access_log_mode_check CHECK (access_mode IN ('view', 'download')),
  CONSTRAINT document_access_log_document_fk FOREIGN KEY (tenant_id, employee_document_id) REFERENCES employee_documents(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_access_log_document_idx ON document_access_log(tenant_id, employee_document_id, accessed_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_access_log_employee_idx ON document_access_log(tenant_id, employee_id, accessed_at);
--> statement-breakpoint
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE document_access_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS document_access_log_isolate ON document_access_log;
--> statement-breakpoint
CREATE POLICY document_access_log_isolate ON document_access_log
  USING (app.current_tenant_is_authorized(tenant_id)) WITH CHECK (app.current_tenant_is_authorized(tenant_id));
--> statement-breakpoint
-- The access log is permanent.
DO $grants$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    REVOKE UPDATE, DELETE ON document_access_log FROM app_runtime;
  END IF;
END $grants$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.forbid_document_access_log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The document access log is permanent.' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_access_log_immutable ON document_access_log;
--> statement-breakpoint
CREATE TRIGGER document_access_log_immutable BEFORE UPDATE OR DELETE ON document_access_log
  FOR EACH ROW EXECUTE FUNCTION app.forbid_document_access_log_change();
