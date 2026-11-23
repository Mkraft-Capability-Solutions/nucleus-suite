"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, X } from "lucide-react";
import { decimalAmount, downloadText, formatMoney, formatPeriod, useResource, type ResourceHandle } from "./payroll-client";
import { DataState, NS, Notice, usePayrollT } from "./PayrollParts";
import { runTypeLabel } from "./payroll-labels";
import type { JournalView, LegalEntity, PayrollRun } from "./payroll-types";
import styles from "../PayrollView.module.css";

/**
 * Balanced salary journal for one run, from GET /api/v1/payroll-runs/:id/journal
 * (payroll.accounting.read). The Tally export is built from those journal lines,
 * so the file always equals what is on screen; a blocked journal (unmapped
 * components) cannot be exported.
 */

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

export function buildTallyXml(journal: JournalView, currency: string, entityName: (id: string) => string): string {
  const vouchers = journal.journals.map((entry, index) => {
    const lines = entry.lines.map((line) => {
      const debit = line.debitMinor > 0;
      const minor = debit ? line.debitMinor : line.creditMinor;
      const amount = decimalAmount(debit ? -minor : minor, currency);
      return `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xml(`${line.accountCode} ${line.accountName}`)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${debit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
    }).join("\n");
    return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${journal.asOf.replace(/-/g, "")}</DATE>
            <NARRATION>${xml(`Payroll journal ${journal.period} ${journal.runType} - ${entityName(entry.legalEntityId)}`)}</NARRATION>
            <VOUCHERNUMBER>${xml(`SAL-${journal.period.replace("-", "")}-${String(index + 1).padStart(3, "0")}`)}</VOUCHERNUMBER>
${lines}
          </VOUCHER>
        </TALLYMESSAGE>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`;
}

export default function SalaryJournalModal({ runs, entities, onClose, notify }: {
  runs: ResourceHandle<PayrollRun[]>;
  entities: LegalEntity[];
  onClose: () => void;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
}) {
  const { t } = usePayrollT();
  const title = t(`${NS}.text_journal_title`, "Balanced salary journal (general ledger)");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={`${styles.modalContent} ${styles.modalWide}`} role="dialog" aria-modal="true" aria-labelledby="journal-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="journal-title" className={styles.sectionTitle}>{title}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className={styles.modalBody}>
          <DataState resource={runs.state} onRetry={runs.reload} isEmpty={(rows) => rows.length === 0} emptyText={t(`${NS}.text_no_runs`, "No payroll run has been created yet.")}>
            {(rows) => <JournalBody runs={rows} entities={entities} title={title} onClose={onClose} notify={notify} />}
          </DataState>
        </div>
      </div>
    </div>
  );
}

function JournalBody({ runs, entities, title, onClose, notify }: {
  runs: PayrollRun[];
  entities: LegalEntity[];
  title: string;
  onClose: () => void;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
}) {
  const { t, locale } = usePayrollT();
  const [runId, setRunId] = useState(runs[0]?.id ?? "");
  const journal = useResource<JournalView>(runId ? `/api/v1/payroll-runs/${encodeURIComponent(runId)}/journal` : null);
  const run = runs.find((item) => item.id === runId) ?? null;
  const currency = run?.currency ?? "INR";
  const entityName = (id: string) => entities.find((entity) => entity.id === id)?.legal_name ?? id;

  const exportTally = (data: JournalView) => {
    downloadText(`Salary_Journal_${data.period}_Tally.xml`, buildTallyXml(data, currency, entityName), "application/xml");
    notify(title, t(`${NS}.text_tally_exported`, "Tally Prime XML exported for {period}.", { period: formatPeriod(data.period, locale) ?? data.period }), "success");
  };

  return (
    <>
              <div className={styles.formGroup}>
                <label htmlFor="journal-run">{t(`${NS}.text_journal_run`, "Payroll run")}</label>
                <select id="journal-run" className={styles.select} value={runId} onChange={(event) => setRunId(event.target.value)}>
                  {runs.map((item) => <option key={item.id} value={item.id}>{`${formatPeriod(item.period, locale) ?? item.period} · ${runTypeLabel(t, item.scope)}`}</option>)}
                </select>
                {run && <span className={styles.micro}>{t(`${NS}.text_journal_sub`, "Period: {period} · Run: {type}", { period: formatPeriod(run.period, locale) ?? run.period, type: runTypeLabel(t, run.scope) })}</span>}
              </div>
              <DataState resource={journal.state} onRetry={journal.reload}>
                {(data) => data.blocked ? (
                  <Notice tone="error">
                    {t(`${NS}.text_journal_blocked`, "The journal is blocked: these components have no GL mapping — {codes}.", { codes: data.unmapped.map((item) => item.componentCode).join(", ") })}
                  </Notice>
                ) : (
                  <>
                    <Notice tone={data.balanced ? "ok" : "error"}>
                      <CheckCircle2 size={16} aria-hidden="true" />{" "}
                      {data.balanced
                        ? t(`${NS}.text_journal_balanced`, "Balanced: debits equal credits (residual {residual}).", { residual: formatMoney(data.residualMinor, currency, locale) })
                        : t(`${NS}.text_journal_unbalanced`, "Not balanced: residual {residual}.", { residual: formatMoney(data.residualMinor, currency, locale) })}
                    </Notice>
                    {data.journals.length === 0 ? (
                      <div className={styles.stateBox} role="note">{t(`${NS}.text_journal_empty`, "This run has no posted payroll lines yet.")}</div>
                    ) : (
                      <div className={styles.tableWrap}>
                        <table className={styles.dataTable}>
                          <thead>
                            <tr>
                              <th scope="col">{t(`${NS}.text_gl_account`, "GL account")}</th>
                              <th scope="col">{t(`${NS}.text_entity`, "Legal entity")}</th>
                              <th scope="col">{t(`${NS}.text_debit`, "Debit")}</th>
                              <th scope="col">{t(`${NS}.text_credit`, "Credit")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.journals.flatMap((entry) => entry.lines.map((line, index) => (
                              <tr key={`${entry.legalEntityId}-${line.accountCode}-${line.componentCode ?? ""}-${index}`}>
                                <td><strong>{line.accountCode}</strong> {line.accountName}{line.componentCode ? <div className={styles.micro}>{line.componentCode}</div> : null}</td>
                                <td>{entityName(entry.legalEntityId)}</td>
                                <td className={styles.numeric}>{line.debitMinor > 0 ? formatMoney(line.debitMinor, currency, locale) : "—"}</td>
                                <td className={styles.numeric}>{line.creditMinor > 0 ? formatMoney(line.creditMinor, currency, locale) : "—"}</td>
                              </tr>
                            )))}
                            <tr>
                              <td colSpan={2}><strong>{t(`${NS}.text_journal_total`, "Total journal posting")}</strong></td>
                              <td className={styles.numeric}><strong>{formatMoney(data.totalDebitMinor, currency, locale)}</strong></td>
                              <td className={styles.numeric}><strong>{formatMoney(data.totalCreditMinor, currency, locale)}</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className={styles.row}>
                      <button type="button" className={styles.btnSecondary} onClick={onClose}>{t(`${NS}.text_close`, "Close")}</button>
                      <button type="button" className={styles.btnPrimary} disabled={!data.balanced || data.journals.length === 0} onClick={() => exportTally(data)}>
                        <Download size={14} aria-hidden="true" />{t(`${NS}.text_export_tally`, "Export Tally Prime XML")}
                      </button>
                    </div>
                  </>
                )}
              </DataState>
    </>
  );
}
