import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getCompensationSummary } from "@/server/compensation/summary";

export const dynamic = "force-dynamic";

/** GET /api/v1/compensation/summary — the caller's own pay, band, compa-ratio and flex-benefit catalogue. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const summary = await getCompensationSummary(access);
    return ok({ type: "compensation-summary", id: summary.employee.id, version: 1, attributes: { ...summary }, requestId, self: "/api/v1/compensation/summary" });
  } catch (error) {
    return fail(error, requestId);
  }
}
