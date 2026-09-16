/**
 * SCR-080 / FRM-CMB-01 vocabularies shared by the server service and the client
 * pages. It lives in `src/lib` rather than `src/server/loans` because the loan
 * service is `server-only`: a client component cannot import from it, and a
 * second copy of the list would drift from the one the API validates against.
 */

import { picklists, picklistValues } from "@/lib/picklists";

/**
 * FRM-CMB-01 "Purpose" is PL_LOAN_PURPOSE, so the registry owns the vocabulary rather than a
 * second copy of it here. A closed list: the form presents a select, not free text.
 */
export const LOAN_PURPOSES = picklistValues("PL_LOAN_PURPOSE");

export type LoanPurpose = (typeof LOAN_PURPOSES)[number];

export const LOAN_PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  picklists.PL_LOAN_PURPOSE.values.map((entry) => [entry.value, entry.label]),
);

/**
 * FRM-CMB-01: "Supporting document — Y for medical and education". The two purposes whose
 * application cannot be submitted without one.
 */
export const LOAN_PURPOSES_REQUIRING_DOCUMENT: readonly string[] = ["medical", "education"];

/**
 * How interest is applied over the tenure. A commercial term of the loan product,
 * not a statutory rule - but it has no default: a loan with no recorded method
 * cannot be scheduled, and approval fails naming the missing configuration rather
 * than assuming one.
 */
export const INTEREST_METHODS = ["reducing_balance", "flat"] as const;
export type InterestMethod = (typeof INTEREST_METHODS)[number];

export const INTEREST_METHOD_LABELS: Record<InterestMethod, string> = {
  reducing_balance: "Reducing balance",
  flat: "Flat rate",
};

/** Whether interest accrues while instalments are deferred. Also has no default. */
export const MORATORIUM_INTEREST_TREATMENTS = ["accrue", "waive"] as const;
export type MoratoriumInterest = (typeof MORATORIUM_INTEREST_TREATMENTS)[number];

export const MORATORIUM_INTEREST_LABELS: Record<MoratoriumInterest, string> = {
  accrue: "Accrue and capitalise",
  waive: "Waive",
};
