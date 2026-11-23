"use client";

import { useEffect, useId, useState } from "react";
import NextImage from "next/image";
import { Save, User } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import { send, useResource, useSubmitKey, type Translate } from "../admin/adminApi";
import { Notice, StateBox, useToast } from "../admin/AdminParts";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.SettingsView";

type Profile = { id: string; name: string | null; email: string | null; phone: string | null; jobTitle: string | null; dept: string | null; location: string | null; photoUrl: string | null; roles: string[] };
type Form = { name: string; phone: string; jobTitle: string; dept: string; location: string };

/** Mirrors updateOwnProfileSchema (src/server/identity/profile.ts). */
function validate(t: Translate, form: Form): Partial<Record<keyof Form, string>> {
  const errors: Partial<Record<keyof Form, string>> = {};
  if (!form.name.trim()) errors.name = t(`${NS}.err_name`, "Your name is required.");
  if (form.name.trim().length > 120) errors.name = t(`${NS}.err_long`, "Use at most 120 characters.");
  if (form.phone.trim().length > 32 || !/^[+0-9 ()-]*$/.test(form.phone.trim())) errors.phone = t(`${NS}.err_phone`, "Use digits, spaces and + ( ) - only.");
  for (const key of ["jobTitle", "dept", "location"] as const) if (form[key].trim().length > 120) errors[key] = t(`${NS}.err_long`, "Use at most 120 characters.");
  return errors;
}

export default function ProfileTab({ t, onDirty }: { t: Translate; onDirty: (dirty: boolean) => void }) {
  const id = useId();
  const toast = useToast();
  const submitKey = useSubmitKey();
  const { locale, setLocale, supportedLanguages } = useTranslation();
  const { state, reload } = useResource<Profile>("/api/v1/operations/profile", t(`${NS}.text_profile_failed`, "Your profile could not be loaded."));
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = state.status === "ready" ? state.data : null;
  const base: Form | null = profile ? { name: profile.name ?? "", phone: profile.phone ?? "", jobTitle: profile.jobTitle ?? "", dept: profile.dept ?? "", location: profile.location ?? "" } : null;
  const current = form ?? base;
  const dirty = Boolean(form && base && JSON.stringify(form) !== JSON.stringify(base));
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);

  if (state.status === "loading") return <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>;
  if (state.status === "error" || !current || !profile) return <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.status === "error" ? state.message : ""}</StateBox>;

  const set = (key: keyof Form, value: string) => setForm({ ...current, [key]: value });

  const save = async () => {
    const found = validate(t, current);
    setErrors(found);
    if (Object.keys(found).length > 0) { document.getElementById(`${id}-${Object.keys(found)[0]}`)?.focus(); return; }
    const body = { name: current.name.trim(), phone: current.phone.trim(), jobTitle: current.jobTitle.trim(), dept: current.dept.trim(), location: current.location.trim() };
    setBusy(true);
    setError(null);
    const result = await send<Profile>("/api/v1/operations/profile", { method: "PATCH", body, idempotencyKey: submitKey.key(JSON.stringify(body)), fallback: t(`${NS}.text_save_failed`, "Your profile could not be saved.") });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    submitKey.done();
    setForm(null);
    reload();
    window.dispatchEvent(new CustomEvent("nucleus:profile-updated", { detail: { name: result.data.name, photoUrl: result.data.photoUrl } }));
    toast(t(`${NS}.toast_saved_title`, "Settings saved"), t(`${NS}.toast_profile`, "Your profile was updated."), "success");
  };

  const field = (key: keyof Form, label: string, required = false, type = "text") => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-${key}`}>{label}{required ? <span className={styles.required} aria-hidden="true">*</span> : <span className={styles.optional}>{t(`${NS}.text_optional`, "(optional)")}</span>}</label>
      <input id={`${id}-${key}`} type={type} className={`${styles.input} ${errors[key] ? styles.inputInvalid : ""}`} value={current[key]} aria-required={required} aria-invalid={Boolean(errors[key])}
        onChange={(event) => set(key, event.target.value)} onBlur={() => setErrors(validate(t, current))} />
      {errors[key] && <span className={styles.fieldError}>{errors[key]}</span>}
    </div>
  );

  const initials = (current.name || profile.email || "").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon} aria-hidden="true"><User size={18} /></span>
        <div><h3 className={styles.cardTitle}>{t(`${NS}.text_profile_title`, "Personal profile")}</h3><p className={styles.cardSubtitle}>{t(`${NS}.text_profile_sub`, "Your details, designation and display language.")}</p></div>
      </div>
      <div className={styles.row}>
        {profile.photoUrl ? <NextImage unoptimized width={48} height={48} src={profile.photoUrl} alt={current.name} className={styles.avatar} /> : <span className={styles.avatar} aria-hidden="true">{initials}</span>}
        <div>
          <strong>{current.name || profile.email}</strong>
          <p className={styles.help}>{[profile.email, profile.dept].filter(Boolean).join(" · ")}</p>
          <div className={styles.chips}>{profile.roles.map((role) => <span key={role} className={`${styles.badge} ${styles.badgeInfo}`}>{role}</span>)}</div>
        </div>
        <button type="button" className={styles.btnSecondary} onClick={() => launchAction("photo")}>{t(`${NS}.text_change_photo`, "Change photo")}</button>
      </div>
      <form className={styles.formGrid} noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {field("name", t(`${NS}.text_full_name`, "Full name"), true)}
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-email`}>{t(`${NS}.text_email`, "Work email address")}</label>
          <input id={`${id}-email`} className={styles.input} value={profile.email ?? ""} disabled aria-describedby={`${id}-email-help`} />
          <span id={`${id}-email-help`} className={styles.help}>{t(`${NS}.help_email`, "Your sign-in email is changed by an administrator.")}</span>
        </div>
        {field("phone", t(`${NS}.text_phone`, "Phone number"), false, "tel")}
        {field("jobTitle", t(`${NS}.text_job_title`, "Job title / designation"))}
        {field("dept", t(`${NS}.text_department`, "Department"))}
        {field("location", t(`${NS}.text_location`, "Primary office location"))}
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-lang`}>{t(`${NS}.text_language`, "Preferred language")}</label>
          <select id={`${id}-lang`} className={styles.select} value={locale} onChange={(event) => setLocale(event.target.value)}>
            {supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
          </select>
          <span className={styles.help}>{t(`${NS}.help_language`, "Applies immediately on this device.")}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>{t(`${NS}.text_timezone`, "Time zone")}</span>
          <span className={styles.help}>{t(`${NS}.help_timezone`, "Dates use your organisation's time zone (Organisation tab).")}</span>
        </div>
        <div className={styles.footer} style={{ gridColumn: "1 / -1" }}>
          <span>{error && <Notice tone="error">{error}</Notice>}</span>
          <div className={styles.row}>
            <button type="button" className={styles.btnSecondary} disabled={!dirty || busy} onClick={() => { setForm(null); setErrors({}); }}>{t(`${NS}.text_discard`, "Discard")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={!dirty || busy}><Save size={15} aria-hidden="true" />{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_save`, "Save changes")}</button>
          </div>
        </div>
      </form>
    </section>
  );
}
