import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { searchLeaveEmployees } from "@/server/leave/workspace";

export const dynamic = "force-dynamic";

/** Employees the caller may apply or adjust leave for (HR/approvers: tenant search; others: themselves). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const search = (new URL(request.url).searchParams.get("search") ?? "").slice(0, 80);
    const rows = await searchLeaveEmployees(access, search);
    return collection({
      type: "leave-employee",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/leave/employees",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
