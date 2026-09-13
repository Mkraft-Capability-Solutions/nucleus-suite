import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createBand, createBandSchema } from "@/server/compensation/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createBandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The band payload is invalid." });
    const result = await createBand(access, parsed.data);
    return ok({ type: "compensation-band", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/compensation/bands` });
  } catch (error) {
    return fail(error, requestId);
  }
}
