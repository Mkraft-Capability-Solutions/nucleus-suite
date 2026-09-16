import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Employee milestones — upcoming birthdays, work anniversaries and new joiners.
 *
 * All three panels are derived from columns the `employees` record already
 * carries: `date_of_birth` (added by `0023_lifecycle_letters_recognition`) and
 * the long-standing `joining_date`. Nothing here invents a person, a date or a
 * celebration; where a column is empty the board reports that the data is not
 * recorded rather than returning an empty list that reads as "nobody has one".
 *
 * PRIVACY — `date_of_birth` is personal data and its YEAR reveals age.
 *
 *  - Reading it is gated behind `employee.birthdate.read`, the permission the
 *    migration registers for exactly this purpose. A caller without it still
 *    gets the anniversaries, the new joiners and the board itself; only the
 *    birthday panel comes back unavailable, with the reason stated.
 *  - The birthday query never selects the column. It selects
 *    `extract(month …)` and `extract(day …)` only, so the year is not in the
 *    result set, not in this process's memory and not in the response. That is
 *    also what makes `employees_birthday_idx` — an index on exactly those two
 *    expressions — the index the planner can use.
 *  - Work anniversaries DO carry the year, because completed years of service
 *    is the entire point of the panel.
 *
 * The fourth panel of SCR "Recognition & Events", the recognition hall of fame,
 * is deliberately NOT here: `@/server/engagement/recognition-register` already
 * loads award records with their citation, programme, award value and state,
 * and `GET /api/v1/recognition-register` already serves them. Re-deriving them
 * here would be a second, divergent read model of the same table.
 */

/* ------------------------------------------------------------------ */
/* Rules stated as data                                                */
/* ------------------------------------------------------------------ */

/** The permission `0023_lifecycle_letters_recognition` registers for birth dates. */
export const BIRTHDATE_PERMISSION = "employee.birthdate.read";

/** The rolling window, counted inclusive of today. */
export const DEFAULT_WINDOW_DAYS = 14;

/** How far back a joiner still counts as new, and how far ahead one is expected. */
export const DEFAULT_JOINER_LOOKBACK_DAYS = 30;

/**
 * What the birthday panel says when it has nothing to show, and why the two
 * cases are different. An empty list under "no birth dates recorded" would
 * claim that nobody in the tenant has a birthday this fortnight, which is a
 * statement about people rather than about the data.
 */
export const BIRTHDATE_COVERAGE_NOTE = {
  none: "No birth dates are recorded on any active employee record, so no birthday can be derived. This is a gap in the data, not a fortnight without birthdays.",
  partial:
    "Birthdays can only be derived for employees whose record carries a date of birth. Anybody whose record does not is absent from this panel.",
} as const;

export const BIRTHDATE_PRIVACY_NOTE =
  "Only the month and the day of each birth date are read and returned. The birth year is never selected, so it cannot be shown, exported or used to derive an age.";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* The pure calendar maths                                             */
/* ------------------------------------------------------------------ */

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  // Rejects 2025-02-30 and friends: the round trip only survives a real date.
  const [year, month, day] = value.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCFullYear() === year && at.getUTCMonth() + 1 === month && at.getUTCDate() === day;
}

function utcMillis(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isoFrom(millis: number): string {
  return new Date(millis).toISOString().slice(0, 10);
}

/** One calendar day inside the window. `offset` is 0 for today. */
export type WindowDay = { date: string; month: number; day: number; offset: number };

/**
 * The rolling window as real calendar days, starting on `asOf` and counted
 * inclusive of it.
 *
 * Built by walking real dates in UTC rather than by incrementing a month/day
 * pair, so it crosses a year boundary without special-casing: a window opened
 * on 28 December runs into January, and matching on month and day then finds a
 * 3 January birthday exactly as it finds a 30 December one.
 *
 * 29 February appears in the window only in a leap year, which is the same
 * convention `@/server/engagement/occasion-announcements` applies: no source in
 * this product states a substitute date for a 29 February birthday in a common
 * year, and one is not invented here.
 */
export function rollingWindow(asOf: string, days: number): WindowDay[] {
  if (!isIsoDate(asOf) || !Number.isInteger(days) || days <= 0) return [];
  const start = utcMillis(asOf);
  const window: WindowDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const at = new Date(start + offset * MS_PER_DAY);
    window.push({
      date: isoFrom(at.getTime()),
      month: at.getUTCMonth() + 1,
      day: at.getUTCDate(),
      offset,
    });
  }
  return window;
}

/** `MM-DD`, the key a birthday or an anniversary is matched on. */
export function monthDayKey(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The distinct months and days the window spans.
 *
 * These are the two arrays the SQL filters on, one per index expression, which
 * is what lets `employees_birthday_idx` and `employees_joining_anniversary_idx`
 * be used. Filtering on them independently matches their CROSS PRODUCT, which
 * is a superset of the window — a 14-day window straddling a month end asks for
 * up to 28 month/day pairs and wants 14 of them. `occurrenceIn` narrows the
 * rows to the exact window afterwards, so the superset never reaches a caller.
 */
export function windowFilter(window: readonly WindowDay[]): { months: number[]; days: number[] } {
  return {
    months: [...new Set(window.map((entry) => entry.month))],
    days: [...new Set(window.map((entry) => entry.day))],
  };
}

/** The window day a month/day pair falls on, or null when it falls outside it. */
export function occurrenceIn(window: readonly WindowDay[], month: number, day: number): WindowDay | null {
  const key = monthDayKey(month, day);
  return window.find((entry) => monthDayKey(entry.month, entry.day) === key) ?? null;
}

/**
 * Completed years between two dates, month-and-day aware.
 *
 * A year is only complete once the anniversary day itself has arrived: joining
 * on 30 December 2019 gives 0 completed years on 2 January 2020, not 1. A date
 * in the future gives 0 rather than a negative count.
 */
export function completedYearsOfService(joiningDate: string, onDate: string): number {
  if (!isIsoDate(joiningDate) || !isIsoDate(onDate)) return 0;
  const [fromYear, fromMonth, fromDay] = joiningDate.split("-").map(Number);
  const [onYear, onMonth, onDay] = onDate.split("-").map(Number);
  let years = onYear - fromYear;
  if (onMonth < fromMonth || (onMonth === fromMonth && onDay < fromDay)) years -= 1;
  return years > 0 ? years : 0;
}

/** Whole days from `from` to `to`; negative when `to` is the earlier date. */
export function daysBetween(from: string, to: string): number {
  if (!isIsoDate(from) || !isIsoDate(to)) return 0;
  return Math.round((utcMillis(to) - utcMillis(from)) / MS_PER_DAY);
}

/** A date the reader can say out loud, carrying no year. */
export function monthDayLabel(month: number, day: number): string {
  const name = MONTH_LABELS[month - 1];
  if (name === undefined || !Number.isInteger(day) || day < 1 || day > 31) return "";
  return `${day} ${name}`;
}

/** Already joined, or due to join. Decided against today, never assumed. */
export type JoinerRelation = "joined" | "joining";

export function joinerRelation(joiningDate: string, asOf: string): JoinerRelation {
  return joiningDate <= asOf ? "joined" : "joining";
}

/* ------------------------------------------------------------------ */
/* Projections                                                         */
/* ------------------------------------------------------------------ */

/** A person, as every panel names them. */
export type MilestonePerson = {
  employeeId: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  designation: string | null;
};

/**
 * A birthday source row. It carries a month and a day and NO year, because the
 * query that produces it selects no year — see the privacy note above.
 */
export type BirthdaySource = MilestonePerson & { month: number; day: number };

export type BirthdayEntry = MilestonePerson & {
  month: number;
  day: number;
  /** "15 Sep". Never carries a year. */
  dateLabel: string;
  /** The upcoming occurrence inside the window, which is not the birth date. */
  occursOn: string;
  daysAway: number;
};

export type AnniversarySource = MilestonePerson & { joiningDate: string; month: number; day: number };

export type AnniversaryEntry = MilestonePerson & {
  joiningDate: string;
  dateLabel: string;
  occursOn: string;
  daysAway: number;
  /** Completed years of service ON the anniversary. Always 1 or more. */
  years: number;
};

export type NewJoinerSource = MilestonePerson & { joiningDate: string };

export type NewJoinerEntry = MilestonePerson & {
  joiningDate: string;
  relation: JoinerRelation;
  /** Negative in the past, positive in the future, 0 for today. */
  daysFromToday: number;
};

/** Soonest first, then by name, so the order does not wobble between reads. */
function bySoonest<T extends { daysAway: number; name: string }>(left: T, right: T): number {
  return left.daysAway - right.daysAway || left.name.localeCompare(right.name);
}

export function projectBirthdays(rows: readonly BirthdaySource[], window: readonly WindowDay[]): BirthdayEntry[] {
  const entries: BirthdayEntry[] = [];
  for (const row of rows) {
    const occurrence = occurrenceIn(window, row.month, row.day);
    if (occurrence === null) continue;
    entries.push({
      ...row,
      dateLabel: monthDayLabel(row.month, row.day),
      occursOn: occurrence.date,
      daysAway: occurrence.offset,
    });
  }
  return entries.sort(bySoonest);
}

/**
 * Anniversaries in the window, excluding the joining day itself.
 *
 * Somebody joining inside the window has completed no years, and calling their
 * first day a "0 years" work anniversary would double-count them against the
 * new joiners panel, which is where they belong.
 */
export function projectAnniversaries(
  rows: readonly AnniversarySource[],
  window: readonly WindowDay[],
): AnniversaryEntry[] {
  const entries: AnniversaryEntry[] = [];
  for (const row of rows) {
    const occurrence = occurrenceIn(window, row.month, row.day);
    if (occurrence === null) continue;
    const years = completedYearsOfService(row.joiningDate, occurrence.date);
    if (years < 1) continue;
    entries.push({
      ...row,
      dateLabel: monthDayLabel(row.month, row.day),
      occursOn: occurrence.date,
      daysAway: occurrence.offset,
      years,
    });
  }
  return entries.sort(bySoonest);
}

export function projectNewJoiners(rows: readonly NewJoinerSource[], asOf: string): NewJoinerEntry[] {
  return rows
    .map((row) => ({
      ...row,
      relation: joinerRelation(row.joiningDate, asOf),
      daysFromToday: daysBetween(asOf, row.joiningDate),
    }))
    .sort((left, right) => right.joiningDate.localeCompare(left.joiningDate) || left.name.localeCompare(right.name));
}

/* ------------------------------------------------------------------ */
/* Request contract                                                    */
/* ------------------------------------------------------------------ */

export const milestonesQuery = z
  .object({
    /** The rolling window for birthdays and anniversaries, inclusive of today. */
    windowDays: z.coerce.number().int().min(1).max(60).optional(),
    /** How far back a joiner still counts as new. */
    lookbackDays: z.coerce.number().int().min(1).max(180).optional(),
  })
  .strict();

export type MilestonesQuery = z.infer<typeof milestonesQuery>;

/* ------------------------------------------------------------------ */
/* Read model                                                          */
/* ------------------------------------------------------------------ */

export type BirthdayPanel =
  | {
      available: true;
      items: BirthdayEntry[];
      /** Active employees whose record carries a date of birth. */
      recorded: number;
      /** Active employees in the tenant, so "5 of 240" can be stated. */
      population: number;
      coverageNote: string;
      privacyNote: string;
    }
  | { available: false; reason: string; permission: string };

export type MilestoneBoard = {
  asOf: string;
  windowDays: number;
  windowEndsOn: string;
  lookbackDays: number;
  birthdays: BirthdayPanel;
  anniversaries: { items: AnniversaryEntry[] };
  newJoiners: { items: NewJoinerEntry[]; from: string; to: string };
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function personFrom(row: Record<string, unknown>): MilestonePerson {
  const name = `${text(row.first_name) ?? ""} ${text(row.last_name) ?? ""}`.trim();
  const code = text(row.employee_code);
  return {
    employeeId: String(row.id),
    // No specimen name is ever substituted. The fallback is the person's own
    // employee code, and failing that a placeholder that is visibly not a name.
    name: name.length > 0 ? name : (code ?? "Unnamed employee"),
    employeeCode: code,
    department: text(row.department),
    designation: text(row.designation),
  };
}

function integer(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/** True when the caller holds the permission that gates birth dates. */
export function canReadBirthdates(access: Access): boolean {
  return access.context.permissions.includes(BIRTHDATE_PERMISSION);
}

export function birthdatesWithheld(): Extract<BirthdayPanel, { available: false }> {
  return {
    available: false,
    reason: `Upcoming birthdays are derived from each employee's date of birth, which is personal data. Showing them needs the ${BIRTHDATE_PERMISSION} permission, which this role does not hold. The other panels are unaffected.`,
    permission: BIRTHDATE_PERMISSION,
  };
}

/**
 * The milestone board for the caller's tenant.
 *
 * Only actively employed people appear: somebody who has left the company is
 * not a birthday, an anniversary or a new joiner.
 */
export async function loadMilestoneBoard(access: Access, query: MilestonesQuery): Promise<MilestoneBoard> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });

  const asOf = today();
  const windowDays = query.windowDays ?? DEFAULT_WINDOW_DAYS;
  const lookbackDays = query.lookbackDays ?? DEFAULT_JOINER_LOOKBACK_DAYS;
  const window = rollingWindow(asOf, windowDays);
  const { months, days } = windowFilter(window);
  const joinerFrom = isoFrom(utcMillis(asOf) - lookbackDays * MS_PER_DAY);
  const joinerTo = window.length > 0 ? window[window.length - 1].date : asOf;

  const [anniversaryRows, joinerRows] = await tenantTx(access, [
    // `extract(...)` is left uncast so it matches the indexed expression in
    // `employees_joining_anniversary_idx`; the cast to int happens in the
    // select list, where it is only shaping the output.
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name, e.department, e.designation,
        to_char(e.joining_date, 'YYYY-MM-DD') as joining_date,
        extract(month from e.joining_date)::int as month,
        extract(day from e.joining_date)::int as day
      from employees e
      where e.tenant_id = ${access.tenantId}
        and e.status = 'active'
        and extract(month from e.joining_date) = any(${months}::int[])
        and extract(day from e.joining_date) = any(${days}::int[])
      order by e.joining_date asc
      limit 500
    `,
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name, e.department, e.designation,
        to_char(e.joining_date, 'YYYY-MM-DD') as joining_date
      from employees e
      where e.tenant_id = ${access.tenantId}
        and e.status = 'active'
        and e.joining_date between ${joinerFrom}::date and ${joinerTo}::date
      order by e.joining_date desc
      limit 200
    `,
  ]);

  const anniversaries = projectAnniversaries(
    (anniversaryRows as Array<Record<string, unknown>>).map((row) => ({
      ...personFrom(row),
      joiningDate: text(row.joining_date) ?? "",
      month: integer(row.month),
      day: integer(row.day),
    })),
    window,
  );

  const newJoiners = projectNewJoiners(
    (joinerRows as Array<Record<string, unknown>>).map((row) => ({
      ...personFrom(row),
      joiningDate: text(row.joining_date) ?? "",
    })),
    asOf,
  );

  return {
    asOf,
    windowDays,
    windowEndsOn: joinerTo,
    lookbackDays,
    birthdays: await loadBirthdayPanel(access, window, months, days),
    anniversaries: { items: anniversaries },
    newJoiners: { items: newJoiners, from: joinerFrom, to: joinerTo },
  };
}

/**
 * The birthday panel, or the reason there is none.
 *
 * The permission is checked BEFORE the query is issued, and `enforce` runs on
 * the same permission so the refusal is the platform's, not a local `if`. A
 * caller without it gets a stated reason and the rest of the board; the whole
 * endpoint is never failed over one panel.
 */
async function loadBirthdayPanel(
  access: Access,
  window: readonly WindowDay[],
  months: readonly number[],
  days: readonly number[],
): Promise<BirthdayPanel> {
  if (!canReadBirthdates(access)) return birthdatesWithheld();
  enforce(access.context, BIRTHDATE_PERMISSION, { tenantId: access.tenantId, sensitivity: ["birthdate"] });

  const [birthdayRows, coverageRows] = await tenantTx(access, [
    // The birth date itself is NOT selected. Only the month and the day leave
    // the database, which is both the privacy rule and the index expression.
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name, e.department, e.designation,
        extract(month from e.date_of_birth)::int as month,
        extract(day from e.date_of_birth)::int as day
      from employees e
      where e.tenant_id = ${access.tenantId}
        and e.status = 'active'
        and e.date_of_birth is not null
        and extract(month from e.date_of_birth) = any(${months}::int[])
        and extract(day from e.date_of_birth) = any(${days}::int[])
      limit 500
    `,
    // Two counts, no rows: enough to tell "nobody has a birth date recorded"
    // apart from "no birthdays fall in this fortnight".
    sqlClient`
      select count(*)::int as population, count(e.date_of_birth)::int as recorded
      from employees e
      where e.tenant_id = ${access.tenantId} and e.status = 'active'
    `,
  ]);

  const coverage = (coverageRows as Array<{ population: number; recorded: number }>)[0] ?? { population: 0, recorded: 0 };
  const recorded = integer(coverage.recorded);
  return {
    available: true,
    items: projectBirthdays(
      (birthdayRows as Array<Record<string, unknown>>).map((row) => ({
        ...personFrom(row),
        month: integer(row.month),
        day: integer(row.day),
      })),
      window,
    ),
    recorded,
    population: integer(coverage.population),
    coverageNote: recorded === 0 ? BIRTHDATE_COVERAGE_NOTE.none : BIRTHDATE_COVERAGE_NOTE.partial,
    privacyNote: BIRTHDATE_PRIVACY_NOTE,
  };
}
