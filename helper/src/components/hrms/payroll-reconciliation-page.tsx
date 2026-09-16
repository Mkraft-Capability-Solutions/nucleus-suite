"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/** Null stays null: an unknown side of an assertion must never render as zero. */
function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period || "—";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${sign}${whole}.${String(absolute % 100).padStart(2, "0")}`;
}

/** A variance is shown with its sign, always, so the direction is never lost. */
function signedMoney(amountMinor: number): string {
  return `${amountMinor > 0 ? "+" : ""}${money(amountMinor)}`;
}

function scopeLabel(scope: string): string {
  if (scope === "regular") return "Regular";
  if (scope === "ot") return "Off-cycle overtime";
  if (scope === "full_final") return "Full and final";
  if (scope === "correction") return "Correction";
  return scope || "—";
}

/** The control's own verdict: passing, out by an amount, or unprovable. */
function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "pass") return "success";
  if (status === "variance") return "danger";
  if (status === "indeterminate") return "warning";
  return "neutral";
}

function stateTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "reconciled") return "success";
  if (state === "explained") return "info";
  if (state === "escalated") return "danger";
  if (state === "open") return "warning";
  return "neutral";
}

const STATUS_LABELS: Record<string, string> = {
  pass: "Pass",
  variance: "Variance",
  indeterminate: "Indeterminate",
};

const STATE_LABELS: Record<string, string> = {
  open: "Open",
  explained: "Explained",
  reconciled: "Reconciled",
  escalated: "Escalated",
};

const DISPOSITION_LABELS: Record<string, string> = {
  timing: "Timing difference",
  data_correction: "Correction required at source",
  accepted: "Accepted variance",
  reconcile: "Close as reconciled",
  escalate: "Escalate",
};

type RunRow = { id: string; period: string; scope: string; status: string };

type CheckDetail = { label: string; value: string };

type CheckRow = {
  id: string;
  resultId: string;
  runId: string;
  key: string;
  label: string;
  expectedMinor: number | null;
  actualMinor: number | null;
  varianceMinor: number | null;
  status: string;
  state: string;
  reason: string | null;
  expectedSource: string;
  actualSource: string;
  detail: CheckDetail[];
  disposition: string | null;
  note: string | null;
  allowedDispositions: string[];
  explanations: Array<{ disposition: string; note: string; state: string; recordedAt: string }>;
  ranAt: string | null;
};

type TimelineStep = { key: string; label: string; state: string };

type Detail = {
  id: string;
  runId: string;
  period: string;
  runType: string;
  state: string;
  lifecycle: string;
  ranAt: string | null;
  timeline: TimelineStep[];
  summary: { checks: number; passed: number; variances: number; indeterminate: number; totalVarianceMinor: number };
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
  pairings: Array<{ id: string; employeeCode: string | null; bankAmountMinor: number; matched: boolean }>;
};

type DrillEmployee = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  expectedMinor: number | null;
  actualMinor: number | null;
  varianceMinor: number | null;
};

type Drill = { checkKey: string; label: string; basis: string; employees: DrillEmployee[]; lineCount: number };

function readChecks(payload: unknown): CheckRow[] {
  const rows = Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : [];
  return rows.map((item) => ({
    id: str(item.id),
    resultId: str(item.resultId),
    runId: str(item.runId),
    key: str(item.key),
    label: str(item.label, str(item.key, "—")),
    expectedMinor: intOrNull(item.expectedMinor),
    actualMinor: intOrNull(item.actualMinor),
    varianceMinor: intOrNull(item.varianceMinor),
    status: str(item.status, "indeterminate"),
    state: str(item.state, "open"),
    reason: typeof item.reason === "string" ? item.reason : null,
    expectedSource: str(item.expectedSource),
    actualSource: str(item.actualSource),
    detail: (Array.isArray(item.detail) ? (item.detail as UnknownRecord[]) : []).map((entry) => ({
      label: str(entry.label),
      value: str(entry.value),
    })),
    disposition: typeof item.disposition === "string" ? item.disposition : null,
    note: typeof item.note === "string" ? item.note : null,
    allowedDispositions: Array.isArray(item.allowedDispositions) ? (item.allowedDispositions as unknown[]).map((value) => String(value)) : [],
    explanations: (Array.isArray(item.explanations) ? (item.explanations as UnknownRecord[]) : []).map((entry) => ({
      disposition: str(entry.disposition),
      note: str(entry.note),
      state: str(entry.state),
      recordedAt: str(entry.recordedAt),
    })),
    ranAt: typeof item.ranAt === "string" ? item.ranAt : null,
  }));
}

function readDetail(payload: unknown): Detail {
  const data = asRecord(asRecord(payload).data);
  const summary = asRecord(data.summary);
  return {
    id: str(data.id),
    runId: str(data.runId),
    period: str(data.period),
    runType: str(data.runType),
    state: str(data.state, "open"),
    lifecycle: str(data.lifecycle, "live"),
    ranAt: typeof data.ranAt === "string" ? data.ranAt : null,
    timeline: (Array.isArray(data.timeline) ? (data.timeline as UnknownRecord[]) : []).map((step) => ({
      key: str(step.key),
      label: str(step.label),
      state: str(step.state, "todo"),
    })),
    summary: {
      checks: int(summary.checks),
      passed: int(summary.passed),
      variances: int(summary.variances),
      indeterminate: int(summary.indeterminate),
      totalVarianceMinor: int(summary.totalVarianceMinor),
    },
    auditTrail: (Array.isArray(data.auditTrail) ? (data.auditTrail as UnknownRecord[]) : []).map((entry) => ({
      action: str(entry.action),
      reason: typeof entry.reason === "string" ? entry.reason : null,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : null,
    })),
    pairings: (Array.isArray(data.pairings) ? (data.pairings as UnknownRecord[]) : []).map((entry) => ({
      id: str(entry.id),
      employeeCode: typeof entry.employeeCode === "string" ? entry.employeeCode : null,
      bankAmountMinor: int(entry.bankAmountMinor),
      matched: entry.matched === true,
    })),
  };
}

function readDrill(payload: unknown): Drill {
  const data = asRecord(asRecord(payload).data);
  return {
    checkKey: str(data.checkKey),
    label: str(data.label),
    basis: str(data.basis),
    employees: (Array.isArray(data.employees) ? (data.employees as UnknownRecord[]) : []).map((entry) => ({
      employeeId: str(entry.employeeId),
      employeeCode: typeof entry.employeeCode === "string" ? entry.employeeCode : null,
      employeeName: str(entry.employeeName, "—"),
      expectedMinor: intOrNull(entry.expectedMinor),
      actualMinor: intOrNull(entry.actualMinor),
      varianceMinor: intOrNull(entry.varianceMinor),
    })),
    lineCount: Array.isArray(data.lines) ? data.lines.length : 0,
  };
}

function reconciliationCsv(run: RunRow | null, checks: CheckRow[]): string {
  const header = [
    "run_id", "period", "run_type", "control_key", "control", "status", "state",
    "expected_minor", "actual_minor", "variance_minor", "expected_source", "actual_source", "reason", "disposition", "note",
  ];
  const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const rows = checks.map((check) =>
    [
      run?.id ?? check.runId,
      run?.period ?? "",
      run?.scope ?? "",
      check.key,
      check.label,
      check.status,
      check.state,
      // An unknown side stays empty in the export too; it is never exported as 0.
      check.expectedMinor === null ? "" : String(check.expectedMinor),
      check.actualMinor === null ? "" : String(check.actualMinor),
      check.varianceMinor === null ? "" : String(check.varianceMinor),
      check.expectedSource,
      check.actualSource,
      check.reason ?? "",
      check.disposition ?? "",
      check.note ?? "",
    ].map((cell) => escape(String(cell))).join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function PayrollReconciliationPage() {
  // Deep-link preselect (?record=<runId>); lazy initializer keeps SSR output stable.
  const [selectedRunId, setSelectedRunId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checksLoading, setChecksLoading] = useState(false);
  const [checksError, setChecksError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCheckKey, setSelectedCheckKey] = useState("");
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState("");
  // The explain form is keyed to the control it belongs to, so selecting another
  // control clears it without an effect that writes state during render.
  const [dispositionChoice, setDispositionChoice] = useState("");
  const [noteDraft, setNoteDraft] = useState({ itemId: "", text: "" });
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainFailure, setExplainFailure] = useState({ itemId: "", message: "" });

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
        const payload = await getJson("/api/v1/payroll-runs?page=1&pageSize=100");
        const rows = (Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          period: str(item.period, "—"),
          scope: str(item.scope, "—"),
          status: str(item.status, "—"),
        }));
        if (live) setRuns(rows);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Payroll runs could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const activeRun = useMemo(() => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null, [runs, selectedRunId]);
  const activeRunId = activeRun?.id ?? "";

  useEffect(() => {
    if (!activeRunId) return;
    let live = true;
    void (async () => {
      setChecksLoading(true);
      setChecksError("");
      try {
        const payload = await getJson(`/api/v1/reconciliations?payrollRunId=${encodeURIComponent(activeRunId)}&page=1&pageSize=50`);
        const rows = readChecks(payload);
        if (!live) return;
        setChecks(rows);
        const resultId = rows[0]?.resultId ?? "";
        if (resultId === "") {
          setDetail(null);
          return;
        }
        const detailPayload = await getJson(`/api/v1/reconciliations/${encodeURIComponent(resultId)}`);
        if (live) setDetail(readDetail(detailPayload));
      } catch (err) {
        if (live) {
          setChecks([]);
          setDetail(null);
          setChecksError(err instanceof Error ? err.message : "The reconciliation could not be loaded.");
        }
      } finally {
        if (live) setChecksLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeRunId, revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return checks.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (needle && !`${row.label} ${row.key}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [checks, search, statusFilter]);

  const activeCheck = useMemo(
    () => checks.find((row) => row.key === selectedCheckKey) ?? filtered[0] ?? null,
    [checks, selectedCheckKey, filtered],
  );

  // RL-531: the contributing employees behind the selected control's figure.
  useEffect(() => {
    const resultId = activeCheck?.resultId ?? "";
    const checkKey = activeCheck?.key ?? "";
    if (resultId === "" || checkKey === "") return;
    let live = true;
    void (async () => {
      setDrillLoading(true);
      setDrillError("");
      try {
        const payload = await getJson(`/api/v1/reconciliations/${encodeURIComponent(resultId)}?drill=${encodeURIComponent(checkKey)}`);
        if (live) setDrill(readDrill(payload));
      } catch (err) {
        if (live) {
          setDrill(null);
          setDrillError(err instanceof Error ? err.message : "The drill-back could not be loaded.");
        }
      } finally {
        if (live) setDrillLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeCheck?.resultId, activeCheck?.key, revision]);

  const activeCheckId = activeCheck?.id ?? "";
  // Derived, not stored: a choice that the selected control does not offer falls
  // back to its first available disposition.
  const disposition = activeCheck && activeCheck.allowedDispositions.includes(dispositionChoice)
    ? dispositionChoice
    : activeCheck?.allowedDispositions[0] ?? "";
  const note = noteDraft.itemId === activeCheckId ? noteDraft.text : "";
  const explainError = explainFailure.itemId === activeCheckId ? explainFailure.message : "";

  const runReconciliation = useCallback(async () => {
    if (!activeRunId) return;
    setRunBusy(true);
    setRunError("");
    try {
      const response = await fetch("/api/v1/reconciliations", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ payrollRunId: activeRunId }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `The reconciliation could not be run (${response.status}).`);
      }
      invalidateGetRequests();
      setRevision((n) => n + 1);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "The reconciliation could not be run.");
    } finally {
      setRunBusy(false);
    }
  }, [activeRunId]);

  const submitExplanation = useCallback(async () => {
    if (!activeCheck || disposition === "") return;
    const itemId = activeCheck.id;
    setExplainBusy(true);
    setExplainFailure({ itemId, message: "" });
    try {
      const response = await fetch(`/api/v1/reconciliations/${encodeURIComponent(activeCheck.resultId)}`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ action: "explain", itemId, disposition, note }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `The explanation could not be recorded (${response.status}).`);
      }
      setNoteDraft({ itemId, text: "" });
      invalidateGetRequests();
      setRevision((n) => n + 1);
    } catch (err) {
      setExplainFailure({ itemId, message: err instanceof Error ? err.message : "The explanation could not be recorded." });
    } finally {
      setExplainBusy(false);
    }
  }, [activeCheck, disposition, note]);

  function downloadCsv(): void {
    if (checks.length === 0) return;
    const csv = reconciliationCsv(activeRun, checks);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payroll-reconciliation-${activeRun?.period || activeRunId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const summary = detail?.summary ?? null;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-103"
        title="Payroll reconciliation"
        description="Prove the seven FIN-04.1 assertions for a payroll run, drill any variance back to the employees behind it, and export the control sheet before the period is closed."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            {activeRunId ? (
              <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={runBusy} onClick={() => void runReconciliation()}>
                {runBusy ? "Reconciling…" : "Run reconciliation"}
              </Button>
            ) : null}
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-103"
          description="Run → drill → export. RL-530 requires all seven assertions to pass and to be shown passing, so each control is evaluated on its own and reports both sides of its comparison: journal gross against payslip earnings, journal net against the released bank file, statutory heads against remitted amounts, dimension sums against the journal total, off-cycle overtime against approved attendance, loan recovery against the movement in loan outstanding, and gross less deductions against net."
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          A variance is shown with its sign and never absorbed. A control whose other side does not exist in this system is reported as indeterminate and names the missing source rather than comparing a figure to itself — the statutory control is in that position today, because nothing here records a remitted or challan amount. Each variance moves Open → Explained → Reconciled, a reason of at least ten characters is required before it can be explained, and any variance can be escalated. Re-running an unchanged reconciliation is a no-op, so recorded explanations survive; a changed result supersedes the previous one, which is retained.
        </p>
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <label className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="shrink-0 text-xs font-bold text-muted-foreground">Payroll run</span>
          <select
            aria-label="Payroll run"
            className={`${selectClass} w-full max-w-full sm:w-auto`}
            value={activeRunId}
            onChange={(e) => {
              setSelectedRunId(e.target.value);
              setSelectedCheckKey("");
            }}
          >
            {runs.length === 0 ? <option value="">No runs available</option> : null}
            {runs.map((run) => (
              <option key={run.id} value={run.id}>{`${formatPeriod(run.period)} · ${scopeLabel(run.scope)} · ${run.status}`}</option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {summary ? (
            <>
              <StatusPill tone={summary.passed === summary.checks ? "success" : "neutral"}>{summary.passed} of {summary.checks} passing</StatusPill>
              {summary.variances > 0 ? <StatusPill tone="danger">{summary.variances} variance{summary.variances === 1 ? "" : "s"}</StatusPill> : null}
              {summary.indeterminate > 0 ? <StatusPill tone="warning">{summary.indeterminate} indeterminate</StatusPill> : null}
              {detail ? <StatusPill tone={stateTone(detail.state)}>{STATE_LABELS[detail.state] ?? detail.state}</StatusPill> : null}
            </>
          ) : null}
          <Link href={activeRunId ? `/payroll?record=${encodeURIComponent(activeRunId)}` : "/payroll"} className="text-xs font-bold text-primary hover:underline">
            Open payroll run
          </Link>
        </div>
      </div>

      {runError ? <p role="alert" className="mb-4 text-xs text-destructive">{runError}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={checksLoading ? "Loading…" : `${filtered.length} control${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <input aria-label="Search controls" className={`${inputClass} w-full sm:w-auto`} placeholder="Control name" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select aria-label="Control status filter" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="pass">Pass</option>
                  <option value="variance">Variance</option>
                  <option value="indeterminate">Indeterminate</option>
                </select>
                {checks.length > 0 ? (
                  <Button variant="outline" size="sm" className="h-10 w-full rounded-xl text-xs sm:w-auto" onClick={downloadCsv}>
                    <Download className="mr-1.5 size-3.5" /> Export CSV
                  </Button>
                ) : null}
              </div>
            }
          />
          {loading || checksLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error || checksError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{error || checksError}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {checks.length === 0
                ? activeRunId
                  ? "This run has not been reconciled yet. Run the reconciliation to evaluate the seven assertions."
                  : "Select a payroll run to reconcile."
                : "No controls match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Control</th>
                    <th className="px-3 py-2 text-right font-bold">Expected</th>
                    <th className="px-3 py-2 text-right font-bold">Actual</th>
                    <th className="px-3 py-2 text-right font-bold">Variance</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.key === activeCheck?.key;
                    return (
                      <tr key={row.id}>
                        <td colSpan={6} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSelectedCheckKey(row.key)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                              {row.label}
                              <span className="mt-0.5 block font-normal text-muted-foreground">{STATE_LABELS[row.state] ?? row.state}</span>
                            </span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">
                              {row.expectedMinor === null ? <span className="italic text-muted-foreground">No source</span> : money(row.expectedMinor)}
                            </span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">
                              {row.actualMinor === null ? <span className="italic text-muted-foreground">No source</span> : money(row.actualMinor)}
                            </span>
                            <span className={`whitespace-nowrap text-right text-xs font-semibold tabular-nums ${row.varianceMinor === null ? "" : row.varianceMinor === 0 ? "text-muted-foreground" : "text-destructive"}`}>
                              {row.varianceMinor === null ? <span className="font-normal italic text-muted-foreground">Not computable</span> : signedMoney(row.varianceMinor)}
                            </span>
                            <span><StatusPill tone={statusTone(row.status)}>{STATUS_LABELS[row.status] ?? row.status}</StatusPill></span>
                            <ChevronRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Variance is actual minus expected, signed: a positive figure means the payroll or ledger side is the heavier one. A control marked
                “No source” has no second side to compare against; its reason names what is missing.
              </p>
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="Control detail"
            description={activeCheck ? activeCheck.label : "Select a control to inspect it"}
            action={activeCheck ? <StatusPill tone={statusTone(activeCheck.status)}>{STATUS_LABELS[activeCheck.status] ?? activeCheck.status}</StatusPill> : undefined}
          />
          {!activeCheck ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No control selected.</p>
          ) : (
            <div>
              <dl className="space-y-2 text-xs">
                {[
                  ["Expected", activeCheck.expectedMinor === null ? "No source" : money(activeCheck.expectedMinor)],
                  ["Expected from", activeCheck.expectedSource || "—"],
                  ["Actual", activeCheck.actualMinor === null ? "No source" : money(activeCheck.actualMinor)],
                  ["Actual from", activeCheck.actualSource || "—"],
                  ["Variance", activeCheck.varianceMinor === null ? "Not computable" : signedMoney(activeCheck.varianceMinor)],
                  ["State", STATE_LABELS[activeCheck.state] ?? activeCheck.state],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              {activeCheck.reason ? (
                <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed ${activeCheck.status === "indeterminate" ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"} text-muted-foreground`}>
                  {activeCheck.reason}
                </p>
              ) : null}
              {activeCheck.detail.length > 0 ? (
                <>
                  <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Supporting figures</h3>
                  <dl className="mt-2 space-y-1.5 text-xs">
                    {activeCheck.detail.map((entry) => (
                      <div key={entry.label} className="flex justify-between gap-3">
                        <dt className="min-w-0 text-muted-foreground">{entry.label}</dt>
                        <dd className="shrink-0 text-right tabular-nums text-foreground">{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : null}

              {detail ? (
                <>
                  <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">State</h3>
                  <ol className="mt-2 space-y-1.5">
                    {detail.timeline.map((step) => (
                      <li key={step.key} className="flex items-center gap-2 text-xs">
                        <span className={`size-1.5 rounded-full ${step.state === "done" ? "bg-success" : step.state === "current" ? "bg-primary" : "bg-border"}`} />
                        <span className={step.state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}

              {activeCheck.allowedDispositions.length > 0 ? (
                <>
                  <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Explain this variance</h3>
                  <div className="mt-2 space-y-2">
                    <select aria-label="Disposition" className={`${selectClass} w-full`} value={disposition} onChange={(e) => setDispositionChoice(e.target.value)}>
                      {activeCheck.allowedDispositions.map((value) => (
                        <option key={value} value={value}>{DISPOSITION_LABELS[value] ?? value}</option>
                      ))}
                    </select>
                    <textarea
                      aria-label="Reason"
                      className="min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
                      placeholder="Why does this control not balance? At least ten characters."
                      value={note}
                      onChange={(e) => setNoteDraft({ itemId: activeCheckId, text: e.target.value })}
                    />
                    {explainError ? <p role="alert" className="text-xs text-destructive">{explainError}</p> : null}
                    <Button
                      size="sm"
                      className="h-9 rounded-lg text-xs"
                      disabled={explainBusy || disposition === "" || note.trim().length < 10}
                      onClick={() => void submitExplanation()}
                    >
                      {explainBusy ? "Recording…" : "Record explanation"}
                    </Button>
                  </div>
                </>
              ) : activeCheck.status === "pass" ? (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">This control passes, so it is reconciled and needs no explanation.</p>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">This control is closed; no further disposition is available.</p>
              )}

              {activeCheck.explanations.length > 0 ? (
                <>
                  <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Explanations</h3>
                  <ul className="mt-2 space-y-2">
                    {activeCheck.explanations.map((entry, index) => (
                      <li key={`${entry.recordedAt}-${index}`} className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5 text-xs">
                        <p className="font-semibold text-foreground">{DISPOSITION_LABELS[entry.disposition] ?? entry.disposition} → {STATE_LABELS[entry.state] ?? entry.state}</p>
                        <p className="mt-0.5 leading-relaxed text-muted-foreground">{entry.note}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          )}
        </Surface>
      </div>

      <Surface className="mt-6">
        <SectionHeading
          title="Drill-back"
          description={
            activeCheck
              ? `${activeCheck.label} · the employees and payslip lines behind this figure`
              : "Select a control to drill into it"
          }
          action={drill && drill.lineCount > 0 ? <StatusPill tone="info">{drill.lineCount} journal line{drill.lineCount === 1 ? "" : "s"}</StatusPill> : undefined}
        />
        {!activeCheck ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No control selected.</p>
        ) : drillLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : drillError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{drillError}</p>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : !drill || drill.employees.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            No contributing employees resolve for this control. A control whose journal side has not been posted has nothing to drill into yet.
          </p>
        ) : (
          <div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{drill.basis}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Employee</th>
                    <th className="px-3 py-2 text-right font-bold">Expected</th>
                    <th className="px-3 py-2 text-right font-bold">Actual</th>
                    <th className="px-3 py-2 text-right font-bold">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {drill.employees.slice(0, 200).map((row) => (
                    <tr key={row.employeeId} className="border-t border-border/60">
                      <td className="px-3 py-2 text-xs font-semibold text-foreground">
                        {row.employeeName}
                        {row.employeeCode ? <span className="ml-1 font-normal text-muted-foreground">({row.employeeCode})</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">
                        {row.expectedMinor === null ? <span className="italic text-muted-foreground">No source</span> : money(row.expectedMinor)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">
                        {row.actualMinor === null ? <span className="italic text-muted-foreground">No source</span> : money(row.actualMinor)}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs font-semibold tabular-nums ${row.varianceMinor ? "text-destructive" : "text-muted-foreground"}`}>
                        {row.varianceMinor === null ? <span className="font-normal italic">—</span> : signedMoney(row.varianceMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {drill.employees.length > 200 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">Showing the first 200 of {drill.employees.length} employees. Export the CSV for the full set.</p>
            ) : null}
          </div>
        )}
      </Surface>

      <Surface className="mt-6">
        <SectionHeading
          title="Audit trail"
          description={detail?.ranAt ? `Last reconciled ${new Date(detail.ranAt).toLocaleString()}` : "Every run and every explanation is recorded"}
          action={detail && detail.lifecycle === "superseded" ? <StatusPill tone="warning">Superseded</StatusPill> : undefined}
        />
        {!detail ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">This run has not been reconciled yet.</p>
        ) : detail.auditTrail.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No audit entries have been recorded for this result.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-bold">Action</th>
                  <th className="px-3 py-2 font-bold">Reason</th>
                  <th className="px-3 py-2 font-bold">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {detail.auditTrail.map((entry, index) => (
                  <tr key={`${entry.action}-${entry.createdAt}-${index}`} className="border-t border-border/60">
                    <td className="px-3 py-2 text-xs font-semibold text-foreground">{entry.action}</td>
                    <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{entry.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
