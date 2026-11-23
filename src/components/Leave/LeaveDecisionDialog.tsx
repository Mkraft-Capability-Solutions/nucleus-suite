"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Dialog from "@mui/material/Dialog";
import { useHRMS } from "@/context/HRMSContext";
import { FormError } from "./LeaveBits";
import styles from "./Leave.module.css";
import { announceLeaveChanged, formatLeaveDate, postLeave, useLeaveT, useSubmitKey, type LeaveRequestRow } from "./leave-client";

const NS = "components.Leave.LeaveDecisionDialog";

export type LeaveAction = "approve" | "reject" | "withdraw" | "cancel";

const TITLES: Record<LeaveAction, [string, string]> = {
  approve: ["title_approve", "Approve leave"],
  reject: ["title_reject", "Reject leave"],
  withdraw: ["title_withdraw", "Withdraw request"],
  cancel: ["title_cancel", "Cancel approved leave"],
};

type ShowToast = (title: string, message: string, tone: string) => void;

/**
 * Confirms one workflow action. Approve/reject call POST
 * /api/v1/leave-requests/{id}/decide; withdraw/cancel call .../cancel. A
 * reason is mandatory except for approval. The list changes only after the
 * server confirms.
 */
export default function LeaveDecisionDialog({ request, action, onClose }: { request: LeaveRequestRow; action: LeaveAction; onClose: () => void }) {
  const { t, locale } = useLeaveT();
  const hrms = useHRMS() as { showToast?: ShowToast } | null;
  const [remarks, setRemarks] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const { keyFor, settle } = useSubmitKey();
  const reasonRequired = action !== "approve";
  const invalid = reasonRequired && remarks.trim().length < 3;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (invalid) {
      document.getElementById("leave-decision-remarks")?.focus();
      return;
    }
    if (lock.current) return;
    const decide = action === "approve" || action === "reject";
    const url = `/api/v1/leave-requests/${encodeURIComponent(request.id)}/${decide ? "decide" : "cancel"}`;
    const body = decide ? { approve: action === "approve", ...(remarks.trim() ? { comment: remarks.trim() } : {}) } : { reason: remarks.trim() };
    lock.current = true;
    setBusy(true);
    setMessage("");
    const result = await postLeave(url, body, keyFor({ url, body }), t(`${NS}.text_failure`, "The action could not be recorded."));
    lock.current = false;
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    settle();
    hrms?.showToast?.(t(`${NS}.${TITLES[action][0]}`, TITLES[action][1]), t(`${NS}.toast_recorded`, "Recorded."), "success");
    announceLeaveChanged();
    onClose();
  };
  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm" aria-labelledby="leave-decision-title">
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.formHead}>
          <h2 id="leave-decision-title">{t(`${NS}.${TITLES[action][0]}`, TITLES[action][1])}</h2>
          <p>
            {request.employee_name ?? request.employee_code} · {request.leave_type_name ?? request.leave_type} · {formatLeaveDate(request.starts_on, locale)} – {formatLeaveDate(request.ends_on, locale)}
          </p>
        </div>
        <div className={styles.formBody}>
          <FormError message={message} />
          <div className={`${styles.f} ${styles.wide} ${touched && invalid ? styles.bad : ""}`}>
            <label htmlFor="leave-decision-remarks">
              {t(`${NS}.label_remarks`, "Remarks")} {reasonRequired ? <span className={styles.req} aria-hidden="true">*</span> : <span className={styles.opt}>{t(`${NS}.text_optional`, "(optional)")}</span>}
            </label>
            <textarea id="leave-decision-remarks" maxLength={1000} aria-required={reasonRequired} aria-invalid={touched && invalid} aria-describedby="leave-decision-remarks-msg" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            <span id="leave-decision-remarks-msg" className={styles.msg}>{touched && invalid ? t(`${NS}.text_reason_required`, "A reason of at least 3 characters is required.") : ""}</span>
          </div>
        </div>
        <div className={styles.formFoot}>
          <button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>{t(`${NS}.button_back`, "Back")}</button>
          <button type="submit" className={action === "approve" ? styles.primary : styles.danger} disabled={busy} aria-busy={busy}>
            {busy ? t(`${NS}.button_saving`, "Saving…") : t(`${NS}.button_confirm`, "Confirm")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
