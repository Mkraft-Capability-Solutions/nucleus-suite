import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listEarlyReturns } from "@/server/leave/engine-console";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listEarlyReturns(access);
    return collection({
      type: "early-return",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/leave/early-returns",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
