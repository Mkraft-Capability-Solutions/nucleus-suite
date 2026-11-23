"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Dialog from "@mui/material/Dialog";
import { useHRMS } from "@/context/HRMSContext";
import LeaveEmployeeSelect from "./LeaveEmployeeSelect";
import { FormError } from "./LeaveBits";
import styles from "./Leave.module.css";
import {
  announceLeaveChanged,
  formatDays,
  postLeave,
  todayIso,
  useLeaveResource,
  useLeaveT,
  useSubmitKey,
  type BalanceCard,
  type LeaveContext,
  type LeaveEmployee,
  type LeaveEngine,
} from "./leave-client";
import { validateLeaveApplication, REQUESTABLE_TYPES, type LeaveDraft, type LeaveField } from "./leave-validation";

const NS = "components.Leave.LeaveApplicationDialog";

/**
 * The one leave application form (SCR apply leave). Applicant, leave types and
 * balances come from the leave APIs; the request is submitted to
 * POST /api/v1/leave-requests, which re-checks scope, overlap and balance.
 */
export default function LeaveApplicationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { t } = useLeaveT();
  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm(t(`${NS}.text_discard_changes`, "Discard this leave application?"))) return;
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" aria-labelledby="leave-application-title">
      {open && (
        <LeaveApplicationForm
          onCancel={close}
          onDone={() => {
            setDirty(false);
            onClose();
          }}
          busy={busy}
          setBusy={setBusy}
          setDirty={setDirty}
        />
      )}
    </Dialog>
  );
}

type ShowToast = (title: string, message: string, tone: string) => void;

function LeaveApplicationForm({
  onCancel,
  onDone,
  busy,
  setBusy,
  setDirty,
}: {
  onCancel: () => void;
  onDone: () => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setDirty: (value: boolean) => void;
}) {
  const { t, locale } = useLeaveT();
  const hrms = useHRMS() as { showToast?: ShowToast } | null;
  const failed = t(`${NS}.text_failure`, "The leave application could not be submitted.");
  const contextResource = useLeaveResource<LeaveContext>("/api/v1/leave/context", t(`${NS}.text_context_failed`, "Your leave profile could not be loaded."));
  const engine = useLeaveResource<LeaveEngine>("/api/v1/leave/engine", t(`${NS}.text_types_failed`, "Leave types could not be loaded."));
  const context = contextResource.state.status === "ready" ? contextResource.state.data : null;
  const [picked, setPicked] = useState<LeaveEmployee | null>(null);
  const employee = picked ?? context?.employee ?? null;
  const today = todayIso();
  const [draft, setDraft] = useState<LeaveDraft>({ leaveType: "", startsOn: today, endsOn: today, duration: "full", days: "1", reason: "", contact: "" });
  const [touched, setTouched] = useState<Partial<Record<LeaveField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<LeaveField, string>>>({});
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const { keyFor, settle } = useSubmitKey();
  const balances = useLeaveResource<BalanceCard[]>(
    employee ? `/api/v1/leave/balance-cards?employeeId=${encodeURIComponent(employee.id)}` : null,
    t(`${NS}.text_balance_failed`, "Balances could not be loaded."),
  );
  const available = useMemo(() => {
    if (balances.state.status !== "ready" || !draft.leaveType) return null;
    const card = balances.state.data.find((row) => row.leaveType === draft.leaveType);
    return card ? card.available : 0;
  }, [balances.state, draft.leaveType]);

  const types = engine.state.status === "ready" ? engine.state.data.leaveTypeRules : [];
  const errors = { ...validateLeaveApplication(draft, { available, hasEmployee: Boolean(employee) }, t), ...serverErrors };

  const update = (patch: Partial<LeaveDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (next.startsOn !== next.endsOn && next.duration !== "full") next.duration = "full";
      if (patch.startsOn !== undefined || patch.endsOn !== undefined || patch.duration !== undefined) {
        const span = Math.round((Date.parse(next.endsOn) - Date.parse(next.startsOn)) / 86_400_000) + 1;
        next.days = next.duration === "full" ? (Number.isFinite(span) && span > 0 ? String(span) : "") : "0.5";
      }
      return next;
    });
    setServerErrors({});
    setMessage("");
    setDirty(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current) return;
    const allTouched = { employee: true, leaveType: true, startsOn: true, endsOn: true, days: true, reason: true, contact: true };
    setTouched(allTouched);
    const firstInvalid = (Object.keys(allTouched) as LeaveField[]).find((field) => errors[field]);
    if (firstInvalid || !employee) {
      document.getElementById(`leave-apply-${firstInvalid ?? "employee"}`)?.focus();
      return;
    }
    const body = {
      employeeId: employee.id,
      leaveType: draft.leaveType,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      days: Number(draft.days),
      ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
      ...(draft.contact.trim() ? { contact: draft.contact.trim() } : {}),
      ...(draft.duration !== "full" ? { halfDaySession: draft.duration } : {}),
    };
    lock.current = true;
    setBusy(true);
    setMessage("");
    const result = await postLeave<{ id: string; status?: string }>("/api/v1/leave-requests", body, keyFor(body), failed);
    lock.current = false;
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      const mapped: Partial<Record<LeaveField, string>> = {};
      for (const detail of result.details) {
        const field = detail.field as LeaveField;
        if (field in allTouched) mapped[field] = result.message;
      }
      setServerErrors(mapped);
      return;
    }
    settle();
    hrms?.showToast?.(t(`${NS}.toast_submitted_title`, "Leave submitted"), t(`${NS}.toast_submitted_body`, "Your request is waiting for approval."), "success");
    announceLeaveChanged();
    onDone();
  };

  const show = (field: LeaveField) => (touched[field] || serverErrors[field] ? errors[field] : undefined);
  const fieldClass = (field: LeaveField) => `${styles.f} ${show(field) ? styles.bad : ""}`;
  const reqMark = <span className={styles.req} aria-hidden="true">*</span>;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.formHead}>
        <h2 id="leave-application-title">{t(`${NS}.text_title`, "Apply for leave")}</h2>
        <p>{t(`${NS}.text_subtitle`, "Days are reserved on submit and debited on final approval.")}</p>
      </div>
      <div className={styles.formBody}>
        <FormError message={message} />
        {contextResource.state.status === "error" && <FormError message={contextResource.state.message} />}
        {engine.state.status === "error" && <FormError message={engine.state.message} />}
        <div className={`${fieldClass("employee")} ${styles.wide}`}>
          {context?.actsForOthers ? (
            <LeaveEmployeeSelect id="leave-apply-employee" required label={t(`${NS}.label_employee`, "Employee")} value={employee} onChange={(next) => { setPicked(next); setDirty(true); }} error={show("employee")} />
          ) : (
            <>
              <label htmlFor="leave-apply-employee">{t(`${NS}.label_employee`, "Employee")} {reqMark}</label>
              <input id="leave-apply-employee" readOnly value={employee ? `${employee.name} · ${employee.employeeCode}` : ""} placeholder={contextResource.state.status === "loading" ? t(`${NS}.text_loading`, "Loading…") : t(`${NS}.text_no_employee`, "Your login is not linked to an employee record")} aria-invalid={Boolean(show("employee"))} aria-describedby="leave-apply-employee-msg" />
              <span id="leave-apply-employee-msg" className={styles.msg}>{show("employee")}</span>
            </>
          )}
        </div>
        <div className={fieldClass("leaveType")}>
          <label htmlFor="leave-apply-leaveType">{t(`${NS}.label_type`, "Leave type")} {reqMark}</label>
          <select id="leave-apply-leaveType" value={draft.leaveType} aria-required="true" aria-invalid={Boolean(show("leaveType"))} aria-describedby="leave-apply-leaveType-msg" onChange={(event) => update({ leaveType: event.target.value })} onBlur={() => setTouched((v) => ({ ...v, leaveType: true }))}>
            <option value="">{engine.state.status === "loading" ? t(`${NS}.text_loading`, "Loading…") : t(`${NS}.text_select_leave_type`, "Select leave type")}</option>
            {types.map((type) => {
              const requestable = REQUESTABLE_TYPES.has(type.code) && (type.code !== "BIRTHDAY" || Boolean(employee?.hasBirthDate));
              return (
                <option key={type.code} value={type.code} disabled={!requestable}>
                  {type.name}{requestable ? "" : ` — ${type.code === "BIRTHDAY" ? t(`${NS}.text_birthday_unavailable`, "date of birth not on record") : t(`${NS}.text_not_requestable`, "apply through HR")}`}
                </option>
              );
            })}
          </select>
          <span id="leave-apply-leaveType-msg" className={styles.msg}>
            {show("leaveType") ?? (available !== null ? t(`${NS}.text_available`, "{days} day(s) available", { days: formatDays(available, locale) }) : "")}
          </span>
        </div>
        <div className={fieldClass("days")}>
          <label htmlFor="leave-apply-days">{t(`${NS}.label_days`, "Days to debit")} {reqMark}</label>
          <div className={styles.stepper}>
            <button type="button" aria-label={t(`${NS}.aria_decrease`, "Decrease by half a day")} disabled={Number(draft.days) <= 0.5} onClick={() => update({ days: String(Math.max(0.5, Number(draft.days) - 0.5)) })}>−</button>
            <input id="leave-apply-days" type="number" inputMode="decimal" min={0.5} max={60} step={0.5} value={draft.days} aria-required="true" aria-invalid={Boolean(show("days"))} aria-describedby="leave-apply-days-msg" onChange={(event) => update({ days: event.target.value })} onBlur={() => setTouched((v) => ({ ...v, days: true }))} />
            <button type="button" aria-label={t(`${NS}.aria_increase`, "Increase by half a day")} disabled={Number(draft.days) >= 60} onClick={() => update({ days: String(Math.min(60, Number(draft.days) + 0.5)) })}>+</button>
          </div>
          <span id="leave-apply-days-msg" className={styles.msg}>{show("days") ?? t(`${NS}.text_days_help`, "Exclude weekly offs and holidays that do not count against leave.")}</span>
        </div>
        <div className={fieldClass("startsOn")}>
          <label htmlFor="leave-apply-startsOn">{t(`${NS}.label_from`, "From")} {reqMark}</label>
          <input id="leave-apply-startsOn" type="date" value={draft.startsOn} aria-required="true" aria-invalid={Boolean(show("startsOn"))} aria-describedby="leave-apply-startsOn-msg" onChange={(event) => update({ startsOn: event.target.value })} onBlur={() => setTouched((v) => ({ ...v, startsOn: true }))} />
          <span id="leave-apply-startsOn-msg" className={styles.msg}>{show("startsOn")}</span>
        </div>
        <div className={fieldClass("endsOn")}>
          <label htmlFor="leave-apply-endsOn">{t(`${NS}.label_to`, "To")} {reqMark}</label>
          <input id="leave-apply-endsOn" type="date" min={draft.startsOn} value={draft.endsOn} aria-required="true" aria-invalid={Boolean(show("endsOn"))} aria-describedby="leave-apply-endsOn-msg" onChange={(event) => update({ endsOn: event.target.value })} onBlur={() => setTouched((v) => ({ ...v, endsOn: true }))} />
          <span id="leave-apply-endsOn-msg" className={styles.msg}>{show("endsOn")}</span>
        </div>
        {draft.startsOn === draft.endsOn && (
          <div className={styles.f}>
            <label htmlFor="leave-apply-duration">{t(`${NS}.label_duration`, "Duration")}</label>
            <select id="leave-apply-duration" value={draft.duration} onChange={(event) => update({ duration: event.target.value as LeaveDraft["duration"] })}>
              <option value="full">{t(`${NS}.option_full_day`, "Full day")}</option>
              <option value="first_half">{t(`${NS}.option_first_half`, "First half")}</option>
              <option value="second_half">{t(`${NS}.option_second_half`, "Second half")}</option>
            </select>
          </div>
        )}
        <div className={fieldClass("contact")}>
          <label htmlFor="leave-apply-contact">{t(`${NS}.label_contact`, "Contact while away")} <span className={styles.opt}>{t(`${NS}.text_optional`, "(optional)")}</span></label>
          <input id="leave-apply-contact" maxLength={200} value={draft.contact} aria-describedby="leave-apply-contact-msg" onChange={(event) => update({ contact: event.target.value })} />
          <span id="leave-apply-contact-msg" className={styles.msg}>{show("contact")}</span>
        </div>
        <div className={`${fieldClass("reason")} ${styles.wide}`}>
          <label htmlFor="leave-apply-reason">{t(`${NS}.label_reason`, "Reason")} <span className={styles.opt}>{t(`${NS}.text_optional`, "(optional)")}</span></label>
          <textarea id="leave-apply-reason" maxLength={500} value={draft.reason} aria-describedby="leave-apply-reason-msg" onChange={(event) => update({ reason: event.target.value })} />
          <span id="leave-apply-reason-msg" className={styles.msg}>{show("reason") ?? t(`${NS}.text_reason_count`, "{count}/500", { count: draft.reason.length })}</span>
        </div>
      </div>
      <div className={styles.formFoot}>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>{t(`${NS}.button_cancel`, "Cancel")}</button>
        <button type="submit" className={styles.primary} disabled={busy || !employee} aria-busy={busy}>
          {busy ? t(`${NS}.button_submitting`, "Submitting…") : t(`${NS}.button_submit`, "Submit for approval")}
        </button>
      </div>
    </form>
  );
}
