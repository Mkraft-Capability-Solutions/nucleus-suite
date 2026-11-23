import { createHash } from "node:crypto";
import { z } from "zod";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createShiftAssignment, createShiftAssignmentSchema, listShiftAssignments } from "@/server/attendance/shift-assignment";

export const dynamic = "force-dynamic";

const OPERATION = "attendance.shift_assignment_create";

/** GET lists shift assignments in the caller's attendance scope (attendance.read), optionally for one employee. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = new URL(request.url).searchParams.get("employeeId");
    if (employeeId && !z.string().uuid().safeParse(employeeId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid employee reference.", details: [{ field: "employeeId", issue: "must be a uuid" }] });
    }
    const rows = await listShiftAssignments(access, employeeId || null);
    return collection({
      type: "shift-assignment",
      items: rows.map((row) => ({
        id: row.id,
        version: 1,
        employeeId: row.employee_id,
        shiftId: row.shift_id,
        shiftCode: row.shift_code,
        effectiveDate: row.effective_date,
        reason: row.reason,
        status: row.record_status,
        createdAt: row.created_at,
      })),
      requestId,
      self: "/api/v1/shifts/assignments",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST assigns a master shift to an employee from a date (attendance.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = createShiftAssignmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Invalid shift assignment payload.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, OPERATION, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "shift-assignment", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: "/api/v1/shifts/assignments" });
    }
    const result = await createShiftAssignment(access, parsed.data, requestId);
    await storeIdempotency(access, OPERATION, key, fingerprint, 201, result.id);
    return ok({ type: "shift-assignment", id: result.id, version: 1, attributes: result, requestId, self: "/api/v1/shifts/assignments" });
  } catch (error) {
    return fail(error, requestId);
  }
}
