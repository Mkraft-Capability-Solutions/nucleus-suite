import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

async function ensureLegalEntity(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const id = (rows as Array<{ id: string }>)[0]?.id;
  if (!id) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No legal entity exists for this tenant yet." });
  return id;
}

/**
 * CMP-01 obligation half. `title` is the workbook's `obligation`; the filing half
 * (filed on, acknowledgement, evidence, amount remitted, late reason) is recorded by
 * `attachEvidence` and by `recordFilingOutcome` in `./statutory-register`, which is where
 * the late-filing rule lives.
 *
 * The due date is an input rather than a derivation because no rule pack in this repository
 * states a due-date formula per form and frequency - see tmp/_audit/requests/talent.md.
 */
export const createObligationSchema = z.object({
  title: z.string().trim().min(1).max(150),
  act: z.string().trim().min(1).max(120),
  authority: z.string().trim().min(1).max(120),
  entityCode: z.string().trim().min(1).max(40),
  locationCode: z.string().trim().min(1).max(60),
  frequency: z.enum(picklistValues("PL_FREQUENCY")).default("monthly"),
  ownerEmployeeId: z.string().uuid(),
  status: z.enum(picklistValues("PL_OBLIGATION_STATUS")).default("open"),
  formCode: z.string().trim().min(1).max(40),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).optional(),
});

export async function createObligation(access: Access, input: z.infer<typeof createObligationSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const entityId = await ensureLegalEntity(access);
  const [formRows] = await tenantTx(access, [
    sqlClient`select id from statutory_forms where attributes->>'code' = ${input.formCode} limit 1`,
  ]);
  const formId = (formRows as Array<{ id: string }>)[0]?.id ?? null;
  if (!formId) {
    throw new HttpError({ status: 422, code: "RULE_PACK_NOT_APPROVED", message: `Form ${input.formCode} has no approved rule pack and stays unavailable.` });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into compliance_calendar_items (id, tenant_id, legal_entity_id, statutory_form_id, attributes)
      values (${id}, ${access.tenantId}, ${entityId}, ${formId},
        ${JSON.stringify({
          title: input.title,
          act: input.act,
          authority: input.authority,
          entity_code: input.entityCode,
          location_code: input.locationCode,
          frequency: input.frequency,
          owner_employee_id: input.ownerEmployeeId,
          form_code: input.formCode,
          due_date: input.dueDate,
          notes: input.notes ?? null,
          status: input.status,
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'compliance.obligation_create', 'compliance_calendar_item', ${id}, 'Obligation scheduled', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: input.status };
}

export async function listObligations(access: Access, status: string | null) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const filter = status;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, legal_entity_id, attributes, created_at from compliance_calendar_items where tenant_id = ${access.tenantId}
        and (${filter}::text is null or attributes->>'status' = ${status})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}

export const attachEvidenceSchema = z.object({
  calendarItemId: z.string().uuid(),
  documentId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

export async function attachEvidence(access: Access, input: z.infer<typeof attachEvidenceSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into compliance_evidence (id, tenant_id, compliance_calendar_item_id, document_id, attributes)
      values (${id}, ${access.tenantId}, ${input.calendarItemId}, ${input.documentId},
        ${JSON.stringify({ note: input.note ?? null, version: 1 })}::jsonb)
    `,
    sqlClient`
      update compliance_calendar_items set attributes = attributes || '{"status":"evidence_attached"}'::jsonb
      where id = ${input.calendarItemId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'compliance.evidence', 'compliance_evidence', ${id}, 'Evidence version attached', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export async function listForms(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from statutory_forms order by created_at limit 100`,
  ]);
  return (rows as Array<{ id: string; attributes: { code: string } }>).map((row) => ({ id: row.id, attributes: row.attributes, available: true }));
}
