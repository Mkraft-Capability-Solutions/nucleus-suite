import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listOvertimeRegister } from "@/server/attendance/overtime-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const rows = await listOvertimeRegister(access, {
      search: params.get("search") ?? "",
      location: params.get("location"),
      orgUnit: params.get("orgUnit"),
      period: params.get("period"),
    });
    return collection({
      type: "overtime-entry",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/overtime/register",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
