"use client";

import { useState } from "react";
import { Download, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { currentPeriod, downloadText, formatMoney, formatPeriod, sendJson, useResource, useSubmitKey, type ResourceHandle } from "./payroll-client";
import { readJson } from "./payroll-api";
import { DataState, NS, usePayrollT } from "./PayrollParts";
import { runStatusLabel, runTypeDescription, runTypeLabel } from "./payroll-labels";
import type { DisbursementBatch, PayrollRun } from "./payroll-types";
import styles from "../PayrollView.module.css";

/** Run scopes shown in the legend, in the order the run-type picklist (PL_RUN_TYPE) declares them. */
const RUN_SCOPES = ["regular", "ot", "arrears", "full_final", "bonus", "reimbursement"] as const;
/** `payDateAllowed` in src/server/payroll/service.ts: these run types may pay inside their period. */
const IN_PERIOD_SCOPES = new Set(["ot", "full_final", "reimbursement"]);

/** Display-only run code, same derivation as `displayRunCode` on the server. */
function runCode(period: string, id: string): string {
  return `PR-${period}-${(id.replace(/-/g, "").slice(0, 4) || "0000").toUpperCase()}`;
}

type Props = {
  runs: ResourceHandle<PayrollRun[]>;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
};

export default function PayrollRunsTab({ runs, notify }: Props) {
  const { t, locale } = usePayrollT();
  const batches = useResource<DisbursementBatch[]>("/api/v1/disbursements?pageSize=100");
  const [pending, setPending] = useState<string | null>(null);
  const submitKey = useSubmitKey();

  const createRun = async (runType: "off_cycle_overtime" | "arrears") => {
    if (pending) return;
    const title = runType === "arrears" ? t(`${NS}.text_new_arrears_run`, "New retro arrears run") : t(`${NS}.text_new_ot_run`, "New off-cycle OT run");
    const body = { period: currentPeriod(), runType, includeArrears: runType === "arrears" };
    setPending(runType);
    const result = await sendJson<{ id: string }>("/api/v1/payroll-runs", body, { key: submitKey.key(JSON.stringify(body)), fallbackError: t(`${NS}.text_save_failed`, "This could not be saved. Check the details and try again.") });
    setPending(null);
    if (!result.ok) {
      notify(title, result.message, "error");
      return;
    }
    submitKey.reset();
    notify(title, t(`${NS}.text_run_created`, "A draft run for {period} was created.", { period: formatPeriod(body.period, locale) ?? body.period }), "success");
    runs.reload();
  };

  const exportBankFile = async (batch: DisbursementBatch) => {
    const result = await readJson<{ file?: { name: string; content: string } }>(`/api/v1/disbursements/${encodeURIComponent(batch.id)}`);
    const title = t(`${NS}.text_export_bank_file`, "Export bank file");
    if (!result.ok || !result.data?.file) {
      notify(title, result.ok ? t(`${NS}.text_bank_file_missing`, "The batch has no bank file.") : result.message, "error");
      return;
    }
    downloadText(result.data.file.name, result.data.file.content, "text/plain;charset=utf-8");
    notify(title, t(`${NS}.text_bank_file_masked`, "Control copy downloaded. Account numbers are masked; the bank-ready file is released only through the disbursement workflow."), "success");
  };

  const batchFor = (runId: string): DisbursementBatch | null =>
    batches.state.status === "ready" ? (batches.state.data.find((batch) => batch.payrollRunId === runId && batch.state !== "superseded") ?? null) : null;

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.accentInfo}`} aria-labelledby="payroll-runs-title">
        <div className={styles.rowBetween}>
          <div>
            <h3 id="payroll-runs-title" className={styles.sectionTitle}><RefreshCw size={20} aria-hidden="true" />{t(`${NS}.text_multi_run_title`, "Multi-run payroll architecture")}</h3>
            <p className={styles.intro}>{t(`${NS}.text_multi_run_intro`, "Payroll is partitioned into run types. Overtime is paid off-cycle after salary, while retro adjustments and exit settlements run as their own bank batches without changing the regular cycle.")}</p>
          </div>
          <div className={styles.row}>
            <button type="button" className={styles.btnSecondary} disabled={pending !== null} onClick={() => void createRun("off_cycle_overtime")}>
              <Zap size={14} aria-hidden="true" />{pending === "off_cycle_overtime" ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_new_ot_run`, "New off-cycle OT run")}
            </button>
            <button type="button" className={styles.btnSecondary} disabled={pending !== null} onClick={() => void createRun("arrears")}>
              <TrendingUp size={14} aria-hidden="true" />{pending === "arrears" ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_new_arrears_run`, "New retro arrears run")}
            </button>
          </div>
        </div>
        <div className={styles.legendGrid}>
          {RUN_SCOPES.map((scope) => (
            <div key={scope} className={styles.legendItem}>
              <strong className={styles.strongText}>{runTypeLabel(t, scope)}</strong>
              <p>{runTypeDescription(t, scope)}</p>
              <p className={styles.micro}>{IN_PERIOD_SCOPES.has(scope) ? t(`${NS}.text_pay_in_period`, "Pay date: any day in the period") : t(`${NS}.text_pay_after_period`, "Pay date: on or after period end")}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.tableContainer} aria-labelledby="payroll-runs-table">
        <div className={styles.tableHeader}>
          <strong id="payroll-runs-table" className={styles.strongText}>{t(`${NS}.text_runs_table`, "Payroll batches and disbursal history")}</strong>
          {runs.state.status === "ready" && <span className={styles.micro}>{t(`${NS}.text_total_runs`, "Runs shown: {count}", { count: runs.state.data.length })}</span>}
        </div>
        <DataState resource={runs.state} onRetry={runs.reload} isEmpty={(rows) => rows.length === 0} emptyText={t(`${NS}.text_no_runs`, "No payroll run has been created yet.")}>
          {(rows) => (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th scope="col">{t(`${NS}.text_batch_id`, "Batch ID")}</th>
                    <th scope="col">{t(`${NS}.text_run_type`, "Run type")}</th>
                    <th scope="col">{t(`${NS}.text_period`, "Period")}</th>
                    <th scope="col">{t(`${NS}.text_employees`, "Employees")}</th>
                    <th scope="col">{t(`${NS}.text_net_disbursement`, "Net disbursement")}</th>
                    <th scope="col">{t(`${NS}.text_status`, "Status")}</th>
                    <th scope="col">{t(`${NS}.text_bank_file`, "Bank file")}</th>
                    <th scope="col">{t(`${NS}.text_actions`, "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((run) => {
                    const batch = batchFor(run.id);
                    return (
                      <tr key={run.id}>
                        <td className={styles.numeric}>{runCode(run.period, run.id)}</td>
                        <td><span className={`${styles.badge} ${styles.badgeInfo}`}>{runTypeLabel(t, run.scope)}</span></td>
                        <td>{formatPeriod(run.period, locale) ?? run.period}</td>
                        <td className={styles.numeric}>{run.employee_count}</td>
                        <td className={`${styles.numeric} ${styles.positive}`}>{formatMoney(Number(run.net_minor), run.currency, locale)}</td>
                        <td><span className={`${styles.badge} ${run.status === "finalized" || run.status === "paid" ? styles.badgeSuccess : styles.badgeWarning}`}>{runStatusLabel(t, run.status)}</span></td>
                        <td>
                          {batch ? <code className={styles.code}>{batch.fileReference || batch.fileName}</code>
                            : batches.state.status === "error" ? <span className={styles.micro}>{batches.state.message}</span>
                            : <span className={styles.micro}>{t(`${NS}.text_no_bank_file`, "Not prepared")}</span>}
                        </td>
                        <td>
                          <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} disabled={!batch} onClick={() => batch && void exportBankFile(batch)}
                            title={batch ? t(`${NS}.text_export_bank_title`, "Download the masked control copy of the bank file") : t(`${NS}.text_no_bank_file_title`, "Prepare a disbursement batch for this run first")}>
                            <Download size={13} aria-hidden="true" />{t(`${NS}.text_export_neft`, "Export NEFT")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </section>
    </div>
  );
}
