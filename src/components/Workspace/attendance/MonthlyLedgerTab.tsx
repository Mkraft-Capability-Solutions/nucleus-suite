"use client";

import { Calendar as CalIcon, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import styles from "../AttendanceView.module.css";
import { formatMinutes, type SessionStrip, type TimesheetDay } from "./attendanceApi";
import type { Resource } from "./useResource";
import { formatTime, type Tr } from "./useAttendanceText";
import StateNote from "./StateNote";

type DayStatus = TimesheetDay["status"];

const DAY_CLASS: Record<DayStatus, string> = {
  in: styles.dayPresent, late: styles.dayLate, absent: styles.dayAbsent, off: styles.dayWeekend,
  leave: styles.dayLeave, not_recorded: styles.dayNotRecorded,
};

function dayLabel(tr: Tr, status: DayStatus): string {
  switch (status) {
    case "in": return tr("text_day_in", "In");
    case "late": return tr("text_day_late", "Late");
    case "absent": return tr("text_day_absent", "Absent");
    case "off": return tr("text_day_off", "Off");
    case "leave": return tr("text_day_leave", "Leave");
    case "not_recorded": return tr("text_day_not_recorded", "No record");
    default: {
      const unreachable: never = status;
      return String(unreachable);
    }
  }
}

/** Weekday names for the calendar header, Sunday first, in the viewer's locale. */
function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale || undefined, { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2024, 0, 7 + index))));
}

export function periodLabel(locale: string, period: string): string {
  const [year = 1970, month = 1] = period.split("-").map(Number);
  return new Intl.DateTimeFormat(locale || undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function MonthlyLedgerTab({ tr, locale, linked, session, timesheet, anomalies, period, onPeriod, onReloadTimesheet, onOpenAnomalies }: {
  tr: Tr;
  locale: string;
  linked: boolean;
  session: Resource<SessionStrip>;
  timesheet: Resource<TimesheetDay[]>;
  anomalies: Resource<number>;
  period: string;
  onPeriod: (delta: number) => void;
  onReloadTimesheet: () => void;
  onOpenAnomalies: () => void;
}) {
  const strip = session.status === "ready" ? session.data : null;
  const allowance = strip?.gatePassAllowance ?? null;
  const unlinked = tr("text_not_linked", "Your account is not linked to an employee record, so there is no personal attendance to show.");
  const days = timesheet.status === "ready" ? timesheet.data : [];
  const [year = 1970, month = 1] = period.split("-").map(Number);
  const leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  return (
    <>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{tr("AttendanceView_text_23", "Current Session")}</span>
          {!linked ? <span className={styles.statSub}>{unlinked}</span> : !strip ? <StateNote tr={tr} state={session} compact /> : (
            <>
              <span className={styles.statValue}>{strip.session.open ? formatMinutes(strip.session.elapsedMinutes) ?? "—" : "—"}</span>
              <span className={styles.statSub}>
                {strip.session.open
                  ? tr("text_checked_in_at", "Checked in at {time}", { time: formatTime(locale, strip.session.checkedInAt) ?? "—" })
                  : tr("text_not_checked_in", "Not checked in")}
              </span>
            </>
          )}
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{tr("AttendanceView_text_24", "Active Shift Assignment")}</span>
          {!linked ? <span className={styles.statSub}>{unlinked}</span> : !strip ? <StateNote tr={tr} state={session} compact /> : strip.shift.shiftCode ? (
            <>
              <span className={`${styles.statValue} ${styles.statValueSmall}`}>{strip.shift.shiftName ?? strip.shift.shiftCode}</span>
              <span className={`${styles.statSub} ${styles.signalText}`}>
                {[strip.shift.startsAt && strip.shift.endsAt ? `${strip.shift.startsAt} – ${strip.shift.endsAt}` : null,
                  strip.shift.graceMinutes !== null ? tr("text_grace_minutes", "Grace window: {minutes} min", { minutes: strip.shift.graceMinutes }) : tr("text_no_grace", "No grace window recorded")]
                  .filter(Boolean).join(" · ")}
              </span>
            </>
          ) : <span className={styles.statSub}>{tr("text_no_shift", "No active shift is assigned.")}</span>}
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{tr("AttendanceView_text_27", "Monthly Gate Pass Quota")}</span>
          {!linked ? <span className={styles.statSub}>{unlinked}</span> : !allowance ? <StateNote tr={tr} state={session} compact /> : (
            <>
              <span className={`${styles.statValue} ${styles.statValueSmall}`}>
                {allowance.ceilingMinutes !== null
                  ? tr("text_minutes_used_of", "{used} / {limit} min used", { used: allowance.usedMinutes, limit: allowance.ceilingMinutes })
                  : tr("text_minutes_used", "{used} min used", { used: allowance.usedMinutes })}
              </span>
              <span className={styles.statSub}>
                {allowance.remainingRequests !== null
                  ? tr("text_requests_remaining", "{count} requests remaining this month", { count: allowance.remainingRequests })
                  : tr("text_no_request_limit", "No monthly request limit is configured")}
              </span>
            </>
          )}
        </div>
      </div>

      <div className={styles.anomalyBanner}>
        <div className={styles.inline}>
          <Sparkles size={22} color="var(--pending)" aria-hidden="true" />
          <div>
            <strong>{tr("AttendanceView_text_30", "AI Shift & Anomaly Intelligence")}</strong>
            <div className={styles.muted} aria-live="polite">
              {anomalies.status === "ready"
                ? tr("text_open_anomalies", "{count} open anomalies flagged for HR review", { count: anomalies.data })
                : anomalies.status === "error" ? anomalies.message : tr("text_loading", "Loading…")}
            </div>
          </div>
        </div>
        <button type="button" className={styles.anomalyBtn} onClick={onOpenAnomalies}>{tr("AttendanceView_text_32", "Review Anomalies")}</button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3><CalIcon size={20} color="var(--signal)" aria-hidden="true" />{tr("text_monthly_ledger_title", "Monthly Timesheet & Attendance Ledger")}</h3>
          <div className={styles.inline}>
            <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={() => onPeriod(-1)} aria-label={tr("text_previous_month", "Previous month")}><ChevronLeft size={16} aria-hidden="true" /></button>
            <strong aria-live="polite">{periodLabel(locale, period)}</strong>
            <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={() => onPeriod(1)} aria-label={tr("text_next_month", "Next month")}><ChevronRight size={16} aria-hidden="true" /></button>
            <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={onReloadTimesheet} aria-label={tr("text_refresh", "Refresh")}><RefreshCw size={14} aria-hidden="true" /></button>
          </div>
        </div>
        {!linked ? <p className={styles.note}>{unlinked}</p> : timesheet.status !== "ready" ? <StateNote tr={tr} state={timesheet} onRetry={onReloadTimesheet} /> : (
          <div className={styles.calendarGrid} role="grid" aria-label={periodLabel(locale, period)}>
            {weekdayNames(locale).map((name) => <div key={name} className={styles.dayHeader} role="columnheader">{name}</div>)}
            {Array.from({ length: leading }, (_, index) => <div key={`pad-${index}`} className={styles.dayFiller} aria-hidden="true" />)}
            {days.map((day) => (
              <div key={day.date} role="gridcell" className={`${styles.dayCell} ${DAY_CLASS[day.status]}`}
                title={[day.shiftCode, formatMinutes(day.grossMinutes)].filter(Boolean).join(" · ") || undefined}>
                <span className={styles.dayNumber}>{Number(day.date.slice(8, 10))}</span>
                <span className={styles.dayStatus}>{dayLabel(tr, day.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
