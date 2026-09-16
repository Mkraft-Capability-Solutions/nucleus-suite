import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { decideCoff, decideCoffSchema } from "@/server/leave/service";

export const dynamic = "force-dynamic";

/** FRM-LVE-03: approve or refuse a comp-off claim, recording the approver and the remarks. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = decideCoffSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A decision and remarks of at least 10 characters are required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await decideCoff(access, id, parsed.data, requestId);
    return ok({ type: "coff-grant", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/coff-grants/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
