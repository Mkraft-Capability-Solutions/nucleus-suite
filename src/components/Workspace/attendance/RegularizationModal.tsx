"use client";

import { useRef, useState, type FormEvent } from "react";
import { UserCheck } from "lucide-react";
import styles from "../AttendanceView.module.css";
import AttendanceDialog from "./AttendanceDialog";
import { errorFields, errorMessage, newIdempotencyKey, sendJson, todayIso } from "./attendanceApi";
import type { Tr } from "./useAttendanceText";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;

/** Mirrors REGULARIZATION_KINDS and createRegularizationSchema in src/server/attendance/regularization-workflow.ts. */
export const REGULARIZATION_KINDS = ["missing-punch", "official-duty", "late-arrival", "system-failure", "shift-correct", "break-correct"] as const;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export type RegularizationTarget = { employeeId: string; employeeName: string; date: string | null };

export function kindLabel(tr: Tr, kind: string | null): string {
  switch (kind) {
    case "missing-punch": return tr("text_missing_punch_terminal_failure_forgot_to", "Missing Punch (Terminal failure / Forgot to punch)");
    case "official-duty": return tr("text_official_duty_client_visit_external_assi", "Official Duty (Client visit / External assignment)");
    case "late-arrival": return tr("text_late_arrival_transit_delay_emergency", "Late Arrival (Transit delay / Emergency)");
    case "system-failure": return tr("text_system_network_outage_at_turnstile", "System / Network Outage at Turnstile");
    case "shift-correct": return tr("text_kind_shift_correct", "Shift correction");
    case "break-correct": return tr("text_kind_break_correct", "Break correction");
    default: return kind ?? "—";
  }
}

type Fields = { date: string; kind: string; claimedIn: string; claimedOut: string; reason: string };
type Errors = Partial<Record<keyof Fields, string>>;

export default function RegularizationModal({ tr, target, onClose, onSaved, notify }: {
  tr: Tr;
  target: RegularizationTarget;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const [fields, setFields] = useState<Fields>({ date: target.date ?? todayIso(), kind: "missing-punch", claimedIn: "", claimedOut: "", reason: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);

  const set = (name: keyof Fields, value: string) => {
    keyRef.current = null;
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) next.date = tr("text_err_date", "Choose a date.");
    else if (fields.date > todayIso()) next.date = tr("text_err_future", "The date cannot be in the future.");
    if (!REGULARIZATION_KINDS.includes(fields.kind as (typeof REGULARIZATION_KINDS)[number])) next.kind = tr("text_err_kind", "Choose a category.");
    if (fields.claimedIn && !CLOCK.test(fields.claimedIn)) next.claimedIn = tr("text_err_clock", "Use the 24-hour HH:MM format.");
    if (fields.claimedOut && !CLOCK.test(fields.claimedOut)) next.claimedOut = tr("text_err_clock", "Use the 24-hour HH:MM format.");
    if (!next.claimedIn && !next.claimedOut && fields.claimedIn && fields.claimedOut && fields.claimedIn >= fields.claimedOut) {
      next.claimedOut = tr("text_err_out_after_in", "The claimed out-time must be after the claimed in-time.");
    }
    const reason = fields.reason.trim();
    if (reason.length < 5 || reason.length > 500) next.reason = tr("text_err_reason_5", "Give a reason of 5 to 500 characters.");
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    keyRef.current ??= newIdempotencyKey();
    setBusy(true);
    setServerError(null);
    try {
      await sendJson("/api/v1/regularizations", {
        employeeId: target.employeeId, date: fields.date, kind: fields.kind, reason: fields.reason.trim(),
        ...(fields.claimedIn ? { claimedIn: fields.claimedIn } : {}),
        ...(fields.claimedOut ? { claimedOut: fields.claimedOut } : {}),
      }, keyRef.current, tr("text_reg_failed", "The regularization could not be submitted."));
      keyRef.current = null;
      notify(tr("text_reg_submitted_title", "Regularization submitted"), tr("text_reg_submitted", "The request is waiting for the shift supervisor."), "success");
      onSaved();
      onClose();
    } catch (error) {
      setErrors((current) => ({ ...current, ...errorFields(error) }));
      setServerError(errorMessage(error, tr("text_reg_failed", "The regularization could not be submitted.")));
    } finally {
      setBusy(false);
    }
  };

  const describe = (name: keyof Fields) => (errors[name] ? `reg-${name}-error` : undefined);
  const fieldError = (name: keyof Fields) => errors[name] && <span id={`reg-${name}-error`} className={styles.fieldError}>{errors[name]}</span>;

  return (
    <AttendanceDialog open onClose={onClose} busy={busy} titleId="regularization-title" title={tr("text_request_regularization", "Request Regularization")}
      icon={<UserCheck size={20} color="var(--signal)" aria-hidden="true" />} closeLabel={tr("text_close", "Close")}>
      <div className={styles.contextBox}>
        <div>{tr("text_employee_label", "Employee:")} <strong>{target.employeeName}</strong></div>
        <div>{tr("text_reg_policy", "Requests go to the shift supervisor first and then to the time office. A day locked for payroll cannot be regularized.")}</div>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.fieldRow}>
          <label htmlFor="reg-date">{tr("text_attendance_exception_date", "Attendance Exception Date")} <span className={styles.required}>*</span></label>
          <input id="reg-date" type="date" value={fields.date} max={todayIso()} onChange={(event) => set("date", event.target.value)} aria-required="true" aria-invalid={Boolean(errors.date) || undefined} aria-describedby={describe("date")} />
          {fieldError("date")}
        </div>
        <div className={styles.fieldRow}>
          <label htmlFor="reg-kind">{tr("text_exception_category", "Exception Category")} <span className={styles.required}>*</span></label>
          <select id="reg-kind" value={fields.kind} onChange={(event) => set("kind", event.target.value)} aria-required="true" aria-invalid={Boolean(errors.kind) || undefined} aria-describedby={describe("kind")}>
            {REGULARIZATION_KINDS.map((kind) => <option key={kind} value={kind}>{kindLabel(tr, kind)}</option>)}
          </select>
          {fieldError("kind")}
        </div>
        <div className={styles.twoCol}>
          <div className={styles.fieldRow}>
            <label htmlFor="reg-claimedIn">{tr("text_claimed_in_optional", "Claimed in-time (optional)")}</label>
            <input id="reg-claimedIn" type="time" value={fields.claimedIn} onChange={(event) => set("claimedIn", event.target.value)} aria-invalid={Boolean(errors.claimedIn) || undefined} aria-describedby={describe("claimedIn")} />
            {fieldError("claimedIn")}
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="reg-claimedOut">{tr("text_claimed_out_optional", "Claimed out-time (optional)")}</label>
            <input id="reg-claimedOut" type="time" value={fields.claimedOut} onChange={(event) => set("claimedOut", event.target.value)} aria-invalid={Boolean(errors.claimedOut) || undefined} aria-describedby={describe("claimedOut")} />
            {fieldError("claimedOut")}
          </div>
        </div>
        <div className={styles.fieldRow}>
          <label htmlFor="reg-reason">{tr("text_justification_reason", "Justification Reason")} <span className={styles.required}>*</span></label>
          <textarea id="reg-reason" className={styles.textarea} value={fields.reason} maxLength={500} onChange={(event) => set("reason", event.target.value)}
            placeholder={tr("placeholder_explain_the_circumstance_for_supervisor_", "Explain the circumstance for supervisor and time-office review...")} aria-required="true" aria-invalid={Boolean(errors.reason) || undefined} aria-describedby={describe("reason")} />
          {fieldError("reason")}
        </div>
        {serverError && <div className={styles.errorNote} role="alert">{serverError}</div>}
        <div className={styles.formActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{tr("text_cancel", "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? tr("text_saving", "Saving…") : tr("text_submit_request", "Submit Request")}</button>
        </div>
      </form>
    </AttendanceDialog>
  );
}
