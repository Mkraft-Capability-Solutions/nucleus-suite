import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Workflow pipelines and lifecycle trigger chains — READ SIDE ONLY.
 *
 * ## What these tables are, and what they are not
 *
 * `workflow_definitions` / `workflow_versions` / `workflow_steps` /
 * `workflow_transitions` (columnar, created in `0004_foundation_domain`) and
 * `workflow_instances` / `workflow_activity` (envelope + JSONB, created in
 * `0008_canonical_304_topology`) hold *automation definitions*: a named
 * pipeline, the record subject it is about, and an ordered chain of steps
 * joined by event-carrying transitions.
 *
 * They are NOT the engine that actually runs approvals in Nucleus. That engine
 * is `src/server/workflows/operational-service.ts`, which drives *record*
 * workflows (draft -> submitted -> approved) over `hrms_operation_records` /
 * `hrms_operation_events` using the catalogue in `src/lib/operational-catalog.ts`.
 * The operational engine never reads a `workflow_definitions` row, and nothing
 * else in `src/` does either — this module is the first reader in the tree.
 *
 * ## Execution honesty (DESIGN_SYSTEM.md section 9)
 *
 * There is no runtime in this repository that starts, advances, retries or
 * completes one of these definitions:
 *
 *   - no application code writes `workflow_instances`, `step_instances`,
 *     `task_assignments` or `workflow_activity`;
 *   - no scheduler, outbox consumer or trigger subscribes to a lifecycle event
 *     and looks up a matching definition;
 *   - every row present in the estate today was written by the demo loader
 *     `scripts/seeder/domain03-workflows.ts`, which is also the only writer of
 *     `workflow_definitions` anywhere in the repo.
 *
 * So a pipeline here is a RECORDED DEFINITION, not a configured-and-executing
 * automation. `PIPELINE_EXECUTION` below is the single place that fact is
 * stated, and every row carries it so no surface can render a step chain
 * without also rendering what it does (and does not) do. If an executor is ever
 * added, change it here and the surfaces follow.
 */

/** The one claim the UI is allowed to make about execution. Keep it truthful. */
export const PIPELINE_EXECUTION = {
  mode: "definition_only" as const,
  label: "Recorded definition — not executed",
  summary:
    "Nucleus stores these pipelines but does not run them. No service in this build starts, advances or completes a pipeline, so nothing here provisions access, changes reporting lines or triggers payroll on its own.",
};

export type PipelineExecution = typeof PIPELINE_EXECUTION;

export type PipelineStep = {
  id: string;
  stepKey: string;
  /** `workflow_steps.name` — the real column. There is no `title` column. */
  title: string;
  order: number | null;
  /** Only where a definition actually recorded one; otherwise null. */
  stepType: string | null;
  slaMinutes: number | null;
  /** Whatever else the definition recorded against the step, verbatim. */
  config: Record<string, unknown>;
  /** Events on the transitions leaving this step. */
  outboundEvents: string[];
};

export type Pipeline = {
  id: string;
  version: number;
  code: string;
  /** `workflow_definitions.name`. The reference app bound `title` and rendered blanks. */
  name: string;
  /** `workflow_definitions.subject_type` — the record category the pipeline is about. */
  category: string;
  categoryLabel: string;
  /**
   * The event that starts the chain: the event on the transition leaving the
   * entry step (the step nothing transitions into). `workflow_definitions` has
   * no `triggerEvent` column, so this is derived from the stored transitions
   * rather than invented — null when the definition records no transition.
   */
  triggerEvent: string | null;
  entryStepKey: string | null;
  status: string;
  statusLabel: string;
  versionNumber: number | null;
  publishedAt: string | null;
  stepCount: number;
  steps: PipelineStep[];
  /** Null unless the subject type names a lifecycle stage. Never guessed. */
  lifecycleEvent: string | null;
  lifecycleEventLabel: string | null;
  /** Rows in `workflow_instances` for this definition's latest version. */
  recordedRuns: number;
  /** Of those, how many record a user who started them. */
  runsStartedByUser: number;
  lastActivityAt: string | null;
  execution: PipelineExecution;
};

/**
 * Subject types that name a lifecycle stage. This maps a stored `subject_type`
 * onto the lifecycle vocabulary the product already uses (`PL_ASSIGNMENT_CHANGE`
 * in `src/lib/picklists.ts`); it does NOT invent chains. A definition whose
 * subject is not listed simply is not a lifecycle chain, and the trigger-chain
 * surface shows nothing for it.
 */
const LIFECYCLE_SUBJECTS: Record<string, { event: string; label: string }> = {
  onboarding_instance: { event: "new_hire", label: "New hire" },
  onboarding_template: { event: "new_hire", label: "New hire" },
  onboarding_task: { event: "new_hire", label: "New hire" },
  employment: { event: "assignment_change", label: "Promotion, transfer or redesignation" },
  assignment: { event: "assignment_change", label: "Promotion, transfer or redesignation" },
  assignment_change: { event: "assignment_change", label: "Promotion, transfer or redesignation" },
  internal_mobility: { event: "assignment_change", label: "Promotion, transfer or redesignation" },
  mobility: { event: "assignment_change", label: "Promotion, transfer or redesignation" },
  confirmation: { event: "confirmation", label: "Confirmation" },
  offboarding_case: { event: "exit", label: "Resignation and exit" },
  exit_interview: { event: "exit", label: "Resignation and exit" },
  clearance_item: { event: "exit", label: "Resignation and exit" },
  full_final_settlement: { event: "exit", label: "Resignation and exit" },
};

/** `onboarding_instance` -> `Onboarding instance`. Never a bare machine token. */
function humanLabel(value: string): string {
  if (!value) return "Not recorded";
  const words = value.replace(/[_\-.]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  retired: "Retired",
};

/**
 * `hr.lifecycle.read` is registered by `0023_lifecycle_letters_recognition`.
 * Until every estate has run that migration no role holds it, so a caller that
 * has not been granted it is checked against `employee.read` instead — the same
 * permission that already gates the joining-chain console over this lifecycle
 * data. Exactly one of the two is enforced; neither is bypassed.
 */
function enforcePipelineRead(access: Access): void {
  const held = new Set(access.context.permissions);
  const action = held.has("hr.lifecycle.read") ? "hr.lifecycle.read" : "employee.read";
  enforce(access.context, action, { tenantId: access.tenantId });
}

type PipelineQueryRow = {
  id: string;
  code: string | null;
  name: string | null;
  subject_type: string | null;
  status: string | null;
  version_number: number | null;
  published_at: string | null;
  steps: unknown;
  step_count: number | null;
  trigger_event: string | null;
  entry_step_key: string | null;
  recorded_runs: number | null;
  runs_started_by_user: number | null;
  last_activity_at: string | null;
};

/**
 * One definition per row with its latest version's ordered steps.
 *
 * `assignee_rule` is the only per-step JSON a step carries, so the step's
 * ordinal, its recorded type and its remaining configuration all come out of
 * it. The ordinal cast is guarded by a digit test: a non-numeric `order` must
 * sort last, not abort the query.
 */
const PIPELINE_SQL = `
with latest_version as (
  select distinct on (v.workflow_definition_id)
    v.id, v.workflow_definition_id, v.version, v.published_at
  from workflow_versions v
  where v.tenant_id = $1
  order by v.workflow_definition_id, v.version desc, v.created_at desc
)
select
  d.id,
  d.code,
  d.name,
  d.subject_type,
  d.status,
  lv.version as version_number,
  to_json(lv.published_at)#>>'{}' as published_at,
  coalesce(step_list.items, '[]'::jsonb) as steps,
  coalesce(step_list.step_count, 0)::int as step_count,
  entry.trigger_event,
  entry.entry_step_key,
  coalesce(runs.recorded_runs, 0)::int as recorded_runs,
  coalesce(runs.runs_started_by_user, 0)::int as runs_started_by_user,
  acts.last_activity_at
from workflow_definitions d
left join latest_version lv on lv.workflow_definition_id = d.id
left join lateral (
  select
    count(*)::int as step_count,
    jsonb_agg(step.item order by step.sort_order asc, step.created_at asc, step.step_key asc) as items
  from (
    select
      s.step_key,
      s.created_at,
      case when s.assignee_rule->>'order' ~ '^[0-9]+$'
           then (s.assignee_rule->>'order')::int else 2147483647 end as sort_order,
      jsonb_build_object(
        'id', s.id,
        'stepKey', s.step_key,
        'title', s.name,
        'order', case when s.assignee_rule->>'order' ~ '^[0-9]+$'
                      then (s.assignee_rule->>'order')::int else null end,
        'stepType', coalesce(s.assignee_rule->>'step_type', s.assignee_rule->>'type'),
        'slaMinutes', s.sla_minutes,
        'config', coalesce(s.assignee_rule, '{}'::jsonb) - 'order' - 'step_type' - 'type',
        'outboundEvents', coalesce((
          select jsonb_agg(distinct t.event)
          from workflow_transitions t
          where t.tenant_id = s.tenant_id and t.from_step_id = s.id
        ), '[]'::jsonb)
      ) as item
    from workflow_steps s
    where s.tenant_id = d.tenant_id and s.workflow_version_id = lv.id
  ) step
) step_list on true
left join lateral (
  select t.event as trigger_event, s.step_key as entry_step_key
  from workflow_steps s
  join workflow_transitions t on t.tenant_id = s.tenant_id and t.from_step_id = s.id
  where s.tenant_id = d.tenant_id
    and s.workflow_version_id = lv.id
    and not exists (
      select 1 from workflow_transitions inbound
      where inbound.tenant_id = s.tenant_id and inbound.to_step_id = s.id
    )
  order by t.priority asc, t.created_at asc
  limit 1
) entry on true
left join lateral (
  select
    count(*)::int as recorded_runs,
    count(*) filter (where i.started_by_user_id is not null)::int as runs_started_by_user
  from workflow_instances i
  where i.tenant_id = d.tenant_id and i.workflow_version_id = lv.id
) runs on true
left join lateral (
  -- ISO 8601 so the browser can parse it: a plain ::text cast yields a
  -- space-separated form that new Date(...) rejects in some engines.
  select to_json(max(act.created_at))#>>'{}' as last_activity_at
  from workflow_activity act
  join workflow_instances i2
    on i2.tenant_id = act.tenant_id and i2.id = act.workflow_instance_id
  where act.tenant_id = d.tenant_id and i2.workflow_version_id = lv.id
) acts on true
where d.tenant_id = $1
order by d.name asc nulls last, d.code asc
limit 200
`;

function toStep(raw: unknown): PipelineStep | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  if (!id) return null;
  const events = Array.isArray(record.outboundEvents)
    ? record.outboundEvents.filter((event): event is string => typeof event === "string")
    : [];
  const order = Number(record.order);
  const sla = Number(record.slaMinutes);
  return {
    id,
    stepKey: typeof record.stepKey === "string" ? record.stepKey : "",
    title: typeof record.title === "string" && record.title.length > 0 ? record.title : "Untitled step",
    order: Number.isInteger(order) ? order : null,
    stepType: typeof record.stepType === "string" && record.stepType.length > 0 ? record.stepType : null,
    slaMinutes: Number.isFinite(sla) && sla > 0 ? Math.trunc(sla) : null,
    config:
      typeof record.config === "object" && record.config !== null
        ? (record.config as Record<string, unknown>)
        : {},
    outboundEvents: events,
  };
}

function toPipeline(raw: PipelineQueryRow): Pipeline {
  const category = raw.subject_type ?? "";
  const lifecycle = LIFECYCLE_SUBJECTS[category] ?? null;
  const status = raw.status ?? "unknown";
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map(toStep).filter((step): step is PipelineStep => step !== null)
    : [];
  const trigger = raw.trigger_event && raw.trigger_event.length > 0 ? raw.trigger_event : null;
  return {
    id: raw.id,
    version: raw.version_number ?? 1,
    code: raw.code ?? "",
    name: raw.name && raw.name.length > 0 ? raw.name : "Unnamed pipeline",
    category,
    categoryLabel: category ? humanLabel(category) : "No category recorded",
    triggerEvent: trigger,
    entryStepKey: raw.entry_step_key ?? null,
    status,
    statusLabel: STATUS_LABELS[status] ?? humanLabel(status),
    versionNumber: raw.version_number ?? null,
    publishedAt: raw.published_at ?? null,
    stepCount: Number(raw.step_count ?? 0),
    steps,
    lifecycleEvent: lifecycle?.event ?? null,
    lifecycleEventLabel: lifecycle?.label ?? null,
    recordedRuns: Number(raw.recorded_runs ?? 0),
    runsStartedByUser: Number(raw.runs_started_by_user ?? 0),
    lastActivityAt: raw.last_activity_at ?? null,
    execution: PIPELINE_EXECUTION,
  };
}

/**
 * Every stored pipeline definition for the tenant, newest version first.
 *
 * Read-only by design: there is no create/update path here because there is no
 * executor to make a written definition mean anything, and a save button on a
 * definition nothing runs would be the exact dishonesty this surface exists to
 * avoid. If an executor lands, add the mutation alongside it.
 */
export async function listPipelines(access: Access): Promise<Pipeline[]> {
  enforcePipelineRead(access);
  const [rows] = await tenantTx(access, [sqlClient.query(PIPELINE_SQL, [access.tenantId])]);
  return (rows as PipelineQueryRow[]).map(toPipeline);
}
