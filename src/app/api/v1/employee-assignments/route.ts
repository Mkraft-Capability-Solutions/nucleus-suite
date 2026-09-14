import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { getAssignmentHistory, listAssignmentQueue } from "@/server/assignments/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const employeeId = params.get("employeeId");
    if (employeeId) {
      const history = await getAssignmentHistory(access, employeeId);
      return NextResponse.json(
        { data: { type: "assignment-history", employeeId, ...history }, meta: { requestId } },
        { headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    }
    const rows = await listAssignmentQueue(access, params.get("search") ?? "");
    return collection({
      type: "assignment",
      items: rows.map((row) => ({ ...row, id: row.id ?? `employee:${row.employee_id}`, version: 1 })),
      requestId,
      self: "/api/v1/employee-assignments",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
