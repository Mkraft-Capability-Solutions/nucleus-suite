"use client";

import { useState } from "react";
import type { Translate } from "../onboarding/api";
import type { EmployeeOption } from "../onboarding/EmployeePicker";
import { ROW_GROUPS, SECTIONS, type FormValues, type Row, type RowGroupId, type Rows, type Scalar } from "./fields";
import FieldControl, { WIZARD_NS, type ReferenceOptions } from "./FieldControl";
import RowsEditor from "./RowsEditor";
import { fieldError, isRequired, type Status } from "./validation";
import styles from "../EmployeeCreationWizard.module.css";

/** Step 2 of the approved design: a queue of what still needs the user, plus every section. */
export default function ReviewStep(props: {
  values: FormValues; rows: Rows; manager: EmployeeOption | null; status: Status; rowErrors: Record<string, string>;
  touched: Record<string, boolean>; fromResume: Record<string, boolean>; reference: ReferenceOptions; mode: "create" | "edit";
  excludeIds: readonly string[]; today: string; t: Translate;
  onChange: (key: string, value: Scalar) => void; onManager: (value: EmployeeOption | null) => void; onBlur: (key: string) => void;
  onRows: (group: RowGroupId, rows: Row[]) => void; onNextMissing: () => void; onJump: (key: string, section: string) => void;
  openSections: Record<string, boolean>; onToggle: (id: string, open: boolean) => void;
}) {
  const { values, rows, status, t } = props;
  const [query, setQuery] = useState("");
  const left = status.missing.length + status.invalid.length;
  const needle = query.trim().toLowerCase();
  const hits = needle ? SECTIONS.flatMap((s) => s.fields.map((f) => ({ f, s }))).filter(({ f }) => t(`${WIZARD_NS}.${f.labelKey}`, f.fallback).toLowerCase().includes(needle)).slice(0, 12) : [];
  const sectionCount = (id: string) => [...status.missing, ...status.invalid].filter((issue) => issue.section === id).length;

  return (
    <div className={styles.review}>
      <aside className={styles.queue} aria-label={t(`${WIZARD_NS}.queue_label`, "What still needs you")}>
        <div className={styles.qn} aria-live="polite">{left}</div>
        <div className={styles.msg}>{left === 0 ? t(`${WIZARD_NS}.queue_clear`, "All clear. Ready to submit.") : t(`${WIZARD_NS}.queue_left`, "fields still need you ({missing} missing, {invalid} to fix)", { missing: status.missing.length, invalid: status.invalid.length })}</div>
        <button type="button" className={styles.btnPrimary} onClick={props.onNextMissing}>{t(`${WIZARD_NS}.next_missing`, "Next missing field")}</button>
        <label className={styles.msg} htmlFor="ecw-find">{t(`${WIZARD_NS}.jump`, "Jump to any field")}</label>
        <input id="ecw-find" type="search" className={styles.control} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(`${WIZARD_NS}.jump_placeholder`, "Type a field name…")} />
        <div className={styles.hits}>
          {hits.map(({ f, s }) => (
            <button key={f.key} type="button" className={styles.hit} onClick={() => props.onJump(f.key, s.id)}>
              {t(`${WIZARD_NS}.${f.labelKey}`, f.fallback)} · {t(`${WIZARD_NS}.${s.titleKey}`, s.fallback)}
            </button>
          ))}
        </div>
      </aside>
      <div className={styles.sections}>
        {SECTIONS.map((section) => {
          const todo = sectionCount(section.id);
          return (
            <details key={section.id} id={`ecw-sec-${section.id}`} className={styles.sec} open={props.openSections[section.id] ?? false} onToggle={(e) => props.onToggle(section.id, (e.currentTarget as HTMLDetailsElement).open)}>
              <summary>
                <span>{t(`${WIZARD_NS}.${section.titleKey}`, section.fallback)}</span>
                <span className={`${styles.badge} ${todo ? styles.badgeBad : styles.badgeOk}`}>{todo ? t(`${WIZARD_NS}.to_do`, "{n} to do", { n: todo }) : t(`${WIZARD_NS}.complete`, "Complete")}</span>
              </summary>
              <div className={styles.grid}>
                {section.fields.filter((f) => !f.visibleWhen || f.visibleWhen(values)).map((field) => (
                  <FieldControl key={field.key} field={field} value={values[field.key]} required={isRequired(field, values)}
                    error={fieldError(field, values, t, props.today, props.manager)} showError={Boolean(props.touched[field.key])}
                    fromResume={Boolean(props.fromResume[field.key])} locked={props.mode === "edit" && Boolean(field.lockedOnEdit)}
                    reference={props.reference} manager={props.manager} excludeIds={props.excludeIds} t={t}
                    onChange={props.onChange} onManager={props.onManager} onBlur={props.onBlur} />
                ))}
              </div>
            </details>
          );
        })}
        {ROW_GROUPS.map((group) => {
          const todo = sectionCount(group.id);
          return (
            <details key={group.id} id={`ecw-sec-${group.id}`} className={styles.sec} open={props.openSections[group.id] ?? false} onToggle={(e) => props.onToggle(group.id, (e.currentTarget as HTMLDetailsElement).open)}>
              <summary>
                <span>{t(`${WIZARD_NS}.${group.titleKey}`, group.fallback)}</span>
                <span className={`${styles.badge} ${todo ? styles.badgeBad : styles.badgeOk}`}>{todo ? t(`${WIZARD_NS}.to_do`, "{n} to do", { n: todo }) : t(`${WIZARD_NS}.rows_count`, "{n} rows", { n: rows[group.id].length })}</span>
              </summary>
              <RowsEditor group={group} rows={rows[group.id]} errors={props.rowErrors} t={t} onChange={(next) => props.onRows(group.id, next)} />
            </details>
          );
        })}
      </div>
    </div>
  );
}
