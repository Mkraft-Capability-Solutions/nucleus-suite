"use client";

import { History } from "lucide-react";
import styles from "../AttendanceView.module.css";
import AttendanceDialog from "./AttendanceDialog";
import type { DayDetail, LedgerRow } from "./attendanceApi";
import { useResource } from "./useResource";
import { formatDate, type Tr } from "./useAttendanceText";
import PunchTimeline from "./PunchTimeline";

/** Punch timeline for one ledger day, from GET /api/v1/attendance/days/register/{id}. */
export default function TimelineModal({ tr, locale, row, onClose }: { tr: Tr; locale: string; row: LedgerRow; onClose: () => void }) {
  const { state, reload } = useResource<DayDetail>(`/api/v1/attendance/days/register/${encodeURIComponent(row.id)}`, tr("text_day_detail_failed", "The punch evidence could not be loaded."));
  return (
    <AttendanceDialog open onClose={onClose} titleId="punch-timeline-title" title={tr("text_punch_timeline_device_audit", "Punch Timeline & Device Audit")}
      icon={<History size={18} color="var(--info)" aria-hidden="true" />} closeLabel={tr("text_close", "Close")}>
      <div className={styles.contextBox}>
        <div><strong>{row.employee_name ?? row.employee_code ?? "—"}</strong></div>
        <div>{tr("text_timeline_context", "Attendance date {date} · Shift {shift}", { date: formatDate(locale, row.date) ?? "—", shift: row.shift_applied ?? row.shift_assigned ?? "—" })}</div>
      </div>
      <PunchTimeline tr={tr} row={row} detail={state} onRetry={reload} />
      <div className={styles.formActions}>
        <button type="button" className={styles.btnSecondary} onClick={onClose}>{tr("text_close", "Close")}</button>
      </div>
    </AttendanceDialog>
  );
}
