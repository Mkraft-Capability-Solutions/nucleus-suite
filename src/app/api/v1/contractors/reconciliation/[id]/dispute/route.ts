import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { disputeInvoice, disputeInvoiceSchema } from "@/server/contractors/reconciliation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = disputeInvoiceSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The variance disposition is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await disputeInvoice(access, id, parsed.data, requestId);
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
