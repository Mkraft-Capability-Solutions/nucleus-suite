import type {
  AnalyticsPeriod,
  ChannelRow,
  PayrollInsights,
  PeopleInsights,
  RiskInsights,
  SiteLoad,
  TalentInsights,
  WorkforceInsights,
} from "@/lib/analytics/workforce-insights-types";

/**
 * Pure derivations for the workforce-insights aggregate. Every helper returns null rather than a
 * flattering zero when there is nothing to divide by.
 */

const PIPELINE_FLOW = ["applied", "screening", "shortlisted", "interview", "background", "offer_review", "offered", "accepted", "converted"] as const;
const FUNNEL: ReadonlyArray<{ key: TalentInsights["funnel"][number]["key"]; stage: (typeof PIPELINE_FLOW)[number] }> = [
  { key: "applied", stage: "applied" },
  { key: "screened", stage: "screening" },
  { key: "interviewed", stage: "interview" },
  { key: "offered", stage: "offered" },
  { key: "joined", stage: "converted" },
];

export function percent(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Inclusive reporting window for a period, ending today (UTC calendar day). */
export function periodWindow(period: AnalyticsPeriod, today: Date): { from: string; to: string; days: number } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  let start: Date;
  switch (period) {
    case "current_month":
      start = new Date(Date.UTC(y, m, 1));
      break;
    case "current_quarter":
      start = new Date(Date.UTC(y, m - (m % 3), 1));
      break;
    case "ytd":
      start = new Date(Date.UTC(y, 0, 1));
      break;
    case "last_12_months":
      start = new Date(Date.UTC(y, m - 12, today.getUTCDate() + 1));
      break;
    default: {
      const unreachable: never = period;
      throw new Error(`Unknown period ${String(unreachable)}`);
    }
  }
  const end = new Date(Date.UTC(y, m, today.getUTCDate()));
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return { from: iso(start), to: iso(end), days };
}

/** Folds recorded gender values into the four reported groups. */
export function genderBreakdown(rows: ReadonlyArray<{ gender: string | null; total: number }>): PeopleInsights["gender"] {
  const out = { female: 0, male: 0, other: 0, unrecorded: 0 };
  for (const row of rows) {
    const value = (row.gender ?? "").trim().toLowerCase();
    const total = Number(row.total) || 0;
    if (!value) out.unrecorded += total;
    else if (value === "f" || value === "female") out.female += total;
    else if (value === "m" || value === "male") out.male += total;
    else out.other += total;
  }
  return out;
}

export function diversityIndex(gender: PeopleInsights["gender"]): number | null {
  const recorded = gender.female + gender.male + gender.other;
  if (recorded === 0) return null;
  return Math.min(100, Math.round(((Math.min(gender.female, gender.male) * 2) / recorded) * 1000) / 10);
}

/** Separation rate over the exposed population, annualised from the window length. */
export function annualizedAttrition(exits: number, active: number, windowDays: number): number | null {
  const rate = percent(exits, active + exits);
  if (rate === null || windowDays <= 0) return null;
  return Math.round(Math.min(100, rate * (365 / windowDays)) * 10) / 10;
}

export function riskBands(rows: ReadonlyArray<{ band: string | null; total: number }>): RiskInsights {
  const out = { low: 0, medium: 0, high: 0, scored: 0 };
  for (const row of rows) {
    const band = (row.band ?? "").trim().toLowerCase();
    const total = Number(row.total) || 0;
    if (band === "low" || band === "medium" || band === "high") {
      out[band] += total;
      out.scored += total;
    }
  }
  return out;
}

export type AttendanceSiteRow = {
  location: string | null;
  shift: string | null;
  employees: number;
  scheduled: number;
  present: number;
  half_day: number;
  absent: number;
  ot_minutes: number | string | null;
};

export function workforceFromSites(rows: readonly AttendanceSiteRow[]): WorkforceInsights {
  let scheduled = 0;
  let presentEq = 0;
  let absent = 0;
  let otMinutes = 0;
  let employees = 0;
  const sites: SiteLoad[] = rows.map((row) => {
    const sitePresent = Number(row.present) + Number(row.half_day) * 0.5;
    const siteOt = Number(row.ot_minutes ?? 0) || 0;
    scheduled += Number(row.scheduled);
    presentEq += sitePresent;
    absent += Number(row.absent);
    otMinutes += siteOt;
    employees += Number(row.employees);
    return {
      location: row.location?.trim() || "",
      shift: row.shift?.trim() || null,
      employees: Number(row.employees),
      scheduledDays: Number(row.scheduled),
      utilization: percent(sitePresent, Number(row.scheduled)),
      overtimeHours: Math.round((siteOt / 60) * 10) / 10,
    };
  });
  return {
    scheduledDays: scheduled,
    utilization: percent(presentEq, scheduled),
    absenteeism: percent(absent, scheduled),
    avgOvertimeHoursPerEmployee: employees > 0 ? Math.round((otMinutes / 60 / employees) * 10) / 10 : null,
    sites: sites.sort((a, b) => b.employees - a.employees).slice(0, 12),
  };
}

export type PayEmployeeRow = { run_id: string; employee_id: string; gross: number | string; basic_da: number | string };

/** Share of paid employees whose basic + DA is at least half of gross earnings (Code on Wages floor). */
export function basicWageCompliance(rows: readonly PayEmployeeRow[]): number | null {
  const paid = rows.filter((row) => Number(row.gross) > 0);
  const compliant = paid.filter((row) => Number(row.basic_da) * 2 >= Number(row.gross)).length;
  return percent(compliant, paid.length);
}

/**
 * Month-on-month bridge between two runs, built from each employee's earning total. The three movements
 * close exactly: prior + joiners + continuing change - leavers = current.
 */
export function wageBridge(current: readonly PayEmployeeRow[], prior: readonly PayEmployeeRow[]) {
  const before = new Map(prior.map((row) => [row.employee_id, Number(row.gross)]));
  const after = new Map(current.map((row) => [row.employee_id, Number(row.gross)]));
  let joinersMinor = 0;
  let continuingChangeMinor = 0;
  let leaversMinor = 0;
  for (const [id, gross] of after) {
    const previous = before.get(id);
    if (previous === undefined) joinersMinor += gross;
    else continuingChangeMinor += gross - previous;
  }
  for (const [id, gross] of before) if (!after.has(id)) leaversMinor += gross;
  const priorGrossMinor = [...before.values()].reduce((sum, value) => sum + value, 0);
  return { priorGrossMinor, joinersMinor, continuingChangeMinor, leaversMinor } satisfies Omit<Extract<PayrollInsights["bridge"], { available: true }>["value"], "priorPeriod">;
}

export type ApplicationRow = { stage: string | null; source: string | null; days_to_join: number | string | null; referred: boolean };

export function talentFromApplications(rows: readonly ApplicationRow[], openPositions: number): TalentInsights {
  const indices = rows.map((row) => PIPELINE_FLOW.indexOf((row.stage ?? "") as (typeof PIPELINE_FLOW)[number]));
  const funnel = FUNNEL.map(({ key, stage }) => {
    const threshold = PIPELINE_FLOW.indexOf(stage);
    return { key, value: threshold <= 0 ? rows.length : indices.filter((index) => index >= threshold).length };
  });
  const reachedOffer = indices.filter((index) => index >= PIPELINE_FLOW.indexOf("offered")).length + rows.filter((row) => row.stage === "declined").length;
  const joined = rows.filter((row) => row.stage === "converted");
  const joinDays = joined.map((row) => Number(row.days_to_join)).filter((value) => Number.isFinite(value) && value >= 0);
  const channels = new Map<string, { applications: number; joined: number }>();
  for (const row of rows) {
    const channel = row.source?.trim() || "";
    const entry = channels.get(channel) ?? { applications: 0, joined: 0 };
    entry.applications += 1;
    if (row.stage === "converted") entry.joined += 1;
    channels.set(channel, entry);
  }
  const channelRows: ChannelRow[] = [...channels.entries()]
    .map(([channel, entry]) => ({
      channel,
      applications: entry.applications,
      share: percent(entry.applications, rows.length) ?? 0,
      joined: entry.joined,
      conversion: percent(entry.joined, entry.applications),
    }))
    .sort((a, b) => b.applications - a.applications);
  return {
    applications: rows.length,
    funnel,
    avgTimeToHireDays: joinDays.length > 0 ? Math.round(joinDays.reduce((sum, value) => sum + value, 0) / joinDays.length) : null,
    offerAcceptance: percent(joined.length, reachedOffer),
    referralShare: percent(rows.filter((row) => row.referred).length, rows.length),
    openPositions,
    channels: channelRows,
  };
}
