import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const createInterviewPlanSchema = z.object({
  requisitionId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  /** The rounds this plan runs, from the workbook's round vocabulary. */
  rounds: z.array(z.enum(picklistValues("PL_INTERVIEW_ROUND"))).min(1).max(10),
  /** The competency set every card for this plan must rate in full (TAL-03 competency_rating[]). */
  rubric: z.array(z.string().trim().min(1).max(80)).min(1).max(20).default(["skills", "attitude", "communication"]),
});

export async function createInterviewPlan(access: Access, input: z.infer<typeof createInterviewPlanSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const scorecardId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into scorecards (id, tenant_id, requisition_id, attributes)
      values (${scorecardId}, ${access.tenantId}, ${input.requisitionId},
        ${JSON.stringify({ title: `${input.title} scorecard`, rubric: input.rubric })}::jsonb)
    `,
  ]);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into interview_plans (id, tenant_id, requisition_id, scorecard_id, attributes)
      values (${id}, ${access.tenantId}, ${input.requisitionId}, ${scorecardId},
        ${JSON.stringify({ title: input.title, rounds: input.rounds, status: "active" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.interview_plan', 'interview_plan', ${id}, 'Interview plan created', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, scorecardId };
}

/**
 * TAL-03 schedule half. The candidate and requisition the form shows read-only come from
 * `applicationId`, which owns both, so neither is accepted again here.
 */
export const scheduleSessionSchema = z.object({
  applicationId: z.string().uuid(),
  planId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(1).max(600),
  panelMembershipIds: z.array(z.string().uuid()).min(1).max(10),
  round: z.enum(picklistValues("PL_INTERVIEW_ROUND")),
  mode: z.enum(picklistValues("PL_INTERVIEW_MODE")).default("in_person"),
});

export async function scheduleSession(access: Access, input: z.infer<typeof scheduleSessionSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into interview_sessions (id, tenant_id, application_id, interview_plan_id, attributes)
      values (${id}, ${access.tenantId}, ${input.applicationId}, ${input.planId},
        ${JSON.stringify({
          scheduled_at: input.scheduledAt,
          duration_minutes: input.durationMinutes,
          round: input.round,
          mode: input.mode,
          status: "scheduled",
          debriefed: false,
        })}::jsonb)
    `,
    ...input.panelMembershipIds.map((membershipId) => sqlClient`
      insert into interview_panel_members (tenant_id, interview_session_id, membership_id, attributes)
      values (${access.tenantId}, ${id}, ${membershipId}, '{"invited":true}'::jsonb)
    `),
  ]);
  return { id, panel: input.panelMembershipIds.length };
}

/**
 * TAL-03 feedback half. `submitted_on` is the record's own `created_at`, and the lock the
 * workbook asks for is the one-card-per-panel-member conflict `submitScore` already raises.
 */
export const submitScoreSchema = z.object({
  sessionId: z.string().uuid(),
  /** The workbook's repeating competency table: competency, rating 1-5, remark. */
  competencyRatings: z.array(z.object({
    competency: z.string().trim().min(1).max(80),
    rating: z.number().int().min(1).max(5),
    remark: z.string().trim().max(500).optional(),
  })).min(1).max(20),
  overallRating: z.enum(picklistValues("PL_INTERVIEW_VERDICT")),
  strengths: z.string().trim().min(30).max(500),
  concerns: z.string().trim().min(30).max(500),
  recommendedBand: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  for (const entry of value.competencyRatings) {
    if (seen.has(entry.competency)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["competencyRatings"], message: `Competency "${entry.competency}" is rated twice.` });
    }
    seen.add(entry.competency);
  }
});

export async function submitScore(access: Access, input: z.infer<typeof submitScoreSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [memberRows] = await tenantTx(access, [
    sqlClient`select id from interview_panel_members where tenant_id = ${access.tenantId} and interview_session_id = ${input.sessionId} and membership_id = ${access.context.membershipId} limit 1`,
  ]);
  const panel = (memberRows as Array<{ id: string }>)[0];
  if (!panel) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Only seated panel members score this session." });
  const [sessionRows] = await tenantTx(access, [
    sqlClient`
      select s.id, s.attributes as session_attributes, p.attributes as plan_attributes, p.scorecard_id,
             c.attributes as scorecard_attributes
      from interview_sessions s
      join interview_plans p on p.id = s.interview_plan_id
      left join scorecards c on c.tenant_id = s.tenant_id and c.id = p.scorecard_id
      where s.tenant_id = ${access.tenantId} and s.id = ${input.sessionId} limit 1
    `,
  ]);
  const session = (sessionRows as Array<{
    id: string; session_attributes: { debriefed: boolean }; plan_attributes: { status: string };
    scorecard_id: string; scorecard_attributes: { rubric?: unknown } | null;
  }>)[0];
  if (!session) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // TAL-03 requires every competency to be rated. The plan's scorecard holds that set, so a
  // card that skips one is incomplete feedback rather than a partial opinion worth filing.
  const rubric = Array.isArray(session.scorecard_attributes?.rubric)
    ? (session.scorecard_attributes.rubric as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : [];
  const rated = new Set(input.competencyRatings.map((entry) => entry.competency));
  const unrated = rubric.filter((competency) => !rated.has(competency));
  if (unrated.length > 0) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: "Every competency on the scorecard must be rated before the card is filed.",
      details: unrated.map((competency) => ({ field: "competencyRatings", issue: `${competency} is unrated.` })),
    });
  }
  const [dupRows] = await tenantTx(access, [
    sqlClient`select id from interview_scores where tenant_id = ${access.tenantId} and interview_session_id = ${input.sessionId} and panel_member_id = ${panel.id} limit 1`,
  ]);
  if ((dupRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This panel member already scored the session." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into interview_scores (id, tenant_id, interview_session_id, panel_member_id, scorecard_id, attributes)
      values (${id}, ${access.tenantId}, ${input.sessionId}, ${panel.id}, ${session.scorecard_id},
        ${JSON.stringify({
          competency_ratings: input.competencyRatings,
          overall_rating: input.overallRating,
          strengths: input.strengths,
          concerns: input.concerns,
          recommended_band: input.recommendedBand ?? null,
          notes: input.notes ?? null,
          sealed: !(session.session_attributes.debriefed ?? false),
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.interview_score', 'interview_session', ${input.sessionId}, 'Sealed scorecard submitted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, sealed: !(session.session_attributes.debriefed ?? false) };
}

export async function debriefSession(access: Access, sessionId: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from interview_sessions where tenant_id = ${access.tenantId} and id = ${sessionId} limit 1`,
  ]);
  const session = (rows as Array<{ id: string; attributes: { debriefed: boolean } }>)[0];
  if (!session) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await tenantTx(access, [
    sqlClient`update interview_sessions set attributes = attributes || '{"debriefed":true,"status":"debriefed"}'::jsonb where id = ${sessionId} and tenant_id = ${access.tenantId}`,
    sqlClient`update interview_scores set attributes = attributes || '{"sealed":false}'::jsonb where interview_session_id = ${sessionId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.interview_debrief', 'interview_session', ${sessionId}, 'Scorecards unsealed at debrief', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: sessionId, debriefed: true };
}

export async function sessionScores(access: Access, sessionId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [sessionRows] = await tenantTx(access, [
    sqlClient`select attributes from interview_sessions where tenant_id = ${access.tenantId} and id = ${sessionId} limit 1`,
  ]);
  const session = (sessionRows as Array<{ attributes: { debriefed: boolean } }>)[0];
  if (!session) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [memberRows] = await tenantTx(access, [
    sqlClient`select id from interview_panel_members where tenant_id = ${access.tenantId} and interview_session_id = ${sessionId} and membership_id = ${access.context.membershipId} limit 1`,
  ]);
  const mine = (memberRows as Array<{ id: string }>)[0]?.id;
  const [scoreRows] = await tenantTx(access, [
    sqlClient`select panel_member_id, attributes from interview_scores where tenant_id = ${access.tenantId} and interview_session_id = ${sessionId}`,
  ]);
  const scores = scoreRows as Array<{
    panel_member_id: string;
    attributes: { competency_ratings: Array<{ competency: string; rating: number; remark?: string }>; overall_rating: string };
  }>;
  if (session.attributes.debriefed) return { debriefed: true, scores };
  // Sealed: each panel member sees only their own card plus the count.
  return { debriefed: false, scores: scores.filter((score) => score.panel_member_id === mine), totalCards: scores.length };
}

export const createPostingSchema = z.object({
  jobDescriptionId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  channels: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  opensOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closesOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((value, context) => {
  if (value.closesOn < value.opensOn) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "The posting window closes before it opens." });
  }
});

export async function createPosting(access: Access, input: z.infer<typeof createPostingSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (input.closesOn < input.opensOn) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The posting window closes before it opens." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into job_postings (id, tenant_id, job_description_id, requisition_id, attributes)
      values (${id}, ${access.tenantId}, ${input.jobDescriptionId}, ${input.requisitionId},
        ${JSON.stringify({ channels: input.channels, opens_on: input.opensOn, closes_on: input.closesOn, status: "open" })}::jsonb)
    `,
  ]);
  return { id, status: "open" };
}

export async function listPostings(access: Access, requisitionId: string | null) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const filter = requisitionId;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, job_description_id, requisition_id, attributes, created_at from job_postings where tenant_id = ${access.tenantId}
        and (${filter}::uuid is null or requisition_id = ${requisitionId})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}
