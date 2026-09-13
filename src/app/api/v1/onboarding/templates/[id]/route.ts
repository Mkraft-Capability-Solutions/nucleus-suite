import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { updateTemplate, updateTemplateSchema } from "@/server/lifecycle/templates";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = updateTemplateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The template update is invalid." });
    const result = await updateTemplate(access, id, parsed.data, requestId);
    return ok({ type: "onboarding-template", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/onboarding/templates` });
  } catch (error) {
    return fail(error, requestId);
  }
}
