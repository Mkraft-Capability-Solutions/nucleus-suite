"use client";

import { Badge, ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import { formatDays, formatLeaveDate, useLeaveChanged, useLeaveT, type CompOffEntry, type Resource } from "./leave-client";

const NS = "components.Leave.LeaveCompOffTab";

/** Pure summary of the comp-off clock (unit-tested): open and lapsed days and the soonest expiry. */
export function summariseCompOff(rows: CompOffEntry[]): { openDays: number; lapsedDays: number; nextExpiry: CompOffEntry | null } {
  let openDays = 0;
  let lapsedDays = 0;
  let nextExpiry: CompOffEntry | null = null;
  for (const row of rows) {
    if (row.status === "open") {
      openDays += row.daysRemaining;
      if (row.daysToExpiry !== null && (nextExpiry === null || (nextExpiry.daysToExpiry ?? Infinity) > row.daysToExpiry)) nextExpiry = row;
    } else if (row.status === "lapsed") {
      lapsedDays += row.daysRemaining;
    }
  }
  return { openDays: Math.round(openDays * 100) / 100, lapsedDays: Math.round(lapsedDays * 100) / 100, nextExpiry };
}

/** The 60-day comp-off expiry clock from GET /api/v1/leave/comp-off-clock (own grants for employees). */
export default function LeaveCompOffTab({ resource, reload }: { resource: Resource<CompOffEntry[]>; reload: () => void }) {
  const { t, locale } = useLeaveT();
  useLeaveChanged(reload);
  return (
    <ResourceView resource={resource} onRetry={reload}>
      {(rows) => {
        const summary = summariseCompOff(rows);
        return (
          <div className={styles.stack}>
            <div className={styles.grid}>
              <div className={styles.card}>
                <div className={styles.kpiLabel}>{t(`${NS}.text_open`, "Open comp-off")}</div>
                <div className={`${styles.kpiValue} ${styles.kpiOk}`}>{formatDays(summary.openDays, locale)}<span className={styles.kpiUnit}>{t(`${NS}.text_days`, "days")}</span></div>
                <div className={styles.muted}>{t(`${NS}.text_open_help`, "Usable before each credit's expiry date")}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.kpiLabel}>{t(`${NS}.text_lapsed`, "Lapsed")}</div>
                <div className={`${styles.kpiValue} ${styles.kpiFlag}`}>{formatDays(summary.lapsedDays, locale)}<span className={styles.kpiUnit}>{t(`${NS}.text_days`, "days")}</span></div>
                <div className={styles.muted}>{t(`${NS}.text_lapsed_help`, "Not used within 60 days of being earned")}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.kpiLabel}>{t(`${NS}.text_next`, "Next expiry")}</div>
                <div className={styles.kpiValue}>
                  {summary.nextExpiry ? formatLeaveDate(summary.nextExpiry.expiresOn, locale) : t(`${NS}.text_none`, "None open")}
                </div>
                <div className={styles.muted}>
                  {summary.nextExpiry?.daysToExpiry !== null && summary.nextExpiry
                    ? t(`${NS}.text_in_days`, "in {days} day(s)", { days: summary.nextExpiry.daysToExpiry ?? 0 })
                    : t(`${NS}.text_fifo`, "Oldest credits are used first")}
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h3>{t(`${NS}.text_ledger_title`, "Comp-off credits")}</h3>
                  <p className={styles.sub}>{t(`${NS}.text_ledger_copy`, "Each credit expires 60 days after it was earned.")}</p>
                </div>
              </div>
              {rows.length === 0 ? (
                <div className={styles.state}>{t(`${NS}.text_empty`, "No comp-off credits have been granted.")}</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">{t(`${NS}.col_credit`, "Credit")}</th>
                        <th scope="col">{t(`${NS}.col_employee`, "Employee")}</th>
                        <th scope="col">{t(`${NS}.col_earned`, "Earned on")}</th>
                        <th scope="col">{t(`${NS}.col_expires`, "Expires on")}</th>
                        <th scope="col">{t(`${NS}.col_remaining`, "Days remaining")}</th>
                        <th scope="col">{t(`${NS}.col_status`, "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td className={styles.mono}>{row.creditId ?? row.id.slice(0, 8)}</td>
                          <td>{row.employeeName ?? row.employeeCode ?? "—"}</td>
                          <td>{formatLeaveDate(row.earnedOn, locale)}</td>
                          <td>{formatLeaveDate(row.expiresOn, locale)}{row.status === "open" && row.daysToExpiry !== null ? ` · ${t(`${NS}.text_in_days`, "in {days} day(s)", { days: row.daysToExpiry })}` : ""}</td>
                          <td>{formatDays(row.daysRemaining, locale)}</td>
                          <td>
                            <Badge tone={row.status === "open" ? "ok" : row.status === "lapsed" ? "flag" : "neutral"}>
                              {row.status === "open" ? t(`${NS}.status_open`, "Open") : row.status === "lapsed" ? t(`${NS}.status_lapsed`, "Lapsed") : t(`${NS}.status_consumed`, "Consumed")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </ResourceView>
  );
}
