import "server-only";

import { sqlClient } from "@/lib/db";
import { MCI_WEIGHTS } from "@/server/analytics/service";
import { readLearningProgress } from "@/server/learning/progress";
import { listCourses } from "@/server/learning/service";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { countBy, derived, ratio, round1, source, type Source } from "./source";

/**
 * S9 Capability Intelligence — the L&D console's aggregation.
 *
 * Everything on this cockpit is read from recorded rows. The specification
 * carries illustrative figures (1,284 assigned, 1,420h Engineering); none of
 * them appear here. Where the platform does not record something the payload
 * says so in a `note` and the client renders that sentence rather than a zero.
 *
 * What the learning data can and cannot carry (established by
 * `src/server/learning/progress.ts` and `my-learning.ts`, reused verbatim):
 *
 * - `enrollments.attributes.status` moves `assigned` -> `verified` and nothing
 *   writes a third state. There is no SCORM, xAPI or resume-point signal, so a
 *   "started" stage does not exist and is reported as omitted, not as zero.
 * - `learning_completions.attributes.score_pct` is optional and is the only
 *   assessment record in the system, so "assessed" means exactly "a score is
 *   recorded against the completion".
 * - Nothing anywhere links an enrolment to an on-the-job outcome, so the
 *   spec's "applied at work" stage is omitted with that reason stated.
 * - `courses.attributes.duration_minutes` IS recorded, so learning hours are
 *   genuinely computable. Where no completed course carries a duration the
 *   measure falls back to completion counts and the axis is relabelled — a
 *   count is never printed under an hours axis.
 */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/* -------------------------------------------------------------------------- */
/* Capability movement                                                        */
/* -------------------------------------------------------------------------- */

export type CapabilityDimension = keyof typeof MCI_WEIGHTS;

/**
 * The dimensions the capability index is actually built from. Taken from
 * `MCI_WEIGHTS` so the radar can never drift from the formula that produced
 * the scores. Five dimensions, inside the six the radar allows.
 */
export const CAPABILITY_DIMENSIONS = Object.keys(MCI_WEIGHTS) as CapabilityDimension[];

export const CAPABILITY_DIMENSION_LABELS: Record<CapabilityDimension, string> = {
  performance: "Performance",
  skills: "Skills",
  learning: "Learning",
  engagement: "Engagement",
  tenure: "Tenure",
};

export type CapabilityRunRow = {
  employee_id: string;
  attributes: unknown;
  created_at?: string | null;
};

export type CapabilityAxis = { axis: string; current: number; comparison: number };

export type CapabilityMovement = {
  /** Populated only when a baseline run exists; otherwise empty. */
  axes: CapabilityAxis[];
  /** The latest reading per dimension. Always populated where scores exist. */
  current: Array<{ axis: string; value: number }>;
  baselineRecorded: boolean;
  employeesScored: number;
  employeesWithBaseline: number;
  averageIndex: number | null;
  currentLabel: string;
  comparisonLabel: string;
  note: string;
};

export const CAPABILITY_NO_SCORES_NOTE =
  "No capability index run is recorded for this tenant. The radar is drawn from capability_index_runs, which computeMci writes; until one is computed there is nothing to plot.";

export const CAPABILITY_NO_BASELINE_NOTE =
  "No baseline is recorded. A baseline needs a second, earlier capability index run for the same employee, and every scored employee here has exactly one run. The current reading is shown on its own rather than compared against a fabricated starting point.";

function dimensionInputs(run: CapabilityRunRow): Partial<Record<CapabilityDimension, number>> {
  const inputs = asRecord(asRecord(run.attributes).inputs);
  const result: Partial<Record<CapabilityDimension, number>> = {};
  for (const dimension of CAPABILITY_DIMENSIONS) {
    const value = numOrNull(inputs[dimension]);
    if (value !== null) result[dimension] = value;
  }
  return result;
}

function averageDimension(
  rows: ReadonlyArray<Partial<Record<CapabilityDimension, number>>>,
  dimension: CapabilityDimension,
): number | null {
  const values = rows
    .map((row) => row[dimension])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  return round1(values.reduce((total, value) => total + value, 0) / values.length);
}

/**
 * Baseline against current across the capability dimensions.
 *
 * The comparison cohort is held fixed: baseline and current are both averaged
 * over the employees that have at least two runs, so the two series describe
 * the same people. An employee with a single run contributes to the current
 * reading only. With no such cohort, `axes` is empty and `baselineRecorded` is
 * false — the client then renders the current series alone.
 */
export function deriveCapabilityMovement(runs: readonly CapabilityRunRow[]): CapabilityMovement {
  const byEmployee = new Map<string, CapabilityRunRow[]>();
  for (const run of runs) {
    const key = str(run.employee_id);
    if (!key) continue;
    const bucket = byEmployee.get(key) ?? [];
    bucket.push(run);
    byEmployee.set(key, bucket);
  }

  const latestInputs: Array<Partial<Record<CapabilityDimension, number>>> = [];
  const cohortBaseline: Array<Partial<Record<CapabilityDimension, number>>> = [];
  const cohortCurrent: Array<Partial<Record<CapabilityDimension, number>>> = [];
  const latestIndexes: number[] = [];

  for (const bucket of byEmployee.values()) {
    const ordered = [...bucket].sort((left, right) =>
      String(left.created_at ?? "").localeCompare(String(right.created_at ?? "")),
    );
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    latestInputs.push(dimensionInputs(last));
    const index = numOrNull(asRecord(last.attributes).index);
    if (index !== null) latestIndexes.push(index);
    if (ordered.length > 1) {
      cohortBaseline.push(dimensionInputs(first));
      cohortCurrent.push(dimensionInputs(last));
    }
  }

  const current = CAPABILITY_DIMENSIONS.map((dimension) => ({
    axis: CAPABILITY_DIMENSION_LABELS[dimension],
    value: averageDimension(latestInputs, dimension),
  })).filter((entry): entry is { axis: string; value: number } => entry.value !== null);

  const axes = CAPABILITY_DIMENSIONS.map((dimension) => ({
    axis: CAPABILITY_DIMENSION_LABELS[dimension],
    current: averageDimension(cohortCurrent, dimension),
    comparison: averageDimension(cohortBaseline, dimension),
  })).filter((entry): entry is CapabilityAxis => entry.current !== null && entry.comparison !== null);

  const baselineRecorded = cohortBaseline.length > 0 && axes.length > 0;
  const employeesScored = byEmployee.size;
  const averageIndex =
    latestIndexes.length === 0
      ? null
      : round1(latestIndexes.reduce((total, value) => total + value, 0) / latestIndexes.length);

  return {
    axes: baselineRecorded ? axes : [],
    current,
    baselineRecorded,
    employeesScored,
    employeesWithBaseline: cohortBaseline.length,
    averageIndex,
    currentLabel: "Latest run",
    comparisonLabel: "Earliest recorded run",
    note:
      employeesScored === 0
        ? CAPABILITY_NO_SCORES_NOTE
        : baselineRecorded
          ? `Averaged over the ${cohortBaseline.length} employee${cohortBaseline.length === 1 ? "" : "s"} that carry both an earliest and a later capability index run, so both series describe the same people.`
          : CAPABILITY_NO_BASELINE_NOTE,
  };
}

/* -------------------------------------------------------------------------- */
/* Learning programme conversion                                              */
/* -------------------------------------------------------------------------- */

export type FunnelSubject = { completed: boolean; scoreRecorded: boolean; certified: boolean };

export type LearningFunnel = {
  stages: Array<{ label: string; value: number; basis: string }>;
  omitted: Array<{ label: string; reason: string }>;
  note: string;
};

/**
 * The two stages the specification names that this system cannot produce. They
 * are reported as omitted with the reason, never drawn as a zero-height stage
 * that would read as "nobody got that far".
 */
export const FUNNEL_OMITTED_STAGES: ReadonlyArray<{ label: string; reason: string }> = [
  {
    label: "Started",
    reason:
      "Not modelled. enrollEmployee writes status 'assigned' and completeEnrollment writes 'verified'; no writer moves an enrolment to a third, non-terminal state, and there is no SCORM, xAPI or resume-point signal that would mark a start.",
  },
  {
    label: "Applied at work",
    reason:
      "Not recorded. Nothing links an enrolment or a completion to an on-the-job outcome, a performance measure or a manager attestation, so this stage has no source anywhere in the platform.",
  },
];

export function deriveLearningFunnel(subjects: readonly FunnelSubject[]): LearningFunnel {
  const assigned = subjects.length;
  const completed = subjects.filter((subject) => subject.completed).length;
  const assessed = subjects.filter((subject) => subject.completed && subject.scoreRecorded).length;
  const certified = subjects.filter((subject) => subject.completed && subject.certified).length;

  return {
    stages: [
      {
        label: "Assigned",
        value: assigned,
        basis: "Every enrolments row. enrollEmployee writes one per assignment.",
      },
      {
        label: "Verified complete",
        value: completed,
        basis:
          "A learning_completions row exists for the enrolment. Completion and verification are one recorded event, so they are one stage.",
      },
      {
        label: "Assessed",
        value: assessed,
        basis: "learning_completions.attributes.score_pct carries a score. The score is optional at completion.",
      },
      {
        label: "Certified",
        value: certified,
        basis:
          "An employee_certifications row links the learner to the certification the course defines. Only a course that defines one can reach this stage.",
      },
    ],
    omitted: [...FUNNEL_OMITTED_STAGES],
    note:
      "The funnel ends where the recorded data ends. Two stages the specification names are listed below it with the reason they carry no source.",
  };
}

/* -------------------------------------------------------------------------- */
/* Learning volume by function                                                */
/* -------------------------------------------------------------------------- */

export type CompletionSubject = { department: string | null; courseCode: string };

export type LearningVolume = {
  measure: "hours" | "completions";
  /** What the bar length means. Never says "hours" unless it is hours. */
  axisLabel: string;
  bars: Array<{ label: string; value: number }>;
  completionsMeasured: number;
  completionsWithoutDuration: number;
  note: string;
};

const UNASSIGNED_DEPARTMENT = "No department recorded";

/**
 * Learning volume grouped by the learner's department.
 *
 * Hours are real: `courses.attributes.duration_minutes` is written by
 * createCourse and multiplied by the verified completions on that course. A
 * completion whose course carries no usable duration is excluded from the hours
 * total and counted in `completionsWithoutDuration`. If no completion at all
 * has a duration behind it the measure degrades to a completion count and the
 * axis label changes with it.
 */
export function deriveLearningVolume(input: {
  completions: readonly CompletionSubject[];
  durationMinutesByCourse: ReadonlyMap<string, number | null>;
}): LearningVolume {
  const minutes = new Map<string, number>();
  let measured = 0;
  let missing = 0;

  for (const completion of input.completions) {
    const label = str(completion.department) || UNASSIGNED_DEPARTMENT;
    const duration = input.durationMinutesByCourse.get(completion.courseCode) ?? null;
    if (duration === null || !Number.isFinite(duration) || duration <= 0) {
      missing += 1;
      continue;
    }
    minutes.set(label, (minutes.get(label) ?? 0) + duration);
    measured += 1;
  }

  if (measured === 0) {
    const bars = countBy(input.completions, (completion) => str(completion.department) || UNASSIGNED_DEPARTMENT);
    return {
      measure: "completions",
      axisLabel: "Verified completions",
      bars,
      completionsMeasured: 0,
      completionsWithoutDuration: missing,
      note:
        input.completions.length === 0
          ? "No verified completion is recorded yet, so there is nothing to attribute to a function."
          : "No completed course carries a usable courses.attributes.duration_minutes, so this measures verified completions, not hours. The axis is labelled accordingly.",
    };
  }

  const bars = [...minutes.entries()]
    .map(([label, total]) => ({ label, value: round1(total / 60) ?? 0 }))
    .sort((left, right) => right.value - left.value);

  return {
    measure: "hours",
    axisLabel: "Learning hours",
    bars,
    completionsMeasured: measured,
    completionsWithoutDuration: missing,
    note:
      missing === 0
        ? "Verified completions multiplied by the recorded course duration (courses.attributes.duration_minutes), grouped by the learner's department."
        : `Verified completions multiplied by the recorded course duration, grouped by the learner's department. ${missing} completion${missing === 1 ? "" : "s"} could not be counted because the course records no duration.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Database reads                                                             */
/* -------------------------------------------------------------------------- */

async function readCapabilityRuns(access: Access): Promise<CapabilityRunRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select employee_id, attributes, created_at from capability_index_runs
      where tenant_id = ${access.tenantId}
      order by created_at
      limit 2000
    `,
  ]);
  return rows as CapabilityRunRow[];
}

async function readCompletionDepartments(access: Access): Promise<CompletionSubject[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select employee.department as department,
             completion.attributes->>'course_code' as course_code
      from learning_completions completion
      left join employees employee
        on employee.id = completion.employee_id and employee.tenant_id = completion.tenant_id
      where completion.tenant_id = ${access.tenantId}
      order by completion.created_at desc
      limit 2000
    `,
  ]);
  return (rows as Array<{ department: string | null; course_code: string | null }>).map((row) => ({
    department: row.department ?? null,
    courseCode: str(row.course_code),
  }));
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                    */
/* -------------------------------------------------------------------------- */

export type CapabilityIntelligencePayload = {
  kpis: {
    courses: Source<number>;
    enrolments: Source<number>;
    completionPct: Source<number | null>;
    averageCapabilityIndex: Source<number | null>;
  };
  capabilityMovement: Source<CapabilityMovement>;
  learningFunnel: Source<LearningFunnel>;
  learningVolume: Source<LearningVolume>;
  unavailableSources: Array<{ name: string; message: string }>;
  generatedAt: string;
};

const EMPTY_MOVEMENT: CapabilityMovement = {
  axes: [],
  current: [],
  baselineRecorded: false,
  employeesScored: 0,
  employeesWithBaseline: 0,
  averageIndex: null,
  currentLabel: "Latest run",
  comparisonLabel: "Earliest recorded run",
  note: CAPABILITY_NO_SCORES_NOTE,
};

export async function readCapabilityIntelligence(access: Access): Promise<CapabilityIntelligencePayload> {
  const [learning, courses, runs, completions] = await Promise.all([
    source(
      () => readLearningProgress(access),
      null as Awaited<ReturnType<typeof readLearningProgress>> | null,
      "learning.readLearningProgress",
    ),
    source(() => listCourses(access), [] as unknown[], "learning.listCourses"),
    source(() => readCapabilityRuns(access), [] as CapabilityRunRow[], "analytics.capability_index_runs"),
    source(() => readCompletionDepartments(access), [] as CompletionSubject[], "learning_completions + employees"),
  ]);

  const projection = learning.value;
  const analytics = projection?.analytics ?? null;
  const enrolmentCards = projection?.enrollments ?? [];

  const movement = runs.available ? deriveCapabilityMovement(runs.value) : EMPTY_MOVEMENT;

  const durationMinutesByCourse = new Map<string, number | null>();
  for (const row of courses.value as Array<{ attributes: unknown }>) {
    const attributes = asRecord(row.attributes);
    const code = str(attributes.code);
    if (code) durationMinutesByCourse.set(code, numOrNull(attributes.duration_minutes));
  }

  const funnel = deriveLearningFunnel(
    enrolmentCards.map((card) => ({
      completed: card.state === "completed",
      scoreRecorded: card.scorePct !== null,
      certified: card.certificateHeld,
    })),
  );

  const volume = deriveLearningVolume({
    completions: completions.value,
    durationMinutesByCourse,
  });

  const sources = { learning, courses, capabilityRuns: runs, completions };
  const unavailableSources = Object.entries(sources)
    .filter(([, entry]) => !entry.available)
    .map(([name, entry]) => ({ name, message: entry.message ?? "Permission or source unavailable." }));

  return {
    kpis: {
      courses: learning.available && analytics
        ? derived(analytics.courses, "courses rows in this tenant")
        : { value: 0, available: false, message: learning.message, origin: "courses" },
      enrolments: learning.available && analytics
        ? derived(analytics.enrollments, "enrollments rows in this tenant")
        : { value: 0, available: false, message: learning.message, origin: "enrollments" },
      completionPct: learning.available && analytics
        ? derived(
            ratio(analytics.completed, analytics.enrollments),
            "Enrolments with a learning_completions row, over all enrolments",
          )
        : { value: null, available: false, message: learning.message, origin: "enrollments" },
      averageCapabilityIndex: runs.available
        ? derived(
            movement.averageIndex,
            `Mean of the latest capability_index_runs index per employee, formula mci/v2 weighted ${CAPABILITY_DIMENSIONS.map((dimension) => `${CAPABILITY_DIMENSION_LABELS[dimension]} ${MCI_WEIGHTS[dimension]}%`).join(", ")}`,
          )
        : { value: null, available: false, message: runs.message, origin: "capability_index_runs" },
    },
    capabilityMovement: runs.available
      ? derived(movement, "capability_index_runs, earliest and latest run per employee")
      : { value: EMPTY_MOVEMENT, available: false, message: runs.message, origin: "capability_index_runs" },
    learningFunnel: learning.available
      ? derived(funnel, "enrollments, learning_completions and employee_certifications")
      : { value: deriveLearningFunnel([]), available: false, message: learning.message, origin: "enrollments" },
    learningVolume: completions.available && courses.available
      ? derived(volume, "learning_completions joined to employees, priced by courses.attributes.duration_minutes")
      : {
          value: volume,
          available: false,
          message: completions.message ?? courses.message,
          origin: "learning_completions",
        },
    unavailableSources,
    generatedAt: new Date().toISOString(),
  };
}
