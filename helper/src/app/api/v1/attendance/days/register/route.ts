import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listAttendanceDayRegister } from "@/server/attendance/day-register";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function optionalDate(value: string | null, field: string): string | null {
  if (value === null || value === "") return null;
  if (!DATE_PATTERN.test(value)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid date filter.", details: [{ field, issue: "Expected YYYY-MM-DD." }] });
  }
  return value;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const employeeId = params.get("employeeId");
    if (employeeId !== null && employeeId !== "" && !z.string().uuid().safeParse(employeeId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const rows = await listAttendanceDayRegister(access, {
      employeeId: employeeId === "" ? null : employeeId,
      from: optionalDate(params.get("from"), "from"),
      to: optionalDate(params.get("to"), "to"),
      search: params.get("search") ?? "",
    });
    return collection({
      type: "attendance-day",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/attendance/days/register",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
