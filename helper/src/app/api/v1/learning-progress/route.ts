import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import {
  defineCourseCertification,
  learningProgressCommandSchema,
  readLearningProgress,
  recordCourseCompletion,
} from "@/server/learning/progress";

export const dynamic = "force-dynamic";

/**
 * SCR-063 — the Learning & Development screen projection: course cards with
 * cohort completion, enrollment state, certification linkage and the analytics
 * that are actually computable from recorded data. Per-learner progress
 * percentages are returned as null with `progressTracked: false`, because no
 * progress signal exists to compute them from.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const projection = await readLearningProgress(access);
    return ok({
      type: "learning-progress",
      id: access.tenantId,
      version: 1,
      attributes: { ...projection },
      requestId,
      self: "/api/v1/learning-progress",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * Two commands, both consequential and both idempotency-keyed:
 * - `complete` verifies the enrollment through the existing learning service
 *   transition and then issues the course's certification, if it defines one.
 * - `define_certification` records the certification a course awards. Nothing
 *   else in the system writes `certifications`, so without it no course can
 *   ever award a certificate.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = learningProgressCommandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The learning progress command is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const command = parsed.data;
    const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    const operation = `learning.${command.action}`;
    const prior = await checkIdempotency(access, operation, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }

    if (command.action === "define_certification") {
      const result = await defineCourseCertification(access, command);
      if (prior.outcome === "accept") await storeIdempotency(access, operation, key, fingerprint, 200, result.id);
      return ok({
        type: "certification",
        id: result.id,
        version: 1,
        attributes: { ...result, courseCode: command.courseCode },
        requestId,
        self: "/api/v1/learning-progress",
      });
    }

    const result = await recordCourseCompletion(access, command, requestId);
    if (prior.outcome === "accept") await storeIdempotency(access, operation, key, fingerprint, 200, result.enrollmentId);
    return ok({
      type: "learning-completion",
      id: result.completionId,
      version: 1,
      attributes: { ...result },
      requestId,
      self: "/api/v1/learning-progress",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
