"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import type { Translate } from "./adminApi";
import styles from "./Admin.module.css";

/** Small building blocks shared by the admin screens. */

export function useT(): Translate {
  const { t } = useTranslation();
  return t as Translate;
}

export type Toast = (title: string, message: string, tone: "success" | "error" | "info" | "warning") => void;

export function useToast(): Toast {
  const { showToast } = useHRMS() as { showToast?: Toast };
  return (title, message, tone) => showToast?.(title, message, tone);
}

export function StateBox({ tone, children, onRetry, retryLabel }: {
  tone: "loading" | "empty" | "error";
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const Icon = tone === "loading" ? Loader2 : tone === "error" ? AlertCircle : Inbox;
  return (
    <div className={`${styles.state} ${tone === "error" ? styles.stateError : ""}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <Icon size={18} aria-hidden="true" className={tone === "loading" ? styles.spin : undefined} />
      <span>{children}</span>
      {onRetry && retryLabel && <button type="button" className={styles.btnSecondary} onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, title }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Notice({ tone, children }: { tone: "ok" | "error" | "info"; children: ReactNode }) {
  const cls = tone === "ok" ? styles.noticeOk : tone === "error" ? styles.noticeError : styles.noticeInfo;
  return <p className={`${styles.notice} ${cls}`} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}
