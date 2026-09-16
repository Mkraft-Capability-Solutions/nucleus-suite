import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { listErpQueue } from "@/server/integrations/erp-sync";

export const dynamic = "force-dynamic";

/**
 * FRM-FIN-02: the inbound ERP queue with its failures and their reasons.
 *
 * The service existed and nothing reached it, so a sync that failed was recorded with a
 * reason nobody could read without querying the database. Filters are honoured as given;
 * an absent filter means everything in scope, never a guessed default.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const limitRaw = Number(params.get("limit") ?? "");
    const queue = await listErpQueue(access, {
      direction: params.get("direction"),
      status: params.get("status"),
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
    });
    return ok({
      type: "erp-queue",
      id: "queue",
      version: 1,
      attributes: queue,
      requestId,
      self: "/api/v1/integrations/erp-queue",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
