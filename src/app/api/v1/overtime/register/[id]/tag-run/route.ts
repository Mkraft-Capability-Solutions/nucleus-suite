import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { tagOvertimePayRun, tagPayRunSchema } from "@/server/attendance/overtime-register";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = tagPayRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A payroll run reference and a reason (min 3 characters) are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await tagOvertimePayRun(access, id, parsed.data, requestId);
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
