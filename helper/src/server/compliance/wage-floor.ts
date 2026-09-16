import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Wage-floor simulation for the 2026 Indian Labour Codes.
 *
 * Every statutory figure this module uses — the wage-floor percentage and each
 * contribution rate — is read from the tenant's stored rule pack. Nothing is
 * hardcoded: when the pack carries no rates the simulator returns an empty
 * result and the console renders its unconfigured state instead of computing
 * against invented percentages.
 */

/** Stored percentages are whole percents, so this converts one to a fraction. */
const PERCENT_SCALE = 100;

/** Trailing window, in minutes of a percentage, used when rounding for display. */
const DISPLAY_PRECISION = PERCENT_SCALE;

export type StatutoryRate = {
  code: string;
  label: string;
  percent: number | null;
  formula: string | null;
  appliesTo: string | null;
};

export type StatutoryRatePack = {
  packCode: string | null;
  packVersion: string | null;
  effectiveFrom: string | null;
  rates: StatutoryRate[];
};

/** The rate pack plus the stored wage-floor percentage the simulator needs. */
export type WageFloorConfiguration = StatutoryRatePack & { floorPercent: number | null };

type AttributeBag = Record<string, unknown> | null;

function bagOf(value: unknown): AttributeBag {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

/** A stored percentage, or null when the row does not carry a usable number. */
function percentOf(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstDefined(...bags: AttributeBag[]): (key: string) => unknown {
  return (key: string) => {
    for (const bag of bags) {
      if (bag && bag[key] !== undefined && bag[key] !== null) return bag[key];
    }
    return null;
  };
}

/** Reads the `rates` array a rule-pack row may carry. Absent means empty. */
function readRates(...bags: AttributeBag[]): StatutoryRate[] {
  for (const bag of bags) {
    const raw = bag?.rates;
    if (!Array.isArray(raw)) continue;
    const parsed = raw.flatMap<StatutoryRate>((entry) => {
      const row = bagOf(entry);
      if (!row) return [];
      const code = textOf(row.code);
      if (!code) return [];
      return [
        {
          code,
          label: textOf(row.label) ?? code,
          percent: percentOf(row.percent),
          formula: textOf(row.formula),
          appliesTo: textOf(row.applies_to) ?? textOf(row.appliesTo),
        },
      ];
    });
    if (parsed.length > 0) return parsed;
  }
  return [];
}

type RulePackRow = {
  pack_attributes: unknown;
  version_attributes: unknown;
  assignment_attributes: unknown;
};

/**
 * The rule-pack version assigned to this tenant, preferred over any unassigned
 * pack. Packs and versions are global rows; only the assignment is tenant-owned.
 */
async function readRulePack(access: Access): Promise<WageFloorConfiguration> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select p.attributes as pack_attributes,
             v.attributes as version_attributes,
             a.attributes as assignment_attributes
      from rule_pack_versions v
      left join statutory_rule_packs p on p.id = v.statutory_rule_pack_id
      left join rule_pack_assignments a on a.rule_pack_version_id = v.id and a.tenant_id = ${access.tenantId}
      order by (a.id is null), v.created_at desc
      limit 1
    `,
  ]);
  const row = (rows as RulePackRow[])[0];
  if (!row) return { packCode: null, packVersion: null, effectiveFrom: null, rates: [], floorPercent: null };

  const pack = bagOf(row.pack_attributes);
  const version = bagOf(row.version_attributes);
  const assignment = bagOf(row.assignment_attributes);
  const pick = firstDefined(version, pack, assignment);

  return {
    packCode: textOf(pack?.code),
    packVersion: textOf(version?.code),
    effectiveFrom: textOf(assignment?.effective_from) ?? textOf(pick("effective_from")),
    rates: readRates(version, pack),
    floorPercent: percentOf(pick("wage_floor_percent") ?? pick("wage_floor_percentage")),
  };
}

/** The stored statutory rates for this tenant's active rule pack. */
export async function getStatutoryRates(access: Access): Promise<StatutoryRatePack> {
  const { packCode, packVersion, effectiveFrom, rates } = await readRulePack(access);
  return { packCode, packVersion, effectiveFrom, rates };
}

/** The same pack plus the stored wage-floor percentage, for the simulator. */
export async function getWageFloorConfiguration(access: Access): Promise<WageFloorConfiguration> {
  return readRulePack(access);
}

export type WageFloorInput = {
  grossMinor: number;
  basicMinor: number;
  dearnessMinor: number;
  hraMinor: number;
  specialMinor: number;
};

export type WageFloorLine = {
  component: string;
  preCodeMinor: number;
  postCodeMinor: number;
  deltaMinor: number;
};

export type WageFloorResult = {
  basicDaPercent: number;
  floorTriggered: boolean;
  declaredBaseMinor: number;
  statutoryBaseMinor: number;
  addBackMinor: number;
  lines: WageFloorLine[];
  rateSource: string | null;
};

const amountSchema = z.number().int().nonnegative();

export const wageFloorInputSchema = z.object({
  grossMinor: amountSchema,
  basicMinor: amountSchema,
  dearnessMinor: amountSchema,
  hraMinor: amountSchema,
  specialMinor: amountSchema,
});

function amountOf(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/** Applies one stored percentage to a wage base. A rate with no percent scores nothing. */
function applyRate(baseMinor: number, percent: number | null): number {
  if (percent === null) return 0;
  return Math.round((baseMinor * percent) / PERCENT_SCALE);
}

/**
 * Pure wage-floor simulation.
 *
 * `floorPercent` and every entry in `rates` must come from a stored rule-pack
 * row — this function never supplies a statutory figure of its own. With an
 * empty `rates` list it still reports the floor arithmetic but produces no
 * contribution lines and no rate source.
 */
export function simulateWageFloor(
  input: WageFloorInput,
  rates: StatutoryRate[],
  floorPercent: number,
): WageFloorResult {
  const grossMinor = amountOf(input.grossMinor);
  const declaredBaseMinor = amountOf(input.basicMinor) + amountOf(input.dearnessMinor);
  const floor = Number.isFinite(floorPercent) ? Math.max(0, floorPercent) : 0;

  const basicDaPercent =
    grossMinor > 0
      ? Math.round((declaredBaseMinor / grossMinor) * PERCENT_SCALE * DISPLAY_PRECISION) / DISPLAY_PRECISION
      : 0;

  // Compared on integers so a rounded percentage never flips the trigger.
  const floorTriggered = grossMinor > 0 && declaredBaseMinor * PERCENT_SCALE < grossMinor * floor;
  const statutoryBaseMinor = floorTriggered
    ? Math.round((grossMinor * floor) / PERCENT_SCALE)
    : declaredBaseMinor;
  const addBackMinor = Math.max(0, statutoryBaseMinor - declaredBaseMinor);

  const lines = rates.map<WageFloorLine>((rate) => {
    const preCodeMinor = applyRate(declaredBaseMinor, rate.percent);
    const postCodeMinor = applyRate(statutoryBaseMinor, rate.percent);
    return {
      component: rate.label || rate.code,
      preCodeMinor,
      postCodeMinor,
      deltaMinor: postCodeMinor - preCodeMinor,
    };
  });

  return {
    basicDaPercent,
    floorTriggered,
    declaredBaseMinor,
    statutoryBaseMinor,
    addBackMinor,
    lines,
    // Names the stored rows this result was computed from; null when none were supplied.
    rateSource: rates.length === 0 ? null : rates.map((rate) => rate.code).join(", "),
  };
}
