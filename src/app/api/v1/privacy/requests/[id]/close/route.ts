import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { closeRightsCase } from "@/server/privacy/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ outcome: z.string().trim().min(1).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A closure outcome is required." });
    const result = await closeRightsCase(access, id, parsed.data.outcome, requestId);
    return ok({ type: "privacy-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/privacy/requests/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
