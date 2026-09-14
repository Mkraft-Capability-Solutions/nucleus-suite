import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { freezePosition } from "@/server/organization/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = bodySchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reason (min 3 characters) is required to freeze a position." });
    const result = await freezePosition(access, id, parsed.data.reason, requestId);
    return ok({ type: "position", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/organization/positions/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
