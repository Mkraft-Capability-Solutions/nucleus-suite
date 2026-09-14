import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Establishment control: sanctioned strength, derived headroom, and the gate that
 * stops a requisition exceeding an approved ceiling.
 *
 * Process refs PPL-04 and TAL-01:
 *   RL-055  sanctioned strength is recorded by org unit + designation + location,
 *           with an effective period and an approver.
 *   RL-056  filled and open counts are DERIVED from assignments and requisitions.
 *           Neither is stored.
 *   RL-057  headroom = sanctioned - filled - open.
 *   RL-461  a replacement names a vacated position code and consumes no fresh
 *           sanctioned strength.
 *   RL-462  an addition exceeding sanctioned strength is blocked AT APPROVAL.
 *   RL-463  an authorised role may override, with a recorded reason.
 *
 * The ceiling itself lives in `vp_manpower_lines`, which already exists as a real
 * typed table with a natural key of (tenant, plan year, department, designation,
 * location) and an approver. This module reads it rather than introducing a second
 * store: an establishment ceiling that two tables disagree about is worse than one
 * that is inconveniently shaped.
 */

/** SCR-013's three states. */
export const ESTABLISHMENT_STATES = ["within_headroom", "at_limit", "over_plan"] as const;
export type EstablishmentState = (typeof ESTABLISHMENT_STATES)[number];

export const ESTABLISHMENT_STATE_LABELS: Record<EstablishmentState, string> = {
  within_headroom: "Within headroom",
  at_limit: "At limit",
  over_plan: "Over plan",
};

export const REQUISITION_TYPES = ["addition", "replacement"] as const;
export type RequisitionType = (typeof REQUISITION_TYPES)[number];

/** The workbook requires an override reason of at least 20 characters (SCR-090). */
export const OVERRIDE_REASON_MIN_LENGTH = 20;

export type HeadroomCounts = { sanctioned: number; filled: number; open: number };

/**
 * RL-057. Deliberately NOT clamped at zero: SCR-013 defines an "over plan" state,
 * which only exists if headroom can go negative. Clamping would hide exactly the
 * condition the board is meant to show.
 */
export function headroomOf(counts: HeadroomCounts): number {
  return counts.sanctioned - counts.filled - counts.open;
}

export function establishmentState(counts: HeadroomCounts): EstablishmentState {
  const headroom = headroomOf(counts);
  if (headroom < 0) return "over_plan";
  if (headroom === 0) return "at_limit";
  return "within_headroom";
}

/** Share of the ceiling already committed. Reported above 100 rather than capped. */
export function utilisationPercent(counts: HeadroomCounts): number | null {
  if (counts.sanctioned <= 0) return null;
  return Math.round(((counts.filled + counts.open) / counts.sanctioned) * 100);
}

export type RequisitionDecisionInput = {
  requisitionType: RequisitionType;
  positions: number;
  counts: HeadroomCounts;
  /** RL-461: the vacated position code a replacement is filling. */
  againstPositionCode: string | null;
  /** True when the named position is vacant and not frozen. */
  againstPositionVacant: boolean;
  override: boolean;
  overrideReason: string | null;
  /** Caller holds the manpower-approval permission. */
  overriderAuthorised: boolean;
  /**
   * Caller is a different person from whoever approved the ceiling. An override is
   * a decision to exceed a control; letting its own approver waive it would make the
   * control self-certifying.
   */
  overriderDistinctFromApprover: boolean;
};

export type RequisitionDecision =
  | { allowed: true; consumesSanction: boolean; headroomAfter: number; overridden: boolean; warnings: string[] }
  | { allowed: false; code: string; message: string };

/**
 * RL-461/462/463, as a pure function so the rule is testable without a database and
 * is identical whether it runs at approval, on a preview panel, or in a test.
 */
export function decideRequisition(input: RequisitionDecisionInput): RequisitionDecision {
  const warnings: string[] = [];

  if (input.positions < 1) {
    return { allowed: false, code: "INVALID_POSITIONS", message: "A requisition must ask for at least one position." };
  }

  // RL-461 - a replacement backfills a named vacated seat and consumes no fresh sanction.
  if (input.requisitionType === "replacement") {
    if (!input.againstPositionCode?.trim()) {
      return {
        allowed: false,
        code: "REPLACEMENT_POSITION_REQUIRED",
        message: "A replacement requisition must name the vacated position code it backfills.",
      };
    }
    if (!input.againstPositionVacant) {
      return {
        allowed: false,
        code: "REPLACEMENT_POSITION_UNAVAILABLE",
        message: `Position ${input.againstPositionCode} is not vacant, so it cannot be backfilled.`,
      };
    }
    return { allowed: true, consumesSanction: false, headroomAfter: headroomOf(input.counts), overridden: false, warnings };
  }

  // RL-462 - an addition is blocked at approval when it would exceed the ceiling.
  const headroom = headroomOf(input.counts);
  const headroomAfter = headroom - input.positions;
  if (headroomAfter >= 0) {
    if (headroomAfter === 0) warnings.push("This requisition consumes the last of the approved headroom.");
    return { allowed: true, consumesSanction: true, headroomAfter, overridden: false, warnings };
  }

  if (!input.override) {
    return {
      allowed: false,
      code: "SANCTION_EXCEEDED",
      message:
        `Blocked: this addition would exceed approved manpower. Sanctioned ${input.counts.sanctioned}, ` +
        `filled ${input.counts.filled}, open ${input.counts.open}, headroom ${headroom}, requested ${input.positions}. ` +
        `An authorised override with a recorded reason is required.`,
    };
  }

  // RL-463 - override is permitted, but only by an authorised role and with a reason.
  if (!input.overriderAuthorised) {
    return {
      allowed: false,
      code: "OVERRIDE_NOT_PERMITTED",
      message: "Exceeding approved manpower requires an authorised role. Your role cannot override the establishment ceiling.",
    };
  }
  if (!input.overriderDistinctFromApprover) {
    return {
      allowed: false,
      code: "OVERRIDE_SELF_APPROVAL",
      message: "The person who approved this manpower ceiling cannot also waive it. A different authorised approver must record the override.",
    };
  }
  const reason = (input.overrideReason ?? "").trim();
  if (reason.length < OVERRIDE_REASON_MIN_LENGTH) {
    return {
      allowed: false,
      code: "OVERRIDE_REASON_REQUIRED",
      message: `An establishment override needs a recorded justification of at least ${OVERRIDE_REASON_MIN_LENGTH} characters. Received ${reason.length}.`,
    };
  }
  warnings.push(`Approved over plan by ${Math.abs(headroomAfter)} position(s) under a recorded override.`);
  return { allowed: true, consumesSanction: true, headroomAfter, overridden: true, warnings };
}

export type SanctionKey = {
  departmentId: string;
  departmentName: string;
  designation: string;
  locationId: string | null;
  planYear: number;
};

export type EstablishmentLine = SanctionKey & {
  manpowerLineId: string | null;
  approvedByMembershipId: string | null;
  sanctioned: number;
  filled: number;
  open: number;
  headroom: number;
  utilisationPercent: number | null;
  state: EstablishmentState;
  /** Set when no approved ceiling exists for the key - headroom is then unknown, not zero. */
  unsanctioned: boolean;
};

function planYearOf(value?: number): number {
  return value ?? new Date().getUTCFullYear();
}

/**
 * Reads the approved ceilings for a plan year and derives filled and open against
 * each. Filled comes from active employees, open from live addition requisitions;
 * neither is persisted, per RL-056.
 */
export async function listEstablishment(access: Access, args: { planYear?: number } = {}): Promise<EstablishmentLine[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const planYear = planYearOf(args.planYear);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select
        l.id as manpower_line_id,
        l.department_id,
        coalesce(d.attributes->>'name', '') as department_name,
        l.designation,
        l.location_id,
        l.sanctioned_count,
        l.approved_by_membership_id,
        (
          select count(*)::int from employees e
          where e.tenant_id = l.tenant_id
            and e.status = 'active'
            and lower(e.department) = lower(coalesce(d.attributes->>'name', ''))
            and lower(e.designation) = lower(l.designation)
        ) as filled,
        (
          select count(*)::int from requisitions r
          where r.tenant_id = l.tenant_id
            and r.department_id = l.department_id
            and coalesce(r.attributes->>'requisition_type', 'addition') = 'addition'
            and coalesce(r.attributes->>'status', 'draft') in ('draft', 'approved')
            and lower(coalesce(r.attributes->>'designation', l.designation)) = lower(l.designation)
        ) as open
      from vp_manpower_lines l
      left join departments d on d.id = l.department_id and d.tenant_id = l.tenant_id
      where l.tenant_id = ${access.tenantId} and l.plan_year = ${planYear} and l.status = 'approved'
      order by department_name, l.designation
    `,
  ]);
  return (rows as Array<{
    manpower_line_id: string; department_id: string; department_name: string; designation: string;
    location_id: string | null; sanctioned_count: number; approved_by_membership_id: string | null;
    filled: number; open: number;
  }>).map((row) => {
    const counts = { sanctioned: Number(row.sanctioned_count), filled: Number(row.filled), open: Number(row.open) };
    return {
      manpowerLineId: row.manpower_line_id,
      departmentId: row.department_id,
      departmentName: row.department_name,
      designation: row.designation,
      locationId: row.location_id,
      planYear,
      approvedByMembershipId: row.approved_by_membership_id,
      ...counts,
      headroom: headroomOf(counts),
      utilisationPercent: utilisationPercent(counts),
      state: establishmentState(counts),
      unsanctioned: false,
    };
  });
}

/**
 * Headroom for one sanction key. Returns `unsanctioned` when no approved ceiling
 * exists: that is not the same as a ceiling of zero, and an addition against an
 * unsanctioned key must be refused rather than silently treated as over plan.
 */
export async function headroomForKey(
  access: Access,
  key: { departmentId: string; designation: string; planYear?: number },
): Promise<EstablishmentLine | null> {
  const lines = await listEstablishment(access, { planYear: key.planYear });
  return lines.find(
    (line) => line.departmentId === key.departmentId && line.designation.toLowerCase() === key.designation.toLowerCase(),
  ) ?? null;
}

export type EstablishmentControl =
  | { active: false; reason: string }
  | { active: true; line: EstablishmentLine | null };

/**
 * Whether establishment control applies to this tenant and key.
 *
 * A tenant that has configured no approved manpower lines at all has not adopted
 * establishment control, and blocking every requisition approval on a ceiling that
 * nobody has set would break existing hiring rather than govern it. Once ANY ceiling
 * exists for the plan year the control is live, and a key with no ceiling is then a
 * gap in the establishment rather than an absence of one - so it is refused.
 */
export async function establishmentControlFor(
  access: Access,
  key: { departmentId: string; designation: string; planYear?: number },
): Promise<EstablishmentControl> {
  const lines = await listEstablishment(access, { planYear: key.planYear });
  if (lines.length === 0) {
    return {
      active: false,
      reason: `No approved manpower lines exist for ${planYearOf(key.planYear)}, so establishment control is not in force. Approve sanctioned strength to enable the headroom check.`,
    };
  }
  const line = lines.find(
    (entry) => entry.departmentId === key.departmentId && entry.designation.toLowerCase() === key.designation.toLowerCase(),
  ) ?? null;
  return { active: true, line };
}

export const establishmentQuerySchema = z.object({
  planYear: z.coerce.number().int().min(2000).max(2200).optional(),
});
