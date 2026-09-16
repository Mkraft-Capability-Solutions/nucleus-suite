import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listAgencies } from "@/server/contractors/reconciliation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listAgencies(access);
    return collection({
      type: "staffing-vendor-master",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/contractors/reconciliation/vendors",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
