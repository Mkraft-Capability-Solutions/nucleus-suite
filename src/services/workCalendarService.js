
import { readData } from './workspace-data.mjs';
/**
 * Nucleus HRMS — Work Calendar and Worker Categories Subsystem (Gap G2)
 * Governs rest days, wage types (monthly vs daily), OT eligibility, and multi-plant calendars.
 */

export const WORKER_CATEGORIES = readData("services.workCalendarService", "WORKER_CATEGORIES_1");

export const WORK_CALENDARS = readData("services.workCalendarService", "WORK_CALENDARS_2");

/**
 * Resolves day type (working, weekly_off, holiday) for an employee on a given date.
 * MUST be resolved BEFORE applying shift thresholds, so rest-day punches are not scored as short days.
 */
export function resolveDayType({
    calendarId = 'LOC-BLR-01',
    dateStr, // YYYY-MM-DD
    workerCategoryCode = 'PERM',
    employeeOverrides = {}
}) {
    const category = WORKER_CATEGORIES[workerCategoryCode] || WORKER_CATEGORIES.PERM;
    const calendar = WORK_CALENDARS[calendarId] || WORK_CALENDARS['LOC-BLR-01'];
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

    // 1. Check Holiday for this plant's calendar
    const isHoliday = calendar.holidays_2026.find(h => h.date === dateStr);
    if (isHoliday) {
        return {
            ...readData("services.workCalendarService", "content_fields_3"),
            label: isHoliday.name,
            ...readData("services.workCalendarService", "content_fields_4") // Double wage on statutory holidays
        };
    }

    // 2. Check Rest Day / Weekly Off based on Worker Category
    const hasRestDays = employeeOverrides.has_rest_days !== undefined
        ? employeeOverrides.has_rest_days
        : category.has_rest_days;

    if (hasRestDays) {
        // Sunday is default weekly off
        if (dayOfWeek === 0) {
            return {
                ...readData("services.workCalendarService", "content_fields_5"),
                is_payable: category.wage_type === 'monthly',
                ...readData("services.workCalendarService", "content_fields_6")
            };
        }
        // Custom rest day override
        if (employeeOverrides.rest_day_override && employeeOverrides.rest_day_override.includes(dayOfWeek)) {
            return {
                ...readData("services.workCalendarService", "content_fields_7"),
                is_payable: category.wage_type === 'monthly',
                ...readData("services.workCalendarService", "content_fields_8")
            };
        }
    }

    // 3. Regular Working Day
    return readData("services.workCalendarService", "content_9");
}

/**
 * Checks whether an employee is eligible for OT on the resolved day type.
 */
export function isOTEligible({
    workerCategoryCode = 'PERM',
    dayType = 'working',
    employeeOverride = null
}) {
    const category = WORKER_CATEGORIES[workerCategoryCode] || WORKER_CATEGORIES.PERM;
    const rule = employeeOverride || category.ot_eligibility;

    if (rule === 'all') return true;
    if (rule === 'none') return false;
    if (rule === 'restday_holiday_only') {
        return dayType === 'weekly_off' || dayType === 'holiday';
    }
    return false;
}
