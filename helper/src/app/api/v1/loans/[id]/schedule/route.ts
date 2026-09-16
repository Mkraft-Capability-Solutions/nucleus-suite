import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getLoanSchedule } from "@/server/loans/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await getLoanSchedule(access, id);
    return ok({
      type: "loan-schedule",
      id: result.scheduleId,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/loans/${id}/schedule`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
