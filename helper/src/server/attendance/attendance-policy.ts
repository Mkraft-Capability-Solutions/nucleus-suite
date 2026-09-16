import "server-only";

import { sqlClient } from "@/lib/db";
import { defaultLatePolicy, type AttendanceStatus, type LatePolicy, type NightExtensionRule } from "@/lib/hr-rules";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Attendance policy pack — the settings RL-17 and RL-18 place on "Grace & Late
 * Policy Setup" (F-ATT-06) and "Night Extension Rule Setup" (F-SHF-03).
 *
 * Follows the house pattern of `src/server/payroll/rule-pack.ts`: every setting is
 * DECLARED here, a setting the source workbook actually states carries that stated
 * value as its default, and a setting the workbook leaves open is `null`. Reading a
 * `null` setting throws `ATTENDANCE_POLICY_INCOMPLETE` rather than substituting a
 * guess, because guessing here silently changes who loses half a day's pay.
 *
 * Resolution order, per policy:
 *
 * 1. The PUBLISHED record of the configuration screen — `grace-late-policies` for
 *    F-ATT-06 and `night-extension-rules` for F-SHF-03 in `hrms_operation_records`.
 *    This is what a consultant edits, so it is the primary source.
 * 2. Otherwise the tenant's approved rule set (`POST /api/v1/vp/readiness` with
 *    `action: "save_rule_set"`, domain `attendance`), the earlier override channel.
 * 3. Otherwise the declared pack, where an unstated setting stays `null`.
 *
 * A published record is the whole source for its policy: a blank optional field on
 * it stays unsupplied and is refused, never back-filled from the rule set.
 */

export const GRACE_LATE_POLICY_CODE = "grace-late-policy";
export const NIGHT_EXTENSION_POLICY_CODE = "night-extension";
export const BREAK_TYPE_POLICY_CODE = "break-types";

/** Catalog resources behind the two configuration screens. */
export const GRACE_LATE_RESOURCE = "grace-late-policies";
export const NIGHT_EXTENSION_RESOURCE = "night-extension-rules";

export const GRACE_LATE_SCREEN = "Grace & Late Policy Setup (F-ATT-06)";
export const NIGHT_EXTENSION_SCREEN = "Night Extension Rule Setup (F-SHF-03)";

export type PolicySource = "published" | "rule-set" | "declared";

export type LateCounterReset = "calendar_month" | "payroll_month" | "quarter" | "year";

export type GraceLatePolicy = {
  graceMinutesIn: number;
  graceMinutesOut: number;
  latesAllowedPerMonth: number;
  consequence: LatePolicy["consequence"];
  /**
   * Q-12. The workbook states "Calendar month" as the default and then asks the
   * client to confirm it, so the stated default stands and the alternative is a
   * configured value rather than a second code path.
   */
  counterReset: LateCounterReset;
  /**
   * Q-06. The workbook names the exemption by designation ("Assistant Manager and
   * above") and never says which grade rank that is. Left unsupplied on purpose:
   * matching on a job title breaks the first time a title changes.
   */
  exemptFromGradeRank: number | null;
  source: PolicySource;
};

export type NightExtensionPolicy = {
  /** RL-18 names A shift; null means the rule applies to every shift. */
  appliesToShiftCode: string | null;
  /** The source offers 03:00 or 04:00 and settles on neither. */
  triggerAfterMinute: number | null;
  /** The source offers 09:00 or 09:30 and settles on neither. */
  permittedArrivalUntilMinute: number | null;
  /** The source requires work "until 20:00" without stating it as a setting. */
  minimumDepartureMinute: number | null;
  /** The status the day takes when the rule applies; the workbook states "Present". */
  resultingDayStatus: AttendanceStatus;
  /** Q-11. No frequency limit is stated; null is unlimited only once a client says so. */
  maxUsesPerMonth: number | null;
  source: PolicySource;
};

/**
 * EN_BREAK_TYPE. The workbook states the complete value set and marks it
 * "configurable per tenant", so the stated set is the seed and the tenant's own
 * rule-set row replaces it.
 */
export const DEFAULT_BREAK_TYPES = ["Meal", "Personal", "Gate pass", "Shift break", "Unclassified"] as const;
export const UNCLASSIFIED_BREAK_TYPE = "Unclassified";

export type AttendancePolicyPack = {
  graceLate: GraceLatePolicy;
  /**
   * Night-extension rules in lookup order. Published records, one per shift, when
   * any exist; otherwise the single rule-set or declared rule. Read through
   * `nightExtensionForShift`, never by index, so the shift match is always applied.
   */
  nightExtensionRules: NightExtensionPolicy[];
  breakTypes: string[];
  /**
   * FRM-TIM-04 `ruleset_version`: which configuration decided a day.
   *
   * A recompute months later can reach a different verdict because the policy changed,
   * and without this the day record cannot say which one it was judged under. It names
   * the source each half of the pack came from and the newest publication stamp among
   * the records actually used, so two days carrying the same version were judged the
   * same way.
   */
  version: string;
};

/** The pack as the workbook states it, before any tenant override. */
export const declaredAttendancePolicy: AttendancePolicyPack = {
  graceLate: {
    graceMinutesIn: defaultLatePolicy.graceMinutes,
    graceMinutesOut: defaultLatePolicy.graceMinutes,
    latesAllowedPerMonth: defaultLatePolicy.latesAllowedPerMonth,
    consequence: defaultLatePolicy.consequence,
    counterReset: "calendar_month",
    exemptFromGradeRank: null,
    source: "declared",
  },
  nightExtensionRules: [{
    appliesToShiftCode: null,
    triggerAfterMinute: null,
    permittedArrivalUntilMinute: null,
    minimumDepartureMinute: null,
    resultingDayStatus: "Present",
    maxUsesPerMonth: null,
    source: "declared",
  }],
  breakTypes: [...DEFAULT_BREAK_TYPES],
  // Nothing is configured, so every half of the pack is the workbook's own statement.
  version: "grace:declared/night:declaredx1/breaks:declared",
};

/**
 * Reads a setting that must have a value. Throws a named, actionable error when
 * the setting has not been supplied, so an unapproved attendance rule can never
 * become a silent default on someone's attendance record.
 */
export function requireAttendanceSetting<T>(value: T | null | undefined, path: string, screen: string): T {
  if (value === null || value === undefined) {
    throw new HttpError({
      status: 422,
      code: "ATTENDANCE_POLICY_INCOMPLETE",
      message: `Attendance setting "${path}" has no approved value. Set it on ${screen} before this day can be processed.`,
      details: [{ field: path, issue: `Not configured. ${screen} owns this value.` }],
    });
  }
  return value;
}

/**
 * A published record carries a value the engine has no outcome for. Refused at load
 * rather than mapped to the nearest outcome, because the screen would then say one
 * thing and the attendance record another.
 */
function unsupportedPublishedValue(path: string, value: unknown, screen: string, accepted: readonly string[]): never {
  throw new HttpError({
    status: 422,
    code: "ATTENDANCE_POLICY_INCOMPLETE",
    message: `Attendance setting "${path}" is "${String(value)}" on ${screen}, which the attendance engine cannot apply. Choose one of ${accepted.join(", ")}.`,
    details: [{ field: path, issue: `Accepted values: ${accepted.join(", ")}.` }],
  });
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** HH:MM to minutes since midnight, or null when the value is absent or unreadable. */
export function clockToMinuteOfDay(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function positiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function trimmedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const CONSEQUENCES = ["Half day", "Leave deduction", "Warning only", "No action"] as const;
const COUNTER_RESETS = ["calendar_month", "payroll_month", "quarter", "year"] as const;

/**
 * F-ATT-06 stores the consequence as a `PL_ATTENDANCE_STATUS` value. Only the
 * values that name an outcome the late rule can produce are mapped; "present"
 * means the day stands and nothing is deducted.
 */
const CONSEQUENCE_BY_DAY_STATUS: Record<string, LatePolicy["consequence"]> = {
  half_day: "Half day",
  on_leave: "Leave deduction",
  present: "No action",
};

/** F-SHF-03 stores the resulting status as a `PL_ATTENDANCE_STATUS` value. */
const DAY_STATUS_BY_PICKLIST: Record<string, AttendanceStatus> = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
};

function readConsequence(value: unknown): LatePolicy["consequence"] | null {
  return CONSEQUENCES.find((option) => option === value) ?? (typeof value === "string" ? CONSEQUENCE_BY_DAY_STATUS[value] ?? null : null);
}

function readCounterReset(value: unknown): LateCounterReset | null {
  return COUNTER_RESETS.find((option) => option === value) ?? null;
}

function readDayStatus(value: unknown): AttendanceStatus | null {
  return (["Present", "Half day", "Absent"] as const).find((option) => option === value)
    ?? (typeof value === "string" ? DAY_STATUS_BY_PICKLIST[value] ?? null : null);
}

export type RuleSetRow = { code: string; config: Record<string, unknown> };
/** One published configuration record, as `hrms_operation_records` stores it. */
export type PublishedPolicyRow = { resource: string; data: Record<string, unknown>; updated_at?: string | Date | null };

function readConfig(rows: readonly RuleSetRow[], code: string): Record<string, unknown> {
  return rows.find((row) => row.code === code)?.config ?? {};
}

function isoDate(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

/**
 * Published records that are in force on `asOf`: a future `effectiveFrom` does not
 * apply yet. Ordered so the first record for any key is the one to use — latest
 * effective date first, then most recently updated.
 */
function effectivePublished(rows: readonly PublishedPolicyRow[], resource: string, asOf: string): PublishedPolicyRow[] {
  return rows
    .filter((row) => row.resource === resource && isoDate(row.data.effectiveFrom) <= asOf)
    .sort((left, right) => {
      const byDate = isoDate(right.data.effectiveFrom).localeCompare(isoDate(left.data.effectiveFrom));
      if (byDate !== 0) return byDate;
      return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
    });
}

function graceLateFromPublished(data: Record<string, unknown>): GraceLatePolicy {
  const declared = declaredAttendancePolicy.graceLate;
  const consequence = readConsequence(data.consequenceBeyondAllowance)
    ?? unsupportedPublishedValue("graceLate.consequenceBeyondAllowance", data.consequenceBeyondAllowance, GRACE_LATE_SCREEN, Object.keys(CONSEQUENCE_BY_DAY_STATUS));
  const counterReset = readCounterReset(data.counterResetBasis)
    ?? unsupportedPublishedValue("graceLate.counterResetBasis", data.counterResetBasis, GRACE_LATE_SCREEN, COUNTER_RESETS);
  return {
    // The three counts are mandatory on the screen; the declared value only covers a
    // record written before the field existed.
    graceMinutesIn: positiveInt(data.graceInMinutes) ?? declared.graceMinutesIn,
    graceMinutesOut: positiveInt(data.graceOutMinutes) ?? declared.graceMinutesOut,
    latesAllowedPerMonth: positiveInt(data.latesAllowedPerMonth) ?? declared.latesAllowedPerMonth,
    consequence,
    counterReset,
    exemptFromGradeRank: positiveInt(data.exemptFromGradeRank),
    source: "published",
  };
}

function graceLateFromRuleSet(grace: Record<string, unknown>): GraceLatePolicy {
  const declared = declaredAttendancePolicy.graceLate;
  return {
    graceMinutesIn: positiveInt(grace.graceMinutesIn) ?? declared.graceMinutesIn,
    graceMinutesOut: positiveInt(grace.graceMinutesOut) ?? declared.graceMinutesOut,
    latesAllowedPerMonth: positiveInt(grace.latesAllowedPerMonth) ?? declared.latesAllowedPerMonth,
    consequence: readConsequence(grace.lateConsequence) ?? declared.consequence,
    counterReset: readCounterReset(grace.lateCounterReset) ?? declared.counterReset,
    exemptFromGradeRank: positiveInt(grace.exemptFromGradeRank),
    source: "rule-set",
  };
}

function nightExtensionFromPublished(data: Record<string, unknown>): NightExtensionPolicy {
  return {
    appliesToShiftCode: trimmedText(data.appliesToShiftCode),
    triggerAfterMinute: clockToMinuteOfDay(data.triggerAfterTime),
    permittedArrivalUntilMinute: clockToMinuteOfDay(data.permittedArrivalUntil),
    minimumDepartureMinute: clockToMinuteOfDay(data.minimumDepartureTime),
    resultingDayStatus: readDayStatus(data.resultingDayStatus)
      ?? unsupportedPublishedValue("nightExtension.resultingDayStatus", data.resultingDayStatus, NIGHT_EXTENSION_SCREEN, Object.keys(DAY_STATUS_BY_PICKLIST)),
    maxUsesPerMonth: positiveInt(data.maxUsesPerMonth),
    source: "published",
  };
}

function nightExtensionFromRuleSet(night: Record<string, unknown>): NightExtensionPolicy {
  return {
    appliesToShiftCode: trimmedText(night.appliesToShiftCode),
    triggerAfterMinute: clockToMinuteOfDay(night.triggerAfterTime),
    permittedArrivalUntilMinute: clockToMinuteOfDay(night.permittedArrivalUntil),
    minimumDepartureMinute: clockToMinuteOfDay(night.minimumDepartureTime),
    resultingDayStatus: readDayStatus(night.resultingDayStatus) ?? declaredAttendancePolicy.nightExtensionRules[0].resultingDayStatus,
    maxUsesPerMonth: positiveInt(night.maxUsesPerMonth),
    source: "rule-set",
  };
}

/**
 * Builds the pack from what the two stores hold. Pure, so the resolution order is
 * unit-testable without a database: a published record wins outright; without one
 * the rule set applies; without either the declared pack does.
 */
/**
 * The version string for one resolved pack (pure, unit-tested). Deliberately legible
 * rather than a hash: an operator reading a day record should be able to see at a glance
 * that the grace policy came from a published screen record and the night rules did not.
 */
export function attendanceRulesetVersion(input: {
  graceSource: PolicySource;
  nightSources: readonly PolicySource[];
  breakSource: PolicySource;
  publishedAt: string | null;
}): string {
  const night = input.nightSources.length === 0
    ? "none"
    : `${input.nightSources[0]}x${input.nightSources.length}`;
  const stamp = input.publishedAt === null ? "" : `@${input.publishedAt}`;
  return `grace:${input.graceSource}/night:${night}/breaks:${input.breakSource}${stamp}`;
}

export function resolveAttendancePolicy(input: {
  ruleSets: readonly RuleSetRow[];
  published: readonly PublishedPolicyRow[];
  /** The day being processed, ISO date. A record effective after it is ignored. */
  asOf: string;
}): AttendancePolicyPack {
  const declared = declaredAttendancePolicy;
  const grace = readConfig(input.ruleSets, GRACE_LATE_POLICY_CODE);
  const night = readConfig(input.ruleSets, NIGHT_EXTENSION_POLICY_CODE);
  const breaks = readConfig(input.ruleSets, BREAK_TYPE_POLICY_CODE);
  const breakValues = Array.isArray(breaks.values)
    ? breaks.values.filter((value): value is string => typeof value === "string" && value.trim() !== "")
    : [];

  const publishedGrace = effectivePublished(input.published, GRACE_LATE_RESOURCE, input.asOf)[0];
  const graceLate = publishedGrace
    ? graceLateFromPublished(publishedGrace.data)
    : Object.keys(grace).length > 0
      ? graceLateFromRuleSet(grace)
      : declared.graceLate;

  // One published rule per shift; the first record seen for a shift is the one in
  // force. Only when nothing is published does the single rule-set rule stand in.
  const seenShifts = new Set<string | null>();
  const publishedNight: NightExtensionPolicy[] = [];
  for (const row of effectivePublished(input.published, NIGHT_EXTENSION_RESOURCE, input.asOf)) {
    const rule = nightExtensionFromPublished(row.data);
    const key = rule.appliesToShiftCode?.toUpperCase() ?? null;
    if (seenShifts.has(key)) continue;
    seenShifts.add(key);
    publishedNight.push(rule);
  }
  const nightExtensionRules = publishedNight.length > 0
    ? publishedNight
    : Object.keys(night).length > 0
      ? [nightExtensionFromRuleSet(night)]
      : declared.nightExtensionRules;

  // The newest publication stamp among the records this pack actually used. A record
  // that was not selected must not move the version, or an unrelated edit would make
  // every day look re-judged.
  const usedRows = [publishedGrace, ...effectivePublished(input.published, NIGHT_EXTENSION_RESOURCE, input.asOf)].filter(
    (row): row is PublishedPolicyRow => row !== undefined,
  );
  const stamps = usedRows.map((row) => String(row.updated_at ?? "")).filter((value) => value !== "").sort();
  return {
    graceLate,
    nightExtensionRules,
    breakTypes: breakValues.length > 0 ? breakValues : declared.breakTypes,
    version: attendanceRulesetVersion({
      graceSource: graceLate.source,
      nightSources: nightExtensionRules.map((rule) => rule.source),
      breakSource: breakValues.length > 0 ? "rule-set" : "declared",
      publishedAt: stamps[stamps.length - 1] ?? null,
    }),
  };
}

/**
 * Loads the tenant's attendance policy pack in force on `asOf` (today when the
 * caller has no day in hand). Published screen records are read alongside the
 * latest approved rule sets, which is what makes a recompute reproduce the verdict
 * the day was first given.
 */
export async function loadAttendancePolicy(access: Access, asOf: string = new Date().toISOString().slice(0, 10)): Promise<AttendancePolicyPack> {
  const [ruleSetRows, publishedRows] = await tenantTx(access, [
    sqlClient`
      select distinct on (code) code, config
      from vp_rule_sets
      where tenant_id = ${access.tenantId} and domain = 'attendance' and status = 'approved'
        and code in (${GRACE_LATE_POLICY_CODE}, ${NIGHT_EXTENSION_POLICY_CODE}, ${BREAK_TYPE_POLICY_CODE})
      order by code, version desc
    `,
    sqlClient`
      select resource, data, updated_at
      from hrms_operation_records
      where tenant_id = ${access.tenantId} and status = 'published'
        and resource in (${GRACE_LATE_RESOURCE}, ${NIGHT_EXTENSION_RESOURCE})
      order by data->>'effectiveFrom' desc, updated_at desc, created_at desc
    `,
  ]);
  return resolveAttendancePolicy({
    ruleSets: ruleSetRows as RuleSetRow[],
    published: publishedRows as PublishedPolicyRow[],
    asOf,
  });
}

/**
 * The night-extension rule that governs one shift, or null when no rule covers it.
 * A rule naming a shift applies to that shift alone; a rule with no shift applies
 * to every shift. Match is on the code, case-insensitively, because shift codes are
 * typed by hand on two different screens.
 */
export function nightExtensionForShift(pack: AttendancePolicyPack, shiftCode: string): NightExtensionPolicy | null {
  const wanted = shiftCode.trim().toUpperCase();
  return pack.nightExtensionRules.find((rule) => rule.appliesToShiftCode === null || rule.appliesToShiftCode.toUpperCase() === wanted) ?? null;
}

/**
 * Resolves the three night-extension times, refusing when any is unsupplied. The
 * caller only reaches this when a session actually ran past midnight, so an
 * unconfigured tenant is not blocked from processing ordinary days.
 */
export function requireNightExtensionRule(policy: NightExtensionPolicy): NightExtensionRule {
  return {
    triggerAfterMinute: requireAttendanceSetting(policy.triggerAfterMinute, "nightExtension.triggerAfterTime", NIGHT_EXTENSION_SCREEN),
    permittedArrivalUntilMinute: requireAttendanceSetting(policy.permittedArrivalUntilMinute, "nightExtension.permittedArrivalUntil", NIGHT_EXTENSION_SCREEN),
    minimumDepartureMinute: requireAttendanceSetting(policy.minimumDepartureMinute, "nightExtension.minimumDepartureTime", NIGHT_EXTENSION_SCREEN),
  };
}

/** The exempt grade rank, refused rather than guessed (Q-06). */
export function requireExemptGradeRank(policy: GraceLatePolicy): number {
  return requireAttendanceSetting(policy.exemptFromGradeRank, "graceLate.exemptFromGradeRank", GRACE_LATE_SCREEN);
}

/**
 * The window the late counter is counted over. Only the calendar month is derived
 * here; any other basis is refused until the cycle it refers to is configured,
 * because a payroll month that nobody has defined is not a month.
 */
export function lateCounterWindow(policy: GraceLatePolicy, date: string): { from: string; to: string } {
  if (policy.counterReset !== "calendar_month") {
    throw new HttpError({
      status: 422,
      code: "ATTENDANCE_POLICY_INCOMPLETE",
      message: `Late counter reset basis "${policy.counterReset}" needs its cycle defined before late marks can be counted.`,
      details: [{ field: "graceLate.lateCounterReset", issue: "Only the calendar month is defined by the source (Q-12)." }],
    });
  }
  const month = date.slice(0, 7);
  const first = new Date(`${month}-01T00:00:00Z`);
  const next = new Date(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  return { from: `${month}-01`, to: next.toISOString().slice(0, 10) };
}
