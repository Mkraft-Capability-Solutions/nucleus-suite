import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listMobilityRegister, mobilityRegisterQuery } from "@/server/talent/mobility";

export const dynamic = "force-dynamic";

/** Top-level so the contract is readable without opening the service. */
export const querySchema = mobilityRegisterQuery;

const SELF = "/api/v1/mobility-register";

/**
 * GET /api/v1/mobility-register — the career & internal mobility work queue.
 *
 * Read-only by design. Mobility requests are created and transitioned through
 * the generic operational workflow (`/api/v1/operations/mobility` and its
 * `/[id]/[action]` endpoints), which already own draft -> submitted ->
 * approved/returned/rejected -> completed, the Idempotency-Key and If-Match
 * preconditions, the audit trail and the separation-of-duties refusal. This
 * endpoint adds the two things that register cannot answer on its own: the
 * employee's CURRENT role, department and location beside the requested target,
 * and, per row, which of those transitions the caller may actually take and why
 * not. Scope is `talent.mobility.read` / `.team.read` / `.self.read`.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const raw: Record<string, string> = {};
    for (const key of ["status", "employeeId", "search", "page", "pageSize"]) {
      const value = params.get(key);
      if (value !== null && value !== "") raw[key] = value;
    }
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the mobility register filters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const register = await listMobilityRegister(access, parsed.data);
    return collection({
      type: "mobility-request",
      // The caller's scope travels with every row so the page never has to
      // re-derive it, and `actions` already carries the per-row verdict.
      items: register.items.map((item) => ({ ...item, scope: register.scope })),
      requestId,
      self: SELF,
      nextCursor: register.nextCursor,
      total: register.items.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
