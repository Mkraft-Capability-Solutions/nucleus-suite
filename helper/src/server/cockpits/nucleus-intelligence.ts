import "server-only";

import { sqlClient } from "@/lib/db";
import { EVALUATION_SUITES } from "@/server/ai/evals";
import { ALLOWLISTED_TOOLS } from "@/server/ai/service";
import { listLatestRunAnomalies } from "@/server/payroll/service";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { derived, ratio, round1, source, unsupported, type Source } from "./source";

/**
 * S10 Nucleus Intelligence — the AI governance console's aggregation.
 *
 * This is a security and compliance surface, so it is built to a stricter rule
 * than the rest of the cockpits: a row here is an assurance that a control
 * exists. Nothing on this page is illustrative. Every guardrail row is a
 * recorded `agent_actions` row, every model is a recorded `model_configs` row,
 * every detection is a recorded `safety_evaluations` or `payroll_anomalies`
 * row, and every review is a recorded `human_review_requests` row.
 *
 * Just as importantly, the payload names what the platform does NOT record.
 * `GOVERNANCE_FIELDS_NOT_RECORDED` is rendered on the page so an absent control
 * reads as absent rather than as an unticked box someone forgot to fill in.
 *
 * Two gaps deserve calling out here because they change how the tables should
 * be read:
 *
 * - A BLOCKED agent action leaves no trace. `proposeAction` rejects a tool
 *   outside `ALLOWLISTED_TOOLS` with a 422 and `approveAction` rejects a
 *   self-approval with a 403, both before any row is written and without an
 *   audit event. The guardrails table therefore shows governed actions that
 *   were recorded; it cannot show attempts that were refused.
 * - A safety evaluation records a pass/fail verdict, not a graded severity.
 *   Only `payroll_anomalies.severity` carries a recorded severity word.
 */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  const raw = str(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

export type SeverityTone = "danger" | "warning" | "success" | "info" | "neutral";

/**
 * Tone for a recorded severity word. The word itself always travels with it —
 * the client prints it inside the pill, so the tone is reinforcement and never
 * the only carrier of the meaning.
 */
export function severityTone(severity: string): SeverityTone {
  const key = severity.trim().toLowerCase();
  if (["critical", "high", "fail", "failed", "blocked", "severe"].includes(key)) return "danger";
  if (["medium", "moderate", "warn", "warning"].includes(key)) return "warning";
  if (["pass", "passed", "resolved", "ok"].includes(key)) return "success";
  if (["low", "info", "informational"].includes(key)) return "info";
  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* Model detections feed                                                      */
/* -------------------------------------------------------------------------- */

export type SafetyEvaluationRow = { id: string; ai_run_id: string | null; attributes: unknown; created_at?: unknown };
export type PayrollAnomalyRow = UnknownRecord;

export type Detection = {
  id: string;
  feed: string;
  subject: string;
  detail: string;
  severity: string;
  tone: SeverityTone;
  recordedAt: string | null;
  reference: string | null;
  open: boolean;
};

export const DETECTION_SEVERITY_NOTE =
  "AI safety evaluations record a pass/fail verdict only — no graded severity is stored against an evaluation, so the verdict word is shown as the severity. Payroll anomalies carry a recorded severity and that recorded word is shown verbatim.";

/**
 * The detections feed: recorded AI evaluation results and recorded payroll
 * anomalies, newest first with anything still open lifted to the top.
 */
export function buildDetections(input: {
  evaluations: readonly SafetyEvaluationRow[];
  anomalies: readonly PayrollAnomalyRow[];
}): Detection[] {
  const fromEvaluations: Detection[] = input.evaluations.map((row) => {
    const attributes = asRecord(row.attributes);
    const passed = attributes.pass === true;
    const suite = str(attributes.suite) || "evaluation";
    const testCase = str(attributes.case) || "case";
    const expected = str(attributes.expected);
    return {
      id: `evaluation:${str(row.id)}`,
      feed: "AI safety evaluation",
      subject: `${suite} · ${testCase}`,
      detail: expected ? `Expected the model to ${expected}.` : "No expectation recorded for this case.",
      severity: passed ? "Pass" : "Fail",
      tone: severityTone(passed ? "pass" : "fail"),
      recordedAt: iso(row.created_at),
      reference: str(row.ai_run_id) || null,
      open: !passed,
    };
  });

  const fromAnomalies: Detection[] = input.anomalies.map((row) => {
    const severity = str(row.severity) || "Not recorded";
    const status = str(row.status) || "open";
    return {
      id: `payroll-anomaly:${str(row.id)}`,
      feed: "Payroll anomaly",
      subject: str(row.rule_code) || "Payroll rule",
      detail: str(row.resolution) || `Status ${status}.`,
      severity,
      tone: severityTone(severity),
      recordedAt: null,
      reference: str(row.employee_id) || null,
      open: status.toLowerCase() === "open",
    };
  });

  return [...fromEvaluations, ...fromAnomalies].sort((left, right) => {
    if (left.open !== right.open) return left.open ? -1 : 1;
    return String(right.recordedAt ?? "").localeCompare(String(left.recordedAt ?? ""));
  });
}

/* -------------------------------------------------------------------------- */
/* Autonomous agent guardrails                                                */
/* -------------------------------------------------------------------------- */

export type AgentActionRow = {
  id: string;
  attributes: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  principal?: unknown;
  tool?: unknown;
  simulations?: number | string | null;
  outcomes?: number | string | null;
  reversals?: number | string | null;
};

export type GuardrailRow = {
  id: string;
  agent: string;
  tool: string;
  status: string;
  tone: SeverityTone;
  autonomyCeiling: string;
  dryRunRecorded: boolean;
  outcomeRecorded: boolean;
  reversed: boolean;
  kind: string | null;
  proposedAt: string | null;
  lastChangeAt: string | null;
};

export const GUARDRAIL_BLOCKED_NOT_RECORDED =
  "Blocked attempts are not recorded anywhere. proposeAction rejects a tool outside the allowlist with a 422, and approveAction rejects a self-approval with a 403 — both refuse before any row or audit event is written. This table shows the governed actions that exist; it cannot show attempts that were blocked, and an empty table is not evidence that nothing was refused.";

function statusTone(status: string): SeverityTone {
  const key = status.trim().toLowerCase();
  if (key === "proposed") return "warning";
  if (key === "approved") return "info";
  if (key === "completed") return "success";
  if (key === "rejected" || key === "blocked") return "danger";
  return "neutral";
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildGuardrailRows(rows: readonly AgentActionRow[]): GuardrailRow[] {
  return rows.map((row) => {
    const attributes = asRecord(row.attributes);
    const status = str(attributes.status) || "not recorded";
    const reversals = count(row.reversals);
    return {
      id: str(row.id),
      agent: str(asRecord(row.principal).code) || "Not recorded",
      tool: str(asRecord(row.tool).code) || "Not recorded",
      status,
      tone: reversals > 0 ? "danger" : statusTone(status),
      autonomyCeiling: str(attributes.autonomy_ceiling) || "Not recorded",
      dryRunRecorded: count(row.simulations) > 0,
      outcomeRecorded: count(row.outcomes) > 0,
      reversed: reversals > 0,
      kind: str(attributes.kind) || null,
      proposedAt: iso(row.created_at),
      lastChangeAt: iso(row.updated_at),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Model register                                                             */
/* -------------------------------------------------------------------------- */

export type ModelConfigRow = {
  id: string;
  attributes: unknown;
  created_at?: unknown;
  runs?: number | string | null;
  last_run_at?: unknown;
};

export type RegisteredModel = {
  id: string;
  model: string;
  runs: number;
  registeredAt: string | null;
  lastRunAt: string | null;
};

export function buildModelRegister(rows: readonly ModelConfigRow[]): RegisteredModel[] {
  return rows.map((row) => ({
    id: str(row.id),
    model: str(asRecord(row.attributes).model) || "Not recorded",
    runs: count(row.runs),
    registeredAt: iso(row.created_at),
    lastRunAt: iso(row.last_run_at),
  }));
}

export type EvalSuiteSummary = {
  suite: string;
  description: string | null;
  passed: number;
  total: number;
  passRatePct: number | null;
  lastRunAt: string | null;
  everRun: boolean;
};

/**
 * Evaluation suites defined in code, scored from the `safety_evaluations` rows
 * they actually wrote. A defined suite that has never run reports `everRun:
 * false` with no score rather than a zero that would read as a failure.
 */
export function summariseEvalSuites(
  evaluations: readonly SafetyEvaluationRow[],
  definitions: Record<string, { description: string }>,
): EvalSuiteSummary[] {
  const buckets = new Map<string, { passed: number; total: number; lastRunAt: string | null }>();
  for (const row of evaluations) {
    const attributes = asRecord(row.attributes);
    const suite = str(attributes.suite);
    if (!suite) continue;
    const bucket = buckets.get(suite) ?? { passed: 0, total: 0, lastRunAt: null };
    bucket.total += 1;
    if (attributes.pass === true) bucket.passed += 1;
    const recordedAt = iso(row.created_at);
    if (recordedAt && (bucket.lastRunAt === null || recordedAt > bucket.lastRunAt)) bucket.lastRunAt = recordedAt;
    buckets.set(suite, bucket);
  }

  const names = [...new Set([...Object.keys(definitions), ...buckets.keys()])].sort();
  return names.map((suite) => {
    const bucket = buckets.get(suite) ?? { passed: 0, total: 0, lastRunAt: null };
    return {
      suite,
      description: definitions[suite]?.description ?? null,
      passed: bucket.passed,
      total: bucket.total,
      passRatePct: bucket.total > 0 ? ratio(bucket.passed, bucket.total) : null,
      lastRunAt: bucket.lastRunAt,
      everRun: bucket.total > 0,
    };
  });
}

/**
 * The governance fields this platform does not store. Rendered on the page so
 * the register cannot be mistaken for a complete model card — an absent bias
 * audit must read as "never recorded", not as a column nobody filled in.
 */
export const GOVERNANCE_FIELDS_NOT_RECORDED: ReadonlyArray<{ field: string; detail: string }> = [
  {
    field: "Bias / fairness audit",
    detail:
      "No table, column or service anywhere records a bias or fairness audit, its date, its methodology or its outcome. There is no bias-audit writer in the codebase.",
  },
  {
    field: "DPDP or privacy impact assessment",
    detail:
      "No DPDP assessment, data-protection impact assessment or review date is stored against a model, a workflow or an agent principal.",
  },
  {
    field: "Model provider, version and pin",
    detail:
      "model_configs.attributes carries a single `model` name. No provider, no version, no weight hash and no pinned revision are recorded, so a silent provider-side model change would leave no trace here.",
  },
  {
    field: "Model owner and approver",
    detail:
      "No accountable owner, approving authority or sign-off date is stored against a registered model.",
  },
  {
    field: "Risk classification and approved use",
    detail:
      "No risk tier, intended-use statement or restriction is recorded. capability_index_versions carries a permitted_use string for the capability index only; models carry nothing equivalent.",
  },
  {
    field: "Drift and production monitoring",
    detail:
      "Nothing samples live output quality. Evaluation suites run only when invoked, so a score here is the score of the last deliberate run, not a continuous monitor.",
  },
  {
    field: "Retention and deletion schedule",
    detail: "No retention period or deletion schedule is recorded for AI runs, prompts, artefacts or evaluation output.",
  },
  {
    field: "Blocked-attempt record",
    detail:
      "A refused agent action writes no row and no audit event, so the count of blocked attempts is unknowable from stored data.",
  },
];

export const NL_QUERY_CONSOLE_ABSENT =
  "The specification describes a natural-language query console. No endpoint, service or parser backing one exists in this platform, so it is not built here. A query box that produced nothing, or produced an answer from somewhere other than the tenant's data, would be worse than its absence on a governance surface.";

/* -------------------------------------------------------------------------- */
/* Human-review queue                                                         */
/* -------------------------------------------------------------------------- */

export type HumanReviewRow = {
  id: string;
  ai_run_id: string | null;
  assigned_membership_id: string | null;
  attributes: unknown;
  created_at?: unknown;
  decision?: unknown;
  decided_at?: unknown;
};

export type ReviewItem = {
  id: string;
  runId: string | null;
  summary: string;
  status: string;
  tone: SeverityTone;
  decision: string | null;
  comment: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  assignedMembershipId: string | null;
  /** True only when the row is still pending; the endpoint rejects anything else with a 409. */
  decidable: boolean;
  /** Where the decision is actually made. Wired to a real POST. */
  decideEndpoint: string;
};

export function buildReviewQueue(rows: readonly HumanReviewRow[]): ReviewItem[] {
  return rows.map((row) => {
    const attributes = asRecord(row.attributes);
    const decision = asRecord(row.decision);
    const status = str(attributes.status) || "pending";
    const pending = status.toLowerCase() === "pending";
    return {
      id: str(row.id),
      runId: str(row.ai_run_id) || null,
      summary: str(attributes.summary) || "No summary recorded.",
      status,
      tone: pending ? "warning" : severityTone(str(decision.decision)),
      decision: str(decision.decision) || null,
      comment: str(decision.comment) || null,
      requestedAt: iso(row.created_at),
      decidedAt: iso(row.decided_at),
      assignedMembershipId: str(row.assigned_membership_id) || null,
      decidable: pending,
      decideEndpoint: `/api/v1/ai/reviews/${str(row.id)}/decide`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Database reads                                                             */
/* -------------------------------------------------------------------------- */

/** Every read on this cockpit is gated on the tenant-administration permission. */
function requireGovernanceRead(access: Access): void {
  enforce(access.context, "tenant.read", { tenantId: access.tenantId });
}

async function readSafetyEvaluations(access: Access): Promise<SafetyEvaluationRow[]> {
  requireGovernanceRead(access);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, ai_run_id, attributes, created_at from safety_evaluations
      where tenant_id = ${access.tenantId}
      order by created_at desc
      limit 200
    `,
  ]);
  return rows as SafetyEvaluationRow[];
}

async function readAgentActions(access: Access): Promise<AgentActionRow[]> {
  requireGovernanceRead(access);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select action.id, action.attributes, action.created_at, action.updated_at,
             principal.attributes as principal,
             tool.attributes as tool,
             (select count(*) from agent_action_simulations simulation
                where simulation.tenant_id = action.tenant_id and simulation.agent_action_id = action.id)::int as simulations,
             (select count(*) from agent_action_outcomes outcome
                where outcome.tenant_id = action.tenant_id and outcome.agent_action_id = action.id)::int as outcomes,
             (select count(*) from agent_action_reversals reversal
                where reversal.tenant_id = action.tenant_id and reversal.original_agent_action_id = action.id)::int as reversals
      from agent_actions action
      left join agent_principals principal
        on principal.id = action.agent_principal_id and principal.tenant_id = action.tenant_id
      left join agent_tools tool on tool.id = action.agent_tool_id
      where action.tenant_id = ${access.tenantId}
      order by action.created_at desc
      limit 100
    `,
  ]);
  return rows as AgentActionRow[];
}

async function readModelConfigs(access: Access): Promise<ModelConfigRow[]> {
  requireGovernanceRead(access);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select config.id, config.attributes, config.created_at,
             (select count(*) from ai_runs run
                where run.tenant_id = config.tenant_id and run.model_config_id = config.id)::int as runs,
             (select max(run.created_at) from ai_runs run
                where run.tenant_id = config.tenant_id and run.model_config_id = config.id) as last_run_at
      from model_configs config
      where config.tenant_id = ${access.tenantId}
      order by config.created_at
      limit 50
    `,
  ]);
  return rows as ModelConfigRow[];
}

async function readHumanReviews(access: Access): Promise<HumanReviewRow[]> {
  requireGovernanceRead(access);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select request.id, request.ai_run_id, request.assigned_membership_id, request.attributes, request.created_at,
             decision.attributes as decision, decision.created_at as decided_at
      from human_review_requests request
      left join human_review_decisions decision
        on decision.human_review_request_id = request.id and decision.tenant_id = request.tenant_id
      where request.tenant_id = ${access.tenantId}
      order by request.created_at desc
      limit 100
    `,
  ]);
  return rows as HumanReviewRow[];
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                    */
/* -------------------------------------------------------------------------- */

export type NucleusIntelligencePayload = {
  kpis: {
    openDetections: Source<number>;
    governedActions: Source<number>;
    pendingReviews: Source<number>;
    evaluationPassRatePct: Source<number | null>;
  };
  detections: Source<Detection[]>;
  detectionSeverityNote: string;
  guardrails: Source<GuardrailRow[]>;
  guardrailNotes: { blockedNotRecorded: string; allowlistedTools: readonly string[]; allowlistNote: string };
  modelRegister: Source<RegisteredModel[]>;
  evaluationSuites: Source<EvalSuiteSummary[]>;
  governanceFieldsNotRecorded: ReadonlyArray<{ field: string; detail: string }>;
  reviewQueue: Source<ReviewItem[]>;
  reviewDecisions: readonly string[];
  canDecideReviews: boolean;
  canDecideNote: string;
  naturalLanguageQueryConsole: Source<null>;
  unavailableSources: Array<{ name: string; message: string }>;
  generatedAt: string;
};

export const REVIEW_DECISIONS = ["accepted", "rejected", "changes_requested"] as const;

export async function readNucleusIntelligence(access: Access): Promise<NucleusIntelligencePayload> {
  const [evaluations, anomalies, actions, models, reviews] = await Promise.all([
    source(() => readSafetyEvaluations(access), [] as SafetyEvaluationRow[], "safety_evaluations"),
    source(
      async () => (await listLatestRunAnomalies(access)) as PayrollAnomalyRow[],
      [] as PayrollAnomalyRow[],
      "payroll_anomalies (latest run)",
    ),
    source(() => readAgentActions(access), [] as AgentActionRow[], "agent_actions"),
    source(() => readModelConfigs(access), [] as ModelConfigRow[], "model_configs"),
    source(() => readHumanReviews(access), [] as HumanReviewRow[], "human_review_requests"),
  ]);

  const detections = buildDetections({ evaluations: evaluations.value, anomalies: anomalies.value });
  const guardrails = buildGuardrailRows(actions.value);
  const register = buildModelRegister(models.value);
  const suites = summariseEvalSuites(evaluations.value, EVALUATION_SUITES);
  const queue = buildReviewQueue(reviews.value);

  const evaluatedTotal = suites.reduce((total, suite) => total + suite.total, 0);
  const evaluatedPassed = suites.reduce((total, suite) => total + suite.passed, 0);
  const canDecideReviews = access.context.permissions.includes("employee.write");

  const sources = { evaluations, anomalies, actions, models, reviews };
  const unavailableSources = Object.entries(sources)
    .filter(([, entry]) => !entry.available)
    .map(([name, entry]) => ({ name, message: entry.message ?? "Permission or source unavailable." }));

  const detectionsAvailable = evaluations.available || anomalies.available;

  return {
    kpis: {
      openDetections: detectionsAvailable
        ? derived(detections.filter((detection) => detection.open).length, "Failed safety evaluations and open payroll anomalies")
        : { value: 0, available: false, message: evaluations.message, origin: "safety_evaluations" },
      governedActions: actions.available
        ? derived(guardrails.length, "agent_actions rows recorded for this tenant")
        : { value: 0, available: false, message: actions.message, origin: "agent_actions" },
      pendingReviews: reviews.available
        ? derived(queue.filter((item) => item.decidable).length, "human_review_requests still at status pending")
        : { value: 0, available: false, message: reviews.message, origin: "human_review_requests" },
      evaluationPassRatePct: evaluations.available
        ? derived(
            evaluatedTotal > 0 ? round1(ratio(evaluatedPassed, evaluatedTotal)) : null,
            "Passed cases over all recorded safety_evaluations cases",
          )
        : { value: null, available: false, message: evaluations.message, origin: "safety_evaluations" },
    },
    detections: detectionsAvailable
      ? derived(detections, "safety_evaluations joined with the latest payroll run's anomalies")
      : { value: [], available: false, message: evaluations.message, origin: "safety_evaluations" },
    detectionSeverityNote: DETECTION_SEVERITY_NOTE,
    guardrails: actions.available
      ? derived(guardrails, "agent_actions with their simulation, outcome and reversal records")
      : { value: [], available: false, message: actions.message, origin: "agent_actions" },
    guardrailNotes: {
      blockedNotRecorded: GUARDRAIL_BLOCKED_NOT_RECORDED,
      allowlistedTools: ALLOWLISTED_TOOLS,
      allowlistNote:
        "The tool allowlist enforced by proposeAction, read from the server contract rather than from any per-action record. A tool outside it cannot be proposed.",
    },
    modelRegister: models.available
      ? derived(register, "model_configs with their ai_runs count and latest run timestamp")
      : { value: [], available: false, message: models.message, origin: "model_configs" },
    evaluationSuites: evaluations.available
      ? derived(suites, "Suites defined in EVALUATION_SUITES, scored from recorded safety_evaluations rows")
      : { value: [], available: false, message: evaluations.message, origin: "safety_evaluations" },
    governanceFieldsNotRecorded: GOVERNANCE_FIELDS_NOT_RECORDED,
    reviewQueue: reviews.available
      ? derived(queue, "human_review_requests with their recorded decision")
      : { value: [], available: false, message: reviews.message, origin: "human_review_requests" },
    reviewDecisions: REVIEW_DECISIONS,
    canDecideReviews,
    canDecideNote: canDecideReviews
      ? "Deciding posts to /api/v1/ai/reviews/{id}/decide, the same endpoint the review workflow uses."
      : "Deciding a review needs the employee.write permission, which this account does not hold. The decision control is disabled rather than hidden so the route to it stays visible.",
    naturalLanguageQueryConsole: unsupported(null, NL_QUERY_CONSOLE_ABSENT),
    unavailableSources,
    generatedAt: new Date().toISOString(),
  };
}
