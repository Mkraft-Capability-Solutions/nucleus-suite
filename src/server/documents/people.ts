import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { MAX_DOCUMENT_BYTES, detectFileKind } from "@/lib/documents/file-types";
import { documentAccess, type DocumentAccess } from "@/lib/documents/access";
import { signToken, signingSecret, verifyToken, type AccessMode } from "@/lib/documents/signed-url";
import { authorize } from "@/server/identity/authorization";
import { recomputeEmployeeAlerts } from "@/server/alerts/engine";
import { tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * People > Documents (the document vault): documents filed per person, on top of the document
 * library. A vault upload writes the library's documents + document_versions rows (the file is
 * stored once, in v2's storage layer) plus an employee_documents row with the category, expiry and
 * the scoped storage key group/{groupId}/company/{companyId}/employees/{employeeId}/{uuid}.
 * Files are opened only through a 5-minute HMAC-signed link; every link issued is logged in the
 * append-only document_access_log.
 *
 * Who may do what follows the library: document.read/write (everyone in the tenant) or
 * document.self.read/write (one's own folder only, needs a linked employee record).
 */

export const DOCUMENT_CATEGORIES = ["PASSPORT", "VISA", "WORK_PERMIT", "TRANSFER_ORDER", "CONTRACT", "OTHER"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export const VAULT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
const CATEGORY_NAMES: Record<DocumentCategory, string> = {
  PASSPORT: "Passport", VISA: "Visa", WORK_PERMIT: "Work permit", TRANSFER_ORDER: "Transfer order", CONTRACT: "Contract", OTHER: "Other",
};

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));

function rightsOf(access: Access): DocumentAccess {
  return documentAccess((permission) => authorize(access.context, { action: permission, resource: { tenantId: access.tenantId } }).allowed, access.context.employeeId);
}
function forbidden(message: string): never {
  throw new HttpError({ status: 403, code: "FORBIDDEN", message });
}

/** May the caller act on this employee's folder? (pure, unit-tested) Self reach is limited to one's own record. */
export function mayReach(reach: DocumentAccess["read"], callerEmployeeId: string | null, employeeId: string): boolean {
  if (reach === "all") return true;
  return reach === "self" && callerEmployeeId !== null && callerEmployeeId === employeeId;
}

/** The storage key for a vault file (pure). */
export function storageKey(groupId: string, companyId: string, employeeId: string, fileId: string): string {
  return `group/${groupId}/company/${companyId}/employees/${employeeId}/${fileId}`;
}

/* ------------------------------------------------------------------ */
/* Person-wise folders                                                 */
/* ------------------------------------------------------------------ */

export const peopleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(80).optional(),
  company: z.string().uuid().optional(),
  sort: z.enum(["name", "documents", "expiry"]).default("name"),
});
export type PeopleQuery = z.infer<typeof peopleQuerySchema>;

export type PersonFolder = {
  employeeId: string; employeeCode: string; name: string; designation: string | null;
  companyId: string | null; company: string | null; documentCount: number; nearestExpiry: string | null; expiredCount: number;
};
export type PeoplePage = { items: PersonFolder[]; page: number; pageSize: number; total: number; canUpload: boolean; scope: "all" | "self" };

const ORDER: Record<PeopleQuery["sort"], string> = {
  name: "name asc, e.id",
  documents: "document_count desc, name asc, e.id",
  expiry: "nearest_expiry asc nulls last, name asc, e.id",
};

export async function listPeopleFolders(access: Access, query: PeopleQuery): Promise<PeoplePage> {
  const rights = rightsOf(access);
  if (!rights.read) forbidden("Your role cannot open documents.");
  const search = query.search ? `%${query.search.replace(/[%_\\]/g, "")}%` : null;
  const offset = (query.page - 1) * query.pageSize;
  const [rows] = await tenantTx(access, [
    sqlClient.query(`
      select e.id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name, nullif(trim(e.designation), '') as designation,
        le.id as company_id, le.legal_name as company,
        (select count(*)::int from documents d where d.tenant_id = e.tenant_id and d.employee_id = e.id and d.record_status <> 'deleted') as document_count,
        (select min(ed.expiry_date)::text from employee_documents ed join documents d on d.tenant_id = ed.tenant_id and d.id = ed.document_id and d.record_status <> 'deleted'
          where ed.tenant_id = e.tenant_id and ed.employee_id = e.id and ed.expiry_date >= current_date) as nearest_expiry,
        (select count(*)::int from employee_documents ed join documents d on d.tenant_id = ed.tenant_id and d.id = ed.document_id and d.record_status <> 'deleted'
          where ed.tenant_id = e.tenant_id and ed.employee_id = e.id and ed.expiry_date < current_date) as expired_count,
        count(*) over() as total
      from employees e
      left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id
      where e.tenant_id = $1::uuid
        and ($2::uuid is null or e.id = $2::uuid)
        and ($3::uuid is null or e.legal_entity_id = $3::uuid)
        and ($4::text is null or (e.employee_code || ' ' || coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '') || ' ' || coalesce(e.designation, '')) ilike $4::text)
      order by ${ORDER[query.sort]}
      limit $5 offset $6`,
    [access.tenantId, rights.read === "self" ? rights.employeeId : null, query.company ?? null, search, query.pageSize, offset]),
  ]);
  const list = rows as Row[];
  return {
    items: list.map((row) => ({
      employeeId: String(row.id), employeeCode: String(row.employee_code), name: String(row.name), designation: str(row.designation),
      companyId: str(row.company_id), company: str(row.company), documentCount: Number(row.document_count ?? 0),
      nearestExpiry: str(row.nearest_expiry), expiredCount: Number(row.expired_count ?? 0),
    })),
    page: query.page, pageSize: query.pageSize, total: list.length ? Number(list[0]!.total) : 0,
    canUpload: Boolean(rights.write), scope: rights.read,
  };
}

/* ------------------------------------------------------------------ */
/* One person's documents                                              */
/* ------------------------------------------------------------------ */

export type EmployeeDocument = {
  id: string; documentId: string; title: string; category: DocumentCategory; fileName: string; mimeType: string; fileSizeBytes: number;
  expiryDate: string | null; uploadedBy: string | null; createdAt: string;
};
export type UploadedDocument = EmployeeDocument & { alertsRecomputed: boolean };
export type EmployeeFolder = {
  employee: { id: string; code: string; name: string; companyId: string | null; company: string | null };
  documents: EmployeeDocument[]; canUpload: boolean;
};

async function loadEmployee(access: Access, employeeId: string) {
  const [rows] = await tenantTx(access, [
    sqlClient`select e.id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name, le.id as company_id, le.legal_name as company
      from employees e left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id
      where e.tenant_id = ${access.tenantId} and e.id = ${employeeId} limit 1`,
  ]);
  const row = (rows as Row[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That employee was not found." });
  return { id: String(row.id), code: String(row.employee_code), name: String(row.name), companyId: str(row.company_id), company: str(row.company) };
}

export async function listEmployeeDocuments(access: Access, employeeId: string): Promise<EmployeeFolder> {
  const rights = rightsOf(access);
  // A person outside the caller's reach is reported as not found, so existence is not leaked.
  if (!rights.read) forbidden("Your role cannot open documents.");
  if (!mayReach(rights.read, rights.employeeId, employeeId)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That employee was not found." });
  const employee = await loadEmployee(access, employeeId);
  const [rows] = await tenantTx(access, [
    sqlClient`select ed.id, ed.document_id, coalesce(nullif(d.attributes->>'title', ''), ed.file_name) as title, ed.document_category, ed.file_name, ed.mime_type,
        ed.file_size_bytes, ed.expiry_date::text as expiry_date, ed.created_at::text as created_at, d.attributes->>'uploaded_by_name' as uploaded_by
      from employee_documents ed join documents d on d.tenant_id = ed.tenant_id and d.id = ed.document_id
      where ed.tenant_id = ${access.tenantId} and ed.employee_id = ${employeeId} and d.record_status <> 'deleted'
      order by ed.created_at desc, ed.id limit 500`,
  ]);
  return {
    employee,
    canUpload: mayReach(rights.write, rights.employeeId, employeeId),
    documents: (rows as Row[]).map((row) => ({
      id: String(row.id), documentId: String(row.document_id), title: String(row.title), category: String(row.document_category) as DocumentCategory,
      fileName: String(row.file_name), mimeType: String(row.mime_type), fileSizeBytes: Number(row.file_size_bytes), expiryDate: str(row.expiry_date),
      uploadedBy: str(row.uploaded_by), createdAt: String(row.created_at),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

export const vaultUploadSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES, { message: "Choose a category." }),
  title: z.string().trim().max(200).optional(),
  expiryDate: z.iso.date({ message: "Enter a valid date." }).optional(),
  fileName: z.string().trim().min(1, "Choose a file.").max(200),
  contentBase64: z.string().min(1, "Choose a file.").max(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 8),
});
export type VaultUpload = z.infer<typeof vaultUploadSchema>;

/** Checks the bytes against the vault's allow-list (pure, unit-tested). */
export function checkVaultFile(bytes: Uint8Array, fileName: string): { mime: (typeof VAULT_MIME_TYPES)[number] } {
  if (bytes.length === 0) throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The file is empty.", details: [{ field: "file", issue: "empty" }] });
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new HttpError({ status: 413, code: "PAYLOAD_TOO_LARGE", message: "Files are limited to 10 MB.", details: [{ field: "file", issue: "too_large" }] });
  const kind = detectFileKind(bytes, fileName);
  const mime = VAULT_MIME_TYPES.find((entry) => entry === kind?.mime);
  if (!mime) throw new HttpError({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "Upload a PDF, PNG, JPEG or WebP file.", details: [{ field: "file", issue: "unsupported_type" }] });
  return { mime };
}

export async function uploadEmployeeDocument(access: Access, employeeId: string, input: VaultUpload, requestId: string): Promise<UploadedDocument> {
  const rights = rightsOf(access);
  if (!rights.write) forbidden("Your role cannot upload documents.");
  if (!mayReach(rights.write, rights.employeeId, employeeId)) forbidden("You can upload documents to your own folder only.");
  const bytes = new Uint8Array(Buffer.from(input.contentBase64, "base64"));
  const { mime } = checkVaultFile(bytes, input.fileName);

  const employee = await loadEmployee(access, employeeId);
  if (!employee.companyId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This employee has no company recorded; assign one before filing documents." });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const [groups, types, duplicates, uploader] = await tenantTx(access, [
    // The root of the company's group: walk parent companies up to the top (bounded depth).
    sqlClient`with recursive chain(id, parent, depth) as (
        select id, parent_legal_entity_id, 0 from legal_entities where tenant_id = ${access.tenantId} and id = ${employee.companyId}
        union all
        select le.id, le.parent_legal_entity_id, c.depth + 1 from legal_entities le join chain c on le.id = c.parent and le.tenant_id = ${access.tenantId} where c.depth < 50)
      select id from chain order by depth desc limit 1`,
    sqlClient`select id from document_types where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.category} order by created_at limit 1`,
    sqlClient`select ed.id from employee_documents ed join documents d on d.tenant_id = ed.tenant_id and d.id = ed.document_id
      join document_versions v on v.tenant_id = d.tenant_id and v.document_id = d.id
      where ed.tenant_id = ${access.tenantId} and ed.employee_id = ${employeeId} and d.record_status <> 'deleted' and v.attributes->>'sha256' = ${sha256} limit 1`,
    sqlClient`select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as name from employees where tenant_id = ${access.tenantId} and id = ${rights.employeeId ?? null} limit 1`,
  ]);
  if ((duplicates as Row[]).length) throw new HttpError({ status: 409, code: "DUPLICATE", message: "This file is already filed for this person." });
  const groupId = str((groups as Row[])[0]?.id) ?? employee.companyId;

  const typeId = str((types as Row[])[0]?.id) ?? randomUUID();
  const createType = !(types as Row[]).length;
  const documentId = randomUUID();
  const vaultId = randomUUID();
  const key = storageKey(groupId, employee.companyId, employeeId, randomUUID());
  const title = input.title?.trim() || `${CATEGORY_NAMES[input.category]} – ${employee.name}`;
  const source = rights.write === "all" ? "hr" : "self";
  const uploadedByName = str((uploader as Row[])[0]?.name) ?? "Administrator";
  const today = new Date().toISOString().slice(0, 10);
  if (input.expiryDate && input.expiryDate < today) throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The expiry date has already passed.", details: [{ field: "expiryDate", issue: "past" }] });

  await tenantTx(access, [
    ...(createType ? [sqlClient`insert into document_types (id, tenant_id, attributes) values (${typeId}, ${access.tenantId}, ${JSON.stringify({ code: input.category, name: CATEGORY_NAMES[input.category] })}::jsonb)`] : []),
    sqlClient`insert into documents (id, tenant_id, document_type_id, employee_id, attributes) values (${documentId}, ${access.tenantId}, ${typeId}, ${employeeId}, ${JSON.stringify({
      title, classification: input.category === "VISA" || input.category === "WORK_PERMIT" ? "immigration" : input.category === "PASSPORT" ? "identity" : input.category === "OTHER" ? "other" : "employment",
      expires_at: input.expiryDate ?? null, verification: source === "hr" ? "verified" : "pending", source,
      uploaded_by_user: access.context.actorUserId, uploaded_by_employee: rights.employeeId, uploaded_by_name: uploadedByName, current_version: 1, storage_key: key,
    })}::jsonb)`,
    sqlClient`insert into document_versions (tenant_id, document_id, attributes) values (${access.tenantId}, ${documentId}, ${JSON.stringify({
      version: 1, title, file_name: input.fileName, mime, size_bytes: bytes.length, sha256, scan: "available", scan_method: "file-signature",
      storage_key: key, content_base64: Buffer.from(bytes).toString("base64"), expires_at: input.expiryDate ?? null,
    })}::jsonb)`,
    sqlClient`insert into employee_documents (id, tenant_id, root_group_id, company_id, employee_id, document_id, document_category, file_name, mime_type, file_size_bytes, storage_key, expiry_date, uploaded_by)
      values (${vaultId}, ${access.tenantId}, ${groupId}, ${employee.companyId}, ${employeeId}, ${documentId}, ${input.category}, ${input.fileName}, ${mime}, ${bytes.length}, ${key}, ${input.expiryDate ?? null}, ${access.context.actorUserId})`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'document.vault_upload', 'employee_document', ${vaultId},
        'Uploaded to the employee document vault', ${JSON.stringify({ category: input.category, file_name: input.fileName, size_bytes: bytes.length, sha256, expiry_date: input.expiryDate ?? null })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  // Expiry alerts (visa / permit) are recalculated after the commit; the upload stands either way.
  let alertsRecomputed = !input.expiryDate;
  if (input.expiryDate) {
    try { await recomputeEmployeeAlerts(access, employeeId); alertsRecomputed = true; } catch (error) {
      // The daily scan picks it up; the caller is told the alerts are not yet current.
      console.warn("[documents.vault] alert recompute deferred", { employeeId, reason: (error as Error).name });
    }
  }
  return {
    alertsRecomputed,
    id: vaultId, documentId, title, category: input.category, fileName: input.fileName, mimeType: mime, fileSizeBytes: bytes.length,
    expiryDate: input.expiryDate ?? null, uploadedBy: uploadedByName, createdAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Signed access                                                       */
/* ------------------------------------------------------------------ */

export const SIGNED_FILE_PATH = "/api/v1/documents/people/file";

export async function issueAccessLink(access: Access, employeeId: string, vaultId: string, mode: AccessMode, requestId: string): Promise<{ url: string; expiresAt: string; mode: AccessMode }> {
  const secret = signingSecret();
  const rights = rightsOf(access);
  if (!rights.read) forbidden("Your role cannot open documents.");
  if (!mayReach(rights.read, rights.employeeId, employeeId)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The document was not found." });
  const [rows] = await tenantTx(access, [
    sqlClient`select ed.id, ed.company_id from employee_documents ed join documents d on d.tenant_id = ed.tenant_id and d.id = ed.document_id
      where ed.tenant_id = ${access.tenantId} and ed.employee_id = ${employeeId} and ed.id = ${vaultId} and d.record_status <> 'deleted' limit 1`,
  ]);
  const row = (rows as Row[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The document was not found." });
  const signed = signToken({ t: access.tenantId, d: vaultId, e: employeeId, m: mode }, secret);
  await tenantTx(access, [
    sqlClient`insert into document_access_log (tenant_id, employee_document_id, employee_id, company_id, actor_user_id, membership_id, access_mode, request_id)
      values (${access.tenantId}, ${vaultId}, ${employeeId}, ${String(row.company_id)}, ${access.context.actorUserId}, ${uuidOrNull(access.context.membershipId)}::uuid, ${mode}, ${uuidOrNull(requestId)}::uuid)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${mode === "download" ? "document.download" : "document.view"}, 'employee_document', ${vaultId},
        'Signed link issued from the document vault', ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { url: `${SIGNED_FILE_PATH}?token=${encodeURIComponent(signed.token)}`, expiresAt: signed.expiresAt, mode };
}

/** Serves the file behind a signed link: signature, expiry and the caller's tenant are all checked. */
export async function readSignedFile(access: Access, token: string): Promise<{ bytes: Uint8Array; mime: string; fileName: string; mode: AccessMode }> {
  const verified = verifyToken(token, signingSecret());
  if (!verified.ok || !verified.payload) {
    throw new HttpError({ status: verified.reason === "expired" ? 410 : 403, code: verified.reason === "expired" ? "LINK_EXPIRED" : "FORBIDDEN", message: verified.reason === "expired" ? "This link has expired. Open the document again." : "This link is not valid." });
  }
  const payload = verified.payload;
  if (payload.t !== access.tenantId) forbidden("This link is not valid.");
  const [rows] = await tenantTx(access, [
    sqlClient`select ed.file_name, ed.mime_type, v.attributes->>'content_base64' as content
      from employee_documents ed join documents d on d.tenant_id = ed.tenant_id and d.id = ed.document_id
      left join lateral (select x.attributes from document_versions x where x.tenant_id = d.tenant_id and x.document_id = d.id order by x.created_at desc limit 1) v on true
      where ed.tenant_id = ${access.tenantId} and ed.id = ${payload.d} and ed.employee_id = ${payload.e} and d.record_status <> 'deleted' limit 1`,
  ]);
  const row = (rows as Row[])[0];
  if (!row?.content) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "No file is stored for this document." });
  return { bytes: new Uint8Array(Buffer.from(String(row.content), "base64")), mime: String(row.mime_type), fileName: String(row.file_name), mode: payload.m };
}
