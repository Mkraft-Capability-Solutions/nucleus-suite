"use client";

import { Trash2 } from "lucide-react";
import styles from "./WorkflowBuilderModal.module.css";
import { useT } from "./engagement-client";
import { WF_NS, stepTypeLabel, type Catalogue, type Step, type StepType } from "./workflow-model";

const NS = WF_NS;

/** Edits one step of the draft. Changes stay local until the workflow is saved (PUT with If-Match). */
export default function WorkflowStepInspector({ step, index, catalogue, canEdit, onChange, onDelete }: {
  step: Step;
  index: number;
  catalogue: Catalogue;
  canEdit: boolean;
  onChange: (next: Step) => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const titleError = step.title.trim().length < 2 ? t(`${NS}.err_step_title`, "Each step needs a title of at least 2 characters.") : "";
  const slaError = step.type === "approval" && !step.slaHours ? t(`${NS}.issue_approval_without_sla`, "Approval steps need an SLA in hours.") : "";

  return (
    <aside className={styles.inspectorPane} aria-label={t(`${NS}.text_inspector`, "Step settings")}>
      <div className={styles.inspectorHeader}>
        <h4>{t(`${NS}.text_step_n`, "Step {n}", { n: index + 1 })}</h4>
        {canEdit && index > 0 && (
          <button type="button" className={styles.deleteBtn} onClick={onDelete} aria-label={t(`${NS}.text_delete_step`, "Delete step")}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={styles.inspectorBody}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="wf-step-type">{t(`${NS}.text_type`, "Step type")} *</label>
          <select id="wf-step-type" className={styles.selectInput} value={step.type} disabled={!canEdit || index === 0}
            onChange={(event) => {
              const type = event.target.value as StepType;
              onChange({ ...step, type, operator: type === "condition" ? step.operator ?? catalogue.operators[0] ?? null : null, slaHours: type === "approval" ? step.slaHours ?? 24 : step.slaHours });
            }}>
            {catalogue.stepTypes.filter((type) => index === 0 || type !== "trigger").map((type) => <option key={type} value={type}>{stepTypeLabel(type, t)}</option>)}
          </select>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="wf-step-title">{t(`${NS}.text_title`, "Title")} *</label>
          <input id="wf-step-title" className={styles.selectInput} value={step.title} maxLength={120} disabled={!canEdit} aria-required="true"
            aria-invalid={Boolean(titleError)} aria-describedby={titleError ? "wf-step-title-error" : undefined}
            onChange={(event) => onChange({ ...step, title: event.target.value })} />
          {titleError && <p id="wf-step-title-error" className={styles.logInfo} role="alert">{titleError}</p>}
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="wf-step-desc">{t(`${NS}.text_description_optional`, "Description (optional)")}</label>
          <textarea id="wf-step-desc" className={styles.selectInput} value={step.description} maxLength={300} disabled={!canEdit}
            onChange={(event) => onChange({ ...step, description: event.target.value })} />
        </div>
        {step.type === "condition" && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="wf-step-op">{t(`${NS}.text_operator`, "Operator")} *</label>
            <select id="wf-step-op" className={styles.selectInput} value={step.operator ?? ""} disabled={!canEdit} onChange={(event) => onChange({ ...step, operator: event.target.value || null })}>
              {catalogue.operators.map((op) => <option key={op} value={op}>{t(`${NS}.operator_${op}`, op)}</option>)}
            </select>
          </div>
        )}
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="wf-step-sla">
            {step.type === "approval" ? `${t(`${NS}.text_sla_hours`, "SLA (hours)")} *` : t(`${NS}.text_sla_hours_optional`, "SLA in hours (optional)")}
          </label>
          <input id="wf-step-sla" type="number" min={1} max={720} step={1} className={styles.selectInput} value={step.slaHours ?? ""} disabled={!canEdit}
            aria-invalid={Boolean(slaError)} aria-describedby={slaError ? "wf-step-sla-error" : undefined}
            onChange={(event) => onChange({ ...step, slaHours: event.target.value ? Math.max(1, Math.min(720, Math.trunc(Number(event.target.value)))) : null })} />
          {slaError && <p id="wf-step-sla-error" className={styles.logInfo} role="alert">{slaError}</p>}
        </div>
      </div>
    </aside>
  );
}
