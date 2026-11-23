"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "../ContractWorkforceView.module.css";
import { NS, formatMinor, postData, type Reconciliation, type Translate } from "./api";

/**
 * CTG-02 variance disposition: POST /api/v1/contractors/reconciliation/{id}/dispute.
 * Client rules mirror disputeInvoiceSchema: reason 3-500 chars (20+ for a query), and accept/reduce need the
 * amount that will be paid, never above the invoiced amount. The queue refreshes only after the server accepts.
 */

type Action = "accept" | "query" | "reduce";
const ACTIONS: Action[] = ["reduce", "query", "accept"];

export default function VarianceDialog({ t, record, onClose, onDone }: { t: Translate; record: Reconciliation; onClose: () => void; onDone: () => void }) {
  const { locale } = useTranslation();
  const [action, setAction] = useState<Action>("reduce");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(record.billedHours > 0 ? String(Math.round(record.verifiedMinor) / 100) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const edited = () => { keyRef.current = null; setServerError(null); };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 500) next.reason = t(`${NS}.text_err_reason`, "Give a reason of 3 to 500 characters.");
    else if (action === "query" && trimmed.length < 20) next.reason = t(`${NS}.text_err_query_reason`, "A query note must explain the challenge in at least 20 characters.");
    if (action !== "query") {
      const value = Number(amount);
      if (amount.trim() === "" || !Number.isFinite(value) || value < 0) next.approvedAmountMinor = t(`${NS}.text_err_amount`, "Enter the amount that will be paid.");
      else if (record.billedMinor > 0 && Math.round(value * 100) > record.billedMinor) next.approvedAmountMinor = t(`${NS}.text_err_amount_max`, "The approved amount cannot exceed the invoice amount of {amount}.", { amount: formatMinor(locale, record.billedMinor, record.currency) });
    }
    return next;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    if (found.reason) { reasonRef.current?.focus(); return; }
    if (found.approvedAmountMinor) { amountRef.current?.focus(); return; }
    keyRef.current ??= crypto.randomUUID();
    setBusy(true);
    const body = { varianceAction: action, reason: reason.trim(), ...(action !== "query" ? { approvedAmountMinor: Math.round(Number(amount) * 100) } : {}) };
    const result = await postData(`/api/v1/contractors/reconciliation/${encodeURIComponent(record.id)}/dispute`, body, keyRef.current, t(`${NS}.text_settle_failed`, "The variance decision could not be recorded. Try again."));
    setBusy(false);
    if (result.status === "error") { setServerError(result.message); setErrors(result.fields); return; }
    onDone();
  };

  const actionLabel = (value: Action) => value === "accept" ? t(`${NS}.text_action_accept`, "Accept the invoice as billed")
    : value === "query" ? t(`${NS}.text_action_query`, "Query the vendor (dispute)") : t(`${NS}.text_action_reduce`, "Reduce to verified amount (debit note)");

  return (
    <div className={styles.modalOverlay} onClick={() => !busy && onClose()}>
      <div className={styles.modalContainer} role="dialog" aria-modal="true" aria-labelledby="cw-variance-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="cw-variance-title">{t(`${NS}.text_settle_title`, "Settle invoice variance · {agency}", { agency: record.agencyName })}</h3>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} /></button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className={styles.formGrid}>
            <fieldset className={`${styles.formGroup} ${styles.formFieldFull}`}>
              <legend>{t(`${NS}.text_variance_action`, "Decision")} *</legend>
              {ACTIONS.map((value) => (
                <label key={value} className={styles.radioRow}>
                  <input type="radio" name="varianceAction" value={value} checked={action === value} onChange={() => { setAction(value); edited(); }} />
                  {actionLabel(value)}
                </label>
              ))}
            </fieldset>
            {action !== "query" && (
              <div className={styles.formGroup}>
                <label htmlFor="cw-approved">{t(`${NS}.text_approved_amount`, "Amount to pay ({currency})", { currency: record.currency })} *</label>
                <input id="cw-approved" ref={amountRef} type="number" min="0" step="0.01" inputMode="decimal" value={amount} aria-required="true"
                  aria-invalid={Boolean(errors.approvedAmountMinor)} aria-describedby={errors.approvedAmountMinor ? "cw-approved-err" : undefined}
                  onChange={(event) => { setAmount(event.target.value); edited(); }} />
                {errors.approvedAmountMinor && <span id="cw-approved-err" className={styles.fieldError}>{errors.approvedAmountMinor}</span>}
              </div>
            )}
            <div className={`${styles.formGroup} ${styles.formFieldFull}`}>
              <label htmlFor="cw-reason">{t(`${NS}.text_reason`, "Reason")} *</label>
              <textarea id="cw-reason" ref={reasonRef} rows={3} maxLength={500} value={reason} aria-required="true"
                aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? "cw-reason-err" : undefined}
                onChange={(event) => { setReason(event.target.value); edited(); }} />
              {errors.reason && <span id="cw-reason-err" className={styles.fieldError}>{errors.reason}</span>}
            </div>
          </div>
          {serverError && <p className={styles.stateError} role="alert">{serverError}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_record_decision`, "Record decision")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
