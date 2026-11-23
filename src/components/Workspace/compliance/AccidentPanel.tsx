"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import { AlertCircle, AlertTriangle, CheckCircle2, Send, X } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, fieldErrors, formatDate, formatNumber, todayIso, useSubmit, useT, type Problem } from "./api";
import type { AccidentNotice } from "./types";

/** Form 18 accident notices: list from GET /api/v1/compliance, new notice via POST /api/v1/compliance (action "accident"). */

const EMPTY = { injuredPersonName: "", tokenNo: "", age: "", sex: "", occupation: "", exactPlace: "", dateOfOccurrence: "", timeOfOccurrence: "", natureOfInjury: "", causeOfAccident: "", lostWorkdays: "", investigatingOfficer: "", remedialActions: "", inspectorateNotifiedOn: "" };
type Form = typeof EMPTY;
const REQUIRED: Array<keyof Form> = ["injuredPersonName", "tokenNo", "occupation", "exactPlace", "dateOfOccurrence", "natureOfInjury", "lostWorkdays", "remedialActions"];

function validate(form: Form, t: (k: string, f: string) => string): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of REQUIRED) if (!form[key].trim()) errors[key] = t(`${NS}.err_required`, "This field is required.");
  const today = todayIso();
  if (form.dateOfOccurrence && form.dateOfOccurrence > today) errors.dateOfOccurrence = t(`${NS}.err_future`, "The date cannot be in the future.");
  if (form.inspectorateNotifiedOn && form.inspectorateNotifiedOn > today) errors.inspectorateNotifiedOn = t(`${NS}.err_future`, "The date cannot be in the future.");
  if (form.inspectorateNotifiedOn && form.dateOfOccurrence && form.inspectorateNotifiedOn < form.dateOfOccurrence) errors.inspectorateNotifiedOn = t(`${NS}.err_notified_before`, "The inspectorate cannot be notified before the accident happened.");
  const lost = Number(form.lostWorkdays);
  if (form.lostWorkdays && (!Number.isFinite(lost) || lost < 0 || lost > 365)) errors.lostWorkdays = t(`${NS}.err_lost_days`, "Enter 0 to 365 days.");
  const age = Number(form.age);
  if (form.age && (!Number.isInteger(age) || age < 14 || age > 100)) errors.age = t(`${NS}.err_age`, "Enter an age from 14 to 100.");
  return errors;
}

function AccidentDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const { submit, pending } = useSubmit();
  const local = validate(form, t);
  const errors = { ...fieldErrors(problem), ...(touched ? local : {}) };
  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setTouched(true);
    if (Object.keys(local).length > 0 || pending) {
      const first = Object.keys(local)[0];
      if (first) document.getElementById(`acc-${first}`)?.focus();
      return;
    }
    setProblem(null);
    const body: Record<string, unknown> = { action: "accident", lostWorkdays: Number(form.lostWorkdays) };
    for (const [key, value] of Object.entries(form)) {
      if (key === "lostWorkdays" || !value.trim()) continue;
      body[key] = key === "age" ? Number(value) : value.trim();
    }
    const result = await submit("/api/v1/compliance", body, t(`${NS}.acc_failed`, "The Form 18 notice could not be recorded."));
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onSaved();
  };

  const field = (key: keyof Form, label: string, props: { type?: string; wide?: boolean; textarea?: boolean; min?: number; max?: number | string; step?: string } = {}) => {
    const required = REQUIRED.includes(key);
    const error = errors[key];
    const common = {
      id: `acc-${key}`, className: styles.input, value: form[key], onChange: set(key), "aria-required": required || undefined,
      "aria-invalid": error ? ("true" as const) : undefined, "aria-describedby": error ? `acc-${key}-error` : undefined,
    };
    return (
      <label className={`${styles.field} ${props.wide ? styles.fieldWide : ""}`}>
        <span className={`${styles.fieldLabel} ${required ? styles.required : ""}`}>{label}</span>
        {props.textarea ? <textarea rows={3} maxLength={1000} {...common} /> : <input type={props.type ?? "text"} min={props.min} max={props.max} step={props.step} {...common} />}
        {error && <span id={`acc-${key}-error`} className={styles.fieldError}>{error}</span>}
      </label>
    );
  };

  return (
    <Dialog open onClose={() => !pending && onClose()} fullWidth maxWidth="md" aria-labelledby="acc-title">
      <div className={styles.dialogBody}>
        <div className={styles.modalTitle}>
          <h3 id="acc-title"><AlertTriangle size={18} aria-hidden="true" /> {t(`${NS}.acc_dialog_title`, "Record Form 18 accident notice")}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={pending} aria-label={t(`${NS}.close`, "Close")}><X size={16} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <div className={styles.formGrid}>
            {field("injuredPersonName", t(`${NS}.acc_name`, "Injured person name"))}
            {field("tokenNo", t(`${NS}.acc_token`, "Token no"))}
            {field("age", t(`${NS}.acc_age`, "Age"), { type: "number", min: 14, max: 100 })}
            {field("sex", t(`${NS}.acc_sex`, "Sex"))}
            {field("occupation", t(`${NS}.acc_occupation`, "Occupation"))}
            {field("exactPlace", t(`${NS}.acc_place`, "Exact place of occurrence"))}
            {field("dateOfOccurrence", t(`${NS}.acc_date`, "Date of occurrence"), { type: "date", max: todayIso() })}
            {field("timeOfOccurrence", t(`${NS}.acc_time`, "Time of occurrence"), { type: "time" })}
            {field("lostWorkdays", t(`${NS}.acc_lost`, "Lost workdays"), { type: "number", min: 0, max: 365, step: "0.5" })}
            {field("inspectorateNotifiedOn", t(`${NS}.acc_notified`, "Notified to inspectorate on"), { type: "date", max: todayIso() })}
            {field("investigatingOfficer", t(`${NS}.acc_officer`, "Investigating safety officer"))}
            {field("natureOfInjury", t(`${NS}.acc_injury`, "Nature of injury"), { wide: true })}
            {field("causeOfAccident", t(`${NS}.acc_cause`, "Immediate cause"), { wide: true, textarea: true })}
            {field("remedialActions", t(`${NS}.acc_remedial`, "Remedial actions mandated"), { wide: true, textarea: true })}
          </div>
          {problem && <p className={styles.errorNote} role="alert">{problem.message}</p>}
          <div className={styles.actionsRow}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={pending}>{t(`${NS}.cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={pending}><Send size={14} aria-hidden="true" />{pending ? t(`${NS}.saving`, "Saving…") : t(`${NS}.acc_submit`, "Record Form 18 notice")}</button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export default function AccidentPanel({ accidents, onChanged }: { accidents: AccidentNotice[]; onChanged: (message: string) => void }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const nr = t(`${NS}.not_recorded`, "Not recorded");
  return (
    <div className={styles.cardPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h3><AlertTriangle size={18} aria-hidden="true" /> {t(`${NS}.acc_title`, "Form 18: Notice of accidents and dangerous occurrences")}</h3>
          <p>{t(`${NS}.acc_subtitle`, "Section 88, Factories Act 1948 · an injury keeping a worker away for more than 48 hours is notifiable. Legal interpretation to be confirmed by counsel.")}</p>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={() => setOpen(true)}><AlertTriangle size={14} aria-hidden="true" />{t(`${NS}.acc_new`, "Record Form 18 notice")}</button>
      </div>
      {accidents.length === 0 && <p className={styles.stateNote}>{t(`${NS}.acc_empty`, "No accident notices are recorded.")}</p>}
      {accidents.map((acc) => (
        <div key={acc.id} className={styles.incidentCard}>
          <div className={styles.incidentHeader}>
            <div className={styles.incidentTitle}>
              <AlertCircle size={18} aria-hidden="true" />
              <span>{acc.injuredPersonName} ({acc.tokenNo})</span>
            </div>
            {acc.inspectorateNotifiedOn ? (
              <span className={styles.tagGreen}><CheckCircle2 size={12} aria-hidden="true" />{t(`${NS}.acc_notified_on`, "Notified to inspectorate on {date}", { date: formatDate(acc.inspectorateNotifiedOn, locale) ?? "" })}</span>
            ) : (
              <span className={acc.notifiable ? styles.tagAmber : styles.tagBlue}>{acc.notifiable ? t(`${NS}.acc_notify_pending`, "Notifiable: inspectorate notice not recorded") : t(`${NS}.acc_not_notifiable`, "Recorded (not notifiable)")}</span>
            )}
          </div>
          <div className={styles.incidentMeta}>
            <div className={styles.incidentMetaItem}><span>{t(`${NS}.acc_when`, "Date & time")}</span><strong>{formatDate(acc.dateOfOccurrence, locale) ?? nr}{acc.timeOfOccurrence ? ` · ${acc.timeOfOccurrence}` : ""}</strong></div>
            <div className={styles.incidentMetaItem}><span>{t(`${NS}.acc_place_short`, "Exact location")}</span><strong>{acc.exactPlace}</strong></div>
            <div className={styles.incidentMetaItem}><span>{t(`${NS}.acc_occupation_age`, "Occupation & age")}</span><strong>{acc.occupation}{acc.age !== null ? ` · ${t(`${NS}.years_value`, "{n} yrs", { n: acc.age })}` : ""}{acc.sex ? ` · ${acc.sex}` : ""}</strong></div>
            <div className={styles.incidentMetaItem}><span>{t(`${NS}.acc_lost_short`, "Lost workdays")}</span><strong>{acc.lostWorkdays === null ? nr : formatNumber(acc.lostWorkdays, locale, 1)}</strong></div>
          </div>
          <div className={styles.inspectionBody}>
            <div><strong>{t(`${NS}.acc_injury`, "Nature of injury")}:</strong> {acc.natureOfInjury}</div>
            <div><strong>{t(`${NS}.acc_cause`, "Immediate cause")}:</strong> {acc.causeOfAccident ?? nr}</div>
            <div><strong>{t(`${NS}.acc_remedial`, "Remedial actions mandated")}:</strong> {acc.remedialActions}</div>
            <div className={styles.metaLine}>{t(`${NS}.acc_officer`, "Investigating safety officer")}: {acc.investigatingOfficer ?? nr}</div>
          </div>
        </div>
      ))}
      {open && <AccidentDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(t(`${NS}.acc_saved`, "Form 18 notice recorded.")); }} />}
    </div>
  );
}
