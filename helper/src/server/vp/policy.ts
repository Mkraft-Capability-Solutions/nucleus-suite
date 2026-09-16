import {
  analyzePunchDay,
  attendanceStatus,
  detectionIntervals,
  detectionWindowContains,
  evaluateLateArrival,
  evaluateNightExtension,
  isOvertimeEligible,
  seededShiftThresholds,
  type NightExtensionRule,
  type Punch,
  type ShiftThresholds,
} from "@/lib/hr-rules";

export const VP_FEATURES = [
  "Multi-punch overnight attendance, breaks and OT",
  "Contract workers without rest days and daily wages",
  "Third-party employee/helper rest-day distinction",
  "Employee OT eligibility by working/rest/holiday day",
  "Early leave return, re-credit and three-stage approval",
  "COFF automatic 60-day lapse",
  "Leave accrual, proration, caps and year-end action",
  "Location-scoped attendance with salary masking",
  "Loan eligibility, guarantors and director override",
  "Post-salary off-cycle OT payroll",
  "Gate-pass limits and credited work time",
  "Shift thresholds, grace, late instances and relief",
  "Automatic shift inference from in-punch",
  "ERP-owned employee-master synchronization",
  "ERP GL posting and reconciliation",
  "Same-day F&F gated by no-dues",
  "State-specific statutory registers and returns",
  "Star-employee recognition programme",
  "Employee referral workflow and payroll award",
  "Lifecycle and recognition announcements",
  "Versioned HR letter generation and issue register",
  "Organisation chart and department hierarchy",
  "Induction and asset allocation",
  "Replacement requisitions against position codes",
  "Approved departmental manpower control",
  "Factory Act Joining Form F",
] as const;

export type ShiftWindow = { code: string; earliestMinute: number; latestMinute: number; durationMinutes: number };

export function clockMinute(iso: string, timeZone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * RL-19. The window is matched through `detectionIntervals`, so a window that runs
 * from 20:00 to 04:00 splits across midnight instead of matching nothing — a night
 * shift is otherwise inexpressible.
 */
export function inferShift(assigned: string, firstPunchIso: string, windows: ShiftWindow[], timeZone = "Asia/Kolkata") {
  const minute = clockMinute(firstPunchIso, timeZone);
  const inferred = windows.find((window) => detectionWindowContains(detectionIntervals(window.earliestMinute, window.latestMinute), minute));
  if (!inferred || inferred.code === assigned) return { assigned, inferred: null, effective: assigned, reason: null };
  return { assigned, inferred: inferred.code, effective: inferred.code, reason: `First punch at minute ${minute} matched ${inferred.code} shift window.` };
}

export function computeVpAttendance(input: {
  punches: Punch[];
  assignedShift: string;
  windows: ShiftWindow[];
  shiftHours: 8 | 9 | 10 | 12;
  approvedGatePassMinutes: number;
  otPolicy: "all-days" | "rest-holiday-only" | "not-eligible";
  dayType: "working" | "weekly_off" | "holiday" | "festival";
  minutesLate: number;
  lateOccurrencesThisMonth: number;
  assistantManagerOrAbove: boolean;
  workedPast3AmPreviousDay: boolean;
  firstPunchIso: string;
  timeZone?: string;
  /** The shift record's own thresholds; the seeded ones for `shiftHours` otherwise. */
  thresholds?: ShiftThresholds;
  /** RL-04: the shift's "OT starts after hours"; the shift duration otherwise. */
  overtimeAfterMinutes?: number;
  overtimeBasis?: "gross-span" | "productive";
  /** RL-18 inputs. Supplied by the caller that read the previous day's last OUT. */
  nightExtension?: {
    rule: NightExtensionRule;
    previousSessionEndMinute: number | null;
    arrivalMinute: number;
    departureMinute: number;
  };
}) {
  const inferred = inferShift(input.assignedShift, input.firstPunchIso, input.windows, input.timeZone);
  const duration = (input.windows.find((window) => window.code === inferred.effective)?.durationMinutes ?? input.shiftHours * 60);
  const trace = analyzePunchDay({
    punches: input.punches,
    shiftMinutes: duration,
    approvedGatePassMinutes: input.approvedGatePassMinutes,
    overtimeBasis: input.overtimeBasis ?? "productive",
    overtimeAfterMinutes: input.overtimeAfterMinutes,
  });
  // RL-18 is decided before the threshold verdict, because the rule has to be able
  // to raise a short, late day to a full one — an exemption applied afterwards can
  // only stop a downgrade, which is not what the rule says.
  const nightExtension = input.nightExtension
    ? evaluateNightExtension({
      previousSessionEndMinute: input.nightExtension.previousSessionEndMinute,
      arrivalMinute: input.nightExtension.arrivalMinute,
      departureMinute: input.nightExtension.departureMinute,
      rule: input.nightExtension.rule,
    })
    : { applies: input.workedPast3AmPreviousDay, reason: "Night extension supplied by the caller." };
  const late = evaluateLateArrival({ ...input, workedPast3AmPreviousDay: nightExtension.applies });
  const thresholds = input.thresholds ?? seededShiftThresholds(input.shiftHours);
  const thresholdStatus = attendanceStatus(thresholds, trace.productiveMinutes);
  const status = nightExtension.applies
    ? "Present"
    : late.status === "Half day" && thresholdStatus === "Present" ? "Half day" : thresholdStatus;
  const otEligible = isOvertimeEligible({
    policy: input.otPolicy,
    isRestDay: input.dayType === "weekly_off",
    isHoliday: input.dayType === "holiday" || input.dayType === "festival",
  });
  return {
    ...trace,
    ...inferred,
    status,
    statusReason: nightExtension.applies
      ? nightExtension.reason
      : status === "Half day" && late.status === "Half day" ? late.reason : `Net-hours threshold for ${input.shiftHours}h shift`,
    lateMarkApplied: late.late,
    nightExtensionApplied: nightExtension.applies,
    payableOtMinutes: otEligible ? trace.overtimeMinutes : 0,
    otEligible,
  };
}

export function assertOtRunAllowed(runScope: string, regularRunStatus: string | null) {
  if (runScope !== "ot") return true;
  if (regularRunStatus !== "finalized") throw new Error("OT payroll requires the regular salary run to be finalized first.");
  return true;
}

export function manpowerAvailability(input: { sanctioned: number; filled: number; openAdditions: number; requisitionType: "addition" | "replacement" }) {
  const remaining = Math.max(0, input.sanctioned - input.filled - input.openAdditions);
  return { remaining, allowed: input.requisitionType === "replacement" || remaining > 0 };
}

export function renderMergeTemplate(template: string, values: Record<string, string | number | null>) {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => {
    if (!(key in values)) throw new Error(`Missing merge field: ${key}`);
    return String(values[key] ?? "");
  });
}

export function payloadHashSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(payloadHashSource);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, payloadHashSource(entry)]));
  }
  return value;
}
