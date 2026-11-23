import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { getMyPunchDay, recordMyPunch, recordPunchSchema } from "@/server/attendance/self-punch";

export const dynamic = "force-dynamic";

const SELF = "/api/v1/attendance/punches/me";

/** GET: today's punches, state and shift for the caller's own employee record (attendance.self.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const view = await getMyPunchDay(access);
    return ok({ type: "punch-day", id: `${view.employeeId}:${view.workDate}`, version: 1, attributes: view, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * POST: record one punch ({ direction: "in" | "out", remark? }) at the server's clock.
 * attendance.self.write (or attendance.write); Idempotency-Key required, so a retried click never double-punches.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = recordPunchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The punch is not valid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "attendance.self_punch", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    // A replay returns the current day without writing a second punch.
    const view = prior.outcome === "replay" ? await getMyPunchDay(access) : await recordMyPunch(access, parsed.data, requestId);
    if (prior.outcome !== "replay") await storeIdempotency(access, "attendance.self_punch", key, fingerprint, 201, `${view.employeeId}:${view.workDate}`);
    return ok({ type: "punch-day", id: `${view.employeeId}:${view.workDate}`, version: 1, attributes: { ...view, replayed: prior.outcome === "replay" }, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}
