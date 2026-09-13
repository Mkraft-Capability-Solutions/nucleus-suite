import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom } from "@/server/platform/http";
import { listProposals, proposeCompensation, proposeCompSchema } from "@/server/compensation/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await listProposals(access, { cycleId: params.get("cycleId"), page, pageSize });
    return collection({
      type: "compensation-proposal",
      items: (items as Array<Record<string, unknown>>).map((item) => {
        const { id, ...rest } = item as { id: string } & Record<string, unknown>;
        return { id, version: 1, ...rest };
      }),
      requestId,
      self: "/api/v1/compensation/proposals",
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = proposeCompSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The proposal payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await proposeCompensation(access, parsed.data, requestId);
    return ok({ type: "compensation-proposal", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/compensation/proposals` });
  } catch (error) {
    return fail(error, requestId);
  }
}
