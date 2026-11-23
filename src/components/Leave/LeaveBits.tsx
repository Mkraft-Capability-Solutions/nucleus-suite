"use client";

import type { ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import styles from "./Leave.module.css";
import { useLeaveT, type Resource } from "./leave-client";

const NS = "components.Leave.LeaveBits";

type Tone = "ok" | "flag" | "pending" | "info" | "neutral";

const STATUS: Record<string, [string, string, Tone]> = {
  pending_supervisor: ["status_pending_supervisor", "Pending supervisor", "pending"],
  pending_hod: ["status_pending_hod", "Pending HOD", "pending"],
  pending_hr: ["status_pending_hr", "Pending HR", "pending"],
  approved: ["status_approved", "Approved", "ok"],
  rejected: ["status_rejected", "Rejected", "flag"],
  cancelled: ["status_cancelled", "Cancelled", "neutral"],
  withdrawn: ["status_withdrawn", "Withdrawn", "neutral"],
  short_closed: ["status_short_closed", "Short-closed (early return)", "info"],
  draft: ["status_draft", "Draft", "neutral"],
};

/** Stored status of a leave request as a localized badge; an early return reads as short-closed. */
export function LeaveStatusBadge({ rawStatus, actualReturnDate }: { rawStatus: string; actualReturnDate?: string | null }) {
  const { t } = useLeaveT();
  const key = actualReturnDate ? "short_closed" : (rawStatus || "").trim().toLowerCase();
  const entry = STATUS[key];
  const label = entry ? t(`${NS}.${entry[0]}`, entry[1]) : key.replace(/_/g, " ");
  return <span className={`${styles.badge} ${styles[`tone_${entry?.[2] ?? "neutral"}`]}`}>{label}</span>;
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

/**
 * Renders a resource's loading and error states, and its empty state when
 * `isEmpty` says the data holds nothing; otherwise renders `children(data)`.
 */
export function ResourceView<T>({
  resource,
  onRetry,
  isEmpty,
  empty,
  children,
}: {
  resource: Resource<T>;
  onRetry?: () => void;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { t } = useLeaveT();
  if (resource.status === "loading") {
    return (
      <div className={styles.state} role="status" aria-live="polite">
        <Loader2 size={16} aria-hidden="true" /> {t(`${NS}.text_loading`, "Loading…")}
      </div>
    );
  }
  if (resource.status === "error") {
    return (
      <div className={`${styles.state} ${styles.stateError}`} role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        <span>{resource.message}</span>
        {onRetry && (
          <button type="button" className={`${styles.secondary} ${styles.small}`} onClick={onRetry}>
            <RefreshCw size={13} aria-hidden="true" /> {t(`${NS}.text_retry`, "Retry")}
          </button>
        )}
      </div>
    );
  }
  if (isEmpty && isEmpty(resource.data)) {
    return <div className={styles.state}>{empty ?? t(`${NS}.text_empty`, "Nothing recorded yet.")}</div>;
  }
  return <>{children(resource.data)}</>;
}

/** Server message for a failed write, shown inline (never a success toast for a failed save). */
export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className={`${styles.notice} ${styles.noticeError} ${styles.formAlert}`} role="alert">
      <AlertCircle size={16} aria-hidden="true" /> <span>{message}</span>
    </div>
  );
}
