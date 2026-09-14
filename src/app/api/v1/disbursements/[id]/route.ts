import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { bankReturnSchema, getBatch, recordBankReturn, verifyBatch, verifyBatchSchema } from "@/server/payroll/disbursement";

export const dynamic = "force-dynamic";

/**
 * The two non-release writes a batch accepts are discriminated on `action`:
 * `verify` records the out-of-band verification that release depends on, and
 * `record-return` posts the bank's return file. Release is deliberately a
 * separate, privileged endpoint.
 */
export const batchActionSchema = z.discriminatedUnion("action", [
  verifyBatchSchema.extend({ action: z.literal("verify") }),
  bankReturnSchema.extend({ action: z.literal("record-return") }),
]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await getBatch(access, id);
    return NextResponse.json(
      { data: { type: "disbursement-batch", version: 1, ...result }, meta: { requestId }, links: { self: `/api/v1/disbursements/${id}` } },
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
    const parsed = batchActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Provide an action of 'verify' (with an out-of-band reference) or 'record-return' (with a return file reference and the failed items).",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result =
      parsed.data.action === "verify"
        ? await verifyBatch(access, id, { outOfBandVerified: true, outOfBandReference: parsed.data.outOfBandReference, remarks: parsed.data.remarks }, requestId)
        : await recordBankReturn(access, id, { returnFileReference: parsed.data.returnFileReference, items: parsed.data.items }, requestId);
    return ok({ type: "disbursement-batch", id, version: 1, attributes: { ...result }, requestId, self: `/api/v1/disbursements/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
