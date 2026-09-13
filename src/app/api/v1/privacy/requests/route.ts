import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { openRightsCase, openRightsSchema } from "@/server/privacy/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = openRightsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The privacy-request payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await openRightsCase(access, parsed.data, requestId);
    return ok({ type: "privacy-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/privacy/requests/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
