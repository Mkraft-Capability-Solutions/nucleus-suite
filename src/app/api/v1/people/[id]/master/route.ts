import { createHash } from "node:crypto";
import { patchEmployeeMasterSchema } from "@/lib/employee-master/contract";
import { getEmployeeMaster, patchEmployeeMaster } from "@/server/organization/employee-master";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET: hydrated employee master (core, currency, visa — number masked unless permitted — and typed custom fields). */
export async function GET(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const item = await getEmployeeMaster(access, id);
    return ok({ type: "employee_master", id: item.id, version: item.version, attributes: item, requestId, self: `/api/v1/employees/${item.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** PATCH: core + currency + visa/expatriate + custom values in one transaction. Optional Idempotency-Key. */
export async function PATCH(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const raw = await request.json().catch(() => null);
    const parsed = patchEmployeeMasterSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The employee master payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const key = request.headers.get("idempotency-key");
    const operation = `employee.master_update:${id}`;
    const fingerprint = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
    if (key) {
      const prior = await checkIdempotency(access, operation, key, fingerprint);
      if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_CONFLICT", message: "This Idempotency-Key was already used with a different payload." });
      if (prior.outcome === "replay") {
        const item = await getEmployeeMaster(access, id);
        return ok({ type: "employee_master", id: item.id, version: item.version, attributes: item, requestId, self: `/api/v1/employees/${item.id}` });
      }
    }
    const item = await patchEmployeeMaster(access, id, parsed.data, requestId);
    if (key) await storeIdempotency(access, operation, key, fingerprint, 200, `/api/v1/employees/${item.id}`);
    return ok({ type: "employee_master", id: item.id, version: item.version, attributes: item, requestId, self: `/api/v1/employees/${item.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
