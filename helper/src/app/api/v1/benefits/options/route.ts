import { workflowRecords } from "@/server/workflows/records";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createBenefitOption, createBenefitOptionSchema } from "@/server/benefits/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createBenefitOptionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The benefit-option payload is invalid." });
    const result = await createBenefitOption(access, parsed.data);
    return ok({ type: "benefit-option", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/benefits/options` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Read the tenant-scoped work queue used by the operational forms. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return await workflowRecords(access, "benefits/options", request, requestId);
  } catch (error) { return fail(error, requestId); }
}
