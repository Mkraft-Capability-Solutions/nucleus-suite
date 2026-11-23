"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "../ContractWorkforceView.module.css";
import { NS, formatMoney, type Loadable, type Translate } from "./api";
import { categoryLabel, complianceLabel } from "./labels";
import type { WorkerPage } from "../ContractWorkforceView";

type Props = {
  t: Translate; state: Loadable<WorkerPage>; search: string; page: number; pageSize: number;
  onSearch: (value: string) => void; onPage: (page: number) => void; onRetry: () => void;
};

/** Principal-employer register from GET /api/v1/contractors/assignments (server-side search and pagination). */
export default function WorkerRegistryTab({ t, state, search, page, pageSize, onSearch, onPage, onRetry }: Props) {
  const { locale } = useTranslation();
  const notRecorded = t(`${NS}.text_not_recorded`, "Not recorded");
  const total = state.status === "ready" ? state.data.total : 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={styles.workersSection}>
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3>{t(`${NS}.text_registry_title`, "Principal employer contract worker registry")}</h3>
          <input type="search" className={styles.searchInput} value={search} onChange={(event) => onSearch(event.target.value)}
            placeholder={t(`${NS}.placeholder_search_worker_by_name_trade_vendor_site`, "Search worker by name, trade, vendor, site...")}
            aria-label={t(`${NS}.placeholder_search_worker_by_name_trade_vendor_site`, "Search worker by name, trade, vendor, site...")} />
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th scope="col">{t(`${NS}.text_worker_details`, "Worker Details")}</th>
                <th scope="col">{t(`${NS}.text_vendor_agency`, "Vendor / Agency")}</th>
                <th scope="col">{t(`${NS}.text_statutory_kyc_uan_esic`, "Statutory KYC (UAN / ESIC)")}</th>
                <th scope="col">{t(`${NS}.text_work_site`, "Work Site")}</th>
                <th scope="col">{t(`${NS}.text_trade_rest_day_policy`, "Trade & Rest Day Policy")}</th>
                <th scope="col">{t(`${NS}.text_compliance`, "Compliance")}</th>
              </tr>
            </thead>
            <tbody>
              {state.status === "loading" && <tr><td colSpan={6} className={styles.emptyCell}>{t(`${NS}.text_workers_loading`, "Loading the worker register…")}</td></tr>}
              {state.status === "error" && (
                <tr><td colSpan={6} className={styles.emptyCell} role="alert">
                  {state.message} <button type="button" className={styles.btnSecondary} onClick={onRetry}>{t(`${NS}.text_retry`, "Retry")}</button>
                </td></tr>
              )}
              {state.status === "ready" && state.data.rows.length === 0 && (
                <tr><td colSpan={6} className={styles.emptyCell}>
                  {search ? t(`${NS}.text_workers_no_match`, "No worker matches your search.") : t(`${NS}.text_workers_empty`, "No contract workers are registered yet.")}
                </td></tr>
              )}
              {state.status === "ready" && state.data.rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <code>{w.workerCode ?? "—"}</code>
                    <div className={styles.workerName}>{w.name ?? notRecorded}</div>
                  </td>
                  <td>{w.agencyName ?? notRecorded}{w.contractCode && <div className={styles.uanText}>{w.contractCode}</div>}</td>
                  <td>
                    <div className={styles.uanText}>{t(`${NS}.text_uan`, "UAN:")} {w.uan ?? notRecorded}</div>
                    <div className={styles.uanText}>{t(`${NS}.text_esic`, "ESIC:")} {w.esicNumber ?? notRecorded}</div>
                  </td>
                  <td>{w.site ?? notRecorded}</td>
                  <td>
                    <div><strong>{w.trade ?? notRecorded}</strong></div>
                    <div className={styles.uanText}>{categoryLabel(t, w.category)}</div>
                    <div className={styles.pillRow}>
                      <span className={styles.bandPill}>
                        {w.dailyWage !== null ? t(`${NS}.text_wage_per_day`, "{amount}/day", { amount: formatMoney(locale, w.dailyWage, w.currency) }) : t(`${NS}.text_wage_not_recorded`, "Wage not recorded")}
                      </span>
                      <span className={w.hasRestDays ? styles.restYes : styles.restNo}>
                        {w.hasRestDays ? t(`${NS}.text_rest_days_eligible`, "Rest Days: Eligible") : t(`${NS}.text_daily_wages_no_rest_days`, "Daily Wages · No Rest Days")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${w.compliance === "verified" ? styles.stApproved : styles.stAction}`}>
                      {w.compliance === "verified" ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
                      {complianceLabel(t, w.compliance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.status === "ready" && total > pageSize && (
          <nav className={styles.pager} aria-label={t(`${NS}.text_pagination`, "Register pages")}>
            <button type="button" className={styles.btnSecondary} disabled={page <= 1} onClick={() => onPage(page - 1)}>{t(`${NS}.text_previous`, "Previous")}</button>
            <span>{t(`${NS}.text_page_of`, "Page {page} of {pages} · {total} workers", { page, pages, total })}</span>
            <button type="button" className={styles.btnSecondary} disabled={page >= pages} onClick={() => onPage(page + 1)}>{t(`${NS}.text_next`, "Next")}</button>
          </nav>
        )}
      </div>
    </div>
  );
}
