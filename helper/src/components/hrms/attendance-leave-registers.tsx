"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { invalidateGetRequest } from "@/lib/client-api";
import { picklistLabel, picklists } from "@/lib/picklists";
import { SectionHeading, StatusPill, Surface } from "./page-primitives";
import {
  ActionButton,
  ActionField,
  ActionPanel,
  AuditTrail,
  Cell,
  ConfigFooter,
  DetailPlaceholder,
  ProcessGuide,
  QueueRow,
  RegisterIntro,
  RegisterLayout,
  RegisterNotice,
  RegisterQueue,
  RegisterStates,
  ScopeBar,
  StateTimeline,
  actionInputClass,
  listOf,
  postRegisterAction,
  recordFromEnvelope,
  stateLabel,
  useRegisterResource,
  useSelection,
  type Notice,
} from "./register-primitives";

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

function listFromEnvelope(payload: unknown): UnknownRecord[] {
  const data = asRecord(payload).data;
  return Array.isArray(data) ? (data as UnknownRecord[]) : [];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** One leave scheme value the engine needs and nobody has supplied yet. */
type SchemeGap = { rule: string; question: string | null; detail: string };

/**
 * The rules the accrual, cap, COFF and year-end engines are still waiting on.
 *
 * A balance derived from a scheme with a hole in it is worth less than the hole
 * being visible, so the ledger names what is missing rather than quietly showing
 * a figure that assumed an answer.
 */
function SchemeGapBanner({ gaps }: { gaps: SchemeGap[] }) {
  if (gaps.length === 0) return null;
  return (
    <Surface className="mt-4 border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        {gaps.length} leave scheme value{gaps.length === 1 ? "" : "s"} not configured
      </p>
      <ul className="mt-2 space-y-1.5">
        {gaps.map((gap) => (
          <li key={gap.rule} className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{gap.rule}</span>
            {gap.question ? <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-400">{gap.question}</span> : null}
            <span className="ml-1.5">{gap.detail}</span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

/* ---------------- Leave requests (SCR-030) ---------------- */

type LeaveRequestRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  leave_type: string;
  leave_type_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  requested_days: number;
  actual_return_date: string | null;
  reason: string | null;
  is_half_day_start: boolean;
  is_half_day_end: boolean;
  half_day_session: string | null;
  document_ref: string | null;
  contact: string | null;
  leave_address: string | null;
  handover_person_id: string | null;
  handover_person_name: string | null;
  raw_status: string;
  status: "draft" | "validated" | "pending_approval" | "approved" | "availed" | "closed";
};

/** The half-day markers read as one phrase, or as nothing when the span is whole days. */
function halfDayLabel(row: LeaveRequestRow): string | null {
  const ends: string[] = [];
  if (row.is_half_day_start) ends.push("start");
  if (row.is_half_day_end) ends.push("end");
  if (ends.length === 0) return null;
  const session = row.half_day_session ? picklistLabel("PL_HALF_DAY_SESSION", row.half_day_session) : "session not recorded";
  return `Half day at ${ends.join(" and ")} · ${session}`;
}

const LEAVE_REQUEST_STATES = [
  { value: "draft", label: "Draft" },
  { value: "validated", label: "Validated" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "availed", label: "Availed" },
  { value: "closed", label: "Closed" },
] as const;

function leaveRequestTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "approved" || status === "availed") return "success";
  if (status === "pending_approval") return "warning";
  if (status === "closed") return "neutral";
  return "info";
}

function approvalStepLabel(rawStatus: string): string {
  if (rawStatus === "pending_supervisor") return "Pending supervisor";
  if (rawStatus === "pending_hod") return "Pending HOD";
  if (rawStatus === "pending_hr") return "Pending HR";
  if (!rawStatus) return "Not recorded";
  return rawStatus.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

export function LeaveRequestsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [comment, setComment] = useState("");
  const [returnDate, setReturnDate] = useState(todayISO);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(
    `/api/v1/leave-requests/register?search=${encodeURIComponent(search)}&status=${encodeURIComponent(statusFilter)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as LeaveRequestRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/leave-requests/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as LeaveRequestRow,
      ledger: listOf(data.ledger),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function decide(approve: boolean) {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/leave-requests/${encodeURIComponent(selected.id)}/decide`, {
      approve,
      comment: comment.trim() || undefined,
    });
    setNotice(outcome.ok
      ? { text: approve ? "Approval recorded through the supervisor → HOD → HR chain." : "Rejection recorded with your comment.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setComment("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  async function earlyReturn() {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      `/api/v1/leave-requests/${encodeURIComponent(selected.id)}/early-return`,
      { actualReturnDate: returnDate },
    );
    setNotice(outcome.ok
      ? { text: "Early return recorded. Unused days are re-credited to the ledger.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Leaves · SCR-030"
        title="Leave requests"
        description="Manage leave requests with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/leave" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Apply for leave
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-030"
        description="Pick a request from the queue → check the applicant, dates and the ledger movements it caused → approve, reject or record an early return. Applying stays in Leave with balance and rule validation."
      />
      <ScopeBar href="/leave" label="Open leaves" />

      <Surface className="mb-6">
        <label className="block w-full max-w-xs text-xs font-semibold">
          Approval step
          <select
            value={statusFilter}
            onChange={(event) => { setSelectedId(""); setStatusFilter(event.target.value); }}
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
          >
            <option value="">All steps</option>
            <option value="pending_supervisor">Pending supervisor</option>
            <option value="pending_hod">Pending HOD</option>
            <option value="pending_hr">Pending HR</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </Surface>

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading leave requests…"
        errorTitle="Leave requests unavailable"
        emptyTitle="No leave requests"
        emptyHint="Apply for leave from the Leave module. Requests arrive here with their approval step and ledger impact."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search leave requests"
              searchPlaceholder="Search employee, code, leave type…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Employee", "Leave type", "Dates", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_code ?? "—"} · {row.employee_name ?? "Unnamed"}</Cell>
                  <Cell>{row.leave_type || "—"}</Cell>
                  <Cell>{row.starts_on ?? "—"} → {row.ends_on ?? "—"}</Cell>
                  <Cell><StatusPill tone={leaveRequestTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.employee_code ?? detail.record.id}
                  action={<StatusPill tone={leaveRequestTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_code ?? "—"} · {detail.record.employee_name ?? "Unnamed"} · Department: {detail.record.department ?? "—"} · Leave type: {detail.record.leave_type}{detail.record.leave_type_name ? ` (${detail.record.leave_type_name})` : ""}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Dates: {detail.record.starts_on ?? "—"} → {detail.record.ends_on ?? "—"} · {detail.record.requested_days} day(s) · Approval step: {approvalStepLabel(detail.record.raw_status)}
                  {detail.record.actual_return_date ? ` · Early return on ${detail.record.actual_return_date}` : ""}
                </p>
                {detail.record.reason && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Reason: {detail.record.reason}</p>
                )}
                {halfDayLabel(detail.record) && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{halfDayLabel(detail.record)}</p>
                )}
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Contact: {detail.record.contact ?? "Not recorded"} · Address during leave: {detail.record.leave_address ?? "Not recorded"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Handover: {detail.record.handover_person_name ?? detail.record.handover_person_id ?? "Not recorded"} · Supporting document: {detail.record.document_ref ?? "Not recorded"}
                </p>
                <StateTimeline states={LEAVE_REQUEST_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Ledger movements ({detail.ledger.length})</p>
                  {detail.ledger.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">This request has not moved the leave ledger yet.</p>
                  ) : (
                    <ol className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                      {detail.ledger.map((entry, index) => (
                        <li key={str(entry.id, String(index))} className="min-w-0 break-words rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span className="font-semibold">{str(entry.transaction_type, "Movement")} · {num(entry.days)} day(s)</span>
                          <span className="mt-0.5 block text-muted-foreground">{str(entry.effective_date, "—")} · {str(entry.narration, "No narration")}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <AuditTrail events={detail.auditTrail} />
                {detail.record.status === "pending_approval" && (
                  <ActionPanel title="Record a decision">
                    <ActionField label="Comment (audited)">
                      <input
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Why is this approved or rejected?"
                        className={actionInputClass}
                      />
                    </ActionField>
                    <span className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => void decide(true)} busy={busy}>Approve</ActionButton>
                      <ActionButton onClick={() => void decide(false)} busy={busy}>Reject</ActionButton>
                    </span>
                  </ActionPanel>
                )}
                {(detail.record.status === "approved" || detail.record.status === "availed") && !detail.record.actual_return_date && (
                  <ActionPanel title="Record early return">
                    <ActionField label="Actual return date">
                      <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className={actionInputClass} />
                    </ActionField>
                    <ActionButton onClick={() => void earlyReturn()} busy={busy}>Record early return</ActionButton>
                  </ActionPanel>
                )}
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Leave balance and ledger (SCR-031) ---------------- */

type LeaveLedgerRow = {
  id: string;
  ledger_reference: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  leave_type: string;
  leave_type_name: string | null;
  transaction_type: string;
  credit: number;
  debit: number;
  balance: number;
  effective_date: string | null;
  expires_on: string | null;
  narration: string | null;
  source_reference: string | null;
  status: "projected" | "expired" | "encashed" | "reversed";
};

const LEAVE_LEDGER_STATES = [
  { value: "projected", label: "Projected" },
  { value: "expired", label: "Expired" },
  { value: "encashed", label: "Encashed" },
  { value: "reversed", label: "Reversed" },
] as const;

function ledgerTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "projected") return "success";
  if (status === "expired") return "warning";
  if (status === "reversed") return "danger";
  return "neutral";
}

/** Builds a CSV of exactly the rows on screen; nothing is fetched or invented. */
function ledgerCsv(rows: LeaveLedgerRow[]): string {
  const header = ["Ledger", "Employee code", "Employee", "Leave type", "Transaction", "Credit", "Debit", "Balance", "Effective date", "Expires on", "Narration", "Source", "Status"];
  const escape = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((row) => [
    row.ledger_reference, row.employee_code, row.employee_name, row.leave_type, row.transaction_type,
    row.credit, row.debit, row.balance, row.effective_date, row.expires_on, row.narration, row.source_reference, row.status,
  ].map(escape).join(","));
  return [header.map(escape).join(","), ...lines].join("\n");
}

export function LeaveBalanceLedgerPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/leave-balances/ledger?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as LeaveLedgerRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/leave-balances/ledger/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as LeaveLedgerRow,
      account: listOf(data.account) as unknown as LeaveLedgerRow[],
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  // The scheme the engine that posted these movements actually calculates on.
  const engineState = useRegisterResource("/api/v1/leave/engine");
  const schemeGaps = useMemo(
    () => listOf(asRecord(asRecord(engineState.data).data).schemeGaps) as unknown as SchemeGap[],
    [engineState.data],
  );

  function exportLedger() {
    if (queue.length === 0) {
      setNotice({ text: "There is nothing in the current scope to export.", tone: "error" });
      return;
    }
    try {
      const blob = new Blob([ledgerCsv(queue)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `leave-ledger-${todayISO()}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ text: `Exported ${queue.length} ledger row(s) in the current scope.`, tone: "success" });
    } catch {
      setNotice({ text: "This ledger could not be exported in your browser.", tone: "error" });
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Leaves · SCR-031"
        title="Leave balance and ledger"
        description="Manage leave balance and ledger with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <button
            type="button"
            onClick={exportLedger}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Export ledger
          </button>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-031"
        description="Every credit and debit in the order it takes effect, with the balance it left behind. Pick a movement to see the whole account it belongs to. Balances are derived from the ledger, never typed in."
      />
      <SchemeGapBanner gaps={schemeGaps} />
      <ScopeBar href="/leave" label="Open leaves" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading leave ledger…"
        errorTitle="Leave ledger unavailable"
        emptyTitle="No ledger movements yet"
        emptyHint="Annual credits, leave debits and reversals appear here as the leave engine posts them."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search leave ledger"
              searchPlaceholder="Search employee, code, leave type, ledger id…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Leave type", "Credit", "Debit", "Balance"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.leave_type || "—"}</Cell>
                  <Cell>{row.credit > 0 ? row.credit : "—"}</Cell>
                  <Cell>{row.debit > 0 ? row.debit : "—"}</Cell>
                  <Cell>{row.balance}</Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.ledger_reference}
                  action={<StatusPill tone={ledgerTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Leave type: {detail.record.leave_type} · Credit: {detail.record.credit > 0 ? detail.record.credit : "—"} · Debit: {detail.record.debit > 0 ? detail.record.debit : "—"} · Balance: {detail.record.balance}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_code ?? "—"} · {detail.record.employee_name ?? "Unnamed"} · Effective: {detail.record.effective_date ?? "—"} · Expires: {detail.record.expires_on ?? "—"}
                </p>
                {detail.record.narration && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Narration: {detail.record.narration}{detail.record.source_reference ? ` · Source ${detail.record.source_reference}` : ""}
                  </p>
                )}
                <StateTimeline states={LEAVE_LEDGER_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">
                    Account trail · {detail.record.leave_type} ({detail.account.length})
                  </p>
                  {detail.account.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No other movements on this account.</p>
                  ) : (
                    <ol className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                      {detail.account.map((entry) => (
                        <li
                          key={entry.id}
                          className={`min-w-0 break-words rounded-xl border px-3 py-2 text-xs ${entry.id === detail.record.id ? "border-primary/30 bg-primary/5" : "border-border/60"}`}
                        >
                          <span className="font-semibold">
                            {entry.ledger_reference} · {entry.transaction_type || "Movement"} · {entry.credit > 0 ? `+${entry.credit}` : `−${entry.debit}`}
                          </span>
                          <span className="mt-0.5 block text-muted-foreground">
                            {entry.effective_date ?? "—"} · balance {entry.balance}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <AuditTrail events={detail.auditTrail} />
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Leave policy configuration (SCR-032) ---------------- */

type LeavePolicyRow = {
  id: string;
  policy_code: string;
  policy_name: string | null;
  leave_type: string;
  leave_type_name: string | null;
  leave_band: string | null;
  annual_days: number | null;
  accrual_frequency: string | null;
  days_per_period: number | null;
  eligibility_wait_months: number | null;
  credit_on_completion: number | null;
  credit_date: string | null;
  effective_from: string;
  record_status: string;
  configuration: UnknownRecord | null;
  status: "draft" | "simulated" | "effective" | "superseded";
};

/**
 * FRM-LVE-01 draft state. Numbers are held as strings because that is what the
 * inputs produce; `toConfigPayload` converts them, and an empty optional number
 * is omitted rather than sent as zero.
 */
type ConfigDraft = {
  leaveType: string;
  name: string;
  unit: string;
  isPaid: boolean;
  genderRestriction: string;
  applicableClasses: string[];
  applicableBands: string;
  accrualMethod: string;
  annualDays: string;
  accrualFrequency: string;
  accrualDay: string;
  prorationRule: string;
  eligibilityWaitDays: string;
  earnedAgainstAttendance: boolean;
  carryForward: boolean;
  maxCarryForward: string;
  carryForwardExpiryMonths: string;
  maxAccumulation: string;
  allowNegative: boolean;
  negativeLimit: string;
  isEncashable: boolean;
  encashmentCap: string;
  minDays: string;
  maxDays: string;
  maxInstancesMonth: string;
  allowHalfDay: boolean;
  advanceNoticeDays: string;
  backdateDays: string;
  reasonMandatory: boolean;
  documentAfterDays: string;
  sandwichRule: string;
  excludedWith: string;
  prerequisiteType: string;
  approvalChainId: string;
  effectiveFrom: string;
  status: string;
};

/** The workbook's stated defaults; every field it leaves blank starts empty. */
function emptyConfigDraft(): ConfigDraft {
  return {
    leaveType: "",
    name: "",
    unit: "days",
    isPaid: true,
    genderRestriction: "",
    applicableClasses: [],
    applicableBands: "",
    accrualMethod: "monthly_accrual",
    annualDays: "",
    accrualFrequency: "monthly",
    accrualDay: "period_end",
    prorationRule: "",
    eligibilityWaitDays: "0",
    earnedAgainstAttendance: false,
    carryForward: true,
    maxCarryForward: "",
    carryForwardExpiryMonths: "12",
    maxAccumulation: "",
    allowNegative: false,
    negativeLimit: "",
    isEncashable: false,
    encashmentCap: "",
    minDays: "0.5",
    maxDays: "",
    maxInstancesMonth: "",
    allowHalfDay: true,
    advanceNoticeDays: "1",
    backdateDays: "7",
    reasonMandatory: false,
    documentAfterDays: "3",
    sandwichRule: "exclude_holidays_and_rest_days",
    excludedWith: "",
    prerequisiteType: "",
    approvalChainId: "",
    effectiveFrom: todayISO(),
    status: "active",
  };
}

const numOr = (value: unknown, fallback: string): string => (typeof value === "number" ? String(value) : fallback);
const listOrText = (value: unknown): string => (Array.isArray(value) ? value.map((item) => String(item)).join(", ") : "");

/** Reads a saved configuration back into the form, leaving unset fields blank. */
function draftFromConfiguration(configuration: UnknownRecord | null): ConfigDraft {
  const base = emptyConfigDraft();
  if (!configuration) return base;
  const flag = (key: string, fallback: boolean) => (typeof configuration[key] === "boolean" ? (configuration[key] as boolean) : fallback);
  return {
    ...base,
    leaveType: str(configuration.leave_type, base.leaveType),
    name: str(configuration.name, base.name),
    unit: str(configuration.unit, base.unit),
    isPaid: flag("is_paid", base.isPaid),
    genderRestriction: str(configuration.gender_restriction),
    applicableClasses: Array.isArray(configuration.applicable_classes)
      ? (configuration.applicable_classes as unknown[]).map((item) => String(item))
      : [],
    applicableBands: listOrText(configuration.applicable_bands),
    accrualMethod: str(configuration.accrual_method, base.accrualMethod),
    annualDays: numOr(configuration.annual_days, base.annualDays),
    accrualFrequency: str(configuration.accrual_frequency, base.accrualFrequency),
    accrualDay: str(configuration.accrual_day, base.accrualDay),
    prorationRule: str(configuration.proration_rule, base.prorationRule),
    eligibilityWaitDays: numOr(configuration.eligibility_wait_days, base.eligibilityWaitDays),
    earnedAgainstAttendance: flag("earned_against_attendance", base.earnedAgainstAttendance),
    carryForward: flag("carry_forward", base.carryForward),
    maxCarryForward: numOr(configuration.max_carry_forward, ""),
    carryForwardExpiryMonths: numOr(configuration.carry_forward_expiry_months, base.carryForwardExpiryMonths),
    maxAccumulation: numOr(configuration.max_accumulation, ""),
    allowNegative: flag("allow_negative", base.allowNegative),
    negativeLimit: numOr(configuration.negative_limit, ""),
    isEncashable: flag("is_encashable", base.isEncashable),
    encashmentCap: numOr(configuration.encashment_cap, ""),
    minDays: numOr(configuration.min_days, base.minDays),
    maxDays: numOr(configuration.max_days, ""),
    maxInstancesMonth: numOr(configuration.max_instances_month, ""),
    allowHalfDay: flag("allow_half_day", base.allowHalfDay),
    advanceNoticeDays: numOr(configuration.advance_notice_days, base.advanceNoticeDays),
    backdateDays: numOr(configuration.backdate_days, base.backdateDays),
    reasonMandatory: flag("reason_mandatory", base.reasonMandatory),
    documentAfterDays: numOr(configuration.document_after_days, base.documentAfterDays),
    sandwichRule: str(configuration.sandwich_rule, base.sandwichRule),
    excludedWith: listOrText(configuration.excluded_with),
    prerequisiteType: str(configuration.prerequisite_type),
    approvalChainId: str(configuration.approval_chain_id, base.approvalChainId),
    effectiveFrom: str(configuration.effective_from, base.effectiveFrom),
    status: str(configuration.status, base.status),
  };
}

const splitList = (value: string): string[] =>
  value.split(",").map((item) => item.trim()).filter((item) => item !== "");

/** Converts the draft into the API payload, omitting every unset optional field. */
function toConfigPayload(draft: ConfigDraft): UnknownRecord {
  const optionalNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));
  const optionalText = (value: string) => (value.trim() === "" ? undefined : value.trim());
  const bands = splitList(draft.applicableBands);
  const excluded = splitList(draft.excludedWith);
  return {
    leaveType: draft.leaveType.trim(),
    name: draft.name.trim(),
    unit: draft.unit,
    isPaid: draft.isPaid,
    ...(draft.genderRestriction ? { genderRestriction: draft.genderRestriction } : {}),
    applicableClasses: draft.applicableClasses,
    applicableBands: bands,
    accrualMethod: draft.accrualMethod,
    annualDays: Number(draft.annualDays),
    accrualFrequency: draft.accrualFrequency,
    accrualDay: draft.accrualDay,
    prorationRule: draft.prorationRule.trim(),
    eligibilityWaitDays: Number(draft.eligibilityWaitDays),
    earnedAgainstAttendance: draft.earnedAgainstAttendance,
    carryForward: draft.carryForward,
    ...(optionalNumber(draft.maxCarryForward) === undefined ? {} : { maxCarryForward: Number(draft.maxCarryForward) }),
    ...(optionalNumber(draft.carryForwardExpiryMonths) === undefined ? {} : { carryForwardExpiryMonths: Number(draft.carryForwardExpiryMonths) }),
    ...(optionalNumber(draft.maxAccumulation) === undefined ? {} : { maxAccumulation: Number(draft.maxAccumulation) }),
    allowNegative: draft.allowNegative,
    ...(optionalNumber(draft.negativeLimit) === undefined ? {} : { negativeLimit: Number(draft.negativeLimit) }),
    isEncashable: draft.isEncashable,
    ...(optionalNumber(draft.encashmentCap) === undefined ? {} : { encashmentCap: Number(draft.encashmentCap) }),
    minDays: Number(draft.minDays),
    ...(optionalNumber(draft.maxDays) === undefined ? {} : { maxDays: Number(draft.maxDays) }),
    ...(optionalNumber(draft.maxInstancesMonth) === undefined ? {} : { maxInstancesMonth: Number(draft.maxInstancesMonth) }),
    allowHalfDay: draft.allowHalfDay,
    advanceNoticeDays: Number(draft.advanceNoticeDays),
    backdateDays: Number(draft.backdateDays),
    reasonMandatory: draft.reasonMandatory,
    ...(optionalNumber(draft.documentAfterDays) === undefined ? {} : { documentAfterDays: Number(draft.documentAfterDays) }),
    sandwichRule: draft.sandwichRule,
    ...(excluded.length > 0 ? { excludedWith: excluded } : {}),
    ...(optionalText(draft.prerequisiteType) === undefined ? {} : { prerequisiteType: draft.prerequisiteType.trim() }),
    approvalChainId: draft.approvalChainId.trim(),
    effectiveFrom: draft.effectiveFrom,
    status: draft.status,
  };
}

/** Client-side mirror of the schema's own conditional requirements. */
function configDraftError(draft: ConfigDraft): string | null {
  if (draft.leaveType.trim() === "" || draft.name.trim() === "") return "A leave type code and name are required.";
  if (draft.applicableClasses.length === 0) return "Pick at least one applicable worker class.";
  if (splitList(draft.applicableBands).length === 0) return "Name at least one applicable leave band.";
  if (draft.annualDays.trim() === "" || Number.isNaN(Number(draft.annualDays))) return "An annual entitlement is required.";
  if (draft.prorationRule.trim() === "") return "A proration rule is required.";
  if (draft.approvalChainId.trim() === "") return "An approval chain is required.";
  if (draft.carryForward && draft.maxCarryForward.trim() === "") return "A carry-forward type must state its maximum carry forward.";
  if (draft.allowNegative && draft.negativeLimit.trim() === "") return "A type that allows a negative balance must state the limit.";
  if (draft.isEncashable && draft.encashmentCap.trim() === "") return "An encashable type must state its annual encashment cap.";
  return null;
}

/** One labelled configuration control, laid out the same way for every field. */
function ConfigField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-4 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function ConfigToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2.5">
      <input
        type="checkbox"
        aria-label={label}
        className="size-4 rounded border-border"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </label>
  );
}

/** The 36-field Leave Type Configuration form (FRM-LVE-01). */
function LeaveTypeConfigForm({
  draft,
  onChange,
  onSubmit,
  busy,
  submitLabel,
  codeLocked,
}: {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  codeLocked: boolean;
}) {
  const set = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => { onChange({ ...draft, [key]: value }); };
  const options = (values: ReadonlyArray<{ value: string; label: string }>) =>
    values.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-foreground">Type</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ConfigField label="Leave type code">
            <input value={draft.leaveType} disabled={codeLocked} onChange={(event) => set("leaveType", event.target.value)} className={actionInputClass} aria-label="Leave type code" />
          </ConfigField>
          <ConfigField label="Leave type name">
            <input value={draft.name} onChange={(event) => set("name", event.target.value)} className={actionInputClass} aria-label="Leave type name" />
          </ConfigField>
          <ConfigField label="Unit">
            <select value={draft.unit} onChange={(event) => set("unit", event.target.value)} className={actionInputClass} aria-label="Leave unit">
              {options(picklists.PL_LEAVE_UNIT.values)}
            </select>
          </ConfigField>
          <ConfigField label="Gender restriction" hint="Leave blank for no restriction.">
            <select value={draft.genderRestriction} onChange={(event) => set("genderRestriction", event.target.value)} className={actionInputClass} aria-label="Gender restriction">
              <option value="">None</option>
              {options(picklists.PL_GENDER.values)}
            </select>
          </ConfigField>
          <ConfigField label="Applicable worker classes" hint="Ctrl-click to pick more than one.">
            <select
              multiple
              size={4}
              aria-label="Applicable worker classes"
              value={draft.applicableClasses}
              onChange={(event) => set("applicableClasses", Array.from(event.target.selectedOptions, (option) => option.value))}
              className="min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {options(picklists.PL_WORKER_CLASS.values)}
            </select>
          </ConfigField>
          <ConfigField label="Applicable leave bands" hint="Comma separated.">
            <input value={draft.applicableBands} onChange={(event) => set("applicableBands", event.target.value)} className={actionInputClass} aria-label="Applicable leave bands" />
          </ConfigField>
          <ConfigToggle label="Paid" checked={draft.isPaid} onChange={(next) => set("isPaid", next)} />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-foreground">Accrual</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ConfigField label="Accrual method">
            <select value={draft.accrualMethod} onChange={(event) => set("accrualMethod", event.target.value)} className={actionInputClass} aria-label="Accrual method">
              {options(picklists.PL_ACCRUAL_METHOD.values)}
            </select>
          </ConfigField>
          <ConfigField label="Annual entitlement (days)">
            <input type="number" min="0" max="365" step="0.01" value={draft.annualDays} onChange={(event) => set("annualDays", event.target.value)} className={actionInputClass} aria-label="Annual entitlement" />
          </ConfigField>
          <ConfigField label="Accrual frequency">
            <select value={draft.accrualFrequency} onChange={(event) => set("accrualFrequency", event.target.value)} className={actionInputClass} aria-label="Accrual frequency">
              {options(picklists.PL_FREQUENCY.values)}
            </select>
          </ConfigField>
          <ConfigField label="Accrual on">
            <select value={draft.accrualDay} onChange={(event) => set("accrualDay", event.target.value)} className={actionInputClass} aria-label="Accrual on">
              {options(picklists.PL_ACCRUAL_DAY.values)}
            </select>
          </ConfigField>
          <ConfigField label="Proration rule">
            <input value={draft.prorationRule} onChange={(event) => set("prorationRule", event.target.value)} className={actionInputClass} aria-label="Proration rule" />
          </ConfigField>
          <ConfigField label="Eligibility wait (days from joining)">
            <input type="number" min="0" max="365" value={draft.eligibilityWaitDays} onChange={(event) => set("eligibilityWaitDays", event.target.value)} className={actionInputClass} aria-label="Eligibility wait days" />
          </ConfigField>
          <ConfigToggle label="Earned against attendance" checked={draft.earnedAgainstAttendance} onChange={(next) => set("earnedAgainstAttendance", next)} />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-foreground">Balance</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ConfigToggle label="Carry forward allowed" checked={draft.carryForward} onChange={(next) => set("carryForward", next)} />
          <ConfigField label="Maximum carry forward">
            <input type="number" min="0" step="0.01" disabled={!draft.carryForward} value={draft.maxCarryForward} onChange={(event) => set("maxCarryForward", event.target.value)} className={actionInputClass} aria-label="Maximum carry forward" />
          </ConfigField>
          <ConfigField label="Carry-forward expiry (months)">
            <input type="number" min="0" max="120" value={draft.carryForwardExpiryMonths} onChange={(event) => set("carryForwardExpiryMonths", event.target.value)} className={actionInputClass} aria-label="Carry forward expiry months" />
          </ConfigField>
          <ConfigField label="Maximum accumulation" hint="Blank means no ceiling is configured.">
            <input type="number" min="0" step="0.01" value={draft.maxAccumulation} onChange={(event) => set("maxAccumulation", event.target.value)} className={actionInputClass} aria-label="Maximum accumulation" />
          </ConfigField>
          <ConfigToggle label="Negative balance allowed" checked={draft.allowNegative} onChange={(next) => set("allowNegative", next)} />
          <ConfigField label="Negative balance limit">
            <input type="number" min="0" step="0.01" disabled={!draft.allowNegative} value={draft.negativeLimit} onChange={(event) => set("negativeLimit", event.target.value)} className={actionInputClass} aria-label="Negative balance limit" />
          </ConfigField>
          <ConfigToggle label="Encashable" checked={draft.isEncashable} onChange={(next) => set("isEncashable", next)} />
          <ConfigField label="Encashment cap (days a year)">
            <input type="number" min="0" step="0.01" disabled={!draft.isEncashable} value={draft.encashmentCap} onChange={(event) => set("encashmentCap", event.target.value)} className={actionInputClass} aria-label="Encashment cap" />
          </ConfigField>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-foreground">Application</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ConfigField label="Minimum days per request">
            <input type="number" min="0" step="0.5" value={draft.minDays} onChange={(event) => set("minDays", event.target.value)} className={actionInputClass} aria-label="Minimum days per request" />
          </ConfigField>
          <ConfigField label="Maximum days per request" hint="Blank means no maximum.">
            <input type="number" min="0" step="0.5" value={draft.maxDays} onChange={(event) => set("maxDays", event.target.value)} className={actionInputClass} aria-label="Maximum days per request" />
          </ConfigField>
          <ConfigField label="Maximum instances per month" hint="Blank means no cap.">
            <input type="number" min="1" max="31" value={draft.maxInstancesMonth} onChange={(event) => set("maxInstancesMonth", event.target.value)} className={actionInputClass} aria-label="Maximum instances per month" />
          </ConfigField>
          <ConfigField label="Advance notice (days)">
            <input type="number" min="0" max="90" value={draft.advanceNoticeDays} onChange={(event) => set("advanceNoticeDays", event.target.value)} className={actionInputClass} aria-label="Advance notice days" />
          </ConfigField>
          <ConfigField label="Backdating allowed (days)">
            <input type="number" min="0" max="90" value={draft.backdateDays} onChange={(event) => set("backdateDays", event.target.value)} className={actionInputClass} aria-label="Backdating allowed days" />
          </ConfigField>
          <ConfigField label="Document mandatory beyond (days)" hint="Blank means never mandatory.">
            <input type="number" min="0" max="365" value={draft.documentAfterDays} onChange={(event) => set("documentAfterDays", event.target.value)} className={actionInputClass} aria-label="Document mandatory beyond days" />
          </ConfigField>
          <ConfigToggle label="Half day allowed" checked={draft.allowHalfDay} onChange={(next) => set("allowHalfDay", next)} />
          <ConfigToggle label="Reason mandatory" checked={draft.reasonMandatory} onChange={(next) => set("reasonMandatory", next)} />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-foreground">Rules and control</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ConfigField label="Sandwich rule">
            <select value={draft.sandwichRule} onChange={(event) => set("sandwichRule", event.target.value)} className={actionInputClass} aria-label="Sandwich rule">
              {options(picklists.PL_SANDWICH_RULE.values)}
            </select>
          </ConfigField>
          <ConfigField label="Cannot be combined with" hint="Comma separated leave type codes.">
            <input value={draft.excludedWith} onChange={(event) => set("excludedWith", event.target.value)} className={actionInputClass} aria-label="Cannot be combined with" />
          </ConfigField>
          <ConfigField label="Must be preceded by" hint="Another leave type code; blank for none.">
            <input value={draft.prerequisiteType} onChange={(event) => set("prerequisiteType", event.target.value)} className={actionInputClass} aria-label="Must be preceded by" />
          </ConfigField>
          <ConfigField label="Approval chain">
            <input value={draft.approvalChainId} onChange={(event) => set("approvalChainId", event.target.value)} className={actionInputClass} aria-label="Approval chain" />
          </ConfigField>
          <ConfigField label="Effective from">
            <input type="date" value={draft.effectiveFrom} onChange={(event) => set("effectiveFrom", event.target.value)} className={actionInputClass} aria-label="Effective from" />
          </ConfigField>
          <ConfigField label="Status">
            <select value={draft.status} onChange={(event) => set("status", event.target.value)} className={actionInputClass} aria-label="Leave type status">
              {options(picklists.PL_ACTIVE_STATUS.values)}
            </select>
          </ConfigField>
        </div>
      </div>

      <ActionButton onClick={onSubmit} busy={busy}>{submitLabel}</ActionButton>
    </div>
  );
}

const LEAVE_POLICY_STATES = [
  { value: "draft", label: "Draft" },
  { value: "simulated", label: "Simulated" },
  { value: "effective", label: "Effective" },
  { value: "superseded", label: "Superseded" },
] as const;

function policyTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "effective") return "success";
  if (status === "simulated") return "info";
  if (status === "draft") return "warning";
  return "neutral";
}

/**
 * FRM-LVE-01's scheme header: the three rules that sit above the individual leave types.
 *
 * These decide what the accrual and lapse runs credit, and until now nothing in the
 * product could set them — the reader and the schema existed, but the only writer was a
 * seed script, so answering Q-06 or Q-07 meant running SQL. Each value can also be put
 * back to unsupplied, which returns the engine to refusing by name rather than quietly
 * keeping the last figure somebody typed.
 */
function LeaveSchemeSettingsPanel() {
  const settings = useRegisterResource("/api/v1/leave/scheme-settings");
  const stored = useMemo(() => recordFromEnvelope(settings.data), [settings.data]);
  const gaps = useMemo(() => listOf(stored.gaps), [stored.gaps]);
  const [form, setForm] = useState<{ seniorGradeRank: string; coffLapseDays: string; coffLapseDayBasis: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Adjusting state to the loaded record during render, with the record as the key: the
  // form shows what is stored until somebody edits it, and never overwrites a live edit.
  const loadedKey = `${str(stored.seniorGradeRank, "-")}|${str(stored.coffLapseDays, "-")}|${str(stored.coffLapseDayBasis, "-")}`;
  const [appliedKey, setAppliedKey] = useState(loadedKey);
  if (form === null || appliedKey !== loadedKey) {
    setAppliedKey(loadedKey);
    setForm({
      seniorGradeRank: str(stored.seniorGradeRank),
      coffLapseDays: str(stored.coffLapseDays),
      coffLapseDayBasis: str(stored.coffLapseDayBasis),
      reason: "",
    });
  }
  const values = form ?? { seniorGradeRank: "", coffLapseDays: "", coffLapseDayBasis: "", reason: "" };

  async function save() {
    if (values.reason.trim().length < 10) {
      setNotice({ text: "A reason of at least 10 characters is recorded against the change.", tone: "error" });
      return;
    }
    // An empty box means "unsupplied" and is sent as null, which removes the value.
    const body: Record<string, unknown> = { reason: values.reason.trim() };
    body.seniorGradeRank = values.seniorGradeRank.trim() === "" ? null : Number(values.seniorGradeRank);
    body.coffLapseDays = values.coffLapseDays.trim() === "" ? null : Number(values.coffLapseDays);
    body.coffLapseDayBasis = values.coffLapseDayBasis === "" ? null : values.coffLapseDayBasis;
    if (body.seniorGradeRank !== null && !Number.isInteger(body.seniorGradeRank)) {
      setNotice({ text: "The senior grade rank must be a whole number.", tone: "error" });
      return;
    }
    if (body.coffLapseDays !== null && !Number.isInteger(body.coffLapseDays)) {
      setNotice({ text: "The comp-off window must be a whole number of days.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction("/api/v1/leave/scheme-settings", body, "PUT");
    setBusy(false);
    setNotice(outcome.ok
      ? { text: "Scheme settings saved. The next accrual or lapse run reads these values.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) invalidateGetRequest("/api/v1/leave/scheme-settings");
  }

  return (
    <ActionPanel title="Scheme rules (above the individual leave types)">
      <ActionField label="Senior grade rank — RL-07 credits 18/6/6 at or above this rank (Q-06)">
        <input value={values.seniorGradeRank} inputMode="numeric" onChange={(event) => setForm((c) => ({ ...(c ?? values), seniorGradeRank: event.target.value }))} className={actionInputClass} placeholder="Leave blank if not yet decided" />
      </ActionField>
      <ActionField label="Comp-off lapse window in days — RL-06">
        <input value={values.coffLapseDays} inputMode="numeric" onChange={(event) => setForm((c) => ({ ...(c ?? values), coffLapseDays: event.target.value }))} className={actionInputClass} placeholder="60" />
      </ActionField>
      <ActionField label="Comp-off day basis (Q-07)">
        <select value={values.coffLapseDayBasis} onChange={(event) => setForm((c) => ({ ...(c ?? values), coffLapseDayBasis: event.target.value }))} className={actionInputClass}>
          <option value="">Not yet decided</option>
          <option value="calendar">Calendar days</option>
          <option value="working">Working days</option>
        </select>
      </ActionField>
      <ActionField label="Reason (audited)">
        <input value={values.reason} onChange={(event) => setForm((c) => ({ ...(c ?? values), reason: event.target.value }))} className={actionInputClass} />
      </ActionField>
      {gaps.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold">Still unanswered ({gaps.length})</p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
            {gaps.map((gap, index) => (
              <li key={index}><span className="font-mono">{str(gap.question, "—")}</span> {str(gap.detail)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <RegisterNotice notice={notice} />
      <ActionButton onClick={save} busy={busy}>Save scheme rules</ActionButton>
    </ActionPanel>
  );
}

export function LeavePolicyConfigurationPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<ConfigDraft>(emptyConfigDraft);
  const [editDraft, setEditDraft] = useState<ConfigDraft | null>(null);

  const queueState = useRegisterResource(`/api/v1/leave-policies/register?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as LeavePolicyRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/leave-policies/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as LeavePolicyRow,
      rules: asRecord(data.leaveTypeRules),
      coverage: typeof data.coverage === "number" ? data.coverage : null,
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  /** The saved configuration, ready to edit, refreshed whenever another rule is picked. */
  const savedDraft = useMemo(
    () => (detail ? draftFromConfiguration(detail.record.configuration) : null),
    [detail],
  );
  const activeEditDraft = editDraft ?? savedDraft;

  async function saveConfiguration(mode: "create" | "update") {
    const draft = mode === "create" ? createDraft : activeEditDraft;
    if (!draft) return;
    if (mode === "update" && !selected) return;
    const error = configDraftError(draft);
    if (error) {
      setNotice({ text: error, tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      mode === "create"
        ? "/api/v1/leave-policies/register"
        : `/api/v1/leave-policies/register/${encodeURIComponent(selected?.id ?? "")}/configure`,
      toConfigPayload(draft),
    );
    setNotice(outcome.ok
      ? { text: mode === "create" ? "Leave type configured. The new rule opens as a draft version." : "Leave type re-configured. The change is recorded as a delta in the audit trail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      if (mode === "create") {
        setCreateDraft(emptyConfigDraft());
        setShowCreate(false);
      } else {
        setEditDraft(null);
      }
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  async function transition(action: "simulate" | "activate" | "supersede") {
    if (!selected) return;
    if (reason.trim().length < 3) {
      setNotice({ text: "A reason (min 3 characters) is required.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      `/api/v1/leave-policies/register/${encodeURIComponent(selected.id)}/transition`,
      { action, reason: reason.trim() },
    );
    setNotice(outcome.ok
      ? { text: "Policy state changed. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Leaves · SCR-032"
        title="Leave policy configuration"
        description="Manage leave policy configuration with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <button
            type="button"
            onClick={() => setShowCreate((visible) => !visible)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            {showCreate ? "Close the policy form" : "Create policy"}
          </button>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-032"
        description="Pick an accrual rule from the queue → review its band, accrual and the leave-type rules it credits against → move it through simulate, activate and supersede with a reason. Accrual arithmetic stays server-owned."
      />
      <ScopeBar href="/leave" label="Open leaves" />

      {showCreate && (
        <Surface className="mb-6">
          <SectionHeading
            title="Configure a leave type"
            description="Every field the workbook marks mandatory is required here; anything it leaves blank stays unset rather than defaulted."
          />
          <LeaveTypeConfigForm
            draft={createDraft}
            onChange={setCreateDraft}
            onSubmit={() => void saveConfiguration("create")}
            busy={busy}
            submitLabel="Save leave type"
            codeLocked={false}
          />
        </Surface>
      )}

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading leave policies…"
        errorTitle="Leave policies unavailable"
        emptyTitle="No leave policies configured"
        emptyHint="Define an accrual rule per leave type and band. Each rule appears here with the leave-type rules it credits against."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search leave policies"
              searchPlaceholder="Search policy code, leave type, band…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Policy", "Leave type", "Effective from", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.policy_code}</Cell>
                  <Cell>{row.leave_type || "—"}</Cell>
                  <Cell>{row.effective_from || "—"}</Cell>
                  <Cell><StatusPill tone={policyTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.policy_code}
                  action={<StatusPill tone={policyTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Policy: {detail.record.policy_code} · Leave type: {detail.record.leave_type}{detail.record.leave_type_name ? ` (${detail.record.leave_type_name})` : ""} · Band: {detail.record.leave_band ?? "All bands"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Accrual: {detail.record.annual_days ?? "—"} day(s) a year · {detail.record.accrual_frequency ?? "—"} · {detail.record.days_per_period ?? "—"} per period · Credit on {detail.record.credit_date ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Eligibility wait: {detail.record.eligibility_wait_months ?? 0} month(s){detail.record.credit_on_completion === null ? "" : ` · ${detail.record.credit_on_completion} day(s) credited on completion`}
                  {detail.coverage === null ? "" : ` · ${detail.coverage} employee assignment(s) on this policy`}
                </p>
                <StateTimeline states={LEAVE_POLICY_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Leave type rules</p>
                  <ul className="mt-2 space-y-1.5">
                    {[
                      ["Carry forward", str(detail.rules.carry_forward, "—")],
                      ["Expiry rule", str(detail.rules.expiry_rule, "—")],
                      ["Year-end action", str(detail.rules.year_end_action, "—")],
                      ["Maximum per month", str(detail.rules.max_per_month, "No cap")],
                      ["Cannot combine with", str(detail.rules.cannot_combine_with, "No restriction")],
                      ["Applies to bands", str(detail.rules.applies_to_bands, "—")],
                    ].map(([label, value]) => (
                      <li
                        key={label}
                        className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 rounded-xl border border-border/60 px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 break-words font-semibold text-foreground">{label}</span>
                        <span className="min-w-0 break-words text-left text-muted-foreground sm:text-right">{value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <AuditTrail events={detail.auditTrail} />
                {detail.record.status === "superseded" ? (
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    This is a superseded version. Configure a new rule instead of editing it, so in-flight requests keep the version they started on.
                  </p>
                ) : (
                  activeEditDraft && (
                    <ActionPanel title="Leave type configuration">
                      <LeaveTypeConfigForm
                        draft={activeEditDraft}
                        onChange={setEditDraft}
                        onSubmit={() => void saveConfiguration("update")}
                        busy={busy}
                        submitLabel="Save configuration"
                        codeLocked
                      />
                    </ActionPanel>
                  )
                )}
                <LeaveSchemeSettingsPanel />
                <ActionPanel title="Move policy state">
                  <ActionField label="Reason (audited)">
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why is this policy state changing?"
                      className={actionInputClass}
                    />
                  </ActionField>
                  <span className="flex flex-wrap gap-2">
                    <ActionButton onClick={() => void transition("simulate")} busy={busy}>Simulate policy</ActionButton>
                    <ActionButton onClick={() => void transition("activate")} busy={busy}>Make effective</ActionButton>
                    <ActionButton onClick={() => void transition("supersede")} busy={busy}>Supersede</ActionButton>
                  </span>
                </ActionPanel>
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}
