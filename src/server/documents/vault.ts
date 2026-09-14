import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** SCR-014 — document vault over `documents` with expiry and verification state. */

export type DocumentVaultState = "pending_verification" | "verified" | "rejected" | "expired" | "replaced";

/**
 * Legacy rows carry the antivirus verdict in `attributes.scan`; newer rows carry a
 * human verification decision in `attributes.verification`. Both funnel through here
 * so the board never shows two vocabularies for the same idea.
 */
export function normaliseVerification(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "verified" || value === "available") return "verified";
  // Only the human decision is a rejection; a failed antivirus scan ("quarantined") is a
  // scan verdict, and stays pending until someone actually verifies the document.
  if (value === "rejected") return "rejected";
  if (value === "replaced") return "replaced";
  return "pending";
}

/**
 * Pure vault state mapping shared by the board contract (unit-tested).
 * Replacement wins over expiry, expiry wins over an earlier verification.
 * Rejection outranks expiry: a rejected document has to be re-uploaded whatever
 * its expiry says, so ageing out must not hide the reason it was sent back.
 */
export function deriveDocumentState(
  verification: string | null | undefined,
  expiresOn: string | null | undefined,
  today: string = new Date().toISOString().slice(0, 10),
): DocumentVaultState {
  const value = (verification ?? "").trim().toLowerCase();
  if (value === "replaced") return "replaced";
  if (value === "rejected") return "rejected";
  const expiry = (expiresOn ?? "").trim();
  if (expiry.length > 0 && expiry.slice(0, 10) < today) return "expired";
  if (value === "verified") return "verified";
  return "pending_verification";
}

export type DocumentVaultRow = {
  id: string;
  title: string;
  code: string;
  document_type: string;
  /** The workbook's document class (PL_DOCUMENT_CLASS); null on rows uploaded before it was captured. */
  classification: string | null;
  employee_code: string | null;
  employee_name: string | null;
  issued_on: string | null;
  expires_on: string | null;
  replaces_document_id: string | null;
  verification: string;
  rejection_reason: string | null;
  status: DocumentVaultState;
};

type DocumentVaultQueryRow = Omit<DocumentVaultRow, "verification" | "status"> & { verification: string | null };

const VERIFY_ACTION = "document.verify";
const ENTITY_TYPE = "document";

/**
 * Expiries are versioned rows; only the newest one governs the vault board, so the
 * lateral keeps the join to a single row per document.
 */
const EXPIRY_LATERAL = `left join lateral (
  select x.attributes->>'expires_on' as expires_on
  from document_expiries x
  where x.tenant_id = d.tenant_id and x.document_id = d.id
  order by x.created_at desc limit 1
) ex on true`;

const DOCUMENT_VAULT_SELECT = `select d.id,
  coalesce(d.attributes->>'title', d.attributes->>'code', 'Untitled document') as title,
  coalesce(d.attributes->>'code', d.id::text) as code,
  coalesce(dt.attributes->>'name', dt.attributes->>'code', 'Unclassified') as document_type,
  coalesce(d.attributes->>'classification', d.attributes->>'category') as classification,
  e.employee_code,
  case when e.employee_code is null then null else e.first_name || ' ' || e.last_name end as employee_name,
  coalesce(d.attributes->>'issued_on', d.attributes->>'issued_at') as issued_on,
  coalesce(ex.expires_on, d.attributes->>'expires_at') as expires_on,
  d.attributes->>'replaces_document_id' as replaces_document_id,
  d.attributes->>'rejection_reason' as rejection_reason,
  coalesce(d.attributes->>'verification', d.attributes->>'scan') as verification
from documents d
left join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id
left join employees e on e.tenant_id = d.tenant_id and e.id = d.employee_id
${EXPIRY_LATERAL}`;

/** Project the raw query row onto the board contract (normalised + derived). */
function project(row: DocumentVaultQueryRow): DocumentVaultRow {
  const verification = normaliseVerification(row.verification);
  return { ...row, verification, status: deriveDocumentState(verification, row.expires_on) };
}

export async function listDocumentVault(access: Access, search: string): Promise<DocumentVaultRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${DOCUMENT_VAULT_SELECT}
       where d.tenant_id = $1
         and (coalesce(d.attributes->>'title', '') || ' ' || coalesce(d.attributes->>'code', '') || ' ' || coalesce(dt.attributes->>'name', '') || ' ' || coalesce(e.employee_code, '')) ilike $2
       order by coalesce(d.attributes->>'code', d.id::text) asc limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as DocumentVaultQueryRow[]).map(project);
}

/** One document with its version ledger and an isolated audit trail. */
export async function getDocumentVaultRecord(access: Access, id: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${DOCUMENT_VAULT_SELECT} where d.tenant_id = $1 and d.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const raw = (rows as DocumentVaultQueryRow[])[0];
  if (!raw) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const record = project(raw);
  const [versionRows] = await tenantTx(access, [
    sqlClient`select id, created_at::text as created_at, attributes from document_versions
      where tenant_id = ${access.tenantId} and document_id = ${id}
      order by created_at desc limit 20`,
  ]);
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = ${ENTITY_TYPE} and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record, versions: versionRows as Array<Record<string, unknown>>, auditTrail };
}

/**
 * The workbook's verification vocabulary is PL_VERIFICATION_STATUS - Pending, Verified,
 * Rejected. `replaced` is kept alongside it because a superseded document is a real vault
 * state the board already renders; it is recorded in tmp/_audit/requests/people-lifecycle.md.
 *
 * A rejection is returned to the employee, so the workbook holds its reason to ten
 * characters rather than the three a routine decision needs. One reason is captured, not
 * two: the audited reason for a rejection *is* the rejection reason the employee is shown.
 */
export const VERIFICATION_DECISIONS = [...picklistValues("PL_VERIFICATION_STATUS"), "replaced"] as const;
export const REJECTION_REASON_MIN_LENGTH = 10;

export const verifyDocumentSchema = z.object({
  decision: z.enum(VERIFICATION_DECISIONS),
  reason: z.string().trim().min(3).max(500),
}).refine(
  (input) => input.decision !== "rejected" || input.reason.trim().length >= REJECTION_REASON_MIN_LENGTH,
  { path: ["reason"], message: `A rejection reason must be at least ${REJECTION_REASON_MIN_LENGTH} characters; the employee is shown it.` },
);

/** Record a verification decision on a document; always audited with before/after. */
export async function verifyDocument(
  access: Access,
  id: string,
  input: z.infer<typeof verifyDocumentSchema>,
  requestId: string,
) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, coalesce(attributes->>'verification', attributes->>'scan') as verification from documents
      where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const document = (rows as Array<{ id: string; verification: string | null }>)[0];
  if (!document) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const from = normaliseVerification(document.verification);
  // Clearing the reason on any non-rejection stops a stale rejection being shown against
  // a document that has since been accepted.
  const rejectionReason = input.decision === "rejected" ? input.reason : null;
  await tenantTx(access, [
    sqlClient`
      update documents
      set attributes = attributes || jsonb_build_object(
            'verification', ${input.decision}::text,
            'verified_at', to_char(current_date, 'YYYY-MM-DD'),
            'rejection_reason', ${rejectionReason}::text
          ),
          updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${VERIFY_ACTION}, ${ENTITY_TYPE}, ${id}, ${input.reason},
        ${JSON.stringify({ verification: from })}::jsonb,
        ${JSON.stringify({ verification: input.decision })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from, to: input.decision };
}
