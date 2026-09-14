import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createModuleRecord, createModuleRecordSchema, listModuleRecords } from "@/server/ops/modules-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { moduleId } = await params;
    const urlParams = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(urlParams);

    const { items, total } = await listModuleRecords(access, moduleId, {
      page,
      pageSize,
    });

    return collection({
      type: "operational-module-record",
      items: items.map((item) => ({
        id: item.id,
        version: 1,
        attributes: item.values,
        createdAt: item.createdAt,
      })),
      requestId,
      self: `/api/v1/ops/modules/${moduleId}/records`,
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { moduleId } = await params;
    const key = requireIdempotencyKey(request.headers);

    const raw = await request.json().catch(() => null);
    const parsed = createModuleRecordSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The form payload is invalid.",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          issue: issue.message,
        })),
      });
    }

    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ moduleId, data: parsed.data }))
      .digest("hex");

    const prior = await checkIdempotency(access, `ops.module.${moduleId}`, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({
        status: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "This Idempotency-Key was already used with a different payload.",
      });
    }

    const result = await createModuleRecord(access, moduleId, parsed.data, requestId);
    await storeIdempotency(access, `ops.module.${moduleId}`, key, fingerprint, 201, result.id);

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
