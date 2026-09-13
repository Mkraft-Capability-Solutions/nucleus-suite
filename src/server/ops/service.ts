import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const auditQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(80).optional(),
  actorUserId: z.string().trim().max(80).optional(),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export async function queryAudit(access: Access, input: z.infer<typeof auditQuerySchema>) {
  enforce(access.context, "audit.read", { tenantId: access.tenantId });
  const offset = (input.page - 1) * input.pageSize;
  const action = input.action ?? null;
  const entityType = input.entityType ?? null;
  const entityId = input.entityId ?? null;
  const actor = input.actorUserId ?? null;
  const since = input.since ?? null;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from audit_events where tenant_id = ${access.tenantId}
        and (${action}::text is null or action = ${input.action})
        and (${entityType}::text is null or entity_type = ${input.entityType})
        and (${entityId}::text is null or entity_id = ${input.entityId})
        and (${actor}::text is null or actor_user_id = ${input.actorUserId})
        and (${since}::date is null or created_at >= ${input.since}::date)
    `,
    sqlClient`
      select id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, correlation_id, request_id, created_at
      from audit_events where tenant_id = ${access.tenantId}
        and (${action}::text is null or action = ${input.action})
        and (${entityType}::text is null or entity_type = ${input.entityType})
        and (${entityId}::text is null or entity_id = ${input.entityId})
        and (${actor}::text is null or actor_user_id = ${input.actorUserId})
        and (${since}::date is null or created_at >= ${input.since}::date)
      order by created_at desc limit ${input.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export async function queryAccessEvents(access: Access, args: { subjectId?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "audit.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const subject = args.subjectId ?? null;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from access_events where tenant_id = ${access.tenantId}
        and (${subject}::text is null or subject_id = ${args.subjectId})
    `,
    sqlClient`
      select membership_id, subject_type, subject_id, field_domain, purpose, decision, reason_code, occurred_at
      from access_events where tenant_id = ${access.tenantId}
        and (${subject}::text is null or subject_id = ${args.subjectId})
      order by occurred_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export async function listOutbox(access: Access, status: string | null) {
  enforce(access.context, "tenant.read", { tenantId: access.tenantId });
  const filter = status;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, event_type, aggregate_type, aggregate_id, status, attempts, available_at, published_at, created_at
      from transactional_outbox where tenant_id = ${access.tenantId}
        and (${filter}::text is null or status = ${status})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}

export async function retryOutbox(access: Access, eventId: string, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, status from transactional_outbox where tenant_id = ${access.tenantId} and id = ${eventId} limit 1`,
  ]);
  const event = (rows as Array<{ id: string; status: string }>)[0];
  if (!event) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (event.status !== "dead" && event.status !== "failed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Only dead-lettered or failed events can be retried (current: ${event.status}).` });
  }
  await tenantTx(access, [
    sqlClient`update transactional_outbox set status = 'pending', attempts = 0, available_at = now() where id = ${eventId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ops.outbox_retry', 'transactional_outbox', ${eventId}, 'Dead-letter replay authorized', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: eventId, status: "pending" };
}

export async function listScheduledTasks(access: Access, status: string | null) {
  enforce(access.context, "tenant.read", { tenantId: access.tenantId });
  const filter = status;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, task_type, status, attempts, max_attempts, available_at, lease_owner, lease_expires_at, completed_at, created_at
      from scheduled_tasks where tenant_id = ${access.tenantId}
        and (${filter}::text is null or status = ${status})
      order by available_at asc limit 100
    `,
  ]);
  return rows;
}

export async function cancelScheduledTask(access: Access, taskId: string, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, status from scheduled_tasks where tenant_id = ${access.tenantId} and id = ${taskId} limit 1`,
  ]);
  const task = (rows as Array<{ id: string; status: string }>)[0];
  if (!task) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (task.status === "succeeded") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Completed tasks cannot be cancelled; completed financial effects reverse only via adjustment." });
  }
  await tenantTx(access, [
    sqlClient`update scheduled_tasks set status = 'cancelled', updated_at = now() where id = ${taskId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ops.task_cancel', 'scheduled_task', ${taskId}, 'Best-effort cancellation', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: taskId, status: "cancelled" };
}
