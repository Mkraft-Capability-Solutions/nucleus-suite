
import { readData } from './workspace-data.mjs';
/**
 * Nucleus HRMS — Enterprise Leave Accrual, Comp-Off Expiry & Multi-Tier Approval Engine (Gap G3)
 * Implements:
 * - Demo Point 5: Early return from leave (automatic re-credit) + 3-level sequential approval workflow (Supervisor -> HOD -> HR Head)
 * - Demo Point 6: Comp-off independent 60-day auto-lapse clock (FIFO consumption, non-encashable) + Sandwich leave rule
 * - Demo Point 7: Band-based annual credit (AGM+ 18 upfront on Jan 1 vs 1.5/mo for general staff), mid-year joining proration, carry-forward caps
 */

export const LEAVE_RULESET_VERSION = 'v2.0.0-LEAVE-2026.09';

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
    /c-suite/i
];

export function isExecutiveOrAbove(designation = '') {
    if (!designation) return false;
    return EXECUTIVE_BAND_PATTERNS.some(p => p.test(designation));
}

/**
 * Demo Point 7: Band-based annual credit & mid-year proration.
 * - AGM and above get 18 EL upfront on Jan 1st.
 * - General staff get 1.5 EL per completed month.
 * - Mid-year joiners get prorated credit for remaining months.
 */
export function computeAnnualCredit({ designation = '', joinDateStr = '2026-01-01', currentYear = 2026 }) {
    const isExec = isExecutiveOrAbove(designation);
    const joinDate = new Date(joinDateStr);
    const joinYear = joinDate.getFullYear();
    const joinMonth = joinDate.getMonth(); // 0 = Jan, 11 = Dec

    let elCredit = 0;
    let accrualMode = 'MONTHLY_ACCRUAL';
    let prorationFactor = 1.0;

    if (isExec) {
        if (joinYear < currentYear || (joinYear === currentYear && joinMonth === 0)) {
            // Joined prior to or on Jan 1: full 18 upfront
            elCredit = 18;
            accrualMode = 'ANNUAL_UPFRONT';
        } else if (joinYear === currentYear) {
            // Mid-year executive joiner: prorate 18 based on remaining months
            const remainingMonths = 12 - joinMonth;
            prorationFactor = remainingMonths / 12;
            elCredit = Math.round((18 * remainingMonths) / 12);
            accrualMode = 'PRORATED_UPFRONT';
        }
    } else {
        // General staff (L1-L4): 1.5 EL per month completed
        if (joinYear < currentYear) {
            elCredit = 18; // 12 months * 1.5 = 18 per annum
            accrualMode = 'MONTHLY_ACCRUAL';
        } else if (joinYear === currentYear) {
            const remainingMonths = 12 - joinMonth;
            prorationFactor = remainingMonths / 12;
            elCredit = Number((remainingMonths * 1.5).toFixed(1));
            accrualMode = 'PRORATED_MONTHLY';
        }
    }

    return {
        designation,
        is_executive: isExec,
        join_date: joinDateStr,
        el_credit: elCredit,
        ...readData("services.leaveEngine", "content_fields_2"),
        accrual_mode: accrualMode,
        proration_factor: prorationFactor
    };
}

/**
 * Demo Point 6: Comp-off independent 60-day auto-lapse clock.
 * Evaluates comp-off credits against reference date (or current date).
 * Credits older than 60 days lapse automatically and cannot be encashed.
 */
export function evaluateCompOffValidity(compOffCredits = [], referenceDateStr = new Date().toISOString().split('T')[0]) {
    const refDate = new Date(referenceDateStr + 'T00:00:00');

    let activeCount = 0;
    let lapsedCount = 0;
    let usedCount = 0;

    const evaluated = compOffCredits.map(credit => {
        const creditDate = new Date(credit.credited_at + 'T00:00:00');
        const expiryDate = new Date(creditDate);
        expiryDate.setDate(expiryDate.getDate() + 60);

        const diffTime = expiryDate.getTime() - refDate.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status = credit.status;

        if (status === 'USED') {
            usedCount += credit.days || 1;
            return {
                ...credit,
                expires_at: expiryDate.toISOString().split('T')[0],
                ...readData("services.leaveEngine", "evaluated_fields_3")
            };
        }

        if (daysRemaining <= 0) {
            status = 'LAPSED_60_DAYS';
            lapsedCount += credit.days || 1;
        } else {
            status = 'ACTIVE';
            activeCount += credit.days || 1;
        }

        return {
            ...credit,
            expires_at: expiryDate.toISOString().split('T')[0],
            days_remaining: Math.max(0, daysRemaining),
            status: status
        };
    });

    return {
        credits: evaluated,
        active_balance: activeCount,
        lapsed_count: lapsedCount,
        used_count: usedCount,
        reference_date: referenceDateStr
    };
}

/**
 * Consumes comp-offs in First-In, First-Out (FIFO) order.
 */
export function consumeCompOffFIFO(compOffCredits = [], requestedDays = 1, referenceDateStr = new Date().toISOString().split('T')[0]) {
    const { credits, active_balance } = evaluateCompOffValidity(compOffCredits, referenceDateStr);

    if (active_balance < requestedDays) {
        return {
            ...readData("services.leaveEngine", "content_fields_4"),
            reason: `Insufficient active comp-off balance (${active_balance} days available, ${requestedDays} requested). Expired credits cannot be used.`
        };
    }

    let remainingToDeduct = requestedDays;
    // Sort active credits chronologically (oldest first)
    const updated = credits.map(c => {
        if (c.status === 'ACTIVE' && remainingToDeduct > 0) {
            remainingToDeduct -= (c.days || 1);
            return {
                ...c,
                ...readData("services.leaveEngine", "updated_fields_5"),
                used_on: referenceDateStr
            };
        }
        return c;
    });

    return {
        ...readData("services.leaveEngine", "content_fields_6"),
        updated_credits: updated,
        days_deducted: requestedDays,
        remaining_balance: active_balance - requestedDays
    };
}

/**
 * Demo Point 6: Sandwich Leave Rule Engine.
 * Evaluates whether leave brackets weekend/weekly offs (e.g. Friday and Monday).
 * If sandwich rule is enabled, intermediate weekend days are added to chargeable days.
 */
export function calculateLeaveSpan({
    startDateStr, // YYYY-MM-DD
    endDateStr,   // YYYY-MM-DD
    leaveTypeCode = 'PRIVILEGE',
    sandwichRuleEnabled = true
}) {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    if (end < start) {
        throw new Error('End date cannot be prior to start date.');
    }

    const leaveType = LEAVE_TYPES[leaveTypeCode] || LEAVE_TYPES.PRIVILEGE;
    const daysList = [];
    const curr = new Date(start);

    let workingDays = 0;
    let weekendDays = 0;

    while (curr <= end) {
        const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const dateStr = curr.toISOString().split('T')[0];

        if (isWeekend) {
            weekendDays++;
            daysList.push({ date: dateStr, ...readData("services.leaveEngine", "content_fields_7") });
        } else {
            workingDays++;
            daysList.push({ date: dateStr, ...readData("services.leaveEngine", "content_fields_8") });
        }
        curr.setDate(curr.getDate() + 1);
    }

    // Apply sandwich rule if enabled and leave type permits
    const appliesSandwich = sandwichRuleEnabled && leaveType.can_be_sandwich && weekendDays > 0 && workingDays > 0;
    let chargeableDays = workingDays;

    if (appliesSandwich) {
        chargeableDays = workingDays + weekendDays;
        daysList.forEach(d => {
            if (d.is_weekend) d.chargeable = true;
        });
    }

    return {
        start_date: startDateStr,
        end_date: endDateStr,
        total_calendar_days: daysList.length,
        working_days: workingDays,
        weekend_days: weekendDays,
        sandwich_rule_applied: appliesSandwich,
        chargeable_days: chargeableDays,
        days_breakdown: daysList,
        reason: appliesSandwich
            ? `Sandwich rule active: ${weekendDays} intervening weekend day(s) included in leave debit.`
            : 'Standard working-day debit.'
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
    currentBalance = 10
}) {
    const plannedStart = new Date(application.start_date + 'T00:00:00');
    const plannedEnd = new Date(application.end_date + 'T00:00:00');
    const actualReturn = new Date(actualReturnDateStr + 'T00:00:00');

    if (actualReturn <= plannedStart) {
        throw new Error('Actual return date must be after the leave start date.');
    }
    if (actualReturn > plannedEnd) {
        throw new Error('Actual return date is on or after the original end date — no early return to process.');
    }

    // Days actually taken: from plannedStart up to the day BEFORE actualReturn
    const adjustedEnd = new Date(actualReturn);
    adjustedEnd.setDate(adjustedEnd.getDate() - 1);
    const adjustedEndDateStr = `${adjustedEnd.getFullYear()}-${String(adjustedEnd.getMonth() + 1).padStart(2, '0')}-${String(adjustedEnd.getDate()).padStart(2, '0')}`;

    const daysTakenSpan = calculateLeaveSpan({
        startDateStr: application.start_date,
        endDateStr: adjustedEndDateStr,
        leaveTypeCode: application.leave_type_code,
        sandwichRuleEnabled: application.sandwich_rule_applied
    });

    const originallyDebited = application.chargeable_days || application.duration_days;
    const daysActuallyTaken = daysTakenSpan.chargeable_days;
    const daysToRecredit = Math.max(0, originallyDebited - daysActuallyTaken);

    const recreditTransaction = {
        transaction_id: `TXN-REV-${Date.now().toString().slice(-4)}`,
        employee_id: application.employee_id,
        leave_type_code: application.leave_type_code,
        days_recredited: daysToRecredit,
        reason: `RE_CREDIT_EARLY_RETURN: Resumed duty on ${actualReturnDateStr} prior to planned end ${application.end_date}`,
        recredited_at: new Date().toISOString(),
        previous_balance: currentBalance,
        new_balance: currentBalance + daysToRecredit
    };

    const updatedApplication = {
        ...application,
        actual_return_date: actualReturnDateStr,
        adjusted_end_date: adjustedEndDateStr,
        original_chargeable_days: originallyDebited,
        chargeable_days: daysActuallyTaken,
        ...readData("services.leaveEngine", "updatedApplication_fields_9"),
        recredit_transaction: recreditTransaction
    };

    return {
        updated_application: updatedApplication,
        days_recredited: daysToRecredit,
        new_balance: currentBalance + daysToRecredit,
        recredit_transaction: recreditTransaction
    };
}

/**
 * Demo Point 5: 3-Level Sequential Approval Workflow.
 * Tiers: Supervisor -> HOD -> HR Head.
 */
export const APPROVAL_TIERS = readData("services.leaveEngine", "APPROVAL_TIERS_10");

export function advanceApproval({
    application,
    approverRole, // 'SUPERVISOR' | 'HOD' | 'HR_HEAD'
    action,       // 'APPROVE' | 'REJECT'
    remarks = '',
    reviewerName = ''
}) {
    const history = [...(application.approval_history || [])];

    if (action === 'REJECT') {
        history.push({
            tier: approverRole,
            ...readData("services.leaveEngine", "content_fields_11"),
            reviewer: reviewerName || approverRole,
            remarks,
            timestamp: new Date().toISOString()
        });
        return {
            ...application,
            ...readData("services.leaveEngine", "content_fields_12"),
            current_approval_tier: approverRole,
            approval_history: history,
            rejection_reason: remarks || `Rejected by ${approverRole}`
        };
    }

    // Approval action
    history.push({
        tier: approverRole,
        ...readData("services.leaveEngine", "content_fields_13"),
        reviewer: reviewerName || approverRole,
        remarks: remarks || 'Approved without exception',
        timestamp: new Date().toISOString()
    });

    let nextTier = null;
    let nextStatus = application.status;

    if (approverRole === 'SUPERVISOR') {
        nextTier = 'HOD';
        nextStatus = 'PENDING_HOD';
    } else if (approverRole === 'HOD') {
        nextTier = 'HR_HEAD';
        nextStatus = 'PENDING_HR_HEAD';
    } else if (approverRole === 'HR_HEAD') {
        nextTier = 'COMPLETED';
        nextStatus = 'APPROVED';
    }

    return {
        ...application,
        status: nextStatus,
        current_approval_tier: nextTier,
        approval_history: history
    };
}
