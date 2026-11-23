import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listTimeOfficeLedger } from "@/server/attendance/time-office-ledger";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function optionalDate(value: string | null, field: string): string | null {
  if (value === null || value.trim() === "") return null;
  if (!DATE.test(value)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid date filter.", details: [{ field, issue: "Expected YYYY-MM-DD." }] });
  }
  return value;
}

/** GET /api/v1/attendance/ledger — time-office recompute ledger for the caller's attendance scope (attendance.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const rawLimit = params.get("limit");
    const limit = rawLimit === null || rawLimit.trim() === "" ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The limit must be a whole number between 1 and 200.", details: [{ field: "limit", issue: "must be an integer between 1 and 200" }] });
    }
    const rows = await listTimeOfficeLedger(access, {
      from: optionalDate(params.get("from"), "from"),
      to: optionalDate(params.get("to"), "to"),
      search: params.get("search") ?? "",
      limit,
    });
    return collection({
      type: "attendance-ledger-row",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/attendance/ledger",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
