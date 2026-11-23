"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Dialog from "@mui/material/Dialog";
import { RotateCcw } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import { FormError } from "./LeaveBits";
import styles from "./Leave.module.css";
import { announceLeaveChanged, formatDays, formatLeaveDate, postLeave, todayIso, useLeaveT, useSubmitKey, type LeaveRequestRow } from "./leave-client";

const NS = "components.Leave.EarlyReturnDialog";

type ShowToast = (title: string, message: string, tone: string) => void;

/** Records an early return: POST /api/v1/leave-requests/{id}/early-return; the server re-credits the unused days. */
export default function EarlyReturnDialog({ request, onClose }: { request: LeaveRequestRow; onClose: () => void }) {
  const { t, locale } = useLeaveT();
  const hrms = useHRMS() as { showToast?: ShowToast } | null;
  const start = request.starts_on ?? "";
  const end = request.ends_on ?? "";
  const initial = todayIso() >= start && todayIso() <= end ? todayIso() : start;
  const [date, setDate] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const { keyFor, settle } = useSubmitKey();
  const invalid = !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > end;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invalid) {
      document.getElementById("early-return-date")?.focus();
      return;
    }
    if (lock.current) return;
    const body = { actualReturnDate: date };
    lock.current = true;
    setBusy(true);
    setMessage("");
    const result = await postLeave<{ leaveDaysCreditedBack?: number }>(`/api/v1/leave-requests/${encodeURIComponent(request.id)}/early-return`, body, keyFor(body), t(`${NS}.text_failure`, "The early return could not be recorded."));
    lock.current = false;
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    settle();
    const credited = result.data?.leaveDaysCreditedBack;
    hrms?.showToast?.(
      t(`${NS}.toast_title`, "Early return recorded"),
      typeof credited === "number" ? t(`${NS}.toast_body`, "{days} day(s) re-credited to the balance.", { days: formatDays(credited, locale) }) : t(`${NS}.toast_body_replay`, "Already recorded."),
      "success",
    );
    announceLeaveChanged();
    onClose();
  };
  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm" aria-labelledby="early-return-title">
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.formHead}>
          <h2 id="early-return-title"><RotateCcw size={18} aria-hidden="true" /> {t(`${NS}.text_title`, "Record early return")}</h2>
          <p>
            {request.employee_name ?? request.employee_code} · {formatLeaveDate(start, locale)} – {formatLeaveDate(end, locale)} · {t(`${NS}.text_days`, "{days} day(s) approved", { days: formatDays(request.requested_days, locale) })}
          </p>
        </div>
        <div className={styles.formBody}>
          <FormError message={message} />
          <div className={`${styles.f} ${styles.wide} ${invalid ? styles.bad : ""}`}>
            <label htmlFor="early-return-date">{t(`${NS}.label_date`, "Actual return date")} <span className={styles.req} aria-hidden="true">*</span></label>
            <input id="early-return-date" type="date" required min={start} max={end} value={date} aria-invalid={invalid} aria-describedby="early-return-date-msg" onChange={(event) => setDate(event.target.value)} />
            <span id="early-return-date-msg" className={styles.msg}>
              {invalid ? t(`${NS}.text_date_range`, "Choose a date within the approved period.") : t(`${NS}.text_date_help`, "Days from this date to the approved end date are re-credited.")}
            </span>
          </div>
        </div>
        <div className={styles.formFoot}>
          <button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>{t(`${NS}.button_cancel`, "Cancel")}</button>
          <button type="submit" className={styles.primary} disabled={busy} aria-busy={busy}>{busy ? t(`${NS}.button_saving`, "Saving…") : t(`${NS}.button_confirm`, "Record return")}</button>
        </div>
      </form>
    </Dialog>
  );
}
