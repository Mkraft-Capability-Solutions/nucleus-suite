"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import styles from "../RecruitmentView.module.css";
import { ApiError, employeeLabel, errorMessage, getData, sendJson, useSubmitKey, type Employee, type Translate } from "../workspaceHttp";
import type { RequisitionRegister } from "./types";
import { NS } from "./useRecruitmentData";

type Props = {
  t: Translate;
  register: RequisitionRegister;
  people: Employee[];
  defaultManagerId: string | null;
  onClose: () => void;
  onCreated: (code: string) => void;
};

type Form = {
  title: string; departmentId: string; designation: string; positions: string; budget: string;
  hiringManagerEmployeeId: string; requisitionType: "addition" | "replacement";
  againstPositionCode: string; replacingEmployeeId: string; overrideRequested: boolean; overrideReason: string;
};
type Preview = NonNullable<RequisitionRegister["preview"]>;

/** Same rules as raiseRequisitionSchema (src/server/talent/requisition-raise.ts). */
function validate(form: Form, minReason: number, t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.trim().length < 3) errors.title = t(`${NS}.err_title`, "Enter a job title of at least 3 characters.");
  if (!form.departmentId) errors.departmentId = t(`${NS}.err_department`, "Choose a department.");
  if (form.requisitionType === "addition" && form.designation.trim().length < 1) errors.designation = t(`${NS}.err_designation`, "An addition needs a designation so its sanctioned strength can be found.");
  const positions = Number(form.positions);
  if (!Number.isInteger(positions) || positions < 1 || positions > 99) errors.positions = t(`${NS}.err_positions`, "Enter a whole number from 1 to 99.");
  const budget = Number(form.budget);
  if (!form.budget.trim() || !Number.isFinite(budget) || budget <= 0) errors.ctcMaxMinor = t(`${NS}.err_budget`, "Enter a positive annual CTC budget.");
  if (!form.hiringManagerEmployeeId) errors.hiringManagerEmployeeId = t(`${NS}.err_manager`, "Choose the hiring manager.");
  if (form.requisitionType === "replacement") {
    if (!form.againstPositionCode.trim()) errors.againstPositionCode = t(`${NS}.err_vacated`, "A replacement must name the vacated position code.");
    if (!form.replacingEmployeeId) errors.replacingEmployeeId = t(`${NS}.err_incumbent`, "Choose the previous incumbent.");
  }
  if (form.overrideRequested && form.overrideReason.trim().length < minReason) {
    errors.overrideReason = t(`${NS}.err_override`, "An override needs a justification of at least {min} characters.", { min: minReason });
  }
  return errors;
}

/**
 * Create-requisition form. The quota panel is the server's own verdict (GET /api/v1/requisition-register
 * preview); submit posts to POST /api/v1/requisition-register with one Idempotency-Key per logical submit.
 */
export default function RequisitionModal({ t, register, people, defaultManagerId, onClose, onCreated }: Props) {
  const [form, setForm] = useState<Form>({
    title: "", departmentId: register.departments[0]?.id ?? "", designation: "", positions: "1", budget: "",
    hiringManagerEmployeeId: defaultManagerId ?? "", requisitionType: "addition", againstPositionCode: "", replacingEmployeeId: "",
    overrideRequested: false, overrideReason: "",
  });
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ key: string; value: Preview | null; error: string | null } | null>(null);
  const submitKey = useSubmitKey();

  const errors = useMemo(() => ({ ...validate(form, register.overrideReasonMinLength, t), ...serverErrors }), [form, register.overrideReasonMinLength, t, serverErrors]);
  const shown = touched ? errors : serverErrors;

  const previewQuery = useMemo(() => {
    const params = new URLSearchParams({ previewRequisitionType: form.requisitionType, previewPositions: String(Number(form.positions) || 1) });
    if (form.requisitionType === "replacement") {
      if (!form.againstPositionCode.trim()) return null;
      params.set("previewAgainstPositionCode", form.againstPositionCode.trim());
    } else {
      if (!form.departmentId || !form.designation.trim()) return null;
      params.set("previewDepartmentId", form.departmentId);
      params.set("previewDesignation", form.designation.trim());
    }
    if (form.overrideRequested) {
      params.set("previewOverride", "true");
      if (form.overrideReason.trim()) params.set("previewOverrideReason", form.overrideReason.trim());
    }
    return params.toString();
  }, [form]);

  useEffect(() => {
    if (!previewQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getData<RequisitionRegister>(`/api/v1/requisition-register?${previewQuery}`, t(`${NS}.text_preview_failed`, "The quota check could not be run."), controller.signal)
        .then((data) => setPreview({ key: previewQuery, value: data.preview, error: null }))
        .catch((error: unknown) => { if (!controller.signal.aborted) setPreview({ key: previewQuery, value: null, error: errorMessage(error, "") }); });
    }, 400);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [previewQuery, t]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setServerErrors({});
    setFormError(null);
    submitKey.reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (busy || Object.keys(validate(form, register.overrideReasonMinLength, t)).length > 0) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await sendJson<{ code: string }>("/api/v1/requisition-register", {
        method: "POST",
        idempotencyKey: submitKey.current(),
        body: {
          title: form.title.trim(), departmentId: form.departmentId, designation: form.designation.trim() || undefined,
          requisitionType: form.requisitionType, positions: Number(form.positions), hiringManagerEmployeeId: form.hiringManagerEmployeeId,
          againstPositionCode: form.requisitionType === "replacement" ? form.againstPositionCode.trim() : undefined,
          replacingEmployeeId: form.requisitionType === "replacement" ? form.replacingEmployeeId : undefined,
          ctcMaxMinor: Math.round(Number(form.budget) * 100),
          overrideRequested: form.overrideRequested, overrideReason: form.overrideRequested ? form.overrideReason.trim() : undefined,
        },
      }, t(`${NS}.text_requisition_failed`, "The requisition could not be created."));
      submitKey.reset();
      onCreated(result.code ?? "");
    } catch (error) {
      setFormError(errorMessage(error, t(`${NS}.text_requisition_failed`, "The requisition could not be created.")));
      if (error instanceof ApiError) setServerErrors(error.fields);
    } finally {
      setBusy(false);
    }
  };

  const field = (name: string) => ({ "aria-invalid": shown[name] ? true : undefined, "aria-describedby": shown[name] ? `req-${name}-error` : undefined });
  const fieldError = (name: string) => shown[name] ? <span id={`req-${name}-error`} className={styles.fieldError}>{shown[name]}</span> : null;
  const req = <span className={styles.required} aria-hidden="true">*</span>;
  const current = preview && preview.key === previewQuery ? preview : null;

  return (
    <div className={styles.modalOverlay} onClick={() => !busy && onClose()}>
      <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="req-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 id="req-title">{t(`${NS}.text_open_requisition`, "Open new job requisition")}</h3>
            <p>{t(`${NS}.text_requisition_subtitle`, "Sanctioned manpower quota and replacement code verification")}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} /></button>
        </div>
        <form className={styles.modalBody} onSubmit={submit} noValidate>
          {register.departments.length === 0 && <p className={styles.formError}>{t(`${NS}.text_no_departments`, "No departments exist yet. Create a department before raising a requisition.")}</p>}
          <div className={styles.formGroup}>
            <label htmlFor="req-title-input">{t(`${NS}.text_job_title`, "Job title")}{req}</label>
            <input id="req-title-input" className={styles.formInput} value={form.title} onChange={(e) => update("title", e.target.value)} aria-required="true" maxLength={200} {...field("title")} />
            {fieldError("title")}
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="req-dept">{t(`${NS}.text_department`, "Department")}{req}</label>
              <select id="req-dept" className={styles.formInput} value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)} aria-required="true" {...field("departmentId")}>
                {register.departments.length === 0 && <option value="">{t(`${NS}.text_none_available`, "None available")}</option>}
                {register.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              {fieldError("departmentId")}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="req-designation">{t(`${NS}.text_designation`, "Designation")}{form.requisitionType === "addition" ? req : <span className={styles.hint}> {t(`${NS}.text_optional`, "(optional)")}</span>}</label>
              <input id="req-designation" className={styles.formInput} value={form.designation} onChange={(e) => update("designation", e.target.value)} maxLength={120} {...field("designation")} />
              {fieldError("designation")}
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="req-positions">{t(`${NS}.text_positions`, "Positions")}{req}</label>
              <input id="req-positions" type="number" min={1} max={99} step={1} className={styles.formInput} value={form.positions} onChange={(e) => update("positions", e.target.value)} {...field("positions")} />
              {fieldError("positions")}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="req-budget">{t(`${NS}.text_budget`, "Budget (annual CTC)")}{req}</label>
              <input id="req-budget" type="number" min={1} step={1000} inputMode="numeric" className={styles.formInput} value={form.budget} onChange={(e) => update("budget", e.target.value)} {...field("ctcMaxMinor")} />
              {fieldError("ctcMaxMinor")}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="req-manager">{t(`${NS}.text_hiring_manager`, "Hiring manager")}{req}</label>
            <select id="req-manager" className={styles.formInput} value={form.hiringManagerEmployeeId} onChange={(e) => update("hiringManagerEmployeeId", e.target.value)} {...field("hiringManagerEmployeeId")}>
              <option value="">{t(`${NS}.text_choose_employee`, "Choose an employee")}</option>
              {people.map((person) => <option key={person.id} value={person.id}>{employeeLabel(person)}</option>)}
            </select>
            {fieldError("hiringManagerEmployeeId")}
          </div>
          <fieldset className={styles.radioRow}>
            <legend className={styles.legend}>{t(`${NS}.text_classification`, "Requisition classification")}{req}</legend>
            <label><input type="radio" name="reqType" checked={form.requisitionType === "addition"} onChange={() => update("requisitionType", "addition")} />{t(`${NS}.text_new_addition`, "New headcount addition (capacity slot)")}</label>
            <label><input type="radio" name="reqType" checked={form.requisitionType === "replacement"} onChange={() => update("requisitionType", "replacement")} />{t(`${NS}.text_replacement_backfill`, "Replacement backfill (vacated code)")}</label>
          </fieldset>
          {form.requisitionType === "replacement" && (
            <div className={styles.subPanel}>
              <strong>{t(`${NS}.text_vacated_tracking`, "Vacated position tracking")}</strong>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="req-vacated">{t(`${NS}.text_vacated_code`, "Vacated position code")}{req}</label>
                  <input id="req-vacated" className={styles.formInput} value={form.againstPositionCode} onChange={(e) => update("againstPositionCode", e.target.value)} maxLength={40} {...field("againstPositionCode")} />
                  {fieldError("againstPositionCode")}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="req-incumbent">{t(`${NS}.text_previous_incumbent`, "Previous incumbent")}{req}</label>
                  <select id="req-incumbent" className={styles.formInput} value={form.replacingEmployeeId} onChange={(e) => update("replacingEmployeeId", e.target.value)} {...field("replacingEmployeeId")}>
                    <option value="">{t(`${NS}.text_choose_employee`, "Choose an employee")}</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{employeeLabel(person)}</option>)}
                  </select>
                  {fieldError("replacingEmployeeId")}
                </div>
              </div>
            </div>
          )}
          <div aria-live="polite">
            {!previewQuery && <div className={styles.previewInfo}>{t(`${NS}.text_preview_needs`, "Enter the department and designation (or the vacated code) to check the quota.")}</div>}
            {previewQuery && !current && <div className={styles.previewInfo}>{t(`${NS}.text_checking_quota`, "Checking the quota…")}</div>}
            {current?.error && <div className={styles.previewBlocked}><AlertTriangle size={16} aria-hidden="true" />{current.error}</div>}
            {current?.value && (
              <div className={current.value.gate.allowed ? styles.previewOk : styles.previewBlocked}>
                {current.value.gate.allowed ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
                <span>
                  <strong>{current.value.headroom.label}</strong> — {current.value.headroom.detail}
                  {current.value.gate.message && <span className={styles.sub}>{current.value.gate.message}</span>}
                  {!current.value.gate.checked && current.value.gate.uncheckedReason && <span className={styles.sub}>{current.value.gate.uncheckedReason}</span>}
                </span>
              </div>
            )}
          </div>
          <div className={styles.subPanel}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={form.overrideRequested} onChange={(e) => update("overrideRequested", e.target.checked)} />
              {t(`${NS}.text_waiver`, "Request an executive headcount expansion override")}
            </label>
            {!register.overriderAuthorised && <span className={styles.hint}>{t(`${NS}.text_waiver_hint`, "An approver holding the manpower-approval permission decides the override at approval.")}</span>}
            {form.overrideRequested && (
              <div className={styles.formGroup}>
                <label htmlFor="req-reason">{t(`${NS}.text_waiver_reason`, "Justification")}{req}</label>
                <textarea id="req-reason" rows={3} className={styles.formInput} value={form.overrideReason} onChange={(e) => update("overrideReason", e.target.value)} maxLength={1000} {...field("overrideReason")} />
                <span className={styles.hint}>{t(`${NS}.text_min_chars`, "At least {min} characters.", { min: register.overrideReasonMinLength })}</span>
                {fieldError("overrideReason")}
              </div>
            )}
          </div>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy || register.departments.length === 0}>{busy ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_submit_requisition`, "Submit requisition")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
