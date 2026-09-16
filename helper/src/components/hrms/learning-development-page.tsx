"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, GraduationCap, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function intOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Compliance = "complete" | "mandatory_outstanding" | "in_progress" | "not_enrolled";
type EnrollmentState = "not_started" | "in_progress" | "completed";

type CourseCard = {
  id: string;
  code: string;
  title: string;
  category: string | null;
  provider: string | null;
  durationMinutes: number | null;
  mandatory: boolean;
  compliance: Compliance;
  complianceBasis: string;
  cohort: { enrolled: number; completed: number; inProgress: number; notStarted: number; completionRatePct: number | null };
  certification: { id: string; name: string; issuingBody: string | null; validityMonths: number | null; holders: number } | null;
  certificationNote: string;
};

type EnrollmentCard = {
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

type Analytics = {
  courses: number;
  mandatoryCourses: number;
  enrollments: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRatePct: number | null;
  mandatoryCoveragePct: number | null;
  mandatoryOutstandingCourses: number;
  timeToCompletion: { samples: number; medianDays: number | null; averageDays: number | null; basis: string };
  certificatesIssued: number;
  coursesDefiningCertification: number;
  sources: Record<string, string>;
  impact: { roiPct: number | null; computed: boolean; statement: string; missing: string[] };
};

/** The card badge, derived from recorded state only — never from a target. */
function statusTone(compliance: Compliance): "success" | "warning" | "info" | "neutral" {
  if (compliance === "complete") return "success";
  if (compliance === "mandatory_outstanding") return "warning";
  if (compliance === "in_progress") return "info";
  return "neutral";
}

function complianceLabel(compliance: Compliance): string {
  if (compliance === "complete") return "All enrollments verified";
  if (compliance === "mandatory_outstanding") return "Mandatory · outstanding";
  if (compliance === "in_progress") return "In progress";
  return "No enrollments";
}

function stateLabel(state: EnrollmentState): string {
  if (state === "completed") return "Completed";
  if (state === "in_progress") return "In progress";
  return "Not started";
}

function stateTone(state: EnrollmentState): "success" | "info" | "neutral" {
  if (state === "completed") return "success";
  if (state === "in_progress") return "info";
  return "neutral";
}

function durationLabel(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "Duration not recorded";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function pctLabel(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

/**
 * A plain inline bar rather than components/ui/progress.tsx: that component is
 * unused in this codebase and imports `cn` from the bare "cn" package while
 * every hrms file imports it from @/lib/utils. Two divs avoid taking on that
 * inconsistency, and let the bar render an explicit untracked state.
 */
function CohortBar({ completed, enrolled }: { completed: number; enrolled: number }) {
  if (enrolled === 0) {
    return (
      <div className="mt-3">
        <div className="h-1.5 w-full rounded-full bg-secondary" />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">No enrollments, so there is no completion figure to show.</p>
      </div>
    );
  }
  const pct = Math.round((completed / enrolled) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cohort completion</span>
        <span className="text-[11px] font-bold tabular-nums text-foreground">{completed} of {enrolled}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${completed} of ${enrolled} enrollments verified complete`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Verified enrollments over total enrollments. Per-learner progress is not tracked anywhere in this system.
      </p>
    </div>
  );
}

export function LearningDevelopmentPage() {
  // Deep-link preselect (?record=<courseId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentCard[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [pathOpen, setPathOpen] = useState(false);
  const [pathCode, setPathCode] = useState("");
  const [pathTitle, setPathTitle] = useState("");
  const [pathCourses, setPathCourses] = useState("");

  const [enrollCourse, setEnrollCourse] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [certCourse, setCertCourse] = useState("");
  const [certName, setCertName] = useState("");
  const [certBody, setCertBody] = useState("");
  const [certValidity, setCertValidity] = useState("");

  const [scorePct, setScorePct] = useState("");
  const [busy, setBusy] = useState(false);
  const [completingId, setCompletingId] = useState("");
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson("/api/v1/learning-progress");
        const data = asRecord(asRecord(raw).data);
        if (live) {
          setCourses(Array.isArray(data.courses) ? (data.courses as CourseCard[]) : []);
          setEnrollments(Array.isArray(data.enrollments) ? (data.enrollments as EnrollmentCard[]) : []);
          setAnalytics((asRecord(data.analytics) as Analytics) ?? null);
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Learning data could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const course of courses) if (course.category) set.add(course.category);
    return Array.from(set).sort();
  }, [courses]);

  const filtered = useMemo(
    () =>
      courses.filter((course) => {
        if (categoryFilter === "uncategorised" && course.category) return false;
        if (categoryFilter !== "all" && categoryFilter !== "uncategorised" && course.category !== categoryFilter) return false;
        if (statusFilter !== "all" && course.compliance !== statusFilter) return false;
        return true;
      }),
    [courses, categoryFilter, statusFilter],
  );

  const activeCourse = useMemo(
    () => courses.find((course) => course.id === selectedId) ?? null,
    [courses, selectedId],
  );

  const activeEnrollments = useMemo(
    () => (activeCourse ? enrollments.filter((row) => row.courseCode === activeCourse.code) : enrollments),
    [enrollments, activeCourse],
  );

  async function send(path: string, body: UnknownRecord, idempotent: boolean): Promise<UnknownRecord> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (idempotent) headers["Idempotency-Key"] = crypto.randomUUID();
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, `Request failed (${response.status})`));
    return asRecord(asRecord(payload).data);
  }

  async function createPath(): Promise<void> {
    setFormError("");
    setFormOk("");
    const codes = pathCourses.split(",").map((code) => code.trim()).filter(Boolean);
    if (!pathCode.trim() || !pathTitle.trim()) {
      setFormError("A path code and title are required.");
      return;
    }
    if (codes.length === 0) {
      setFormError("At least one course code is required, comma separated.");
      return;
    }
    setBusy(true);
    try {
      await send("/api/v1/learning-paths", { code: pathCode.trim(), title: pathTitle.trim(), courseCodes: codes }, false);
      setFormOk(`Learning path ${pathCode.trim()} created.`);
      setPathCode("");
      setPathTitle("");
      setPathCourses("");
      setPathOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The learning path could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function enroll(): Promise<void> {
    setFormError("");
    setFormOk("");
    if (!enrollCourse) {
      setFormError("Choose a course to enroll into.");
      return;
    }
    if (!UUID_RE.test(employeeId.trim())) {
      setFormError("Employee id must be a valid UUID.");
      return;
    }
    if (dueDate.trim() && !DATE_RE.test(dueDate.trim())) {
      setFormError("Due date must use YYYY-MM-DD.");
      return;
    }
    setBusy(true);
    try {
      const body: UnknownRecord = { employeeId: employeeId.trim(), courseCode: enrollCourse };
      if (dueDate.trim()) body.dueDate = dueDate.trim();
      await send("/api/v1/enrollments", body, false);
      setFormOk(`Enrollment assigned on ${enrollCourse}. It is recorded as not started until a completion is verified.`);
      setEmployeeId("");
      setDueDate("");
      setEnrollCourse("");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The enrollment could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function complete(id: string): Promise<void> {
    setFormError("");
    setFormOk("");
    const body: UnknownRecord = { action: "complete", enrollmentId: id };
    if (scorePct.trim()) {
      const score = Number(scorePct);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        setFormError("Score must be a number between 0 and 100.");
        return;
      }
      body.scorePct = score;
    }
    setCompletingId(id);
    try {
      const data = await send("/api/v1/learning-progress", body, true);
      const certificate = asRecord(data.certificate);
      setFormOk(`Completion verified. ${str(certificate.note, "")}`.trim());
      setScorePct("");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The completion could not be recorded.");
    } finally {
      setCompletingId("");
    }
  }

  async function defineCertification(): Promise<void> {
    setFormError("");
    setFormOk("");
    if (!certCourse || !certName.trim() || !certBody.trim()) {
      setFormError("A course, a certification name and an issuing body are required.");
      return;
    }
    const body: UnknownRecord = { action: "define_certification", courseCode: certCourse, name: certName.trim(), issuingBody: certBody.trim() };
    if (certValidity.trim()) {
      const months = Number(certValidity);
      if (!Number.isInteger(months) || months <= 0) {
        setFormError("Validity must be a whole number of months.");
        return;
      }
      body.validityMonths = months;
    }
    setBusy(true);
    try {
      const data = await send("/api/v1/learning-progress", body, true);
      setFormOk(data.duplicate === true ? `${certCourse} already defines a certification.` : `${certName.trim()} is now awarded on completion of ${certCourse}.`);
      setCertCourse("");
      setCertName("");
      setCertBody("");
      setCertValidity("");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The certification could not be defined.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Learning and development · SCR-063"
        title="Learning and development"
        description="Course catalogue, enrollment state and the learning analytics that are computable from recorded data. Every figure on this screen names the rows it is derived from."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setFormError("");
                setFormOk("");
                setPathOpen((open) => !open);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Create learning path
            </Button>
          </div>
        }
      />

      {pathOpen ? (
        <Surface className="mb-6">
          <SectionHeading title="New learning path" description="Group existing course codes into a path. This writes a learning_paths record through the existing endpoint." />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex w-full min-w-0 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Path code</span>
              <input aria-label="Path code" className={`${inputClass} font-mono`} value={pathCode} onChange={(e) => setPathCode(e.target.value)} placeholder="WEAVE-L2" />
            </label>
            <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Path title</span>
              <input aria-label="Path title" className={inputClass} value={pathTitle} onChange={(e) => setPathTitle(e.target.value)} placeholder="Weaving level 2" />
            </label>
            <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Course codes, comma separated</span>
              <input aria-label="Course codes" className={`${inputClass} font-mono`} value={pathCourses} onChange={(e) => setPathCourses(e.target.value)} placeholder="WEAVE-101, SAFETY-01" />
            </label>
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy} onClick={() => void createPath()}>
              {busy ? "Saving…" : "Create path"}
            </Button>
          </div>
        </Surface>
      ) : null}

      <Surface className="mb-6">
        <SectionHeading
          title="Learning impact analytics"
          description="Counts and rates computed from courses, enrollments, learning_completions and employee_certifications. Each tile names its source."
        />
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : !analytics ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No learning analytics are available for this tenant yet.</p>
        ) : (
          <div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  value: pctLabel(analytics.completionRatePct),
                  label: `Completion rate · ${analytics.completed} of ${analytics.enrollments} enrollments`,
                  note: analytics.enrollments === 0 ? "No enrollments exist, so no rate is computed." : analytics.sources.completionRatePct,
                },
                {
                  value: pctLabel(analytics.mandatoryCoveragePct),
                  label: `Mandatory coverage · ${analytics.mandatoryOutstandingCourses} of ${analytics.mandatoryCourses} outstanding`,
                  note: analytics.mandatoryCourses === 0 ? "No course is flagged mandatory, so no coverage is computed." : analytics.sources.mandatoryCoveragePct,
                },
                {
                  value: analytics.timeToCompletion.medianDays === null ? "—" : `${analytics.timeToCompletion.medianDays} d`,
                  label: `Median time to completion · ${analytics.timeToCompletion.samples} sample${analytics.timeToCompletion.samples === 1 ? "" : "s"}`,
                  note: analytics.timeToCompletion.basis,
                },
                {
                  value: String(analytics.certificatesIssued),
                  label: `Certificates held · ${analytics.coursesDefiningCertification} of ${analytics.courses} courses define one`,
                  note: analytics.sources.certificatesIssued,
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                  <p className="text-[26px] font-bold leading-8 tabular-nums text-foreground">{tile.value}</p>
                  <p className="mt-1 text-[12px] font-semibold text-foreground">{tile.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tile.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Learning ROI is not computed</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{analytics.impact.statement}</p>
              <ul className="mt-2 space-y-1">
                {analytics.impact.missing.map((item) => (
                  <li key={item} className="text-[11px] leading-relaxed text-muted-foreground">— {item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-3 rounded-xl border border-border/70 bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">What this screen does not have</p>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                <li>— Per-learner progress. {analytics.sources.learnerProgress}</li>
                <li>— A content marketplace. No external learning provider is modelled anywhere in the system, so there is nothing for a marketplace to browse or buy from.</li>
                <li>— Automated path curation. Paths are created by naming course codes; nothing scores or recommends a sequence.</li>
                <li>— Due-date or assignment rules. Compliance is the courses.attributes.mandatory flag and nothing else.</li>
              </ul>
            </div>
          </div>
        )}
      </Surface>

      <Surface className="mb-6">
        <SectionHeading
          title="Course catalogue"
          description={loading ? "Loading…" : `${filtered.length} course${filtered.length === 1 ? "" : "s"} in the current scope`}
          action={
            <div className="flex flex-wrap gap-2">
              <select aria-label="Category filter" className={selectClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                <option value="uncategorised">No category recorded</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select aria-label="Status filter" className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="complete">All enrollments verified</option>
                <option value="mandatory_outstanding">Mandatory outstanding</option>
                <option value="in_progress">In progress</option>
                <option value="not_enrolled">No enrollments</option>
              </select>
            </div>
          }
        />
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            {courses.length === 0 ? "No courses have been created yet. Courses are created through the learning catalogue endpoint." : "No courses match these filters."}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((course) => {
              const selected = course.id === selectedId;
              return (
                <Surface
                  key={course.id}
                  className={`flex flex-col border ${selected ? "border-primary/50 bg-primary/5" : "border-border/80"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {course.category ?? "No category recorded"}
                    </span>
                    <StatusPill tone={statusTone(course.compliance)}>{complianceLabel(course.compliance)}</StatusPill>
                  </div>

                  <button
                    type="button"
                    className="mt-2 text-left"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => setSelectedId(selected ? "" : course.id)}
                  >
                    <p className="font-heading text-sm font-semibold text-foreground">{course.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{course.code || "No code"}</p>
                  </button>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {course.provider ?? "No provider recorded"} · {durationLabel(course.durationMinutes)}
                    {course.mandatory ? " · Mandatory" : ""}
                  </p>

                  <CohortBar completed={course.cohort.completed} enrolled={course.cohort.enrolled} />

                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/30 p-2.5">
                    {course.certification ? (
                      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-foreground">
                        {course.certification
                          ? `${course.certification.name} · ${course.certification.issuingBody ?? "Issuer not recorded"}`
                          : "No certification defined"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {course.certification
                          ? `${course.certification.holders} holder${course.certification.holders === 1 ? "" : "s"}${course.certification.validityMonths ? ` · valid ${course.certification.validityMonths} months` : " · no expiry recorded"}. ${course.certificationNote}`
                          : course.certificationNote}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{course.complianceBasis}</p>

                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <Button
                      size="sm"
                      className="h-10 sm:h-8 rounded-lg text-xs font-semibold"
                      disabled={!course.code}
                      onClick={() => {
                        setFormError("");
                        setFormOk("");
                        setSelectedId(course.id);
                        setEnrollCourse(course.code);
                      }}
                    >
                      Enroll employee
                    </Button>
                    {course.certification ? null : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 sm:h-8 rounded-lg text-xs font-semibold"
                        disabled={!course.code}
                        onClick={() => {
                          setFormError("");
                          setFormOk("");
                          setCertCourse(course.code);
                        }}
                      >
                        Define certification
                      </Button>
                    )}
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
      </Surface>

      {enrollCourse ? (
        <Surface className="mb-6">
          <SectionHeading title={`Enroll into ${enrollCourse}`} description="Assigns the course to an employee. The enrollment is recorded as not started until a completion is verified." />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee</span>
              <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" ariaLabel="Employee" className={inputClass} value={employeeId} onChange={setEmployeeId} />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Due date (optional)</span>
              <input aria-label="Due date" className={`${inputClass} font-mono`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="2026-10-31" />
            </label>
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy} onClick={() => void enroll()}>
              {busy ? "Saving…" : "Assign enrollment"}
            </Button>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={() => setEnrollCourse("")}>
              Cancel
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            A due date is stored on the enrollment but nothing acts on it: there is no escalation, no reminder and no overdue queue in this system.
          </p>
        </Surface>
      ) : null}

      {certCourse ? (
        <Surface className="mb-6">
          <SectionHeading title={`Define the certification awarded by ${certCourse}`} description="Recorded against the certifications table and issued to the learner on verified completion." />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Certification name</span>
              <input aria-label="Certification name" className={inputClass} value={certName} onChange={(e) => setCertName(e.target.value)} placeholder="Loom safety" />
            </label>
            <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Issuing body</span>
              <input aria-label="Issuing body" className={inputClass} value={certBody} onChange={(e) => setCertBody(e.target.value)} placeholder="Plant EHS" />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 lg:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Validity months (optional)</span>
              <input aria-label="Validity months" className={inputClass} value={certValidity} onChange={(e) => setCertValidity(e.target.value)} placeholder="12" inputMode="numeric" />
            </label>
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy} onClick={() => void defineCertification()}>
              {busy ? "Saving…" : "Define certification"}
            </Button>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={() => setCertCourse("")}>
              Cancel
            </Button>
          </div>
        </Surface>
      ) : null}

      <Surface>
        <SectionHeading
          title={activeCourse ? `Enrollments · ${activeCourse.code}` : "Enrollments"}
          description={
            activeCourse
              ? "Selected from the catalogue above. Select the card again to see every enrollment."
              : "Every enrollment in scope. Completion verifies the enrollment and issues the certification where the course defines one."
          }
          action={
            <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Score (optional)</span>
              <input aria-label="Completion score" className={"h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground sm:w-20"} value={scorePct} onChange={(e) => setScorePct(e.target.value)} placeholder="85" inputMode="numeric" />
            </label>
          }
        />
        {formError ? <p className="mb-3 text-xs leading-relaxed text-destructive">{formError}</p> : null}
        {formOk ? <p className="mb-3 text-xs leading-relaxed text-success">{formOk}</p> : null}
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : activeEnrollments.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            {enrollments.length === 0 ? "No enrollments exist yet. Use Enroll employee on a course above." : "No enrollments exist for the selected course."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-bold">Course</th>
                  <th className="px-3 py-2 font-bold">Employee</th>
                  <th className="px-3 py-2 font-bold">State</th>
                  <th className="px-3 py-2 font-bold">Progress</th>
                  <th className="px-3 py-2 text-right font-bold">Score</th>
                  <th className="px-3 py-2 font-bold">Certificate</th>
                  <th className="px-3 py-2 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeEnrollments.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-foreground">{row.courseTitle || row.courseCode}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{row.courseCode || "No code"}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{row.employeeId.slice(0, 8)}</td>
                    <td className="px-3 py-2.5"><StatusPill tone={stateTone(row.state)}>{stateLabel(row.state)}</StatusPill></td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-foreground">{row.progressTracked ? `${numOrNull(row.percentComplete) ?? 0}%` : "Not tracked"}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{row.progressBasis}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">{row.scorePct === null ? "—" : `${row.scorePct}`}</td>
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{row.certificateHeld ? "Held" : "None"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 sm:h-8 rounded-lg text-xs font-semibold"
                        disabled={row.state === "completed" || completingId === row.id}
                        onClick={() => void complete(row.id)}
                      >
                        {completingId === row.id ? "Saving…" : row.state === "completed" ? "Verified" : "Record completion"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {analytics ? (
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            {intOrZero(analytics.notStarted)} not started · {intOrZero(analytics.inProgress)} in progress · {intOrZero(analytics.completed)} completed, out of {intOrZero(analytics.enrollments)} enrollments.
          </p>
        ) : null}
      </Surface>
    </div>
  );
}
