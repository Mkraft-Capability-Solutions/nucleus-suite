import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

// Standard induction task templates for new joiners
const DEFAULT_INDUCTION_TASKS = [
  { task_name: "Joining documents and Form F", category: "policy", assigned_to: "HR", due_date_days: 0 },
  { task_name: "Biometric enrollment", category: "it_setup", assigned_to: "IT", due_date_days: 1 },
  { task_name: "ID card issuance", category: "id_card", assigned_to: "HR", due_date_days: 1 },
  { task_name: "Laptop/equipment issuance", category: "it_setup", assigned_to: "IT", due_date_days: 1 },
  { task_name: "PPE and uniform issuance", category: "uniform", assigned_to: "HR", due_date_days: 2 },
  { task_name: "Bank account details submission", category: "bank_details", assigned_to: "HR", due_date_days: 3 },
  { task_name: "Plant/office safety tour", category: "safety", assigned_to: "Manager", due_date_days: 3 },
  { task_name: "Buddy assignment", category: "buddy_assign", assigned_to: "Manager", due_date_days: 1 },
  { task_name: "HR policy acknowledgment", category: "policy", assigned_to: "HR", due_date_days: 5 },
  { task_name: "Welcome kit delivery", category: "welcome_kit", assigned_to: "HR", due_date_days: 0 },
  { task_name: "Department introduction", category: "department_intro", assigned_to: "Manager", due_date_days: 2 },
];

export async function createDefaultInductionTasks(access: Access, employeeId: string, joiningDate: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const joiningMs = new Date(joiningDate).getTime();
  const insertQueries = DEFAULT_INDUCTION_TASKS.map((task) => {
    const dueDate = new Date(joiningMs + task.due_date_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    return sqlClient`
      insert into induction_tasks (id, tenant_id, employee_id, task_name, category, assigned_to, due_date, status)
      values (${id}, ${access.tenantId}, ${employeeId}, ${task.task_name}, ${task.category}, ${task.assigned_to}, ${dueDate}, 'pending')
    `;
  });

  await tenantTx(access, [
    ...insertQueries,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.induction_init', 'employee', ${employeeId},
        'Induction tasks created for new joiner',
        ${JSON.stringify({ taskCount: DEFAULT_INDUCTION_TASKS.length, joiningDate })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { employeeId, taskCount: DEFAULT_INDUCTION_TASKS.length };
}

export const createInductionTaskSchema = z.object({
  employeeId: z.string().uuid(),
  taskName: z.string().trim().min(1).max(200),
  category: z.enum(["safety", "it_setup", "id_card", "uniform", "policy", "bank_details", "asset_allocation", "buddy_assign", "department_intro", "welcome_kit"]),
  assignedTo: z.string().trim().max(80).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function createInductionTask(access: Access, input: z.infer<typeof createInductionTaskSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const [empRows] = await tenantTx(access, [
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${input.employeeId} limit 1`,
  ]);
  if ((empRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Employee not found." });
  }

  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into induction_tasks (id, tenant_id, employee_id, task_name, category, assigned_to, due_date, status, notes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.taskName}, ${input.category},
        ${input.assignedTo ?? null}, ${input.dueDate ?? null}, 'pending', ${input.notes ?? null})
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.induction_task_add', 'induction_task', ${id},
        'Induction task added',
        ${JSON.stringify({ taskName: input.taskName, category: input.category })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, status: "pending", taskName: input.taskName, category: input.category };
}

export async function listInductionTasks(access: Access, args: { employeeId?: string | null; status?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from induction_tasks
      where tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.status ?? null}::text is null or status = ${args.status ?? null}::text)
    `,
    sqlClient`
      select t.id, t.employee_id, t.task_name, t.category, t.assigned_to, t.due_date::text,
             t.status, t.completed_at, t.notes, t.created_at,
             e.first_name, e.last_name, e.employee_code
      from induction_tasks t
      join employees e on e.id = t.employee_id and e.tenant_id = t.tenant_id
      where t.tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or t.employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.status ?? null}::text is null or t.status = ${args.status ?? null}::text)
      order by t.due_date asc nulls last, t.created_at asc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const total = ((countRows as Array<{ total: number }>)[0]?.total ?? 0);
  return { items: rows, total };
}

export const completeInductionTaskSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export async function completeInductionTask(access: Access, id: string, input: z.infer<typeof completeInductionTaskSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const [rows] = await tenantTx(access, [
    sqlClient`select id, status, task_name, employee_id from induction_tasks where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const task = (rows as Array<{ id: string; status: string; task_name: string; employee_id: string }>)[0];
  if (!task) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Induction task not found." });
  if (task.status === "completed") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Task is already completed." });
  }

  await tenantTx(access, [
    sqlClient`
      update induction_tasks
      set status = 'completed', completed_at = now(), completed_by_membership_id = ${access.context.membershipId},
          notes = ${input.notes ?? null}, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.induction_task_complete', 'induction_task', ${id},
        'Induction task completed',
        ${JSON.stringify({ taskName: task.task_name })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, status: "completed" };
}
