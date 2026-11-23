import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { submitTimesheetSchema, submitWeeklyTimesheet } from "@/server/attendance/timesheet-submission";

export const dynamic = "force-dynamic";

const OPERATION = "attendance.timesheet_submit";

/**
 * POST submits one employee-week. Hours are summed on the server from the computed attendance days; the client
 * sends only the week and optional notes (attendance.write, Idempotency-Key required).
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = submitTimesheetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Invalid timesheet submission payload.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, OPERATION, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "timesheet-submission", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: `/api/v1/attendance/timesheets/${prior.responseLocator}` });
    }
    const result = await submitWeeklyTimesheet(access, parsed.data, requestId);
    await storeIdempotency(access, OPERATION, key, fingerprint, 201, result.id);
    return ok({ type: "timesheet-submission", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/attendance/timesheets/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
