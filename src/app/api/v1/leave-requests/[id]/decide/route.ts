import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { decideLeave } from "@/server/leave/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ approve: z.boolean(), comment: z.string().trim().max(1000).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A decision (approve true/false) is required." });
    const result = await decideLeave(access, id, parsed.data.approve, parsed.data.comment, requestId);
    return ok({ type: "leave-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave-requests/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
