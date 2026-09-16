import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * The seed for the standard Day-1 template. It is not the checklist a tenant runs: the
 * chain is instantiated from the `onboarding_templates` row the caller named, which HR
 * maintains through /api/v1/onboarding/templates. This list is only what a tenant that has
 * defined nothing starts from.
 *
 * `blocksConfirmation` marks the items R-24 puts in front of confirmation - induction and
 * asset issue - as distinct from `required`, which is the Day-1 readiness gate.
 */
const DAY1_TASKS: readonly ChainTaskSeed[] = [
  { key: "documents", title: "Joining documents and Form F", required: true, owner: "hr" },
  { key: "induction", title: "Induction program attendance", required: true, owner: "hr", blocksConfirmation: true },
  { key: "assets", title: "Laptop and PPE issuance", required: true, owner: "it", blocksConfirmation: true },
  { key: "buddy", title: "Buddy assignment and introduction", required: true, owner: "manager" },
  { key: "payroll", title: "Payroll enrollment verification", required: true, owner: "payroll" },
  { key: "tour", title: "Plant safety tour", required: false, owner: "manager" },
];

type ChainTaskSeed = { key: string; title: string; required: boolean; owner: string; offsetDays?: number; blocksConfirmation?: boolean };

const CLEARANCE_OWNERS = ["it", "payroll", "facilities"] as const;

/**
 * The workbook takes the item name and its blocking flag from a clearance template by
 * worker class and location. Nucleus has no such template, so the owner list above stands
 * in for one and supplies the name the board shows. Which items block full and final is a
 * policy the workbook does not state, and is not guessed here - see
 * tmp/_audit/requests/people-lifecycle.md.
 */
const CLEARANCE_ITEM_NAMES: Record<(typeof CLEARANCE_OWNERS)[number], string> = {
  it: "IT assets and systems access",
  payroll: "Payroll dues and recoveries",
  facilities: "Facilities, access card and locker",
};

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

/**
 * Pre-boarding and joining chain (FRM-LCY-01).
 *
 * The candidate and offer references are optional because Nucleus can also hire directly:
 * the workbook assumes every joiner arrives from an accepted offer, and nothing in this
 * app creates the person record from one yet (see tmp/_audit/requests/people-lifecycle.md).
 * When the actual joining date differs from the date held on the employee record, the
 * workbook requires a reason - a deviation is a decision, not a correction.
 */
export const JOINING_DEVIATION_REASON_MIN_LENGTH = 10;

export type ChainTask = ChainTaskSeed;

/**
 * The chain is instantiated from the template the caller named, not from the built-in
 * list: a tenant that has defined its own Day-1 template expects to get that one.
 * DAY1_TASKS is the fallback the standard template is seeded from.
 */
async function templateTasks(access: Access, templateId: string): Promise<ChainTask[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes->'tasks' as tasks from onboarding_templates where tenant_id = ${access.tenantId} and id = ${templateId} limit 1`,
  ]);
  const declared = (rows as Array<{ tasks: ChainTask[] | null }>)[0]?.tasks;
  return Array.isArray(declared) && declared.length > 0 ? declared : [...DAY1_TASKS];
}

/**
 * The items that hold up confirmation. A template that marks none falls back to its blocking
 * Day-1 items, so the gate is real for a tenant whose template predates the setting rather
 * than silently letting every confirmation through.
 */
export function confirmationBlockers<T extends { required: boolean; blocksConfirmation?: boolean }>(tasks: readonly T[]): T[] {
  const declared = tasks.filter((task) => task.blocksConfirmation === true);
  return declared.length > 0 ? declared : tasks.filter((task) => task.required);
}

/**
 * The workbook derives an item's due date as the joining date plus the template's offset.
 * A template that states no offset gets no due date - the offset is not guessed.
 */
function dueDate(joiningDate: string | null, offsetDays: number | undefined): string | null {
  if (!joiningDate || offsetDays === undefined) return null;
  const due = new Date(`${joiningDate}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + offsetDays);
  return due.toISOString().slice(0, 10);
}

export const startOnboardingSchema = z.object({
  employeeId: z.string().uuid(),
  templateCode: z.string().trim().min(1).max(40).default("DAY1-STD"),
  candidateId: z.string().uuid().optional(),
  offerId: z.string().uuid().optional(),
  actualJoiningDate: z.iso.date().optional(),
  joiningDeviationReason: z.string().trim().min(JOINING_DEVIATION_REASON_MIN_LENGTH).max(200).optional(),
});

export async function startOnboarding(access: Access, input: z.infer<typeof startOnboardingSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const employmentId = await ensureEmployment(access, input.employeeId);
  const templateId = await ensureTemplate(access, input.templateCode);
  const [joiningRows] = await tenantTx(access, [
    sqlClient`select joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and id = ${input.employeeId} limit 1`,
  ]);
  const proposedJoining = (joiningRows as Array<{ joining_date: string | null }>)[0]?.joining_date ?? null;
  const actualJoining = input.actualJoiningDate ?? proposedJoining;
  if (proposedJoining && actualJoining !== proposedJoining && !input.joiningDeviationReason) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: `Joining on ${actualJoining} instead of ${proposedJoining} needs a reason of at least ${JOINING_DEVIATION_REASON_MIN_LENGTH} characters.`,
    });
  }
  const tasks = await templateTasks(access, templateId);
  const [dupRows] = await tenantTx(access, [
    sqlClient`select id from onboarding_instances where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and onboarding_template_id = ${templateId} limit 1`,
  ]);
  if ((dupRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Onboarding already started for this employee and template." });
  }
  const id = crypto.randomUUID();
  const instanceAttributes = {
    status: "active",
    candidate_id: input.candidateId ?? null,
    offer_id: input.offerId ?? null,
    actual_joining_date: actualJoining,
    proposed_joining_date: proposedJoining,
    joining_deviation_reason: input.joiningDeviationReason ?? null,
  };
  await tenantTx(access, [
    sqlClient`
      insert into onboarding_instances (id, tenant_id, employee_id, employment_id, onboarding_template_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${employmentId}, ${templateId}, ${JSON.stringify(instanceAttributes)}::jsonb)
    `,
    ...tasks.map((task) => sqlClient`
      insert into onboarding_tasks (tenant_id, onboarding_instance_id, attributes)
      values (${access.tenantId}, ${id}, ${JSON.stringify({
        key: task.key,
        title: task.title,
        required: task.required,
        blocks_confirmation: task.blocksConfirmation ?? null,
        owner: task.owner,
        status: "pending",
        due_date: dueDate(actualJoining, task.offsetDays),
      })}::jsonb)
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.onboard_start', 'onboarding_instance', ${id}, 'Onboarding started', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, tasks: tasks.length, status: "active" };
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
  tasks: Array<{ id: string; key: string; title: string; owner: string; required: boolean; status: string; due_date: string | null; completed_on: string | null; waiver_reason: string | null }>;
  total: number;
  done: number;
  actual_joining_date: string | null;
  joining_deviation_reason: string | null;
  candidate_id: string | null;
  offer_id: string | null;
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
             coalesce(task_rollup.done, 0)::int as done,
             coalesce(instance.attributes->>'actual_joining_date', employee.joining_date::text) as actual_joining_date,
             instance.attributes->>'joining_deviation_reason' as joining_deviation_reason,
             instance.attributes->>'candidate_id' as candidate_id,
             instance.attributes->>'offer_id' as offer_id
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
                 'status', coalesce(task.attributes->>'status', 'pending'),
                 'due_date', task.attributes->>'due_date',
                 'completed_on', task.attributes->>'completed_on',
                 'waiver_reason', task.attributes->>'waiver_reason'
               ) order by task.created_at) as tasks,
               count(*)::int as total,
               count(*) filter (where task.attributes->>'status' in ('done', 'waived'))::int as done
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

/**
 * A chain item's outcome (FRM-LCY-01 `item_status`). The workbook's PL_TASK_STATUS also
 * lists Overdue, which is derived from the due date rather than chosen - see
 * `isOverdue` - so it is not an outcome an owner can record.
 *
 * Waiving a blocking item releases shop-floor access and payroll without the step being
 * done, so the workbook holds the waiver reason to twenty characters.
 */
export const TASK_WAIVER_REASON_MIN_LENGTH = 20;
const RECORDABLE_TASK_STATUSES = picklistValues("PL_TASK_STATUS").filter((value) => value !== "overdue");

export const completeOnboardingTaskSchema = z.object({
  status: z.enum(RECORDABLE_TASK_STATUSES as [string, ...string[]]).default("done"),
  note: z.string().trim().max(500).optional(),
}).refine(
  (input) => input.status !== "waived" || (input.note ?? "").length >= TASK_WAIVER_REASON_MIN_LENGTH,
  { path: ["note"], message: `Waiving a joining-chain item needs a reason of at least ${TASK_WAIVER_REASON_MIN_LENGTH} characters.` },
);

/** True when an item that is still outstanding has passed its due date. */
export function isOverdue(status: string, due: string | null, today = new Date().toISOString().slice(0, 10)): boolean {
  if (status === "done" || status === "waived") return false;
  return due !== null && due < today;
}

export async function completeOnboardingTask(
  access: Access,
  taskId: string,
  input: z.infer<typeof completeOnboardingTaskSchema>,
  requestId: string,
) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, onboarding_instance_id, attributes from onboarding_tasks where tenant_id = ${access.tenantId} and id = ${taskId} limit 1`,
  ]);
  const task = (rows as Array<{ id: string; onboarding_instance_id: string; attributes: { status: string } }>)[0];
  if (!task) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // "open" is the stored "pending"; in progress is a step on the way, not a settled outcome.
  if (!["pending", "open", "in_progress"].includes(task.attributes.status)) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The task is already completed." });
  }
  const settled = input.status === "done" || input.status === "waived";
  await tenantTx(access, [
    sqlClient`
      update onboarding_tasks set attributes = attributes || ${JSON.stringify({
        status: input.status,
        note: input.note ?? null,
        completed_by: settled ? access.context.actorUserId : null,
        completed_on: settled ? new Date().toISOString().slice(0, 10) : null,
        waiver_reason: input.status === "waived" ? input.note : null,
      })}::jsonb
      where id = ${taskId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.task_done', 'onboarding_task', ${taskId}, ${input.note ?? "Onboarding task completed"}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: taskId, status: input.status, instanceId: task.onboarding_instance_id };
}

type ChainTaskRow = {
  key: string;
  title: string;
  required: boolean;
  blocks_confirmation?: boolean | null;
  status: string;
};

/** Done and waived are both settled; the workbook's waiver exists so the chain can close. */
const SETTLED_TASK_STATUSES = ["done", "waived"];

function readinessOf(tasks: readonly ChainTaskRow[]) {
  const pendingRequired = tasks.filter((task) => task.required && !SETTLED_TASK_STATUSES.includes(task.status));
  const blockers = confirmationBlockers(tasks.map((task) => ({ ...task, blocksConfirmation: task.blocks_confirmation ?? undefined })));
  const pendingConfirmation = blockers.filter((task) => !SETTLED_TASK_STATUSES.includes(task.status));
  return {
    total: tasks.length,
    done: tasks.filter((task) => SETTLED_TASK_STATUSES.includes(task.status)).length,
    day1Ready: pendingRequired.length === 0,
    pendingRequired: pendingRequired.map((task) => task.key),
    /** R-24: confirmation is refused while any of these is still outstanding. */
    confirmationReady: pendingConfirmation.length === 0,
    pendingConfirmation: pendingConfirmation.map((task) => ({ key: task.key, title: task.title })),
  };
}

async function chainTasksFor(access: Access, instanceId: string): Promise<ChainTaskRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes from onboarding_tasks where tenant_id = ${access.tenantId} and onboarding_instance_id = ${instanceId}`,
  ]);
  return (rows as Array<{ attributes: ChainTaskRow }>).map((row) => row.attributes);
}

export async function onboardingReadiness(access: Access, instanceId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const tasks = await chainTasksFor(access, instanceId);
  if (tasks.length === 0) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return { instanceId, ...readinessOf(tasks) };
}

/**
 * Confirmation (R-24) is a transition on the employment record, not a date somebody types
 * into the dossier: it moves the employment from probation to confirmed, and it is refused
 * while any item the joining-chain template marks as blocking confirmation - the induction
 * and asset-issue items on the standard template - is still outstanding.
 */
export const CONFIRMATION_REASON_MIN_LENGTH = 10;

export const confirmEmploymentSchema = z.object({
  employeeId: z.string().uuid(),
  confirmationDate: z.iso.date(),
  reason: z.string().trim().min(CONFIRMATION_REASON_MIN_LENGTH).max(500),
});

export async function confirmEmployment(
  access: Access,
  input: z.infer<typeof confirmEmploymentSchema>,
  requestId: string,
) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [employmentRows] = await tenantTx(access, [
    sqlClient`
      select em.id, em.attributes, e.joining_date::text as joining_date
      from employments em
      join employees e on e.tenant_id = em.tenant_id and e.id = em.employee_id
      where em.tenant_id = ${access.tenantId} and em.employee_id = ${input.employeeId}
      order by em.created_at desc limit 1
    `,
  ]);
  const employment = (employmentRows as Array<{ id: string; attributes: Record<string, unknown>; joining_date: string | null }>)[0];
  if (!employment) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This employee has no employment record to confirm." });
  }
  if (employment.attributes.confirmationDate || employment.attributes.status === "confirmed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This employment is already confirmed." });
  }
  if (employment.joining_date && input.confirmationDate < employment.joining_date) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: `Confirmation cannot precede the joining date (${employment.joining_date}).` });
  }
  const [instanceRows] = await tenantTx(access, [
    sqlClient`select id from onboarding_instances where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} order by created_at desc limit 1`,
  ]);
  const instanceId = (instanceRows as Array<{ id: string }>)[0]?.id;
  if (!instanceId) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: "No joining chain exists for this employee, so the induction items confirmation depends on cannot be evidenced. Start onboarding first.",
    });
  }
  const readiness = readinessOf(await chainTasksFor(access, instanceId));
  if (!readiness.confirmationReady) {
    throw new HttpError({
      status: 422,
      code: "INDUCTION_INCOMPLETE",
      message: `Confirmation is blocked: ${readiness.pendingConfirmation.map((task) => task.title).join(", ")} still outstanding.`,
      details: readiness.pendingConfirmation.map((task) => ({ field: task.key, issue: `${task.title} is not complete or waived.` })),
    });
  }
  const eventId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      update employments set attributes = attributes || ${JSON.stringify({
        status: "confirmed",
        confirmationDate: input.confirmationDate,
        confirmedByMembershipId: access.context.membershipId,
      })}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${employment.id}
    `,
    sqlClient`
      insert into lifecycle_events (id, tenant_id, employee_id, attributes)
      values (${eventId}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({ kind: "confirmation", confirmation_date: input.confirmationDate, reason: input.reason })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.confirm', 'employment', ${employment.id}, ${input.reason},
        ${JSON.stringify({ confirmationDate: input.confirmationDate })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { employmentId: employment.id, employeeId: input.employeeId, status: "confirmed", confirmationDate: input.confirmationDate };
}

/**
 * Resignation and exit (FRM-LCY-03).
 *
 * `reason` is the workbook's exit_reason_detail and `lastWorkingDate` its approved_lwd -
 * the same fields under the names this app already uses. A notice waiver and an
 * ineligible-for-rehire decision are both things someone has to justify, so both carry
 * the workbook's twenty-character minimum.
 *
 * Clearance is instantiated only once the manager and HR have both accepted: the
 * workbook gates it on exactly that, and an unaccepted resignation must not start
 * pulling assets and access back.
 */
export const EXIT_REASON_DETAIL_MIN_LENGTH = 20;
export const EXIT_WAIVER_REASON_MIN_LENGTH = 20;
/** The workbook allows a post-dated resignation, but no further ahead than a week. */
export const MAX_RESIGNATION_LEAD_DAYS = 7;

export const startOffboardingSchema = z.object({
  employeeId: z.string().uuid(),
  exitType: z.enum(picklistValues("PL_EXIT_TYPE")).default("resignation"),
  resignationDate: z.iso.date().optional(),
  exitReasonCategory: z.enum(picklistValues("PL_EXIT_REASON")),
  reason: z.string().trim().min(EXIT_REASON_DETAIL_MIN_LENGTH).max(500),
  requestedLastWorkingDay: z.iso.date().optional(),
  lastWorkingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  noticeWaivedDays: z.number().int().min(0).max(180).default(0),
  noticeWaiverReason: z.string().trim().min(EXIT_WAIVER_REASON_MIN_LENGTH).max(300).optional(),
  isGardenLeave: z.boolean().default(false),
  rehireEligible: z.enum(picklistValues("PL_REHIRE_ELIGIBILITY")).default("yes"),
  rehireReason: z.string().trim().min(EXIT_WAIVER_REASON_MIN_LENGTH).max(300).optional(),
  exitInterviewDate: z.iso.date().optional(),
  interviewerId: z.string().uuid().optional(),
  managerAccepted: z.boolean().default(false),
  hrAccepted: z.boolean().default(false),
}).superRefine((input, ctx) => {
  if (input.noticeWaivedDays > 0 && !input.noticeWaiverReason) {
    ctx.addIssue({ code: "custom", path: ["noticeWaiverReason"], message: "Waiving notice needs a recorded reason." });
  }
  if (input.rehireEligible !== "yes" && !input.rehireReason) {
    ctx.addIssue({ code: "custom", path: ["rehireReason"], message: "Marking someone ineligible for rehire needs a recorded reason." });
  }
  if (input.exitInterviewDate && input.exitInterviewDate > input.lastWorkingDate) {
    ctx.addIssue({ code: "custom", path: ["exitInterviewDate"], message: "The exit interview must happen on or before the last working day." });
  }
});

export async function startOffboarding(access: Access, input: z.infer<typeof startOffboardingSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const today = new Date().toISOString().slice(0, 10);
  const resignationDate = input.resignationDate ?? today;
  const latestAllowed = new Date(`${today}T00:00:00Z`);
  latestAllowed.setUTCDate(latestAllowed.getUTCDate() + MAX_RESIGNATION_LEAD_DAYS);
  if (resignationDate > latestAllowed.toISOString().slice(0, 10)) {
    throw new HttpError({
      status: 422,
      code: "INVALID_DATES",
      message: `A resignation cannot be dated more than ${MAX_RESIGNATION_LEAD_DAYS} days ahead.`,
    });
  }
  if (input.lastWorkingDate < resignationDate) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The last working day cannot precede the resignation date." });
  }
  const employmentId = await ensureEmployment(access, input.employeeId);
  const noticePeriodDays = await assignedNoticePeriodDays(access, input.employeeId);
  const accepted = input.managerAccepted && input.hrAccepted;
  const eventId = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  const caseAttributes = {
    status: accepted ? "clearance_active" : "awaiting_acceptance",
    exit_type: input.exitType,
    resigned_on: resignationDate,
    exit_reason_category: input.exitReasonCategory,
    exit_reason_detail: input.reason,
    // Snapshotted, not looked up later: the notice that applied on the day the person
    // resigned is what the shortfall on full and final is measured against.
    notice_period_days: noticePeriodDays,
    requested_last_working_day: input.requestedLastWorkingDay ?? input.lastWorkingDate,
    last_working_day: input.lastWorkingDate,
    notice_waived_days: input.noticeWaivedDays,
    notice_waiver_reason: input.noticeWaiverReason ?? null,
    garden_leave: input.isGardenLeave,
    rehire_eligible: input.rehireEligible,
    rehire_reason: input.rehireReason ?? null,
    exit_interview_date: input.exitInterviewDate ?? null,
    interviewer_id: input.interviewerId ?? null,
    manager_accepted: input.managerAccepted,
    hr_accepted: input.hrAccepted,
    // Systems access is revoked on the last working day; the workbook derives the date
    // rather than asking for it.
    access_revocation_date: input.lastWorkingDate,
  };
  await tenantTx(access, [
    sqlClient`
      insert into lifecycle_events (id, tenant_id, employee_id, attributes)
      values (${eventId}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({ kind: "exit_notice", exit_type: input.exitType, reason: input.reason, resigned_on: resignationDate, last_working_date: input.lastWorkingDate })}::jsonb)
    `,
    sqlClient`
      insert into offboarding_cases (id, tenant_id, employment_id, lifecycle_event_id, attributes)
      values (${caseId}, ${access.tenantId}, ${employmentId}, ${eventId}, ${JSON.stringify(caseAttributes)}::jsonb)
    `,
    ...(accepted ? CLEARANCE_OWNERS.map((owner) => sqlClient`
      insert into clearance_items (tenant_id, offboarding_case_id, attributes)
      values (${access.tenantId}, ${caseId}, ${JSON.stringify({ owner, item_name: CLEARANCE_ITEM_NAMES[owner], status: "pending" })}::jsonb)
    `) : []),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.exit_notice', 'offboarding_case', ${caseId}, ${input.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return {
    caseId,
    status: caseAttributes.status,
    exitType: input.exitType,
    noticePeriodDays,
    clearanceInitiated: accepted,
    accessRevocationDate: input.lastWorkingDate,
    clearance: accepted ? [...CLEARANCE_OWNERS] : [],
  };
}

/**
 * The notice that applies to a leaver comes from their live assignment (FRM-PPL-02
 * `notice_period_days`). An assignment that has not recorded one yields null rather than
 * a made-up default - the workbook states no fallback.
 */
async function assignedNoticePeriodDays(access: Access, employeeId: string): Promise<number | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select (assignment.attributes->>'noticePeriodDays')::int as notice_period_days
      from employee_assignments assignment
      join employments employment on employment.tenant_id = assignment.tenant_id and employment.id = assignment.employment_id
      where assignment.tenant_id = ${access.tenantId} and employment.employee_id = ${employeeId}
        and assignment.record_status = 'active'
      order by coalesce(assignment.attributes->>'effectiveFrom', '') desc, assignment.created_at desc
      limit 1`,
  ]);
  const value = (rows as Array<{ notice_period_days: number | null }>)[0]?.notice_period_days;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Clearing a no-dues item (FRM-LCY-04). An unreturned asset or an outstanding advance
 * becomes a recovery line on full and final, so a non-zero recovery must say what it is
 * for; a zero recovery is the normal case and needs nothing.
 */
export const RECOVERY_DESCRIPTION_MIN_LENGTH = 10;

export const clearClearanceItemSchema = z.object({
  note: z.string().trim().max(500).optional(),
  recoveryAmountMinor: z.number().int().min(0).max(1_000_000_000_000).default(0),
  recoveryDescription: z.string().trim().min(1).max(200).optional(),
}).refine(
  (input) => input.recoveryAmountMinor === 0 || (input.recoveryDescription ?? "").length >= RECOVERY_DESCRIPTION_MIN_LENGTH,
  { path: ["recoveryDescription"], message: `A recovery needs a description of at least ${RECOVERY_DESCRIPTION_MIN_LENGTH} characters.` },
);

export async function clearClearanceItem(
  access: Access,
  itemId: string,
  input: z.infer<typeof clearClearanceItemSchema>,
  requestId: string,
) {
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
      update clearance_items set attributes = attributes || ${JSON.stringify({
        status: "cleared",
        note: input.note ?? null,
        cleared_by: access.context.actorUserId,
        cleared_on: new Date().toISOString().slice(0, 10),
        recovery_amount_minor: input.recoveryAmountMinor,
        recovery_description: input.recoveryDescription ?? null,
      })}::jsonb
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
  enforce(access.context, "payroll.settlement.approve", {tenantId:access.tenantId});
  const [rows] = await tenantTx(access,[sqlClient`select id,attributes from full_final_settlements where tenant_id=${access.tenantId} and offboarding_case_id=${caseId} and attributes->>'status'='settled' order by created_at desc limit 1`]);
  const record=(rows as Array<{id:string;attributes:Record<string,unknown>}>)[0];
  if(!record) throw new HttpError({status:409,code:"APPROVED_SETTLEMENT_REQUIRED",message:"Create and approve a full-and-final proposal in Payroll & Finance, clear all no-dues items, then record the final payment. Automatic demo proration is no longer used."});
  return {settlementId:record.id,caseId,status:"settled",lines:Array.isArray(record.attributes.lines) ? record.attributes.lines as Array<{code:string;amount_minor:number}> : [],requestId};
}
