import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom } from "@/server/platform/http";
import { listSettlements } from "@/server/payroll/settlement";
import { getProposalDetail, listProposalOptions } from "@/server/payroll/settlement-proposals";

/**
 * GET /api/v1/settlement-proposals - the full and final PROPOSAL DESK read model
 * (module `settlements`).
 *
 * Read-only by design, in three shapes:
 *   (no selector)   the proposal register: every proposal with its leaver, last
 *                   working day, exit type, net and outcome
 *   ?options=exits  what a new proposal may legally cite - open exit cases and
 *                   finalized payroll runs, each with the reason it is or is not
 *                   available
 *   ?proposalId=    one proposal: every stored head, the arithmetic they produce,
 *                   the transitions legal from its state, and its audit trail
 *
 * Every WRITE - raise, edit, submit, approve, return, reject, cancel - goes to
 * `/api/v1/operations/settlements`, which already owns strict field validation,
 * Idempotency-Key, If-Match, the maker/checker split, history and audit. This
 * endpoint adds nothing to that path and deliberately exposes no POST, so there
 * is exactly one way a settlement proposal can be written.
 *
 * `finalize` and the settlement working itself live on
 * `/api/v1/settlement-workings` (SCR-056); this route neither recomputes a
 * working nor evaluates the finalize gates.
 */
export const dynamic = "force-dynamic";

export const settlementProposalQuerySchema = z.object({
  proposalId: z.string().uuid().optional(),
  options: z.enum(["exits"]).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  employeeId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = settlementProposalQuerySchema.safeParse({
      proposalId: params.get("proposalId") ?? undefined,
      options: params.get("options") ?? undefined,
      status: params.get("status") ?? undefined,
      employeeId: params.get("employeeId") ?? undefined,
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the query parameters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || "query", issue: issue.message })),
      });
    }
    const { proposalId, options, status, employeeId } = parsed.data;

    if (proposalId) {
      const detail = await getProposalDetail(access, proposalId);
      return ok({
        type: "settlement-proposal",
        id: detail.id,
        version: detail.version,
        attributes: { ...detail },
        requestId,
        self: `/api/v1/settlement-proposals?proposalId=${encodeURIComponent(proposalId)}`,
      });
    }

    if (options === "exits") {
      const catalogue = await listProposalOptions(access);
      return ok({
        type: "settlement-proposal-options",
        id: "exits",
        version: 1,
        attributes: { ...catalogue },
        requestId,
        self: "/api/v1/settlement-proposals?options=exits",
      });
    }

    const { page, pageSize } = parsePagination(params);
    const { items, nextCursor } = await listSettlements(access, {
      status: status ?? null,
      employeeId: employeeId ?? null,
      page,
      pageSize,
    });
    return collection({
      type: "settlement-proposal",
      items,
      requestId,
      self: "/api/v1/settlement-proposals",
      nextCursor,
      total: items.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
