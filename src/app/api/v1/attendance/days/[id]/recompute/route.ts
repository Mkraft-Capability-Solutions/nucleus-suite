import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { recomputeDay } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await recomputeDay(access, id, requestId);
    return ok({ type: "attendance-day", id, version: 1, attributes: result, requestId, self: `/api/v1/attendance/days/${id}/trace` });
  } catch (error) {
    return fail(error, requestId);
  }
}

