import "server-only";

import { sqlClient } from "@/lib/db";
// A landlord or lender PAN may belong to a company, so the general PAN shape applies - not
// `isIndividualPan`, which additionally requires "P" as the fourth character.
import { PAN_PATTERN } from "@/lib/statutory-ids";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError, parsePagination } from "@/server/platform/http";
import { operationalScope } from "@/server/workflows/operational-access";
import { listStructureComponents, resolveStructure, type StructureLine } from "./components";
import { DEFAULT_RULE_PACK_CODE, rulePack, ruleGaps, type RulePack } from "./rule-pack";

/**
 * SCR-054 - Tax declaration and projection (FRM-PAY-05).
 *
 * The declaration itself is an operational record (`taxDeclarations` in
 * `src/lib/operational-catalog.ts`), served by the generic
 * `/api/v1/operations/[resource]` family. This module adds only the read model
 * the screen needs on top of it: the projection.
 *
 * THE DESIGN CONSTRAINT THIS FILE EXISTS TO HONOUR
 * ------------------------------------------------
 * A tax projection has computable inputs and a non-computable result. Rule pack
 * `in-pay/v1` supplies nothing under `tds.*`, nothing under `deductionCaps.*`
 * and nothing under `hraExemption.*` - no slabs, no standard deduction, no cess,
 * no surcharge, no 87A rebate, no section ceilings, no least-of-three constants.
 *
 * So this module computes what the data actually supports:
 *   - projected annual gross, resolved from the employee's salary structure;
 *   - declared amounts per head and per section, summed exactly;
 *   - HRA inputs (rent, basic + DA, work location);
 *   - tax already deducted this financial year, read from posted payroll lines;
 * and refuses to produce what it cannot:
 *   - no section cap is applied while its ceiling is unsupplied - the head is
 *     reported indeterminate and the missing rule is named, never capped at an
 *     invented ceiling and never silently allowed in full;
 *   - HRA exemption is `null` with its missing constants named;
 *   - projected annual tax and monthly TDS are `null` with `blockedBy` naming
 *     every rule that stands in the way;
 *   - both regimes are returned with their own blocked lists rather than one
 *     side being fabricated so a comparison can be drawn.
 *
 * Nothing here writes. Declarations are created, edited and transitioned through
 * the generic operational endpoints, which already own validation, idempotency,
 * optimistic concurrency, history and audit.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const TAX_DECLARATION_RESOURCE = "taxDeclarations";

/** As declared on the operational resource. Reads fall back to self/team scope. */
export const TAX_DECLARATION_PERMISSION = "payroll.settlement";

/** Verification transitions are approvals; the generic route enforces this key. */
export const TAX_VERIFY_PERMISSION = "payroll.settlement.approve";

export const TAX_REGIMES = ["old_regime", "new_regime"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  old_regime: "Old regime",
  new_regime: "New regime",
};

export const DECLARATION_STATES = [
  "draft",
  "submitted",
  "proof_pending",
  "verified",
  "partially_verified",
  "returned",
  "rejected",
  "cancelled",
] as const;
export type DeclarationState = (typeof DECLARATION_STATES)[number];

export const DECLARATION_STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  proof_pending: "Proof pending",
  verified: "Verified",
  partially_verified: "Partially verified",
  returned: "Returned",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Payroll run statuses whose lines represent tax actually deducted. */
const POSTED_RUN_STATUSES = ["finalized", "paid", "closed"] as const;
/** Calculated but not yet finalised: a figure, but not yet a deduction. */
const PROVISIONAL_RUN_STATUSES = ["calculated", "approved"] as const;

// ---------------------------------------------------------------------------
// Declared heads and the sections they roll into
// ---------------------------------------------------------------------------

export type DeductionHeadDefinition = { code: string; label: string };

export type DeductionSectionDefinition = {
  code: string;
  label: string;
  /**
   * The rule pack path that supplies this section's ceiling. A path the pack
   * does not declare at all (`section80g`) and a path it declares as `null`
   * (`section80c`) are both unusable, and are reported differently so the gap
   * is actionable.
   */
  capRule: string;
  heads: DeductionHeadDefinition[];
};

export const DEDUCTION_SECTIONS: DeductionSectionDefinition[] = [
  {
    code: "80C",
    label: "Section 80C",
    capRule: "deductionCaps.section80c",
    heads: [
      { code: "employeePfMinor", label: "Employee provident fund" },
      { code: "publicProvidentFundMinor", label: "Public provident fund" },
      { code: "lifeInsuranceMinor", label: "Life insurance premium" },
      { code: "elssMinor", label: "ELSS / tax saving mutual funds" },
      { code: "tuitionFeesMinor", label: "Children tuition fees" },
      { code: "housingPrincipalMinor", label: "Housing loan principal" },
      { code: "otherSection80cMinor", label: "Other 80C investments" },
    ],
  },
  {
    code: "80CCD(1B)",
    label: "Section 80CCD(1B) - National Pension System",
    capRule: "deductionCaps.section80ccd1b",
    heads: [{ code: "nps80ccd1bMinor", label: "NPS contribution" }],
  },
  {
    code: "80D-self",
    label: "Section 80D - self and family",
    capRule: "deductionCaps.section80dSelf",
    heads: [{ code: "healthInsuranceSelfMinor", label: "Health insurance - self and family" }],
  },
  {
    code: "80D-parents",
    label: "Section 80D - parents",
    capRule: "deductionCaps.section80dParents",
    heads: [{ code: "healthInsuranceParentsMinor", label: "Health insurance - parents" }],
  },
  {
    code: "80DD",
    label: "Section 80DD - disability maintenance",
    capRule: "deductionCaps.section80dd",
    heads: [{ code: "disability80ddMinor", label: "Disability maintenance" }],
  },
  {
    code: "80E",
    label: "Section 80E - education loan interest",
    capRule: "deductionCaps.section80e",
    heads: [{ code: "educationLoanInterestMinor", label: "Education loan interest" }],
  },
  {
    code: "80G",
    label: "Section 80G - donations",
    capRule: "deductionCaps.section80g",
    heads: [{ code: "donations80gMinor", label: "Donations" }],
  },
  {
    code: "80TTA",
    label: "Section 80TTA - savings interest",
    capRule: "deductionCaps.section80tta",
    heads: [{ code: "savingsInterest80ttaMinor", label: "Savings bank interest" }],
  },
  {
    code: "24(b)-self",
    label: "Section 24(b) - self-occupied house property",
    capRule: "deductionCaps.housingInterestSelfOccupied",
    heads: [{ code: "housingInterestSelfMinor", label: "Housing loan interest - self-occupied" }],
  },
  {
    code: "24(b)-letout",
    label: "Section 24(b) - let-out house property",
    capRule: "deductionCaps.housingInterestLetOut",
    heads: [{ code: "housingInterestLetOutMinor", label: "Housing loan interest - let out" }],
  },
];

export const DEDUCTION_HEAD_CODES: string[] = DEDUCTION_SECTIONS.flatMap((section) =>
  section.heads.map((head) => head.code),
);

/**
 * Whether a deduction head is admissible under a given regime is itself a
 * statutory rule, and the pack declares no such rule. Naming the path keeps the
 * gap visible instead of the screen quietly assuming one regime's treatment.
 */
export const REGIME_ADMISSIBILITY_RULE = "deductionCaps.regimeAdmissibility";

/**
 * The date after which the regime elected for a financial year can no longer be
 * switched. It is configuration, not a statutory constant, and no configuration
 * source in this codebase carries it - so it is surfaced as unconfigured rather
 * than defaulted to a date nobody approved.
 */
export const REGIME_FREEZE_DATE_SETTING = "configuration.taxRegimeFreezeDate";

/** Named because gross depends on it and it is an input gap, not a rule gap. */
export const SALARY_STRUCTURE_INPUT = "salaryStructure.assignment";

// ---------------------------------------------------------------------------
// Reading the declaration payload
// ---------------------------------------------------------------------------

export type DeclarationData = Record<string, unknown>;

export function declaredMinor(data: DeclarationData, code: string): number {
  const raw = data[code];
  if (raw === null || raw === undefined || raw === "") return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function declaredRegime(data: DeclarationData): TaxRegime | null {
  const raw = data.taxRegime;
  return typeof raw === "string" && (TAX_REGIMES as readonly string[]).includes(raw) ? (raw as TaxRegime) : null;
}

function declaredText(data: DeclarationData, code: string): string | null {
  const raw = data[code];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

// ---------------------------------------------------------------------------
// Financial year
// ---------------------------------------------------------------------------

export type FinancialYear = {
  /** Canonical label, e.g. "2026-27". */
  label: string;
  startYear: number;
  endYear: number;
  /** April of `startYear` through March of `endYear`, inclusive. */
  startDate: string;
  endDate: string;
  /** The twelve `YYYY-MM` payroll periods the year covers, in order. */
  periods: string[];
};

/**
 * Accepts `2026-27`, `2026-2027`, `FY 2026-27` and a bare `2026` (read as the
 * year the financial year starts in). Anything else is rejected rather than
 * guessed, because the period list drives which payroll lines are summed.
 */
export function parseFinancialYear(value: string): FinancialYear {
  const cleaned = String(value ?? "").trim().toUpperCase().replace(/^FY[\s-]*/, "").replace(/\s+/g, "");
  const match = /^(\d{4})(?:[-/](\d{2}|\d{4}))?$/.exec(cleaned);
  if (!match) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Enter the financial year as YYYY-YY, for example 2026-27.",
      details: [{ field: "financialYear", issue: "Expected YYYY-YY, YYYY-YYYY or YYYY." }],
    });
  }
  const startYear = Number(match[1]);
  const expected = startYear + 1;
  let endYear = expected;
  if (match[2]) {
    endYear = match[2].length === 2 ? Number(String(startYear).slice(0, 2) + match[2]) : Number(match[2]);
  }
  if (endYear !== expected) {
    throw new HttpError({
      status: 422,
      code: "INVALID_FINANCIAL_YEAR",
      message: `A financial year spans twelve months, so ${startYear} must pair with ${expected}.`,
      details: [{ field: "financialYear", issue: `Expected ${startYear}-${String(expected).slice(2)}.` }],
    });
  }
  const periods: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    const month = 4 + index;
    const year = month > 12 ? endYear : startYear;
    const monthInYear = month > 12 ? month - 12 : month;
    periods.push(`${year}-${String(monthInYear).padStart(2, "0")}`);
  }
  return {
    label: `${startYear}-${String(endYear).slice(2)}`,
    startYear,
    endYear,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    periods,
  };
}

/** Periods of the year that are still ahead of `asOfPeriod` (YYYY-MM). */
export function remainingPeriods(year: FinancialYear, asOfPeriod: string): string[] {
  return year.periods.filter((period) => period > asOfPeriod);
}

// ---------------------------------------------------------------------------
// Rule availability
// ---------------------------------------------------------------------------

export type RuleState =
  /** The pack declares the rule and supplies a value. */
  | "supplied"
  /** The pack declares the rule and leaves it null - awaiting policy approval. */
  | "not_supplied"
  /** The pack does not declare the rule at all. */
  | "not_declared";

export type RuleStatus = { rule: string; state: RuleState; valueMinor: number | null };

export function ruleStatus(path: string, pack: RulePack = rulePack()): RuleStatus {
  let cursor: unknown = pack;
  for (const key of path.split(".")) {
    if (typeof cursor !== "object" || cursor === null || !Object.hasOwn(cursor as object, key)) {
      return { rule: path, state: "not_declared", valueMinor: null };
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  if (cursor === null || cursor === undefined) return { rule: path, state: "not_supplied", valueMinor: null };
  return { rule: path, state: "supplied", valueMinor: typeof cursor === "number" ? cursor : null };
}

export function ruleUsable(status: RuleStatus): boolean {
  return status.state === "supplied" && status.valueMinor !== null;
}

/** Every `tds.*` rule the pack leaves unsupplied. Drives every blocked figure. */
export function tdsRuleGaps(packCode: string = DEFAULT_RULE_PACK_CODE): string[] {
  return ruleGaps(packCode).filter((gap) => gap.area === "tds").map((gap) => gap.rule);
}

export function hraRuleGaps(packCode: string = DEFAULT_RULE_PACK_CODE): string[] {
  return ruleGaps(packCode).filter((gap) => gap.area === "hraExemption").map((gap) => gap.rule);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// ---------------------------------------------------------------------------
// Declared deductions
// ---------------------------------------------------------------------------

export type HeadProjection = {
  code: string;
  label: string;
  declaredMinor: number;
  /** The ceiling that governs this head. */
  capRule: string;
  /** Never true while the ceiling is unavailable: an invented cap is worse than none. */
  capped: boolean;
  /** The rule that must be supplied before this head can be capped, if any. */
  missingRule: string | null;
};

export type SectionProjection = {
  code: string;
  label: string;
  heads: HeadProjection[];
  /** Exact sum of the declared heads. Always computable. */
  declaredMinor: number;
  capRule: string;
  cap: RuleStatus;
  capped: boolean;
  /** What may actually be deducted. `null` while the ceiling is unavailable. */
  allowableMinor: number | null;
  blockedBy: string[];
};

export function summariseSections(data: DeclarationData, pack: RulePack = rulePack()): SectionProjection[] {
  return DEDUCTION_SECTIONS.map((section) => {
    const cap = ruleStatus(section.capRule, pack);
    const usable = ruleUsable(cap);
    const heads = section.heads.map((head) => ({
      code: head.code,
      label: head.label,
      declaredMinor: declaredMinor(data, head.code),
      capRule: section.capRule,
      capped: usable,
      missingRule: usable ? null : section.capRule,
    }));
    const declared = heads.reduce((total, head) => total + head.declaredMinor, 0);
    return {
      code: section.code,
      label: section.label,
      heads,
      declaredMinor: declared,
      capRule: section.capRule,
      cap,
      capped: usable,
      // A declared total below an unknown ceiling is still not an allowable
      // amount: without the ceiling there is no way to know it clears it.
      allowableMinor: usable && cap.valueMinor !== null ? Math.min(declared, cap.valueMinor) : null,
      blockedBy: usable ? [] : [section.capRule],
    };
  });
}

export function totalDeclaredDeductions(sections: SectionProjection[]): number {
  return sections.reduce((total, section) => total + section.declaredMinor, 0);
}

/**
 * A head whose proof was rejected reverts to zero before the projection is
 * recomputed. Decisions are supplied explicitly; see `headDecisionsForStatus`
 * for what the record's workflow state can and cannot tell us.
 */
export type HeadDecision = "verified" | "rejected";

export function applyHeadDecisions(data: DeclarationData, decisions: Record<string, HeadDecision>): DeclarationData {
  const next: DeclarationData = { ...data };
  for (const [code, decision] of Object.entries(decisions)) {
    if (decision === "rejected" && DEDUCTION_HEAD_CODES.includes(code)) next[code] = 0;
  }
  return next;
}

export type HeadDecisionOutcome = {
  decisions: Record<string, HeadDecision>;
  /**
   * True when the state says some heads were rejected but the record carries no
   * per-head verification outcome to say which. The projection then keeps the
   * declared amounts and the screen says so, rather than zeroing at random.
   */
  rejectedHeadsUnidentified: boolean;
};

export function headDecisionsForStatus(status: string): HeadDecisionOutcome {
  if (status === "rejected" || status === "cancelled") {
    return {
      decisions: Object.fromEntries(DEDUCTION_HEAD_CODES.map((code) => [code, "rejected" as HeadDecision])),
      rejectedHeadsUnidentified: false,
    };
  }
  if (status === "verified") {
    return {
      decisions: Object.fromEntries(DEDUCTION_HEAD_CODES.map((code) => [code, "verified" as HeadDecision])),
      rejectedHeadsUnidentified: false,
    };
  }
  // `partially_verified` means some heads were rejected, but the operational
  // record has no field naming them. Reported, not guessed.
  return { decisions: {}, rejectedHeadsUnidentified: status === "partially_verified" };
}

// ---------------------------------------------------------------------------
// Gross
// ---------------------------------------------------------------------------

export type GrossProjection = {
  state: "computed" | "unavailable";
  /** Why gross could not be resolved, when it could not be. */
  reason: string | null;
  basicMinor: number | null;
  monthlyComponentsMinor: Record<string, number>;
  monthlyGrossMinor: number | null;
  annualSalaryGrossMinor: number | null;
  previousEmployerIncomeMinor: number;
  otherSourcesIncomeMinor: number;
  /** Annual salary + previous employer salary + other sources. */
  projectedAnnualGrossMinor: number | null;
};

export function projectGross(input: {
  basicMinor: number | null;
  structureLines: StructureLine[];
  data: DeclarationData;
}): GrossProjection {
  const previousEmployerIncomeMinor = declaredMinor(input.data, "previousEmployerIncomeMinor");
  const otherSourcesIncomeMinor = declaredMinor(input.data, "otherSourcesIncomeMinor");
  const empty: GrossProjection = {
    state: "unavailable",
    reason: null,
    basicMinor: input.basicMinor,
    monthlyComponentsMinor: {},
    monthlyGrossMinor: null,
    annualSalaryGrossMinor: null,
    previousEmployerIncomeMinor,
    otherSourcesIncomeMinor,
    projectedAnnualGrossMinor: null,
  };
  if (!input.basicMinor || input.basicMinor <= 0) {
    return { ...empty, reason: "The employee has no basic salary on their salary assignment or employee record." };
  }
  if (input.structureLines.length === 0) {
    return { ...empty, reason: "No salary structure is assigned, so the earning components cannot be resolved." };
  }
  const resolved = resolveStructure(input.structureLines, input.basicMinor);
  const monthlyGrossMinor = Object.values(resolved).reduce((total, amount) => total + amount, 0);
  const annualSalaryGrossMinor = monthlyGrossMinor * 12;
  return {
    state: "computed",
    reason: null,
    basicMinor: input.basicMinor,
    monthlyComponentsMinor: resolved,
    monthlyGrossMinor,
    annualSalaryGrossMinor,
    previousEmployerIncomeMinor,
    otherSourcesIncomeMinor,
    projectedAnnualGrossMinor: annualSalaryGrossMinor + previousEmployerIncomeMinor + otherSourcesIncomeMinor,
  };
}

// ---------------------------------------------------------------------------
// HRA
// ---------------------------------------------------------------------------

export type HraProjection = {
  inputs: {
    monthlyRentPaidMinor: number;
    annualRentPaidMinor: number;
    monthlyBasicDaMinor: number | null;
    annualBasicDaMinor: number | null;
    annualHraReceivedMinor: number | null;
    workLocation: string | null;
    /** `null`: metro status needs `hraExemption.metroCities`, which is unsupplied. */
    metro: boolean | null;
    landlordName: string | null;
    landlordPan: string | null;
    rentedAddress: string | null;
    rentPeriodFrom: string | null;
    rentPeriodTo: string | null;
    /** `null`: the PAN threshold rule is unsupplied, so this cannot be decided. */
    landlordPanRequired: boolean | null;
  };
  /** The least-of-three result. `null` while its constants are unsupplied. */
  exemptionMinor: number | null;
  blockedBy: string[];
};

export function projectHra(input: {
  data: DeclarationData;
  monthlyComponentsMinor: Record<string, number>;
  workLocation: string | null;
  pack?: RulePack;
}): HraProjection {
  const pack = input.pack ?? rulePack();
  const monthlyRentPaidMinor = declaredMinor(input.data, "rentPaidMonthlyMinor");
  const basic = input.monthlyComponentsMinor.basic;
  const da = input.monthlyComponentsMinor.da ?? 0;
  const hra = input.monthlyComponentsMinor.hra;
  const monthlyBasicDaMinor = basic === undefined ? null : basic + da;
  const metroCities = pack.hraExemption.metroCities;
  const workLocation = input.workLocation === null ? null : input.workLocation.trim().toLowerCase();
  const panThreshold = ruleStatus("hraExemption.landlordPanThresholdMinor", pack);
  const blockedBy = unique([
    ...hraRuleGaps(pack.code),
    ...(input.monthlyComponentsMinor.basic === undefined ? [SALARY_STRUCTURE_INPUT] : []),
  ]);
  return {
    inputs: {
      monthlyRentPaidMinor,
      annualRentPaidMinor: monthlyRentPaidMinor * 12,
      monthlyBasicDaMinor,
      annualBasicDaMinor: monthlyBasicDaMinor === null ? null : monthlyBasicDaMinor * 12,
      annualHraReceivedMinor: hra === undefined ? null : hra * 12,
      workLocation: input.workLocation,
      // Metro status decides which percentage leg applies. It can only be
      // derived once `hraExemption.metroCities` names the cities.
      metro:
        metroCities === null || workLocation === null
          ? null
          : metroCities.some((city) => city.toLowerCase() === workLocation),
      landlordName: declaredText(input.data, "landlordName"),
      landlordPan: declaredText(input.data, "landlordPan"),
      rentedAddress: declaredText(input.data, "rentedAddress"),
      rentPeriodFrom: declaredText(input.data, "rentPeriodFrom"),
      rentPeriodTo: declaredText(input.data, "rentPeriodTo"),
      landlordPanRequired:
        panThreshold.state === "supplied" && panThreshold.valueMinor !== null
          ? monthlyRentPaidMinor * 12 > panThreshold.valueMinor
          : null,
    },
    // The least-of-three test needs metroPercent / nonMetroPercent /
    // rentLessSalaryPercent. All three are unsupplied, so there is no exemption
    // to report - only the inputs that would feed it.
    exemptionMinor: null,
    blockedBy,
  };
}

// ---------------------------------------------------------------------------
// Declaration consistency (FRM-PAY-05 conditional requirements)
// ---------------------------------------------------------------------------

export type DeclarationIssue = { field: string; issue: string };

/**
 * FRM-PAY-05's conditional requirements, as one pure rule so they read the same on the screen,
 * in the API and in a test.
 *
 * The landlord PAN is the one requirement that cannot be decided here: the workbook makes it
 * mandatory "if annual rent exceeds the threshold", and `hraExemption.landlordPanThresholdMinor`
 * is unsupplied. While it is, a missing PAN is not refused - `projectHra` already reports
 * `landlordPanRequired: null` so the screen can say the test could not be applied. A PAN that IS
 * supplied is still format-checked, because that needs no threshold.
 */
export function declarationIssues(data: DeclarationData, pack: RulePack = rulePack()): DeclarationIssue[] {
  const issues: DeclarationIssue[] = [];
  const text = (code: string) => declaredText(data, code);
  const rent = declaredMinor(data, "rentPaidMonthlyMinor");

  if (rent > 0) {
    if (!text("landlordName")) issues.push({ field: "landlordName", issue: "Declared rent needs the landlord's name." });
    if (!text("rentedAddress")) issues.push({ field: "rentedAddress", issue: "Declared rent needs the rented property's address." });
    if (!text("rentPeriodFrom") || !text("rentPeriodTo")) {
      issues.push({ field: "rentPeriodFrom", issue: "Declared rent needs the period it was paid for." });
    }
    const threshold = ruleStatus("hraExemption.landlordPanThresholdMinor", pack);
    if (threshold.state === "supplied" && threshold.valueMinor !== null && rent * 12 > threshold.valueMinor && !text("landlordPan")) {
      issues.push({ field: "landlordPan", issue: "Annual rent is above the threshold, so the landlord's PAN is mandatory." });
    }
  }

  const from = text("rentPeriodFrom");
  const to = text("rentPeriodTo");
  if (from && to && to < from) {
    issues.push({ field: "rentPeriodTo", issue: "The rent period must end on or after it starts." });
  }
  const financialYear = text("financialYear");
  if (financialYear && (from || to)) {
    // A malformed financial year is its own problem; it must not mask the rent-period check.
    let year: FinancialYear | null = null;
    try {
      year = parseFinancialYear(financialYear);
    } catch {
      issues.push({ field: "financialYear", issue: "Enter the financial year as YYYY-YY, for example 2026-27." });
    }
    if (year) {
      for (const [field, value] of [["rentPeriodFrom", from], ["rentPeriodTo", to]] as const) {
        if (value && (value < year.startDate || value > year.endDate)) {
          issues.push({ field, issue: `The rent period must fall inside ${financialYear} (${year.startDate} to ${year.endDate}).` });
        }
      }
    }
  }

  // Interest declared against a house property needs the lender it was paid to.
  const interest = declaredMinor(data, "housingInterestSelfMinor") + declaredMinor(data, "housingInterestLetOutMinor");
  if (interest > 0) {
    if (!text("lenderName")) issues.push({ field: "lenderName", issue: "Declared housing loan interest needs the lender's name." });
    if (!text("lenderPan")) issues.push({ field: "lenderPan", issue: "Declared housing loan interest needs the lender's PAN." });
  }

  for (const field of ["landlordPan", "lenderPan"] as const) {
    const value = text(field);
    if (value && !PAN_PATTERN.test(value.trim().toUpperCase())) {
      issues.push({ field, issue: "A PAN is five letters, four digits and a letter, for example ABCDE1234F." });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Taxable income and tax
// ---------------------------------------------------------------------------

export type TaxableIncomeProjection = {
  state: "computed" | "indeterminate";
  amountMinor: number | null;
  grossMinor: number | null;
  /** Deductions that are genuinely allowable, i.e. their ceiling is supplied. */
  allowableDeductionsMinor: number;
  /** Everything declared, whether or not it can be allowed yet. */
  declaredDeductionsMinor: number;
  blockedBy: string[];
};

export function projectTaxableIncome(input: {
  gross: GrossProjection;
  sections: SectionProjection[];
  hra: HraProjection;
  pack?: RulePack;
}): TaxableIncomeProjection {
  const pack = input.pack ?? rulePack();
  const declaredDeductionsMinor = totalDeclaredDeductions(input.sections);
  const allowableDeductionsMinor = input.sections.reduce(
    (total, section) => total + (section.allowableMinor ?? 0),
    0,
  );
  const standardDeduction = ruleStatus("tds.standardDeductionMinor", pack);
  const blockedBy = unique([
    ...input.sections.flatMap((section) => section.blockedBy),
    ...(input.hra.exemptionMinor === null ? input.hra.blockedBy : []),
    ...(ruleUsable(standardDeduction) ? [] : ["tds.standardDeductionMinor"]),
    ...(input.gross.state === "computed" ? [] : [SALARY_STRUCTURE_INPUT]),
  ]);
  if (blockedBy.length > 0 || input.gross.projectedAnnualGrossMinor === null) {
    return {
      state: "indeterminate",
      amountMinor: null,
      grossMinor: input.gross.projectedAnnualGrossMinor,
      allowableDeductionsMinor,
      declaredDeductionsMinor,
      blockedBy,
    };
  }
  return {
    state: "computed",
    amountMinor: Math.max(
      0,
      input.gross.projectedAnnualGrossMinor -
        allowableDeductionsMinor -
        (input.hra.exemptionMinor ?? 0) -
        (standardDeduction.valueMinor ?? 0),
    ),
    grossMinor: input.gross.projectedAnnualGrossMinor,
    allowableDeductionsMinor,
    declaredDeductionsMinor,
    blockedBy: [],
  };
}

export type BlockedAmount = {
  state: "computed" | "blocked";
  amountMinor: number | null;
  blockedBy: string[];
};

/**
 * Annual tax needs slabs, the standard deduction, surcharge, cess and the 87A
 * rebate - the whole of `tds.*`, none of which the pack supplies. It is always
 * `null`; what varies is the list of reasons, which is real and actionable.
 */
export function projectAnnualTax(input: {
  taxableIncome: TaxableIncomeProjection;
  packCode?: string;
}): BlockedAmount {
  const gaps = tdsRuleGaps(input.packCode);
  return {
    state: "blocked",
    amountMinor: null,
    // Even a pack that supplied every rate would still need an approved slab
    // computation; `tds.slabs` names it so the list is never empty.
    blockedBy: unique([...(gaps.length > 0 ? gaps : ["tds.slabs"]), ...input.taxableIncome.blockedBy]),
  };
}

export type MonthlyTdsProjection = BlockedAmount & {
  asOfPeriod: string;
  remainingMonths: number;
  /** The computable half of the formula: what has already been deducted. */
  taxDeductedSoFarMinor: number;
};

/**
 * Monthly TDS going forward is `(annual tax - tax already deducted) / months
 * remaining`. Two of the three terms are computable; the annual tax is not, so
 * the result is not either.
 */
export function projectMonthlyTds(input: {
  annualTax: BlockedAmount;
  taxDeductedSoFarMinor: number;
  year: FinancialYear;
  asOfPeriod: string;
}): MonthlyTdsProjection {
  return {
    state: "blocked",
    amountMinor: null,
    blockedBy: input.annualTax.blockedBy,
    asOfPeriod: input.asOfPeriod,
    remainingMonths: remainingPeriods(input.year, input.asOfPeriod).length,
    taxDeductedSoFarMinor: input.taxDeductedSoFarMinor,
  };
}

// ---------------------------------------------------------------------------
// Tax already deducted
// ---------------------------------------------------------------------------

export type TdsLineRow = { period: string; runStatus: string; amountMinor: number };

export type TaxDeductedSoFar = {
  state: "computed";
  /** Deducted on finalised, paid or closed runs. */
  postedMinor: number;
  /** Calculated or approved but not yet finalised - shown apart, never merged. */
  provisionalMinor: number;
  /** Carried from the declaration; it is the employee's statement, not ours. */
  previousEmployerTdsMinor: number;
  periods: TdsLineRow[];
};

/** Pure aggregation over the TDS payroll lines of one financial year. */
export function sumTaxDeducted(rows: TdsLineRow[], data: DeclarationData = {}): TaxDeductedSoFar {
  const posted = new Set<string>(POSTED_RUN_STATUSES);
  const provisional = new Set<string>(PROVISIONAL_RUN_STATUSES);
  let postedMinor = 0;
  let provisionalMinor = 0;
  for (const row of rows) {
    if (posted.has(row.runStatus)) postedMinor += row.amountMinor;
    else if (provisional.has(row.runStatus)) provisionalMinor += row.amountMinor;
  }
  return {
    state: "computed",
    postedMinor,
    provisionalMinor,
    previousEmployerTdsMinor: declaredMinor(data, "previousEmployerTdsMinor"),
    periods: [...rows].sort((left, right) => left.period.localeCompare(right.period)),
  };
}

// ---------------------------------------------------------------------------
// Regime comparison
// ---------------------------------------------------------------------------

export type RegimeProjection = {
  regime: TaxRegime;
  label: string;
  selected: boolean;
  grossMinor: number | null;
  declaredDeductionsMinor: number;
  /** Which heads this regime admits is itself an unsupplied rule. */
  admissibility: RuleStatus;
  taxableIncome: TaxableIncomeProjection;
  annualTax: BlockedAmount;
  blockedBy: string[];
};

export function compareRegimes(input: {
  selected: TaxRegime | null;
  gross: GrossProjection;
  sections: SectionProjection[];
  hra: HraProjection;
  pack?: RulePack;
}): RegimeProjection[] {
  const pack = input.pack ?? rulePack();
  const admissibility = ruleStatus(REGIME_ADMISSIBILITY_RULE, pack);
  return TAX_REGIMES.map((regime) => {
    const taxableIncome = projectTaxableIncome({ gross: input.gross, sections: input.sections, hra: input.hra, pack });
    const annualTax = projectAnnualTax({ taxableIncome, packCode: pack.code });
    return {
      regime,
      label: TAX_REGIME_LABELS[regime],
      selected: input.selected === regime,
      grossMinor: input.gross.projectedAnnualGrossMinor,
      declaredDeductionsMinor: totalDeclaredDeductions(input.sections),
      admissibility,
      taxableIncome,
      annualTax,
      blockedBy: unique([...annualTax.blockedBy, ...(ruleUsable(admissibility) ? [] : [REGIME_ADMISSIBILITY_RULE])]),
    };
  });
}

// ---------------------------------------------------------------------------
// Business rules that are enforceable here
// ---------------------------------------------------------------------------

export type RegimeSwitchDecision = {
  /** `null` when the freeze date is unconfigured: neither allowed nor refused. */
  allowed: boolean | null;
  reason: string;
  blockedBy: string[];
};

/**
 * A regime may be switched once per financial year, up to a freeze date. The
 * once-per-year half is enforceable from the record's own history; the freeze
 * date is configuration this codebase does not carry, so the window's end is
 * reported as unconfigured rather than assumed to be open.
 */
export function evaluateRegimeSwitch(input: {
  currentRegime: TaxRegime | null;
  requestedRegime: TaxRegime;
  priorSwitchCount: number;
  freezeDate: string | null;
  today: string;
}): RegimeSwitchDecision {
  if (input.currentRegime === input.requestedRegime) {
    return { allowed: true, reason: "The declaration already elects this regime; nothing is switched.", blockedBy: [] };
  }
  if (input.priorSwitchCount >= 1) {
    return {
      allowed: false,
      reason: "The regime has already been switched once for this financial year.",
      blockedBy: [],
    };
  }
  if (input.freezeDate === null) {
    return {
      allowed: null,
      reason: "The regime freeze date for this financial year is not configured, so the switching window cannot be evaluated.",
      blockedBy: [REGIME_FREEZE_DATE_SETTING],
    };
  }
  if (input.today > input.freezeDate) {
    return { allowed: false, reason: `The regime was frozen for this financial year on ${input.freezeDate}.`, blockedBy: [] };
  }
  return { allowed: true, reason: `The regime may be switched once, until ${input.freezeDate}.`, blockedBy: [] };
}

/** Actions that cannot be recorded without the verifier saying why. */
export const REMARKS_REQUIRED_ACTIONS = ["reject", "partiallyVerify", "return"] as const;
export const VERIFIER_REMARKS_MIN_LENGTH = 10;

/**
 * The generic transition input (`operational-validation.transitionInput`) already
 * demands a `reason` of at least 3 characters for every action. A rejection or a
 * partial verification carries a consequence for the employee's take-home pay,
 * so this path demands a substantive one. Returns the problem, or `null`.
 */
export function verifierRemarksIssue(action: string, remarks: string): string | null {
  const trimmed = String(remarks ?? "").trim();
  if (!(REMARKS_REQUIRED_ACTIONS as readonly string[]).includes(action)) {
    return trimmed.length >= 3 ? null : "Enter a reason; every declaration action is audited with it.";
  }
  if (trimmed.length < VERIFIER_REMARKS_MIN_LENGTH) {
    return `Verifier remarks are mandatory on ${action === "reject" ? "rejection" : action === "return" ? "return" : "partial verification"} and must be at least ${VERIFIER_REMARKS_MIN_LENGTH} characters.`;
  }
  return null;
}

/** Which transitions the catalog permits from a given state. */
export const DECLARATION_TRANSITIONS: Record<string, { label: string; from: string[]; approval: boolean }> = {
  submit: { label: "Submit", from: ["draft", "returned"], approval: false },
  requestProof: { label: "Request proof", from: ["submitted"], approval: true },
  verify: { label: "Verify", from: ["submitted", "proof_pending"], approval: true },
  partiallyVerify: { label: "Partially verify", from: ["submitted", "proof_pending"], approval: true },
  return: { label: "Return", from: ["submitted", "proof_pending"], approval: true },
  reject: { label: "Reject", from: ["submitted", "proof_pending"], approval: true },
  cancel: { label: "Cancel", from: ["draft", "returned", "submitted"], approval: true },
};

export function transitionAllowed(action: string, status: string): boolean {
  const transition = DECLARATION_TRANSITIONS[action];
  return Boolean(transition && transition.from.includes(status));
}

// ---------------------------------------------------------------------------
// The assembled projection
// ---------------------------------------------------------------------------

export type TaxProjection = {
  declarationId: string | null;
  status: string;
  version: number | null;
  employee: { id: string; code: string | null; name: string | null; department: string | null; location: string | null };
  financialYear: FinancialYear;
  rulePackCode: string;
  regime: TaxRegime | null;
  gross: GrossProjection;
  sections: SectionProjection[];
  declaredDeductionsMinor: number;
  hra: HraProjection;
  taxableIncome: TaxableIncomeProjection;
  annualTax: BlockedAmount;
  taxDeductedSoFar: TaxDeductedSoFar;
  monthlyTds: MonthlyTdsProjection;
  regimes: RegimeProjection[];
  headDecisions: HeadDecisionOutcome;
  regimeSwitch: RegimeSwitchDecision;
  /** Every rule and input that stands between this record and a tax figure. */
  blockedBy: string[];
};

export type ProjectionInputs = {
  declarationId: string | null;
  status: string;
  version: number | null;
  employee: TaxProjection["employee"];
  year: FinancialYear;
  data: DeclarationData;
  basicMinor: number | null;
  structureLines: StructureLine[];
  tdsRows: TdsLineRow[];
  priorRegimeSwitchCount: number;
  asOfPeriod: string;
  today: string;
  pack?: RulePack;
};

/** Pure assembly: every DB read has already happened by the time this runs. */
export function buildProjection(input: ProjectionInputs): TaxProjection {
  const pack = input.pack ?? rulePack();
  const headDecisions = headDecisionsForStatus(input.status);
  const effective = applyHeadDecisions(input.data, headDecisions.decisions);
  const gross = projectGross({ basicMinor: input.basicMinor, structureLines: input.structureLines, data: effective });
  const sections = summariseSections(effective, pack);
  const hra = projectHra({
    data: effective,
    monthlyComponentsMinor: gross.monthlyComponentsMinor,
    workLocation: input.employee.location,
    pack,
  });
  const taxableIncome = projectTaxableIncome({ gross, sections, hra, pack });
  const annualTax = projectAnnualTax({ taxableIncome, packCode: pack.code });
  const taxDeductedSoFar = sumTaxDeducted(input.tdsRows, effective);
  const regime = declaredRegime(effective);
  return {
    declarationId: input.declarationId,
    status: input.status,
    version: input.version,
    employee: input.employee,
    financialYear: input.year,
    rulePackCode: pack.code,
    regime,
    gross,
    sections,
    declaredDeductionsMinor: totalDeclaredDeductions(sections),
    hra,
    taxableIncome,
    annualTax,
    taxDeductedSoFar,
    monthlyTds: projectMonthlyTds({
      annualTax,
      taxDeductedSoFarMinor: taxDeductedSoFar.postedMinor,
      year: input.year,
      asOfPeriod: input.asOfPeriod,
    }),
    regimes: compareRegimes({ selected: regime, gross, sections, hra, pack }),
    headDecisions,
    regimeSwitch: evaluateRegimeSwitch({
      currentRegime: regime,
      // Evaluated against the other regime: the question the screen asks is
      // "may this declaration still move?", not "may it stay where it is?".
      requestedRegime: regime === "old_regime" ? "new_regime" : "old_regime",
      priorSwitchCount: input.priorRegimeSwitchCount,
      freezeDate: null,
      today: input.today,
    }),
    blockedBy: unique([...annualTax.blockedBy, ...hra.blockedBy]),
  };
}

export function currentPeriod(today: Date = new Date()): string {
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * `payroll.read` sees every declaration; otherwise the caller falls back to the
 * operational resource's own scope, which is what gives an employee self-service
 * access to their own declaration ("Self only" in the process guide) and a
 * manager their team's.
 */
function projectionScope(access: Access): "all" | "team" | "self" {
  if (access.context.permissions.includes("payroll.read")) return "all";
  return operationalScope(access, TAX_DECLARATION_PERMISSION, "read");
}

export type DeclarationRow = {
  id: string;
  version: number;
  status: string;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  department: string | null;
  financialYear: string | null;
  taxRegime: TaxRegime | null;
  regimeLabel: string;
  declaredDeductionsMinor: number;
  proofDocumentId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Never a number while the slabs are unsupplied - the screen says why. */
  projectedTds: BlockedAmount;
};

export async function listDeclarations(
  access: Access,
  filters: { employeeId?: string | null; financialYear?: string | null; status?: string | null; search?: string | null; page?: number; pageSize?: number },
): Promise<{ items: DeclarationRow[]; nextCursor: string | null }> {
  const scope = projectionScope(access);
  const { page, pageSize } = parsePagination(
    new URLSearchParams({ page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 100) }),
  );
  const employeeId = filters.employeeId ?? null;
  if (employeeId && !/^[a-f\d-]{36}$/i.test(employeeId)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid employee reference." });
  }
  const self = access.context.employeeId ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.version, r.status, r.employee_id, r.data, r.created_at, r.updated_at,
             e.employee_code, e.first_name, e.last_name, e.department
      from hrms_operation_records r
      left join employees e on e.tenant_id = r.tenant_id and e.id = r.employee_id
      where r.tenant_id = ${access.tenantId} and r.resource = ${TAX_DECLARATION_RESOURCE}
        and (${scope} = 'all' or r.employee_id = ${self}::uuid
             or (${scope} = 'team' and r.employee_id in (select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${self}::uuid)))
        and (${employeeId}::uuid is null or r.employee_id = ${employeeId}::uuid)
        and (${filters.financialYear ?? null}::text is null or r.data->>'financialYear' = ${filters.financialYear ?? null})
        and (${filters.status ?? null}::text is null or r.status = ${filters.status ?? null})
        and (r.data::text || ' ' || coalesce(e.employee_code, '') || ' ' || coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, ''))
            ilike ${"%" + (filters.search ?? "").slice(0, 100) + "%"}
      order by r.created_at desc, r.id desc
      limit ${pageSize + 1} offset ${(page - 1) * pageSize}
    `,
  ]);
  const blockedBy = unique([...tdsRuleGaps(), ...DEDUCTION_SECTIONS.map((section) => section.capRule)]);
  const items = (rows as Array<{
    id: string; version: number; status: string; employee_id: string | null; data: DeclarationData | null;
    created_at: string | null; updated_at: string | null; employee_code: string | null; first_name: string | null;
    last_name: string | null; department: string | null;
  }>).map((row) => {
    const data = row.data ?? {};
    const regime = declaredRegime(data);
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    return {
      id: row.id,
      version: Number(row.version),
      status: row.status,
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      employeeName: name === "" ? null : name,
      department: row.department,
      financialYear: typeof data.financialYear === "string" ? data.financialYear : null,
      taxRegime: regime,
      regimeLabel: regime ? TAX_REGIME_LABELS[regime] : "Not elected",
      declaredDeductionsMinor: totalDeclaredDeductions(summariseSections(data)),
      proofDocumentId: declaredText(data, "proofDocumentId"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectedTds: { state: "blocked" as const, amountMinor: null, blockedBy },
    };
  });
  return {
    items: items.slice(0, pageSize),
    nextCursor: items.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null,
  };
}

export type ProjectionSelector = { declarationId: string } | { employeeId: string; financialYear: string };

async function loadDeclaration(
  access: Access,
  scope: "all" | "team" | "self",
  selector: ProjectionSelector,
): Promise<{ id: string; version: number; status: string; employeeId: string | null; data: DeclarationData } | null> {
  const self = access.context.employeeId ?? null;
  const declarationId = "declarationId" in selector ? selector.declarationId : null;
  const employeeId = "employeeId" in selector ? selector.employeeId : null;
  const financialYear = "financialYear" in selector ? selector.financialYear : null;
  for (const candidate of [declarationId, employeeId]) {
    if (candidate !== null && !/^[a-f\d-]{36}$/i.test(candidate)) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
  }
  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.version, r.status, r.employee_id, r.data
      from hrms_operation_records r
      where r.tenant_id = ${access.tenantId} and r.resource = ${TAX_DECLARATION_RESOURCE}
        and (${scope} = 'all' or r.employee_id = ${self}::uuid
             or (${scope} = 'team' and r.employee_id in (select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${self}::uuid)))
        and (${declarationId}::uuid is null or r.id = ${declarationId}::uuid)
        and (${employeeId}::uuid is null or r.employee_id = ${employeeId}::uuid)
        and (${financialYear}::text is null or r.data->>'financialYear' = ${financialYear})
      order by r.created_at desc, r.id desc
      limit 1
    `,
  ]);
  const row = (rows as Array<{ id: string; version: number; status: string; employee_id: string | null; data: DeclarationData | null }>)[0];
  if (!row) return null;
  return { id: row.id, version: Number(row.version), status: row.status, employeeId: row.employee_id, data: row.data ?? {} };
}

/**
 * The projection for one declaration, or for one employee's financial year when
 * no declaration exists yet (the salary side is still computable without one).
 */
export async function projectTax(access: Access, selector: ProjectionSelector | string): Promise<TaxProjection> {
  const normalised: ProjectionSelector = typeof selector === "string" ? { declarationId: selector } : selector;
  const scope = projectionScope(access);
  const declaration = await loadDeclaration(access, scope, normalised);
  if (!declaration && "declarationId" in normalised) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const employeeId = declaration?.employeeId ?? ("employeeId" in normalised ? normalised.employeeId : null);
  if (!employeeId) {
    throw new HttpError({ status: 422, code: "EMPLOYEE_REQUIRED", message: "The declaration is not linked to an employee, so no projection can be produced." });
  }
  if (scope === "self" && employeeId !== access.context.employeeId) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const declaredYear = typeof declaration?.data.financialYear === "string" ? declaration.data.financialYear : null;
  const requestedYear = "financialYear" in normalised ? normalised.financialYear : null;
  const year = parseFinancialYear(declaredYear ?? requestedYear ?? "");

  const [employeeRows, assignmentRows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code, first_name, last_name, department, location, basic_salary_minor
      from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1
    `,
    sqlClient`
      select salary_structure_id, (attributes->>'basic_minor')::bigint as basic_minor
      from employee_salary_assignments
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
      order by created_at desc limit 1
    `,
  ]);
  const employeeRow = (employeeRows as Array<{
    id: string; employee_code: string | null; first_name: string | null; last_name: string | null;
    department: string | null; location: string | null; basic_salary_minor: number | string | null;
  }>)[0];
  if (!employeeRow) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const assignment = (assignmentRows as Array<{ salary_structure_id: string | null; basic_minor: number | string | null }>)[0];
  const basicMinor = assignment?.basic_minor !== null && assignment?.basic_minor !== undefined
    ? Number(assignment.basic_minor)
    : employeeRow.basic_salary_minor === null || employeeRow.basic_salary_minor === undefined
      ? null
      : Number(employeeRow.basic_salary_minor);
  const structureLines = assignment?.salary_structure_id
    ? await listStructureComponents(access, assignment.salary_structure_id)
    : [];

  const [tdsRows, switchRows] = await tenantTx(access, [
    sqlClient`
      select r.period, r.status as run_status, sum((l.attributes->>'amount_minor')::bigint)::bigint as amount_minor
      from payroll_lines l
      join payroll_run_employees e on e.tenant_id = l.tenant_id and e.id = l.payroll_run_employee_id
      join payroll_runs r on r.tenant_id = e.tenant_id and r.id = e.payroll_run_id
      where l.tenant_id = ${access.tenantId} and e.employee_id = ${employeeId}
        and l.attributes->>'code' = 'tds' and r.period = any(${year.periods})
      group by r.period, r.status
      order by r.period
    `,
    declaration
      ? sqlClient`
          select count(*)::int as switches
          from hrms_operation_events
          where tenant_id = ${access.tenantId} and record_id = ${declaration.id} and action = 'edit'
        `
      : sqlClient`select 0::int as switches`,
  ]);

  const name = [employeeRow.first_name, employeeRow.last_name].filter(Boolean).join(" ").trim();
  return buildProjection({
    declarationId: declaration?.id ?? null,
    status: declaration?.status ?? "draft",
    version: declaration?.version ?? null,
    employee: {
      id: employeeRow.id,
      code: employeeRow.employee_code,
      name: name === "" ? null : name,
      department: employeeRow.department,
      location: employeeRow.location,
    },
    year,
    data: declaration?.data ?? {},
    basicMinor,
    structureLines,
    tdsRows: (tdsRows as Array<{ period: string; run_status: string; amount_minor: number | string | null }>).map((row) => ({
      period: row.period,
      runStatus: row.run_status,
      amountMinor: Number(row.amount_minor ?? 0),
    })),
    // Every edit is a candidate regime switch; the record keeps no history of the
    // field itself, so this is an upper bound and is reported as such.
    priorRegimeSwitchCount: Number((switchRows as Array<{ switches: number }>)[0]?.switches ?? 0),
    asOfPeriod: currentPeriod(),
    today: new Date().toISOString().slice(0, 10),
  });
}
