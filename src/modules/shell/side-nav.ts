import { BarChart3, Briefcase, FolderOpen, House, Settings2, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";

/** The areas of the redesigned side menu (navigation domains), and which sit on the rail. */

export type Area = { id: string; label: string; icon: LucideIcon };

export const AREAS: Area[] = [
  { id: "dashboard", label: "Home", icon: House },
  { id: "core_hr", label: "Core HR", icon: Users },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "talent", label: "Talent", icon: UserPlus },
  { id: "payroll_finance", label: "Payroll", icon: Wallet },
  { id: "workforce_ops", label: "Workforce", icon: Briefcase },
  { id: "analytics_ai", label: "Analytics", icon: BarChart3 },
  { id: "platform", label: "Admin", icon: Settings2 },
];

/** Areas on the rail by default; the rest are under More. */
export const DEFAULT_RAIL = ["dashboard", "core_hr", "documents", "talent", "payroll_finance", "workforce_ops"];

/** Areas that open one screen of their own rather than a list of screens (no side panel). */
export const SINGLE_SCREEN_AREAS = new Set(["dashboard", "documents"]);
export const MAX_RAIL = 6;

/** Aliases the workspace uses for the same area. */
export function areaFor(domain: string | null | undefined): string {
  switch (domain) {
    case "people": case "compliance": case "helpdesk": return "core_hr";
    case "payroll": return "payroll_finance";
    case "analytics": return "analytics_ai";
    case "settings": return "platform";
    default: return domain || "dashboard";
  }
}

/**
 * The rail: the member's saved areas (or the defaults) that they may open, in order, up to the
 * limit; everything else they may open goes under More.
 */
export function railAreas(saved: readonly string[] | null | undefined, allowed: readonly Area[]): { rail: Area[]; more: Area[] } {
  const byId = new Map(allowed.map((area) => [area.id, area]));
  const rail = [...new Set(saved ?? DEFAULT_RAIL)].map((id) => byId.get(id)).filter((area): area is Area => Boolean(area)).slice(0, MAX_RAIL);
  const onRail = new Set(rail.map((area) => area.id));
  return { rail, more: allowed.filter((area) => !onRail.has(area.id)) };
}

/* ------------------------------------------------------------------ */
/* The screens panel: groups, labels, what is open, recent screens     */
/* ------------------------------------------------------------------ */

export type PanelItem = { id: string; label: string; targetTab?: string };
export type PanelGroup = { heading: string; items: PanelItem[] };

const MINOR_WORDS = new Set(["And", "Or", "Of", "The", "To", "For", "In", "On", "With", "By", "A", "An"]);

/** Reads catalogue labels evenly: "Assignment And Policy Attributes" → "Assignment and Policy Attributes"; a lower-case first letter is capitalised. */
export function displayLabel(label: string): string {
  const words = label.trim().split(/\s+/).map((word, index) => (index > 0 && MINOR_WORDS.has(word) ? word.toLowerCase() : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Groups with the same heading are merged and a screen listed twice in an area is shown once. */
export function mergeGroups(groups: readonly PanelGroup[]): PanelGroup[] {
  const seen = new Set<string>();
  const byHeading = new Map<string, PanelGroup>();
  for (const group of groups) {
    const key = group.heading.trim().toLowerCase();
    const target = byHeading.get(key) ?? { heading: group.heading, items: [] };
    for (const item of group.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      target.items.push(item);
    }
    byHeading.set(key, target);
  }
  return [...byHeading.values()].filter((group) => group.items.length > 0);
}

/** Which group opens by default: the one holding the open screen, otherwise the first. */
export function defaultOpenGroup(groups: readonly PanelGroup[], activeItem: string | null | undefined): number {
  const index = groups.findIndex((group) => group.items.some((item) => item.id === activeItem));
  return index >= 0 ? index : 0;
}

export const RECENT_KEY = "nucleus_recent_screens";
export const MAX_RECENT = 3;

/** Adds a screen to the front of an area's recent list (most recent first, no repeats). */
export function pushRecent(recent: Record<string, string[]>, area: string, id: string): Record<string, string[]> {
  return { ...recent, [area]: [id, ...(recent[area] ?? []).filter((value) => value !== id)].slice(0, MAX_RECENT) };
}
