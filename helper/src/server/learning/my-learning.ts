import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import {
  certificationForCourse,
  deriveEnrollmentState,
  deriveProgress,
  type CertificationRow,
  type CourseRow,
  type Progress,
} from "./progress";

/**
 * SCR-063 "My learning" — the signed-in employee's own learning queue:
 * learning path, due date, progress and status.
 *
 * This is the self-service counterpart to the catalogue-oriented Learning &
 * Development screen. Nothing here re-derives what `progress.ts` already
 * derives: `deriveEnrollmentState`, `deriveProgress` and `certificationForCourse`
 * are imported and reused, so there is exactly one enrollment-state derivation
 * in the system.
 *
 * What this module adds on top of that derivation, and what it refuses to add:
 *
 * - The five states the spec names are NOT all reachable. `enrollEmployee`
 *   writes `status: "assigned"`; `completeEnrollment` writes `status:
 *   "verified"` AND a `learning_completions` row in one transaction. Those are
 *   the only two statuses any writer in this system produces. So:
 *     Assigned    — backed.
 *     In progress — NOT reachable. No writer moves an enrollment to a third,
 *                   non-terminal status. `deriveEnrollmentState` returns
 *                   `in_progress` only for an unrecognised status string, which
 *                   is a defensive branch, not a state the system can enter.
 *     Completed   — NOT distinguishable from Verified. One transaction records
 *                   both; there is no reviewer, no second actor and no
 *                   "completed, awaiting verification" step anywhere.
 *     Verified    — backed, by that recorded status plus the completion row.
 *     Certified   — backed, by an `employee_certifications` row for the
 *                   certification the course defines.
 *   `MY_LEARNING_STATE_BACKING` carries that verdict per state so the screen can
 *   state it rather than imply five working states.
 *
 * - Progress percentage is NOT tracked. `progress.ts` establishes this (no
 *   SCORM, no xAPI, no resume point) and reports `percentComplete: null` with
 *   `tracked: false`. That is reused verbatim. Zero is never substituted.
 *
 * - A due date IS stored (`enrollments.attributes.due_date`, written by
 *   `enrollEmployee`) and NOTHING acts on it. There is no reminder job, no
 *   escalation, no overdue queue and no second reader of that field anywhere in
 *   the codebase. Overdue position is therefore computed here for display, and
 *   every overdue row carries `DUE_DATE_INERT` saying plainly that the system
 *   takes no action on it.
 *
 * - Completion evidence is a file in the spec and has nowhere to go.
 *   `learning_completions.document_id` exists in the canonical topology and has
 *   NO writer: neither `completeEnrollment` nor `recordCourseCompletion` sets
 *   it. `POST /api/v1/documents` would store bytes, but nothing would ever link
 *   that document to the completion, so the upload would look attached and
 *   would not be. This module therefore READS an evidence document when one is
 *   linked and offers no upload, reporting `EVIDENCE_UPLOAD_UNREACHABLE`.
 */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: unknown): number | null {
  const parsed = numOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}

/* ---------------------------------------------------------------------------
 * The five spec states, and how much of each one the data can actually carry.
 * Pure; no database.
 * ------------------------------------------------------------------------ */

export const MY_LEARNING_STATES = ["assigned", "in_progress", "completed", "verified", "certified"] as const;
export type MyLearningState = (typeof MY_LEARNING_STATES)[number];

export const MY_LEARNING_STATE_LABELS: Record<MyLearningState, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  verified: "Verified",
  certified: "Certified",
};

export type StateBacking = { backed: boolean; basis: string };

/**
 * Per-state verdict on whether a writer in this system can actually produce it.
 * The screen renders this next to the state filter rather than presenting five
 * equally real states.
 */
export const MY_LEARNING_STATE_BACKING: Record<MyLearningState, StateBacking> = {
  assigned: {
    backed: true,
    basis: "enrollEmployee writes enrollments.attributes.status = 'assigned' and no completion row exists yet.",
  },
  in_progress: {
    backed: false,
    basis:
      "Not reachable. No writer moves an enrollment to a third, non-terminal status — enrollEmployee writes 'assigned' and completeEnrollment writes 'verified'. deriveEnrollmentState returns in_progress only for an unrecognised status string, which is a defensive branch rather than a state this system can enter.",
  },
  completed: {
    backed: false,
    basis:
      "Not distinguishable from Verified. completeEnrollment writes the 'verified' status and the learning_completions row in the same transaction, so completion and verification are one event with one actor. Nothing records a completion awaiting verification.",
  },
  verified: {
    backed: true,
    basis: "A learning_completions row exists for the enrollment, and completeEnrollment set the status to 'verified'.",
  },
  certified: {
    backed: true,
    basis:
      "An employee_certifications row links this learner to the certification the course defines. Issued by recordCourseCompletion, and only where the course actually defines a certification.",
  },
};

/**
 * Map the reusable three-way derivation onto the five-state spec vocabulary.
 *
 * `completed` is never returned: it is the same recorded event as `verified`
 * (see MY_LEARNING_STATE_BACKING), and returning both would assert a
 * distinction the data does not carry.
 */
export function deriveMyLearningState(input: { status: string; hasCompletion: boolean; certificateHeld: boolean }): MyLearningState {
  const base = deriveEnrollmentState(input.status, input.hasCompletion);
  if (base === "completed") return input.certificateHeld ? "certified" : "verified";
  if (base === "in_progress") return "in_progress";
  return "assigned";
}

/** True once the enrollment has a recorded completion, whether or not certified. */
export function isClosedState(state: MyLearningState): boolean {
  return state === "completed" || state === "verified" || state === "certified";
}

/* ---------------------------------------------------------------------------
 * Due date and overdue position. Computed for display only.
 * ------------------------------------------------------------------------ */

export const DUE_DATE_INERT =
  "Nothing in this system acts on a due date: there is no reminder, no escalation, no overdue queue and no second reader of enrollments.attributes.due_date. This position is computed for display only.";

export const DUE_SOON_DAYS = 7;

export type DueBand = "no_due_date" | "overdue" | "due_today" | "due_soon" | "scheduled" | "closed";

export type DuePosition = {
  band: DueBand;
  dueDate: string | null;
  daysUntilDue: number | null;
  daysOverdue: number | null;
  /** null when the enrollment is still open or carries no due date. */
  closedLate: boolean | null;
  label: string;
  note: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `from` to `to`, both YYYY-MM-DD. Null when either is unusable. */
export function daysBetweenDates(from: string, to: string): number | null {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

/**
 * Band an enrollment against its due date.
 *
 * Boundaries are inclusive on the safe side: a due date equal to today is
 * `due_today` and not yet overdue, and a due date exactly DUE_SOON_DAYS away is
 * still `due_soon`. A closed enrollment is never overdue — it is `closed`, and
 * `closedLate` says whether the completion landed after the due date.
 */
export function dueBanding(input: {
  dueDate: string | null;
  today: string;
  state: MyLearningState;
  completedOn: string | null;
}): DuePosition {
  const dueDate = input.dueDate && DATE_PATTERN.test(input.dueDate) ? input.dueDate : null;
  if (isClosedState(input.state)) {
    const closedLate: boolean | null =
      dueDate && input.completedOn && DATE_PATTERN.test(input.completedOn) ? input.completedOn > dueDate : null;
    return {
      band: "closed",
      dueDate,
      daysUntilDue: null,
      daysOverdue: null,
      closedLate,
      label: closedLate === true ? "Closed after the due date" : closedLate === false ? "Closed on time" : "Closed",
      note: dueDate
        ? closedLate === null
          ? "A completion is recorded but its date could not be compared with the due date."
          : DUE_DATE_INERT
        : "This enrollment was recorded without a due date.",
    };
  }
  if (!dueDate) {
    return {
      band: "no_due_date",
      dueDate: null,
      daysUntilDue: null,
      daysOverdue: null,
      closedLate: null,
      label: "No due date",
      note: "A due date is optional at enrolment and none was supplied for this one.",
    };
  }
  const delta = daysBetweenDates(input.today, dueDate);
  if (delta === null) {
    return { band: "no_due_date", dueDate, daysUntilDue: null, daysOverdue: null, closedLate: null, label: "No due date", note: "The stored due date could not be read as a date." };
  }
  if (delta < 0) {
    const daysOverdue = -delta;
    return {
      band: "overdue",
      dueDate,
      daysUntilDue: delta,
      daysOverdue,
      closedLate: null,
      label: `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`,
      note: DUE_DATE_INERT,
    };
  }
  if (delta === 0) {
    return { band: "due_today", dueDate, daysUntilDue: 0, daysOverdue: null, closedLate: null, label: "Due today", note: DUE_DATE_INERT };
  }
  if (delta <= DUE_SOON_DAYS) {
    return {
      band: "due_soon",
      dueDate,
      daysUntilDue: delta,
      daysOverdue: null,
      closedLate: null,
      label: `Due in ${delta} day${delta === 1 ? "" : "s"}`,
      note: DUE_DATE_INERT,
    };
  }
  return { band: "scheduled", dueDate, daysUntilDue: delta, daysOverdue: null, closedLate: null, label: `Due ${dueDate}`, note: DUE_DATE_INERT };
}

/* ---------------------------------------------------------------------------
 * Learning path resolution.
 * ------------------------------------------------------------------------ */

export type LearningPathRow = { id: string; attributes: UnknownRecord };

export type ResolvedPath = { id: string; code: string; title: string };

/**
 * Which learning paths contain a course.
 *
 * `enrollments.learning_path_id` exists in the canonical topology but has no
 * writer — `enrollEmployee` never sets it — so an enrollment's path is resolved
 * by membership instead: `learning_paths.attributes.course_codes` is written by
 * `createLearningPath` and is the only linkage that carries data today. The FK
 * is still preferred when some other writer has populated it.
 */
export function pathsForCourse(courseCode: string, paths: readonly LearningPathRow[]): ResolvedPath[] {
  const code = str(courseCode);
  if (!code) return [];
  const matches: ResolvedPath[] = [];
  for (const path of paths) {
    const attrs = asRecord(path.attributes);
    const codes = Array.isArray(attrs.course_codes) ? (attrs.course_codes as unknown[]).map((value) => str(value)) : [];
    if (!codes.includes(code)) continue;
    matches.push({ id: path.id, code: str(attrs.code), title: str(attrs.title) || str(attrs.code) || "Untitled learning path" });
  }
  return matches;
}

/* ---------------------------------------------------------------------------
 * Access scope. Self by default, exactly as SCR-053 payslips resolves it.
 * ------------------------------------------------------------------------ */

export type MyLearningScope = "all" | "self";

/**
 * The permission catalog carries no `learning.read` and no `employee.self.read`;
 * every learning module in this repo gates on `employee.read` / `employee.write`,
 * and `employee.read` is held by ordinary employees, so it cannot be the
 * discriminator. `employee.write` is what `enrollEmployee` and
 * `completeEnrollment` already require — a caller who may assign learning to
 * somebody is the caller who may look at their queue. Everyone else is self.
 */
export function myLearningScopeFrom(permissions: readonly string[]): MyLearningScope {
  return permissions.includes("employee.write") ? "all" : "self";
}

/**
 * The employee whose queue is being read. Self is the default in every case:
 * a broader caller reaches another employee only by asking for them explicitly,
 * and a self-scoped caller is pinned to their own row whatever they ask for.
 */
export function resolveSubjectEmployeeId(input: {
  scope: MyLearningScope;
  requestedEmployeeId: string | null;
  selfEmployeeId: string | null;
}): string | null {
  if (input.scope === "self") return input.selfEmployeeId;
  return input.requestedEmployeeId ?? input.selfEmployeeId ?? null;
}

/* ---------------------------------------------------------------------------
 * Action gates. The screen disables a control this refuses, and shows `reason`.
 * ------------------------------------------------------------------------ */

export type ActionGate = { allowed: boolean; reason: string | null };

/**
 * `completeEnrollment` refuses any status other than `assigned` with a 409, and
 * enforces `employee.write`. Both refusals are reproduced here so the button is
 * disabled with the real reason instead of failing on submit.
 */
export function completionGate(input: { state: MyLearningState; canWrite: boolean }): ActionGate {
  if (!input.canWrite) {
    return { allowed: false, reason: "Recording a completion needs the employee.write permission, which this account does not hold." };
  }
  if (isClosedState(input.state)) {
    return { allowed: false, reason: "A completion is already recorded for this enrollment. completeEnrollment accepts an assigned enrollment only." };
  }
  if (input.state === "in_progress") {
    return {
      allowed: false,
      reason: "This enrollment carries a status completeEnrollment does not accept; it transitions an 'assigned' enrollment only.",
    };
  }
  return { allowed: true, reason: null };
}

/** Enrolment needs employee.write, a subject employee and at least one course. */
export function assignGate(input: { canWrite: boolean; subjectEmployeeId: string | null; courseCount: number }): ActionGate {
  if (!input.canWrite) {
    return { allowed: false, reason: "Assigning learning needs the employee.write permission, which this account does not hold." };
  }
  if (!input.subjectEmployeeId) {
    return { allowed: false, reason: "This account is not linked to an employee profile, so there is no learner to enrol." };
  }
  if (input.courseCount === 0) {
    return { allowed: false, reason: "No courses exist in this tenant yet, so there is nothing to assign." };
  }
  return { allowed: true, reason: null };
}

export const EVIDENCE_UPLOAD_UNREACHABLE =
  "Completion evidence cannot be uploaded from this screen. learning_completions.document_id exists but has no writer — neither completeEnrollment nor recordCourseCompletion sets it — so a file uploaded through POST /api/v1/documents would be stored and never linked to the completion. An evidence document is shown here only when something else has already linked one.";

/* ---------------------------------------------------------------------------
 * State timeline.
 * ------------------------------------------------------------------------ */

export type TimelineStepState = "done" | "current" | "todo" | "unreachable";

export type MyLearningTimelineStep = { key: MyLearningState; label: string; state: TimelineStepState; note: string };

/**
 * The spec's five states rendered honestly: the two that no writer can produce
 * are marked `unreachable` rather than drawn as steps the learner is waiting
 * for, and `certified` is only a pending step when the course defines a
 * certification to issue.
 */
export function myLearningTimeline(state: MyLearningState, courseDefinesCertification: boolean): MyLearningTimelineStep[] {
  return [
    {
      key: "assigned",
      label: MY_LEARNING_STATE_LABELS.assigned,
      state: state === "assigned" ? "current" : "done",
      note: MY_LEARNING_STATE_BACKING.assigned.basis,
    },
    {
      key: "in_progress",
      label: MY_LEARNING_STATE_LABELS.in_progress,
      state: state === "in_progress" ? "current" : "unreachable",
      note: MY_LEARNING_STATE_BACKING.in_progress.basis,
    },
    {
      key: "completed",
      label: MY_LEARNING_STATE_LABELS.completed,
      state: "unreachable",
      note: MY_LEARNING_STATE_BACKING.completed.basis,
    },
    {
      key: "verified",
      label: MY_LEARNING_STATE_LABELS.verified,
      state: state === "verified" ? "current" : state === "certified" ? "done" : "todo",
      note: MY_LEARNING_STATE_BACKING.verified.basis,
    },
    {
      key: "certified",
      label: MY_LEARNING_STATE_LABELS.certified,
      state: state === "certified" ? "current" : courseDefinesCertification ? "todo" : "unreachable",
      note: courseDefinesCertification
        ? MY_LEARNING_STATE_BACKING.certified.basis
        : "This course defines no certification, so completing it issues no certificate and this state cannot be reached for this enrollment.",
    },
  ];
}

/* ---------------------------------------------------------------------------
 * Row assembly. Pure; the database reads below feed it.
 * ------------------------------------------------------------------------ */

export type MyEnrollmentRow = {
  id: string;
  version?: number | string | null;
  employee_id: string;
  learning_path_id?: string | null;
  attributes: UnknownRecord;
  created_at?: string | null;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type MyCompletionRow = {
  id: string;
  enrollment_id: string | null;
  document_id?: string | null;
  attributes: UnknownRecord;
  created_at?: string | null;
};

export type MyEmployeeCertificationRow = {
  id: string;
  employee_id: string;
  certification_id: string;
  attributes: UnknownRecord;
  created_at?: string | null;
};

export type MyLearningItem = {
  id: string;
  version: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  courseCode: string;
  courseTitle: string;
  /** The first path containing the course; null when no path contains it. */
  learningPath: ResolvedPath | null;
  learningPathCount: number;
  learningPathLabel: string;
  state: MyLearningState;
  stateLabel: string;
  stateBacking: StateBacking;
  progress: Progress;
  due: DuePosition;
  scorePct: number | null;
  completedOn: string | null;
  certification: { id: string; name: string; issuingBody: string | null; validityMonths: number | null } | null;
  certificateHeld: boolean;
  evidenceDocumentId: string | null;
  complete: ActionGate;
  enrolledAt: string | null;
};

/**
 * Build the queue rows. Every field is either read from a row or derived by a
 * function above; nothing is defaulted into existence.
 */
export function buildMyLearningItems(input: {
  enrollments: readonly MyEnrollmentRow[];
  completions: readonly MyCompletionRow[];
  courses: readonly CourseRow[];
  paths: readonly LearningPathRow[];
  certifications: readonly CertificationRow[];
  employeeCertifications: readonly MyEmployeeCertificationRow[];
  today: string;
  canWrite: boolean;
}): MyLearningItem[] {
  const completionByEnrollment = new Map<string, MyCompletionRow>();
  for (const completion of input.completions) {
    const key = str(completion.enrollment_id);
    if (key) completionByEnrollment.set(key, completion);
  }
  const heldByEmployee = new Set<string>();
  for (const held of input.employeeCertifications) heldByEmployee.add(`${held.employee_id}:${held.certification_id}`);

  const courseByCode = new Map<string, CourseRow>();
  for (const course of input.courses) {
    const code = str(asRecord(course.attributes).code);
    if (code) courseByCode.set(code, course);
  }

  return input.enrollments.map((enrollment) => {
    const attrs = asRecord(enrollment.attributes);
    const courseCode = str(attrs.course_code);
    const course = courseCode ? courseByCode.get(courseCode) ?? null : null;
    const certificationRow = course ? certificationForCourse(course, input.certifications) : null;
    const certificateHeld = Boolean(certificationRow && heldByEmployee.has(`${enrollment.employee_id}:${certificationRow.id}`));
    const completion = completionByEnrollment.get(str(enrollment.id));
    const state = deriveMyLearningState({ status: str(attrs.status), hasCompletion: Boolean(completion), certificateHeld });
    const progress = deriveProgress(deriveEnrollmentState(str(attrs.status), Boolean(completion)));
    const completedOn = completion?.created_at ? str(completion.created_at).slice(0, 10) : null;
    const paths = pathsForCourse(courseCode, input.paths);
    const certAttrs = certificationRow ? asRecord(certificationRow.attributes) : {};
    const name = [enrollment.first_name, enrollment.last_name]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join(" ")
      .trim();

    return {
      id: str(enrollment.id),
      version: intOrNull(enrollment.version ?? 1) ?? 1,
      employeeId: str(enrollment.employee_id),
      employeeName: name || str(enrollment.employee_code) || "This learner",
      employeeCode: enrollment.employee_code ?? null,
      courseCode,
      courseTitle: course ? str(asRecord(course.attributes).title) || courseCode : courseCode || "Unnamed course",
      learningPath: paths[0] ?? null,
      learningPathCount: paths.length,
      learningPathLabel: paths[0]
        ? paths.length > 1
          ? `${paths[0].title} (+${paths.length - 1} more)`
          : paths[0].title
        : "Not part of a learning path",
      state,
      stateLabel: MY_LEARNING_STATE_LABELS[state],
      stateBacking: MY_LEARNING_STATE_BACKING[state],
      progress,
      due: dueBanding({ dueDate: str(attrs.due_date) || null, today: input.today, state, completedOn }),
      scorePct: completion ? numOrNull(asRecord(completion.attributes).score_pct) : null,
      completedOn,
      certification: certificationRow
        ? {
            id: certificationRow.id,
            name: str(certAttrs.name) || str(certAttrs.code) || "Certification",
            issuingBody: str(certAttrs.issuing_body) || null,
            validityMonths: intOrNull(certAttrs.validity_months),
          }
        : null,
      certificateHeld,
      evidenceDocumentId: completion?.document_id ?? null,
      complete: completionGate({ state, canWrite: input.canWrite }),
      enrolledAt: enrollment.created_at ?? null,
    };
  });
}

/* ---------------------------------------------------------------------------
 * Filters.
 * ------------------------------------------------------------------------ */

export type MyLearningFilters = { state: MyLearningState | null; overdueOnly: boolean; search: string };

export function normalizeMyLearningFilters(args: { state?: string | null; overdue?: string | null; q?: string | null }): MyLearningFilters {
  const state = str(args.state).toLowerCase();
  return {
    state: (MY_LEARNING_STATES as readonly string[]).includes(state) ? (state as MyLearningState) : null,
    overdueOnly: str(args.overdue).toLowerCase() === "true",
    search: str(args.q).toLowerCase(),
  };
}

export function applyMyLearningFilters(items: readonly MyLearningItem[], filters: MyLearningFilters): MyLearningItem[] {
  return items.filter((item) => {
    if (filters.state && item.state !== filters.state) return false;
    if (filters.overdueOnly && item.due.band !== "overdue") return false;
    if (filters.search && !`${item.courseCode} ${item.courseTitle} ${item.learningPathLabel}`.toLowerCase().includes(filters.search)) return false;
    return true;
  });
}

/* ---------------------------------------------------------------------------
 * Database reads. Every raw statement runs inside tenantTx.
 * ------------------------------------------------------------------------ */

/** Rows are capped; a single learner's queue is far below this in practice. */
const QUEUE_LIMIT = 500;

function requireSubject(access: Access): { scope: MyLearningScope; selfEmployeeId: string | null; canWrite: boolean } {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const scope = myLearningScopeFrom(access.context.permissions);
  return { scope, selfEmployeeId: access.context.employeeId ?? null, canWrite: scope === "all" };
}

export type MyLearningQueue = {
  scope: MyLearningScope;
  subjectEmployeeId: string | null;
  viewing: "self" | "other" | "tenant";
  items: MyLearningItem[];
  total: number;
  states: Array<{ key: MyLearningState; label: string; backed: boolean; basis: string; count: number }>;
  assign: ActionGate;
  courses: Array<{ code: string; title: string; mandatory: boolean }>;
  notes: { dueDate: string; progress: string; evidence: string; states: string };
  truncated: boolean;
};

/**
 * The signed-in employee's learning queue. `employeeId` is honoured only for a
 * caller holding `employee.write`; everybody else is pinned to their own row,
 * and a self-scoped caller with no employee link is refused rather than shown
 * the tenant.
 */
export async function listMyLearning(
  access: Access,
  args: { employeeId?: string | null; state?: string | null; overdue?: string | null; q?: string | null; page: number; pageSize: number; today?: string },
): Promise<MyLearningQueue> {
  const { scope, selfEmployeeId, canWrite } = requireSubject(access);
  const requestedEmployeeId = uuidOrNull(args.employeeId ?? null);
  const subjectEmployeeId = resolveSubjectEmployeeId({ scope, requestedEmployeeId, selfEmployeeId });
  if (scope === "self" && !subjectEmployeeId) {
    throw new HttpError({
      status: 403,
      code: "EMPLOYEE_LINK_REQUIRED",
      message: "Link this account to its employee profile to see its own learning.",
    });
  }
  const today = args.today ?? new Date().toISOString().slice(0, 10);

  const [enrollmentRows, completionRows, courseRows, pathRows, certificationRows, heldRows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.version, e.employee_id, e.learning_path_id, e.attributes, e.created_at,
             emp.employee_code, emp.first_name, emp.last_name
      from enrollments e
      left join employees emp on emp.id = e.employee_id and emp.tenant_id = e.tenant_id
      where e.tenant_id = ${access.tenantId}
        and (${subjectEmployeeId}::uuid is null or e.employee_id = ${subjectEmployeeId}::uuid)
      order by e.created_at desc
      limit ${QUEUE_LIMIT}
    `,
    sqlClient`
      select id, enrollment_id, document_id, attributes, created_at from learning_completions
      where tenant_id = ${access.tenantId}
        and (${subjectEmployeeId}::uuid is null or employee_id = ${subjectEmployeeId}::uuid)
      order by created_at desc limit ${QUEUE_LIMIT}
    `,
    sqlClient`select id, attributes, created_at from courses where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, attributes from learning_paths where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, attributes from certifications where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`
      select id, employee_id, certification_id, attributes, created_at from employee_certifications
      where tenant_id = ${access.tenantId}
        and (${subjectEmployeeId}::uuid is null or employee_id = ${subjectEmployeeId}::uuid)
      limit ${QUEUE_LIMIT}
    `,
  ]);

  const courses = courseRows as CourseRow[];
  const all = buildMyLearningItems({
    enrollments: enrollmentRows as MyEnrollmentRow[],
    completions: completionRows as MyCompletionRow[],
    courses,
    paths: pathRows as LearningPathRow[],
    certifications: certificationRows as CertificationRow[],
    employeeCertifications: heldRows as MyEmployeeCertificationRow[],
    today,
    canWrite,
  });
  const filtered = applyMyLearningFilters(all, normalizeMyLearningFilters(args));
  const offset = (args.page - 1) * args.pageSize;

  return {
    scope,
    subjectEmployeeId,
    viewing: subjectEmployeeId === null ? "tenant" : subjectEmployeeId === selfEmployeeId ? "self" : "other",
    items: filtered.slice(offset, offset + args.pageSize),
    total: filtered.length,
    states: MY_LEARNING_STATES.map((key) => ({
      key,
      label: MY_LEARNING_STATE_LABELS[key],
      backed: MY_LEARNING_STATE_BACKING[key].backed,
      basis: MY_LEARNING_STATE_BACKING[key].basis,
      count: all.filter((item) => item.state === key).length,
    })),
    assign: assignGate({ canWrite, subjectEmployeeId, courseCount: courses.length }),
    courses: courses.map((course) => {
      const attrs = asRecord(course.attributes);
      return { code: str(attrs.code), title: str(attrs.title) || str(attrs.code), mandatory: attrs.mandatory === true };
    }),
    notes: {
      dueDate: DUE_DATE_INERT,
      progress:
        "Progress percentage is not tracked anywhere in this system: there is no SCORM, xAPI or resume-point signal, so an open enrollment reports no percentage rather than zero.",
      evidence: EVIDENCE_UPLOAD_UNREACHABLE,
      states:
        "Of the five states this screen names, Assigned, Verified and Certified are backed by recorded data. In progress has no writer, and Completed is the same recorded event as Verified.",
    },
    truncated: (enrollmentRows as unknown[]).length >= QUEUE_LIMIT,
  };
}

export type MyLearningDetail = MyLearningItem & {
  timeline: MyLearningTimelineStep[];
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
  evidence: { documentId: string; title: string | null; mimeType: string | null } | null;
  evidenceNote: string;
  certificateIssued: { id: string; issuedOn: string | null; expiresOn: string | null; credentialReference: string | null } | null;
  notes: { dueDate: string; progress: string };
};

/**
 * One enrollment in full. A self-scoped caller reading another employee's
 * enrollment gets a 404, not a 403, so the existence of that enrollment never
 * leaks — the same rule SCR-053 applies to payslips.
 */
export async function getMyLearningDetail(access: Access, enrollmentId: string, today?: string): Promise<MyLearningDetail> {
  const { scope, selfEmployeeId, canWrite } = requireSubject(access);
  if (scope === "self" && !selfEmployeeId) {
    throw new HttpError({
      status: 403,
      code: "EMPLOYEE_LINK_REQUIRED",
      message: "Link this account to its employee profile to see its own learning.",
    });
  }
  const asOf = today ?? new Date().toISOString().slice(0, 10);

  const [enrollmentRows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.version, e.employee_id, e.learning_path_id, e.attributes, e.created_at,
             emp.employee_code, emp.first_name, emp.last_name
      from enrollments e
      left join employees emp on emp.id = e.employee_id and emp.tenant_id = e.tenant_id
      where e.tenant_id = ${access.tenantId} and e.id = ${enrollmentId}
      limit 1
    `,
  ]);
  const enrollment = (enrollmentRows as MyEnrollmentRow[])[0];
  if (!enrollment) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (scope === "self" && enrollment.employee_id !== selfEmployeeId) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }

  const [completionRows, courseRows, pathRows, certificationRows, heldRows, auditRows] = await tenantTx(access, [
    sqlClient`select id, enrollment_id, document_id, attributes, created_at from learning_completions where tenant_id = ${access.tenantId} and enrollment_id = ${enrollmentId} limit 1`,
    sqlClient`select id, attributes, created_at from courses where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, attributes from learning_paths where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, attributes from certifications where tenant_id = ${access.tenantId} order by created_at`,
    sqlClient`select id, employee_id, certification_id, attributes, created_at from employee_certifications where tenant_id = ${access.tenantId} and employee_id = ${enrollment.employee_id}`,
    sqlClient`
      select action, reason, created_at from audit_events
      where tenant_id = ${access.tenantId} and entity_type = 'enrollment' and entity_id = ${enrollmentId}
      order by created_at desc limit 12
    `,
  ]);

  const item = buildMyLearningItems({
    enrollments: [enrollment],
    completions: completionRows as MyCompletionRow[],
    courses: courseRows as CourseRow[],
    paths: pathRows as LearningPathRow[],
    certifications: certificationRows as CertificationRow[],
    employeeCertifications: heldRows as MyEmployeeCertificationRow[],
    today: asOf,
    canWrite,
  })[0];
  if (!item) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  let evidence: MyLearningDetail["evidence"] = null;
  if (item.evidenceDocumentId) {
    const [documentRows] = await tenantTx(access, [
      sqlClient`select id, attributes from documents where tenant_id = ${access.tenantId} and id = ${item.evidenceDocumentId} limit 1`,
    ]);
    const document = (documentRows as Array<{ id: string; attributes: UnknownRecord }>)[0];
    if (document) {
      const attrs = asRecord(document.attributes);
      evidence = { documentId: document.id, title: str(attrs.title) || null, mimeType: str(attrs.mime) || null };
    }
  }

  const held = (heldRows as MyEmployeeCertificationRow[]).find((row) => item.certification && row.certification_id === item.certification.id);
  const heldAttrs = held ? asRecord(held.attributes) : {};

  return {
    ...item,
    timeline: myLearningTimeline(item.state, item.certification !== null),
    auditTrail: (auditRows as Array<{ action: string; reason: string | null; created_at: string | null }>).map((entry) => ({
      action: entry.action,
      reason: entry.reason,
      createdAt: entry.created_at,
    })),
    evidence,
    evidenceNote: EVIDENCE_UPLOAD_UNREACHABLE,
    certificateIssued: held
      ? {
          id: held.id,
          issuedOn: str(heldAttrs.issued_on) || null,
          expiresOn: str(heldAttrs.expires_on) || null,
          credentialReference: str(heldAttrs.credential_reference) || null,
        }
      : null,
    notes: {
      dueDate: DUE_DATE_INERT,
      progress: item.progress.basis,
    },
  };
}

/** Query contract for GET /api/v1/my-learning. Exported for the route handler. */
export const myLearningQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  enrollmentId: z.string().uuid().optional(),
  state: z.enum(MY_LEARNING_STATES).optional(),
  overdue: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(120).optional(),
});
