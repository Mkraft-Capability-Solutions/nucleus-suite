"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, ChevronRight, Plus, RefreshCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

/**
 * SCR — Performance and capability management.
 *
 * Four registers over data that already exists and was never read: the OKR
 * cascade (`objectives.parent_objective_id` / `goal_links`), the 9-box grid
 * (`talent_placements`), the manager coaching register
 * (`manager_coaching_notes`) and the succession bench (`succession_candidates`).
 *
 * Three things this screen deliberately does NOT show, because the underlying
 * definitions do not exist anywhere in this product:
 *   - a RAG band when no threshold is configured (health reads "Not determined");
 *   - a 9-box band inferred from a rating when no cut-offs are configured
 *     (placement stays a human act);
 *   - a succession readiness percentage (the bench is reported as counts).
 *
 * Progress bars are plain inline divs rather than `@/components/ui/progress`:
 * that component imports `cn` from the bare "cn" package while every file in
 * this folder imports it from `@/lib/utils`, and a two-element bar is not worth
 * inheriting the inconsistency.
 */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function listOf(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? (value as unknown[]).map(asRecord) : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

/** Mirrors the `NINE_BOX_BANDS` vocabulary in src/server/performance/calibration.ts. */
const BANDS = ["low", "medium", "high"] as const;
type Band = (typeof BANDS)[number];
const BAND_LABELS: Record<Band, string> = { low: "Low", medium: "Medium", high: "High" };

/** Mirrors `READINESS_VOCABULARY` in src/server/performance/calibration.ts and `createSuccessionSchema`. */
const READINESS = [
  { value: "ready-now", label: "Ready now" },
  { value: "ready-1-2y", label: "Ready in 1-2 years" },
  { value: "ready-3y-plus", label: "Ready in 3 years or more" },
] as const;

const COACHING_ROUTE_GAP =
  "src/app/api/v1/manager-coaching-notes/route.ts does not exist yet, so this register cannot be read or written from the browser.";

function healthTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "green") return "success";
  if (status === "amber") return "warning";
  if (status === "red") return "danger";
  return "neutral";
}

function healthLabel(status: string): string {
  if (status === "green") return "Green";
  if (status === "amber") return "Amber";
  if (status === "red") return "Red";
  return "Not determined";
}

function weightTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "valid") return "success";
  if (status === "mismatched") return "danger";
  if (status === "partial") return "warning";
  return "neutral";
}

function sessionStatusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "open") return "success";
  if (status === "closed") return "neutral";
  return "warning";
}

function ProgressBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <span className="text-[11px] italic text-muted-foreground">No measurable target</span>;
  }
  return (
    <span className="flex items-center gap-2" role="img" aria-label={`${label}: ${value}%`}>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="text-xs tabular-nums text-foreground">{value}%</span>
    </span>
  );
}

type ObjectiveNode = {
  id: string;
  parentId: string | null;
  title: string;
  ownerEmployeeId: string | null;
  depth: number;
  childIds: string[];
  weightPct: number | null;
  ownKeyResultProgressPct: number | null;
  keyResultCount: number;
  derivedProgressPct: number | null;
  progressSource: string;
  weightMode: string;
  storedProgressPct: number | null;
  storedDisagrees: boolean;
  health: { status: string; reason: string };
  notes: string[];
};

type WeightCheck = { parentId: string | null; status: string; sumPct: number; message: string; childIds: string[] };

type KeyResultRow = {
  id: string;
  objectiveId: string;
  title: string;
  unit: string;
  current: number;
  target: number;
  weightPct: number | null;
  progressPct: number | null;
};

type OkrTree = {
  nodes: ObjectiveNode[];
  weightChecks: WeightCheck[];
  keyResults: KeyResultRow[];
  thresholdsConfigured: boolean;
  healthNote: string;
};

function readTree(payload: unknown): OkrTree {
  const data = asRecord(asRecord(payload).data);
  return {
    nodes: listOf(data.nodes).map((node) => ({
      id: str(node.id),
      parentId: typeof node.parentId === "string" ? node.parentId : null,
      title: str(node.title, "Untitled objective"),
      ownerEmployeeId: typeof node.ownerEmployeeId === "string" ? node.ownerEmployeeId : null,
      depth: numOrNull(node.depth) ?? 0,
      childIds: Array.isArray(node.childIds) ? (node.childIds as unknown[]).map((value) => String(value)) : [],
      weightPct: numOrNull(node.weightPct),
      ownKeyResultProgressPct: numOrNull(node.ownKeyResultProgressPct),
      keyResultCount: numOrNull(node.keyResultCount) ?? 0,
      derivedProgressPct: numOrNull(node.derivedProgressPct),
      progressSource: str(node.progressSource, "none"),
      weightMode: str(node.weightMode, "equal-fallback"),
      storedProgressPct: numOrNull(node.storedProgressPct),
      storedDisagrees: node.storedDisagrees === true,
      health: { status: str(asRecord(node.health).status, "undetermined"), reason: str(asRecord(node.health).reason) },
      notes: Array.isArray(node.notes) ? (node.notes as unknown[]).map((value) => String(value)) : [],
    })),
    weightChecks: listOf(data.weightChecks).map((check) => ({
      parentId: typeof check.parentId === "string" ? check.parentId : null,
      status: str(check.status, "unweighted"),
      sumPct: numOrNull(check.sumPct) ?? 0,
      message: str(check.message),
      childIds: Array.isArray(check.childIds) ? (check.childIds as unknown[]).map((value) => String(value)) : [],
    })),
    keyResults: listOf(data.keyResults).map((keyResult) => ({
      id: str(keyResult.id),
      objectiveId: str(keyResult.objectiveId),
      title: str(keyResult.title, "Untitled key result"),
      unit: str(keyResult.unit, "pct"),
      current: numOrNull(keyResult.current) ?? 0,
      target: numOrNull(keyResult.target) ?? 0,
      weightPct: numOrNull(keyResult.weightPct),
      progressPct: numOrNull(keyResult.progressPct),
    })),
    thresholdsConfigured: data.thresholdsConfigured === true,
    healthNote: str(data.healthNote),
  };
}

type Placement = {
  id: string;
  employeeId: string;
  cellKey: string;
  performanceBand: string;
  potentialBand: string;
  rationale: string;
  adjustmentReason: string | null;
  placedByUserId: string | null;
  placedAt: string | null;
  anonymised: boolean;
  anonymityNote: string | null;
  reviewRating: number | null;
};

type GridCell = { key: string; performance: string; potential: string; label: string; employeeIds: string[] };

type NineBox = {
  bandingConfigured: boolean;
  bandingNote: string;
  placements: Placement[];
  cells: GridCell[];
  unplacedNote: string;
};

function readGrid(payload: unknown): NineBox {
  const data = asRecord(asRecord(payload).data);
  return {
    bandingConfigured: data.bandingConfigured === true,
    bandingNote: str(data.bandingNote),
    unplacedNote: str(data.unplacedNote),
    placements: listOf(data.placements).map((placement) => ({
      id: str(placement.id),
      employeeId: str(placement.employeeId),
      cellKey: str(placement.cellKey),
      performanceBand: str(placement.performanceBand),
      potentialBand: str(placement.potentialBand),
      rationale: str(placement.rationale),
      adjustmentReason: typeof placement.adjustmentReason === "string" ? placement.adjustmentReason : null,
      placedByUserId: typeof placement.placedByUserId === "string" ? placement.placedByUserId : null,
      placedAt: typeof placement.placedAt === "string" ? placement.placedAt : null,
      anonymised: placement.anonymised === true,
      anonymityNote: typeof placement.anonymityNote === "string" ? placement.anonymityNote : null,
      reviewRating: numOrNull(placement.reviewRating),
    })),
    cells: listOf(data.cells).map((cell) => ({
      key: str(cell.key),
      performance: str(cell.performance),
      potential: str(cell.potential),
      label: str(cell.label),
      employeeIds: Array.isArray(cell.employeeIds) ? (cell.employeeIds as unknown[]).map((value) => String(value)) : [],
    })),
  };
}

type PersonRow = { id: string; name: string; code: string };
type SessionRow = { id: string; label: string; status: string; adjustments: number };
type PlanRow = {
  id: string;
  positionCode: string;
  candidates: Array<{ employeeId: string; readiness: string | null; gaps: string[] }>;
  createdAt: string;
};

type FeedbackView = { anonymous: boolean; count: number };

async function sendJson(path: string, body: unknown): Promise<UnknownRecord> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as UnknownRecord | null;
  if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, `The request failed (${response.status}).`));
  return asRecord(payload ?? {});
}

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";
const textareaClass = "min-h-20 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground";
const labelClass = "flex w-full min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

export function PerformanceOkrPage() {
  // Deep-link preselect (?record=<objectiveId>); lazy initializer keeps SSR output stable.
  const [selectedObjectiveId, setSelectedObjectiveId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [tab, setTab] = useState("okr");
  const [revision, setRevision] = useState(0);

  const [tree, setTree] = useState<OkrTree | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackView | null>(null);
  const [selfEmployeeId, setSelfEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sessionId, setSessionId] = useState("");
  const [grid, setGrid] = useState<NineBox | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState("");

  const [openForm, setOpenForm] = useState<"" | "okr" | "feedback">("");
  const [busy, setBusy] = useState("");
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");

  const [goalTitle, setGoalTitle] = useState("");
  const [goalOwner, setGoalOwner] = useState("");
  const [goalParent, setGoalParent] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [goalKrTitle, setGoalKrTitle] = useState("");
  const [goalKrTarget, setGoalKrTarget] = useState("");

  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackProvider, setFeedbackProvider] = useState("");
  const [feedbackPrompt, setFeedbackPrompt] = useState("Share strengths and one growth area.");

  const [linkObjectiveId, setLinkObjectiveId] = useState("");
  const [linkParentId, setLinkParentId] = useState("");
  const [linkWeight, setLinkWeight] = useState("");

  const [placeEmployee, setPlaceEmployee] = useState("");
  const [placePerformance, setPlacePerformance] = useState<Band>("medium");
  const [placePotential, setPlacePotential] = useState<Band>("medium");
  const [placeRationale, setPlaceRationale] = useState("");
  const [placeAdjustment, setPlaceAdjustment] = useState("");

  const [benchPosition, setBenchPosition] = useState("");
  const [benchEmployee, setBenchEmployee] = useState("");
  const [benchReadiness, setBenchReadiness] = useState<string>(READINESS[0].value);
  const [benchGap, setBenchGap] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [treePayload, peoplePayload, sessionPayload, planPayload, membershipPayload] = await Promise.all([
          getJson("/api/v1/okr-tree"),
          getJson("/api/v1/people?page=1&pageSize=100"),
          getJson("/api/v1/calibration-sessions?page=1&pageSize=50"),
          getJson("/api/v1/succession-plans?page=1&pageSize=50"),
          getJson("/api/v1/identity/memberships"),
        ]);
        if (!live) return;

        setTree(readTree(treePayload));
        setPeople(
          listOf(asRecord(peoplePayload).data).map((person) => ({
            id: str(person.id),
            name: `${str(person.firstName)} ${str(person.lastName)}`.trim() || str(person.workEmail, "Unnamed"),
            code: str(person.employeeCode, ""),
          })),
        );
        setSessions(
          listOf(asRecord(sessionPayload).data).map((session) => {
            const attributes = asRecord(session.attributes);
            return {
              id: str(session.id),
              label: str(attributes.department, "All departments"),
              status: str(attributes.status, "open"),
              adjustments: Array.isArray(attributes.adjustments) ? (attributes.adjustments as unknown[]).length : 0,
            };
          }),
        );
        setPlans(
          listOf(asRecord(planPayload).data).map((plan) => {
            const attributes = asRecord(plan.attributes);
            return {
              id: str(plan.id),
              positionCode: str(attributes.position_code, "—"),
              candidates: listOf(attributes.candidates).map((candidate) => ({
                employeeId: str(candidate.employeeId, str(candidate.employee_id)),
                readiness: typeof candidate.readiness === "string" ? candidate.readiness : null,
                gaps: Array.isArray(candidate.gaps) ? (candidate.gaps as unknown[]).map((value) => String(value)) : [],
              })),
              createdAt: str(plan.created_at),
            };
          }),
        );

        const employeeId =
          listOf(asRecord(membershipPayload).memberships)
            .map((membership) => str(membership.employeeId))
            .find((id) => id.length > 0) ?? "";
        setSelfEmployeeId(employeeId);
        setGoalOwner((current) => current || employeeId);
        setFeedbackSubject((current) => current || employeeId);

        if (employeeId) {
          const feedbackPayload = await getJson(`/api/v1/feedback?subjectEmployeeId=${encodeURIComponent(employeeId)}`);
          if (!live) return;
          const data = asRecord(asRecord(feedbackPayload).data);
          setFeedback({ anonymous: data.anonymous === true, count: listOf(data.entries).length });
        }
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : "Performance data could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const activeSessionId = sessionId || sessions[0]?.id || "";

  useEffect(() => {
    let live = true;
    void (async () => {
      if (!activeSessionId) {
        setGrid(null);
        return;
      }
      setGridLoading(true);
      setGridError("");
      try {
        const payload = await getJson(`/api/v1/talent-placements?calibrationSessionId=${encodeURIComponent(activeSessionId)}`);
        if (live) setGrid(readGrid(payload));
      } catch (caught) {
        if (live) {
          setGrid(null);
          setGridError(caught instanceof Error ? caught.message : "The calibration grid could not be loaded.");
        }
      } finally {
        if (live) setGridLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeSessionId, revision]);

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? null, [sessions, activeSessionId]);

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  const personLabel = useCallback(
    (employeeId: string | null): string => {
      if (!employeeId) return "Unassigned";
      const person = peopleById.get(employeeId);
      return person ? `${person.name}${person.code ? ` (${person.code})` : ""}` : `Employee ${shortId(employeeId)}`;
    },
    [peopleById],
  );

  const keyResultsByObjective = useMemo(() => {
    const map = new Map<string, KeyResultRow[]>();
    for (const keyResult of tree?.keyResults ?? []) {
      const bucket = map.get(keyResult.objectiveId);
      if (bucket) bucket.push(keyResult);
      else map.set(keyResult.objectiveId, [keyResult]);
    }
    return map;
  }, [tree]);

  const activeObjective = useMemo(
    () => tree?.nodes.find((node) => node.id === selectedObjectiveId) ?? tree?.nodes[0] ?? null,
    [tree, selectedObjectiveId],
  );

  const weightProblems = useMemo(
    () => (tree?.weightChecks ?? []).filter((check) => check.status === "mismatched" || check.status === "partial"),
    [tree],
  );

  async function run(name: string, action: () => Promise<string>): Promise<void> {
    setBusy(name);
    setFormError("");
    setFormNotice("");
    try {
      const notice = await action();
      setFormNotice(notice);
      refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The request failed.");
    } finally {
      setBusy("");
    }
  }

  const createGoal = () =>
    run("goal", async () => {
      const keyResults =
        goalKrTitle.trim() && Number(goalKrTarget) > 0 ? [{ title: goalKrTitle.trim(), target: Number(goalKrTarget), unit: "pct" }] : [];
      const result = await sendJson("/api/v1/okr-tree", {
        mode: "create",
        title: goalTitle.trim(),
        ownerEmployeeId: goalOwner,
        ...(goalParent ? { parentObjectiveId: goalParent } : {}),
        ...(goalWeight.trim() ? { weightPct: Number(goalWeight) } : {}),
        keyResults,
      });
      setGoalTitle("");
      setGoalKrTitle("");
      setGoalKrTarget("");
      setGoalWeight("");
      return `Objective ${shortId(str(asRecord(result.data).id))} recorded${keyResults.length ? " with its key result" : ""}.`;
    });

  const requestFeedback = () =>
    run("feedback", async () => {
      await sendJson("/api/v1/feedback", {
        subjectEmployeeId: feedbackSubject,
        ...(feedbackProvider ? { providerEmployeeId: feedbackProvider } : {}),
        prompt: feedbackPrompt.trim(),
      });
      return `360 feedback requested for ${personLabel(feedbackSubject)}.`;
    });

  const relink = () =>
    run("link", async () => {
      await sendJson("/api/v1/okr-tree", {
        mode: "link",
        objectiveId: linkObjectiveId,
        parentObjectiveId: linkParentId === "" ? null : linkParentId,
        ...(linkWeight.trim() ? { weightPct: Number(linkWeight) } : {}),
      });
      setLinkWeight("");
      return "Cascade updated. Progress above this objective is recomputed from its key results.";
    });

  const place = () =>
    run("place", async () => {
      await sendJson("/api/v1/talent-placements", {
        calibrationSessionId: activeSessionId,
        employeeId: placeEmployee,
        performanceBand: placePerformance,
        potentialBand: placePotential,
        rationale: placeRationale.trim(),
        ...(placeAdjustment.trim() ? { adjustmentReason: placeAdjustment.trim() } : {}),
      });
      setPlaceRationale("");
      setPlaceAdjustment("");
      return `${personLabel(placeEmployee)} placed at ${BAND_LABELS[placePerformance]} performance / ${BAND_LABELS[placePotential]} potential.`;
    });

  const recordBench = () =>
    run("bench", async () => {
      await sendJson("/api/v1/succession-plans", {
        positionCode: benchPosition.trim(),
        candidates: [
          {
            employeeId: benchEmployee,
            readiness: benchReadiness,
            gaps: benchGap.trim() ? [benchGap.trim()] : [],
          },
        ],
      });
      setBenchGap("");
      return `${personLabel(benchEmployee)} recorded on the bench for ${benchPosition.trim()} as "${READINESS.find((entry) => entry.value === benchReadiness)?.label}".`;
    });

  const tabs = [
    { value: "okr", label: "Cascading OKRs & KRAs" },
    { value: "calibration", label: "9-box calibration" },
    { value: "coaching", label: "Manager coaching" },
    { value: "succession", label: "Succession risk" },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="PERFORMANCE · CAPABILITY MANAGEMENT"
        title="Performance and capability management"
        description="Cascade objectives and roll key-result progress up by weight, calibrate a 9-box against a session, keep the manager coaching register with its provenance, and record the succession bench."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={openForm === "okr" ? "default" : "outline"}
              className="h-10 rounded-xl px-4 text-xs font-bold"
              onClick={() => setOpenForm((current) => (current === "okr" ? "" : "okr"))}
              aria-expanded={openForm === "okr"}
              aria-controls="new-okr-goal"
            >
              <Plus className="mr-1.5 size-4" /> New OKR goal
            </Button>
            <Button
              variant={openForm === "feedback" ? "default" : "outline"}
              className="h-10 rounded-xl px-4 text-xs font-bold"
              onClick={() => setOpenForm((current) => (current === "feedback" ? "" : "feedback"))}
              aria-expanded={openForm === "feedback"}
              aria-controls="request-360"
            >
              Request 360 feedback
            </Button>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
          </div>
        }
      />

      {formError ? (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {formError}
        </p>
      ) : null}
      {formNotice ? (
        <p role="status" className="mb-4 rounded-xl border border-success/40 bg-success/5 px-3 py-2 text-xs text-success">
          {formNotice}
        </p>
      ) : null}

      {openForm === "okr" ? (
        <Surface className="mb-6" >
          <div id="new-okr-goal">
            <SectionHeading
              title="New OKR goal"
              description="Writes a real objective through POST /api/v1/okr-tree: the objective, its place in the cascade, its weight and its first key result in one audited call. Nothing here is discarded on submit."
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className={labelClass}>
                Objective
                <input className={inputClass} value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Lift plant OEE to 85%" />
              </label>
              <label className={labelClass}>
                Owner
                <select className={selectClass} value={goalOwner} onChange={(event) => setGoalOwner(event.target.value)}>
                  <option value="">Select an employee</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}{person.code ? ` (${person.code})` : ""}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Cascades under
                <select className={selectClass} value={goalParent} onChange={(event) => setGoalParent(event.target.value)}>
                  <option value="">Top level (no parent)</option>
                  {(tree?.nodes ?? []).map((node) => (
                    <option key={node.id} value={node.id}>{node.title}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Weight in parent (%)
                <input className={inputClass} inputMode="decimal" value={goalWeight} onChange={(event) => setGoalWeight(event.target.value)} placeholder="40" />
              </label>
              <label className={labelClass}>
                First key result
                <input className={inputClass} value={goalKrTitle} onChange={(event) => setGoalKrTitle(event.target.value)} placeholder="OEE reaches 85" />
              </label>
              <label className={labelClass}>
                Key-result target
                <input className={inputClass} inputMode="decimal" value={goalKrTarget} onChange={(event) => setGoalKrTarget(event.target.value)} placeholder="85" />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button
                className="h-10 sm:h-9 rounded-lg text-xs"
                disabled={busy === "goal" || goalTitle.trim().length === 0 || goalOwner.length === 0}
                onClick={() => void createGoal()}
              >
                {busy === "goal" ? "Recording…" : "Record objective"}
              </Button>
              <p className="text-[11px] text-muted-foreground">Sibling weights should add up to 100%. The screen reports the total either way rather than silently rescaling it.</p>
            </div>
          </div>
        </Surface>
      ) : null}

      {openForm === "feedback" ? (
        <Surface className="mb-6">
          <div id="request-360">
            <SectionHeading
              title="Request 360 feedback"
              description="Writes a real feedback request through POST /api/v1/feedback. Responses stay anonymous until at least five people have answered."
            />
            <div className="grid gap-3 md:grid-cols-3">
              <label className={labelClass}>
                Subject
                <select className={selectClass} value={feedbackSubject} onChange={(event) => setFeedbackSubject(event.target.value)}>
                  <option value="">Select an employee</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Provider (optional)
                <select className={selectClass} value={feedbackProvider} onChange={(event) => setFeedbackProvider(event.target.value)}>
                  <option value="">Any invited respondent</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Prompt
                <input className={inputClass} value={feedbackPrompt} onChange={(event) => setFeedbackPrompt(event.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button className="h-10 sm:h-9 rounded-lg text-xs" disabled={busy === "feedback" || feedbackSubject.length === 0 || feedbackPrompt.trim().length === 0} onClick={() => void requestFeedback()}>
                {busy === "feedback" ? "Requesting…" : "Request feedback"}
              </Button>
              {feedback ? (
                <StatusPill tone={feedback.anonymous ? "warning" : "success"}>
                  {feedback.anonymous
                    ? `Your own cohort: ${feedback.count} response${feedback.count === 1 ? "" : "s"}, still anonymised`
                    : `Your own cohort: ${feedback.count} responses, attributable`}
                </StatusPill>
              ) : null}
            </div>
          </div>
        </Surface>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="gap-4">
        <TabsList aria-label="Performance and capability registers" variant="line" className="w-full max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          {tabs.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value} className="h-10 px-3">
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="okr">
          <Surface className="mb-6">
            <SectionHeading
              title="Derived cascade"
              description="Objective progress is computed from key-result attainment and the declared weights. Any stored progress figure is shown only where it disagrees with the derived one."
              action={
                <StatusPill tone={tree?.thresholdsConfigured ? "success" : "warning"}>
                  {tree?.thresholdsConfigured ? "RAG thresholds configured" : "RAG not configured"}
                </StatusPill>
              }
            />
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{tree?.healthNote || "Loading the health policy…"}</p>

            {weightProblems.length > 0 ? (
              <div className="mb-4 space-y-2">
                {weightProblems.map((check) => (
                  <p key={check.parentId ?? "root"} className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span>
                      <StatusPill tone={weightTone(check.status)}>
                        {check.status === "mismatched" ? `Weights total ${check.sumPct}%` : "Partly weighted"}
                      </StatusPill>{" "}
                      <span className="font-semibold text-foreground">
                        {check.parentId === null ? "Top level" : tree?.nodes.find((node) => node.id === check.parentId)?.title ?? "Objective"}:
                      </span>{" "}
                      {check.message}
                    </span>
                  </p>
                ))}
              </div>
            ) : null}

            {loading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
                  <RefreshCcw className="mr-1.5 size-3.5" /> Retry
                </Button>
              </div>
            ) : (tree?.nodes.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
                No objective exists yet. Record the first one with &ldquo;New OKR goal&rdquo;, then cascade the rest under it.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-bold">Objective</th>
                      <th className="px-3 py-2 font-bold">Owner</th>
                      <th className="px-3 py-2 text-right font-bold">Weight</th>
                      <th className="px-3 py-2 font-bold">Derived progress</th>
                      <th className="px-3 py-2 font-bold">Rolled up from</th>
                      <th className="px-3 py-2 font-bold">Health</th>
                      <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tree?.nodes ?? []).map((node) => {
                      const selected = node.id === activeObjective?.id;
                      return (
                        <tr key={node.id} className={`border-t border-border/60 ${selected ? "bg-primary/5" : ""}`}>
                          <td className="px-3 py-2 text-xs font-semibold text-foreground" style={{ paddingLeft: `${12 + node.depth * 18}px` }}>
                            {node.depth > 0 ? <span className="mr-1 text-muted-foreground">└</span> : null}
                            {node.title}
                            {node.storedDisagrees ? (
                              <span className="ml-2 text-[11px] font-normal text-warning">stored {pct(node.storedProgressPct)}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{personLabel(node.ownerEmployeeId)}</td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{node.weightPct === null ? "—" : `${node.weightPct}%`}</td>
                          <td className="px-3 py-2"><ProgressBar value={node.derivedProgressPct} label={node.title} /></td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {node.progressSource === "children"
                              ? `${node.childIds.length} child objective${node.childIds.length === 1 ? "" : "s"}`
                              : node.progressSource === "children-and-own-key-results"
                                ? `${node.childIds.length} children + own key results`
                                : node.progressSource === "key-results"
                                  ? `${node.keyResultCount} key result${node.keyResultCount === 1 ? "" : "s"}`
                                  : "Nothing measurable"}
                            {node.weightMode === "equal-fallback" ? <span className="ml-1 italic">(equal weights)</span> : null}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill tone={healthTone(node.health.status)}>{healthLabel(node.health.status)}</StatusPill>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={`Inspect ${node.title}`}
                              aria-current={selected ? "true" : undefined}
                              onClick={() => setSelectedObjectiveId(node.id)}
                            >
                              <ChevronRight className="size-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Surface>
              <SectionHeading
                title="Objective detail"
                description={activeObjective ? activeObjective.title : "Select an objective"}
                action={activeObjective ? <StatusPill tone={healthTone(activeObjective.health.status)}>{healthLabel(activeObjective.health.status)}</StatusPill> : undefined}
              />
              {!activeObjective ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No objective selected.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">{activeObjective.health.reason}</p>
                  {activeObjective.notes.length > 0 ? (
                    <ul className="space-y-1.5">
                      {activeObjective.notes.map((note) => (
                        <li key={note} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 font-bold">Key result</th>
                          <th className="px-3 py-2 text-right font-bold">Current / target</th>
                          <th className="px-3 py-2 text-right font-bold">Weight</th>
                          <th className="px-3 py-2 font-bold">Attainment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(keyResultsByObjective.get(activeObjective.id) ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">
                              No key result is recorded, so this objective contributes nothing measurable to its parent.
                            </td>
                          </tr>
                        ) : (
                          (keyResultsByObjective.get(activeObjective.id) ?? []).map((keyResult) => (
                            <tr key={keyResult.id} className="border-t border-border/60">
                              <td className="px-3 py-2 text-xs font-semibold text-foreground">{keyResult.title}</td>
                              <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                                {keyResult.current} / {keyResult.target} {keyResult.unit}
                              </td>
                              <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                                {keyResult.weightPct === null ? "—" : `${keyResult.weightPct}%`}
                              </td>
                              <td className="px-3 py-2"><ProgressBar value={keyResult.progressPct} label={keyResult.title} /></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Surface>

            <Surface>
              <SectionHeading
                title="Re-cascade an objective"
                description="Moves an objective under a different parent or restates its weight. A parent that would make the objective its own ancestor is refused."
              />
              <div className="space-y-3">
                <label className={labelClass}>
                  Objective
                  <select className={selectClass} value={linkObjectiveId} onChange={(event) => setLinkObjectiveId(event.target.value)}>
                    <option value="">Select an objective</option>
                    {(tree?.nodes ?? []).map((node) => (
                      <option key={node.id} value={node.id}>{node.title}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  New parent
                  <select className={selectClass} value={linkParentId} onChange={(event) => setLinkParentId(event.target.value)}>
                    <option value="">Top level (detach)</option>
                    {(tree?.nodes ?? []).filter((node) => node.id !== linkObjectiveId).map((node) => (
                      <option key={node.id} value={node.id}>{node.title}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Weight in parent (%)
                  <input className={inputClass} inputMode="decimal" value={linkWeight} onChange={(event) => setLinkWeight(event.target.value)} placeholder="Leave blank to keep" />
                </label>
                <Button className="h-10 sm:h-9 rounded-lg text-xs" disabled={busy === "link" || linkObjectiveId.length === 0} onClick={() => void relink()}>
                  {busy === "link" ? "Saving…" : "Update cascade"}
                </Button>
              </div>
            </Surface>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="calibration">
          <Surface className="mb-6">
            <SectionHeading
              title="Calibration session"
              description="Placements are recorded against one session. Nobody appears on the grid until a facilitator puts them there."
              action={
                grid ? (
                  <StatusPill tone={grid.bandingConfigured ? "success" : "warning"}>
                    {grid.bandingConfigured ? "Automatic banding configured" : "Manual placement only"}
                  </StatusPill>
                ) : undefined
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <span className="text-xs font-bold text-muted-foreground">Session</span>
                <select aria-label="Calibration session" className={selectClass} value={activeSessionId} onChange={(event) => setSessionId(event.target.value)}>
                  {sessions.length === 0 ? <option value="">No calibration session exists</option> : null}
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{`${session.label} · ${session.status} · ${session.adjustments} adjustment${session.adjustments === 1 ? "" : "s"}`}</option>
                  ))}
                </select>
              </label>
              {activeSession ? (
                <StatusPill tone={sessionStatusTone(activeSession.status)}>{activeSession.status}</StatusPill>
              ) : null}
              {grid ? <p className="text-xs leading-relaxed text-muted-foreground">{grid.bandingNote}</p> : null}
            </div>
          </Surface>

          {gridLoading && !grid ? (
            <Surface className="mb-6"><p className="py-6 text-center text-xs text-muted-foreground">Loading…</p></Surface>
          ) : gridError ? (
            <Surface className="mb-6">
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-xs leading-relaxed text-muted-foreground">{gridError}</p>
                <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
                  <RefreshCcw className="mr-1.5 size-3.5" /> Retry
                </Button>
              </div>
            </Surface>
          ) : !grid ? (
            <Surface className="mb-6">
              <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
                No calibration session exists yet. Open one through POST /api/v1/calibration-sessions before anybody can be placed.
              </p>
            </Surface>
          ) : (
            <Surface className="mb-6">
              <SectionHeading title="9-box grid" description={grid.unplacedNote} />
              <div className="-mx-1 overflow-x-auto px-1">
                <div className="grid min-w-[540px] grid-cols-3 gap-3">
                  {grid.cells.map((cell) => (
                    <div key={cell.key} className="min-h-28 min-w-0 rounded-xl border border-border/80 bg-card p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cell.label}</p>
                      {cell.employeeIds.length === 0 ? (
                        <p className="mt-2 text-xs italic text-muted-foreground">Nobody placed here.</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {cell.employeeIds.map((employeeId) => (
                            <li key={employeeId} className="break-words text-xs font-semibold text-foreground">{personLabel(employeeId)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Surface>
          )}

          <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
            <Surface>
              <SectionHeading title="Record a placement" description="Both bands are stated by a person. Moving somebody out of a cell already recorded in this session needs an adjustment reason." />
              <div className="space-y-3">
                <label className={labelClass}>
                  Employee
                  <select className={selectClass} value={placeEmployee} onChange={(event) => setPlaceEmployee(event.target.value)}>
                    <option value="">Select an employee</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    Performance
                    <select className={selectClass} value={placePerformance} onChange={(event) => setPlacePerformance(event.target.value as Band)}>
                      {BANDS.map((band) => (
                        <option key={band} value={band}>{BAND_LABELS[band]}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Potential
                    <select className={selectClass} value={placePotential} onChange={(event) => setPlacePotential(event.target.value as Band)}>
                      {BANDS.map((band) => (
                        <option key={band} value={band}>{BAND_LABELS[band]}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={labelClass}>
                  Rationale
                  <textarea className={textareaClass} value={placeRationale} onChange={(event) => setPlaceRationale(event.target.value)} placeholder="What evidence puts this person in this cell?" />
                </label>
                <label className={labelClass}>
                  Adjustment reason (only when moving an existing placement)
                  <input className={inputClass} value={placeAdjustment} onChange={(event) => setPlaceAdjustment(event.target.value)} />
                </label>
                <Button
                  className="h-10 sm:h-9 rounded-lg text-xs"
                  disabled={busy === "place" || !activeSessionId || placeEmployee.length === 0 || placeRationale.trim().length === 0}
                  onClick={() => void place()}
                >
                  {busy === "place" ? "Recording…" : "Record placement"}
                </Button>
              </div>
            </Surface>

            <Surface>
              <SectionHeading title="Placement register" description="Who placed whom, when, and why." />
              {!grid || grid.placements.length === 0 ? (
                <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
                  No placement has been recorded in this session. The grid stays empty until somebody places a person; nothing is inferred from a rating.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Employee</th>
                        <th className="px-3 py-2 font-bold">Cell</th>
                        <th className="px-3 py-2 font-bold">Recorded</th>
                        <th className="px-3 py-2 font-bold">Review evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grid.placements.map((placement) => (
                        <tr key={placement.id} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">{personLabel(placement.employeeId)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {BAND_LABELS[placement.performanceBand as Band] ?? placement.performanceBand} / {BAND_LABELS[placement.potentialBand as Band] ?? placement.potentialBand}
                            <span className="block italic">{placement.rationale}</span>
                            {placement.adjustmentReason ? <span className="block text-warning">Adjusted: {placement.adjustmentReason}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {placement.placedAt ? placement.placedAt.slice(0, 10) : "—"}
                            <span className="block">by {placement.placedByUserId ? shortId(placement.placedByUserId) : "unknown"}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {placement.anonymised ? placement.anonymityNote : placement.reviewRating === null ? "No linked review summary" : `Rating ${placement.reviewRating}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Surface>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="coaching">
          <Surface className="mb-6">
            <SectionHeading
              title="Manager coaching register"
              description="A register of coaching notes and the growth actions taken from them. Every note carries its author, its timestamp and whether a person or a model produced it."
              action={<StatusPill tone="warning">Not yet reachable</StatusPill>}
            />
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              The server side of this register is implemented in{" "}
              <code className="rounded bg-secondary px-1 py-0.5">src/server/performance/calibration.ts</code> —{" "}
              <code className="rounded bg-secondary px-1 py-0.5">recordCoachingNote</code>,{" "}
              <code className="rounded bg-secondary px-1 py-0.5">listCoachingNotes</code> and{" "}
              <code className="rounded bg-secondary px-1 py-0.5">applyGrowthAction</code>, which writes a tracked growth action against the subject.
              It is not wired to the browser because {COACHING_ROUTE_GAP}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nothing is shown in its place. An empty register is an empty register: presenting a generated suggestion here as coaching advice, or
              rendering model output without saying it is model output, is exactly the failure this screen exists to avoid.
            </p>
          </Surface>

          <Surface>
            <SectionHeading title="How a note is presented once the route exists" description="The two provenance states the register renders, verbatim from describeCoachingOrigin()." />
            <ul className="space-y-3">
              <li className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3 py-3">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  <span className="block font-semibold text-foreground">Written by a person.</span>
                  The author&rsquo;s user id, the manager, the subject and the timestamp are stored on the note.
                </span>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-ai/30 bg-ai/5 px-3 py-3">
                <Bot className="mt-0.5 size-4 shrink-0 text-ai" />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  <span className="block font-semibold text-foreground">Generated by model run &lt;ai_run_id&gt; — not written by a person. Review before acting on it.</span>
                  A note recorded as model-generated must carry the <code className="rounded bg-secondary px-1 py-0.5">ai_run_id</code> it came from; the payload
                  schema refuses it otherwise, and refuses a human-attributed note that carries one.
                </span>
              </li>
            </ul>
          </Surface>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="succession">
          <Surface className="mb-6">
            <SectionHeading
              title="Succession bench"
              description="Readiness is a value somebody recorded from a closed vocabulary. No readiness percentage is shown, because no formula for one is defined anywhere in this product."
              action={<StatusPill tone="neutral">{plans.length} plan{plans.length === 1 ? "" : "s"}</StatusPill>}
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
            ) : plans.length === 0 ? (
              <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
                No succession plan has been recorded. Record the first one below; the position code must already exist in the position register.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-bold">Position</th>
                      <th className="px-3 py-2 font-bold">Bench</th>
                      <th className="px-3 py-2 text-right font-bold">Ready now</th>
                      <th className="px-3 py-2 font-bold">Cover</th>
                      <th className="px-3 py-2 font-bold">Critical role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => {
                      const readyNow = plan.candidates.filter((candidate) => candidate.readiness === "ready-now").length;
                      const assessed = plan.candidates.filter((candidate) => candidate.readiness !== null).length;
                      const notAssessed = plan.candidates.length === 0;
                      return (
                        <tr key={plan.id} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">{plan.positionCode}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {plan.candidates.length === 0 ? (
                              <span className="italic">No candidate recorded</span>
                            ) : (
                              <ul className="space-y-1">
                                {plan.candidates.map((candidate) => (
                                  <li key={`${plan.id}-${candidate.employeeId}`}>
                                    {personLabel(candidate.employeeId)} —{" "}
                                    <span className="font-semibold text-foreground">
                                      {READINESS.find((entry) => entry.value === candidate.readiness)?.label ?? "Readiness not recorded"}
                                    </span>
                                    {candidate.gaps.length > 0 ? <span className="block italic">Gaps: {candidate.gaps.join(", ")}</span> : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <span className="mt-1 block text-[11px]">{assessed} of {plan.candidates.length} candidates carry a recorded readiness.</span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{readyNow}</td>
                          <td className="px-3 py-2 text-xs">
                            {notAssessed ? (
                              <StatusPill tone="neutral">Not assessed</StatusPill>
                            ) : readyNow === 0 ? (
                              <StatusPill tone="danger">Single point of failure</StatusPill>
                            ) : (
                              <StatusPill tone="success">Covered</StatusPill>
                            )}
                            <span className="mt-1 block leading-relaxed text-muted-foreground">
                              {notAssessed
                                ? "No candidate has been recorded, so nothing can be concluded about cover."
                                : "Criterion: the position has recorded candidates but none of them is recorded as ready now."}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            Not recorded. No criticality criterion is defined in this system, so a role is critical only when somebody records it as such.
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>

          <Surface>
            <SectionHeading
              title="Record a bench candidate"
              description="Writes a real succession plan through POST /api/v1/succession-plans with the recorded readiness vocabulary."
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className={labelClass}>
                Position code
                <input className={inputClass} value={benchPosition} onChange={(event) => setBenchPosition(event.target.value)} placeholder="SPN-OP-03" />
              </label>
              <label className={labelClass}>
                Candidate
                <select className={selectClass} value={benchEmployee} onChange={(event) => setBenchEmployee(event.target.value)}>
                  <option value="">Select an employee</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Recorded readiness
                <select className={selectClass} value={benchReadiness} onChange={(event) => setBenchReadiness(event.target.value)}>
                  {READINESS.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Development gap (optional)
                <input className={inputClass} value={benchGap} onChange={(event) => setBenchGap(event.target.value)} placeholder="Commercial exposure" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                className="h-10 sm:h-9 rounded-lg text-xs"
                disabled={busy === "bench" || benchPosition.trim().length === 0 || benchEmployee.length === 0}
                onClick={() => void recordBench()}
              >
                {busy === "bench" ? "Recording…" : "Record bench candidate"}
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The single-point-of-failure flag and the critical-role flag need their own{" "}
                <code className="rounded bg-secondary px-1 py-0.5">succession_candidates</code> write — see{" "}
                <code className="rounded bg-secondary px-1 py-0.5">recordSuccessionCandidate</code> in calibration.ts — which has no route yet.
              </p>
            </div>
            {selfEmployeeId ? null : (
              <p className="mt-3 text-[11px] text-muted-foreground">Your login is not linked to an employee record, so the self-service defaults are blank.</p>
            )}
          </Surface>
        </TabsContent>
      </Tabs>
    </div>
  );
}
