"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import styles from "../AttendanceView.module.css";
import AttendanceDialog from "./AttendanceDialog";
import { errorMessage, newIdempotencyKey, sendJson, type Anomaly } from "./attendanceApi";
import type { Resource } from "./useResource";
import { formatDate, type Tr } from "./useAttendanceText";
import StateNote from "./StateNote";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;
type Action = "RESOLVE" | "WAIVE" | "ESCALATE";

const CLOSED = new Set(["resolved", "waived", "escalated", "closed", "rejected"]);
export function isOpenAnomaly(anomaly: Anomaly): boolean {
  return !CLOSED.has(anomaly.status.trim().toLowerCase());
}

function reasonFor(tr: Tr, action: Action, anomaly: Anomaly): string {
  const name = anomaly.employeeName ?? anomaly.employeeCode ?? "—";
  switch (action) {
    case "RESOLVE": return tr("text_anomaly_reason_resolve", "Resolved after review for {name}", { name });
    case "WAIVE": return tr("text_anomaly_reason_waive", "Waived as a false positive for {name}", { name });
    case "ESCALATE": return tr("text_anomaly_reason_escalate", "Escalated to the plant supervisor for {name}", { name });
    default: {
      const unreachable: never = action;
      return String(unreachable);
    }
  }
}

/** Open anomalies from GET /api/v1/attendance/anomalies; each decision is POSTed and the list reloads after success. */
export default function AnomalyModal({ tr, locale, open, anomalies, onClose, onChanged, notify }: {
  tr: Tr;
  locale: string;
  open: boolean;
  anomalies: Resource<Anomaly[]>;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const items = anomalies.status === "ready" ? anomalies.data.filter(isOpenAnomaly) : [];

  const resolve = async (anomaly: Anomaly, action: Action): Promise<boolean> => {
    try {
      await sendJson(`/api/v1/attendance/anomalies/${encodeURIComponent(anomaly.id)}/resolve`, { action, reason: reasonFor(tr, action, anomaly) }, newIdempotencyKey(), tr("text_anomaly_failed", "The decision could not be saved."));
      setFailures((current) => { const next = { ...current }; delete next[anomaly.id]; return next; });
      return true;
    } catch (error) {
      setFailures((current) => ({ ...current, [anomaly.id]: errorMessage(error, tr("text_anomaly_failed", "The decision could not be saved.")) }));
      return false;
    }
  };

  const one = async (anomaly: Anomaly, action: Action) => {
    setBusy(anomaly.id);
    const done = await resolve(anomaly, action);
    setBusy(null);
    if (done) {
      notify(tr("text_anomaly_saved_title", "Anomaly updated"), reasonFor(tr, action, anomaly), action === "RESOLVE" ? "success" : "info");
      onChanged();
    }
  };

  const all = async () => {
    setBusy("ALL");
    let ok = 0;
    for (const anomaly of items) {
      if (await resolve(anomaly, "RESOLVE")) ok += 1;
    }
    setBusy(null);
    const failed = items.length - ok;
    notify(failed === 0 ? tr("text_all_resolved_title", "All resolved") : tr("text_some_failed_title", "Some anomalies were not resolved"),
      tr("text_resolved_count", "{ok} resolved, {failed} failed.", { ok, failed }), failed === 0 ? "success" : "error");
    onChanged();
  };

  return (
    <AttendanceDialog open={open} onClose={onClose} busy={busy !== null} wide titleId="anomaly-review-title" title={tr("text_ai_shift_anomaly_intelligence_review_que", "AI Shift & Anomaly Intelligence — Review Queue")}
      icon={<Sparkles size={20} color="var(--pending)" aria-hidden="true" />} closeLabel={tr("text_close", "Close")}>
      <p className={styles.muted}>{tr("text_anomaly_intro", "Attendance exceptions recorded by the engine and waiting for review.")}</p>
      <div className={styles.scrollList} aria-live="polite">
        {anomalies.status !== "ready" ? <StateNote tr={tr} state={anomalies} onRetry={onChanged} /> : items.length === 0 ? (
          <div className={`${styles.note} ${styles.okText}`}>
            <CheckCircle2 size={40} aria-hidden="true" />
            <div>{tr("text_all_anomalies_resolved", "All anomalies resolved")}</div>
            <div className={styles.tiny}>{tr("text_no_pending_biometric_or_schedule_anomali", "No pending biometric or schedule anomalies require HR review.")}</div>
          </div>
        ) : items.map((anomaly) => (
          <div key={anomaly.id} className={styles.anomalyItem}>
            <div className={styles.spaceBetween}>
              <div>
                <strong>{anomaly.employeeName ?? anomaly.employeeCode ?? "—"}</strong>
                <div className={styles.anomalyKind}>{anomaly.kind}</div>
              </div>
              <span className={`${styles.badge} ${styles.badgeAmber}`}>{formatDate(locale, anomaly.date) ?? "—"} · {anomaly.status}</span>
            </div>
            {anomaly.detail && <div className={styles.anomalyDetail}>{anomaly.detail}</div>}
            {failures[anomaly.id] && <div className={styles.fieldError} role="alert">{failures[anomaly.id]}</div>}
            <div className={styles.formActions}>
              <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} disabled={busy !== null} onClick={() => { void one(anomaly, "WAIVE"); }}>{tr("text_waive_false_positive", "Waive / False Positive")}</button>
              <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} disabled={busy !== null} onClick={() => { void one(anomaly, "ESCALATE"); }}>{tr("text_escalate_to_supervisor", "Escalate to Supervisor")}</button>
              <button type="button" className={`${styles.btnPrimary} ${styles.smallBtn}`} disabled={busy !== null} onClick={() => { void one(anomaly, "RESOLVE"); }}>{tr("text_resolve", "Resolve")}</button>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.footerBar}>
        {items.length > 0 ? (
          <button type="button" className={styles.btnSecondary} disabled={busy !== null} onClick={() => { void all(); }}>{tr("text_resolve_all_count", "Resolve all flagged ({count})", { count: items.length })}</button>
        ) : <span />}
        <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy !== null}>{tr("text_close", "Close")}</button>
      </div>
    </AttendanceDialog>
  );
}
