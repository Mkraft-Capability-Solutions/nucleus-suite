import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { deleteRecord, getRecord, updateRecord } from "@/server/ops-modules/records";
import { idempotent, parseModulePayload } from "@/server/ops-modules/payload";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ moduleId: string; id: string }> };

/** GET one record (404 when missing); PATCH/PUT merge fields into it; DELETE removes it (table modules only). */
export async function GET(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    const { moduleId, id } = await params;
    const access = await requireAccess(request);
    const record = await getRecord(access, moduleId, id);
    return ok({ type: "module-record", id: record.id, version: 1, attributes: record, requestId, self: `/api/v1/ops/modules/${moduleId}/records/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const { moduleId, id } = await params;
    const access = await requireAccess(request);
    const patch = parseModulePayload(moduleId, await request.json().catch(() => null), true);
    const key = request.headers.get("idempotency-key")?.trim();
    const record = key
      ? (await idempotent(access, `ops.module_record_update.${moduleId}.${id}`, key, patch,
        () => updateRecord(access, moduleId, id, patch, requestId),
        () => getRecord(access, moduleId, id))).result
      : await updateRecord(access, moduleId, id, patch, requestId);
    return ok({ type: "module-record", id: record.id, version: 1, attributes: record, requestId, self: `/api/v1/ops/modules/${moduleId}/records/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

export const PUT = PATCH;

export async function DELETE(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const { moduleId, id } = await params;
    const access = await requireAccess(request);
    const result = await deleteRecord(access, moduleId, id, requestId);
    return ok({ type: "module-record", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/ops/modules/${moduleId}/records/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
