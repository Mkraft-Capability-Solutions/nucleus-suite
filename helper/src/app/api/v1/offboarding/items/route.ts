import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { workflowRecords } from "@/server/workflows/records";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return await workflowRecords(access, "offboarding/items", request, requestId);
  } catch (error) { return fail(error, requestId); }
}
