"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Download, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklistLabel, picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** FRM-PAY-07 "Bank / format" (PL_BANK_FORMAT). The registry owns the vocabulary. */
const BANK_FILE_FORMATS = picklists.PL_BANK_FORMAT.values;

/** Batches prepared before PL_BANK_FORMAT stored the bank's own display name; show either. */
function bankFormatLabel(format: string): string {
  const known = picklists.PL_BANK_FORMAT.values.some((option) => option.value === format);
  return known ? picklistLabel("PL_BANK_FORMAT", format) : format;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period || "—";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Exact rendering of integer minor units as money; never rounds a figure away. */
function money(amountMinor: number, currency: string): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const major = Math.trunc(absolute / 100);
  const minor = String(absolute % 100).padStart(2, "0");
  return `${sign}${major.toLocaleString()}.${minor} ${currency || "INR"}`;
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function auditLabel(action: string): string {
  return action.replace(/^payroll\./, "").replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function stateLabel(state: string): string {
  if (state === "prepared") return "PREPARED";
  if (state === "verified") return "VERIFIED";
  if (state === "released") return "RELEASED";
  if (state === "failed") return "FAILED";
  if (state === "superseded") return "SUPERSEDED";
  return (state || "—").toUpperCase();
}

function statusTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "released") return "success";
  if (state === "verified") return "info";
  if (state === "failed") return "danger";
  if (state === "superseded") return "neutral";
  return "warning";
}

/** Actor ids are opaque; show a short form and keep the full value on hover. */
function actorLabel(value: string | null): string {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

type BatchRow = {
  id: string;
  payrollRunId: string;
  runPeriod: string;
  runScope: string;
  state: string;
  format: string;
  fileName: string;
  fileReference: string;
  totalAmountMinor: number;
  currency: string;
  accountCount: number;
  valueDate: string;
};

type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

type ItemRow = {
  id: string;
  employeeCode: string | null;
  employeeName: string;
  accountMasked: string;
  bankName: string;
  routingCode: string;
  amountMinor: number;
  state: string;
  exclusionReasonText: string | null;
  returnReason: string | null;
};

type ExcludedRow = { employeeId: string; employeeCode: string | null; employeeName: string; amountMinor: number; reasonText: string };

type WarningRow = { bankAccountId: string; employeeCode: string | null; employeeName: string; changedAt: string; message: string };

type BatchDetail = BatchRow & {
  version: number;
  excludedCount: number;
  excludedAmountMinor: number;
  checksum: string;
  disbursingAccountLabel: string;
  disbursingAccountMasked: string;
  preparedBy: string | null;
  preparedAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  outOfBandVerified: boolean;
  outOfBandReference: string | null;
  releaseRemarks: string | null;
  returnFileReference: string | null;
  releaseBlockedReason: string | null;
  items: ItemRow[];
  excluded: ExcludedRow[];
  warnings: WarningRow[];
  timeline: TimelineStep[];
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
  file: { name: string; format: string; content: string };
};

function readBatchRow(item: UnknownRecord): BatchRow {
  return {
    id: str(item.id),
    payrollRunId: str(item.payrollRunId),
    runPeriod: str(item.runPeriod),
    runScope: str(item.runScope),
    state: str(item.state, "prepared"),
    format: str(item.format, "generic_csv"),
    fileName: str(item.fileName),
    fileReference: str(item.fileReference, str(item.fileName)),
    totalAmountMinor: num(item.totalAmountMinor),
    currency: str(item.currency, "INR"),
    accountCount: num(item.accountCount),
    valueDate: str(item.valueDate),
  };
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function BankDisbursementPage() {
  // Deep-link preselect (?record=<batchId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [runs, setRuns] = useState<Array<{ id: string; period: string; scope: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [stateFilter, setStateFilter] = useState("all");

  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [prepareOpen, setPrepareOpen] = useState(false);
  const [runId, setRunId] = useState("");
  const [format, setFormat] = useState<string>(BANK_FILE_FORMATS[0].value);
  const [accountLabel, setAccountLabel] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [valueDate, setValueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  const [oobReference, setOobReference] = useState("");
  const [releaseRemarks, setReleaseRemarks] = useState("");

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
        const [batchPayload, runPayload] = await Promise.all([
          getJson("/api/v1/disbursements?page=1&pageSize=100"),
          getJson("/api/v1/payroll-runs?page=1&pageSize=100"),
        ]);
        const batchItems = asRecord(batchPayload).data;
        const runItems = asRecord(runPayload).data;
        if (!live) return;
        setBatches((Array.isArray(batchItems) ? (batchItems as UnknownRecord[]) : []).map(readBatchRow));
        setRuns(
          (Array.isArray(runItems) ? (runItems as UnknownRecord[]) : [])
            .map((item) => ({ id: str(item.id), period: str(item.period), scope: str(item.scope), status: str(item.status) }))
            .filter((run) => run.status === "approved" || run.status === "finalized"),
        );
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Disbursement batches could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(
    () => batches.filter((batch) => stateFilter === "all" || batch.state === stateFilter),
    [batches, stateFilter],
  );

  const activeBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedId) ?? filtered[0] ?? null,
    [batches, selectedId, filtered],
  );
  const activeId = activeBatch?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/disbursements/${encodeURIComponent(activeId)}`);
        const data = asRecord(asRecord(raw).data);
        const file = asRecord(data.file);
        if (!live) return;
        setDetail({
          ...readBatchRow(data),
          version: num(data.version, 1),
          excludedCount: num(data.excludedCount),
          excludedAmountMinor: num(data.excludedAmountMinor),
          checksum: str(data.checksum),
          disbursingAccountLabel: str(data.disbursingAccountLabel),
          disbursingAccountMasked: str(data.disbursingAccountMasked, "—"),
          preparedBy: str(data.preparedBy) || null,
          preparedAt: str(data.preparedAt) || null,
          verifiedBy: str(data.verifiedBy) || null,
          verifiedAt: str(data.verifiedAt) || null,
          releasedBy: str(data.releasedBy) || null,
          releasedAt: str(data.releasedAt) || null,
          outOfBandVerified: data.outOfBandVerified === true,
          outOfBandReference: str(data.outOfBandReference) || null,
          releaseRemarks: str(data.releaseRemarks) || null,
          returnFileReference: str(data.returnFileReference) || null,
          releaseBlockedReason: str(data.releaseBlockedReason) || null,
          items: (Array.isArray(data.items) ? (data.items as UnknownRecord[]) : []).map((item) => ({
            id: str(item.id),
            employeeCode: str(item.employeeCode) || null,
            employeeName: str(item.employeeName),
            accountMasked: str(item.accountMasked, "—"),
            bankName: str(item.bankName),
            routingCode: str(item.routingCode),
            amountMinor: num(item.amountMinor),
            state: str(item.state, "included"),
            exclusionReasonText: str(item.exclusionReasonText) || null,
            returnReason: str(item.returnReason) || null,
          })),
          excluded: (Array.isArray(data.excluded) ? (data.excluded as UnknownRecord[]) : []).map((item) => ({
            employeeId: str(item.employeeId),
            employeeCode: str(item.employeeCode) || null,
            employeeName: str(item.employeeName),
            amountMinor: num(item.amountMinor),
            reasonText: str(item.reasonText),
          })),
          warnings: (Array.isArray(data.warnings) ? (data.warnings as UnknownRecord[]) : []).map((item) => ({
            bankAccountId: str(item.bankAccountId),
            employeeCode: str(item.employeeCode) || null,
            employeeName: str(item.employeeName),
            changedAt: str(item.changedAt),
            message: str(item.message),
          })),
          timeline: Array.isArray(data.timeline) ? (data.timeline as TimelineStep[]) : [],
          auditTrail: Array.isArray(data.auditTrail) ? (data.auditTrail as BatchDetail["auditTrail"]) : [],
          file: { name: str(file.name), format: str(file.format), content: str(file.content) },
        });
      } catch (err) {
        if (live) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "Batch detail could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  function selectBatch(id: string): void {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setActionError("");
    setActionOk("");
  }

  async function post(path: string, body: unknown, version?: number): Promise<UnknownRecord> {
    const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() };
    if (version !== undefined) headers["If-Match"] = `"${version}"`;
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = asRecord(asRecord(payload).error);
      throw new Error(str(failure.message, `Request failed (${response.status})`));
    }
    return asRecord(asRecord(payload).data);
  }

  async function prepare(): Promise<void> {
    setActionError("");
    setActionOk("");
    if (!runId) {
      setActionError("Choose an approved payroll run.");
      return;
    }
    if (accountLabel.trim() === "" || accountNumber.trim().length < 4) {
      setActionError("Name the disbursing account and give its number (only the last four characters are stored).");
      return;
    }
    setBusy("prepare");
    try {
      const data = await post("/api/v1/disbursements", {
        payrollRunId: runId,
        format,
        disbursingAccountLabel: accountLabel.trim(),
        disbursingAccountNumber: accountNumber.trim(),
        valueDate,
        currency: "INR",
      });
      const id = str(data.id);
      setActionOk(`Bank file prepared: ${num(data.accountCount)} accounts, ${num(data.excludedCount)} excluded.`);
      setPrepareOpen(false);
      if (id) selectBatch(id);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The bank file could not be prepared.");
    } finally {
      setBusy("");
    }
  }

  async function verify(): Promise<void> {
    if (!detail) return;
    setActionError("");
    setActionOk("");
    if (oobReference.trim() === "") {
      setActionError("Record the out-of-band verification reference — the call, ticket or confirmation that proves the total and account count were checked with the bank.");
      return;
    }
    setBusy("verify");
    try {
      await post(`/api/v1/disbursements/${encodeURIComponent(detail.id)}`, {
        action: "verify",
        outOfBandVerified: true,
        outOfBandReference: oobReference.trim(),
      });
      setActionOk("Out-of-band verification recorded.");
      setOobReference("");
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The verification could not be recorded.");
    } finally {
      setBusy("");
    }
  }

  async function release(): Promise<void> {
    if (!detail) return;
    setActionError("");
    setActionOk("");
    setBusy("release");
    try {
      const data = await post(
        `/api/v1/disbursements/${encodeURIComponent(detail.id)}/release`,
        // Optional per the workbook; dual control, not a sentence, is what guards a release.
        releaseRemarks.trim() ? { releaseRemarks: releaseRemarks.trim() } : {},
        detail.version,
      );
      setActionOk(`Released ${num(data.released)} credits totalling ${money(num(data.totalAmountMinor), detail.currency)}.`);
      setReleaseRemarks("");
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The batch could not be released.");
    } finally {
      setBusy("");
    }
  }

  function downloadFile(): void {
    if (!detail || detail.file.content === "") return;
    const url = URL.createObjectURL(new Blob([detail.file.content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = detail.file.name || `disbursement-${detail.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // Guard against a detail payload that belongs to a previously selected batch.
  const activeDetail = detail && detail.id === activeId ? detail : null;
  const payable = activeDetail ? activeDetail.items.filter((item) => item.state !== "excluded") : [];

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-055"
        title="Bank disbursement control"
        description="Generate the bank file for an approved run, hold it under dual control with out-of-band verification, release it, and record what the bank sent back."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setActionError("");
                setActionOk("");
                setPrepareOpen((open) => !open);
              }}
            >
              Generate bank file
            </Button>
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-055"
          description="Generate bank file → verify out of band → release → reconcile the bank return. Only an approved or finalized run can be disbursed, the file total must equal the sum of net pay, and dual control is enforced at the service: the releaser must differ from the preparer."
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Employees with no usable bank account are excluded from the file with a stated reason, and the excluded count and amount reconcile back to the run&apos;s net pay. Past DISBURSEMENT_PREPARED (RL-323) a correction is made as arrears in a later run: a released batch is never edited or regenerated, and a changed batch supersedes its predecessor, which is retained. Account numbers are tokenised throughout — only the last four characters are ever shown, and the file offered for download here is a control copy with masked accounts.
        </p>
      </Surface>

      {prepareOpen ? (
        <Surface className="mb-6">
          <SectionHeading title="Generate bank file" description="The file is built from the run's net pay. The disbursing account number is masked before it is stored." />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payroll run</span>
              <select aria-label="Payroll run" className={`${selectClass} w-full`} value={runId} onChange={(event) => setRunId(event.target.value)}>
                <option value="">Select an approved run</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {formatPeriod(run.period)} · {run.scope} · {run.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bank and file format</span>
              <select aria-label="Bank file format" className={`${selectClass} w-full`} value={format} onChange={(event) => setFormat(event.target.value)}>
                {BANK_FILE_FORMATS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Disbursing account</span>
              <input aria-label="Disbursing account name" className={`${inputClass} w-full`} value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder="Payroll operating account" />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Account number</span>
              <input aria-label="Disbursing account number" className={`${inputClass} w-full`} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="Stored masked" />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Value date</span>
              <input aria-label="Value date" type="date" className={`${inputClass} w-full`} value={valueDate} onChange={(event) => setValueDate(event.target.value)} />
            </label>
            <Button className="h-10 w-full shrink-0 rounded-xl px-4 text-xs font-bold sm:w-auto" disabled={busy === "prepare"} onClick={() => void prepare()}>
              {busy === "prepare" ? "Preparing…" : "Prepare batch"}
            </Button>
          </div>
          {runs.length === 0 && !loading ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">No approved or finalized run is available. Approve a run in the payroll cockpit first.</p>
          ) : null}
        </Surface>
      ) : null}

      {actionError ? <p className="mb-4 text-xs leading-relaxed text-destructive">{actionError}</p> : null}
      {actionOk ? <p className="mb-4 text-xs leading-relaxed text-success">{actionOk}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} batch${filtered.length === 1 ? "" : "es"} in the current scope`}
            action={
              <select aria-label="Status filter" className={`${selectClass} w-full max-w-full sm:w-auto`} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="prepared">Prepared</option>
                <option value="verified">Verified</option>
                <option value="released">Released</option>
                <option value="failed">Failed</option>
                <option value="superseded">Superseded</option>
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
              {batches.length === 0 ? "No bank file has been generated yet. Generate one for an approved run to begin." : "No batches match this filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Run</th>
                    <th className="px-3 py-2 font-bold">Bank file</th>
                    <th className="px-3 py-2 text-right font-bold">Total</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((batch) => {
                    const selected = batch.id === activeId;
                    return (
                      <tr key={batch.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => selectBatch(batch.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{formatPeriod(batch.runPeriod)}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{batch.runScope || "—"}</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-[11px] text-foreground">{batch.fileReference || "—"}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {bankFormatLabel(batch.format)} · {batch.accountCount} account{batch.accountCount === 1 ? "" : "s"}
                              </span>
                            </span>
                            <span className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-foreground">
                              {money(batch.totalAmountMinor, batch.currency)}
                            </span>
                            <span>
                              <StatusPill tone={statusTone(batch.state)}>{stateLabel(batch.state)}</StatusPill>
                            </span>
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
            title="Batch detail"
            description={activeBatch ? `${formatPeriod(activeBatch.runPeriod)} · ${bankFormatLabel(activeBatch.format)}` : "Select a batch to inspect its controls"}
            action={activeDetail ? <StatusPill tone={statusTone(activeDetail.state)}>{stateLabel(activeDetail.state)}</StatusPill> : undefined}
          />
          {!activeBatch ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No batch selected.</p>
          ) : detailLoading && !activeDetail ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : detailError && !activeDetail ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : activeDetail ? (
            <div>
              <p className="break-all font-mono text-sm font-bold text-foreground">{activeDetail.fileReference || activeDetail.fileName}</p>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-2">
                {[
                  ["Bank and file format", bankFormatLabel(activeDetail.format)],
                  ["Disbursing account", `${activeDetail.disbursingAccountLabel || "—"} · ${activeDetail.disbursingAccountMasked}`],
                  ["Value date", activeDetail.valueDate || "—"],
                  ["Total amount", money(activeDetail.totalAmountMinor, activeDetail.currency)],
                  ["Account count", String(activeDetail.accountCount)],
                  ["Excluded", `${activeDetail.excludedCount} · ${money(activeDetail.excludedAmountMinor, activeDetail.currency)}`],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-muted-foreground">File checksum</dt>
                  <dd className="break-all font-mono text-[10px] text-foreground">{activeDetail.checksum || "—"}</dd>
                </div>
              </dl>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dual control</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Prepared by</p>
                  <p className="truncate font-mono text-xs font-semibold text-foreground" title={activeDetail.preparedBy ?? undefined}>{actorLabel(activeDetail.preparedBy)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeLabel(activeDetail.preparedAt) || "—"}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Released by</p>
                  <p className="truncate font-mono text-xs font-semibold text-foreground" title={activeDetail.releasedBy ?? undefined}>{actorLabel(activeDetail.releasedBy)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeLabel(activeDetail.releasedAt) || "Not released"}</p>
                </div>
              </div>
              {activeDetail.releaseRemarks ? <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Release remarks: {activeDetail.releaseRemarks}</p> : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Out-of-band verification</h3>
              {activeDetail.outOfBandVerified ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-success">
                  <ShieldCheck className="size-3.5" /> Recorded{activeDetail.outOfBandReference ? ` · ${activeDetail.outOfBandReference}` : ""}
                  {activeDetail.verifiedAt ? ` · ${timeLabel(activeDetail.verifiedAt)}` : ""}
                </p>
              ) : activeDetail.state === "prepared" ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Verification reference (call, ticket or bank confirmation)</span>
                    <input aria-label="Out-of-band verification reference" className={`${inputClass} w-full`} value={oobReference} onChange={(event) => setOobReference(event.target.value)} />
                  </label>
                  <Button variant="outline" className="h-10 w-full shrink-0 rounded-xl px-4 text-xs font-bold sm:w-auto" disabled={busy === "verify"} onClick={() => void verify()}>
                    {busy === "verify" ? "Recording…" : "Record verification"}
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Not recorded, and this batch can no longer be verified.</p>
              )}

              {activeDetail.warnings.length > 0 ? (
                <>
                  <h3 className="mt-5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warning">
                    <AlertTriangle className="size-3.5" /> Bank details changed in the payroll window
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {activeDetail.warnings.map((warning) => (
                      <li key={warning.bankAccountId} className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2">
                        <p className="text-xs font-semibold text-foreground">
                          {warning.employeeCode ? `${warning.employeeCode} · ` : ""}
                          {warning.employeeName}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{warning.message}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Payments ({payable.length})
              </h3>
              {payable.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">This batch carries no payable items.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Employee</th>
                        <th className="px-3 py-2 font-bold">Account</th>
                        <th className="px-3 py-2 text-right font-bold">Amount</th>
                        <th className="px-3 py-2 font-bold">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payable.map((item) => (
                        <tr key={item.id} className="border-t border-border/60">
                          <td className="px-3 py-2">
                            <span className="block text-xs font-semibold text-foreground">{item.employeeName || "—"}</span>
                            <span className="block text-[11px] text-muted-foreground">{item.employeeCode ?? "—"}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="block font-mono text-xs text-foreground">{item.accountMasked}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {[item.bankName, item.routingCode].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{money(item.amountMinor, activeDetail.currency)}</td>
                          <td className="px-3 py-2">
                            <StatusPill tone={item.state === "failed" ? "danger" : item.state === "released" ? "success" : "neutral"}>
                              {item.state.toUpperCase()}
                            </StatusPill>
                            {item.returnReason ? <span className="mt-1 block text-[11px] leading-relaxed text-destructive">{item.returnReason}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Excluded employees ({activeDetail.excludedCount})
              </h3>
              {activeDetail.excluded.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Every employee in the run has a usable bank account.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {activeDetail.excluded.map((entry) => (
                    <li key={entry.employeeId} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">
                        {entry.employeeCode ? `${entry.employeeCode} · ` : ""}
                        {entry.employeeName} · {money(entry.amountMinor, activeDetail.currency)}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{entry.reasonText}</p>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {activeDetail.timeline.map((step, index) => (
                  <li key={step.key} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${step.state === "done" ? "border-primary bg-primary text-primary-foreground" : step.state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                        {step.state === "done" ? "✓" : index + 1}
                      </span>
                      {index < activeDetail.timeline.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                    </span>
                    <span className={`pb-3 text-xs ${step.state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                      {index + 1}. {step.label}
                      {step.state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                    </span>
                  </li>
                ))}
              </ol>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {activeDetail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this batch.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {activeDetail.auditTrail.map((entry, index) => (
                    <li key={`${entry.action}-${index}`} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{auditLabel(entry.action)}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {[timeLabel(entry.createdAt), entry.reason].filter(Boolean).join(" · ") || "Recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {activeDetail.returnFileReference ? (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Bank return file {activeDetail.returnFileReference} recorded. Each failed credit is an open finding in the payroll exception queue for re-disbursement.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" disabled={activeDetail.file.content === ""} onClick={downloadFile}>
                  <Download className="mr-1.5 size-3.5" /> Download file (masked)
                </Button>
                <Link href={`/payroll-run-cockpit?record=${encodeURIComponent(activeDetail.payrollRunId)}`} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                  Open run <ChevronRight className="ml-1 size-3.5" />
                </Link>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                The download is a control copy: it matches the bank file line for line but every account number is masked to its last four characters.
              </p>

              <div className="mt-4 rounded-xl border border-border/70 bg-secondary/30 p-3">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Release remarks</span>
                  <input
                    aria-label="Release remarks"
                    className={`${inputClass} w-full`}
                    value={releaseRemarks}
                    onChange={(event) => setReleaseRemarks(event.target.value)}
                    disabled={activeDetail.releaseBlockedReason !== null}
                  />
                </label>
                <Button
                  className="mt-3 h-10 w-full rounded-xl px-4 text-xs font-bold sm:w-auto"
                  disabled={activeDetail.releaseBlockedReason !== null || busy === "release"}
                  onClick={() => void release()}
                >
                  {busy === "release" ? "Releasing…" : "Verify and release"}
                </Button>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {activeDetail.releaseBlockedReason ?? "Release is irreversible and sends the file to the bank. An If-Match precondition and an Idempotency-Key are both required."}
                </p>
              </div>
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
