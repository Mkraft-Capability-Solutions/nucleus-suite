"use client";

import { useRef, useState, type FormEvent } from "react";
import { Timer } from "lucide-react";
import styles from "../AttendanceView.module.css";
import AttendanceDialog from "./AttendanceDialog";
import { errorFields, errorMessage, formatMinutes, newIdempotencyKey, sendJson, type LedgerRow } from "./attendanceApi";
import { formatDate, type Tr } from "./useAttendanceText";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;

/** Mirrors createOtRequestSchema in src/server/ot/service.ts (30-480 minutes, four day types). */
const DAY_TYPES = ["working_day", "rest_day", "holiday", "national_holiday"] as const;
type DayType = (typeof DAY_TYPES)[number];
const MIN_MINUTES = 30;
const MAX_MINUTES = 480;

function dayTypeLabel(tr: Tr, value: DayType): string {
  switch (value) {
    case "working_day": return tr("text_ot_working_day", "Working day overtime");
    case "rest_day": return tr("text_ot_rest_day", "Weekly off / rest day overtime");
    case "holiday": return tr("text_ot_holiday", "Holiday overtime");
    case "national_holiday": return tr("text_ot_national_holiday", "National holiday overtime");
    default: {
      const unreachable: never = value;
      return String(unreachable);
    }
  }
}

function initialDayType(row: LedgerRow): DayType {
  const value = (row.day_type ?? "").toLowerCase();
  if (value.includes("national")) return "national_holiday";
  if (value.includes("holiday")) return "holiday";
  if (value.includes("off") || value.includes("rest")) return "rest_day";
  return "working_day";
}

export default function OvertimeModal({ tr, locale, row, onClose, onSaved, notify }: {
  tr: Tr;
  locale: string;
  row: LedgerRow;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const stored = row.ot_minutes && row.ot_minutes >= MIN_MINUTES ? Math.min(row.ot_minutes, MAX_MINUTES) : null;
  const [hours, setHours] = useState(stored ? String(Math.round((stored / 60) * 2) / 2) : "");
  const [dayType, setDayType] = useState<DayType>(initialDayType(row));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);
  const changed = () => { keyRef.current = null; };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const minutes = Math.round(Number(hours) * 60);
    const next: Record<string, string> = {};
    if (!row.date) next.attendanceDate = tr("text_err_no_date", "This day has no date, so overtime cannot be tagged.");
    if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) next.otMinutes = tr("text_err_ot_range", "Enter between 0.5 and 8 hours.");
    if (reason.trim().length < 1 || reason.trim().length > 500) next.reason = tr("text_err_ot_reason", "Give a justification of up to 500 characters.");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    keyRef.current ??= newIdempotencyKey();
    setBusy(true);
    setServerError(null);
    try {
      await sendJson("/api/v1/ot-requests", { employeeId: row.employee_id, attendanceDate: row.date, otMinutes: minutes, dayType, reason: reason.trim() }, keyRef.current, tr("text_ot_failed", "The overtime request could not be saved."));
      keyRef.current = null;
      notify(tr("text_ot_saved_title", "Overtime tagged"), tr("text_ot_saved", "{hours} h submitted for {name}; it now waits for approval.", { hours: formatMinutes(minutes) ?? "—", name: row.employee_name ?? row.employee_code ?? "—" }), "success");
      onSaved();
      onClose();
    } catch (error) {
      setErrors(errorFields(error));
      setServerError(errorMessage(error, tr("text_ot_failed", "The overtime request could not be saved.")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AttendanceDialog open onClose={onClose} busy={busy} titleId="ot-title" title={tr("text_tag_approve_overtime", "Tag / Approve Overtime")}
      icon={<Timer size={18} color="var(--status-ok)" aria-hidden="true" />} closeLabel={tr("text_close", "Close")}>
      <div className={styles.contextBox}>
        <div><strong>{row.employee_name ?? row.employee_code ?? "—"}</strong>{row.worker_category_code ? ` (${row.worker_category_code})` : ""}</div>
        <div>{tr("text_ot_context", "Date {date} · Shift {shift} · Net {net} · Stored OT {ot}", { date: formatDate(locale, row.date) ?? "—", shift: row.shift_applied ?? "—", net: formatMinutes(row.net_minutes) ?? "—", ot: formatMinutes(row.ot_minutes) ?? "—" })}</div>
        {errors.attendanceDate && <div className={styles.fieldError}>{errors.attendanceDate}</div>}
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.fieldRow}>
          <label htmlFor="ot-hours">{tr("text_overtime_hours_hours", "Overtime Hours (Hours)")} <span className={styles.required}>*</span></label>
          <input id="ot-hours" type="number" inputMode="decimal" step="0.5" min="0.5" max="8" value={hours} onChange={(event) => { changed(); setHours(event.target.value); }}
            aria-required="true" aria-invalid={Boolean(errors.otMinutes) || undefined} aria-describedby={errors.otMinutes ? "ot-hours-error" : undefined} />
          {errors.otMinutes && <span id="ot-hours-error" className={styles.fieldError}>{errors.otMinutes}</span>}
        </div>
        <div className={styles.fieldRow}>
          <label htmlFor="ot-daytype">{tr("text_ot_day_type", "Day type (sets the policy rate)")} <span className={styles.required}>*</span></label>
          <select id="ot-daytype" value={dayType} onChange={(event) => { changed(); setDayType(event.target.value as DayType); }} aria-required="true">
            {DAY_TYPES.map((value) => <option key={value} value={value}>{dayTypeLabel(tr, value)}</option>)}
          </select>
          <span className={styles.tiny}>{tr("text_ot_rate_note", "The overtime rate and eligibility are applied by the server from the employee's policy.")}</span>
        </div>
        <div className={styles.fieldRow}>
          <label htmlFor="ot-reason">{tr("text_approval_justification_project_code", "Approval Justification / Project Code")} <span className={styles.required}>*</span></label>
          <input id="ot-reason" type="text" maxLength={500} value={reason} onChange={(event) => { changed(); setReason(event.target.value); }}
            placeholder={tr("placeholder_eg_critical_deployment_production_ramp-u", "e.g. Critical deployment / production ramp-up")}
            aria-required="true" aria-invalid={Boolean(errors.reason) || undefined} aria-describedby={errors.reason ? "ot-reason-error" : undefined} />
          {errors.reason && <span id="ot-reason-error" className={styles.fieldError}>{errors.reason}</span>}
        </div>
        {serverError && <div className={styles.errorNote} role="alert">{serverError}</div>}
        <div className={styles.formActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{tr("text_cancel", "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? tr("text_saving", "Saving…") : tr("text_confirm_tag_ot", "Confirm & Tag OT")}</button>
        </div>
      </form>
    </AttendanceDialog>
  );
}
