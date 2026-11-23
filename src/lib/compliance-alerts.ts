/**
 * Compliance alerts (stored, acknowledgeable): visa, work permit, document and date custom-field expiry.
 * Shared by the engine (src/server/alerts/engine.ts), the API (src/app/api/v1/alerts/**) and the UI
 * (src/components/Workspace/AlertBanner.tsx, NotificationsMenu.tsx). Pure, no server imports.
 */

export const ALERT_CATEGORIES = ["VISA_EXPIRY", "WORK_PERMIT_EXPIRY", "EXPAT_COMPLIANCE", "CUSTOM_DATE_ALERT", "DOCUMENT_EXPIRY"] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];
export const ALERT_SEVERITIES = ["CRITICAL", "WARNING", "INFO"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export const ALERT_STATUSES = ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const DEFAULT_THRESHOLDS: readonly number[] = [90, 60, 30, 7, 0];

/** One alert as the API returns it (GET /api/v1/alerts → data.items[]). */
export type ComplianceAlert = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  companyId: string | null;
  rootGroupId: string | null;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  triggerDate: string;
  daysRemaining: number;
  status: AlertStatus;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
};

export type AlertListResponse = {
  items: ComplianceAlert[];
  page: number;
  pageSize: number;
  total: number;
  /** Unacknowledged (ACTIVE) counts in the caller's scope, regardless of filters. */
  counts: { active: number; critical: number; warning: number; info: number };
};

/** Detail of the `nucleus:navigate_tab` window event the UI sends when an alert is opened. */
export type AlertNavigateDetail = { tab: "people_core"; sub: string; section: "visa" | "documents" | "custom_fields" };

export function navigationFor(alert: Pick<ComplianceAlert, "employeeId" | "category">): AlertNavigateDetail {
  const section = alert.category === "DOCUMENT_EXPIRY" ? "documents" : alert.category === "CUSTOM_DATE_ALERT" ? "custom_fields" : "visa";
  return { tab: "people_core", sub: alert.employeeId, section };
}

/** Normalise thresholds: integers 0..730, distinct, descending; empty falls back to the defaults. */
export function normaliseThresholds(values: readonly number[] | null | undefined): number[] {
  const clean = [...new Set((values ?? []).filter((v) => Number.isInteger(v) && v >= 0 && v <= 730))].sort((a, b) => b - a);
  return clean.length ? clean : [...DEFAULT_THRESHOLDS];
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `today` to `date` (both YYYY-MM-DD); null when either is not a real date. */
export function daysBetween(today: string, date: string): number | null {
  const a = ISO_DATE.test(today) ? Date.parse(`${today}T00:00:00Z`) : NaN;
  const b = ISO_DATE.test(date.slice(0, 10)) ? Date.parse(`${date.slice(0, 10)}T00:00:00Z`) : NaN;
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
}

/**
 * Severity for a date `days` away under the thresholds, or null when it is out of range (further than
 * the largest threshold). With the defaults 90/60/30/7/0: ≤7 days or past = CRITICAL, ≤30 = WARNING,
 * ≤90 = INFO. In general: at or below the second-smallest threshold = CRITICAL, at or below the
 * median threshold = WARNING, otherwise INFO.
 */
export function severityFor(days: number, thresholds: readonly number[]): AlertSeverity | null {
  const ascending = normaliseThresholds(thresholds).slice().sort((a, b) => a - b);
  const max = ascending[ascending.length - 1]!;
  if (days > max) return null;
  if (days <= 0) return "CRITICAL";
  const critical = ascending[Math.min(1, ascending.length - 1)]!;
  const warning = ascending[Math.floor(ascending.length / 2)]!;
  if (days <= critical) return "CRITICAL";
  if (days <= warning) return "WARNING";
  return "INFO";
}

/** The stable key one alert is upserted by: the date is not part of it, so a moved date updates or resolves the same row. */
export function dedupKey(category: AlertCategory, employeeId: string, sourceRef: string): string {
  return `${category}:${employeeId}:${sourceRef}`;
}

export type AlertCandidate = {
  employeeId: string;
  companyId: string | null;
  rootGroupId: string | null;
  category: AlertCategory;
  sourceRef: string;
  title: string;
  triggerDate: string;
};

export type EvaluatedAlert = AlertCandidate & { severity: AlertSeverity; daysRemaining: number; dedupKey: string };

/** Keep the candidates that are in range under their category's rule, with severity and dedup key. */
export function evaluateCandidates(
  candidates: readonly AlertCandidate[],
  rules: Partial<Record<AlertCategory, { enabled: boolean; thresholds: readonly number[] }>>,
  today: string,
): EvaluatedAlert[] {
  const seen = new Map<string, EvaluatedAlert>();
  for (const candidate of candidates) {
    const rule = rules[candidate.category] ?? { enabled: true, thresholds: DEFAULT_THRESHOLDS };
    if (!rule.enabled) continue;
    const days = daysBetween(today, candidate.triggerDate);
    if (days === null) continue;
    const severity = severityFor(days, rule.thresholds);
    if (!severity) continue;
    const key = dedupKey(candidate.category, candidate.employeeId, candidate.sourceRef);
    const prior = seen.get(key);
    // Two sources for the same key (e.g. column and metadata): keep the nearer date.
    if (prior && prior.daysRemaining <= days) continue;
    seen.set(key, { ...candidate, triggerDate: candidate.triggerDate.slice(0, 10), severity, daysRemaining: days, dedupKey: key });
  }
  return [...seen.values()];
}
