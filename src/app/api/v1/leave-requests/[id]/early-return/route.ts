import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { earlyReturnSchema, recordEarlyReturn } from "@/server/leave/service";
import { assertEarlyReturnOpen } from "@/server/leave/request-guards";
import { runIdempotent } from "@/server/leave/idempotent-write";

export const dynamic = "force-dynamic";

/** HR/approver records an early return once per request; the unused days are re-credited to the ledger. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    const key = requireIdempotencyKey(request.headers);
    const parsed = earlyReturnSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An actual return date (YYYY-MM-DD) is required.", details: [{ field: "actualReturnDate", issue: "required" }] });
    const outcome = await runIdempotent(access, "leave.early_return", key, { id, ...parsed.data }, async () => {
      await assertEarlyReturnOpen(access, id);
      return recordEarlyReturn(access, id, parsed.data, requestId);
    });
    const attributes = outcome.attributes;
    return ok({ type: "leave-request", id, version: 1, attributes, requestId, self: `/api/v1/leave-requests/register/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
