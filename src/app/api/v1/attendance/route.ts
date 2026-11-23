import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/attendance — target of the workspace "Set up biometric sign in" action (`action: "biometric"`).
 *
 * Biometric sign-in enrolment (Voice ID / Face Match bound to a device) needs a credential store, and no table in
 * the schema can hold one: `biometric_devices` registers attendance terminals per location, not a person's
 * sign-in factor. Rather than 404 or a fabricated success, the request is authenticated and validated, then
 * answered with an explicit 501 so the UI can show why the enrolment did not happen. Punches are ingested at
 * POST /api/v1/attendance/punches.
 */
const biometricSchema = z.object({
  action: z.literal("biometric"),
  method: z.string().trim().min(1).max(40),
  deviceName: z.string().trim().min(1).max(120),
  recoveryEmail: z.email(),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    await requireAccess(request);
    const parsed = biometricSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The biometric set-up request is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    throw new HttpError({
      status: 501,
      code: "NOT_IMPLEMENTED",
      message: "Biometric sign-in enrolment is not available yet: there is no secure credential store for it. Nothing was saved.",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
