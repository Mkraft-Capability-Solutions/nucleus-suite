import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { cancelLeave, cancelLeaveSchema } from "@/server/leave/service";

export const dynamic = "force-dynamic";

/** FRM-LVE-02: withdraw a request that has not begun, giving back the days it holds. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = cancelLeaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A cancellation reason of at least 10 characters is required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await cancelLeave(access, id, parsed.data, requestId);
    return ok({ type: "leave-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave-requests/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
