/**
 * Pure helpers for the redesigned attendance module (unit-tested in attendance.test.ts):
 * durations, months, the calendar grid and the vocabulary for day and request states.
 */

import type { Tone } from "@/design/redesign/ui";

/** "8:23" for 503 minutes; an em dash rather than a misleading zero when there is nothing to show. */
export function hm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return "—";
  const total = Math.round(minutes);
  return `${Math.trunc(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** "42 h 10 m" for longer totals (team and month figures). */
export function hoursLabel(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "0 h";
  const hours = Math.trunc(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours.toLocaleString("en-IN")} h ${rest} m` : `${hours.toLocaleString("en-IN")} h`;
}

/** Local calendar date as YYYY-MM-DD (never shifted through UTC). */
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type Month = { year: number; month: number }; // month 1–12

export function monthOf(date: Date): Month {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function shiftMonth(value: Month, delta: number): Month {
  const index = value.year * 12 + (value.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthKey(value: Month): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}`;
}

export function monthRange(value: Month): { from: string; to: string } {
  const last = new Date(value.year, value.month, 0).getDate();
  const key = monthKey(value);
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
}

export function monthLabel(value: Month): string {
  return new Date(value.year, value.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** "Mon 3 Nov" style label for a YYYY-MM-DD date. */
export function dayLabel(date: string | null | undefined, withYear = false): string {
  if (!date) return "—";
  const value = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/**
 * The weeks of a month for a Monday-first calendar: every cell is a YYYY-MM-DD date or null
 * (padding before the 1st and after the last day). Always whole weeks.
 */
export function calendarWeeks(value: Month): Array<Array<string | null>> {
  const first = new Date(value.year, value.month - 1, 1);
  const days = new Date(value.year, value.month, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(`${monthKey(value)}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/* ------------------------------------------------------------------ */
/* Day states (attendance_days.status)                                 */
/* ------------------------------------------------------------------ */

export type DayKind = "present" | "half_day" | "absent" | "leave" | "holiday" | "weekly_off" | "pending" | "other";

const DAY_ALIASES: Record<string, DayKind> = {
  present: "present", locked: "present", computed: "present", on_duty: "present", work_from_home: "present",
  half_day: "half_day", halfday: "half_day",
  absent: "absent",
  leave: "leave", on_leave: "leave",
  holiday: "holiday",
  weekly_off: "weekly_off", week_off: "weekly_off", off: "weekly_off",
  pending: "pending",
};

export function dayKind(status: string | null | undefined): DayKind {
  const key = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return DAY_ALIASES[key] ?? "other";
}

export const DAY_META: Record<DayKind, { label: string; tone: Tone }> = {
  present: { label: "Present", tone: "success" },
  half_day: { label: "Half day", tone: "warning" },
  absent: { label: "Absent", tone: "danger" },
  leave: { label: "On leave", tone: "info" },
  holiday: { label: "Holiday", tone: "accent" },
  weekly_off: { label: "Weekly off", tone: "neutral" },
  pending: { label: "Pending review", tone: "warning" },
  other: { label: "Other", tone: "neutral" },
};

/** Counts of each day kind, for a month summary. */
export function countDays(statuses: ReadonlyArray<string | null | undefined>): Record<DayKind, number> {
  const counts: Record<DayKind, number> = { present: 0, half_day: 0, absent: 0, leave: 0, holiday: 0, weekly_off: 0, pending: 0, other: 0 };
  for (const status of statuses) counts[dayKind(status)] += 1;
  return counts;
}

/** Share of working days attended (a half day counts half); null when there were none. */
export function attendanceRate(counts: Pick<Record<DayKind, number>, "present" | "half_day" | "absent">): number | null {
  const working = counts.present + counts.half_day + counts.absent;
  if (working === 0) return null;
  return Math.round(((counts.present + counts.half_day * 0.5) / working) * 1000) / 10;
}

/* ------------------------------------------------------------------ */
/* Request states                                                      */
/* ------------------------------------------------------------------ */

export function requestTone(status: string | null | undefined): Tone {
  const value = (status ?? "").toLowerCase();
  if (value.startsWith("approve") || value === "resolved" || value === "credited" || value === "paid" || value === "tagged_to_run") return "success";
  if (value.startsWith("reject") || value === "declined") return "danger";
  if (value === "proposed" || value === "escalated") return "info";
  if (value === "submitted" || value.startsWith("pending") || value === "open" || value === "draft") return "warning";
  return "neutral";
}

export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  submitted: "Awaiting approval",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  credited: "Credited",
  draft: "Draft",
  open: "Open",
  proposed: "Correction proposed",
  resolved: "Resolved",
  tagged_to_run: "Tagged to pay run",
  paid: "Paid",
};

export const statusLabel = (status: string | null | undefined) => REQUEST_STATUS_LABEL[(status ?? "").toLowerCase()] ?? humanise(status);

/* ------------------------------------------------------------------ */
/* Gate-pass rules (mirrors gatePassEligibility in src/lib/hr-rules.ts) */
/* ------------------------------------------------------------------ */

/** Adds minutes to an "HH:MM" clock time; null when it would pass midnight. */
export function addMinutes(time: string, minutes: number): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.trunc(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
