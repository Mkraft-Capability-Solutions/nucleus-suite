
import { readData } from './workspace-data.mjs';
/**
 * Nucleus HRMS — Deterministic Time-Office Rule Engine (Gap G1)
 * Covers: Cross-midnight punch pairing, break reports, shift thresholds,
 * late forgiveness (3 forgiven, 4th = half-day), Asst. Mgr exemption,
 * long-night relief, auto shift inference, and gate-pass quotas.
 */

import { resolveDayType, isOTEligible } from './workCalendarService.js';

export const RULESET_VERSION = 'v1.2.0-2026.09';

// Shift Threshold Configuration (Held as configuration, not code)
export const SHIFT_RULES = readData("services.timeOfficeEngine", "SHIFT_RULES_1");

// Managerial exemption list for grace deductions
export const EXEMPT_DESIGNATION_PATTERNS = [
    /assistant\s*manager/i,
    /asst\.?\s*manager/i,
    /manager/i,
    /senior\s*manager/i,
    /director/i,
    /vice\s*president/i,
    /vp/i,
    /chro/i,
    /c-suite/i,
    /lead\s*architect/i
];

export function isGraceExempt(designation = '') {
    if (!designation) return false;
    return EXEMPT_DESIGNATION_PATTERNS.some(pattern => pattern.test(designation));
}

/**
 * Parses timestamp string (ISO or YYYY-MM-DD HH:MM:SS) into Date
 */
function parseTS(ts) {
    return new Date(ts);
}

/**
 * Calculates minute difference between two Date objects or timestamp strings
 */
export function diffMinutes(start, end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(0, Math.round((e - s) / (1000 * 60)));
}

/**
 * Formats minutes into human-readable "19h 20m" format
 */
export function formatMinutes(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

/**
 * Auto-detects/infers shift from first in-punch
 */
export function inferShift(firstInPunchTimeStr, assignedShiftId = 'SHIFT-8H') {
    // Punch time format: "HH:MM" e.g. "14:02"
    const [pHour, pMin] = firstInPunchTimeStr.split(':').map(Number);
    const punchMins = pHour * 60 + pMin;

    for (const shift of Object.values(SHIFT_RULES)) {
        if (!shift.window) continue;
        const [eH, eM] = shift.window.earliest_in.split(':').map(Number);
        const [lH, lM] = shift.window.latest_in.split(':').map(Number);
        const eMins = eH * 60 + eM;
        const lMins = lH * 60 + lM;

        if (eMins <= lMins) {
            if (punchMins >= eMins && punchMins <= lMins) {
                return {
                    shift_id: shift.id,
                    inferred: shift.id !== assignedShiftId,
                    reason: shift.id !== assignedShiftId
                        ? `Auto-inferred ${shift.name} from in-punch at ${firstInPunchTimeStr} (window ${shift.window.earliest_in}–${shift.window.latest_in})`
                        : 'Matched assigned shift schedule'
                };
            }
        }
    }

    return {
        shift_id: assignedShiftId,
        ...readData("services.timeOfficeEngine", "content_fields_2")
    };
}

/**
 * Pairs raw chronological punches into work segments and breaks.
 * A day belongs to the shift it started in — an 08:00 in-punch with a 03:20 out-punch
 * next morning is ONE attendance day of 19h 20m.
 */
export function pairPunches(rawPunches = []) {
    // Sort punches chronologically
    const sorted = [...rawPunches].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const segments = [];
    const breaks = [];
    let currentIn = null;
    let lastOut = null;
    let seq = 1;

    for (const p of sorted) {
        if (p.type === 'IN') {
            // Check if there was a previous OUT to form an intermediate break
            if (lastOut) {
                const breakMins = diffMinutes(lastOut.timestamp, p.timestamp);
                if (breakMins > 0) {
                    breaks.push({
                        id: `BRK-${seq}`,
                        from_ts: lastOut.timestamp,
                        to_ts: p.timestamp,
                        minutes: breakMins,
                        type: breakMins >= 40 ? 'DINNER_BREAK' : 'TEA_BREAK',
                        ...readData("services.timeOfficeEngine", "content_fields_3")
                    });
                }
                lastOut = null;
            }
            if (!currentIn) {
                currentIn = p;
            }
        } else if (p.type === 'OUT') {
            if (currentIn) {
                segments.push({
                    seq: seq++,
                    in_ts: currentIn.timestamp,
                    out_ts: p.timestamp,
                    source: currentIn.source || 'BIOMETRIC',
                    device_id: currentIn.device_id || 'TURNSTILE-GATE-01',
                    duration_minutes: diffMinutes(currentIn.timestamp, p.timestamp)
                });
                lastOut = p;
                currentIn = null;
            }
        }
    }

    // If still clocked in without out-punch
    if (currentIn) {
        segments.push({
            seq: seq++,
            in_ts: currentIn.timestamp,
            ...readData("services.timeOfficeEngine", "content_fields_4"),
            source: currentIn.source || 'BIOMETRIC',
            device_id: currentIn.device_id || 'TURNSTILE-GATE-01',
            ...readData("services.timeOfficeEngine", "content_fields_5")
        });
    }

    return { segments, breaks };
}

/**
 * Evaluates monthly Gate Pass quota (Maximum 240 minutes and 2 requests per month).
 */
export function validateGatePassQuota(existingApprovedGatePasses = [], newMinutes = 60) {
    const totalMinutes = existingApprovedGatePasses.reduce((sum, gp) => sum + (gp.minutes || 0), 0);
    const count = existingApprovedGatePasses.length;

    if (count >= 2) {
        return {
            ...readData("services.timeOfficeEngine", "content_fields_6"),
            reason: `Monthly gate pass quota reached (Maximum 2 requests per month, currently ${count}/2 used).`
        };
    }

    if (totalMinutes + newMinutes > 240) {
        return {
            ...readData("services.timeOfficeEngine", "content_fields_7"),
            reason: `Exceeds monthly gate pass duration ceiling of 240 minutes (${totalMinutes} min used + ${newMinutes} min requested = ${totalMinutes + newMinutes} min).`
        };
    }

    return {
        ...readData("services.timeOfficeEngine", "content_fields_8"),
        remaining_minutes: 240 - (totalMinutes + newMinutes),
        remaining_requests: 2 - (count + 1)
    };
}

/**
 * Pure Deterministic Time-Office Recompute Engine for an Attendance Day.
 */
export function computeAttendanceDay({
    employee,
    attendanceDate, // YYYY-MM-DD
    rawPunches = [],
    assignedShiftId = 'SHIFT-8H',
    priorAttendanceDay = null, // Used for long-night relief calculation
    approvedGatePasses = [], // Personal gate passes for this day
    monthlyLateCount = 0 // Prior late instances in the same month
}) {
    // 1. Resolve Work Calendar and Worker Category first
    const dayContext = resolveDayType({
        calendarId: employee.location_id || 'LOC-BLR-01',
        dateStr: attendanceDate,
        workerCategoryCode: employee.worker_category_code || 'PERM',
        employeeOverrides: employee.overrides || {}
    });

    // 2. Punch Pairing & Break Extraction
    const { segments, breaks } = pairPunches(rawPunches);

    // If no punches recorded
    if (segments.length === 0) {
        if (dayContext.day_type === 'weekly_off') {
            return {
                attendance_date: attendanceDate,
                ...readData("services.timeOfficeEngine", "content_fields_9"),
                status_reason: dayContext.label,
                ...readData("services.timeOfficeEngine", "content_fields_10"),
                computed_by_ruleset_version: RULESET_VERSION
            };
        }
        if (dayContext.day_type === 'holiday') {
            return {
                attendance_date: attendanceDate,
                ...readData("services.timeOfficeEngine", "content_fields_11"),
                status_reason: dayContext.label,
                ...readData("services.timeOfficeEngine", "content_fields_12"),
                computed_by_ruleset_version: RULESET_VERSION
            };
        }
        return {
            attendance_date: attendanceDate,
            ...readData("services.timeOfficeEngine", "content_fields_13"),
            computed_by_ruleset_version: RULESET_VERSION
        };
    }

    // 3. Shift Inference
    const firstIn = segments[0]?.in_ts ? new Date(segments[0].in_ts) : null;
    const firstInTimeStr = firstIn
        ? `${firstIn.getHours().toString().padStart(2, '0')}:${firstIn.getMinutes().toString().padStart(2, '0')}`
        : '09:00';

    const inferredShiftInfo = inferShift(firstInTimeStr, assignedShiftId);
    const activeShift = SHIFT_RULES[inferredShiftInfo.shift_id] || SHIFT_RULES['SHIFT-8H'];

    // 4. Gross Span & Break Minutes
    const firstInTs = segments[0]?.in_ts;
    const lastOutTs = segments[segments.length - 1]?.out_ts;
    const grossMinutes = (firstInTs && lastOutTs)
        ? diffMinutes(firstInTs, lastOutTs)
        : segments.reduce((sum, seg) => sum + (seg.duration_minutes || 0), 0);

    const unpaidBreakMinutes = breaks
        .filter(b => !b.paid)
        .reduce((sum, b) => sum + (b.minutes || 0), 0);

    // Approved personal gate pass minutes add to net hours
    const gatePassMinutes = approvedGatePasses.reduce((sum, gp) => sum + (gp.minutes || 0), 0);

    const netMinutes = Math.max(0, grossMinutes - unpaidBreakMinutes + gatePassMinutes);

    // 5. Long-Night Relief Evaluation
    let longNightReliefApplied = false;
    if (priorAttendanceDay && priorAttendanceDay.last_out_ts) {
        const lastOut = new Date(priorAttendanceDay.last_out_ts);
        // Worked past 03:00 AM of attendance date morning
        if (lastOut.getHours() >= 3 && lastOut.getHours() < 7) {
            longNightReliefApplied = true;
        }
    }

    // 6. Grace Period & Late In Calculation
    const [sHours, sMins] = activeShift.start_time.split(':').map(Number);
    const scheduledInMinutes = sHours * 60 + sMins;
    const actualInMinutes = firstIn ? firstIn.getHours() * 60 + firstIn.getMinutes() : scheduledInMinutes;
    const isLate = actualInMinutes > (scheduledInMinutes + activeShift.grace_in_minutes);

    const isExempt = isGraceExempt(employee.designation);
    let lateInstanceNo = 0;
    let lateForgiven = false;
    let latePenaltyHalfDay = false;

    if (isLate && !isExempt && !longNightReliefApplied) {
        lateInstanceNo = monthlyLateCount + 1;
        if (lateInstanceNo <= 3) {
            // First 3 late clock-ins are forgiven
            lateForgiven = true;
        } else {
            // 4th and beyond convert to half-day
            latePenaltyHalfDay = true;
        }
    }

    // 7. Status & Thresholds Determination
    let status = 'present';
    let statusReason = 'Shift fulfilled within standard tolerances';

    if (dayContext.day_type === 'weekly_off') {
        status = 'present';
        statusReason = `Worked on ${dayContext.label} (Eligible for Rest Day OT / Comp-off)`;
    } else if (dayContext.day_type === 'holiday') {
        status = 'present';
        statusReason = `Worked on ${dayContext.label} (Eligible for Double Holiday Wage)`;
    } else if (latePenaltyHalfDay) {
        status = 'half_day';
        statusReason = `4th monthly late clock-in (${firstInTimeStr} vs ${activeShift.start_time}) — Converted to Half-Day`;
    } else if (netMinutes < activeShift.absent_minutes) {
        status = 'absent';
        statusReason = `Net duration (${formatMinutes(netMinutes)}) fell below absent threshold (${formatMinutes(activeShift.absent_minutes)})`;
    } else if (netMinutes < activeShift.half_day_minutes) {
        status = 'half_day';
        statusReason = `Net duration (${formatMinutes(netMinutes)}) fell below full-day threshold (${formatMinutes(activeShift.half_day_minutes)})`;
    } else if (longNightReliefApplied) {
        status = 'present';
        statusReason = 'Long-Night Relief applied (Prior day shift concluded past 03:00 AM)';
    }

    // 8. Overtime (OT) Calculation
    const otEligible = isOTEligible({
        workerCategoryCode: employee.worker_category_code || 'PERM',
        dayType: dayContext.day_type,
        employeeOverride: employee.ot_eligibility_override
    });

    let otMinutes = 0;
    if (otEligible && netMinutes > activeShift.duration_minutes) {
        otMinutes = netMinutes - activeShift.duration_minutes;
    }

    const lastSegment = segments[segments.length - 1];

    return {
        attendance_date: attendanceDate,
        day_type: dayContext.day_type,
        day_label: dayContext.label,
        shift_id_assigned: assignedShiftId,
        shift_id_inferred: inferredShiftInfo.shift_id,
        shift_inferred: inferredShiftInfo.inferred,
        shift_inference_reason: inferredShiftInfo.reason,
        shift_name: activeShift.name,
        gross_minutes: grossMinutes,
        break_minutes: unpaidBreakMinutes,
        gate_pass_minutes: gatePassMinutes,
        net_minutes: netMinutes,
        formatted_net: formatMinutes(netMinutes),
        ot_minutes: otMinutes,
        formatted_ot: formatMinutes(otMinutes),
        status: status,
        status_reason: statusReason,
        first_in_ts: segments[0]?.in_ts,
        last_out_ts: lastSegment?.out_ts,
        segments: segments,
        breaks: breaks,
        is_late: isLate,
        late_instance_no: lateInstanceNo,
        late_forgiven: lateForgiven,
        is_grace_exempt: isExempt,
        long_night_relief: longNightReliefApplied,
        computed_at: new Date().toISOString(),
        computed_by_ruleset_version: RULESET_VERSION
    };
}
