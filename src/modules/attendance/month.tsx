"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Lock, LockOpen, RefreshCw, CheckCircle2, UserCheck } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, Details, Drawer, EmptyState, ErrorState, IconButton, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { recomputeDay, transitionDay, useDayTrace, useDays, type AttendanceDay } from "./data";
import { DAY_META, attendanceRate, calendarWeeks, countDays, dayKind, dayLabel, hm, hoursLabel, isoDay, monthLabel, monthOf, monthRange, shiftMonth, type DayKind, type Month } from "./format";
import { StatStrip, useNotify } from "./shared";
import styles from "./Attendance.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VIEW_KEY = "nucleus_attendance_month_view";

const KIND_CLASS: Record<DayKind, string> = {
  present: styles.kindPresent, half_day: styles.kindHalf, absent: styles.kindAbsent, leave: styles.kindLeave,
  holiday: styles.kindHoliday, weekly_off: styles.kindOff, pending: styles.kindPending, other: styles.kindOther,
};

/* ------------------------------------------------------------------ */
/* Month: navigation, summary, calendar or list                        */
/* ------------------------------------------------------------------ */

export function MonthView({ employeeId, canDecide, canRequest, onRequestRegularisation, initialMonth, compact = false }: {
  employeeId: string;
  canDecide: boolean;
  canRequest: boolean;
  onRequestRegularisation?: (date: string) => void;
  initialMonth?: Month;
  /** Inside a drawer: no list/calendar switch, smaller summary. */
  compact?: boolean;
}) {
  const today = isoDay(new Date());
  const current = monthOf(new Date());
  const [month, setMonth] = useState<Month>(initialMonth ?? current);
  const [view, setViewState] = useState<"calendar" | "list">(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(VIEW_KEY) === "list" ? "list" : "calendar"; } catch { return "calendar"; }
  });
  const [openDay, setOpenDay] = useState<AttendanceDay | null>(null);
  const range = monthRange(month);
  const days = useDays(employeeId, range.from, range.to);
  const rows = days.data ?? [];
  const byDate = new Map<string, AttendanceDay>(rows.map((day) => [day.work_date.slice(0, 10), day] as const));
  const counts = countDays(rows.map((day) => day.status));
  const rate = attendanceRate(counts);
  const productive = rows.reduce((total, day) => total + (day.productive_minutes ?? 0), 0);
  const overtime = rows.reduce((total, day) => total + (day.payable_ot_minutes ?? 0), 0);
  const isCurrent = month.year === current.year && month.month === current.month;
  const setView = (next: "calendar" | "list") => { setViewState(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* storage blocked */ } };
  const shownView = compact ? "calendar" : view;

  return (
    <div className={styles.month}>
      <div className={styles.monthBar}>
        <div className={styles.monthNav}>
          <IconButton label="Previous month" icon={ChevronLeft} variant="ghost" onClick={() => setMonth((value) => shiftMonth(value, -1))} />
          <h3 className={styles.monthTitle} aria-live="polite">{monthLabel(month)}</h3>
          <IconButton label="Next month" icon={ChevronRight} variant="ghost" onClick={() => setMonth((value) => shiftMonth(value, 1))} disabled={isCurrent} />
          {!isCurrent && <Button size="sm" variant="ghost" onClick={() => setMonth(current)}>This month</Button>}
        </div>
        {!compact && (
          <div className={ui.pills} role="group" aria-label="Month view">
            <button type="button" className={ui.pill} aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><CalendarDays aria-hidden="true" />Calendar</button>
            <button type="button" className={ui.pill} aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" />List</button>
          </div>
        )}
      </div>

      <StatStrip label={`Summary for ${monthLabel(month)}`} items={[
        { label: "Present", value: counts.present, note: counts.half_day ? `+ ${counts.half_day} half ${counts.half_day === 1 ? "day" : "days"}` : undefined },
        { label: "Absent", value: counts.absent, tone: counts.absent ? "danger" : undefined },
        { label: "On leave", value: counts.leave },
        { label: "Attendance", value: rate === null ? "—" : `${rate}%`, note: "of working days" },
        ...(compact ? [] : [
          { label: "Hours worked", value: hoursLabel(productive), note: "productive time" },
          { label: "Overtime", value: hoursLabel(overtime), note: "payable" },
        ]),
      ]} />

      {days.error ? (
        <ErrorState message={days.error.message} onRetry={() => void days.mutate()} />
      ) : !days.data ? (
        <SkeletonRows rows={5} columns={7} />
      ) : shownView === "calendar" ? (
        <>
          <table className={styles.calendar} aria-label={`Attendance for ${monthLabel(month)}`}>
            <thead><tr>{WEEKDAYS.map((name) => <th key={name} scope="col"><abbr title={name}>{name}</abbr></th>)}</tr></thead>
            <tbody>
              {calendarWeeks(month).map((week, index) => (
                <tr key={index}>
                  {week.map((date, position) => {
                    if (!date) return <td key={`pad-${position}`} className={styles.padCell} />;
                    const day = byDate.get(date);
                    const kind = day ? dayKind(day.status) : null;
                    const future = date > today;
                    const weekend = position >= 5;
                    const label = day ? DAY_META[kind!].label : future ? "Upcoming" : weekend ? "Weekend" : "No record";
                    return (
                      <td key={date}>
                        <button type="button" className={cx(styles.dayCell, kind && KIND_CLASS[kind], !day && styles.dayEmpty, date === today && styles.dayToday)}
                          onClick={() => day && setOpenDay(day)} disabled={!day}
                          aria-label={`${dayLabel(date, true)}: ${label}${day?.productive_minutes ? `, ${hm(day.productive_minutes)} worked` : ""}`}>
                          <span className={styles.dayNumber}>{Number(date.slice(8))}</span>
                          <span className={styles.dayStatus}>{day ? DAY_META[kind!].label : future ? "" : weekend ? "" : "No record"}</span>
                          {day && (day.productive_minutes ?? 0) > 0 && <span className={styles.dayHours}>{hm(day.productive_minutes)}</span>}
                          {day?.locked && <Lock className={styles.dayLock} aria-hidden="true" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className={styles.legend} aria-label="Legend">
            {(["present", "half_day", "absent", "leave", "holiday", "pending"] as DayKind[]).map((kind) => (
              <li key={kind}><span className={cx(styles.legendSwatch, KIND_CLASS[kind])} aria-hidden="true" />{DAY_META[kind].label}</li>
            ))}
            <li><Lock size={12} aria-hidden="true" />Locked for payroll</li>
          </ul>
        </>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No attendance recorded this month">Days appear here once punches are processed by the attendance engine.</EmptyState>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead><tr><th>Date</th><th>Shift</th><th className={ui.numeric}>Span</th><th className={ui.numeric}>Worked</th><th className={cx(ui.numeric, styles.hideSm)}>Breaks</th><th className={cx(ui.numeric, styles.hideSm)}>Overtime</th><th>Status</th></tr></thead>
            <tbody>
              {[...rows].sort((a, b) => a.work_date.localeCompare(b.work_date)).map((day) => {
                const meta = DAY_META[dayKind(day.status)];
                return (
                  <tr key={day.id} className={ui.rowClickable} onClick={() => setOpenDay(day)}>
                    <td className={ui.nowrap}><button type="button" className={styles.linkButton} onClick={(event) => { event.stopPropagation(); setOpenDay(day); }}>{dayLabel(day.work_date)}</button></td>
                    <td>{day.assigned_shift ?? "—"}</td>
                    <td className={ui.numeric}>{hm(day.gross_span_minutes)}</td>
                    <td className={ui.numeric}>{hm(day.productive_minutes)}</td>
                    <td className={cx(ui.numeric, styles.hideSm)}>{hm(day.break_minutes)}</td>
                    <td className={cx(ui.numeric, styles.hideSm)}>{hm(day.payable_ot_minutes)}</td>
                    <td><span className={styles.statusCell}><Badge tone={meta.tone}>{meta.label}</Badge>{day.locked && <Lock size={12} aria-label="Locked" />}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openDay && (
        <DayDrawer day={openDay} canDecide={canDecide} canRequest={canRequest}
          onClose={() => setOpenDay(null)}
          onRequestRegularisation={onRequestRegularisation ? (date) => { setOpenDay(null); onRequestRegularisation(date); } : undefined}
          onChanged={() => { const id = openDay.id; void days.mutate().then((fresh) => { const found = fresh?.find((entry) => entry.id === id); if (found) setOpenDay(found); }); }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One day: figures, how the engine computed it, time-office actions   */
/* ------------------------------------------------------------------ */

type Pending = "approve" | "recompute" | "lock" | "reopen" | null;

export function DayDrawer({ day, canDecide, canRequest, onClose, onChanged, onRequestRegularisation }: {
  day: AttendanceDay;
  canDecide: boolean;
  canRequest: boolean;
  onClose: () => void;
  /** Called after a change; the parent reloads the month and passes the fresh day back in. */
  onChanged: () => void;
  onRequestRegularisation?: (date: string) => void;
}) {
  const notify = useNotify();
  const trace = useDayTrace(day.id);
  const [busy, setBusy] = useState<Pending>(null);
  const [confirm, setConfirm] = useState<"lock" | "reopen" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = dayKind(day.status);
  const meta = DAY_META[kind];
  const date = day.work_date.slice(0, 10);
  const computed = trace.data?.trace ?? null;

  async function run(action: Exclude<Pending, null>) {
    setBusy(action);
    setError(null);
    try {
      if (action === "recompute") await recomputeDay(day.id);
      else await transitionDay(day.id, action);
      const done = { approve: "Day approved", recompute: "Day recomputed", lock: "Day locked", reopen: "Day reopened" }[action];
      notify.success(done, `${dayLabel(date, true)} has been updated.`);
      void trace.mutate();
      onChanged();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title={dayLabel(date, true)}
      description={<span className={styles.drawerMeta}><Badge tone={meta.tone}>{meta.label}</Badge>{day.locked && <Badge tone="neutral"><Lock size={11} aria-hidden="true" />Locked for payroll</Badge>}{day.assigned_shift && <span>Shift {day.assigned_shift}</span>}</span>}
      footer={
        <>
          {canRequest && onRequestRegularisation && !day.locked && <Button icon={UserCheck} onClick={() => onRequestRegularisation(date)}>Request correction</Button>}
          {canDecide && !day.locked && kind === "pending" && <Button variant="primary" icon={CheckCircle2} loading={busy === "approve"} onClick={() => void run("approve")}>Approve</Button>}
          {canDecide && !day.locked && <Button icon={RefreshCw} loading={busy === "recompute"} onClick={() => void run("recompute")}>Recompute</Button>}
          {canDecide && !day.locked && <Button icon={Lock} onClick={() => setConfirm("lock")}>Lock</Button>}
          {canDecide && day.locked && <Button icon={LockOpen} onClick={() => setConfirm("reopen")}>Reopen</Button>}
          {!canDecide && !(canRequest && onRequestRegularisation) && <Button onClick={onClose}>Close</Button>}
        </>
      }>
      <div className={styles.drawerStack}>
        {error && <Alert tone="danger">{error}</Alert>}
        <section aria-labelledby="day-figures">
          <h3 id="day-figures" className={styles.drawerHeading}>Time recorded</h3>
          <StatStrip label="Time recorded" items={[
            { label: "Span", value: hm(day.gross_span_minutes), note: "first in to last out" },
            { label: "Worked", value: hm(day.productive_minutes), note: "after breaks" },
            { label: "Breaks", value: hm(day.break_minutes) },
            { label: "Overtime", value: hm(day.payable_ot_minutes), note: "payable" },
          ]} />
        </section>

        <section aria-labelledby="day-trace">
          <h3 id="day-trace" className={styles.drawerHeading}>How it was calculated</h3>
          {trace.error ? <ErrorState message={trace.error.message} onRetry={() => void trace.mutate()} />
            : !trace.data ? <SkeletonRows rows={3} columns={2} />
              : !computed ? <Alert tone="info">{trace.data.reason ?? "The engine has no punches to explain this day."} The figures above are the stored result.</Alert>
                : (
                  <>
                    <Details items={[
                      { label: "Punches used", value: `${computed.evidencePunches}` },
                      { label: "Shift length", value: hm(computed.shiftMinutes) },
                      { label: "Span (recomputed)", value: hm(computed.grossSpanMinutes) },
                      { label: "Worked (recomputed)", value: hm(computed.productiveMinutes) },
                      { label: "Gate-pass credit", value: computed.gatePassMinutes ? hm(computed.gatePassMinutes) : "None" },
                      { label: "Overtime (recomputed)", value: hm(computed.overtimeMinutes) },
                      { label: "Status the rules give", value: trace.data.day.computedStatus ?? "—" },
                    ]} />
                    {computed.breaks.length > 0 && (
                      <ul className={styles.breaks} aria-label="Breaks">
                        {computed.breaks.map((entry) => <li key={`${entry.from}-${entry.to}`}><span className={ui.mono}>{entry.from} – {entry.to}</span><span className={ui.muted}>{hm(entry.minutes)}</span></li>)}
                      </ul>
                    )}
                    {Math.abs((computed.productiveMinutes ?? 0) - (day.productive_minutes ?? 0)) > 0 && !day.locked && (
                      <Alert tone="warning">The stored figure differs from a fresh calculation by {hm(Math.abs((computed.productiveMinutes ?? 0) - (day.productive_minutes ?? 0)))}.{canDecide ? " Recompute to store the fresh figures." : ""}</Alert>
                    )}
                  </>
                )}
        </section>
        {day.locked && <Alert tone="info">This day is locked for payroll. Reopening it sets it back to pending review and marks payroll readiness for it as out of date.</Alert>}
      </div>

      <ConfirmDialog open={confirm !== null} title={confirm === "lock" ? "Lock this day?" : "Reopen this day?"} confirmLabel={confirm === "lock" ? "Lock day" : "Reopen day"}
        tone={confirm === "reopen" ? "danger" : "primary"} onCancel={() => setConfirm(null)} onConfirm={() => confirm && void run(confirm)}>
        {confirm === "lock"
          ? "A locked day is closed for payroll: it cannot be recomputed or overridden until it is reopened."
          : "The day goes back to pending review and payroll readiness for it is marked out of date. Use this only to correct a mistake."}
      </ConfirmDialog>
    </Drawer>
  );
}

