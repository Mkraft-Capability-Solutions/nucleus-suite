"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Dialog from "@mui/material/Dialog";
import { useHRMS } from "@/context/HRMSContext";
import { FormError } from "./LeaveBits";
import styles from "./Leave.module.css";
import { announceLeaveChanged, postLeave, useLeaveT, useSubmitKey, type LeaveEmployee } from "./leave-client";

const NS = "components.Leave.LeaveAdjustmentDialog";
const TYPES = ["EL", "CL", "SL", "BIRTHDAY"] as const;

type ShowToast = (title: string, message: string, tone: string) => void;

/** HR balance adjustment: POST /api/v1/leave-balances/adjustments (ledger entry with reason, never below zero). */
export default function LeaveAdjustmentDialog({
  employee,
  typeNames,
  onClose,
}: {
  employee: LeaveEmployee | null;
  typeNames: Record<string, string>;
  onClose: () => void;
}) {
  const { t } = useLeaveT();
  const hrms = useHRMS() as { showToast?: ShowToast } | null;
  const [leaveType, setLeaveType] = useState<string>("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const { keyFor, settle } = useSubmitKey();
  const value = Number(days);
  const errors = {
    leaveType: leaveType ? "" : t(`${NS}.type_required`, "Choose a leave type."),
    days:
      days.trim() === "" || !Number.isFinite(value) || value === 0
        ? t(`${NS}.days_required`, "Enter a non-zero number of days (negative to deduct).")
        : Math.abs(value) > 366 || Math.round(value * 2) !== value * 2
          ? t(`${NS}.days_step`, "Use half-day steps up to 366 days.")
          : "",
    reason: reason.trim().length < 3 ? t(`${NS}.reason_required`, "A reason of at least 3 characters is required.") : "",
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    const first = (Object.keys(errors) as Array<keyof typeof errors>).find((key) => errors[key]);
    if (first) {
      document.getElementById(`leave-adjust-${first}`)?.focus();
      return;
    }
    if (!employee || lock.current) return;
    const body = { employeeId: employee.id, leaveType, days: value, reason: reason.trim() };
    lock.current = true;
    setBusy(true);
    setMessage("");
    const result = await postLeave("/api/v1/leave-balances/adjustments", body, keyFor(body), t(`${NS}.text_failure`, "The adjustment could not be saved."));
    lock.current = false;
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    settle();
    hrms?.showToast?.(t(`${NS}.toast_title`, "Balance adjusted"), t(`${NS}.toast_body`, "The ledger entry was recorded."), "success");
    announceLeaveChanged();
    onClose();
  };
  const bad = (key: keyof typeof errors) => (touched && errors[key] ? styles.bad : "");
  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm" aria-labelledby="leave-adjust-title">
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.formHead}>
          <h2 id="leave-adjust-title">{t(`${NS}.text_title`, "Adjust leave balance")}</h2>
          <p>{employee ? `${employee.name} · ${employee.employeeCode}` : ""}</p>
        </div>
        <div className={styles.formBody}>
          <FormError message={message} />
          <div className={`${styles.f} ${bad("leaveType")}`}>
            <label htmlFor="leave-adjust-leaveType">{t(`${NS}.label_type`, "Leave type")} <span className={styles.req} aria-hidden="true">*</span></label>
            <select id="leave-adjust-leaveType" aria-required="true" value={leaveType} onChange={(event) => setLeaveType(event.target.value)}>
              <option value="">{t(`${NS}.text_select`, "Select leave type")}</option>
              {TYPES.map((code) => <option key={code} value={code}>{typeNames[code] ?? code}</option>)}
            </select>
            <span className={styles.msg}>{touched ? errors.leaveType : ""}</span>
          </div>
          <div className={`${styles.f} ${bad("days")}`}>
            <label htmlFor="leave-adjust-days">{t(`${NS}.label_days`, "Days (+ credit / − deduct)")} <span className={styles.req} aria-hidden="true">*</span></label>
            <input id="leave-adjust-days" type="number" step={0.5} min={-366} max={366} aria-required="true" value={days} onChange={(event) => setDays(event.target.value)} />
            <span className={styles.msg}>{touched ? errors.days : ""}</span>
          </div>
          <div className={`${styles.f} ${styles.wide} ${bad("reason")}`}>
            <label htmlFor="leave-adjust-reason">{t(`${NS}.label_reason`, "Reason")} <span className={styles.req} aria-hidden="true">*</span></label>
            <textarea id="leave-adjust-reason" aria-required="true" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
            <span className={styles.msg}>{touched ? errors.reason : ""}</span>
          </div>
        </div>
        <div className={styles.formFoot}>
          <button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>{t(`${NS}.button_cancel`, "Cancel")}</button>
          <button type="submit" className={styles.primary} disabled={busy || !employee} aria-busy={busy}>{busy ? t(`${NS}.button_saving`, "Saving…") : t(`${NS}.button_save`, "Record adjustment")}</button>
        </div>
      </form>
    </Dialog>
  );
}
