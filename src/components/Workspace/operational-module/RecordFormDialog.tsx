"use client";

import { useRef, useState, type FormEvent } from "react";
import Dialog from "@mui/material/Dialog";
import { LoaderCircle, X } from "lucide-react";
import { initialFormValues, updateDerivedFields, validateForm, type FormValues } from "@/lib/form-validation";
import { ApiError, buildPayload, NS, saveRecord, type LookupKind, type LookupState, type ModuleRecord, type OperationalModule, type ResolvedField, type Translate } from "./data";
import { useIdempotencyKey } from "./hooks";
import RecordField from "./RecordField";
import styles from "../OperationalModuleView.module.css";

type Props = {
  module: OperationalModule;
  fields: ResolvedField[];
  lookups: Partial<Record<LookupKind, LookupState>>;
  /** null = create a new record; otherwise edit this record. */
  target: ModuleRecord | null;
  t: Translate;
  onClose: () => void;
  onSaved: (record: ModuleRecord) => void;
};

function editValues(fields: ResolvedField[], record: ModuleRecord): FormValues {
  const attrs = record.attributes;
  return Object.fromEntries(fields.map((field) => [field.key, attrs[field.key] ?? attrs[field.label] ?? field.defaultValue ?? ""]));
}

/**
 * Create / edit dialog. Client validation mirrors the server's registry-derived schema; the record
 * appears in the list only after the server accepted it, and server field errors land on the fields.
 */
export default function RecordFormDialog({ module, fields, lookups, target, t, onClose, onSaved }: Props) {
  const [initial] = useState<FormValues>(() => (target ? editValues(fields, target) : initialFormValues(fields)));
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const { keyFor, reset } = useIdempotencyKey();
  const formRef = useRef<HTMLFormElement>(null);
  const idPrefix = target ? "edit-record" : "record";
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const close = () => {
    if (pending) return;
    if (dirty && !window.confirm(t(`${NS}.text_discard_changes`, "Discard the changes you made?"))) return;
    onClose();
  };

  const update = (key: string, value: unknown) => {
    setValues((current) => updateDerivedFields(fields, current, key, value));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const focusFirst = (fieldErrors: Record<string, string>) => {
    const first = fields.find((field) => fieldErrors[field.key]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first.key)}"]`)?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const clientErrors = validateForm(fields, values);
    setErrors(clientErrors);
    setFormError("");
    if (Object.keys(clientErrors).length) { focusFirst(clientErrors); return; }
    const payload = buildPayload(values);
    setPending(true);
    try {
      const saved = await saveRecord(module, target, payload, keyFor(payload), t(`${NS}.text_save_failed`, "The record could not be saved."));
      reset();
      onSaved(saved);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setFormError(error instanceof Error ? error.message : t(`${NS}.text_save_failed`, "The record could not be saved."));
      if (apiError && Object.keys(apiError.fieldErrors).length) { setErrors(apiError.fieldErrors); focusFirst(apiError.fieldErrors); }
    } finally {
      setPending(false);
    }
  };

  const titleId = `${idPrefix}-title`;
  return (
    <Dialog open onClose={close} aria-labelledby={titleId} maxWidth="sm" fullWidth>
      <form ref={formRef} className={styles.formDialog} onSubmit={submit} noValidate>
        <header>
          <div>
            <span>{target ? t(`${NS}.text_edit_record_eyebrow`, "Edit record") : t(`${NS}.text_new_record_eyebrow`, "New record")}</span>
            <h2 id={titleId}>{target ? t(`${NS}.text_edit_title`, "Edit {title}", { title: module.title }) : (module.actions[0] ?? module.title)}</h2>
          </div>
          <button type="button" onClick={close} aria-label={t(`${NS}.aria-label_close`, "Close")}><X size={18} aria-hidden /></button>
        </header>
        {formError && <div role="alert" className={styles.error}>{formError}</div>}
        <div className={styles.formGrid}>
          {fields.map((field) => (
            <RecordField
              key={field.key}
              field={field}
              id={`${idPrefix}-${field.key}`}
              value={values[field.key]}
              error={errors[field.key]}
              lookup={field.lookup ? lookups[field.lookup] : undefined}
              t={t}
              onChange={(value) => update(field.key, value)}
            />
          ))}
        </div>
        <footer>
          <p>{t(`${NS}.text_required_hint`, "Fields marked * are required. The server checks every field again before saving.")}</p>
          <div>
            <button type="button" className={styles.secondaryButton} onClick={close} disabled={pending}>{t(`${NS}.text_cancel`, "Cancel")}</button>
            <button className={styles.primaryButton} type="submit" disabled={pending} aria-busy={pending}>
              {pending && <LoaderCircle size={15} className={styles.spin} aria-hidden />}
              {pending ? t(`${NS}.text_saving`, "Saving…") : target ? t(`${NS}.text_save_update`, "Save changes") : t(`${NS}.text_create_record`, "Create record")}
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
