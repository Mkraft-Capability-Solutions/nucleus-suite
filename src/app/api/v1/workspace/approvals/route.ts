import { z } from "zod";
import { operationalResources } from "@/lib/operational-catalog";
import { recordLabel } from "@/lib/workflow-catalog";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey, requireVersion } from "@/server/platform/http";
import { operationalApprovals } from "@/server/workflows/approval-inbox";
import { mutateOperationalRecord } from "@/server/workflows/operational-service";

export const dynamic = "force-dynamic";

/** GET: the caller's approval queue (items they may approve, never their own). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const rows = await operationalApprovals(await requireAccess(request));
    const items = rows.slice(0, 100).map((row) => ({
      id: row.id,
      version: row.version,
      resource: row.resource,
      title: recordLabel(row.data),
      status: row.status,
      feature: operationalResources[row.resource].label,
      updatedAt: row.updated_at,
      actions: Object.entries(operationalResources[row.resource].transitions)
        .filter(([, transition]) => transition.approval && transition.from.includes(row.status))
        .map(([name]) => name),
      href: "/" + operationalResources[row.resource].module + "?section=" + encodeURIComponent("operations/" + row.resource),
    }));
    return collection({ type: "approval", items, requestId, self: "/api/v1/workspace/approvals", nextCursor: null });
  } catch (error) {
    return fail(error, requestId);
  }
}

const decisionSchema = z.object({
  resource: z.string().trim().min(1).max(60),
  id: z.string().uuid(),
  decision: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(3, "Give a reason for this decision.").max(1000),
});

/**
 * POST: decide one queue item. Headers: Idempotency-Key and If-Match (the item's version).
 * Runs the record's state machine: permission and data scope, no self-approval, legal transition only, audited.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The decision is not valid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const { resource, id, decision, reason } = parsed.data;
    const definition = Object.hasOwn(operationalResources, resource) ? operationalResources[resource] : undefined;
    const transition = definition?.transitions[decision];
    if (!definition || !transition?.approval) {
      throw new HttpError({ status: 409, code: "INVALID_TRANSITION", message: "This decision is not available for this item." });
    }
    const result = await mutateOperationalRecord(access, resource, {
      id,
      action: decision,
      key: requireIdempotencyKey(request.headers),
      version: requireVersion(request.headers),
      input: { reason },
    });
    return ok({ type: "approval-decision", id: String(result.id), version: Number(result.version), attributes: result, requestId, self: "/api/v1/workspace/approvals" });
  } catch (error) {
    return fail(error, requestId);
  }
}
