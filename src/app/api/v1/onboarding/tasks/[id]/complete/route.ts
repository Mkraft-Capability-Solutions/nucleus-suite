import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { completeOnboardingTask } from "@/server/lifecycle/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ note: z.string().trim().max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The completion payload is invalid." });
    const result = await completeOnboardingTask(access, id, parsed.data.note, requestId);
    return ok({ type: "onboarding-task", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/onboarding/instances/${result.instanceId}/readiness` });
  } catch (error) {
    return fail(error, requestId);
  }
}
