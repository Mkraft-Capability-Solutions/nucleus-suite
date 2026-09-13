import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const MIN_ANONYMITY_COHORT = 5;

async function assertEmployee(access: Access, employeeId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
}

export const createCycleSchema = z.object({
  code: z.string().trim().min(1).max(40).default("FY26-H2"),
  name: z.string().trim().min(1).max(120).default("FY26 H2 review cycle"),
});

export async function ensureReviewCycle(access: Access, code: string, name: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from review_cycles where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into review_cycles (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code, name, status: "open" })}::jsonb)`,
  ]);
  return id;
}

export async function createReviewCycle(access: Access, input: z.infer<typeof createCycleSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = await ensureReviewCycle(access, input.code, input.name);
  await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'perf.cycle_ensure', 'review_cycle', ${id}, 'Review cycle ensured', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, code: input.code };
}

async function ensureGoalCycle(access: Access, code = "FY26"): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from goal_cycles where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into goal_cycles (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code })}::jsonb)`,
  ]);
  return id;
}

export const createObjectiveSchema = z.object({
  title: z.string().trim().min(1).max(200),
  ownerEmployeeId: z.string().uuid(),
  parentObjectiveId: z.string().uuid().optional(),
});

export async function createObjective(access: Access, input: z.infer<typeof createObjectiveSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.ownerEmployeeId);
  const cycleId = await ensureGoalCycle(access);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into objectives (id, tenant_id, goal_cycle_id, owner_employee_id, parent_objective_id, attributes)
      values (${id}, ${access.tenantId}, ${cycleId}, ${input.ownerEmployeeId}, ${input.parentObjectiveId ?? null},
        ${JSON.stringify({ title: input.title, status: "active", progress_pct: 0 })}::jsonb)
    `,
  ]);
  return { id };
}

export const createKeyResultSchema = z.object({
  objectiveId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  target: z.number().positive(),
  unit: z.string().trim().min(1).max(20).default("pct"),
});

export async function createKeyResult(access: Access, input: z.infer<typeof createKeyResultSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into key_results (id, tenant_id, objective_id, attributes)
      values (${id}, ${access.tenantId}, ${input.objectiveId},
        ${JSON.stringify({ title: input.title, target: input.target, unit: input.unit, current: 0 })}::jsonb)
    `,
  ]);
  return { id };
}

export const createCheckinSchema = z.object({
  employeeId: z.string().uuid(),
  objectiveId: z.string().uuid().optional(),
  keyResultId: z.string().uuid().optional(),
  notes: z.string().trim().min(1).max(2000),
  progressPct: z.number().min(0).max(100).optional(),
});

export async function createCheckin(access: Access, input: z.infer<typeof createCheckinSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.employeeId);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into checkins (id, tenant_id, employee_id, key_result_id, objective_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.keyResultId ?? null}, ${input.objectiveId ?? null},
        ${JSON.stringify({ notes: input.notes, progress_pct: input.progressPct ?? null })}::jsonb)
    `,
  ]);
  if (input.keyResultId && input.progressPct !== undefined) {
    await tenantTx(access, [
      sqlClient`update key_results set attributes = attributes || ${JSON.stringify({ current: input.progressPct })}::jsonb where id = ${input.keyResultId} and tenant_id = ${access.tenantId}`,
    ]);
  }
  return { id };
}

export const requestFeedbackSchema = z.object({
  subjectEmployeeId: z.string().uuid(),
  providerEmployeeId: z.string().uuid().optional(),
  reviewCycleCode: z.string().trim().min(1).max(40).default("FY26-H2"),
  prompt: z.string().trim().min(1).max(1000).default("Share strengths and one growth area."),
});

export async function requestFeedback(access: Access, input: z.infer<typeof requestFeedbackSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.subjectEmployeeId);
  const cycleId = await ensureReviewCycle(access, input.reviewCycleCode, input.reviewCycleCode);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into feedback_requests (id, tenant_id, requester_employee_id, review_cycle_id, subject_employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.subjectEmployeeId}, ${cycleId}, ${input.subjectEmployeeId},
        ${JSON.stringify({ prompt: input.prompt, provider_employee_id: input.providerEmployeeId ?? null, status: "pending" })}::jsonb)
    `,
  ]);
  return { id };
}

export const submitFeedbackSchema = z.object({
  requestId: z.string().uuid(),
  authorEmployeeId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function submitFeedback(access: Access, input: z.infer<typeof submitFeedbackSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into feedback_entries (id, tenant_id, author_employee_id, feedback_request_id, subject_employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.authorEmployeeId}, ${input.requestId},
        (select subject_employee_id from feedback_requests where id = ${input.requestId} and tenant_id = ${access.tenantId}),
        ${JSON.stringify({ body: input.body, rating: input.rating ?? null })}::jsonb)
    `,
  ]);
  return { id };
}

export async function listFeedback(access: Access, subjectEmployeeId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, author_employee_id, attributes, created_at from feedback_entries where tenant_id = ${access.tenantId} and subject_employee_id = ${subjectEmployeeId} order by created_at`,
  ]);
  const entries = rows as Array<{ id: string; author_employee_id: string; attributes: { body: string; rating: number | null }; created_at: string }>;
  const anonymous = entries.length < MIN_ANONYMITY_COHORT;
  return {
    subjectEmployeeId,
    anonymous,
    entries: entries.map((entry) => ({
      id: entry.id,
      author: anonymous ? null : entry.author_employee_id,
      body: entry.attributes.body,
      rating: entry.attributes.rating,
      createdAt: entry.created_at,
    })),
  };
}

export const createCalibrationSchema = z.object({
  reviewCycleCode: z.string().trim().min(1).max(40).default("FY26-H2"),
  departmentName: z.string().trim().min(1).max(80).optional(),
});

export async function createCalibrationSession(access: Access, input: z.infer<typeof createCalibrationSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const cycleId = await ensureReviewCycle(access, input.reviewCycleCode, input.reviewCycleCode);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into calibration_sessions (id, tenant_id, facilitator_membership_id, review_cycle_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.membershipId}, ${cycleId},
        ${JSON.stringify({ department: input.departmentName ?? null, status: "open", adjustments: [] })}::jsonb)
    `,
  ]);
  return { id };
}

export const calibrationAdjustSchema = z.object({
  employeeId: z.string().uuid(),
  from: z.string().trim().min(1).max(40),
  to: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(1).max(500),
});

export async function recordCalibrationAdjustment(access: Access, sessionId: string, input: z.infer<typeof calibrationAdjustSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.employeeId);
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from calibration_sessions where tenant_id = ${access.tenantId} and id = ${sessionId} limit 1`,
  ]);
  const session = (rows as Array<{ id: string; attributes: { status: string; adjustments: unknown[] } }>)[0];
  if (!session) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (session.attributes.status !== "open") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The calibration session is closed." });
  }
  const adjustment = { ...input, by: access.context.actorUserId, at: new Date().toISOString() };
  await tenantTx(access, [
    sqlClient`
      update calibration_sessions
      set attributes = jsonb_set(attributes, '{adjustments}', (attributes->'adjustments') || ${JSON.stringify(adjustment)}::jsonb)
      where id = ${sessionId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'perf.calibrate', 'calibration_session', ${sessionId}, ${input.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { sessionId, adjustments: session.attributes.adjustments.length + 1 };
}

export const createSuccessionSchema = z.object({
  positionCode: z.string().trim().min(1).max(40).default("SPN-OP-03"),
  candidates: z.array(z.object({
    employeeId: z.string().uuid(),
    readiness: z.enum(["ready-now", "ready-1-2y", "ready-3y-plus"]),
    gaps: z.array(z.string().trim().min(1).max(120)).default([]),
  })).min(1).max(10),
});

export async function createSuccessionPlan(access: Access, input: z.infer<typeof createSuccessionSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  for (const candidate of input.candidates) await assertEmployee(access, candidate.employeeId);
  const [positionRows] = await tenantTx(access, [
    sqlClient`select id from positions where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.positionCode} limit 1`,
  ]);
  const positionId = (positionRows as Array<{ id: string }>)[0]?.id;
  if (!positionId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The succession position does not exist yet." });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into succession_plans (id, tenant_id, position_id, attributes)
      values (${id}, ${access.tenantId}, ${positionId}, ${JSON.stringify({ position_code: input.positionCode, candidates: input.candidates })}::jsonb)
    `,
  ]);
  return { id, candidates: input.candidates.length };
}
