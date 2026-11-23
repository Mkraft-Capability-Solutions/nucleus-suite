"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import { Download, ShieldCheck, X } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, fieldErrors, formatDate, formatMoney, printRecord, todayIso, useSubmit, useT, type Problem } from "./api";
import type { FilingRow } from "./types";

/**
 * Filing dialogs. Transitions call POST /api/v1/operations/filings/{id}/{action} with If-Match (the row
 * version) and an Idempotency-Key; the outcome form calls POST /api/v1/statutory-register. The row changes
 * only after the server accepts, and the server's message is shown on failure.
 */

const LATE_REASON_MIN = 20;

export function FilingTransitionDialog({ filing, onClose, onDone }: { filing: FilingRow; onClose: () => void; onDone: (message: string) => void }) {
  const { t } = useT();
  const allowed = filing.actions.filter((a) => a.allowed);
  const [action, setAction] = useState(allowed[0]?.action ?? "");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const { submit, pending } = useSubmit();
  const needsAck = action === "file" || action === "accept";
  const errors = fieldErrors(problem);
  const reasonError = reason.trim().length > 0 && reason.trim().length < 3 ? t(`${NS}.err_reason_short`, "Enter at least 3 characters.") : errors.reason;
  const ackError = ack.trim().length > 0 && ack.trim().length < 3 ? t(`${NS}.err_ack_short`, "Enter at least 3 characters.") : errors.acknowledgementReference;
  const valid = action !== "" && reason.trim().length >= 3 && (!ack.trim() || ack.trim().length >= 3);

  const send = async () => {
    if (!valid || pending) return;
    setProblem(null);
    const body: Record<string, string> = { reason: reason.trim() };
    if (needsAck && ack.trim()) body.acknowledgementReference = ack.trim();
    const result = await submit(`/api/v1/operations/filings/${encodeURIComponent(filing.id)}/${encodeURIComponent(action)}`, body,
      t(`${NS}.filing_action_failed`, "The filing could not be updated."), { "If-Match": String(filing.version) });
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onDone(t(`${NS}.filing_action_done`, "{form} {period} updated.", { form: filing.formCode, period: filing.period }));
  };

  return (
    <Dialog open onClose={() => !pending && onClose()} fullWidth maxWidth="sm" aria-labelledby="filing-transition-title">
      <div className={styles.dialogBody}>
        <div className={styles.modalTitle}>
          <h3 id="filing-transition-title">{t(`${NS}.filing_review_title`, "Review and file: {form} · {period}", { form: filing.formCode, period: filing.period })}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={pending} aria-label={t(`${NS}.close`, "Close")}><X size={16} /></button>
        </div>
        {allowed.length === 0 ? (
          <p className={styles.stateNote}>{t(`${NS}.filing_no_actions`, "No workflow action is open for a filing that is {status}.", { status: filing.status })}</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
            <div className={styles.formGrid}>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.filing_action`, "Action")}</span>
                <select className={styles.input} value={action} onChange={(e) => setAction(e.target.value)} aria-required="true">
                  {allowed.map((a) => <option key={a.action} value={a.action}>{t(`${NS}.filing_action_${a.action}`, a.label)}</option>)}
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.filing_reason`, "Reason / review note")}</span>
                <textarea className={styles.input} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-required="true"
                  aria-invalid={reasonError ? "true" : undefined} aria-describedby={reasonError ? "filing-reason-error" : undefined} autoFocus />
                {reasonError && <span id="filing-reason-error" className={styles.fieldError}>{reasonError}</span>}
              </label>
              {needsAck && (
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.fieldLabel}>{t(`${NS}.filing_ack_ref`, "Acknowledgement reference (optional)")}</span>
                  <input className={styles.input} maxLength={160} value={ack} onChange={(e) => setAck(e.target.value)}
                    aria-invalid={ackError ? "true" : undefined} aria-describedby={ackError ? "filing-ack-error" : undefined} />
                  {ackError && <span id="filing-ack-error" className={styles.fieldError}>{ackError}</span>}
                </label>
              )}
            </div>
            {problem && <p className={styles.errorNote} role="alert">{problem.message}</p>}
            <div className={styles.actionsRow}>
              <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={pending}>{t(`${NS}.cancel`, "Cancel")}</button>
              <button type="submit" className={styles.btnPrimary} disabled={!valid || pending}>{pending ? t(`${NS}.saving`, "Saving…") : t(`${NS}.filing_submit`, "Record action")}</button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}

export function FilingReceiptDialog({ filing, disclaimer, onClose, onDone }: { filing: FilingRow; disclaimer: string; onClose: () => void; onDone: (message: string) => void }) {
  const { t, locale } = useT();
  const outcome = filing.outcome;
  const [form, setForm] = useState({ filedOn: todayIso(), acknowledgementNumber: "", amount: "", currency: "INR", challanReference: "", authority: "", lateFilingReason: "" });
  const [problem, setProblem] = useState<Problem | null>(null);
  const { submit, pending } = useSubmit();
  const errors = fieldErrors(problem);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const late = filing.dueDate !== null && form.filedOn > filing.dueDate;
  const amountMinor = form.amount.trim() === "" ? null : Math.round(Number(form.amount) * 100);
  const amountInvalid = amountMinor !== null && (!Number.isFinite(amountMinor) || amountMinor < 0);
  const lateInvalid = late && form.lateFilingReason.trim().length < LATE_REASON_MIN;
  const futureFiled = form.filedOn > todayIso();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(form.filedOn) && !futureFiled && !amountInvalid && !lateInvalid && /^[A-Z]{3}$/.test(form.currency);

  const record = async () => {
    if (!valid || pending) return;
    setProblem(null);
    const body: Record<string, unknown> = { filingId: filing.id, filedOn: form.filedOn, currency: form.currency };
    if (form.acknowledgementNumber.trim()) body.acknowledgementNumber = form.acknowledgementNumber.trim();
    if (amountMinor !== null) body.amountRemittedMinor = amountMinor;
    if (form.challanReference.trim()) body.challanReference = form.challanReference.trim();
    if (form.authority.trim()) body.authority = form.authority.trim();
    if (form.lateFilingReason.trim()) body.lateFilingReason = form.lateFilingReason.trim();
    const result = await submit("/api/v1/statutory-register", body, t(`${NS}.outcome_failed`, "The filing outcome could not be recorded."));
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onDone(t(`${NS}.outcome_done`, "Filing outcome recorded for {form} {period}.", { form: filing.formCode, period: filing.period }));
  };

  const notRecorded = t(`${NS}.not_recorded`, "Not recorded");
  const facts: Array<[string, string]> = outcome
    ? [
        [t(`${NS}.receipt_form`, "Form"), filing.formCode],
        [t(`${NS}.receipt_jurisdiction`, "Jurisdiction"), filing.stateCode],
        [t(`${NS}.receipt_period`, "Wage period"), filing.period],
        [t(`${NS}.receipt_filed_on`, "Filed on"), formatDate(outcome.filedOn, locale) ?? notRecorded],
        [t(`${NS}.receipt_ack`, "Acknowledgement / TRRN"), outcome.acknowledgementNumber ?? notRecorded],
        [t(`${NS}.receipt_challan`, "Challan / bank reference"), outcome.challanReference ?? notRecorded],
        [t(`${NS}.receipt_amount`, "Amount remitted"), formatMoney(outcome.amountRemittedMinor, outcome.currency, locale) ?? notRecorded],
        [t(`${NS}.receipt_authority`, "Authority"), outcome.authority ?? notRecorded],
        [t(`${NS}.receipt_recorded_at`, "Recorded"), formatDate(outcome.recordedAt, locale, true) ?? notRecorded],
        [t(`${NS}.receipt_late`, "Late filing"), outcome.late ? t(`${NS}.receipt_late_days`, "{days} day(s) late: {reason}", { days: outcome.lateByDays ?? 0, reason: outcome.lateFilingReason ?? "" }) : t(`${NS}.receipt_on_time`, "On time")],
      ]
    : [];

  return (
    <Dialog open onClose={() => !pending && onClose()} fullWidth maxWidth="sm" aria-labelledby="filing-receipt-title">
      <div className={styles.dialogBody}>
        <div className={styles.modalTitle}>
          <h3 id="filing-receipt-title">{t(`${NS}.receipt_title`, "Statutory challan evidence")}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={pending} aria-label={t(`${NS}.close`, "Close")}><X size={16} /></button>
        </div>
        <p className={styles.metaLine}>{disclaimer}</p>
        {outcome ? (
          <>
            <div className={styles.receiptProof}>
              <div className={styles.receiptHeader}>
                <ShieldCheck size={28} aria-hidden="true" />
                <div><h4>{filing.formCode} · {filing.period}</h4></div>
              </div>
              <div className={styles.receiptGrid}>
                {facts.map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>)}
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>{t(`${NS}.close`, "Close")}</button>
              <button type="button" className={styles.btnPrimary} onClick={() => printRecord({ title: t(`${NS}.receipt_title`, "Statutory challan evidence"), lang: locale, sections: [{ paragraph: disclaimer }, { rows: facts }] })}>
                <Download size={14} aria-hidden="true" />{t(`${NS}.receipt_print`, "Print receipt")}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void record(); }} noValidate>
            <p className={styles.stateNote}>{t(`${NS}.outcome_intro`, "No outcome is recorded for this filing yet. Record what was filed with the authority.")}</p>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.outcome_filed_on`, "Filed on")}</span>
                <input type="date" className={styles.input} value={form.filedOn} max={todayIso()} onChange={set("filedOn")} aria-required="true" aria-invalid={futureFiled || errors.filedOn ? "true" : undefined} />
                {(futureFiled || errors.filedOn) && <span className={styles.fieldError}>{errors.filedOn ?? t(`${NS}.err_future`, "The date cannot be in the future.")}</span>}
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t(`${NS}.outcome_ack`, "Acknowledgement / TRRN")}</span>
                <input className={styles.input} maxLength={160} value={form.acknowledgementNumber} onChange={set("acknowledgementNumber")} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t(`${NS}.outcome_amount`, "Amount remitted")}</span>
                <input type="number" min={0} step="0.01" inputMode="decimal" className={styles.input} value={form.amount} onChange={set("amount")} aria-invalid={amountInvalid || errors.amountRemittedMinor ? "true" : undefined} />
                {(amountInvalid || errors.amountRemittedMinor) && <span className={styles.fieldError}>{errors.amountRemittedMinor ?? t(`${NS}.err_amount`, "Enter a non-negative amount.")}</span>}
              </label>
              <label className={styles.field}>
                <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.outcome_currency`, "Currency")}</span>
                <input className={styles.input} maxLength={3} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} aria-required="true" />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t(`${NS}.outcome_challan`, "Challan / bank reference")}</span>
                <input className={styles.input} maxLength={160} value={form.challanReference} onChange={set("challanReference")} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t(`${NS}.outcome_authority`, "Authority")}</span>
                <input className={styles.input} maxLength={200} value={form.authority} onChange={set("authority")} />
              </label>
              {late && (
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.outcome_late_reason`, "Late filing reason")}</span>
                  <textarea className={styles.input} rows={3} maxLength={1000} value={form.lateFilingReason} onChange={set("lateFilingReason")} aria-required="true" aria-invalid={lateInvalid ? "true" : undefined} />
                  {(lateInvalid || errors.lateFilingReason) && <span className={styles.fieldError}>{errors.lateFilingReason ?? t(`${NS}.err_late_reason`, "Filed after the due date: explain the delay in at least {min} characters.", { min: LATE_REASON_MIN })}</span>}
                </label>
              )}
            </div>
            {problem && <p className={styles.errorNote} role="alert">{problem.message}</p>}
            <div className={styles.actionsRow}>
              <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={pending}>{t(`${NS}.cancel`, "Cancel")}</button>
              <button type="submit" className={styles.btnPrimary} disabled={!valid || pending}>{pending ? t(`${NS}.saving`, "Saving…") : t(`${NS}.outcome_submit`, "Record outcome")}</button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
