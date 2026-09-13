import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { snapshotMetric, snapshotMetricSchema } from "@/server/analytics/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = snapshotMetricSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The snapshot payload is invalid." });
    const result = await snapshotMetric(access, parsed.data);
    return ok({ type: "metric-snapshot", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/analytics/metrics` });
  } catch (error) {
    return fail(error, requestId);
  }
}
