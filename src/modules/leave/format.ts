/**
 * Pure helpers for the redesigned leave module (unit-tested in leave.test.ts).
 */

import type { Tone } from "@/design/redesign/ui";

export const LEAVE_NAMES: Record<string, string> = {
  EL: "Earned leave", CL: "Casual leave", SL: "Sick leave", COFF: "Compensatory off", BIRTHDAY: "Birthday leave", BL: "Bereavement leave",
};

export const leaveName = (code: string | null | undefined, stored?: string | null) => stored || LEAVE_NAMES[(code ?? "").toUpperCase()] || code || "Leave";

/** The engine key the classic span calculator (services/leaveEngine.js) uses for an API leave code. */
export const ENGINE_KEY: Record<string, string> = { EL: "PRIVILEGE", CL: "CASUAL", SL: "SICK", COFF: "COMP_OFF" };

/** Monthly limits the API enforces (validateLeaveRequest in src/lib/hr-rules.ts). */
export const MONTHLY_LIMIT: Record<string, number> = { CL: 2, EL: 10 };

export type Stage = "pending_supervisor" | "pending_hod" | "pending_hr";

export function requestState(raw: string | null | undefined, endsOn?: string | null, today = new Date().toISOString().slice(0, 10)): { label: string; tone: Tone } {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "pending_supervisor") return { label: "With manager", tone: "warning" };
  if (value === "pending_hod") return { label: "With head of department", tone: "warning" };
  if (value === "pending_hr") return { label: "With HR", tone: "warning" };
  if (value.startsWith("pending")) return { label: "Awaiting approval", tone: "warning" };
  if (value === "approved") return endsOn && endsOn.slice(0, 10) < today ? { label: "Taken", tone: "neutral" } : { label: "Approved", tone: "success" };
  if (value === "rejected") return { label: "Rejected", tone: "danger" };
  if (value === "cancelled" || value === "canceled" || value === "withdrawn") return { label: "Cancelled", tone: "neutral" };
  return { label: value ? value.replace(/_/g, " ") : "—", tone: "neutral" };
}

export const isPending = (raw: string | null | undefined) => (raw ?? "").toLowerCase().startsWith("pending");

/** "1 day", "2.5 days". */
export function daysLabel(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "—";
  const rounded = Math.round(days * 100) / 100;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

/** "3 Nov – 7 Nov 2026" (or a single day). */
export function rangeLabel(from: string | null | undefined, to: string | null | undefined): string {
  if (!from) return "—";
  const start = new Date(`${from.slice(0, 10)}T00:00:00`);
  const end = to ? new Date(`${to.slice(0, 10)}T00:00:00`) : start;
  if (Number.isNaN(start.getTime())) return from;
  const sameYear = start.getFullYear() === end.getFullYear();
  const first = start.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const last = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return from.slice(0, 10) === (to ?? from).slice(0, 10) ? last : `${first} – ${last}`;
}

/** Whether a leave period overlaps [from, to] (all YYYY-MM-DD). */
export function overlaps(startsOn: string | null | undefined, endsOn: string | null | undefined, from: string, to: string): boolean {
  if (!startsOn) return false;
  const end = (endsOn ?? startsOn).slice(0, 10);
  return startsOn.slice(0, 10) <= to && end >= from;
}

/** Whole calendar days from `from` to `to`, inclusive; null when the range is not valid. */
export function inclusiveDays(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Whether today falls inside an approved leave (so the person can come back early). */
export function canReturnEarly(raw: string, startsOn: string | null, endsOn: string | null, today = new Date().toISOString().slice(0, 10)): boolean {
  return raw.toLowerCase() === "approved" && Boolean(startsOn && endsOn) && startsOn!.slice(0, 10) <= today && endsOn!.slice(0, 10) > today;
}
