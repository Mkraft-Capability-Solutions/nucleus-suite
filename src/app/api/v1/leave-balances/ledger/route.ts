import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listLeaveLedger } from "@/server/leave/ledger-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const rows = await listLeaveLedger(access, {
      search: params.get("search") ?? "",
      employeeId: params.get("employeeId"),
    });
    return collection({
      type: "leave-ledger",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/leave-balances/ledger",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
