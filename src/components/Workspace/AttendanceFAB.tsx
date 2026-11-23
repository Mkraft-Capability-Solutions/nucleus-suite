"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Fingerprint, LoaderCircle, XCircle } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import { useT } from "@/hooks/useT";
import { formatClock, formatMinutes, isLateArrival, useMyPunchDay } from "@/hooks/useMyPunchDay";
import styles from "./AttendanceFAB.module.css";

/**
 * The single employee punch control. State comes from GET /api/v1/attendance/punches/me (today's punches in the
 * facility timezone); a punch posts to the same route with an Idempotency-Key and the UI changes only after the
 * server accepts it. Voice / assistant punches arrive as `nucleus:trigger_punch` ({ type: "IN" | "OUT" }).
 * Late status is derived from the employee's assigned shift start + grace, never a hardcoded time.
 */
const NS = "components.Workspace.AttendanceFAB";

export default function AttendanceFAB() {
  const { t, locale } = useT();
  const { showToast } = useHRMS();
  const { state, punch, pending } = useMyPunchDay();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const day = state.status === "ready" ? state.data : null;

  const submit = async (direction: "in" | "out") => {
    if (pending) return;
    setError("");
    const result = await punch(direction, note);
    if (!result.ok) {
      const message = result.message || t(`${NS}.text_punch_failed`, "The punch was not recorded. Try again.");
      setError(message);
      showToast(t(`${NS}.text_punch_failed_title`, "Punch not recorded"), message, "error");
      return;
    }
    setNote("");
    showToast(
      direction === "in" ? t(`${NS}.text_punched_in_title`, "Punched in") : t(`${NS}.text_punched_out_title`, "Punched out"),
      t(`${NS}.text_punch_saved`, "Your punch was recorded."),
      "success",
    );
  };

  // Voice and assistant punches are routed here so there is one punch control.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    const onVoicePunch = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      void submitRef.current(type === "OUT" ? "out" : "in");
    };
    window.addEventListener("nucleus:trigger_punch", onVoicePunch);
    return () => window.removeEventListener("nucleus:trigger_punch", onVoicePunch);
  }, []);

  const late = day ? isLateArrival(day) : null;
  const tone = !day || day.state !== "in" ? styles.toneIdle : late ? styles.toneLate : styles.toneOnTime;
  const worked = day ? formatMinutes(day.workedMinutes, locale) : null;
  const dateLabel = day ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.workDate}T00:00:00Z`)) : "";

  return (
    <div className={`${styles.fab} ${tone} ${expanded ? styles.expanded : ""}`} onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={expanded}
        aria-controls="attendance-fab-panel"
        aria-label={t(`${NS}.text_toggle`, "Attendance punch")}
        onClick={() => setExpanded((value) => !value)}
      >
        <Fingerprint size={24} aria-hidden="true" />
        {day?.state === "in" && <span className={styles.statusDot} aria-hidden="true" />}
      </button>

      {expanded && (
        <div className={styles.panel} id="attendance-fab-panel" aria-live="polite">
          <div className={styles.head}>
            <span className={styles.title}>{t(`${NS}.text_title`, "Attendance")}</span>
            <span className={styles.date}>{dateLabel}</span>
          </div>

          {state.status === "loading" && <p className={styles.note}>{t(`${NS}.text_loading`, "Loading today's attendance…")}</p>}
          {state.status === "error" && <p className={styles.error} role="alert">{state.message || t(`${NS}.text_load_failed`, "Today's attendance could not be loaded.")}</p>}

          {day && (
            <>
              <dl className={styles.stats}>
                <div><dt>{t(`${NS}.text_first_in`, "First in")}</dt><dd>{formatClock(day.firstIn, locale, day.timezone) ?? t(`${NS}.text_not_yet`, "Not yet")}</dd></div>
                <div><dt>{t(`${NS}.text_worked`, "Worked today")}</dt><dd>{worked ? t(`${NS}.text_duration`, "{hours}h {minutes}m", worked) : ""}</dd></div>
              </dl>
              <p className={styles.tag}>
                {day.shift?.name || day.shift?.code
                  ? t(`${NS}.text_shift`, "Shift {shift}", { shift: day.shift?.name || day.shift?.code || "" })
                  : t(`${NS}.text_no_shift`, "No shift is assigned, so late arrival cannot be checked.")}
                {late === true && ` · ${t(`${NS}.text_late`, "Late arrival")}`}
              </p>
              {day.locked ? (
                <p className={styles.note}>{t(`${NS}.text_locked`, "Today's attendance is locked. Raise a regularization to change it.")}</p>
              ) : (
                <>
                  <label className={styles.noteField}>
                    <span>{day.nextDirection === "out" ? t(`${NS}.text_note_out`, "Work summary (optional)") : t(`${NS}.text_note_in`, "Plan for the day (optional)")}</span>
                    <textarea value={note} maxLength={120} rows={2} onChange={(event) => setNote(event.target.value)} />
                  </label>
                  <button
                    type="button"
                    className={day.nextDirection === "out" ? styles.punchOut : styles.punchIn}
                    disabled={pending}
                    aria-busy={pending}
                    onClick={() => void submit(day.nextDirection)}
                  >
                    {pending ? <LoaderCircle size={16} aria-hidden="true" /> : day.nextDirection === "out" ? <XCircle size={16} aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
                    {day.nextDirection === "out" ? t(`${NS}.text_punch_out`, "Punch out") : t(`${NS}.text_punch_in`, "Punch in")}
                  </button>
                </>
              )}
            </>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
