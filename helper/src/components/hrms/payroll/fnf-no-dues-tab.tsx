"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Lock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { workforcePolicyDefaults } from "@/lib/workforce-policy";
import {
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
} from "../page-primitives";
import { asRecord, currencyLabel, dateLabel, num, str, type UnknownRecord } from "../workforce/records";

/**
 * Same-Day F&F and No-Dues.
 *
 * Two things are joined here that the estate already owns separately: the departmental
 * no-dues checklist (`clearance_items`, read through the clearance board) and the
 * settlement working (`computeSettlementWorking`, read through
 * `/api/v1/settlement-workings`). The settlement arithmetic is NOT rebuilt — every figure
 * on this tab is the server's, and the proposal desk at `/full-and-final-settlement`
 * remains the place a proposal is raised, edited and approved.
 *
 * What this tab adds is the lock. Disbursement cannot be released while a no-dues item is
 * still open, and the reason is stated in words next to the disabled control. The gates it
 * shows are `finalizeGates()` from `src/server/payroll/settlement.ts`, which the server
 * computes and returns; the SAME conditions are re-evaluated in SQL inside
 * `mutateOperationalRecord` when `finalize` actually runs, so the UI is a preview of the
 * server's decision and never the control itself.
 */

const settlementPolicy = workforcePolicyDefaults.settlement;

type QueueRow = {
  id: string;
  version: number;
  status: string;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  lastWorkingDate: string | null;
  netPayableMinor: number | null;
  blockingItems: number;
  clearanceItems: number;
};

type Figure = {
  head: string;
  label: string;
  direction: "earning" | "recovery";
  amountMinor: number | null;
  basis: string;
  indeterminate: boolean;
  blockedBy: string[];
};

type Working = {
  employee: { id: string; code: string; name: string; joiningDate: string; currency: string };
  lastWorkingDate: string;
  period: string;
  periodSource: string;
  figures: Figure[];
  totals: {
    earningsMinor: number;
    recoveriesMinor: number;
    netPayableMinor: number;
    settlementOutcome: "payable" | "recovery_pending";
    recoverableMinor: number;
    indeterminateHeads: string[];
  };
  blockedBy: string[];
};

type Gate = { key: string; name: string; pass: boolean; blocking: string };

type Detail = {
  record: QueueRow & { data: UnknownRecord };
  working: Working | null;
  workingError: string | null;
  gates: Gate[];
};

type ClearanceItem = {
  id: string;
  caseId: string;
  department: string;
  officerCode: string | null;
  officerName: string | null;
  blocking: boolean;
  status: "open" | "cleared" | "waived" | "held";
  clearedOn: string | null;
  recoveryMinor: number | null;
  evidenceNote: string | null;
  waiveReason: string | null;
};

function toQueueRow(raw: UnknownRecord): QueueRow {
  return {
    id: str(raw.id),
    version: num(raw.version, 1),
    status: str(raw.status, "draft"),
    employeeId: str(raw.employeeId) || null,
    employeeCode: str(raw.employeeCode) || null,
    employeeName: str(raw.employeeName) || null,
    lastWorkingDate: str(raw.lastWorkingDate) || null,
    netPayableMinor: raw.netPayableMinor === null || raw.netPayableMinor === undefined ? null : num(raw.netPayableMinor),
    blockingItems: num(raw.blockingItems),
    clearanceItems: num(raw.clearanceItems),
  };
}

function toClearanceItem(raw: UnknownRecord): ClearanceItem {
  const status = str(raw.status, "open");
  return {
    id: str(raw.id),
    caseId: str(raw.case_id),
    department: str(raw.item_name, "Clearance item"),
    officerCode: str(raw.owner_code) || null,
    officerName: str(raw.owner_name) || null,
    blocking: raw.blocking === true,
    status: status === "cleared" || status === "waived" || status === "held" ? status : "open",
    clearedOn: str(raw.cleared_on) || null,
    recoveryMinor: raw.recovery_amount_minor === null || raw.recovery_amount_minor === undefined ? null : num(raw.recovery_amount_minor),
    evidenceNote: str(raw.recovery_description) || null,
    waiveReason: str(raw.waive_reason) || null,
  };
}

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Completed years of continuous service, used only to explain the gratuity gate. */
function completedYears(joiningDate: string, lastWorkingDate: string): number {
  const from = new Date(joiningDate);
  const to = new Date(lastWorkingDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return days <= 0 ? 0 : days / 365.25;
}

const CLEARANCE_WORDS: Record<ClearanceItem["status"], { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  open: { label: "Open — still owed", tone: "warning" },
  held: { label: "On hold", tone: "danger" },
  cleared: { label: "Cleared", tone: "success" },
  waived: { label: "Waived", tone: "info" },
};

const inputClass =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground";
const selectClass = "h-10 min-w-0 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";

export function FnfNoDuesTab() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [queueError, setQueueError] = useState("");
  const [queueLoading, setQueueLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  // Keyed by the record they belong to, so switching leaver derives an empty panel
  // rather than needing a state reset inside the effect.
  const [detailEntry, setDetailEntry] = useState<{ id: string; value: Detail | null } | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [clearanceEntry, setClearanceEntry] = useState<{ caseId: string; items: ClearanceItem[] } | null>(null);
  const [clearanceError, setClearanceError] = useState("");
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [itemReason, setItemReason] = useState<Record<string, string>>({});
  const [disburseReason, setDisburseReason] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setQueueLoading(true);
      setQueueError("");
      try {
        const raw = await getJson("/api/v1/settlement-workings?page=1&pageSize=100");
        const data = asRecord(raw).data;
        const parsed = (Array.isArray(data) ? (data as UnknownRecord[]) : []).map(toQueueRow).filter((row) => row.id);
        if (live) setRows(parsed);
      } catch (caught) {
        if (live) setQueueError(caught instanceof Error ? caught.message : "The settlement queue could not be loaded.");
      } finally {
        if (live) setQueueLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const activeRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);
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
        if (!live) return;
        setDetailEntry({
          id: activeId,
          value: {
            record: { ...toQueueRow(record), data: asRecord(record.data) },
            working: (data.working as Working | null) ?? null,
            workingError: str(data.workingError) || null,
            gates: Array.isArray(data.gates) ? (data.gates as Gate[]) : [],
          },
        });
      } catch (caught) {
        if (live) {
          setDetailEntry({ id: activeId, value: null });
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

  const detail = detailEntry && detailEntry.id === activeId ? detailEntry.value : null;
  const caseId = str(detail?.record.data.offboardingCaseId);

  useEffect(() => {
    if (!caseId) return;
    let live = true;
    void (async () => {
      setClearanceError("");
      try {
        const raw = await getJson("/api/v1/offboarding/clearance-board?search=");
        const data = asRecord(raw).data;
        const items = (Array.isArray(data) ? (data as UnknownRecord[]) : [])
          .map(toClearanceItem)
          .filter((item) => item.id && item.caseId === caseId);
        if (live) setClearanceEntry({ caseId, items });
      } catch (caught) {
        if (live) setClearanceError(caught instanceof Error ? caught.message : "The no-dues checklist could not be loaded.");
      }
    })();
    return () => {
      live = false;
    };
  }, [caseId, revision]);

  const clearance = clearanceEntry && clearanceEntry.caseId === caseId ? clearanceEntry.items : [];

  const blockingOpen = clearance.filter((item) => item.blocking && (item.status === "open" || item.status === "held")).length;
  const failedGates = (detail?.gates ?? []).filter((gate) => !gate.pass);
  const disbursementLocked = failedGates.length > 0;

  async function post(path: string, body: UnknownRecord, version?: number): Promise<boolean> {
    const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": idempotencyKey() };
    if (version !== undefined) headers["If-Match"] = `"${version}"`;
    try {
      const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        setNotice(str(asRecord(payload.error).message, `The request failed (${response.status}).`));
        return false;
      }
      return true;
    } catch {
      setNotice("The server could not be reached. Nothing was recorded.");
      return false;
    }
  }

  async function clearItem(item: ClearanceItem): Promise<void> {
    setBusy(`clear:${item.id}`);
    setNotice("");
    const note = (itemReason[item.id] ?? "").trim();
    const done = await post(`/api/v1/offboarding/items/${encodeURIComponent(item.id)}/clear`, {
      note: note || undefined,
      recoveryAmountMinor: 0,
    });
    setBusy("");
    if (done) {
      setNotice(`${item.department} marked cleared. The settlement gate is re-evaluated on the server.`);
      refresh();
    }
  }

  async function holdItem(item: ClearanceItem, action: "hold" | "release"): Promise<void> {
    const reason = (itemReason[item.id] ?? "").trim();
    if (reason.length < 20) {
      setNotice("A hold or release needs a recorded reason of at least 20 characters — it is written to the audit trail.");
      return;
    }
    setBusy(`${action}:${item.id}`);
    setNotice("");
    const done = await post(`/api/v1/offboarding/items/${encodeURIComponent(item.id)}/hold`, { action, reason });
    setBusy("");
    if (done) {
      setNotice(action === "hold" ? `${item.department} put on hold.` : `${item.department} released back to open.`);
      refresh();
    }
  }

  async function waiveItem(item: ClearanceItem): Promise<void> {
    const reason = (itemReason[item.id] ?? "").trim();
    if (reason.length < 20) {
      setNotice("Waiving a no-dues item needs a reason of at least 20 characters saying what was forgiven and why.");
      return;
    }
    setBusy(`waive:${item.id}`);
    setNotice("");
    const done = await post(`/api/v1/offboarding/items/${encodeURIComponent(item.id)}/waive`, { reason });
    setBusy("");
    if (done) {
      setNotice(`${item.department} waived. The waiver and its reason are on the audit trail.`);
      refresh();
    }
  }

  async function releaseDisbursement(): Promise<void> {
    const record = detail?.record;
    if (!record) return;
    if (disbursementLocked) return;
    if (disburseReason.trim().length < 10) {
      setNotice("Enter a reason of at least 10 characters — the disbursement is audited with it.");
      return;
    }
    if (!paymentReference.trim()) {
      setNotice("Enter the completed payment reference before releasing the disbursement.");
      return;
    }
    setBusy("finalize");
    setNotice("");
    const done = await post(
      `/api/v1/operations/settlements/${encodeURIComponent(record.id)}/finalize`,
      { reason: disburseReason.trim(), paymentReference: paymentReference.trim() },
      record.version,
    );
    setBusy("");
    if (done) {
      setDisburseReason("");
      setPaymentReference("");
      setNotice("Settlement finalised and the exit case closed.");
      refresh();
    }
  }

  const working = detail?.working ?? null;
  const currency = working?.employee.currency ?? "INR";
  const earnings = (working?.figures ?? []).filter((figure) => figure.direction === "earning");
  const recoveries = (working?.figures ?? []).filter((figure) => figure.direction === "recovery");
  const gratuity = (working?.figures ?? []).find((figure) => figure.head === "gratuityMinor") ?? null;
  const serviceYears = working ? completedYears(working.employee.joiningDate, working.lastWorkingDate) : null;
  const gratuityEligible = serviceYears !== null && serviceYears >= settlementPolicy.gratuityEligibilityYears;

  return (
    <div className="min-w-0 space-y-6">
      <SectionHeading
        title="Same-day full & final and no-dues"
        description="The departmental no-dues checklist and the settlement working for one leaver, with disbursement locked until every clearance is signed off."
        action={
          <Button variant="outline" size="sm" onClick={refresh} className="h-10">
            <RefreshCw className="mr-2 size-4" strokeWidth={2} />
            Refresh
          </Button>
        }
      />

      <Surface>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground">Exiting employee</span>
            <select
              className={selectClass}
              value={activeId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setNotice("");
              }}
              disabled={rows.length === 0}
            >
              {rows.length === 0 && <option value="">No settlement proposal is on file</option>}
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {[row.employeeCode, row.employeeName].filter(Boolean).join(" · ") || row.id} — {row.status}
                  {row.lastWorkingDate ? ` — last working day ${row.lastWorkingDate}` : ""}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/full-final-settlement"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3.5 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Open the full & final desk
            <ExternalLink className="size-3.5" strokeWidth={2} />
          </Link>
        </div>
        <p className="mt-3 text-[12px] leading-[19px] text-muted-foreground">
          Proposals are raised, edited and approved on the full &amp; final desk. This tab reads the same records and adds the
          no-dues gate.
        </p>
      </Surface>

      {notice && (
        <Surface className="border-l-2 border-l-primary">
          <p className="text-sm text-foreground">{notice}</p>
        </Surface>
      )}

      {queueError && <Surface><StateBlock tone="error" icon={AlertTriangle} title="The settlement queue could not be loaded" description={queueError} /></Surface>}
      {!queueError && queueLoading && <Surface><StateBlock tone="loading" icon={RefreshCw} title="Loading settlements" description="Reading the settlement queue." /></Surface>}
      {!queueError && !queueLoading && rows.length === 0 && (
        <Surface>
          <StateBlock
            icon={ClipboardList}
            title="No settlement proposal is on file"
            description="A full and final proposal has to exist before its no-dues checklist and working can be shown. Raise one on the full & final desk."
          />
        </Surface>
      )}

      {detailError && <Surface><StateBlock tone="error" icon={AlertTriangle} title="This settlement could not be loaded" description={detailError} /></Surface>}
      {detailLoading && !detail && <Surface><StateBlock tone="loading" icon={RefreshCw} title="Loading the settlement" description="Reading the working and its gates." /></Surface>}

      {detail && (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={working ? `Net payable — ${working.totals.settlementOutcome === "payable" ? "due to the leaver" : "recoverable from the leaver"}` : "Net payable"}
              value={working ? currencyLabel(working.totals.netPayableMinor, currency) : "—"}
              hint={working ? `Period ${working.period} · ${working.periodSource}` : detail.workingError ?? "No working available"}
              icon={Wallet}
              tone={working && working.totals.settlementOutcome === "payable" ? "primary" : "warning"}
            />
            <StatTile
              label="Earnings"
              value={working ? currencyLabel(working.totals.earningsMinor, currency) : "—"}
              hint="Unpaid days, leave encashment and gratuity"
              icon={CheckCircle2}
              tone="success"
            />
            <StatTile
              label="Deductions"
              value={working ? currencyLabel(working.totals.recoveriesMinor, currency) : "—"}
              hint="Loans, notice shortfall, advances and tax"
              icon={ShieldAlert}
              tone="warning"
            />
            <StatTile
              label="No-dues still blocking"
              value={String(blockingOpen)}
              hint={`${clearance.length} clearance item${clearance.length === 1 ? "" : "s"} on this exit case`}
              icon={ClipboardList}
              tone={blockingOpen === 0 ? "success" : "danger"}
            />
          </div>

          <Surface>
            <SectionHeading
              title="Departmental no-dues"
              description="Every clearance item this tenant configured for the exit case. The departments are the tenant's own — nothing here is a fixed four-department list."
            />
            {clearanceError && <StateBlock tone="error" icon={AlertTriangle} title="The checklist could not be loaded" description={clearanceError} />}
            {!clearanceError && clearance.length === 0 && (
              <StateBlock
                icon={ClipboardList}
                title="No clearance items on this exit case"
                description="The settlement gate requires at least one clearance item, so finalize stays blocked until the exit case has a no-dues checklist."
              />
            )}
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              {clearance.map((item) => {
                const words = CLEARANCE_WORDS[item.status];
                const settled = item.status === "cleared" || item.status === "waived";
                const reason = itemReason[item.id] ?? "";
                return (
                  <div key={item.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-semibold text-foreground">{item.department}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          Clearance officer: {item.officerName ?? item.officerCode ?? "Not assigned"}
                          {item.officerName && item.officerCode ? ` (${item.officerCode})` : ""}
                        </p>
                      </div>
                      <StatusPill tone={words.tone} dot>
                        {words.label}
                      </StatusPill>
                    </div>

                    <dl className="mt-3 space-y-1.5 text-[12px]">
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">Blocks settlement</dt>
                        <dd className="min-w-0 text-foreground">{item.blocking ? "Yes — finalize is refused while this is open" : "No — informational only"}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">Evidence note</dt>
                        <dd className="min-w-0 text-foreground">{item.evidenceNote ?? item.waiveReason ?? "None recorded"}</dd>
                      </div>
                      {item.recoveryMinor !== null && item.recoveryMinor > 0 && (
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Recovery raised</dt>
                          <dd className="min-w-0 font-mono text-foreground tabular-nums">{currencyLabel(item.recoveryMinor, currency)}</dd>
                        </div>
                      )}
                      {item.clearedOn && (
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Cleared on</dt>
                          <dd className="min-w-0 text-foreground">{dateLabel(item.clearedOn)}</dd>
                        </div>
                      )}
                    </dl>

                    {!settled && (
                      <div className="mt-3 space-y-2">
                        <label className="block">
                          <span className="sr-only">Note or reason for {item.department}</span>
                          <input
                            className={inputClass}
                            value={reason}
                            placeholder="Note for clearing; 20+ characters to hold, release or waive"
                            onChange={(event) => setItemReason((current) => ({ ...current, [item.id]: event.target.value }))}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {item.status === "open" && (
                            <>
                              <Button size="sm" className="h-10" disabled={busy !== ""} onClick={() => void clearItem(item)}>
                                <CheckCircle2 className="mr-2 size-4" strokeWidth={2} />
                                {busy === `clear:${item.id}` ? "Clearing…" : "Mark cleared"}
                              </Button>
                              <Button size="sm" variant="outline" className="h-10" disabled={busy !== ""} onClick={() => void holdItem(item, "hold")}>
                                <PauseCircle className="mr-2 size-4" strokeWidth={2} />
                                {busy === `hold:${item.id}` ? "Holding…" : "Hold"}
                              </Button>
                            </>
                          )}
                          {item.status === "held" && (
                            <Button size="sm" variant="outline" className="h-10" disabled={busy !== ""} onClick={() => void holdItem(item, "release")}>
                              <PlayCircle className="mr-2 size-4" strokeWidth={2} />
                              {busy === `release:${item.id}` ? "Releasing…" : "Release hold"}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-10" disabled={busy !== ""} onClick={() => void waiveItem(item)}>
                            {busy === `waive:${item.id}` ? "Waiving…" : "Waive with reason"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Surface>

          <Surface>
            <SectionHeading
              title="Settlement working"
              description="Computed by the server from the leaver's salary structure, leave ledger, loans and advances. Nothing on this tab recalculates it."
            />
            {detail.workingError && !working && (
              <StateBlock tone="error" icon={AlertTriangle} title="The working could not be computed" description={detail.workingError} />
            )}
            {working && (
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                {[
                  { title: "Earnings", figures: earnings },
                  { title: "Deductions", figures: recoveries },
                ].map((group) => (
                  <div key={group.title} className="min-w-0">
                    <h3 className="mb-2 font-heading text-[13px] font-semibold text-foreground">{group.title}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm" style={{ minWidth: 360 }}>
                        <caption className="sr-only">{group.title} on this full and final settlement</caption>
                        <thead>
                          <tr className="text-[11px] text-muted-foreground">
                            <th scope="col" className="py-2 pr-3 font-medium">Head</th>
                            <th scope="col" className="py-2 pl-3 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.figures.map((figure) => (
                            <tr key={figure.head} className="border-t border-border align-top">
                              <td className="py-2.5 pr-3">
                                <p className="text-[13px] font-medium text-foreground">{figure.label}</p>
                                <p className="mt-0.5 text-[11px] leading-[17px] text-muted-foreground">{figure.basis}</p>
                              </td>
                              <td className="py-2.5 pl-3 text-right font-mono text-[13px] text-foreground tabular-nums">
                                {figure.indeterminate || figure.amountMinor === null ? (
                                  <span className="text-[11px] text-muted-foreground">Not determinable</span>
                                ) : (
                                  currencyLabel(figure.amountMinor, currency)
                                )}
                              </td>
                            </tr>
                          ))}
                          {group.figures.length === 0 && (
                            <tr className="border-t border-border">
                              <td className="py-2.5 pr-3 text-[12px] text-muted-foreground" colSpan={2}>
                                No {group.title.toLowerCase()} on this settlement.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {working && working.totals.indeterminateHeads.length > 0 && (
              <p className="mt-4 text-[12px] leading-[19px] text-muted-foreground">
                {working.totals.indeterminateHeads.length} head{working.totals.indeterminateHeads.length === 1 ? " is" : "s are"} not
                determinable and are excluded from the net: {working.blockedBy.join(" ")}
              </p>
            )}
          </Surface>

          {working && (
            <Surface>
              <SectionHeading title="Gratuity eligibility" description="Why gratuity is or is not payable on this settlement." />
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground">Continuous service</p>
                  <p className="mt-1 font-mono text-[22px] font-bold text-foreground tabular-nums">
                    {serviceYears === null ? "—" : `${serviceYears.toFixed(2)} yrs`}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Joined {dateLabel(working.employee.joiningDate)} · last working day {dateLabel(working.lastWorkingDate)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground">Qualifying period</p>
                  <p className="mt-1 font-mono text-[22px] font-bold text-foreground tabular-nums">
                    {settlementPolicy.gratuityEligibilityYears} yrs
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">Workforce policy setting, not a constant in this screen.</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground">Accrual formula</p>
                  <p className="mt-1 font-mono text-[15px] font-semibold text-foreground tabular-nums">
                    wage &times; {settlementPolicy.gratuityDaysPerYear} / {settlementPolicy.gratuityDivisor} per year
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Days per year and the divisor come from the same policy; the settlement engine applies its own rule pack, quoted
                    below.
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
                <p className="flex items-start gap-2 text-sm leading-[21px] text-foreground">
                  {gratuityEligible ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} />
                  )}
                  <span>
                    {serviceYears === null
                      ? "Service length could not be derived, so eligibility cannot be stated."
                      : gratuityEligible
                        ? `Gratuity is payable: ${serviceYears.toFixed(2)} years of continuous service meets the ${settlementPolicy.gratuityEligibilityYears}-year qualifying period.`
                        : `Gratuity is not payable: ${serviceYears.toFixed(2)} years of continuous service is below the ${settlementPolicy.gratuityEligibilityYears}-year qualifying period, so no gratuity accrues. The zero on this settlement is a rule, not a missing figure.`}
                  </span>
                </p>
                {gratuity && (
                  <p className="mt-2 text-[12px] leading-[19px] text-muted-foreground">
                    Settlement engine: {gratuity.basis}
                    {gratuity.indeterminate || gratuity.amountMinor === null
                      ? " The engine could not determine an amount."
                      : ` Amount ${currencyLabel(gratuity.amountMinor, currency)}.`}
                  </p>
                )}
              </div>
            </Surface>
          )}

          <Surface>
            <SectionHeading
              title="Disbursement release"
              description="Finalising the settlement writes the full and final record and closes the exit case. It is the disbursement."
            />
            <ul className="space-y-2">
              {detail.gates.map((gate) => (
                <li key={gate.key} className="flex min-w-0 items-start gap-2.5 rounded-lg border border-border p-3">
                  {gate.pass ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} />
                  ) : (
                    <Lock className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={2} />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">
                      {gate.name} — {gate.pass ? "satisfied" : "blocking"}
                    </p>
                    {!gate.pass && gate.blocking && (
                      <p className="mt-0.5 text-[12px] leading-[19px] text-muted-foreground">{gate.blocking}</p>
                    )}
                  </div>
                </li>
              ))}
              {detail.gates.length === 0 && (
                <li className="text-[12px] text-muted-foreground">The server returned no gates for this proposal.</li>
              )}
            </ul>

            <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground">Reason (audited)</span>
                <input
                  className={inputClass}
                  value={disburseReason}
                  placeholder="Why this settlement is being released"
                  onChange={(event) => setDisburseReason(event.target.value)}
                  disabled={disbursementLocked}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground">Payment reference</span>
                <input
                  className={inputClass}
                  value={paymentReference}
                  placeholder="Bank or instrument reference"
                  onChange={(event) => setPaymentReference(event.target.value)}
                  disabled={disbursementLocked}
                />
              </label>
            </div>

            <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                className="h-10"
                disabled={disbursementLocked || busy !== ""}
                onClick={() => void releaseDisbursement()}
              >
                {disbursementLocked && <Lock className="mr-2 size-4" strokeWidth={2} />}
                {busy === "finalize" ? "Releasing…" : "Release disbursement"}
              </Button>
              <p className="min-w-0 text-[12px] leading-[19px] text-muted-foreground">
                {disbursementLocked
                  ? `Disbursement is locked. ${failedGates.map((gate) => gate.blocking || `${gate.name} is not satisfied.`).join(" ")}`
                  : "Every gate is satisfied, so the server should accept the release."}
              </p>
            </div>

            <p className="mt-4 text-[12px] leading-[19px] text-muted-foreground">
              This screen is not the control. When the release is sent, the server re-evaluates the same conditions inside the
              settlement write itself — the proposal must be approved, its payroll run finalized, the exit case still open, at least
              one clearance item present with none still blocking, no asset left allocated, and outstanding loans no greater than the
              recovery recorded on the proposal. A release that slipped past this screen would still be refused there with a workflow
              conflict.
            </p>
          </Surface>
        </>
      )}
    </div>
  );
}
