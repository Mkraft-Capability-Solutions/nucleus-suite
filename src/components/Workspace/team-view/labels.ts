import type { useTranslation } from "@/context/I18nContext";

type T = ReturnType<typeof useTranslation>["t"];

export const NS = "teamView";

/** English source text for every teamView key (mirrored in src/locales/en/interface.json). */
export const LABELS = {
  title: "My Team & Pod Directory",
  subtitle: "Connect with colleagues across departments, see their role, location and reporting details.",
  managerCockpit: "Manager Cockpit",
  managerCockpitTitle: "Open Manager Cockpit Dashboard",
  invite: "Invite Teammate",
  total: "Total Teammates",
  totalHint: "{shown} of {total} in your permitted directory",
  active: "Active in Shift",
  busy: "In Meetings / Focus",
  away: "Away / Remote Shift",
  presenceUnavailable: "Presence is not tracked, so live availability cannot be shown.",
  unavailable: "Unavailable",
  search: "Search teammate by name, role, or skill...",
  allPods: "All Departments",
  noDepartment: "No department recorded",
  noRole: "No designation recorded",
  noLocation: "No location recorded",
  noShift: "No shift recorded",
  noEmail: "No work email recorded",
  dm: "DM",
  dmTitle: "Direct messaging is not available in this workspace yet.",
  email: "Email",
  emailTitle: "Send Email",
  oneOnOne: "1-on-1",
  oneOnOneTitle: "Schedule 1-on-1 Sync",
  loading: "Loading your team directory…",
  loadError: "The team directory could not be loaded.",
  retry: "Retry",
  empty: "No employees are visible in your directory yet.",
  noMatches: "No teammates match this search.",
} as const;

export type LabelKey = keyof typeof LABELS;

export function label(t: T, key: LabelKey, params?: Record<string, string | number>): string {
  return params ? t(`${NS}.${key}`, LABELS[key], params) : t(`${NS}.${key}`, LABELS[key]);
}
