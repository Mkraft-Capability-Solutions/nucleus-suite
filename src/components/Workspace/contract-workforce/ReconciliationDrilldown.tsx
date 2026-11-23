"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { downloadPrintableDocument } from "@/utils/exportUtils";
import styles from "../ContractWorkforceView.module.css";
import { NS, errorText, formatMinor, formatNumber, getData, type Loadable, type ReconciliationDetail, type Translate } from "./api";
import { verdictLabel } from "./labels";

/** One invoice's per-worker turnstile breakdown and audit trail from GET /api/v1/contractors/reconciliation/{id}. */
export default function ReconciliationDrilldown({ t, id, onClose }: { t: Translate; id: string; onClose: () => void }) {
  const { locale } = useTranslation();
  const [state, setState] = useState<Loadable<ReconciliationDetail>>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const failed = t(`${NS}.text_detail_load_failed`, "The invoice breakdown could not be loaded.");
    getData<ReconciliationDetail>(`/api/v1/contractors/reconciliation/${encodeURIComponent(id)}`, failed, controller.signal)
      .then(({ data }) => setState({ status: "ready", data }))
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ status: "error", message: errorText(error, failed) }); });
    return () => controller.abort();
  }, [id, t]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hrs = (value: number) => t(`${NS}.text_hours_value`, "{hours} hrs", { hours: formatNumber(locale, value) });
  const date = (iso: string) => new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  const download = () => {
    if (state.status !== "ready") return;
    const rec = state.data;
    downloadPrintableDocument(`Vendor_Recon_${rec.agencyName.replace(/\s+/g, "_")}_${rec.period}`, {
      [t(`${NS}.text_vendor_agency`, "Vendor / Agency")]: rec.agencyName,
      [t(`${NS}.text_billing_period`, "Billing period")]: rec.period,
      [t(`${NS}.text_vendor_billed`, "Vendor billed")]: `${hrs(rec.billedHours)} · ${formatMinor(locale, rec.billedMinor, rec.currency)}`,
      [t(`${NS}.text_gate_turnstile`, "Gate turnstile")]: `${hrs(rec.verifiedHours)} · ${formatMinor(locale, rec.verifiedMinor, rec.currency)}`,
      [t(`${NS}.text_variance`, "Variance")]: `${hrs(rec.deltaHours)} (${formatNumber(locale, rec.variancePct, 2)}%)`,
      [t(`${NS}.text_status`, "Status")]: verdictLabel(t, rec.verdict),
    }, [t(`${NS}.text_badge_id`, "Badge ID"), t(`${NS}.text_contract_worker`, "Contract worker"), t(`${NS}.text_col_trade`, "Trade / Role"),
      t(`${NS}.text_agency_billed`, "Agency billed"), t(`${NS}.text_biometric_turnstile`, "Biometric turnstile"), t(`${NS}.text_variance`, "Variance")],
    rec.workerLogs.map((w) => [w.workerCode, w.workerName, w.trade, w.billedHours, w.verifiedHours, w.deltaHours]));
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalLarge} role="dialog" aria-modal="true" aria-labelledby="cw-drilldown-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 id="cw-drilldown-title">{t(`${NS}.text_drilldown_title`, "Turnstile punch drilldown: {agency}", { agency: state.status === "ready" ? state.data.agencyName : "…" })}</h3>
            {state.status === "ready" && <span>{state.data.site || t(`${NS}.text_no_site`, "Site not linked")} · {state.data.period}</span>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t(`${NS}.text_close`, "Close")}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.text_detail_loading`, "Loading worker logs…")}</p>}
          {state.status === "error" && <p className={styles.stateError} role="alert">{state.message}</p>}
          {state.status === "ready" && (
            <>
              <div className={styles.tableScroll}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th scope="col">{t(`${NS}.text_badge_id`, "Badge ID")}</th>
                      <th scope="col">{t(`${NS}.text_contract_worker`, "Contract worker")}</th>
                      <th scope="col">{t(`${NS}.text_agency_billed`, "Agency billed")}</th>
                      <th scope="col">{t(`${NS}.text_biometric_turnstile`, "Biometric turnstile")}</th>
                      <th scope="col">{t(`${NS}.text_variance`, "Variance")}</th>
                      <th scope="col">{t(`${NS}.text_anomaly_analysis`, "Anomaly analysis")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.workerLogs.length === 0 ? (
                      <tr><td colSpan={6} className={styles.emptyCell}>{t(`${NS}.text_no_worker_logs`, "No workers are assigned to this contract, so there are no turnstile logs to compare.")}</td></tr>
                    ) : state.data.workerLogs.map((w) => (
                      <tr key={w.id}>
                        <td><code>{w.workerCode || "—"}</code></td>
                        <td><strong>{w.workerName || t(`${NS}.text_not_recorded`, "Not recorded")}</strong></td>
                        <td>{hrs(w.billedHours)}</td>
                        <td className={styles.boldCell}>{hrs(w.verifiedHours)}</td>
                        <td className={w.deltaHours > 0 ? styles.textRed : undefined}>{w.deltaHours > 0 ? "+" : ""}{hrs(w.deltaHours)}</td>
                        <td>
                          <span className={w.deltaHours > 0 ? styles.tagRed : styles.tagGreen}>
                            {w.deltaHours > 0 ? t(`${NS}.text_anomaly_over`, "Billed above gate") : w.deltaHours < 0 ? t(`${NS}.text_anomaly_under`, "Billed below gate") : t(`${NS}.text_anomaly_match`, "Matches gate")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className={styles.subHeading}>{t(`${NS}.text_audit_trail`, "Audit trail")}</h4>
              {state.data.auditTrail.length === 0 ? (
                <p className={styles.stateNote}>{t(`${NS}.text_audit_empty`, "No decisions have been recorded on this invoice yet.")}</p>
              ) : (
                <ol className={styles.auditList}>
                  {state.data.auditTrail.map((entry) => (
                    <li key={entry.id}><time dateTime={entry.created_at}>{date(entry.created_at)}</time> · <strong>{entry.action}</strong>{entry.reason ? ` · ${entry.reason}` : ""}</li>
                  ))}
                </ol>
              )}

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={onClose}>{t(`${NS}.text_close`, "Close")}</button>
                <button type="button" className={styles.btnPrimary} onClick={download} title={t(`${NS}.title_download_vendor_reconciliation_invoice_s`, "Download Vendor Reconciliation Invoice Sheet")}>
                  <Download size={14} aria-hidden="true" />{t(`${NS}.text_download_sheet`, "Download reconciliation sheet")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
