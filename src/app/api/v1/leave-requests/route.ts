import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listLeaveRequests, requestLeave, requestLeaveSchema } from "@/server/leave/service";
import { annotateLeaveRequest, assertLeaveRequestAllowed, leaveSubmissionExtrasSchema } from "@/server/leave/request-guards";
import { issueDetails } from "@/server/leave/idempotent-write";
import { ownScope } from "@/server/leave/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    // Employees see only their own requests; HR and approvers may filter by any employee.
    const scope = ownScope(access);
    const { items, total } = await listLeaveRequests(access, {
      employeeId: scope ?? params.get("employeeId"),
      status: params.get("status"),
      page,
      pageSize,
    });
    return collection({
      type: "leave-request",
      items: (items as Array<Record<string, unknown>>).map((item) => {
        const { id, ...rest } = item as { id: string } & Record<string, unknown>;
        return { id, version: 1, ...rest };
      }),
      requestId,
      self: "/api/v1/leave-requests",
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * Submits a leave request. Before the legacy submit service runs, the request
 * is checked for applicant scope, overlap (INV-LEV-02) and balance
 * (INV-LEV-01); the contact and half-day session are stored on the request.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const body = await request.json().catch(() => null);
    const parsed = requestLeaveSchema.safeParse(body);
    const extras = leaveSubmissionExtrasSchema.safeParse(body ?? {});
    if (!parsed.success || !extras.success) {
      const issues = [...(parsed.success ? [] : parsed.error.issues), ...(extras.success ? [] : extras.error.issues)];
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The leave payload is invalid.", details: issueDetails(issues) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ ...parsed.data, ...extras.data })).digest("hex");
    const prior = await checkIdempotency(access, "leave.submit", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "leave-request", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: `/api/v1/leave-requests/register/${prior.responseLocator}` });
    }
    const employee = await assertLeaveRequestAllowed(access, parsed.data, extras.data.halfDaySession);
    const result = await requestLeave(access, { ...parsed.data, employeeId: employee.id }, requestId);
    await annotateLeaveRequest(access, result.id, extras.data);
    await storeIdempotency(access, "leave.submit", key, fingerprint, 201, result.id);
    return ok({ type: "leave-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave-requests/register/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
