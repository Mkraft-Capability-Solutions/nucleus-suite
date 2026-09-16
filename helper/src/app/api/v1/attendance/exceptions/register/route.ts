import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listExceptionRegister } from "@/server/attendance/exception-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listExceptionRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "attendance-exception",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/attendance/exceptions/register",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
