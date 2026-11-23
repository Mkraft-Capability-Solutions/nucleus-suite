"use client";

import { useId, useState } from "react";
import { Copy, X } from "lucide-react";
import { daysAhead, send, useResource, useSubmitKey, type AccessCatalog, type Translate } from "../admin/adminApi";
import { Notice, StateBox, useToast } from "../admin/AdminParts";
import type { ApiKeyView } from "./types";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.IntegrationsView";

/** Issue an API key (POST /api/v1/integrations/api-keys). Validation mirrors createApiKeySchema. The secret is shown once. */
export default function ApiKeyDialog({ t, onClose, onIssued }: { t: Translate; onClose: () => void; onIssued: () => void }) {
  const id = useId();
  const toast = useToast();
  const submitKey = useSubmitKey();
  const catalog = useResource<AccessCatalog>("/api/v1/access/catalog", t(`${NS}.text_scopes_failed`, "Scopes could not be loaded."));
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [scopes, setScopes] = useState<string[]>([]);
  const [scopeQuery, setScopeQuery] = useState("");
  const [expiresOn, setExpiresOn] = useState(daysAhead(90));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 3 || name.trim().length > 80) next.name = t(`${NS}.err_key_name`, "Use 3 to 80 characters.");
    if (scopes.length === 0) next.scopes = t(`${NS}.err_scopes`, "Choose at least one scope.");
    if (expiresOn <= daysAhead(0) || expiresOn > daysAhead(366)) next.expiresOn = t(`${NS}.err_expiry`, "Choose a future date within one year.");
    setErrors(next);
    if (Object.keys(next).length > 0 || busy) return;
    const body = { name: name.trim(), environment, scopes: [...scopes].sort(), expiresOn };
    setBusy(true);
    const result = await send<{ key: ApiKeyView; secret: string }>("/api/v1/integrations/api-keys", {
      method: "POST", body, idempotencyKey: submitKey.key(JSON.stringify(body)), fallback: t(`${NS}.text_issue_failed`, "The key could not be issued."),
    });
    setBusy(false);
    if (!result.ok) {
      const field = result.error.details[0]?.field;
      setErrors(field && ["name", "scopes", "expiresOn"].includes(field) ? { [field]: result.error.message } : { form: result.error.message });
      return;
    }
    submitKey.done();
    setSecret(result.data.secret);
    onIssued();
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast(t(`${NS}.toast_copied_title`, "Copied"), t(`${NS}.toast_copied`, "The key is on your clipboard. Store it in a secret manager."), "success");
    } catch {
      toast(t(`${NS}.toast_copy_failed_title`, "Copy failed"), t(`${NS}.toast_copy_failed`, "Select the key and copy it manually."), "error");
    }
  };

  const options = catalog.state.status === "ready"
    ? catalog.state.data.permissions.filter((entry) => !scopeQuery || entry.key.includes(scopeQuery.trim().toLowerCase())).slice(0, 60)
    : [];

  return (
    <div className={styles.overlay} role="presentation" onClick={() => !busy && onClose()}>
      <div className={`${styles.dialog} ${styles.dialogSmall}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.cardHeader}>
          <h3 id={`${id}-title`} className={styles.cardTitle}>{t(`${NS}.text_issue_title`, "Generate API key")}</h3>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} /></button>
        </div>
        {secret ? (
          <>
            <Notice tone="info">{t(`${NS}.text_secret_once`, "Copy this key now. It is stored only as a hash and cannot be shown again.")}</Notice>
            <code className={styles.secret}>{secret}</code>
            <div className={styles.footer}>
              <button type="button" className={styles.btnSecondary} onClick={() => void copy()}><Copy size={14} aria-hidden="true" />{t(`${NS}.text_copy_key`, "Copy key")}</button>
              <button type="button" className={styles.btnPrimary} onClick={onClose}>{t(`${NS}.text_done`, "Done")}</button>
            </div>
          </>
        ) : (
          <form className={styles.toggleList} noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-name`}>{t(`${NS}.text_key_name`, "Key name")}<span className={styles.required} aria-hidden="true">*</span></label>
              <input id={`${id}-name`} className={`${styles.input} ${errors.name ? styles.inputInvalid : ""}`} value={name} maxLength={80} aria-required="true" aria-invalid={Boolean(errors.name)} onChange={(event) => setName(event.target.value)} />
              {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-env`}>{t(`${NS}.text_environment`, "Environment")}<span className={styles.required} aria-hidden="true">*</span></label>
              <select id={`${id}-env`} className={styles.select} value={environment} onChange={(event) => setEnvironment(event.target.value === "production" ? "production" : "sandbox")}>
                <option value="sandbox">{t(`${NS}.env_sandbox`, "Sandbox")}</option>
                <option value="production">{t(`${NS}.env_production`, "Production")}</option>
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.label} id={`${id}-scopes`}>{t(`${NS}.text_scopes`, "Scopes")}<span className={styles.required} aria-hidden="true">*</span></span>
              {scopes.length > 0 && <div className={styles.chips}>{scopes.map((scope) => (
                <button key={scope} type="button" className={`${styles.chip} ${styles.chipActive}`} onClick={() => setScopes(scopes.filter((item) => item !== scope))} aria-label={t(`${NS}.text_remove_scope`, "Remove {scope}", { scope })}><span className={styles.mono}>{scope}</span> ×</button>
              ))}</div>}
              <input className={styles.input} value={scopeQuery} onChange={(event) => setScopeQuery(event.target.value)} placeholder={t(`${NS}.text_scope_search`, "Search permissions")} aria-labelledby={`${id}-scopes`} />
              {catalog.state.status === "loading" && <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>}
              {catalog.state.status === "error" && <StateBox tone="error">{catalog.state.message}</StateBox>}
              <div className={styles.chips}>{options.filter((entry) => !scopes.includes(entry.key)).map((entry) => (
                <button key={entry.key} type="button" className={styles.chip} onClick={() => setScopes([...scopes, entry.key])}><span className={styles.mono}>{entry.key}</span></button>
              ))}</div>
              <span className={errors.scopes ? styles.fieldError : styles.help}>{errors.scopes ?? t(`${NS}.help_scopes`, "You can only issue scopes you hold yourself.")}</span>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-exp`}>{t(`${NS}.text_expiry`, "Expiry date")}<span className={styles.required} aria-hidden="true">*</span></label>
              <input id={`${id}-exp`} type="date" className={`${styles.input} ${errors.expiresOn ? styles.inputInvalid : ""}`} min={daysAhead(1)} max={daysAhead(366)} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
              {errors.expiresOn && <span className={styles.fieldError}>{errors.expiresOn}</span>}
            </div>
            {errors.form && <Notice tone="error">{errors.form}</Notice>}
            <div className={styles.footer}>
              <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
              <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.text_issuing`, "Issuing…") : t(`${NS}.text_issue`, "Generate key")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
