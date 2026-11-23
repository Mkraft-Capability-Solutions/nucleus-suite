import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { isLookupList, listLookup } from "@/server/workspace/lookups";

export const dynamic = "force-dynamic";

/** GET /api/v1/workspace/lookups/{roles|document-types}?search= — tenant reference lists for action forms. */
export async function GET(request: Request, context: { params: Promise<{ list: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { list } = await context.params;
    if (!isLookupList(list)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Unknown reference list." });
    const items = await listLookup(access, list, new URL(request.url).searchParams.get("search") ?? "");
    return collection({ type: list, items: items.map((item) => ({ ...item, version: 1 })), requestId, self: `/api/v1/workspace/lookups/${list}`, nextCursor: null });
  } catch (error) {
    return fail(error, requestId);
  }
}
