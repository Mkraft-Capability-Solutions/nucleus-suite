"use client";

import { useState, type FormEvent } from "react";
import { XCircle } from "lucide-react";
import styles from "../AttendanceView.module.css";
import AttendanceDialog from "./AttendanceDialog";
import type { Tr } from "./useAttendanceText";

/**
 * Asks for the remarks a rejection must carry, then calls `onConfirm`. The dialog stays open and shows the server's
 * message when the call fails; it closes only after the server accepted the decision.
 */
export default function DecisionDialog({ tr, open, title, subject, minLength, onConfirm, onClose }: {
  tr: Tr;
  open: boolean;
  title: string;
  subject: string;
  minLength: number;
  onConfirm: (remarks: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tooShort = remarks.trim().length < minLength;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (tooShort || busy) return;
    setBusy(true);
    const failure = await onConfirm(remarks.trim());
    setBusy(false);
    if (failure) { setError(failure); return; }
    setRemarks("");
    setError(null);
    onClose();
  };

  return (
    <AttendanceDialog open={open} onClose={onClose} busy={busy} titleId="attendance-decision-title" title={title} closeLabel={tr("text_close", "Close")}
      icon={<XCircle size={18} color="var(--flag)" aria-hidden="true" />}>
      <div className={styles.contextBox}>{subject}</div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.fieldRow}>
          <label htmlFor="attendance-decision-remarks">{tr("text_rejection_remarks", "Rejection remarks")} <span className={styles.required}>*</span></label>
          <textarea id="attendance-decision-remarks" className={styles.textarea} value={remarks} onChange={(event) => setRemarks(event.target.value)}
            aria-required="true" aria-invalid={error !== null || undefined} aria-describedby="attendance-decision-help" maxLength={300} />
          <span id="attendance-decision-help" className={error ? styles.fieldError : styles.tiny} role={error ? "alert" : undefined}>
            {error ?? tr("text_min_characters", "At least {count} characters.", { count: minLength })}
          </span>
        </div>
        <div className={styles.formActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{tr("text_cancel", "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={tooShort || busy}>{busy ? tr("text_saving", "Saving…") : tr("text_reject", "Reject")}</button>
        </div>
      </form>
    </AttendanceDialog>
  );
}
