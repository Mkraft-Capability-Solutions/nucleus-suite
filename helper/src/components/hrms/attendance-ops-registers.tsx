"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  asRecord,
  downloadCsv,
  listFromEnvelope,
  listOf,
  num,
  postRegisterAction,
  recordFromEnvelope,
  stateLabel,
  str,
  toCsv,
  useRegisterResource,
  useSelection,
  type Notice,
} from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoISO(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

/** Header call to action, styled like every other register primary action. */
const headerActionClass =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90";

const headerSecondaryClass =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50";

/** Renders one labelled fact pair list without inventing a value for a missing field. */
function FactList({ title, facts }: { title: string; facts: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {facts.map(([label, value]) => (
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
  );
}

/**
 * The attendance day a record hangs off, when the server returned one. Some
 * endpoints project the day's fields flat and others return the stored row with
 * them nested under `attributes`, so both shapes are read here.
 */
function LinkedDay({ day }: { day: UnknownRecord }) {
  const fields: UnknownRecord = { ...day, ...asRecord(day.attributes) };
  const state = str(fields.status, str(fields.record_status));
  return (
    <FactList
      title="Linked attendance day"
      facts={[
        ["Date", str(fields.date, "—")],
        ["Day type", str(fields.day_type, "—")],
        ["Shift", str(fields.shift_applied, str(fields.shift_assigned, "—"))],
        ["First in / last out", `${str(fields.first_in, "—")} · ${str(fields.last_out, "—")}`],
        ["Gross / break minutes", `${str(fields.gross_minutes, "—")} · ${str(fields.break_minutes, "—")}`],
        ["Gate pass minutes", str(fields.gate_pass_minutes, "—")],
        ["Day state", state ? stateLabel(state) : "—"],
      ]}
    />
  );
}

/* ---------------- Overtime register (SCR-024) ---------------- */

type OvertimeRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  overtime_minutes: number;
  overtime_minutes_raw: number | null;
  overtime_label: string;
  multiplier: string | null;
  reduction_reason: string | null;
  weekly_cap_status: string | null;
  eligibility_basis: string | null;
  day_type: string | null;
  pay_run: string | null;
  approved_by: string | null;
  approved_on: string | null;
  record_reference: string | null;
  status: "pending_approval" | "approved" | "tagged_to_run" | "paid";
};

const OVERTIME_STATES = [
  { value: "pending_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "tagged_to_run", label: "Tagged to run" },
  { value: "paid", label: "Paid" },
] as const;

function overtimeTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "paid") return "success";
  if (status === "pending_approval") return "warning";
  if (status === "approved" || status === "tagged_to_run") return "info";
  return "neutral";
}

export function OvertimeRegisterPage() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [orgUnit, setOrgUnit] = useState("");
  const [period, setPeriod] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [payableMinutes, setPayableMinutes] = useState("");
  const [reductionReason, setReductionReason] = useState("");
  const [payRun, setPayRun] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(
    `/api/v1/overtime/register?search=${encodeURIComponent(search)}&location=${encodeURIComponent(location)}` +
      `&orgUnit=${encodeURIComponent(orgUnit)}&period=${encodeURIComponent(period)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as OvertimeRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/overtime/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    const day = asRecord(data.day);
    return {
      record: data as unknown as OvertimeRow,
      day: day.id ? day : null,
      weeklyCap: asRecord(data.weeklyCap),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function approve() {
    if (!selected) return;
    if (reason.trim().length < 3) {
      setNotice({ text: "A reason (at least 3 characters) is required to approve overtime.", tone: "error" });
      return;
    }
    const reduced = payableMinutes.trim() !== "";
    const minutes = Number(payableMinutes);
    if (reduced && (!Number.isInteger(minutes) || minutes < 0)) {
      setNotice({ text: "Payable minutes must be a whole number of minutes.", tone: "error" });
      return;
    }
    if (reduced && reductionReason.trim().length < 10) {
      setNotice({ text: "A reduction must state why the payable minutes were cut (at least 10 characters).", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      `/api/v1/overtime/register/${encodeURIComponent(selected.id)}/approve`,
      {
        reason: reason.trim(),
        ...(reduced ? { payableMinutes: minutes, reductionReason: reductionReason.trim() } : {}),
      },
    );
    setNotice(outcome.ok
      ? { text: "Overtime approved. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setReason("");
      setPayableMinutes("");
      setReductionReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  async function tagRun() {
    if (!selected) return;
    if (payRun.trim().length < 1) {
      setNotice({ text: "Enter the payroll run this overtime is tagged to.", tone: "error" });
      return;
    }
    if (reason.trim().length < 3) {
      setNotice({ text: "A reason (at least 3 characters) is required to tag a payroll run.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      `/api/v1/overtime/register/${encodeURIComponent(selected.id)}/tag-run`,
      { payRun: payRun.trim(), reason: reason.trim() },
    );
    setNotice(outcome.ok
      ? { text: "Overtime tagged to the payroll run. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setPayRun("");
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-024"
        title="Overtime register"
        description="Manage overtime register with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/attendance" className={headerActionClass}>
            Approve overtime
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-024"
        description="OT by person and date with eligibility basis, multiplier and pay run. Pick a line from the queue → check the eligibility basis and the attendance day behind it → approve, then tag the payroll run that will pay it."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <Surface className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionField label="Location">
            <input
              value={location}
              onChange={(event) => { setSelectedId(""); setLocation(event.target.value); }}
              placeholder="All locations in scope"
              className={actionInputClass}
            />
          </ActionField>
          <ActionField label="Org unit">
            <input
              value={orgUnit}
              onChange={(event) => { setSelectedId(""); setOrgUnit(event.target.value); }}
              placeholder="All org units in scope"
              className={actionInputClass}
            />
          </ActionField>
          <ActionField label="Period">
            <input
              type="month"
              value={period}
              onChange={(event) => { setSelectedId(""); setPeriod(event.target.value); }}
              className={actionInputClass}
            />
          </ActionField>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          An empty filter means everything in your permitted scope; no period is assumed for you.
        </p>
      </Surface>

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading overtime register…"
        errorTitle="Overtime register unavailable"
        emptyTitle="No overtime recorded"
        emptyHint="Overtime appears here once the time-office engine credits payable minutes against an attendance day. Nothing is listed until a day produces them."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search overtime register"
              searchPlaceholder="Search employee, code, pay run…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Employee", "Date", "Overtime", "Run"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_name || row.employee_code || "—"}</Cell>
                  <Cell>{row.date || "—"}</Cell>
                  <Cell>{row.overtime_label || "—"}</Cell>
                  <Cell>{row.pay_run || "Not tagged"}</Cell>
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
                  description={detail.record.record_reference ?? detail.record.employee_code ?? "Overtime record"}
                  action={<StatusPill tone={overtimeTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_name ?? "—"}{detail.record.employee_code ? ` (${detail.record.employee_code})` : ""} · Date: {detail.record.date ?? "—"} · Overtime: {detail.record.overtime_label || "—"} ({num(detail.record.overtime_minutes)} min)
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Multiplier: {detail.record.multiplier ?? "—"} · Eligibility basis: {detail.record.eligibility_basis ?? "—"} · Day type: {detail.record.day_type ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Raw minutes: {detail.record.overtime_minutes_raw === null ? "—" : String(detail.record.overtime_minutes_raw)} · Payable minutes: {String(detail.record.overtime_minutes)}
                  {detail.record.reduction_reason ? ` · Reduced because: ${detail.record.reduction_reason}` : ""}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Weekly cap: {str(detail.weeklyCap.status)
                    ? `${picklistLabel("PL_CAP_STATUS", str(detail.weeklyCap.status))} — ${String(num(detail.weeklyCap.minutesInWeek))} of ${String(num(detail.weeklyCap.capMinutes))} minutes this week`
                    : "No statutory weekly cap is configured on the overtime policy, so no cap check can be made."}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Pay run: {detail.record.pay_run || "Not tagged"} · Approved by: {detail.record.approved_by ?? "—"} · Approved on: {detail.record.approved_on ?? "—"} · Record reference: {detail.record.record_reference ?? "—"}
                </p>
                <StateTimeline states={OVERTIME_STATES} current={detail.record.status} />
                {detail.day && <LinkedDay day={detail.day} />}
                <AuditTrail events={detail.auditTrail} />
                <ActionPanel title="Controlled actions">
                  {detail.record.status !== "pending_approval" && detail.record.status !== "approved" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      This record is {stateLabel(detail.record.status).toLowerCase()}. Approval and payroll tagging are closed for it.
                    </p>
                  ) : (
                    <>
                      {detail.record.status === "approved" && (
                        <ActionField label="Payroll run">
                          <input
                            value={payRun}
                            onChange={(event) => setPayRun(event.target.value)}
                            placeholder="Payroll run this overtime is paid in"
                            className={actionInputClass}
                          />
                        </ActionField>
                      )}
                      {detail.record.status === "pending_approval" && (
                        <>
                          <ActionField label="Payable minutes (blank keeps the raw figure; may be reduced, never raised)">
                            <input
                              type="number"
                              min="0"
                              max={detail.record.overtime_minutes_raw ?? undefined}
                              value={payableMinutes}
                              onChange={(event) => setPayableMinutes(event.target.value)}
                              placeholder={detail.record.overtime_minutes_raw === null ? "" : String(detail.record.overtime_minutes_raw)}
                              className={actionInputClass}
                            />
                          </ActionField>
                          {payableMinutes.trim() !== "" && (
                            <ActionField label="Reduction reason (at least 10 characters)">
                              <input
                                value={reductionReason}
                                onChange={(event) => setReductionReason(event.target.value)}
                                placeholder="Why are the payable minutes below the raw minutes?"
                                className={actionInputClass}
                              />
                            </ActionField>
                          )}
                        </>
                      )}
                      <ActionField label="Reason (audited)">
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Why is this overtime being actioned?"
                          className={actionInputClass}
                        />
                      </ActionField>
                      <span className="flex flex-wrap gap-2">
                        {detail.record.status === "pending_approval" && (
                          <ActionButton onClick={() => void approve()} busy={busy}>Approve overtime</ActionButton>
                        )}
                        {detail.record.status === "approved" && (
                          <ActionButton onClick={() => void tagRun()} busy={busy}>Tag payroll run</ActionButton>
                        )}
                      </span>
                    </>
                  )}
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

/* ---------------- Attendance exception queue (SCR-025) ---------------- */

type ExceptionRow = {
  id: string;
  exception_reference: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  kind: string;
  severity: string | null;
  detail: string | null;
  proposal: string | null;
  resolution_action: string | null;
  amended_value: string | null;
  age_days: number | null;
  status: "open" | "proposed" | "resolved" | "rejected";
};

/** PL_EXCEPTION_ACTION, read from the registry rather than retyped. */
const EXCEPTION_ACTIONS = picklists.PL_EXCEPTION_ACTION.values;

const EXCEPTION_STATES = [
  { value: "open", label: "Open" },
  { value: "proposed", label: "Proposed" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
] as const;

function exceptionTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "resolved") return "success";
  if (status === "open") return "warning";
  if (status === "rejected") return "danger";
  if (status === "proposed") return "info";
  return "neutral";
}

export function AttendanceExceptionQueuePage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [resolutionAction, setResolutionAction] = useState<string>(EXCEPTION_ACTIONS[0].value);
  const [amendedValue, setAmendedValue] = useState("");
  const [reason, setReason] = useState("");
  const [bulkApply, setBulkApply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(
    `/api/v1/attendance/exceptions/register?search=${encodeURIComponent(search)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as ExceptionRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/attendance/exceptions/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    const day = asRecord(data.day);
    return {
      record: data as unknown as ExceptionRow,
      day: day.id ? day : null,
      punches: listOf(data.punches),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function accept() {
    if (!selected) return;
    if (reason.trim().length < 3) {
      setNotice({ text: "A reason (at least 3 characters) is required to accept the proposal.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      `/api/v1/attendance/exceptions/register/${encodeURIComponent(selected.id)}/accept`,
      { reason: reason.trim() },
    );
    setNotice(outcome.ok
      ? { text: "Proposal accepted. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  /** Every open exception of the selected one's type — what a bulk apply may cover. */
  const sameTypeOpenIds = useMemo(
    () =>
      selected
        ? queue
            .filter((row) => row.kind === selected.kind && (row.status === "open" || row.status === "proposed"))
            .map((row) => row.id)
        : [],
    [queue, selected],
  );

  async function resolve() {
    if (!selected) return;
    if (reason.trim().length < 10) {
      setNotice({ text: "A reason of at least 10 characters is required.", tone: "error" });
      return;
    }
    if (resolutionAction === "amend" && amendedValue.trim() === "") {
      setNotice({ text: "An amendment must carry the amended value.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      `/api/v1/attendance/exceptions/register/${encodeURIComponent(selected.id)}/resolve`,
      {
        action: resolutionAction,
        reason: reason.trim(),
        ...(resolutionAction === "amend" ? { amendedValue: amendedValue.trim() } : {}),
        ...(bulkApply ? { bulkApply: true, bulkIds: sameTypeOpenIds } : {}),
      },
    );
    setNotice(outcome.ok
      ? { text: "Exception actioned. One audit entry is written per record covered.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setAmendedValue("");
      setReason("");
      setBulkApply(false);
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-025"
        title="Attendance exception queue"
        description="Manage attendance exception queue with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/attendance" className={headerActionClass}>
            Accept proposal
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-025"
        description="Unpaired punches, missing days, device failures, inferred shifts, agent proposals. Pick an exception → read the punches behind it → accept the proposal or record your own resolution."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading attendance exceptions…"
        errorTitle="Attendance exceptions unavailable"
        emptyTitle="No attendance exceptions"
        emptyHint="Unpaired punches, missing days and device failures appear here as the time-office engine detects them. An empty queue means nothing is currently flagged in your scope."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search attendance exceptions"
              searchPlaceholder="Search exception, employee, kind…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Exception", "Employee", "Age", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>
                    <span className="block">{row.exception_reference}</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{row.kind || "—"}</span>
                  </Cell>
                  <Cell>{row.employee_name || row.employee_code || "—"}</Cell>
                  <Cell>{row.age_days === null ? "—" : `${row.age_days} days`}</Cell>
                  <Cell><StatusPill tone={exceptionTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
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
                  description={detail.record.exception_reference}
                  action={<StatusPill tone={exceptionTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_name ?? "—"}{detail.record.employee_code ? ` (${detail.record.employee_code})` : ""} · Date: {detail.record.date ?? "—"} · Kind: {detail.record.kind || "—"} · Age: {detail.record.age_days === null ? "—" : `${detail.record.age_days} day(s)`}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Detail: {detail.record.detail ?? "No detail recorded for this exception."}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Severity: {detail.record.severity ? picklistLabel("PL_SEVERITY", detail.record.severity) : "Not classified"}
                  {detail.record.resolution_action ? ` · Action taken: ${picklistLabel("PL_EXCEPTION_ACTION", detail.record.resolution_action)}` : ""}
                  {detail.record.amended_value ? ` · Amended to: ${detail.record.amended_value}` : ""}
                </p>
                {detail.record.proposal && (
                  <p className="mt-2 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    Agent proposal: {detail.record.proposal}
                  </p>
                )}
                <StateTimeline states={EXCEPTION_STATES} current={detail.record.status} />
                {detail.day && <LinkedDay day={detail.day} />}
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Punches on this day</p>
                  {detail.punches.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No punches were recorded for this employee and date — which is itself why this exception exists.
                    </p>
                  ) : (
                    <ol className="mt-2 space-y-1.5">
                      {detail.punches.slice(0, 12).map((punch, index) => (
                        <li
                          key={str(punch.id, String(index))}
                          className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 rounded-xl border border-border/60 px-3 py-2 text-xs"
                        >
                          <span className="min-w-0 break-words font-semibold text-foreground">
                            {str(punch.time, str(punch.punch_time, "—"))} · {stateLabel(str(punch.direction, "unknown"))}
                          </span>
                          <span className="min-w-0 break-words text-left text-muted-foreground sm:text-right">
                            {str(punch.device, "No device")} · {str(punch.event_id, str(punch.event_reference, "—"))}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <AuditTrail events={detail.auditTrail} />
                <ActionPanel title="Controlled actions">
                  {detail.record.status !== "open" && detail.record.status !== "proposed" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      This exception is {stateLabel(detail.record.status).toLowerCase()}. No further action is open on it.
                    </p>
                  ) : (
                    <>
                      <ActionField label="Action">
                        <select
                          value={resolutionAction}
                          onChange={(event) => setResolutionAction(event.target.value)}
                          className={actionInputClass}
                        >
                          {EXCEPTION_ACTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </ActionField>
                      {resolutionAction === "amend" && (
                        <ActionField label="Amended value">
                          <input
                            value={amendedValue}
                            onChange={(event) => setAmendedValue(event.target.value)}
                            placeholder="The corrected value for this exception type"
                            className={actionInputClass}
                          />
                        </ActionField>
                      )}
                      <ActionField label="Reason (audited, at least 10 characters)">
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Why is this exception being actioned?"
                          className={actionInputClass}
                        />
                      </ActionField>
                      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border"
                          checked={bulkApply}
                          onChange={(event) => setBulkApply(event.target.checked)}
                        />
                        Apply to all {sameTypeOpenIds.length} open {stateLabel(detail.record.kind).toLowerCase()} exception(s) with this same reason
                      </label>
                      <span className="mt-2 flex flex-wrap gap-2">
                        {detail.record.status === "proposed" && (
                          <ActionButton onClick={() => void accept()} busy={busy}>Accept proposal</ActionButton>
                        )}
                        <ActionButton onClick={() => void resolve()} busy={busy}>Resolve exception</ActionButton>
                      </span>
                    </>
                  )}
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

/* ---------------- Attendance recompute monitor (SCR-026) ---------------- */

type RecomputeRow = {
  id: string;
  job_reference: string;
  scope: string;
  scope_employee_code: string | null;
  from_date: string | null;
  to_date: string | null;
  delta_minutes: number | null;
  delta_label: string;
  queued_at: string | null;
  completed_at: string | null;
  status: "queued" | "running" | "completed" | "blocked";
};

const RECOMPUTE_STATES = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
] as const;

function recomputeTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "queued") return "warning";
  if (status === "blocked") return "danger";
  if (status === "running") return "info";
  return "neutral";
}

export function AttendanceRecomputeMonitorPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [employeeScope, setEmployeeScope] = useState("");
  const [fromDate, setFromDate] = useState(monthAgoISO());
  const [toDate, setToDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const peopleState = useRegisterResource("/api/v1/people?search=&page=1&pageSize=100");
  const people = useMemo(
    () => listFromEnvelope(peopleState.data).filter((row) => str(row.id)),
    [peopleState.data],
  );
  const queueState = useRegisterResource(
    `/api/v1/attendance/recompute/register?search=${encodeURIComponent(search)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as RecomputeRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/attendance/recompute/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as RecomputeRow,
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  const scopeId = employeeScope || str(people[0]?.id);

  async function queueRecompute() {
    if (!scopeId) {
      setNotice({ text: "Choose the employee whose days should be recomputed.", tone: "error" });
      return;
    }
    if (!fromDate || !toDate) {
      setNotice({ text: "A from date and a to date are required.", tone: "error" });
      return;
    }
    if (fromDate > toDate) {
      setNotice({ text: "The from date must not be after the to date.", tone: "error" });
      return;
    }
    if (reason.trim().length < 3) {
      setNotice({ text: "A reason (min 3 characters) is required to queue a recompute.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction("/api/v1/attendance/recompute/register", {
      employeeScope: scopeId,
      fromDate,
      toDate,
      reason: reason.trim(),
    });
    setNotice(outcome.ok
      ? { text: "Recompute queued. It appears in this monitor with its own audit trail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setReason("");
      setFormOpen(false);
      queueState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-026"
        title="Attendance recompute monitor"
        description="Manage attendance recompute monitor with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <button type="button" onClick={() => setFormOpen((open) => !open)} className={headerActionClass}>
            Queue recompute
          </button>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-026"
        description="Queue depth, running jobs, deltas produced, locked-period collisions. Queue a recompute for one person and range → watch it move through running to completed → read the delta it produced."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      {formOpen && (
        <Surface className="mb-6">
          <SectionHeading
            title="Queue a recompute"
            description="The engine recomputes the days in this range. A locked payroll period blocks the job rather than rewriting it."
          />
          <ActionPanel title="Recompute request">
            <ActionField label="Employee scope">
              <select
                value={scopeId}
                onChange={(event) => setEmployeeScope(event.target.value)}
                aria-label="Employee scope"
                className={actionInputClass}
              >
                {people.length === 0 && <option value="">No employees in your scope</option>}
                {people.map((row) => (
                  <option key={str(row.id)} value={str(row.id)}>
                    {str(row.firstName)} {str(row.lastName)} · {str(row.employeeCode)}
                  </option>
                ))}
              </select>
            </ActionField>
            <div className="grid gap-3 sm:grid-cols-2">
              <ActionField label="From date">
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={actionInputClass} />
              </ActionField>
              <ActionField label="To date">
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={actionInputClass} />
              </ActionField>
            </div>
            <ActionField label="Reason (audited)">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why are these days being recomputed?"
                className={actionInputClass}
              />
            </ActionField>
            <ActionButton onClick={() => void queueRecompute()} busy={busy}>Queue recompute</ActionButton>
          </ActionPanel>
        </Surface>
      )}

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading recompute jobs…"
        errorTitle="Recompute monitor unavailable"
        emptyTitle="No recompute jobs yet"
        emptyHint="A recompute is recorded here when one is queued from this console or by the time-office engine. Until then this monitor stays empty."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search recompute jobs"
              searchPlaceholder="Search job, scope, employee code…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Job", "Scope", "Delta", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.job_reference}</Cell>
                  <Cell>{row.scope_employee_code || row.scope || "—"}</Cell>
                  <Cell>{row.delta_label || "—"}</Cell>
                  <Cell><StatusPill tone={recomputeTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
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
                  description={detail.record.job_reference}
                  action={<StatusPill tone={recomputeTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Job: {detail.record.job_reference} · Scope: {detail.record.scope_employee_code || detail.record.scope || "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Range: {detail.record.from_date ?? "—"} to {detail.record.to_date ?? "—"} · Delta: {detail.record.delta_label || "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Queued at: {detail.record.queued_at ?? "—"} · Completed at: {detail.record.completed_at ?? "Not completed"}
                </p>
                <StateTimeline states={RECOMPUTE_STATES} current={detail.record.status} />
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

/* ---------------- Team history (SCR-027) ---------------- */

type TeamHistoryRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  present_days: number;
  absent_days: number;
  weekly_off_days: number;
  leave_days: number;
  overtime_minutes: number;
  overtime_label: string;
  gate_pass_minutes: number;
  status: "ready" | "scheduled" | "expired";
};

const TEAM_HISTORY_STATES = [
  { value: "ready", label: "Ready" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
] as const;

function historyTone(status: string): "success" | "warning" | "neutral" {
  if (status === "ready") return "success";
  if (status === "scheduled") return "warning";
  return "neutral";
}

export function TeamHistoryPage() {
  const [from, setFrom] = useState(monthAgoISO());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const queueState = useRegisterResource(
    `/api/v1/reports/team-history/register?${range}&search=${encodeURIComponent(search)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as TeamHistoryRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/reports/team-history/register/${encodeURIComponent(selected.id)}?${range}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as TeamHistoryRow,
      days: listOf(data.days),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  /** Exports exactly the rows on screen for the range that produced them. */
  function exportHistory() {
    if (queue.length === 0) {
      setNotice({ text: "There is nothing in the current view to export.", tone: "error" });
      return;
    }
    const csv = toCsv(
      ["Employee code", "Team member", "Department", "Present days", "Absent days", "Weekly offs", "Leave days", "Overtime", "Overtime minutes", "Gate pass minutes", "Status"],
      queue.map((row) => [
        row.employee_code, row.employee_name, row.department,
        row.present_days, row.absent_days, row.weekly_off_days, row.leave_days,
        row.overtime_label, row.overtime_minutes, row.gate_pass_minutes, row.status,
      ]),
    );
    setNotice(
      downloadCsv(`team-history-${from}-to-${to}.csv`, csv)
        ? { text: `Exported ${queue.length} team member(s) for ${from} to ${to}.`, tone: "success" }
        : { text: "This history could not be exported in your browser.", tone: "error" },
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-027"
        title="Team history"
        description="Manage team history with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <span className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { queueState.refresh(); detailState.refresh(); }}
              className={headerActionClass}
            >
              Run report
            </button>
            <button type="button" onClick={exportHistory} className={headerSecondaryClass}>
              Export history
            </button>
          </span>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-027"
        description="Date range, one member or whole team: attendance, leave, OT, gate pass, late. Set the range → run the report → open a team member for the day-by-day breakdown behind their counts."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <Surface className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold">
            From
            <input type="date" value={from} onChange={(event) => { setSelectedId(""); setFrom(event.target.value); }} className={actionInputClass} />
          </label>
          <label className="block text-xs font-semibold">
            To
            <input type="date" value={to} onChange={(event) => { setSelectedId(""); setTo(event.target.value); }} className={actionInputClass} />
          </label>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Counts are computed by the server for this range. Nothing on this screen is derived in the browser.
        </p>
      </Surface>

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading team history…"
        errorTitle="Team history unavailable"
        emptyTitle="No team history in this range"
        emptyHint="Widen the date range or clear the search. Members appear here once attendance days exist for them inside the range."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search team history"
              searchPlaceholder="Search team member, code, department…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Team member", "Attendance", "Leave", "Overtime"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_name || row.employee_code || "—"}</Cell>
                  <Cell>{`${num(row.present_days)} present · ${num(row.absent_days)} absent`}</Cell>
                  <Cell>{`${num(row.leave_days)} days`}</Cell>
                  <Cell>{row.overtime_label || "—"}</Cell>
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
                  description={detail.record.employee_name ?? detail.record.employee_code ?? "Team member"}
                  action={<StatusPill tone={historyTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_name ?? "—"}{detail.record.employee_code ? ` (${detail.record.employee_code})` : ""} · Department: {detail.record.department ?? "—"} · Range: {from} to {to}
                </p>
                <FactList
                  title="Counts in this range"
                  facts={[
                    ["Present days", String(num(detail.record.present_days))],
                    ["Absent days", String(num(detail.record.absent_days))],
                    ["Weekly offs", String(num(detail.record.weekly_off_days))],
                    ["Leave days", String(num(detail.record.leave_days))],
                    ["Overtime", `${detail.record.overtime_label || "—"} (${num(detail.record.overtime_minutes)} min)`],
                    ["Gate pass", `${num(detail.record.gate_pass_minutes)} min`],
                  ]}
                />
                <StateTimeline states={TEAM_HISTORY_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Day-by-day breakdown</p>
                  {detail.days.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No attendance days exist for this member inside the selected range.
                    </p>
                  ) : (
                    <ol className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                      {detail.days.map((day, index) => (
                        <li
                          key={str(day.id, String(index))}
                          className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 rounded-xl border border-border/60 px-3 py-2 text-xs"
                        >
                          <span className="min-w-0 shrink-0 break-words font-semibold text-foreground">{str(day.date, "—")}</span>
                          <span className="min-w-0 break-words text-left text-muted-foreground sm:text-right">
                            {stateLabel(str(day.status, "unknown"))} · {str(day.day_type, "—")} · {str(day.shift_applied, "No shift")} · OT {str(day.overtime_label, "—")}
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
