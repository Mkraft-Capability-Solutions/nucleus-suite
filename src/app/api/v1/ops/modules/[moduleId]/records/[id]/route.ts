import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { getModuleRecord, updateModuleRecord } from "@/server/ops/modules-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleId: string; id: string }> }
) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { moduleId, id } = await params;
    const record = await getModuleRecord(access, moduleId, id);

    return ok({
      type: "operational-module-record",
      id: record.id,
      version: 1,
      attributes: {
        ...record.values,
        createdAt: record.createdAt,
      },
      requestId,
      self: `/api/v1/ops/modules/${moduleId}/records/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ moduleId: string; id: string }> }
) {
  return handleUpdate(request, params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ moduleId: string; id: string }> }
) {
  return handleUpdate(request, params);
}

async function handleUpdate(
  request: Request,
  paramsPromise: Promise<{ moduleId: string; id: string }>
) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { moduleId, id } = await paramsPromise;
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Payload must be an object.",
      });
    }

    const { id: _ignored, ...payload } = raw as Record<string, unknown>;
    const result = await updateModuleRecord(access, moduleId, id, payload, requestId);

    return ok({
      type: "operational-module-record",
      id: result.id,
      version: 1,
      attributes: result.attributes,
      requestId,
      self: `/api/v1/ops/modules/${moduleId}/records/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
