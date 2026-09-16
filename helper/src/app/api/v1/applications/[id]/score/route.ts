import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { scoreApplication, scoreApplicationSchema } from "@/server/talent/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const parsed = scoreApplicationSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The assessment payload violates the one-score contract.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await scoreApplication(access, id, parsed.data, requestId);
    return ok({ type: "candidate-match-result", id: result.resultId, version: 1, attributes: result, requestId, self: `/api/v1/applications/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
