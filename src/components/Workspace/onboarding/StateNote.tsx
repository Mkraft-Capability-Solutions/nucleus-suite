"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import styles from "../OnboardingView.module.css";

/** Loading, empty and error rows shared by every onboarding tab. */
export default function StateNote({ tone, children, onRetry, retryLabel }: {
  tone: "loading" | "empty" | "error";
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const Icon = tone === "loading" ? Loader2 : tone === "error" ? AlertCircle : Inbox;
  return (
    <div className={`${styles.stateNote} ${tone === "error" ? styles.stateError : ""}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <Icon size={18} aria-hidden="true" className={tone === "loading" ? styles.spin : undefined} />
      <span>{children}</span>
      {onRetry && retryLabel && (
        <button type="button" className={styles.btnSecondary} onClick={onRetry}>{retryLabel}</button>
      )}
    </div>
  );
}
