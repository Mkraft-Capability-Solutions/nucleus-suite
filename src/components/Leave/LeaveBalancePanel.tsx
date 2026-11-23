"use client";

import { useState } from "react";
import LeaveEmployeeSelect from "./LeaveEmployeeSelect";
import LeaveAdjustmentDialog from "./LeaveAdjustmentDialog";
import { ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import {
  formatDays,
  formatLeaveDate,
  useLeaveChanged,
  useLeaveResource,
  useLeaveT,
  type BalanceCard,
  type CompOffEntry,
  type LeaveContext,
  type LeaveEmployee,
} from "./leave-client";

const NS = "components.Leave.LeaveBalancePanel";

type RequestRow = { id: string; leave_type: string; requested_days: number; status: string };

/**
 * Balance summary for the caller (or, for HR/approvers, any employee they pick):
 * ledger cards from /api/v1/leave/balance-cards, days held by pending requests
 * from /api/v1/leave-requests and comp-off credits from /api/v1/leave/comp-off-clock.
 */
export default function LeaveBalancePanel() {
  const { t, locale } = useLeaveT();
  const context = useLeaveResource<LeaveContext>("/api/v1/leave/context", t(`${NS}.text_context_failed`, "Your leave profile could not be loaded."));
  const ctx = context.state.status === "ready" ? context.state.data : null;
  const [picked, setPicked] = useState<LeaveEmployee | null>(null);
  const employee = picked ?? ctx?.employee ?? null;
  const [adjusting, setAdjusting] = useState(false);
  const cards = useLeaveResource<BalanceCard[]>(employee ? `/api/v1/leave/balance-cards?employeeId=${employee.id}` : null, t(`${NS}.text_failed`, "Balances could not be loaded."));
  const requests = useLeaveResource<RequestRow[]>(employee ? `/api/v1/leave-requests?employeeId=${employee.id}&pageSize=100` : null, t(`${NS}.text_failed`, "Balances could not be loaded."));
  const coff = useLeaveResource<CompOffEntry[]>("/api/v1/leave/comp-off-clock", t(`${NS}.text_coff_failed`, "Comp-off credits could not be loaded."));
  useLeaveChanged(cards.reload);
  useLeaveChanged(requests.reload);
  useLeaveChanged(coff.reload);

  const pendingFor = (code: string) =>
    requests.state.status === "ready"
      ? requests.state.data.filter((row) => row.leave_type === code && row.status.toLowerCase().startsWith("pending")).reduce((sum, row) => sum + Number(row.requested_days || 0), 0)
      : null;
  const credits = coff.state.status === "ready" && employee ? coff.state.data.filter((row) => row.employeeCode === employee.employeeCode) : [];
  const typeNames = cards.state.status === "ready" ? Object.fromEntries(cards.state.data.map((card) => [card.leaveType, card.leaveTypeName ?? card.leaveType])) : {};

  return (
    <section className={styles.stack} aria-labelledby="leave-balance-title">
      <div className={styles.spread}>
        <h3 id="leave-balance-title" className={styles.itemTitle}>{t(`${NS}.text_title`, "Balance summary")}</h3>
        <div className={styles.row}>
          {ctx?.actsForOthers && (
            <div className={styles.picker}>
              <LeaveEmployeeSelect label={t(`${NS}.label_scope`, "Employee")} value={employee} onChange={setPicked} />
            </div>
          )}
          {ctx?.canMaintain && (
            <button type="button" className={styles.secondary} disabled={!employee} onClick={() => setAdjusting(true)}>
              {t(`${NS}.button_adjust`, "Adjust allocation")}
            </button>
          )}
        </div>
      </div>
      {context.state.status === "error" && <ResourceView resource={context.state} onRetry={context.reload}>{() => null}</ResourceView>}
      {ctx && !employee && <div className={styles.state}>{t(`${NS}.text_no_employee`, "Your login is not linked to an employee record, so there is no balance to show.")}</div>}
      {employee && (
        <ResourceView resource={cards.state} onRetry={cards.reload} isEmpty={(data) => data.length === 0} empty={t(`${NS}.text_no_allocation`, "No leave has been credited to this employee yet.")}>
          {(data) => (
            <div className={styles.grid}>
              {data.map((card) => {
                const pending = pendingFor(card.leaveType);
                return (
                  <article key={card.leaveType} className={styles.card}>
                    <div className={styles.kpiLabel}>{card.leaveTypeName ?? card.leaveType}</div>
                    <div className={styles.kpiValue}>{formatDays(card.available, locale)}<span className={styles.kpiUnit}>{t(`${NS}.text_days`, "days")}</span></div>
                    <div className={styles.muted}>{t(`${NS}.text_allocated_availed`, "Allocated {allocated} · Availed {availed}", { allocated: formatDays(card.allocated, locale), availed: formatDays(card.availed, locale) })}</div>
                    <div className={styles.muted}>
                      {pending === null ? t(`${NS}.text_pending_unknown`, "Pending: not available") : t(`${NS}.text_pending`, "Pending approval: {days}", { days: formatDays(pending, locale) })}
                    </div>
                    {card.accrualNote && <div className={styles.muted}>{card.accrualNote}</div>}
                    {card.leaveType === "COFF" && credits.length > 0 && (
                      <details className={styles.details}>
                        <summary>{t(`${NS}.text_credit_history`, "Credit history")}</summary>
                        {credits.map((credit) => (
                          <div key={credit.id} className={styles.muted}>
                            {formatLeaveDate(credit.earnedOn, locale)} → {formatLeaveDate(credit.expiresOn, locale)} · {formatDays(credit.daysRemaining, locale)}
                          </div>
                        ))}
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </ResourceView>
      )}
      {adjusting && <LeaveAdjustmentDialog employee={employee} typeNames={typeNames} onClose={() => setAdjusting(false)} />}
    </section>
  );
}
