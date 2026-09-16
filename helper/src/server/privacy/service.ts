import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const openRightsSchema = z.object({
  kind: z.enum(["access", "rectify", "erase", "nominate"]),
  subjectEmployeeId: z.string().uuid().optional(),
  details: z.string().trim().min(1).max(2000),
  identityProofRef: z.string().trim().min(1).max(200),
});

export async function openRightsCase(access: Access, input: z.infer<typeof openRightsSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into privacy_requests (id, tenant_id, requested_by_user_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.actorUserId},
        ${JSON.stringify({ kind: input.kind, subject_employee_id: input.subjectEmployeeId ?? null, details: input.details, identity_proof_ref: input.identityProofRef, identity_verified: true, status: "received" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'privacy.case_open', 'privacy_request', ${id}, 'Privacy rights case opened', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "received" };
}

export async function closeRightsCase(access: Access, id: string, outcome: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from privacy_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string; attributes: { status: string; kind: string; subject_employee_id: string | null } }>)[0];
  if (!existing) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (existing.attributes.kind === "erase") {
    const [holds] = await tenantTx(access, [
      sqlClient`select id from legal_holds where tenant_id = ${access.tenantId} and attributes->>'status' = 'active' limit 1`,
    ]);
    if ((holds as unknown[]).length > 0) {
      throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Erasure is blocked by an active legal hold." });
    }
  }
  await tenantTx(access, [
    sqlClient`
      update privacy_requests set attributes = attributes || ${JSON.stringify({ status: "closed", outcome })}::jsonb
      where id = ${id} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'privacy.case_close', 'privacy_request', ${id}, 'Privacy rights case closed', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "closed" };
}

export const createHoldSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  scope: z.string().trim().min(1).max(200).default("tenant"),
});

export async function createLegalHold(access: Access, input: z.infer<typeof createHoldSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into legal_holds (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ reason: input.reason, scope: input.scope, status: "active" })}::jsonb)
    `,
  ]);
  return { id, status: "active" };
}

export async function releaseLegalHold(access: Access, id: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await tenantTx(access, [
    sqlClient`update legal_holds set attributes = attributes || '{"status":"released"}'::jsonb where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'privacy.hold_release', 'legal_hold', ${id}, 'Legal hold released', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "released" };
}
