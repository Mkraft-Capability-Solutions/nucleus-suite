"use client";

import { useRef, useState, type FormEvent } from "react";
import { Sliders } from "lucide-react";
import styles from "../AttendanceView.module.css";
import AttendanceDialog from "./AttendanceDialog";
import { errorFields, errorMessage, newIdempotencyKey, sendJson, todayIso, type LedgerRow, type ShiftOption } from "./attendanceApi";
import { useResource } from "./useResource";
import { formatDate, type Tr } from "./useAttendanceText";
import StateNote from "./StateNote";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;

/** Assigns a shift from the tenant's shift master (GET /api/v1/shifts) via POST /api/v1/shifts/assignments. */
export default function ShiftOverrideModal({ tr, locale, row, onClose, onSaved, notify }: {
  tr: Tr;
  locale: string;
  row: LedgerRow;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const { state: shifts, reload } = useResource<ShiftOption[]>("/api/v1/shifts", tr("text_shifts_failed", "The shift master could not be loaded."));
  const current = (row.shift_applied ?? row.shift_assigned ?? "").toUpperCase();
  const [shiftCode, setShiftCode] = useState(current);
  const [effectiveDate, setEffectiveDate] = useState(row.date ?? todayIso());
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);
  const options = shifts.status === "ready" ? shifts.data : [];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (!options.some((option) => option.code.toUpperCase() === shiftCode)) next.shiftCode = tr("text_err_shift", "Choose a shift from the shift master.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) next.effectiveDate = tr("text_err_date", "Choose a date.");
    if (reason.trim().length < 5 || reason.trim().length > 500) next.reason = tr("text_err_reason_5", "Give a reason of 5 to 500 characters.");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    keyRef.current ??= newIdempotencyKey();
    setBusy(true);
    setServerError(null);
    try {
      await sendJson("/api/v1/shifts/assignments", { employeeId: row.employee_id, shiftCode, effectiveDate, reason: reason.trim() }, keyRef.current, tr("text_shift_failed", "The shift could not be assigned."));
      keyRef.current = null;
      notify(tr("text_shift_saved_title", "Shift assigned"), tr("text_shift_saved", "{name} is on shift {shift} from {date}.", { name: row.employee_name ?? row.employee_code ?? "—", shift: shiftCode, date: formatDate(locale, effectiveDate) ?? effectiveDate }), "success");
      onSaved();
      onClose();
    } catch (error) {
      setErrors(errorFields(error));
      setServerError(errorMessage(error, tr("text_shift_failed", "The shift could not be assigned.")));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { keyRef.current = null; };

  return (
    <AttendanceDialog open onClose={onClose} busy={busy} titleId="shift-override-title" title={tr("text_manual_shift_override", "Manual Shift Override")}
      icon={<Sliders size={18} color="var(--pending)" aria-hidden="true" />} closeLabel={tr("text_close", "Close")}>
      <div className={styles.contextBox}>
        <div><strong>{row.employee_name ?? row.employee_code ?? "—"}</strong></div>
        <div>{tr("text_shift_context", "Date {date} · Current shift {shift}", { date: formatDate(locale, row.date) ?? "—", shift: current || "—" })}</div>
      </div>
      {shifts.status !== "ready" ? <StateNote tr={tr} state={shifts} onRetry={reload} /> : options.length === 0 ? (
        <p className={styles.note}>{tr("text_no_shifts", "No shifts are defined in the shift master yet, so a shift cannot be assigned.")}</p>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.fieldRow}>
            <label htmlFor="shift-code">{tr("text_target_work_shift", "Target Work Shift")} <span className={styles.required}>*</span></label>
            <select id="shift-code" value={shiftCode} onChange={(event) => { reset(); setShiftCode(event.target.value); }} aria-required="true" aria-invalid={Boolean(errors.shiftCode) || undefined} aria-describedby={errors.shiftCode ? "shift-code-error" : undefined}>
              <option value="">{tr("text_select_shift", "-- Select shift --")}</option>
              {options.map((option) => (
                <option key={option.id} value={option.code.toUpperCase()}>
                  {[option.code, option.name, option.startsAt && option.endsAt ? `${option.startsAt} – ${option.endsAt}` : null].filter(Boolean).join(" · ")}
                  {option.crossesMidnight ? ` ${tr("text_crosses_midnight", "(crosses midnight)")}` : ""}
                </option>
              ))}
            </select>
            {errors.shiftCode && <span id="shift-code-error" className={styles.fieldError}>{errors.shiftCode}</span>}
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="shift-date">{tr("text_effective_from", "Effective from")} <span className={styles.required}>*</span></label>
            <input id="shift-date" type="date" value={effectiveDate} onChange={(event) => { reset(); setEffectiveDate(event.target.value); }} aria-required="true" aria-invalid={Boolean(errors.effectiveDate) || undefined} />
            {errors.effectiveDate && <span className={styles.fieldError}>{errors.effectiveDate}</span>}
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="shift-reason">{tr("text_reason_for_manual_override", "Reason for Manual Override")} <span className={styles.required}>*</span></label>
            <input id="shift-reason" type="text" maxLength={500} value={reason} onChange={(event) => { reset(); setReason(event.target.value); }}
              placeholder={tr("placeholder_eg_approved_shift_swap_with_supervisor_c", "e.g. Approved shift swap with supervisor consent")}
              aria-required="true" aria-invalid={Boolean(errors.reason) || undefined} aria-describedby={errors.reason ? "shift-reason-error" : undefined} />
            {errors.reason && <span id="shift-reason-error" className={styles.fieldError}>{errors.reason}</span>}
          </div>
          {serverError && <div className={styles.errorNote} role="alert">{serverError}</div>}
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{tr("text_cancel", "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? tr("text_saving", "Saving…") : tr("text_apply_shift_override", "Apply Shift Override")}</button>
          </div>
        </form>
      )}
    </AttendanceDialog>
  );
}
