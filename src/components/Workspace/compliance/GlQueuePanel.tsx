"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import { CheckCircle, Eye, Scale, Send, X } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, formatDate, formatMoney, useResource, useSubmit, useT, type Problem } from "./api";
import GlBatchDialog from "./GlBatchDialog";
import type { GlBatch } from "./types";

/** GL posting queue from GET /api/v1/compliance/gl-dispatch; transitions via POST on the same route. */

type Notify = (title: string, message: string, tone: "success" | "error") => void;
const STATUS_CLASS: Record<string, string> = { reconciled: styles.tagGreen, posted: styles.tagBlue, queued: styles.tagAmber, draft: styles.tagAmber, failed: styles.tagAmber };

function AckDialog({ batch, onClose, onSaved }: { batch: GlBatch; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [ref, setRef] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const { submit, pending } = useSubmit();
  const valid = ref.trim().length >= 3;
  const save = async () => {
    if (!valid || pending) return;
    const result = await submit("/api/v1/compliance/gl-dispatch", { action: "acknowledge", batchId: batch.id, acknowledgementRef: ref.trim() }, t(`${NS}.gl_action_failed`, "The GL batch could not be updated."));
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onSaved();
  };
  return (
    <Dialog open onClose={() => !pending && onClose()} fullWidth maxWidth="sm" aria-labelledby="gl-ack-title">
      <div className={styles.dialogBody}>
        <div className={styles.modalTitle}>
          <h3 id="gl-ack-title">{t(`${NS}.gl_ack_title`, "Record ERP acknowledgement")}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={pending} aria-label={t(`${NS}.close`, "Close")}><X size={16} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <label className={styles.field}>
            <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.gl_ack_ref`, "Document reference issued by the ERP")}</span>
            <input className={styles.input} value={ref} maxLength={160} onChange={(e) => setRef(e.target.value)} aria-required="true" autoFocus
              aria-invalid={problem?.details.some((d) => d.field === "acknowledgementRef") ? "true" : undefined} />
          </label>
          {problem && <p className={styles.errorNote} role="alert">{problem.message}</p>}
          <div className={styles.actionsRow}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={pending}>{t(`${NS}.cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={!valid || pending}>{pending ? t(`${NS}.saving`, "Saving…") : t(`${NS}.gl_ack_submit`, "Record acknowledgement")}</button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export default function GlQueuePanel({ notify }: { notify: Notify }) {
  const { t, locale } = useT();
  const queue = useResource<{ batches: GlBatch[] }>("/api/v1/compliance/gl-dispatch", t(`${NS}.gl_failed`, "The GL posting queue could not be loaded."));
  const [inspect, setInspect] = useState<GlBatch | null>(null);
  const [acking, setAcking] = useState<GlBatch | null>(null);
  const { submit, pending } = useSubmit();
  const title = t(`${NS}.gl_title`, "GL posting queue");

  const move = async (batch: GlBatch, action: "dispatch" | "reconcile") => {
    const result = await submit("/api/v1/compliance/gl-dispatch", { action, batchId: batch.id }, t(`${NS}.gl_action_failed`, "The GL batch could not be updated."));
    if (!result.ok) {
      notify(title, result.problem?.message ?? "", "error");
      return;
    }
    notify(title, action === "dispatch" ? t(`${NS}.gl_dispatched`, "Batch queued for ERP delivery.") : t(`${NS}.gl_reconciled`, "Batch reconciled."), "success");
    await queue.reload();
  };
  const batches = queue.state.status === "ready" ? queue.state.data.batches : [];
  const allBalanced = batches.length > 0 && batches.every((b) => b.balanced);

  return (
    <div className={styles.cardPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h3><Scale size={18} aria-hidden="true" /> {t(`${NS}.gl_heading`, "Finance-grade ERP GL posting queue with acknowledgement tracking")}</h3>
          <p>{t(`${NS}.gl_subtitle`, "Balanced salary journals from finalized payroll, with debits and credits summed from the stored lines.")}</p>
        </div>
        {batches.length > 0 && (
          <span className={allBalanced ? styles.allocationValidBadge : styles.allocationInvalidBadge}>
            {allBalanced ? t(`${NS}.gl_all_balanced`, "Δ = 0.00 on every batch") : t(`${NS}.gl_some_unbalanced`, "Some batches do not balance")}
          </span>
        )}
      </div>
      {queue.state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.loading`, "Loading…")}</p>}
      {queue.state.status === "error" && <div className={styles.errorNote} role="alert"><span>{queue.state.message}</span><button type="button" className={styles.btnSecondary} onClick={() => void queue.reload()}>{t(`${NS}.retry`, "Retry")}</button></div>}
      {queue.state.status === "ready" && batches.length === 0 && <p className={styles.stateNote}>{t(`${NS}.gl_empty`, "No GL batches yet. A batch is created when a finalized payroll run is posted to accounting.")}</p>}
      {batches.length > 0 && (
        <div className={styles.musterTableWrap}>
          <table className={styles.musterTable}>
            <thead>
              <tr>
                <th scope="col">{t(`${NS}.gl_col_batch`, "Posting batch")}</th>
                <th scope="col">{t(`${NS}.gl_col_period`, "Period & target ERP")}</th>
                <th scope="col">{t(`${NS}.gl_col_cc`, "Cost centre")}</th>
                <th scope="col">{t(`${NS}.gl_col_dr_cr`, "Debits / credits")}</th>
                <th scope="col">{t(`${NS}.gl_col_variance`, "Variance (Δ)")}</th>
                <th scope="col">{t(`${NS}.gl_col_state`, "Posting state")}</th>
                <th scope="col">{t(`${NS}.gl_col_ack`, "ERP acknowledgement")}</th>
                <th scope="col">{t(`${NS}.gl_col_actions`, "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const money = (minor: number) => formatMoney(minor, b.currency, locale) ?? "";
                const centres = [...new Set(b.lines.map((l) => l.costCentre).filter((c): c is string => Boolean(c)))];
                return (
                  <tr key={b.id}>
                    <td><strong className={styles.mono}>{b.id.slice(0, 8)}</strong><div className={styles.metaLine}>{formatDate(b.createdAt, locale) ?? ""}</div></td>
                    <td><strong>{b.period ?? t(`${NS}.not_recorded`, "Not recorded")}</strong><div className={styles.metaLine}>{b.connector ?? t(`${NS}.gl_no_connector`, "No connection linked")}</div></td>
                    <td>{centres.length === 0 ? <span className={styles.unavailable}>{t(`${NS}.not_recorded`, "Not recorded")}</span> : <span className={styles.rowBetween}>{centres.map((c) => <span key={c} className={styles.tagBlue}>{c}</span>)}</span>}</td>
                    <td className={styles.mono}><div>{t(`${NS}.gl_dr`, "Dr {amount}", { amount: money(b.lineDebitMinor) })}</div><div>{t(`${NS}.gl_cr`, "Cr {amount}", { amount: money(b.lineCreditMinor) })}</div></td>
                    <td>{b.balanced ? <span className={styles.tagGreen}>{t(`${NS}.gl_balanced`, "Δ = 0.00")}</span> : <span className={styles.tagAmber}>{t(`${NS}.gl_variance`, "Δ = {amount}", { amount: money(b.varianceMinor) })}</span>}</td>
                    <td><span className={STATUS_CLASS[b.status] ?? styles.tagAmber}>{t(`${NS}.gl_status_${b.status}`, b.status)}</span></td>
                    <td>{b.acknowledgementRef ? <span className={styles.mono}>{b.acknowledgementRef}</span> : <span className={styles.unavailable}>{t(`${NS}.gl_ack_pending`, "Awaiting acknowledgement")}</span>}</td>
                    <td>
                      <span className={styles.rowBetween}>
                        {(b.status === "draft" || b.status === "failed") && <button type="button" className={`${styles.btnPrimary} ${styles.smallBtn}`} disabled={pending || !b.balanced} onClick={() => void move(b, "dispatch")}><Send size={11} aria-hidden="true" />{t(`${NS}.gl_dispatch`, "Dispatch")}</button>}
                        {b.status === "queued" && <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} disabled={pending} onClick={() => setAcking(b)}>{t(`${NS}.gl_record_ack`, "Record ack")}</button>}
                        {b.status === "posted" && <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} disabled={pending || !b.balanced} onClick={() => void move(b, "reconcile")}><CheckCircle size={11} aria-hidden="true" />{t(`${NS}.gl_reconcile`, "Reconcile")}</button>}
                        <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={() => setInspect(b)} title={t(`${NS}.gl_inspect_title`, "Inspect journal & export formats")}><Eye size={11} aria-hidden="true" />{t(`${NS}.gl_inspect`, "Inspect")}</button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {inspect && <GlBatchDialog batch={inspect} onClose={() => setInspect(null)} />}
      {acking && <AckDialog batch={acking} onClose={() => setAcking(null)} onSaved={() => { setAcking(null); notify(title, t(`${NS}.gl_acked`, "ERP acknowledgement recorded."), "success"); void queue.reload(); }} />}
    </div>
  );
}
