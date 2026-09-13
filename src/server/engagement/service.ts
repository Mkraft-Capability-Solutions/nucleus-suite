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

export const publishAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  audience: z.string().trim().min(1).max(120).default("all"),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kind: z.enum(["birthday", "joiner", "star", "referral", "project", "management"]).default("management"),
});

export async function publishAnnouncement(access: Access, input: z.infer<typeof publishAnnouncementSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into feed_posts (id, tenant_id, attributes)
      values (${id}, ${access.tenantId},
        ${JSON.stringify({ title: input.title, body: input.body, audience: input.audience, expires_at: input.expiresAt ?? null, kind: input.kind, published_by: access.context.actorUserId })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'engage.announce', 'feed_post', ${id}, 'Announcement published', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export async function listAnnouncements(access: Access, audience: string | null) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const today = new Date().toISOString().slice(0, 10);
  const filter = audience;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, attributes, created_at from feed_posts where tenant_id = ${access.tenantId}
        and (attributes->>'expires_at' is null or attributes->>'expires_at' >= ${today})
        and (${filter}::text is null or attributes->>'audience' in (${audience ?? "all"}, 'all'))
      order by created_at desc limit 50
    `,
  ]);
  return rows;
}

async function ensureRecognitionProgram(access: Access, code = "STAR-MONTHLY"): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from recognition_programs where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into recognition_programs (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code, name: "Star of the month" })}::jsonb)`,
  ]);
  return id;
}

export const recognizeSchema = z.object({
  recipientEmployeeId: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
  points: z.number().int().min(0).max(10000).default(100),
});

export async function recognizeEmployee(access: Access, input: z.infer<typeof recognizeSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.recipientEmployeeId);
  const [memberRows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  const nominator = (memberRows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
  const programId = await ensureRecognitionProgram(access);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into recognition_events (id, tenant_id, nominator_employee_id, recipient_employee_id, recognition_program_id, attributes)
      values (${id}, ${access.tenantId}, ${nominator}, ${input.recipientEmployeeId}, ${programId},
        ${JSON.stringify({ message: input.message, points: input.points })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'engage.recognize', 'recognition_event', ${id}, 'Recognition recorded', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export const referCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function referCandidate(access: Access, input: z.infer<typeof referCandidateSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [memberRows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  const referrer = (memberRows as Array<{ employee_id: string | null }>)[0]?.employee_id;
  if (!referrer) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Referrals require a linked employee profile." });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into referrals (id, tenant_id, application_id, candidate_id, referrer_employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.applicationId ?? null}, ${input.candidateId}, ${referrer},
        ${JSON.stringify({ note: input.note ?? null, status: "referred" })}::jsonb)
    `,
  ]);
  return { id, status: "referred" };
}

export async function awardReferral(access: Access, referralId: string, tenureDays: number, requiredDays: number, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (tenureDays < requiredDays) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Tenure requirement for the referral award is unmet." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from referrals where tenant_id = ${access.tenantId} and id = ${referralId} limit 1`,
  ]);
  const referral = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!referral) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (referral.attributes.status !== "referred") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The referral award was already processed." });
  }
  const awardId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`update referrals set attributes = attributes || '{"status":"awarded"}'::jsonb where id = ${referralId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into referral_awards (id, tenant_id, referral_id, attributes)
      values (${awardId}, ${access.tenantId}, ${referralId},
        ${JSON.stringify({ tenure_days: tenureDays, required_days: requiredDays, status: "payable" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'engage.referral_award', 'referral_award', ${awardId}, 'Referral award reconciled on tenure', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { awardId, status: "payable" };
}

export const createSurveySchema = z.object({
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  questions: z.array(z.object({ key: z.string().min(1).max(40), text: z.string().min(1).max(500), scale: z.number().int().min(2).max(10).default(5) })).min(1).max(30),
});

export async function createSurvey(access: Access, input: z.infer<typeof createSurveySchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into surveys (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code: input.code, title: input.title, questions: input.questions })}::jsonb)
    `,
  ]);
  return { id };
}

export async function startSurveyRun(access: Access, surveyId: string, audience: string | null) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into survey_runs (id, tenant_id, survey_id, attributes)
      values (${id}, ${access.tenantId}, ${surveyId}, ${JSON.stringify({ audience: audience ?? "all", status: "open" })}::jsonb)
    `,
  ]);
  return { id, status: "open" };
}

export const answerSurveySchema = z.object({
  runId: z.string().uuid(),
  answers: z.record(z.string(), z.number().int().min(1).max(10)).refine((value) => Object.keys(value).length > 0, "At least one answer is required."),
  anonymous: z.boolean().default(true),
});

export async function answerSurvey(access: Access, input: z.infer<typeof answerSurveySchema>) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [memberRows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  const employeeId = (memberRows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into survey_responses (id, tenant_id, employee_id, survey_run_id, attributes)
      values (${id}, ${access.tenantId}, ${input.anonymous ? null : employeeId}, ${input.runId},
        ${JSON.stringify({ answers: input.answers, anonymous: input.anonymous })}::jsonb)
    `,
  ]);
  return { id };
}

export async function surveyResults(access: Access, runId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes from survey_responses where tenant_id = ${access.tenantId} and survey_run_id = ${runId}`,
  ]);
  const responses = rows as Array<{ attributes: { answers: Record<string, number> } }>;
  if (responses.length < MIN_ANONYMITY_COHORT) {
    return { runId, suppressed: true, respondents: responses.length, threshold: MIN_ANONYMITY_COHORT, means: null };
  }
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const response of responses) {
    for (const [key, value] of Object.entries(response.attributes.answers)) {
      sums[key] = (sums[key] ?? 0) + value;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const means: Record<string, number> = {};
  for (const key of Object.keys(sums)) means[key] = Math.round((sums[key]! / counts[key]!) * 100) / 100;
  return { runId, suppressed: false, respondents: responses.length, threshold: MIN_ANONYMITY_COHORT, means };
}
