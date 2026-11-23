"use client";

import { useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { send, useResource, useSubmitKey, type Translate } from "../admin/adminApi";
import { Notice, StateBox, Switch, useToast } from "../admin/AdminParts";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.SettingsView";

type Prefs = { stored: boolean; channels: { inapp: boolean; email: boolean; sms: boolean }; mutedEvents: string[] };

/** Own notification preferences: GET/POST /api/v1/notifications/preferences. The UI changes only after the server saves. */
export default function NotificationsTab({ t }: { t: Translate }) {
  const toast = useToast();
  const submitKey = useSubmitKey();
  const { state, reload } = useResource<Prefs>("/api/v1/notifications/preferences", t(`${NS}.text_prefs_failed`, "Notification preferences could not be loaded."));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === "loading") return <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>;
  if (state.status === "error") return <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>;
  const prefs = state.data;

  const update = async (channel: "email" | "inapp", value: boolean) => {
    const body = { channels: { ...prefs.channels, [channel]: value }, mutedEvents: prefs.mutedEvents };
    setBusy(true);
    setError(null);
    const result = await send<{ id: string }>("/api/v1/notifications/preferences", { method: "POST", body, idempotencyKey: submitKey.key(JSON.stringify(body)), fallback: t(`${NS}.text_prefs_save_failed`, "The preference could not be saved.") });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    submitKey.done();
    reload();
    toast(t(`${NS}.toast_saved_title`, "Settings saved"), t(`${NS}.toast_prefs`, "Notification preference updated."), "success");
  };

  const row = (title: string, desc: string, control: ReactNode, note?: string) => (
    <div className={styles.toggleRow}>
      <div className={styles.toggleText}><h4 className={styles.toggleTitle}>{title}</h4><p className={styles.toggleDesc}>{desc}</p>{note && <p className={styles.help}>{note}</p>}</div>
      {control}
    </div>
  );

  const emailTitle = t(`${NS}.text_email_notif`, "Email notifications");
  const pushTitle = t(`${NS}.text_inapp_notif`, "In-app and browser notifications");
  const anomalyTitle = t(`${NS}.text_anomaly`, "AI anomaly nudges");
  const chatTitle = t(`${NS}.text_chat_alerts`, "Slack & MS Teams alerts");
  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon} aria-hidden="true"><Bell size={18} /></span>
        <div><h3 className={styles.cardTitle}>{t(`${NS}.text_notif_title`, "Notification preferences")}</h3><p className={styles.cardSubtitle}>{t(`${NS}.text_notif_sub`, "Choose the channels that receive your workflow updates.")}</p></div>
      </div>
      {!prefs.stored && <Notice tone="info">{t(`${NS}.text_prefs_default`, "You have not saved preferences yet; the defaults below apply.")}</Notice>}
      <div className={styles.toggleList}>
        {row(emailTitle, t(`${NS}.text_email_desc`, "Leave approvals, payroll completion and other workflow updates by email."), <Switch checked={prefs.channels.email} disabled={busy} label={emailTitle} onChange={(next) => void update("email", next)} />)}
        {row(pushTitle, t(`${NS}.text_inapp_desc`, "Notifications in the bell menu while you work."), <Switch checked={prefs.channels.inapp} disabled={busy} label={pushTitle} onChange={(next) => void update("inapp", next)} />)}
        {row(anomalyTitle, t(`${NS}.text_anomaly_desc`, "Proactive alerts when payroll or compliance checks find anomalies."), <Switch checked={false} disabled label={anomalyTitle} onChange={() => undefined} />, t(`${NS}.text_anomaly_reason`, "Not available: no anomaly alert events are published yet."))}
        {row(chatTitle, t(`${NS}.text_chat_desc`, "Send approval and security cards to a team channel."), <Switch checked={false} disabled label={chatTitle} onChange={() => undefined} />, t(`${NS}.text_chat_reason`, "Configure a webhook endpoint under Integrations to deliver events to a chat tool."))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
