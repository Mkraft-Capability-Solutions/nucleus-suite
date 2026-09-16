import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { sqlClient } from "@/lib/db";
import { HttpError } from "@/server/platform/http";
import type { AuthorizationContext } from "@/server/identity/authorization";
import { tenantTx, type Access } from "@/server/platform/access";

export const BACKOFF_MINUTES = [1, 5, 30, 120, 720] as const;
export const MAX_TASKS_PER_TICK = 25;
export const MAX_EVENTS_PER_TICK = 50;

export function backoffForAttempt(attempt: number): number {
  if (attempt < 1) return BACKOFF_MINUTES[0]!;
  return BACKOFF_MINUTES[Math.min(attempt, BACKOFF_MINUTES.length) - 1]!;
}

export function shouldDeadLetter(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}

export type FailureVerdict = "retry" | "dead_letter";

export function classifyFailure(error: unknown): FailureVerdict {
  if (error instanceof HttpError) {
    if (error.status === 408 || error.status === 429 || error.status >= 500) return "retry";
    return "dead_letter";
  }
  return "retry";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

export function dedupeKey(taskType: string, payload: unknown): string {
  return createHash("sha256").update(`${taskType}:${stableStringify(payload)}`).digest("hex");
}

export function isAuthorizedCron(headers: Headers, secret: string): boolean {
  if (!secret) return false;
  const header = headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ClaimedTask = {
  id: string;
  tenant_id: string;
  task_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

export type ClaimedEvent = {
  id: string;
  tenant_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export async function listWorkerTenants(): Promise<string[]> {
  const rows = (await sqlClient`select tenant_id from app.worker_tenants()`) as Array<{ tenant_id: string }>;
  return rows.map((row) => row.tenant_id);
}

export async function claimTasks(tenantId: string, owner: string, limit: number): Promise<ClaimedTask[]> {
  const rows = (await sqlClient`select * from app.worker_claim_tasks(${tenantId}, ${owner}, ${limit})`) as Array<{
    id: string; tenant_id: string; task_type: string; payload: Record<string, unknown>; attempts: number; max_attempts: number;
  }>;
  return rows.map((row) => ({
    id: row.id, tenant_id: row.tenant_id, task_type: row.task_type,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts), max_attempts: Number(row.max_attempts),
  }));
}

export async function claimOutbox(tenantId: string, owner: string, limit: number): Promise<ClaimedEvent[]> {
  const rows = (await sqlClient`select * from app.worker_claim_outbox(${tenantId}, ${owner}, ${limit})`) as Array<{
    id: string; tenant_id: string; event_type: string; aggregate_type: string; aggregate_id: string;
    payload: Record<string, unknown>; attempts: number;
  }>;
  return rows.map((row) => ({
    id: row.id, tenant_id: row.tenant_id, event_type: row.event_type,
    aggregate_type: row.aggregate_type, aggregate_id: row.aggregate_id,
    payload: (row.payload ?? {}) as Record<string, unknown>, attempts: Number(row.attempts),
  }));
}

/** System authority for worker execution: first active owner membership, audited as system. */
export async function systemAccess(tenantId: string): Promise<Access> {
  const memberships = (await sqlClient`
    select m.id as membership_id, m.user_id
    from memberships m
    join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.code = 'owner' and r.status = 'active'
    where m.tenant_id = ${tenantId} and m.status = 'active'
    order by m.created_at asc limit 1
  `) as Array<{ membership_id: string; user_id: string }>;
  const membership = memberships[0];
  if (!membership) throw new Error(`No owner membership for tenant ${tenantId}; worker cannot execute.`);
  const permissions = (await sqlClient`select permission_key from permissions where status = 'active'`) as Array<{ permission_key: string }>;
  const context: AuthorizationContext = {
    actorUserId: membership.user_id,
    membershipId: membership.membership_id,
    tenantId,
    permissions: permissions.map((row) => row.permission_key),
    roles: ["owner"],
  };
  return { context, tenantId };
}

/**
 * RL-06 lapses a comp-off grant ON its expiry date, but only if something asks.
 * Nothing ever created a `leave.coff_expire` task, so the nightly lapse never ran
 * at all and a grant stayed `available` for ever. The tick enqueues one per tenant
 * per day: the day's own `asOf` is the dedupe key, so a tick every few minutes
 * still enqueues once, and the run itself is idempotent on top of that.
 */
export async function enqueueDailyLeaveLapse(tenantId: string, asOf: string): Promise<boolean> {
  const rows = (await sqlClient`
    insert into scheduled_tasks (tenant_id, task_type, payload, available_at)
    select ${tenantId}, 'leave.coff_expire', ${JSON.stringify({ asOf })}::jsonb, now()
    where not exists (
      select 1 from scheduled_tasks
      where tenant_id = ${tenantId} and task_type = 'leave.coff_expire' and payload->>'asOf' = ${asOf}
    )
    returning id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

export type TaskVerdict = "completed" | "retry" | "dead_letter";

export async function settleTask(
  task: ClaimedTask,
  verdict: TaskVerdict,
  meta: { owner: string; startedAt: string; errorMessage?: string },
): Promise<void> {
  const outcome = verdict === "completed" ? "succeeded" : verdict === "retry" ? "retry" : "dead";
  await sqlClient`
    insert into task_attempts (tenant_id, scheduled_task_id, attempt_number, worker_id, started_at, ended_at, outcome, redacted_error)
    values (${task.tenant_id}, ${task.id}, ${task.attempts}, ${meta.owner}, ${meta.startedAt}, now(), ${outcome}, ${(meta.errorMessage ?? "none").slice(0, 500)})
  `;
  if (verdict === "completed") {
    await sqlClient`update scheduled_tasks set status = 'succeeded', completed_at = now(), lease_owner = null, lease_expires_at = null where id = ${task.id}`;
    return;
  }
  if (verdict === "dead_letter" || shouldDeadLetter(task.attempts, task.max_attempts)) {
    await sqlClient`
      update scheduled_tasks set status = 'dead', lease_owner = null, lease_expires_at = null,
        payload = payload || ${JSON.stringify({ last_error: meta.errorMessage ?? "unknown" })}::jsonb
      where id = ${task.id}
    `;
    return;
  }
  const delay = backoffForAttempt(task.attempts);
  await sqlClient`
    update scheduled_tasks set status = 'pending', lease_owner = null, lease_expires_at = null,
      available_at = now() + (${delay} || ' minutes')::interval,
      payload = payload || ${JSON.stringify({ last_error: meta.errorMessage ?? "unknown" })}::jsonb
    where id = ${task.id}
  `;
}

export type TickSummary = {
  tenants: number;
  tasks: { enqueued: number; claimed: number; completed: number; retried: number; deadLettered: number };
  outbox: { claimed: number; published: number; deadLettered: number; deliveries: number };
};

export async function runTick(owner: string, taskLimit = MAX_TASKS_PER_TICK, eventLimit = MAX_EVENTS_PER_TICK): Promise<TickSummary> {
  const { dispatchTask } = await import("@/server/jobs/handlers");
  const summary: TickSummary = {
    tenants: 0,
    tasks: { enqueued: 0, claimed: 0, completed: 0, retried: 0, deadLettered: 0 },
    outbox: { claimed: 0, published: 0, deadLettered: 0, deliveries: 0 },
  };
  const today = new Date().toISOString().slice(0, 10);
  for (const tenantId of await listWorkerTenants()) {
    summary.tenants += 1;
    const access = await systemAccess(tenantId);
    // Enqueued before the claim so the day's lapse runs in this same tick.
    if (await enqueueDailyLeaveLapse(tenantId, today)) summary.tasks.enqueued += 1;
    for (const task of await claimTasks(tenantId, owner, taskLimit)) {
      summary.tasks.claimed += 1;
      const startedAt = new Date().toISOString();
      try {
        await dispatchTask(access, task.task_type, task.payload);
        await settleTask(task, "completed", { owner, startedAt });
        summary.tasks.completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown worker failure.";
        const verdict = classifyFailure(error);
        if (verdict === "retry" && !shouldDeadLetter(task.attempts, task.max_attempts)) {
          await settleTask(task, "retry", { owner, startedAt, errorMessage: message });
          summary.tasks.retried += 1;
        } else {
          await settleTask(task, "dead_letter", { owner, startedAt, errorMessage: message });
          summary.tasks.deadLettered += 1;
        }
      }
    }
    for (const event of await claimOutbox(tenantId, owner, eventLimit)) {
      summary.outbox.claimed += 1;
      try {
        const made = await dispatchOutboxEvent(access, event);
        await settleEvent(event, true);
        summary.outbox.published += 1;
        summary.outbox.deliveries += made;
      } catch (error) {
        await settleEvent(event, false, error instanceof Error ? error.message : "Outbox dispatch failed.");
        summary.outbox.deadLettered += 1;
      }
    }
  }
  return summary;
}

export async function dispatchOutboxEvent(access: Access, event: ClaimedEvent): Promise<number> {
  const [subscriptionRows] = await tenantTx(access, [
    sqlClient`
      select s.id from webhook_subscriptions s
      join webhook_endpoints e on e.id = s.webhook_endpoint_id
      where s.tenant_id = ${access.tenantId} and s.attributes->>'status' = 'active'
        and e.attributes->>'status' = 'active' and s.attributes->'events' ? ${event.event_type}
    `,
  ]);
  const targets = subscriptionRows as Array<{ id: string }>;
  if (targets.length > 0) {
    await tenantTx(access, targets.map((target) => sqlClient`
      insert into webhook_deliveries (tenant_id, outbox_event_id, webhook_subscription_id, attributes)
      values (${access.tenantId}, ${event.id}, ${target.id},
        ${JSON.stringify({ status: "queued", attempts: 0, event_type: event.event_type, aggregate_id: event.aggregate_id })}::jsonb)
    `));
  }
  const { fanOutEvent } = await import("@/server/notifications/service");
  const [actorRows] = await tenantTx(access, [
    sqlClient`
      select membership_id from audit_events
      where tenant_id = ${access.tenantId} and entity_id = ${event.aggregate_id}
      order by created_at desc limit 1
    `,
  ]);
  const actor = (actorRows as Array<{ membership_id: string | null }>)[0];
  await fanOutEvent(access, event.event_type, event.payload, actor?.membership_id ?? access.context.membershipId);
  return targets.length;
}

export async function settleEvent(event: ClaimedEvent, published: boolean, errorMessage?: string): Promise<void> {
  if (published) {
    await sqlClient`update transactional_outbox set status = 'published', published_at = now(), lease_owner = null where id = ${event.id}`;
    return;
  }
  await sqlClient`
    update transactional_outbox set status = 'dead', lease_owner = null,
      payload = payload || ${JSON.stringify({ last_error: errorMessage ?? "unknown" })}::jsonb
    where id = ${event.id}
  `;
}
