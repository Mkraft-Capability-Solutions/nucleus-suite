import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listLeaveHolidays } from "@/server/leave/workspace";

export const dynamic = "force-dynamic";

/** Active tenant holidays for one year (?year=YYYY), for the leave calendar. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const year = Number(new URL(request.url).searchParams.get("year") ?? new Date().getUTCFullYear());
    const rows = await listLeaveHolidays(access, year);
    return collection({
      type: "holiday",
      items: rows.map((row) => ({ ...row, id: `${row.date}:${row.name}`, version: 1 })),
      requestId,
      self: `/api/v1/leave/holidays?year=${year}`,
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
