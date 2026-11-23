"use client";

import { useState } from "react";
import { CheckCircle2, Plus, UserCheck, XCircle } from "lucide-react";
import styles from "../AttendanceView.module.css";
import { errorMessage, newIdempotencyKey, sendJson, type Regularization } from "./attendanceApi";
import type { Resource } from "./useResource";
import { formatDate, type Tr } from "./useAttendanceText";
import StateNote from "./StateNote";
import DecisionDialog from "./DecisionDialog";
import { kindLabel } from "./RegularizationModal";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;
type Stage = "supervisor" | "time_office";
const FILTERS = ["ALL", "submitted", "supervisor_approved", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

function filterLabel(tr: Tr, filter: Filter): string {
  switch (filter) {
    case "ALL": return tr("text_all_requests", "All Requests");
    case "submitted": return tr("text_pending_supervisor", "Pending Supervisor");
    case "supervisor_approved": return tr("text_pending_time_office", "Pending Time Office");
    case "approved": return tr("text_fully_approved", "Fully Approved");
    case "rejected": return tr("text_rejected", "Rejected");
    default: {
      const unreachable: never = filter;
      return String(unreachable);
    }
  }
}

const STATUS_CLASS: Record<string, string> = {
  submitted: styles.badgeAmber, supervisor_approved: styles.badgePurple, approved: styles.badgeTeal, rejected: styles.badgeCoral,
};

export default function RegularizationTab({ tr, locale, ownEmployeeId, list, onReload, onNew, notify }: {
  tr: Tr;
  locale: string;
  ownEmployeeId: string | null;
  list: Resource<Regularization[]>;
  onReload: () => void;
  onNew: (() => void) | null;
  notify: Notify;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ row: Regularization; stage: Stage } | null>(null);
  const rows = list.status === "ready" ? list.data.filter((row) => filter === "ALL" || row.status === filter) : [];

  const decide = async (row: Regularization, stage: Stage, approve: boolean, remarks?: string): Promise<string | null> => {
    setBusyId(row.id);
    try {
      await sendJson(`/api/v1/regularizations/${encodeURIComponent(row.id)}/decide`, { approve, stage, ...(remarks ? { remarks } : {}) }, newIdempotencyKey(), tr("text_decision_failed", "The decision could not be saved."));
      notify(approve ? tr("text_reg_approved_title", "Regularization approved") : tr("text_reg_rejected_title", "Regularization rejected"),
        stage === "supervisor" ? tr("text_stage_supervisor_done", "Supervisor decision recorded.") : tr("text_stage_time_office_done", "Time-office decision recorded."), approve ? "success" : "info");
      onReload();
      return null;
    } catch (error) {
      const message = errorMessage(error, tr("text_decision_failed", "The decision could not be saved."));
      if (!remarks) notify(tr("text_decision_failed_title", "Decision not saved"), message, "error");
      return message;
    } finally {
      setBusyId(null);
    }
  };

  const actions = (row: Regularization) => {
    const stage: Stage | null = row.status === "submitted" ? "supervisor" : row.status === "supervisor_approved" ? "time_office" : null;
    if (!stage) return <span className={styles.tiny}>{tr("text_settled", "Settled")}</span>;
    if (row.employeeId !== null && row.employeeId === ownEmployeeId) return <span className={styles.tiny}>{tr("text_own_request", "Your request")}</span>;
    return (
      <div className={styles.inline}>
        <button type="button" className={`${styles.btnPrimary} ${styles.smallBtn}`} disabled={busyId === row.id} onClick={() => { void decide(row, stage, true); }}
          title={stage === "supervisor" ? tr("title_shift_supervisor_tier_1_approval", "Shift Supervisor Tier 1 Approval") : tr("title_time_office_admin_final_recalculation_ap", "Time Office Admin Final Recalculation Approval")}>
          <CheckCircle2 size={13} aria-hidden="true" />{stage === "supervisor" ? tr("text_supv_approve", "Supv Approve") : tr("text_admin_settle", "Admin Settle")}
        </button>
        <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn} ${styles.dangerText}`} disabled={busyId === row.id} onClick={() => setRejecting({ row, stage })}>
          <XCircle size={13} aria-hidden="true" />{tr("text_reject", "Reject")}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.inline}>
          <UserCheck size={20} color="var(--signal)" aria-hidden="true" />
          <div>
            <h3>{tr("text_attendance_regularization_register", "Attendance Regularization Register")}</h3>
            <p className={styles.muted}>{tr("text_reg_register_sub", "Two-tier approval: shift supervisor, then time office.")}</p>
          </div>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={onNew ?? undefined} disabled={!onNew}>
          <Plus size={15} aria-hidden="true" />{tr("text_new_request", "New Request")}
        </button>
      </div>

      <div className={styles.chips} role="group" aria-label={tr("text_filter_status", "Filter by status")}>
        {FILTERS.map((value) => (
          <button key={value} type="button" className={`${styles.chip} ${filter === value ? styles.chipOn : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {filterLabel(tr, value)}
          </button>
        ))}
      </div>

      {list.status !== "ready" ? <StateNote tr={tr} state={list} onRetry={onReload} /> : rows.length === 0 ? (
        <p className={styles.note}>{list.data.length === 0 ? tr("text_reg_empty", "No regularization requests yet.") : tr("text_reg_no_match", "No request has this status.")}</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{tr("text_request_date", "Requested")}</th>
                <th scope="col">{tr("text_employee", "Employee")}</th>
                <th scope="col">{tr("text_exception_type", "Exception Type")}</th>
                <th scope="col">{tr("text_claimed_punches", "Claimed Punches")}</th>
                <th scope="col">{tr("text_justification", "Justification")}</th>
                <th scope="col">{tr("text_workflow_status", "Workflow Status")}</th>
                <th scope="col" className={styles.alignEnd}>{tr("text_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{formatDate(locale, row.date) ?? "—"}</strong><div className={styles.mono}>{formatDate(locale, row.createdAt) ?? ""}</div></td>
                  <td><div className={styles.segmentValue}>{row.employeeName ?? "—"}</div><div className={styles.mono}>{row.employeeCode ?? ""}</div></td>
                  <td><span className={`${styles.badge} ${styles.badgeBlue}`}>{kindLabel(tr, row.kind)}</span></td>
                  <td className={styles.mono}>
                    <div>{tr("text_in", "In:")} <strong>{row.claimedIn ?? "—"}</strong></div>
                    <div>{tr("text_out", "Out:")} <strong>{row.claimedOut ?? "—"}</strong></div>
                  </td>
                  <td className={styles.reasonCell}>{row.reason ?? "—"}{row.remarks && <div className={styles.dangerText}>{row.remarks}</div>}</td>
                  <td><span className={`${styles.badge} ${STATUS_CLASS[row.status] ?? styles.badgeBlue}`}>{FILTERS.includes(row.status as Filter) ? filterLabel(tr, row.status as Filter) : row.status}</span></td>
                  <td className={styles.alignEnd}>{actions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DecisionDialog tr={tr} open={rejecting !== null} minLength={3} title={tr("text_reject_regularization", "Reject regularization")}
        subject={rejecting ? `${rejecting.row.employeeName ?? "—"} · ${formatDate(locale, rejecting.row.date) ?? "—"}` : ""}
        onClose={() => setRejecting(null)} onConfirm={(remarks) => (rejecting ? decide(rejecting.row, rejecting.stage, false, remarks) : Promise.resolve(null))} />
    </div>
  );
}
