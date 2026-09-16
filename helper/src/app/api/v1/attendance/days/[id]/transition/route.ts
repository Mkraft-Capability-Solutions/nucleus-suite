import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { transitionDay } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["approve", "lock", "reopen"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A transition action (approve, lock, reopen) is required." });
    const result = await transitionDay(access, id, parsed.data.action, requestId);
    return ok({ type: "attendance-day", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/attendance/days/${result.id}/trace` });
  } catch (error) {
    return fail(error, requestId);
  }
}
