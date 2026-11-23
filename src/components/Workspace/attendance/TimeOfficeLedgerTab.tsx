"use client";

import { useEffect, useRef, useState } from "react";
import { CheckSquare, History, RefreshCw, Sliders, Timer } from "lucide-react";
import styles from "../AttendanceView.module.css";
import { errorMessage, formatMinutes, newIdempotencyKey, sendJson, type DayDetail, type LedgerRow } from "./attendanceApi";
import { useResource, type Resource } from "./useResource";
import { formatDate, type Tr } from "./useAttendanceText";
import StateNote from "./StateNote";
import PunchTimeline from "./PunchTimeline";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;
export type LedgerAction = "regularize" | "overtime" | "timeline" | "shift";

function categoryClass(code: string | null): string {
  const value = (code ?? "").toUpperCase();
  if (value === "CONTRACT") return styles.badgeAmber;
  if (value.startsWith("THIRD_PARTY")) return styles.badgePurple;
  return styles.badgeBlue;
}

function isPresent(status: string | null): boolean {
  return (status ?? "").trim().toLowerCase().startsWith("present");
}

export default function TimeOfficeLedgerTab({ tr, locale, ledger, onReload, onAction, notify }: {
  tr: Tr;
  locale: string;
  ledger: Resource<LedgerRow[]>;
  onReload: () => void;
  onAction: (action: LedgerAction, row: LedgerRow) => void;
  notify: Notify;
}) {
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const queueKey = useRef<{ rowId: string; key: string } | null>(null);
  const rows = ledger.status === "ready" ? ledger.data : [];
  const inspected = rows.find((row) => row.id === inspectedId) ?? rows[0] ?? null;
  const { state: detail, reload: reloadDetail } = useResource<DayDetail>(inspected ? `/api/v1/attendance/days/register/${encodeURIComponent(inspected.id)}` : null, tr("text_day_detail_failed", "The punch evidence could not be loaded."));

  useEffect(() => {
    if (!menuRowId) return;
    const close = () => setMenuRowId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuRowId]);

  const queueRecompute = async () => {
    if (!inspected?.date || queueing) return;
    if (queueKey.current?.rowId !== inspected.id) queueKey.current = { rowId: inspected.id, key: newIdempotencyKey() };
    setQueueing(true);
    try {
      await sendJson("/api/v1/attendance/recompute/register", {
        employeeScope: inspected.employee_id, fromDate: inspected.date, toDate: inspected.date,
        reason: tr("text_recompute_reason", "Recompute requested from the time-office ledger"),
      }, queueKey.current.key, tr("text_recompute_failed", "The recompute could not be queued."));
      queueKey.current = null;
      notify(tr("text_recompute_queued_title", "Recompute queued"), tr("text_recompute_queued", "{name} · {date} is queued for recomputation.", { name: inspected.employee_name ?? inspected.employee_code ?? "—", date: formatDate(locale, inspected.date) ?? inspected.date }), "success");
    } catch (error) {
      notify(tr("text_recompute_failed_title", "Recompute not queued"), errorMessage(error, tr("text_recompute_failed", "The recompute could not be queued.")), "error");
    } finally {
      setQueueing(false);
    }
  };

  const choose = (action: LedgerAction, row: LedgerRow) => {
    setMenuRowId(null);
    if (action === "timeline") setInspectedId(row.id);
    onAction(action, row);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3>{tr("text_ledger_title", "Time-Office Recompute Ledger")}</h3>
            <p className={styles.muted}>{tr("text_ledger_sub", "Computed attendance days for the employees you can see: gross span, breaks, gate passes, net hours and overtime as stored by the engine.")}</p>
          </div>
          <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={onReload}><RefreshCw size={14} aria-hidden="true" />{tr("text_refresh", "Refresh")}</button>
        </div>
        {ledger.status !== "ready" ? <StateNote tr={tr} state={ledger} onRetry={onReload} /> : rows.length === 0 ? (
          <p className={styles.note}>{tr("text_ledger_empty", "No computed attendance days are available yet.")}</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{tr("AttendanceView_text_62", "Employee / Role")}</th>
                  <th scope="col">{tr("AttendanceView_text_63", "Category")}</th>
                  <th scope="col">{tr("AttendanceView_text_64", "Date")}</th>
                  <th scope="col">{tr("AttendanceView_text_65", "Assigned vs Inferred Shift")}</th>
                  <th scope="col">{tr("AttendanceView_text_66", "Gross Span")}</th>
                  <th scope="col">{tr("AttendanceView_text_67", "Breaks / GP")}</th>
                  <th scope="col">{tr("AttendanceView_text_68", "Net Working")}</th>
                  <th scope="col">{tr("AttendanceView_text_69", "Overtime (OT)")}</th>
                  <th scope="col">{tr("AttendanceView_text_70", "Status / Policy Action")}</th>
                  <th scope="col">{tr("AttendanceView_text_71", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.employee_name ?? row.employee_code ?? "—"}</strong><div className={styles.tiny}>{row.designation ?? ""}</div></td>
                    <td>{row.worker_category_code ? <span className={`${styles.badge} ${categoryClass(row.worker_category_code)}`}>{row.worker_category_code}</span> : "—"}</td>
                    <td>{formatDate(locale, row.date) ?? "—"}</td>
                    <td>
                      <div className={styles.segmentValue}>{row.shift_applied ?? row.shift_assigned ?? "—"}</div>
                      {row.shift_inferred && <span className={`${styles.badge} ${styles.badgeTeal}`}>{tr("text_inferred_from", "Inferred (assigned {shift})", { shift: row.shift_assigned ?? "—" })}</span>}
                    </td>
                    <td><strong>{formatMinutes(row.gross_minutes) ?? "—"}</strong></td>
                    <td>
                      {row.break_minutes ? <div className={`${styles.tiny} ${styles.dangerText}`}>{tr("text_break_minus", "−{minutes} min break", { minutes: row.break_minutes })}</div> : null}
                      {row.gate_pass_minutes ? <div className={`${styles.tiny} ${styles.okText}`}>{tr("text_gate_pass_plus", "+{minutes} min gate pass", { minutes: row.gate_pass_minutes })}</div> : null}
                      {!row.break_minutes && !row.gate_pass_minutes && "—"}
                    </td>
                    <td className={styles.signalText}>{formatMinutes(row.net_minutes) ?? "—"}</td>
                    <td>{row.ot_minutes ? <strong className={styles.okText}>{formatMinutes(row.ot_minutes)}</strong> : "—"}</td>
                    <td>
                      <span className={`${styles.badge} ${isPresent(row.status) ? styles.badgeTeal : styles.badgeCoral}`}>{row.status ?? tr("text_not_recorded", "Not recorded")}</span>
                      {row.status_reason && <div className={styles.reasonCell}>{row.status_reason}</div>}
                    </td>
                    <td className={styles.relative}>
                      <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} aria-haspopup="menu" aria-expanded={menuRowId === row.id}
                        onClick={(event) => { event.stopPropagation(); setMenuRowId(menuRowId === row.id ? null : row.id); }}>
                        {tr("text_actions", "Actions ▾")}
                      </button>
                      {menuRowId === row.id && (
                        <div className={styles.actionMenuPopover} role="menu" onClick={(event) => event.stopPropagation()}>
                          <button type="button" role="menuitem" onClick={() => choose("regularize", row)}><CheckSquare size={13} color="var(--signal)" aria-hidden="true" />{tr("text_regularize_attendance", "Regularize Attendance")}</button>
                          <button type="button" role="menuitem" onClick={() => choose("overtime", row)}><Timer size={13} color="var(--status-ok)" aria-hidden="true" />{tr("text_tag_approve_ot", "Tag / Approve OT")}</button>
                          <button type="button" role="menuitem" onClick={() => choose("timeline", row)}><History size={13} color="var(--info)" aria-hidden="true" />{tr("text_view_punch_timeline", "View Punch Timeline")}</button>
                          <button type="button" role="menuitem" onClick={() => choose("shift", row)}><Sliders size={13} color="var(--pending)" aria-hidden="true" />{tr("text_manual_shift_override", "Manual Shift Override")}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {inspected && (
        <div className={`${styles.card} ${styles.inspector}`}>
          <div className={styles.cardHeader}>
            <div>
              <h4 className={styles.signalText}>{tr("text_inspector_title", "Shift Inspector: punch evidence & break report")}</h4>
              <p className={styles.muted}>
                {tr("text_inspector_sub", "{name} · {date} · shift {shift}", { name: inspected.employee_name ?? inspected.employee_code ?? "—", date: formatDate(locale, inspected.date) ?? "—", shift: inspected.shift_applied ?? inspected.shift_assigned ?? "—" })}
              </p>
            </div>
            <button type="button" className={styles.btnSecondary} onClick={() => { void queueRecompute(); }} disabled={queueing || !inspected.date}>
              <RefreshCw size={14} aria-hidden="true" />{queueing ? tr("text_saving", "Saving…") : tr("text_queue_recompute", "Queue recompute for this day")}
            </button>
          </div>
          <div className={styles.segmentGrid}>
            <div className={styles.segment}><span className={styles.segmentLabel}>{tr("text_first_in", "First in")}</span><span className={styles.segmentValue}>{detail.status === "ready" ? detail.data.first_in ?? "—" : "…"}</span></div>
            <div className={styles.segment}><span className={styles.segmentLabel}>{tr("text_breaks_deducted", "Breaks deducted")}</span><span className={`${styles.segmentValue} ${styles.dangerText}`}>{formatMinutes(inspected.break_minutes) ?? "—"}</span></div>
            <div className={styles.segment}><span className={styles.segmentLabel}>{tr("text_last_out", "Last out")}</span><span className={styles.segmentValue}>{detail.status === "ready" ? detail.data.last_out ?? "—" : "…"}</span></div>
            <div className={`${styles.segment} ${styles.segmentSummary}`}>
              <span className={styles.segmentLabel}>{tr("text_final_summary", "Final summary")}</span>
              <span className={styles.segmentValue}>{tr("text_net_ot_summary", "Net {net} · OT {ot}", { net: formatMinutes(inspected.net_minutes) ?? "—", ot: formatMinutes(inspected.ot_minutes) ?? "—" })}</span>
            </div>
          </div>
          <PunchTimeline tr={tr} row={inspected} detail={detail} onRetry={reloadDetail} />
        </div>
      )}
    </div>
  );
}
