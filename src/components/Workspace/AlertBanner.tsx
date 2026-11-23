"use client";

import { useState } from "react";
import WarningIcon from "@mui/icons-material/ReportProblemOutlined";
import { useTranslation } from "@/context/I18nContext";
import { openAlert, useComplianceAlerts } from "./useComplianceAlerts";
import styles from "./AlertBanner.module.css";

/**
 * Critical compliance alert banner (visa, work permit, documents, date custom fields). Shows while the
 * caller has unacknowledged CRITICAL alerts; dismissing hides it for this browser session until the
 * set of critical alerts changes. Mount above the breadcrumb in AppWorkspace.
 */

const DISMISS_KEY = "nucleus.alertBanner.dismissed";

function readDismissed(): string | null {
  try { return window.sessionStorage.getItem(DISMISS_KEY); } catch { return null; }
}

export function AlertBanner() {
  const { t } = useTranslation() as { t: (key: string, fallback: string, params?: Record<string, unknown>) => string };
  const { state } = useComplianceAlerts("status=ACTIVE&severity=CRITICAL&pageSize=5");
  // Safe during SSR: the banner renders nothing until alerts have loaded on the client.
  const [dismissed, setDismissed] = useState<string | null>(() => (typeof window === "undefined" ? null : readDismissed()));

  if (state.status !== "ready" || state.data.total === 0) return null;
  const signature = state.data.items.map((item) => item.id).join(",") + `:${state.data.total}`;
  if (dismissed === signature) return null;
  const first = state.data.items[0];
  if (!first) return null;

  const dismiss = () => {
    try { window.sessionStorage.setItem(DISMISS_KEY, signature); } catch { /* Storage blocked: dismiss for this render only. */ }
    setDismissed(signature);
  };

  return (
    <div className={styles.banner} role="alert">
      <WarningIcon className={styles.icon} sx={{ fontSize: 22 }} aria-hidden="true" />
      <div className={styles.text}>
        <span className={styles.title}>
          {t("components.Workspace.AlertBanner.text_title", "Critical compliance alerts: {count}", { count: state.data.total })}
        </span>
        <span className={styles.body}>
          {first.daysRemaining < 0
            ? t("components.Workspace.AlertBanner.text_overdue", "{title} for {name} expired {days} day(s) ago.", { title: first.title, name: first.employeeName, days: -first.daysRemaining })
            : t("components.Workspace.AlertBanner.text_due", "{title} for {name}: {days} day(s) remaining.", { title: first.title, name: first.employeeName, days: first.daysRemaining })}
        </span>
      </div>
      <button type="button" className={styles.action} onClick={() => openAlert(first)}>
        {t("components.Workspace.AlertBanner.text_review", "Review")}
      </button>
      <button type="button" className={styles.dismiss} onClick={dismiss}>
        {t("components.Workspace.AlertBanner.text_dismiss", "Dismiss")}
      </button>
    </div>
  );
}

export default AlertBanner;
