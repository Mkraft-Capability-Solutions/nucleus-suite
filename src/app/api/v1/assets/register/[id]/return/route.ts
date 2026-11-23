import { createHash } from "node:crypto";
import { z } from "zod";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { returnAsset, returnAssetSchema } from "@/server/assets/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = returnAssetSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A condition, a return date (YYYY-MM-DD) and a reason (min 3 characters) are required to return an asset.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    // Retry-safe when the caller sends an Idempotency-Key: a replay returns the first outcome
    // instead of failing with "already returned".
    const key = request.headers.get("idempotency-key")?.trim() || null;
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    if (key) {
      const prior = await checkIdempotency(access, "asset.return", key, fingerprint);
      if (prior.outcome === "conflict") {
        throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
      }
      if (prior.outcome === "replay") {
        return ok({ type: "asset", id, version: 1, attributes: { id, replayed: true }, requestId, self: `/api/v1/assets/register/${id}` });
      }
    }
    const result = await returnAsset(access, id, parsed.data, requestId);
    if (key) await storeIdempotency(access, "asset.return", key, fingerprint, 200, id);
    return ok({
      type: "asset",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/assets/register/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
