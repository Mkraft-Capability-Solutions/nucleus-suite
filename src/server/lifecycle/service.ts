import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { getBalances } from "@/server/leave/service";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

const DAY1_TASKS = [
  { key: "documents", title: "Joining documents and Form F", required: true, owner: "hr" },
  { key: "induction", title: "Induction program attendance", required: true, owner: "hr" },
  { key: "assets", title: "Laptop and PPE issuance", required: true, owner: "it" },
  { key: "buddy", title: "Buddy assignment and introduction", required: true, owner: "manager" },
  { key: "payroll", title: "Payroll enrollment verification", required: true, owner: "payroll" },
  { key: "tour", title: "Plant safety tour", required: false, owner: "manager" },
] as const;

const CLEARANCE_OWNERS = ["it", "payroll", "facilities"] as const;

async function ensureLegalEntity(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const id = (rows as Array<{ id: string }>)[0]?.id;
  if (!id) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No legal entity exists for this tenant yet." });
  return id;
}

async function ensureWorkerCategory(access: Access, code = "regular"): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from worker_categories where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into worker_categories (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code })}::jsonb)`,
  ]);
  return id;
}

export async function ensureEmployment(access: Access, employeeId: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from employments where tenant_id = ${access.tenantId} and employee_id = ${employeeId} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const legalEntityId = await ensureLegalEntity(access);
  const categoryId = await ensureWorkerCategory(access);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into employments (id, tenant_id, employee_id, legal_entity_id, worker_category_id, attributes)
      values (${id}, ${access.tenantId}, ${employeeId}, ${legalEntityId}, ${categoryId}, '{"status":"active"}'::jsonb)
    `,
  ]);
  return id;
}

async function ensureTemplate(access: Access, code = "DAY1-STD"): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from onboarding_templates where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into onboarding_templates (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code, name: "Standard Day-1 onboarding", tasks: DAY1_TASKS })}::jsonb)
    `,
  ]);
  return id;
}

export const startOnboardingSchema = z.object({
  employeeId: z.string().uuid(),
  templateCode: z.string().trim().min(1).max(40).default("DAY1-STD"),
});

export async function startOnboarding(access: Access, input: z.infer<typeof startOnboardingSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const employmentId = await ensureEmployment(access, input.employeeId);
  const templateId = await ensureTemplate(access, input.templateCode);
  const [dupRows] = await tenantTx(access, [
    sqlClient`select id from onboarding_instances where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and onboarding_template_id = ${templateId} limit 1`,
  ]);
  if ((dupRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Onboarding already started for this employee and template." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into onboarding_instances (id, tenant_id, employee_id, employment_id, onboarding_template_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${employmentId}, ${templateId}, '{"status":"active"}'::jsonb)
    `,
    ...DAY1_TASKS.map((task) => sqlClient`
      insert into onboarding_tasks (tenant_id, onboarding_instance_id, attributes)
      values (${access.tenantId}, ${id}, ${JSON.stringify({ key: task.key, title: task.title, required: task.required, owner: task.owner, status: "pending" })}::jsonb)
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.onboard_start', 'onboarding_instance', ${id}, 'Onboarding started', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, tasks: DAY1_TASKS.length, status: "active" };
}

export type OnboardingInstanceView = {
  id: string;
  employee_id: string;
  status: string;
  created_at: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
  joining_date: string;
  template_name: string;
  tasks: Array<{ id: string; key: string; title: string; owner: string; required: boolean; status: string }>;
  total: number;
  done: number;
};

/** Tenant-scoped onboarding worklist with joiner details and actionable tasks. */
export async function listOnboardingInstances(access: Access): Promise<OnboardingInstanceView[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select instance.id, instance.employee_id,
             coalesce(instance.attributes->>'status', 'active') as status,
             instance.created_at::text as created_at,
             employee.employee_code, employee.first_name, employee.last_name,
             employee.department, employee.designation, employee.joining_date::text as joining_date,
             coalesce(template.attributes->>'name', template.attributes->>'code', 'Onboarding') as template_name,
             coalesce(task_rollup.tasks, '[]'::jsonb) as tasks,
             coalesce(task_rollup.total, 0)::int as total,
             coalesce(task_rollup.done, 0)::int as done
      from onboarding_instances instance
      join employees employee
        on employee.tenant_id = instance.tenant_id and employee.id = instance.employee_id
      join onboarding_templates template
        on template.tenant_id = instance.tenant_id and template.id = instance.onboarding_template_id
      left join lateral (
        select jsonb_agg(jsonb_build_object(
                 'id', task.id,
                 'key', task.attributes->>'key',
                 'title', task.attributes->>'title',
                 'owner', task.attributes->>'owner',
                 'required', coalesce((task.attributes->>'required')::boolean, false),
                 'status', coalesce(task.attributes->>'status', 'pending')
               ) order by task.created_at) as tasks,
               count(*)::int as total,
               count(*) filter (where task.attributes->>'status' = 'done')::int as done
        from onboarding_tasks task
        where task.tenant_id = instance.tenant_id and task.onboarding_instance_id = instance.id
      ) task_rollup on true
      where instance.tenant_id = ${access.tenantId}
      order by instance.created_at desc
      limit 100
    `,
  ]);
  return rows as OnboardingInstanceView[];
}

export async function completeOnboardingTask(access: Access, taskId: string, note: string | undefined, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, onboarding_instance_id, attributes from onboarding_tasks where tenant_id = ${access.tenantId} and id = ${taskId} limit 1`,
  ]);
  const task = (rows as Array<{ id: string; onboarding_instance_id: string; attributes: { status: string } }>)[0];
  if (!task) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (task.attributes.status !== "pending") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The task is already completed." });
  }
  await tenantTx(access, [
    sqlClient`
      update onboarding_tasks set attributes = attributes || ${JSON.stringify({ status: "done", note: note ?? null, completed_by: access.context.actorUserId })}::jsonb
      where id = ${taskId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.task_done', 'onboarding_task', ${taskId}, 'Onboarding task completed', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: taskId, status: "done", instanceId: task.onboarding_instance_id };
}

export async function onboardingReadiness(access: Access, instanceId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from onboarding_tasks where tenant_id = ${access.tenantId} and onboarding_instance_id = ${instanceId}`,
  ]);
  const tasks = rows as Array<{ id: string; attributes: { key: string; title: string; required: boolean; status: string } }>;
  if (tasks.length === 0) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const pendingRequired = tasks.filter((task) => task.attributes.required && task.attributes.status !== "done");
  return {
    instanceId,
    total: tasks.length,
    done: tasks.filter((task) => task.attributes.status === "done").length,
    day1Ready: pendingRequired.length === 0,
    pendingRequired: pendingRequired.map((task) => task.attributes.key),
  };
}

export const startOffboardingSchema = z.object({
  employeeId: z.string().uuid(),
  reason: z.string().trim().min(1).max(300),
  lastWorkingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function startOffboarding(access: Access, input: z.infer<typeof startOffboardingSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const employmentId = await ensureEmployment(access, input.employeeId);
  const eventId = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into lifecycle_events (id, tenant_id, employee_id, attributes)
      values (${eventId}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({ kind: "exit_notice", reason: input.reason, last_working_date: input.lastWorkingDate })}::jsonb)
    `,
    sqlClient`
      insert into offboarding_cases (id, tenant_id, employment_id, lifecycle_event_id, attributes)
      values (${caseId}, ${access.tenantId}, ${employmentId}, ${eventId}, '{"status":"clearance_active"}'::jsonb)
    `,
    ...CLEARANCE_OWNERS.map((owner) => sqlClient`
      insert into clearance_items (tenant_id, offboarding_case_id, attributes)
      values (${access.tenantId}, ${caseId}, ${JSON.stringify({ owner, status: "pending" })}::jsonb)
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.exit_notice', 'offboarding_case', ${caseId}, 'Exit initiated', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { caseId, status: "clearance_active", clearance: [...CLEARANCE_OWNERS] };
}

export async function clearClearanceItem(access: Access, itemId: string, note: string | undefined, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, offboarding_case_id, attributes from clearance_items where tenant_id = ${access.tenantId} and id = ${itemId} limit 1`,
  ]);
  const item = (rows as Array<{ id: string; offboarding_case_id: string; attributes: { status: string } }>)[0];
  if (!item) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (item.attributes.status !== "pending") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The clearance item is already cleared." });
  }
  await tenantTx(access, [
    sqlClient`
      update clearance_items set attributes = attributes || ${JSON.stringify({ status: "cleared", note: note ?? null, cleared_by: access.context.actorUserId })}::jsonb
      where id = ${itemId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.clearance', 'clearance_item', ${itemId}, 'No-dues cleared', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: itemId, status: "cleared", caseId: item.offboarding_case_id };
}

export async function settleFullAndFinal(access: Access, caseId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const [caseRows] = await tenantTx(access, [
    sqlClient`select id, employment_id, attributes from offboarding_cases where tenant_id = ${access.tenantId} and id = ${caseId} limit 1`,
  ]);
  const offshore = (caseRows as Array<{ id: string; employment_id: string; attributes: { status: string } }>)[0];
  if (!offshore) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [itemRows] = await tenantTx(access, [
    sqlClient`select attributes from clearance_items where tenant_id = ${access.tenantId} and offboarding_case_id = ${caseId}`,
  ]);
  const pending = (itemRows as Array<{ attributes: { status: string; owner: string } }>).filter((item) => item.attributes.status !== "cleared");
  if (pending.length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `No-dues pending from: ${pending.map((item) => item.attributes.owner).join(", ")}.` });
  }
  const [employmentRows] = await tenantTx(access, [
    sqlClient`
      select e.employee_id, emp.basic_salary_minor, emp.joining_date::text as joining_date
      from employments e join employees emp on emp.id = e.employee_id
      where e.tenant_id = ${access.tenantId} and e.id = ${offshore.employment_id} limit 1
    `,
  ]);
  const employment = (employmentRows as Array<{ employee_id: string; basic_salary_minor: number | string | null; joining_date: string }>)[0];
  if (!employment) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Employment record is missing." });
  const basic = Number(employment.basic_salary_minor ?? 0);
  if (basic <= 0) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Settlement needs a positive basic salary." });
  const dailyMinor = Math.round(basic / 30);
  const balances = await getBalances(access, employment.employee_id);
  const elEncashMinor = Math.round((balances.balances.EL > 0 ? balances.balances.EL : 0) * dailyMinor);
  // Salary payable: pro-rata from month start to today (demo simplification, auditable).
  const today = new Date();
  const dayOfMonth = today.getUTCDate();
  const salaryPayableMinor = dailyMinor * Math.min(dayOfMonth, 30);
  const [loanRows] = await tenantTx(access, [
    sqlClient`
      select coalesce(sum((attributes->>'outstanding_minor')::bigint), 0)::bigint as outstanding
      from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${employment.employee_id}
        and attributes->>'status' = 'disbursed'
    `,
  ]);
  const loanOutstanding = Number((loanRows as Array<{ outstanding: number | string }>)[0]?.outstanding ?? 0);
  const netMinor = salaryPayableMinor + elEncashMinor - loanOutstanding;
  const settlementId = crypto.randomUUID();
  const lines = [
    { code: "salary_payable", amount_minor: salaryPayableMinor },
    { code: "el_encashment", amount_minor: elEncashMinor },
    { code: "loan_recovery", amount_minor: -loanOutstanding },
    { code: "net_payable", amount_minor: netMinor },
  ];
  await tenantTx(access, [
    sqlClient`
      insert into full_final_settlements (id, tenant_id, employment_id, offboarding_case_id, attributes)
      values (${settlementId}, ${access.tenantId}, ${offshore.employment_id}, ${caseId},
        ${JSON.stringify({ status: "ready", lines, rule: "in-pay/v1" })}::jsonb)
    `,
    sqlClient`update offboarding_cases set attributes = attributes || '{"status":"settled"}'::jsonb where id = ${caseId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.settle', 'full_final_settlement', ${settlementId}, 'Same-day F&F computed',
        ${JSON.stringify({ net_minor: netMinor })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { settlementId, caseId, status: "settled", lines };
}
