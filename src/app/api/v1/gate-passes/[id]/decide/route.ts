import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { decideGatePass } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

// `decisionRemarks` is optional (older callers send only `approve`); it is stored with the decision.
const bodySchema = z.object({ approve: z.boolean(), decisionRemarks: z.string().trim().min(1).max(300).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A decision (approve true/false) is required." });
    const result = await decideGatePass(access, id, { approve: parsed.data.approve, decisionRemarks: parsed.data.decisionRemarks }, requestId);
    return ok({ type: "gate-pass", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/gate-passes/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
