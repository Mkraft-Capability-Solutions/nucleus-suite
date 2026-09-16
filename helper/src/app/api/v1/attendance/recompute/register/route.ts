import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listRecomputeMonitor, queueRecompute, queueRecomputeSchema } from "@/server/attendance/recompute-monitor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listRecomputeMonitor(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "attendance-recompute",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/attendance/recompute/register",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = queueRecomputeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "An employee scope, a from date, a to date (YYYY-MM-DD) and a reason (min 3 characters) are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await queueRecompute(access, parsed.data, requestId);
    return ok({
      type: "attendance-recompute",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/attendance/recompute/register/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
