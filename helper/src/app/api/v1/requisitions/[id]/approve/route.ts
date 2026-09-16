import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, ok, requestIdFrom } from "@/server/platform/http";
import { approveRequisition, approveRequisitionSchema } from "@/server/talent/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    // The body is optional: approving within headroom needs nothing, and only an
    // establishment override carries a payload.
    const body = await request.json().catch(() => ({}));
    const parsed = approveRequisitionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the highlighted fields.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await approveRequisition(access, id, parsed.data, requestId);
    return ok({ type: "requisition", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/requisitions/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
