import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listGlMappings } from "@/server/payroll/gl";

export const dynamic = "force-dynamic";

/**
 * Read-only by design. Mapping records are created and approved through the
 * `ledger` operational workflow (`/api/v1/operations/ledger`), which already
 * owns draft -> submitted -> approved -> retired and the effective-date overlap
 * guard. This endpoint returns the resolved result of that workflow against the
 * chart of accounts.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const items = await listGlMappings(access, { legalEntityId: params.get("legalEntityId"), asOf: params.get("asOf") });
    return collection({
      type: "gl-mapping",
      items: items.map((item, index) => ({
        id: item.mappingId ?? item.workflowRecordId ?? `${item.legalEntityId}:${item.componentCode}:${index}`,
        version: 1,
        ...item,
      })),
      requestId,
      self: "/api/v1/gl-mappings",
      nextCursor: null,
      total: items.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
