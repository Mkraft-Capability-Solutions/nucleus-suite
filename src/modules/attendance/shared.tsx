"use client";

import type { ReactNode } from "react";
import { useHRMS } from "@/context/HRMSContext";
import { Badge, cx, ui } from "@/design/redesign/ui";
import { requestTone, statusLabel } from "./format";
import styles from "./Attendance.module.css";

/** A row of figures with dividers (not cards): label, value and an optional note. */
export function StatStrip({ items, label }: { items: Array<{ label: string; value: ReactNode; note?: ReactNode; tone?: "danger" | "warning" | "success" }>; label: string }) {
  return (
    <dl className={styles.stats} aria-label={label}>
      {items.map((item) => (
        <div key={item.label} className={styles.stat}>
          <dt className={styles.statLabel}>{item.label}</dt>
          <dd className={cx(styles.statValue, item.tone && styles[`text-${item.tone}`])}>{item.value}</dd>
          {item.note !== undefined && <dd className={styles.statNote}>{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Single-choice filter as pills (keyboard: each is a toggle button). */
export function FilterPills<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: NoInfer<T>) => void; options: Array<{ value: NoInfer<T>; label: string; count?: number }>; label: string }) {
  return (
    <div className={ui.pills} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className={ui.pill} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}{option.count !== undefined && <span className={styles.pillCount}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <Badge tone={requestTone(status)}>{statusLabel(status)}</Badge>;
}

export function PersonCell({ name, code }: { name: string | null | undefined; code: string | null | undefined }) {
  return (
    <span className={styles.person}>
      <span className={styles.personName}>{name || code || "—"}</span>
      {code && name && <span className={styles.personCode}>{code}</span>}
    </span>
  );
}

/** The workspace toast (shared with every classic screen). */
export function useNotify() {
  const { showToast } = (useHRMS() ?? {}) as { showToast?: (title: string, message: string, type?: string) => void };
  return {
    success: (title: string, message: string) => showToast?.(title, message, "success"),
    error: (title: string, message: string) => showToast?.(title, message, "error"),
  };
}

/** A two-line cell: main text and a quieter line below. */
export function Stacked({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <span className={styles.stacked}>
      <span>{main}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </span>
  );
}
