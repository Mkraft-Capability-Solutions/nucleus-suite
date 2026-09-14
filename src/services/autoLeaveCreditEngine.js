/**
 * Auto Leave Credit Engine — Demo Point #7
 * Full leave credit and proration rules for Nucleus HRMS prototype.
 */

const SENIOR_MANAGEMENT_DESIGNATIONS = [
    'AGM', 'DGM', 'GM', 'VP', 'SVP', 'EVP', 'Director', 'MD', 'CEO', 'COO', 'CFO', 'CTO', 'CHRO',
    'Assistant General Manager', 'Deputy General Manager', 'General Manager',
    'Vice President', 'Senior Vice President', 'Executive Vice President',
];

export function isSeniorManagement(designation = '') {
    const d = designation.trim().toLowerCase();
    return SENIOR_MANAGEMENT_DESIGNATIONS.some(s => d.startsWith(s.toLowerCase()) || d.includes(s.toLowerCase()));
}

export function getCLSLProration(joiningMonth) {
    if (joiningMonth === 1) return 6;
    if (joiningMonth <= 3) return 5;
    if (joiningMonth <= 5) return 4;
    if (joiningMonth <= 7) return 3;
    if (joiningMonth <= 9) return 2;
    return 1;
}

export function getNewJoinerELCredit(joiningDate, referenceDate = new Date()) {
    const joining = new Date(joiningDate);
    const ref = new Date(referenceDate);
    const monthsWorked = (ref.getFullYear() - joining.getFullYear()) * 12 + (ref.getMonth() - joining.getMonth());
    if (monthsWorked < 6) return { elDays: 0, note: 'EL not eligible until 6 months of service' };
    if (monthsWorked === 6) return { elDays: 9, note: '9 EL credited on completion of 6 months' };
    const accrualMonths = monthsWorked - 6;
    return { elDays: Math.floor(accrualMonths * 1.5), note: `${accrualMonths} months x 1.5 EL` };
}

export function computeAutoLeaveAllocation(employee, referenceDate = new Date()) {
    const ref = new Date(referenceDate);
    const joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : null;
    const workerCategory = employee.workerCategory || 'PERM';
    const designation = employee.designation || '';
    const notes = [];

    if (workerCategory === 'CONTRACT') {
        return { EL: 0, CL: 0, SL: 0, BL: 0, notes: ['Contractual employees are not eligible for leave credit.'], isEligible: false };
    }

    if (employee.isTrainee || workerCategory === 'TRAINEE_DET' || workerCategory === 'TRAINEE_GET') {
        const joiningMonth = joiningDate ? joiningDate.getMonth() + 1 : 1;
        const cl = getCLSLProration(joiningMonth);
        return {
            EL: 0, CL: cl, SL: 0, BL: 1,
            notes: [`Trainee (${employee.traineeType || 'DET/GET'}): CL only`, `CL = ${cl} days (prorated from joining month ${joiningMonth})`, 'Birthday Leave: 1 day'],
            isEligible: true,
        };
    }

    if (isSeniorManagement(designation)) {
        notes.push(`Senior Management (${designation}): Fixed annual credit on Jan 1 — 18 EL + 6 CL + 6 SL + 1 BL`);
        return { EL: 18, CL: 6, SL: 6, BL: 1, notes, isEligible: true };
    }

    if (!joiningDate) {
        return { EL: 18, CL: 6, SL: 6, BL: 1, notes: ['Joining date not set; using full year defaults'], isEligible: true };
    }

    const joiningYear = joiningDate.getFullYear();
    const currentYear = ref.getFullYear();
    const joiningMonth = joiningDate.getMonth() + 1;
    let elDays, clDays, slDays;

    if (joiningYear < currentYear) {
        elDays = 18; clDays = 6; slDays = 6;
        notes.push('Existing employee: full annual credit (18 EL, 6 CL, 6 SL)');
    } else {
        const { elDays: el, note: elNote } = getNewJoinerELCredit(joiningDate, ref);
        elDays = el;
        clDays = getCLSLProration(joiningMonth);
        slDays = getCLSLProration(joiningMonth);
        notes.push(`EL: ${elNote}`);
        notes.push(`CL: ${clDays} days (joining month ${joiningMonth})`);
        notes.push(`SL: ${slDays} days (joining month ${joiningMonth})`);
    }

    notes.push('Birthday Leave: 1 day');
    notes.push('Restrictions: Max 2 CL/month, Max 10 EL/month. CL cannot merge with EL or SL.');
    notes.push('Year-end: EL encashed, CL+SL lapsed.');

    return { EL: elDays, CL: clDays, SL: slDays, BL: 1, notes, isEligible: true };
}

export function evaluateCOFFLapse(coffCredits = []) {
    const now = Date.now();
    const LAPSE_MS = 60 * 24 * 60 * 60 * 1000;
    const WARN_MS = 7 * 24 * 60 * 60 * 1000;
    const active = [], lapsed = [], expiringSoon = [];

    for (const credit of coffCredits) {
        const creditDate = new Date(credit.credit_date || credit.creditDate || credit.date || now);
        const age = now - creditDate.getTime();
        const lapseDate = new Date(creditDate.getTime() + LAPSE_MS).toISOString().split('T')[0];

        if (age > LAPSE_MS) {
            lapsed.push({ ...credit, status: 'LAPSED_60_DAYS', lapseDate });
        } else {
            const daysLeft = Math.ceil((LAPSE_MS - age) / (24 * 60 * 60 * 1000));
            active.push({ ...credit, status: 'ACTIVE', daysLeft, lapseDate });
            if (age > (LAPSE_MS - WARN_MS)) expiringSoon.push({ ...credit, daysLeft, lapseDate });
        }
    }
    return { active, lapsed, expiringSoon };
}

export function validateLeaveRestrictions(leaveType, existingLeaves = [], days = 1) {
    if (leaveType === 'CL') {
        const thisMonthCL = existingLeaves
            .filter(l => l.leave_type_code === 'CL' && l.status !== 'REJECTED' && l.status !== 'CANCELLED')
            .reduce((sum, l) => sum + (l.chargeable_days || l.numberOfDays || 1), 0);
        if (thisMonthCL + days > 2)
            return { allowed: false, reason: `CL limit is 2 days per month. Already taken ${thisMonthCL} day(s) this month.` };
        const hasELorSL = existingLeaves.some(l =>
            (l.leave_type_code === 'EL' || l.leave_type_code === 'SL') && l.status !== 'REJECTED' && l.status !== 'CANCELLED'
        );
        if (hasELorSL) return { allowed: false, reason: 'CL cannot be combined with EL or SL in the same period.' };
    }
    if (leaveType === 'EL') {
        const thisMonthEL = existingLeaves
            .filter(l => l.leave_type_code === 'EL' && l.status !== 'REJECTED' && l.status !== 'CANCELLED')
            .reduce((sum, l) => sum + (l.chargeable_days || l.numberOfDays || 1), 0);
        if (thisMonthEL + days > 10)
            return { allowed: false, reason: `EL limit is 10 days per month. Already taken ${thisMonthEL} day(s) this month.` };
    }
    return { allowed: true, reason: null };
}
