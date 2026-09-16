"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, MessageSquare, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { AvatarMark, PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { SurveyAnswerPanel } from "./survey-answer-panel";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function dateLabel(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function timeLabel(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) return `${Math.max(1, Math.floor(diffMs / 60_000))} min ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} h ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

/** How a feed post's own `kind` reads on the page. */
function statusTone(kind: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (kind === "milestone") return "success";
  if (kind === "kudos") return "info";
  if (kind === "notice") return "warning";
  return "neutral";
}

function kindLabel(kind: string): string {
  if (kind === "milestone") return "Milestone";
  if (kind === "kudos") return "Kudos";
  if (kind === "notice") return "Notice";
  if (kind === "update") return "Update";
  return kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) || "Update";
}

async function postJson(path: string, body: unknown): Promise<UnknownRecord> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, `Request failed (${response.status})`));
  return asRecord(asRecord(payload).data);
}

type Component = { key: string; label: string; value: number; weight: number; contribution: number };

type CapabilityRun = {
  id: string;
  index: number;
  recomputedIndex: number;
  agrees: boolean;
  formula: string;
  permittedUse: string;
  automatedDecision: boolean;
  computedAt: string;
  weightTotal: number;
  components: Component[];
};

type CapabilityView = { employeeId: string; employeeName: string; employeeCode: string; runCount: number; run: CapabilityRun | null };

type Checkin = { id: string; energy: number | null; stress: number | null; workload: number | null; note: string | null; recordedAt: string };

type WellbeingView = {
  self: { checkins: Checkin[] } | null;
  aggregate: { cohortSize: number; threshold: number; suppressed: boolean; averages: { energy: number | null; stress: number | null; workload: number | null } | null };
  points: { configured: boolean; balance: number | null; awarded: number; reversed: number; transactionCount: number; schemes: Array<{ programId: string; name: string; points: number }> };
};

type FeedPost = {
  id: string;
  title: string;
  body: string;
  kind: string;
  authorName: string;
  authorInitials: string;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  viewerReaction: string | null;
  audienceScoped: boolean;
};

type Person = { id: string; label: string };

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";
const textareaClass = "min-h-[88px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground";

const RATINGS = [1, 2, 3, 4, 5];

export function EmployeeExperiencePage() {
  // Deep-link preselect (?record=<employeeId>); lazy initializer keeps SSR output stable.
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [tab, setTab] = useState("capability");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Engagement · Employee experience"
        title="Employee experience and capability index"
        description="A person's own capability index, their own wellbeing record, and the audience-scoped social feed. The index is advisory and development-planning-only; wellbeing is private to the individual and only ever aggregated above the anonymity threshold."
        action={
          <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
            <RefreshCcw className="mr-1.5 size-4" /> Refresh
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList
          aria-label="Employee experience sections"
          className="mb-4 h-auto w-full max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto"
        >
          <TabsTrigger value="capability" className="h-10 flex-none px-3">Capability index</TabsTrigger>
          <TabsTrigger value="wellbeing" className="h-10 flex-none px-3">Wellbeing and surveys</TabsTrigger>
          <TabsTrigger value="feed" className="h-10 flex-none px-3">Social feed and kudos</TabsTrigger>
        </TabsList>

        <TabsContent value="capability">
          <CapabilityTab
            revision={revision}
            refresh={refresh}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
          />
        </TabsContent>

        <TabsContent value="wellbeing">
          <WellbeingTab revision={revision} refresh={refresh} />
          {/* The pulse survey sits beside the private check-in: the check-in is your own
              record, the survey is the tenant's listening instrument, and both are answered
              here. It keeps its own load and retry so a refresh cannot wipe a part-filled form. */}
          <div className="mt-6">
            <SurveyAnswerPanel />
          </div>
        </TabsContent>

        <TabsContent value="feed">
          <FeedTab revision={revision} refresh={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Capability index                                                    */
/* ------------------------------------------------------------------ */

function CapabilityTab({
  revision,
  refresh,
  selectedEmployeeId,
  onSelectEmployee,
}: {
  revision: number;
  refresh: () => void;
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
}) {
  const [view, setView] = useState<CapabilityView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const raw = await getJson("/api/v1/people?page=1&pageSize=100");
        const items = Array.isArray(asRecord(raw).data) ? (asRecord(raw).data as UnknownRecord[]) : [];
        const rows = items.map((item) => ({
          id: str(item.id),
          label: `${str(item.firstName)} ${str(item.lastName)}`.trim() || str(item.employeeCode, "Employee"),
        }));
        if (live) setPeople(rows);
      } catch {
        // The directory is a convenience only; the index still loads for the signed-in user.
        if (live) setPeople([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const query = selectedEmployeeId ? `&employeeId=${encodeURIComponent(selectedEmployeeId)}` : "";
        const raw = await getJson(`/api/v1/social-feed?view=capability-index${query}`);
        const data = asRecord(asRecord(raw).data);
        const runRaw = data.run === null || data.run === undefined ? null : asRecord(data.run);
        const run: CapabilityRun | null = runRaw
          ? {
              id: str(runRaw.id),
              index: num(runRaw.index) ?? 0,
              recomputedIndex: num(runRaw.recomputedIndex) ?? 0,
              agrees: runRaw.agrees === true,
              formula: str(runRaw.formula, "mci/v2"),
              permittedUse: str(runRaw.permittedUse, "development-planning-only"),
              automatedDecision: runRaw.automatedDecision === true,
              computedAt: str(runRaw.computedAt),
              weightTotal: num(runRaw.weightTotal) ?? 0,
              components: (Array.isArray(runRaw.components) ? (runRaw.components as UnknownRecord[]) : []).map((component) => ({
                key: str(component.key),
                label: str(component.label),
                value: num(component.value) ?? 0,
                weight: num(component.weight) ?? 0,
                contribution: num(component.contribution) ?? 0,
              })),
            }
          : null;
        if (live) {
          setView({
            employeeId: str(data.employeeId),
            employeeName: str(data.employeeName, "—"),
            employeeCode: str(data.employeeCode, "—"),
            runCount: int(data.runCount),
            run,
          });
        }
      } catch (err) {
        if (live) {
          setView(null);
          setError(err instanceof Error ? err.message : "The capability index could not be loaded.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision, selectedEmployeeId]);

  const run = view?.run ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Surface>
        <SectionHeading
          title="Capability index"
          description="One person at a time. This screen never ranks or compares people."
          action={
            <select
              aria-label="Employee"
              className={selectClass}
              value={selectedEmployeeId}
              onChange={(event) => onSelectEmployee(event.target.value)}
            >
              <option value="">Signed-in employee</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
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
        ) : !view ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No employee selected.</p>
        ) : !run ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5">
            <p className="text-sm font-semibold text-foreground">No capability index run exists for {view.employeeName}.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              The index is only ever the result of a recorded <code className="font-mono">mci/v2</code> run over five supplied sub-scores. Nothing derives those
              sub-scores automatically, so there is no number to show until a run has been computed and recorded in Insights.
            </p>
          </div>
        ) : !run.agrees ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <p className="text-sm font-semibold text-destructive">This run is inconsistent and is not displayed as a score.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              The persisted index is {run.index} but the weighted sum of the components recorded with it is {run.recomputedIndex}. A headline number that does not
              follow from its own components is not shown. Recompute the run before using it for development planning.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-secondary/20 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Capability index · {run.formula}</p>
                <p className="mt-1 text-[40px] font-bold leading-none tabular-nums text-foreground">{run.index.toFixed(2)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {view.employeeName} · {view.employeeCode} · computed {dateLabel(run.computedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="info">{run.permittedUse}</StatusPill>
                <StatusPill tone={run.automatedDecision ? "danger" : "success"} dot>
                  automated_decision: {String(run.automatedDecision)}
                </StatusPill>
              </div>
            </div>

            <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Weighted components</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <caption className="sr-only">Weighted components of the capability index</caption>
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-bold">Component</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Score</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Weight</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {run.components.map((component) => (
                    <tr key={component.key} className="border-t border-border/70">
                      <td className="px-3 py-2.5 text-xs font-semibold text-foreground">{component.label}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">{component.value}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">{(component.weight / 100).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">{component.contribution.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <td className="px-3 py-2.5 text-xs font-bold text-foreground">Weighted total</td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-muted-foreground">{(run.weightTotal / 100).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-foreground">{run.recomputedIndex.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Formula <code className="font-mono">{run.formula}</code>: the index is Σ(score × weight) ÷ 100, rounded to two decimals. The displayed index is the
              value persisted with the run and equals the sum of the contributions above.
            </p>
          </div>
        )}
      </Surface>

      <Surface>
        <SectionHeading title="How this index may be used" description="Governance recorded with the run, not a caption added by this page." />
        <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
            <span className="font-semibold text-foreground">Development planning only.</span> The run carries{" "}
            <code className="font-mono">permitted_use: &quot;development-planning-only&quot;</code>. It is advisory input for a growth conversation and is not an
            input to promotion, pay, performance rating or exit decisions.
          </li>
          <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
            <span className="font-semibold text-foreground">Not an automated decision.</span> Every run stores{" "}
            <code className="font-mono">automated_decision: false</code>. No transition anywhere in the product reads this number.
          </li>
          <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
            <span className="font-semibold text-foreground">The fifth component is tenure.</span> <code className="font-mono">mci/v2</code> weights performance,
            skills, learning, engagement and tenure at 0.25 / 0.25 / 0.20 / 0.15 / 0.15. Tenure measures time in role, not leadership readiness, and is labelled
            as what it is.
          </li>
          <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
            <span className="font-semibold text-foreground">No ranking.</span> This screen reads one employee at a time. There is no league table, no percentile
            and no cross-employee comparison — the API has no list form for index runs.
          </li>
          {view ? (
            <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              <span className="font-semibold text-foreground">Run history.</span> {view.runCount} run{view.runCount === 1 ? "" : "s"} recorded for this employee.
              The latest is shown; earlier runs are retained so a result can be appealed against the version that produced it.
            </li>
          ) : null}
        </ul>
      </Surface>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wellbeing                                                           */
/* ------------------------------------------------------------------ */

function WellbeingTab({ revision, refresh }: { revision: number; refresh: () => void }) {
  const [view, setView] = useState<WellbeingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [workload, setWorkload] = useState(3);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson("/api/v1/social-feed?view=wellbeing");
        const data = asRecord(asRecord(raw).data);
        const selfRaw = data.self === null || data.self === undefined ? null : asRecord(data.self);
        const aggregate = asRecord(data.aggregate);
        const averagesRaw = aggregate.averages === null || aggregate.averages === undefined ? null : asRecord(aggregate.averages);
        const points = asRecord(data.points);
        if (live) {
          setView({
            self: selfRaw
              ? {
                  checkins: (Array.isArray(selfRaw.checkins) ? (selfRaw.checkins as UnknownRecord[]) : []).map((row) => ({
                    id: str(row.id),
                    energy: num(row.energy),
                    stress: num(row.stress),
                    workload: num(row.workload),
                    note: typeof row.note === "string" ? row.note : null,
                    recordedAt: str(row.recordedAt),
                  })),
                }
              : null,
            aggregate: {
              cohortSize: int(aggregate.cohortSize),
              threshold: int(aggregate.threshold),
              suppressed: aggregate.suppressed === true,
              averages: averagesRaw ? { energy: num(averagesRaw.energy), stress: num(averagesRaw.stress), workload: num(averagesRaw.workload) } : null,
            },
            points: {
              configured: points.configured === true,
              balance: num(points.balance),
              awarded: int(points.awarded),
              reversed: int(points.reversed),
              transactionCount: int(points.transactionCount),
              schemes: (Array.isArray(points.schemes) ? (points.schemes as UnknownRecord[]) : []).map((scheme) => ({
                programId: str(scheme.programId),
                name: str(scheme.name, "Recognition programme"),
                points: int(scheme.points),
              })),
            },
          });
        }
      } catch (err) {
        if (live) {
          setView(null);
          setError(err instanceof Error ? err.message : "Wellbeing could not be loaded.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  async function submitCheckin(): Promise<void> {
    setFormError("");
    setFormOk("");
    setBusy(true);
    try {
      await postJson("/api/v1/social-feed?view=wellbeing", { energy, stress, workload, note: note.trim() || undefined });
      setFormOk("Check-in recorded. Only you can read it.");
      setNote("");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The check-in could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  const aggregate = view?.aggregate ?? null;
  const points = view?.points ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Surface>
        <SectionHeading title="Your check-in" description="Self-recorded. Stored against your employee record and readable only by you." />
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["Energy", energy, setEnergy, "energy-rating"],
              ["Stress", stress, setStress, "stress-rating"],
              ["Workload", workload, setWorkload, "workload-rating"],
            ] as Array<[string, number, (value: number) => void, string]>
          ).map(([label, value, setter, id]) => (
            <label key={id} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label} (1-5)</span>
              <select aria-label={`${label} rating`} className={selectClass} value={value} onChange={(event) => setter(Number(event.target.value))}>
                {RATINGS.map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="mt-4 flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Private note (optional)</span>
          <textarea
            aria-label="Private wellbeing note"
            className={textareaClass}
            value={note}
            maxLength={1000}
            placeholder="Anything you want to remember about this week."
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy} onClick={() => void submitCheckin()}>
            {busy ? "Recording…" : "Record check-in"}
          </Button>
          {formError ? <p className="text-xs leading-relaxed text-destructive">{formError}</p> : null}
          {formOk ? <p className="text-xs leading-relaxed text-success">{formOk}</p> : null}
        </div>

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Your history</h3>
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : !view?.self ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            Your sign-in is not linked to an employee record, so no personal check-in history can be shown.
          </p>
        ) : view.self.checkins.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">You have not recorded a check-in yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-sm">
              <caption className="sr-only">Your recorded wellbeing check-ins</caption>
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-bold">Recorded</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Energy</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Stress</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Workload</th>
                  <th scope="col" className="px-3 py-2 font-bold">Note</th>
                </tr>
              </thead>
              <tbody>
                {view.self.checkins.map((checkin) => (
                  <tr key={checkin.id} className="border-t border-border/70">
                    <td className="px-3 py-2.5 text-xs text-foreground">{dateLabel(checkin.recordedAt)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">{checkin.energy ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">{checkin.stress ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">{checkin.workload ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{checkin.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <div className="flex min-w-0 flex-col gap-6">
        <Surface>
          <SectionHeading title="Organisation view" description="Means only, across everyone who checked in during the last 90 days." />
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : !aggregate ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Unavailable.</p>
          ) : aggregate.suppressed ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4">
              <StatusPill tone="warning" dot>
                Suppressed
              </StatusPill>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {aggregate.cohortSize} {aggregate.cohortSize === 1 ? "person has" : "people have"} checked in. An aggregate is released only at{" "}
                {aggregate.threshold} or more. Below that the server returns no averages at all — not a rounded or approximate figure — because a small cohort
                mean can identify an individual.
              </p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Energy", aggregate.averages?.energy ?? null],
                    ["Stress", aggregate.averages?.stress ?? null],
                    ["Workload", aggregate.averages?.workload ?? null],
                  ] as Array<[string, number | null]>
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                    <p className="text-lg font-bold tabular-nums text-foreground">{value === null ? "—" : value.toFixed(2)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Cohort of {aggregate.cohortSize}, threshold {aggregate.threshold}. One sample per person; no names, departments, dates or notes are included.
              </p>
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading title="What is enforced" description="Describing the code on this path, not an aspiration." />
          <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <li className="flex gap-2.5 rounded-xl border border-border/70 bg-secondary/20 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                An individual&apos;s check-ins are addressed only by the employee id on your own session membership. The wellbeing endpoint accepts no employee
                reference, so no manager, HR or payroll view can read another person&apos;s record through it.
              </span>
            </li>
            <li className="flex gap-2.5 rounded-xl border border-border/70 bg-secondary/20 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                The only non-self read is a tenant-wide mean. It is computed from one sample per person and dropped entirely below the anonymity threshold,
                server-side, before the response is built.
              </span>
            </li>
            <li className="flex gap-2.5 rounded-xl border border-border/70 bg-secondary/20 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                There is no department, location, manager or team slice of wellbeing anywhere, so a cohort cannot be narrowed until it identifies someone. Free
                text is never aggregated and never leaves the self path.
              </span>
            </li>
            <li className="flex gap-2.5 rounded-xl border border-border/70 bg-secondary/20 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                Recording a check-in writes an audit row that says a check-in happened and carries none of the scores. Wellbeing is not joined to performance,
                capability or compensation data anywhere in this module.
              </span>
            </li>
          </ul>
        </Surface>

        {points?.configured ? (
          <Surface>
            <SectionHeading title="Recognition points" description="Balance computed from recorded reward transactions." />
            <p className="text-[32px] font-bold leading-none tabular-nums text-foreground">{points.balance ?? 0}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {points.transactionCount} transaction{points.transactionCount === 1 ? "" : "s"} recorded
              {points.reversed > 0 ? `, of which ${points.reversed} point${points.reversed === 1 ? "" : "s"} were reversed and are excluded` : ""}. Scheme
              {points.schemes.length === 1 ? "" : "s"}: {points.schemes.map((scheme) => `${scheme.name} (${scheme.points})`).join(", ")}.
            </p>
          </Surface>
        ) : points ? (
          <Surface>
            <SectionHeading title="Recognition points" description="Not configured for this workspace." />
            <p className="text-xs leading-relaxed text-muted-foreground">
              No recognition programme in this workspace declares a points value, so there is no scheme to report a balance against and no balance is shown.
              {points.transactionCount > 0
                ? ` ${points.transactionCount} reward transaction${points.transactionCount === 1 ? " exists" : "s exist"} but cannot be priced without a scheme.`
                : ""}{" "}
              There is no rewards catalogue behind this screen, so none is offered.
            </p>
          </Surface>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Social feed                                                         */
/* ------------------------------------------------------------------ */

function FeedTab({ revision, refresh }: { revision: number; refresh: () => void }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("update");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [reactingId, setReactingId] = useState("");
  const [reactError, setReactError] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson("/api/v1/social-feed?page=1&pageSize=25");
        const items = Array.isArray(asRecord(raw).data) ? (asRecord(raw).data as UnknownRecord[]) : [];
        const rows = items.map((item) => ({
          id: str(item.id),
          title: str(item.title),
          body: str(item.body),
          kind: str(item.kind, "update"),
          authorName: str(item.authorName, "Workspace"),
          authorInitials: str(item.authorInitials, "—"),
          createdAt: str(item.createdAt),
          reactionCount: int(item.reactionCount),
          commentCount: int(item.commentCount),
          viewerReaction: typeof item.viewerReaction === "string" ? item.viewerReaction : null,
          audienceScoped: item.audienceScoped === true,
        }));
        if (live) setPosts(rows);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "The feed could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  async function publish(): Promise<void> {
    setFormError("");
    if (!title.trim() || !body.trim()) {
      setFormError("A title and a message are both required.");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/v1/social-feed", { title: title.trim(), body: body.trim(), kind });
      setTitle("");
      setBody("");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The post could not be published.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReaction(post: FeedPost): Promise<void> {
    setReactError("");
    setReactingId(post.id);
    try {
      const data = await postJson(`/api/v1/social-feed/${encodeURIComponent(post.id)}/reactions`, {
        op: post.viewerReaction ? "withdraw" : "react",
        kind: "kudos",
      });
      const reacted = data.reacted === true;
      const count = int(data.reactionCount);
      setPosts((current) =>
        current.map((row) => (row.id === post.id ? { ...row, viewerReaction: reacted ? str(data.kind, "kudos") : null, reactionCount: count } : row)),
      );
    } catch (err) {
      setReactError(err instanceof Error ? err.message : "The reaction could not be recorded.");
    } finally {
      setReactingId("");
    }
  }

  const scopedCount = useMemo(() => posts.filter((post) => post.audienceScoped).length, [posts]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Surface>
        <SectionHeading
          title="Feed"
          description={loading ? "Loading…" : `${posts.length} post${posts.length === 1 ? "" : "s"} visible to you${scopedCount > 0 ? ` · ${scopedCount} audience-scoped` : ""}`}
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
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            No posts are visible in your audience scope yet. Publish the first one from the composer.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="rounded-xl border border-border/80 bg-card p-4">
                <div className="flex items-start gap-3">
                  <AvatarMark initials={post.authorInitials} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{post.authorName}</span>
                      <span className="text-[11px] text-muted-foreground">{timeLabel(post.createdAt)}</span>
                      <StatusPill tone={statusTone(post.kind)}>{kindLabel(post.kind)}</StatusPill>
                      {post.audienceScoped ? <StatusPill tone="neutral">Audience-scoped</StatusPill> : null}
                    </div>
                    {post.title ? <p className="mt-2 text-sm font-semibold text-foreground">{post.title}</p> : null}
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{post.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant={post.viewerReaction ? "default" : "outline"}
                        size="sm"
                        className="h-10 sm:h-8 rounded-lg text-xs"
                        aria-pressed={post.viewerReaction ? "true" : "false"}
                        disabled={reactingId === post.id}
                        onClick={() => void toggleReaction(post)}
                      >
                        <Heart className="mr-1.5 size-3.5" />
                        {post.viewerReaction ? "Kudos given" : "Give kudos"}
                        <span className="ml-1.5 tabular-nums">{post.reactionCount}</span>
                      </Button>
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MessageSquare className="size-3.5" />
                        {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {reactError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{reactError}</p> : null}
      </Surface>

      <div className="flex min-w-0 flex-col gap-6">
        <Surface>
          <SectionHeading title="Post an update" description="Published to everyone unless an audience is attached to the post." />
          <div className="flex flex-col gap-3">
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Title</span>
              <input aria-label="Post title" className={inputClass} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</span>
              <textarea aria-label="Post message" className={textareaClass} value={body} maxLength={5000} onChange={(event) => setBody(event.target.value)} />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Kind</span>
              <select aria-label="Post kind" className={selectClass} value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="update">Update</option>
                <option value="milestone">Milestone</option>
                <option value="kudos">Kudos</option>
                <option value="notice">Notice</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy} onClick={() => void publish()}>
                <Send className="mr-1.5 size-4" />
                {busy ? "Publishing…" : "Publish post"}
              </Button>
              {formError ? <p className="text-xs leading-relaxed text-destructive">{formError}</p> : null}
            </div>
          </div>
        </Surface>

        <Surface>
          <SectionHeading title="How reactions behave" description="One per person, idempotent, reversible." />
          <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              A reaction is a single row keyed to you and the post. Pressing the button again withdraws it; a retried or duplicated request settles on the same
              state instead of adding a count.
            </li>
            <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              Counts shown here are read back from the stored reactions after every write, so they match what is recorded rather than a number held in the
              browser.
            </li>
            <li className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              A post with no audience rows is visible to the whole workspace. A post with audience rows reaches you only if your department, location or a role
              you hold is on that list.
            </li>
          </ul>
        </Surface>
      </div>
    </div>
  );
}
