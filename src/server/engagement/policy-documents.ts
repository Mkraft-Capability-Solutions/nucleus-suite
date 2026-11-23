import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Policy repository for the content CMS. A policy is a `documents` row whose `document_types` code is POLICY
 * (the same rows `policy-acknowledgements` and the AI knowledge base read); the file is a `document_versions`
 * row that starts `pending_scan` and is downloadable through `/api/v1/documents/{id}/download` only after the
 * scan marks it available. Reads need `employee.read`; uploads need `policy.manage`.
 */

export const POLICY_CATEGORIES = ["compliance_legal", "leave_attendance", "finance_operations", "legal_safety", "benefits_wellness", "general"] as const;
export const POLICY_MIME_TYPES = ["application/pdf"] as const;
export const MAX_POLICY_BYTES = 10 * 1024 * 1024;

export const uploadPolicySchema = z.object({
  title: z.string().trim().min(3, "Enter a policy title of at least 3 characters.").max(200),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,40}$/, "Use 2-40 capital letters, digits or hyphens.").optional(),
  category: z.enum(POLICY_CATEGORIES, { message: "Choose a policy category." }),
  versionTag: z.string().trim().min(1, "Enter a version tag.").max(20),
  department: z.string().trim().max(120).default("all"),
  effectiveFrom: z.iso.date({ message: "Enter the effective date." }),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(POLICY_MIME_TYPES, { message: "Upload a PDF file." }),
  contentBase64: z.string().min(1, "Attach the policy file."),
});

export type UploadPolicy = z.infer<typeof uploadPolicySchema>;

export type PolicyDocumentView = {
  id: string;
  version: number;
  title: string;
  code: string | null;
  category: string;
  versionTag: string | null;
  department: string;
  effectiveFrom: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  scan: string;
  uploadedAt: string;
};

type Row = { id: string; attributes: Record<string, unknown>; created_at: string | Date; version_attributes: Record<string, unknown> | null };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

export function projectPolicy(row: Row): PolicyDocumentView {
  const a = row.attributes ?? {};
  const v = row.version_attributes ?? {};
  const size = Number(v.size_bytes);
  return {
    id: row.id,
    version: Number(a.current_version ?? 1),
    title: text(a.title) ?? "",
    code: text(a.code),
    category: text(a.category) ?? "general",
    versionTag: text(a.version_tag) ?? text(a.active_year),
    department: text(a.department) ?? "all",
    effectiveFrom: text(a.effective_from),
    fileName: text(v.file_name),
    sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
    scan: text(v.scan) ?? "unknown",
    uploadedAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function listPolicyDocuments(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select d.id, d.attributes, d.created_at, latest.attributes as version_attributes
      from documents d
        join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id and dt.attributes->>'code' = 'POLICY'
        left join lateral (
          select v.attributes - 'content_base64' as attributes from document_versions v
          where v.tenant_id = d.tenant_id and v.document_id = d.id
          order by v.created_at desc limit 1
        ) latest on true
      where d.tenant_id = ${access.tenantId}
      order by d.created_at desc, d.id desc
      limit 200
    `,
  ]);
  return {
    items: (rows as Row[]).map(projectPolicy),
    canManage: authorize(access.context, { action: "policy.manage", resource: { tenantId: access.tenantId } }).allowed,
  };
}

async function policyTypeId(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from document_types where tenant_id = ${access.tenantId} and attributes->>'code' = 'POLICY' limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into document_types (id, tenant_id, attributes) values (${id}, ${access.tenantId}, '{"code":"POLICY","name":"Policy document"}'::jsonb)`,
  ]);
  return id;
}

/** True when the bytes start with the PDF signature, so a renamed file cannot pass as a PDF. */
export function isPdf(bytes: Buffer): boolean {
  return bytes.length > 4 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

export async function uploadPolicyDocument(access: Access, input: UploadPolicy, requestId: string) {
  enforce(access.context, "policy.manage", { tenantId: access.tenantId });
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_POLICY_BYTES) {
    throw new HttpError({ status: 413, code: "PAYLOAD_TOO_LARGE", message: "Policy files must be between 1 byte and 10 MB.", details: [{ field: "contentBase64", issue: "size" }] });
  }
  if (!isPdf(bytes)) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The file is not a valid PDF.", details: [{ field: "contentBase64", issue: "not_pdf" }] });
  }
  if (input.code) {
    const [dupes] = await tenantTx(access, [
      sqlClient`
        select d.id from documents d join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id
        where d.tenant_id = ${access.tenantId} and dt.attributes->>'code' = 'POLICY' and d.attributes->>'code' = ${input.code}
          and d.attributes->>'version_tag' = ${input.versionTag}
        limit 1
      `,
    ]);
    if ((dupes as unknown[]).length > 0) {
      throw new HttpError({ status: 409, code: "CONFLICT", message: `Policy ${input.code} version ${input.versionTag} already exists.`, details: [{ field: "versionTag", issue: "duplicate" }] });
    }
  }
  const typeId = await policyTypeId(access);
  const id = crypto.randomUUID();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const documentAttributes = {
    title: input.title,
    code: input.code ?? null,
    category: input.category,
    version_tag: input.versionTag,
    department: input.department || "all",
    effective_from: input.effectiveFrom,
    classification: "other",
    current_version: 1,
  };
  await tenantTx(access, [
    sqlClient`insert into documents (id, tenant_id, document_type_id, attributes) values (${id}, ${access.tenantId}, ${typeId}, ${JSON.stringify(documentAttributes)}::jsonb)`,
    sqlClient`
      insert into document_versions (tenant_id, document_id, attributes)
      values (${access.tenantId}, ${id}, ${JSON.stringify({
        version: 1, title: input.title, file_name: input.fileName, mime: input.mimeType, size_bytes: bytes.length, sha256, scan: "pending_scan", content_base64: input.contentBase64,
      })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'policy.document_upload', 'document', ${id}, 'Policy document uploaded',
        ${JSON.stringify({ title: input.title, code: input.code ?? null, version_tag: input.versionTag, sha256, size_bytes: bytes.length })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, sha256, sizeBytes: bytes.length, scan: "pending_scan" as const };
}
