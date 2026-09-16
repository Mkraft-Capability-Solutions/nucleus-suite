"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, GraduationCap, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The enrollment's real state, as the API derives it from recorded rows. */
function statusTone(state: string): "success" | "warning" | "danger" | "info" | "violet" | "neutral" {
  if (state === "certified") return "violet";
  if (state === "verified") return "success";
  if (state === "in_progress") return "info";
  if (state === "assigned") return "neutral";
  return "neutral";
}

function dueTone(band: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (band === "overdue") return "danger";
  if (band === "due_today") return "warning";
  if (band === "due_soon") return "info";
  if (band === "closed") return "success";
  return "neutral";
}

function timelineTone(state: string): "success" | "info" | "neutral" | "danger" {
  if (state === "done") return "success";
  if (state === "current") return "info";
  if (state === "unreachable") return "danger";
  return "neutral";
}

type Gate = { allowed: boolean; reason: string | null };

type DuePosition = {
  band: string;
  dueDate: string | null;
  daysUntilDue: number | null;
  daysOverdue: number | null;
  closedLate: boolean | null;
  label: string;
  note: string;
};

type ProgressView = { percentComplete: number | null; tracked: boolean; basis: string };

type LearningRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  courseCode: string;
  courseTitle: string;
  learningPathLabel: string;
  learningPathCount: number;
  state: string;
  stateLabel: string;
  stateBasis: string;
  progress: ProgressView;
  due: DuePosition;
  scorePct: number | null;
  completedOn: string | null;
  certificationName: string | null;
  certificateHeld: boolean;
  complete: Gate;
  enrolledAt: string | null;
};

type StateSummary = { key: string; label: string; backed: boolean; basis: string; count: number };

type CourseOption = { code: string; title: string; mandatory: boolean };

type Queue = {
  scope: string;
  viewing: string;
  subjectEmployeeId: string | null;
  rows: LearningRow[];
  total: number;
  states: StateSummary[];
  assign: Gate;
  courses: CourseOption[];
  notes: { dueDate: string; progress: string; evidence: string; states: string };
  truncated: boolean;
};

type TimelineStep = { key: string; label: string; state: string; note: string };

type Detail = LearningRow & {
  timeline: TimelineStep[];
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
  evidence: { documentId: string; title: string | null; mimeType: string | null } | null;
  evidenceNote: string;
  certificateIssued: { id: string; issuedOn: string | null; expiresOn: string | null; credentialReference: string | null } | null;
  certificationIssuingBody: string | null;
  certificationValidityMonths: number | null;
};

function readGate(value: unknown): Gate {
  const gate = asRecord(value);
  return { allowed: gate.allowed === true, reason: nullableStr(gate.reason) };
}

function readDue(value: unknown): DuePosition {
  const due = asRecord(value);
  return {
    band: str(due.band, "no_due_date"),
    dueDate: nullableStr(due.dueDate),
    daysUntilDue: numOrNull(due.daysUntilDue),
    daysOverdue: numOrNull(due.daysOverdue),
    closedLate: typeof due.closedLate === "boolean" ? due.closedLate : null,
    label: str(due.label, "—"),
    note: str(due.note),
  };
}

function readProgress(value: unknown): ProgressView {
  const progress = asRecord(value);
  return {
    percentComplete: numOrNull(progress.percentComplete),
    tracked: progress.tracked === true,
    basis: str(progress.basis),
  };
}

function readRow(value: unknown): LearningRow {
  const item = asRecord(value);
  const certification = asRecord(item.certification);
  return {
    id: str(item.id),
    employeeId: str(item.employeeId),
    employeeName: str(item.employeeName, "This learner"),
    courseCode: str(item.courseCode, "—"),
    courseTitle: str(item.courseTitle, str(item.courseCode, "—")),
    learningPathLabel: str(item.learningPathLabel, "Not part of a learning path"),
    learningPathCount: int(item.learningPathCount),
    state: str(item.state, "assigned"),
    stateLabel: str(item.stateLabel, "Assigned"),
    stateBasis: str(asRecord(item.stateBacking).basis),
    progress: readProgress(item.progress),
    due: readDue(item.due),
    scorePct: numOrNull(item.scorePct),
    completedOn: nullableStr(item.completedOn),
    certificationName: nullableStr(certification.name),
    certificateHeld: item.certificateHeld === true,
    complete: readGate(item.complete),
    enrolledAt: nullableStr(item.enrolledAt),
  };
}

function readQueue(payload: unknown): Queue {
  const data = asRecord(asRecord(payload).data);
  const notes = asRecord(data.notes);
  return {
    scope: str(data.scope, "self"),
    viewing: str(data.viewing, "self"),
    subjectEmployeeId: nullableStr(data.subjectEmployeeId),
    rows: (Array.isArray(data.items) ? (data.items as unknown[]) : []).map(readRow),
    total: int(data.total),
    states: (Array.isArray(data.states) ? (data.states as unknown[]) : []).map((entry) => {
      const state = asRecord(entry);
      return {
        key: str(state.key),
        label: str(state.label),
        backed: state.backed === true,
        basis: str(state.basis),
        count: int(state.count),
      };
    }),
    assign: readGate(data.assign),
    courses: (Array.isArray(data.courses) ? (data.courses as unknown[]) : []).map((entry) => {
      const course = asRecord(entry);
      return { code: str(course.code), title: str(course.title, str(course.code)), mandatory: course.mandatory === true };
    }),
    notes: {
      dueDate: str(notes.dueDate),
      progress: str(notes.progress),
      evidence: str(notes.evidence),
      states: str(notes.states),
    },
    truncated: data.truncated === true,
  };
}

function readDetail(payload: unknown): Detail {
  const data = asRecord(asRecord(payload).data);
  const certification = asRecord(data.certification);
  const evidence = asRecord(data.evidence);
  const issued = asRecord(data.certificateIssued);
  return {
    ...readRow(data),
    timeline: (Array.isArray(data.timeline) ? (data.timeline as unknown[]) : []).map((entry) => {
      const step = asRecord(entry);
      return { key: str(step.key), label: str(step.label), state: str(step.state, "todo"), note: str(step.note) };
    }),
    auditTrail: (Array.isArray(data.auditTrail) ? (data.auditTrail as unknown[]) : []).map((entry) => {
      const event = asRecord(entry);
      return { action: str(event.action, "—"), reason: nullableStr(event.reason), createdAt: nullableStr(event.createdAt) };
    }),
    evidence: data.evidence
      ? { documentId: str(evidence.documentId), title: nullableStr(evidence.title), mimeType: nullableStr(evidence.mimeType) }
      : null,
    evidenceNote: str(data.evidenceNote),
    certificateIssued: data.certificateIssued
      ? {
          id: str(issued.id),
          issuedOn: nullableStr(issued.issuedOn),
          expiresOn: nullableStr(issued.expiresOn),
          credentialReference: nullableStr(issued.credentialReference),
        }
      : null,
    certificationIssuingBody: nullableStr(certification.issuingBody),
    certificationValidityMonths: numOrNull(certification.validityMonths),
  };
}

/**
 * Progress cell. A percentage is rendered only where one is genuinely recorded;
 * an open enrollment says the percentage is not tracked instead of drawing an
 * empty bar, which would read as 0% of the course done.
 */
function ProgressCell({ progress }: { progress: ProgressView }) {
  if (!progress.tracked || progress.percentComplete === null) {
    return (
      <span className="text-xs text-muted-foreground" title={progress.basis}>
        Not tracked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2" title={progress.basis}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-success" style={{ width: `${Math.min(Math.max(progress.percentComplete, 0), 100)}%` }} />
      </span>
      <span className="text-xs font-semibold tabular-nums text-foreground">{progress.percentComplete}%</span>
    </span>
  );
}

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function MyLearningPage() {
  // Deep-link preselect (?record=<enrollmentId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [stateFilter, setStateFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [learners, setLearners] = useState<Array<{ id: string; label: string }>>([]);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [assignCourse, setAssignCourse] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [completeScore, setCompleteScore] = useState("");
  const [completeBusy, setCompleteBusy] = useState(false);

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "100" });
    if (stateFilter !== "all") params.set("state", stateFilter);
    if (overdueOnly) params.set("overdue", "true");
    if (search.trim()) params.set("q", search.trim());
    if (learnerId) params.set("employeeId", learnerId);
    return params.toString();
  }, [stateFilter, overdueOnly, search, learnerId]);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getJson(`/api/v1/my-learning?${queryString}`);
        if (live) setQueue(readQueue(payload));
      } catch (err) {
        if (live) {
          setQueue(null);
          setError(err instanceof Error ? err.message : "Your learning queue could not be loaded.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [queryString, revision]);

  // A caller who may assign learning may also look at another learner's queue;
  // the directory is fetched only for that caller, and self stays the default.
  const canBrowseLearners = queue?.scope === "all";
  useEffect(() => {
    if (!canBrowseLearners) return;
    let live = true;
    void (async () => {
      try {
        const payload = await getJson("/api/v1/people?page=1&pageSize=100");
        const rows = (Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : []).map((item) => {
          const name = [str(item.firstName), str(item.lastName)].filter(Boolean).join(" ").trim();
          const code = str(item.employeeCode);
          return { id: str(item.id), label: `${name || "Unnamed"}${code ? ` · ${code}` : ""}` };
        });
        if (live) setLearners(rows.filter((row) => row.id));
      } catch {
        if (live) setLearners([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [canBrowseLearners, revision]);

  const rows = useMemo(() => queue?.rows ?? [], [queue]);
  const activeId = useMemo(() => (rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id ?? ""), [rows, selectedId]);

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const payload = await getJson(`/api/v1/my-learning?enrollmentId=${encodeURIComponent(activeId)}`);
        if (live) setDetail(readDetail(payload));
      } catch (err) {
        if (live) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "This enrollment could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  // Assign learning is POST /api/v1/enrollments — the endpoint that already
  // owns enrolment. This screen does not introduce a second writer.
  const assignLearning = useCallback(async () => {
    const subject = queue?.subjectEmployeeId;
    if (!subject || !assignCourse) return;
    setAssignBusy(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await fetch("/api/v1/enrollments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ employeeId: subject, courseCode: assignCourse, ...(assignDueDate ? { dueDate: assignDueDate } : {}) }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(body, response.status, `The enrolment failed (${response.status}).`));
      }
      setAssignCourse("");
      setAssignDueDate("");
      setActionNotice("Learning assigned. A due date, if you set one, is stored but nothing acts on it.");
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The enrolment could not be recorded.");
    } finally {
      setAssignBusy(false);
    }
  }, [queue, assignCourse, assignDueDate, refresh]);

  // Record completion is POST /api/v1/enrollments/:id/complete, which writes the
  // learning_completions row and the verified status in one transaction.
  const recordCompletion = useCallback(async () => {
    if (!detail || !detail.complete.allowed) return;
    const score = completeScore.trim();
    setCompleteBusy(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await fetch(`/api/v1/enrollments/${encodeURIComponent(detail.id)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(score ? { scorePct: Number(score) } : {}),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(body, response.status, `Recording the completion failed (${response.status}).`));
      }
      setCompleteScore("");
      setActionNotice("Completion recorded. This single event is both the completion and the verification.");
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The completion could not be recorded.");
    } finally {
      setCompleteBusy(false);
    }
  }, [detail, completeScore, refresh]);

  // The fetched detail belongs to a specific row; drop it the moment the
  // selection no longer matches rather than leaving a stale panel on screen.
  const activeDetail = detail && detail.id === activeId ? detail : null;

  const overdueCount = rows.filter((row) => row.due.band === "overdue").length;
  const unbackedStates = (queue?.states ?? []).filter((state) => !state.backed);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="LEARNING · SCR-063"
        title="My learning"
        description="Your own learning queue: the path each enrolment belongs to, the date it is due, the progress actually recorded against it, and its status."
        action={
          <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
            <RefreshCcw className="mr-1.5 size-4" /> Refresh
          </Button>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="What this screen can and cannot tell you"
          description="Assign learning → record completion. The completion writes the verified status and the learning_completions row in one transaction, and issues the course's certification where the course defines one."
          action={
            <StatusPill tone="warning" dot>
              {unbackedStates.length} of 5 states unbacked
            </StatusPill>
          }
        />
        <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Status. </span>
            {queue?.notes.states || "Assigned, Verified and Certified are backed by recorded data. In progress has no writer, and Completed is the same recorded event as Verified."}
          </li>
          <li>
            <span className="font-semibold text-foreground">Progress. </span>
            {queue?.notes.progress || "Progress percentage is not tracked anywhere in this system, so an open enrolment reports no percentage rather than zero."}
          </li>
          <li>
            <span className="font-semibold text-foreground">Due date. </span>
            {queue?.notes.dueDate || "Nothing in this system acts on a due date. The overdue position below is computed for display only."}
          </li>
          <li>
            <span className="font-semibold text-foreground">Completion evidence. </span>
            {queue?.notes.evidence || "Completion evidence cannot be uploaded from this screen: learning_completions.document_id has no writer, so an uploaded file would never be linked to the completion."}
          </li>
        </ul>
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Search learning" className={inputClass} placeholder="Course or path" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Status filter" className={selectClass} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {(queue?.states ?? []).map((state) => (
              <option key={state.key} value={state.key}>
                {`${state.label} (${state.count})${state.backed ? "" : " · unbacked"}`}
              </option>
            ))}
          </select>
          <label className="flex w-full min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground sm:w-auto">
            <input type="checkbox" aria-label="Overdue only" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            Overdue only ({overdueCount})
          </label>
          {canBrowseLearners ? (
            <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <span className="text-xs font-bold text-muted-foreground">Learner</span>
              <select
                aria-label="Learner"
                className={selectClass}
                value={learnerId}
                onChange={(e) => {
                  setLearnerId(e.target.value);
                  setSelectedId("");
                }}
              >
                <option value="">My own learning</option>
                {learners.map((learner) => (
                  <option key={learner.id} value={learner.id}>{learner.label}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <StatusPill tone={queue?.viewing === "self" ? "info" : "warning"}>
          {queue?.viewing === "self" ? "Viewing your own learning" : queue?.viewing === "other" ? "Viewing another learner" : "Viewing the whole tenant"}
        </StatusPill>
      </div>

      {actionError ? (
        <Surface className="mb-6 border-destructive/40">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {actionError}
          </p>
        </Surface>
      ) : null}
      {actionNotice ? (
        <Surface className="mb-6 border-success/40">
          <p className="text-xs leading-relaxed text-muted-foreground">{actionNotice}</p>
        </Surface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="My learning"
            description={loading ? "Loading…" : `${rows.length} enrolment${rows.length === 1 ? "" : "s"}${queue?.truncated ? " (capped at the first 500 rows)" : ""}`}
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
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {stateFilter !== "all" || overdueOnly || search.trim()
                ? "No enrolments match these filters."
                : "Nothing is assigned to you yet. An enrolment appears here once somebody with the employee.write permission assigns a course."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Learning path</th>
                    <th className="px-3 py-2 font-bold">Due date</th>
                    <th className="px-3 py-2 font-bold">Progress</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const selected = row.id === activeId;
                    return (
                      <tr key={row.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[1.6fr_1fr_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.learningPathLabel}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{row.courseTitle} ({row.courseCode})</span>
                            </span>
                            <span className="text-xs text-muted-foreground" title={row.due.note}>
                              {row.due.dueDate ?? "No due date"}
                              {row.due.band === "overdue" || row.due.band === "due_today" ? (
                                <span className="ml-1.5"><StatusPill tone={dueTone(row.due.band)}>{row.due.label}</StatusPill></span>
                              ) : null}
                            </span>
                            <ProgressCell progress={row.progress} />
                            <span><StatusPill tone={statusTone(row.state)}>{row.stateLabel}</StatusPill></span>
                            <ChevronRight className="size-4 justify-self-end text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 border-t border-border/60 pt-4">
            <SectionHeading
              title="Assign learning"
              description="Enrols a learner on a course through POST /api/v1/enrollments. The due date is optional and, once stored, nothing acts on it."
              action={<GraduationCap className="size-4 text-muted-foreground" />}
            />
            {!queue?.assign.allowed ? (
              <p className="rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {queue?.assign.reason ?? "Assigning learning is not available to this account."}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Course" className={selectClass} value={assignCourse} onChange={(e) => setAssignCourse(e.target.value)}>
                  <option value="">Select a course</option>
                  {(queue?.courses ?? []).map((course) => (
                    <option key={course.code} value={course.code}>{`${course.title}${course.mandatory ? " · mandatory" : ""}`}</option>
                  ))}
                </select>
                <input aria-label="Due date" type="date" className={inputClass} value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
                <Button
                  size="sm"
                  className="h-10 rounded-xl px-4 text-xs font-bold"
                  disabled={assignBusy || !assignCourse}
                  onClick={() => void assignLearning()}
                >
                  {assignBusy ? "Assigning…" : "Assign learning"}
                </Button>
                {!assignCourse ? <span className="text-xs text-muted-foreground">Select a course to enable this.</span> : null}
              </div>
            )}
          </div>
        </Surface>

        <Surface>
          <SectionHeading
            title="Enrolment detail"
            description={activeDetail ? `${activeDetail.courseTitle} · ${activeDetail.employeeName}` : "Select an enrolment to inspect it"}
            action={activeDetail ? <StatusPill tone={statusTone(activeDetail.state)}>{activeDetail.stateLabel}</StatusPill> : undefined}
          />
          {detailLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : detailError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
              <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : !activeDetail ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No enrolment selected.</p>
          ) : (
            <div>
              <dl className="space-y-2 text-xs">
                {[
                  ["Learning path", activeDetail.learningPathCount > 1 ? `${activeDetail.learningPathLabel}` : activeDetail.learningPathLabel],
                  ["Course", `${activeDetail.courseTitle} (${activeDetail.courseCode})`],
                  ["Enrolled", activeDetail.enrolledAt ? activeDetail.enrolledAt.slice(0, 10) : "—"],
                  ["Due date", activeDetail.due.dueDate ?? "None recorded"],
                  ["Due position", activeDetail.due.label],
                  ["Progress", activeDetail.progress.tracked && activeDetail.progress.percentComplete !== null ? `${activeDetail.progress.percentComplete}%` : "Not tracked"],
                  ["Score", activeDetail.scorePct === null ? "Not recorded" : `${activeDetail.scorePct}%`],
                  ["Completed on", activeDetail.completedOn ?? "Not completed"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{activeDetail.due.note}</p>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ul className="mt-2 space-y-1.5">
                {activeDetail.timeline.map((step) => (
                  <li key={step.key} className="flex items-start justify-between gap-3 border-b border-border/40 pb-1.5">
                    <span className="text-xs text-muted-foreground" title={step.note}>{step.label}</span>
                    <StatusPill tone={timelineTone(step.state)}>{step.state === "unreachable" ? "no writer" : step.state}</StatusPill>
                  </li>
                ))}
              </ul>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Certification</h3>
              {activeDetail.certificationName ? (
                <div className="mt-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">{activeDetail.certificationName}</p>
                  <p>
                    {activeDetail.certificationIssuingBody ? `Issued by ${activeDetail.certificationIssuingBody}. ` : ""}
                    {activeDetail.certificationValidityMonths ? `Valid for ${activeDetail.certificationValidityMonths} months. ` : ""}
                    {activeDetail.certificateIssued
                      ? `Held since ${activeDetail.certificateIssued.issuedOn ?? "an unrecorded date"}${activeDetail.certificateIssued.expiresOn ? `, expires ${activeDetail.certificateIssued.expiresOn}` : ""}. Reference ${activeDetail.certificateIssued.credentialReference ?? "—"}.`
                      : "Not yet held; completing this course issues it."}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  This course defines no certification, so completing it issues no certificate and the Certified state cannot be reached for this enrolment.
                </p>
              )}

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Completion evidence</h3>
              {activeDetail.evidence ? (
                <p className="mt-2 text-xs leading-relaxed text-foreground">
                  {activeDetail.evidence.title ?? "Linked document"}
                  {activeDetail.evidence.mimeType ? ` · ${activeDetail.evidence.mimeType}` : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{activeDetail.evidenceNote}</p>
              )}

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Record completion</h3>
              {!activeDetail.complete.allowed ? (
                <p className="mt-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {activeDetail.complete.reason ?? "Recording a completion is not available for this enrolment."}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Score percent"
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="Score % (optional)"
                    value={completeScore}
                    onChange={(e) => setCompleteScore(e.target.value)}
                  />
                  <Button size="sm" className="h-10 rounded-xl px-4 text-xs font-bold" disabled={completeBusy} onClick={() => void recordCompletion()}>
                    {completeBusy ? "Recording…" : "Record completion"}
                  </Button>
                </div>
              )}

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {activeDetail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  No audit event is recorded against this enrolment. enrollEmployee writes no audit row, so an assignment leaves no trail; only a completion does.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {activeDetail.auditTrail.map((event, index) => (
                    <li key={`${event.action}-${index}`} className="flex items-start justify-between gap-3 border-b border-border/40 pb-1.5 text-xs">
                      <span className="text-muted-foreground">{event.reason ?? event.action}</span>
                      <span className="shrink-0 tabular-nums text-foreground">{event.createdAt ? event.createdAt.slice(0, 10) : "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
