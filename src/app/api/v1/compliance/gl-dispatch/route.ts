import { glTransitionSchema, listGlBatches, transitionGlBatch } from "@/server/compliance/erp-ledger";
import { idempotentWrite, readRoute } from "@/server/compliance/route-support";

export const dynamic = "force-dynamic";

/**
 * GL posting queue.
 * GET  batches with their stored journal lines and computed balance (payroll.accounting.read).
 * POST moves one batch: dispatch (draft → queued, payroll.accounting.write), acknowledge (queued → posted
 *      with the ERP's reference) or reconcile (posted → reconciled), both payroll.accounting.approve.
 *      Idempotency-Key required; an unbalanced batch is refused.
 */
export function GET(request: Request) {
  return readRoute(request, "gl-batches", (access) => listGlBatches(access));
}

export function POST(request: Request) {
  return idempotentWrite(request, {
    operation: "compliance.gl_transition",
    type: "gl-batch",
    schema: glTransitionSchema,
    message: "Check the GL batch action.",
    handle: transitionGlBatch,
  });
}
