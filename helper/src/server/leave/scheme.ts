import {
  STATED_ANNUAL_QUANTA,
  STATED_JOINING_PRORATION,
  resolveJoiningProrationDays,
  type JoiningProrationBand,
} from "@/lib/hr-rules";
import { HttpError } from "@/server/platform/http";

export type { JoiningProrationBand };

/**
 * The leave scheme the accrual, cap, combination, COFF and year-end engines
 * calculate against — and the only place a leave number is allowed to live.
 *
 * Two sources feed it, in this order:
 *
 *  1. The stored Leave Scheme / Leave Type configuration (`leave_types.attributes
 *     ->'configuration'` merged with `accrual_rules.attributes->'configuration'`,
 *     which `policy-register.ts` writes from FRM-LVE-01), plus the leave-type
 *     rule keys the console already reads (`max_per_month`, `year_end_action`,
 *     `cannot_combine_with`).
 *  2. `tenant_settings.settings->'leave_scheme'` for the scheme-level settings the
 *     workbook puts on F-EMP-03 Leave Scheme Master but the leave-type form has no
 *     field for: the senior grade rank, the COFF lapse window, and the joining
 *     proration table.
 *
 * `WORKBOOK_STATED` below carries ONLY figures the client's own build sheet
 * states in words, each cited to its rule. Configuration supersedes them. A value
 * the workbook never states is declared `null` here and reading it throws
 * `LEAVE_SCHEME_INCOMPLETE` — the same refusal `src/server/payroll/rule-pack.ts`
 * makes for an unapproved statutory rate. Three values are in that state today,
 * one per open question: Q-06 (senior grade rank), Q-07 (COFF day basis) and
 * Q-02 (what a joiner after 4 December receives).
 */

/** Where the scheme-level settings would have to be configured for them to exist. */
export const LEAVE_SCHEME_SETTINGS_PATH = "tenant_settings.settings -> 'leave_scheme'";

export type YearEndTreatment = "encash" | "lapse" | "carry_forward";
export type CoffLapseDayBasis = "calendar" | "working";
export type AccrualFrequency = "annual" | "monthly";

export type LeaveTypeScheme = {
  code: string;
  /** Entitlement for an employee on the rolls for the whole year. */
  annualDays: number | null;
  accrualFrequency: AccrualFrequency | null;
  /** Days credited per period when the frequency is monthly. */
  daysPerPeriod: number | null;
  /** Service that must complete before this type accrues at all. */
  minimumServiceMonths: number | null;
  /** The single credit written on completing that service, in place of the held periods. */
  catchUpDays: number | null;
  /** Days of this type that may be AVAILED in one calendar month (RL-12). */
  maxAvailedPerMonth: number | null;
  /** Types this one may not be taken contiguously with (RL-11). */
  cannotCombineWith: string[];
  yearEndTreatment: YearEndTreatment | null;
  /** The new-joiner table (RL-10); null where the type is not prorated by joining month. */
  joiningProration: JoiningProrationBand[] | null;
  /** What a joiner past the last band's cut-off day receives. Q-02 — unstated. */
  joiningAfterCutoffDays: number | null;
};

export type LeaveScheme = {
  /** `employees.designation_level` at or above which RL-07 applies. Q-06 — unstated. */
  seniorGradeRank: number | null;
  /** COFF lapse window. The workbook states 60; whether they are calendar or working days is Q-07. */
  coffLapseDays: number | null;
  coffLapseDayBasis: CoffLapseDayBasis | null;
  types: Record<string, LeaveTypeScheme>;
};

/**
 * Every figure the build sheet states in words, and nothing else.
 *
 * Each entry cites the rule it comes from. Configuration supersedes all of them;
 * a leave type the tenant has never configured still calculates on the client's
 * own stated policy rather than on a zero.
 */
export const WORKBOOK_STATED: LeaveScheme = {
  // Q-06: "Which grade rank is AGM and above?" — the workbook names a designation,
  // never a rank, so nothing may resolve one here.
  seniorGradeRank: null,
  // RL-06 and the configuration register both state 60.
  coffLapseDays: 60,
  // Q-07: "Are the 60 COFF days calendar days or working days?" — unanswered.
  coffLapseDayBasis: null,
  types: {
    EL: {
      code: "EL",
      annualDays: STATED_ANNUAL_QUANTA.annualEL, // RL-07 / RL-08: 18 across the year.
      accrualFrequency: "monthly", // RL-08: 1.5 each month, January to December.
      daysPerPeriod: STATED_ANNUAL_QUANTA.monthlyEL,
      minimumServiceMonths: 6, // RL-09: no EL until six months of service are complete.
      catchUpDays: STATED_ANNUAL_QUANTA.catchUpEL, // RL-09: "9 EL in one credit, not six monthly accruals".
      maxAvailedPerMonth: 10, // RL-12: "a maximum of 2 CL and 10 EL may be availed".
      cannotCombineWith: [], // RL-11 restricts CL; EL carries no restriction of its own.
      yearEndTreatment: "encash", // RL-14: "at year end EL is encashed".
      joiningProration: null, // EL is held and caught up, not prorated by joining month.
      joiningAfterCutoffDays: null,
    },
    CL: {
      code: "CL",
      annualDays: STATED_ANNUAL_QUANTA.annualCL, // RL-07 / RL-08: 6 CL.
      accrualFrequency: "annual", // RL-08: credited once, in January.
      daysPerPeriod: null,
      minimumServiceMonths: 0,
      catchUpDays: null,
      maxAvailedPerMonth: 2, // RL-12.
      cannotCombineWith: ["EL", "SL"], // RL-11: CL may not be taken with EL or SL.
      yearEndTreatment: "lapse", // RL-14.
      joiningProration: STATED_JOINING_PRORATION.map((band) => ({ ...band })),
      joiningAfterCutoffDays: null, // Q-02.
    },
    SL: {
      code: "SL",
      annualDays: STATED_ANNUAL_QUANTA.annualSL,
      accrualFrequency: "annual",
      daysPerPeriod: null,
      minimumServiceMonths: 0,
      catchUpDays: null,
      maxAvailedPerMonth: null, // The workbook caps CL and EL only.
      cannotCombineWith: ["CL"], // RL-11 read from SL's side: the restriction is mutual.
      yearEndTreatment: "lapse",
      joiningProration: STATED_JOINING_PRORATION.map((band) => ({ ...band })),
      joiningAfterCutoffDays: null, // Q-02.
    },
  },
};

/**
 * Reads a scheme value that must have one. Throws a named, actionable error when
 * nobody has supplied it, so an unapproved leave rule can never quietly become a
 * zero on a real person's balance.
 */
export function requireLeaveRule<T>(value: T | null | undefined, path: string, because: string): T {
  if (value === null || value === undefined) {
    throw new HttpError({
      status: 422,
      code: "LEAVE_SCHEME_INCOMPLETE",
      message: `Leave scheme rule "${path}" is not configured. ${because}`,
      details: [{ field: path, issue: `Not configured. Set it under ${LEAVE_SCHEME_SETTINGS_PATH}.` }],
    });
  }
  return value;
}

/** The leave type's own rules, or a refusal naming the type nobody has configured. */
export function leaveTypeScheme(scheme: LeaveScheme, code: string): LeaveTypeScheme {
  const found = scheme.types[code];
  if (!found) {
    throw new HttpError({
      status: 422,
      code: "LEAVE_SCHEME_INCOMPLETE",
      message: `Leave type "${code}" has no scheme rules. Configure it on the Leave Type Configuration form before it can accrue, cap or lapse.`,
      details: [{ field: `types.${code}`, issue: "No accrual rule or leave type configuration exists." }],
    });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Calendar helpers — plain UTC date-string arithmetic, no timezone assumptions
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(value: string, field: string): { year: number; month: number; day: number } {
  if (!ISO_DATE.test(value)) throw new Error(`${field} must be an ISO date (YYYY-MM-DD).`);
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`${field} must be a valid calendar date.`);
  return { year, month, day };
}

/** Accrual period key, `YYYY-MM`. */
export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Adds whole calendar months, clamping to the end of the target month so that
 * 31 August plus six months is 28/29 February rather than rolling into March.
 * Six months of service is a calendar span — never `6 * 30` days and never 183.
 */
export function addMonths(isoDate: string, months: number): string {
  const { year, month, day } = parseIsoDate(isoDate, "date");
  const zeroBased = (year * 12 + (month - 1)) + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

/** Adds calendar days to an ISO date. */
export function addDays(isoDate: string, days: number): string {
  const { year, month, day } = parseIsoDate(isoDate, "date");
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// RL-10 — new joiner CL and SL proration
// ---------------------------------------------------------------------------

/**
 * The CL/SL a joiner receives in their joining year, from the configured table.
 *
 * A joining date past the last band's cut-off day resolves to nothing the
 * workbook states, so it refuses (Q-02) instead of returning the zero the engine
 * used to return silently.
 */
export function resolveJoiningProration(type: LeaveTypeScheme, joinMonth: number, joinDay: number): number {
  const bands = requireLeaveRule(
    type.joiningProration,
    `types.${type.code}.joining_proration`,
    `The joining-month proration table for ${type.code} (F-EMP-03 "joining month from / to / cut-off day / quantity credited") has not been configured.`,
  );
  const days = resolveJoiningProrationDays(joinMonth, joinDay, bands);
  if (days !== null) return days;
  return requireLeaveRule(
    type.joiningAfterCutoffDays,
    `types.${type.code}.joining_after_cutoff_days`,
    `Open question Q-02: the source's proration table ends at "up to 4th Dec - 1 each" and is silent on joiners after that day, so what a ${joinDay} ${monthName(joinMonth)} joiner receives has never been stated. The client must answer it; nothing is assumed here.`,
  );
}

function monthName(month: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1] ?? String(month);
}

// ---------------------------------------------------------------------------
// RL-07 / RL-08 / RL-09 — what one employee is credited on one run date
// ---------------------------------------------------------------------------

export type AccrualBasis = "annual" | "joining" | "monthly" | "catch_up";

export type AccrualLine = {
  leaveType: string;
  days: number;
  basis: AccrualBasis;
  /**
   * What makes this line unique for the employee. The ledger carries it so a
   * re-run writes nothing, whichever entry point triggered the run.
   */
  occurrence: string;
  note: string;
};

export type AccrualPlan = {
  /** True when RL-07's senior branch applied. */
  senior: boolean;
  /** True when the employee was on the rolls on 1 January of the accrual year. */
  onRollsOnJanuaryFirst: boolean;
  lines: AccrualLine[];
};

/**
 * Plans one employee's credit for one run date.
 *
 * RL-07's senior branch turns on being "on the rolls on 1 January" — joined on or
 * before that day — not on having joined that day. The two were conflated, which
 * is why an AGM who joined in June never received the annual entitlement in any
 * later year.
 *
 * Trainee CL eligibility is RL-13: a DET or GET trainee accrues CL, another
 * trainee type does not. SL and EL are unaffected by trainee type.
 */
export function planLeaveAccrual({
  scheme,
  gradeRank,
  joiningDate,
  asOf,
  traineeType,
}: {
  scheme: LeaveScheme;
  gradeRank: number;
  joiningDate: string;
  asOf: string;
  traineeType?: string | null;
}): AccrualPlan {
  const run = parseIsoDate(asOf, "asOf");
  parseIsoDate(joiningDate, "joiningDate");
  const seniorRank = requireLeaveRule(
    scheme.seniorGradeRank,
    "senior_grade_rank",
    'Open question Q-06: RL-07 says "at or above the configured grade rank" and the source names only the designation "AGM and above". The grade ladder has never been confirmed, so no rank is assumed here.',
  );
  const senior = gradeRank >= seniorRank;
  const januaryFirst = `${String(run.year).padStart(4, "0")}-01-01`;
  const onRollsOnJanuaryFirst = joiningDate <= januaryFirst;
  const joiningYear = Number(joiningDate.slice(0, 4));
  const lines: AccrualLine[] = [];

  if (asOf < joiningDate) return { senior, onRollsOnJanuaryFirst, lines };

  const clEligible = traineeEligibleForCasualLeave(traineeType);

  // RL-07. One annual movement on 1 January for an employee at or above the
  // senior rank who was already on the rolls that day.
  if (senior && onRollsOnJanuaryFirst && run.month === 1) {
    for (const code of ["EL", "CL", "SL"]) {
      const type = leaveTypeScheme(scheme, code);
      const days = requireLeaveRule(type.annualDays, `types.${code}.annual_days`, `The annual entitlement for ${code} has not been configured.`);
      if (code === "CL" && !clEligible) continue;
      lines.push({
        leaveType: code,
        days,
        basis: "annual",
        occurrence: `annual:${run.year}`,
        note: `Annual entitlement, grade rank ${gradeRank} at or above ${seniorRank}`,
      });
    }
    return { senior, onRollsOnJanuaryFirst, lines };
  }

  // RL-08 / RL-10. CL and SL are credited once a year: the full entitlement in
  // January for an employee already on the rolls, the prorated quantum in the
  // joining year. The proration belongs to the joining year alone — applying it
  // every January is what capped a 2023 joiner at their joining-month band for
  // the rest of their service.
  for (const code of ["CL", "SL"]) {
    const type = leaveTypeScheme(scheme, code);
    if (code === "CL" && !clEligible) continue;
    if (onRollsOnJanuaryFirst) {
      if (run.month !== 1) continue;
      const days = requireLeaveRule(type.annualDays, `types.${code}.annual_days`, `The annual entitlement for ${code} has not been configured.`);
      lines.push({ leaveType: code, days, basis: "annual", occurrence: `annual:${run.year}`, note: `Annual ${code} credit` });
      continue;
    }
    if (run.year !== joiningYear) continue;
    const joining = parseIsoDate(joiningDate, "joiningDate");
    const days = resolveJoiningProration(type, joining.month, joining.day);
    if (days <= 0) continue;
    lines.push({
      leaveType: code,
      days,
      basis: "joining",
      occurrence: `joining:${joiningYear}`,
      note: `Joining-year ${code} credit for a ${monthName(joining.month)} joiner`,
    });
  }

  // RL-08 / RL-09. EL accrues monthly, held until the minimum service completes
  // and then released as one catch-up credit.
  const el = leaveTypeScheme(scheme, "EL");
  if (senior && onRollsOnJanuaryFirst) {
    // Handled by the annual branch above; a senior on the rolls takes no monthly EL.
    return { senior, onRollsOnJanuaryFirst, lines };
  }
  const waitMonths = requireLeaveRule(
    el.minimumServiceMonths,
    "types.EL.minimum_service_months",
    "The minimum service before earned leave accrues has not been configured.",
  );
  const eligibleFrom = addMonths(joiningDate, waitMonths);
  if (asOf < eligibleFrom) return { senior, onRollsOnJanuaryFirst, lines };

  if (waitMonths > 0 && periodOf(asOf) === periodOf(eligibleFrom)) {
    const catchUp = requireLeaveRule(
      el.catchUpDays,
      "types.EL.catch_up_days",
      "The credit released on completing the minimum service has not been configured.",
    );
    lines.push({
      leaveType: "EL",
      days: catchUp,
      basis: "catch_up",
      occurrence: `catch_up:${periodOf(eligibleFrom)}`,
      note: `Earned leave held from ${joiningDate}, released on completing ${waitMonths} months on ${eligibleFrom}`,
    });
    return { senior, onRollsOnJanuaryFirst, lines };
  }

  const perPeriod = requireLeaveRule(el.daysPerPeriod, "types.EL.days_per_period", "The monthly earned-leave accrual quantity has not been configured.");
  lines.push({
    leaveType: "EL",
    days: perPeriod,
    basis: "monthly",
    occurrence: `monthly:${periodOf(asOf)}`,
    note: "Monthly earned-leave accrual",
  });
  return { senior, onRollsOnJanuaryFirst, lines };
}

/** RL-13. A DET or GET trainee accrues CL; another trainee type does not. */
export function traineeEligibleForCasualLeave(traineeType?: string | null): boolean {
  const normalized = (traineeType ?? "").trim().toUpperCase();
  if (normalized === "") return true;
  return normalized === "DET" || normalized === "GET";
}

// ---------------------------------------------------------------------------
// RL-11 — combination restriction
// ---------------------------------------------------------------------------

/**
 * Whether two leave types may share a contiguous absence. The restriction is
 * mutual: a conflict declared on either side blocks the pair, so configuring it
 * once on CL is enough.
 */
export function combinationConflict(scheme: LeaveScheme, left: string, right: string): boolean {
  if (left === right) return false;
  const conflicts = (code: string, other: string) => {
    const type = scheme.types[code];
    return type ? type.cannotCombineWith.includes(other) : false;
  };
  return conflicts(left, right) || conflicts(right, left);
}

// ---------------------------------------------------------------------------
// RL-12 — monthly availing caps
// ---------------------------------------------------------------------------

export type CapViolation = { leaveType: string; cap: number; requested: number };

/**
 * RL-12 caps what may be AVAILED in a calendar month, counting days already
 * approved in it. Q-04 asks the client to confirm that reading; the rule's own
 * wording ("may be availed in a calendar month, counting days already approved")
 * is what is implemented, and the question is recorded rather than guessed at.
 */
export function monthlyAvailingViolation(
  scheme: LeaveScheme,
  leaveType: string,
  daysThisMonthIncludingRequest: number,
): CapViolation | null {
  const type = scheme.types[leaveType];
  const cap = type?.maxAvailedPerMonth ?? null;
  if (cap === null) return null;
  if (daysThisMonthIncludingRequest <= cap) return null;
  return { leaveType, cap, requested: daysThisMonthIncludingRequest };
}

// ---------------------------------------------------------------------------
// RL-06 — COFF lapse date
// ---------------------------------------------------------------------------

/**
 * The date a COFF grant lapses. The window length is stated (60); whether those
 * days are calendar or working days is Q-07 and has to be configured, because
 * the two answers sit about two weeks apart.
 */
export function coffLapseDate(earnedOn: string, scheme: LeaveScheme): string {
  parseIsoDate(earnedOn, "earnedOn");
  const days = requireLeaveRule(scheme.coffLapseDays, "coff_lapse_days", "The COFF lapse window has not been configured.");
  const basis = requireLeaveRule(
    scheme.coffLapseDayBasis,
    "coff_lapse_day_basis",
    'Open question Q-07: the source says "60 days from the COFF date" without saying whether they are calendar or working days, which moves the expiry by around two weeks. Configure the basis before comp-off can be granted or lapsed.',
  );
  if (basis === "working") {
    throw new HttpError({
      status: 422,
      code: "LEAVE_SCHEME_INCOMPLETE",
      message:
        "The COFF lapse window is configured in working days, but no work calendar is wired to the leave engine to count them. Either configure a calendar-day basis or supply the work calendar the count should follow.",
      details: [{ field: "coff_lapse_day_basis", issue: "Working-day counting needs a work calendar that does not exist yet." }],
    });
  }
  return addDays(earnedOn, days);
}

// ---------------------------------------------------------------------------
// RL-14 — year-end treatment
// ---------------------------------------------------------------------------

/** What happens to one leave type's closing balance at year end. */
export function yearEndTreatment(scheme: LeaveScheme, leaveType: string): YearEndTreatment {
  const type = scheme.types[leaveType];
  return requireLeaveRule(
    type?.yearEndTreatment ?? null,
    `types.${leaveType}.year_end_treatment`,
    `The year-end treatment for ${leaveType} has not been configured. RL-14 makes it configuration per type ("EL treatment at year end", "CL treatment at year end", "SL treatment at year end").`,
  );
}

/** The ledger movement kind each treatment posts. */
export const YEAR_END_KIND: Record<YearEndTreatment, "encash" | "lapse" | "carry_forward"> = {
  encash: "encash",
  lapse: "lapse",
  carry_forward: "carry_forward",
};
