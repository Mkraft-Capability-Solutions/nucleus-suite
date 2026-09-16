/**
 * Workforce Operations policy defaults.
 *
 * These are **defaults, not constants**. Every value here is a tenant-level
 * policy setting that an operator may override; nothing in the application may
 * hardcode one of these numbers inline. Pages and services read the resolved
 * policy so a rule change never requires a code release.
 *
 * Each value records the rule it encodes so the intent survives future edits.
 */

export type GatePassPolicy = {
  /** Total gate-pass minutes an employee may consume per calendar month. */
  monthlyCeilingMinutes: number;
  /** Maximum number of gate passes an employee may raise per calendar month. */
  maxRequestsPerMonth: number;
  /** Whether approved gate-pass minutes count towards net attendance. */
  creditsNetAttendance: boolean;
};

export type LatenessPolicy = {
  /** Minutes after scheduled start before a punch counts as late. */
  graceMinutes: number;
  /** Late instances forgiven each calendar month before a penalty applies. */
  forgivenInstancesPerMonth: number;
  /** Penalty once the forgiven allowance is exhausted. */
  penalty: "half_day" | "absent" | "none";
  /**
   * Designations exempt from the late-grace penalty. Matched case-insensitively
   * against the whole designation, never as a loose substring — a substring
   * match would exempt every title containing "manager".
   */
  exemptDesignations: string[];
};

export type OvertimePolicy = {
  /** Divisor converting monthly basic pay to an hourly rate (26 days x 8 hours). */
  hourlyRateDivisor: number;
  /** Statutory overtime multiplier applied to the derived hourly rate. */
  multiplier: number;
  /** Cap on payable overtime minutes per day; null means uncapped. */
  dailyCapMinutes: number | null;
};

export type HolidayType = "national" | "state" | "festival" | "optional";

export type HolidayPolicy = {
  /** Wage and overtime multiplier for a statutory holiday worked. */
  statutoryHolidayMultiplier: number;
  /** Wage and overtime multiplier for a weekly rest day worked. */
  weeklyOffMultiplier: number;
  /** Multiplier for an ordinary working day. */
  workingDayMultiplier: number;
  /**
   * Multiplier applied per holiday type when a holiday record does not store
   * its own. National, state and festival days are all statutory closures and
   * carry the full holiday rate; an optional (restricted) holiday is worked at
   * the ordinary rate because the employee chooses whether to take it.
   */
  multiplierByHolidayType: Record<HolidayType, number>;
};

export type LoanPolicy = {
  /** Ceiling on principal, as a multiple of monthly basic pay. */
  ceilingMultipleOfBasic: number;
  /** Number of active employee guarantors a loan requires. */
  requiredGuarantors: number;
  /** Concurrent active loans permitted per employee. */
  maxActiveLoansPerEmployee: number;
  /** A guarantor cannot borrow while a loan they guarantee is outstanding. */
  guarantorLockWhileOutstanding: boolean;
  /** Annual interest rate as a percentage. Company welfare loans are interest-free. */
  annualInterestPercent: number;
};

export type SettlementPolicy = {
  /** Days used to derive a per-day rate from a monthly figure. */
  monthlyDivisor: number;
  /** Continuous service years required before gratuity is payable. */
  gratuityEligibilityYears: number;
  /** Gratuity accrual days per completed year, under the Payment of Gratuity Act 1972. */
  gratuityDaysPerYear: number;
  /** Divisor for the gratuity formula (working days in a month). */
  gratuityDivisor: number;
};

export type EarnedWagePolicy = {
  /** Share of earned-to-date wages an employee may draw early. */
  maxEarnedPercent: number;
};

export type WorkforcePolicy = {
  gatePass: GatePassPolicy;
  lateness: LatenessPolicy;
  overtime: OvertimePolicy;
  holiday: HolidayPolicy;
  loan: LoanPolicy;
  settlement: SettlementPolicy;
  earnedWage: EarnedWagePolicy;
};

export const workforcePolicyDefaults: WorkforcePolicy = {
  gatePass: {
    monthlyCeilingMinutes: 240,
    maxRequestsPerMonth: 2,
    creditsNetAttendance: true,
  },
  lateness: {
    graceMinutes: 15,
    forgivenInstancesPerMonth: 3,
    penalty: "half_day",
    exemptDesignations: ["Assistant Manager", "Manager", "Senior Manager", "Director", "Vice President"],
  },
  overtime: {
    hourlyRateDivisor: 208,
    multiplier: 2,
    dailyCapMinutes: null,
  },
  holiday: {
    statutoryHolidayMultiplier: 2,
    weeklyOffMultiplier: 1.5,
    workingDayMultiplier: 1,
    multiplierByHolidayType: {
      national: 2,
      state: 2,
      festival: 2,
      optional: 1,
    },
  },
  loan: {
    ceilingMultipleOfBasic: 4,
    requiredGuarantors: 2,
    maxActiveLoansPerEmployee: 1,
    guarantorLockWhileOutstanding: true,
    annualInterestPercent: 0,
  },
  settlement: {
    monthlyDivisor: 30,
    gratuityEligibilityYears: 4.8,
    gratuityDaysPerYear: 15,
    gratuityDivisor: 26,
  },
  earnedWage: {
    maxEarnedPercent: 50,
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * Merges tenant overrides over the defaults, one section at a time. Overrides
 * are shallow within each section, so a tenant may change a single value
 * without restating the rest of that section.
 */
export function resolveWorkforcePolicy(overrides?: DeepPartial<WorkforcePolicy> | null): WorkforcePolicy {
  if (!overrides) return workforcePolicyDefaults;
  const sections = Object.keys(workforcePolicyDefaults) as Array<keyof WorkforcePolicy>;
  return sections.reduce((resolved, section) => {
    return {
      ...resolved,
      [section]: { ...workforcePolicyDefaults[section], ...(overrides[section] ?? {}) },
    };
  }, {} as WorkforcePolicy);
}

/** Remaining gate-pass allowance for an employee in the current period. */
export function gatePassAllowance(
  usedMinutes: number,
  usedRequests: number,
  policy: GatePassPolicy = workforcePolicyDefaults.gatePass,
) {
  const remainingMinutes = Math.max(0, policy.monthlyCeilingMinutes - usedMinutes);
  const remainingRequests = Math.max(0, policy.maxRequestsPerMonth - usedRequests);
  return {
    remainingMinutes,
    remainingRequests,
    exhausted: remainingMinutes === 0 || remainingRequests === 0,
  };
}

/**
 * Whether a further gate pass of `requestedMinutes` is admissible. The request
 * count is checked before the minute ceiling, and a request landing exactly on
 * the ceiling is admitted.
 */
export function gatePassAdmissible(
  usedMinutes: number,
  usedRequests: number,
  requestedMinutes: number,
  policy: GatePassPolicy = workforcePolicyDefaults.gatePass,
): { admissible: boolean; reason: string } {
  if (usedRequests >= policy.maxRequestsPerMonth) {
    return { admissible: false, reason: `Monthly limit of ${policy.maxRequestsPerMonth} gate passes already used.` };
  }
  if (usedMinutes + requestedMinutes > policy.monthlyCeilingMinutes) {
    return {
      admissible: false,
      reason: `This would exceed the ${policy.monthlyCeilingMinutes}-minute monthly ceiling by ${usedMinutes + requestedMinutes - policy.monthlyCeilingMinutes} minutes.`,
    };
  }
  return { admissible: true, reason: "" };
}

/**
 * The wage and overtime multiplier for a holiday type, used when the holiday
 * record itself stores no multiplier. An unrecognised type falls back to the
 * statutory holiday rate rather than silently paying the ordinary rate.
 */
export function holidayMultiplierFor(
  holidayType: string,
  policy: HolidayPolicy = workforcePolicyDefaults.holiday,
): number {
  const mapped = policy.multiplierByHolidayType[holidayType as HolidayType];
  return typeof mapped === "number" ? mapped : policy.statutoryHolidayMultiplier;
}

/**
 * Whether a designation is exempt from the late-grace penalty.
 *
 * The attendance engine does NOT use this: RL-17 states the exemption as a grade
 * rank ("Assistant Manager and above") and Q-06 points out that matching on the
 * designation text breaks the first time a title changes, so
 * `src/server/attendance/attendance-policy.ts` holds the exempt rank and the engine
 * compares `employees.designation_level` against it. This stays as the display-side
 * helper for screens that only know a job title, and as the shape a tenant without a
 * configured grade ladder can fall back to.
 */
export function isGraceExempt(
  designation: string,
  policy: LatenessPolicy = workforcePolicyDefaults.lateness,
): boolean {
  const normalised = designation.trim().toLowerCase();
  return policy.exemptDesignations.some((exempt) => exempt.trim().toLowerCase() === normalised);
}
