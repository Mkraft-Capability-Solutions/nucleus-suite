import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createContract, createContractSchema } from "@/server/contractors/service";
import { listContractOptions } from "@/server/contractors/workforce";

export const dynamic = "force-dynamic";

/** GET: the tenant's contractor contracts with their agency, for deploying workers (employee.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listContractOptions(access);
    return collection({ type: "contractor-contract", items: rows.map((row) => ({ ...row, version: 1 })), requestId, self: "/api/v1/contractors/contracts", nextCursor: null, total: rows.length });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createContractSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The contract payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createContract(access, parsed.data, requestId);
    return ok({ type: "contractor-contract", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/contractors/contracts/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
