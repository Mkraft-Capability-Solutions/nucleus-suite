import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { disburseFnf, disburseFnfSchema } from "@/server/fnf/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = disburseFnfSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The disbursement payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await disburseFnf(access, id, parsed.data, requestId);
    return ok({ type: "fnf-disbursement", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/fnf-settlements/${id}/disburse` });
  } catch (error) {
    return fail(error, requestId);
  }
}
