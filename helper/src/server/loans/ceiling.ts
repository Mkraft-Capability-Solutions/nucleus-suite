import "server-only";

import { DEFAULT_RULE_PACK_CODE, requireRule, rulePack } from "@/server/payroll/rule-pack";

/**
 * RL-22 — the loan ceiling.
 *
 * "The maximum loan is four times basic salary, rising to six times where
 * continuous service is five years or more."
 *
 * The multiples used to be inlined in `loanEligibility` (src/lib/hr-rules.ts),
 * where the tenure band was written `serviceYears > 5` — so an employee at
 * exactly five years received the lower ceiling, which RL-22's "or more" does
 * not say. The band and both multiples now come from the rule pack, so a tenant
 * that sanctions different multiples changes a rule-pack entry rather than the
 * engine, and a pack that leaves them unsupplied raises `RULE_PACK_INCOMPLETE`
 * instead of quietly falling back to 4x.
 *
 * `loanEligibility` decides only *whether* an employee may borrow (open loan,
 * open advance, standing guarantee) and no longer returns a ceiling of its own,
 * so there is exactly one answer to "how much".
 */

const MILLISECONDS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export type LoanCeiling = {
  /** The ceiling in minor units, which is how every amount on a loan is carried. */
  maximumMinor: number;
  /** The multiple applied, so the sanction letter can say which band was used. */
  multiple: number;
  standardMultiple: number;
  higherMultiple: number;
  /** Completed service used for the band decision, in years. */
  serviceYears: number;
  /** Service at or above which the higher multiple applies. */
  higherFromServiceYears: number;
  higherApplied: boolean;
};

/**
 * Completed service in years, measured as elapsed time from the joining date.
 *
 * Q-09 asks whether "more than 5 years" means continuous service and whether a
 * break in service, a transfer between entities or a change of employment
 * category resets the clock. Until that is answered this measures the only thing
 * the employee record actually states — time since `joining_date` — and does not
 * model breaks. `ceilingServiceBasisNote` is the sentence the screen shows so the
 * assumption is visible rather than implied.
 */
export function completedServiceYears(joiningDate: string, now: Date = new Date()): number {
  const joined = Date.parse(`${joiningDate}T00:00:00Z`);
  if (!Number.isFinite(joined)) return 0;
  return Math.max(0, (now.getTime() - joined) / MILLISECONDS_PER_YEAR);
}

export const CEILING_SERVICE_BASIS_NOTE =
  "Service is measured as elapsed time from the joining date on the employee record. Whether a break in service, a transfer between entities or a change of employment category restarts that clock (Q-09) has not been answered, so no such adjustment is applied.";

/**
 * The ceiling for one applicant. Throws `RULE_PACK_INCOMPLETE` when the pack in
 * force does not supply the multiples or the service band.
 */
export function resolveLoanCeiling(
  input: { basicSalaryMinor: number; serviceYears: number },
  packCode: string = DEFAULT_RULE_PACK_CODE,
): LoanCeiling {
  const loans = rulePack(packCode).loans;
  const multiples = requireRule(loans.ceilingMultipleOfBasic, "loans.ceilingMultipleOfBasic", packCode);
  const higherFromServiceYears = requireRule(loans.higherCeilingServiceYears, "loans.higherCeilingServiceYears", packCode);
  // RL-22 reads "five years or more", so the band is inclusive at its boundary.
  const higherApplied = input.serviceYears >= higherFromServiceYears;
  const multiple = higherApplied ? multiples.higher : multiples.standard;
  return {
    maximumMinor: Math.round(Math.max(0, input.basicSalaryMinor) * multiple),
    multiple,
    standardMultiple: multiples.standard,
    higherMultiple: multiples.higher,
    serviceYears: input.serviceYears,
    higherFromServiceYears,
    higherApplied,
  };
}
