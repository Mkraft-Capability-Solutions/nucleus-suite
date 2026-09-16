import { z } from "zod";
import { picklistValues, picklists, type PicklistValue } from "@/lib/picklists";
import { leaveEncashmentWorking, type EncashmentBasis } from "@/server/payroll/settlement";

/**
 * FRM-LVE-04 Leave Encashment Request — the rules, with no database in them.
 *
 * Two figures on this form come "from policy" and the workbook states neither:
 * the rate basis (PL_ENCASHMENT_BASIS) and the divisor that turns the monthly
 * wage into a day rate. `src/server/payroll/settlement.ts` already refuses to
 * price a leaver's encashment without them; this module reads the same two
 * values from tenant settings and refuses the same way, so a request and a
 * settlement can never disagree about what a day of leave is worth.
 */

export const LEAVE_ENCASHMENT_SETTINGS_PATH = "tenant_settings.settings -> 'leave_encashment'";

export type EncashmentRateBasis = PicklistValue<"PL_ENCASHMENT_BASIS">;

const encashmentPolicySchema = z.object({
  rateBasis: z.enum(picklistValues("PL_ENCASHMENT_BASIS")).optional(),
  /** Days in the notional month the monthly wage is divided by. */
  monthDaysDivisor: z.number().int().min(1).max(31).optional(),
  /** Days of a type that must remain on the balance after encashing, by leave-type code. */
  retentionFloorDays: z.record(z.string(), z.number().min(0).max(365)).optional(),
});

export type EncashmentPolicy = {
  rateBasis: EncashmentRateBasis | null;
  monthDaysDivisor: number | null;
  retentionFloorDays: Record<string, number>;
};

/** The stored policy, or one with nothing supplied when the bag is absent or malformed. */
export function parseEncashmentPolicy(raw: unknown): EncashmentPolicy {
  const parsed = encashmentPolicySchema.safeParse(raw ?? {});
  const value = parsed.success ? parsed.data : {};
  return {
    rateBasis: value.rateBasis ?? null,
    monthDaysDivisor: value.monthDaysDivisor ?? null,
    retentionFloorDays: Object.fromEntries(
      Object.entries(value.retentionFloorDays ?? {}).map(([code, days]) => [code.trim().toUpperCase(), days]),
    ),
  };
}

export type EncashmentPolicyGap = { rule: string; detail: string };

/** What the policy is still missing, named the way the settlement working names it. */
export function encashmentPolicyGaps(policy: EncashmentPolicy): EncashmentPolicyGap[] {
  const gaps: EncashmentPolicyGap[] = [];
  if (policy.rateBasis === null) {
    gaps.push({
      rule: "PL_ENCASHMENT_BASIS",
      detail: `The workbook says the rate basis is "from policy" (Basic, Basic + DA or Gross) and never states it. Set \`rateBasis\` under ${LEAVE_ENCASHMENT_SETTINGS_PATH}.`,
    });
  }
  if (policy.monthDaysDivisor === null) {
    gaps.push({
      rule: "PL_ENCASHMENT_MONTH_DAYS",
      detail: `The divisor that turns the monthly wage into a day rate is not stated anywhere. Set \`monthDaysDivisor\` under ${LEAVE_ENCASHMENT_SETTINGS_PATH}.`,
    });
  }
  return gaps;
}

/**
 * The picklist spells "Basic + DA" as `basic_da`; the settlement working, which
 * predates the registry, spells it `basic_plus_da`. Same wage, one arithmetic.
 */
const SETTLEMENT_BASIS: Record<EncashmentRateBasis, EncashmentBasis> = {
  basic: "basic",
  basic_da: "basic_plus_da",
  gross: "gross",
};

export type EncashmentEstimate = {
  rateBasis: EncashmentRateBasis | null;
  /** Null until the policy supplies both the basis and the divisor. */
  amountMinor: number | null;
  perDayMinor: number | null;
  blockedBy: string[];
  basis: string;
};

/**
 * The indicative amount for `days`, priced by the settlement working so a
 * request and a full-and-final quote the same figure for the same days.
 */
export function estimateEncashment(input: {
  days: number;
  policy: EncashmentPolicy;
  monthlyWagesMinor: { basic: number; da: number; gross: number };
}): EncashmentEstimate {
  const working = leaveEncashmentWorking({
    balanceDays: input.days,
    basis: input.policy.rateBasis === null ? null : SETTLEMENT_BASIS[input.policy.rateBasis],
    monthDaysDivisor: input.policy.monthDaysDivisor,
    monthlyWagesMinor: {
      basic: input.monthlyWagesMinor.basic,
      basic_plus_da: input.monthlyWagesMinor.basic + input.monthlyWagesMinor.da,
      gross: input.monthlyWagesMinor.gross,
    },
    balanceSource: "days requested",
  });
  const perDay = working.inputs.perDayMinor;
  return {
    rateBasis: input.policy.rateBasis,
    amountMinor: working.amountMinor,
    perDayMinor: typeof perDay === "number" ? perDay : null,
    blockedBy: working.blockedBy,
    basis: working.basis,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export type EncashableInput = {
  /** The ledger balance of the type as at today. */
  balance: number;
  /** FRM-LVE-01 `encashment_cap`: days a year; null when the type states none. */
  annualCap: number | null;
  /** `encash` movements already written this calendar year. */
  encashedThisYear: number;
  /** Days on requests still in flight (requested or approved but not yet posted). */
  pendingDays: number;
  /** Days that must stay on the balance; null when the policy states no floor. */
  retentionFloorDays: number | null;
};

export type EncashableResult = {
  encashable: number;
  /** Which limit set the ceiling, for the screen to say why. */
  limitedBy: "balance" | "retention_floor" | "annual_cap";
  /** Rules that would narrow the ceiling but have no value, so were not applied. */
  unstated: string[];
};

/**
 * The most a request may ask for right now: the balance less the retention
 * floor and anything already in flight, and no more than what remains of the
 * annual cap. Both limits come from the workbook's validation column; where the
 * tenant has stated neither, the balance alone is the ceiling and the gap is named.
 */
export function encashableDays(input: EncashableInput): EncashableResult {
  const unstated: string[] = [];
  let limitedBy: EncashableResult["limitedBy"] = "balance";
  let ceiling = round(input.balance - input.pendingDays);
  if (input.retentionFloorDays === null) unstated.push("retention_floor_days");
  else if (round(input.balance - input.retentionFloorDays - input.pendingDays) < ceiling) {
    ceiling = round(input.balance - input.retentionFloorDays - input.pendingDays);
    limitedBy = "retention_floor";
  }
  if (input.annualCap === null) unstated.push("encashment_cap");
  else {
    const capRemaining = round(input.annualCap - input.encashedThisYear - input.pendingDays);
    if (capRemaining < ceiling) {
      ceiling = capRemaining;
      limitedBy = "annual_cap";
    }
  }
  return { encashable: Math.max(0, ceiling), limitedBy, unstated };
}

/** Why `days` cannot be encashed against `ceiling`, or null when it can. */
export function encashmentRefusal(days: number, ceiling: EncashableResult): string | null {
  if (days <= ceiling.encashable) return null;
  const reason =
    ceiling.limitedBy === "annual_cap" ? "what remains of the annual encashment cap"
    : ceiling.limitedBy === "retention_floor" ? "the balance above the retention floor"
    : "the encashable balance";
  return `${days} day${days === 1 ? "" : "s"} exceeds ${reason} of ${ceiling.encashable}.`;
}

/**
 * The engine identifies a leave type by its code (EL, CL, ...); the workbook's
 * select is PL_LEAVE_TYPE. These are the codes the leave engine already knows
 * under those names — anything else is resolved against the tenant's own
 * `leave_types` rows by name, never guessed.
 */
export const LEAVE_TYPE_CODE_BY_PICKLIST: Partial<Record<PicklistValue<"PL_LEAVE_TYPE">, string>> = {
  earned_leave: "EL",
  casual_leave: "CL",
  sick_leave: "SL",
  compensatory_off: "COFF",
  birthday_leave: "BIRTHDAY",
};

/** The picklist value for a code the engine already knows, so a stored code reads back as its select. */
export function picklistValueForLeaveCode(code: string): PicklistValue<"PL_LEAVE_TYPE"> | null {
  const upper = code.trim().toUpperCase();
  for (const [value, mapped] of Object.entries(LEAVE_TYPE_CODE_BY_PICKLIST)) {
    if (mapped === upper) return value as PicklistValue<"PL_LEAVE_TYPE">;
  }
  const byLabel = picklists.PL_LEAVE_TYPE.values.find((entry) => entry.label.toLowerCase() === code.trim().toLowerCase());
  return byLabel ? byLabel.value : null;
}

/** FRM-LVE-04 Request section. `current_balance`, `rate_basis` and `estimated_amount` are derived, never posted. */
export const requestEncashmentSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(picklistValues("PL_LEAVE_TYPE")),
  /** Dec(5,1): whole and half days, up to the field's width. */
  daysToEncash: z.number().positive().max(9999.9).multipleOf(0.5),
  reason: z.string().trim().min(1).max(200).optional(),
});

export type RequestEncashmentInput = z.infer<typeof requestEncashmentSchema>;

/** FRM-LVE-04 Approval section (PL_DECISION). Remarks are mandatory on anything but an approval. */
export const decideEncashmentSchema = z
  .object({
    decision: z.enum(picklistValues("PL_DECISION")),
    remarks: z.string().trim().min(1).max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision !== "approve" && !value.remarks) {
      ctx.addIssue({ code: "custom", path: ["remarks"], message: "A reason is required on anything but an approval." });
    }
  });

export type DecideEncashmentInput = z.infer<typeof decideEncashmentSchema>;

/** The status each decision leaves on the request. A delegated decision is still pending. */
export const ENCASHMENT_DECISION_STATUS: Record<PicklistValue<"PL_DECISION">, "approved" | "rejected" | "returned" | "requested"> = {
  approve: "approved",
  reject: "rejected",
  return_for_correction: "returned",
  delegate: "requested",
};

/** FRM-LVE-04 Payroll section: the open run the payout is filed against. */
export const tagEncashmentSchema = z.object({
  runId: z.string().uuid(),
});

export type TagEncashmentInput = z.infer<typeof tagEncashmentSchema>;

/** Runs whose figures are already fixed take no further inputs. */
export const CLOSED_RUN_STATUSES = ["finalized", "paid", "closed"] as const;
