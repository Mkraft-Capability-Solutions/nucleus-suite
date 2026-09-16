import { workflowRecords } from "@/server/workflows/records";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { recognizeEmployee, recognizeSchema } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = recognizeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The recognition payload is invalid." });
    const result = await recognizeEmployee(access, parsed.data, requestId);
    return ok({ type: "recognition-event", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/recognition-events` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Read the tenant-scoped work queue used by the operational forms. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return await workflowRecords(access, "recognition-events", request, requestId);
  } catch (error) { return fail(error, requestId); }
}
