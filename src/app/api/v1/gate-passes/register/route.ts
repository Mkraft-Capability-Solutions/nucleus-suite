import { requireAccess } from "@/server/platform/access";
import { HttpError, collection, fail, ok, requestIdFrom } from "@/server/platform/http";
import { listGatePassRegister } from "@/server/attendance/gate-pass-register";
import { requestGatePass, requestGatePassSchema } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listGatePassRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "gate-pass",
      // The envelope owns `type`, so the pass's own kind travels as `pass_type`.
      items: rows.map(({ type, ...row }) => ({ ...row, pass_type: type, version: 1 })),
      requestId,
      self: "/api/v1/gate-passes/register",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * Raises a gate pass through the attendance service (validation, the monthly personal allowance,
 * scope check and audit). Added for the redesigned attendance screen; POST /api/v1/gate-passes is
 * left unchanged for the classic screen.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = requestGatePassSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The gate pass request is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await requestGatePass(access, parsed.data, requestId);
    return ok({ type: "gate-pass", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/gate-passes/register/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
