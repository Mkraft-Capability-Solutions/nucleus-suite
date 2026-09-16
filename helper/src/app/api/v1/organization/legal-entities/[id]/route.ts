import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { getLegalEntity, legalEntityForm, updateLegalEntity, updateLegalEntitySchema } from "@/server/organization/legal-entities";

export const dynamic = "force-dynamic";

function assertReference(id: string): void {
  if (!z.string().uuid().safeParse(id).success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
  }
}

/** One entity, both as stored and in the form's own shape so the edit screen reads back what was saved. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    assertReference(id);
    const item = await getLegalEntity(access, id);
    return ok({ type: "legal-entity", id: item.id, version: item.version, attributes: { ...item, form: legalEntityForm(item) }, requestId, self: `/api/v1/organization/legal-entities/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Edit an entity. The code and currency are refused once a payroll run refers to the entity. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    assertReference(id);
    const parsed = updateLegalEntitySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The legal entity changes are invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await updateLegalEntity(access, id, parsed.data, requestId);
    return ok({ type: "legal-entity", id, version: 1, attributes: result, requestId, self: `/api/v1/organization/legal-entities/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
