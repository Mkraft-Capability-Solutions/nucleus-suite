import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { listUnacknowledgedPoliciesForEmployee } from "@/server/engagement/policy-acknowledgements";

/**
 * SCR-042 — Employee home actions.
 *
 * The signed-in employee's self-service work queue, derived entirely from
 * governed records: onboarding tasks, exit clearance items, unacknowledged
 * policy versions, their own documents and their pending leave requests.
 * Nothing is synthesised; every row is backed by a real row id.
 *
 * Each source is gathered inside its own try/catch so one unavailable source
 * degrades to an empty slice instead of failing the whole queue
 * (partial-data contract, as in `getEmployeeTimeline`).
 */

export type HomeActionState = "available" | "queued_offline" | "completed" | "needs_attention";

/** Pure state mapping shared by the home-actions contract (unit-tested). */
export function deriveHomeActionState(
  args: { completed: boolean; blocked: boolean; dueOn: string | null },
  today: string = new Date().toISOString().slice(0, 10),
): HomeActionState {
  if (args.completed) return "completed";
  if (args.blocked) return "needs_attention";
  if (args.dueOn && args.dueOn < today) return "needs_attention";
  return "available";
}

export type HomeActionSource = "onboarding" | "clearance" | "policy" | "document" | "leave";

export type HomeActionRow = {
  id: string;
  action: string;
  context: string;
  source: HomeActionSource;
  updated_at: string | null;
  due_on: string | null;
  status: HomeActionState;
  href: string;
};

export type HomeActionEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string | null;
  location: string | null;
};

const STATE_ORDER: Record<HomeActionState, number> = {
  needs_attention: 0,
  available: 1,
  queued_offline: 2,
  completed: 3,
};

/** Pure ordering: attention first, then actionable, then done; newest first inside each group. */
export function sortHomeActions(rows: HomeActionRow[]): HomeActionRow[] {
  return [...rows].sort((left, right) => {
    const byState = STATE_ORDER[left.status] - STATE_ORDER[right.status];
    if (byState !== 0) return byState;
    const leftAt = left.updated_at ?? "";
    const rightAt = right.updated_at ?? "";
    if (leftAt === rightAt) return 0;
    return leftAt < rightAt ? 1 : -1;
  });
}

/**
 * Signed-in employee header. `$1` tenant, `$2` the actor user id.
 * A membership with no linked employee yields no row.
 */
const HOME_EMPLOYEE_SELECT = `select emp.id, emp.employee_code, emp.first_name, emp.last_name, emp.department, emp.location
  from memberships mem
  join employees emp on emp.tenant_id = mem.tenant_id and emp.id = mem.employee_id
  where mem.tenant_id = $1 and mem.user_id = $2 and mem.status = 'active' and mem.employee_id is not null
  limit 1`;

const ONBOARDING_ACTIONS_SELECT = `select task.id,
    coalesce(nullif(task.attributes->>'title', ''), nullif(task.attributes->>'task_name', ''), 'Onboarding task') as action,
    coalesce(nullif(tpl.attributes->>'name', ''), nullif(tpl.attributes->>'code', ''), 'Onboarding') as context,
    (lower(coalesce(task.attributes->>'status', '')) = 'done'
      or lower(coalesce(task.attributes->>'completed', 'false')) in ('true', 't', '1')) as completed,
    task.updated_at::text as updated_at
  from onboarding_tasks task
  join onboarding_instances inst on inst.tenant_id = task.tenant_id and inst.id = task.onboarding_instance_id
  left join onboarding_templates tpl on tpl.tenant_id = inst.tenant_id and tpl.id = inst.onboarding_template_id
  where task.tenant_id = $1 and inst.employee_id = $2::uuid
  order by task.created_at desc limit 100`;

const CLEARANCE_ACTIONS_SELECT = `select item.id,
    coalesce(nullif(item.attributes->>'item_name', ''), nullif(item.attributes->>'owner', ''), 'Clearance item') as action,
    'Exit clearance · last working day ' || coalesce(nullif(kase.attributes->>'last_working_day', ''), 'not set') as context,
    (lower(coalesce(item.attributes->>'status', '')) in ('cleared', 'waived')) as completed,
    (lower(coalesce(item.attributes->>'blocking', 'false')) in ('true', 't', '1')) as blocking,
    item.updated_at::text as updated_at
  from clearance_items item
  join offboarding_cases kase on kase.tenant_id = item.tenant_id and kase.id = item.offboarding_case_id
  join employments emt on emt.tenant_id = kase.tenant_id and emt.id = kase.employment_id
  where item.tenant_id = $1 and emt.employee_id = $2::uuid
  order by item.created_at desc limit 100`;

const DOCUMENT_ACTIONS_SELECT = `select doc.id,
    'Review ' || coalesce(nullif(doc.attributes->>'title', ''), 'document') as action,
    coalesce(nullif(dtype.attributes->>'name', ''), nullif(dtype.attributes->>'code', ''), 'Document') as context,
    expiry.expires_on as due_on,
    doc.updated_at::text as updated_at
  from documents doc
  left join document_types dtype on dtype.tenant_id = doc.tenant_id and dtype.id = doc.document_type_id
  left join lateral (
    select dx.attributes->>'expires_on' as expires_on
    from document_expiries dx
    where dx.tenant_id = doc.tenant_id and dx.document_id = doc.id
      and dx.attributes->>'expires_on' is not null
    order by dx.attributes->>'expires_on' asc limit 1
  ) expiry on true
  left join lateral (
    select dv.attributes->>'scan' as scan
    from document_versions dv
    where dv.tenant_id = doc.tenant_id and dv.document_id = doc.id
    order by dv.created_at desc limit 1
  ) latest on true
  where doc.tenant_id = $1 and doc.employee_id = $2::uuid
    and (coalesce(latest.scan, 'pending_scan') = 'pending_scan'
      or (expiry.expires_on is not null
        and expiry.expires_on <= to_char(current_date + interval '60 days', 'YYYY-MM-DD')))
  order by doc.updated_at desc limit 100`;

const LEAVE_ACTIONS_SELECT = `select req.id,
    'Leave request awaiting decision' as action,
    req.starts_on::text || ' to ' || req.ends_on::text as context,
    req.updated_at::text as updated_at
  from leave_requests req
  where req.tenant_id = $1 and req.employee_id = $2::uuid
    and (lower(req.status) like 'pending%' or lower(req.status) in ('submitted', 'requested'))
  order by req.created_at desc limit 100`;

type RawAction = {
  id: string;
  action: string;
  context: string;
  source: HomeActionSource;
  updated_at: string | null;
  due_on: string | null;
  completed: boolean;
  blocked: boolean;
  href: string;
};

async function safely<T>(operation: () => Promise<T[]>): Promise<T[]> {
  try {
    return await operation();
  } catch {
    return [];
  }
}

export async function listEmployeeHomeActions(access: Access): Promise<{
  employee: HomeActionEmployee | null;
  rows: HomeActionRow[];
  auditTrail: Array<Record<string, unknown>>;
}> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [employeeRows] = await tenantTx(access, [
    sqlClient.query(HOME_EMPLOYEE_SELECT, [access.tenantId, access.context.actorUserId]),
  ]);
  const found = (employeeRows as Array<{
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    department: string | null;
    location: string | null;
  }>)[0];
  if (!found) return { employee: null, rows: [], auditTrail: [] };
  const employee: HomeActionEmployee = {
    id: found.id,
    employeeCode: found.employee_code,
    firstName: found.first_name,
    lastName: found.last_name,
    department: found.department,
    location: found.location,
  };
  const params = [access.tenantId, employee.id];
  const raw: RawAction[] = [];

  const onboarding = await safely(async () => {
    const [rows] = await tenantTx(access, [sqlClient.query(ONBOARDING_ACTIONS_SELECT, params)]);
    return rows as Array<{ id: string; action: string; context: string; completed: boolean; updated_at: string | null }>;
  });
  for (const row of onboarding) {
    raw.push({
      id: row.id,
      action: row.action,
      context: row.context,
      source: "onboarding",
      updated_at: row.updated_at,
      due_on: null,
      completed: row.completed === true,
      blocked: false,
      href: "/joining-chain-console",
    });
  }

  const clearance = await safely(async () => {
    const [rows] = await tenantTx(access, [sqlClient.query(CLEARANCE_ACTIONS_SELECT, params)]);
    return rows as Array<{ id: string; action: string; context: string; completed: boolean; blocking: boolean; updated_at: string | null }>;
  });
  for (const row of clearance) {
    const completed = row.completed === true;
    raw.push({
      id: row.id,
      action: row.action,
      context: row.context,
      source: "clearance",
      updated_at: row.updated_at,
      due_on: null,
      completed,
      blocked: row.blocking === true && !completed,
      href: "/clearance-board",
    });
  }

  const policies = await safely(() => listUnacknowledgedPoliciesForEmployee(access, employee.id));
  for (const row of policies) {
    raw.push({
      id: row.id,
      action: `Acknowledge ${row.title}`,
      context: row.code,
      source: "policy",
      updated_at: row.updated_at,
      due_on: row.due_on,
      completed: false,
      blocked: false,
      href: "/policy-acknowledgements",
    });
  }

  const docs = await safely(async () => {
    const [rows] = await tenantTx(access, [sqlClient.query(DOCUMENT_ACTIONS_SELECT, params)]);
    return rows as Array<{ id: string; action: string; context: string; due_on: string | null; updated_at: string | null }>;
  });
  for (const row of docs) {
    raw.push({
      id: row.id,
      action: row.action,
      context: row.context,
      source: "document",
      updated_at: row.updated_at,
      due_on: row.due_on,
      completed: false,
      blocked: false,
      href: "/document-vault",
    });
  }

  const leave = await safely(async () => {
    const [rows] = await tenantTx(access, [sqlClient.query(LEAVE_ACTIONS_SELECT, params)]);
    return rows as Array<{ id: string; action: string; context: string; updated_at: string | null }>;
  });
  for (const row of leave) {
    raw.push({
      id: row.id,
      action: row.action,
      context: row.context,
      source: "leave",
      updated_at: row.updated_at,
      due_on: null,
      completed: false,
      blocked: false,
      href: "/leave-requests",
    });
  }

  const rows = sortHomeActions(
    raw.map((entry) => ({
      id: entry.id,
      action: entry.action,
      context: entry.context,
      source: entry.source,
      updated_at: entry.updated_at,
      due_on: entry.due_on,
      status: deriveHomeActionState({ completed: entry.completed, blocked: entry.blocked, dueOn: entry.due_on }),
      href: entry.href,
    })),
  ).slice(0, 100);

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'employee' and entity_id = ${employee.id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { employee, rows, auditTrail };
}
