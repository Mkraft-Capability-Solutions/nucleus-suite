import "server-only";

/**
 * The advance lifecycle's closing states, in one place.
 *
 * `finalizePayrollRun` in `src/server/payroll/service.ts` marks a recovered
 * advance `recovered`; `repayAdvance` here can also close one as `repaid`. Both
 * end the exposure, and an advance in either state must stop blocking the next
 * loan or advance. The loans module read a list that omitted `recovered`, so a
 * fully recovered advance blocked every later borrowing permanently (RL-21,
 * T-19). Anything that asks "is this employee still carrying an advance?" reads
 * this constant rather than restating the list.
 */
export const TERMINAL_ADVANCE_STATUSES = ["recovered", "repaid", "closed", "rejected", "cancelled"] as const;

/** True when the advance is finished and no longer blocks a further advance or loan. */
export function isAdvanceSettled(status: string | null | undefined): boolean {
  return (TERMINAL_ADVANCE_STATUSES as readonly string[]).includes((status ?? "").trim().toLowerCase());
}
