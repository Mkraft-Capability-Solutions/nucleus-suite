import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { decideEncashmentSchema } from "@/server/leave/encashment-rules";
import { decideEncashment } from "@/server/leave/encashment";

export const dynamic = "force-dynamic";

/** FRM-LVE-04 "Approver / decision" (PL_DECISION). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = decideEncashmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A decision is required, with remarks on anything but an approval.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await decideEncashment(access, id, parsed.data, requestId);
    return ok({ type: "leave-encashment", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave/encashments/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
