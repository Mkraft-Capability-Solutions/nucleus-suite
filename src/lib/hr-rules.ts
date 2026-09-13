export type Punch = {
  type: "in" | "out";
  at: string;
};

export type AttendanceStatus = "Present" | "Half day" | "Absent";

export type ShiftRule = {
  hours: 8 | 9 | 10 | 12;
  halfDayBelowMinutes: number;
  absentBelowMinutes: number;
};

export const shiftRules: Record<ShiftRule["hours"], ShiftRule> = {
  12: { hours: 12, halfDayBelowMinutes: 11 * 60 + 30, absentBelowMinutes: 6 * 60 + 30 },
  10: { hours: 10, halfDayBelowMinutes: 9 * 60 + 30, absentBelowMinutes: 6 * 60 },
  9: { hours: 9, halfDayBelowMinutes: 8 * 60 + 30, absentBelowMinutes: 5 * 60 },
  8: { hours: 8, halfDayBelowMinutes: 7 * 60 + 30, absentBelowMinutes: 4 * 60 + 30 },
};

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
  overtimeBasis = "gross-span",
}: {
  punches: Punch[];
  shiftMinutes: number;
  approvedGatePassMinutes?: number;
  overtimeBasis?: "gross-span" | "productive";
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

  return {
    grossSpanMinutes,
    productiveMinutes: creditedProductiveMinutes,
    rawProductiveMinutes: productiveMinutes,
    breakMinutes,
    breaks,
    overtimeMinutes: Math.max(0, overtimeSource - shiftMinutes),
  };
}

export function attendanceStatus(
  shiftHours: ShiftRule["hours"],
  netMinutes: number,
): AttendanceStatus {
  if (!Number.isFinite(netMinutes) || netMinutes < 0) throw new Error("Net attendance minutes must be non-negative.");
  const rule = shiftRules[shiftHours];
  if (netMinutes < rule.absentBelowMinutes) return "Absent";
  if (netMinutes < rule.halfDayBelowMinutes) return "Half day";
  return "Present";
}

export function evaluateLateArrival({
  minutesLate,
  lateOccurrencesThisMonth,
  assistantManagerOrAbove,
  workedPast3AmPreviousDay,
}: {
  minutesLate: number;
  lateOccurrencesThisMonth: number;
  assistantManagerOrAbove: boolean;
  workedPast3AmPreviousDay: boolean;
}) {
  if (assistantManagerOrAbove || workedPast3AmPreviousDay) {
    return { status: "Present" as AttendanceStatus, reason: "Policy exemption applies" };
  }
  if (minutesLate <= 15) {
    return { status: "Present" as AttendanceStatus, reason: "Within 15-minute grace" };
  }
  if (lateOccurrencesThisMonth < 3) {
    return {
      status: "Present" as AttendanceStatus,
      reason: `Late occurrence ${lateOccurrencesThisMonth + 1} of 3`,
    };
  }
  return {
    status: "Half day" as AttendanceStatus,
    reason: "Monthly late-arrival allowance exhausted",
  };
}

export type EmployeeCategory =
  | "regular"
  | "contract"
  | "third-party-employee"
  | "third-party-helper";

export function restDayPolicy(category: EmployeeCategory) {
  return {
    hasRestDay: category === "regular" || category === "third-party-employee",
    wageBasis: category === "contract" ? "daily" : "monthly",
  } as const;
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

export function joiningPeriodCasualAndSickLeave(joinMonth: number, joinDay: number) {
  if (!Number.isInteger(joinMonth) || joinMonth < 1 || joinMonth > 12 || !Number.isInteger(joinDay) || joinDay < 1 || joinDay > 31) {
    throw new Error("Joining month and day must be valid calendar values.");
  }
  if (joinMonth === 1) return 6;
  if (joinMonth <= 3) return 5;
  if (joinMonth <= 5) return 4;
  if (joinMonth <= 7) return 3;
  if (joinMonth <= 9) return 2;
  if (joinMonth <= 11 || (joinMonth === 12 && joinDay <= 4)) return 1;
  return 0;
}

export function annualLeaveCredit({
  designationLevel,
  joinMonth = 1,
  joinDay = 1,
  completedSixMonths,
  traineeType,
}: {
  designationLevel: "AGM+" | "below-AGM";
  joinMonth?: number;
  joinDay?: number;
  completedSixMonths: boolean;
  traineeType?: "DET" | "GET" | "other";
}) {
  const isAnnualCycleEmployee = joinMonth === 1 && joinDay === 1;
  const clSl = isAnnualCycleEmployee
    ? 6
    : joiningPeriodCasualAndSickLeave(joinMonth, joinDay);
  const traineeClEligible = !traineeType || traineeType === "DET" || traineeType === "GET";

  if (designationLevel === "AGM+" && isAnnualCycleEmployee) {
    return { EL: 18, CL: traineeClEligible ? 6 : 0, SL: 6, monthlyEL: 0 };
  }

  return {
    EL: !isAnnualCycleEmployee && completedSixMonths ? 9 : 0,
    CL: traineeClEligible ? clSl : 0,
    SL: clSl,
    monthlyEL: completedSixMonths ? 1.5 : 0,
  };
}

export function validateLeaveRequest({
  requestedTypes,
  clDaysThisMonth,
  elDaysThisMonth,
}: {
  requestedTypes: LeaveType[];
  clDaysThisMonth: number;
  elDaysThisMonth: number;
}) {
  const errors: string[] = [];
  const includesCL = requestedTypes.includes("CL");
  if (includesCL && requestedTypes.some((type) => type === "EL" || type === "SL")) {
    errors.push("Casual leave cannot be combined with earned or sick leave.");
  }
  if (clDaysThisMonth > 2) errors.push("Casual leave is limited to 2 days per month.");
  if (elDaysThisMonth > 10) errors.push("Earned leave is limited to 10 days per month.");
  return { valid: errors.length === 0, errors };
}

export function coffExpiryDate(earnedOn: Date) {
  if (Number.isNaN(earnedOn.getTime())) throw new Error("COFF earned date must be valid.");
  const expires = new Date(earnedOn);
  expires.setDate(expires.getDate() + 60);
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
    maximumAmount: basicSalary * (serviceYears > 5 ? 6 : 4),
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
