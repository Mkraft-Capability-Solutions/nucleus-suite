import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createDepartment, createDepartmentSchema } from "@/server/organization/service";

export const dynamic = "force-dynamic";

/** Department creation (organization page). Consequential write: Idempotency-Key required. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = createDepartmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The department payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "organization.department_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await createDepartment(access, parsed.data, requestId);
    await storeIdempotency(access, "organization.department_create", key, fingerprint, 201, result.id);
    return ok({ type: "department", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/organization/tree` });
  } catch (error) {
    return fail(error, requestId);
  }
}
