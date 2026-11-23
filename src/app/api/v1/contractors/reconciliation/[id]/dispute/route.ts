import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { disputeInvoice, disputeInvoiceSchema } from "@/server/contractors/reconciliation";
import { idempotentWrite } from "@/server/contractors/write-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = disputeInvoiceSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The variance disposition is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const outcome = await idempotentWrite(access, `contractor.invoice_dispute:${id}`, key, parsed.data, () => disputeInvoice(access, id, parsed.data, requestId));
    const result = outcome.kind === "written" ? outcome.result : { id: outcome.id, replayed: true };
    return ok({
      type: "contractor-reconciliation",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/contractors/reconciliation/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
