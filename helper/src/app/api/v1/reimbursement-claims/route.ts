import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import {
  listReimbursementClaims,
  parseReimbursementClaimsQuery,
  reimbursementClaimsQuerySchema,
} from "@/server/payroll/reimbursements";

export const dynamic = "force-dynamic";

/** The query contract, exported so the screen and the tests share one shape. */
export const querySchema = reimbursementClaimsQuerySchema;

/**
 * SCR-058 / FRM-PAY-06 — the reimbursement claim register.
 *
 * Read-only by design, and deliberately so: a reimbursement claim is an
 * `expenses` operational record, and every write on it — create, edit, submit,
 * approve, return, reject, cancel, reimburse — already belongs to
 * `/api/v1/operations/expenses[/:id[/:action]]`, which owns the state machine,
 * `Idempotency-Key`, `If-Match` and the audit trail. Building a second write path
 * here would fork that. This endpoint returns what those routes cannot: the
 * entitlement position, claimed-to-date, the claimed-versus-passed split and the
 * payroll tag state, per claim.
 *
 * Visibility is the operational scope for `workforce.travel.read`, resolved by
 * the same helper the generic register uses, so this endpoint can never widen it.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const url = new URL(request.url);
    const query = parseReimbursementClaimsQuery(url.searchParams);
    const { items, total } = await listReimbursementClaims(access, query);
    // `self` is rebuilt from the validated query so no unchecked request text is
    // echoed back into the response envelope.
    const self = new URLSearchParams(
      Object.entries(query)
        .filter((entry): entry is [string, string | boolean] => entry[1] !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ).toString();
    return collection({
      type: "reimbursement-claim",
      items,
      requestId,
      self: `/api/v1/reimbursement-claims${self === "" ? "" : `?${self}`}`,
      // The register is read whole (bounded server-side) so entitlement
      // consumption can be summed across the year rather than across a page.
      nextCursor: null,
      total,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
