"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SALARY_CURRENCIES, currencyDigits, currencySymbol, formatMoney, toMinorUnits } from "@/lib/currencies";
import { useFieldArray, useForm, useWatch, type Control, type FieldErrors, type Resolver, type UseFormRegister } from "react-hook-form";
import { Check, Plus, Trash2 } from "lucide-react";
import { validateFormFields } from "@/hooks/useFormValidation";
import { Alert, Button, ConfirmDialog, Drawer, ErrorState, Field, IconButton, Input, Select, SkeletonRows, Textarea, cx, ui } from "@/design/redesign/ui";
import { sendJson, useEmployee, type DirectoryRow } from "../data";
import { ALL_FORM_RULES, FORM_RULES, FORM_SECTIONS, emptyEmployeeValues, type FormField, type Repeater } from "./fields";
import { buildPersonPayload, suggestEmployeeCode, valuesFromRecord, type FormValues } from "./person-payload";
import { currentSection } from "./scroll-spy";
import styles from "./EmployeeForm.module.css";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  employeeId?: string | null;
  directory: DirectoryRow[];
  onClose: () => void;
  onSaved: (result: { id: string; name: string; mode: "create" | "edit" }) => void;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Cross-field rules the server also applies (person-profile.ts applyPersonProfileRules). */
export function crossFieldErrors(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (String(values.maritalStatus ?? "").toLowerCase() === "married") {
    if (!values.marriageDate) errors.marriageDate = "A marriage date is required once marital status is married.";
    if (!String(values.spouseName ?? "").trim()) errors.spouseName = "A spouse name is required once marital status is married.";
  }
  if (values.dateOfBirth && values.marriageDate) {
    const earliest = new Date(`${values.dateOfBirth}T00:00:00Z`);
    earliest.setUTCFullYear(earliest.getUTCFullYear() + 18);
    if (String(values.marriageDate) < earliest.toISOString().slice(0, 10)) errors.marriageDate = "A marriage date cannot precede the date of birth plus 18 years.";
  }
  if (values.isDifferentlyAbled === true) {
    if (!String(values.disabilityType ?? "").trim()) errors.disabilityType = "Record the disability type.";
    if (values.disabilityPercent === "" || values.disabilityPercent === undefined) errors.disabilityPercent = "Record the disability percentage.";
  }
  if (values.dateOfBirth && String(values.dateOfBirth) > today()) errors.dateOfBirth = "The date of birth cannot be in the future.";
  const salary = String(values.basicSalary ?? "").trim();
  const currency = String(values.salaryCurrency ?? "");
  if (salary && !currency) errors.basicSalary = "Choose the currency the salary is paid in.";
  else if (salary && toMinorUnits(salary, currency) === null) {
    const digits = currencyDigits(currency);
    errors.basicSalary = digits === 0 ? `Enter a whole amount in ${currency} (it has no decimals).` : `Enter an amount in ${currency} with up to ${digits} decimals.`;
  }
  return errors;
}

function makeResolver(existingCodes: Set<string>, mode: "create" | "edit"): Resolver<FormValues> {
  return async (values) => {
    const found: Record<string, string> = { ...validateFormFields(values, ALL_FORM_RULES), ...crossFieldErrors(values) };
    const code = String(values.employeeCode ?? "").trim().toLowerCase();
    if (mode === "create" && code && existingCodes.has(code)) found.employeeCode = `Employee code "${values.employeeCode}" is already in use.`;
    if (Object.keys(found).length === 0) return { values, errors: {} };
    return { values: {}, errors: Object.fromEntries(Object.entries(found).map(([key, message]) => [key, { type: "validate", message }])) as FieldErrors<FormValues> };
  };
}

export default function EmployeeForm({ open, mode, employeeId, directory, onClose, onSaved }: Props) {
  const existingCodes = useMemo(() => new Set(directory.map((row) => row.employee_code.toLowerCase())), [directory]);
  const base = useMemo(() => emptyEmployeeValues(today()), []);
  const record = useEmployee(mode === "edit" && open ? employeeId ?? null : null);
  const resolver = useMemo(() => makeResolver(existingCodes, mode), [existingCodes, mode]);
  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({ defaultValues: base, resolver, mode: "onTouched", reValidateMode: "onChange" });
  const { errors, isDirty, isSubmitting, submitCount } = formState;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [activeSection, setActiveSection] = useState(FORM_SECTIONS[0]!.id);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  /** The scrolling form body, as state: the drawer mounts its content after opening. */
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  const indexRef = useRef<HTMLOListElement>(null);
  /** While a jump from the index scrolls smoothly, the clicked section stays current. */
  const jumpingUntil = useRef(0);
  const values = useWatch({ control }) as FormValues;

  // Fill the form when it opens: a suggested code for a new record, the stored profile for an edit.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { loadedFor.current = null; return; }
    if (mode === "create" && loadedFor.current !== "create") {
      loadedFor.current = "create";
      reset({ ...base, employeeCode: suggestEmployeeCode(directory.map((row) => row.employee_code)) });
    }
    if (mode === "edit" && record.data && loadedFor.current !== record.data.id) {
      loadedFor.current = record.data.id;
      const row = directory.find((item) => item.id === record.data!.id);
      const managerId = row?.manager_code ? directory.find((item) => item.employee_code === row.manager_code)?.id ?? "" : "";
      reset({ ...valuesFromRecord(record.data, base), manager: managerId });
    }
  }, [open, mode, record.data, base, directory, reset]);

  const managers = useMemo(
    () => directory.filter((row) => row.id !== employeeId && row.status !== "separated").sort((a, b) => a.first_name.localeCompare(b.first_name)),
    [directory, employeeId],
  );

  const sectionErrors = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const section of FORM_SECTIONS) {
      const keys = new Set([...(FORM_RULES[section.id] ?? []).map((rule) => rule.key), ...section.fields.map((field) => field.key)]);
      counts[section.id] = [...keys].filter((key) => errors[key]).length;
    }
    return counts;
  }, [errors]);
  const errorCount = Object.values(sectionErrors).reduce((sum, count) => sum + count, 0);

  function requestClose() {
    if (isDirty && !isSubmitting) setConfirmDiscard(true);
    else onClose();
  }

  function jumpTo(sectionId: string) {
    setActiveSection(sectionId);
    jumpingUntil.current = Date.now() + 900;
    bodyRef.current?.querySelector(`#section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save(formValues: FormValues) {
    setSaveError(null);
    const managerRow = directory.find((row) => row.id === formValues.manager);
    const payload = buildPersonPayload(formValues, managerRow ? { id: managerRow.id, name: `${managerRow.first_name} ${managerRow.last_name}`.trim() } : null);
    try {
      const result = mode === "edit" && employeeId
        ? await sendJson<{ data: { id: string } }>(`/api/v1/people/${encodeURIComponent(employeeId)}`, "PATCH", payload)
        : await sendJson<{ data: { id: string } }>("/api/v1/people", "POST", payload, true);
      reset(formValues);
      onSaved({ id: result.data.id, name: `${formValues.firstName} ${formValues.lastName}`.trim(), mode });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The employee could not be saved.");
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Validation failures are shown inline; react-hook-form focuses the first invalid field.
  const submit = () => handleSubmit(save)();

  const title = mode === "edit" ? "Edit employee" : "Add employee";
  const loading = mode === "edit" && (record.isLoading || (!record.data && !record.error));

  // Scroll spy: the index follows the section being read as the form scrolls.
  useEffect(() => {
    const body = bodyEl;
    if (!body) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < jumpingUntil.current) return;
      const offsets = FORM_SECTIONS.map((section) => ({ id: section.id, top: body.querySelector<HTMLElement>(`#section-${section.id}`)?.offsetTop ?? 0 }));
      const next = currentSection(offsets, body);
      if (next) setActiveSection((current) => (current === next ? current : next));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onScrollEnd = () => { jumpingUntil.current = 0; onScroll(); };
    body.addEventListener("scroll", onScroll, { passive: true });
    body.addEventListener("scrollend", onScrollEnd);
    return () => {
      body.removeEventListener("scroll", onScroll);
      body.removeEventListener("scrollend", onScrollEnd);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [bodyEl]);

  // Keep the current section visible in the index when the index itself scrolls (short screens).
  useEffect(() => {
    indexRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeSection]);
  const activeIndex = FORM_SECTIONS.findIndex((section) => section.id === activeSection);

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => { if (!next) requestClose(); }}
        title={title}
        description={mode === "edit" ? "Changes to designation, department, location or manager are added to the career history." : "Fields marked * are required. You can complete the rest later."}
        footer={
          <>
            {errorCount > 0 && submitCount > 0 && <span className={styles.footerNote} role="status">{errorCount} {errorCount === 1 ? "field needs" : "fields need"} attention</span>}
            <Button onClick={requestClose}>Cancel</Button>
            <Button variant="primary" loading={isSubmitting} onClick={() => void submit()} disabled={loading}>{mode === "edit" ? "Save changes" : "Add employee"}</Button>
          </>
        }
      >
        {loading ? <SkeletonRows rows={8} columns={2} /> : record.error ? (
          <div style={{ padding: 20 }}><ErrorState message={record.error.message} onRetry={() => void record.mutate()} /></div>
        ) : (
          <form className={styles.layout} onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
            <nav className={styles.index} aria-label="Form sections">
              <label className={styles.indexSelectLabel} htmlFor="employee-form-section">Section</label>
              <select id="employee-form-section" className={cx(ui.select, styles.indexSelect)} value={activeSection} onChange={(event) => jumpTo(event.target.value)}>
                {FORM_SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.title}{sectionErrors[section.id] ? ` (${sectionErrors[section.id]} to fix)` : ""}</option>)}
              </select>
              <ol className={styles.indexList} ref={indexRef}>
                {FORM_SECTIONS.map((section, position) => (
                  <li key={section.id} className={cx(styles.indexStep, position < activeIndex && styles.indexPassed)}>
                    <button type="button" className={styles.indexItem} aria-current={activeSection === section.id ? "true" : undefined} onClick={() => jumpTo(section.id)}>
                      <span className={styles.indexMarker} aria-hidden="true">{position < activeIndex ? <Check /> : null}</span>
                      <span className={styles.indexLabel}>{section.title}</span>
                      {sectionErrors[section.id] ? <span className={styles.indexErrors} aria-label={`${sectionErrors[section.id]} fields to fix`}>{sectionErrors[section.id]}</span> : null}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className={styles.body} ref={(element) => { bodyRef.current = element; setBodyEl(element); }}>
              {saveError && <Alert tone="danger">{saveError}</Alert>}
              {errorCount > 0 && submitCount > 0 && <Alert tone="warning">Fix the {errorCount} highlighted {errorCount === 1 ? "field" : "fields"} before saving.</Alert>}
              {FORM_SECTIONS.map((section) => (
                <fieldset key={section.id} id={`section-${section.id}`} className={styles.section}>
                  <legend className={styles.sectionTitle}>{section.title}</legend>
                  <p className={styles.sectionDescription}>{section.description}</p>
                  {section.fields.length > 0 && (
                    <div className={styles.grid}>
                      {section.fields.filter((field) => !field.showIf || field.showIf(values)).map((field) => (
                        <FormInput key={field.key} field={field} register={register} error={errors[field.key]?.message as string | undefined} required={field.required} disabled={mode === "edit" && field.lockedOnEdit} managers={managers} values={values} />
                      ))}
                    </div>
                  )}
                  {section.repeaters?.map((repeater) => <RepeaterGroup key={repeater.key} repeater={repeater} control={control} register={register} />)}
                </fieldset>
              ))}
            </div>
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => { setConfirmDiscard(false); reset(base); onClose(); }}
      >
        You have changes that have not been saved. They will be lost.
      </ConfirmDialog>
    </>
  );
}

function FormInput({ field, register, error, required, disabled, managers, values }: {
  field: FormField; register: UseFormRegister<FormValues>; error?: string; required?: boolean; disabled?: boolean; managers: DirectoryRow[]; values: FormValues;
}) {
  const id = `employee-${field.key}`;
  const describedBy = error ? `${id}-error` : field.hint ? `${id}-hint` : undefined;
  const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": required || undefined, disabled, ...register(field.key) };
  if (field.type === "money" && field.currencyKey) {
    // One control: the currency the salary is paid in, and the amount in that currency.
    const currency = String(values[field.currencyKey] ?? "INR");
    const amount = String(values[field.key] ?? "").trim();
    const minor = amount ? toMinorUnits(amount, currency) : null;
    const digits = currencyDigits(currency);
    const masked = Boolean(values.salaryMasked);
    const preview = minor !== null ? `${formatMoney(minor, currency)} a month · ${formatMoney(minor * 12, currency)} a year` : null;
    return (
      <div className={cx(styles.cell, field.wide && styles.wide)}>
        <Field id={id} label={field.label} required={required} hint={error ? undefined : preview ?? (masked ? "The current amount is hidden for your role. Enter an amount only to replace it." : field.hint)} error={error}>
          <div className={styles.money}>
            <Select id={`${id}-currency`} aria-label="Salary currency" className={styles.moneyCurrency} disabled={disabled} {...register(field.currencyKey)}>
              {SALARY_CURRENCIES.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.name}</option>)}
            </Select>
            <div className={styles.moneyAmount}>
              <span className={styles.moneySymbol} aria-hidden="true">{currencySymbol(currency)}</span>
              <Input {...common} type="text" inputMode={digits === 0 ? "numeric" : "decimal"} autoComplete="off"
                placeholder={masked ? "Hidden for your role" : digits === 0 ? "250000" : digits === 3 ? "1500.000" : "150000.00"} />
            </div>
          </div>
        </Field>
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <div className={cx(styles.cell, styles.checkboxCell)}>
        <label className={ui.checkbox} htmlFor={id}><input type="checkbox" {...common} />{field.label}</label>
        {error && <span className={ui.error}>{error}</span>}
      </div>
    );
  }
  let control;
  if (field.type === "select") {
    control = <Select {...common}><option value="">Select…</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</Select>;
  } else if (field.type === "manager") {
    control = (
      <Select {...common}>
        <option value="">Select a manager…</option>
        {managers.map((row) => <option key={row.id} value={row.id}>{`${row.first_name} ${row.last_name}`.trim()} · {row.employee_code}{row.designation && row.designation !== "—" ? ` · ${row.designation}` : ""}</option>)}
      </Select>
    );
  } else if (field.type === "textarea") {
    control = <Textarea {...common} placeholder={field.placeholder} />;
  } else {
    const type = field.type === "number" ? "text" : field.type ?? "text";
    control = <Input {...common} type={type} inputMode={field.type === "number" ? "numeric" : field.inputMode} placeholder={field.placeholder} autoComplete={field.autoComplete ?? "off"} />;
  }
  return (
    <div className={cx(styles.cell, field.wide && styles.wide)}>
      <Field id={id} label={field.label} required={required} hint={field.hint} error={error}>{control}</Field>
    </div>
  );
}

function RepeaterGroup({ repeater, control, register }: { repeater: Repeater; control: Control<FormValues>; register: UseFormRegister<FormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: repeater.key as never });
  return (
    <div className={styles.repeater}>
      <div className={styles.repeaterHeader}>
        <h4 className={styles.repeaterTitle}>{repeater.label}</h4>
        <Button size="sm" icon={Plus} onClick={() => append(repeater.empty as never)}>{repeater.addLabel}</Button>
      </div>
      {fields.length === 0 && <p className={styles.repeaterEmpty}>None added.</p>}
      {fields.map((item, index) => (
        <div key={item.id} className={styles.repeaterRow}>
          <div className={styles.grid}>
            {repeater.fields.map((field) => {
              const id = `employee-${repeater.key}-${index}-${field.key}`;
              const name = `${repeater.key}.${index}.${field.key}`;
              if (field.type === "checkbox") {
                return <div key={field.key} className={cx(styles.cell, styles.checkboxCell)}><label className={ui.checkbox} htmlFor={id}><input id={id} type="checkbox" {...register(name)} />{field.label}</label></div>;
              }
              return (
                <div key={field.key} className={cx(styles.cell, field.wide && styles.wide)}>
                  <Field id={id} label={field.label}>
                    {field.type === "select"
                      ? <Select id={id} {...register(name)}><option value="">Select…</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</Select>
                      : <Input id={id} type={field.type === "date" ? "date" : "text"} inputMode={field.type === "number" ? "numeric" : field.inputMode} {...register(name)} />}
                  </Field>
                </div>
              );
            })}
          </div>
          <IconButton label={`Remove ${repeater.label.toLowerCase()} ${index + 1}`} icon={Trash2} onClick={() => remove(index)} />
        </div>
      ))}
    </div>
  );
}
