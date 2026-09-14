import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { listEmployeeHomeActions } from "@/server/home/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { employee, rows, auditTrail } = await listEmployeeHomeActions(access);
    return NextResponse.json(
      {
        data: rows.map((row) => ({ ...row, version: 1 })),
        meta: { requestId, employee, auditTrail, total: rows.length },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
