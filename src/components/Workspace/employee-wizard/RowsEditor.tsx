"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Translate } from "../onboarding/api";
import { picklistOptions } from "../onboarding/picklistOptions";
import { emptyRow, type Row, type RowGroup } from "./fields";
import { WIZARD_NS } from "./FieldControl";
import styles from "../EmployeeCreationWizard.module.css";

/** Repeating rows (dependants, nominees, education, work history) as an editable table. */
export default function RowsEditor({ group, rows, errors, t, onChange }: {
  group: RowGroup;
  rows: Row[];
  errors: Record<string, string>;
  t: Translate;
  onChange: (rows: Row[]) => void;
}) {
  const update = (index: number, key: string, value: string | boolean) => {
    onChange(rows.map((row, i) => {
      if (i !== index) return key === "isHighest" && value === true ? { ...row, isHighest: false } : row;
      return { ...row, [key]: value };
    }));
  };
  const groupError = errors[group.id];

  return (
    <div className={styles.rowsBlock}>
      {rows.length === 0 ? (
        <p className={styles.msg}>{t(`${WIZARD_NS}.rows_none`, "Nothing added yet.")}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.rowsTable}>
            <thead>
              <tr>
                {group.fields.map((field) => <th key={field.key} scope="col">{t(`${WIZARD_NS}.${field.labelKey}`, field.fallback)}</th>)}
                <th scope="col"><span className={styles.srOnly}>{t(`${WIZARD_NS}.row_actions`, "Actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {group.fields.map((field) => {
                    const key = `${group.id}.${index}.${field.key}`;
                    const error = errors[key];
                    const label = `${t(`${WIZARD_NS}.${field.labelKey}`, field.fallback)} ${index + 1}`;
                    const common = { id: `ecw-${key}`, "aria-label": label, "aria-invalid": error ? true : undefined, title: error || undefined };
                    return (
                      <td key={field.key}>
                        {field.type === "bool" ? (
                          <input type="checkbox" {...common} checked={row[field.key] === true} onChange={(event) => update(index, field.key, event.target.checked)} />
                        ) : field.type === "select" && field.options ? (
                          <select {...common} className={styles.control} value={String(row[field.key] ?? "")} onChange={(event) => update(index, field.key, event.target.value)}>
                            <option value="">{t(`${WIZARD_NS}.choose`, "Choose…")}</option>
                            {picklistOptions(field.options, t).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        ) : (
                          <input
                            {...common}
                            className={`${styles.control} ${error ? styles.controlBad : ""}`}
                            type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                            maxLength={field.maxLength}
                            value={String(row[field.key] ?? "")}
                            onChange={(event) => update(index, field.key, event.target.value)}
                          />
                        )}
                        {error && <span className={styles.cellError}>{error}</span>}
                      </td>
                    );
                  })}
                  <td>
                    <button type="button" className={styles.iconBtn} onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={t(`${WIZARD_NS}.row_remove`, "Remove row {n}", { n: index + 1 })}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {groupError && <p className={styles.cellError} role="alert">{groupError}</p>}
      <button type="button" className={styles.addBtn} onClick={() => onChange([...rows, emptyRow(group)])} disabled={rows.length >= group.max}>
        <Plus size={14} aria-hidden="true" />{t(`${WIZARD_NS}.${group.addKey}`, group.addFallback)}
      </button>
    </div>
  );
}
