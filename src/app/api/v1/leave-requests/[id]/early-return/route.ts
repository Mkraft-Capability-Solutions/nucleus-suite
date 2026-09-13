import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { earlyReturnSchema, recordEarlyReturn } from "@/server/leave/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = earlyReturnSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An actual return date (YYYY-MM-DD) is required." });
    const result = await recordEarlyReturn(access, id, parsed.data, requestId);
    return ok({ type: "leave-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave-requests/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
