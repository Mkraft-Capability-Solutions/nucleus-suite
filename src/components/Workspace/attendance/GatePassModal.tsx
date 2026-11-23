"use client";

import { useRef, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { picklistValues } from "@/lib/picklists";
import styles from "../AttendanceView.module.css";
import AttendanceDialog from "./AttendanceDialog";
import { errorFields, errorMessage, newIdempotencyKey, sendJson, todayIso, type SessionStrip } from "./attendanceApi";
import type { Tr } from "./useAttendanceText";

type Notify = (title: string, message: string, tone: "success" | "error" | "info") => void;

/** Mirrors requestGatePassSchema in src/server/attendance/service.ts: a pass is 2 or 4 hours. */
const SERVER_DURATIONS = [120, 240] as const;
const PASS_TYPES = picklistValues("PL_GATE_PASS_TYPE");
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

type Fields = { passType: string; date: string; fromTime: string; minutes: string; reason: string };
type Errors = Partial<Record<keyof Fields, string>>;

export default function GatePassModal({ tr, open, employeeId, employeeName, allowance, onClose, onSaved, notify }: {
  tr: Tr;
  open: boolean;
  employeeId: string;
  employeeName: string;
  allowance: SessionStrip["gatePassAllowance"] | null;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const [fields, setFields] = useState<Fields>({ passType: "personal", date: todayIso(), fromTime: "", minutes: "", reason: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);
  const durations = allowance && allowance.allowedMinutes.length > 0
    ? SERVER_DURATIONS.filter((minutes) => allowance.allowedMinutes.includes(minutes))
    : [...SERVER_DURATIONS];

  const set = (name: keyof Fields, value: string) => {
    keyRef.current = null; // a changed payload is a new logical submit
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!PASS_TYPES.includes(fields.passType as (typeof PASS_TYPES)[number])) next.passType = tr("text_err_pass_type", "Choose a pass type.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) next.date = tr("text_err_date", "Choose a date.");
    if (fields.fromTime && !CLOCK.test(fields.fromTime)) next.fromTime = tr("text_err_clock", "Use the 24-hour HH:MM format.");
    if (!durations.includes(Number(fields.minutes) as (typeof SERVER_DURATIONS)[number])) next.minutes = tr("text_err_duration", "Choose 2 hours or 4 hours.");
    const reason = fields.reason.trim();
    if (reason.length < 4 || reason.length > 300) next.reason = tr("text_err_reason_4", "Give a reason of 4 to 300 characters.");
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
      await sendJson("/api/v1/gate-passes", {
        employeeId, date: fields.date, passType: fields.passType, minutes: Number(fields.minutes), reason: fields.reason.trim(),
        ...(fields.fromTime ? { fromTime: fields.fromTime } : {}),
      }, keyRef.current, tr("text_gp_failed", "The gate pass could not be requested."));
      keyRef.current = null;
      notify(tr("text_gp_requested_title", "Gate pass requested"), tr("text_gp_requested", "Your request is waiting for approval."), "success");
      setFields({ passType: "personal", date: todayIso(), fromTime: "", minutes: "", reason: "" });
      onSaved();
      onClose();
    } catch (error) {
      const fieldErrors = errorFields(error);
      setErrors((current) => ({ ...current, ...fieldErrors }));
      setServerError(errorMessage(error, tr("text_gp_failed", "The gate pass could not be requested.")));
    } finally {
      setBusy(false);
    }
  };

  const describe = (name: keyof Fields) => (errors[name] ? `gp-${name}-error` : undefined);

  return (
    <AttendanceDialog open={open} onClose={onClose} busy={busy} titleId="gate-pass-title" title={tr("AttendanceView_text_113", "Request Gate Pass")}
      icon={<KeyRound size={20} color="var(--signal)" aria-hidden="true" />} closeLabel={tr("text_close", "Close")}>
      <div className={styles.contextBox}>
        <div>{tr("text_employee_label", "Employee:")} <strong>{employeeName}</strong></div>
        {allowance && (
          <div>
            {allowance.ceilingMinutes !== null
              ? tr("text_gp_usage_ceiling", "Used {used} of {limit} minutes this month", { used: allowance.usedMinutes, limit: allowance.ceilingMinutes })
              : tr("text_gp_usage", "Used {used} minutes this month", { used: allowance.usedMinutes })}
            {" · "}
            {allowance.requestLimit !== null
              ? tr("text_gp_requests_ceiling", "{used} of {limit} requests", { used: allowance.usedRequests, limit: allowance.requestLimit })
              : tr("text_gp_requests", "{used} requests", { used: allowance.usedRequests })}
          </div>
        )}
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.fieldRow}>
          <label htmlFor="gp-passType">{tr("AttendanceView_text_121", "Pass Type")} <span className={styles.required}>*</span></label>
          <select id="gp-passType" value={fields.passType} onChange={(event) => set("passType", event.target.value)} aria-required="true" aria-invalid={Boolean(errors.passType) || undefined} aria-describedby={describe("passType")}>
            {PASS_TYPES.map((value) => (
              <option key={value} value={value}>{value === "official" ? tr("text_pass_official", "Official duty / client site visit") : tr("text_pass_personal", "Personal permission (counts against the monthly allowance)")}</option>
            ))}
          </select>
          {errors.passType && <span id="gp-passType-error" className={styles.fieldError}>{errors.passType}</span>}
        </div>
        <div className={styles.twoCol}>
          <div className={styles.fieldRow}>
            <label htmlFor="gp-date">{tr("AttendanceView_text_50", "Date")} <span className={styles.required}>*</span></label>
            <input id="gp-date" type="date" value={fields.date} onChange={(event) => set("date", event.target.value)} aria-required="true" aria-invalid={Boolean(errors.date) || undefined} aria-describedby={describe("date")} />
            {errors.date && <span id="gp-date-error" className={styles.fieldError}>{errors.date}</span>}
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="gp-fromTime">{tr("text_from_time_optional", "Leaving at (optional)")}</label>
            <input id="gp-fromTime" type="time" value={fields.fromTime} onChange={(event) => set("fromTime", event.target.value)} aria-invalid={Boolean(errors.fromTime) || undefined} aria-describedby={describe("fromTime")} />
            {errors.fromTime && <span id="gp-fromTime-error" className={styles.fieldError}>{errors.fromTime}</span>}
          </div>
        </div>
        <div className={styles.fieldRow}>
          <label htmlFor="gp-minutes">{tr("AttendanceView_text_124", "Duration (Minutes)")} <span className={styles.required}>*</span></label>
          <select id="gp-minutes" value={fields.minutes} onChange={(event) => set("minutes", event.target.value)} aria-required="true" aria-invalid={Boolean(errors.minutes) || undefined} aria-describedby={describe("minutes")}>
            <option value="">{tr("text_--_select_duration_--", "-- Select Duration --")}</option>
            {durations.map((minutes) => <option key={minutes} value={minutes}>{tr("text_duration_hours", "{hours} hours ({minutes} minutes)", { hours: minutes / 60, minutes })}</option>)}
          </select>
          {errors.minutes && <span id="gp-minutes-error" className={styles.fieldError}>{errors.minutes}</span>}
        </div>
        <div className={styles.fieldRow}>
          <label htmlFor="gp-reason">{tr("AttendanceView_text_131", "Reason / Purpose")} <span className={styles.required}>*</span></label>
          <textarea id="gp-reason" className={styles.textarea} value={fields.reason} maxLength={300} onChange={(event) => set("reason", event.target.value)}
            placeholder={tr("AttendanceView_placeholder_132", "Enter business reason or emergency justification...")} aria-required="true" aria-invalid={Boolean(errors.reason) || undefined} aria-describedby={describe("reason")} />
          {errors.reason && <span id="gp-reason-error" className={styles.fieldError}>{errors.reason}</span>}
        </div>
        {serverError && <div className={styles.errorNote} role="alert">{serverError}</div>}
        <div className={styles.formActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{tr("text_cancel", "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? tr("text_saving", "Saving…") : tr("AttendanceView_text_134", "Submit Request")}</button>
        </div>
      </form>
    </AttendanceDialog>
  );
}
