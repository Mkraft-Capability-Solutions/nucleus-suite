import { HttpError } from "@/server/platform/http";
import { INTEREST_METHODS, MORATORIUM_INTEREST_TREATMENTS, type InterestMethod, type MoratoriumInterest } from "@/lib/loan-constants";

/**
 * SCR-080 — loan amortisation.
 *
 * Pure, database-free schedule arithmetic. Everything here is integer minor
 * units; a fractional paisa never leaves this module.
 *
 * Two values this module needs are NOT statutory and are NOT inferable from the
 * source workbook, so neither one has a default (see the rule-pack precedent in
 * `src/server/payroll/rule-pack.ts`):
 *
 *  - `method` — reducing balance vs flat is a commercial term of the loan
 *    product / sanction letter, not a regulated rate. Guessing it would change
 *    every instalment on a real employee's payslip, so a loan with no recorded
 *    method fails with LOAN_CONFIGURATION_INCOMPLETE instead of amortising on an
 *    assumption.
 *  - `moratoriumInterest` — whether interest accrues or is waived during a
 *    moratorium is a policy choice the workbook never states. It is an explicit
 *    required argument for the same reason.
 *
 * Month conventions: `startMonth` is the first month of the loan's repayment
 * clock (normally the disbursement month's next due month). `moratoriumMonths`
 * defers instalments, so instalment 1 falls at `startMonth + moratoriumMonths`.
 * `tenureMonths` counts INSTALMENTS, never moratorium months.
 */

// Defined in src/lib/loan-constants.ts so client pages and this module share one
// list; re-exported here for callers that already import them from the schedule.
export { INTEREST_METHODS, MORATORIUM_INTEREST_TREATMENTS };
export type { InterestMethod, MoratoriumInterest };



export type ScheduleInput = {
  principalMinor: number;
  annualRatePercent: number;
  tenureMonths: number;
  /** First month of the repayment clock, "YYYY-MM". */
  startMonth: string;
  /** Required. No default — see the module note. */
  method: InterestMethod;
  moratoriumMonths: number;
  /** Required. No default — see the module note. */
  moratoriumInterest: MoratoriumInterest;
};

export type Instalment = {
  seq: number;
  /** "YYYY-MM". */
  dueMonth: string;
  openingMinor: number;
  principalMinor: number;
  interestMinor: number;
  instalmentMinor: number;
  closingMinor: number;
};

export type Schedule = {
  method: InterestMethod;
  annualRatePercent: number;
  tenureMonths: number;
  moratoriumMonths: number;
  moratoriumInterest: MoratoriumInterest;
  /** Principal actually amortised: the sanctioned principal plus any capitalised moratorium interest. */
  amortisedPrincipalMinor: number;
  principalMinor: number;
  totalInterestMinor: number;
  totalPayableMinor: number;
  /** The level instalment. The final row may differ because it absorbs the residual. */
  instalmentMinor: number;
  instalments: Instalment[];
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function invalid(message: string, field: string): HttpError {
  return new HttpError({
    status: 422,
    code: "LOAN_SCHEDULE_INVALID",
    message,
    details: [{ field, issue: message }],
  });
}

function missingConfiguration(message: string, field: string): HttpError {
  return new HttpError({
    status: 422,
    code: "LOAN_CONFIGURATION_INCOMPLETE",
    message,
    details: [{ field, issue: message }],
  });
}

/**
 * Validates a recorded interest method. A loan with nothing recorded fails by
 * name rather than silently amortising on reducing balance.
 */
export function requireInterestMethod(value: unknown, loanReference: string): InterestMethod {
  if (typeof value === "string" && (INTEREST_METHODS as readonly string[]).includes(value)) {
    return value as InterestMethod;
  }
  throw missingConfiguration(
    `Loan ${loanReference} has no interest method recorded. The interest method (${INTEREST_METHODS.join(" or ")}) is a term of the loan product and must be recorded on the application before a repayment schedule can be generated.`,
    "interestMethod",
  );
}

/** Validates a recorded moratorium-interest treatment. Never defaulted. */
export function requireMoratoriumInterest(value: unknown, loanReference: string): MoratoriumInterest {
  if (typeof value === "string" && (MORATORIUM_INTEREST_TREATMENTS as readonly string[]).includes(value)) {
    return value as MoratoriumInterest;
  }
  throw missingConfiguration(
    `Loan ${loanReference} has no moratorium interest treatment recorded. Whether interest accrues or is waived during a moratorium (${MORATORIUM_INTEREST_TREATMENTS.join(" or ")}) must be recorded on the application before a repayment schedule can be generated.`,
    "moratoriumInterest",
  );
}

/** Adds whole months to a "YYYY-MM" month key. */
export function addMonths(month: string, count: number): string {
  if (!MONTH_PATTERN.test(month)) throw invalid(`"${month}" is not a valid month (YYYY-MM).`, "startMonth");
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1 + count;
  const shiftedYear = year + Math.floor(monthIndex / 12);
  const shiftedMonth = ((monthIndex % 12) + 12) % 12;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth + 1).padStart(2, "0")}`;
}

function assertInputs(input: ScheduleInput): void {
  if (!Number.isInteger(input.principalMinor) || input.principalMinor <= 0) {
    throw invalid("Principal must be a positive integer number of minor units.", "principalMinor");
  }
  if (!Number.isInteger(input.tenureMonths) || input.tenureMonths <= 0) {
    throw invalid("Tenure must be a positive whole number of months.", "tenureMonths");
  }
  if (!Number.isFinite(input.annualRatePercent) || input.annualRatePercent < 0) {
    throw invalid("The annual interest rate must be zero or a positive percentage.", "annualRatePercent");
  }
  if (!MONTH_PATTERN.test(input.startMonth)) {
    throw invalid(`"${input.startMonth}" is not a valid repayment start month (YYYY-MM).`, "startMonth");
  }
  if (!Number.isInteger(input.moratoriumMonths) || input.moratoriumMonths < 0) {
    throw invalid("Moratorium months must be zero or a positive whole number.", "moratoriumMonths");
  }
  requireInterestMethod(input.method, "application");
  requireMoratoriumInterest(input.moratoriumInterest, "application");
}

/** Level instalment for a reducing-balance loan. Zero rate falls back to P/n. */
function reducingBalanceInstalment(principalMinor: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return Math.round(principalMinor / months);
  const growth = Math.pow(1 + monthlyRate, months);
  return Math.round((principalMinor * monthlyRate * growth) / (growth - 1));
}

/**
 * Builds the instalment table. The final instalment absorbs every rounding
 * residual, so the last closing balance is exactly zero by construction.
 */
export function buildSchedule(input: ScheduleInput): Schedule {
  assertInputs(input);
  const monthlyRate = input.annualRatePercent / 100 / 12;
  const annualRate = input.annualRatePercent / 100;
  const accrues = input.moratoriumInterest === "accrue" && input.moratoriumMonths > 0;

  // Moratorium interest, when it accrues, is capitalised into the balance that
  // is amortised; when waived, the borrower simply starts later on the same
  // principal.
  const amortisedPrincipalMinor =
    input.method === "reducing_balance" && accrues
      ? Math.round(input.principalMinor * Math.pow(1 + monthlyRate, input.moratoriumMonths))
      : input.principalMinor;

  const instalments: Instalment[] = [];
  let opening = amortisedPrincipalMinor;
  let levelInstalment: number;

  if (input.method === "reducing_balance") {
    levelInstalment = reducingBalanceInstalment(amortisedPrincipalMinor, monthlyRate, input.tenureMonths);
    for (let seq = 1; seq <= input.tenureMonths; seq += 1) {
      const last = seq === input.tenureMonths;
      const interestMinor = Math.round(opening * monthlyRate);
      const principalMinor = last
        ? opening
        : Math.min(Math.max(levelInstalment - interestMinor, 0), opening);
      const closingMinor = opening - principalMinor;
      instalments.push({
        seq,
        dueMonth: addMonths(input.startMonth, input.moratoriumMonths + seq - 1),
        openingMinor: opening,
        principalMinor,
        interestMinor,
        instalmentMinor: principalMinor + interestMinor,
        closingMinor,
      });
      opening = closingMinor;
    }
  } else {
    // Flat: interest is charged on the sanctioned principal for the whole
    // financed period and spread evenly across the instalments.
    const financedMonths = input.tenureMonths + (accrues ? input.moratoriumMonths : 0);
    const totalInterest = Math.round((input.principalMinor * annualRate * financedMonths) / 12);
    const perInstalmentInterest = Math.round(totalInterest / input.tenureMonths);
    const perInstalmentPrincipal = Math.round(input.principalMinor / input.tenureMonths);
    levelInstalment = perInstalmentPrincipal + perInstalmentInterest;
    let interestCharged = 0;
    for (let seq = 1; seq <= input.tenureMonths; seq += 1) {
      const last = seq === input.tenureMonths;
      const interestMinor = last ? totalInterest - interestCharged : perInstalmentInterest;
      const principalMinor = last ? opening : Math.min(perInstalmentPrincipal, opening);
      const closingMinor = opening - principalMinor;
      interestCharged += interestMinor;
      instalments.push({
        seq,
        dueMonth: addMonths(input.startMonth, input.moratoriumMonths + seq - 1),
        openingMinor: opening,
        principalMinor,
        interestMinor,
        instalmentMinor: principalMinor + interestMinor,
        closingMinor,
      });
      opening = closingMinor;
    }
  }

  const totalInterestMinor = instalments.reduce((sum, row) => sum + row.interestMinor, 0);
  const totalPrincipalMinor = instalments.reduce((sum, row) => sum + row.principalMinor, 0);
  return {
    method: input.method,
    annualRatePercent: input.annualRatePercent,
    tenureMonths: input.tenureMonths,
    moratoriumMonths: input.moratoriumMonths,
    moratoriumInterest: input.moratoriumInterest,
    amortisedPrincipalMinor,
    principalMinor: input.principalMinor,
    totalInterestMinor,
    totalPayableMinor: totalPrincipalMinor + totalInterestMinor,
    instalmentMinor: levelInstalment,
    instalments,
  };
}

export type ScheduleSummary = {
  instalmentCount: number;
  paidToDateMinor: number;
  outstandingMinor: number;
  instalmentsRemaining: number;
  nextDue: Instalment | null;
};

/**
 * Derives progress by applying the amount already recovered against the
 * instalment table in sequence. An instalment counts as settled only when the
 * recovered total covers it in full.
 */
export function summariseSchedule(instalments: Instalment[], paidToDateMinor: number): ScheduleSummary {
  const paid = Math.max(0, Math.trunc(paidToDateMinor));
  const totalPayable = instalments.reduce((sum, row) => sum + row.instalmentMinor, 0);
  let covered = 0;
  let settled = 0;
  for (const row of instalments) {
    if (covered + row.instalmentMinor > paid) break;
    covered += row.instalmentMinor;
    settled += 1;
  }
  return {
    instalmentCount: instalments.length,
    paidToDateMinor: Math.min(paid, totalPayable),
    outstandingMinor: Math.max(totalPayable - paid, 0),
    instalmentsRemaining: instalments.length - settled,
    nextDue: instalments[settled] ?? null,
  };
}
