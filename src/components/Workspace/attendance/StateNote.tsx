"use client";

import styles from "../AttendanceView.module.css";
import type { Resource } from "./useResource";
import type { Tr } from "./useAttendanceText";

/** Loading / error / idle message for a resource that is not ready. Renders nothing once data is ready. */
export default function StateNote<T>({ tr, state, onRetry, compact = false }: { tr: Tr; state: Resource<T>; onRetry?: () => void; compact?: boolean }) {
  if (state.status === "ready") return null;
  if (state.status === "error") {
    return (
      <div className={compact ? styles.statSub : styles.errorNote} role="alert">
        <span>{state.message}</span>
        {onRetry && <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={onRetry}>{tr("text_retry", "Retry")}</button>}
      </div>
    );
  }
  const text = state.status === "idle" ? tr("text_waiting_profile", "Waiting for your employee profile…") : tr("text_loading", "Loading…");
  return compact ? <span className={styles.statSub} role="status">{text}</span> : <p className={styles.note} role="status">{text}</p>;
}
