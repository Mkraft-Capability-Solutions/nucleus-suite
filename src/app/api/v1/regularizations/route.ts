import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listRegularizations, requestRegularization, requestRegularizationSchema } from "@/server/attendance/regularizations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listRegularizations(access);
    return collection({
      type: "attendance-regularization",
      items: items.map((item) => ({
        id: item.id,
        version: 1,
        attendanceEntryId: item.attendance_entry_id,
        employeeCode: item.employee_code,
        employeeName: `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.employee_code,
        date: (item.attributes as any)?.date,
        kind: (item.attributes as any)?.kind,
        reason: (item.attributes as any)?.reason,
        claimedIn: (item.attributes as any)?.claimed_in,
        claimedOut: (item.attributes as any)?.claimed_out,
        status: (item.attributes as any)?.status || "submitted",
        createdAt: item.created_at,
        attributes: item.attributes,
      })),
      requestId,
      self: "/api/v1/regularizations",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = requestRegularizationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The regularization payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await requestRegularization(access, parsed.data, requestId);
    return ok({ type: "attendance-regularization", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/regularizations` });
  } catch (error) {
    return fail(error, requestId);
  }
}

