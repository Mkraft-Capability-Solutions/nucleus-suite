import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, requestIdFrom } from "@/server/platform/http";
import {
  getAttendanceEngineStatus,
  listPlantCalendars,
  listWorkerCategories,
} from "@/server/attendance/engine-console";

export const dynamic = "force-dynamic";

/** Smart Attendance engine card: rule pack, worker-category rules, plant calendars. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const rawYear = params.get("year");
    const year = rawYear === null || rawYear.trim() === "" ? new Date().getUTCFullYear() : Number(rawYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2999) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The year must be a four-digit calendar year.",
        details: [{ field: "year", issue: "must be a four-digit calendar year" }],
      });
    }
    const [engine, workerCategories, plantCalendars] = await Promise.all([
      getAttendanceEngineStatus(access),
      listWorkerCategories(access),
      listPlantCalendars(access, year),
    ]);
    return NextResponse.json(
      { data: { engine, workerCategories, plantCalendars }, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
