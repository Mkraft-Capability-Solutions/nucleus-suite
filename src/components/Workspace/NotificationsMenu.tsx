"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Bell from "@mui/icons-material/NotificationsOutlined";
import { useTranslation } from "@/context/I18nContext";
import styles from "./NotificationsMenu.module.css";
import { acknowledgeAlert, openAlert, useComplianceAlerts } from "./useComplianceAlerts";
import type { ComplianceAlert } from "@/lib/compliance-alerts";

/**
 * Header notifications, read from GET /api/v1/notifications (the caller's own membership, tenant scoped).
 * The badge shows the real unread count; opening a notification marks it read through
 * POST /api/v1/notifications/{id}/read.
 * Compliance alerts (GET /api/v1/alerts, polled every 60 s) add an Alerts section and count toward the
 * badge; opening one deep-links to the employee profile, acknowledging updates the counts at once.
 */

type NotificationRow = { id: string; attributes: { title?: string; body?: string; read?: boolean }; created_at: string };
type Listing = { items: NotificationRow[]; unread: number };
type State = { status: "loading" } | { status: "ready"; listing: Listing } | { status: "error" };

export function NotificationsMenu({ buttonClassName }: { buttonClassName?: string }) {
  const { t, locale } = useTranslation() as { t: (key: string, fallback: string, params?: Record<string, unknown>) => string; locale?: string };
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "loading" });
  const wrap = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/v1/notifications", { signal, cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: Listing } | null;
      if (!response.ok || !payload?.data) throw new Error("unavailable");
      setState({ status: "ready", listing: payload.data });
    } catch {
      if (!signal?.aborted) setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const markRead = async (row: NotificationRow) => {
    if (row.attributes.read) return;
    const response = await fetch(`/api/v1/notifications/${encodeURIComponent(row.id)}/read`, { method: "POST" }).catch(() => null);
    if (response?.ok) void load();
  };

  const alerts = useComplianceAlerts();
  const alertItems: ComplianceAlert[] = alerts.state.status === "ready" ? alerts.state.data.items : [];
  const activeAlerts = alerts.state.status === "ready" ? alerts.state.data.counts.active : 0;
  const [busy, setBusy] = useState<string | null>(null);
  const acknowledge = async (alert: ComplianceAlert) => {
    setBusy(alert.id);
    await acknowledgeAlert(alert.id);
    setBusy(null);
  };
  const severityLabel = (alert: ComplianceAlert) => alert.severity === "CRITICAL"
    ? t("components.Workspace.NotificationsMenu.text_alert_critical", "Critical")
    : alert.severity === "WARNING"
      ? t("components.Workspace.NotificationsMenu.text_alert_warning", "Warning")
      : t("components.Workspace.NotificationsMenu.text_alert_info", "Info");

  const unread = (state.status === "ready" ? state.listing.unread : 0) + activeAlerts;
  const label = unread > 0
    ? t("components.Workspace.NotificationsMenu.text_label_unread", "Notifications, {count} unread", { count: unread })
    : t("components.Workspace.NotificationsMenu.text_label", "Notifications");
  const when = (iso: string) => new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  return (
    <div ref={wrap} className={styles.wrap}>
      <button type="button" className={buttonClassName} onClick={() => { setOpen((v) => !v); if (!open) void load(); }} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label}>
        <Bell sx={{ fontSize: 19 }} />
        {unread > 0 && <span className={styles.badge} aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label={t("components.Workspace.NotificationsMenu.text_label", "Notifications")}>
          {alertItems.length > 0 && (
            <>
              <div className={styles.heading}>{t("components.Workspace.NotificationsMenu.text_alerts", "Alerts ({count})", { count: activeAlerts })}</div>
              {alertItems.slice(0, 6).map((alert) => (
                <div key={alert.id} className={`${styles.alertRow} ${alert.severity === "CRITICAL" ? styles.critical : alert.severity === "WARNING" ? styles.warning : ""}`}>
                  <button type="button" role="menuitem" className={styles.item} onClick={() => { openAlert(alert); setOpen(false); }}>
                    <span className={styles.title}>{severityLabel(alert)} · {alert.title}</span>
                    <span className={styles.body}>
                      {alert.daysRemaining < 0
                        ? t("components.Workspace.NotificationsMenu.text_alert_overdue", "{name}: expired {days} day(s) ago", { name: alert.employeeName, days: -alert.daysRemaining })
                        : t("components.Workspace.NotificationsMenu.text_alert_due", "{name}: {days} day(s) remaining", { name: alert.employeeName, days: alert.daysRemaining })}
                    </span>
                  </button>
                  <button type="button" className={styles.ack} disabled={busy === alert.id} onClick={() => void acknowledge(alert)}>
                    {t("components.Workspace.NotificationsMenu.text_acknowledge", "Acknowledge")}
                  </button>
                </div>
              ))}
            </>
          )}
          <div className={styles.heading}>{t("components.Workspace.NotificationsMenu.text_label", "Notifications")}</div>
          {state.status === "loading" && <p className={styles.note}>{t("components.Workspace.NotificationsMenu.text_loading", "Loading notifications…")}</p>}
          {state.status === "error" && <p className={styles.note}>{t("components.Workspace.NotificationsMenu.text_error", "Notifications could not be loaded. Try again shortly.")}</p>}
          {state.status === "ready" && state.listing.items.length === 0 && <p className={styles.note}>{t("components.Workspace.NotificationsMenu.text_empty", "You are all caught up.")}</p>}
          {state.status === "ready" && state.listing.items.slice(0, 8).map((row) => (
            <button key={row.id} type="button" role="menuitem" className={`${styles.item} ${row.attributes.read ? "" : styles.unread}`} onClick={() => void markRead(row)}>
              <span className={styles.title}>{row.attributes.title}</span>
              {row.attributes.body && <span className={styles.body}>{row.attributes.body}</span>}
              <time className={styles.time} dateTime={row.created_at}>{when(row.created_at)}</time>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationsMenu;
