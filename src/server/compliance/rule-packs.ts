import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { isoOrNull, minorOrNull, textOrNull } from "./route-support";

/**
 * Stored statutory rule packs and the state rule matrix derived from them.
 *
 * Packs and versions are global reference rows (`statutory_rule_packs`, `rule_pack_versions`); only the
 * assignment (`rule_pack_assignments`) is tenant owned. Every value shown is read from the version's
 * attributes; a field a version does not carry is returned as null so the screen can say "not recorded"
 * instead of a guess. Nothing in this file holds a statutory figure of its own.
 */

export type RulePackVersion = {
  versionId: string;
  packCode: string | null;
  packName: string | null;
  jurisdiction: string | null;
  stateCode: string | null;
  versionCode: string | null;
  effectiveFrom: string | null;
  supersedes: string | null;
  assigned: boolean;
  assignedFrom: string | null;
  wageFloorPercent: number | null;
  rateCount: number;
  goldenTests: { passed: number; total: number } | null;
  createdAt: string | null;
  attributes: Record<string, unknown>;
};

export type StateRuleRow = {
  stateCode: string;
  stateName: string | null;
  packCode: string | null;
  versionCode: string | null;
  codeOnWages: string | null;
  socialSecurityCode: string | null;
  minimumWageMonthlyMinor: number | null;
  currency: string;
  overtimeRule: string | null;
  womenNightShiftRule: string | null;
};

type Bag = Record<string, unknown>;
type Row = { version_id: string; pack: Bag | null; version: Bag | null; assignment: Bag | null; assignment_id: string | null; created_at: unknown };

function bag(value: unknown): Bag {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Bag) : {};
}
function pick(key: string, ...bags: Bag[]): unknown {
  for (const b of bags) if (b[key] !== undefined && b[key] !== null) return b[key];
  return null;
}
function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function readVersion(row: Row): RulePackVersion {
  const pack = bag(row.pack);
  const version = bag(row.version);
  const assignment = bag(row.assignment);
  const passed = num(pick("golden_tests_passed", version));
  const total = num(pick("golden_tests_total", version));
  return {
    versionId: row.version_id,
    packCode: textOrNull(pack.code),
    packName: textOrNull(pack.name),
    jurisdiction: textOrNull(pick("jurisdiction", version, pack)),
    stateCode: textOrNull(pick("state_code", version, pack)),
    versionCode: textOrNull(version.code),
    effectiveFrom: textOrNull(assignment.effective_from) ?? textOrNull(pick("effective_from", version, pack)),
    supersedes: textOrNull(version.supersedes),
    assigned: row.assignment_id !== null,
    assignedFrom: textOrNull(assignment.effective_from),
    wageFloorPercent: num(pick("wage_floor_percent", version, pack) ?? pick("wage_floor_percentage", version, pack)),
    rateCount: Array.isArray(version.rates) ? version.rates.length : Array.isArray(pack.rates) ? pack.rates.length : 0,
    goldenTests: passed !== null && total !== null ? { passed, total } : null,
    createdAt: isoOrNull(row.created_at),
    attributes: version,
  };
}

export function stateMatrix(versions: readonly RulePackVersion[]): StateRuleRow[] {
  const latest = new Map<string, RulePackVersion>();
  for (const version of versions) {
    if (!version.stateCode) continue;
    const prior = latest.get(version.stateCode);
    // Prefer the tenant's assigned version, then the most recent effective date.
    if (!prior || (version.assigned && !prior.assigned) || (version.assigned === prior.assigned && (version.effectiveFrom ?? "") > (prior.effectiveFrom ?? ""))) {
      latest.set(version.stateCode, version);
    }
  }
  return [...latest.values()]
    .map((v) => ({
      stateCode: v.stateCode as string,
      stateName: textOrNull(v.attributes.state_name),
      packCode: v.packCode,
      versionCode: v.versionCode,
      codeOnWages: textOrNull(v.attributes.code_on_wages_status),
      socialSecurityCode: textOrNull(v.attributes.social_security_status),
      minimumWageMonthlyMinor: minorOrNull(v.attributes.minimum_wage_monthly_minor),
      currency: textOrNull(v.attributes.currency) ?? "INR",
      overtimeRule: textOrNull(v.attributes.overtime_rule),
      womenNightShiftRule: textOrNull(v.attributes.women_night_shift_rule),
    }))
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode));
}

export async function loadRulePacks(access: Access): Promise<{ versions: RulePackVersion[]; active: RulePackVersion | null; states: StateRuleRow[] }> {
  enforce(access.context, "compliance.filing.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select v.id as version_id, p.attributes as pack, v.attributes as version, a.attributes as assignment, a.id as assignment_id, v.created_at
      from rule_pack_versions v
      left join statutory_rule_packs p on p.id = v.statutory_rule_pack_id
      left join rule_pack_assignments a on a.rule_pack_version_id = v.id and a.tenant_id = ${access.tenantId}
      order by (a.id is null), v.created_at desc
      limit 200
    `,
  ]);
  const versions = (rows as Row[]).map(readVersion);
  const active = versions.find((v) => v.assigned) ?? null;
  return { versions, active, states: stateMatrix(versions) };
}
