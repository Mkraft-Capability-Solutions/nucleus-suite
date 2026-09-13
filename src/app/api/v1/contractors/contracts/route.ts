import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createContract, createContractSchema } from "@/server/contractors/service";

export const dynamic = "force-dynamic";

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
