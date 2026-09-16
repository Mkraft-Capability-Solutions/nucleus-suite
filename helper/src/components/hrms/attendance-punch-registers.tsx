"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isAdminPrincipal } from "@/lib/cockpit-catalog";
import { picklistLabel, picklists } from "@/lib/picklists";
import { SectionHeading, StatusPill, Surface } from "./page-primitives";
import { useWorkspace } from "./workspace-provider";
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Employee label for the people selector; never invents a name. */
function personLabel(row: Record<string, unknown>): string {
  const name = `${str(row.firstName)} ${str(row.lastName)}`.trim();
  const code = str(row.employeeCode, "—");
  return name ? `${code} · ${name}` : code;
}

/* ---------------- Check in and check out (SCR-020) ---------------- */

type PunchRow = {
  id: string;
  event_reference: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  direction: "in" | "out" | "unknown";
  punch_time: string | null;
  punch_date: string | null;
  source: string | null;
  device: string | null;
  segment: string | null;
  note: string | null;
  geo: string | null;
  geofence_result: string | null;
  selfie_ref: string | null;
  job_code: string | null;
  offline_queued: boolean;
  status: "queued_offline" | "ingested" | "computed" | "rejected";
};

const PUNCH_STATES = [
  { value: "queued_offline", label: "Queued offline" },
  { value: "ingested", label: "Ingested" },
  { value: "computed", label: "Computed" },
  { value: "rejected", label: "Rejected" },
] as const;

function punchTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "computed") return "success";
  if (status === "queued_offline") return "warning";
  if (status === "rejected") return "danger";
  if (status === "ingested") return "info";
  return "neutral";
}

export function CheckInOutPage() {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const queueState = useRegisterResource(
    `/api/v1/attendance/punches/register?search=${encodeURIComponent(search)}&date=${encodeURIComponent(date)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as PunchRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/attendance/punches/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    const day = asRecord(data.day);
    return {
      record: data as unknown as PunchRow,
      day: str(day.id) ? day : null,
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-020"
        title="Check in and check out"
        description="Manage check in and check out with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link
            href="/attendance"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Record punch
          </Link>
        }
      />
      <RegisterNotice notice={null} />
      <ProcessGuide
        screenId="SCR-020"
        description="Punch with geofence and optional selfie. Each event arrives here with its source and device, is ingested, then computed into the attendance day it belongs to."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <Surface className="mb-6">
        <div className="w-full max-w-xs">
          <ActionField label="Punch date">
            <input
              type="date"
              value={date}
              onChange={(event) => { setSelectedId(""); setDate(event.target.value); }}
              className={actionInputClass}
            />
          </ActionField>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Leave the date blank to see every punch in your permitted scope.
          </p>
        </div>
      </Surface>

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading punch events…"
        errorTitle="Punch events unavailable"
        emptyTitle="No punch events"
        emptyHint="Check in from the Attendance module or a registered device. Every punch arrives here with its source, device and computed day."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search punch events"
              searchPlaceholder="Search employee, code, punch reference…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Employee", "Punch", "Source", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_code ?? "—"} · {row.employee_name ?? "Unnamed"}</Cell>
                  <Cell>
                    <span className="block font-semibold text-foreground">{row.event_reference || "—"}</span>
                    <span className="mt-0.5 block">
                      {str(row.direction, "unknown").toUpperCase()} · {row.punch_time ?? "—"} · {row.punch_date ?? "—"}
                    </span>
                  </Cell>
                  <Cell>{row.source ?? "—"}</Cell>
                  <Cell><StatusPill tone={punchTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
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
                  description={detail.record.event_reference || detail.record.id}
                  action={<StatusPill tone={punchTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_code ?? "—"} · {detail.record.employee_name ?? "Unnamed"} · Punch reference: {detail.record.event_reference || "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Direction: {str(detail.record.direction, "unknown").toUpperCase()} · Time: {detail.record.punch_time ?? "—"} · Date: {detail.record.punch_date ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Source: {detail.record.source ?? "—"} · Device: {detail.record.device ?? "—"} · Segment: {detail.record.segment ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Location: {detail.record.geo ?? "Not captured"} · Geofence: {detail.record.geofence_result ? picklistLabel("PL_GEOFENCE_RESULT", detail.record.geofence_result) : "Not evaluated"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Selfie: {detail.record.selfie_ref ?? "Not captured"} · Job code: {detail.record.job_code ?? "Not costed"} · {detail.record.offline_queued ? "Queued offline, synced later" : "Captured online"}
                </p>
                {detail.record.note && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Note: {detail.record.note}</p>
                )}
                <StateTimeline states={PUNCH_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Attendance day</p>
                  {detail.day === null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      This punch has not been computed into an attendance day yet.
                    </p>
                  ) : (
                    <p className="mt-1 rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{str(detail.day.date, "—")}</span>
                      {" · "}Net hours {str(detail.day.net_hours, "—")} · Overtime {str(detail.day.overtime_hours, "—")} · {stateLabel(str(detail.day.status))}
                    </p>
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

/* ---------------- My attendance history (SCR-021) ---------------- */

type AttendanceDayRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  day_type: string | null;
  shift_code: string | null;
  net_minutes: number;
  net_hours: string;
  overtime_minutes: number;
  overtime_hours: string;
  first_in: string | null;
  last_out: string | null;
  status: "computed" | "exception" | "locked";
};

const ATTENDANCE_DAY_STATES = [
  { value: "computed", label: "Computed" },
  { value: "exception", label: "Exception" },
  { value: "locked", label: "Locked" },
] as const;

function dayTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "computed") return "success";
  if (status === "exception") return "warning";
  if (status === "locked") return "info";
  return "neutral";
}

/** Renders the punch list carried on an attendance day detail. */
function PunchList({ punches }: { punches: Record<string, unknown>[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-foreground">Punches ({punches.length})</p>
      {punches.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No punches are attached to this day.</p>
      ) : (
        <ol className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          {punches.map((entry, index) => (
            <li key={str(entry.id, String(index))} className="min-w-0 break-words rounded-xl border border-border/60 px-3 py-2 text-xs">
              <span className="font-semibold">
                {str(entry.direction, "unknown").toUpperCase()} · {str(entry.punch_time, "—")}
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                {str(entry.event_reference, "—")} · {str(entry.source, "Source not recorded")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function MyAttendanceHistoryPage() {
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [fromDate, setFromDate] = useState(() => daysAgoISO(30));
  const [toDate, setToDate] = useState(() => todayISO());
  const [query, setQuery] = useState(() => ({ employeeId: "", from: daysAgoISO(30), to: todayISO() }));
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  // Whether this reader has anybody to pick BETWEEN. The server narrows an
  // attendance read to the caller's own hierarchy (`resolveAttendanceScope`), so
  // for an employee who is nobody's manager the only day rows that exist are
  // their own: a directory picker there offers a choice that cannot change the
  // answer, and fetching the directory to populate it pulls a list of colleagues
  // this screen has no use for. The rule mirrors the seeded roles — the manager,
  // HR and time-office roles that hold `attendance.write`, plus any
  // administrative principal, keep the picker; the standard employee, who holds
  // only `attendance.read`, does not. This is presentation, not protection:
  // what the caller may read is decided by the attendance service either way.
  const { workspace } = useWorkspace();
  const permissions = workspace?.context?.permissions ?? [];
  const roles = workspace?.context?.roles ?? [];
  const canPickEmployee = isAdminPrincipal(permissions, roles) || permissions.includes("attendance.write");

  const peopleState = useRegisterResource(canPickEmployee ? "/api/v1/people?search=&page=1&pageSize=100" : "");
  const people = useMemo(() => listFromEnvelope(peopleState.data).filter((row) => str(row.id)), [peopleState.data]);

  const queueState = useRegisterResource(
    `/api/v1/attendance/days/register?employeeId=${encodeURIComponent(query.employeeId)}&from=${encodeURIComponent(query.from)}&to=${encodeURIComponent(query.to)}&search=${encodeURIComponent(search)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as AttendanceDayRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/attendance/days/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as AttendanceDayRow,
      punches: listOf(data.punches),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  function runQuery() {
    setSelectedId("");
    setNotice(null);
    setQuery({ employeeId, from: fromDate, to: toDate });
    queueState.refresh();
  }

  function exportHistory() {
    if (queue.length === 0) {
      setNotice({ text: "There is nothing in the current view to export.", tone: "error" });
      return;
    }
    const csv = toCsv(
      ["Employee code", "Employee", "Date", "Day type", "Shift", "Net hours", "Overtime", "First in", "Last out", "Status"],
      queue.map((row) => [
        row.employee_code, row.employee_name, row.date, row.day_type, row.shift_code,
        row.net_hours, row.overtime_hours, row.first_in, row.last_out, row.status,
      ]),
    );
    setNotice(
      downloadCsv(`attendance-history-${todayISO()}.csv`, csv)
        ? { text: `Exported ${queue.length} attendance day(s) from the current view.`, tone: "success" }
        : { text: "This history could not be exported in your browser.", tone: "error" },
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-021"
        title="My attendance history"
        description="Manage my attendance history with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <>
            <button
              type="button"
              onClick={runQuery}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              View history
            </button>
            <button
              type="button"
              onClick={exportHistory}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50"
            >
              Export
            </button>
          </>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-021"
        description="Day-by-day status, net hours, late allowance remaining, OT, gate-pass balance."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <Surface className="mb-6">
        {/* Filter bar: one control per line on a phone, two at `sm`, three only
            once there is desktop room for a readable date field. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {canPickEmployee && (
            <ActionField label="Employee">
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className={actionInputClass}
              >
                <option value="">All employees in scope</option>
                {people.map((person) => (
                  <option key={str(person.id)} value={str(person.id)}>
                    {personLabel(person)}
                  </option>
                ))}
              </select>
            </ActionField>
          )}
          <ActionField label="From">
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={actionInputClass} />
          </ActionField>
          <ActionField label="To">
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={actionInputClass} />
          </ActionField>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {!canPickEmployee
            ? "Defaults to the last 30 days. This history is your own; press View history to re-run the query."
            : peopleState.loading
              ? "Loading the employee list…"
              : peopleState.error
                ? "The employee list could not be loaded; the range still applies to your own scope."
                : "Defaults to the last 30 days. Choose an employee and press View history to re-run the query."}
        </p>
      </Surface>

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading attendance history…"
        errorTitle="Attendance history unavailable"
        emptyTitle="No attendance days in this range"
        emptyHint="Widen the date range or pick another employee. Days appear here once the attendance engine computes them from punches."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search attendance history"
              searchPlaceholder="Search date, shift, day type…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Date", "Net hours", "Overtime", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.date ?? "—"}</Cell>
                  <Cell>{row.net_hours || "—"}</Cell>
                  <Cell>{row.overtime_hours || "—"}</Cell>
                  <Cell><StatusPill tone={dayTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
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
                  description={detail.record.date ?? detail.record.id}
                  action={<StatusPill tone={dayTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_code ?? "—"} · {detail.record.employee_name ?? "Unnamed"} · Date: {detail.record.date ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Shift: {detail.record.shift_code ?? "—"} · Day type: {detail.record.day_type ?? "—"} · Net hours: {detail.record.net_hours || "—"} · Overtime: {detail.record.overtime_hours || "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  First in: {detail.record.first_in ?? "—"} · Last out: {detail.record.last_out ?? "—"}
                </p>
                <StateTimeline states={ATTENDANCE_DAY_STATES} current={detail.record.status} />
                <PunchList punches={detail.punches} />
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

/* ---------------- Attendance day detail (SCR-022) ---------------- */

const DAY_DETAIL_STATES = [
  { value: "computed", label: "Computed" },
  { value: "exception", label: "Exception" },
  { value: "locked", label: "Locked" },
] as const;

export function AttendanceDayDetailPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [overrideShift, setOverrideShift] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const queueState = useRegisterResource(
    `/api/v1/attendance/days/register?search=${encodeURIComponent(search)}`,
  );
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as AttendanceDayRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/attendance/days/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as AttendanceDayRow,
      punches: listOf(data.punches),
      regularizations: listOf(data.regularizations),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  /** An override changes the shift, the disposition, or both, and always carries a reason. */
  async function applyOverride() {
    if (!selected) return;
    if (overrideShift.trim() === "" && overrideStatus === "") {
      setNotice({ text: "An override must change the shift, the status, or both.", tone: "error" });
      return;
    }
    if (overrideReason.trim().length < 10) {
      setNotice({ text: "An override reason of at least 10 characters is required.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(
      `/api/v1/attendance/days/register/${encodeURIComponent(selected.id)}/override`,
      {
        ...(overrideShift.trim() ? { overrideShiftCode: overrideShift.trim() } : {}),
        ...(overrideStatus ? { overrideStatus } : {}),
        reason: overrideReason.trim(),
      },
    );
    setNotice(outcome.ok
      ? { text: "Override recorded with its reason, and a recompute queued for the day.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setOverrideShift("");
      setOverrideStatus("");
      setOverrideReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-022"
        title="Attendance day detail"
        description="Manage attendance day detail with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link
            href="/attendance"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Regularise day
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-022"
        description="Segments, breaks, shift assigned vs applied, rules applied, provenance."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading attendance days…"
        errorTitle="Attendance days unavailable"
        emptyTitle="No attendance days computed"
        emptyHint="Days appear here as the attendance engine computes punches into segments, net hours and overtime for your permitted scope."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search attendance days"
              searchPlaceholder="Search employee, code, date, shift…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Employee", "Date", "Net hours", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_code ?? "—"} · {row.employee_name ?? "Unnamed"}</Cell>
                  <Cell>{row.date ?? "—"}</Cell>
                  <Cell>{row.net_hours || "—"}</Cell>
                  <Cell><StatusPill tone={dayTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
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
                  description={`${detail.record.employee_code ?? detail.record.id} · ${detail.record.date ?? "—"}`}
                  action={<StatusPill tone={dayTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_code ?? "—"} · {detail.record.employee_name ?? "Unnamed"} · Date: {detail.record.date ?? "—"} · Shift: {detail.record.shift_code ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Day type: {detail.record.day_type ?? "—"} · Net hours: {detail.record.net_hours || "—"} · Overtime: {detail.record.overtime_hours || "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  First in: {detail.record.first_in ?? "—"} · Last out: {detail.record.last_out ?? "—"}
                </p>
                <StateTimeline states={DAY_DETAIL_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Punch segments ({detail.punches.length})</p>
                  {detail.punches.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No punch segments were computed for this day.</p>
                  ) : (
                    <ol className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                      {detail.punches.map((entry, index) => (
                        <li key={str(entry.id, String(index))} className="min-w-0 break-words rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span className="font-semibold">
                            {str(entry.direction, "unknown").toUpperCase()} · {str(entry.punch_time, "—")}
                          </span>
                          <span className="mt-0.5 block text-muted-foreground">
                            {str(entry.event_reference, "—")} · Segment {str(entry.segment, "—")} · {str(entry.source, "Source not recorded")}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Regularisations ({detail.regularizations.length})</p>
                  {detail.regularizations.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">This day has not been regularised.</p>
                  ) : (
                    <ol className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                      {detail.regularizations.map((entry, index) => (
                        <li key={str(entry.id, String(index))} className="min-w-0 break-words rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span className="font-semibold">{stateLabel(str(entry.status, "recorded"))}</span>
                          <span className="mt-0.5 block text-muted-foreground">
                            {str(entry.reason, "No reason recorded")} · {str(entry.date, "—")}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <AuditTrail events={detail.auditTrail} />
                {detail.record.status === "locked" ? (
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    This day is locked. A locked period is corrected through arrears, not by an override.
                  </p>
                ) : (
                  <ActionPanel title="Override this day">
                    <ActionField label="Override shift (leave blank to keep)">
                      <input
                        value={overrideShift}
                        onChange={(event) => setOverrideShift(event.target.value)}
                        placeholder={detail.record.shift_code ?? "Shift code"}
                        className={actionInputClass}
                      />
                    </ActionField>
                    <ActionField label="Override status (leave blank to keep)">
                      <select
                        value={overrideStatus}
                        onChange={(event) => setOverrideStatus(event.target.value)}
                        className={actionInputClass}
                      >
                        <option value="">Keep the computed status</option>
                        {picklists.PL_ATTENDANCE_STATUS.values.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </ActionField>
                    <ActionField label="Override reason (audited, at least 10 characters)">
                      <input
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        placeholder="Why is the computed day being changed?"
                        className={actionInputClass}
                      />
                    </ActionField>
                    <ActionButton onClick={() => void applyOverride()} busy={busy}>Record override</ActionButton>
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

/* ---------------- Gate pass register (SCR-023) ---------------- */

type GatePassRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  minutes: number;
  from_time: string | null;
  to_time: string | null;
  /** The register projects the stored `type` key; this is the gate pass type. */
  type: string | null;
  reason: string | null;
  expected_return: string | null;
  actual_out_ts: string | null;
  actual_in_ts: string | null;
  decision_remarks: string | null;
  approver_code: string | null;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "credited";
  rejection_note: string | null;
};

const GATE_PASS_STATES = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "credited", label: "Credited" },
] as const;

function gatePassTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "approved" || status === "credited") return "success";
  if (status === "pending_approval") return "warning";
  if (status === "rejected") return "danger";
  if (status === "draft") return "info";
  return "neutral";
}

export function GatePassRegisterPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [scanOut, setScanOut] = useState("");
  const [scanIn, setScanIn] = useState("");

  const queueState = useRegisterResource(`/api/v1/gate-passes/register?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as GatePassRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/gate-passes/register/${encodeURIComponent(selected.id)}` : "",
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as GatePassRow,
      quota: asRecord(data.quota),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function decide(approve: boolean) {
    if (!selected) return;
    if (!approve && decisionRemarks.trim() === "") {
      setNotice({ text: "A rejected gate pass must carry its remarks.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/gate-passes/${encodeURIComponent(selected.id)}/decide`, {
      approve,
      ...(decisionRemarks.trim() ? { decisionRemarks: decisionRemarks.trim() } : {}),
    });
    setNotice(outcome.ok
      ? { text: approve ? "Gate pass approved. The minutes are counted against the monthly ceiling." : "Gate pass rejected. The rejection reason is visible in the queue.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setDecisionRemarks("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  /** The gate scans are local wall-clock values; they are sent with the browser's offset. */
  async function recordScan() {
    if (!selected) return;
    const toOffsetIso = (value: string) => (value === "" ? undefined : new Date(value).toISOString());
    const actualOut = toOffsetIso(scanOut);
    const actualIn = toOffsetIso(scanIn);
    if (actualOut === undefined && actualIn === undefined) {
      setNotice({ text: "A gate scan must record an out or an in timestamp.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/gate-passes/${encodeURIComponent(selected.id)}/scan`, {
      ...(actualOut ? { actualOut } : {}),
      ...(actualIn ? { actualIn } : {}),
    });
    setNotice(outcome.ok
      ? { text: "Gate scan recorded against the pass.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setScanOut("");
      setScanIn("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  const ceilingMinutes = detail ? detail.quota.ceilingMinutes : null;
  const hasPolicy = typeof ceilingMinutes === "number";
  const instanceLimit = detail ? detail.quota.instanceLimit : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · SCR-023"
        title="Gate pass register"
        description="Manage gate passes with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link
            href="/attendance"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Request gate pass
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-023"
        description="Request and approve gate passes; shows minutes and instances used."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading gate passes…"
        errorTitle="Gate passes unavailable"
        emptyTitle="No gate passes"
        emptyHint="Request a gate pass from the Attendance module. Each request arrives here with the minutes and instances it consumes."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search gate passes"
              searchPlaceholder="Search employee, code, gate pass type…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Employee", "Date", "Minutes", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_code ?? "—"} · {row.employee_name ?? "Unnamed"}</Cell>
                  <Cell>{row.date ?? "—"}</Cell>
                  <Cell>{row.minutes} min</Cell>
                  <Cell>
                    <StatusPill tone={gatePassTone(row.status)} dot>{stateLabel(row.status)}</StatusPill>
                    {row.rejection_note && (
                      <span className="mt-1 block leading-4">{row.rejection_note}</span>
                    )}
                  </Cell>
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
                  description={`${detail.record.employee_code ?? detail.record.id} · ${detail.record.date ?? "—"}`}
                  action={<StatusPill tone={gatePassTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee: {detail.record.employee_code ?? "—"} · {detail.record.employee_name ?? "Unnamed"} · Date: {detail.record.date ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  From: {detail.record.from_time ?? "—"} · To: {detail.record.to_time ?? "—"} · {detail.record.minutes} minute(s) · Type: {detail.record.type ? picklistLabel("PL_GATE_PASS_TYPE", detail.record.type) : "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Approver: {detail.record.approver_code ?? "Not assigned"} · Reason: {detail.record.reason ?? "No reason recorded"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Expected return: {detail.record.expected_return ?? "Same as the to time"} · Gate scans: out {detail.record.actual_out_ts ?? "not scanned"}, in {detail.record.actual_in_ts ?? "not scanned"}
                </p>
                {detail.record.decision_remarks && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Decision remarks: {detail.record.decision_remarks}
                  </p>
                )}
                {detail.record.rejection_note && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Rejection note: {detail.record.rejection_note}
                  </p>
                )}
                <StateTimeline states={GATE_PASS_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">
                    Gate-pass quota{str(detail.quota.period) ? ` · ${str(detail.quota.period)}` : ""}
                  </p>
                  {!hasPolicy ? (
                    <p className="mt-1 text-xs text-muted-foreground">No gate-pass policy configured</p>
                  ) : (
                    <p className="mt-1 rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                      Minutes used: <span className="font-semibold text-foreground">{num(detail.quota.usedMinutes)} / {num(ceilingMinutes)}</span>
                      {" · "}Instances used:{" "}
                      <span className="font-semibold text-foreground">
                        {num(detail.quota.instancesUsed)} / {typeof instanceLimit === "number" ? instanceLimit : "—"}
                      </span>
                    </p>
                  )}
                </div>
                <AuditTrail events={detail.auditTrail} />
                {(detail.record.status === "pending_approval" || detail.record.status === "draft") && (
                  <ActionPanel title="Record a decision">
                    <ActionField label="Decision remarks (required to reject)">
                      <input
                        value={decisionRemarks}
                        onChange={(event) => setDecisionRemarks(event.target.value)}
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
                {detail.record.status === "approved" && (
                  <ActionPanel title="Record the gate scan">
                    <ActionField label="Actual out">
                      <input
                        type="datetime-local"
                        value={scanOut}
                        onChange={(event) => setScanOut(event.target.value)}
                        className={actionInputClass}
                      />
                    </ActionField>
                    <ActionField label="Actual in">
                      <input
                        type="datetime-local"
                        value={scanIn}
                        onChange={(event) => setScanIn(event.target.value)}
                        className={actionInputClass}
                      />
                    </ActionField>
                    <ActionButton onClick={() => void recordScan()} busy={busy}>Record scan</ActionButton>
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
