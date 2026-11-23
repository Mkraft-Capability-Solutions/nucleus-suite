"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "../ContractWorkforceView.module.css";
import { NS, formatMinor, formatNumber, type Loadable, type Reconciliation, type Translate } from "./api";
import { verdictLabel } from "./labels";
import ReconciliationDrilldown from "./ReconciliationDrilldown";
import VarianceDialog from "./VarianceDialog";

/** Gate punch vs vendor invoice queue from GET /api/v1/contractors/reconciliation. */
export default function ReconciliationTab({ t, state, onRetry, onChanged }: { t: Translate; state: Loadable<Reconciliation[]>; onRetry: () => void; onChanged: () => void }) {
  const { locale } = useTranslation();
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [settle, setSettle] = useState<Reconciliation | null>(null);

  if (state.status === "loading") return <p className={styles.stateNote}>{t(`${NS}.text_recon_loading`, "Loading the reconciliation queue…")}</p>;
  if (state.status === "error") {
    return (
      <div className={styles.stateError} role="alert">
        <span>{state.message}</span>
        <button type="button" className={styles.btnSecondary} onClick={onRetry}>{t(`${NS}.text_retry`, "Retry")}</button>
      </div>
    );
  }
  const rows = state.data;
  if (rows.length === 0) {
    return <p className={styles.stateNote}>{t(`${NS}.text_recon_empty`, "No contractor invoices have been submitted yet, so there is nothing to reconcile.")}</p>;
  }

  const flagged = rows.filter((row) => row.verdict === "action_required" && row.deltaHours > 0);
  const flaggedHours = flagged.reduce((sum, row) => sum + row.deltaHours, 0);
  const currencies = new Set(flagged.map((row) => row.currency));
  const flaggedMinor = flagged.reduce((sum, row) => sum + Math.max(0, row.billedMinor - row.verifiedMinor), 0);
  const agencyCount = new Set(flagged.map((row) => row.agencyName)).size;

  return (
    <div className={styles.reconSection}>
      <div className={styles.reconBanner}>
        <ShieldAlert size={20} aria-hidden="true" />
        <div>
          <strong>{t(`${NS}.text_banner_title`, "Biometric gate vs vendor invoice discrepancy engine:")}</strong>{" "}
          {flagged.length === 0
            ? t(`${NS}.text_banner_clear`, "Every invoice in the queue is within the contract tolerance.")
            : currencies.size === 1
              ? t(`${NS}.text_banner_flagged`, "{hours} hours billed above gate-verified attendance across {agencies} agencies, worth {amount}.", {
                hours: formatNumber(locale, flaggedHours), agencies: agencyCount, amount: formatMinor(locale, flaggedMinor, [...currencies][0] ?? "INR"),
              })
              : t(`${NS}.text_banner_flagged_hours`, "{hours} hours billed above gate-verified attendance across {agencies} agencies.", { hours: formatNumber(locale, flaggedHours), agencies: agencyCount })}
        </div>
      </div>

      <div className={styles.reconGrid}>
        {rows.map((rec) => {
          const overMinor = Math.max(0, rec.billedMinor - rec.verifiedMinor);
          const badge = rec.verdict === "approved" || rec.verdict === "within_tolerance" ? styles.stApproved : rec.verdict === "disputed" ? styles.stDebit : styles.stAction;
          return (
            <article key={rec.id} className={styles.reconCard}>
              <div className={styles.reconCardHead}>
                <div>
                  <span className={styles.recId}>{rec.period || t(`${NS}.text_no_period`, "No period")}</span>
                  <h4>{rec.agencyName}</h4>
                  <span className={styles.siteText}>{rec.site || t(`${NS}.text_no_site`, "Site not linked")} · {t(`${NS}.text_worker_count`, "{count} workers", { count: rec.workerCount })}</span>
                </div>
                <span className={`${styles.statusBadge} ${badge}`}>{verdictLabel(t, rec.verdict)}</span>
              </div>

              <div className={styles.comparisonMetrics}>
                <div className={styles.metricBlock}>
                  <span>{t(`${NS}.text_vendor_billed`, "Vendor billed")}</span>
                  <strong>{t(`${NS}.text_hours_value`, "{hours} hrs", { hours: formatNumber(locale, rec.billedHours) })}</strong>
                  <div className={styles.metricCost}>{formatMinor(locale, rec.billedMinor, rec.currency)}</div>
                </div>
                <div className={styles.arrowBlock}>{t(`${NS}.text_vs`, "vs")}</div>
                <div className={styles.metricBlock}>
                  <span>{t(`${NS}.text_gate_turnstile`, "Gate turnstile")}</span>
                  <strong>{t(`${NS}.text_hours_value`, "{hours} hrs", { hours: formatNumber(locale, rec.verifiedHours) })}</strong>
                  <div className={styles.metricCostVerified}>{rec.billedHours > 0 ? formatMinor(locale, rec.verifiedMinor, rec.currency) : t(`${NS}.text_no_hourly_basis`, "No hourly basis")}</div>
                </div>
              </div>

              {rec.deltaHours !== 0 && (
                <div className={styles.discrepancyBox}>
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>
                    {rec.deltaHours > 0
                      ? t(`${NS}.text_overbilled`, "Overbilled by {hours} hrs ({pct}%) = {amount}", { hours: formatNumber(locale, rec.deltaHours), pct: formatNumber(locale, rec.variancePct, 2), amount: formatMinor(locale, overMinor, rec.currency) })
                      : t(`${NS}.text_underbilled`, "Billed {hours} hrs below gate attendance ({pct}%)", { hours: formatNumber(locale, Math.abs(rec.deltaHours)), pct: formatNumber(locale, rec.variancePct, 2) })}
                  </span>
                </div>
              )}

              <div className={styles.reconActions}>
                {rec.verdict === "action_required" && (
                  <button type="button" className={styles.btnDebitNote} onClick={() => setSettle(rec)}>
                    {t(`${NS}.text_issue_debit_note`, "Settle variance (debit note {amount})", { amount: formatMinor(locale, overMinor, rec.currency) })}
                  </button>
                )}
                <button type="button" className={rec.verdict === "action_required" ? styles.btnInspect : styles.btnSecondary} onClick={() => setInspectId(rec.id)}>
                  {t(`${NS}.text_inspect_logs`, "Inspect {count} worker logs and audit trail", { count: rec.workerCount })}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {inspectId && <ReconciliationDrilldown t={t} id={inspectId} onClose={() => setInspectId(null)} />}
      {settle && <VarianceDialog t={t} record={settle} onClose={() => setSettle(null)} onDone={() => { setSettle(null); onChanged(); }} />}
    </div>
  );
}
