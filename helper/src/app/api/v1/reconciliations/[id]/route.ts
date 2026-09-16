import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import {
  CHECK_KEYS,
  drillVariance,
  explainVariance,
  explainVarianceSchema,
  getReconciliation,
  type CheckKey,
} from "@/server/payroll/reconciliation";

export const dynamic = "force-dynamic";

/**
 * The one write a reconciliation result accepts is discriminated on `action`.
 * `explain` records why a control does not balance and moves it along
 * open -> explained -> reconciled, with escalation available from either of the
 * first two. Running the reconciliation itself is a POST to the collection.
 */
export const reconciliationActionSchema = z.discriminatedUnion("action", [
  explainVarianceSchema.extend({ action: z.literal("explain") }),
]);

/**
 * Detail, or — with `?drill=<checkKey>` — the RL-531 drill-back: the employees
 * and payslip lines behind that control's figure.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const drill = new URL(request.url).searchParams.get("drill");
    const result = await getReconciliation(access, id);
    if (drill !== null) {
      if (!(CHECK_KEYS as readonly string[]).includes(drill)) {
        throw new HttpError({
          status: 400,
          code: "BAD_REQUEST",
          message: `Unknown reconciliation control. Expected one of: ${CHECK_KEYS.join(", ")}.`,
          details: [{ field: "drill", issue: drill }],
        });
      }
      const drilled = await drillVariance(access, drill as CheckKey, result.runId);
      return NextResponse.json(
        { data: { type: "reconciliation-drill", id, version: 1, ...drilled }, meta: { requestId }, links: { self: `/api/v1/reconciliations/${id}?drill=${drill}` } },
        { headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    }
    return NextResponse.json(
      { data: { type: "reconciliation", version: 1, ...result }, meta: { requestId }, links: { self: `/api/v1/reconciliations/${id}` } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    requireIdempotencyKey(request.headers);
    const parsed = reconciliationActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Provide an action of 'explain' with the control being explained, a disposition and a reason.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const item = await explainVariance(access, parsed.data.itemId, { disposition: parsed.data.disposition, note: parsed.data.note }, requestId);
    return ok({
      type: "reconciliation-item",
      id: item.id,
      version: 1,
      attributes: { ...item },
      requestId,
      self: `/api/v1/reconciliations/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
