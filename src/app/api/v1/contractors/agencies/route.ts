import { requireAccess } from "@/server/platform/access";
import { collection, fail, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createAgencyRecord, createAgencySchema, listAgencyMaster } from "@/server/contractors/agency-master";
import { idempotentWrite, parseBody } from "@/server/contractors/write-guard";

export const dynamic = "force-dynamic";

const SELF = "/api/v1/contractors/agencies";

/** GET: staffing vendor master with contract/worker counts and the latest PF and ESIC evidence (employee.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listAgencyMaster(access);
    return collection({ type: "contractor-organization", items: rows.map((row) => ({ ...row, version: 1 })), requestId, self: SELF, nextCursor: null, total: rows.length });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST: creates an agency (employee.write, Idempotency-Key required, audited). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const input = parseBody(createAgencySchema, await request.json().catch(() => null), "The agency payload is invalid.");
    const outcome = await idempotentWrite(access, "contractor.agency_create", key, input, () => createAgencyRecord(access, input, requestId));
    const attributes = outcome.kind === "written" ? outcome.result : { replayed: true };
    return ok({ type: "contractor-organization", id: outcome.id, version: 1, attributes, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}
