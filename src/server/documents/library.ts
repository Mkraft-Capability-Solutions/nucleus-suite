import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { MAX_DOCUMENT_BYTES, detectFileKind } from "@/lib/documents/file-types";
import { renderPdf } from "@/lib/documents/simple-pdf";
import { authorize } from "@/server/identity/authorization";
import { tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { classify, documentAccess, mayDelete, type DocumentAccess, type Reach } from "@/lib/documents/access";

export { classify, documentAccess, mayDelete, type DocumentAccess, type Reach };

/**
 * The document library: every employee document filed under company > department > person.
 *
 * Who sees what is decided here, from the caller's permissions:
 *   document.read / write / delete            everyone's documents (HR, administrators)
 *   document.self.read / write / delete       one's own documents only (needs a linked employee record)
 * A person may delete only documents they uploaded themselves; payslips stay with their payroll run.
 * Files are checked by their bytes on upload (see file-types.ts) and served only to those who may read them.
 */

function accessOf(access: Access): DocumentAccess {
  return documentAccess((permission) => authorize(access.context, { action: permission, resource: { tenantId: access.tenantId } }).allowed, access.context.employeeId);
}

function forbidden(message: string): never {
  throw new HttpError({ status: 403, code: "FORBIDDEN", message });
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export type LibraryDocument = {
  id: string;
  title: string;
  code: string | null;
  type: string;
  typeId: string | null;
  classification: string | null;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  department: string;
  companyId: string;
  company: string;
  former: boolean;
  mime: string | null;
  sizeBytes: number | null;
  fileName: string | null;
  hasFile: boolean;
  uploadedAt: string;
  uploadedBy: string | null;
  source: "hr" | "self" | "system" | "record";
  verification: string;
  issuedOn: string | null;
  expiresOn: string | null;
  isPayslip: boolean;
  canDelete: boolean;
};

const NO_COMPANY = "No company recorded";
const NO_DEPARTMENT = "No department recorded";
const FORMER = `coalesce(lower(e.status), 'active') in ('separated', 'exited', 'relieved', 'archived', 'inactive')`;

const LIBRARY_SELECT = `
  select d.id, coalesce(nullif(d.attributes->>'title', ''), d.attributes->>'code', 'Untitled document') as title, d.attributes->>'code' as code,
    coalesce(dt.attributes->>'name', 'Other') as type, dt.id as type_id, d.attributes->>'classification' as classification,
    e.id as employee_id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as employee_name,
    nullif(trim(e.designation), '') as designation, coalesce(nullif(trim(e.department), ''), '${NO_DEPARTMENT}') as department,
    coalesce(le.id::text, 'none') as company_id, coalesce(le.legal_name, '${NO_COMPANY}') as company, ${FORMER} as former,
    v.attributes->>'mime' as mime, case when v.attributes->>'size_bytes' ~ '^[0-9]+$' then (v.attributes->>'size_bytes')::bigint end as size_bytes,
    v.attributes->>'file_name' as file_name, coalesce(v.attributes ? 'content_base64', false) or p.id is not null as has_file,
    coalesce(v.created_at, d.created_at)::text as uploaded_at,
    case when ue.id is not null then trim(coalesce(ue.first_name, '') || ' ' || coalesce(ue.last_name, '')) else d.attributes->>'uploaded_by_name' end as uploaded_by,
    case when p.id is not null then 'system' else coalesce(d.attributes->>'source', 'record') end as source,
    d.attributes->>'uploaded_by_employee' as uploaded_by_employee,
    coalesce(d.attributes->>'verification', d.attributes->>'scan', 'pending') as verification,
    coalesce(d.attributes->>'issued_on', d.attributes->>'issued_at') as issued_on,
    coalesce(ex.expires_on, d.attributes->>'expires_at') as expires_on,
    p.id is not null as is_payslip
  from documents d
  join employees e on e.tenant_id = d.tenant_id and e.id = d.employee_id
  left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id
  left join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id
  left join lateral (select x.created_at, x.attributes from document_versions x where x.tenant_id = d.tenant_id and x.document_id = d.id order by x.created_at desc limit 1) v on true
  left join lateral (select x.attributes->>'expires_on' as expires_on from document_expiries x where x.tenant_id = d.tenant_id and x.document_id = d.id order by x.created_at desc limit 1) ex on true
  left join payslips p on p.tenant_id = d.tenant_id and p.document_id = d.id
  left join employees ue on ue.tenant_id = d.tenant_id and ue.id::text = d.attributes->>'uploaded_by_employee'
  where d.tenant_id = $1::uuid and d.record_status <> 'deleted'`;

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));

function toDocument(row: Row, rights: DocumentAccess): LibraryDocument {
  const document = {
    id: String(row.id), title: String(row.title), code: str(row.code), type: String(row.type), typeId: str(row.type_id), classification: str(row.classification),
    employeeId: String(row.employee_id), employeeCode: String(row.employee_code), employeeName: String(row.employee_name), designation: str(row.designation),
    department: String(row.department), companyId: String(row.company_id), company: String(row.company), former: Boolean(row.former),
    // A payslip without a stored file is served as a PDF rendered from its payroll run.
    mime: str(row.mime) ?? (row.is_payslip ? "application/pdf" : null), sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes), fileName: str(row.file_name), hasFile: Boolean(row.has_file),
    uploadedAt: String(row.uploaded_at), uploadedBy: str(row.uploaded_by), source: (str(row.source) ?? "record") as LibraryDocument["source"],
    verification: String(row.verification), issuedOn: str(row.issued_on), expiresOn: str(row.expires_on), isPayslip: Boolean(row.is_payslip),
  };
  return { ...document, canDelete: mayDelete(rights.delete, { employeeId: document.employeeId, source: document.source, uploadedBy: str(row.uploaded_by_employee), isPayslip: document.isPayslip }, rights.employeeId) };
}

export const listFiltersSchema = z.object({
  company: z.string().max(80).optional(),
  department: z.string().max(120).optional(),
  employee: z.string().uuid().optional(),
  type: z.string().uuid().optional(),
  search: z.string().max(80).optional(),
});

export async function listLibrary(access: Access, filters: z.infer<typeof listFiltersSchema>): Promise<{ documents: LibraryDocument[]; truncated: boolean }> {
  const rights = accessOf(access);
  if (!rights.read) forbidden("Your role cannot open documents.");
  const limit = 1000;
  const search = filters.search?.trim() ? `%${filters.search.trim().replace(/[%_\\]/g, "")}%` : null;
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${LIBRARY_SELECT}
        and ($2::uuid is null or e.id = $2::uuid)
        and ($3::text is null or coalesce(le.id::text, 'none') = $3::text)
        and ($4::text is null or coalesce(nullif(trim(e.department), ''), '${NO_DEPARTMENT}') = $4::text)
        and ($5::uuid is null or e.id = $5::uuid)
        and ($6::uuid is null or dt.id = $6::uuid)
        and ($7::text is null or (coalesce(d.attributes->>'title', '') || ' ' || coalesce(d.attributes->>'code', '') || ' ' || coalesce(dt.attributes->>'name', '') || ' '
          || e.employee_code || ' ' || coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '') || ' ' || coalesce(v.attributes->>'file_name', '')) ilike $7::text)
      order by coalesce(v.created_at, d.created_at) desc, d.id
      limit ${limit + 1}`,
    [access.tenantId, rights.read === "self" ? rights.employeeId : null, filters.company ?? null, filters.department ?? null, filters.employee ?? null, filters.type ?? null, search]),
  ]);
  const list = rows as Row[];
  return { documents: list.slice(0, limit).map((row) => toDocument(row, rights)), truncated: list.length > limit };
}

export type LibraryTree = {
  reach: { read: Reach; write: Reach; delete: Reach };
  me: string | null;
  companies: Array<{
    id: string; name: string; documents: number; people: number;
    departments: Array<{ name: string; documents: number; people: number; employees: Array<{ id: string; code: string; name: string; designation: string | null; former: boolean; documents: number }> }>;
  }>;
  types: Array<{ id: string; name: string }>;
};

/** The folders: companies, their departments and the people in each, with document counts. */
export async function libraryTree(access: Access): Promise<LibraryTree> {
  const rights = accessOf(access);
  if (!rights.read) forbidden("Your role cannot open documents.");
  const [rows, types] = await tenantTx(access, [
    sqlClient.query(`
      select coalesce(le.id::text, 'none') as company_id, coalesce(le.legal_name, '${NO_COMPANY}') as company,
        coalesce(nullif(trim(e.department), ''), '${NO_DEPARTMENT}') as department,
        e.id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name, nullif(trim(e.designation), '') as designation,
        ${FORMER} as former, count(d.id)::int as documents
      from employees e
      left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id
      left join documents d on d.tenant_id = e.tenant_id and d.employee_id = e.id and d.record_status <> 'deleted'
      where e.tenant_id = $1::uuid and ($2::uuid is null or e.id = $2::uuid)
      group by 1, 2, 3, e.id
      order by 2, 3, ${FORMER}, 6`, [access.tenantId, rights.read === "self" ? rights.employeeId : null]),
    sqlClient.query(`select id, coalesce(attributes->>'name', attributes->>'code') as name from document_types
      where tenant_id = $1::uuid and coalesce(attributes->>'code', '') <> 'PAYSLIP' order by 2`, [access.tenantId]),
  ]);
  const companies = new Map<string, LibraryTree["companies"][number]>();
  for (const row of rows as Row[]) {
    const companyId = String(row.company_id);
    const company = companies.get(companyId) ?? { id: companyId, name: String(row.company), documents: 0, people: 0, departments: [] };
    let department = company.departments.find((entry) => entry.name === String(row.department));
    if (!department) { department = { name: String(row.department), documents: 0, people: 0, employees: [] }; company.departments.push(department); }
    const count = Number(row.documents);
    department.employees.push({ id: String(row.id), code: String(row.employee_code), name: String(row.name), designation: str(row.designation), former: Boolean(row.former), documents: count });
    department.documents += count; department.people += 1; company.documents += count; company.people += 1;
    companies.set(companyId, company);
  }
  return {
    reach: { read: rights.read, write: rights.write, delete: rights.delete }, me: rights.employeeId,
    companies: [...companies.values()],
    types: (types as Row[]).map((row) => ({ id: String(row.id), name: String(row.name) })),
  };
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

export const uploadSchema = z.object({
  employeeId: z.string().uuid(),
  documentTypeId: z.string().uuid(),
  title: z.string().trim().min(1, "Give the document a title.").max(200),
  documentNumber: z.string().trim().max(60).optional(),
  issuedOn: z.iso.date().optional(),
  expiresOn: z.iso.date().optional(),
  fileName: z.string().trim().min(1).max(200),
  contentBase64: z.string().min(1).max(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 8),
});

export async function uploadToLibrary(access: Access, input: z.infer<typeof uploadSchema>, requestId: string) {
  const rights = accessOf(access);
  if (!rights.write) forbidden("Your role cannot upload documents.");
  if (rights.write === "self" && input.employeeId !== rights.employeeId) forbidden("You can upload documents to your own folder only.");
  const bytes = new Uint8Array(Buffer.from(input.contentBase64, "base64"));
  if (bytes.length === 0) throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The file is empty." });
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new HttpError({ status: 413, code: "PAYLOAD_TOO_LARGE", message: "Files are limited to 10 MB." });
  const kind = detectFileKind(bytes, input.fileName);
  if (!kind) throw new HttpError({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "This file type is not accepted. Upload a PDF, an image (PNG, JPEG, WebP), a Word or Excel file, or plain text." });
  const today = new Date().toISOString().slice(0, 10);
  if (input.issuedOn && input.issuedOn > today) throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The issue date cannot be in the future." });
  if (input.expiresOn && input.issuedOn && input.expiresOn <= input.issuedOn) throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The expiry date must be after the issue date." });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const [people, types, duplicates, uploader] = await tenantTx(access, [
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${input.employeeId} limit 1`,
    sqlClient`select id, coalesce(attributes->>'name', attributes->>'code') as name, attributes->>'code' as code from document_types where tenant_id = ${access.tenantId} and id = ${input.documentTypeId} limit 1`,
    sqlClient`select d.attributes->>'title' as title from documents d join document_versions v on v.tenant_id = d.tenant_id and v.document_id = d.id
      where d.tenant_id = ${access.tenantId} and d.employee_id = ${input.employeeId} and d.record_status <> 'deleted' and v.attributes->>'sha256' = ${sha256} limit 1`,
    sqlClient`select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as name from employees where tenant_id = ${access.tenantId} and id = ${rights.employeeId ?? null} limit 1`,
  ]);
  if (!(people as Row[]).length) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That employee was not found." });
  const type = (types as Row[])[0];
  if (!type) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That document type was not found." });
  if (type.code === "PAYSLIP") throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Payslips are issued by payroll, not uploaded." });
  const duplicate = (duplicates as Row[])[0];
  if (duplicate) throw new HttpError({ status: 409, code: "DUPLICATE", message: `This file is already filed for this person as "${String(duplicate.title)}".` });

  const id = randomUUID();
  const source = rights.write === "all" && input.employeeId !== rights.employeeId ? "hr" : rights.write === "all" ? "hr" : "self";
  const uploadedByName = (uploader as Row[])[0]?.name ? String((uploader as Row[])[0]!.name) : "Administrator";
  const attributes = {
    title: input.title, code: input.documentNumber || null, classification: classify(String(type.name)), issued_on: input.issuedOn ?? null, expires_at: input.expiresOn ?? null,
    // A document HR files is accepted as filed; one a person files about themselves waits for HR to verify it.
    verification: source === "hr" ? "verified" : "pending", source, uploaded_by_user: access.context.actorUserId, uploaded_by_employee: rights.employeeId, uploaded_by_name: uploadedByName, current_version: 1,
  };
  await tenantTx(access, [
    sqlClient`insert into documents (id, tenant_id, document_type_id, employee_id, attributes) values (${id}, ${access.tenantId}, ${input.documentTypeId}, ${input.employeeId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into document_versions (tenant_id, document_id, attributes) values (${access.tenantId}, ${id}, ${JSON.stringify({
      version: 1, title: input.title, file_name: input.fileName, mime: kind.mime, size_bytes: bytes.length, sha256, scan: "available", scan_method: "file-signature",
      content_base64: Buffer.from(bytes).toString("base64"), expires_at: input.expiresOn ?? null,
    })}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'document.upload', 'document', ${id},
        ${source === "self" ? "Uploaded to own folder" : "Uploaded to the employee's folder"}, ${JSON.stringify({ title: input.title, type: type.name, file_name: input.fileName, size_bytes: bytes.length, sha256 })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, title: input.title, mime: kind.mime, sizeBytes: bytes.length, verification: attributes.verification };
}

/* ------------------------------------------------------------------ */
/* Read a file, delete                                                 */
/* ------------------------------------------------------------------ */

async function loadOne(access: Access, id: string, rights: DocumentAccess) {
  const [rows] = await tenantTx(access, [sqlClient.query(`${LIBRARY_SELECT} and d.id = $2::uuid limit 1`, [access.tenantId, id])]);
  const row = (rows as Row[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The document was not found." });
  const document = toDocument(row, rights);
  return { document, uploadedBy: str(row.uploaded_by_employee) };
}

export async function readLibraryFile(access: Access, id: string, intent: "view" | "download", requestId: string): Promise<{ bytes: Uint8Array; mime: string; fileName: string }> {
  const rights = accessOf(access);
  if (!rights.read) forbidden("Your role cannot open documents.");
  const { document } = await loadOne(access, id, rights);
  if (rights.read === "self" && document.employeeId !== rights.employeeId) forbidden("You can open your own documents only.");

  let file: { bytes: Uint8Array; mime: string; fileName: string } | null = null;
  const [versions] = await tenantTx(access, [
    sqlClient`select attributes->>'content_base64' as content, attributes->>'mime' as mime, attributes->>'file_name' as file_name, attributes->>'scan' as scan
      from document_versions where tenant_id = ${access.tenantId} and document_id = ${id} order by created_at desc limit 1`,
  ]);
  const version = (versions as Row[])[0];
  if (version?.content) {
    if (version.scan && version.scan !== "available") throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This file has not passed its check yet." });
    file = { bytes: new Uint8Array(Buffer.from(String(version.content), "base64")), mime: String(version.mime ?? "application/octet-stream"), fileName: String(version.file_name ?? `${document.title}.pdf`) };
  } else if (document.isPayslip) {
    file = await payslipPdf(access, id, document);
  }
  if (!file) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "No file is stored for this record." });
  await tenantTx(access, [
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${intent === "download" ? "document.download" : "document.view"}, 'document', ${id},
        ${intent === "download" ? "Downloaded from the document library" : "Opened in the document library"}, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return file;
}

/** A payslip is generated from its payroll run, so its copy is rendered from the run's figures. */
async function payslipPdf(access: Access, id: string, document: LibraryDocument) {
  const [rows] = await tenantTx(access, [
    sqlClient`select p.attributes as slip, t.name as organisation, coalesce(s.currency, t.default_currency, 'INR') as currency
      from payslips p join tenants t on t.id = p.tenant_id left join tenant_settings s on s.tenant_id = t.id
      where p.tenant_id = ${access.tenantId} and p.document_id = ${id} limit 1`,
  ]);
  const row = (rows as Array<{ slip: { period?: string; totals?: Record<string, number>; generated_at?: string }; organisation: string; currency: string }>)[0];
  if (!row) return null;
  const money = (minor: number | undefined) => (typeof minor === "number" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: row.currency, maximumFractionDigits: 2 }).format(minor / 100) : "-");
  const totals = row.slip.totals ?? {};
  const bytes = renderPdf({
    heading: `Payslip ${row.slip.period ?? ""}`.trim(),
    subheading: `${document.company} - ${row.organisation}`,
    lines: [
      { label: "Employee", value: `${document.employeeName} (${document.employeeCode})` },
      { label: "Designation", value: document.designation ?? "-" },
      { label: "Department", value: document.department },
      { label: "Pay period", value: row.slip.period ?? "-" },
    ],
    sections: [{ title: "Pay", lines: [{ label: "Gross pay", value: money(totals.gross_minor) }, { label: "Deductions", value: money(totals.deductions_minor) }, { label: "Net pay", value: money(totals.net_minor) }] }],
    footer: `Generated from the finalised payroll run${row.slip.generated_at ? ` on ${row.slip.generated_at.slice(0, 10)}` : ""}. Document ${document.code ?? id}.`,
  });
  return { bytes, mime: "application/pdf", fileName: `${document.title.replace(/[^\w.-]+/g, "-")}.pdf` };
}

export const deleteSchema = z.object({ reason: z.string().trim().max(300).optional() });

export async function deleteFromLibrary(access: Access, id: string, reason: string | undefined, requestId: string) {
  const rights = accessOf(access);
  const { document } = await loadOne(access, id, rights);
  if (rights.read === "self" && document.employeeId !== rights.employeeId) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The document was not found." });
  if (document.isPayslip) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Payslips stay with their payroll run and cannot be deleted here." });
  if (!document.canDelete) forbidden(rights.delete === "self" ? "You can delete only documents you uploaded yourself." : "Your role cannot delete documents.");
  const now = new Date().toISOString();
  await tenantTx(access, [
    sqlClient`update documents set record_status = 'deleted', updated_at = now(),
        attributes = attributes || ${JSON.stringify({ deleted_at: now, deleted_by_user: access.context.actorUserId, deletion_reason: reason || null })}::jsonb
      where tenant_id = ${access.tenantId} and id = ${id}`,
    // The file itself is removed; the record of what was filed, and by whom, stays for the audit trail.
    sqlClient`update document_versions set attributes = (attributes - 'content_base64') || ${JSON.stringify({ purged_at: now })}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and document_id = ${id}`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'document.delete', 'document', ${id},
        ${reason || "Deleted from the document library"}, ${JSON.stringify({ title: document.title, employee: document.employeeCode })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, deleted: true };
}
