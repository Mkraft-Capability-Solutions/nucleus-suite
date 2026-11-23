"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./Platform.module.css";

/** Shown at /platform to a signed-in user who is not a platform operator. */
export default function NotPlatformOperator({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  async function switchAccount() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    try {
      localStorage.removeItem("nucleus_user");
    } catch {
      // Storage unavailable: nothing cached to clear.
    }
    window.location.assign("/login?callbackUrl=%2Fplatform");
  }
  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="not-operator-title" style={{ maxWidth: "36rem" }}>
        <h1 id="not-operator-title" className={styles.title}>Platform console</h1>
        <p>
          You are signed in as <strong>{email}</strong>, which is not a platform operator account. The console is
          only for accounts listed in <code className={styles.code}>PLATFORM_ADMIN_EMAILS</code>.
        </p>
        <div className={styles.statusForm}>
          <button type="button" className={styles.buttonPrimary} onClick={switchAccount} disabled={busy}>
            {busy ? "Signing out…" : "Sign in as a platform operator"}
          </button>
          <Link className={styles.buttonSecondary} href="/workspace">Back to workspace</Link>
        </div>
      </section>
    </div>
  );
}
