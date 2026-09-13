import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createAgency, createAgencySchema } from "@/server/contractors/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createAgencySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The agency payload is invalid." });
    const result = await createAgency(access, parsed.data);
    return ok({ type: "contractor-organization", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/contractors/agencies` });
  } catch (error) {
    return fail(error, requestId);
  }
}
