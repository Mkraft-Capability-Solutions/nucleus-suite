import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { submitAiFeedback, submitAiFeedbackSchema } from "@/server/ai/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = submitAiFeedbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A run id and rating are required." });
    const result = await submitAiFeedback(access, parsed.data);
    return ok({ type: "ai-feedback", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/ai/feedback` });
  } catch (error) {
    return fail(error, requestId);
  }
}
