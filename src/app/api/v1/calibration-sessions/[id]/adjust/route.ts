import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { calibrationAdjustSchema, recordCalibrationAdjustment } from "@/server/performance/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = calibrationAdjustSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reasoned calibration adjustment is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await recordCalibrationAdjustment(access, id, parsed.data, requestId);
    return ok({ type: "calibration-session", id: result.sessionId, version: 1, attributes: result, requestId, self: `/api/v1/calibration-sessions/${result.sessionId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
