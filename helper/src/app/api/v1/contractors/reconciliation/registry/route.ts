import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listContractWorkers } from "@/server/contractors/reconciliation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listContractWorkers(access);
    return collection({
      type: "contract-worker-registry",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/contractors/reconciliation/registry",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
