import { requireAccess } from "@/server/platform/access";
import { collection, fail, ok, parsePagination, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { assignContractWorker, assignContractWorkerSchema, listContractWorkforce } from "@/server/contractors/workforce";
import { idempotentWrite, parseBody } from "@/server/contractors/write-guard";

export const dynamic = "force-dynamic";

const SELF = "/api/v1/contractors/assignments";

/** GET: one page of the contract worker register (employee.read). Query: page, pageSize (max 100), q. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const url = new URL(request.url);
    const { page, pageSize } = parsePagination(url.searchParams);
    const { items, total } = await listContractWorkforce(access, { page, pageSize, search: url.searchParams.get("q") });
    return collection({
      type: "contract-worker-assignment",
      items: items.map((worker) => ({ ...worker, version: 1 })),
      requestId,
      self: SELF,
      nextCursor: page * pageSize < total ? String(page + 1) : null,
      total,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST: registers a contract worker under an existing contract (employee.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const input = parseBody(assignContractWorkerSchema, await request.json().catch(() => null), "The assignment payload is invalid.");
    const outcome = await idempotentWrite(access, "contractor.worker_assign", key, input, () => assignContractWorker(access, input, requestId));
    const attributes = outcome.kind === "written" ? outcome.result : { replayed: true };
    return ok({ type: "contract-worker-assignment", id: outcome.id, version: 1, attributes, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}
