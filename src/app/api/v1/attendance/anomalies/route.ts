import { requireAccess } from "@/server/platform/access";
import { HttpError, collection, fail, requestIdFrom } from "@/server/platform/http";
import { listAttendanceAnomalies } from "@/server/attendance/engine-console";

export const dynamic = "force-dynamic";

/** Attendance exception queue for the anomalies panel. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rawLimit = new URL(request.url).searchParams.get("limit");
    const limit = rawLimit === null || rawLimit.trim() === "" ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The limit must be a whole number between 1 and 100.",
        details: [{ field: "limit", issue: "must be an integer between 1 and 100" }],
      });
    }
    const items = await listAttendanceAnomalies(access, limit);
    return collection({
      type: "attendance-anomaly",
      items: items.map((item) => ({ ...item, version: 1 })),
      requestId,
      self: "/api/v1/attendance/anomalies",
      nextCursor: null,
      total: items.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
