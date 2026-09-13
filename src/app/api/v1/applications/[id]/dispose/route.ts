import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { disposeApplication, disposeApplicationSchema } from "@/server/talent/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = disposeApplicationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reasoned human disposition is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await disposeApplication(access, id, parsed.data, requestId);
    return ok({ type: "candidate-match-disposition", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/applications/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
