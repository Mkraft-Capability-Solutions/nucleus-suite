import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import {
  LEAVE_SCHEME_SETTINGS_PATH,
  WORKBOOK_STATED,
  type CoffLapseDayBasis,
  type JoiningProrationBand,
  type LeaveScheme,
  type LeaveTypeScheme,
  type YearEndTreatment,
} from "./scheme";

/**
 * Loads the leave scheme the engine calculates against.
 *
 * Everything here is read from a stored row. `policy-register.ts` already
 * persists the 38-field Leave Type Configuration onto `leave_types.attributes
 * ->'configuration'` and `accrual_rules.attributes->'configuration'`; until now
 * nothing read it back and every accrual, cap and combination number was a
 * literal in `src/lib/hr-rules.ts`. This module is what closes that.
 *
 * Precedence is stored configuration first, then the client's own stated policy
 * (`WORKBOOK_STATED`), then nothing — and "nothing" throws rather than defaults.
 */

const SCHEME_SETTINGS_KEY = "leave_scheme";

/** The scheme-level settings the leave-type form has no field for. */
const prorationBandSchema = z.object({
  fromMonth: z.number().int().min(1).max(12),
  toMonth: z.number().int().min(1).max(12),
  cutoffDay: z.number().int().min(1).max(31).nullable().default(null),
  days: z.number().min(0).max(365),
});

const leaveSchemeSettingsSchema = z.object({
  /** F-EMP-03 "Applies from grade rank" — the rank RL-07's senior branch turns on. */
  seniorGradeRank: z.number().int().min(0).max(100).optional(),
  coffLapseDays: z.number().int().min(1).max(3650).optional(),
  coffLapseDayBasis: z.enum(["calendar", "working"]).optional(),
  types: z
    .record(
      z.string(),
      z.object({
        annualDays: z.number().min(0).max(365).optional(),
        accrualFrequency: z.enum(["annual", "monthly"]).optional(),
        daysPerPeriod: z.number().min(0).max(365).optional(),
        minimumServiceMonths: z.number().int().min(0).max(120).optional(),
        catchUpDays: z.number().min(0).max(365).optional(),
        maxAvailedPerMonth: z.number().min(0).max(365).optional(),
        cannotCombineWith: z.array(z.string().trim().min(1).max(10)).optional(),
        yearEndTreatment: z.enum(["encash", "lapse", "carry_forward"]).optional(),
        joiningProration: z.array(prorationBandSchema).optional(),
        joiningAfterCutoffDays: z.number().min(0).max(365).optional(),
      }),
    )
    .optional(),
});

export type LeaveSchemeSettings = z.infer<typeof leaveSchemeSettingsSchema>;
type LeaveTypeSettings = NonNullable<LeaveSchemeSettings["types"]>[string];

/** Returns the configured scheme-level settings, or null when none are stored. */
export function parseLeaveSchemeSettings(raw: unknown): LeaveSchemeSettings | null {
  if (raw === null || raw === undefined) return null;
  const parsed = leaveSchemeSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

type ConfigurationRow = {
  code: string;
  configuration: Record<string, unknown> | null;
  year_end_action: string | null;
  max_per_month: number | null;
  cannot_combine_with: string | null;
  annual_days: number | null;
  accrual_frequency: string | null;
  days_per_period: number | null;
  eligibility_wait_months: number | null;
  credit_on_completion: number | null;
};

/**
 * One configured leave type, read from the two rows FRM-LVE-01 writes. The
 * accrual-rule version's keys win over the leave type's, which is the order
 * `policy-register.ts` merges them in when it reads the form back.
 */
const CONFIGURATION_SELECT = `select coalesce(lt.attributes->>'code', '') as code,
    (coalesce(lt.attributes->'configuration', '{}'::jsonb) || coalesce(a.attributes->'configuration', '{}'::jsonb)) as configuration,
    lt.attributes->>'year_end_action' as year_end_action,
    case when coalesce(lt.attributes->>'max_per_month', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         then (lt.attributes->>'max_per_month')::float end as max_per_month,
    lt.attributes->>'cannot_combine_with' as cannot_combine_with,
    case when coalesce(a.attributes->>'annual_days', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         then (a.attributes->>'annual_days')::float end as annual_days,
    a.attributes->>'accrual_frequency' as accrual_frequency,
    case when coalesce(a.attributes->>'days_per_period', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         then (a.attributes->>'days_per_period')::float end as days_per_period,
    case when coalesce(a.attributes->>'eligibility_wait_months', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         then (a.attributes->>'eligibility_wait_months')::float end as eligibility_wait_months,
    case when coalesce(a.attributes->>'credit_on_completion', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         then (a.attributes->>'credit_on_completion')::float end as credit_on_completion
  from leave_types lt
  left join accrual_rules a on a.tenant_id = lt.tenant_id and a.leave_type_id = lt.id
    and coalesce(a.record_status, '') not in ('superseded', 'archived', 'inactive')
  where lt.tenant_id = $1
  order by coalesce(lt.attributes->>'code', ''), coalesce(a.attributes->>'effective_from', '') desc, a.created_at desc`;

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/**
 * A stored list of leave-type codes, or null when the field carries nothing.
 *
 * An EMPTY list reads as "not specified", not as "no restrictions". FRM-LVE-01
 * defaults `excluded_with` to `[]` when the field is left blank, so treating an
 * empty array as a deliberate answer would let an unfilled form silently remove
 * RL-11's CL restriction. A tenant that really wants no restriction says so in
 * `leave_scheme.types.<CODE>.cannotCombineWith`, which is unambiguous.
 */
function codes(value: unknown): string[] | null {
  const list =
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : typeof value === "string"
        ? value.split(",")
        : null;
  if (list === null) return null;
  const normalized = list.map((entry) => entry.trim().toUpperCase()).filter((entry) => entry !== "");
  return normalized.length > 0 ? normalized : null;
}

/**
 * Maps the stored `year_end_action` vocabulary onto the three treatments RL-14
 * distinguishes. Anything else is left unresolved so it refuses rather than
 * guessing which way an unrecognised word points.
 */
function treatment(value: unknown): YearEndTreatment | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
  if (["encash", "encashed", "encashment"].includes(normalized)) return "encash";
  if (["lapse", "lapsed", "forfeit"].includes(normalized)) return "lapse";
  if (["carry_forward", "carryforward", "carry_over"].includes(normalized)) return "carry_forward";
  return null;
}

/** The 38-field configuration's own days-per-period, derived from its accrual settings. */
function daysPerPeriodFrom(configuration: Record<string, unknown>, annualDays: number | null): number | null {
  const explicit = num(configuration.days_per_period);
  if (explicit !== null) return explicit;
  const frequency = typeof configuration.accrual_frequency === "string" ? configuration.accrual_frequency.trim().toLowerCase() : "";
  if (frequency === "monthly" && annualDays !== null) return Math.round((annualDays / 12) * 100) / 100;
  return null;
}

function mergeType(
  stated: LeaveTypeScheme | undefined,
  code: string,
  row: ConfigurationRow | undefined,
  settings: LeaveTypeSettings | undefined,
): LeaveTypeScheme {
  const base: LeaveTypeScheme = stated
    ? { ...stated, cannotCombineWith: [...stated.cannotCombineWith], joiningProration: stated.joiningProration ? stated.joiningProration.map((band) => ({ ...band })) : null }
    : {
        code,
        annualDays: null,
        accrualFrequency: null,
        daysPerPeriod: null,
        minimumServiceMonths: null,
        catchUpDays: null,
        maxAvailedPerMonth: null,
        cannotCombineWith: [],
        yearEndTreatment: null,
        joiningProration: null,
        joiningAfterCutoffDays: null,
      };

  if (row) {
    const configuration = (row.configuration ?? {}) as Record<string, unknown>;
    const annualDays = num(configuration.annual_days) ?? row.annual_days;
    if (annualDays !== null) base.annualDays = annualDays;
    const frequency = typeof configuration.accrual_frequency === "string" ? configuration.accrual_frequency : row.accrual_frequency;
    const normalizedFrequency = (frequency ?? "").trim().toLowerCase();
    if (normalizedFrequency === "monthly" || normalizedFrequency === "annual") base.accrualFrequency = normalizedFrequency;
    const perPeriod = daysPerPeriodFrom(configuration, annualDays) ?? row.days_per_period;
    if (perPeriod !== null) base.daysPerPeriod = perPeriod;
    // FRM-LVE-01 records the wait in days; F-EMP-03 records it in months. Both mean
    // the same hold, so whole months are taken from either field.
    const waitDays = num(configuration.eligibility_wait_days);
    const waitMonths = row.eligibility_wait_months ?? (waitDays === null ? null : Math.round(waitDays / 30));
    if (waitMonths !== null) base.minimumServiceMonths = waitMonths;
    if (row.credit_on_completion !== null) base.catchUpDays = row.credit_on_completion;
    if (row.max_per_month !== null) base.maxAvailedPerMonth = row.max_per_month;
    const excluded = codes(configuration.excluded_with) ?? codes(row.cannot_combine_with);
    if (excluded !== null) base.cannotCombineWith = excluded;
    const stored = treatment(row.year_end_action);
    if (stored !== null) base.yearEndTreatment = stored;
    else if (configuration.is_encashable === true) base.yearEndTreatment = "encash";
  }

  if (settings) {
    if (settings.annualDays !== undefined) base.annualDays = settings.annualDays;
    if (settings.accrualFrequency !== undefined) base.accrualFrequency = settings.accrualFrequency;
    if (settings.daysPerPeriod !== undefined) base.daysPerPeriod = settings.daysPerPeriod;
    if (settings.minimumServiceMonths !== undefined) base.minimumServiceMonths = settings.minimumServiceMonths;
    if (settings.catchUpDays !== undefined) base.catchUpDays = settings.catchUpDays;
    if (settings.maxAvailedPerMonth !== undefined) base.maxAvailedPerMonth = settings.maxAvailedPerMonth;
    if (settings.cannotCombineWith !== undefined) base.cannotCombineWith = settings.cannotCombineWith.map((entry) => entry.toUpperCase());
    if (settings.yearEndTreatment !== undefined) base.yearEndTreatment = settings.yearEndTreatment;
    if (settings.joiningProration !== undefined) base.joiningProration = settings.joiningProration as JoiningProrationBand[];
    if (settings.joiningAfterCutoffDays !== undefined) base.joiningAfterCutoffDays = settings.joiningAfterCutoffDays;
  }

  return base;
}

/**
 * Builds the scheme from the stated policy, the stored leave-type configuration
 * and the tenant's scheme settings (unit-tested; no database in here).
 */
export function buildLeaveScheme(rows: ConfigurationRow[], settings: LeaveSchemeSettings | null): LeaveScheme {
  const byCode = new Map<string, ConfigurationRow>();
  for (const row of rows) {
    const code = (row.code ?? "").trim().toUpperCase();
    // The select orders the newest effective accrual rule first, so the first row
    // seen for a code is the version in force.
    if (code !== "" && !byCode.has(code)) byCode.set(code, row);
  }
  const allCodes = new Set<string>([...Object.keys(WORKBOOK_STATED.types), ...byCode.keys(), ...Object.keys(settings?.types ?? {})]);
  const types: Record<string, LeaveTypeScheme> = {};
  for (const code of allCodes) {
    types[code] = mergeType(WORKBOOK_STATED.types[code], code, byCode.get(code), settings?.types?.[code]);
  }
  return {
    seniorGradeRank: settings?.seniorGradeRank ?? WORKBOOK_STATED.seniorGradeRank,
    coffLapseDays: settings?.coffLapseDays ?? WORKBOOK_STATED.coffLapseDays,
    coffLapseDayBasis: (settings?.coffLapseDayBasis as CoffLapseDayBasis | undefined) ?? WORKBOOK_STATED.coffLapseDayBasis,
    types,
  };
}

/** The tenant's leave scheme, read from configuration on every call. */
export async function loadLeaveScheme(access: Access): Promise<LeaveScheme> {
  const [typeRows, settingsRows] = await tenantTx(access, [
    sqlClient.query(CONFIGURATION_SELECT, [access.tenantId]),
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const raw = (settingsRows as Array<{ settings: unknown }>)[0]?.settings;
  const bag = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return buildLeaveScheme(typeRows as ConfigurationRow[], parseLeaveSchemeSettings(bag[SCHEME_SETTINGS_KEY]));
}

export type LeaveSchemeGap = { rule: string; question: string | null; detail: string };

/**
 * Every scheme value the engine needs that nobody has supplied, with the open
 * question behind it. Drives the readiness panel and the audit's BLOCKED list.
 */
export function leaveSchemeGaps(scheme: LeaveScheme): LeaveSchemeGap[] {
  const gaps: LeaveSchemeGap[] = [];
  if (scheme.seniorGradeRank === null) {
    gaps.push({
      rule: "senior_grade_rank",
      question: "Q-06",
      detail: 'RL-07 credits 18/6/6 "at or above the configured grade rank". The source names the designation "AGM and above" and never the rank, so the senior annual credit cannot run.',
    });
  }
  if (scheme.coffLapseDayBasis === null) {
    gaps.push({
      rule: "coff_lapse_day_basis",
      question: "Q-07",
      detail: "RL-06 gives a 60-day COFF window without saying whether the days are calendar or working days. Comp-off cannot be granted or lapsed until the basis is set.",
    });
  }
  for (const [code, type] of Object.entries(scheme.types)) {
    if (type.joiningProration !== null && type.joiningAfterCutoffDays === null) {
      gaps.push({
        rule: `types.${code}.joining_after_cutoff_days`,
        question: "Q-02",
        detail: `RL-10's table for ${code} ends at "up to 4th Dec - 1 each" and is silent beyond it, so a joiner after the cut-off day cannot be credited.`,
      });
    }
    if (type.maxAvailedPerMonth !== null && code === "EL") {
      gaps.push({
        rule: "types.EL.max_availed_per_month",
        question: "Q-04",
        detail: `The ${type.maxAvailedPerMonth}-day monthly EL figure is enforced as a cap on AVAILING, which is how RL-12 words it. The client is still asked to confirm it is not a cap on accrual.`,
      });
    }
  }
  return gaps;
}

/**
 * Saving the scheme-level settings (FRM-LVE-01's header, above the per-type rules).
 *
 * These three values — the senior grade rank RL-07 turns on, the comp-off lapse window and
 * its day basis, and the joiner proration bands — decide what the accrual and lapse runs
 * credit, and they had no writer at all: the schema and the reader existed, but the only
 * thing that ever put them in `tenant_settings` was a seed script. A tenant could not
 * answer Q-06 or Q-07 without someone running SQL.
 *
 * Every field is optional and only what is sent is changed, so answering one open question
 * does not require restating the others. Clearing a value back to "unsupplied" is explicit:
 * send `null`, and the engine returns to refusing by name rather than silently keeping the
 * last figure.
 */
export const saveLeaveSchemeSettingsSchema = z.object({
  seniorGradeRank: z.number().int().min(0).max(100).nullable().optional(),
  coffLapseDays: z.number().int().min(1).max(3650).nullable().optional(),
  coffLapseDayBasis: z.enum(["calendar", "working"]).nullable().optional(),
  reason: z.string().trim().min(10).max(300),
});

export type SaveLeaveSchemeSettingsInput = z.infer<typeof saveLeaveSchemeSettingsSchema>;

export async function saveLeaveSchemeSettings(
  access: Access,
  input: SaveLeaveSchemeSettingsInput,
  requestId: string,
): Promise<{ scheme: LeaveScheme; gaps: LeaveSchemeGap[] }> {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const bag = ((rows as Array<{ settings: unknown }>)[0]?.settings ?? {}) as Record<string, unknown>;
  const current = (typeof bag[SCHEME_SETTINGS_KEY] === "object" && bag[SCHEME_SETTINGS_KEY] !== null
    ? bag[SCHEME_SETTINGS_KEY]
    : {}) as Record<string, unknown>;

  const next: Record<string, unknown> = { ...current };
  // `undefined` means "leave as it is"; an explicit null removes the key, which is what
  // takes the value back to unsupplied rather than to zero.
  for (const key of ["seniorGradeRank", "coffLapseDays", "coffLapseDayBasis"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
  }
  // The per-type rules live under the same key and belong to FRM-LVE-01's type screen;
  // they are carried through untouched so the two forms cannot overwrite each other.
  if (current.types !== undefined) next.types = current.types;

  const patch = JSON.stringify({ [SCHEME_SETTINGS_KEY]: next });
  await tenantTx(access, [
    sqlClient`
      insert into tenant_settings (tenant_id, settings)
      values (${access.tenantId}, ${patch}::jsonb)
      on conflict (tenant_id) do update
      set settings = jsonb_set(coalesce(tenant_settings.settings, '{}'::jsonb),
            array[${SCHEME_SETTINGS_KEY}]::text[], ${JSON.stringify(next)}::jsonb, true),
          updated_at = now()
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.scheme_settings', 'leave_scheme', ${access.tenantId}, ${input.reason},
        ${JSON.stringify(current)}::jsonb, ${JSON.stringify(next)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  // Read the scheme back through the normal loader, so the caller sees exactly what the
  // engine will see — including which questions are still open after this change.
  const scheme = await loadLeaveScheme(access);
  return { scheme, gaps: leaveSchemeGaps(scheme) };
}
