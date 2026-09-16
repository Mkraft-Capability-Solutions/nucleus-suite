import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { resolveAnomaly, resolveAnomalySchema } from "@/server/payroll/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = resolveAnomalySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A disposition and a reason are required; a waiver reason must be at least 20 characters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await resolveAnomaly(access, id, parsed.data, requestId);
    return ok({ type: "payroll-anomaly", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/payroll-anomalies` });
  } catch (error) {
    return fail(error, requestId);
  }
}
