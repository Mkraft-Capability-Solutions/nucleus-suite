import { EmployeeContext } from './models';

export function resolveDayType({
    calendarId = 'LOC-BLR-01',
    dateStr,
    workerCategoryCode = 'PERM',
    employeeOverrides = {},
    holidays = [],
    workerCategory = { has_rest_days: true, wage_type: 'monthly', ot_eligibility: 'restday_holiday_only' }
}: {
    calendarId?: string,
    dateStr: string,
    workerCategoryCode?: string,
    employeeOverrides?: any,
    holidays: { date: string, name: string }[],
    workerCategory: any
}) {
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

    const isHoliday = holidays.find(h => h.date === dateStr);
    if (isHoliday) {
        return {
            day_type: 'holiday',
            label: isHoliday.name,
            is_payable: true
        };
    }

    const hasRestDays = employeeOverrides.has_rest_days !== undefined
        ? employeeOverrides.has_rest_days
        : workerCategory.has_rest_days;

    if (hasRestDays) {
        if (dayOfWeek === 0) {
            return {
                day_type: 'weekly_off',
                is_payable: workerCategory.wage_type === 'monthly',
                label: 'Sunday Rest Day'
            };
        }
        if (employeeOverrides.rest_day_override && employeeOverrides.rest_day_override.includes(dayOfWeek)) {
            return {
                day_type: 'weekly_off',
                is_payable: workerCategory.wage_type === 'monthly',
                label: 'Custom Rest Day'
            };
        }
    }

    return {
        day_type: 'working',
        is_payable: true,
        label: 'Regular Working Day'
    };
}

export function isOTEligible({
    workerCategoryCode = 'PERM',
    dayType = 'working',
    employeeOverride = null,
    workerCategory = { ot_eligibility: 'restday_holiday_only' }
}: {
    workerCategoryCode?: string,
    dayType?: string,
    employeeOverride?: any,
    workerCategory: any
}) {
    const rule = employeeOverride || workerCategory.ot_eligibility;

    if (rule === 'all') return true;
    if (rule === 'none') return false;
    if (rule === 'restday_holiday_only') {
        return dayType === 'weekly_off' || dayType === 'holiday';
    }
    return false;
}
