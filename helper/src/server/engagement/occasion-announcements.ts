import "server-only";

import { z } from "zod";
import {
  AUDIENCE_DIMENSIONS,
  parseAudienceRule,
  type AudienceCandidate,
} from "@/server/engagement/announcement-register";

/**
 * Occasion announcements — R-21 / FRM-EXP-03 `is_auto_generated`.
 *
 * The workbook's rule is that birthday and new-joiner announcements "should raise
 * themselves from the employee record rather than being typed". Everything in this
 * file is the pure half of that: which employees have an occasion today, what
 * audience rule the announcement carries, what it says, and the key that stops the
 * same occasion being raised twice. The database half is the
 * `engagement.announce_occasions` handler in `@/server/jobs/handlers`.
 *
 * Nothing here invents copy for an occasion the workbook does not name, and nothing
 * here resolves an audience itself: the rule it builds is the grammar
 * `parseAudienceRule` already defines, resolved by the one resolver in
 * `announcement-register.ts`.
 */

/** The two occasions the employee record can raise on its own (FRM-EXP-03). */
export const OCCASION_KINDS = ["birthday", "joiner"] as const;
export type OccasionKind = (typeof OCCASION_KINDS)[number];

/**
 * The audience scopes an auto-raised announcement may use.
 *
 * The workbook's value set is "All employees, Department, Location or Grade". The
 * first three are `AUDIENCE_DIMENSIONS` entries that resolve against real employee
 * rows; Grade is NOT offered, for exactly the reason the register already states for
 * band and class — no employee-to-grade relationship exists in this schema, so a
 * grade-scoped rule could not be resolved and would publish to an unknown audience.
 * `designation` is offered in its place because it is the one rank-like dimension
 * `employees` actually carries.
 */
export const AUDIENCE_SCOPES = ["all", "department", "location", "designation"] as const;
export type AudienceScope = (typeof AUDIENCE_SCOPES)[number];

export const AUDIENCE_SCOPE_LABELS: Record<AudienceScope, string> = {
  all: "All employees",
  department: "The employee's department",
  location: "The employee's location",
  designation: "The employee's designation",
};

/** Where the per-type scope is configured. There is no announcement master table. */
export const AUDIENCE_SCOPE_SETTINGS_PATH = "tenant_settings.settings -> 'announcement_audience_scope'";

/**
 * Per-occasion audience scope. This is configuration, not a coded rule: the
 * workbook says a birthday announcement is *usually* location-scoped, which makes
 * location the default for that type and not a law about it.
 */
export const announcementAudienceScopeSchema = z
  .object({
    birthday: z.enum(AUDIENCE_SCOPES).optional(),
    joiner: z.enum(AUDIENCE_SCOPES).optional(),
  })
  .strict();

export type AnnouncementAudienceScopeConfig = z.infer<typeof announcementAudienceScopeSchema>;

/** The defaults the workbook states, applied only where the tenant configures nothing. */
export const DEFAULT_AUDIENCE_SCOPES: Record<OccasionKind, AudienceScope> = {
  birthday: "location",
  joiner: "all",
};

/** Returns the configured scopes, or null when the tenant has configured none. */
export function parseAudienceScopeConfig(raw: unknown): AnnouncementAudienceScopeConfig | null {
  if (raw === null || raw === undefined) return null;
  const parsed = announcementAudienceScopeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function audienceScopeFor(kind: OccasionKind, config: AnnouncementAudienceScopeConfig | null): AudienceScope {
  return config?.[kind] ?? DEFAULT_AUDIENCE_SCOPES[kind];
}

/** The dimension key each scope resolves through, or null for the whole tenant. */
const SCOPE_DIMENSION: Record<AudienceScope, keyof AudienceCandidate | null> = {
  all: null,
  department: "department",
  location: "location",
  designation: "designation",
};

export type AudienceRuleResult =
  | { ok: true; rule: string }
  | { ok: false; reason: string };

/**
 * Build the audience rule for one employee's occasion.
 *
 * A scoped rule names the employee's own value on that dimension, so a birthday at
 * Plant North reaches Plant North. Where the employee carries no value on the
 * configured dimension the announcement is refused rather than quietly widened to
 * everybody: a narrower audience is a deliberate setting, and silently ignoring it
 * would publish somebody's birthday to the whole tenant.
 */
export function audienceRuleFor(scope: AudienceScope, employee: AudienceCandidate): AudienceRuleResult {
  const dimension = SCOPE_DIMENSION[scope];
  if (dimension === null) return { ok: true, rule: "all" };
  const value = (employee[dimension] as string | null | undefined) ?? "";
  const label = AUDIENCE_DIMENSIONS.find((entry) => entry.key === dimension)?.label ?? dimension;
  if (value.trim().length === 0) {
    return {
      ok: false,
      reason: `${employee.employeeCode || employee.id} has no ${label.toLowerCase()} on the employee record, so a ${scope}-scoped announcement has no audience to address.`,
    };
  }
  // A comma or a semicolon would be read as a second value or a second clause, and
  // a rule longer than the ceiling is refused by the write path, not by this build.
  const rule = `${dimension}:${value.trim()}`;
  const parsed = parseAudienceRule(rule);
  if (!parsed.ok) return { ok: false, reason: `${employee.employeeCode || employee.id}: ${parsed.error}` };
  return { ok: true, rule: parsed.canonical };
}

/**
 * The idempotency key. One occasion per employee per year: re-running the job on the
 * same day finds the key and writes nothing, and next year's birthday is a different
 * key, so it raises again. Stored on the announcement as `auto_occasion_key`.
 */
export function occasionKey(kind: OccasionKind, employeeId: string, occasionOn: string): string {
  return `${kind}:${employeeId}:${occasionOn.slice(0, 4)}`;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a stored date of birth falls on `asOf`.
 *
 * Matched on month and day, which is what "birthday" means. A 29 February birth
 * date therefore matches only in a leap year: the source states no substitute date
 * for common years and one is not invented here.
 */
export function isBirthdayOn(dateOfBirth: string | null, asOf: string): boolean {
  if (!dateOfBirth || !DATE_PATTERN.test(dateOfBirth) || !DATE_PATTERN.test(asOf)) return false;
  return dateOfBirth.slice(5) === asOf.slice(5);
}

/** Whether a joining date falls on `asOf`. A new joiner is announced on the day they join. */
export function isJoiningOn(joiningDate: string | null, asOf: string): boolean {
  if (!joiningDate || !DATE_PATTERN.test(joiningDate) || !DATE_PATTERN.test(asOf)) return false;
  return joiningDate === asOf;
}

export type OccasionCopy = { title: string; body: string };

/**
 * The announcement text. `publishAnnouncementSchema` requires a title of at least 5
 * characters and a body of at least 20, so the body names the occasion in full
 * rather than relying on the title.
 */
export function occasionCopy(kind: OccasionKind, employee: AudienceCandidate, occasionOn: string): OccasionCopy {
  const name = employee.name.trim() || employee.employeeCode || "A colleague";
  const where = employee.location?.trim() ? ` at ${employee.location.trim()}` : "";
  if (kind === "birthday") {
    return {
      title: `Happy birthday, ${name}`,
      body: `Today is ${name}'s birthday. Colleagues${where} are invited to wish ${name} well.`,
    };
  }
  const role = employee.designation?.trim() ? ` as ${employee.designation.trim()}` : "";
  const team = employee.department?.trim() ? ` in ${employee.department.trim()}` : "";
  return {
    title: `Welcome, ${name}`,
    body: `${name} joins us${role}${team}${where} today, ${occasionOn}. Please join us in welcoming ${name} to the team.`,
  };
}

export type OccasionCandidate = AudienceCandidate & {
  dateOfBirth: string | null;
  joiningDate: string | null;
};

export type PlannedOccasion = {
  kind: OccasionKind;
  employeeId: string;
  key: string;
  rule: string;
  copy: OccasionCopy;
};

export type SkippedOccasion = { kind: OccasionKind; employeeId: string; reason: string };

export type OccasionPlan = {
  planned: PlannedOccasion[];
  skipped: SkippedOccasion[];
};

/**
 * Everything the handler needs, decided without touching the database: which
 * employees have an occasion on `asOf`, what each announcement would say, and which
 * ones cannot be raised and why. Occasions whose key is already present are dropped
 * here, which is what makes re-running the job on the same day a no-op.
 */
export function planOccasions(input: {
  asOf: string;
  employees: readonly OccasionCandidate[];
  config: AnnouncementAudienceScopeConfig | null;
  /** `auto_occasion_key` values already on `feed_posts`. */
  existingKeys: ReadonlySet<string>;
}): OccasionPlan {
  const planned: PlannedOccasion[] = [];
  const skipped: SkippedOccasion[] = [];
  for (const employee of input.employees) {
    for (const kind of OCCASION_KINDS) {
      const occurs =
        kind === "birthday" ? isBirthdayOn(employee.dateOfBirth, input.asOf) : isJoiningOn(employee.joiningDate, input.asOf);
      if (!occurs) continue;
      const key = occasionKey(kind, employee.id, input.asOf);
      if (input.existingKeys.has(key)) continue;
      const rule = audienceRuleFor(audienceScopeFor(kind, input.config), employee);
      if (!rule.ok) {
        skipped.push({ kind, employeeId: employee.id, reason: rule.reason });
        continue;
      }
      planned.push({ kind, employeeId: employee.id, key, rule: rule.rule, copy: occasionCopy(kind, employee, input.asOf) });
    }
  }
  return { planned, skipped };
}
