import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { claimCoff, claimCoffSchema } from "@/server/leave/service";

export const dynamic = "force-dynamic";

/** FRM-LVE-03: raise a comp-off claim against a worked day. Nothing is credited until it is decided. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = claimCoffSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The comp-off claim payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await claimCoff(access, parsed.data, requestId);
    return ok({ type: "coff-grant", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/coff-grants/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
