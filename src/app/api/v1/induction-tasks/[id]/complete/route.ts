import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { completeInductionTask, completeInductionTaskSchema } from "@/server/induction/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = completeInductionTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The completion payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await completeInductionTask(access, id, parsed.data, requestId);
    return ok({ type: "induction-task", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/induction-tasks/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
