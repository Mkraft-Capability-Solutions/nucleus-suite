import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { computeMci, computeMciSchema } from "@/server/analytics/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = computeMciSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "MCI inputs must be 0-100 across all five dimensions." });
    const result = await computeMci(access, parsed.data, requestId);
    return ok({ type: "capability-index-run", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/analytics/capability-index/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
