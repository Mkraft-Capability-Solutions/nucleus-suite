"use client";

import { useMemo, useState } from "react";
import { SectionHeading, StatusPill, Surface } from "./page-primitives";
import {
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
  actionInputClass,
  downloadCsv,
  listFromEnvelope,
  num,
  recordFromEnvelope,
  str,
  toCsv,
  useRegisterResource,
  useSelection,
  type Notice,
} from "./register-primitives";

/* ---------------- Break register (RP-01 / F-ATT-03) ---------------- */

type BreakRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  attendance_date: string | null;
  shift_code: string | null;
  break_seq: number;
  break_start_time: string | null;
  break_end_time: string | null;
  break_minutes: number;
  break_label: string;
  break_type: string;
  deducted: boolean;
};

const headerActionClass =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90";

const headerSecondaryClass =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50";

function monthStartISO(): string {
  const today = new Date();
  return `${today.toISOString().slice(0, 7)}-01`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Every intermediate break by employee and date, with its start, end, duration and
 * type. RL-03 reports breaks rather than deducting them, so the register says so on
 * the row instead of leaving the reader to assume.
 */
export function BreakRegisterPage() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [breakType, setBreakType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&breakType=${encodeURIComponent(breakType)}&search=${encodeURIComponent(search)}`;
  const queueState = useRegisterResource(`/api/v1/reports/break-register?${query}`);
  const typesState = useRegisterResource("/api/v1/reports/break-register/types");
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as BreakRow[], [queueState.data]);
  const breakTypes = useMemo(() => {
    const values = recordFromEnvelope(typesState.data).values;
    return Array.isArray(values) ? values.map((value) => String(value)) : [];
  }, [typesState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(selected ? `/api/v1/reports/break-register/${encodeURIComponent(selected.id)}` : "");
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return { record: data as unknown as BreakRow, session: data.session ? (data.session as Record<string, unknown>) : null };
  }, [detailState.data]);

  const totalMinutes = queue.reduce((total, row) => total + num(row.break_minutes), 0);

  /** Exports exactly the rows on screen for the range that produced them. */
  function exportBreaks() {
    if (queue.length === 0) {
      setNotice({ text: "There is nothing in the current view to export.", tone: "error" });
      return;
    }
    const csv = toCsv(
      ["Employee code", "Employee", "Department", "Attendance date", "Shift", "Break", "Start", "End", "Minutes", "Break type", "Deducted"],
      queue.map((row) => [
        row.employee_code, row.employee_name, row.department, row.attendance_date, row.shift_code,
        row.break_seq, row.break_start_time, row.break_end_time, row.break_minutes, row.break_type,
        row.deducted ? "Yes" : "No",
      ]),
    );
    setNotice(
      downloadCsv(`break-register-${from}-to-${to}.csv`, csv)
        ? { text: `Exported ${queue.length} break(s) for ${from} to ${to}.`, tone: "success" }
        : { text: "This register could not be exported in your browser.", tone: "error" },
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <RegisterIntro
        eyebrow="Attendance · RP-01"
        title="Break register"
        description="Every gap between an out punch and the following in punch inside a session, with its start, end and duration."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { queueState.refresh(); detailState.refresh(); }} className={headerActionClass}>
              Run register
            </button>
            <button type="button" onClick={exportBreaks} className={headerSecondaryClass}>
              Export breaks
            </button>
          </span>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="F-ATT-03"
        description="Breaks are derived when the attendance day is computed, never typed. Set the range → run the register → open a row for the session it was taken inside. Breaks are reported, not deducted from paid hours."
      />
      <ScopeBar href="/attendance" label="Open attendance" />

      <Surface className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold">
            From
            <input type="date" value={from} onChange={(event) => { setSelectedId(""); setFrom(event.target.value); }} className={actionInputClass} />
          </label>
          <label className="block text-xs font-semibold">
            To
            <input type="date" value={to} onChange={(event) => { setSelectedId(""); setTo(event.target.value); }} className={actionInputClass} />
          </label>
          <label className="block text-xs font-semibold">
            Break type
            <select value={breakType} onChange={(event) => { setSelectedId(""); setBreakType(event.target.value); }} className={actionInputClass}>
              <option value="">All break types</option>
              {breakTypes.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {queue.length} break(s) totalling {totalMinutes} minute(s) in this range. Break minutes are reported and are not deducted from paid hours.
        </p>
      </Surface>

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading breaks…"
        errorTitle="Break register unavailable"
        emptyTitle="No breaks in this range"
        emptyHint="Breaks appear once an attendance day with an intermediate out/in pair has been computed. Widen the range or recompute the day."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search breaks"
              searchPlaceholder="Search employee, code, department, break type…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Employee", "Date", "Break", "Duration"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_name || row.employee_code || "—"}</Cell>
                  <Cell>{row.attendance_date ?? "—"}</Cell>
                  <Cell>{`${str(row.break_start_time, "—")} → ${str(row.break_end_time, "—")}`}</Cell>
                  <Cell>{`${row.break_label} · ${row.break_type}`}</Cell>
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
                  title="Break detail"
                  description={detail.record.employee_name ?? detail.record.employee_code ?? "Employee"}
                  action={<StatusPill tone={detail.record.deducted ? "warning" : "success"} dot>{detail.record.deducted ? "Deducted" : "Reported"}</StatusPill>}
                />
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <Fact label="Attendance date" value={str(detail.record.attendance_date, "—")} />
                  <Fact label="Break sequence" value={String(num(detail.record.break_seq))} />
                  <Fact label="Break start" value={str(detail.record.break_start_time, "—")} />
                  <Fact label="Break end" value={str(detail.record.break_end_time, "—")} />
                  <Fact label="Duration" value={`${detail.record.break_label} (${num(detail.record.break_minutes)} min)`} />
                  <Fact label="Break type" value={str(detail.record.break_type, "Unclassified")} />
                </dl>
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Session this break was taken inside</p>
                  {!detail.session ? (
                    <p className="mt-1 text-xs text-muted-foreground">The session record behind this break is no longer available.</p>
                  ) : (
                    <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <Fact label="Session date" value={str(detail.session.session_date, "—")} />
                      <Fact label="Shift" value={str(detail.session.shift_code, "—")} />
                      <Fact label="First in" value={str(detail.session.first_in, "—")} />
                      <Fact label="Last out" value={str(detail.session.last_out, "—")} />
                      <Fact label="Gross minutes" value={String(num(detail.session.gross_minutes))} />
                      <Fact label="Break minutes" value={String(num(detail.session.break_minutes))} />
                    </dl>
                  )}
                </div>
                <AuditTrail events={[]} />
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
