import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { completeEnrollment } from "./service";

/**
 * SCR-063 Learning & Development read model and completion command.
 *
 * Honesty constraints this module is built around, all of them properties of
 * the data that actually exists rather than presentation choices:
 *
 * - There is NO per-learner progress signal anywhere in the system. No SCORM,
 *   no xAPI, no resume point, no heartbeat. `enrollments.attributes.status`
 *   moves from `assigned` to `verified` and `learning_completions` records a
 *   score at the end. A percentage between those two points does not exist,
 *   so this module reports `percentComplete: null` with `progressTracked:
 *   false` rather than inventing a number. Zero would be a claim too, and a
 *   false one.
 * - Cohort completion (completed enrollments / total enrollments for a course)
 *   IS computable and is labelled as such. It is a course statistic, never a
 *   learner's position inside a course.
 * - `courses.attributes.mandatory` is the only compliance hook in the schema.
 *   There are no due-date rules, no assignment rules and no non-compliance
 *   queue, so compliance here means exactly "a course flagged mandatory does
 *   not have every enrollment verified" and says so.
 * - No learning-to-performance ROI figure is produced. See `impactReadiness`.
 */

type UnknownRecord = Record<string, unknown>;

export type CourseRow = { id: string; attributes: UnknownRecord; created_at?: string | null };
export type EnrollmentRow = { id: string; employee_id: string; attributes: UnknownRecord; created_at?: string | null };
export type CompletionRow = { id: string; employee_id: string; enrollment_id: string | null; attributes: UnknownRecord; created_at?: string | null };
export type CertificationRow = { id: string; attributes: UnknownRecord };
export type EmployeeCertificationRow = { id: string; employee_id: string; certification_id: string; attributes: UnknownRecord; created_at?: string | null };

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ---------------------------------------------------------------------------
 * Pure derivations. No database, no I/O; every one of these is unit-tested.
 * ------------------------------------------------------------------------ */

export type EnrollmentState = "not_started" | "in_progress" | "completed";

/**
 * The only states the system records are `assigned` (written on enrollment)
 * and `verified` (written on completion). An enrollment is therefore completed
 * when a completion row exists or the status says so; `assigned` means nothing
 * has been recorded since assignment, which is not-started; any other status a
 * future writer introduces is treated as in-progress rather than silently
 * collapsed into one of the two known states.
 */
export function deriveEnrollmentState(status: string, hasCompletion: boolean): EnrollmentState {
  const key = status.trim().toLowerCase();
  if (hasCompletion || key === "verified" || key === "completed") return "completed";
  if (key === "" || key === "assigned" || key === "not_started" || key === "enrolled") return "not_started";
  return "in_progress";
}

export const PROGRESS_UNTRACKED_NOT_STARTED = "Assigned; no progress event has been recorded since assignment.";
export const PROGRESS_UNTRACKED_IN_PROGRESS = "Progress percentage is not tracked: there is no SCORM, xAPI or resume-point signal in the system.";
export const PROGRESS_TRACKED_COMPLETED = "A learning_completions row is recorded for this enrollment.";

export type Progress = {
  state: EnrollmentState;
  /** null whenever a real percentage does not exist. Never defaulted to 0. */
  percentComplete: number | null;
  tracked: boolean;
  basis: string;
};

export function deriveProgress(state: EnrollmentState): Progress {
  if (state === "completed") {
    return { state, percentComplete: 100, tracked: true, basis: PROGRESS_TRACKED_COMPLETED };
  }
  if (state === "not_started") {
    return { state, percentComplete: null, tracked: false, basis: PROGRESS_UNTRACKED_NOT_STARTED };
  }
  return { state, percentComplete: null, tracked: false, basis: PROGRESS_UNTRACKED_IN_PROGRESS };
}

export type CourseCompliance = "complete" | "mandatory_outstanding" | "in_progress" | "not_enrolled";

/**
 * Course-level classification across every enrollment for that course.
 * `mandatory` is `courses.attributes.mandatory` — the only compliance hook the
 * schema has. A mandatory course with nobody enrolled is outstanding, because
 * the flag asserts the course is required and nothing satisfies it.
 */
export function classifyCourseCompliance(input: { mandatory: boolean; enrolled: number; completed: number }): CourseCompliance {
  const { mandatory, enrolled, completed } = input;
  if (enrolled > 0 && completed >= enrolled) return "complete";
  if (mandatory) return "mandatory_outstanding";
  if (enrolled === 0) return "not_enrolled";
  return "in_progress";
}

export function complianceBasis(compliance: CourseCompliance, mandatory: boolean): string {
  if (compliance === "complete") return "Every enrollment on this course is verified complete.";
  if (compliance === "mandatory_outstanding") {
    return "Flagged mandatory on the course record, and not every enrollment is verified. There are no due dates and no assignment rules in this system, so that flag is the whole of the compliance test.";
  }
  if (compliance === "not_enrolled") return "No enrollments exist for this course, and it is not flagged mandatory.";
  return `Enrollments exist and are not all verified.${mandatory ? "" : " This course is not flagged mandatory."}`;
}

/** Completion rate as a percentage, or null when nothing has been enrolled. */
export function completionRatePct(completed: number, total: number): number | null {
  if (!Number.isFinite(completed) || !Number.isFinite(total)) return null;
  if (total <= 0) return null;
  return Math.round((completed / total) * 1000) / 10;
}

/** Find the certification a course defines, by either linkage the data allows. */
export function certificationForCourse(course: CourseRow, certifications: readonly CertificationRow[]): CertificationRow | null {
  const attrs = asRecord(course.attributes);
  const courseCode = str(attrs.code);
  const declaredCode = str(attrs.certification_code);
  for (const certification of certifications) {
    const certAttrs = asRecord(certification.attributes);
    if (courseCode && str(certAttrs.course_code) === courseCode) return certification;
    if (declaredCode && str(certAttrs.code) === declaredCode) return certification;
  }
  return null;
}

/** Add whole months to a YYYY-MM-DD date, clamping to the end of the month. */
export function addMonths(isoDate: string, months: number): string {
  const parts = isoDate.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total - targetYear * 12;
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInMonth);
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export type CertificatePlan = {
  issue: boolean;
  reason: "course_defines_no_certification" | "already_held" | "issue";
  certificationId: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  validityMonths: number | null;
};

/**
 * A certificate is issued ONLY where the course actually defines one. A course
 * with no linked `certifications` row produces no certificate and no certified
 * badge — the card says the course defines no certification instead.
 */
export function planCertificateIssuance(input: {
  certification: CertificationRow | null;
  employeeId: string;
  held: readonly EmployeeCertificationRow[];
  completedOn: string;
}): CertificatePlan {
  const { certification, employeeId, held, completedOn } = input;
  if (!certification) {
    return { issue: false, reason: "course_defines_no_certification", certificationId: null, issuedOn: null, expiresOn: null, validityMonths: null };
  }
  const validityMonths = intOrNull(asRecord(certification.attributes).validity_months);
  const already = held.some((row) => row.certification_id === certification.id && row.employee_id === employeeId);
  if (already) {
    return { issue: false, reason: "already_held", certificationId: certification.id, issuedOn: null, expiresOn: null, validityMonths };
  }
  return {
    issue: true,
    reason: "issue",
    certificationId: certification.id,
    issuedOn: completedOn,
    expiresOn: validityMonths !== null && validityMonths > 0 ? addMonths(completedOn, validityMonths) : null,
    validityMonths,
  };
}

export type ImpactReadiness = {
  roiPct: null;
  computed: false;
  statement: string;
  missing: string[];
};

/**
 * Deliberately returns no number. Correlating learning to a performance
 * outcome requires a defined outcome metric, a pre-learning baseline and a
 * comparison window. None of the three exist in this system, so any figure
 * printed here would be fabricated — and a fabricated ROI number is worse than
 * an absent one, because it gets quoted in a budget conversation.
 */
export function impactReadiness(): ImpactReadiness {
  return {
    roiPct: null,
    computed: false,
    statement:
      "No learning ROI or capability-velocity figure is produced. Correlating learning to a performance outcome needs a defined outcome metric, a pre-learning baseline and a comparison window; none of the three are recorded anywhere in this system.",
    missing: [
      "A defined outcome metric — nothing links an enrollment to a performance, quality or output measure.",
      "A baseline reading of that metric from before the learning was taken.",
      "A comparison window, and a comparable cohort that did not take the course.",
    ],
  };
}

export type TimeToCompletion = { samples: number; medianDays: number | null; averageDays: number | null; basis: string };

export function timeToCompletion(pairs: ReadonlyArray<{ enrolledAt: string | null; completedAt: string | null }>): TimeToCompletion {
  const days: number[] = [];
  for (const pair of pairs) {
    if (!pair.enrolledAt || !pair.completedAt) continue;
    const from = new Date(pair.enrolledAt).getTime();
    const to = new Date(pair.completedAt).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
    days.push((to - from) / 86_400_000);
  }
  if (days.length === 0) {
    return { samples: 0, medianDays: null, averageDays: null, basis: "No enrollment has both an assignment timestamp and a completion timestamp yet." };
  }
  days.sort((a, b) => a - b);
  const middle = Math.floor(days.length / 2);
  const median = days.length % 2 === 1 ? days[middle] : (days[middle - 1] + days[middle]) / 2;
  const average = days.reduce((total, value) => total + value, 0) / days.length;
  return {
    samples: days.length,
    medianDays: Math.round(median * 10) / 10,
    averageDays: Math.round(average * 10) / 10,
    basis: "enrollments.created_at to learning_completions.created_at, over enrollments that have both.",
  };
}

export type CourseCard = {
  id: string;
  code: string;
  title: string;
  category: string | null;
  provider: string | null;
  durationMinutes: number | null;
  mandatory: boolean;
  compliance: CourseCompliance;
  complianceBasis: string;
  cohort: { enrolled: number; completed: number; inProgress: number; notStarted: number; completionRatePct: number | null };
  certification: { id: string; name: string; issuingBody: string | null; validityMonths: number | null; holders: number } | null;
  certificationNote: string;
};

export type EnrollmentCard = {
  id: string;
  employeeId: string;
  courseCode: string;
  courseTitle: string;
  state: EnrollmentState;
  percentComplete: number | null;
  progressTracked: boolean;
  progressBasis: string;
  dueDate: string | null;
  scorePct: number | null;
  completedAt: string | null;
  certificateHeld: boolean;
};

export type LearningAnalytics = {
  courses: number;
  mandatoryCourses: number;
  enrollments: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRatePct: number | null;
  mandatoryCoveragePct: number | null;
  mandatoryOutstandingCourses: number;
  timeToCompletion: TimeToCompletion;
  certificatesIssued: number;
  coursesDefiningCertification: number;
  sources: Record<string, string>;
  impact: ImpactReadiness;
};

export type LearningProjection = { courses: CourseCard[]; enrollments: EnrollmentCard[]; analytics: LearningAnalytics };

/** Assemble the whole screen projection from raw rows. Pure; no database. */
export function summariseLearning(input: {
  courses: readonly CourseRow[];
  enrollments: readonly EnrollmentRow[];
  completions: readonly CompletionRow[];
  certifications: readonly CertificationRow[];
  employeeCertifications: readonly EmployeeCertificationRow[];
}): LearningProjection {
  const completionByEnrollment = new Map<string, CompletionRow>();
  for (const completion of input.completions) {
    const key = str(completion.enrollment_id);
    if (key) completionByEnrollment.set(key, completion);
  }
  const holdersByCertification = new Map<string, number>();
  const heldByEmployee = new Set<string>();
  for (const held of input.employeeCertifications) {
    holdersByCertification.set(held.certification_id, (holdersByCertification.get(held.certification_id) ?? 0) + 1);
    heldByEmployee.add(`${held.employee_id}:${held.certification_id}`);
  }

  const courseByCode = new Map<string, CourseRow>();
  for (const course of input.courses) {
    const code = str(asRecord(course.attributes).code);
    if (code) courseByCode.set(code, course);
  }

  const enrollmentCards: EnrollmentCard[] = [];
  const cohorts = new Map<string, { enrolled: number; completed: number; inProgress: number; notStarted: number }>();
  const durations: Array<{ enrolledAt: string | null; completedAt: string | null }> = [];

  for (const enrollment of input.enrollments) {
    const attrs = asRecord(enrollment.attributes);
    const courseCode = str(attrs.course_code);
    const completion = completionByEnrollment.get(str(enrollment.id));
    const state = deriveEnrollmentState(str(attrs.status), Boolean(completion));
    const progress = deriveProgress(state);
    const course = courseCode ? courseByCode.get(courseCode) ?? null : null;
    const certification = course ? certificationForCourse(course, input.certifications) : null;

    const bucket = cohorts.get(courseCode) ?? { enrolled: 0, completed: 0, inProgress: 0, notStarted: 0 };
    bucket.enrolled += 1;
    if (state === "completed") bucket.completed += 1;
    else if (state === "in_progress") bucket.inProgress += 1;
    else bucket.notStarted += 1;
    cohorts.set(courseCode, bucket);

    if (state === "completed") {
      durations.push({ enrolledAt: enrollment.created_at ?? null, completedAt: completion?.created_at ?? null });
    }

    enrollmentCards.push({
      id: str(enrollment.id),
      employeeId: str(enrollment.employee_id),
      courseCode,
      courseTitle: course ? str(asRecord(course.attributes).title) || courseCode : courseCode,
      state,
      percentComplete: progress.percentComplete,
      progressTracked: progress.tracked,
      progressBasis: progress.basis,
      dueDate: str(attrs.due_date) || null,
      scorePct: completion ? numOrNull(asRecord(completion.attributes).score_pct) : null,
      completedAt: completion?.created_at ?? null,
      certificateHeld: Boolean(certification && heldByEmployee.has(`${str(enrollment.employee_id)}:${certification.id}`)),
    });
  }

  const courseCards: CourseCard[] = input.courses.map((course) => {
    const attrs = asRecord(course.attributes);
    const code = str(attrs.code);
    const mandatory = attrs.mandatory === true;
    const cohort = cohorts.get(code) ?? { enrolled: 0, completed: 0, inProgress: 0, notStarted: 0 };
    const compliance = classifyCourseCompliance({ mandatory, enrolled: cohort.enrolled, completed: cohort.completed });
    const certification = certificationForCourse(course, input.certifications);
    const certAttrs = certification ? asRecord(certification.attributes) : {};
    return {
      id: str(course.id),
      code,
      title: str(attrs.title) || code || "Untitled course",
      category: str(attrs.category) || null,
      provider: str(attrs.provider) || null,
      durationMinutes: intOrNull(attrs.duration_minutes),
      mandatory,
      compliance,
      complianceBasis: complianceBasis(compliance, mandatory),
      cohort: { ...cohort, completionRatePct: completionRatePct(cohort.completed, cohort.enrolled) },
      certification: certification
        ? {
            id: certification.id,
            name: str(certAttrs.name) || str(certAttrs.code) || "Certification",
            issuingBody: str(certAttrs.issuing_body) || null,
            validityMonths: intOrNull(certAttrs.validity_months),
            holders: holdersByCertification.get(certification.id) ?? 0,
          }
        : null,
      certificationNote: certification
        ? "Completing this course issues the linked certification to the learner."
        : "This course defines no certification, so completing it issues no certificate.",
    };
  });

  const completed = enrollmentCards.filter((card) => card.state === "completed").length;
  const inProgress = enrollmentCards.filter((card) => card.state === "in_progress").length;
  const mandatoryCards = courseCards.filter((card) => card.mandatory);
  const mandatorySatisfied = mandatoryCards.filter((card) => card.compliance === "complete").length;

  return {
    courses: courseCards,
    enrollments: enrollmentCards,
    analytics: {
      courses: courseCards.length,
      mandatoryCourses: mandatoryCards.length,
      enrollments: enrollmentCards.length,
      completed,
      inProgress,
      notStarted: enrollmentCards.length - completed - inProgress,
      completionRatePct: completionRatePct(completed, enrollmentCards.length),
      mandatoryCoveragePct: completionRatePct(mandatorySatisfied, mandatoryCards.length),
      mandatoryOutstandingCourses: mandatoryCards.length - mandatorySatisfied,
      timeToCompletion: timeToCompletion(durations),
      certificatesIssued: input.employeeCertifications.length,
      coursesDefiningCertification: courseCards.filter((card) => card.certification !== null).length,
      sources: {
        completionRatePct: "Enrollments with a learning_completions row, over all enrollments.",
        mandatoryCoveragePct: "Courses flagged courses.attributes.mandatory whose every enrollment is verified, over all mandatory courses. That flag is the only compliance hook in the schema.",
        cohortCompletion: "Completed enrollments over total enrollments for the course. A course statistic, not a learner's position inside the course.",
        learnerProgress: "Not tracked. No SCORM, xAPI or resume-point signal exists, so per-learner percentages are reported as untracked rather than as a number.",
        certificatesIssued: "employee_certifications rows.",
      },
      impact: impactReadiness(),
    },
  };
}

/* ---------------------------------------------------------------------------
 * Database reads and writes. Every raw statement runs inside tenantTx.
 * ------------------------------------------------------------------------ */

export async function readLearningProgress(access: Access): Promise<LearningProjection> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [courseRows, enrollmentRows, completionRows, certificationRows, employeeCertificationRows] = await tenantTx(access, [
    sqlClient`select id, attributes, created_at from courses where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, employee_id, attributes, created_at from enrollments where tenant_id = ${access.tenantId} order by created_at desc limit 500`,
    sqlClient`select id, employee_id, enrollment_id, attributes, created_at from learning_completions where tenant_id = ${access.tenantId} order by created_at desc limit 500`,
    sqlClient`select id, attributes from certifications where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, employee_id, certification_id, attributes, created_at from employee_certifications where tenant_id = ${access.tenantId} order by created_at desc limit 500`,
  ]);
  return summariseLearning({
    courses: courseRows as CourseRow[],
    enrollments: enrollmentRows as EnrollmentRow[],
    completions: completionRows as CompletionRow[],
    certifications: certificationRows as CertificationRow[],
    employeeCertifications: employeeCertificationRows as EmployeeCertificationRow[],
  });
}

export const recordCompletionSchema = z.object({
  action: z.literal("complete"),
  enrollmentId: z.string().uuid(),
  scorePct: z.number().min(0).max(100).optional(),
});

export const defineCertificationSchema = z.object({
  action: z.literal("define_certification"),
  courseCode: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  issuingBody: z.string().trim().min(1).max(200),
  validityMonths: z.number().int().positive().max(600).optional(),
});

export const learningProgressCommandSchema = z.discriminatedUnion("action", [recordCompletionSchema, defineCertificationSchema]);

export type LearningProgressCommand = z.infer<typeof learningProgressCommandSchema>;

export type CompletionResult = {
  enrollmentId: string;
  completionId: string;
  status: string;
  certificate: CertificatePlan & { employeeCertificationId: string | null; note: string };
};

/**
 * Complete an enrollment through the existing service transition, then issue
 * the linked certification where — and only where — the course defines one.
 */
export async function recordCourseCompletion(
  access: Access,
  input: z.infer<typeof recordCompletionSchema>,
  requestId: string,
): Promise<CompletionResult> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [enrollmentRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from enrollments where tenant_id = ${access.tenantId} and id = ${input.enrollmentId} limit 1`,
  ]);
  const enrollment = (enrollmentRows as EnrollmentRow[])[0];
  if (!enrollment) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const courseCode = str(asRecord(enrollment.attributes).course_code);

  const completion = await completeEnrollment(access, input.enrollmentId, input.scorePct, requestId);

  const [courseRows, certificationRows, heldRows] = await tenantTx(access, [
    sqlClient`select id, attributes from courses where tenant_id = ${access.tenantId} and attributes->>'code' = ${courseCode} limit 1`,
    sqlClient`select id, attributes from certifications where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, employee_id, certification_id, attributes from employee_certifications where tenant_id = ${access.tenantId} and employee_id = ${enrollment.employee_id}`,
  ]);
  const course = (courseRows as CourseRow[])[0] ?? null;
  const certification = course ? certificationForCourse(course, certificationRows as CertificationRow[]) : null;
  const plan = planCertificateIssuance({
    certification,
    employeeId: enrollment.employee_id,
    held: heldRows as EmployeeCertificationRow[],
    completedOn: new Date().toISOString().slice(0, 10),
  });

  let employeeCertificationId: string | null = null;
  if (plan.issue && plan.certificationId) {
    employeeCertificationId = crypto.randomUUID();
    const credentialReference = `CERT-${courseCode || "COURSE"}-${employeeCertificationId.slice(0, 8).toUpperCase()}`;
    const certificateAttributes = JSON.stringify({
      course_code: courseCode,
      enrollment_id: input.enrollmentId,
      learning_completion_id: completion.completionId,
      issued_on: plan.issuedOn,
      expires_on: plan.expiresOn,
      credential_reference: credentialReference,
      source: "learning.completion",
    });
    await tenantTx(access, [
      sqlClient`
        insert into employee_certifications (id, tenant_id, employee_id, certification_id, attributes)
        values (${employeeCertificationId}, ${access.tenantId}, ${enrollment.employee_id}, ${plan.certificationId}, ${certificateAttributes}::jsonb)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'learning.certificate_issue', 'employee_certification', ${employeeCertificationId},
          'Certification issued on verified course completion', ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
  }

  const note = plan.issue
    ? "Certification issued on completion."
    : plan.reason === "already_held"
      ? "The learner already holds this certification; no duplicate was issued."
      : "This course defines no certification, so no certificate was issued.";

  return { ...completion, certificate: { ...plan, employeeCertificationId, note } };
}

/**
 * Define the certification a course awards. Nothing else in the system writes
 * `certifications`, so without this the table stays empty and no course can
 * ever award a certificate.
 */
export async function defineCourseCertification(
  access: Access,
  input: z.infer<typeof defineCertificationSchema>,
): Promise<{ id: string; duplicate: boolean }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [courseRows, existingRows] = await tenantTx(access, [
    sqlClient`select id from courses where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.courseCode} limit 1`,
    sqlClient`select id from certifications where tenant_id = ${access.tenantId} and attributes->>'course_code' = ${input.courseCode} limit 1`,
  ]);
  if ((courseRows as Array<{ id: string }>).length === 0) {
    throw new HttpError({
      status: 404,
      code: "NOT_FOUND",
      message: "The course does not exist.",
      details: [{ field: "courseCode", issue: "No course carries this code." }],
    });
  }
  const existing = (existingRows as Array<{ id: string }>)[0];
  if (existing) return { id: existing.id, duplicate: true };
  const id = crypto.randomUUID();
  const attributes = JSON.stringify({
    course_code: input.courseCode,
    name: input.name,
    issuing_body: input.issuingBody,
    validity_months: input.validityMonths ?? null,
  });
  await tenantTx(access, [
    sqlClient`insert into certifications (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${attributes}::jsonb)`,
  ]);
  return { id, duplicate: false };
}
