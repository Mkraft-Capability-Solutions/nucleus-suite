"use client";

import { useId, useState } from "react";
import styles from "@/components/Entitlements/Entitlements.module.css";

/**
 * Change the signed-in user's password (Better Auth /api/auth/change-password); other sessions are
 * signed out. Used after signing in with a one-time password from the platform administrator.
 */
export default function ChangePasswordForm() {
  const id = useId();
  const [state, setState] = useState({ busy: false, error: "", done: "" });

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");
    if (newPassword.length < 12) return setState({ busy: false, error: "Use at least 12 characters for the new password.", done: "" });
    if (newPassword !== confirm) return setState({ busy: false, error: "The new passwords do not match.", done: "" });
    setState({ busy: true, error: "", done: "" });
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      const message = body?.code === "INVALID_PASSWORD" ? "The current password is not correct." : (body?.message ?? "The password could not be changed.");
      return setState({ busy: false, error: message, done: "" });
    }
    form.reset();
    setState({ busy: false, error: "", done: "Password changed. Other devices have been signed out." });
  }

  const inputStyle = { width: "min(100%, 22rem)" };
  return (
    <form
      className={styles.config}
      style={{ paddingLeft: 14, borderTop: 0, borderRadius: 8, marginBottom: 16 }}
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <h4 id={`${id}-title`} style={{ margin: 0 }}>Change password</h4>
      {state.error && <div className={styles.alert} role="alert">{state.error}</div>}
      {state.done && <p className={styles.status} role="status">{state.done}</p>}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-current`}>Current password</label>
        <input id={`${id}-current`} name="currentPassword" type="password" autoComplete="current-password" required className={styles.input} style={inputStyle} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-new`}>New password</label>
        <span className={styles.fieldHint} id={`${id}-hint`}>At least 12 characters.</span>
        <input id={`${id}-new`} name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby={`${id}-hint`} className={styles.input} style={inputStyle} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-confirm`}>Confirm new password</label>
        <input id={`${id}-confirm`} name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={styles.input} style={inputStyle} />
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.buttonPrimary} disabled={state.busy}>{state.busy ? "Changing…" : "Change password"}</button>
      </div>
    </form>
  );
}
