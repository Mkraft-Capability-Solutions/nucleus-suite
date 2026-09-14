import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * There is no recompute-job table in the canonical topology, and none is
 * invented here. The monitor reads the two places a recompute actually leaves a
 * trace:
 *   1. `audit_events` whose action is in the attendance recompute family —
 *      `attendance.day_recompute` (written by recomputeDay in service.ts) and
 *      `attendance.recompute_queue` (written by queueRecompute below);
 *   2. `scheduled_tasks` whose task type or payload names an attendance
 *      recompute / recalculation / aggregation run.
 * When neither yields rows the monitor is empty. Nothing is synthesised from
 * attendance days.
 */
export const RECOMPUTE_QUEUE_ACTION = "attendance.recompute_queue";
const RECOMPUTE_ENTITY_TYPE = "attendance_recompute";

export type RecomputeState = "queued" | "running" | "completed" | "blocked";

/**
 * Pure state mapping for one recompute record (unit-tested). The stored status
 * wins when it is recognised; otherwise a completion timestamp proves the run
 * finished and anything else is still waiting.
 */
export function deriveRecomputeState(
  storedStatus: string | null | undefined,
  completedAt: string | null,
): RecomputeState {
  const normalized = (storedStatus ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["failed", "blocked", "dead", "cancelled", "canceled", "error"].includes(normalized)) return "blocked";
  if (["succeeded", "success", "completed", "complete", "done"].includes(normalized)) return "completed";
  if (["running", "leased", "in_progress", "processing"].includes(normalized)) return "running";
  if (["queued", "pending", "available", "scheduled"].includes(normalized)) return "queued";
  return completedAt ? "completed" : "queued";
}

/**
 * Pure minutes rendering for the delta column (unit-tested). A recompute that
 * changed nothing says so; a delta that was never measured stays an em dash
 * rather than a misleading zero.
 */
export function deltaLabel(minutes: number | null): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  if (minutes === 0) return "No change";
  return `${minutes} min OT`;
}

export type RecomputeRow = {
  id: string;
  job_reference: string;
  scope: string;
  scope_employee_code: string | null;
  from_date: string | null;
  to_date: string | null;
  delta_minutes: number | null;
  delta_label: string;
  queued_at: string | null;
  completed_at: string | null;
  status: RecomputeState;
};

type RecomputeQueryRow = Omit<RecomputeRow, "delta_label" | "status"> & { stored_status: string | null };

const NUMERIC = `~ '^-?[0-9]+$'`;

/**
 * Both sources projected onto one shape. `source_kind` is kept out of the row
 * type: what the screen shows is the scope, not the plumbing.
 */
const RECOMPUTE_SELECT = `select * from (
    select ev.id::text as id,
      left(ev.id::text, 8) as job_reference,
      coalesce(nullif(ev.after->>'scope', ''),
               case when ev.action = '${RECOMPUTE_QUEUE_ACTION}' then 'Employee range' else 'Attendance day' end) as scope,
      emp.employee_code as scope_employee_code,
      nullif(ev.after->>'from_date', '') as from_date,
      nullif(ev.after->>'to_date', '') as to_date,
      case when coalesce(ev.after->>'delta_minutes', '') ${NUMERIC} then (ev.after->>'delta_minutes')::int end as delta_minutes,
      ev.created_at::text as queued_at,
      case when ev.action = '${RECOMPUTE_QUEUE_ACTION}' then nullif(ev.after->>'completed_at', '')
           else ev.created_at::text end as completed_at,
      coalesce(nullif(ev.after->>'status', ''),
               case when ev.action = '${RECOMPUTE_QUEUE_ACTION}' then 'queued' else 'completed' end) as stored_status
    from audit_events ev
    left join employees emp on emp.tenant_id = ev.tenant_id
      and emp.id::text = coalesce(ev.after->>'employee_scope', ev.after->>'employee_id')
    where ev.tenant_id = $1 and ev.action like 'attendance.%recompute%'
    union all
    select t.id::text as id,
      left(t.id::text, 8) as job_reference,
      t.task_type as scope,
      nullif(t.payload->>'employee_code', '') as scope_employee_code,
      nullif(t.payload->>'from_date', '') as from_date,
      nullif(t.payload->>'to_date', '') as to_date,
      case when coalesce(t.payload->>'delta_minutes', '') ${NUMERIC} then (t.payload->>'delta_minutes')::int end as delta_minutes,
      coalesce(t.available_at, t.created_at)::text as queued_at,
      t.completed_at::text as completed_at,
      t.status as stored_status
    from scheduled_tasks t
    where t.tenant_id = $1
      and (lower(t.task_type) like '%recompute%'
           or lower(t.payload::text) like '%recompute%'
           or (lower(t.task_type) like '%attendance%'
               and (lower(t.task_type) like '%recalc%' or lower(t.task_type) like '%aggregat%')))
  ) monitor`;

function projectRecompute(row: RecomputeQueryRow): RecomputeRow {
  const { stored_status: storedStatus, ...rest } = row;
  return {
    ...rest,
    delta_label: deltaLabel(row.delta_minutes),
    status: deriveRecomputeState(storedStatus, row.completed_at),
  };
}

/** SCR-026 monitor: every real recompute trace, newest first. */
export async function listRecomputeMonitor(access: Access, search: string): Promise<RecomputeRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${RECOMPUTE_SELECT}
       where ($2 = '%%' or (coalesce(scope, '') || ' ' || coalesce(scope_employee_code, '') || ' '
              || coalesce(job_reference, '')) ilike $2)
       order by queued_at desc
       limit 200`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as RecomputeQueryRow[]).map(projectRecompute);
}

/** One recompute trace with the audit entries recorded against it. */
export async function getRecomputeRecord(access: Access, id: string) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${RECOMPUTE_SELECT} where id = $2 limit 1`, [access.tenantId, id]),
  ]);
  const found = (rows as RecomputeQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId}
          and ((entity_type = ${RECOMPUTE_ENTITY_TYPE} and entity_id = ${id}) or id = ${id})
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return { record: projectRecompute(found), auditTrail };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const queueRecomputeSchema = z.object({
  employeeScope: z.string().uuid(),
  fromDate: z.string().regex(ISO_DATE),
  toDate: z.string().regex(ISO_DATE),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Records a requested recompute. There is no worker queue and no job table, so
 * this writes the intent as an audit event and returns that event's id — the
 * monitor then shows it as a queued job. It does not run any recalculation.
 */
export async function queueRecompute(access: Access, input: z.infer<typeof queueRecomputeSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  if (input.toDate < input.fromDate) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The end date cannot precede the start date." });
  }
  const [employeeRows] = await tenantTx(access, [
    sqlClient`select id, employee_code from employees where tenant_id = ${access.tenantId} and id = ${input.employeeScope} limit 1`,
  ]);
  const employee = (employeeRows as Array<{ id: string; employee_code: string }>)[0];
  if (!employee) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const after = {
    scope: "Employee range",
    employee_scope: employee.id,
    employee_code: employee.employee_code,
    from_date: input.fromDate,
    to_date: input.toDate,
    status: "queued",
  };
  const [inserted] = await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${RECOMPUTE_QUEUE_ACTION}, ${RECOMPUTE_ENTITY_TYPE}, ${employee.id}, ${input.reason},
        ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      returning id
    `,
  ]);
  const id = (inserted as Array<{ id: string }>)[0]?.id;
  if (!id) {
    throw new HttpError({ status: 500, code: "INTERNAL_ERROR", message: "The request could not be completed." });
  }
  return { id, ...after };
}
