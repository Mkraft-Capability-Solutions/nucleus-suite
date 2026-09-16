"use client";

import { picklistLabel, picklistValues } from "@/lib/picklists";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage, getJson } from "@/lib/client-api";
import { ReferencePicker } from "./register-primitives";
import { CapabilityBars, WorkforceChart } from "./charts";
import {
  AiLabel,
  AvatarMark,
  PageIntro,
  SectionHeading,
  StatusPill,
  Surface,
} from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function listOf(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is UnknownRecord => typeof item === "object" && item !== null);
}

function attrsOf(item: UnknownRecord): UnknownRecord {
  return asRecord(item.attributes);
}

function shortId(value: unknown): string {
  const raw = str(value);
  if (!raw) return "—";
  return raw.length > 8 ? `${raw.slice(0, 8)}…` : raw;
}

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatDate(value: unknown): string {
  const raw = str(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

async function errorDetail(response: Response, path: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as unknown;
  return apiErrorMessage(body, response.status, `Request failed (${response.status}): ${path}`);
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, path));
  }
  return (await response.json().catch(() => null)) as unknown;
}

function LoadingNote() {
  return <p className="py-6 text-center font-mono text-xs text-muted-foreground">Loading…</p>;
}

function ErrorNote({ message }: { message: string }) {
  return <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">{message}</p>;
}

function EmptyNote({ message }: { message: string }) {
  return <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">{message}</p>;
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-start justify-items-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full min-w-0 max-w-lg rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="min-h-10 shrink-0 rounded-lg text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-foreground">
      {label}
      <span className="mt-1.5 block font-normal">{children}</span>
      {hint ? <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function FormStatus({ error, success }: { error: string; success: string }) {
  if (error) return <p className="rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-foreground">{error}</p>;
  if (success) return <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">{success}</p>;
  return null;
}

export function PerformancePage() {
  const [entries, setEntries] = useState<UnknownRecord[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noSubject, setNoSubject] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<"cycle" | "objective" | "request" | "entry" | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [cycleCode, setCycleCode] = useState("");
  const [cycleName, setCycleName] = useState("");
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [requestSubject, setRequestSubject] = useState("");
  const [providerId, setProviderId] = useState("");
  const [requestPrompt, setRequestPrompt] = useState("");
  const [entryRequestId, setEntryRequestId] = useState("");
  const [entryAuthor, setEntryAuthor] = useState("");
  const [entryBody, setEntryBody] = useState("");
  const [entryRating, setEntryRating] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const membershipsBody = await getJson("/api/v1/identity/memberships");
        const memberships = listOf(asRecord(membershipsBody).memberships);
        const employeeId =
          memberships.map((membership) => str(membership.employeeId)).find((id) => id.length > 0) ?? "";
        if (!employeeId) {
          if (!cancelled) {
            setNoSubject(true);
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setSubjectId(employeeId);
          setOwnerId((current) => current || employeeId);
          setRequestSubject((current) => current || employeeId);
          setEntryAuthor((current) => current || employeeId);
        }
        const feedbackBody = await getJson(
          `/api/v1/feedback?subjectEmployeeId=${encodeURIComponent(employeeId)}`
        );
        const payload = asRecord(asRecord(feedbackBody).data);
        if (!cancelled) {
          setEntries(listOf(payload.entries));
          setAnonymous(payload.anonymous === true);
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Feedback could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function open(m: "cycle" | "objective" | "request" | "entry") {
    setMode(m);
    setFormError("");
    setFormSuccess("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !mode) return;
    setFormError("");
    setFormSuccess("");
    setSaving(true);
    try {
      if (mode === "cycle") {
        const body: UnknownRecord = {};
        if (cycleCode.trim()) body.code = cycleCode.trim();
        if (cycleName.trim()) body.name = cycleName.trim();
        await postJson("/api/v1/review-cycles", body);
        setFormSuccess("Review cycle created successfully.");
      } else if (mode === "objective") {
        if (!objectiveTitle.trim()) throw new Error("A title is required.");
        if (!isUuid(ownerId)) throw new Error("Owner employee id must be a valid UUID.");
        await postJson("/api/v1/objectives", { title: objectiveTitle.trim(), ownerEmployeeId: ownerId.trim() });
        setFormSuccess("Objective saved successfully.");
        setObjectiveTitle("");
      } else if (mode === "request") {
        if (!isUuid(requestSubject)) throw new Error("Subject employee id must be a valid UUID.");
        if (providerId.trim() && !isUuid(providerId)) throw new Error("Provider employee id must be a valid UUID when provided.");
        const body: UnknownRecord = { subjectEmployeeId: requestSubject.trim() };
        if (providerId.trim()) body.providerEmployeeId = providerId.trim();
        if (requestPrompt.trim()) body.prompt = requestPrompt.trim();
        await postJson("/api/v1/feedback", body);
        setFormSuccess("Feedback request saved.");
      } else {
        if (!isUuid(entryRequestId)) throw new Error("Request id must be a valid UUID.");
        if (!isUuid(entryAuthor)) throw new Error("Author employee id must be a valid UUID.");
        if (!entryBody.trim()) throw new Error("Feedback body is required.");
        const body: UnknownRecord = {
          requestId: entryRequestId.trim(),
          authorEmployeeId: entryAuthor.trim(),
          body: entryBody.trim(),
        };
        if (entryRating.trim()) {
          const rating = Number(entryRating);
          if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating must be an integer from 1 to 5.");
          body.rating = rating;
        }
        await postJson("/api/v1/feedback/entries", body);
        setFormSuccess("Feedback entry submitted. The list below has been refreshed.");
        setEntryBody("");
        setEntryRating("");
        setRefreshKey((key) => key + 1);
      }
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The request could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  const ratings = entries
    .map((entry) => Number(asRecord(entry).rating))
    .filter((rating) => Number.isFinite(rating));
  const average = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Performance · Feedback"
        title="Outcomes over paperwork."
        description="Review cycles, objectives, feedback, and calibration in one workspace."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => open("cycle")} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> New Cycle
            </Button>
            <Button onClick={() => open("objective")} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> New Objective
            </Button>
            <Button onClick={() => open("request")} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> Request Feedback
            </Button>
            <Button onClick={() => open("entry")} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4 mr-1.5" /> Submit Entry
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 font-mono sm:grid-cols-3">
        {[
          ["Feedback Entries", loading ? "Loading…" : error || noSubject ? "—" : String(entries.length), anonymous ? "Anonymized cohort (< 5 respondents)" : "Attributed feedback"],
          ["Average Rating", loading ? "Loading…" : average === null ? "—" : average.toFixed(1), ratings.length > 0 ? `Across ${ratings.length} rated ${ratings.length === 1 ? "entry" : "entries"}` : "No rated entries yet"],
          ["Calibration Panel", "—", "No completed calibration sessions yet"],
        ].map(([label, value, note]) => (
          <Surface key={label} className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{note}</p>
          </Surface>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <Surface>
          <SectionHeading
            title="Feedback Received"
            description="Feedback for your linked employee record"
            action={
              <StatusPill tone={anonymous ? "warning" : "success"} dot>
                {anonymous ? "Anonymized" : "Attributed"}
              </StatusPill>
            }
          />
          {loading ? (
            <LoadingNote />
          ) : error ? (
            <ErrorNote message={error} />
          ) : noSubject ? (
            <EmptyNote message="No employee record is linked to this login yet, so feedback cannot be resolved. Ask an administrator to link your membership to an employee." />
          ) : entries.length === 0 ? (
            <EmptyNote message="No feedback yet. Feedback appears here once entries are submitted against your employee record." />
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div key={str(entry.id, `feedback-${index}`)} className="rounded-2xl border border-border/80 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm leading-relaxed text-foreground">{str(asRecord(entry).body, "No written feedback.")}</p>
                    {Number.isFinite(Number(asRecord(entry).rating)) && (
                      <span className="shrink-0"><StatusPill tone="info">{String(asRecord(entry).rating)}</StatusPill></span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {asRecord(entry).author === null || asRecord(entry).author === undefined
                      ? "Anonymous"
                      : `Author ${shortId(asRecord(entry).author)}`}
                    {formatDate(asRecord(entry).createdAt) ? ` · ${formatDate(asRecord(entry).createdAt)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <div className="space-y-4">
          <Surface>
            <SectionHeading
              title="Company Strategic Outcomes"
              description="Current performance objectives"
            />
            <EmptyNote message="No objectives are available yet." />
          </Surface>

          <Surface>
            <SectionHeading
              title="Calibration Signals"
              description="Distribution guidance from live calibration data"
            />
            <CapabilityBars
              bars={[]}
              emptyNote="No completed calibration sessions yet."
            />
          </Surface>
        </div>
      </div>

      {mode ? (
        <Modal
          title={
            mode === "cycle" ? "New review cycle" : mode === "objective" ? "New objective" : mode === "request" ? "Request feedback" : "Submit feedback entry"
          }
          description={
            mode === "cycle"
              ? "Create a review cycle using the defaults or your own code and name."
              : mode === "objective"
                ? "Create an objective for the selected employee."
                : mode === "request"
                  ? "Open a feedback request for the selected employee."
                  : "Submit feedback against an open request."
          }
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            {mode === "cycle" ? (
              <>
                <Field label="Code (optional)" hint="Defaults to FY26-H2 on the server.">
                  <Input value={cycleCode} onChange={(e) => setCycleCode(e.target.value)} placeholder="FY26-H2" className="h-10 rounded-xl text-xs" />
                </Field>
                <Field label="Name (optional)" hint="Defaults to FY26 H2 review cycle on the server.">
                  <Input value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="FY26 H2 review cycle" className="h-10 rounded-xl text-xs" />
                </Field>
              </>
            ) : mode === "objective" ? (
              <>
                <Field label="Title">
                  <Input value={objectiveTitle} onChange={(e) => setObjectiveTitle(e.target.value)} placeholder="Cut warp waste by 8 percent" className="h-10 rounded-xl text-xs" />
                </Field>
                <Field label="Owner employee" hint={subjectId ? "Prefilled from your linked employee record." : undefined}>
                  <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" value={ownerId} onChange={setOwnerId} className="h-10 rounded-xl border border-border bg-card px-3 text-xs" />
                </Field>
              </>
            ) : mode === "request" ? (
              <>
                <Field label="Subject employee">
                  <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" value={requestSubject} onChange={setRequestSubject} className="h-10 rounded-xl border border-border bg-card px-3 text-xs" />
                </Field>
                <Field label="Provider employee (optional)">
                  <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" value={providerId} onChange={setProviderId} placeholder="Leave blank for an open request" className="h-10 rounded-xl border border-border bg-card px-3 text-xs" />
                </Field>
                <Field label="Prompt (optional)">
                  <Input value={requestPrompt} onChange={(e) => setRequestPrompt(e.target.value)} placeholder="Share strengths and one growth area." className="h-10 rounded-xl text-xs" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Request id (UUID)" hint="The id returned when the feedback request was created.">
                  <Input value={entryRequestId} onChange={(e) => setEntryRequestId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
                <Field label="Author employee">
                  <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" value={entryAuthor} onChange={setEntryAuthor} className="h-10 rounded-xl border border-border bg-card px-3 text-xs" />
                </Field>
                <Field label="Feedback">
                  <Input value={entryBody} onChange={(e) => setEntryBody(e.target.value)} placeholder="Specific, observable feedback" className="h-10 rounded-xl text-xs" />
                </Field>
                <Field label="Rating 1-5 (optional)">
                  <Input value={entryRating} onChange={(e) => setEntryRating(e.target.value)} placeholder="4" inputMode="numeric" className="h-10 rounded-xl text-xs" />
                </Field>
              </>
            )}
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Submit"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export function TalentPage() {
  const [query, setQuery] = useState("");
  const [applications, setApplications] = useState<UnknownRecord[]>([]);
  const [postings, setPostings] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [applicationsBody, postingsBody] = await Promise.all([
          getJson("/api/v1/applications?page=1&pageSize=100"),
          getJson("/api/v1/job-postings"),
        ]);
        if (!cancelled) {
          setApplications(listOf(asRecord(applicationsBody).data));
          setPostings(listOf(asRecord(postingsBody).data));
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Talent data could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const normalized = query.trim().toLowerCase();
  const shown = applications.filter((application) => {
    if (!normalized) return true;
    const attrs = attrsOf(application);
    const haystack =
      `${str(application.id)} ${str(application.candidate_id)} ${str(application.requisition_id)} ${str(attrs.stage)}`.toLowerCase();
    return haystack.includes(normalized);
  });

  const stageCounts = new Map<string, number>();
  for (const application of applications) {
    const stage = str(attrsOf(application).stage, "unknown");
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  }
  const topStages = [...stageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const postingTitle = postings.length > 0
    ? str(attrsOf(postings[0]).title, "Talent Pipeline")
    : "Talent Pipeline";

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Talent Acquisition · Live Pipeline"
        title="See the candidate, and the evidence."
        description="Manage applications and job postings. Match scores remain advisory and per application."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setRefreshKey((key) => key + 1)}
              className="h-10 rounded-xl px-3 text-xs font-bold"
            >
              <RefreshCcw className="size-4 mr-1.5" /> Refresh
            </Button>
            <Link
              href="/recruitment-requisitions"
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <BriefcaseBusiness className="size-4 mr-1.5" /> New Position
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)]">
        <Surface>
          <SectionHeading
            title={postingTitle}
            description={
              loading ? "Loading…" : error ? error : `${applications.length} ${applications.length === 1 ? "application" : "applications"} · ${postings.length} ${postings.length === 1 ? "posting" : "postings"}`
            }
            action={<StatusPill tone="success" dot>Live</StatusPill>}
          />

          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by stage, candidate, or requisition…"
              className="h-10 rounded-xl border-border bg-secondary/40 pl-9 text-xs"
            />
          </div>

          {loading ? (
            <LoadingNote />
          ) : error ? (
            <ErrorNote message={error} />
          ) : shown.length === 0 ? (
            <EmptyNote message={applications.length === 0 ? "No applications yet. Applications appear here once candidates are submitted." : "No applications match this search."} />
          ) : (
            <div className="space-y-3">
              {shown.map((application, index) => {
                const attrs = attrsOf(application);
                const stage = str(attrs.stage, "unknown");
                return (
                  <motion.div
                    key={str(application.id, String(index))}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 8) * 0.04 }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left"
                  >
                    <AvatarMark initials={initialsOf(stage)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-foreground">Application {shortId(application.id)}</p>
                        <StatusPill>{stage}</StatusPill>
                      </div>
                      <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                        Candidate {shortId(application.candidate_id)} · Requisition {shortId(application.requisition_id)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </Surface>

        <div className="space-y-4">
          <Surface className="border-primary/30 bg-card">
            <AiLabel>Advisory Evaluation Only</AiLabel>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">
              Single Integer Match Score (0–100)
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Scores are recorded per application and never auto-advance or dispose a candidate —
              disposition stays human-only.
            </p>
            <Button variant="link" disabled title="Rubric configuration is not available in this view" className="mt-3 h-auto p-0 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-50">
              Inspect Rubric and Provenance <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </Surface>

          <Surface>
            <SectionHeading title="Requisition Pipeline Pulse" description="Live stage counts from applications" />
            {loading ? (
              <LoadingNote />
            ) : error ? (
              <ErrorNote message={error} />
            ) : topStages.length === 0 ? (
              <EmptyNote message="No applications yet — stage counts will build as candidates apply." />
            ) : (
              <div className="grid grid-cols-2 gap-3 text-center font-mono">
                {topStages.map(([stage, count]) => (
                  <div key={stage} className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                    <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{stage}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{count}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      </div>

    </div>
  );
}

export function CompensationPage() {
  const [proposals, setProposals] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<"band" | "cycle" | "proposal" | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [gradeCode, setGradeCode] = useState("E3");
  const [minMinor, setMinMinor] = useState("");
  const [maxMinor, setMaxMinor] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [cycleCode, setCycleCode] = useState("COMP-FY27");
  const [budgetMinor, setBudgetMinor] = useState("");
  const [proposalCycle, setProposalCycle] = useState("");
  const [proposalEmployee, setProposalEmployee] = useState("");
  const [newBasic, setNewBasic] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [justification, setJustification] = useState("");
  // FRM-PAY-02 makes the revision type mandatory: an increment and a market correction are
  // different decisions and the letter and the approval route differ by which one it is.
  const [revisionType, setRevisionType] = useState<string>(picklistValues("PL_REVISION_TYPE")[0]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const body = await getJson("/api/v1/compensation/proposals");
        if (!cancelled) {
          setProposals(listOf(asRecord(body).data));
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Compensation data could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function open(m: "band" | "cycle" | "proposal") {
    setMode(m);
    setFormError("");
    setFormSuccess("");
  }

  function positiveInt(raw: string): number | null {
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) return null;
    return value;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !mode) return;
    setFormError("");
    setFormSuccess("");
    setSaving(true);
    try {
      if (mode === "band") {
        const min = positiveInt(minMinor);
        const max = positiveInt(maxMinor);
        if (!gradeCode.trim()) throw new Error("A grade code is required.");
        if (min === null) throw new Error("Minimum must be a positive integer in minor units (paise).");
        if (max === null) throw new Error("Maximum must be a positive integer in minor units (paise).");
        if (min >= max) throw new Error("Band minimum must be below the maximum.");
        if (!/^[A-Z]{3}$/.test(currency.trim())) throw new Error("Currency must be a 3-letter code such as INR.");
        await postJson("/api/v1/compensation/bands", {
          gradeCode: gradeCode.trim(),
          minMinor: min,
          maxMinor: max,
          currency: currency.trim(),
        });
        setFormSuccess("Compensation band saved successfully.");
      } else if (mode === "cycle") {
        const budget = positiveInt(budgetMinor);
        if (!cycleCode.trim()) throw new Error("A cycle code is required.");
        if (budget === null) throw new Error("Budget must be a positive integer in minor units (paise).");
        await postJson("/api/v1/compensation/cycles", { code: cycleCode.trim(), budgetMinor: budget });
        setFormSuccess("Cycle budgeted. It becomes selectable for new proposals once created.");
      } else {
        if (!isUuid(proposalCycle)) throw new Error("Cycle id must be a valid UUID.");
        if (!isUuid(proposalEmployee)) throw new Error("Employee id must be a valid UUID.");
        const basic = positiveInt(newBasic);
        if (basic === null) throw new Error("New basic must be a positive integer in minor units (paise).");
        if (!DATE_RE.test(effectiveDate.trim())) throw new Error("Effective date must use YYYY-MM-DD.");
        if (justification.trim().length < 10) throw new Error("A justification of at least 10 characters is required.");
        await postJson("/api/v1/compensation/proposals", {
          cycleId: proposalCycle.trim(),
          employeeId: proposalEmployee.trim(),
          revisionType,
          newBasicMinor: basic,
          effectiveDate: effectiveDate.trim(),
          justification: justification.trim(),
        });
        setFormSuccess("Proposal submitted. The review population below has been refreshed.");
        setRefreshKey((key) => key + 1);
      }
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The request could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  const statusCounts = new Map<string, number>();
  for (const proposal of proposals) {
    const status = str(attrsOf(proposal).status, "unknown");
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  const approved = [...statusCounts.entries()]
    .filter(([status]) => status.toLowerCase() === "approved")
    .reduce((sum, [, count]) => sum + count, 0);
  const pending = proposals.length - approved;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Total Rewards · Live Proposals"
        title="Fairness you can inspect."
        description="Manage compensation proposals with maker-checker approval controls."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => open("band")} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> New Band
            </Button>
            <Button onClick={() => open("cycle")} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> New Cycle
            </Button>
            <Button onClick={() => open("proposal")} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4 mr-1.5" /> New Proposal
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 font-mono sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Proposals", loading ? "Loading…" : error ? "—" : String(proposals.length), "Across review cycles"],
          ["Approved", loading ? "Loading…" : error ? "—" : String(approved), "Maker-checker approved"],
          ["Awaiting Decision", loading ? "Loading…" : error ? "—" : String(pending), "Not yet approved"],
          ["Bands & Budgets", "—", "No band or budget data available yet"],
        ].map(([label, value, note]) => (
          <Surface key={label} className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{note}</p>
          </Surface>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,.7fr)]">
        <Surface>
          <SectionHeading
            title="Review Population"
            description="Current compensation proposals"
            action={
              <StatusPill tone={pending > 0 ? "warning" : "success"}>
                {loading ? "Loading…" : `${pending} awaiting decision`}
              </StatusPill>
            }
          />
          {loading ? (
            <LoadingNote />
          ) : error ? (
            <ErrorNote message={error} />
          ) : proposals.length === 0 ? (
            <EmptyNote message="No compensation proposals yet. Proposals appear here once they are submitted for a review cycle." />
          ) : (
            <div className="space-y-3">
              {proposals.slice(0, 8).map((proposal, index) => {
                const attrs = attrsOf(proposal);
                return (
                  <div
                    key={str(proposal.id, String(index))}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarMark initials={initialsOf(str(attrs.status, "P"))} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">Employee {shortId(proposal.employee_id)}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          Cycle {shortId(proposal.compensation_cycle_id)}
                          {str(attrs.effective_date) ? ` · Effective ${str(attrs.effective_date)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="font-mono sm:text-right">
                      <StatusPill tone={str(attrs.status).toLowerCase() === "approved" ? "success" : "warning"}>
                        {str(attrs.status, "unknown")}
                      </StatusPill>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>

        <Surface className="border-primary/30 bg-card">
          <SectionHeading title="Decision Status" description="Live status breakdown" />
          {loading ? (
            <LoadingNote />
          ) : error ? (
            <ErrorNote message={error} />
          ) : statusCounts.size === 0 ? (
            <EmptyNote message="No proposal statuses to summarize yet." />
          ) : (
            <div className="space-y-2.5 font-mono text-xs">
              {[...statusCounts.entries()].map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3"
                >
                  <p className="min-w-0 truncate font-semibold text-foreground">{status}</p>
                  <p className="shrink-0 font-bold text-foreground">{count}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Band ranges and budget aggregates need read endpoints that v1 does not expose yet.
          </p>
        </Surface>
      </div>

      {mode ? (
        <Modal
          title={mode === "band" ? "New compensation band" : mode === "cycle" ? "New compensation cycle" : "New compensation proposal"}
          description={
            mode === "band"
              ? "Create a compensation range using amounts in paise."
              : mode === "cycle"
                ? "Create and fund a compensation review cycle."
                : "Create a proposal for an employee with an active salary assignment."
          }
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            {mode === "band" ? (
              <>
                <Field label="Grade code">
                  <Input value={gradeCode} onChange={(e) => setGradeCode(e.target.value)} placeholder="E3" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
                <Field label="Minimum (minor units, paise)">
                  <Input value={minMinor} onChange={(e) => setMinMinor(e.target.value)} placeholder="2500000" inputMode="numeric" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
                <Field label="Maximum (minor units, paise)">
                  <Input value={maxMinor} onChange={(e) => setMaxMinor(e.target.value)} placeholder="4200000" inputMode="numeric" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
                <Field label="Currency">
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
              </>
            ) : mode === "cycle" ? (
              <>
                <Field label="Cycle code">
                  <Input value={cycleCode} onChange={(e) => setCycleCode(e.target.value)} placeholder="COMP-FY27" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
                <Field label="Budget (minor units, paise)">
                  <Input value={budgetMinor} onChange={(e) => setBudgetMinor(e.target.value)} placeholder="50000000" inputMode="numeric" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Compensation cycle">
                  <ReferencePicker endpoint="/api/v1/compensation/cycles" value={proposalCycle} onChange={setProposalCycle} className="h-10 rounded-xl border border-border bg-card px-3 text-xs" />
                </Field>
                <Field label="Employee">
                  <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" value={proposalEmployee} onChange={setProposalEmployee} className="h-10 rounded-xl border border-border bg-card px-3 text-xs" />
                </Field>
                <Field label="Revision type">
                  <select value={revisionType} onChange={(e) => setRevisionType(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs">
                    {picklistValues("PL_REVISION_TYPE").map((value) => <option key={value} value={value}>{picklistLabel("PL_REVISION_TYPE", value)}</option>)}
                  </select>
                </Field>
                <Field label="New basic (minor units, paise)">
                  <Input value={newBasic} onChange={(e) => setNewBasic(e.target.value)} placeholder="3100000" inputMode="numeric" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
                <Field label="Effective date YYYY-MM-DD">
                  <Input value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} placeholder="2026-04-01" className="h-10 rounded-xl font-mono text-xs" />
                </Field>
                <Field label="Justification">
                  <Input value={justification} onChange={(e) => setJustification(e.target.value)} minLength={10} maxLength={300} placeholder="Sustained above-band delivery in H2" className="h-10 rounded-xl text-xs" />
                </Field>
              </>
            )}
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Submit"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export function InsightsPage() {
  const [metrics, setMetrics] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const body = await getJson("/api/v1/analytics/metrics");
        if (!cancelled) {
          setMetrics(listOf(asRecord(body).data));
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Analytics data could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    if (!code.trim()) {
      setFormError("A metric code is required.");
      return;
    }
    if (!name.trim()) {
      setFormError("A metric name is required.");
      return;
    }
    if (!definition.trim()) {
      setFormError("A definition is required.");
      return;
    }
    let privacyThreshold: number | undefined;
    if (threshold.trim()) {
      const value = Number(threshold);
      if (!Number.isInteger(value) || value < 2 || value > 100) {
        setFormError("Privacy threshold must be an integer from 2 to 100.");
        return;
      }
      privacyThreshold = value;
    }
    setSaving(true);
    try {
      const body: UnknownRecord = { code: code.trim(), name: name.trim(), definition: definition.trim() };
      if (privacyThreshold !== undefined) body.privacyThreshold = privacyThreshold;
      await postJson("/api/v1/analytics/metrics", body);
      setFormSuccess("Metric defined. The definitions below have been refreshed.");
      setCode("");
      setName("");
      setDefinition("");
      setThreshold("");
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The metric could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="People Intelligence · Live Metrics"
        title="From telemetry to action."
        description="Track workforce metrics through privacy-protected snapshots."
        action={
          <Button
            onClick={() => {
              setFormError("");
              setFormSuccess("");
              setOpen(true);
            }}
            className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4 mr-1.5" /> New Metric
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)]">
        <Surface>
          <SectionHeading
            title="Workforce Trajectory"
            description="Historical headcount trend"
            action={<StatusPill tone="neutral">No history yet</StatusPill>}
          />
          <WorkforceChart
            points={[]}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Headcount history will appear after historical snapshots are available.
          </p>
        </Surface>

        <Surface className="border-primary/30 bg-card">
          <AiLabel>Executive Signal</AiLabel>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            {loading ? "Loading…" : `${metrics.length} ${metrics.length === 1 ? "metric" : "metrics"} defined.`}
          </h2>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {loading || error
              ? "Live metric definitions."
              : metrics.length === 0
                ? "No metric definitions exist yet. Define one to start tracking."
                : "Definitions below are live. Values accrue via metric snapshots with privacy thresholds."}
          </p>

          <div className="mt-6">
            {loading ? (
              <LoadingNote />
            ) : error ? (
              <ErrorNote message={error} />
            ) : metrics.length === 0 ? (
              <EmptyNote message="No metric definitions yet." />
            ) : (
              <div className="space-y-2.5">
                {metrics.map((metric, index) => {
                  const attrs = attrsOf(metric);
                  return (
                    <div key={str(metric.id, String(index))} className="rounded-2xl border border-border/80 bg-secondary/30 p-4">
                      <p className="break-words font-mono text-xs font-bold text-foreground">
                        {str(attrs.code, shortId(metric.id))}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">{str(attrs.name, "Unnamed metric")}</p>
                      {str(attrs.definition) ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{str(attrs.definition)}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Surface>
      </div>

      <div className="mt-6">
        <Surface>
          <SectionHeading
            title="Capability Detail"
            description="Department capability overview"
          />
          <EmptyNote message="No capability index has been published yet." />
        </Surface>
      </div>

      {open ? (
        <Modal
          title="New metric definition"
          description="Define a metric whose values accrue through privacy-safe snapshots."
          onClose={() => setOpen(false)}
        >
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABSENTEEISM-RATE" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Absenteeism rate" className="h-10 rounded-xl text-xs" />
            </Field>
            <Field label="Definition">
              <Input value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="Unscheduled absence days divided by scheduled days" className="h-10 rounded-xl text-xs" />
            </Field>
            <Field label="Privacy threshold 2-100 (optional)" hint="Defaults to 5 on the server.">
              <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="5" inputMode="numeric" className="h-10 rounded-xl text-xs" />
            </Field>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Define metric"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
