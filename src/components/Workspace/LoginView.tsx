"use client";

import { useState, type FormEvent } from "react";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import PublicMotion from "../Website/PublicMotion";
import PublicHeader from "@/components/Website/PublicHeader";
import websiteStyles from "@/components/Website/Website.module.css";
import BrandLogo from "@/components/BrandLogo";
import { useTranslation } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/hooks/useT";
import styles from "./LoginView.module.css";

/** In-app sign-in (session via AuthContext.login → password login route). Labels from locales only. */
const NS = "components.Workspace.LoginView";

export default function LoginView() {
  const { t } = useT();
  const { t: legacyT } = useTranslation();
  // AuthContext is untyped JS; this is the signature of its login(email, password): Promise<boolean>.
  const { login } = useAuth() as unknown as { login: (email: string, password: string) => Promise<boolean> };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError("");
    const success = await login(email, password);
    if (!success) {
      // AuthContext.login returns only a boolean, so the server's reason is not available here.
      setError(t(`${NS}.loginError`, "Sign-in failed. Check your credentials and connection, then try again."));
      setIsLoading(false);
    }
  };

  return (
    <PublicMotion className={`${styles.loginWrapper} ${websiteStyles.site}`}>
      <PublicHeader />
      <main id="main-content" className={styles.loginLayout}>
        <section data-reveal="slide" className={styles.introduction} aria-labelledby="login-introduction-title">
          <span className={styles.eyebrow}>{legacyT("login", "eyebrow")}</span>
          <h1 id="login-introduction-title">{legacyT("login", "title")}</h1>
          <p>{legacyT("login", "description")}</p>
          <ul>{["pointOne", "pointTwo", "pointThree"].map((key) => <li key={key}><CheckCircleOutline fontSize="small" />{legacyT("login", key)}</li>)}</ul>
        </section>
        <section data-reveal="scale" className={styles.loginCard} aria-labelledby="login-form-title">
          <div className={styles.brand}>
            <BrandLogo size={64} className={styles.brandLogo} />
            <h2 id="login-form-title" className={styles.title}>{t(`${NS}.LoginView_text_3`, "Welcome back")}</h2>
            <div className={styles.subtitle}>{t(`${NS}.LoginView_text_4`, "Sign in to the Nucleus enterprise workspace")}</div>
          </div>
          {error && <div role="alert" className={styles.error}>{error}</div>}
          <form className={styles.inputGroup} onSubmit={handleLogin}>
            <input type="email" aria-label={t(`${NS}.LoginView_placeholder_5`, "Email address")} autoComplete="username" maxLength={254} disabled={isLoading} placeholder={t(`${NS}.LoginView_placeholder_5`, "Email address")} className={styles.inputField} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" aria-label={t(`${NS}.LoginView_placeholder_6`, "Password")} autoComplete="current-password" maxLength={128} disabled={isLoading} placeholder={t(`${NS}.LoginView_placeholder_6`, "Password")} className={styles.inputField} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" disabled={isLoading} aria-busy={isLoading} className={styles.loginBtn}>
              {isLoading ? t(`${NS}.display_1`, "Signing in…") : t(`${NS}.display_2`, "Sign in")}
            </button>
          </form>
        </section>
      </main>
    </PublicMotion>
  );
}
