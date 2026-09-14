import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey, requireVersion } from "@/server/platform/http";
import { releaseBatch, releaseBatchSchema } from "@/server/payroll/disbursement";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    // Money leaves the business here: irreversible, so an explicit version
    // precondition and an idempotency key are both required. Dual control and the
    // out-of-band verification check live in the service, not in this handler.
    requireVersion(request.headers);
    requireIdempotencyKey(request.headers);
    const parsed = releaseBatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Release remarks are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await releaseBatch(access, id, parsed.data, requestId);
    return ok({ type: "disbursement-batch", id: result.id, version: 1, attributes: { ...result }, requestId, self: `/api/v1/disbursements/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
