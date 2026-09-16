import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const ALLOWLISTED_TOOLS = ["policy.retrieve", "leave.read_balance", "attendance.read_day", "draft.prepare", "action.preview"] as const;

function toolAllowed(tool: string): boolean {
  return (ALLOWLISTED_TOOLS as readonly string[]).includes(tool);
}

// ---------------------------------------------------------------------------
// Knowledge base (tenant-filtered retrieval corpus)
// ---------------------------------------------------------------------------

export const ingestKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  section: z.string().trim().min(1).max(200),
  text: z.string().trim().min(10).max(20000),
  keywords: z.array(z.string().trim().min(2).max(40)).min(1).max(20),
  audience: z.string().trim().min(1).max(80).default("all"),
});

export async function ingestKnowledge(access: Access, input: z.infer<typeof ingestKnowledgeSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [sourceRows] = await tenantTx(access, [
    sqlClient`select id from knowledge_sources where tenant_id = ${access.tenantId} and attributes->>'code' = 'policy-manual' limit 1`,
  ]);
  let sourceId = (sourceRows as Array<{ id: string }>)[0]?.id;
  if (!sourceId) {
    sourceId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into knowledge_sources (id, tenant_id, attributes) values (${sourceId}, ${access.tenantId}, '{"code":"policy-manual","name":"Policy manual"}'::jsonb)`,
    ]);
  }
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const checksum = createHash("sha256").update(input.text).digest("hex");
  const [policyTypeRows] = await tenantTx(access, [
    sqlClient`select id from document_types where tenant_id = ${access.tenantId} and attributes->>'code' = 'POLICY' limit 1`,
  ]);
  let policyTypeId = (policyTypeRows as Array<{ id: string }>)[0]?.id;
  if (!policyTypeId) {
    policyTypeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into document_types (id, tenant_id, attributes) values (${policyTypeId}, ${access.tenantId}, '{"code":"POLICY","name":"Policy document"}'::jsonb)`,
    ]);
  }
  await tenantTx(access, [
    sqlClient`
      insert into documents (id, tenant_id, document_type_id, attributes)
      values (${documentId}, ${access.tenantId}, ${policyTypeId},
        ${JSON.stringify({ title: input.title, current_version: 1 })}::jsonb)
    `,
  ]);
  await tenantTx(access, [
    sqlClient`
      insert into document_versions (id, tenant_id, document_id, attributes)
      values (${versionId}, ${access.tenantId}, ${documentId},
        ${JSON.stringify({ version: 1, title: input.title, mime: "text/markdown", sha256: checksum, scan: "available" })}::jsonb)
    `,
    sqlClient`
      insert into knowledge_documents (id, tenant_id, document_id, document_version_id, knowledge_source_id, attributes)
      values (${crypto.randomUUID()}, ${access.tenantId}, ${documentId}, ${versionId}, ${sourceId},
        ${JSON.stringify({ title: input.title, audience: input.audience })}::jsonb)
    `,
  ]);
  const [knowledgeRows] = await tenantTx(access, [
    sqlClient`select id from knowledge_documents where tenant_id = ${access.tenantId} and document_id = ${documentId} limit 1`,
  ]);
  const knowledgeId = (knowledgeRows as Array<{ id: string }>)[0]?.id ?? crypto.randomUUID();
  // Chunk by paragraphs for permission-filtered retrieval.
  const chunks = input.text.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean);
  await tenantTx(access, [
    ...chunks.map((chunk, index) => sqlClient`
      insert into knowledge_chunks (tenant_id, knowledge_document_id, attributes)
      values (${access.tenantId}, ${knowledgeId},
        ${JSON.stringify({ ordinal: index, section: input.section, text: chunk, keywords: input.keywords, title: input.title, checksum })}::jsonb)
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ai.knowledge_ingest', 'knowledge_document', ${knowledgeId}, 'Policy passage ingested', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { knowledgeId, chunks: chunks.length, checksum };
}

export async function searchKnowledge(access: Access, query: string, limit: number) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const normalized = query.toLowerCase();
  const terms = new Set(normalized.split(/\W+/).filter((term) => term.length > 2));
  const [rows] = await tenantTx(access, [
    sqlClient`
      select attributes from knowledge_chunks where tenant_id = ${access.tenantId}
      order by created_at desc limit 200
    `,
  ]);
  const scored = (rows as Array<{ attributes: { title: string; section: string; text: string; keywords: string[]; checksum: string } }>)
    .map((row) => ({
      passage: row.attributes,
      score: row.attributes.keywords.reduce((score, keyword) => score + (normalized.includes(keyword.toLowerCase()) || terms.has(keyword.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(limit, 1), 10));
  return scored.map((result) => result.passage);
}

// ---------------------------------------------------------------------------
// Runs, steps, artifacts, feedback, human review
// ---------------------------------------------------------------------------

async function ensureWorkflow(access: Access, code: string, modelId: string | null): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from ai_workflow_definitions where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  if (!modelId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "New AI workflows require a default model configuration." });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into ai_workflow_definitions (id, tenant_id, default_model_config_id, attributes)
      values (${id}, ${access.tenantId}, ${modelId}, ${JSON.stringify({ code })}::jsonb)
    `,
  ]);
  return id;
}

async function ensureModel(access: Access): Promise<string> {
  const modelName = process.env.OPENAI_MODEL ?? "deterministic-fallback";
  const [rows] = await tenantTx(access, [
    sqlClient`select id from model_configs where tenant_id = ${access.tenantId} and attributes->>'model' = ${modelName} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into model_configs (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ model: modelName })}::jsonb)`,
  ]);
  return id;
}

export const startRunSchema = z.object({
  workflowCode: z.string().trim().min(1).max(80),
  inputRef: z.string().trim().max(200).optional(),
});

export async function startRun(access: Access, input: z.infer<typeof startRunSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const modelId = await ensureModel(access);
  const workflowId = await ensureWorkflow(access, input.workflowCode, modelId);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into ai_runs (id, tenant_id, ai_workflow_definition_id, model_config_id, requested_by_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${workflowId}, ${modelId}, ${access.context.membershipId},
        ${JSON.stringify({ status: "running", input_ref: input.inputRef ?? null })}::jsonb)
    `,
  ]);
  return { id, status: "running" };
}

export async function recordStep(access: Access, runId: string, name: string, output: unknown) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into ai_run_steps (id, tenant_id, ai_run_id, attributes)
      values (${id}, ${access.tenantId}, ${runId}, ${JSON.stringify({ name, output })}::jsonb)
    `,
  ]);
  return { id };
}

export async function getRun(access: Access, runId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [runRows] = await tenantTx(access, [
    sqlClient`select id, attributes from ai_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (runRows as Array<{ id: string; attributes: unknown }>)[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [stepRows, artifactRows, feedbackRows] = await tenantTx(access, [
    sqlClient`select id, attributes, created_at from ai_run_steps where tenant_id = ${access.tenantId} and ai_run_id = ${runId} order by created_at`,
    sqlClient`select id, attributes from ai_artifacts where tenant_id = ${access.tenantId} and ai_run_id = ${runId} order by created_at`,
    sqlClient`select attributes from ai_feedback where tenant_id = ${access.tenantId} and ai_run_id = ${runId} order by created_at`,
  ]);
  return { run, steps: stepRows, artifacts: artifactRows, feedback: feedbackRows };
}

export const submitAiFeedbackSchema = z.object({
  runId: z.string().uuid(),
  rating: z.enum(["up", "down"]),
  comment: z.string().trim().max(1000).optional(),
});

export async function submitAiFeedback(access: Access, input: z.infer<typeof submitAiFeedbackSchema>) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into ai_feedback (id, tenant_id, ai_run_id, membership_id, attributes)
      values (${id}, ${access.tenantId}, ${input.runId}, ${access.context.membershipId},
        ${JSON.stringify({ rating: input.rating, comment: input.comment ?? null })}::jsonb)
    `,
  ]);
  return { id };
}

export const requestReviewSchema = z.object({
  runId: z.string().uuid(),
  assigneeMembershipId: z.string().uuid().optional(),
  summary: z.string().trim().min(1).max(1000),
});

export async function requestHumanReview(access: Access, input: z.infer<typeof requestReviewSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into human_review_requests (id, tenant_id, ai_run_id, assigned_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${input.runId}, ${input.assigneeMembershipId ?? null},
        ${JSON.stringify({ summary: input.summary, status: "pending" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ai.review_request', 'human_review_request', ${id}, 'Human review requested', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "pending" };
}

export const decideReviewSchema = z.object({
  decision: z.enum(["accepted", "rejected", "changes_requested"]),
  comment: z.string().trim().min(1).max(1000),
});

export async function decideHumanReview(access: Access, requestId_: string, input: z.infer<typeof decideReviewSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from human_review_requests where tenant_id = ${access.tenantId} and id = ${requestId_} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!existing) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (existing.attributes.status !== "pending") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The review request is already decided." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      update human_review_requests set attributes = attributes || '{"status":"decided"}'::jsonb
      where id = ${requestId_} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into human_review_decisions (id, tenant_id, human_review_request_id, reviewer_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${requestId_}, ${access.context.membershipId},
        ${JSON.stringify({ decision: input.decision, comment: input.comment })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ai.review_decide', 'human_review_request', ${requestId_}, ${`${input.decision}: ${input.comment}`}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, decision: input.decision };
}

// ---------------------------------------------------------------------------
// Governed agent actions
// ---------------------------------------------------------------------------

async function ensurePrincipal(access: Access, code: string): Promise<string> {
  const [roleRows] = await tenantTx(access, [
    sqlClient`select id from roles where tenant_id = ${access.tenantId} and code = 'employee' limit 1`,
  ]);
  const roleId = (roleRows as Array<{ id: string }>)[0]?.id;
  if (!roleId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No employee role exists for agent principals." });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from agent_principals where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into agent_principals (id, tenant_id, owner_membership_id, role_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.membershipId}, ${roleId}, ${JSON.stringify({ code, autonomy_ceiling: "dry-run" })}::jsonb)
    `,
  ]);
  return id;
}

async function ensureTool(tool: string): Promise<string> {
  if (!toolAllowed(tool)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Tool '${tool}' is not on the allowlist.` });
  }
  const rows = (await sqlClient`select id from agent_tools where attributes->>'code' = ${tool} limit 1`) as Array<{ id: string }>;
  const existing = rows[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await sqlClient`insert into agent_tools (id, attributes) values (${id}, ${JSON.stringify({ code: tool })}::jsonb)`;
  return id;
}

export const proposeActionSchema = z.object({
  principalCode: z.string().trim().min(1).max(40).default("hr-assistant"),
  tool: z.string().trim().min(1).max(80),
  effect: z.record(z.string(), z.unknown()),
  simulation: z.record(z.string(), z.unknown()).default({}),
});

export async function proposeAction(access: Access, input: z.infer<typeof proposeActionSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const principalId = await ensurePrincipal(access, input.principalCode);
  const toolId = await ensureTool(input.tool);
  const id = crypto.randomUUID();
  const simulationId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into agent_actions (id, tenant_id, agent_principal_id, agent_tool_id, human_principal_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${principalId}, ${toolId}, ${access.context.membershipId},
        ${JSON.stringify({ effect: input.effect, status: "proposed", autonomy_ceiling: "dry-run" })}::jsonb)
    `,
    sqlClient`
      insert into agent_action_simulations (id, tenant_id, agent_action_id, attributes)
      values (${simulationId}, ${access.tenantId}, ${id}, ${JSON.stringify({ diff: input.simulation, mutated: false })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ai.action_propose', 'agent_action', ${id}, 'Governed action proposed with dry-run simulation', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, simulationId, status: "proposed" };
}

export async function approveAction(access: Access, actionId: string, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, human_principal_membership_id, attributes from agent_actions where tenant_id = ${access.tenantId} and id = ${actionId} limit 1`,
  ]);
  const action = (rows as Array<{ id: string; human_principal_membership_id: string; attributes: { status: string } }>)[0];
  if (!action) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (action.attributes.status !== "proposed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Action is ${action.attributes.status}.` });
  }
  if (action.human_principal_membership_id === access.context.membershipId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Proposer and approver must differ for governed actions." });
  }
  await tenantTx(access, [
    sqlClient`
      update agent_actions set attributes = attributes || ${JSON.stringify({ status: "approved", approved_by: access.context.membershipId })}::jsonb
      where id = ${actionId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ai.action_approve', 'agent_action', ${actionId}, 'Governed action approved', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: actionId, status: "approved" };
}

export async function executeAction(access: Access, actionId: string, idempotencyKey: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from agent_actions where tenant_id = ${access.tenantId} and id = ${actionId} limit 1`,
  ]);
  const action = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!action) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // Idempotency before the status gate: a replay or key-conflict decision must
  // not depend on the (already advanced) lifecycle state.
  const [outcomeRows] = await tenantTx(access, [
    sqlClient`select id, attributes from agent_action_outcomes where tenant_id = ${access.tenantId} and agent_action_id = ${actionId} limit 1`,
  ]);
  const prior = (outcomeRows as Array<{ id: string; attributes: { idempotency_key: string } }>)[0];
  if (prior) {
    if (prior.attributes.idempotency_key !== idempotencyKey) {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This action already executed under a different key." });
    }
    return { actionId, outcomeId: prior.id, replayed: true };
  }
  if (action.attributes.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only approved actions can execute." });
  }
  const outcomeId = crypto.randomUUID();
  const [auditRows] = await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ai.action_execute', 'agent_action', ${actionId}, 'Governed action executed', ${uuidOrNull(requestId)}::uuid)
      returning id
    `,
  ]);
  const auditId = ((auditRows as Array<{ id: string }>)[0]?.id ?? "");
  await tenantTx(access, [
    sqlClient`update agent_actions set attributes = attributes || '{"status":"completed"}'::jsonb where id = ${actionId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into agent_action_outcomes (id, tenant_id, agent_action_id, audit_event_id, attributes)
      values (${outcomeId}, ${access.tenantId}, ${actionId}, ${auditId}, ${JSON.stringify({ idempotency_key: idempotencyKey, immutable: true })}::jsonb)
    `,
  ]);
  return { actionId, outcomeId, replayed: false };
}

export async function reverseAction(access: Access, actionId: string, reason: string, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  if (!reason.trim()) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A legal reversal reason is required." });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, agent_principal_id, agent_tool_id from agent_actions where tenant_id = ${access.tenantId} and id = ${actionId} limit 1`,
  ]);
  const original = (rows as Array<{ id: string; agent_principal_id: string; agent_tool_id: string }>)[0];
  if (!original) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const reversalActionId = crypto.randomUUID();
  const reversalId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into agent_actions (id, tenant_id, agent_principal_id, agent_tool_id, human_principal_membership_id, attributes)
      values (${reversalActionId}, ${access.tenantId}, ${original.agent_principal_id}, ${original.agent_tool_id}, ${access.context.membershipId},
        ${JSON.stringify({ status: "completed", kind: "legal-reversal", reverses: actionId })}::jsonb)
    `,
    sqlClient`
      insert into agent_action_reversals (id, tenant_id, approved_by_membership_id, original_agent_action_id, reversal_agent_action_id, attributes)
      values (${reversalId}, ${access.tenantId}, ${access.context.membershipId}, ${actionId}, ${reversalActionId},
        ${JSON.stringify({ reason })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ai.action_reverse', 'agent_action', ${actionId}, ${reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { actionId, reversalId, status: "reversed" };
}

export async function getAction(access: Access, actionId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from agent_actions where tenant_id = ${access.tenantId} and id = ${actionId} limit 1`,
  ]);
  const action = (rows as Array<{ id: string; attributes: unknown }>)[0];
  if (!action) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [simRows, outcomeRows] = await tenantTx(access, [
    sqlClient`select attributes from agent_action_simulations where tenant_id = ${access.tenantId} and agent_action_id = ${actionId}`,
    sqlClient`select attributes from agent_action_outcomes where tenant_id = ${access.tenantId} and agent_action_id = ${actionId}`,
  ]);
  return { action, simulations: simRows, outcomes: outcomeRows };
}
