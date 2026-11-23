"use client";

import { useId, useState } from "react";
import { Building2, Save } from "lucide-react";
import { send, useResource, useSubmitKey, type Translate } from "../admin/adminApi";
import { Notice, StateBox, useToast } from "../admin/AdminParts";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.SettingsView";

type WorkWeek = "mon_fri" | "mon_sat" | "mon_thu_half_fri";
type Profile = { name: string; legalName: string | null; slug: string; locale: string; timezone: string; currency: string; workWeek: WorkWeek | null; dataResidency: string | null; canManage: boolean };
type Form = { legalName: string; locale: string; timezone: string; currency: string; workWeek: WorkWeek | "" };

const CURRENCIES = ["INR", "USD", "EUR", "AED", "GBP", "SGD"];
const LOCALES = ["en-IN", "en-US", "en-GB", "hi-IN", "ar-AE"];

function timezones(current: string): string[] {
  const list = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return list.includes(current) || !current ? list : [current, ...list];
}

/** Organisation settings: GET/PATCH /api/v1/tenant/profile (tenant.read / tenant.manage). Mirrors patchTenantProfileSchema. */
export default function TenantTab({ t }: { t: Translate }) {
  const id = useId();
  const toast = useToast();
  const submitKey = useSubmitKey();
  const { state, reload } = useResource<Profile>("/api/v1/tenant/profile", t(`${NS}.text_tenant_failed`, "Organisation settings could not be loaded."));
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === "loading") return <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>;
  if (state.status === "error") return <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>;
  const profile = state.data;
  const base: Form = { legalName: profile.legalName ?? "", locale: profile.locale, timezone: profile.timezone, currency: profile.currency, workWeek: profile.workWeek ?? "" };
  const current = form ?? base;
  const changed = (Object.keys(base) as Array<keyof Form>).filter((key) => current[key] !== base[key]);
  const currencyName = (code: string) => { try { return new Intl.DisplayNames([profile.locale], { type: "currency" }).of(code) ?? code; } catch { return code; } };

  const save = async () => {
    const found: Partial<Record<keyof Form, string>> = {};
    if (changed.includes("legalName") && (current.legalName.trim().length < 2 || current.legalName.trim().length > 200)) found.legalName = t(`${NS}.err_legal`, "Use 2 to 200 characters.");
    setErrors(found);
    if (Object.keys(found).length > 0 || changed.length === 0 || busy) return;
    const body: Record<string, string> = {};
    for (const key of changed) body[key] = key === "legalName" ? current.legalName.trim() : current[key];
    setBusy(true);
    setError(null);
    const result = await send<Profile>("/api/v1/tenant/profile", { method: "PATCH", body, idempotencyKey: submitKey.key(JSON.stringify(body)), fallback: t(`${NS}.text_tenant_save_failed`, "Organisation settings could not be saved.") });
    setBusy(false);
    if (!result.ok) {
      const field = result.error.details[0]?.field as keyof Form | undefined;
      if (field && field in base) setErrors({ [field]: result.error.message }); else setError(result.error.message);
      return;
    }
    submitKey.done();
    setForm(null);
    reload();
    toast(t(`${NS}.toast_saved_title`, "Settings saved"), t(`${NS}.toast_tenant`, "Organisation settings were updated."), "success");
  };

  const disabled = !profile.canManage || busy;
  const set = (key: keyof Form, value: string) => setForm({ ...current, [key]: value } as Form);
  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon} aria-hidden="true"><Building2 size={18} /></span>
        <div><h3 className={styles.cardTitle}>{t(`${NS}.text_tenant_title`, "Organisation & localisation")}</h3><p className={styles.cardSubtitle}>{t(`${NS}.text_tenant_sub`, "Legal name, base currency, time zone and work week for {name}.", { name: profile.name })}</p></div>
      </div>
      {!profile.canManage && <Notice tone="info">{t(`${NS}.text_tenant_readonly`, "You can view these settings. Changing them needs the tenant management permission.")}</Notice>}
      <form className={styles.formGrid} noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-legal`}>{t(`${NS}.text_legal_name`, "Corporate legal name")}</label>
          <input id={`${id}-legal`} className={`${styles.input} ${errors.legalName ? styles.inputInvalid : ""}`} value={current.legalName} maxLength={200} disabled={disabled} aria-invalid={Boolean(errors.legalName)} onChange={(event) => set("legalName", event.target.value)} />
          <span className={errors.legalName ? styles.fieldError : styles.help}>{errors.legalName ?? t(`${NS}.help_legal`, "Printed on employee documents.")}</span>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-cur`}>{t(`${NS}.text_currency`, "Primary operating currency")}</label>
          <select id={`${id}-cur`} className={styles.select} value={current.currency} disabled={disabled} onChange={(event) => set("currency", event.target.value)}>
            {[...new Set([current.currency, ...CURRENCIES])].map((code) => <option key={code} value={code}>{code} · {currencyName(code)}</option>)}
          </select>
          <span className={styles.help}>{t(`${NS}.help_currency`, "Base currency for GL exports and salary disbursements.")}</span>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-tz`}>{t(`${NS}.text_org_timezone`, "Organisation time zone")}</label>
          <select id={`${id}-tz`} className={styles.select} value={current.timezone} disabled={disabled} onChange={(event) => set("timezone", event.target.value)}>
            {timezones(current.timezone).map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-loc`}>{t(`${NS}.text_org_locale`, "Default locale")}</label>
          <select id={`${id}-loc`} className={styles.select} value={current.locale} disabled={disabled} onChange={(event) => set("locale", event.target.value)}>
            {[...new Set([current.locale, ...LOCALES])].map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-ww`}>{t(`${NS}.text_work_week`, "Default work week")}</label>
          <select id={`${id}-ww`} className={styles.select} value={current.workWeek} disabled={disabled} onChange={(event) => set("workWeek", event.target.value)}>
            {!current.workWeek && <option value="">{t(`${NS}.text_not_set`, "Not set")}</option>}
            <option value="mon_fri">{t(`${NS}.ww_mon_fri`, "Monday to Friday")}</option>
            <option value="mon_sat">{t(`${NS}.ww_mon_sat`, "Monday to Saturday")}</option>
            <option value="mon_thu_half_fri">{t(`${NS}.ww_uae`, "Monday to Thursday + half-day Friday")}</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-res`}>{t(`${NS}.text_residency`, "Data residency region")}</label>
          <input id={`${id}-res`} className={styles.input} value={profile.dataResidency ?? t(`${NS}.text_residency_none`, "Not recorded for this organisation")} disabled />
        </div>
        <div className={styles.footer} style={{ gridColumn: "1 / -1" }}>
          <span>{error && <Notice tone="error">{error}</Notice>}</span>
          {profile.canManage && (
            <div className={styles.row}>
              <button type="button" className={styles.btnSecondary} disabled={changed.length === 0 || busy} onClick={() => { setForm(null); setErrors({}); }}>{t(`${NS}.text_discard`, "Discard")}</button>
              <button type="submit" className={styles.btnPrimary} disabled={changed.length === 0 || busy}><Save size={15} aria-hidden="true" />{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_save`, "Save changes")}</button>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
