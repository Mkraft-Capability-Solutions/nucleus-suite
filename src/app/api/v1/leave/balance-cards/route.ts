import { requireAccess } from "@/server/platform/access";
import { HttpError, collection, fail, requestIdFrom } from "@/server/platform/http";
import { listBalanceCards } from "@/server/leave/engine-console";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = (new URL(request.url).searchParams.get("employeeId") ?? "").trim();
    if (!UUID.test(employeeId)) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A valid employeeId is required.",
        details: [{ field: "employeeId", issue: "must be a uuid" }],
      });
    }
    const rows = await listBalanceCards(access, employeeId);
    return collection({
      type: "leave-balance-card",
      items: rows.map((row) => ({ ...row, id: row.leaveType, version: 1 })),
      requestId,
      self: `/api/v1/leave/balance-cards?employeeId=${employeeId}`,
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
