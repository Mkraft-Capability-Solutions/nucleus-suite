import { requireAccess } from "@/server/platform/access";
import { collection, fail, ok, parsePagination, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createRecord, getRecord, listRecords } from "@/server/ops-modules/records";
import { idempotent, parseModulePayload } from "@/server/ops-modules/payload";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ moduleId: string }> };

/** GET lists a module's records (paginated, optional ?search=); POST creates one (Idempotency-Key required). */
export async function GET(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    const { moduleId } = await params;
    const access = await requireAccess(request);
    const searchParams = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(searchParams);
    const { items, total } = await listRecords(access, moduleId, { page, pageSize, search: searchParams.get("search") });
    return collection({
      type: "module-record",
      items: items.map((item) => ({ ...item, version: 1 })),
      requestId,
      self: `/api/v1/ops/modules/${moduleId}/records`,
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
      total,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const { moduleId } = await params;
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const payload = parseModulePayload(moduleId, await request.json().catch(() => null), false);
    const { result, replayed } = await idempotent(
      access, `ops.module_record_create.${moduleId}`, key, payload,
      () => createRecord(access, moduleId, payload, requestId),
      (id) => getRecord(access, moduleId, id),
    );
    return ok({ type: "module-record", id: result.id, version: 1, attributes: { ...result, replayed }, requestId, self: `/api/v1/ops/modules/${moduleId}/records/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
