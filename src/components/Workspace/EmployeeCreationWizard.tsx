"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/context/I18nContext";
import { getData, localToday, newIdempotencyKey, sendJson, type FieldIssue, type Translate } from "./onboarding/api";
import type { EmployeeOption } from "./onboarding/EmployeePicker";
import StateNote from "./onboarding/StateNote";
import { FIELD_BY_KEY, emptyRow, initialRows, initialValues, ROW_GROUPS, type FormValues, type Row, type RowGroupId, type Rows, type Scalar } from "./employee-wizard/fields";
import { WIZARD_NS, type ReferenceOptions } from "./employee-wizard/FieldControl";
import { buildPersonPayload, fromRecord, type PersonRecord } from "./employee-wizard/payload";
import { readResumeText, type ResumeFindings } from "./employee-wizard/resume";
import ReviewStep from "./employee-wizard/ReviewStep";
import { formStatus, rowErrors } from "./employee-wizard/validation";
import styles from "./EmployeeCreationWizard.module.css";

/**
 * FRM-PPL-01 employee wizard, in the three steps of the approved design:
 * 1 resume (optional, read on the device), 2 review what still needs the user, 3 submit.
 * Create saves with POST /api/v1/people, edit loads with GET and saves with PATCH
 * /api/v1/people/{id}. `onSave` is called only after the server has accepted the write.
 */

type Step = 1 | 2 | 3;

export type SavedEmployee = {
  id: string;
  dbId: string;
  persisted: true;
  name: string;
  role: string;
  dept: string;
  location: string;
  status: string;
  manager: string | null;
  mobile: string;
  details: Record<string, unknown>;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (employee: SavedEmployee) => void;
  mode?: "create" | "edit";
  initialData?: { id?: string; dbId?: string } | null;
  existingEmployees?: unknown[];
};

type ReferencePayload = {
  departments: Array<{ name: string; code: string | null }>;
  locations: Array<{ code: string; name: string; city: string | null }>;
  shifts: Array<{ code: string; name: string }>;
};

type Saved = { id: string; employeeCode?: string; employee_code?: string };

const EMPTY_REFERENCE: ReferenceOptions = { departments: [], locations: [], shifts: [], loaded: false };
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv", ""]);

function applyFindings(values: FormValues, rows: Rows, found: ResumeFindings): { values: FormValues; rows: Rows; marked: Record<string, boolean> } {
  const next = { ...values };
  const marked: Record<string, boolean> = {};
  for (const key of ["firstName", "lastName", "personalEmail", "mobile", "designation"] as const) {
    const value = found[key];
    if (value && FIELD_BY_KEY.has(key) && !String(next[key] ?? "").trim()) { next[key] = value; marked[key] = true; }
  }
  const nextRows: Rows = { ...rows };
  const addRow = (groupId: RowGroupId, patch: Row) => {
    const group = ROW_GROUPS.find((item) => item.id === groupId);
    if (!group) return;
    nextRows[groupId] = [...rows[groupId], { ...emptyRow(group), ...patch }];
  };
  if (found.degree) addRow("education", { degree: found.degree, passingYear: found.passingYear ?? "" });
  if (found.employer) addRow("experience", { employer: found.employer, designation: found.designation ?? "" });
  return { values: next, rows: nextRows, marked };
}

export default function EmployeeCreationWizard({ isOpen, onClose, onSave, mode = "create", initialData = null }: Props) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const k = (key: string, fallback: string, params?: Record<string, string | number>) => t(`${WIZARD_NS}.${key}`, fallback, params);
  const today = useMemo(() => localToday(), []);

  const [step, setStep] = useState<Step>(mode === "edit" ? 2 : 1);
  const [values, setValues] = useState<FormValues>(() => initialValues(today));
  const [rows, setRows] = useState<Rows>(() => initialRows());
  const [manager, setManager] = useState<EmployeeOption | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fromResume, setFromResume] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ identity: true });
  const [reference, setReference] = useState<ReferenceOptions>(EMPTY_REFERENCE);
  const [referenceError, setReferenceError] = useState("");
  const [record, setRecord] = useState<{ status: "idle" | "loading" | "ready" | "error"; id: string; message: string }>({ status: mode === "edit" ? "loading" : "idle", id: "", message: "" });
  const [resumeText, setResumeText] = useState("");
  const [resumeNote, setResumeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; issues: FieldIssue[] } | null>(null);
  const idempotencyKey = useRef<string>(newIdempotencyKey());
  const dialogRef = useRef<HTMLDivElement>(null);

  const editRef = initialData?.dbId || initialData?.id || "";

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    getData<ReferencePayload>("/api/v1/onboarding/form-reference", t(`${WIZARD_NS}.reference_failed`, "Departments, locations and shifts could not be loaded."), controller.signal)
      .then((data) => setReference({
        departments: data.departments.map((d) => ({ value: d.name, label: d.name })),
        locations: data.locations.map((l) => ({ value: l.name, label: l.city ? `${l.name} (${l.city})` : l.name })),
        shifts: data.shifts.map((s) => ({ value: s.code, label: s.name })),
        loaded: true,
      }))
      .catch((error: unknown) => { if (!controller.signal.aborted) setReferenceError(error instanceof Error ? error.message : ""); });
    return () => controller.abort();
  }, [isOpen, t]);

  const fetchRecord = useCallback(() => {
    if (mode !== "edit" || !editRef) return;
    getData<PersonRecord>(`/api/v1/people/${encodeURIComponent(editRef)}`, t(`${WIZARD_NS}.record_failed`, "This employee record could not be loaded."))
      .then((data) => {
        const mapped = fromRecord(data, today);
        setValues(mapped.values); setRows(mapped.rows); setManager(mapped.manager);
        setRecord({ status: "ready", id: data.id, message: "" });
      })
      .catch((error: unknown) => setRecord({ status: "error", id: "", message: error instanceof Error ? error.message : "" }));
  }, [mode, editRef, today, t]);

  useEffect(() => { if (isOpen) fetchRecord(); }, [isOpen, fetchRecord]);
  const loadRecord = () => { setRecord({ status: "loading", id: "", message: "" }); fetchRecord(); };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, saving, onClose]);

  const status = useMemo(() => formStatus(values, rows, manager, t, today), [values, rows, manager, t, today]);
  const rowIssues = useMemo(() => rowErrors(rows, t, today), [rows, t, today]);
  const left = status.missing.length + status.invalid.length + Object.keys(rowIssues).length;

  if (!isOpen) return null;

  const onChange = (key: string, value: Scalar) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFromResume((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
    setSaveError(null);
  };
  const onBlur = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));
  const onRows = (group: RowGroupId, next: Row[]) => { setRows((prev) => ({ ...prev, [group]: next })); setSaveError(null); };

  const jump = (key: string, section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: true }));
    setTouched((prev) => ({ ...prev, [key]: true }));
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`ecw-${key}`) ?? document.getElementById(`ecw-sec-${section}`);
      target?.scrollIntoView({ block: "center" });
      target?.focus();
    });
  };
  const nextMissing = () => {
    const issue = status.missing[0] ?? status.invalid[0];
    if (issue) jump(issue.key, issue.section);
  };

  const readResume = (text: string) => {
    const found = readResumeText(text, new Date().getFullYear());
    const applied = applyFindings(values, rows, found);
    const count = Object.keys(applied.marked).length + (found.degree ? 1 : 0) + (found.employer ? 1 : 0);
    setValues(applied.values); setRows(applied.rows); setFromResume((prev) => ({ ...prev, ...applied.marked }));
    setResumeNote(count > 0 ? k("resume_found", "{count} details found. Check each one marked \"from resume\".", { count }) : k("resume_none", "Nothing could be read from this text. Fill the form instead."));
    if (count > 0) setStep(2);
  };
  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (!TEXT_TYPES.has(file.type) && !/\.(txt|md|csv)$/i.test(file.name)) {
      setResumeNote(k("resume_unsupported", "PDF and Word resumes cannot be read yet because there is no resume parser on the server. Paste the resume text instead."));
      return;
    }
    file.text().then((text) => { setResumeText(text); readResume(text); }).catch(() => setResumeNote(k("resume_read_failed", "This file could not be read.")));
  };

  const submit = async () => {
    if (left > 0) {
      setTouched(Object.fromEntries([...status.missing, ...status.invalid].map((issue) => [issue.key, true])));
      setStep(2);
      nextMissing();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const body = buildPersonPayload(values, rows, manager, mode);
    const isEdit = mode === "edit";
    const result = await sendJson<Saved>(isEdit ? `/api/v1/people/${encodeURIComponent(record.id)}` : "/api/v1/people", {
      method: isEdit ? "PATCH" : "POST",
      body,
      idempotencyKey: isEdit ? undefined : idempotencyKey.current,
      fallback: k("save_failed", "The employee could not be saved. Try again."),
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      setSaveError({ message: result.error?.message ?? k("save_failed", "The employee could not be saved. Try again."), issues: result.error?.details ?? [] });
      return;
    }
    const saved = result.data;
    const code = saved.employeeCode ?? saved.employee_code ?? String(values.employeeCode || saved.id);
    idempotencyKey.current = newIdempotencyKey();
    onSave?.({
      id: code,
      dbId: saved.id,
      persisted: true,
      name: `${String(values.firstName ?? "")} ${String(values.lastName ?? "")}`.trim(),
      role: String(values.designation ?? ""),
      dept: String(values.department ?? ""),
      location: String(values.location ?? ""),
      status: String(values.status ?? ""),
      manager: manager?.name ?? null,
      mobile: String(values.mobile ?? ""),
      details: { ...values, ...rows },
    });
    onClose();
  };

  const steps: Array<{ id: Step; label: string }> = [
    { id: 1, label: k("step_resume", "Start from a resume") },
    { id: 2, label: k("step_review", "Review what needs you") },
    { id: 3, label: k("step_submit", "Submit") },
  ];
  const title = mode === "edit" ? k("title_edit", "Edit employee") : k("title_create", "Add employee");

  return (
    <div className={styles.overlay} onClick={() => { if (!saving) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ecw-title" onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 id="ecw-title" className={styles.title}>{title}</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={saving} aria-label={k("title_close", "Close")}>×</button>
        </header>

        <ol className={styles.steps} aria-label={k("aria-label_employee_creation_wizard_steps", "Steps")}>
          {steps.map((item) => (
            <li key={item.id}>
              <button type="button" className={`${styles.stepBtn} ${step === item.id ? styles.stepOn : ""}`} aria-current={step === item.id ? "step" : undefined}
                disabled={mode === "edit" && item.id === 1} onClick={() => setStep(item.id)}>
                <span className={styles.stepNum}>{item.id}</span>{item.label}
              </button>
            </li>
          ))}
        </ol>

        <div className={styles.body}>
          {referenceError && <StateNote tone="error">{referenceError}</StateNote>}
          {record.status === "loading" && <StateNote tone="loading">{k("record_loading", "Loading the employee record…")}</StateNote>}
          {record.status === "error" && <StateNote tone="error" onRetry={loadRecord} retryLabel={k("retry", "Try again")}>{record.message}</StateNote>}

          {step === 1 && (
            <section className={styles.resume}>
              <p className={styles.lead}>{k("resume_lead", "Paste a resume or choose a text file. It is read on this device and nothing is uploaded. Every value found is a suggestion for you to confirm.")}</p>
              <label className={styles.flabel} htmlFor="ecw-resume-text">{k("resume_text", "Resume text")}</label>
              <textarea id="ecw-resume-text" className={styles.control} rows={8} value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
              <div className={styles.actions}>
                <label className={styles.btnGhost}>
                  {k("resume_choose", "Choose a file")}
                  <input type="file" accept=".txt,.md,.csv,text/plain" className={styles.srOnly} onChange={(e) => chooseFile(e.target.files?.[0])} />
                </label>
                <button type="button" className={styles.btnPrimary} disabled={!resumeText.trim()} onClick={() => readResume(resumeText)}>{k("resume_read", "Read resume")}</button>
                <button type="button" className={styles.btnGhost} onClick={() => setStep(2)}>{k("resume_skip", "Skip and fill the form")}</button>
              </div>
              {resumeNote && <p className={styles.msg} aria-live="polite">{resumeNote}</p>}
              <p className={styles.note}>{k("drafts_unavailable", "Drafts are not saved: there is nowhere on the server to keep them yet, and this form holds PAN, Aadhaar and bank details that should not stay in the browser.")}</p>
            </section>
          )}

          {step === 2 && record.status !== "loading" && record.status !== "error" && (
            <ReviewStep values={values} rows={rows} manager={manager} status={status} rowErrors={rowIssues} touched={touched} fromResume={fromResume}
              reference={reference} mode={mode} excludeIds={record.id ? [record.id] : []} today={today} t={t}
              onChange={onChange} onManager={(next) => { setManager(next); setSaveError(null); }} onBlur={onBlur} onRows={onRows}
              onNextMissing={nextMissing} onJump={jump} openSections={openSections} onToggle={(id, open) => setOpenSections((prev) => ({ ...prev, [id]: open }))} />
          )}

          {step === 3 && (
            <section className={styles.submit}>
              <p className={styles.lead}>
                {left > 0
                  ? k("submit_blocked", "{count} fields still need you before this can be saved.", { count: left })
                  : k("submit_ready", "{filled} of {total} fields filled. Everything required is in place.", { filled: status.filled, total: status.total })}
              </p>
              {saveError && (
                <div role="alert" className={styles.alert}>
                  <p>{saveError.message}</p>
                  {saveError.issues.length > 0 && (
                    <ul>{saveError.issues.map((issue) => <li key={`${issue.field}-${issue.issue}`}><strong>{issue.field}</strong>: {issue.issue}</li>)}</ul>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className={styles.footer}>
          <span className={styles.progress} aria-live="polite">
            {left > 0 ? k("left_count", "{count} left", { count: left }) : k("all_done", "Ready to save")}
          </span>
          <div className={styles.actions}>
            {step > 1 && <button type="button" className={styles.btnGhost} disabled={saving || (mode === "edit" && step === 2)} onClick={() => setStep((step - 1) as Step)}>{k("back", "Back")}</button>}
            {step < 3 && <button type="button" className={styles.btnPrimary} onClick={() => setStep((step + 1) as Step)}>{k("next", "Next")}</button>}
            {step === 3 && (
              <button type="button" className={styles.btnPrimary} disabled={saving || record.status === "loading" || record.status === "error"} onClick={() => { void submit(); }}>
                {saving ? k("saving", "Saving…") : mode === "edit" ? k("save_edit", "Save changes") : k("save_create", "Create employee")}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
