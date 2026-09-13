import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createLearningPath, createPathSchema } from "@/server/learning/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createPathSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The learning-path payload is invalid." });
    const result = await createLearningPath(access, parsed.data);
    return ok({ type: "learning-path", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/learning-paths` });
  } catch (error) {
    return fail(error, requestId);
  }
}
