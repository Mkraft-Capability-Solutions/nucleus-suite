import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { decideRegularizationStage, decideRegularizationSchema } from "@/server/attendance/regularization-workflow";

export const dynamic = "force-dynamic";

/**
 * POST decides the stage a regularization is waiting on (supervisor, then time office). `stage` is optional; when
 * given it must match the pending stage. The status guard makes a repeated decision a 409, so retries are safe.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
    const parsed = decideRegularizationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "A decision (approve true/false) is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await decideRegularizationStage(access, id, parsed.data, requestId);
    return ok({ type: "attendance-regularization", id: result.id, version: 1, attributes: result, requestId, self: "/api/v1/regularizations" });
  } catch (error) {
    return fail(error, requestId);
  }
}
