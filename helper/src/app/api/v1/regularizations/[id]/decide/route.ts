import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { decideRegularization, decideRegularizationSchema } from "@/server/attendance/regularizations";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = decideRegularizationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A decision (approve true/false) is required, with remarks on a rejection.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    const result = await decideRegularization(access, id, parsed.data, requestId);
    return ok({ type: "attendance-regularization", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/regularizations` });
  } catch (error) {
    return fail(error, requestId);
  }
}
