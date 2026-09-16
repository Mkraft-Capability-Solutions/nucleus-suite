import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { approveOvertime, approveOvertimeSchema } from "@/server/attendance/overtime-register";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = approveOvertimeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A reason is required, and a reduction must state why the payable minutes were cut.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await approveOvertime(access, id, parsed.data, requestId);
    return ok({
      type: "overtime-entry",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/overtime/register/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
