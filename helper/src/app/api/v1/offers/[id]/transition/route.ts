import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { transitionOffer, transitionOfferSchema } from "@/server/talent/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = transitionOfferSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The offer transition payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await transitionOffer(access, id, parsed.data, requestId);
    return ok({ type: "offer", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/offers/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
