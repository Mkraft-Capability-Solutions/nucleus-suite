import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listPunchRegister } from "@/server/attendance/punch-register";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const date = params.get("date");
    if (date !== null && date !== "" && !DATE_PATTERN.test(date)) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid date filter." });
    }
    const rows = await listPunchRegister(access, { search: params.get("search") ?? "", date });
    return collection({
      type: "attendance-punch",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/attendance/punches/register",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
