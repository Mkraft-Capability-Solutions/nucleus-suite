import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createCalibrationSession, createCalibrationSchema } from "@/server/performance/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createCalibrationSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The calibration payload is invalid." });
    const result = await createCalibrationSession(access, parsed.data);
    return ok({ type: "calibration-session", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/calibration-sessions/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
