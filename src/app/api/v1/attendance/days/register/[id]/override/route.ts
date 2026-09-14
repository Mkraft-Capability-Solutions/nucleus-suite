import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { overrideAttendanceDay, overrideAttendanceDaySchema } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

/** FRM-TIM-04 Actions: override the applied shift and/or the day's disposition. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = overrideAttendanceDaySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The override payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await overrideAttendanceDay(access, id, parsed.data, requestId);
    return ok({ type: "attendance-day", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/attendance/days/register/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
