import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireVersion } from "@/server/platform/http";
import { getLocation, locationForm, updateLocation, updateLocationSchema } from "@/server/organization/locations";

export const dynamic = "force-dynamic";

function assertReference(id: string): void {
  if (!z.string().uuid().safeParse(id).success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
  }
}

/** One site, both as stored and in the form's own shape so the edit screen reads back what was saved. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    assertReference(id);
    const item = await getLocation(access, id);
    return ok({ type: "location", id: item.id, version: item.version, attributes: { ...item, form: locationForm(item) }, requestId, self: `/api/v1/organization/locations/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Edit a site. `If-Match` carries the envelope version so two admins cannot overwrite each other. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    assertReference(id);
    const version = requireVersion(request.headers);
    const parsed = updateLocationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The location changes are invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await updateLocation(access, id, version, parsed.data, requestId);
    return ok({ type: "location", id, version: version + 1, attributes: result, requestId, self: `/api/v1/organization/locations/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
