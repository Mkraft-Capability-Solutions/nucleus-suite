/**
 * Response contract of GET /api/v1/analytics/workforce-insights, shared by the server service and the
 * Analytics view. Every section is an availability envelope: a section that cannot be measured carries
 * `available: false` and a reason that is safe to show, never a placeholder figure.
 */

export const ANALYTICS_PERIODS = ["current_month", "current_quarter", "ytd", "last_12_months"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

/** Why a section could not be measured; the client maps the code to a localized sentence. */
export type UnavailableReason =
  | "forbidden"
  | "no_roster"
  | "no_gender_recorded"
  | "no_dated_exits"
  | "no_attrition_scores"
  | "no_attendance"
  | "no_payroll_run"
  | "no_payroll_lines"
  | "no_prior_run"
  | "no_applications"
  | "no_capability_runs"
  | "no_metric_definitions"
  | "no_leave_data";

/** `reason` is declared on both branches so callers narrow reliably even without strictNullChecks. */
export type Section<T> = { available: true; value: T; reason?: undefined } | { available: false; reason: UnavailableReason; value?: undefined };

export type PeopleInsights = {
  activeHeadcount: number;
  gender: { female: number; male: number; other: number; unrecorded: number };
  /** min(female, male) * 2 / recorded, 0..100, one decimal. */
  diversityIndex: number | null;
};

export type AttritionInsights = {
  exits: number;
  /** Separations / (active + separations), annualised to 12 months, one decimal. */
  annualizedAttrition: number;
  retentionRate: number;
  windowDays: number;
};

export type RiskInsights = { low: number; medium: number; high: number; scored: number };

export type SiteLoad = {
  location: string;
  shift: string | null;
  employees: number;
  scheduledDays: number;
  /** Present-day equivalents / scheduled days, one decimal; null when nothing was scheduled. */
  utilization: number | null;
  overtimeHours: number;
};

export type WorkforceInsights = {
  scheduledDays: number;
  utilization: number | null;
  absenteeism: number | null;
  avgOvertimeHoursPerEmployee: number | null;
  sites: SiteLoad[];
};

export type PayrollInsights = {
  runId: string;
  period: string;
  currency: string;
  grossMinor: number;
  employees: number;
  /** Share of paid employees whose basic + DA is at least 50% of gross earnings. */
  basicWageCompliance: number | null;
  statutoryMinor: number;
  advancesMinor: number;
  advanceDrawdown: number | null;
  bridge: Section<{
    priorPeriod: string;
    priorGrossMinor: number;
    joinersMinor: number;
    continuingChangeMinor: number;
    leaversMinor: number;
  }>;
};

export type ChannelRow = { channel: string; applications: number; share: number; joined: number; conversion: number | null };

export type TalentInsights = {
  applications: number;
  funnel: Array<{ key: "applied" | "screened" | "interviewed" | "offered" | "joined"; value: number }>;
  avgTimeToHireDays: number | null;
  offerAcceptance: number | null;
  referralShare: number | null;
  openPositions: number;
  channels: ChannelRow[];
};

export type LeaveInsights = {
  employees: number;
  balanceDays: number;
  approvedDays: number;
  byType: Array<{ leaveType: string; balanceDays: number; approvedDays: number }>;
};

export type CapabilityInsights = { averageIndex: number; employees: number };

export type MetricSnapshotRow = {
  code: string;
  name: string;
  cohortSize: number | null;
  suppressed: boolean | null;
  privacyThreshold: number;
  refreshedAt: string | null;
};

export type WorkforceInsightsPayload = {
  window: { period: AnalyticsPeriod; from: string; to: string; department: string | null };
  departments: string[];
  people: Section<PeopleInsights>;
  attrition: Section<AttritionInsights>;
  risk: Section<RiskInsights>;
  workforce: Section<WorkforceInsights>;
  payroll: Section<PayrollInsights>;
  talent: Section<TalentInsights>;
  capability: Section<CapabilityInsights>;
  leave: Section<LeaveInsights>;
  metrics: Section<MetricSnapshotRow[]>;
  generatedAt: string;
};

/** MCI v2 weights, mirrored from src/server/analytics/service.ts (MCI_WEIGHTS) for the client preview only. */
export const MCI_PREVIEW_WEIGHTS = { performance: 25, skills: 25, learning: 20, engagement: 15, tenure: 15 } as const;
export type MciDimension = keyof typeof MCI_PREVIEW_WEIGHTS;
