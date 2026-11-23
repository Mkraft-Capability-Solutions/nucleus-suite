"use client";

import type { ReactNode } from "react";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { useTranslation } from "@/context/I18nContext";
import type { Section, UnavailableReason } from "@/lib/analytics/workforce-insights-types";
import styles from "../AnalyticsView.module.css";

export const NS = "components.Workspace.AnalyticsView";

export type Tone = "signal" | "ok" | "pending" | "info" | "flag";
type T = ReturnType<typeof useTranslation>["t"];

const REASONS: Record<UnavailableReason, [string, string]> = {
  forbidden: ["reason_forbidden", "Your role does not have access to this data."],
  no_roster: ["reason_no_roster", "No active employees are recorded for this scope."],
  no_gender_recorded: ["reason_no_gender", "No employee profile in this scope records a gender."],
  no_dated_exits: ["reason_no_dated_exits", "No offboarding case records a last working day, so attrition cannot be measured."],
  no_attrition_scores: ["reason_no_attrition_scores", "No attrition risk scores have been computed for these employees yet."],
  no_attendance: ["reason_no_attendance", "No attendance days are recorded for this period and scope."],
  no_payroll_run: ["reason_no_payroll_run", "No payroll run exists for this period yet."],
  no_payroll_lines: ["reason_no_payroll_lines", "The latest payroll run has no calculated lines for this scope. Calculate the run first."],
  no_prior_run: ["reason_no_prior_run", "There is no earlier calculated run of the same scope to compare with."],
  no_applications: ["reason_no_applications", "No applications or approved requisitions are recorded for this period and scope."],
  no_capability_runs: ["reason_no_capability_runs", "No capability index has been computed for employees in this scope yet."],
  no_metric_definitions: ["reason_no_metric_definitions", "No metric definitions have been published for this tenant yet."],
  no_leave_data: ["reason_no_leave_data", "No leave balances or approved leave are recorded for this scope."],
};

export function reasonText(t: T, reason: UnavailableReason): string {
  const [key, fallback] = REASONS[reason];
  return t(`${NS}.${key}`, fallback);
}

export function sectionReason(t: T, section: Section<unknown>): string | null {
  return section.available ? null : reasonText(t, section.reason);
}

export function useFormat() {
  const { locale } = useTranslation();
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  const pct = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value / 100);
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, notation: Math.abs(minor) >= 1e9 ? "compact" : "standard", maximumFractionDigits: 0 }).format(minor / 100);
  const time = (iso: Date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(iso);
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  return { number, pct, money, time, date };
}

/** KPI tile. `value` null renders the reason instead of a number. */
export function StatCard({ icon, tone, label, value, reason }: { icon: ReactNode; tone: Tone; label: string; value: string | null; reason?: string | null }) {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[`tone-${tone}`]}`} aria-hidden="true">{icon}</div>
      <div>
        {value === null
          ? <div className={styles.statUnavailable}>{reason}</div>
          : <div className={styles.statValue}>{value}</div>}
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

export function Notice({ children, error = false, action }: { children: ReactNode; error?: boolean; action?: ReactNode }) {
  return (
    <div className={`${styles.notice} ${error ? styles.noticeError : ""}`} role={error ? "alert" : "status"}>
      <InfoOutlined sx={{ fontSize: 18 }} aria-hidden="true" />
      <div style={{ flex: 1 }}>{children}</div>
      {action}
    </div>
  );
}

export function Bar({ label, valueText, percent, fill }: { label: string; valueText: string; percent: number; fill: "signal" | "info" | "ok" | "pending" }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className={styles.barHead}>
        <span>{label}</span>
        <strong>{valueText}</strong>
      </div>
      <div className={styles.barTrack} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
        <div className={`${styles.barFill} ${styles[`fill-${fill}`]}`} style={{ inlineSize: `${width}%` }} />
      </div>
    </div>
  );
}

export function CardHeader({ icon, title, badge }: { icon: ReactNode; title: string; badge?: ReactNode }) {
  return (
    <div className={styles.cardHeader}>
      <h3>{icon} {title}</h3>
      {badge}
    </div>
  );
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[`tone-${tone}`]}`}>{children}</span>;
}
