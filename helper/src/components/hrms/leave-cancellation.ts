/* ------------------------------------------------------------------ */
/* Leave withdrawal — which requests may offer a Cancel action          */
/* Mirrors cancelLeave (src/server/leave/service.ts)                    */
/* ------------------------------------------------------------------ */

/**
 * `cancelLeave` refuses in three ways, and the button is offered only where none of
 * them apply. Read from the service, not assumed:
 *
 *  1. 409 VERSION_CONFLICT when `status` is already `cancelled` or `rejected`. Every
 *     other status — including `approved` — is cancellable: the service explicitly
 *     reverses whichever ledger entry the request is holding, the approval debit if it
 *     was approved and the reservation taken at submit otherwise.
 *  2. 403 when the caller is not the applicant and lacks `leave.approve`. The applicant
 *     is `access.context.employeeId === request.employee_id`, so a self-service Cancel
 *     is offered only on the viewer's own requests.
 *  3. 422 POLICY_VIOLATION when `starts_on <= today`. An absence that has begun is
 *     settled with an early return, not withdrawn.
 *
 * The schema also demands a `reason` of at least 10 characters.
 */

export const LEAVE_CANCEL_REASON_MIN = 10;

/** Statuses `cancelLeave` rejects outright, whoever is asking. */
export const LEAVE_TERMINAL_STATUSES = ["cancelled", "rejected"] as const;

export type CancellableInput = {
  status: string;
  /** The request's `starts_on`, as an ISO `YYYY-MM-DD` date. */
  startsOn: string;
  /** The request's `employee_id`. */
  employeeId: string;
  /** The viewer's own employee id, or null when the session is not linked to an employee. */
  viewerEmployeeId: string | null;
  /** Today as an ISO `YYYY-MM-DD` date, in the viewer's own reckoning. */
  today: string;
};

export type CancelAvailability =
  | { offer: true }
  | { offer: false; reason: "not-applicant" | "terminal-status" | "already-begun" | "unknown-start-date" };

/** Whether a status is one the server will still act on. */
export function isCancellableStatus(status: string): boolean {
  const key = status.trim().toLowerCase();
  if (key === "") return false;
  return !(LEAVE_TERMINAL_STATUSES as readonly string[]).includes(key);
}

/**
 * Whether to show the Cancel control, and when not, why — so the surface can stay quiet
 * rather than offer a button the server is certain to refuse.
 */
export function cancelAvailability(input: CancellableInput): CancelAvailability {
  if (input.viewerEmployeeId === null || input.viewerEmployeeId === "" || input.employeeId !== input.viewerEmployeeId) {
    return { offer: false, reason: "not-applicant" };
  }
  if (!isCancellableStatus(input.status)) return { offer: false, reason: "terminal-status" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)) return { offer: false, reason: "unknown-start-date" };
  // String comparison is safe and correct for zero-padded ISO dates.
  if (input.startsOn <= input.today) return { offer: false, reason: "already-begun" };
  return { offer: true };
}

/** Convenience predicate for the render path. */
export function canCancelLeave(input: CancellableInput): boolean {
  return cancelAvailability(input).offer;
}
