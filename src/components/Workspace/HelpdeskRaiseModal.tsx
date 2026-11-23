"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import styles from "./HelpdeskView.module.css";
import { failureMessage, fieldErrors, sendJson, useSubmitKey, useT } from "./engagement-client";
import { HELPDESK_NS as NS, PRIORITIES, TICKETS_PATH, optionLabel, priorityLabel, type Option, type Priority } from "./helpdesk-model";

/**
 * Raise-ticket dialog. Mirrors the server schema (category from PL_TICKET_CATEGORY, priority, subject 3-200,
 * description 5-4000); submits once per Idempotency-Key and closes only after the server accepts the ticket.
 */

type Draft = { category: string; priority: Priority; subject: string; description: string };
type Errors = Partial<Record<keyof Draft, string>>;

export type RaisePrefill = Partial<Draft>;

function validate(draft: Draft, t: ReturnType<typeof useT>["t"]): Errors {
  const errors: Errors = {};
  if (!draft.category) errors.category = t(`${NS}.err_category`, "Choose a category.");
  if (draft.subject.trim().length < 3) errors.subject = t(`${NS}.err_subject`, "Enter a subject of at least 3 characters.");
  else if (draft.subject.trim().length > 200) errors.subject = t(`${NS}.err_subject_long`, "Keep the subject under 200 characters.");
  if (draft.description.trim().length < 5) errors.description = t(`${NS}.err_description`, "Describe the issue in at least 5 characters.");
  else if (draft.description.trim().length > 4000) errors.description = t(`${NS}.err_description_long`, "Keep the description under 4000 characters.");
  return errors;
}

export default function HelpdeskRaiseModal({ categories, slaHours, prefill, onClose, onCreated }: {
  categories: Option[];
  slaHours: Record<Priority, number> | null;
  prefill: RaisePrefill | null;
  onClose: () => void;
  onCreated: (reference: string) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState<Draft>({ category: prefill?.category ?? "", priority: prefill?.priority ?? "medium", subject: prefill?.subject ?? "", description: prefill?.description ?? "" });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { keyFor, reset } = useSubmitKey();
  const firstField = useRef<HTMLSelectElement>(null);
  const dirty = draft.subject.trim() !== (prefill?.subject ?? "") || draft.description.trim() !== (prefill?.description ?? "");

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (touched) setErrors(validate(next, t));
  };

  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm(t(`${NS}.text_discard_confirm`, "Discard this ticket? Your text will be lost."))) return;
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    const found = validate(draft, t);
    setErrors(found);
    const firstInvalid = (Object.keys(found) as Array<keyof Draft>)[0];
    if (firstInvalid) {
      document.getElementById(`helpdesk-raise-${firstInvalid}`)?.focus();
      return;
    }
    const payload = { category: draft.category, priority: draft.priority, subject: draft.subject.trim(), description: draft.description.trim() };
    setBusy(true);
    setServerError(null);
    const result = await sendJson<{ data: { reference?: string; id: string } }>("POST", TICKETS_PATH, payload, { idempotencyKey: keyFor(payload) });
    setBusy(false);
    if (!result.ok) {
      setErrors(fieldErrors(result.details) as Errors);
      setServerError(failureMessage(result, t, t(`${NS}.text_create_failed`, "The ticket could not be raised.")));
      return;
    }
    reset();
    onCreated(result.body.data.reference ?? result.body.data.id);
  };

  const described = (field: keyof Draft) => (errors[field] ? `helpdesk-raise-${field}-error` : undefined);

  return (
    <div className={styles.modalOverlay} onClick={close}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="helpdesk-raise-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="helpdesk-raise-title">{t(`${NS}.text_raise_title`, "Raise a support ticket")}</h3>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label={t(`${NS}.text_close`, "Close")}><X size={16} aria-hidden="true" /></button>
        </div>
        <form onSubmit={submit} className={styles.modalBody} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="helpdesk-raise-category">{t(`${NS}.text_category`, "Category")} <span aria-hidden="true">*</span></label>
            <select ref={firstField} id="helpdesk-raise-category" className={styles.formSelect} value={draft.category} onChange={(event) => update("category", event.target.value)} aria-required="true" aria-invalid={Boolean(errors.category)} aria-describedby={described("category")}>
              <option value="">{t(`${NS}.text_choose_category`, "Choose a category")}</option>
              {categories.map((option) => <option key={option.value} value={option.value}>{optionLabel(categories, option.value, "category", t)}</option>)}
            </select>
            {errors.category && <span id="helpdesk-raise-category-error" className={styles.fieldError} role="alert">{errors.category}</span>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="helpdesk-raise-priority">{t(`${NS}.text_priority`, "Priority")} <span aria-hidden="true">*</span></label>
            <select id="helpdesk-raise-priority" className={styles.formSelect} value={draft.priority} onChange={(event) => update("priority", event.target.value as Priority)} aria-required="true">
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {slaHours ? t(`${NS}.text_priority_with_sla`, "{priority} (response within {hours}h)", { priority: priorityLabel(priority, t), hours: slaHours[priority] }) : priorityLabel(priority, t)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="helpdesk-raise-subject">{t(`${NS}.text_subject`, "Subject")} <span aria-hidden="true">*</span></label>
            <input id="helpdesk-raise-subject" className={styles.formInput} value={draft.subject} maxLength={200} onChange={(event) => update("subject", event.target.value)} placeholder={t(`${NS}.text_subject_placeholder`, "Brief summary of the request")} aria-required="true" aria-invalid={Boolean(errors.subject)} aria-describedby={described("subject")} />
            {errors.subject && <span id="helpdesk-raise-subject-error" className={styles.fieldError} role="alert">{errors.subject}</span>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="helpdesk-raise-description">{t(`${NS}.text_description`, "Description")} <span aria-hidden="true">*</span></label>
            <textarea id="helpdesk-raise-description" rows={4} className={styles.formTextarea} value={draft.description} maxLength={4000} onChange={(event) => update("description", event.target.value)} placeholder={t(`${NS}.text_description_placeholder`, "Describe the issue with any reference details")} aria-required="true" aria-invalid={Boolean(errors.description)} aria-describedby={described("description")} />
            {errors.description && <span id="helpdesk-raise-description-error" className={styles.fieldError} role="alert">{errors.description}</span>}
          </div>
          {serverError && <p className={styles.formError} role="alert">{serverError}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={close} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_submit_ticket`, "Submit ticket")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
