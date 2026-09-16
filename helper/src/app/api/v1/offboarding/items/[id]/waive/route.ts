import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { waiveClearanceItem, waiveClearanceSchema } from "@/server/lifecycle/clearance-board";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = waiveClearanceSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reason (min 3 characters) is required to waive a clearance item." });
    }
    const result = await waiveClearanceItem(access, id, parsed.data.reason, requestId);
    return ok({
      type: "clearance-item",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/offboarding/clearance-board/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
