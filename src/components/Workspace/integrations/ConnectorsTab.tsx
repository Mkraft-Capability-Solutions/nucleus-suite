"use client";

import { useState } from "react";
import { Activity, FlaskConical, Puzzle, RefreshCw, Settings2 } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import { formatDateTime, send, useResource, useSubmitKey, type Translate } from "../admin/adminApi";
import { Notice, StateBox, useToast } from "../admin/AdminParts";
import type { ConnectionView, JobView } from "./types";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.IntegrationsView";

export function jobLabel(t: Translate, job: JobView | null, locale: string | undefined): string {
  if (!job) return t(`${NS}.text_never`, "Never requested");
  const status = t(`${NS}.job_${job.status}`, job.status);
  return `${status} · ${formatDateTime(job.publishedAt ?? job.requestedAt, locale)}`;
}

function ActivityLog({ t, id }: { t: Translate; id: string }) {
  const { locale } = useTranslation();
  const { state, reload } = useResource<{ jobs: Array<JobView & { eventType: string }>; audit: Array<{ id: string; action: string; reason: string | null; created_at: string }> }>(
    `/api/v1/integrations/connections/${id}/activity`, t(`${NS}.text_activity_failed`, "The activity log could not be loaded."));
  if (state.status === "loading") return <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>;
  if (state.status === "error") return <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>;
  if (state.data.jobs.length === 0 && state.data.audit.length === 0) return <StateBox tone="empty">{t(`${NS}.text_no_activity`, "No activity recorded yet.")}</StateBox>;
  return (
    <ul className={styles.toggleList}>
      {state.data.jobs.map((job) => (
        <li key={job.id} className={styles.help}><span className={styles.mono}>{job.eventType}</span> · {t(`${NS}.job_${job.status}`, job.status)} · {t(`${NS}.text_attempts`, "{count} attempts", { count: job.attempts })} · {formatDateTime(job.requestedAt, locale)}</li>
      ))}
      {state.data.audit.map((row) => (
        <li key={row.id} className={styles.help}><span className={styles.mono}>{row.action}</span> · {row.reason ?? "—"} · {formatDateTime(row.created_at, locale)}</li>
      ))}
    </ul>
  );
}

function ConnectorCard({ t, connection, onChanged }: { t: Translate; connection: ConnectionView; onChanged: () => void }) {
  const { locale } = useTranslation();
  const toast = useToast();
  const syncKey = useSubmitKey();
  const testKey = useSubmitKey();
  const [busy, setBusy] = useState<"sync" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const name = connection.name ?? connection.code ?? t(`${NS}.text_unnamed`, "Unnamed connector");

  const run = async (kind: "sync" | "test") => {
    const keys = kind === "sync" ? syncKey : testKey;
    setBusy(kind);
    setError(null);
    const result = await send<JobView>(`/api/v1/integrations/connections/${connection.id}/${kind}`, {
      method: "POST", body: {}, idempotencyKey: keys.key(connection.id), fallback: t(`${NS}.text_job_failed`, "The request could not be queued."),
    });
    setBusy(null);
    if (!result.ok) { setError(result.error.message); return; }
    keys.done();
    toast(t(`${NS}.toast_queued_title`, "Request queued"), kind === "sync"
      ? t(`${NS}.toast_sync`, "A sync of {name} is queued. Its status updates when the job runs.", { name })
      : t(`${NS}.toast_test`, "A connection test for {name} is queued.", { name }), "info");
    onChanged();
  };

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.kpiLabel}>{connection.category ?? t(`${NS}.text_uncategorised`, "Connector")}</span>
          <h3 className={styles.cardTitle}>{name}</h3>
        </div>
        <span className={`${styles.badge} ${connection.status === "connected" ? styles.badgeOk : styles.badgeWarn}`}>{connection.status ? t(`${NS}.status_${connection.status}`, connection.status) : t(`${NS}.status_unknown`, "Unknown")}</span>
      </div>
      <dl className={styles.toggleList}>
        <div className={styles.help}><dt>{t(`${NS}.text_environment`, "Environment")}</dt><dd>{connection.environment ?? "—"}</dd></div>
        <div className={styles.help}><dt>{t(`${NS}.text_last_sync`, "Last sync")}</dt><dd>{jobLabel(t, connection.lastSync, locale)}</dd></div>
        <div className={styles.help}><dt>{t(`${NS}.text_last_test`, "Last test")}</dt><dd>{jobLabel(t, connection.lastTest, locale)}</dd></div>
        <div className={styles.help}><dt>{t(`${NS}.text_last_error`, "Last error")}</dt><dd>{connection.lastError ? jobLabel(t, connection.lastError, locale) : t(`${NS}.text_no_errors`, "No failures")}</dd></div>
      </dl>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.row}>
        <button type="button" className={styles.btnSecondary} onClick={() => launchAction("connector", { provider: name })}><Settings2 size={14} aria-hidden="true" />{t(`${NS}.text_configure`, "Configure")}</button>
        <button type="button" className={styles.btnSecondary} disabled={busy !== null} onClick={() => void run("test")}><FlaskConical size={14} aria-hidden="true" />{busy === "test" ? t(`${NS}.text_queuing`, "Queuing…") : t(`${NS}.text_test`, "Test")}</button>
        <button type="button" className={styles.btnPrimary} disabled={busy !== null} onClick={() => void run("sync")}><RefreshCw size={14} aria-hidden="true" />{busy === "sync" ? t(`${NS}.text_queuing`, "Queuing…") : t(`${NS}.text_sync`, "Sync now")}</button>
        <button type="button" className={styles.btnGhost} aria-expanded={open} onClick={() => setOpen((value) => !value)}><Activity size={14} aria-hidden="true" />{t(`${NS}.text_activity`, "Error log & activity")}</button>
      </div>
      {open && <ActivityLog t={t} id={connection.id} />}
    </article>
  );
}

export default function ConnectorsTab({ t, connections, onChanged }: { t: Translate; connections: ConnectionView[]; onChanged: () => void }) {
  if (connections.length === 0) {
    return (
      <section className={styles.card}>
        <StateBox tone="empty">{t(`${NS}.text_no_connectors`, "No connectors are configured for this organisation yet.")}</StateBox>
        <div><button type="button" className={styles.btnPrimary} onClick={() => launchAction("connector", {})}><Puzzle size={14} aria-hidden="true" />{t(`${NS}.text_add_connector`, "Configure a connector")}</button></div>
      </section>
    );
  }
  return <div className={styles.kpiGrid}>{connections.map((connection) => <ConnectorCard key={connection.id} t={t} connection={connection} onChanged={onChanged} />)}</div>;
}
