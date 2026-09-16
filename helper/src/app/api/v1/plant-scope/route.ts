import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { listPlantScopedWorkforce } from "@/server/payroll/plant-scope";

/**
 * GET /api/v1/plant-scope — a location's workforce for one period, with compensation
 * masked ON THE SERVER for any caller whose RL-24 data scope does not cover the row.
 *
 *   ?location=  the plant/location to list (omitted lists every location)
 *   ?period=    YYYY-MM for the attendance and payroll figures (defaults to this month)
 *   ?previewRole=  re-query as another role's configured scope; requires membership.manage
 *                  and can only ever narrow the result
 *
 * Read-only. Pay amounts are absent from the response body for a scoped caller — they are
 * not sent and hidden, they are not sent.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const view = await listPlantScopedWorkforce(access, {
      location: params.get("location"),
      period: params.get("period"),
      previewRole: params.get("previewRole"),
    });
    return ok({
      type: "plant-scope",
      id: `${view.location ?? "all"}:${view.period}`,
      version: 1,
      attributes: { ...view },
      requestId,
      self: "/api/v1/plant-scope",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
