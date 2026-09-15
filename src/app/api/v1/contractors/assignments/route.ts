import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { assignWorker, assignWorkerSchema, listContractWorkers } from "@/server/contractors/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const workers = await listContractWorkers(access);
    return collection({
      type: "contract-worker-assignment",
      items: workers.map((w) => ({
        id: w.id,
        version: 1,
        attributes: w,
        createdAt: w.startsOn,
      })),
      requestId,
      self: `/api/v1/contractors/assignments`,
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = assignWorkerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The assignment payload is invalid.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }
    const result = await assignWorker(access, parsed.data);
    return ok({ type: "contract-worker-assignment", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/contractors/assignments` });
  } catch (error) {
    return fail(error, requestId);
  }
}

