import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Onboarding workspace — upcoming birthdays, work anniversaries and new joiners.
 *
 * Read model over `employees.date_of_birth` and `employees.joining_date` (both indexed by
 * month and day in migration 0024). The birth year never leaves the server: a birthday is
 * returned as its next occurrence only. Birthdays additionally need the sensitive
 * `employee.birthdate.read` permission; without it the section reports itself unavailable
 * instead of showing an empty list.
 */

export const celebrationsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(30),
});

export type CelebrationsQuery = z.infer<typeof celebrationsQuerySchema>;

export type CelebrationPerson = {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string | null;
  /** The next date (YYYY-MM-DD) the event falls on, within the window. */
  occursOn: string;
  /** Completed years at `occursOn` (anniversaries only). */
  years: number | null;
};

export type CelebrationSection =
  | { available: true; items: CelebrationPerson[] }
  | { available: false; reason: "permission"; items: [] };

export type Celebrations = {
  windowDays: number;
  today: string;
  birthdays: CelebrationSection;
  anniversaries: CelebrationSection;
  newJoiners: CelebrationSection;
};

const MAX_PER_SECTION = 12;
/** Joiners whose first day falls in the last N days still count as new. */
const NEW_JOINER_LOOKBACK_DAYS = 30;
const INACTIVE_STATUSES = ["exited", "inactive", "terminated", "resigned"];

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * The MM-DD keys a date column has to match to fall inside [today, today + days].
 * In a non-leap year a 29 February date is celebrated on 28 February, so it is
 * added whenever 28 February is in the window.
 */
export function monthDayWindow(today: string, days: number): string[] {
  const keys: string[] = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const day = addDays(today, offset);
    const key = day.slice(5);
    keys.push(key);
    if (key === "02-28" && !isLeapYear(Number(day.slice(0, 4)))) keys.push("02-29");
  }
  return Array.from(new Set(keys));
}

/** Next date on or after `today` that carries the month and day of `source`. */
export function nextOccurrence(source: string, today: string): string {
  const month = source.slice(5, 7);
  const day = source.slice(8, 10);
  let year = Number(today.slice(0, 4));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const useDay = month === "02" && day === "29" && !isLeapYear(year) ? "28" : day;
    const candidate = `${year}-${month}-${useDay}`;
    if (candidate >= today) return candidate;
    year += 1;
  }
  const useDay = month === "02" && day === "29" && !isLeapYear(year) ? "28" : day;
  return `${year}-${month}-${useDay}`;
}

type EmployeeDateRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string | null;
  event_date: string;
};

function toPerson(row: EmployeeDateRow, occursOn: string, years: number | null): CelebrationPerson {
  return {
    employeeId: row.id,
    employeeCode: row.employee_code,
    name: `${row.first_name} ${row.last_name}`.trim(),
    department: row.department,
    occursOn,
    years,
  };
}

function byDateThenName(a: CelebrationPerson, b: CelebrationPerson): number {
  return a.occursOn === b.occursOn ? a.name.localeCompare(b.name) : a.occursOn.localeCompare(b.occursOn);
}

export async function listCelebrations(access: Access, query: CelebrationsQuery, now: Date = new Date()): Promise<Celebrations> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const today = isoDay(now);
  const windowKeys = monthDayWindow(today, query.days);
  const windowEnd = addDays(today, query.days);
  const joinerFrom = addDays(today, -NEW_JOINER_LOOKBACK_DAYS);
  const mayReadBirthdays = authorize(access.context, {
    action: "employee.birthdate.read",
    resource: { tenantId: access.tenantId },
  }).allowed;

  const [birthdayRows, anniversaryRows, joinerRows] = await tenantTx(access, [
    mayReadBirthdays
      ? sqlClient`select id, employee_code, first_name, last_name, department, date_of_birth::text as event_date
          from employees
          where tenant_id = ${access.tenantId} and date_of_birth is not null
            and lower(coalesce(status, '')) <> all(${INACTIVE_STATUSES}::text[])
            and to_char(date_of_birth, 'MM-DD') = any(${windowKeys}::text[])
          limit 200`
      : sqlClient`select null::uuid as id where false`,
    sqlClient`select id, employee_code, first_name, last_name, department, joining_date::text as event_date
      from employees
      where tenant_id = ${access.tenantId} and joining_date is not null and joining_date < ${today}::date
        and lower(coalesce(status, '')) <> all(${INACTIVE_STATUSES}::text[])
        and to_char(joining_date, 'MM-DD') = any(${windowKeys}::text[])
      limit 200`,
    sqlClient`select id, employee_code, first_name, last_name, department, joining_date::text as event_date
      from employees
      where tenant_id = ${access.tenantId} and joining_date between ${joinerFrom}::date and ${windowEnd}::date
        and lower(coalesce(status, '')) <> all(${INACTIVE_STATUSES}::text[])
      order by joining_date asc
      limit ${MAX_PER_SECTION}`,
  ]);

  const birthdays = (birthdayRows as EmployeeDateRow[])
    .map((row) => toPerson(row, nextOccurrence(row.event_date, today), null))
    .filter((person) => person.occursOn <= windowEnd)
    .sort(byDateThenName)
    .slice(0, MAX_PER_SECTION);

  const anniversaries = (anniversaryRows as EmployeeDateRow[])
    .map((row) => {
      const occursOn = nextOccurrence(row.event_date, today);
      return toPerson(row, occursOn, Number(occursOn.slice(0, 4)) - Number(row.event_date.slice(0, 4)));
    })
    .filter((person) => person.occursOn <= windowEnd && (person.years ?? 0) >= 1)
    .sort(byDateThenName)
    .slice(0, MAX_PER_SECTION);

  const newJoiners = (joinerRows as EmployeeDateRow[]).map((row) => toPerson(row, row.event_date, null));

  return {
    windowDays: query.days,
    today,
    birthdays: mayReadBirthdays ? { available: true, items: birthdays } : { available: false, reason: "permission", items: [] },
    anniversaries: { available: true, items: anniversaries },
    newJoiners: { available: true, items: newJoiners },
  };
}
