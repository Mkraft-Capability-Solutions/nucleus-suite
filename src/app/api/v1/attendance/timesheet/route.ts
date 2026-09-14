import { requireAccess } from "@/server/platform/access";
import { HttpError, collection, fail, requestIdFrom } from "@/server/platform/http";
import { listMonthlyTimesheet } from "@/server/attendance/engine-console";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD = /^\d{4}-\d{2}$/;

/** One entry per calendar day of the period, including days with no record. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const employeeId = (params.get("employeeId") ?? "").trim();
    const period = (params.get("period") ?? "").trim();
    if (!UUID.test(employeeId)) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A valid employeeId is required.",
        details: [{ field: "employeeId", issue: "must be a uuid" }],
      });
    }
    if (!PERIOD.test(period)) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A valid period is required.",
        details: [{ field: "period", issue: "must be YYYY-MM" }],
      });
    }
    const days = await listMonthlyTimesheet(access, employeeId, period);
    return collection({
      type: "timesheet-day",
      items: days.map((day) => ({ ...day, id: day.date, version: 1 })),
      requestId,
      self: `/api/v1/attendance/timesheet?employeeId=${employeeId}&period=${period}`,
      nextCursor: null,
      total: days.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
