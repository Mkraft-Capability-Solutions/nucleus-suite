"use client";

import { useRef, useState, type FormEvent } from "react";
import Dialog from "@mui/material/Dialog";
import { CheckCircle2, Info, X } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import { useT } from "@/hooks/useT";
import { newIdempotencyKey, sendJson } from "@/lib/api-mutation";
import {
  ACTION_NS, initialValues, resolveAction, validateAction,
  type ActionContext, type ActionField, type ActionFiles, type ActionValues, type AvailableAction, type Label,
} from "@/lib/action-registry";
import ActionReferenceSelect from "./ActionReferenceSelect";
import styles from "./ActionFormModal.module.css";

/**
 * Workspace action form. Definitions come from the typed registry (src/lib/action-registry.ts); an available
 * action submits directly to its real route with one Idempotency-Key per logical submit (reused on retry),
 * closes only after the server accepts, and shows the server's message and field errors otherwise.
 * Unavailable actions render their fields disabled with the reason. `onComplete` is accepted for caller
 * compatibility but no longer used: MainWorkspace's generic endpoint fallback must not receive these writes.
 */
type Request = { action: string; context?: ActionContext } | null;
type Props = { request: Request; onClose: () => void; onComplete?: unknown };

export default function ActionFormModal({ request, onClose }: Props) {
  if (!request) return null;
  const resolved = resolveAction(request.action, request.context ?? {});
  if (resolved.status === "unknown") return null;
  return <ActionFormContent key={JSON.stringify(request)} request={request} resolved={resolved} onClose={onClose} />;
}

function ActionFormContent({ request, resolved, onClose }: { request: NonNullable<Request>; resolved: Exclude<ReturnType<typeof resolveAction>, { status: "unknown" }>; onClose: () => void }) {
  const { t } = useT();
  const { showToast } = useHRMS();
  const L = (label: Label) => t(`${ACTION_NS}.${label[0]}`, label[1]);
  const context = request.context ?? {};
  const definition = resolved.definition;
  const available = resolved.status === "available" ? (definition as AvailableAction) : null;
  const [values, setValues] = useState<ActionValues>(() => initialValues(definition.fields, context));
  const [files, setFiles] = useState<ActionFiles>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
    keyRef.current = null; // edited payload = new logical submit
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!available || busy) return;
    const invalid = Object.fromEntries(Object.entries(validateAction(available, values, files)).map(([key, label]) => [key, L(label)]));
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus();
      return;
    }
    setBusy(true);
    setSubmitError("");
    keyRef.current ??= newIdempotencyKey();
    let body: unknown;
    try {
      body = await available.body(values, files, context);
    } catch {
      setBusy(false);
      setSubmitError(t(`${ACTION_NS}.text_file_unreadable`, "The selected file could not be read."));
      return;
    }
    const result = await sendJson(available.endpoint(context, values), { method: available.method, body, idempotencyKey: keyRef.current, ifMatch: available.ifMatch?.(context) });
    setBusy(false);
    const title = L(definition.title);
    if (!result.ok) {
      if (result.status !== null) keyRef.current = null;
      const message = result.message || t(`${ACTION_NS}.text_save_failed`, "This could not be saved. Check the details and try again.");
      setSubmitError(message);
      const mapped = Object.fromEntries(result.details.filter((d) => definition.fields.some((field) => field.key === d.field)).map((d) => [d.field, d.issue]));
      if (Object.keys(mapped).length) setErrors(mapped);
      showToast(title, message, "error");
      return;
    }
    const data = (result.data ?? {}) as Record<string, unknown>;
    window.dispatchEvent(new CustomEvent("nucleus:action-completed", { detail: { action: request.action, title, context, result: data, recordedAt: new Date().toISOString() } }));
    if (available.after === "photo" && typeof data.photoUrl === "string") window.dispatchEvent(new CustomEvent("nucleus:profile-updated", { detail: { photoUrl: data.photoUrl } }));
    if (available.after === "profile") window.dispatchEvent(new CustomEvent("nucleus:profile-updated", { detail: data }));
    showToast(title, t(`${ACTION_NS}.text_saved`, "Saved."), "success");
    onClose();
  };

  const renderControl = (field: ActionField) => {
    const id = `action-field-${field.key}`;
    const disabled = !available || Boolean(field.unsupported) || field.readOnly || busy;
    const common = { id, name: field.key, disabled, required: field.required && !field.unsupported, "aria-invalid": errors[field.key] ? true : undefined, "aria-describedby": errors[field.key] || field.unsupported ? `${id}-note` : undefined };
    const value = values[field.key] ?? "";
    switch (field.kind) {
      case "textarea": return <textarea {...common} rows={3} maxLength={field.maxLength} value={value} onChange={(e) => update(field.key, e.target.value)} />;
      case "select": return (
        <select {...common} value={value} onChange={(e) => update(field.key, e.target.value)}>
          <option value="">{t(`${ACTION_NS}.content_text_5`, "Select")}</option>
          {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{L(option.label)}</option>)}
        </select>
      );
      case "reference": return field.source ? <ActionReferenceSelect id={id} source={field.source} value={value} required={common.required} disabled={disabled} invalid={Boolean(errors[field.key])} describedBy={common["aria-describedby"]} onChange={(next) => update(field.key, next)} /> : null;
      case "file": return <input {...common} type="file" accept={field.accept} onChange={(e) => { const file = e.target.files?.[0]; setFiles((current) => ({ ...current, [field.key]: file })); update(field.key, file?.name ?? ""); }} />;
      default: return <input {...common} type={field.kind} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength} value={value} onChange={(e) => update(field.key, e.target.value)} />;
    }
  };

  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} aria-labelledby="action-form-title" maxWidth="sm" fullWidth>
      <section className={styles.modal}>
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>{t(`${ACTION_NS}.content_text_2`, "Workspace action")}</span>
            <h2 id="action-form-title">{L(definition.title)}</h2>
          </div>
          <button className={styles.close} disabled={busy} onClick={onClose} type="button" aria-label={t(`${ACTION_NS}.content_aria-label_3`, "Close")}><X size={19} /></button>
        </header>
        <form ref={formRef} aria-busy={busy} onSubmit={submit} className={styles.form} noValidate>
          {resolved.status === "unavailable" && <p role="note" className={styles.unavailable}><Info size={15} aria-hidden="true" />{L(resolved.reason)}</p>}
          {submitError && <p role="alert">{submitError}</p>}
          {definition.fields.map((field) => (
            <label className={`${styles.field} ${field.kind === "textarea" ? styles.wide : ""}`} key={field.key} htmlFor={`action-field-${field.key}`}>
              <span>{L(field.label)}{field.required && !field.unsupported && available && <b aria-hidden="true">{t(`${ACTION_NS}.content_text_4`, " *")}</b>}</span>
              {renderControl(field)}
              {(errors[field.key] || field.unsupported) && <small id={`action-field-${field.key}-note`} className={errors[field.key] ? styles.fieldError : styles.fieldNote}>{errors[field.key] || (field.unsupported ? L(field.unsupported) : "")}</small>}
            </label>
          ))}
          <footer className={styles.footer}>
            <p><CheckCircle2 size={15} aria-hidden="true" />{t(`${ACTION_NS}.content_text_6`, "Saved to your workspace with an audit record.")}</p>
            <div>
              <button type="button" disabled={busy} className={styles.cancel} onClick={onClose}>{t(`${ACTION_NS}.content_text_7`, "Cancel")}</button>
              <button type="submit" disabled={busy || !available} className={styles.submit}>{busy ? t(`${ACTION_NS}.text_saving`, "Saving…") : L(definition.submit)}</button>
            </div>
          </footer>
        </form>
      </section>
    </Dialog>
  );
}
