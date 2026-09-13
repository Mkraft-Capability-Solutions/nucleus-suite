import { dateDay } from "../lib/form-validation";
import { readData } from "./workspace-data.mjs";
/**
 * Nucleus HRMS — Enterprise Leave Accrual, Comp-Off Expiry & Multi-Tier Approval Engine (Gap G3)
 * Implements:
 * - Demo Point 5: Early return from leave (automatic re-credit) + 3-level sequential approval workflow (Supervisor -> HOD -> HR Head)
 * - Demo Point 6: Comp-off independent 60-day auto-lapse clock (FIFO consumption, non-encashable) + Sandwich leave rule
 * - Demo Point 7: Band-based annual credit (AGM+ 18 upfront on Jan 1 vs 1.5/mo for general staff), mid-year joining proration, carry-forward caps
 */

export const LEAVE_RULESET_VERSION = "v2.1.0-LEAVE-2026.09";
const message = (key) => readData("services.leaveEngine", "errors")[key];
const isoDay = (day) => new Date(day * 86400000).toISOString().slice(0, 10);
function validDay(value) {
  const day = dateDay(value);
  if (day === null) throw new Error(message("date"));
  return day;
}
function validQuantity(value) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value * 2))
    throw new Error(message("quantity"));
}

export const LEAVE_TYPES = readData("services.leaveEngine", "LEAVE_TYPES_1");

// Executive designations qualifying for 18 EL upfront on Jan 1st
export const EXECUTIVE_BAND_PATTERNS = [
  /assistant\s*general\s*manager/i,
  /agm/i,
  /general\s*manager/i,
  /gm\b/i,
  /director/i,
  /vice\s*president/i,
  /vp\b/i,
  /chro/i,
  /ceo/i,
  /coo/i,
  /cfo/i,
  /cto/i,
  /c-suite/i,
];

export function isExecutiveOrAbove(designation = "") {
  if (!designation) return false;
  return EXECUTIVE_BAND_PATTERNS.some((p) => p.test(designation));
}

/**
 * Demo Point 7: Band-based annual credit & mid-year proration.
 * - AGM and above get 18 EL upfront on Jan 1st.
 * - General staff get 1.5 EL per completed month.
 * - Mid-year joiners get prorated credit for remaining months.
 */
export function computeAnnualCredit({
  designation = "",
  joinDateStr = "2026-01-01",
  currentYear = 2026,
}) {
  const isExec = isExecutiveOrAbove(designation);
  const joinDate = new Date(joinDateStr);
  const joinYear = joinDate.getFullYear();
  const joinMonth = joinDate.getMonth(); // 0 = Jan, 11 = Dec

  let elCredit = 0;
  let accrualMode = "MONTHLY_ACCRUAL";
  let prorationFactor = 1.0;

  if (isExec) {
    if (
      joinYear < currentYear ||
      (joinYear === currentYear && joinMonth === 0)
    ) {
      // Joined prior to or on Jan 1: full 18 upfront
      elCredit = 18;
      accrualMode = "ANNUAL_UPFRONT";
    } else if (joinYear === currentYear) {
      // Mid-year executive joiner: prorate 18 based on remaining months
      const remainingMonths = 12 - joinMonth;
      prorationFactor = remainingMonths / 12;
      elCredit = Math.round((18 * remainingMonths) / 12);
      accrualMode = "PRORATED_UPFRONT";
    }
  } else {
    // General staff (L1-L4): 1.5 EL per month completed
    if (joinYear < currentYear) {
      elCredit = 18; // 12 months * 1.5 = 18 per annum
      accrualMode = "MONTHLY_ACCRUAL";
    } else if (joinYear === currentYear) {
      const remainingMonths = 12 - joinMonth;
      prorationFactor = remainingMonths / 12;
      elCredit = Number((remainingMonths * 1.5).toFixed(1));
      accrualMode = "PRORATED_MONTHLY";
    }
  }

  return {
    designation,
    is_executive: isExec,
    join_date: joinDateStr,
    el_credit: elCredit,
    ...readData("services.leaveEngine", "content_fields_2"),
    accrual_mode: accrualMode,
    proration_factor: prorationFactor,
  };
}

/**
 * Demo Point 6: Comp-off independent 60-day auto-lapse clock.
 * Evaluates comp-off credits against reference date (or current date).
 * Credits older than 60 days lapse automatically and cannot be encashed.
 */
export function evaluateCompOffValidity(
  compOffCredits = [],
  referenceDateStr = new Date().toISOString().split("T")[0],
) {
  const reference = validDay(referenceDateStr);
  let activeCount = 0,
    lapsedCount = 0,
    usedCount = 0;
  const evaluated = compOffCredits.map((credit) => {
    const credited = validDay(credit.credited_at);
    const expiry = credited + LEAVE_TYPES.COMP_OFF.validity_days;
    const original = credit.days ?? 1;
    const remaining =
      credit.remaining_days ?? (credit.status === "USED" ? 0 : original);
    if (
      !Number.isFinite(original) ||
      !Number.isFinite(remaining) ||
      remaining < 0 ||
      remaining > original
    )
      throw new Error(message("credit"));
    usedCount += original - remaining;
    const status =
      remaining === 0
        ? "USED"
        : expiry <= reference
          ? "LAPSED_60_DAYS"
          : credited > reference
            ? "SCHEDULED"
            : "ACTIVE";
    if (status === "ACTIVE") activeCount += remaining;
    if (status === "LAPSED_60_DAYS") lapsedCount += remaining;
    return {
      ...credit,
      remaining_days: remaining,
      expires_at: isoDay(expiry),
      days_remaining: Math.max(0, expiry - reference),
      status,
    };
  });
  return {
    credits: evaluated,
    active_balance: activeCount,
    lapsed_count: lapsedCount,
    used_count: usedCount,
    reference_date: referenceDateStr,
  };
}

/** Stable FIFO order, retaining fractional remainders and an allocation trace for reversal. */
export function consumeCompOffFIFO(
  compOffCredits = [],
  requestedDays = 1,
  referenceDateStr = new Date().toISOString().slice(0, 10),
) {
  validQuantity(requestedDays);
  const { credits, active_balance } = evaluateCompOffValidity(
    compOffCredits,
    referenceDateStr,
  );
  if (active_balance < requestedDays)
    return { success: false, reason: message("balance") };
  let remaining = requestedDays;
  const allocations = [];
  const updated = [...credits]
    .sort(
      (a, b) =>
        a.credited_at.localeCompare(b.credited_at) || a.id.localeCompare(b.id),
    )
    .map((credit) => {
      if (credit.status !== "ACTIVE" || remaining <= 0) return credit;
      const used = Math.min(remaining, credit.remaining_days);
      remaining -= used;
      allocations.push({ credit_id: credit.id, days: used });
      return {
        ...credit,
        remaining_days: credit.remaining_days - used,
        status: credit.remaining_days === used ? "USED" : "ACTIVE",
        used_on: referenceDateStr,
      };
    });
  return {
    success: true,
    updated_credits: updated,
    allocations,
    days_deducted: requestedDays,
    remaining_balance: active_balance - requestedDays,
  };
}

/**
 * Demo Point 6: Sandwich Leave Rule Engine.
 * Evaluates whether leave brackets weekend/weekly offs (e.g. Friday and Monday).
 * If sandwich rule is enabled, intermediate weekend days are added to chargeable days.
 */
export function calculateLeaveSpan({
  startDateStr,
  endDateStr,
  leaveTypeCode = "PRIVILEGE",
  sandwichRuleEnabled = true,
  holidays = [],
  weekendDays = [0, 6],
}) {
  const start = validDay(startDateStr),
    end = validDay(endDateStr);
  if (end < start || end - start > 365) throw new Error(message("range"));
  const leaveType = LEAVE_TYPES[leaveTypeCode];
  if (!Object.hasOwn(LEAVE_TYPES, leaveTypeCode))
    throw new Error(message("type"));
  const holidaySet = new Set(holidays.map((date) => isoDay(validDay(date))));
  const daysList = [];
  for (let day = start; day <= end; day++) {
    const date = isoDay(day),
      isWeekend = weekendDays.includes(new Date(day * 86400000).getUTCDay()),
      isHoliday = holidaySet.has(date);
    daysList.push({
      date,
      is_weekend: isWeekend,
      is_holiday: isHoliday,
      chargeable: !isWeekend && !isHoliday,
    });
  }
  const first = daysList.findIndex((day) => day.chargeable),
    last = daysList.findLastIndex((day) => day.chargeable);
  let sandwiched = 0;
  if (sandwichRuleEnabled && leaveType.can_be_sandwich && first >= 0)
    daysList.forEach((day, index) => {
      if (!day.chargeable && index > first && index < last) {
        day.chargeable = true;
        sandwiched++;
      }
    });
  return {
    start_date: startDateStr,
    end_date: endDateStr,
    total_calendar_days: daysList.length,
    working_days: daysList.filter((day) => !day.is_weekend && !day.is_holiday)
      .length,
    weekend_days: daysList.filter((day) => day.is_weekend).length,
    holiday_days: daysList.filter((day) => day.is_holiday).length,
    sandwich_rule_applied: sandwiched > 0,
    chargeable_days: daysList.filter((day) => day.chargeable).length,
    days_breakdown: daysList,
    reason: message(sandwiched ? "sandwich" : "standard"),
  };
}

/**
 * Demo Point 5: Early Return from Leave with Automatic Balance Re-Credit.
 * Example: Leave applied Mon to Fri (5 days). Employee returns Thu morning.
 * Thu & Fri (2 days) are cancelled and re-credited back to employee ledger.
 */
export function processEarlyReturn({
  application,
  actualReturnDateStr, // Date employee resumed work (e.g. Thursday '2026-09-17')
  currentBalance = 10,
}) {
  if (application.status !== "APPROVED" || application.recredit_transaction)
    throw new Error(message("status"));
  validDay(actualReturnDateStr);
  const plannedStart = new Date(application.start_date + "T00:00:00Z");
  const plannedEnd = new Date(application.end_date + "T00:00:00Z");
  const actualReturn = new Date(actualReturnDateStr + "T00:00:00Z");

  if (actualReturn <= plannedStart) {
    throw new Error("Actual return date must be after the leave start date.");
  }
  if (actualReturn > plannedEnd) {
    throw new Error(
      "Actual return date is on or after the original end date — no early return to process.",
    );
  }

  // Days actually taken: from plannedStart up to the day BEFORE actualReturn
  const adjustedEnd = new Date(actualReturn);
  adjustedEnd.setUTCDate(adjustedEnd.getUTCDate() - 1);
  const adjustedEndDateStr = adjustedEnd.toISOString().slice(0, 10);

  const daysTakenSpan = calculateLeaveSpan({
    startDateStr: application.start_date,
    endDateStr: adjustedEndDateStr,
    leaveTypeCode: application.leave_type_code,
    sandwichRuleEnabled: application.sandwich_rule_applied,
    holidays: application.calendar_policy?.holidays ?? [],
    weekendDays: application.calendar_policy?.weekendDays ?? [0, 6],
  });

  const originallyDebited =
    application.chargeable_days ?? application.duration_days;
  const daysActuallyTaken = Math.min(
    originallyDebited,
    daysTakenSpan.chargeable_days,
  );
  const daysToRecredit = Math.max(0, originallyDebited - daysActuallyTaken);

  const recreditTransaction = {
    transaction_id: `TXN-REV-${crypto.randomUUID()}`,
    employee_id: application.employee_id,
    leave_type_code: application.leave_type_code,
    days_recredited: daysToRecredit,
    reason: `RE_CREDIT_EARLY_RETURN: Resumed duty on ${actualReturnDateStr} prior to planned end ${application.end_date}`,
    recredited_at: new Date().toISOString(),
    previous_balance: currentBalance,
    new_balance: currentBalance + daysToRecredit,
  };

  const updatedApplication = {
    ...application,
    actual_return_date: actualReturnDateStr,
    adjusted_end_date: adjustedEndDateStr,
    original_chargeable_days: originallyDebited,
    chargeable_days: daysActuallyTaken,
    ...readData("services.leaveEngine", "updatedApplication_fields_9"),
    recredit_transaction: recreditTransaction,
  };

  return {
    updated_application: updatedApplication,
    days_recredited: daysToRecredit,
    new_balance: currentBalance + daysToRecredit,
    recredit_transaction: recreditTransaction,
  };
}

/**
 * Demo Point 5: 3-Level Sequential Approval Workflow.
 * Tiers: Supervisor -> HOD -> HR Head.
 */
export const APPROVAL_TIERS = readData(
  "services.leaveEngine",
  "APPROVAL_TIERS_10",
);

export function advanceApproval({
  application,
  approverRole, // 'SUPERVISOR' | 'HOD' | 'HR_HEAD'
  action, // 'APPROVE' | 'REJECT'
  remarks = "",
  reviewerName = "",
}) {
  if (!["APPROVE", "REJECT"].includes(action))
    throw new Error(message("action"));
  if (
    !APPROVAL_TIERS.includes(approverRole) ||
    application.current_approval_tier !== approverRole ||
    application.status !== `PENDING_${approverRole}`
  )
    throw new Error(message("tier"));
  if (action === "REJECT" && !remarks.trim())
    throw new Error(message("remarks"));
  const index = APPROVAL_TIERS.indexOf(approverRole);
  const nextTier =
    action === "REJECT"
      ? approverRole
      : (APPROVAL_TIERS[index + 1] ?? "COMPLETED");
  return {
    ...application,
    status:
      action === "REJECT"
        ? "REJECTED"
        : nextTier === "COMPLETED"
          ? "APPROVED"
          : `PENDING_${nextTier}`,
    current_approval_tier: nextTier,
    approval_history: [
      ...(application.approval_history ?? []),
      {
        tier: approverRole,
        action: action === "REJECT" ? "REJECTED" : "APPROVED",
        reviewer: reviewerName || approverRole,
        remarks: remarks.trim(),
        timestamp: new Date().toISOString(),
      },
    ],
    ...(action === "REJECT" ? { rejection_reason: remarks.trim() } : {}),
  };
}
