import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { approveOtRequest, approveOtSchema } from "@/server/ot/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = approveOtSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The approval payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await approveOtRequest(access, id, parsed.data, requestId);
    return ok({ type: "ot-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/ot-requests/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
