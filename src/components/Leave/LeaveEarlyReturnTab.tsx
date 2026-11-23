"use client";

import { RotateCcw } from "lucide-react";
import { LeaveStatusBadge, ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import { formatDays, formatLeaveDate, useLeaveChanged, useLeaveResource, useLeaveT, type EarlyReturnEntry, type LeaveContext, type LeaveRequestRow } from "./leave-client";

const NS = "components.Leave.LeaveEarlyReturnTab";

/** Pure totals over recorded early returns (unit-tested); a return with no ledger credit counts as unknown. */
export function summariseEarlyReturns(rows: EarlyReturnEntry[]): { count: number; recredited: number; unknown: number; latest: EarlyReturnEntry | null } {
  let recredited = 0;
  let unknown = 0;
  for (const row of rows) {
    if (row.recreditedDays === null) unknown += 1;
    else recredited += row.recreditedDays;
  }
  return { count: rows.length, recredited: Math.round(recredited * 100) / 100, unknown, latest: rows[0] ?? null };
}

/**
 * Early return re-credit: approved leave still open (GET /api/v1/leave-requests/register?status=approved)
 * and the returns already recorded with their ledger re-credit (GET /api/v1/leave/early-returns).
 */
export default function LeaveEarlyReturnTab({ ctx, onEarlyReturn }: { ctx: LeaveContext | null; onEarlyReturn: (row: LeaveRequestRow) => void }) {
  const { t, locale } = useLeaveT();
  const approved = useLeaveResource<LeaveRequestRow[]>("/api/v1/leave-requests/register?status=approved", t(`${NS}.text_failed`, "Approved leave could not be loaded."));
  const returns = useLeaveResource<EarlyReturnEntry[]>("/api/v1/leave/early-returns", t(`${NS}.text_returns_failed`, "Early returns could not be loaded."));
  useLeaveChanged(approved.reload);
  useLeaveChanged(returns.reload);
  const canRecord = Boolean(ctx?.canMaintain || ctx?.canApprove);

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h3>{t(`${NS}.text_rule_title`, "How an early return is settled")}</h3>
            <p className={styles.sub}>{t(`${NS}.text_rule_copy`, "When an employee resumes work before the approved end date, the request is short-closed on the return date and the unused approved days are credited back to the same leave type. Attendance from the return date is marked present unless the period is locked.")}</p>
          </div>
        </div>
        <ResourceView resource={returns.state} onRetry={returns.reload}>
          {(rows) => {
            const summary = summariseEarlyReturns(rows);
            return (
              <div className={styles.grid}>
                <div><div className={styles.kpiLabel}>{t(`${NS}.text_count`, "Early returns recorded")}</div><div className={styles.kpiValue}>{formatDays(summary.count, locale)}</div></div>
                <div>
                  <div className={styles.kpiLabel}>{t(`${NS}.text_recredited`, "Days re-credited")}</div>
                  <div className={`${styles.kpiValue} ${styles.kpiOk}`}>{formatDays(summary.recredited, locale)}</div>
                  {summary.unknown > 0 && <div className={styles.muted}>{t(`${NS}.text_unknown`, "{count} return(s) have no ledger credit on record", { count: summary.unknown })}</div>}
                </div>
                <div>
                  <div className={styles.kpiLabel}>{t(`${NS}.text_latest`, "Latest return")}</div>
                  <div className={styles.kpiValue}>{summary.latest ? formatLeaveDate(summary.latest.actualReturnDate, locale) : t(`${NS}.text_none`, "None yet")}</div>
                  {summary.latest && <div className={styles.muted}>{summary.latest.employeeName ?? summary.latest.employeeCode}</div>}
                </div>
              </div>
            );
          }}
        </ResourceView>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}><h3>{t(`${NS}.text_eligible_title`, "Approved leave open for early return")}</h3></div>
        <ResourceView resource={approved.state} onRetry={approved.reload} isEmpty={(rows) => rows.every((row) => row.actual_return_date)} empty={t(`${NS}.text_no_eligible`, "No approved leave is open.")}>
          {(rows) => (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t(`${NS}.col_employee`, "Employee")}</th>
                    <th scope="col">{t(`${NS}.col_type`, "Leave type")}</th>
                    <th scope="col">{t(`${NS}.col_period`, "Approved period")}</th>
                    <th scope="col">{t(`${NS}.col_days`, "Days")}</th>
                    <th scope="col">{t(`${NS}.col_status`, "Status")}</th>
                    <th scope="col">{t(`${NS}.col_action`, "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((row) => !row.actual_return_date).map((row) => (
                    <tr key={row.id}>
                      <td>{row.employee_name ?? row.employee_code}</td>
                      <td>{row.leave_type_name ?? row.leave_type}</td>
                      <td>{formatLeaveDate(row.starts_on, locale)} – {formatLeaveDate(row.ends_on, locale)}</td>
                      <td>{formatDays(row.requested_days, locale)}</td>
                      <td><LeaveStatusBadge rawStatus={row.raw_status} /></td>
                      <td>
                        {canRecord ? (
                          <button type="button" className={`${styles.secondary} ${styles.small}`} onClick={() => onEarlyReturn(row)}>
                            <RotateCcw size={12} aria-hidden="true" /> {t(`${NS}.button_record`, "Record early return")}
                          </button>
                        ) : (
                          <span className={styles.muted}>{t(`${NS}.text_hr_only`, "Recorded by HR")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ResourceView>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}><h3>{t(`${NS}.text_recorded_title`, "Early returns recorded")}</h3></div>
        <ResourceView resource={returns.state} onRetry={returns.reload} isEmpty={(rows) => rows.length === 0} empty={t(`${NS}.text_no_returns`, "No early returns have been recorded.")}>
          {(rows) => (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t(`${NS}.col_employee`, "Employee")}</th>
                    <th scope="col">{t(`${NS}.col_type`, "Leave type")}</th>
                    <th scope="col">{t(`${NS}.col_period`, "Approved period")}</th>
                    <th scope="col">{t(`${NS}.col_returned`, "Returned on")}</th>
                    <th scope="col">{t(`${NS}.col_recredited`, "Re-credited")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.employeeName ?? row.employeeCode}</td>
                      <td>{row.leaveType}</td>
                      <td>{formatLeaveDate(row.startsOn, locale)} – {formatLeaveDate(row.endsOn, locale)}</td>
                      <td>{formatLeaveDate(row.actualReturnDate, locale)}</td>
                      <td>{row.recreditedDays === null ? t(`${NS}.text_not_recorded`, "Not on the ledger") : formatDays(row.recreditedDays, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ResourceView>
      </div>
    </div>
  );
}
