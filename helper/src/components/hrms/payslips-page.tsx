"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, RefreshCcw } from "lucide-react";
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

/** Backend money is integer minor units (paise). Rendered with en-IN grouping. */
function formatMinor(minor: unknown, currency: unknown): string {
  const value = num(minor);
  if (value === null) return "—";
  const grouped = (value / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const code = str(currency, "INR");
  return code === "INR" ? `₹${grouped}` : `₹${grouped} ${code}`;
}

function scopeLabel(scope: string): string {
  if (scope === "regular") return "Regular";
  if (scope === "ot") return "Off-cycle overtime";
  if (scope === "full_final") return "Full and final";
  if (scope === "correction") return "Correction";
  return scope || "—";
}

type PayslipState = "generated" | "published" | "viewed" | "archived";

const STATE_ORDER: PayslipState[] = ["generated", "published", "viewed", "archived"];
const STATE_LABELS: Record<PayslipState, string> = {
  generated: "Generated",
  published: "Published",
  viewed: "Viewed",
  archived: "Archived",
};

function normalizeState(value: unknown): PayslipState {
  const key = str(value).trim().toLowerCase();
  return (STATE_ORDER as string[]).includes(key) ? (key as PayslipState) : "generated";
}

function statusTone(state: PayslipState): "success" | "warning" | "info" | "neutral" {
  if (state === "published") return "success";
  if (state === "viewed") return "info";
  if (state === "archived") return "warning";
  return "neutral";
}

/** Mirrors the server state machine: generated → published → viewed → archived. */
function canTransition(state: PayslipState, action: "publish" | "view" | "archive"): boolean {
  if (action === "publish") return state === "generated";
  if (action === "view") return state === "published";
  return state === "published" || state === "viewed";
}

function auditLabel(action: string): string {
  return action.replace(/^payroll\./, "").replace(/^payslip_/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
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

type PayslipRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  period: string;
  runId: string;
  runDisplayCode: string;
  scope: string;
  currency: string;
  grossMinor: number | null;
  deductionsMinor: number | null;
  netMinor: number | null;
  state: PayslipState;
  displayCode: string;
};

type TraceNode = { id: string; attributes: UnknownRecord; children: TraceNode[] };

type DetailLine = {
  code: string;
  label: string;
  amountMinor: number | null;
  traceAvailable: boolean;
  trace: TraceNode[] | null;
};

type TimelineStep = { key: PayslipState; label: string; state: "done" | "current" | "todo" };

type PayslipDetail = {
  earnings: DetailLine[];
  deductions: DetailLine[];
  informational: DetailLine[];
  earningsMinor: number | null;
  deductionsMinor: number | null;
  netMinor: number | null;
  timeline: TimelineStep[];
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
  /** False when the record endpoint does not yet return the SCR-053 breakdown. */
  breakdownAvailable: boolean;
};

function readTrace(value: unknown): TraceNode[] | null {
  if (!Array.isArray(value)) return null;
  const nodes = (value as unknown[]).map((entry) => {
    const node = asRecord(entry);
    return { id: str(node.id), attributes: asRecord(node.attributes), children: readTrace(node.children) ?? [] };
  });
  return nodes.length > 0 ? nodes : null;
}

function readLines(value: unknown): DetailLine[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).map((entry) => {
    const line = asRecord(entry);
    return {
      code: str(line.code),
      label: str(line.label, str(line.code, "—")),
      amountMinor: num(line.amountMinor),
      traceAvailable: line.traceAvailable === true,
      trace: readTrace(line.trace),
    };
  });
}

function fallbackTimeline(state: PayslipState): TimelineStep[] {
  const index = STATE_ORDER.indexOf(state);
  return STATE_ORDER.map((key, position) => ({
    key,
    label: STATE_LABELS[key],
    state: position === index ? "current" : position < index ? "done" : "todo",
  }));
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";

export function PayslipsPage() {
  // Deep-link preselect (?record=<payslipId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [runs, setRuns] = useState<Array<{ id: string; period: string; scope: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [runFilter, setRunFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [detail, setDetail] = useState<PayslipDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [openLine, setOpenLine] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  // RL-350: period and run are sent as independent selectors, alone or together,
  // because one period can hold several runs (regular, arrears, off-cycle, bonus).
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "100" });
    if (periodFilter !== "all") params.set("period", periodFilter);
    if (runFilter !== "all") params.set("runId", runFilter);
    if (stateFilter !== "all") params.set("state", stateFilter);
    return params.toString();
  }, [periodFilter, runFilter, stateFilter]);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson(`/api/v1/payslips?${query}`);
        const items = asRecord(raw).data;
        const parsed = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          employeeId: str(item.employeeId),
          employeeCode: str(item.employeeCode, "—"),
          employeeName: str(item.employeeName, str(item.employeeCode, "—")),
          period: str(item.period, "—"),
          runId: str(item.runId),
          runDisplayCode: str(item.runDisplayCode, "—"),
          scope: str(item.scope, "—"),
          currency: str(item.currency, "INR"),
          grossMinor: num(item.grossMinor),
          deductionsMinor: num(item.deductionsMinor),
          netMinor: num(item.netMinor),
          state: normalizeState(item.state),
          displayCode: str(item.displayCode, "—"),
        }));
        if (live) setRows(parsed);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Payslips could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [query, revision]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const raw = await getJson("/api/v1/payroll-runs?page=1&pageSize=100");
        const items = asRecord(raw).data;
        const parsed = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          period: str(item.period, "—"),
          scope: str(item.scope, "—"),
        }));
        if (live) setRuns(parsed);
      } catch {
        // The run selector degrades to the runs already present on loaded payslips.
        if (live) setRuns([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const periods = useMemo(() => {
    const all = new Set<string>();
    for (const run of runs) if (run.period !== "—") all.add(run.period);
    for (const row of rows) if (row.period !== "—") all.add(row.period);
    return [...all].sort((left, right) => right.localeCompare(left));
  }, [runs, rows]);

  const runOptions = useMemo(() => {
    const merged = new Map<string, { id: string; period: string; scope: string }>();
    for (const run of runs) merged.set(run.id, run);
    for (const row of rows) if (row.runId && !merged.has(row.runId)) merged.set(row.runId, { id: row.runId, period: row.period, scope: row.scope });
    return [...merged.values()]
      .filter((run) => periodFilter === "all" || run.period === periodFilter)
      .sort((left, right) => right.period.localeCompare(left.period) || left.scope.localeCompare(right.scope));
  }, [runs, rows, periodFilter]);

  function selectPayslip(id: string): void {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setOpenLine("");
    setActionError("");
    setActionOk("");
  }

  const activeRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);
  const activeId = activeRow?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/payslips/${encodeURIComponent(activeId)}`);
        const data = asRecord(asRecord(raw).data);
        const lines = asRecord(data.lines);
        const breakdownAvailable = Array.isArray(lines.earnings) || Array.isArray(lines.deductions);
        const timeline = Array.isArray(data.timeline) ? (data.timeline as TimelineStep[]) : [];
        const auditTrail = Array.isArray(data.auditTrail)
          ? (data.auditTrail as Array<{ action: string; reason: string | null; createdAt: string | null }>)
          : [];
        if (live) {
          setDetail({
            earnings: readLines(lines.earnings),
            deductions: readLines(lines.deductions),
            informational: readLines(lines.informational),
            earningsMinor: num(lines.earningsMinor),
            deductionsMinor: num(lines.deductionsMinor),
            netMinor: num(lines.netMinor),
            timeline: timeline.length > 0 ? timeline : fallbackTimeline(normalizeState(data.state ?? activeRow?.state)),
            auditTrail,
            breakdownAvailable,
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
  }, [activeId, activeRow?.state, revision]);

  async function transition(action: "publish" | "archive"): Promise<void> {
    if (!activeId) return;
    setActionError("");
    setActionOk("");
    setActionBusy(action);
    try {
      const response = await fetch(`/api/v1/payslips/${encodeURIComponent(activeId)}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ action }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const err = asRecord(payload).error;
        const message = typeof err === "object" && err !== null ? str(asRecord(err).message, `Request failed (${response.status})`) : `Request failed (${response.status})`;
        throw new Error(message);
      }
      const data = asRecord(asRecord(payload).data);
      setActionOk(`Payslip ${str(data.state, action === "publish" ? "published" : "archived")}.`);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The payslip could not be updated.");
    } finally {
      setActionBusy("");
    }
  }

  const activeState = activeRow?.state ?? "generated";
  const timeline = detail?.timeline ?? fallbackTimeline(activeState);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-053"
        title="Payslips"
        description="Retrieve a finalized payslip for any period or run, inspect every earning and deduction line, and control publication to the employee."
        action={
          <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
            <RefreshCcw className="mr-1.5 size-4" /> Refresh
          </Button>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-053"
          description="Finalize run → payslip generated → publish to employee → employee views → archive. A period can hold several runs, so pick the period and the run independently. Net pay is sensitive: without payroll.read a viewer sees only their own payslips."
        />
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
        <Link href={activeRow?.runId ? `/payroll-run-cockpit?record=${encodeURIComponent(activeRow.runId)}` : "/payroll"} className="text-xs font-bold text-primary hover:underline">
          Open payroll run
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${rows.length} payslip${rows.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <select
                  aria-label="Period filter"
                  className={`${selectClass} w-full sm:w-auto`}
                  value={periodFilter}
                  onChange={(e) => {
                    setPeriodFilter(e.target.value);
                    setRunFilter("all");
                  }}
                >
                  <option value="all">All periods</option>
                  {periods.map((period) => (
                    <option key={period} value={period}>{formatPeriod(period)}</option>
                  ))}
                </select>
                <select aria-label="Run filter" className={`${selectClass} w-full sm:w-auto`} value={runFilter} onChange={(e) => setRunFilter(e.target.value)}>
                  <option value="all">All runs</option>
                  {runOptions.map((run) => (
                    <option key={run.id} value={run.id}>{`${formatPeriod(run.period)} · ${scopeLabel(run.scope)}`}</option>
                  ))}
                </select>
                <select aria-label="Status filter" className={`${selectClass} w-full sm:w-auto`} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {STATE_ORDER.map((state) => (
                    <option key={state} value={state}>{STATE_LABELS[state]}</option>
                  ))}
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
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {periodFilter === "all" && runFilter === "all" && stateFilter === "all"
                ? "No payslips exist yet. A payslip is minted for every employee when a payroll run is finalized."
                : "No payslips match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Employee</th>
                    <th className="px-3 py-2 font-bold">Period</th>
                    <th className="px-3 py-2 text-right font-bold">Net pay</th>
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
                            onClick={() => selectPayslip(row.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.employeeName}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{row.employeeCode}</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs text-foreground">{formatPeriod(row.period)}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{scopeLabel(row.scope)}</span>
                            </span>
                            <span className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-foreground">{formatMinor(row.netMinor, row.currency)}</span>
                            <span><StatusPill tone={statusTone(row.state)}>{STATE_LABELS[row.state]}</StatusPill></span>
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
        </Surface>

        <Surface>
          <SectionHeading
            title="Record detail"
            description={activeRow ? `${activeRow.employeeName} · ${formatPeriod(activeRow.period)} · ${activeRow.runDisplayCode}` : "Select a payslip to inspect its lines"}
            action={activeRow ? <StatusPill tone={statusTone(activeState)}>{STATE_LABELS[activeState]}</StatusPill> : undefined}
          />
          {!activeRow ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No payslip selected.</p>
          ) : (
            <div>
              <p className="text-sm font-bold text-foreground">{activeRow.displayCode}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Employee: {activeRow.employeeCode} · Period: {formatPeriod(activeRow.period)} · Run: {activeRow.runDisplayCode} · Run type: {scopeLabel(activeRow.scope)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                {[
                  [formatMinor(activeRow.grossMinor, activeRow.currency), "Gross"],
                  [formatMinor(activeRow.deductionsMinor, activeRow.currency), "Deductions"],
                  [formatMinor(activeRow.netMinor, activeRow.currency), "Net pay"],
                ].map(([value, label]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-2.5 last:col-span-2 sm:last:col-span-1">
                    <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  disabled={!canTransition(activeState, "publish") || actionBusy !== ""}
                  onClick={() => void transition("publish")}
                >
                  {actionBusy === "publish" ? "Publishing…" : "Publish"}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  disabled={!canTransition(activeState, "archive") || actionBusy !== ""}
                  onClick={() => void transition("archive")}
                >
                  {actionBusy === "archive" ? "Archiving…" : "Archive"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {activeState === "generated"
                  ? "Publish makes the payslip visible to the employee. Archive becomes available once it is published."
                  : activeState === "archived"
                    ? "An archived payslip is final; no further transition is available."
                    : "Archive withdraws the payslip from the employee's view."}
              </p>
              {actionError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{actionError}</p> : null}
              {actionOk ? <p className="mt-3 text-xs leading-relaxed text-success">{actionOk}</p> : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {timeline.map((step, index) => (
                  <li key={step.key} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${step.state === "done" ? "border-primary bg-primary text-primary-foreground" : step.state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                        {step.state === "done" ? "✓" : index + 1}
                      </span>
                      {index < timeline.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                    </span>
                    <span className={`pb-3 text-xs ${step.state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                      {index + 1}. {step.label}
                      {step.state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                    </span>
                  </li>
                ))}
              </ol>

              {detailLoading && !detail ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Loading lines…</p>
              ) : detailError && !detail ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                    <RefreshCcw className="mr-1.5 size-3.5" /> Retry
                  </Button>
                </div>
              ) : detail && detail.breakdownAvailable ? (
                <>
                  <LineTable
                    title="Earnings"
                    lines={detail.earnings}
                    currency={activeRow.currency}
                    totalMinor={detail.earningsMinor}
                    openLine={openLine}
                    onToggle={(code) => setOpenLine((current) => (current === code ? "" : code))}
                  />
                  <LineTable
                    title="Deductions"
                    lines={detail.deductions}
                    currency={activeRow.currency}
                    totalMinor={detail.deductionsMinor}
                    openLine={openLine}
                    onToggle={(code) => setOpenLine((current) => (current === code ? "" : code))}
                  />
                  {detail.informational.length > 0 ? (
                    <LineTable
                      title="Not part of net pay"
                      lines={detail.informational}
                      currency={activeRow.currency}
                      totalMinor={null}
                      openLine={openLine}
                      onToggle={(code) => setOpenLine((current) => (current === code ? "" : code))}
                    />
                  ) : null}
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5">
                    <span className="min-w-0 text-xs font-bold uppercase tracking-wider text-foreground">Net pay</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatMinor(detail.netMinor ?? activeRow.netMinor, activeRow.currency)}</span>
                  </div>
                </>
              ) : (
                <p className="mt-4 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  The line breakdown is not available from the payslip record endpoint yet. Gross, deductions and net pay above come from the stored payslip totals.
                </p>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {!detail || detail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this payslip. Publish and archive are recorded here.</p>
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
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}

function LineTable({
  title,
  lines,
  currency,
  totalMinor,
  openLine,
  onToggle,
}: {
  title: string;
  lines: DetailLine[];
  currency: string;
  totalMinor: number | null;
  openLine: string;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No {title.toLowerCase()} lines on this payslip.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-bold">Component</th>
                <th className="px-3 py-2 text-right font-bold">Amount</th>
                <th className="w-24 px-3 py-2 text-right font-bold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const key = `${title}:${line.code}`;
                const open = openLine === key;
                return (
                  <tr key={key}>
                    <td colSpan={3} className="p-0">
                      <div className={`mb-1.5 rounded-xl border px-3 py-2 ${open ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card"}`}>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                          <span className="truncate text-xs text-foreground">{line.label}</span>
                          <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">{formatMinor(line.amountMinor, currency)}</span>
                          <button
                            type="button"
                            onClick={() => onToggle(key)}
                            aria-expanded={open}
                            className="shrink-0 text-left text-[11px] font-bold text-primary hover:underline"
                          >
                            {open ? "Hide rule" : "How is this calculated?"}
                          </button>
                        </div>
                        {open ? (
                          <div className="mt-2 border-t border-border/60 pt-2">
                            {line.traceAvailable && line.trace ? (
                              <TraceList nodes={line.trace} />
                            ) : (
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                The calculation trace is not recorded for this line. The payroll engine does not yet write the intermediate values and inputs behind it, so nothing can be shown here without inventing it.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalMinor === null ? null : (
        <div className="mt-1 flex items-center justify-between gap-3 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="min-w-0">Total {title.toLowerCase()}</span>
          <span className="shrink-0 tabular-nums text-foreground">{formatMinor(totalMinor, currency)}</span>
        </div>
      )}
    </div>
  );
}

function TraceList({ nodes, depth = 0 }: { nodes: TraceNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? "space-y-1.5" : "mt-1.5 space-y-1.5 border-l border-border/60 pl-3"}>
      {nodes.map((node) => (
        <li key={node.id}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            {Object.entries(node.attributes).map(([key, value]) => (
              <div key={key} className="col-span-2 grid grid-cols-[auto_1fr] gap-x-2">
                <dt className="text-[11px] font-semibold text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                <dd className="min-w-0 break-words text-[11px] tabular-nums text-foreground">{typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}</dd>
              </div>
            ))}
          </dl>
          {node.children.length > 0 ? <TraceList nodes={node.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}
