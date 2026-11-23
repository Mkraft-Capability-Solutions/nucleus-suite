import type { useTranslation } from "@/context/I18nContext";

type T = ReturnType<typeof useTranslation>["t"];

export const NS = "orgChartView";

/** English source text for every orgChartView key (mirrored in src/locales/en/interface.json). */
export const LABELS = {
  title: "Organization Chart & Hierarchy",
  subtitle: "{employees} employees · {departments} departments · live reporting lines",
  search: "Search employee, title...",
  allDepartments: "All Departments ({count})",
  noDepartment: "No department recorded",
  noLocation: "No location recorded",
  noDesignation: "No designation recorded",
  expandAll: "Expand All",
  collapseAll: "Collapse All",
  expandTeam: "Expand team",
  collapseTeam: "Collapse team",
  treeView: "Hierarchy Tree",
  deptView: "By Department",
  totalRoster: "Total Roster",
  directReportOne: "1 direct report",
  directReports: "{count} direct reports",
  individualContributor: "Individual Contributor",
  dossier: "Dossier",
  viewDossier: "View Employee 360 Dossier",
  members: "{count} Members",
  noMatches: "No employees found matching filter criteria.",
  emptyRoster: "No active or probation employees are recorded for this tenant yet.",
  loading: "Loading the organization chart…",
  loadError: "The organization chart could not be loaded.",
  retry: "Retry",
} as const;

export type LabelKey = keyof typeof LABELS;

export function label(t: T, key: LabelKey, params?: Record<string, string | number>): string {
  return params ? t(`${NS}.${key}`, LABELS[key], params) : t(`${NS}.${key}`, LABELS[key]);
}
