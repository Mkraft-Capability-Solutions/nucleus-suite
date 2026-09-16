import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * SCR-060 Joining chain console.
 *
 * Read-side projection over `onboarding_instances` that tolerates the two task
 * attribute shapes present in the estate (legacy `{completed, task_name}` and
 * current `{key, owner, title, status, required}`). Writes are NOT duplicated
 * here: task completion stays in `src/server/lifecycle/service.ts`.
 */

export type JoiningChainState = "not_started" | "in_progress" | "blocked" | "ready";

/** Pure readiness mapping shared by the joining-chain contract (unit-tested). */
export function deriveJoiningState(
  total: number,
  done: number,
  requiredPending: number,
  blocked: boolean,
): JoiningChainState {
  if (blocked) return "blocked";
  if (!(total > 0)) return "not_started";
  if (requiredPending === 0) return "ready";
  if (done === 0) return "not_started";
  return "in_progress";
}

/** Human label rendered beside the machine state in the console. */
export function joiningReadinessLabel(state: JoiningChainState): string {
  if (state === "ready") return "Completed";
  if (state === "not_started") return "Not started";
  if (state === "blocked") return "Blocked";
  return "In progress";
}

export type JoiningChainRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  location: string;
  template_name: string;
  joining_date: string | null;
  joining_deviation_reason: string | null;
  candidate_id: string | null;
  offer_id: string | null;
  owner: string;
  total: number;
  done: number;
  required_pending: number;
  readiness: string;
  status: JoiningChainState;
};

export type JoiningChainTask = {
  id: string;
  title: string;
  owner: string;
  required: boolean;
  done: boolean;
  completed_at: string | null;
  /** PL_TASK_STATUS, with "overdue" derived from the due date rather than stored. */
  item_status: string;
  due_date: string | null;
  waiver_reason: string | null;
};

type JoiningChainQueryRow = Omit<JoiningChainRow, "owner" | "readiness" | "status"> & {
  blocked: boolean;
  next_owner: string | null;
};

/** Dual-shape task normalisation: legacy `completed` and current `status`. */
const TASK_DONE_SQL = `(coalesce(task.attributes->>'status', '') in ('done', 'waived') or (task.attributes->>'completed')::boolean is true)`;
const TASK_REQUIRED_SQL = `((task.attributes->>'required')::boolean is true)`;
const TASK_OWNER_SQL = `coalesce(task.attributes->>'owner', 'People Ops')`;
const TASK_TITLE_SQL = `coalesce(task.attributes->>'title', task.attributes->>'task_name', 'Onboarding task')`;

const TEMPLATE_NAME_SQL = `coalesce(template.attributes->>'name', template.attributes->>'template_name', template.attributes->>'code', 'Onboarding')`;

const TASK_ROLLUP_LATERAL = `left join lateral (
  select count(*)::int as total,
         count(*) filter (where ${TASK_DONE_SQL})::int as done,
         count(*) filter (where ${TASK_REQUIRED_SQL} and not ${TASK_DONE_SQL})::int as required_pending,
         (array_agg(${TASK_OWNER_SQL} order by task.created_at asc)
            filter (where ${TASK_REQUIRED_SQL} and not ${TASK_DONE_SQL}))[1] as next_owner
  from onboarding_tasks task
  where task.tenant_id = instance.tenant_id and task.onboarding_instance_id = instance.id
) rollup on true`;

const JOINING_CHAIN_SELECT = `select instance.id, instance.employee_id,
    employee.employee_code,
    trim(coalesce(employee.first_name, '') || ' ' || coalesce(employee.last_name, '')) as employee_name,
    coalesce(employee.department, 'Unassigned') as department,
    coalesce(employee.location, 'Unassigned') as location,
    ${TEMPLATE_NAME_SQL} as template_name,
    coalesce(instance.attributes->>'actual_joining_date', employee.joining_date::text) as joining_date,
    instance.attributes->>'joining_deviation_reason' as joining_deviation_reason,
    instance.attributes->>'candidate_id' as candidate_id,
    instance.attributes->>'offer_id' as offer_id,
    coalesce(rollup.total, 0)::int as total,
    coalesce(rollup.done, 0)::int as done,
    coalesce(rollup.required_pending, 0)::int as required_pending,
    (coalesce(instance.attributes->>'status', 'active') = 'blocked') as blocked,
    rollup.next_owner
  from onboarding_instances instance
  join employees employee on employee.tenant_id = instance.tenant_id and employee.id = instance.employee_id
  left join onboarding_templates template on template.tenant_id = instance.tenant_id and template.id = instance.onboarding_template_id
  ${TASK_ROLLUP_LATERAL}`;

function toJoiningChainRow(raw: JoiningChainQueryRow): JoiningChainRow {
  const total = Number(raw.total ?? 0);
  const done = Number(raw.done ?? 0);
  const requiredPending = Number(raw.required_pending ?? 0);
  const status = deriveJoiningState(total, done, requiredPending, raw.blocked === true);
  return {
    id: raw.id,
    employee_id: raw.employee_id,
    employee_code: raw.employee_code,
    employee_name: raw.employee_name,
    department: raw.department,
    location: raw.location,
    template_name: raw.template_name,
    joining_date: raw.joining_date ?? null,
    joining_deviation_reason: raw.joining_deviation_reason ?? null,
    candidate_id: raw.candidate_id ?? null,
    offer_id: raw.offer_id ?? null,
    owner: raw.next_owner ?? "Joining chain",
    total,
    done,
    required_pending: requiredPending,
    readiness: joiningReadinessLabel(status),
    status,
  };
}

/** Joining chain queue with dual-shape task rollups and derived readiness. */
export async function listJoiningChain(access: Access, search: string): Promise<JoiningChainRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${JOINING_CHAIN_SELECT}
       where instance.tenant_id = $1
         and (coalesce(employee.employee_code, '') || ' ' || coalesce(employee.first_name, '') || ' '
              || coalesce(employee.last_name, '') || ' ' || ${TEMPLATE_NAME_SQL}) ilike $2
       order by employee.joining_date desc nulls last, employee.employee_code asc
       limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as JoiningChainQueryRow[]).map(toJoiningChainRow);
}

/** Single joining chain with its normalised tasks and an isolated audit trail. */
export async function getJoiningChainRecord(
  access: Access,
  id: string,
): Promise<{ record: JoiningChainRow; tasks: JoiningChainTask[]; auditTrail: Array<Record<string, unknown>> }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${JOINING_CHAIN_SELECT}
       where instance.tenant_id = $1 and instance.id = $2::uuid
       limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const raw = (rows as JoiningChainQueryRow[])[0];
  if (!raw) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [taskRows] = await tenantTx(access, [
    sqlClient.query(
      `select task.id,
          ${TASK_TITLE_SQL} as title,
          ${TASK_OWNER_SQL} as owner,
          ${TASK_REQUIRED_SQL} as required,
          ${TASK_DONE_SQL} as done,
          coalesce(task.attributes->>'completed_on', task.attributes->>'completed_at') as completed_at,
          case
            when coalesce(task.attributes->>'status', '') in ('done', 'waived') then task.attributes->>'status'
            when task.attributes->>'due_date' is not null and task.attributes->>'due_date' < to_char(current_date, 'YYYY-MM-DD') then 'overdue'
            when coalesce(task.attributes->>'status', '') = 'in_progress' then 'in_progress'
            else 'open' end as item_status,
          task.attributes->>'due_date' as due_date,
          task.attributes->>'waiver_reason' as waiver_reason
        from onboarding_tasks task
        where task.tenant_id = $1 and task.onboarding_instance_id = $2::uuid
        order by task.created_at asc
        limit 200`,
      [access.tenantId, id],
    ),
  ]);
  // The audit trail is auxiliary: a projection failure must never fail the record.
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'onboarding_instance' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record: toJoiningChainRow(raw), tasks: taskRows as JoiningChainTask[], auditTrail };
}
