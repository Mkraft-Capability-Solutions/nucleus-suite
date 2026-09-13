import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { grantCoff, grantCoffSchema } from "@/server/leave/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = grantCoffSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The COFF grant payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await grantCoff(access, parsed.data, requestId);
    return ok({ type: "coff-grant", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave-balances?employeeId=${parsed.data.employeeId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
