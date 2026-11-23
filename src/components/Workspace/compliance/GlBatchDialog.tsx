"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import { CheckCircle2, Database, FileSpreadsheet, FileText, X } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, formatMoney, useT } from "./api";
import type { GlBatch } from "./types";

/** Journal inspector: stored lines, and exports built + audited on the server (GET .../gl-dispatch/{id}/export). */

const FORMATS = [
  { id: "sap_idoc", icon: FileText, key: "gl_export_sap", label: "Export SAP IDoc (FIDCCP02)" },
  { id: "netsuite_csv", icon: FileSpreadsheet, key: "gl_export_netsuite", label: "Export NetSuite CSV" },
  { id: "tally_xml", icon: Database, key: "gl_export_tally", label: "Export Tally Prime XML" },
] as const;

export default function GlBatchDialog({ batch, onClose }: { batch: GlBatch; onClose: () => void }) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const money = (minor: number) => formatMoney(minor, batch.currency, locale) ?? "";

  const download = async (format: string) => {
    setBusy(format);
    setError(null);
    try {
      const response = await fetch(`/api/v1/compliance/gl-dispatch/${encodeURIComponent(batch.id)}/export?format=${format}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message || t(`${NS}.gl_export_failed`, "The export could not be built."));
      }
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? `gl-${batch.id}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(`${NS}.gl_export_failed`, "The export could not be built."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="gl-batch-title">
      <div className={styles.dialogBody}>
        <div className={styles.modalTitle}>
          <div>
            <h3 id="gl-batch-title">{t(`${NS}.gl_journal_title`, "General ledger journal: {period}", { period: batch.period ?? batch.id })}</h3>
            <p className={styles.metaLine}>{t(`${NS}.gl_target`, "Target ERP: {name}", { name: batch.connector ?? t(`${NS}.gl_no_connector`, "No connection linked") })}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t(`${NS}.close`, "Close")}><X size={16} /></button>
        </div>
        <div className={styles.toolbar}>
          {FORMATS.map((f) => (
            <button key={f.id} type="button" className={styles.btnSecondary} onClick={() => void download(f.id)} disabled={busy !== null || batch.lines.length === 0}>
              <f.icon size={13} aria-hidden="true" />{busy === f.id ? t(`${NS}.gl_exporting`, "Preparing…") : t(`${NS}.${f.key}`, f.label)}
            </button>
          ))}
        </div>
        {error && <p className={styles.errorNote} role="alert">{error}</p>}
        {batch.lines.length === 0 ? (
          <p className={styles.stateNote}>{t(`${NS}.gl_no_lines`, "This batch has no journal lines.")}</p>
        ) : (
          <div className={`${styles.musterTableWrap} ${styles.scrollTable}`}>
            <table className={styles.musterTable}>
              <thead>
                <tr>
                  <th scope="col">{t(`${NS}.gl_col_account`, "Account & component")}</th>
                  <th scope="col">{t(`${NS}.gl_col_cc`, "Cost centre")}</th>
                  <th scope="col">{t(`${NS}.gl_col_type`, "Type")}</th>
                  <th scope="col">{t(`${NS}.gl_col_amount`, "Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {batch.lines.map((line) => (
                  <tr key={line.id}>
                    <td><strong className={styles.mono}>{line.accountCode}</strong><div className={styles.metaLine}>{line.componentCode} · {line.narration}</div></td>
                    <td>{line.costCentre ? <span className={styles.tagBlue}>{line.costCentre}</span> : <span className={styles.unavailable}>{t(`${NS}.not_recorded`, "Not recorded")}</span>}</td>
                    <td><span className={line.debitMinor > 0 ? styles.tagAmber : styles.tagGreen}>{line.debitMinor > 0 ? t(`${NS}.gl_debit`, "Debit") : t(`${NS}.gl_credit`, "Credit")}</span></td>
                    <td className={`${styles.mono} ${styles.boldCell}`}>{money(line.debitMinor || line.creditMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.actionsRow}>
          <span className={batch.balanced ? styles.allocationValidBadge : styles.allocationInvalidBadge}>
            <CheckCircle2 size={13} aria-hidden="true" />
            {t(`${NS}.gl_totals`, "Debits {debit} · Credits {credit} · Δ {variance}", { debit: money(batch.lineDebitMinor), credit: money(batch.lineCreditMinor), variance: money(batch.varianceMinor) })}
          </span>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>{t(`${NS}.close`, "Close")}</button>
        </div>
      </div>
    </Dialog>
  );
}
