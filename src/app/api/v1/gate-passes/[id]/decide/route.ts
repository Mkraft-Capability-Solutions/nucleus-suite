import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { decideGatePass, decideGatePassSchema } from "@/server/attendance/service";
import { assertCanDecideGatePass } from "@/server/attendance/gate-pass-decision-guard";

export const dynamic = "force-dynamic";

/** POST approves or rejects a submitted gate pass (attendance.write). A rejection must carry `decisionRemarks`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
    const parsed = decideGatePassSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "A decision (approve true/false) is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    await assertCanDecideGatePass(access, id);
    const result = await decideGatePass(access, id, parsed.data, requestId);
    return ok({ type: "gate-pass", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/gate-passes/register/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
