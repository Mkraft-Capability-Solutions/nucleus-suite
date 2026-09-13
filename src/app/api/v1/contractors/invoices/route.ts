import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listInvoices, submitInvoice, submitInvoiceSchema } from "@/server/contractors/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const invoices = await listInvoices(access, new URL(request.url).searchParams.get("contractId"));
    return NextResponse.json({ data: invoices, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = submitInvoiceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The invoice payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await submitInvoice(access, parsed.data);
    return ok({ type: "contractor-invoice", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/contractors/invoices` });
  } catch (error) {
    return fail(error, requestId);
  }
}
