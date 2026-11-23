"use client";

import { useState } from "react";
import { LeaveStatusBadge, ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import { formatDays, formatLeaveDate, todayIso, useLeaveResource, useLeaveT, type LeaveContext, type LeaveRequestRow } from "./leave-client";
import type { LeaveAction } from "./LeaveDecisionDialog";

const NS = "components.Leave.LeaveRequestCard";

type AuditRow = { id: string; action: string; reason: string | null; created_at: string };
type RecordDetail = { auditTrail: AuditRow[] };

/** Allowed actions for the caller on one request (the server re-checks every one). */
export function allowedActions(request: LeaveRequestRow, ctx: LeaveContext | null, today = todayIso()): LeaveAction[] {
  if (!ctx) return [];
  const status = request.raw_status.toLowerCase();
  const own = ctx.employee?.id === request.employee_id;
  const actions: LeaveAction[] = [];
  const pending = status.startsWith("pending") && !request.actual_return_date;
  if (pending && ctx.canApprove && !own) actions.push("approve", "reject");
  if ((own || ctx.canMaintain) && pending) actions.push("withdraw");
  if ((own || ctx.canMaintain) && status === "approved" && !request.actual_return_date && (request.starts_on ?? "") > today) actions.push("cancel");
  return actions;
}

const LABELS: Record<LeaveAction, [string, string]> = {
  approve: ["button_approve", "Approve"],
  reject: ["button_reject", "Reject"],
  withdraw: ["button_withdraw", "Withdraw"],
  cancel: ["button_cancel", "Cancel leave"],
};

function History({ id }: { id: string }) {
  const { t, locale } = useLeaveT();
  const { state, reload } = useLeaveResource<RecordDetail>(`/api/v1/leave-requests/register/${encodeURIComponent(id)}`, t(`${NS}.text_history_failed`, "The history could not be loaded."));
  return (
    <ResourceView resource={state} onRetry={reload} isEmpty={(data) => data.auditTrail.length === 0} empty={t(`${NS}.text_no_history`, "No history recorded.")}>
      {(data) => (
        <ol className={styles.list}>
          {data.auditTrail.map((entry) => (
            <li key={entry.id} className={styles.itemMeta}>
              {formatLeaveDate(entry.created_at, locale)} · <span className={styles.mono}>{entry.action}</span>{entry.reason ? ` · ${entry.reason}` : ""}
            </li>
          ))}
        </ol>
      )}
    </ResourceView>
  );
}

export default function LeaveRequestCard({ request, ctx, onAction }: { request: LeaveRequestRow; ctx: LeaveContext | null; onAction: (action: LeaveAction) => void }) {
  const { t, locale } = useLeaveT();
  const [showHistory, setShowHistory] = useState(false);
  const actions = allowedActions(request, ctx);
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h4>{request.employee_name ?? request.employee_code ?? t(`${NS}.text_unknown_employee`, "Employee not on record")}</h4>
          <div className={styles.itemMeta}>{request.leave_type_name ?? request.leave_type}{request.department ? ` · ${request.department}` : ""}</div>
        </div>
        <LeaveStatusBadge rawStatus={request.raw_status} actualReturnDate={request.actual_return_date} />
      </div>
      <div className={styles.itemMeta}>
        {formatLeaveDate(request.starts_on, locale)} – {formatLeaveDate(request.ends_on, locale)} · {t(`${NS}.text_days`, "{days} day(s)", { days: formatDays(request.requested_days, locale) })}
      </div>
      {request.reason && <p className={styles.sub}>{request.reason}</p>}
      {actions.length > 0 && (
        <div className={`${styles.row} ${styles.mt}`}>
          {actions.map((action) => (
            <button key={action} type="button" className={`${action === "approve" ? styles.primary : action === "reject" ? styles.danger : styles.secondary} ${styles.small}`} onClick={() => onAction(action)}>
              {t(`${NS}.${LABELS[action][0]}`, LABELS[action][1])}
            </button>
          ))}
        </div>
      )}
      <details className={`${styles.details} ${styles.mt}`} onToggle={(event) => setShowHistory((event.target as HTMLDetailsElement).open)}>
        <summary>{t(`${NS}.text_history`, "Approval history")}</summary>
        {showHistory && <History id={request.id} />}
      </details>
    </article>
  );
}
