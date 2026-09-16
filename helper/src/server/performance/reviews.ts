import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const enrollParticipantSchema = z.object({
  employeeId: z.string().uuid(),
  cycleCode: z.string().trim().min(1).max(40),
  templateCode: z.string().trim().min(1).max(40).default("STD-360"),
  managerEmployeeId: z.string().uuid().optional(),
});

async function ensureTemplate(access: Access, code: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from review_templates where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into review_templates (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code })}::jsonb)`,
  ]);
  return id;
}

async function ensureCycle(access: Access, code: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from review_cycles where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into review_cycles (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code, status: "open" })}::jsonb)`,
  ]);
  return id;
}

export async function enrollParticipant(access: Access, input: z.infer<typeof enrollParticipantSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const cycleId = await ensureCycle(access, input.cycleCode);
  const templateId = await ensureTemplate(access, input.templateCode);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into review_participants (id, tenant_id, employee_id, manager_employee_id, review_cycle_id, review_template_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.managerEmployeeId ?? null}, ${cycleId}, ${templateId}, '{"status":"enrolled"}'::jsonb)
    `,
  ]);
  return { id };
}

export const submitResponseSchema = z.object({
  participantId: z.string().uuid(),
  relationship: z.enum(["self", "manager", "peer", "report"]),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)).refine((value) => Object.keys(value).length > 0, "At least one rating is required."),
  summary: z.string().trim().min(1).max(2000),
});

export async function submitResponse(access: Access, input: z.infer<typeof submitResponseSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [memberRows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  const raterEmployeeId = (memberRows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
  const [participantRows] = await tenantTx(access, [
    sqlClient`select id, employee_id from review_participants where tenant_id = ${access.tenantId} and id = ${input.participantId} limit 1`,
  ]);
  const participant = (participantRows as Array<{ id: string; employee_id: string }>)[0];
  if (!participant) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (input.relationship === "self" && raterEmployeeId !== participant.employee_id) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Self reviews require the subject's own login." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into review_responses (id, tenant_id, rater_employee_id, review_participant_id, attributes)
      values (${id}, ${access.tenantId}, ${raterEmployeeId ?? access.context.actorUserId}, ${input.participantId},
        ${JSON.stringify({ relationship: input.relationship, ratings: input.ratings, summary: input.summary })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'perf.review_response', 'review_response', ${id}, 'Review response submitted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export async function participantResponses(access: Access, participantId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes, created_at from review_responses where tenant_id = ${access.tenantId} and review_participant_id = ${participantId} order by created_at`,
  ]);
  return rows;
}
