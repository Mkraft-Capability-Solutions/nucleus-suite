import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { coffLapseRunSchema, runCoffLapse } from "@/server/leave/coff";

export const dynamic = "force-dynamic";

/**
 * RL-06's nightly lapse, on demand. Preview lists the grants that would lapse on
 * the given date; commit moves them to Lapsed and writes the ledger entry that
 * names the run.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = coffLapseRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The comp-off lapse run payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await runCoffLapse(access, parsed.data, requestId);
    return ok({
      type: "coff-lapse-run",
      id: `${result.asOf}:${result.mode}`,
      version: 1,
      attributes: result,
      requestId,
      self: "/api/v1/leave/coff-lapse-runs",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
