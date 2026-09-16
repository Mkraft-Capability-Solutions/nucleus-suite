import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listBreakRegister } from "@/server/attendance/break-register";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function optionalDate(value: string | null, field: string): string | null {
  if (value === null || value === "") return null;
  if (!DATE_PATTERN.test(value)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid date filter.", details: [{ field, issue: "Expected YYYY-MM-DD." }] });
  }
  return value;
}

/** RP-01 break register: every derived break for the caller's scope and range. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const employeeId = params.get("employeeId");
    if (employeeId !== null && employeeId !== "" && !z.string().uuid().safeParse(employeeId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const from = optionalDate(params.get("from"), "from");
    const to = optionalDate(params.get("to"), "to");
    if (from !== null && to !== null && from > to) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The from date must not be later than the to date.", details: [{ field: "from", issue: "Not later than to." }] });
    }
    const rows = await listBreakRegister(access, {
      employeeId: employeeId === "" ? null : employeeId,
      from,
      to,
      breakType: params.get("breakType"),
      search: params.get("search") ?? "",
    });
    return collection({
      type: "attendance-break",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/reports/break-register",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
