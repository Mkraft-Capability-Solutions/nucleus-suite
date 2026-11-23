import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Workflow automation studio (WorkflowBuilderModal) over the existing workflow tables:
 *   workflow_definitions (code, name, subject_type, status draft|active|retired)
 *   workflow_versions    (immutable numbered versions; `definition` holds ordering and step metadata;
 *                         `published_at` marks the version that runs)
 *   workflow_steps       (one row per step: name, sla_minutes)
 *   workflow_transitions (linear "complete" edges between consecutive steps)
 * Every save writes a NEW version guarded by If-Match on the latest version number, so concurrent editors
 * cannot overwrite each other and every change stays in history. All operations need `tenant.manage`.
 */

export const STEP_TYPES = ["trigger", "condition", "approval", "action", "integration"] as const;
export type StepType = (typeof STEP_TYPES)[number];
export const CONDITION_OPERATORS = ["in", "equals", "greater", "less"] as const;
export const SUBJECT_TYPES = ["employee", "leave_request", "attendance", "payroll_run", "expense_claim", "requisition", "offboarding", "document"] as const;
export const MAX_STEPS = 30;

const stepSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/).optional(),
  type: z.enum(STEP_TYPES),
  title: z.string().trim().min(2, "Each step needs a title of at least 2 characters.").max(120),
  description: z.string().trim().max(300).default(""),
  slaHours: z.number().int().min(1).max(720).nullable().default(null),
  operator: z.enum(CONDITION_OPERATORS).nullable().default(null),
});

export type WorkflowStepInput = z.infer<typeof stepSchema>;

export const saveStepsSchema = z.object({
  steps: z.array(stepSchema).min(1, "A workflow needs at least its trigger step.").max(MAX_STEPS),
});

export const createWorkflowSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,40}$/, "Use 2-40 capital letters, digits or hyphens."),
  name: z.string().trim().min(3, "Enter a name of at least 3 characters.").max(120),
  subjectType: z.enum(SUBJECT_TYPES, { message: "Choose what the workflow runs on." }),
  description: z.string().trim().max(500).default(""),
  triggerTitle: z.string().trim().min(2, "Describe the trigger event.").max(120),
});

export const setStatusSchema = z.object({ status: z.enum(["active", "draft", "retired"]) });

export type WorkflowStep = { id: string; key: string; type: StepType; title: string; description: string; slaHours: number | null; operator: string | null };

export type WorkflowView = {
  id: string;
  version: number;
  code: string;
  name: string;
  subjectType: string;
  description: string;
  status: "draft" | "active" | "retired";
  latestVersion: number;
  publishedVersion: number | null;
  hasUnpublishedChanges: boolean;
  steps: WorkflowStep[];
  updatedAt: string;
};

export type TraceIssue = { stepKey: string | null; code: "first_not_trigger" | "extra_trigger" | "approval_without_sla" | "condition_without_operator" | "no_terminal_action" | "too_short"; };
export type TraceStep = { order: number; key: string; type: StepType; title: string; slaHours: number | null; next: string | null };

/* ------------------------------------------------------------------ */
/* Pure validation                                                     */
/* ------------------------------------------------------------------ */

/** Assign stable, unique keys: keep a valid supplied key, generate the rest. */
export function assignKeys(steps: readonly WorkflowStepInput[]): Array<WorkflowStepInput & { key: string }> {
  const used = new Set<string>();
  return steps.map((step, index) => {
    let key = step.key && !used.has(step.key) ? step.key : `step_${index + 1}`;
    let suffix = 1;
    while (used.has(key)) key = `step_${index + 1}_${suffix++}`;
    used.add(key);
    return { ...step, key };
  });
}

/**
 * Walk the linear path the stored version would execute and report every structural problem.
 * This is the "dry run": no side effects, only what the definition actually says.
 */
export function traceWorkflow(steps: ReadonlyArray<Pick<WorkflowStep, "key" | "type" | "title" | "slaHours" | "operator">>): { path: TraceStep[]; issues: TraceIssue[]; runnable: boolean } {
  const issues: TraceIssue[] = [];
  if (steps.length < 2) issues.push({ stepKey: null, code: "too_short" });
  steps.forEach((step, index) => {
    if (index === 0 && step.type !== "trigger") issues.push({ stepKey: step.key, code: "first_not_trigger" });
    if (index > 0 && step.type === "trigger") issues.push({ stepKey: step.key, code: "extra_trigger" });
    if (step.type === "approval" && !step.slaHours) issues.push({ stepKey: step.key, code: "approval_without_sla" });
    if (step.type === "condition" && !step.operator) issues.push({ stepKey: step.key, code: "condition_without_operator" });
  });
  const last = steps[steps.length - 1];
  if (steps.length >= 2 && last && (last.type === "trigger" || last.type === "condition")) issues.push({ stepKey: last.key, code: "no_terminal_action" });
  const path = steps.map((step, index) => ({ order: index + 1, key: step.key, type: step.type, title: step.title, slaHours: step.slaHours, next: steps[index + 1]?.key ?? null }));
  return { path, issues, runnable: issues.length === 0 };
}

/** Structural rules enforced on save (activation additionally requires a runnable trace). */
export function assertSavable(steps: ReadonlyArray<Pick<WorkflowStep, "key" | "type" | "title" | "slaHours" | "operator">>): void {
  const { issues } = traceWorkflow(steps);
  const blocking = issues.filter((issue) => issue.code === "first_not_trigger" || issue.code === "extra_trigger" || issue.code === "approval_without_sla" || issue.code === "condition_without_operator");
  if (blocking.length > 0) {
    throw new HttpError({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "The workflow steps are not valid.",
      details: blocking.map((issue) => ({ field: `steps.${issue.stepKey ?? ""}`, issue: issue.code })),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

type DefinitionRow = { id: string; code: string; name: string; subject_type: string; status: "draft" | "active" | "retired"; updated_at: string | Date };
type VersionRow = { id: string; workflow_definition_id: string; version: number; definition: Record<string, unknown>; published_at: string | Date | null };
type StepRow = { id: string; workflow_version_id: string; step_key: string; name: string; sla_minutes: number | null };

const iso = (value: string | Date) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

type StepMeta = { key: string; type?: string; description?: string; operator?: string | null };

export function assembleWorkflow(definition: DefinitionRow, versions: VersionRow[], steps: StepRow[]): WorkflowView {
  const ordered = [...versions].sort((left, right) => right.version - left.version);
  const latest = ordered[0];
  const published = ordered.find((version) => version.published_at !== null) ?? null;
  const meta = (Array.isArray(latest?.definition?.steps) ? latest.definition.steps : []) as StepMeta[];
  const byKey = new Map(steps.filter((step) => step.workflow_version_id === latest?.id).map((step) => [step.step_key, step]));
  const view: WorkflowStep[] = meta
    .map((entry) => {
      const row = byKey.get(entry.key);
      if (!row) return null;
      const type = (STEP_TYPES as readonly string[]).includes(entry.type ?? "") ? (entry.type as StepType) : "action";
      return { id: row.id, key: row.step_key, type, title: row.name, description: entry.description ?? "", slaHours: row.sla_minutes ? Math.round(row.sla_minutes / 60) : null, operator: entry.operator ?? null };
    })
    .filter((step): step is WorkflowStep => step !== null);
  return {
    id: definition.id,
    version: latest?.version ?? 0,
    code: definition.code,
    name: definition.name,
    subjectType: definition.subject_type,
    description: typeof latest?.definition?.description === "string" ? latest.definition.description : "",
    status: definition.status,
    latestVersion: latest?.version ?? 0,
    publishedVersion: published?.version ?? null,
    hasUnpublishedChanges: latest !== undefined && latest.published_at === null,
    steps: view,
    updatedAt: iso(definition.updated_at),
  };
}

const manage = (access: Access) => enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
const NOT_FOUND = () => new HttpError({ status: 404, code: "NOT_FOUND", message: "The workflow was not found." });

const audit = (access: Access, action: string, id: string, reason: string, after: unknown, requestId: string) => sqlClient`
  insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
  values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
    ${action}, 'workflow_definition', ${id}, ${reason}, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`;

async function load(access: Access, definitionId: string | null): Promise<WorkflowView[]> {
  const [definitions, versions, steps] = await tenantTx(access, [
    sqlClient`
      select id, code, name, subject_type, status, updated_at from workflow_definitions
      where tenant_id = ${access.tenantId} and (${definitionId}::uuid is null or id = ${definitionId}::uuid)
      order by name asc, id asc limit 200
    `,
    sqlClient`
      select v.id, v.workflow_definition_id, v.version, v.definition, v.published_at from workflow_versions v
      where v.tenant_id = ${access.tenantId} and (${definitionId}::uuid is null or v.workflow_definition_id = ${definitionId}::uuid)
    `,
    sqlClient`
      select s.id, s.workflow_version_id, s.step_key, s.name, s.sla_minutes from workflow_steps s
        join workflow_versions v on v.tenant_id = s.tenant_id and v.id = s.workflow_version_id
      where s.tenant_id = ${access.tenantId} and (${definitionId}::uuid is null or v.workflow_definition_id = ${definitionId}::uuid)
        and v.version = (select max(v2.version) from workflow_versions v2 where v2.tenant_id = v.tenant_id and v2.workflow_definition_id = v.workflow_definition_id)
    `,
  ]);
  const versionRows = versions as VersionRow[];
  const stepRows = steps as StepRow[];
  return (definitions as DefinitionRow[]).map((definition) => assembleWorkflow(definition, versionRows.filter((version) => version.workflow_definition_id === definition.id), stepRows));
}

export async function listWorkflows(access: Access): Promise<WorkflowView[]> {
  manage(access);
  return load(access, null);
}

export async function getWorkflow(access: Access, id: string): Promise<WorkflowView> {
  manage(access);
  const [workflow] = await load(access, id);
  if (!workflow) throw NOT_FOUND();
  return workflow;
}

/** Statements that write version `versionNumber` with its steps and linear transitions. */
function versionStatements(access: Access, definitionId: string, versionNumber: number, description: string, steps: Array<WorkflowStepInput & { key: string }>) {
  const versionId = crypto.randomUUID();
  const stepIds = steps.map(() => crypto.randomUUID());
  const definition = { description, steps: steps.map((step) => ({ key: step.key, type: step.type, description: step.description, operator: step.type === "condition" ? step.operator : null })) };
  return [
    sqlClient`
      insert into workflow_versions (id, tenant_id, workflow_definition_id, version, schema_version, definition)
      values (${versionId}, ${access.tenantId}, ${definitionId}, ${versionNumber}, 1, ${JSON.stringify(definition)}::jsonb)
    `,
    ...steps.map((step, index) => sqlClient`
      insert into workflow_steps (id, tenant_id, workflow_version_id, step_key, name, assignee_rule, sla_minutes)
      values (${stepIds[index]}, ${access.tenantId}, ${versionId}, ${step.key}, ${step.title},
        ${JSON.stringify(step.type === "approval" ? { kind: "approval" } : {})}::jsonb, ${step.type === "approval" && step.slaHours ? step.slaHours * 60 : null})
    `),
    ...steps.slice(0, -1).map((_, index) => sqlClient`
      insert into workflow_transitions (tenant_id, workflow_version_id, from_step_id, to_step_id, event, condition, priority)
      values (${access.tenantId}, ${versionId}, ${stepIds[index]}, ${stepIds[index + 1]}, 'complete', '{}'::jsonb, 100)
    `),
  ];
}

export async function createWorkflow(access: Access, input: z.infer<typeof createWorkflowSchema>, requestId: string) {
  manage(access);
  const [existing] = await tenantTx(access, [
    sqlClient`select id from workflow_definitions where tenant_id = ${access.tenantId} and code = ${input.code} limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `Workflow code ${input.code} already exists.`, details: [{ field: "code", issue: "duplicate" }] });
  }
  const id = crypto.randomUUID();
  const steps = assignKeys([{ type: "trigger", title: input.triggerTitle, description: "", slaHours: null, operator: null }]);
  await tenantTx(access, [
    sqlClient`
      insert into workflow_definitions (id, tenant_id, code, name, subject_type, status)
      values (${id}, ${access.tenantId}, ${input.code}, ${input.name}, ${input.subjectType}, 'draft')
    `,
    ...versionStatements(access, id, 1, input.description, steps),
    audit(access, "workflow.create", id, "Workflow created", { code: input.code, name: input.name, subjectType: input.subjectType }, requestId),
  ]);
  return { id, version: 1 };
}

export async function saveWorkflowSteps(access: Access, id: string, expectedVersion: number, input: z.infer<typeof saveStepsSchema>, requestId: string) {
  const current = await getWorkflow(access, id);
  if (current.status === "retired") throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "A retired workflow cannot be edited." });
  if (current.latestVersion !== expectedVersion) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The workflow changed since it was loaded. Refresh and retry." });
  }
  const steps = assignKeys(input.steps);
  assertSavable(steps);
  const next = current.latestVersion + 1;
  await tenantTx(access, [
    ...versionStatements(access, id, next, current.description, steps),
    sqlClient`update workflow_definitions set updated_at = now() where tenant_id = ${access.tenantId} and id = ${id}`,
    audit(access, "workflow.save", id, `Workflow version ${next} saved`, { version: next, steps: steps.map((step) => ({ key: step.key, type: step.type, title: step.title, slaHours: step.slaHours })) }, requestId),
  ]);
  return getWorkflow(access, id);
}

export async function setWorkflowStatus(access: Access, id: string, expectedVersion: number, status: "active" | "draft" | "retired", requestId: string) {
  const current = await getWorkflow(access, id);
  if (current.latestVersion !== expectedVersion) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The workflow changed since it was loaded. Refresh and retry." });
  }
  if (status === "active") {
    const trace = traceWorkflow(current.steps);
    if (!trace.runnable) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Fix the workflow issues before activating it.", details: trace.issues.map((issue) => ({ field: `steps.${issue.stepKey ?? ""}`, issue: issue.code })) });
    }
  }
  await tenantTx(access, [
    ...(status === "active"
      ? [sqlClient`
          update workflow_versions set published_at = now()
          where tenant_id = ${access.tenantId} and workflow_definition_id = ${id} and version = ${current.latestVersion} and published_at is null
        `]
      : []),
    sqlClient`update workflow_definitions set status = ${status}, updated_at = now() where tenant_id = ${access.tenantId} and id = ${id}`,
    audit(access, `workflow.${status === "active" ? "activate" : status === "retired" ? "retire" : "deactivate"}`, id, `Workflow set to ${status}`, { from: current.status, to: status, version: current.latestVersion }, requestId),
  ]);
  return getWorkflow(access, id);
}

export async function traceStoredWorkflow(access: Access, id: string) {
  const workflow = await getWorkflow(access, id);
  return { workflowId: id, version: workflow.latestVersion, ...traceWorkflow(workflow.steps) };
}
