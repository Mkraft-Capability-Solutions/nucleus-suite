"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, Terminal, Webhook } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { formatDate, send, useResource, type Translate } from "../admin/adminApi";
import { Notice, StateBox, useToast } from "../admin/AdminParts";
import type { ApiKeyView, IntegrationsOverview } from "./types";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.IntegrationsView";

export default function ApiTab({ t, overview, keysVersion }: { t: Translate; overview: IntegrationsOverview; keysVersion: number }) {
  const { locale } = useTranslation();
  const toast = useToast();
  const keys = useResource<{ items: ApiKeyView[] }>(`/api/v1/integrations/api-keys?v=${keysVersion}`, t(`${NS}.text_keys_failed`, "API keys could not be loaded."));
  const [error, setError] = useState<string | null>(null);
  const bus = overview.eventBus;
  const failed = bus.failed + bus.dead;

  const revoke = async (key: ApiKeyView) => {
    const reason = window.prompt(t(`${NS}.text_revoke_reason`, "Why is {name} being revoked?", { name: key.name }));
    if (reason === null) return;
    if (reason.trim().length < 3) { setError(t(`${NS}.err_reason`, "Give a reason of at least 3 characters.")); return; }
    const result = await send<ApiKeyView>(`/api/v1/integrations/api-keys/${key.id}/revoke`, { method: "POST", body: { reason: reason.trim() }, fallback: t(`${NS}.text_revoke_failed`, "The key could not be revoked.") });
    if (!result.ok) { setError(result.error.message); return; }
    setError(null);
    toast(t(`${NS}.toast_revoked_title`, "Key revoked"), t(`${NS}.toast_revoked`, "{name} can no longer be used.", { name: key.name }), "success");
    keys.reload();
  };

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}><Terminal size={18} aria-hidden="true" />{t(`${NS}.text_events_title`, "Event outbox & webhook subscriptions")}</h3>
          <span className={`${styles.badge} ${failed > 0 ? styles.badgeFlag : styles.badgeOk}`}>
            {t(`${NS}.text_bus`, "{pending} pending · {published} published · {failed} failed", { pending: bus.pending + bus.leased, published: bus.published, failed })}
          </span>
        </div>
        {overview.webhooks.length === 0 ? <StateBox tone="empty">{t(`${NS}.text_no_webhooks`, "No webhook endpoints are registered.")}</StateBox> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th scope="col"><Webhook size={12} aria-hidden="true" /> {t(`${NS}.col_host`, "Endpoint host")}</th><th scope="col">{t(`${NS}.col_events`, "Events")}</th><th scope="col">{t(`${NS}.col_status`, "Status")}</th><th scope="col">{t(`${NS}.col_created`, "Created")}</th></tr></thead>
              <tbody>{overview.webhooks.map((hook) => (
                <tr key={hook.id}><td className={styles.mono}>{hook.host ?? "—"}</td><td className={styles.mono}>{hook.events.join(", ") || "—"}</td><td>{hook.status ?? "—"}</td><td>{formatDate(hook.createdAt, locale)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className={styles.help}>{t(`${NS}.text_docs_hint`, "Request and event schemas are in the API reference.")} <Link href="/api-docs">{t(`${NS}.text_api_reference`, "Open API reference")}</Link></p>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}><KeyRound size={18} aria-hidden="true" />{t(`${NS}.text_keys_title`, "API keys")}</h3>
        {error && <Notice tone="error">{error}</Notice>}
        {keys.state.status === "loading" && <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>}
        {keys.state.status === "error" && <StateBox tone="error" onRetry={keys.reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{keys.state.message}</StateBox>}
        {keys.state.status === "ready" && keys.state.data.items.length === 0 && <StateBox tone="empty">{t(`${NS}.text_no_keys`, "No API keys have been issued.")}</StateBox>}
        {keys.state.status === "ready" && keys.state.data.items.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th scope="col">{t(`${NS}.col_name`, "Name")}</th><th scope="col">{t(`${NS}.col_prefix`, "Prefix")}</th><th scope="col">{t(`${NS}.col_env`, "Environment")}</th><th scope="col">{t(`${NS}.col_scopes`, "Scopes")}</th><th scope="col">{t(`${NS}.col_expires`, "Expires")}</th><th scope="col">{t(`${NS}.col_status`, "Status")}</th><th scope="col"><span className={styles.muted}>{t(`${NS}.col_actions`, "Actions")}</span></th></tr></thead>
              <tbody>{keys.state.data.items.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td><td className={styles.mono}>{key.prefix}…</td><td>{t(`${NS}.env_${key.environment}`, key.environment)}</td>
                  <td title={key.scopes.join(", ")}>{key.scopes.length}</td><td>{formatDate(key.expiresOn, locale)}</td>
                  <td><span className={`${styles.badge} ${key.status === "active" ? styles.badgeOk : styles.badgeFlag}`}>{t(`${NS}.key_${key.status}`, key.status)}</span></td>
                  <td>{key.status === "active" && <button type="button" className={styles.btnDanger} onClick={() => void revoke(key)}>{t(`${NS}.text_revoke`, "Revoke")}</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className={styles.help}>{t(`${NS}.text_keys_note`, "Only a hash of each key is stored. The full key is shown once, when it is generated.")}</p>
      </section>
    </>
  );
}
