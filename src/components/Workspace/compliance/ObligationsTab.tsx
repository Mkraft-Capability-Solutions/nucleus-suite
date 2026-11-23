"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, formatDate, formatMoney, formatNumber, useT, type Resource } from "./api";
import { FilingReceiptDialog, FilingTransitionDialog } from "./FilingDialogs";
import type { DueBand, FilingRow, StatutoryRegister } from "./types";

/** Statutory obligation calendar: the filing register from GET /api/v1/statutory-register. */

const BAND_CLASS: Record<DueBand, string> = {
  filed: styles.badgeGreen, due_soon: styles.badgeAmber, overdue: styles.badgeAmber, scheduled: styles.badgeBlue, closed: styles.badgeGray, unknown: styles.badgeGray,
};
const BAND_LABEL: Record<DueBand, string> = {
  overdue: "Overdue", due_soon: "Due soon", scheduled: "Scheduled", filed: "Filed", closed: "Closed unfiled", unknown: "No due date",
};

export default function ObligationsTab({ register, reload, notify }: { register: Resource<StatutoryRegister>; reload: () => Promise<void>; notify: (title: string, message: string, tone: "success" | "error") => void }) {
  const { t, locale } = useT();
  const [stateFilter, setStateFilter] = useState("all");
  const [reviewing, setReviewing] = useState<FilingRow | null>(null);
  const [receipt, setReceipt] = useState<FilingRow | null>(null);

  const data = register.status === "ready" ? register.data : null;
  const states = useMemo(() => [...new Set((data?.items ?? []).map((row) => row.stateCode).filter((s) => s && s !== "—"))].sort(), [data]);
  const rows = useMemo(() => (data?.items ?? []).filter((row) => stateFilter === "all" || row.stateCode === stateFilter), [data, stateFilter]);

  if (register.status === "loading") return <p className={styles.stateNote}>{t(`${NS}.ob_loading`, "Loading the filing register…")}</p>;
  if (register.status === "error") {
    return (
      <div className={styles.errorNote} role="alert">
        <span>{register.message}</span>
        <button type="button" className={styles.btnSecondary} onClick={() => void reload()}>{t(`${NS}.retry`, "Retry")}</button>
      </div>
    );
  }
  const reg = register.data;
  const due = reg.bandCounts.overdue + reg.bandCounts.due_soon;
  const total = formatMoney(reg.remittance.totalMinor, reg.remittance.currency, locale);
  const done = (message: string) => {
    setReviewing(null);
    setReceipt(null);
    notify(t(`${NS}.ob_title`, "Statutory filing obligations"), message, "success");
    void reload();
  };

  return (
    <div className={styles.calendarSection}>
      <div className={styles.calendarStats}>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>{t(`${NS}.ob_kpi_due`, "Filings due or overdue")}</span>
          <div className={styles.statNumber}>{formatNumber(due, locale)}</div>
          <span className={styles.statSub}>{t(`${NS}.ob_kpi_due_sub`, "{filed} filed · {overdue} overdue · {scheduled} scheduled", { filed: reg.bandCounts.filed, overdue: reg.bandCounts.overdue, scheduled: reg.bandCounts.scheduled })}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>{t(`${NS}.ob_kpi_remitted`, "Total remitted (recorded)")}</span>
          <div className={styles.statNumber}>{total ?? <span className={styles.unavailable}>{t(`${NS}.not_available`, "Not available")}</span>}</div>
          <span className={styles.statSub}>{reg.remittance.reason ?? t(`${NS}.ob_kpi_remitted_sub`, "{count} recorded outcome(s)", { count: reg.remittance.recordedCount })}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>{t(`${NS}.ob_kpi_audit`, "Audit-ready status")}</span>
          <div className={`${styles.statNumber} ${reg.items.length > 0 && reg.bandCounts.overdue === 0 ? styles.textOk : styles.textWarn}`}>
            {reg.items.length === 0
              ? t(`${NS}.ob_kpi_audit_none`, "No filings registered")
              : reg.bandCounts.overdue === 0
                ? t(`${NS}.ob_kpi_audit_ok`, "No overdue returns")
                : t(`${NS}.ob_kpi_audit_overdue`, "{count} overdue", { count: reg.bandCounts.overdue })}
          </div>
          <span className={styles.statSub}>{t(`${NS}.ob_kpi_as_of`, "As of {date}", { date: formatDate(reg.asOf, locale) ?? reg.asOf })}</span>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3>{t(`${NS}.ob_table_title`, "Statutory filing obligations & challan registry")}</h3>
          <div className={styles.filterBtns} role="group" aria-label={t(`${NS}.ob_filter`, "Filter by jurisdiction")}>
            {["all", ...states].map((code) => (
              <button key={code} type="button" className={stateFilter === code ? styles.filterBtnActive : styles.filterBtn} aria-pressed={stateFilter === code} onClick={() => setStateFilter(code)}>
                {code === "all" ? t(`${NS}.ob_filter_all`, "All jurisdictions") : code}
              </button>
            ))}
          </div>
        </div>
        {reg.scopeNote && <p className={styles.metaLine}>{reg.scopeNote}</p>}
        {rows.length === 0 ? (
          <p className={styles.stateNote}>{reg.items.length === 0 ? t(`${NS}.ob_empty`, "No statutory filings are registered yet. Filings raised in the statutory filing register appear here.") : t(`${NS}.ob_no_match`, "No filing matches this jurisdiction.")}</p>
        ) : (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th scope="col">{t(`${NS}.ob_col_obligation`, "Obligation")}</th>
                <th scope="col">{t(`${NS}.ob_col_jurisdiction`, "Jurisdiction")}</th>
                <th scope="col">{t(`${NS}.ob_col_period`, "Filing period")}</th>
                <th scope="col">{t(`${NS}.ob_col_due`, "Statutory due date")}</th>
                <th scope="col">{t(`${NS}.ob_col_amount`, "Amount remitted")}</th>
                <th scope="col">{t(`${NS}.ob_col_owner`, "Assigned owner")}</th>
                <th scope="col">{t(`${NS}.ob_col_status`, "Status")}</th>
                <th scope="col">{t(`${NS}.ob_col_action`, "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const filed = row.status === "filed" || row.status === "accepted";
                return (
                  <tr key={row.id}>
                    <td><strong>{row.formCode}</strong><div className={styles.tableHint}>{t(`${NS}.status_${row.status}`, row.status)}</div></td>
                    <td>{row.stateCode}</td>
                    <td><span className={styles.periodBadge}>{row.period}</span></td>
                    <td><span className={styles.rowBetween}><Clock size={13} aria-hidden="true" /><strong>{formatDate(row.dueDate, locale) ?? t(`${NS}.not_recorded`, "Not recorded")}</strong></span></td>
                    <td className={styles.boldCell}>{formatMoney(row.outcome?.amountRemittedMinor ?? null, row.outcome?.currency ?? null, locale) ?? <span className={styles.unavailable}>{t(`${NS}.not_recorded`, "Not recorded")}</span>}</td>
                    <td>{row.owner}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${BAND_CLASS[row.band]}`}>
                        {row.band === "filed" && <CheckCircle2 size={12} aria-hidden="true" />}
                        {row.band === "overdue" && <AlertTriangle size={12} aria-hidden="true" />}
                        {t(`${NS}.band_${row.band}`, BAND_LABEL[row.band])}
                      </span>
                    </td>
                    <td>
                      {filed ? (
                        <button type="button" className={styles.btnTableAction} onClick={() => setReceipt(row)}>
                          {row.outcome ? t(`${NS}.ob_view_receipt`, "View receipt") : t(`${NS}.ob_record_outcome`, "Record outcome")}
                        </button>
                      ) : (
                        <button type="button" className={styles.btnTableActionPrimary} onClick={() => setReviewing(row)} disabled={!row.actions.some((a) => a.allowed)}
                          title={row.actions.some((a) => a.allowed) ? undefined : t(`${NS}.filing_no_actions`, "No workflow action is open for a filing that is {status}.", { status: row.status })}>
                          {t(`${NS}.ob_review_file`, "Review & file")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className={styles.metaLine}>{reg.disclaimer}</p>
      </div>

      {reviewing && <FilingTransitionDialog filing={reviewing} onClose={() => setReviewing(null)} onDone={done} />}
      {receipt && <FilingReceiptDialog filing={receipt} disclaimer={reg.disclaimer} onClose={() => setReceipt(null)} onDone={done} />}
    </div>
  );
}
