"use client";

import { useT } from "@/hooks/useT";
import { formatClock, formatMinutes, isLateArrival, useMyPunchDay } from "@/hooks/useMyPunchDay";
import styles from "./AttendanceWidget.module.css";

/**
 * Today's session from GET /api/v1/attendance/punches/me. The punch button does not punch by itself: it routes
 * to the single punch control (AttendanceFAB) via `nucleus:trigger_punch`.
 */
const NS = "components.Dashboard.AttendanceWidget";

export default function AttendanceWidget() {
  const { t, locale } = useT();
  const { state } = useMyPunchDay();
  const day = state.status === "ready" ? state.data : null;
  const shiftMinutes = (() => {
    const s = day?.shift; if (!s?.startsAt || !s.endsAt) return null;
    const [a, b] = [s.startsAt, s.endsAt].map((v) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; });
    return Number.isFinite(a) && Number.isFinite(b) ? ((b - a + 1440) % 1440) || null : null;
  })();
  const pct = day && shiftMinutes ? Math.min(100, Math.round((day.workedMinutes / shiftMinutes) * 100)) : null;
  const late = day ? isLateArrival(day) : null;

  return (
    <div className={`${styles.card} glass-card`}>
      <h3 className={styles.title}>{t(`${NS}.AttendanceWidget_text_1`, "Today's attendance")}</h3>
      {state.status === "loading" && <p className={styles.subtext}>{t(`${NS}.text_loading`, "Loading…")}</p>}
      {state.status === "error" && <p className={styles.subtext} role="alert">{state.message || t(`${NS}.text_failed`, "Attendance could not be loaded.")}</p>}
      {day && (
        <>
          <div className={styles.sessionGrid}>
            <div className={styles.sessionItem}>
              <span className={styles.label}>{t(`${NS}.text_first_in`, "First in")}</span>
              <span className={styles.value}>{formatClock(day.firstIn, locale, day.timezone) ?? t(`${NS}.text_not_yet`, "Not yet")}</span>
              {late !== null && <span className={styles.status}>{late ? t(`${NS}.text_late`, "Late") : t(`${NS}.text_on_time`, "On time")}</span>}
            </div>
            <div className={styles.sessionItem}>
              <span className={styles.label}>{t(`${NS}.text_worked`, "Worked")}</span>
              <span className={styles.value}>{t(`${NS}.text_duration`, "{hours}h {minutes}m", formatMinutes(day.workedMinutes, locale))}</span>
              {pct !== null && <div className={styles.durationBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t(`${NS}.text_progress`, "Share of shift worked")}><div className={styles.durationProgress} style={{ inlineSize: `${pct}%` }} /></div>}
            </div>
            <div className={styles.sessionItem}>
              <span className={styles.label}>{t(`${NS}.text_action`, "Action")}</span>
              <button type="button" className={styles.punchBtn} disabled={day.locked} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:trigger_punch", { detail: { type: day.nextDirection === "out" ? "OUT" : "IN" } }))}>
                {day.nextDirection === "out" ? t(`${NS}.text_punch_out`, "Punch out") : t(`${NS}.text_punch_in`, "Punch in")}
              </button>
            </div>
          </div>
          <div className={styles.statusFooter}>{day.shift?.name || day.shift?.code ? t(`${NS}.text_shift`, "Shift {shift}", { shift: day.shift?.name || day.shift?.code || "" }) : t(`${NS}.text_no_shift`, "No shift assigned")}</div>
        </>
      )}
    </div>
  );
}
