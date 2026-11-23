"use client";

import { useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import styles from "../RecruitmentView.module.css";
import { ApiError, errorMessage, sendJson, useSubmitKey, type Translate } from "../workspaceHttp";
import type { RegisterRow } from "./types";
import { NS } from "./useRecruitmentData";

type Props = {
  t: Translate;
  requisitions: RegisterRow[];
  schemeNote: string;
  onClose: () => void;
  onCreated: (name: string) => void;
};

type Form = { candidateName: string; candidateEmail: string; candidatePhone: string; requisitionId: string; note: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same rules as referralIntakeSchema (src/server/talent/referral-intake.ts), with the requisition required here. */
function validate(form: Form, t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.candidateName.trim().length < 2) errors.candidateName = t(`${NS}.err_candidate_name`, "Enter the candidate's full name.");
  if (form.candidateEmail.trim() && !EMAIL.test(form.candidateEmail.trim())) errors.candidateEmail = t(`${NS}.err_email`, "Enter a valid email address.");
  if (!form.requisitionId) errors.requisitionId = t(`${NS}.err_requisition`, "Choose the requisition the candidate is referred for.");
  return errors;
}

/**
 * Refer-candidate form: POST /api/v1/referrals with the candidate and the open requisition. The server creates
 * the candidate, the application and the referral in one transaction, with the caller as referrer.
 */
export default function ReferralModal({ t, requisitions, schemeNote, onClose, onCreated }: Props) {
  const [form, setForm] = useState<Form>({ candidateName: "", candidateEmail: "", candidatePhone: "", requisitionId: requisitions[0]?.id ?? "", note: "" });
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitKey = useSubmitKey();
  const errors = useMemo(() => ({ ...validate(form, t), ...serverErrors }), [form, t, serverErrors]);
  const shown = touched ? errors : serverErrors;

  const update = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setServerErrors({});
    setFormError(null);
    submitKey.reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (busy || Object.keys(validate(form, t)).length > 0) return;
    setBusy(true);
    setFormError(null);
    try {
      await sendJson("/api/v1/referrals", {
        method: "POST",
        idempotencyKey: submitKey.current(),
        body: {
          candidateName: form.candidateName.trim(),
          candidateEmail: form.candidateEmail.trim() || undefined,
          candidatePhone: form.candidatePhone.trim() || undefined,
          requisitionId: form.requisitionId,
          note: form.note.trim() || undefined,
        },
      }, t(`${NS}.text_referral_failed`, "The referral could not be submitted."));
      submitKey.reset();
      onCreated(form.candidateName.trim());
    } catch (error) {
      setFormError(errorMessage(error, t(`${NS}.text_referral_failed`, "The referral could not be submitted.")));
      if (error instanceof ApiError) setServerErrors(error.fields);
    } finally {
      setBusy(false);
    }
  };

  const field = (name: string) => ({ "aria-invalid": shown[name] ? true : undefined, "aria-describedby": shown[name] ? `ref-${name}-error` : undefined });
  const fieldError = (name: string) => shown[name] ? <span id={`ref-${name}-error`} className={styles.fieldError}>{shown[name]}</span> : null;
  const req = <span className={styles.required} aria-hidden="true">*</span>;
  const optional = <span className={styles.hint}> {t(`${NS}.text_optional`, "(optional)")}</span>;

  return (
    <div className={styles.modalOverlay} onClick={() => !busy && onClose()}>
      <div className={`${styles.modalContent} ${styles.modalNarrow}`} role="dialog" aria-modal="true" aria-labelledby="ref-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 id="ref-title">{t(`${NS}.text_refer_candidate`, "Refer candidate")}</h3>
            <p>{schemeNote}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} /></button>
        </div>
        <form className={styles.modalBody} onSubmit={submit} noValidate>
          {requisitions.length === 0 && <p className={styles.formError}>{t(`${NS}.text_no_open_requisitions`, "There is no open requisition to refer a candidate for. Raise a requisition first.")}</p>}
          <div className={styles.formGroup}>
            <label htmlFor="ref-name">{t(`${NS}.text_candidate_name`, "Candidate full name")}{req}</label>
            <input id="ref-name" className={styles.formInput} value={form.candidateName} onChange={(e) => update("candidateName", e.target.value)} maxLength={120} aria-required="true" {...field("candidateName")} />
            {fieldError("candidateName")}
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ref-email">{t(`${NS}.text_candidate_email`, "Email")}{optional}</label>
              <input id="ref-email" type="email" className={styles.formInput} value={form.candidateEmail} onChange={(e) => update("candidateEmail", e.target.value)} {...field("candidateEmail")} />
              {fieldError("candidateEmail")}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ref-phone">{t(`${NS}.text_candidate_phone`, "Phone")}{optional}</label>
              <input id="ref-phone" type="tel" className={styles.formInput} value={form.candidatePhone} onChange={(e) => update("candidatePhone", e.target.value)} maxLength={30} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="ref-req">{t(`${NS}.text_proposed_role`, "Proposed role (requisition)")}{req}</label>
            <select id="ref-req" className={styles.formInput} value={form.requisitionId} onChange={(e) => update("requisitionId", e.target.value)} aria-required="true" {...field("requisitionId")}>
              {requisitions.length === 0 && <option value="">{t(`${NS}.text_none_available`, "None available")}</option>}
              {requisitions.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.title ?? row.position}{row.department ? ` · ${row.department}` : ""}</option>)}
            </select>
            {fieldError("requisitionId")}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="ref-note">{t(`${NS}.text_note`, "Note to the recruiter")}{optional}</label>
            <textarea id="ref-note" rows={2} className={styles.formInput} value={form.note} onChange={(e) => update("note", e.target.value)} maxLength={500} />
          </div>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy || requisitions.length === 0}>{busy ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_submit_referral`, "Submit referral")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
