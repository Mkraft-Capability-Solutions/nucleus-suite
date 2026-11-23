/** Pure helpers for the redesigned onboarding & exit module (unit-tested in lifecycle.test.ts). */

import type { Tone } from "@/design/redesign/ui";

export const OWNER_LABEL: Record<string, string> = {
  hr: "HR", it: "IT", payroll: "Payroll", manager: "Manager", finance: "Finance", facilities: "Facilities", admin: "Admin",
};

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type JoinerLike = { status: string; total: number; done: number; tasks: Array<{ required: boolean; status: string }> };

/** Where a joiner stands: ready once every required step is done (or the onboarding is marked completed). */
export function joinerState(joiner: JoinerLike): { key: "ready" | "in_progress" | "not_started" | "no_steps"; label: string; tone: Tone } {
  if (joiner.status.toLowerCase() === "completed") return { key: "ready", label: "Completed", tone: "success" };
  if (joiner.total === 0) return { key: "no_steps", label: "No checklist", tone: "neutral" };
  if (joiner.tasks.filter((task) => task.required).every((task) => task.status === "done")) return { key: "ready", label: "Ready for day one", tone: "success" };
  if (joiner.done === 0) return { key: "not_started", label: "Not started", tone: "warning" };
  return { key: "in_progress", label: "In progress", tone: "info" };
}

export function progress(joiner: { total: number; done: number }): number {
  return joiner.total > 0 ? Math.round((joiner.done / joiner.total) * 100) : 0;
}

/** An exit case's standing, from its clearance items and its own status. */
export function exitState(args: { settledCase: boolean; items: number; settled: number; blockingOpen: number }): { label: string; tone: Tone; canSettle: boolean } {
  if (args.settledCase) return { label: "Settled", tone: "success", canSettle: false };
  if (args.items > 0 && args.settled === args.items) return { label: "Ready to settle", tone: "info", canSettle: true };
  if (args.blockingOpen > 0) return { label: "Clearance pending", tone: "warning", canSettle: false };
  return { label: "Clearance in progress", tone: "warning", canSettle: false };
}

/** Days from today to a date (negative when it has passed); null when there is no date. */
export function daysUntil(date: string | null | undefined, today = new Date().toISOString().slice(0, 10)): number | null {
  if (!date) return null;
  const target = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;
  return Math.round((target - now) / 86_400_000);
}

/** A template task key from its title ("Laptop and access card" → "laptop-and-access-card"). */
export function taskKey(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "step";
}
