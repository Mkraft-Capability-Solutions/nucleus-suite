"use client";

import { useId, useState, type ReactNode } from "react";
import { Laptop, Lock, Shield, ShieldCheck, Smartphone } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { formatDateTime, useResource, type Translate } from "../admin/adminApi";
import { Notice, StateBox, Switch, useToast } from "../admin/AdminParts";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.SettingsView";

type Session = { id: string; token?: string; userAgent?: string | null; ipAddress?: string | null; createdAt: string; updatedAt?: string; expiresAt: string };

async function authPost(path: string, body: unknown, fallback: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!response) return { ok: false, message: fallback };
  if (response.ok) return { ok: true, message: "" };
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, message: payload?.message || fallback };
}

/** Password via better-auth /api/auth/change-password; sessions via /api/auth/list-sessions and revoke-other-sessions. */
export default function SecurityTab({ t }: { t: Translate }) {
  const id = useId();
  const toast = useToast();
  const { locale } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const sessions = useSessions(t, sessionVersion);

  const changePassword = async () => {
    const found: Record<string, string> = {};
    if (!current) found.current = t(`${NS}.err_current`, "Enter your current password.");
    if (next.length < 12 || next.length > 128) found.next = t(`${NS}.err_password_len`, "Use 12 to 128 characters.");
    if (confirm !== next) found.confirm = t(`${NS}.err_password_match`, "The passwords do not match.");
    setErrors(found);
    if (Object.keys(found).length > 0 || busy) return;
    setBusy(true);
    const result = await authPost("change-password", { currentPassword: current, newPassword: next, revokeOtherSessions: true }, t(`${NS}.text_password_failed`, "The password could not be changed."));
    setBusy(false);
    if (!result.ok) { setMessage({ tone: "error", text: result.message }); return; }
    setCurrent(""); setNext(""); setConfirm("");
    setMessage({ tone: "ok", text: t(`${NS}.text_password_done`, "Password changed. Other sessions were signed out.") });
    setSessionVersion((value) => value + 1);
  };

  const revokeOthers = async () => {
    const result = await authPost("revoke-other-sessions", {}, t(`${NS}.text_revoke_failed`, "Other sessions could not be signed out."));
    if (!result.ok) { toast(t(`${NS}.toast_failed_title`, "Not saved"), result.message, "error"); return; }
    toast(t(`${NS}.toast_saved_title`, "Settings saved"), t(`${NS}.toast_revoked`, "All other sessions were signed out."), "success");
    setSessionVersion((value) => value + 1);
  };

  const unavailable = (icon: ReactNode, title: string, desc: string, reason: string) => (
    <div className={styles.toggleRow}>
      <div className={styles.toggleText}><h4 className={styles.toggleTitle}>{icon}{title}</h4><p className={styles.toggleDesc}>{desc}</p><p className={styles.help}>{reason}</p></div>
      <Switch checked={false} disabled onChange={() => undefined} label={title} title={reason} />
    </div>
  );

  const pwField = (key: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-${key}`}>{label}<span className={styles.required} aria-hidden="true">*</span></label>
      <input id={`${id}-${key}`} type="password" autoComplete={auto} className={`${styles.input} ${errors[key] ? styles.inputInvalid : ""}`} value={value} aria-required="true" aria-invalid={Boolean(errors[key])} onChange={(event) => set(event.target.value)} />
      {errors[key] && <span className={styles.fieldError}>{errors[key]}</span>}
    </div>
  );

  return (
    <>
      <section className={styles.card}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon} aria-hidden="true"><Shield size={18} /></span>
          <div><h3 className={styles.cardTitle}>{t(`${NS}.text_security_title`, "Security & authentication")}</h3><p className={styles.cardSubtitle}>{t(`${NS}.text_security_sub`, "Multi-factor authentication, encryption and session governance.")}</p></div>
        </div>
        <div className={styles.toggleList}>
          {unavailable(<Smartphone size={16} aria-hidden="true" />, t(`${NS}.text_2fa`, "Two-factor authentication (2FA)"), t(`${NS}.text_2fa_desc`, "Require an authenticator code at sign-in."), t(`${NS}.text_2fa_reason`, "Not available: two-factor authentication is not enabled on this platform's sign-in service."))}
          {unavailable(<ShieldCheck size={16} aria-hidden="true" />, t(`${NS}.text_vault`, "Document vault encryption"), t(`${NS}.text_vault_desc`, "Tenant-isolated encryption keys for identity documents and payslips."), t(`${NS}.text_vault_reason`, "Not configurable here: encryption keys are managed by the platform, not per tenant."))}
          {unavailable(<Lock size={16} aria-hidden="true" />, t(`${NS}.text_timeout`, "Automatic session lockout"), t(`${NS}.text_timeout_desc`, "Sign out idle sessions."), t(`${NS}.text_timeout_reason`, "Not configurable here: session lifetime is set in the platform configuration."))}
        </div>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{t(`${NS}.text_password_title`, "Update password")}</h3>
        <form className={styles.formGrid} noValidate onSubmit={(event) => { event.preventDefault(); void changePassword(); }}>
          {pwField("current", t(`${NS}.text_current_password`, "Current password"), current, setCurrent, "current-password")}
          {pwField("next", t(`${NS}.text_new_password`, "New password (12+ characters)"), next, setNext, "new-password")}
          {pwField("confirm", t(`${NS}.text_confirm_password`, "Confirm new password"), confirm, setConfirm, "new-password")}
          <div className={styles.footer} style={{ gridColumn: "1 / -1" }}>
            <span>{message && <Notice tone={message.tone}>{message.text}</Notice>}</span>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_update_password`, "Update password")}</button>
          </div>
        </form>
      </section>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}><Laptop size={18} aria-hidden="true" />{t(`${NS}.text_sessions_title`, "Active sessions")}</h3>
          <button type="button" className={styles.btnDanger} onClick={() => void revokeOthers()}>{t(`${NS}.text_revoke_others`, "Sign out all other sessions")}</button>
        </div>
        {sessions.state.status === "loading" && <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>}
        {sessions.state.status === "error" && <StateBox tone="error">{sessions.state.message}</StateBox>}
        {sessions.state.status === "ready" && sessions.state.data.length === 0 && <StateBox tone="empty">{t(`${NS}.text_no_sessions`, "No active sessions were returned.")}</StateBox>}
        {sessions.state.status === "ready" && sessions.state.data.length > 0 && (
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th scope="col">{t(`${NS}.col_device`, "Device / browser")}</th><th scope="col">{t(`${NS}.col_ip`, "IP address")}</th><th scope="col">{t(`${NS}.col_started`, "Signed in")}</th><th scope="col">{t(`${NS}.col_expires`, "Expires")}</th></tr></thead>
            <tbody>{sessions.state.data.map((session) => (
              <tr key={session.id}><td>{session.userAgent || "—"}</td><td className={styles.mono}>{session.ipAddress || "—"}</td><td>{formatDateTime(session.createdAt, locale)}</td><td>{formatDateTime(session.expiresAt, locale)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}

function useSessions(t: Translate, version: number) {
  // better-auth returns a bare array, not the /api/v1 envelope, so it is read directly.
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Session[] }>({ status: "loading" });
  const [loaded, setLoaded] = useState(-1);
  if (loaded !== version) {
    setLoaded(version);
    void fetch("/api/auth/list-sessions", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload)) throw new Error(t(`${NS}.text_sessions_failed`, "Sessions could not be loaded."));
        setState({ status: "ready", data: payload as Session[] });
      })
      .catch((error: unknown) => setState({ status: "error", message: error instanceof Error ? error.message : "" }));
  }
  return { state };
}
