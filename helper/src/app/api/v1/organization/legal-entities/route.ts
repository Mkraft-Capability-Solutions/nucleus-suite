import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createLegalEntity, legalEntitySchema, listLegalEntities } from "@/server/organization/legal-entities";

export const dynamic = "force-dynamic";

/** Legal Entity Master (FRM-PLT-01): every entity with its full record and payroll lock. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listLegalEntities(access);
    return collection({
      type: "legal-entity",
      items,
      requestId,
      self: "/api/v1/organization/legal-entities",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Register a legal entity. Consequential write: Idempotency-Key required. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = legalEntitySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The legal entity payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "organization.legal_entity_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await createLegalEntity(access, parsed.data, requestId);
    await storeIdempotency(access, "organization.legal_entity_create", key, fingerprint, 201, result.id);
    return ok({ type: "legal-entity", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/organization/legal-entities/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
