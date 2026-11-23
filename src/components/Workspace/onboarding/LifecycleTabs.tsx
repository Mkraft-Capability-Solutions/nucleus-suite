"use client";

import { useRef, useState } from "react";
import { ArrowRight, Workflow } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import styles from "../OnboardingView.module.css";
import { newIdempotencyKey, sendJson, type Translate } from "./api";
import StateNote from "./StateNote";
import type { ResourceState } from "./useResource";

/**
 * Onboarding lifecycle tabs:
 * - Studio: active onboarding workflow templates (GET /api/v1/onboarding/templates).
 * - Milestones: each joiner's onboarding case and tasks (GET /api/v1/onboarding/instances);
 *   completing a task calls POST /api/v1/onboarding/tasks/{id}/complete and the list
 *   refreshes only after the server accepts.
 * - Chains: the step chain each template triggers on joining.
 */

const NS = "components.Workspace.OnboardingView";

export type TemplateTask = { key: string; title: string; required: boolean; owner: string };
export type TemplateRow = { id: string; created_at: string; attributes: { code?: string; name?: string; status?: string; tasks?: TemplateTask[] } };
export type InstanceTask = { id: string; key: string | null; title: string | null; owner: string | null; required: boolean; status: string };
export type InstanceRow = {
  id: string; status: string; createdAt: string; templateName: string;
  employee: { code: string; firstName: string; lastName: string; department: string | null; designation: string | null; joiningDate: string | null };
  tasks: InstanceTask[]; total: number; done: number; day1Ready: boolean;
};

export function StudioTab({ state, onReload, onOpenDesigner }: { state: ResourceState<TemplateRow[]>; onReload: () => void; onOpenDesigner: () => void }) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}><Workflow size={18} aria-hidden="true" />
          {state.status === "ready" ? t(`${NS}.studio_title_count`, "Active workflow pipelines ({count})", { count: state.data.length }) : t(`${NS}.studio_title`, "Active workflow pipelines")}
        </h3>
        <p className={styles.cardSub}>{t(`${NS}.studio_subtitle`, "Onboarding workflows that run for every new joiner. Open the designer to change their steps.")}</p>
      </section>
      {state.status === "loading" && <StateNote tone="loading">{t(`${NS}.loading`, "Loading…")}</StateNote>}
      {state.status === "error" && <StateNote tone="error" onRetry={onReload} retryLabel={t(`${NS}.retry`, "Try again")}>{state.message}</StateNote>}
      {state.status === "ready" && state.data.length === 0 && <StateNote tone="empty">{t(`${NS}.studio_empty`, "No onboarding workflow is configured yet.")}</StateNote>}
      {state.status === "ready" && state.data.length > 0 && (
        <div className={styles.studioGrid}>
          {state.data.map((template) => {
            const tasks = template.attributes.tasks ?? [];
            const active = (template.attributes.status ?? "active") === "active";
            return (
              <article key={template.id} className={`${styles.card} ${styles.cardAccent}`}>
                <div className={styles.cardHead}>
                  <div>
                    <h4 className={styles.cardTitleSm}>{template.attributes.name ?? template.attributes.code ?? template.id}</h4>
                    {template.attributes.code && <span className={styles.muted}>{template.attributes.code}</span>}
                  </div>
                  <span className={`${styles.badge} ${active ? styles.badgeSuccess : styles.badgeWarning}`}>{active ? t(`${NS}.status_active`, "Active") : t(`${NS}.status_archived`, "Archived")}</span>
                </div>
                <p className={styles.cardSub}>{t(`${NS}.studio_steps`, "{count} steps · {required} required · trigger: new joiner", { count: tasks.length, required: tasks.filter((task) => task.required).length })}</p>
                <div className={styles.row} style={{ marginBlockStart: 12 }}>
                  <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={onOpenDesigner}>{t(`${NS}.studio_open`, "Open in designer")}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MilestonesTab({ state, onReload, formatDate }: { state: ResourceState<InstanceRow[]>; onReload: () => void; formatDate: (iso: string | null) => string }) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = useHRMS() as { showToast?: (title: string, message: string, tone: string) => void };
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const keys = useRef<Record<string, string>>({});

  const complete = async (task: InstanceTask) => {
    if (pending) return;
    keys.current[task.id] ??= newIdempotencyKey();
    setPending(task.id);
    setErrors((current) => ({ ...current, [task.id]: "" }));
    const result = await sendJson(`/api/v1/onboarding/tasks/${encodeURIComponent(task.id)}/complete`, {
      method: "POST", body: {}, idempotencyKey: keys.current[task.id], fallback: t(`${NS}.err_task_failed`, "The task could not be completed."),
    });
    setPending(null);
    if (!result.ok) { setErrors((current) => ({ ...current, [task.id]: result.error.message })); return; }
    delete keys.current[task.id];
    showToast?.(t(`${NS}.toast_task_title`, "Task completed"), t(`${NS}.toast_task_body`, "{task} is marked done.", { task: task.title ?? "" }), "success");
    onReload();
  };

  if (state.status === "loading") return <StateNote tone="loading">{t(`${NS}.loading`, "Loading…")}</StateNote>;
  if (state.status === "error") return <StateNote tone="error" onRetry={onReload} retryLabel={t(`${NS}.retry`, "Try again")}>{state.message}</StateNote>;
  if (state.data.length === 0) return <StateNote tone="empty">{t(`${NS}.milestones_empty`, "No onboarding case is open. Cases start when a joiner is onboarded.")}</StateNote>;

  return (
    <div className={styles.timelineGrid}>
      {state.data.map((instance) => (
        <section key={instance.id} className={styles.card} aria-labelledby={`instance-${instance.id}`}>
          <div className={styles.cardHead}>
            <div>
              <h4 id={`instance-${instance.id}`} className={styles.cardTitleSm}>{`${instance.employee.firstName} ${instance.employee.lastName}`.trim()} <span className={styles.muted}>{instance.employee.code}</span></h4>
              <p className={styles.cardSub}>{[instance.employee.designation, instance.employee.department, instance.templateName].filter(Boolean).join(" · ")}{instance.employee.joiningDate ? ` · ${t(`${NS}.joins_on`, "joins {date}", { date: formatDate(instance.employee.joiningDate) })}` : ""}</p>
            </div>
            <div className={styles.row}>
              {instance.day1Ready && <span className={`${styles.badge} ${styles.badgeSuccess}`}>{t(`${NS}.day1_ready`, "Day-1 ready")}</span>}
              <span className={`${styles.badge} ${instance.done === instance.total && instance.total > 0 ? styles.badgeSuccess : styles.badgeWarning}`}>{t(`${NS}.tasks_done`, "{done} of {total} done", { done: instance.done, total: instance.total })}</span>
            </div>
          </div>
          <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={instance.total} aria-valuenow={instance.done} aria-label={t(`${NS}.progress`, "Onboarding progress")}>
            <div className={styles.progressFill} style={{ transform: `scaleX(${instance.total > 0 ? instance.done / instance.total : 0})` }} />
          </div>
          <div className={styles.stack} style={{ marginBlockStart: 12 }}>
            {instance.tasks.length === 0 && <span className={styles.muted}>{t(`${NS}.tasks_none`, "This case has no tasks.")}</span>}
            {instance.tasks.map((task) => {
              const done = task.status === "done";
              return (
                <div key={task.id} className={styles.taskRow}>
                  <div>
                    <strong>{task.title ?? task.key ?? task.id}</strong>
                    <div className={styles.muted}>{[task.owner, task.required ? t(`${NS}.required`, "Required") : t(`${NS}.optional`, "Optional")].filter(Boolean).join(" · ")}</div>
                    {errors[task.id] && <div className={styles.fieldError} role="alert">{errors[task.id]}</div>}
                  </div>
                  <div className={styles.row}>
                    <span className={`${styles.badge} ${done ? styles.badgeSuccess : styles.badgeWarning}`}>{done ? t(`${NS}.task_done`, "Done") : t(`${NS}.task_pending`, "Pending")}</span>
                    {!done && (
                      <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => void complete(task)} disabled={pending !== null}>
                        {pending === task.id ? t(`${NS}.saving`, "Saving…") : t(`${NS}.task_complete`, "Mark done")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ChainsTab({ state, onReload }: { state: ResourceState<TemplateRow[]>; onReload: () => void }) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  if (state.status === "loading") return <StateNote tone="loading">{t(`${NS}.loading`, "Loading…")}</StateNote>;
  if (state.status === "error") return <StateNote tone="error" onRetry={onReload} retryLabel={t(`${NS}.retry`, "Try again")}>{state.message}</StateNote>;
  if (state.data.length === 0) return <StateNote tone="empty">{t(`${NS}.chains_empty`, "No lifecycle chain is configured. Chains come from the onboarding workflows.")}</StateNote>;
  return (
    <div className={styles.stack}>
      {state.data.map((template) => {
        const tasks = template.attributes.tasks ?? [];
        return (
          <section key={template.id} className={styles.chainCard} aria-label={template.attributes.name ?? template.id}>
            <strong>{t(`${NS}.chain_event`, "On joining · {name}", { name: template.attributes.name ?? template.attributes.code ?? "" })}</strong>
            {tasks.length === 0 ? <span className={styles.muted}>{t(`${NS}.chain_no_steps`, "No steps configured.")}</span> : (
              <ol className={styles.chainSteps} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {tasks.map((task, index) => (
                  <li key={task.key} className={styles.row}>
                    <span className={`${styles.chainStep} ${task.required ? styles.chainStepRequired : ""}`} title={task.owner}>{task.title}</span>
                    {index < tasks.length - 1 && <ArrowRight size={14} aria-hidden="true" />}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
