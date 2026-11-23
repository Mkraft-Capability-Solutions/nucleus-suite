"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Briefcase, Check, Sparkles, UserCheck, X } from "lucide-react";
import styles from "../ProjectView.module.css";
import { ApiError, employeeLabel, errorMessage, sendJson, useSubmitKey, type Employee, type Translate } from "../workspaceHttp";
import { PROJECT_ACCENTS, PROJECT_VISIBILITIES, TASK_PRIORITIES, TASK_TAGS, type BoardProject } from "./types";

export const NS = "components.Workspace.ProjectView";

function useForm<T extends Record<string, unknown>>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useSubmitKey();
  const update = <K extends keyof T>(name: K, value: T[K]) => { setForm((c) => ({ ...c, [name]: value })); setErrors({}); setFormError(null); key.reset(); };
  const run = async (url: string, body: unknown, fallback: string, done: () => void) => {
    setBusy(true);
    setFormError(null);
    try {
      await sendJson(url, { method: "POST", body, idempotencyKey: key.current() }, fallback);
      key.reset();
      done();
    } catch (error) {
      setFormError(errorMessage(error, fallback));
      if (error instanceof ApiError) setErrors(error.fields);
    } finally {
      setBusy(false);
    }
  };
  return { form, update, errors, setErrors, formError, busy, run };
}

function Shell({ t, title, subtitle, icon, busy, onClose, children }: { t: Translate; title: string; subtitle: string; icon: ReactNode; busy: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <div className={styles.modalOverlay} onClick={() => !busy && onClose()}>
      <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="pv-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 id="pv-modal-title">{icon}{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Err = ({ id, message }: { id: string; message?: string }) => (message ? <span id={id} className={styles.fieldError}>{message}</span> : null);

/** Assign-task form: POST /api/v1/projects/tasks. Projects and assignees come from the loaded board and people list. */
export function TaskModal({ t, projects, people, initialProjectId, viewerEmployeeId, onClose, onCreated }: {
  t: Translate; projects: BoardProject[]; people: Employee[]; initialProjectId: string | null; viewerEmployeeId: string | null; onClose: () => void; onCreated: (title: string) => void;
}) {
  const { form, update, errors, setErrors, formError, busy, run } = useForm({
    title: "", projectId: initialProjectId ?? projects[0]?.id ?? "", assigneeEmployeeId: viewerEmployeeId ?? "", tag: "dev" as string, priority: "medium" as string, dueDate: "",
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (form.title.trim().length < 3) local.title = t(`${NS}.err_task_title`, "Enter a task title of at least 3 characters.");
    if (!form.projectId) local.projectId = t(`${NS}.err_project`, "Choose a project.");
    if (Object.keys(local).length) { setErrors(local); return; }
    void run("/api/v1/projects/tasks", { title: form.title.trim(), projectId: form.projectId, assigneeEmployeeId: form.assigneeEmployeeId || undefined, tag: form.tag, priority: form.priority, dueDate: form.dueDate || undefined },
      t(`${NS}.text_task_failed`, "The task could not be created."), () => onCreated(form.title.trim()));
  };
  const req = <span className={styles.required} aria-hidden="true">*</span>;
  return (
    <Shell t={t} busy={busy} onClose={onClose} icon={<UserCheck size={20} aria-hidden="true" />} title={t(`${NS}.text_assign_task`, "Assign new task")} subtitle={t(`${NS}.text_assign_subtitle`, "Delegate sprint deliverables to pod members or engineering leads.")}>
      <form className={styles.modalBody} onSubmit={submit} noValidate>
        <div className={styles.formGroup}>
          <label htmlFor="pv-task-title">{t(`${NS}.text_task_title`, "Task deliverable title")}{req}</label>
          <input id="pv-task-title" className={styles.formInput} value={form.title} maxLength={200} onChange={(e) => update("title", e.target.value)} aria-required="true" aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? "pv-task-title-err" : undefined} />
          <Err id="pv-task-title-err" message={errors.title} />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="pv-task-project">{t(`${NS}.text_project`, "Project")}{req}</label>
            <select id="pv-task-project" className={styles.formInput} value={form.projectId} onChange={(e) => update("projectId", e.target.value)} aria-invalid={errors.projectId ? true : undefined}>
              {projects.length === 0 && <option value="">{t(`${NS}.text_no_projects_option`, "No projects yet")}</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <Err id="pv-task-project-err" message={errors.projectId} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="pv-task-tag">{t(`${NS}.text_tag`, "Domain / tag")}{req}</label>
            <select id="pv-task-tag" className={styles.formInput} value={form.tag} onChange={(e) => update("tag", e.target.value)}>
              {TASK_TAGS.map((tag) => <option key={tag} value={tag}>{t(`${NS}.tag_${tag}`, tag)}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="pv-task-assignee">{t(`${NS}.text_assignee`, "Assignee (employee)")}</label>
            <select id="pv-task-assignee" className={styles.formInput} value={form.assigneeEmployeeId} onChange={(e) => update("assigneeEmployeeId", e.target.value)} aria-invalid={errors.assigneeEmployeeId ? true : undefined}>
              <option value="">{t(`${NS}.text_unassigned`, "Unassigned")}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{employeeLabel(p)}{p.designation ? ` — ${p.designation}` : ""}</option>)}
            </select>
            <Err id="pv-task-assignee-err" message={errors.assigneeEmployeeId} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="pv-task-priority">{t(`${NS}.text_priority`, "Priority")}{req}</label>
            <select id="pv-task-priority" className={styles.formInput} value={form.priority} onChange={(e) => update("priority", e.target.value)}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{t(`${NS}.priority_${p}`, p)}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="pv-task-due">{t(`${NS}.text_due_date`, "Due date")} <span className={styles.hint}>{t(`${NS}.text_optional`, "(optional)")}</span></label>
          <input id="pv-task-due" type="date" className={styles.formInput} value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
        </div>
        <p className={styles.infoNote}><Sparkles size={16} aria-hidden="true" /><span><strong>{t(`${NS}.text_assignment_rule`, "Assignment rule:")}</strong> {t(`${NS}.text_assignment_rule_body`, "An employee assigned a task can see its project even if they are not a pod member.")}</span></p>
        {formError && <p className={styles.formError} role="alert">{formError}</p>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy || projects.length === 0}>{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_confirm_assignment`, "Confirm assignment")}</button>
        </div>
      </form>
    </Shell>
  );
}

/** Create-project form: POST /api/v1/projects with pod members as employee ids. */
export function ProjectModal({ t, people, onClose, onCreated }: { t: Translate; people: Employee[]; onClose: () => void; onCreated: (title: string) => void }) {
  const { form, update, errors, setErrors, formError, busy, run } = useForm({
    title: "", description: "", dueDate: "", accent: "signal" as string, visibility: "team" as string, memberEmployeeIds: [] as string[],
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (form.title.trim().length < 3) { setErrors({ title: t(`${NS}.err_project_title`, "Enter a project title of at least 3 characters.") }); return; }
    void run("/api/v1/projects", { title: form.title.trim(), description: form.description.trim() || undefined, dueDate: form.dueDate || undefined, accent: form.accent, visibility: form.visibility, memberEmployeeIds: form.memberEmployeeIds },
      t(`${NS}.text_project_failed`, "The project could not be created."), () => onCreated(form.title.trim()));
  };
  const toggle = (id: string) => update("memberEmployeeIds", form.memberEmployeeIds.includes(id) ? form.memberEmployeeIds.filter((m) => m !== id) : [...form.memberEmployeeIds, id]);
  return (
    <Shell t={t} busy={busy} onClose={onClose} icon={<Briefcase size={20} aria-hidden="true" />} title={t(`${NS}.text_create_project_title`, "Create new sprint project")} subtitle={t(`${NS}.text_create_project_subtitle`, "Define milestones, configure team access boundaries, and set the delivery timeline.")}>
      <form className={styles.modalBody} onSubmit={submit} noValidate>
        <div className={styles.formGroup}>
          <label htmlFor="pv-proj-title">{t(`${NS}.text_project_title`, "Project title")}<span className={styles.required} aria-hidden="true">*</span></label>
          <input id="pv-proj-title" className={styles.formInput} value={form.title} maxLength={150} onChange={(e) => update("title", e.target.value)} aria-required="true" aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? "pv-proj-title-err" : undefined} />
          <Err id="pv-proj-title-err" message={errors.title} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="pv-proj-desc">{t(`${NS}.text_project_scope`, "Project objective / scope")} <span className={styles.hint}>{t(`${NS}.text_optional`, "(optional)")}</span></label>
          <textarea id="pv-proj-desc" rows={2} className={styles.formInput} value={form.description} maxLength={1000} onChange={(e) => update("description", e.target.value)} />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="pv-proj-due">{t(`${NS}.text_target_due`, "Target due date")} <span className={styles.hint}>{t(`${NS}.text_optional`, "(optional)")}</span></label>
            <input id="pv-proj-due" type="date" className={styles.formInput} value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
            <Err id="pv-proj-due-err" message={errors.dueDate} />
          </div>
          <fieldset className={styles.accentRow}>
            <legend className={styles.legend}>{t(`${NS}.text_theme_accent`, "Theme accent")}</legend>
            {PROJECT_ACCENTS.map((accent) => (
              <button key={accent} type="button" className={`${styles.swatch} ${styles[`accent_${accent.replace("-", "_")}`]} ${form.accent === accent ? styles.swatchOn : ""}`}
                aria-pressed={form.accent === accent} aria-label={t(`${NS}.accent_${accent.replace("-", "_")}`, accent)} onClick={() => update("accent", accent)} />
            ))}
          </fieldset>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="pv-proj-vis">{t(`${NS}.text_visibility`, "Who can see this project?")}</label>
          <select id="pv-proj-vis" className={styles.formInput} value={form.visibility} onChange={(e) => update("visibility", e.target.value)}>
            {PROJECT_VISIBILITIES.map((v) => <option key={v} value={v}>{t(`${NS}.visibility_${v}`, v === "team" ? "Team and assigned contributors" : v === "all" ? "Public (all employees)" : "Confidential (creator and administrators)")}</option>)}
          </select>
        </div>
        <fieldset className={styles.memberBox}>
          <legend className={styles.legend}>{t(`${NS}.text_pod_members`, "Initial pod members")}</legend>
          {people.length === 0 && <span className={styles.hint}>{t(`${NS}.text_people_unavailable`, "The employee directory could not be loaded or is empty.")}</span>}
          {people.map((p) => {
            const on = form.memberEmployeeIds.includes(p.id);
            return <button key={p.id} type="button" aria-pressed={on} className={`${styles.memberChip} ${on ? styles.memberChipOn : ""}`} onClick={() => toggle(p.id)}>{on && <Check size={12} aria-hidden="true" />}{employeeLabel(p)}</button>;
          })}
          <Err id="pv-proj-members-err" message={errors.memberEmployeeIds} />
        </fieldset>
        {formError && <p className={styles.formError} role="alert">{formError}</p>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_create_project`, "Create project")}</button>
        </div>
      </form>
    </Shell>
  );
}
