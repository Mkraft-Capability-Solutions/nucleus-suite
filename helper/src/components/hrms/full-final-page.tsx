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
  return value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed;
}

function money(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(amountMinor / 100);
}

function humanizeAction(action: string): string {
  return action.replace(/^operations\.settlements\./, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "finalized") return "success";
  if (status === "approved") return "info";
  if (status === "submitted") return "warning";
  if (status === "rejected" || status === "returned" || status === "cancelled") return "danger";
  return "neutral";
}

/** Held / Ready / Approved / Settled, mapped onto the real workflow states. */
const STAGES = [
  { key: "held", label: "Held", states: ["draft", "returned"] },
  { key: "ready", label: "Ready for approval", states: ["submitted"] },
  { key: "approved", label: "Approved", states: ["approved"] },
  { key: "settled", label: "Settled", states: ["finalized"] },
] as const;

function stageState(status: string, index: number): "done" | "current" | "todo" {
  const position = STAGES.findIndex((stage) => (stage.states as readonly string[]).includes(status));
  if (position === -1) return "todo";
  if (index < position) return "done";
  if (index === position) return status === "finalized" ? "done" : "current";
  return "todo";
}

type Figure = {
  head: string;
  label: string;
  direction: "earning" | "recovery";
  amountMinor: number | null;
  basis: string;
  indeterminate: boolean;
  blockedBy: string[];
  inputs: Record<string, string | number | null>;
};

type Totals = {
  earningsMinor: number;
  recoveriesMinor: number;
  netPayableMinor: number;
  settlementOutcome: "payable" | "recovery_pending";
  recoverableMinor: number;
  indeterminateHeads: string[];
};

type Working = {
  employee: { id: string; code: string; name: string; joiningDate: string; currency: string };
  period: string;
  periodSource: string;
  lastWorkingDate: string;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  rulePackCode: string;
  figures: Figure[];
  totals: Totals;
  blockedBy: string[];
};

type Gate = { key: string; name: string; pass: boolean; blocking: string };

type QueueRow = {
  id: string;
  version: number;
  status: string;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  lastWorkingDate: string | null;
  netPayableMinor: number | null;
  settlementOutcome: string | null;
  recoverableMinor: number;
  blockingItems: number;
  clearanceItems: number;
};

type Detail = {
  record: QueueRow & { data: UnknownRecord };
  working: Working | null;
  workingError: string | null;
  gates: Gate[];
  auditTrail: Array<{ action: string; reason: string | null; status: string | null; createdAt: string | null }>;
};

function toQueueRow(raw: UnknownRecord): QueueRow {
  return {
    id: str(raw.id),
    version: Number(raw.version ?? 1),
    status: str(raw.status, "draft"),
    employeeId: str(raw.employeeId) || null,
    employeeCode: str(raw.employeeCode) || null,
    employeeName: str(raw.employeeName) || null,
    lastWorkingDate: str(raw.lastWorkingDate) || null,
    netPayableMinor: num(raw.netPayableMinor),
    settlementOutcome: str(raw.settlementOutcome) || null,
    recoverableMinor: Number(raw.recoverableMinor ?? 0),
    blockingItems: Number(raw.blockingItems ?? 0),
    clearanceItems: Number(raw.clearanceItems ?? 0),
  };
}

let fallbackKeyCounter = 0;
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  fallbackKeyCounter += 1;
  return `${Date.now()}-${fallbackKeyCounter}`;
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function FullFinalPage() {
  // Deep-link preselect (?record=<settlementId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [recomputed, setRecomputed] = useState<Working | null>(null);
  const [computeBusy, setComputeBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");

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
        const raw = await getJson("/api/v1/settlement-workings?page=1&pageSize=100");
        const items = asRecord(raw).data;
        const parsed = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map(toQueueRow).filter((row) => row.id);
        if (live) setRows(parsed);
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : "Settlements could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(
    () => rows.filter((row) => statusFilter === "all" || row.status === statusFilter),
    [rows, statusFilter],
  );

  const activeRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? filtered[0] ?? null,
    [rows, selectedId, filtered],
  );
  const activeId = activeRow?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/settlement-workings?settlementId=${encodeURIComponent(activeId)}`);
        const data = asRecord(asRecord(raw).data);
        const record = asRecord(data.record);
        if (live) {
          setDetail({
            record: { ...toQueueRow(record), data: asRecord(record.data) },
            working: (data.working as Working | null) ?? null,
            workingError: str(data.workingError) || null,
            gates: Array.isArray(data.gates) ? (data.gates as Gate[]) : [],
            auditTrail: Array.isArray(data.auditTrail)
              ? (data.auditTrail as Array<{ action: string; reason: string | null; status: string | null; createdAt: string | null }>)
              : [],
          });
          setRecomputed(null);
        }
      } catch (caught) {
        if (live) {
          setDetail(null);
          setDetailError(caught instanceof Error ? caught.message : "This settlement could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  function selectRow(id: string): void {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setNotice("");
  }

  async function computeWorking(): Promise<void> {
    const record = detail?.record;
    if (!record?.employeeId || !record.lastWorkingDate) {
      setNotice("This proposal carries no employee or last working date, so no working can be computed.");
      return;
    }
    setComputeBusy(true);
    setNotice("");
    try {
      const runId = str(record.data.payrollRunId);
      const path = `/api/v1/settlement-workings?employeeId=${encodeURIComponent(record.employeeId)}&lastWorkingDate=${encodeURIComponent(record.lastWorkingDate)}${runId ? `&payrollRunId=${encodeURIComponent(runId)}` : ""}`;
      const raw = await getJson(path);
      setRecomputed(asRecord(raw).data as unknown as Working);
      setNotice("Working recomputed. Nothing is recorded until the figures are saved on the proposal.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The working could not be computed.");
    } finally {
      setComputeBusy(false);
    }
  }

  async function runAction(action: string): Promise<void> {
    const record = detail?.record;
    if (!record) return;
    if (!reason.trim()) {
      setNotice("Enter a reason — every settlement action is audited with it.");
      return;
    }
    if (action === "finalize" && !paymentReference.trim()) {
      setNotice("Enter the completed payment reference before finalising.");
      return;
    }
    setBusyAction(action);
    setNotice("");
    try {
      const response = await fetch(`/api/v1/operations/settlements/${encodeURIComponent(record.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey(), "If-Match": `"${record.version}"` },
        body: JSON.stringify({ reason: reason.trim(), ...(action === "finalize" ? { paymentReference: paymentReference.trim() } : {}) }),
        cache: "no-store",
      });
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        setNotice(str(asRecord(payload.error).message, `Request failed (${response.status}).`));
        return;
      }
      setReason("");
      setNotice(action === "finalize" ? "Settlement finalised and the exit case closed." : "Recorded.");
      refresh();
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setBusyAction("");
    }
  }

  const working = recomputed ?? detail?.working ?? null;
  const currency = working?.employee.currency ?? "INR";
  const earnings = working?.figures.filter((figure) => figure.direction === "earning") ?? [];
  const recoveries = working?.figures.filter((figure) => figure.direction === "recovery") ?? [];
  const recordStatus = detail?.record.status ?? "";
  const blockingGate = detail?.gates.find((gate) => !gate.pass) ?? null;

  const actionState: Record<string, { allowed: boolean; why: string }> = {
    submit: {
      allowed: ["draft", "returned"].includes(recordStatus),
      why: ["draft", "returned"].includes(recordStatus) ? "" : `Submit is only available from draft or returned; this proposal is ${recordStatus || "not loaded"}.`,
    },
    approve: {
      allowed: recordStatus === "submitted",
      why: recordStatus === "submitted" ? "" : `Approve is only available from submitted; this proposal is ${recordStatus || "not loaded"}.`,
    },
    finalize: {
      allowed: recordStatus === "approved" && detail !== null && detail.gates.every((gate) => gate.pass),
      why:
        recordStatus !== "approved"
          ? `Finalize is only available from approved; this proposal is ${recordStatus || "not loaded"}.`
          : blockingGate
            ? `${blockingGate.name}: ${blockingGate.blocking}`
            : "",
    },
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-056"
        title="Full and final settlement"
        description="Compute the settlement working for a leaver, review every head against its basis, and route the proposal through approval to a finalised settlement."
        action={
          <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
            <RefreshCcw className="mr-1.5 size-4" /> Refresh
          </Button>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-056"
          description="Compute the working → propose → submit → approve (a different person) → finalize. Finalize needs the payroll run finalized, every no-dues item cleared, no asset still allocated and outstanding loans fully covered by the recorded recovery. A negative net is a recovery to collect from the leaver, not an error."
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Figures the rule pack or tenant configuration does not define are shown as indeterminate with the missing rule named. Key a reviewed figure onto the proposal instead — nothing here substitutes a default rate.
        </p>
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
        <Link href="/settlements" className="text-xs font-bold text-primary hover:underline">
          Open full &amp; final proposals
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} settlement${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <select aria-label="Status filter" className={`${selectClass} w-full max-w-full sm:w-auto`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="returned">Returned</option>
                <option value="finalized">Finalized</option>
              </select>
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
              {rows.length === 0 ? "No settlement proposals exist yet. Create one against a finalised payroll run and an open exit case." : "No settlements match this filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Leaver</th>
                    <th className="px-3 py-2 text-right font-bold">Blocking items</th>
                    <th className="px-3 py-2 text-right font-bold">Net settlement</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.id === activeId;
                    const negative = row.netPayableMinor !== null && row.netPayableMinor < 0;
                    return (
                      <tr key={row.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => selectRow(row.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.employeeName ?? "Unnamed leaver"}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {[row.employeeCode, row.lastWorkingDate ? `LWD ${row.lastWorkingDate}` : ""].filter(Boolean).join(" · ") || "No exit details"}
                              </span>
                            </span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">
                              {row.blockingItems}
                              <span className="text-muted-foreground">/{row.clearanceItems}</span>
                            </span>
                            <span className={`whitespace-nowrap text-right text-xs font-semibold tabular-nums ${negative ? "text-warning" : "text-foreground"}`}>
                              {money(row.netPayableMinor, currency)}
                            </span>
                            <span><StatusPill tone={statusTone(row.status)}>{row.status.replace(/_/g, " ")}</StatusPill></span>
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
            title="Settlement detail"
            description={activeRow ? `${activeRow.employeeName ?? "Leaver"} · ${activeRow.lastWorkingDate ? `last working day ${activeRow.lastWorkingDate}` : "no last working day recorded"}` : "Select a settlement to inspect its working"}
            action={detail ? <StatusPill tone={statusTone(detail.record.status)}>{detail.record.status.replace(/_/g, " ")}</StatusPill> : undefined}
          />
          {!activeRow ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No settlement selected.</p>
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
              <p className="text-xs text-muted-foreground">
                {working
                  ? `Final period ${working.period} (${working.periodSource}) · rule pack ${working.rulePackCode} · joined ${working.employee.joiningDate}`
                  : detail.workingError ?? "No working computed yet."}
              </p>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Earnings</h3>
              {earnings.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Compute the working to see each earning head and its basis.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Head</th>
                        <th className="px-3 py-2 font-bold">Basis</th>
                        <th className="px-3 py-2 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.map((figure) => (
                        <tr key={figure.head} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">{figure.label}</td>
                          <td className="px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                            {figure.basis}
                            {figure.blockedBy.length > 0 ? <span className="mt-1 block font-semibold text-warning">Missing: {figure.blockedBy.join(", ")}</span> : null}
                          </td>
                          <td className={`px-3 py-2 text-right text-xs tabular-nums ${figure.indeterminate ? "text-warning" : "text-foreground"}`}>
                            {figure.indeterminate ? "Indeterminate" : money(figure.amountMinor, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recoveries</h3>
              {recoveries.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Compute the working to see each recovery head and its basis.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Head</th>
                        <th className="px-3 py-2 font-bold">Basis</th>
                        <th className="px-3 py-2 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recoveries.map((figure) => (
                        <tr key={figure.head} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">{figure.label}</td>
                          <td className="px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                            {figure.basis}
                            {figure.blockedBy.length > 0 ? <span className="mt-1 block font-semibold text-warning">Missing: {figure.blockedBy.join(", ")}</span> : null}
                          </td>
                          <td className={`px-3 py-2 text-right text-xs tabular-nums ${figure.indeterminate ? "text-warning" : "text-foreground"}`}>
                            {figure.indeterminate ? "Indeterminate" : money(figure.amountMinor, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {working ? (
                <div className={`mt-4 rounded-xl border p-3 ${working.totals.settlementOutcome === "recovery_pending" ? "border-warning/25 bg-warning/10" : "border-border/70 bg-secondary/30"}`}>
                  <p className="text-xs text-muted-foreground">
                    Earnings {money(working.totals.earningsMinor, currency)} less recoveries {money(working.totals.recoveriesMinor, currency)}
                  </p>
                  {working.totals.settlementOutcome === "recovery_pending" ? (
                    <>
                      <p className="mt-1 text-base font-bold tabular-nums text-warning">Recovery to collect {money(working.totals.recoverableMinor, currency)}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        The leaver owes more than is due. This is a valid settlement outcome: it is routed for collection as recovery pending, not blocked.
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-base font-bold tabular-nums text-foreground">Net payable {money(working.totals.netPayableMinor, currency)}</p>
                  )}
                  {working.totals.indeterminateHeads.length > 0 ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-warning">
                      Provisional: {working.totals.indeterminateHeads.join(", ")} could not be computed and contribute nothing to this net.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Finalize gates</h3>
              <ul className="mt-2 space-y-2">
                {detail.gates.map((gate) => (
                  <li key={gate.key} className="flex gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                    <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${gate.pass ? "border-success bg-success text-success-foreground" : "border-warning text-warning"}`}>
                      {gate.pass ? "✓" : "!"}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-foreground">{gate.name}</span>
                      <span className="block text-[11px] leading-relaxed text-muted-foreground">{gate.pass ? "Clear." : gate.blocking}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {STAGES.map((stage, index) => {
                  const state = stageState(detail.record.status, index);
                  return (
                    <li key={stage.key} className="flex gap-3">
                      <span className="flex flex-col items-center">
                        <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${state === "done" ? "border-primary bg-primary text-primary-foreground" : state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                          {state === "done" ? "✓" : index + 1}
                        </span>
                        {index < STAGES.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                      </span>
                      <span className={`pb-3 text-xs ${state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {index + 1}. {stage.label}
                        {state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {["rejected", "cancelled"].includes(detail.record.status) ? (
                <p className="text-xs leading-relaxed text-destructive">This proposal was {detail.record.status}. Raise a fresh proposal to settle this exit.</p>
              ) : null}

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</h3>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reason (audited)</span>
                  <input aria-label="Action reason" className={`${inputClass} w-full`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this action is being taken" />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payment reference (finalize only)</span>
                  <input aria-label="Payment reference" className={`${inputClass} w-full`} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Completed payment reference" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-9 rounded-lg px-3 text-xs font-bold" disabled={computeBusy} onClick={() => void computeWorking()}>
                    {computeBusy ? "Computing…" : "Compute working"}
                  </Button>
                  {(["submit", "approve", "finalize"] as const).map((action) => (
                    <Button
                      key={action}
                      variant={action === "finalize" ? "default" : "outline"}
                      className="h-9 rounded-lg px-3 text-xs font-bold"
                      disabled={!actionState[action].allowed || busyAction !== ""}
                      title={actionState[action].why || undefined}
                      onClick={() => void runAction(action)}
                    >
                      {busyAction === action ? "Working…" : action.replace(/^./, (c) => c.toUpperCase())}
                    </Button>
                  ))}
                </div>
                {(["submit", "approve", "finalize"] as const)
                  .filter((action) => !actionState[action].allowed)
                  .map((action) => (
                    <p key={action} className="text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold">{action.replace(/^./, (c) => c.toUpperCase())} unavailable:</span> {actionState[action].why}
                    </p>
                  ))}
                {actionState.approve.allowed ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">Approval is maker/checker: the person who raised this proposal cannot approve it.</p>
                ) : null}
                {notice ? <p role="status" className="rounded-lg border border-border bg-secondary/40 p-2 text-[11px] leading-relaxed">{notice}</p> : null}
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {detail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this settlement.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.auditTrail.map((entry, index) => (
                    <li key={`${entry.action}-${index}`} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{humanizeAction(entry.action)}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {[timeLabel(entry.createdAt), entry.status, entry.reason].filter(Boolean).join(" · ") || "Recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
