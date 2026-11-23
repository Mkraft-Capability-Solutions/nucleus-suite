"use client";

import { useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import { X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import styles from "../OnboardingView.module.css";
import { localToday, newIdempotencyKey, sendJson, type Translate } from "./api";
import EmployeePicker, { type EmployeeOption } from "./EmployeePicker";
import { picklistOptions } from "./picklistOptions";

/**
 * Register an asset (POST /api/v1/assets/register) and, when a holder is chosen, allocate it
 * (POST /api/v1/assets/register/{id}/allocate). Each step has its own Idempotency-Key kept
 * across retries; if registration succeeded and allocation failed, a retry only allocates.
 * Client rules mirror `registerCatalogAssetSchema` and `allocateAssetSchema`.
 */

const NS = "components.Workspace.OnboardingView";
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

type Form = {
  assetType: string; brand: string; model: string; assetCode: string; serialNumber: string; condition: string;
  value: string; currency: string; issuedOn: string; reason: string;
};
type FieldKey = keyof Form | "holder";

const EMPTY: Form = { assetType: "laptop", brand: "", model: "", assetCode: "", serialNumber: "", condition: "new", value: "", currency: "", issuedOn: "", reason: "" };

export default function AssetAllocateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = useHRMS() as { showToast?: (title: string, message: string, tone: string) => void };
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, issuedOn: localToday() }));
  const [holder, setHolder] = useState<EmployeeOption | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useRef<{ register: string | null; allocate: string | null; assetId: string | null }>({ register: null, allocate: null, assetId: null });

  const set = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const required = t(`${NS}.err_required`, "This field is required.");
  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.brand.trim()) next.brand = required; else if (form.brand.trim().length > 50) next.brand = t(`${NS}.err_max`, "Keep this under {max} characters.", { max: 50 });
    if (!form.model.trim()) next.model = required; else if (form.model.trim().length > 80) next.model = t(`${NS}.err_max`, "Keep this under {max} characters.", { max: 80 });
    if (!form.assetCode.trim()) next.assetCode = required;
    else if (form.assetCode.trim().length > 30 || !CODE_PATTERN.test(form.assetCode.trim())) next.assetCode = t(`${NS}.err_asset_code`, "Use up to 30 letters, digits, dot, slash, underscore or hyphen.");
    if (!form.serialNumber.trim()) next.serialNumber = required; else if (form.serialNumber.trim().length > 50) next.serialNumber = t(`${NS}.err_max`, "Keep this under {max} characters.", { max: 50 });
    if (form.value.trim() !== "" && (Number.isNaN(Number(form.value)) || Number(form.value) < 0)) next.value = t(`${NS}.err_amount`, "Enter an amount of zero or more.");
    if (form.value.trim() !== "" && !form.currency) next.currency = t(`${NS}.err_currency`, "A replacement value needs its currency.");
    if (holder) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.issuedOn)) next.issuedOn = t(`${NS}.err_date`, "Enter a valid date.");
      if (form.reason.trim().length < 3) next.reason = t(`${NS}.err_reason_min`, "Enter at least {min} characters.", { min: 3 });
    }
    return next;
  };

  const reset = () => {
    keys.current = { register: null, allocate: null, assetId: null };
    setForm({ ...EMPTY, issuedOn: localToday() });
    setHolder(null); setErrors({}); setServerError(null);
  };

  const close = () => { if (!busy) { reset(); onClose(); } };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`asset-allocate-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    if (!keys.current.assetId) {
      keys.current.register ??= newIdempotencyKey();
      const body: Record<string, unknown> = {
        assetCode: form.assetCode.trim(), assetType: form.assetType, brand: form.brand.trim(), model: form.model.trim(),
        serialNumber: form.serialNumber.trim(), condition: form.condition,
      };
      if (form.value.trim() !== "") { body.replacementValueMinor = Math.round(Number(form.value) * 100); body.currency = form.currency; }
      const registered = await sendJson<{ id: string }>("/api/v1/assets/register", { method: "POST", body, idempotencyKey: keys.current.register, fallback: t(`${NS}.err_register_failed`, "The asset could not be registered.") });
      if (!registered.ok) {
        setBusy(false);
        setServerError(registered.error.message);
        const fieldErrors: Partial<Record<FieldKey, string>> = {};
        registered.error.details.forEach((detail) => { if (detail.field in EMPTY) fieldErrors[detail.field as keyof Form] = detail.issue; });
        setErrors(fieldErrors);
        return;
      }
      keys.current.assetId = registered.data.id;
    }
    if (holder && keys.current.assetId) {
      keys.current.allocate ??= newIdempotencyKey();
      const allocated = await sendJson(`/api/v1/assets/register/${encodeURIComponent(keys.current.assetId)}/allocate`, {
        method: "POST",
        body: { employeeId: holder.id, issuedOn: form.issuedOn, conditionAtIssue: form.condition, reason: form.reason.trim() },
        idempotencyKey: keys.current.allocate,
        fallback: t(`${NS}.err_allocate_failed`, "The asset was registered but could not be allocated."),
      });
      if (!allocated.ok) {
        setBusy(false);
        setServerError(t(`${NS}.err_allocate_after_register`, "The asset is registered, but allocation failed: {message}", { message: allocated.error.message }));
        onSaved();
        return;
      }
    }
    setBusy(false);
    showToast?.(
      holder ? t(`${NS}.toast_allocated_title`, "Asset allocated") : t(`${NS}.toast_registered_title`, "Asset registered"),
      holder ? t(`${NS}.toast_allocated_body`, "{asset} is now with {name}.", { asset: form.assetCode.trim(), name: holder.name }) : t(`${NS}.toast_registered_body`, "{asset} is in store and ready to allocate.", { asset: form.assetCode.trim() }),
      "success",
    );
    reset();
    onSaved();
    onClose();
  };

  const field = (key: keyof Form, label: string, input: React.ReactNode, isRequired: boolean, hint?: string) => (
    <div className={styles.formGroup}>
      <label htmlFor={`asset-allocate-${key}`}>{label}{isRequired && <span className={styles.req} aria-hidden="true">*</span>}</label>
      {input}
      {(errors[key] || hint) && <span id={`asset-allocate-${key}-msg`} className={errors[key] ? styles.fieldError : styles.hint}>{errors[key] ?? hint}</span>}
    </div>
  );
  const inputProps = (key: keyof Form, isRequired = false) => ({
    id: `asset-allocate-${key}`,
    className: styles.formInput,
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, event.target.value),
    "aria-required": isRequired || undefined,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `asset-allocate-${key}-msg` : undefined,
  });

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" aria-labelledby="asset-allocate-title">
      <form className={styles.dialog} onSubmit={(event) => void submit(event)} noValidate>
        <header className={styles.dialogHeader}>
          <div>
            <h3 id="asset-allocate-title">{t(`${NS}.allocate_title`, "Register and allocate an asset")}</h3>
            <p>{t(`${NS}.allocate_subtitle`, "Catalogue the asset, then optionally hand it to an employee. Leave the holder empty to keep it in store.")}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label={t(`${NS}.close`, "Close")}><X size={16} aria-hidden="true" /></button>
        </header>
        <div className={styles.dialogBody}>
          <div className={styles.formGrid2}>
            {field("assetType", t(`${NS}.field_asset_type`, "Asset type"), (
              <select {...inputProps("assetType", true)}>{picklistOptions("PL_ASSET_TYPE", t).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            ), true)}
            {field("condition", t(`${NS}.field_condition`, "Condition at issue"), (
              <select {...inputProps("condition", true)}>{picklistOptions("PL_ASSET_CONDITION", t).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            ), true)}
            {field("brand", t(`${NS}.field_brand`, "Brand"), <input {...inputProps("brand", true)} maxLength={50} />, true)}
            {field("model", t(`${NS}.field_model`, "Model"), <input {...inputProps("model", true)} maxLength={80} />, true)}
            {field("assetCode", t(`${NS}.field_asset_tag`, "Asset tag"), <input {...inputProps("assetCode", true)} maxLength={30} />, true, t(`${NS}.hint_asset_tag`, "The label on the asset; must be unique."))}
            {field("serialNumber", t(`${NS}.field_serial`, "Serial number"), <input {...inputProps("serialNumber", true)} maxLength={50} />, true)}
            {field("value", t(`${NS}.field_value`, "Replacement value"), <input {...inputProps("value")} type="number" min="0" step="0.01" inputMode="decimal" />, false, t(`${NS}.hint_optional`, "Optional"))}
            {field("currency", t(`${NS}.field_currency`, "Currency"), (
              <select {...inputProps("currency", form.value.trim() !== "")}>
                <option value="">{t(`${NS}.choose`, "Choose…")}</option>
                {picklistOptions("PL_CURRENCY", t).map((o) => <option key={o.value} value={o.value.toUpperCase()}>{o.label}</option>)}
              </select>
            ), form.value.trim() !== "")}
          </div>
          <EmployeePicker id="asset-allocate-holder" label={t(`${NS}.field_holder`, "Allocate to")} value={holder} onChange={(value) => { setHolder(value); setErrors((c) => ({ ...c, holder: undefined })); }} />
          {holder && (
            <div className={styles.formGrid2}>
              {field("issuedOn", t(`${NS}.field_issued_on`, "Issued on"), <input {...inputProps("issuedOn", true)} type="date" />, true, t(`${NS}.hint_issued_on`, "Cannot precede the employee's joining date."))}
              {field("reason", t(`${NS}.field_reason`, "Reason"), <input {...inputProps("reason", true)} maxLength={500} />, true)}
            </div>
          )}
          {serverError && <p className={styles.formError} role="alert">{serverError}</p>}
        </div>
        <footer className={styles.dialogFooter}>
          <button type="button" className={styles.btnSecondary} onClick={close} disabled={busy}>{t(`${NS}.cancel`, "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>
            {busy ? t(`${NS}.saving`, "Saving…") : holder ? t(`${NS}.allocate_submit`, "Register and allocate") : t(`${NS}.register_submit`, "Register asset")}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
