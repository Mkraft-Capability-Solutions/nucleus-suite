import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { grantAccessScopes, grantScopeSchema, listAccessScopes } from "@/server/access-scopes/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const items = await listAccessScopes(access, {
      status: params.get("status"),
      search: params.get("search") ?? "",
    });
    return collection({
      type: "access-scope",
      items: items.map((item) => ({ ...item, version: 1 })),
      requestId,
      self: "/api/v1/access-scopes",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Grant one or more role scopes to a member. Consequential write; overlapping grants are rejected. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = grantScopeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The scope grant payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const grants = await grantAccessScopes(access, parsed.data, requestId);
    const first = grants[0];
    if (!first) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "No scopes were granted." });
    return ok({ type: "access-scope", id: first.id, version: 1, attributes: { grants }, requestId, self: `/api/v1/access-scopes/${first.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
