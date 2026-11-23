import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listAssetRegister } from "@/server/assets/service";
import { registerCatalogAsset, registerCatalogAssetSchema } from "@/server/assets/catalog-intake";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listAssetRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "asset",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/assets/register",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST catalogues a new asset as Available (employee.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = registerCatalogAssetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Check the highlighted fields.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "asset.register", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "asset", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: `/api/v1/assets/register/${prior.responseLocator}` });
    }
    const result = await registerCatalogAsset(access, parsed.data, requestId);
    await storeIdempotency(access, "asset.register", key, fingerprint, 201, result.id);
    return ok({ type: "asset", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/assets/register/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
