"use client";

import type { Translate } from "../onboarding/api";
import EmployeePicker, { type EmployeeOption } from "../onboarding/EmployeePicker";
import { picklistOptions, type Option } from "../onboarding/picklistOptions";
import type { FieldDef, Scalar } from "./fields";
import styles from "../EmployeeCreationWizard.module.css";

export const WIZARD_NS = "components.Workspace.EmployeeCreationWizard";

export type ReferenceOptions = { departments: Option[]; locations: Option[]; shifts: Option[]; loaded: boolean };

export function optionsFor(field: FieldDef, reference: ReferenceOptions, t: Translate): Option[] {
  const source = field.options;
  if (!source) return [];
  if (source.kind === "picklist") return picklistOptions(source.code, t);
  if (source.kind === "enum") return source.values.map((item) => ({ value: item.value, label: t(`${WIZARD_NS}.${item.labelKey}`, item.fallback) }));
  return reference[source.list];
}

const NORMALISE: Partial<Record<NonNullable<FieldDef["format"]>, (value: string) => string>> = {
  phone: (value) => value.replace(/\D/g, "").slice(0, 10),
  aadhaar: (value) => value.replace(/\D/g, "").slice(0, 12),
  uan: (value) => value.replace(/\D/g, "").slice(0, 12),
  esiIp: (value) => value.replace(/\D/g, "").slice(0, 17),
  pin: (value) => value.replace(/\D/g, "").slice(0, 6),
  digits: (value) => value.replace(/\D/g, ""),
  pan: (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
  ifsc: (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11),
  upper: (value) => value.toUpperCase(),
};

type Props = {
  field: FieldDef;
  value: Scalar;
  required: boolean;
  error: string;
  showError: boolean;
  fromResume: boolean;
  locked: boolean;
  reference: ReferenceOptions;
  manager: EmployeeOption | null;
  excludeIds: readonly string[];
  t: Translate;
  onChange: (key: string, value: Scalar) => void;
  onManager: (value: EmployeeOption | null) => void;
  onBlur: (key: string) => void;
};

export default function FieldControl({ field, value, required, error, showError, fromResume, locked, reference, manager, excludeIds, t, onChange, onManager, onBlur }: Props) {
  const id = `ecw-${field.key}`;
  const msgId = `${id}-msg`;
  const label = t(`${WIZARD_NS}.${field.labelKey}`, field.fallback);
  const visibleError = showError ? error : "";
  const hint = field.hintKey ? t(`${WIZARD_NS}.${field.hintKey}`, field.hintFallback ?? "") : "";
  const status = visibleError || hint || (required ? t(`${WIZARD_NS}.required`, "Required") : t(`${WIZARD_NS}.optional`, "Optional"));
  const wrapClass = `${styles.f} ${field.wide || field.type === "textarea" ? styles.wide : ""} ${visibleError ? styles.bad : ""}`;

  if (field.type === "employee") {
    return (
      <div className={wrapClass} id={`ecw-wrap-${field.key}`}>
        <EmployeePicker id={id} label={label} required={required} value={manager} onChange={(next) => { onManager(next); onBlur(field.key); }} excludeIds={excludeIds} error={visibleError} describedBy={msgId} />
        <span id={msgId} className={styles.msg} aria-live="polite">{status}</span>
      </div>
    );
  }

  const labelNode = (
    <label htmlFor={id} className={styles.flabel}>
      <span>{label}</span>
      {required && <span className={styles.req} aria-hidden="true">*</span>}
      {fromResume && <span className={styles.from}>{t(`${WIZARD_NS}.from_resume`, "from resume")}</span>}
    </label>
  );
  const common = {
    id,
    "aria-required": required || undefined,
    "aria-invalid": visibleError ? true : undefined,
    "aria-describedby": msgId,
    disabled: locked,
    onBlur: () => onBlur(field.key),
  };

  let control: React.ReactNode;
  if (field.type === "bool") {
    return (
      <div className={`${wrapClass} ${styles.boolField}`} id={`ecw-wrap-${field.key}`}>
        <label htmlFor={id} className={styles.check}>
          <input type="checkbox" {...common} checked={value === true} onChange={(event) => onChange(field.key, event.target.checked)} />
          <span>{label}</span>
        </label>
        <span id={msgId} className={styles.msg}>{visibleError || hint}</span>
      </div>
    );
  } else if (field.type === "select") {
    const options = optionsFor(field, reference, t);
    const current = String(value ?? "");
    const unknown = current && !options.some((option) => option.value === current);
    control = (
      <select {...common} className={styles.control} value={current} onChange={(event) => onChange(field.key, event.target.value)}>
        <option value="">{field.options?.kind === "reference" && !reference.loaded ? t(`${WIZARD_NS}.loading_options`, "Loading…") : t(`${WIZARD_NS}.choose`, "Choose…")}</option>
        {unknown && <option value={current}>{current}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  } else if (field.type === "textarea") {
    control = <textarea {...common} className={styles.control} rows={3} maxLength={field.maxLength} value={String(value ?? "")} onChange={(event) => onChange(field.key, event.target.value)} />;
  } else {
    const normalise = field.format ? NORMALISE[field.format] : undefined;
    control = (
      <input
        {...common}
        className={styles.control}
        type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        inputMode={field.type === "tel" || field.format === "digits" || field.format === "aadhaar" || field.format === "pin" ? "numeric" : undefined}
        min={field.min}
        max={field.max}
        maxLength={field.type === "text" || field.type === "email" ? field.maxLength : undefined}
        autoComplete={field.key === "personalEmail" ? "email" : field.key === "accountToken" || field.key === "accountConfirm" ? "off" : undefined}
        value={String(value ?? "")}
        onChange={(event) => onChange(field.key, normalise ? normalise(event.target.value) : event.target.value)}
      />
    );
  }

  return (
    <div className={wrapClass} id={`ecw-wrap-${field.key}`}>
      {labelNode}
      {control}
      <span id={msgId} className={styles.msg} aria-live="polite">{status}</span>
    </div>
  );
}
