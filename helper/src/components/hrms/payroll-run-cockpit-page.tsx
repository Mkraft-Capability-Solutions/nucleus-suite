"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period || "—";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

const SCOPE_LABELS: Record<string, string> = {
  regular: "Regular",
  ot: "Off-cycle overtime",
  arrears: "Arrears",
  full_final: "Full and final",
  bonus: "Bonus",
  reimbursement: "Reimbursement",
  correction: "Correction",
};

function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope ?? "—";
}

type DisplayStatus = "DRAFT" | "PRE_AUDIT" | "CLOSED";

function displayStatus(status: string): DisplayStatus {
  const key = status.trim().toLowerCase();
  if (key === "finalized" || key === "paid" || key === "closed") return "CLOSED";
  if (key === "draft") return "DRAFT";
  return "PRE_AUDIT";
}

function displayCode(period: string, id: string): string {
  const suffix = (id.replace(/-/g, "").slice(0, 4) || "0000").toUpperCase();
  return `PR-${period || "----/--"}-${suffix}`;
}

function statusTone(status: DisplayStatus): "success" | "warning" | "info" | "neutral" {
  if (status === "CLOSED") return "success";
  if (status === "PRE_AUDIT") return "info";
  return "neutral";
}

type RunRow = {
  id: string;
  period: string;
  scope: string;
  status: string;
  employeeCount: number | null;
};

type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

type CockpitDetail = {
  displayCode: string;
  periodLabel: string;
  scopeLabel: string;
  displayStatus: DisplayStatus;
  timeline: TimelineStep[];
  counts: { members: number; anomaliesOpen: number; anomaliesTotal: number; inputs: number; approvals: number; payslips: number; criticalFlagsOpen: number };
  /** FRM-PAY-03 run header, read back so an existing run shows what was drafted. */
  header: {
    runType: string;
    payDate: string | null;
    includeArrears: boolean;
    populationFilter: string[];
    inputFileReference: string | null;
    snapshotId: string | null;
    inputHash: string | null;
    legalEntityId: string | null;
    payrollGroupId: string;
    rulePackVersionId: string;
  };
  /** FRM-PAY-03 validation panels. A null gate is unknown, never cleared. */
  gates: { attendanceLocked: boolean; leaveLocked: boolean | null; unmappedComponents: number | null };
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
};

type GateRow = { label: string; value: string; pass: boolean | null };

/** FRM-PAY-03 validation panels. A null `pass` means unknown, and never reads as cleared. */
function gateRows(detail: CockpitDetail): GateRow[] {
  const unmapped = detail.gates.unmappedComponents;
  return [
    { label: "Attendance period locked", value: detail.gates.attendanceLocked ? "Locked" : "Not locked", pass: detail.gates.attendanceLocked },
    {
      // The gate answers whether leave touching the period is settled: nothing overlapping
      // it is still awaiting a decision, so the days payroll is about to pay cannot move.
      label: "Leave period settled",
      value: detail.gates.leaveLocked === null
        ? "Not reported"
        : detail.gates.leaveLocked ? "Settled" : "Requests still awaiting a decision",
      pass: detail.gates.leaveLocked,
    },
    { label: "Unmapped components", value: unmapped === null ? "Not visible to this role" : String(unmapped), pass: unmapped === null ? null : unmapped === 0 },
    { label: "Critical audit flags", value: String(detail.counts.criticalFlagsOpen), pass: detail.counts.criticalFlagsOpen === 0 },
  ];
}

function auditLabel(action: string): string {
  return action.replace(/^payroll\./, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) return `${Math.max(1, Math.floor(diffMs / 60_000))} min ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function PayrollRunCockpitPage() {
  // Deep-link preselect (?record=<runId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<CockpitDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [runType, setRunType] = useState("regular");
  const [payDate, setPayDate] = useState("");
  const [includeArrears, setIncludeArrears] = useState(true);
  const [populationFilter, setPopulationFilter] = useState("");
  const [inputFileReference, setInputFileReference] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createOk, setCreateOk] = useState("");

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
        const raw = await getJson("/api/v1/payroll-runs?page=1&pageSize=100");
        const items = asRecord(raw).data;
        const rows = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          period: str(item.period, "—"),
          scope: str(item.scope, "—"),
          status: str(item.status, "—"),
          employeeCount: num(item.employee_count),
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

  function selectRun(id: string): void {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
  }

  const filtered = useMemo(() => {
    return runs.filter((run) => {
      if (scopeFilter !== "all" && run.scope !== scopeFilter) return false;
      if (statusFilter !== "all" && displayStatus(run.status) !== statusFilter) return false;
      return true;
    });
  }, [runs, scopeFilter, statusFilter]);

  const activeRun = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? filtered[0] ?? null,
    [runs, selectedId, filtered],
  );
  const activeId = activeRun?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/payroll-runs/${encodeURIComponent(activeId)}/cockpit`);
        const data = asRecord(asRecord(raw).data);
        const counts = asRecord(data.counts);
        const header = asRecord(data.header);
        const gates = asRecord(data.gates);
        const timeline = Array.isArray(data.timeline) ? (data.timeline as TimelineStep[]) : [];
        const auditTrail = Array.isArray(data.auditTrail)
          ? (data.auditTrail as Array<{ action: string; reason: string | null; createdAt: string | null }>)
          : [];
        if (live) {
          setDetail({
            displayCode: str(data.displayCode, displayCode(str(asRecord(data.run).period, ""), activeId)),
            periodLabel: str(data.periodLabel, ""),
            scopeLabel: str(data.scopeLabel, ""),
            displayStatus: (str(data.displayStatus, "DRAFT") as DisplayStatus) || "DRAFT",
            timeline,
            counts: {
              members: Number(counts.members ?? 0),
              anomaliesOpen: Number(counts.anomaliesOpen ?? 0),
              anomaliesTotal: Number(counts.anomaliesTotal ?? 0),
              inputs: Number(counts.inputs ?? 0),
              approvals: Number(counts.approvals ?? 0),
              payslips: Number(counts.payslips ?? 0),
              criticalFlagsOpen: Number(counts.criticalFlagsOpen ?? 0),
            },
            header: {
              runType: str(header.runType, "regular"),
              payDate: typeof header.payDate === "string" ? header.payDate : null,
              includeArrears: header.includeArrears !== false,
              populationFilter: Array.isArray(header.populationFilter) ? (header.populationFilter as string[]) : [],
              inputFileReference: typeof header.inputFileReference === "string" ? header.inputFileReference : null,
              snapshotId: typeof header.snapshotId === "string" ? header.snapshotId : null,
              inputHash: typeof header.inputHash === "string" ? header.inputHash : null,
              legalEntityId: typeof header.legalEntityId === "string" ? header.legalEntityId : null,
              payrollGroupId: str(header.payrollGroupId),
              rulePackVersionId: str(header.rulePackVersionId),
            },
            gates: {
              attendanceLocked: gates.attendanceLocked === true,
              leaveLocked: typeof gates.leaveLocked === "boolean" ? gates.leaveLocked : null,
              unmappedComponents: typeof gates.unmappedComponents === "number" ? gates.unmappedComponents : null,
            },
            auditTrail,
          });
        }
      } catch (err) {
        if (live) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "Record detail could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  async function createRun(): Promise<void> {
    setCreateError("");
    setCreateOk("");
    if (!/^\d{4}-\d{2}$/.test(period)) {
      setCreateError("A period (YYYY-MM) is required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
      setCreateError("A pay date is required.");
      return;
    }
    // One entry per line: employee code, location or class. Empty means the whole group.
    const population = populationFilter.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean);
    setCreateBusy(true);
    try {
      const response = await fetch("/api/v1/payroll-runs", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          period,
          runType,
          payDate,
          includeArrears,
          ...(population.length > 0 ? { populationFilter: population } : {}),
          ...(inputFileReference.trim() ? { inputFileReference: inputFileReference.trim() } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const err = asRecord(payload).error;
        const message = typeof err === "object" && err !== null ? str(asRecord(err).message, `Request failed (${response.status})`) : `Request failed (${response.status})`;
        throw new Error(message);
      }
      const data = asRecord(asRecord(payload).data);
      const id = str(data.id);
      setCreateOk(`Run drafted (${period} · ${str(data.scope, runType)} · paid ${payDate}).`);
      if (id) selectRun(id);
      setCreateOpen(false);
      refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "The run could not be created.");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Payroll · SCR-030"
        title="Payroll run cockpit"
        description="Manage payroll run cockpit with a scoped work queue, record history and controlled actions."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90" onClick={() => { setCreateError(""); setCreateOk(""); setCreateOpen((v) => !v); }}>
              <Plus className="mr-1.5 size-4" /> Create payroll run
            </Button>
          </div>
        }
      />

      {createOpen ? (
        <Surface className="mb-6">
          <SectionHeading title="New payroll run" description="Draft a run for the selected period. Calculation and approval stay in Payroll." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Period (YYYY-MM)</span>
              <input aria-label="Run period" type="month" className={`${inputClass} w-full`} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Run type</span>
              <select aria-label="Run type" className={`${selectClass} w-full`} value={runType} onChange={(e) => setRunType(e.target.value)}>
                {picklists.PL_RUN_TYPE.values.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pay date</span>
              <input aria-label="Pay date" type="date" className={`${inputClass} w-full`} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Population filter (optional)</span>
              <input aria-label="Population filter" type="text" placeholder="Whole group — or a comma-separated list" className={`${inputClass} w-full`} value={populationFilter} onChange={(e) => setPopulationFilter(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Input file reference (optional)</span>
              <input aria-label="Input file reference" type="text" placeholder="inputs/2026-09-adhoc.csv" className={`${inputClass} w-full`} value={inputFileReference} onChange={(e) => setInputFileReference(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2.5">
              <input aria-label="Include arrears" type="checkbox" className="size-4 rounded border-border" checked={includeArrears} onChange={(e) => setIncludeArrears(e.target.checked)} />
              <span className="text-xs font-semibold text-foreground">Include arrears</span>
            </label>
          </div>
          <Button className="mt-4 h-10 rounded-xl px-4 text-xs font-bold" disabled={createBusy} onClick={() => void createRun()}>
            {createBusy ? "Drafting…" : "Create run"}
          </Button>
          {createError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{createError}</p> : null}
          {createOk ? <p className="mt-3 text-xs leading-relaxed text-success">{createOk}</p> : null}
        </Surface>
      ) : null}

      <Surface className="mb-6">
        <SectionHeading title="Process guide · SCR-050" description="Create run → lock inputs → pre-audit → calculate → review → approve → disburse → close. Irreversible transitions stay in Payroll with maker/checker control." />
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
        <Link href={activeId ? `/payroll?record=${encodeURIComponent(activeId)}` : "/payroll"} className="text-xs font-bold text-primary hover:underline">
          Open payroll
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} record${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <select aria-label="Run type filter" className={`${selectClass} w-full sm:w-auto`} value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
                  <option value="all">All types</option>
                  {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <select aria-label="Status filter" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PRE_AUDIT">Pre-audit</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            }
          />
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {runs.length === 0 ? "No payroll runs exist yet. Draft the first run to begin the cycle." : "No runs match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Period</th>
                    <th className="px-3 py-2 font-bold">Run type</th>
                    <th className="px-3 py-2 text-right font-bold">Population</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((run) => {
                    const selected = run.id === activeId;
                    const status = displayStatus(run.status);
                    return (
                      <tr key={run.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => selectRun(run.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="truncate text-xs font-semibold text-foreground">{formatPeriod(run.period)}</span>
                            <span className="truncate text-xs text-muted-foreground">{scopeLabel(run.scope)}</span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">{run.employeeCount === null ? "—" : String(run.employeeCount)}</span>
                            <span><StatusPill tone={statusTone(status)}>{status.replace("_", " ")}</StatusPill></span>
                            <ChevronRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
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

        <Surface>
          <SectionHeading
            title="Record detail"
            description={activeRun ? `${formatPeriod(activeRun.period)} · ${scopeLabel(activeRun.scope)} · Population ${activeRun.employeeCount === null ? "—" : activeRun.employeeCount}` : "Select a run to inspect its timeline"}
            action={detail ? <StatusPill tone={statusTone(detail.displayStatus)}>{detail.displayStatus.replace("_", " ")}</StatusPill> : undefined}
          />
          {!activeRun ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No run selected.</p>
          ) : detailLoading && !detail ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : detailError && !detail ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : detail ? (
            <div>
              <p className="text-sm font-bold text-foreground">{detail.displayCode}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Period: {detail.periodLabel} · Run type: {detail.scopeLabel} · Population: {detail.counts.members} · Run: {detail.displayCode}
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Pay date", detail.header.payDate ?? "—"],
                  ["Include arrears", detail.header.includeArrears ? "Yes" : "No"],
                  ["Population filter", detail.header.populationFilter.length === 0 ? "Whole group" : detail.header.populationFilter.join(", ")],
                  ["Input file", detail.header.inputFileReference ?? "—"],
                  ["Snapshot", detail.header.snapshotId ?? "Stamped at calculation"],
                  ["Input hash", detail.header.inputHash ? `${detail.header.inputHash.slice(0, 16)}…` : "Stamped at calculation"],
                  ["Rule pack version", detail.header.rulePackVersionId || "—"],
                  ["Payroll group", detail.header.payrollGroupId || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 break-all text-xs font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Approval gates</h3>
              <ul className="mt-2 space-y-1.5">
                {gateRows(detail).map((gate) => (
                  <li key={gate.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">{gate.label}</span>
                    <StatusPill tone={gate.pass === null ? "neutral" : gate.pass ? "success" : "warning"}>{gate.value}</StatusPill>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                {[
                  [`${detail.counts.inputs}`, "Inputs"],
                  [`${detail.counts.anomaliesOpen}/${detail.counts.anomaliesTotal}`, "Open/total exceptions"],
                  [`${detail.counts.payslips}`, "Payslips"],
                ].map(([value, label]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-2.5 last:col-span-2 sm:last:col-span-1">
                    <p className="truncate text-base font-bold tabular-nums text-foreground">{value}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {detail.timeline.map((step, index) => (
                  <li key={step.key} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${step.state === "done" ? "border-primary bg-primary text-primary-foreground" : step.state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                        {step.state === "done" ? "✓" : index + 1}
                      </span>
                      {index < detail.timeline.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                    </span>
                    <span className={`pb-3 text-xs ${step.state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                      {index + 1}. {step.label}
                      {step.state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {detail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this run. Actions in Payroll are recorded here.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.auditTrail.map((entry, index) => (
                    <li key={`${entry.action}-${index}`} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{auditLabel(entry.action)}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {[timeLabel(entry.createdAt), entry.reason].filter(Boolean).join(" · ") || "Recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Configuration: rules and permissions are evaluated by the active module contract.</p>
              <Link href={`/payroll?record=${encodeURIComponent(activeId)}`} className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                Open in Payroll <ChevronRight className="ml-1 size-3.5" />
              </Link>
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
