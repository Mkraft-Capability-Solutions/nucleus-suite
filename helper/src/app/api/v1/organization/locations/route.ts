import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createLocation, listLocations, locationSchema } from "@/server/organization/locations";

export const dynamic = "force-dynamic";

/** Location / Work Site Master (FRM-PLT-02): every site with its full record. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listLocations(access);
    return collection({
      type: "location",
      items,
      requestId,
      self: "/api/v1/organization/locations",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Register a work site. Consequential write: Idempotency-Key required. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = locationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The location payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "organization.location_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await createLocation(access, parsed.data, requestId);
    await storeIdempotency(access, "organization.location_create", key, fingerprint, 201, result.id);
    return ok({ type: "location", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/organization/locations/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
