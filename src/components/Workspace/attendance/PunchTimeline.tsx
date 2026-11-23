"use client";

import styles from "../AttendanceView.module.css";
import { formatMinutes, type DayDetail, type LedgerRow } from "./attendanceApi";
import type { Resource } from "./useResource";
import type { Tr } from "./useAttendanceText";
import StateNote from "./StateNote";

/**
 * The stored punch events behind one attendance day, in order, plus the minutes the engine computed for it.
 * Nothing is paired or recomputed here: the figures are the server's.
 */
export default function PunchTimeline({ tr, row, detail, onRetry }: { tr: Tr; row: LedgerRow; detail: Resource<DayDetail>; onRetry: () => void }) {
  const breaks = (row.break_minutes ?? 0) + (row.gate_pass_minutes ?? 0);
  return (
    <>
      {detail.status !== "ready" ? <StateNote tr={tr} state={detail} onRetry={onRetry} /> : detail.data.punches.length === 0 ? (
        <p className={styles.note}>{tr("text_no_punches", "No punch events are stored for this day.")}</p>
      ) : (
        <ol className={styles.timelineWrapper}>
          {detail.data.punches.map((punch) => (
            <li key={punch.id} className={styles.timelineItem}>
              <span className={`${styles.timelineDot} ${punch.direction === "in" ? styles.timelineDotTeal : punch.direction === "out" ? styles.timelineDotBlue : styles.timelineDotAmber}`} aria-hidden="true" />
              <span className={styles.timelineTime}>
                {punch.punch_time ?? "—"} · {punch.direction === "in" ? tr("text_punch_in_event", "IN") : punch.direction === "out" ? tr("text_punch_out_event", "OUT") : tr("text_punch_unknown", "Unknown direction")}
                {punch.punch_date && punch.punch_date !== row.date ? ` (${punch.punch_date})` : ""}
              </span>
              <span className={styles.timelineDesc}>{[punch.device, punch.note, punch.event_reference].filter(Boolean).join(" · ") || "—"}</span>
            </li>
          ))}
        </ol>
      )}
      <div className={styles.summaryGrid}>
        <div><div className={styles.tiny}>{tr("text_gross_span", "Gross Span")}</div><div className={styles.segmentValue}>{formatMinutes(row.gross_minutes) ?? "—"}</div></div>
        <div><div className={styles.tiny}>{tr("text_breaksgp", "Breaks/GP")}</div><div className={`${styles.segmentValue} ${styles.dangerText}`}>{row.break_minutes === null && row.gate_pass_minutes === null ? "—" : formatMinutes(breaks)}</div></div>
        <div><div className={styles.tiny}>{tr("text_net_working", "Net Working")}</div><div className={`${styles.segmentValue} ${styles.signalText}`}>{formatMinutes(row.net_minutes) ?? "—"}</div></div>
      </div>
    </>
  );
}
