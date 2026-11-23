"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Plus, XCircle } from "lucide-react";
import styles from "../AttendanceView.module.css";
import { errorMessage, newIdempotencyKey, sendJson, type GatePass, type SessionStrip } from "./attendanceApi";
import type { Resource } from "./useResource";
import { formatDate, type Tr } from "./useAttendanceText";
import StateNote from "./StateNote";
import DecisionDialog from "./DecisionDialog";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;

const STATUS_CLASS: Record<GatePass["status"], string> = {
  draft: styles.badgeBlue, pending_approval: styles.badgeAmber, approved: styles.badgeTeal, rejected: styles.badgeCoral, credited: styles.badgeTeal,
};

function statusLabel(tr: Tr, status: GatePass["status"]): string {
  switch (status) {
    case "draft": return tr("text_gp_draft", "Draft");
    case "pending_approval": return tr("text_gp_pending", "Pending approval");
    case "approved": return tr("text_gp_approved", "Approved");
    case "rejected": return tr("text_gp_rejected", "Rejected");
    case "credited": return tr("text_gp_credited", "Credited");
    default: {
      const unreachable: never = status;
      return String(unreachable);
    }
  }
}

function fillClass(used: number, limit: number | null): string {
  if (limit === null || limit <= 0) return styles.fillSignal;
  if (used >= limit) return styles.fillFlag;
  return used / limit > 0.75 ? styles.fillWarn : styles.fillOk;
}

function percent(used: number, limit: number | null): string {
  return limit && limit > 0 ? `${Math.min(100, (used / limit) * 100)}%` : "0%";
}

export default function GatePassTab({ tr, locale, linked, ownEmployeeId, session, passes, onReload, onApply, notify }: {
  tr: Tr;
  locale: string;
  linked: boolean;
  ownEmployeeId: string | null;
  session: Resource<SessionStrip>;
  passes: Resource<GatePass[]>;
  onReload: () => void;
  onApply: () => void;
  notify: Notify;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<GatePass | null>(null);
  const allowance = session.status === "ready" ? session.data.gatePassAllowance : null;
  const exhausted = allowance !== null && ((allowance.remainingRequests ?? 1) <= 0 || (allowance.remainingMinutes ?? 1) <= 0);

  const decide = async (pass: GatePass, approve: boolean, remarks?: string): Promise<string | null> => {
    setBusyId(pass.id);
    try {
      await sendJson(`/api/v1/gate-passes/${encodeURIComponent(pass.id)}/decide`, remarks ? { approve, decisionRemarks: remarks } : { approve }, newIdempotencyKey(), tr("text_decision_failed", "The decision could not be saved."));
      notify(approve ? tr("text_gp_approved_title", "Gate pass approved") : tr("text_gp_rejected_title", "Gate pass rejected"), pass.employee_name || pass.employee_code, approve ? "success" : "info");
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

  return (
    <div className={styles.stack}>
      <div className={styles.quotaGrid}>
        <div className={styles.quotaCard}>
          <div className={styles.spaceBetween}>
            <span className={styles.statLabel}>{tr("AttendanceView_text_35", "Monthly Duration Ceiling")}</span>
            {allowance?.remainingMinutes !== null && allowance?.remainingMinutes !== undefined && (
              <span className={`${styles.badge} ${allowance.remainingMinutes === 0 ? styles.badgeCoral : styles.badgeTeal}`}>{tr("text_minutes_available", "{minutes} min available", { minutes: allowance.remainingMinutes })}</span>
            )}
          </div>
          {!linked ? <p className={styles.tiny}>{tr("text_not_linked_short", "No employee record is linked to your account.")}</p> : !allowance ? <StateNote tr={tr} state={session} compact /> : (
            <>
              <div className={styles.quotaValue}>{allowance.usedMinutes} <span className={styles.quotaUnit}>{allowance.ceilingMinutes !== null ? tr("text_of_minutes", "/ {limit} minutes", { limit: allowance.ceilingMinutes }) : tr("text_minutes_unit", "minutes")}</span></div>
              <div className={styles.progressBar}><div className={`${styles.progressFill} ${fillClass(allowance.usedMinutes, allowance.ceilingMinutes)}`} style={{ width: percent(allowance.usedMinutes, allowance.ceilingMinutes) }} /></div>
              <span className={styles.tiny}>{allowance.ceilingMinutes !== null ? tr("text_ceiling_policy", "Personal passes count against the monthly ceiling set in the gate-pass policy.") : tr("text_no_ceiling", "No monthly ceiling is configured in the gate-pass policy.")}</span>
            </>
          )}
        </div>

        <div className={styles.quotaCard}>
          <div className={styles.spaceBetween}>
            <span className={styles.statLabel}>{tr("AttendanceView_text_39", "Monthly Request Limit")}</span>
            {allowance?.remainingRequests !== null && allowance?.remainingRequests !== undefined && (
              <span className={`${styles.badge} ${allowance.remainingRequests === 0 ? styles.badgeCoral : styles.badgeBlue}`}>{tr("text_left", "{count} left", { count: allowance.remainingRequests })}</span>
            )}
          </div>
          {!linked ? <p className={styles.tiny}>{tr("text_not_linked_short", "No employee record is linked to your account.")}</p> : !allowance ? <StateNote tr={tr} state={session} compact /> : (
            <>
              <div className={styles.quotaValue}>{allowance.usedRequests} <span className={styles.quotaUnit}>{allowance.requestLimit !== null ? tr("text_of_requests", "/ {limit} requests", { limit: allowance.requestLimit }) : tr("text_requests_unit", "requests")}</span></div>
              <div className={styles.progressBar}><div className={`${styles.progressFill} ${fillClass(allowance.usedRequests, allowance.requestLimit)}`} style={{ width: percent(allowance.usedRequests, allowance.requestLimit) }} /></div>
              <span className={styles.tiny}>{allowance.requestLimit !== null ? tr("text_limit_policy", "Submitted and approved personal passes count towards the limit.") : tr("text_no_request_limit", "No monthly request limit is configured")}</span>
            </>
          )}
        </div>

        <div className={`${styles.quotaCard} ${styles.centerCard}`}>
          <KeyRound size={28} color="var(--signal)" aria-hidden="true" />
          <div className={styles.segmentValue}>{tr("AttendanceView_text_43", "Need Gate Permission?")}</div>
          <p className={styles.tiny}>{tr("AttendanceView_text_44", "Official visits or urgent personal movement during work hours.")}</p>
          <button type="button" className={`${styles.btnPrimary} ${styles.fullWidth}`} onClick={onApply} disabled={!linked || exhausted}>
            <Plus size={15} aria-hidden="true" />{tr("text_apply_gate_pass", "Apply for Gate Pass")}
          </button>
          {exhausted && <span className={styles.tiny}>{tr("text_allowance_used", "This month's allowance is used up.")}</span>}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3>{tr("AttendanceView_text_46", "Gate Pass Applications Ledger")}</h3>
            <p className={styles.muted}>{tr("text_gp_ledger_sub", "Gate passes for the employees you can see, newest first.")}</p>
          </div>
        </div>
        {passes.status !== "ready" ? <StateNote tr={tr} state={passes} onRetry={onReload} /> : passes.data.length === 0 ? (
          <p className={styles.note}>{tr("text_gp_empty", "No gate passes have been requested yet.")}</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{tr("AttendanceView_text_49", "Employee")}</th>
                  <th scope="col">{tr("AttendanceView_text_50", "Date")}</th>
                  <th scope="col">{tr("AttendanceView_text_51", "Type")}</th>
                  <th scope="col">{tr("AttendanceView_text_52", "Duration")}</th>
                  <th scope="col">{tr("AttendanceView_text_53", "Reason")}</th>
                  <th scope="col">{tr("text_decided_by", "Decided by")}</th>
                  <th scope="col">{tr("AttendanceView_text_55", "Status")}</th>
                  <th scope="col">{tr("AttendanceView_text_56", "Net Span Impact")}</th>
                  <th scope="col" className={styles.alignEnd}>{tr("AttendanceView_text_71", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {passes.data.map((pass) => (
                  <tr key={pass.id}>
                    <td><strong>{pass.employee_name || "—"}</strong><div className={styles.mono}>{pass.employee_code}</div></td>
                    <td>{formatDate(locale, pass.date) ?? "—"}</td>
                    <td><span className={`${styles.badge} ${pass.pass_type?.toLowerCase().startsWith("official") ? styles.badgeBlue : styles.badgeAmber}`}>{pass.pass_type ?? "—"}</span></td>
                    <td><strong>{pass.minutes !== null ? tr("text_minutes_value", "{minutes} min", { minutes: pass.minutes }) : "—"}</strong></td>
                    <td className={styles.reasonCell}>{pass.reason ?? "—"}{pass.rejection_note && <div className={styles.dangerText}>{pass.rejection_note}</div>}</td>
                    <td className={styles.mono}>{pass.approver_code ?? "—"}</td>
                    <td><span className={`${styles.badge} ${STATUS_CLASS[pass.status]}`}>{statusLabel(tr, pass.status)}</span></td>
                    <td className={styles.okText}>{(pass.status === "approved" || pass.status === "credited") && pass.minutes !== null ? tr("text_added_to_net", "+{minutes} min added to net", { minutes: pass.minutes }) : "—"}</td>
                    <td className={styles.alignEnd}>
                      {pass.status === "pending_approval" && pass.employee_id !== ownEmployeeId ? (
                        <div className={styles.inline}>
                          <button type="button" className={`${styles.btnPrimary} ${styles.smallBtn}`} disabled={busyId === pass.id} onClick={() => { void decide(pass, true); }}>
                            <CheckCircle2 size={13} aria-hidden="true" />{tr("text_approve", "Approve")}
                          </button>
                          <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn} ${styles.dangerText}`} disabled={busyId === pass.id} onClick={() => setRejecting(pass)}>
                            <XCircle size={13} aria-hidden="true" />{tr("text_reject", "Reject")}
                          </button>
                        </div>
                      ) : <span className={styles.tiny}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DecisionDialog tr={tr} open={rejecting !== null} minLength={1} title={tr("text_reject_gate_pass", "Reject gate pass")}
        subject={rejecting ? `${rejecting.employee_name || rejecting.employee_code} · ${formatDate(locale, rejecting.date) ?? "—"}` : ""}
        onClose={() => setRejecting(null)} onConfirm={(remarks) => (rejecting ? decide(rejecting, false, remarks) : Promise.resolve(null))} />
    </div>
  );
}
