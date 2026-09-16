import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { recordGateScan, recordGateScanSchema } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

/** Security's own out/in scans against an approved pass (FRM-TIM-06, Gate section). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = recordGateScanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A gate scan payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await recordGateScan(access, id, parsed.data, requestId);
    return ok({ type: "gate-pass", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/gate-passes/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
