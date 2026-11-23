"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import styles from "../RecruitmentView.module.css";
import type { Translate } from "../workspaceHttp";
import type { Loadable } from "./types";
import { NS } from "./useRecruitmentData";

/** Renders a source's loading and error states; the children render only real data. */
export function SourceState<T>({ t, source, onRetry, children }: { t: Translate; source: Loadable<T>; onRetry: () => void; children: (data: T) => ReactNode }) {
  if (source.status === "loading") return <p className={styles.muted} role="status">{t(`${NS}.text_loading`, "Loading…")}</p>;
  if (source.status === "error") {
    return (
      <div className={styles.errorNote} role="alert">
        <span>{source.message}</span>
        <button type="button" className={styles.btnSecondary} onClick={onRetry}><RefreshCw size={14} aria-hidden="true" />{t(`${NS}.text_retry`, "Retry")}</button>
      </div>
    );
  }
  return <>{children(source.data)}</>;
}

/** Formats an amount held in minor units. Without a known currency the figure is shown as a plain number. */
export function formatMinor(minor: number, currency: string | null, locale: string | undefined): string {
  const major = minor / 100;
  if (currency) return new Intl.NumberFormat(locale || undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(major);
  return new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: 0 }).format(major);
}

export function formatDate(iso: string | null, locale: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium" }).format(date);
}
