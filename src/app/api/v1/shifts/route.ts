import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listShiftCatalog } from "@/server/attendance/shift-assignment";

export const dynamic = "force-dynamic";

/** GET /api/v1/shifts — the tenant's active shift master (attendance.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const shifts = await listShiftCatalog(access);
    return collection({
      type: "shift",
      items: shifts.map((shift) => ({ ...shift, version: 1 })),
      requestId,
      self: "/api/v1/shifts",
      nextCursor: null,
      total: shifts.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
