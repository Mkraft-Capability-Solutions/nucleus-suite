"use client";

import { useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import { useT } from "@/hooks/useT";
import {
  coerceCustomValue, currencySchema, visaRuleIssues, visaSchema, VISA_ENTRY_TYPES,
  type CustomFieldValue, type EmployeeMasterView, type FieldIssue, type PatchEmployeeMaster,
} from "@/lib/employee-master/contract";
import { Alert, Button, Details, EmptyState, ErrorState, Field, Input, Panel, Select, SkeletonRows, ui } from "@/design/redesign/ui";
import { usePeople } from "../data";
import { issuesByField, MasterSaveError, saveEmployeeMaster, useEmployeeMaster } from "./master-data";
import styles from "./EmployeeProfile.module.css";

export type MasterTab = "currency" | "visa" | "custom";
type Draft = Record<string, string | boolean>;
type Props = { employeeId: string; tab: MasterTab; canEdit: boolean };

const str = (value: unknown): string => (value === null || value === undefined ? "" : String(value));
const zodIssues = (issues: Array<{ path: PropertyKey[]; message: string }>): FieldIssue[] => issues.map((issue) => ({ field: issue.path.map(String).join("."), issue: issue.message }));

/** The three employee-master sections of the profile: currency, visa & expatriate, custom attributes. */
export default function EmployeeMasterTabs({ employeeId, tab, canEdit }: Props) {
  const { t } = useT();
  const master = useEmployeeMaster(employeeId);
  if (master.error) return <ErrorState message={master.error.message} onRetry={() => void master.mutate()} />;
  if (master.isLoading || !master.data) return <Panel><SkeletonRows rows={4} columns={2} /></Panel>;
  const onSaved = (next: EmployeeMasterView) => void master.mutate(next, { revalidate: false });
  // Keyed by version so a saved or re-fetched record resets the draft.
  const key = `${tab}-${master.data.version}`;
  if (tab === "currency") return <CurrencyForm key={key} view={master.data} canEdit={canEdit} onSaved={onSaved} t={t} />;
  if (tab === "visa") return <VisaForm key={key} view={master.data} canEdit={canEdit} onSaved={onSaved} t={t} />;
  return <CustomForm key={key} view={master.data} canEdit={canEdit} onSaved={onSaved} t={t} />;
}

type FormProps = { view: EmployeeMasterView; canEdit: boolean; onSaved: (view: EmployeeMasterView) => void; t: ReturnType<typeof useT>["t"] };

function useSave(view: EmployeeMasterView, section: string, onSaved: FormProps["onSaved"]) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function submit(patch: PatchEmployeeMaster, clientIssues: FieldIssue[]) {
    setSaved(false);
    if (clientIssues.length) { setErrors(issuesByField(clientIssues, section)); setMessage(null); return; }
    setSaving(true); setErrors({}); setMessage(null);
    try {
      onSaved(await saveEmployeeMaster(view.id, { ...patch, version: view.version }, section, crypto.randomUUID()));
      setSaved(true);
    } catch (error) {
      if (error instanceof MasterSaveError) { setErrors(issuesByField(error.details, section)); setMessage(error.message); }
      else setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }
  return { errors, message, saving, saved, submit };
}

function FormShell({ title, subtitle, canEdit, saving, saved, message, onSubmit, children, t }: { title: string; subtitle: string; canEdit: boolean; saving: boolean; saved: boolean; message: string | null; onSubmit: () => void; children: ReactNode; t: FormProps["t"] }) {
  return (
    <Panel title={title} subtitle={subtitle} actions={canEdit ? <Button variant="primary" icon={Save} disabled={saving} onClick={onSubmit}>{saving ? t("coreHr.master.saving", "Saving…") : t("coreHr.master.save", "Save changes")}</Button> : undefined}>
      <div className={styles.stack}>
        {message && <Alert tone="danger">{message}</Alert>}
        {saved && <Alert tone="success">{t("coreHr.master.saved", "Changes saved.")}</Alert>}
        <form className={ui.grid2} onSubmit={(event) => { event.preventDefault(); onSubmit(); }} aria-label={title}>{children}</form>
      </div>
    </Panel>
  );
}

function TextField({ id, label, value, onChange, error, disabled, required, type = "text", hint }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; disabled: boolean; required?: boolean; type?: string; hint?: string }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <Input id={id} type={type} value={value} disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function CurrencyForm({ view, canEdit, onSaved, t }: FormProps) {
  const [draft, setDraft] = useState<Draft>({ baseCurrency: str(view.currency.baseCurrency), payrollCurrency: str(view.currency.payrollCurrency), fxRateOverride: str(view.currency.fxRateOverride) });
  const save = useSave(view, "currency", onSaved);
  const set = (key: string) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  function submit() {
    const parsed = currencySchema.safeParse(draft);
    void save.submit(parsed.success ? { currency: parsed.data } : {}, parsed.success ? [] : zodIssues(parsed.error.issues));
  }
  return (
    <FormShell title={t("coreHr.master.currency.title", "Compensation & currency")} subtitle={t("coreHr.master.currency.subtitle", "Currencies used for this employee's pay")} canEdit={canEdit} saving={save.saving} saved={save.saved} message={save.message} onSubmit={submit} t={t}>
      <TextField id="m-base-currency" label={t("coreHr.master.currency.base", "Base currency")} hint={t("coreHr.master.currency.isoHint", "ISO 4217, for example INR")} value={str(draft.baseCurrency)} onChange={set("baseCurrency")} error={save.errors.baseCurrency} disabled={!canEdit} />
      <TextField id="m-payroll-currency" label={t("coreHr.master.currency.payroll", "Payroll currency")} hint={t("coreHr.master.currency.isoHint", "ISO 4217, for example INR")} value={str(draft.payrollCurrency)} onChange={set("payrollCurrency")} error={save.errors.payrollCurrency} disabled={!canEdit} />
      <TextField id="m-fx" type="number" label={t("coreHr.master.currency.fx", "Exchange rate override")} hint={t("coreHr.master.currency.fxHint", "Leave blank to use the published rate")} value={str(draft.fxRateOverride)} onChange={set("fxRateOverride")} error={save.errors.fxRateOverride} disabled={!canEdit} />
      <Details items={[{ label: t("coreHr.master.currency.legacy", "Salary record currency"), value: view.currency.legacyCurrency }]} />
    </FormShell>
  );
}

const VISA_TEXT = ["homeCountry", "hostCountry", "taxResidencyCountry", "sponsorEntityId", "visaType", "visaIssuingCountry", "visaIssueDate", "visaExpiryDate", "visaEntryType", "workPermitNumber", "workPermitExpiryDate"] as const;

function VisaForm({ view, canEdit, onSaved, t }: FormProps) {
  const people = usePeople();
  const entities = people.data?.legalEntities ?? [];
  const [draft, setDraft] = useState<Draft>({ ...Object.fromEntries(VISA_TEXT.map((key) => [key, str(view.visa[key])])), isExpatriate: view.visa.isExpatriate, visaNumber: "" });
  const save = useSave(view, "visa", onSaved);
  const set = (key: string) => (value: string | boolean) => setDraft((prev) => ({ ...prev, [key]: value }));
  const expat = draft.isExpatriate === true;
  function submit() {
    // The visa number is write-only: send it only when the user typed a new one.
    const { visaNumber, ...rest } = draft;
    const candidate = str(visaNumber).trim() === "" ? rest : draft;
    const parsed = visaSchema.safeParse(candidate);
    if (!parsed.success) return void save.submit({}, zodIssues(parsed.error.issues));
    const v = parsed.data;
    const issues = visaRuleIssues({
      isExpatriate: v.isExpatriate ?? false, hostCountry: v.hostCountry ?? null, visaType: v.visaType ?? null,
      hasVisaNumber: v.visaNumber !== undefined ? v.visaNumber !== null : view.visa.visaNumberLast4 !== null,
      visaIssuingCountry: v.visaIssuingCountry ?? null, visaIssueDate: v.visaIssueDate ?? null, visaExpiryDate: v.visaExpiryDate ?? null,
    });
    void save.submit({ visa: v }, issues.map((issue) => ({ ...issue, field: issue.field.replace(/^visa\./, "") })));
  }
  const text = (key: string, label: string, required = false, type = "text") => (
    <TextField id={`m-${key}`} label={label} type={type} required={required} value={str(draft[key])} onChange={set(key)} error={save.errors[key]} disabled={!canEdit} />
  );
  const stored = view.visa.visaNumber ?? (view.visa.visaNumberLast4 ? `•••• ${view.visa.visaNumberLast4}` : t("coreHr.master.visa.none", "Not recorded"));
  return (
    <FormShell title={t("coreHr.master.visa.title", "Visa & expatriate")} subtitle={t("coreHr.master.visa.subtitle", "Assignment, residency and work authorisation")} canEdit={canEdit} saving={save.saving} saved={save.saved} message={save.message} onSubmit={submit} t={t}>
      <Field id="m-isExpatriate" label={t("coreHr.master.visa.isExpatriate", "Expatriate assignment")}>
        <Select id="m-isExpatriate" value={expat ? "yes" : "no"} disabled={!canEdit} onChange={(event) => set("isExpatriate")(event.target.value === "yes")}>
          <option value="no">{t("coreHr.master.no", "No")}</option><option value="yes">{t("coreHr.master.yes", "Yes")}</option>
        </Select>
      </Field>
      {text("homeCountry", t("coreHr.master.visa.home", "Home country (ISO 2)"))}
      {text("hostCountry", t("coreHr.master.visa.host", "Host country (ISO 2)"), expat)}
      {text("taxResidencyCountry", t("coreHr.master.visa.tax", "Tax residency country (ISO 2)"))}
      <Field id="m-sponsorEntityId" label={t("coreHr.master.visa.sponsor", "Sponsoring legal entity")} error={save.errors.sponsorEntityId}>
        <Select id="m-sponsorEntityId" value={str(draft.sponsorEntityId)} disabled={!canEdit} onChange={(event) => set("sponsorEntityId")(event.target.value)}>
          <option value="">{t("coreHr.master.visa.noSponsor", "None")}</option>
          {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.legal_name} ({entity.code})</option>)}
        </Select>
      </Field>
      {text("visaType", t("coreHr.master.visa.type", "Visa type"), expat)}
      <TextField id="m-visaNumber" label={t("coreHr.master.visa.number", "Visa number")} required={expat && !view.visa.visaNumberLast4}
        hint={t("coreHr.master.visa.numberHint", "Stored encrypted. Current: {current}", { current: stored })}
        value={str(draft.visaNumber)} onChange={set("visaNumber")} error={save.errors.visaNumber} disabled={!canEdit} />
      {text("visaIssuingCountry", t("coreHr.master.visa.issuing", "Issuing country (ISO 2)"), expat)}
      {text("visaIssueDate", t("coreHr.master.visa.issueDate", "Issue date"), false, "date")}
      {text("visaExpiryDate", t("coreHr.master.visa.expiryDate", "Expiry date"), expat, "date")}
      <Field id="m-visaEntryType" label={t("coreHr.master.visa.entry", "Entry type")} error={save.errors.visaEntryType}>
        <Select id="m-visaEntryType" value={str(draft.visaEntryType)} disabled={!canEdit} onChange={(event) => set("visaEntryType")(event.target.value)}>
          <option value="">{t("coreHr.master.visa.notSet", "Not set")}</option>
          {VISA_ENTRY_TYPES.map((entry) => <option key={entry} value={entry}>{entry === "SINGLE" ? t("coreHr.master.visa.single", "Single entry") : t("coreHr.master.visa.multiple", "Multiple entry")}</option>)}
        </Select>
      </Field>
      {text("workPermitNumber", t("coreHr.master.visa.permit", "Work permit number"))}
      {text("workPermitExpiryDate", t("coreHr.master.visa.permitExpiry", "Work permit expiry"), false, "date")}
    </FormShell>
  );
}

function CustomForm({ view, canEdit, onSaved, t }: FormProps) {
  const [draft, setDraft] = useState<Record<string, CustomFieldValue>>(Object.fromEntries(view.customFields.map((field) => [field.key, field.value])));
  const save = useSave(view, "customFields", onSaved);
  if (view.customFields.length === 0) {
    return <Panel title={t("coreHr.master.custom.title", "Custom attributes")}><EmptyState title={t("coreHr.master.custom.emptyTitle", "No custom attributes defined")}>{t("coreHr.master.custom.empty", "An administrator can define custom attributes for the employee master in Settings.")}</EmptyState></Panel>;
  }
  function submit() {
    const issues: FieldIssue[] = [];
    const values: Record<string, CustomFieldValue> = {};
    for (const field of view.customFields) {
      const result = coerceCustomValue(field, draft[field.key] ?? null);
      if ("issue" in result) issues.push({ field: field.key, issue: result.issue });
      else values[field.key] = result.value;
    }
    void save.submit({ customFields: values }, issues);
  }
  const set = (key: string, value: CustomFieldValue) => setDraft((prev) => ({ ...prev, [key]: value }));
  return (
    <FormShell title={t("coreHr.master.custom.title", "Custom attributes")} subtitle={t("coreHr.master.custom.subtitle", "Fields defined by your organisation")} canEdit={canEdit} saving={save.saving} saved={save.saved} message={save.message} onSubmit={submit} t={t}>
      {view.customFields.map((field) => {
        const id = `m-cf-${field.key}`;
        const error = save.errors[field.key];
        if (field.type === "SELECT" || field.type === "BOOLEAN") {
          const value = field.type === "BOOLEAN" ? (draft[field.key] === null || draft[field.key] === undefined ? "" : draft[field.key] ? "true" : "false") : str(draft[field.key]);
          return (
            <Field key={field.key} id={id} label={field.label} required={field.required} error={error}>
              <Select id={id} value={value} disabled={!canEdit} aria-invalid={error ? true : undefined} onChange={(event) => set(field.key, field.type === "BOOLEAN" ? (event.target.value === "" ? null : event.target.value === "true") : event.target.value)}>
                <option value="">{t("coreHr.master.visa.notSet", "Not set")}</option>
                {field.type === "BOOLEAN"
                  ? <><option value="true">{t("coreHr.master.yes", "Yes")}</option><option value="false">{t("coreHr.master.no", "No")}</option></>
                  : field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
          );
        }
        return <TextField key={field.key} id={id} label={field.label} required={field.required} type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"} value={str(draft[field.key])} onChange={(value) => set(field.key, value)} error={error} disabled={!canEdit} />;
      })}
    </FormShell>
  );
}
