import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { decideHumanReview, decideReviewSchema } from "@/server/ai/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = decideReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A decision and comment are required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await decideHumanReview(access, id, parsed.data, requestId);
    return ok({ type: "human-review-decision", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/ai/reviews/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
