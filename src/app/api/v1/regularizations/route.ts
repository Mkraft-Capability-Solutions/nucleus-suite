import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createRegularization, createRegularizationSchema, listRegularizationQueue } from "@/server/attendance/regularization-workflow";

export const dynamic = "force-dynamic";

const OPERATION = "attendance.regularization_create";

/** GET lists regularizations in the caller's attendance scope (attendance.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listRegularizationQueue(access);
    return collection({
      type: "attendance-regularization",
      items: rows.map((row) => ({
        id: row.id,
        version: 1,
        attendanceEntryId: row.attendance_entry_id,
        employeeId: row.employee_id,
        employeeCode: row.employee_code,
        employeeName: row.employee_name ?? row.employee_code,
        date: row.date,
        kind: row.kind,
        reason: row.reason,
        claimedIn: row.claimed_in,
        claimedOut: row.claimed_out,
        status: row.status,
        remarks: row.remarks,
        createdAt: row.created_at,
      })),
      requestId,
      self: "/api/v1/regularizations",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST raises a regularization (attendance.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = createRegularizationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The regularization payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, OPERATION, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "attendance-regularization", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: "/api/v1/regularizations" });
    }
    const result = await createRegularization(access, parsed.data, requestId);
    await storeIdempotency(access, OPERATION, key, fingerprint, 201, result.id);
    return ok({ type: "attendance-regularization", id: result.id, version: 1, attributes: result, requestId, self: "/api/v1/regularizations" });
  } catch (error) {
    return fail(error, requestId);
  }
}
