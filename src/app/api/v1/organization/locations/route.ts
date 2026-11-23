import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listLocations } from "@/server/organization/directory";
import { createLocation, createLocationSchema } from "@/server/organization/establishment-master";

export const dynamic = "force-dynamic";

/** GET lists the tenant's location records; POST creates one (tenant.manage, Idempotency-Key required). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listLocations(access);
    return ok({ type: "location-list", id: "locations", version: 1, attributes: { items }, requestId, self: "/api/v1/organization/locations" });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = createLocationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Check the highlighted fields.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "organization.location_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "location", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: "/api/v1/organization/locations" });
    }
    const result = await createLocation(access, parsed.data, requestId);
    await storeIdempotency(access, "organization.location_create", key, fingerprint, 201, result.id);
    return ok({ type: "location", id: result.id, version: 1, attributes: result, requestId, self: "/api/v1/organization/locations" });
  } catch (error) {
    return fail(error, requestId);
  }
}
