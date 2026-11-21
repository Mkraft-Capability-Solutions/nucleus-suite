/**
 * Career history inside a group of companies: shared by the server (dossier print, API) and the
 * dossier's Career history tab. Pure functions only: no database, no React.
 *
 * Entries come from employee_job_history (db/migrations/0031). Each entry is the position an
 * employee held from its effective date until the next entry's date (or today, or the exit date).
 * A correction supersedes an earlier entry; superseded entries are left out of the career.
 */

export const MOVEMENT_TYPES = [
  "joined", "promotion", "demotion", "transfer", "group_transfer", "redesignation",
  "secondment", "reporting_change", "updated",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Moves HR can record from the dossier ("joined" comes from creating the record, "updated" from edits). */
export const RECORDABLE_MOVES = [
  "promotion", "transfer", "group_transfer", "redesignation", "secondment", "reporting_change", "demotion",
] as const satisfies readonly MovementType[];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  joined: "Joined",
  promotion: "Promotion",
  demotion: "Demotion",
  transfer: "Transfer",
  group_transfer: "Move to a group company",
  redesignation: "Change of designation",
  secondment: "Secondment",
  reporting_change: "Change of manager",
  updated: "Record updated",
};

export const COMPANY_KINDS = ["holding", "company", "subsidiary", "division", "branch"] as const;
export type CompanyKind = (typeof COMPANY_KINDS)[number];
export const COMPANY_KIND_LABELS: Record<CompanyKind, string> = {
  holding: "Holding company",
  company: "Company",
  subsidiary: "Subsidiary",
  division: "Division",
  branch: "Branch",
};

export type CareerEntry = {
  id: string;
  movementType: MovementType;
  effectiveFrom: string; // YYYY-MM-DD
  companyId: string | null;
  companyName: string | null;
  location: string | null;
  department: string | null;
  designation: string | null;
  grade: string | null;
  category: string | null;
  managerId: string | null;
  managerName: string | null;
  reason: string | null;
  source: string;
  supersedesId: string | null;
  recordedAt: string;
  recordedBy: string | null;
};

export type Company = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  kind: CompanyKind;
  industry: string | null;
  status: string;
};

export type CareerStint = CareerEntry & {
  /** Day before the next entry starts; null while it is the current position. */
  endsOn: string | null;
  months: number;
  current: boolean;
  /** Root → company, using the group structure as it is today. */
  companyPath: string[];
  /** What changed from the previous position ("Designation: Executive → Plant supervisor"). */
  changes: string[];
  /** True when this entry replaced an earlier, corrected entry. */
  corrected: boolean;
};

export type CareerTreeNode = {
  id: string;
  label: string;
  kind: "group" | "company" | "role";
  detail?: string;
  from?: string;
  to?: string | null;
  months?: number;
  current?: boolean;
  movementType?: MovementType;
  children: CareerTreeNode[];
};

export type CareerView = {
  stints: CareerStint[];
  tree: CareerTreeNode;
  totals: { months: number; companies: number; positions: number; promotions: number; moves: number };
  exitedOn: string | null;
};

const DAY = 86_400_000;

function toTime(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

function shiftDay(date: string, days: number): string {
  return new Date(toTime(date) + days * DAY).toISOString().slice(0, 10);
}

/** Months between two dates, to one decimal (30.44 days a month). */
export function monthsBetween(from: string, to: string): number {
  const days = Math.max(0, (toTime(to) - toTime(from)) / DAY);
  return Math.round((days / 30.4375) * 10) / 10;
}

/** 38 → "3 yrs 2 mos"; 0.4 → "Less than a month". */
export function durationLabel(months: number): string {
  const whole = Math.floor(months + 0.05);
  if (whole < 1) return "Less than a month";
  const years = Math.floor(whole / 12);
  const rest = whole % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? "yr" : "yrs"}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? "mo" : "mos"}`);
  return parts.join(" ");
}

/** Entries that have not been replaced by a correction, oldest first. */
export function activeEntries(entries: CareerEntry[]): CareerEntry[] {
  const superseded = new Set(entries.map((entry) => entry.supersedesId).filter(Boolean));
  return entries
    .filter((entry) => !superseded.has(entry.id))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.recordedAt.localeCompare(b.recordedAt));
}

/** Root → company names for a company, following parent links (cycle-safe). */
export function companyPath(companyId: string | null, companies: Map<string, Company>): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let cursor = companyId ? companies.get(companyId) : undefined;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor.name);
    cursor = cursor.parentId ? companies.get(cursor.parentId) : undefined;
  }
  return path;
}

const COMPARED: Array<[keyof CareerEntry, string]> = [
  ["companyName", "Company"],
  ["designation", "Designation"],
  ["grade", "Grade"],
  ["department", "Department"],
  ["location", "Location"],
  ["managerName", "Manager"],
  ["category", "Category"],
];

export function describeChanges(previous: CareerEntry | undefined, next: CareerEntry): string[] {
  if (!previous) return [];
  const changes: string[] = [];
  for (const [key, label] of COMPARED) {
    const before = (previous[key] as string | null) ?? null;
    const after = (next[key] as string | null) ?? null;
    if ((before ?? "") !== (after ?? "")) changes.push(`${label}: ${before ?? "not recorded"} → ${after ?? "not recorded"}`);
  }
  return changes;
}

/**
 * Builds the career: stints with end dates and durations, a group → company → position tree, and
 * totals. `exitedOn` (last working day) closes the final stint; otherwise it runs to `today`.
 */
export function buildCareer(
  rawEntries: CareerEntry[],
  companyList: Company[],
  options: { today: string; exitedOn?: string | null; groupName: string },
): CareerView {
  const companies = new Map(companyList.map((company) => [company.id, company]));
  const correctedIds = new Set(rawEntries.map((entry) => entry.supersedesId).filter((id): id is string => Boolean(id)));
  const entries = activeEntries(rawEntries).filter((entry) => !options.exitedOn || entry.effectiveFrom <= options.exitedOn);
  const closing = options.exitedOn ?? options.today;

  const stints: CareerStint[] = entries.map((entry, index) => {
    const next = entries[index + 1];
    const endsOn = next ? shiftDay(next.effectiveFrom, -1) : options.exitedOn ?? null;
    const until = next ? next.effectiveFrom : closing;
    return {
      ...entry,
      endsOn: endsOn && endsOn < entry.effectiveFrom ? entry.effectiveFrom : endsOn,
      months: monthsBetween(entry.effectiveFrom, until),
      current: !next && !options.exitedOn,
      companyPath: entry.companyId ? companyPath(entry.companyId, companies) : entry.companyName ? [entry.companyName] : [],
      changes: describeChanges(entries[index - 1], entry),
      corrected: entry.supersedesId !== null && correctedIds.has(entry.supersedesId),
    };
  });

  const root: CareerTreeNode = { id: "group", label: options.groupName || "Group", kind: "group", children: [] };
  const nodeFor = (path: string[], ids: Array<string | null>): CareerTreeNode => {
    let parent = root;
    path.forEach((name, depth) => {
      const id = `company:${ids[depth] ?? name}`;
      let child = parent.children.find((node) => node.id === id);
      if (!child) {
        child = { id, label: name, kind: "company", children: [] };
        const company = ids[depth] ? companies.get(ids[depth]!) : undefined;
        if (company) child.detail = [COMPANY_KIND_LABELS[company.kind], company.industry].filter(Boolean).join(" · ");
        parent.children.push(child);
      }
      parent = child;
    });
    return parent;
  };
  const idsPath = (companyId: string | null): Array<string | null> => {
    const ids: Array<string | null> = [];
    const seen = new Set<string>();
    let cursor = companyId ? companies.get(companyId) : undefined;
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      ids.unshift(cursor.id);
      cursor = cursor.parentId ? companies.get(cursor.parentId) : undefined;
    }
    return ids;
  };

  for (const stint of stints) {
    const path = stint.companyPath.length ? stint.companyPath : ["Company not recorded"];
    const ids = stint.companyId ? idsPath(stint.companyId) : [null];
    const companyNode = nodeFor(path, ids);
    companyNode.children.push({
      id: `role:${stint.id}`,
      label: stint.designation ?? "Designation not recorded",
      kind: "role",
      detail: [stint.department, stint.location].filter(Boolean).join(" · ") || undefined,
      from: stint.effectiveFrom,
      to: stint.endsOn,
      months: stint.months,
      current: stint.current,
      movementType: stint.movementType,
      children: [],
    });
  }
  const sumMonths = (node: CareerTreeNode): number =>
    node.kind === "role" ? node.months ?? 0 : node.children.reduce((sum, child) => sum + sumMonths(child), 0);
  const annotate = (node: CareerTreeNode) => {
    if (node.kind !== "role") node.months = Math.round(sumMonths(node) * 10) / 10;
    node.children.forEach(annotate);
  };
  annotate(root);

  const companiesWorked = new Set(stints.map((stint) => stint.companyId ?? stint.companyName ?? "unknown"));
  const positions = new Set(stints.map((stint) => `${stint.companyId ?? stint.companyName}|${stint.designation}|${stint.department}|${stint.location}`));
  return {
    stints,
    tree: root,
    totals: {
      months: stints.length ? monthsBetween(stints[0]!.effectiveFrom, closing) : 0,
      companies: stints.length ? companiesWorked.size : 0,
      positions: positions.size,
      promotions: stints.filter((stint) => stint.movementType === "promotion").length,
      moves: Math.max(0, stints.length - 1),
    },
    exitedOn: options.exitedOn ?? null,
  };
}
