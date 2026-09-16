import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues, type PicklistValue } from "@/lib/picklists";
import { proposeCompensation } from "@/server/compensation/service";
import { addDays, addMonths } from "@/server/leave/scheme";
import { issueLetter } from "@/server/letters/service";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { confirmEmployment, ensureEmployment } from "./service";

/**
 * FRM-LCY-02 Confirmation — the form around the R-24 transition.
 *
 * The manager records a recommendation, a rating and an assessment; HR decides
 * it, supplying the effective date and the two toggles the workbook gives HR.
 * Approval then routes on the recommendation: a confirmation runs the gated
 * transition in `service.ts`, an extension moves the probation end date, and a
 * termination is recorded and handed to the exit form, because the workbook
 * puts the last working day and notice on FRM-LCY-03, not here.
 *
 * The review is a `lifecycle_events` row (envelope attributes, no migration);
 * `approval_status` is PL_APPROVAL_STATUS and is derived from the chain.
 */

export const REVIEW_KIND = "confirmation_review";
export const CONFIRMATION_ASSESSMENT_MIN_LENGTH = 50;
export const EXTENSION_REASON_MIN_LENGTH = 30;
/** The workbook's stated default for `extension_months`. */
export const DEFAULT_EXTENSION_MONTHS = 3;

export type ConfirmationAction = PicklistValue<"PL_CONFIRMATION_ACTION">;
export type ApprovalStatus = PicklistValue<"PL_APPROVAL_STATUS">;

/** FRM-LCY-02 Manager section. `person_id` / `confirmation_due` are read from the assignment, never posted. */
export const submitConfirmationReviewSchema = z
  .object({
    employeeId: z.string().uuid(),
    recommendation: z.enum(picklistValues("PL_CONFIRMATION_ACTION")),
    probationRating: z.enum(picklistValues("PL_RATING_SCALE")),
    assessment: z.string().trim().min(CONFIRMATION_ASSESSMENT_MIN_LENGTH).max(1000),
    /** 1-6, default 3; only read when extending. */
    extensionMonths: z.number().int().min(1).max(6).default(DEFAULT_EXTENSION_MONTHS),
    extensionReason: z.string().trim().min(EXTENSION_REASON_MIN_LENGTH).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.recommendation === "extend_probation" && !value.extensionReason) {
      ctx.addIssue({ code: "custom", path: ["extensionReason"], message: `Extending probation needs a reason of at least ${EXTENSION_REASON_MIN_LENGTH} characters.` });
    }
  });

export type SubmitConfirmationReviewInput = z.infer<typeof submitConfirmationReviewSchema>;

const salaryRevisionSchema = z.object({
  cycleId: z.string().uuid().optional(),
  /** FRM-PAY-02's revised basic; the confirmation form itself states no figure. */
  newBasicMinor: z.number().int().positive(),
  justification: z.string().trim().min(10).max(300).optional(),
});

/** FRM-LCY-02 HR section plus the approval decision (PL_DECISION). */
export const decideConfirmationReviewSchema = z
  .object({
    decision: z.enum(picklistValues("PL_DECISION")),
    remarks: z.string().trim().min(1).max(500).optional(),
    /** Defaults to probation end plus one day when the record carries a probation end. */
    confirmationEffectiveDate: z.iso.date().optional(),
    /** "Backdating needs a reason": required when the effective date is before today. */
    backdatingReason: z.string().trim().min(1).max(300).optional(),
    reviseSalary: z.boolean().default(false),
    salaryRevision: salaryRevisionSchema.optional(),
    issueLetter: z.boolean().default(true),
    /** A specific confirmation template; otherwise the tenant's latest one. */
    letterTemplateId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision !== "approve" && !value.remarks) {
      ctx.addIssue({ code: "custom", path: ["remarks"], message: "A reason is required on anything but an approval." });
    }
    if (value.reviseSalary && !value.salaryRevision) {
      ctx.addIssue({ code: "custom", path: ["salaryRevision"], message: "A salary revision on confirmation needs the revised basic (FRM-PAY-02)." });
    }
  });

export type DecideConfirmationReviewInput = z.infer<typeof decideConfirmationReviewSchema>;

/** The approval status each decision leaves on the review. A delegated decision is still pending. */
export const REVIEW_DECISION_STATUS: Record<PicklistValue<"PL_DECISION">, ApprovalStatus> = {
  approve: "approved",
  reject: "rejected",
  return_for_correction: "draft",
  delegate: "pending_approval",
};

/**
 * The probation end the form shows read-only: the recorded date, or joining
 * plus the recorded months. Null when the employment states neither — the
 * workbook takes it "from the assignment" and this app has no other source.
 */
export function probationEndOf(input: { probationEndDate: unknown; probationMonths: unknown; joiningDate: string | null }): string | null {
  if (typeof input.probationEndDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.probationEndDate)) return input.probationEndDate;
  const months = typeof input.probationMonths === "number" ? input.probationMonths : Number(input.probationMonths);
  if (input.joiningDate && Number.isFinite(months) && months > 0) return addMonths(input.joiningDate, months);
  return null;
}

/** Why an effective date cannot stand, or null when it can. */
export function effectiveDateRefusal(input: { effectiveDate: string; today: string; joiningDate: string | null; backdatingReason: string | null }): string | null {
  if (input.joiningDate && input.effectiveDate < input.joiningDate) return `Confirmation cannot precede the joining date (${input.joiningDate}).`;
  if (input.effectiveDate < input.today && !input.backdatingReason) return "A backdated confirmation needs a reason.";
  return null;
}

type EmploymentRow = { id: string; attributes: Record<string, unknown>; joining_date: string | null };

/** The employment in force. Reads never create one; a submission bootstraps it first. */
async function latestEmployment(access: Access, employeeId: string): Promise<EmploymentRow | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select em.id, em.attributes, e.joining_date::text as joining_date
      from employments em
      join employees e on e.tenant_id = em.tenant_id and e.id = em.employee_id
      where em.tenant_id = ${access.tenantId} and em.employee_id = ${employeeId}
      order by em.created_at desc limit 1
    `,
  ]);
  return (rows as EmploymentRow[])[0] ?? null;
}

async function requireEmployment(access: Access, employeeId: string): Promise<EmploymentRow> {
  const row = await latestEmployment(access, employeeId);
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This employee has no employment record." });
  return row;
}

type ReviewRow = { id: string; employee_id: string; attributes: Record<string, unknown>; created_at: string };

async function reviewsFor(access: Access, employeeId: string): Promise<ReviewRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_id, attributes, created_at::text as created_at from lifecycle_events
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attributes->>'kind' = ${REVIEW_KIND}
      order by created_at desc limit 50
    `,
  ]);
  return rows as ReviewRow[];
}

export type ConfirmationContext = {
  employeeId: string;
  employmentId: string | null;
  employmentStatus: string | null;
  joiningDate: string | null;
  probationMonths: number | null;
  /** FRM-LCY-02 `confirmation_due`; null when the employment records neither a date nor months. */
  probationEndDate: string | null;
  confirmationDate: string | null;
  extensions: unknown[];
  reviews: Array<{ id: string; createdAt: string } & Record<string, unknown>>;
};

export async function confirmationContext(access: Access, employeeId: string): Promise<ConfirmationContext> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employment = await latestEmployment(access, employeeId);
  const reviews = await reviewsFor(access, employeeId);
  const attributes = employment?.attributes ?? {};
  const months = Number(attributes.probationMonths);
  return {
    employeeId,
    employmentId: employment?.id ?? null,
    employmentStatus: typeof attributes.status === "string" ? attributes.status : null,
    joiningDate: employment?.joining_date ?? null,
    probationMonths: Number.isFinite(months) && months > 0 ? months : null,
    probationEndDate: employment ? probationEndOf({ probationEndDate: attributes.probationEndDate, probationMonths: attributes.probationMonths, joiningDate: employment.joining_date }) : null,
    confirmationDate: typeof attributes.confirmationDate === "string" ? attributes.confirmationDate : null,
    extensions: Array.isArray(attributes.probationExtensions) ? attributes.probationExtensions : [],
    reviews: reviews.map((row) => ({ ...row.attributes, id: row.id, createdAt: row.created_at })),
  };
}

export async function submitConfirmationReview(access: Access, input: SubmitConfirmationReviewInput, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await ensureEmployment(access, input.employeeId);
  const employment = await requireEmployment(access, input.employeeId);
  if (employment.attributes.confirmationDate || employment.attributes.status === "confirmed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This employment is already confirmed." });
  }
  const open = (await reviewsFor(access, input.employeeId)).find((row) => row.attributes.approval_status === "pending_approval");
  if (open) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "A confirmation review is already awaiting a decision for this employee." });
  }
  const extending = input.recommendation === "extend_probation";
  const id = crypto.randomUUID();
  const attributes = {
    kind: REVIEW_KIND,
    employment_id: employment.id,
    probation_end_at_review: probationEndOf({ probationEndDate: employment.attributes.probationEndDate, probationMonths: employment.attributes.probationMonths, joiningDate: employment.joining_date }),
    recommendation: input.recommendation,
    probation_rating: input.probationRating,
    assessment: input.assessment,
    extension_months: extending ? input.extensionMonths : null,
    extension_reason: extending ? input.extensionReason ?? null : null,
    confirmation_effective_date: null,
    revise_salary: null,
    issue_letter: null,
    approval_status: "pending_approval" as ApprovalStatus,
    submitted_by: access.context.actorUserId,
    approver_id: null,
    decision: null,
    decision_remarks: null,
    outcome: null,
  };
  await tenantTx(access, [
    sqlClient`
      insert into lifecycle_events (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${JSON.stringify(attributes)}::jsonb)
    `,
    sqlClient`
      update employments set attributes = attributes || ${JSON.stringify({ confirmationReviewId: id })}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${employment.id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.confirmation_review', 'lifecycle_event', ${id}, ${`Probation review: ${input.recommendation}`},
        ${JSON.stringify({ recommendation: input.recommendation, probationRating: input.probationRating })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, employeeId: input.employeeId, approvalStatus: attributes.approval_status, recommendation: input.recommendation };
}

async function loadReview(access: Access, reviewId: string): Promise<ReviewRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes, created_at::text as created_at from lifecycle_events
      where tenant_id = ${access.tenantId} and id = ${reviewId} and attributes->>'kind' = ${REVIEW_KIND} limit 1`,
  ]);
  const row = (rows as ReviewRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

/** The confirmation letter template the tenant has published, or a named refusal — no body is invented. */
async function confirmationTemplateId(access: Access, preferred: string | undefined): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id from letter_templates
      where tenant_id = ${access.tenantId} and attributes->>'letter_type' = 'confirmation'
        and (${preferred ?? null}::uuid is null or id = ${preferred ?? null}::uuid)
      order by updated_at desc limit 1
    `,
  ]);
  const id = (rows as Array<{ id: string }>)[0]?.id;
  if (!id) {
    throw new HttpError({
      status: 422,
      code: "LETTER_TEMPLATE_MISSING",
      message: "No confirmation letter template exists, so the letter cannot be issued. Save one with letter type Confirmation, or switch the letter off on this decision.",
      details: [{ field: "issueLetter", issue: "letter_templates has no row with letter_type = confirmation." }],
    });
  }
  return id;
}

/** The compensation cycle the proposal is filed in: the one named, else the latest still budgeting. */
async function compensationCycleId(access: Access, preferred: string | undefined): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id from compensation_cycles
      where tenant_id = ${access.tenantId}
        and (${preferred ?? null}::uuid is null or id = ${preferred ?? null}::uuid)
        and (${preferred ?? null}::uuid is not null or coalesce(attributes->>'status', '') = 'budgeted')
      order by created_at desc limit 1
    `,
  ]);
  const id = (rows as Array<{ id: string }>)[0]?.id;
  if (!id) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "No open compensation cycle exists to file the salary revision in. Create one, or switch the revision off on this decision.",
      details: [{ field: "salaryRevision.cycleId", issue: "compensation_cycles has no budgeted row." }],
    });
  }
  return id;
}

type ConfirmOutcome = {
  kind: "confirmed";
  confirmationDate: string;
  compensationProposalId: string | null;
  letterId: string | null;
  letterReference: string | null;
};
type ExtendOutcome = { kind: "extended"; previousProbationEnd: string; probationEndDate: string; months: number };
type TerminateOutcome = { kind: "termination_recommended"; nextStep: string };
export type ReviewOutcome = ConfirmOutcome | ExtendOutcome | TerminateOutcome;

async function applyConfirmation(
  access: Access,
  review: ReviewRow,
  employment: EmploymentRow,
  input: DecideConfirmationReviewInput,
  requestId: string,
): Promise<ConfirmOutcome> {
  const probationEnd = probationEndOf({ probationEndDate: employment.attributes.probationEndDate, probationMonths: employment.attributes.probationMonths, joiningDate: employment.joining_date });
  const effectiveDate = input.confirmationEffectiveDate ?? (probationEnd ? addDays(probationEnd, 1) : null);
  if (!effectiveDate) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "The employment records no probation end, so the effective date cannot default to probation end plus one day. State it on the decision.",
      details: [{ field: "confirmationEffectiveDate", issue: "Required when the employment has no probation end date or months." }],
    });
  }
  const today = new Date().toISOString().slice(0, 10);
  const refusal = effectiveDateRefusal({ effectiveDate, today, joiningDate: employment.joining_date, backdatingReason: input.backdatingReason ?? null });
  if (refusal) throw new HttpError({ status: 422, code: "INVALID_DATES", message: refusal, details: [{ field: "confirmationEffectiveDate", issue: refusal }] });

  // Everything the outcome depends on is resolved before the transition runs, so a
  // missing template or cycle refuses the whole decision instead of half-applying it.
  const templateId = input.issueLetter ? await confirmationTemplateId(access, input.letterTemplateId) : null;
  const cycleId = input.reviseSalary ? await compensationCycleId(access, input.salaryRevision?.cycleId) : null;

  const assessment = String(review.attributes.assessment ?? "");
  await confirmEmployment(access, { employeeId: review.employee_id, confirmationDate: effectiveDate, reason: assessment }, requestId);
  // Letters merge `confirmation_date` and referral maturity reads it from here: the
  // workbook's "triggers referral award maturity and benefit eligibility" is this write.
  await tenantTx(access, [
    sqlClient`
      update employees set metadata = metadata || ${JSON.stringify({ confirmation_date: effectiveDate })}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${review.employee_id}
    `,
  ]);

  let compensationProposalId: string | null = null;
  if (cycleId && input.salaryRevision) {
    const proposal = await proposeCompensation(
      access,
      {
        cycleId,
        employeeId: review.employee_id,
        newBasicMinor: input.salaryRevision.newBasicMinor,
        effectiveDate,
        justification: input.salaryRevision.justification ?? `Salary revision on confirmation effective ${effectiveDate}`,
        revisionType: "confirmation",
        issueLetter: true,
      },
      requestId,
    );
    compensationProposalId = proposal.id;
  }

  let letterId: string | null = null;
  let letterReference: string | null = null;
  if (templateId) {
    const letter = await issueLetter(
      access,
      {
        letterType: "confirmation",
        templateId,
        employeeId: review.employee_id,
        effectiveDate,
        approver: access.context.actorUserId,
        deliveryChannels: ["email", "employee_portal"],
        acknowledgementRequired: true,
        reason: `Confirmation letter issued on confirmation effective ${effectiveDate}`,
      },
      requestId,
    );
    letterId = letter.id;
    letterReference = letter.reference;
  }
  return { kind: "confirmed", confirmationDate: effectiveDate, compensationProposalId, letterId, letterReference };
}

async function applyExtension(access: Access, review: ReviewRow, employment: EmploymentRow, requestId: string): Promise<ExtendOutcome> {
  const previous = probationEndOf({ probationEndDate: employment.attributes.probationEndDate, probationMonths: employment.attributes.probationMonths, joiningDate: employment.joining_date });
  if (!previous) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "The employment records no probation end, so there is no confirmation due date to extend. Record the probation end or months on the employment first.",
      details: [{ field: "extensionMonths", issue: "No probation end date or months on the employment record." }],
    });
  }
  const months = Number(review.attributes.extension_months ?? DEFAULT_EXTENSION_MONTHS);
  const next = addMonths(previous, months);
  const extension = { from: previous, to: next, months, reason: review.attributes.extension_reason ?? null, review_id: review.id, decided_by: access.context.actorUserId };
  const prior = Array.isArray(employment.attributes.probationExtensions) ? employment.attributes.probationExtensions : [];
  await tenantTx(access, [
    sqlClient`
      update employments set attributes = attributes || ${JSON.stringify({ probationEndDate: next, probationExtensions: [...prior, extension] })}::jsonb,
        version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${employment.id}
    `,
    sqlClient`
      insert into lifecycle_events (id, tenant_id, employee_id, attributes)
      values (${crypto.randomUUID()}, ${access.tenantId}, ${review.employee_id},
        ${JSON.stringify({ kind: "probation_extension", ...extension })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.probation_extend', 'employment', ${employment.id}, ${String(review.attributes.extension_reason ?? "Probation extended")},
        ${JSON.stringify({ previousProbationEnd: previous, probationEndDate: next, months })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { kind: "extended", previousProbationEnd: previous, probationEndDate: next, months };
}

async function applyTermination(access: Access, review: ReviewRow, employment: EmploymentRow, requestId: string): Promise<TerminateOutcome> {
  const nextStep = "Raise the exit through Resignation and Exit (FRM-LCY-03) with exit type Termination; the last working day and notice are decided there.";
  await tenantTx(access, [
    sqlClient`
      update employments set attributes = attributes || ${JSON.stringify({ probationOutcome: "terminate", probationOutcomeReviewId: review.id })}::jsonb,
        version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${employment.id}
    `,
    sqlClient`
      insert into lifecycle_events (id, tenant_id, employee_id, attributes)
      values (${crypto.randomUUID()}, ${access.tenantId}, ${review.employee_id},
        ${JSON.stringify({ kind: "probation_termination", review_id: review.id, assessment: review.attributes.assessment ?? null, decided_by: access.context.actorUserId })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.probation_terminate', 'employment', ${employment.id}, ${String(review.attributes.assessment ?? "Termination on probation approved")}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { kind: "termination_recommended", nextStep };
}

export async function decideConfirmationReview(access: Access, reviewId: string, input: DecideConfirmationReviewInput, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const review = await loadReview(access, reviewId);
  if (review.attributes.approval_status !== "pending_approval") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `This review is ${String(review.attributes.approval_status)}.` });
  }
  if (review.attributes.submitted_by === access.context.actorUserId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "The manager who submitted the review cannot also decide it." });
  }
  const employment = await requireEmployment(access, review.employee_id);
  let outcome: ReviewOutcome | null = null;
  if (input.decision === "approve") {
    const recommendation = review.attributes.recommendation as ConfirmationAction;
    outcome =
      recommendation === "confirm" ? await applyConfirmation(access, review, employment, input, requestId)
      : recommendation === "extend_probation" ? await applyExtension(access, review, employment, requestId)
      : await applyTermination(access, review, employment, requestId);
  }
  const approvalStatus = REVIEW_DECISION_STATUS[input.decision];
  const decided = {
    approval_status: approvalStatus,
    decision: input.decision,
    decision_remarks: input.remarks ?? null,
    approver_id: access.context.actorUserId,
    confirmation_effective_date: outcome?.kind === "confirmed" ? outcome.confirmationDate : null,
    revise_salary: input.reviseSalary,
    issue_letter: input.issueLetter,
    outcome,
  };
  await tenantTx(access, [
    sqlClient`update lifecycle_events set attributes = attributes || ${JSON.stringify(decided)}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${reviewId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`lifecycle.confirmation_review_${input.decision}`}, 'lifecycle_event', ${reviewId}, ${input.remarks ?? `Confirmation review ${input.decision}`},
        ${JSON.stringify({ approvalStatus, outcome })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: reviewId, employeeId: review.employee_id, approvalStatus, decision: input.decision, outcome };
}
