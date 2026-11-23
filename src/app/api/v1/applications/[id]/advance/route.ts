import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { advanceApplication } from "@/server/talent/service";
import { idempotentWrite, parseBody } from "@/server/workflows/idempotent-write";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ to: z.string().trim().min(1, "A target stage is required.").max(40) });

/**
 * POST advances an application exactly one stage (or into a terminal stage) by human decision.
 * employee.write; Idempotency-Key required so a retried click replays instead of hitting a 409.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const input = parseBody(bodySchema, await request.json().catch(() => null));
    const result = await idempotentWrite(access, request.headers, "talent.application_advance", { id, ...input }, () => advanceApplication(access, id, input.to, requestId));
    return ok({ type: "application", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/applications/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
