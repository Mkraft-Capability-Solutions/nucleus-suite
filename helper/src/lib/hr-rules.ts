export type Punch = {
  type: "in" | "out";
  at: string;
};

export type AttendanceStatus = "Present" | "Half day" | "Absent";

/**
 * The net-minute thresholds that decide one day's status (RL-16).
 *
 * RL-16 puts these on the shift record — "a new shift length needs configuration,
 * not code" — so the engine passes the shift master's own `halfDayMinutes` and
 * `absentBelowMinutes` here rather than looking a shift length up in this file.
 */
export type ShiftThresholds = {
  /** Net minutes below this, and at or above the absent threshold, give a half day. */
  halfDayBelowMinutes: number;
  /** Net minutes below this give Absent. */
  absentBelowMinutes: number;
};

export type ShiftRule = ShiftThresholds & { hours: number };

/**
 * Seed thresholds for the four shift lengths the workbook states.
 *
 * These are the values a shift master row is CREATED with; they are not what the
 * running engine decides with. Nothing here may grow a fifth entry to support a
 * new shift length — that length is configured on its own shift record.
 */
export const shiftRules: Record<number, ShiftRule> = {
  12: { hours: 12, halfDayBelowMinutes: 11 * 60 + 30, absentBelowMinutes: 6 * 60 + 30 },
  10: { hours: 10, halfDayBelowMinutes: 9 * 60 + 30, absentBelowMinutes: 6 * 60 },
  9: { hours: 9, halfDayBelowMinutes: 8 * 60 + 30, absentBelowMinutes: 5 * 60 },
  8: { hours: 8, halfDayBelowMinutes: 7 * 60 + 30, absentBelowMinutes: 4 * 60 + 30 },
};

/**
 * The OT basis this client's RL-04 states: "OT hours equal gross work hours less
 * the shift OT threshold", so the 45-minute dinner break in the worked example is
 * not deducted before overtime is measured.
 *
 * It is stated once, here, because the other workbook's `PL_OT_BASIS` defaults the
 * same setting to Net minutes. The two sources genuinely disagree; a shift record
 * that names its own `otBasis` always wins over this default, and the conflict is
 * recorded in tmp/_audit/requests/acceptance-attendance.md.
 */
export const DEFAULT_OVERTIME_BASIS = "gross-span" as const;

/** A closed clock-minute range inside one day. */
export type ClockInterval = [number, number];

/**
 * RL-19 detection windows. A window whose end is earlier than its start crosses
 * midnight, so it splits in two — without this a night shift cannot be expressed
 * at all, because 20:00–04:00 compared with plain >= and <= matches nothing.
 */
export function detectionIntervals(fromMinute: number, toMinute: number): ClockInterval[] {
  return fromMinute <= toMinute ? [[fromMinute, toMinute]] : [[fromMinute, 1439], [0, toMinute]];
}

export function detectionWindowContains(intervals: ClockInterval[], minute: number): boolean {
  return intervals.some(([from, to]) => minute >= from && minute <= to);
}

/** Punch-in windows are inclusive, so a shared endpoint is an ambiguity too. */
export function intervalsOverlap(left: ClockInterval[], right: ClockInterval[]): boolean {
  return left.some(([leftFrom, leftTo]) => right.some(([rightFrom, rightTo]) => leftFrom <= rightTo && rightFrom <= leftTo));
}

/** Every pair of detection windows that RL-19 forbids. Empty means the set is valid. */
export function detectionWindowOverlaps<T extends { code: string; intervals: ClockInterval[] }>(
  windows: readonly T[],
): Array<{ left: T; right: T }> {
  const clashes: Array<{ left: T; right: T }> = [];
  for (let left = 0; left < windows.length; left += 1) {
    for (let right = left + 1; right < windows.length; right += 1) {
      if (intervalsOverlap(windows[left].intervals, windows[right].intervals)) {
        clashes.push({ left: windows[left], right: windows[right] });
      }
    }
  }
  return clashes;
}

function clockToMinutes(value: string) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s+(AM|PM)$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid punch time: ${value}`);
  const [, rawHour, rawMinute, period] = match;
  const clock = `${rawHour}:${rawMinute}`;
  const [rawHours, rawMinutes] = clock.split(":").map(Number);
  let hours = rawHours % 12;
  if (period.toUpperCase() === "PM") hours += 12;
  return hours * 60 + rawMinutes;
}

/** "09:15 PM" as minutes since midnight. Throws rather than guessing an unreadable time. */
export function punchClockToMinutes(value: string): number {
  return clockToMinutes(value);
}

function nextOccurrence(value: string, after: number) {
  let minutes = clockToMinutes(value);
  while (minutes < after) minutes += 24 * 60;
  return minutes;
}

export function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function analyzePunchDay({
  punches,
  shiftMinutes,
  approvedGatePassMinutes = 0,
  overtimeBasis = DEFAULT_OVERTIME_BASIS,
  overtimeAfterMinutes,
}: {
  punches: Punch[];
  shiftMinutes: number;
  approvedGatePassMinutes?: number;
  overtimeBasis?: "gross-span" | "productive";
  /**
   * The shift master's "OT starts after hours" (RL-04). It is a separate setting
   * from the shift duration — a 12-hour shift may start paying overtime earlier —
   * and falls back to the duration only when the shift record does not state it.
   */
  overtimeAfterMinutes?: number;
}) {
  if (shiftMinutes <= 0 || approvedGatePassMinutes < 0) {
    throw new Error("Shift and approved gate-pass minutes must be valid positive durations.");
  }
  if (punches.length < 2 || punches[0].type !== "in" || punches.at(-1)?.type !== "out") {
    throw new Error("A punch day must start with an in punch and end with an out punch.");
  }
  if (punches.some((punch, index) => index > 0 && punch.type === punches[index - 1].type)) {
    throw new Error("Punches must alternate between in and out.");
  }

  const normalized = punches.map((punch, index) => ({
    ...punch,
    minutes:
      index === 0
        ? clockToMinutes(punch.at)
        : nextOccurrence(punch.at, clockToMinutes(punches[index - 1].at)),
  }));

  for (let index = 1; index < normalized.length; index += 1) {
    while (normalized[index].minutes < normalized[index - 1].minutes) {
      normalized[index].minutes += 24 * 60;
    }
  }

  let productiveMinutes = 0;
  let breakMinutes = 0;
  const breaks: Array<{ from: string; to: string; minutes: number }> = [];

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    const minutes = next.minutes - current.minutes;

    if (current.type === "in" && next.type === "out") {
      productiveMinutes += minutes;
    }

    if (current.type === "out" && next.type === "in") {
      breakMinutes += minutes;
      breaks.push({ from: current.at, to: next.at, minutes });
    }
  }

  const first = normalized[0];
  const last = normalized.at(-1)!;
  const grossSpanMinutes = last.minutes - first.minutes;
  const creditedProductiveMinutes = productiveMinutes + approvedGatePassMinutes;
  const overtimeSource =
    overtimeBasis === "gross-span" ? grossSpanMinutes : creditedProductiveMinutes;
  const overtimeThreshold = overtimeAfterMinutes ?? shiftMinutes;

  return {
    grossSpanMinutes,
    productiveMinutes: creditedProductiveMinutes,
    rawProductiveMinutes: productiveMinutes,
    breakMinutes,
    breaks,
    overtimeMinutes: Math.max(0, overtimeSource - overtimeThreshold),
    overtimeBasis,
    overtimeAfterMinutes: overtimeThreshold,
  };
}

/**
 * Resolves the seed thresholds for one stated shift length. An unseeded length is
 * refused rather than silently processed on another shift's thresholds — falling
 * back is how a 10-hour shift ends up measured against 8-hour numbers.
 */
export function seededShiftThresholds(shiftHours: number): ShiftThresholds {
  const rule = shiftRules[shiftHours];
  if (!rule) {
    throw new Error(
      `No seeded thresholds for a ${shiftHours}-hour shift. Configure halfDayMinutes and absentBelowMinutes on the shift master record.`,
    );
  }
  return rule;
}

export function attendanceStatus(
  shift: ShiftThresholds | number,
  netMinutes: number,
): AttendanceStatus {
  if (!Number.isFinite(netMinutes) || netMinutes < 0) throw new Error("Net attendance minutes must be non-negative.");
  const thresholds = typeof shift === "number" ? seededShiftThresholds(shift) : shift;
  if (!Number.isFinite(thresholds.absentBelowMinutes) || !Number.isFinite(thresholds.halfDayBelowMinutes)) {
    throw new Error("Shift thresholds must be configured before a day status can be derived.");
  }
  if (netMinutes < thresholds.absentBelowMinutes) return "Absent";
  if (netMinutes < thresholds.halfDayBelowMinutes) return "Half day";
  return "Present";
}

/**
 * The grace and late-mark settings RL-17 configures at "Grace & Late Policy Setup".
 * The values here are the ones the workbook itself states as defaults; the tenant's
 * own record overrides them, and the exempt grade rank is not among them because
 * the workbook never states which rank that is (Q-06).
 */
export type LatePolicy = {
  graceMinutes: number;
  latesAllowedPerMonth: number;
  consequence: "Half day" | "Leave deduction" | "Warning only" | "No action";
};

export const defaultLatePolicy: LatePolicy = {
  graceMinutes: 15,
  latesAllowedPerMonth: 3,
  consequence: "Half day",
};

export function evaluateLateArrival({
  minutesLate,
  lateOccurrencesThisMonth,
  assistantManagerOrAbove,
  workedPast3AmPreviousDay,
  policy = defaultLatePolicy,
}: {
  minutesLate: number;
  lateOccurrencesThisMonth: number;
  /** Resolved from the employee's grade rank against the exempt rank, never from a job title. */
  assistantManagerOrAbove: boolean;
  /** The night-extension verdict for this day (RL-18), already decided by the caller. */
  workedPast3AmPreviousDay: boolean;
  policy?: LatePolicy;
}) {
  if (assistantManagerOrAbove || workedPast3AmPreviousDay) {
    return { status: "Present" as AttendanceStatus, reason: "Policy exemption applies", late: false };
  }
  if (minutesLate <= policy.graceMinutes) {
    return { status: "Present" as AttendanceStatus, reason: `Within ${policy.graceMinutes}-minute grace`, late: false };
  }
  if (lateOccurrencesThisMonth < policy.latesAllowedPerMonth) {
    return {
      status: "Present" as AttendanceStatus,
      reason: `Late occurrence ${lateOccurrencesThisMonth + 1} of ${policy.latesAllowedPerMonth}`,
      late: true,
    };
  }
  return {
    status: (policy.consequence === "Half day" ? "Half day" : "Present") as AttendanceStatus,
    reason: "Monthly late-arrival allowance exhausted",
    late: true,
  };
}

/**
 * RL-18 night extension.
 *
 * Where the previous session ran past the trigger hour, an arrival up to the
 * permitted hour carries no late mark and — provided work continues to the minimum
 * departure time — the day stands as a full day. The upgrade is the point of the
 * rule: the threshold verdict alone would make a 09:15-to-20:00 day a half day.
 *
 * All three times are clock minutes on the day being processed. `previousSessionEndMinute`
 * is null when the previous session did not run past midnight into this date at all.
 */
export type NightExtensionRule = {
  triggerAfterMinute: number;
  permittedArrivalUntilMinute: number;
  minimumDepartureMinute: number;
};

export function evaluateNightExtension({
  previousSessionEndMinute,
  arrivalMinute,
  departureMinute,
  rule,
}: {
  previousSessionEndMinute: number | null;
  arrivalMinute: number;
  departureMinute: number;
  rule: NightExtensionRule;
}): { applies: boolean; reason: string } {
  if (previousSessionEndMinute === null || previousSessionEndMinute < rule.triggerAfterMinute) {
    return { applies: false, reason: "The previous session did not run past the trigger hour." };
  }
  if (arrivalMinute > rule.permittedArrivalUntilMinute) {
    return { applies: false, reason: "Arrival fell after the permitted late-arrival hour." };
  }
  if (departureMinute < rule.minimumDepartureMinute) {
    return { applies: false, reason: "Work did not continue to the minimum departure time." };
  }
  return { applies: true, reason: "Night extension: previous session ran past the trigger hour." };
}

export function isOvertimeEligible({
  policy,
  isRestDay,
  isHoliday,
}: {
  policy: "all-days" | "rest-holiday-only" | "not-eligible";
  isRestDay: boolean;
  isHoliday: boolean;
}) {
  if (policy === "not-eligible") return false;
  if (policy === "all-days") return true;
  return isRestDay || isHoliday;
}

export type LeaveType = "EL" | "CL" | "SL" | "COFF" | "BIRTHDAY";

/**
 * One row of RL-10's new-joiner table, as F-EMP-03 configures it: "joining month
 * from", "joining month to", "cut-off day in the last month", "quantity credited".
 */
export type JoiningProrationBand = {
  fromMonth: number;
  toMonth: number;
  /** Last day of `toMonth` the band covers; null covers the whole month. */
  cutoffDay: number | null;
  days: number;
};

/**
 * RL-10 exactly as the workbook writes it: "January 6 each; February or March 5;
 * April or May 4; June or July 3; August or September 2; October, November or up
 * to 4 December 1". The sentence stops there, and that silence is Q-02.
 */
export const STATED_JOINING_PRORATION: readonly JoiningProrationBand[] = [
  { fromMonth: 1, toMonth: 1, cutoffDay: null, days: 6 },
  { fromMonth: 2, toMonth: 3, cutoffDay: null, days: 5 },
  { fromMonth: 4, toMonth: 5, cutoffDay: null, days: 4 },
  { fromMonth: 6, toMonth: 7, cutoffDay: null, days: 3 },
  { fromMonth: 8, toMonth: 9, cutoffDay: null, days: 2 },
  { fromMonth: 10, toMonth: 12, cutoffDay: 4, days: 1 },
];

/**
 * The band a joining date falls in, or null where the table does not reach it.
 *
 * Null is the honest answer for a joiner past the last band's cut-off day: the
 * source never states what they receive, so the caller refuses rather than
 * crediting the zero this used to return silently.
 */
export function resolveJoiningProrationDays(
  joinMonth: number,
  joinDay: number,
  bands: readonly JoiningProrationBand[] = STATED_JOINING_PRORATION,
): number | null {
  if (!Number.isInteger(joinMonth) || joinMonth < 1 || joinMonth > 12 || !Number.isInteger(joinDay) || joinDay < 1 || joinDay > 31) {
    throw new Error("Joining month and day must be valid calendar values.");
  }
  for (const band of bands) {
    if (joinMonth < band.fromMonth || joinMonth > band.toMonth) continue;
    if (joinMonth === band.toMonth && band.cutoffDay !== null && joinDay > band.cutoffDay) continue;
    return band.days;
  }
  return null;
}

/**
 * RL-10's CL/SL quantum for a joiner. A joining date the configured table does not
 * reach is refused: open question Q-02 asks what a joiner after 4 December
 * receives, and T-14 is explicit that the answer must be the client's, "not an
 * assumption".
 */
export function joiningPeriodCasualAndSickLeave(
  joinMonth: number,
  joinDay: number,
  bands: readonly JoiningProrationBand[] = STATED_JOINING_PRORATION,
) {
  const days = resolveJoiningProrationDays(joinMonth, joinDay, bands);
  if (days === null) {
    throw new Error(
      `The joining-month proration table does not cover ${joinDay}/${joinMonth}. Open question Q-02: the source's table ends at "up to 4th Dec - 1 each" and never states what a later joiner receives. Configure the quantity before crediting.`,
    );
  }
  return days;
}

/** The annual quanta RL-07 and RL-08 state, superseded by the leave scheme when configured. */
export type AnnualLeaveQuanta = {
  annualEL: number;
  annualCL: number;
  annualSL: number;
  monthlyEL: number;
  /** RL-09's single credit released on completing the minimum service. */
  catchUpEL: number;
};

export const STATED_ANNUAL_QUANTA: AnnualLeaveQuanta = {
  annualEL: 18,
  annualCL: 6,
  annualSL: 6,
  monthlyEL: 1.5,
  catchUpEL: 9,
};

/**
 * What one employee is entitled to for a leave year.
 *
 * RL-07's senior branch turns on being "ON THE ROLLS on 1 January" — joined on or
 * before that day — not on having joined that day. Conflating the two is why an
 * AGM who joined 15 June was still being treated as a new joiner in every
 * following year. Callers that know the accrual year pass `onRollsOnJanuaryFirst`
 * explicitly; the default preserves the old reading only for callers that cannot.
 */
export function annualLeaveCredit({
  designationLevel,
  joinMonth = 1,
  joinDay = 1,
  completedSixMonths,
  traineeType,
  onRollsOnJanuaryFirst,
  quanta = STATED_ANNUAL_QUANTA,
  prorationBands = STATED_JOINING_PRORATION,
}: {
  designationLevel: "AGM+" | "below-AGM";
  joinMonth?: number;
  joinDay?: number;
  completedSixMonths: boolean;
  traineeType?: "DET" | "GET" | "other";
  /** True when the employee was already on the rolls on 1 January of the accrual year. */
  onRollsOnJanuaryFirst?: boolean;
  quanta?: AnnualLeaveQuanta;
  prorationBands?: readonly JoiningProrationBand[];
}) {
  const onRolls = onRollsOnJanuaryFirst ?? (joinMonth === 1 && joinDay === 1);
  const traineeClEligible = !traineeType || traineeType === "DET" || traineeType === "GET";

  if (designationLevel === "AGM+" && onRolls) {
    return {
      EL: quanta.annualEL,
      CL: traineeClEligible ? quanta.annualCL : 0,
      SL: quanta.annualSL,
      monthlyEL: 0,
    };
  }

  const clSl = onRolls ? quanta.annualCL : joiningPeriodCasualAndSickLeave(joinMonth, joinDay, prorationBands);
  return {
    EL: !onRolls && completedSixMonths ? quanta.catchUpEL : 0,
    CL: traineeClEligible ? clSl : 0,
    SL: onRolls ? quanta.annualSL : clSl,
    monthlyEL: completedSixMonths ? quanta.monthlyEL : 0,
  };
}

/** RL-12's caps, keyed by leave type. A type with no entry is not capped. */
export type MonthlyAvailingCaps = Readonly<Record<string, number | null>>;

/** RL-11's matrix: for each type, the types it may not share a contiguous absence with. */
export type LeaveCombinationMatrix = Readonly<Record<string, readonly string[]>>;

export const STATED_MONTHLY_CAPS: MonthlyAvailingCaps = { CL: 2, EL: 10 };
export const STATED_COMBINATION_MATRIX: LeaveCombinationMatrix = { CL: ["EL", "SL"], SL: ["CL"], EL: ["CL"] };

/**
 * The checks that can be made from one application alone: the types inside it,
 * and the days it would take the month to.
 *
 * The contiguous-absence half of RL-11 cannot be decided here, because it spans
 * separate applications — `src/server/leave/absence.ts` owns that. Caps and the
 * matrix are configuration (F-EMP-03 "maximum availed per month" and "cannot be
 * combined with"); the stated values stand in only until a scheme supplies them.
 */
export function validateLeaveRequest({
  requestedTypes,
  clDaysThisMonth,
  elDaysThisMonth,
  daysThisMonthByType,
  caps = STATED_MONTHLY_CAPS,
  combinationMatrix = STATED_COMBINATION_MATRIX,
}: {
  requestedTypes: LeaveType[];
  clDaysThisMonth?: number;
  elDaysThisMonth?: number;
  /** Days already taken this month per type, including the request being validated. */
  daysThisMonthByType?: Readonly<Record<string, number>>;
  caps?: MonthlyAvailingCaps;
  combinationMatrix?: LeaveCombinationMatrix;
}) {
  const errors: string[] = [];
  for (const type of requestedTypes) {
    const forbidden = combinationMatrix[type] ?? [];
    const clash = requestedTypes.find((other) => other !== type && forbidden.includes(other));
    if (clash && !errors.some((error) => error.includes(`${type} cannot be combined`))) {
      errors.push(`${type} cannot be combined with ${clash}.`);
    }
  }
  const usage: Record<string, number> = {
    ...(clDaysThisMonth === undefined ? {} : { CL: clDaysThisMonth }),
    ...(elDaysThisMonth === undefined ? {} : { EL: elDaysThisMonth }),
    ...(daysThisMonthByType ?? {}),
  };
  for (const [type, days] of Object.entries(usage)) {
    const cap = caps[type];
    if (cap === null || cap === undefined) continue;
    if (days > cap) errors.push(`${type} is limited to ${cap} days per month.`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * RL-06's lapse date. The window length is configuration ("COFF lapse days", 60
 * by the stated policy); whether the days are calendar or working days is Q-07
 * and is resolved by the leave scheme, not here.
 */
export function coffExpiryDate(earnedOn: Date, lapseDays = 60) {
  if (Number.isNaN(earnedOn.getTime())) throw new Error("COFF earned date must be valid.");
  if (!Number.isInteger(lapseDays) || lapseDays <= 0) throw new Error("The COFF lapse window must be a positive number of days.");
  const expires = new Date(earnedOn);
  expires.setDate(expires.getDate() + lapseDays);
  return expires;
}

export function reconcileEarlyLeaveReturn({
  approvedDays,
  actualLeaveDays,
}: {
  approvedDays: number;
  actualLeaveDays: number;
}) {
  if (approvedDays < 0 || actualLeaveDays < 0) throw new Error("Leave day counts must be non-negative.");
  return {
    presentDaysRestored: Math.max(0, approvedDays - actualLeaveDays),
    leaveDaysCreditedBack: Math.max(0, approvedDays - actualLeaveDays),
  };
}

export function gatePassEligibility({
  approvedMinutesThisMonth,
  approvedCountThisMonth,
  requestedMinutes,
}: {
  approvedMinutesThisMonth: number;
  approvedCountThisMonth: number;
  requestedMinutes: number;
}) {
  if (approvedMinutesThisMonth < 0 || approvedCountThisMonth < 0 || requestedMinutes <= 0) {
    throw new Error("Gate-pass usage and request values must be valid.");
  }
  const reasons: string[] = [];
  if (approvedCountThisMonth >= 2) reasons.push("Maximum 2 gate passes per month reached.");
  if (approvedMinutesThisMonth + requestedMinutes > 240) {
    reasons.push("Monthly personal gate-pass allowance exceeds 4 hours.");
  }
  if (![120, 240].includes(requestedMinutes)) {
    reasons.push("A personal gate pass must be 2 or 4 hours.");
  }
  if (requestedMinutes === 240 && approvedCountThisMonth > 0) {
    reasons.push("The 4-hour option is available only as the single monthly gate pass.");
  }
  return { eligible: reasons.length === 0, reasons };
}

/**
 * RL-22's exposure test: whether an employee may borrow at all.
 *
 * It deliberately does NOT return a ceiling. The multiples and the service band
 * are rule-pack values read through `resolveLoanCeiling`
 * (src/server/loans/ceiling.ts); the inlined `serviceYears > 5` that used to live
 * here gave four times basic at exactly five years, which RL-22's "five years or
 * more" does not say. One question, one answer.
 */
export function loanEligibility({
  basicSalary,
  serviceYears,
  hasOpenLoan,
  hasSalaryAdvance,
  isActiveGuarantor,
  directorOverride = false,
}: {
  basicSalary: number;
  serviceYears: number;
  hasOpenLoan: boolean;
  hasSalaryAdvance: boolean;
  isActiveGuarantor: boolean;
  directorOverride?: boolean;
}) {
  if (basicSalary <= 0 || serviceYears < 0) throw new Error("Salary and service years must be valid.");
  const reasons: string[] = [];
  if (hasOpenLoan) reasons.push("Existing loan must be repaid in full.");
  if (hasSalaryAdvance) reasons.push("Salary advance is active.");
  if (isActiveGuarantor) reasons.push("Employee is an active guarantor for another loan.");
  return {
    eligible: reasons.length === 0 || directorOverride,
    requiresDirectorOverride: reasons.length > 0,
    reasons,
    mandatoryGuarantors: 2,
    optionalThirdGuarantor: true,
  };
}

export const overnightPunchExample = analyzePunchDay({
  punches: [
    { type: "in", at: "08:00 AM" },
    { type: "out", at: "08:30 PM" },
    { type: "in", at: "09:15 PM" },
    { type: "out", at: "03:20 AM" },
  ],
  shiftMinutes: 12 * 60,
  overtimeBasis: "gross-span",
});
