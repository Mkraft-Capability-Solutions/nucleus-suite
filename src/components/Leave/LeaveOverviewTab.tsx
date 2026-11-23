"use client";

import { Calendar, RotateCcw } from "lucide-react";
import { LeaveStatusBadge, ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import { formatDays, formatLeaveDate, useLeaveChanged, useLeaveResource, useLeaveT, type BalanceCard, type LeaveContext, type LeaveRequestRow } from "./leave-client";

const NS = "components.Leave.LeaveOverviewTab";

/**
 * "Balances & apply": the caller's ledger balances (GET /api/v1/leave/balance-cards),
 * the apply entry point and the leave register they may see (own requests for
 * employees, the tenant for HR/approvers) with the early-return action for HR.
 */
export default function LeaveOverviewTab({ ctx, onApply, onEarlyReturn }: { ctx: LeaveContext | null; onApply: () => void; onEarlyReturn: (row: LeaveRequestRow) => void }) {
  const { t, locale } = useLeaveT();
  const own = ctx?.employee ?? null;
  const cards = useLeaveResource<BalanceCard[]>(own ? `/api/v1/leave/balance-cards?employeeId=${own.id}` : null, t(`${NS}.text_balance_failed`, "Balances could not be loaded."));
  const history = useLeaveResource<LeaveRequestRow[]>("/api/v1/leave-requests/register", t(`${NS}.text_history_failed`, "Leave history could not be loaded."));
  useLeaveChanged(cards.reload);
  useLeaveChanged(history.reload);
  const canRecordReturn = Boolean(ctx?.canMaintain || ctx?.canApprove);

  return (
    <div className={styles.stack}>
      {ctx && !own && <div className={styles.state}>{t(`${NS}.text_no_employee`, "Your login is not linked to an employee record, so there is no personal balance to show.")}</div>}
      {own && (
        <ResourceView resource={cards.state} onRetry={cards.reload} isEmpty={(data) => data.length === 0} empty={t(`${NS}.text_no_balance`, "No leave has been credited to you yet.")}>
          {(data) => (
            <div className={styles.grid}>
              {data.map((card) => (
                <article key={card.leaveType} className={styles.card}>
                  <div className={styles.kpiLabel}>{card.leaveTypeName ?? card.leaveType}</div>
                  <div className={styles.kpiValue}>{formatDays(card.available, locale)}<span className={styles.kpiUnit}>{t(`${NS}.text_available`, "available")}</span></div>
                  <div className={styles.muted}>{t(`${NS}.text_of_allocated`, "of {allocated} allocated · {availed} availed", { allocated: formatDays(card.allocated, locale), availed: formatDays(card.availed, locale) })}</div>
                </article>
              ))}
            </div>
          )}
        </ResourceView>
      )}
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHead}><h3>{t(`${NS}.text_apply_title`, "Request leave")}</h3></div>
          <p className={styles.sub}>{t(`${NS}.text_apply_copy`, "Submit a request; it goes to your supervisor, then the HOD and HR. Days are reserved until the final decision.")}</p>
          <div className={styles.mt}>
            <button type="button" className={styles.primary} onClick={onApply}><Calendar size={15} aria-hidden="true" /> {t(`${NS}.button_apply`, "Apply leave")}</button>
          </div>
        </div>
        <div className={`${styles.card} ${styles.span2}`}>
          <div className={styles.cardHead}><h3>{t(`${NS}.text_history_title`, "Leave history")}</h3></div>
          <ResourceView resource={history.state} onRetry={history.reload} isEmpty={(data) => data.length === 0} empty={t(`${NS}.text_no_history`, "No leave requests yet.")}>
            {(data) => (
              <div className={styles.list}>
                {data.slice(0, 20).map((row) => (
                  <div key={row.id} className={styles.item}>
                    <div>
                      <div className={styles.itemTitle}>{row.leave_type_name ?? row.leave_type}{ctx?.actsForOthers && row.employee_name ? ` · ${row.employee_name}` : ""}</div>
                      <div className={styles.itemMeta}>{formatLeaveDate(row.starts_on, locale)} – {formatLeaveDate(row.ends_on, locale)} · {t(`${NS}.text_days`, "{days} day(s)", { days: formatDays(row.requested_days, locale) })}</div>
                      {row.reason && <div className={styles.itemMeta}>{row.reason}</div>}
                    </div>
                    <div className={styles.row}>
                      <LeaveStatusBadge rawStatus={row.raw_status} actualReturnDate={row.actual_return_date} />
                      {row.raw_status === "approved" && !row.actual_return_date && canRecordReturn && (
                        <button type="button" className={`${styles.secondary} ${styles.small}`} onClick={() => onEarlyReturn(row)}>
                          <RotateCcw size={12} aria-hidden="true" /> {t(`${NS}.button_early_return`, "Early return")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ResourceView>
        </div>
      </div>
    </div>
  );
}
