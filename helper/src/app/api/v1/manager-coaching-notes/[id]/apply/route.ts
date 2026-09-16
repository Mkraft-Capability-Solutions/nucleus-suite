import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { HttpError, fail, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { applyGrowthAction, applyGrowthActionSchema } from "@/server/performance/calibration";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const key = requireIdempotencyKey(request.headers);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const parsed = applyGrowthActionSchema.safeParse({ ...(body ?? {}), coachingNoteId: id });
    if (!parsed.success) {
      throw new HttpError({
        status: 400, code: "BAD_REQUEST", message: "Check the highlighted fields.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "performance.growth_action", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This idempotency key was used with a different payload." });
    }
    const result = await applyGrowthAction(access, parsed.data, requestId);
    await storeIdempotency(access, "performance.growth_action", key, fingerprint, 201, id);
    return ok({ type: "growth-action", id, version: 1, attributes: result, requestId, self: `/api/v1/manager-coaching-notes/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
