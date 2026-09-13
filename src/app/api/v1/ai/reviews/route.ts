import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { requestHumanReview, requestReviewSchema } from "@/server/ai/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = requestReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The review-request payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await requestHumanReview(access, parsed.data, requestId);
    return ok({ type: "human-review-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/ai/reviews/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
