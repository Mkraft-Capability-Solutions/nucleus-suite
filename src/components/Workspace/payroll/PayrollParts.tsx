"use client";

import type { ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import type { Resource, Translate } from "./payroll-client";
import styles from "../PayrollView.module.css";

export const NS = "components.Workspace.PayrollView";

export function usePayrollT(): { t: Translate; locale: string } {
  const { t, locale } = useTranslation();
  return { t: t as Translate, locale };
}

/** Loading / error / empty states for one data region; renders children only with data. */
export function DataState<T>({ resource, isEmpty, emptyText, onRetry, children }: {
  resource: Resource<T>;
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  const { t } = usePayrollT();
  if (resource.status === "loading") {
    return (
      <div className={styles.stateBox} role="status" aria-live="polite">
        <Loader2 size={16} aria-hidden="true" />
        {t(`${NS}.text_loading`, "Loading…")}
      </div>
    );
  }
  if (resource.status === "error") {
    return (
      <div className={`${styles.stateBox} ${styles.stateError}`} role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        <span>{resource.message}</span>
        {onRetry && (
          <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={onRetry}>
            <RefreshCcw size={13} aria-hidden="true" />
            {t(`${NS}.text_retry`, "Retry")}
          </button>
        )}
      </div>
    );
  }
  if (isEmpty && isEmpty(resource.data)) {
    return <div className={styles.stateBox} role="note">{emptyText ?? t(`${NS}.text_no_records`, "No records yet.")}</div>;
  }
  return <>{children(resource.data)}</>;
}

/** An inline "not available" value with its reason as the accessible description. */
export function Unavailable({ reason }: { reason: string }) {
  const { t } = usePayrollT();
  return (
    <span className={styles.micro} title={reason}>
      {t(`${NS}.text_not_available`, "Not available")}
      <span className={styles.srOnly}>{` — ${reason}`}</span>
    </span>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "error" | "info"; children: ReactNode }) {
  const toneClass = tone === "ok" ? styles.noticeOk : tone === "error" ? styles.noticeError : "";
  return (
    <div className={`${styles.notice} ${toneClass}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
