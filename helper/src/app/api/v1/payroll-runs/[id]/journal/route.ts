import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { getJournal, postJournal } from "@/server/payroll/gl";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await getJournal(access, id);
    return NextResponse.json({ data: { type: "payroll-journal", ...result }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    // postJournal is itself idempotent per run and legal entity; the key still guards
    // against a duplicate client submission being treated as a second intent.
    requireIdempotencyKey(request.headers);
    const { id } = await params;
    const result = await postJournal(access, id, requestId);
    return NextResponse.json({ data: { type: "payroll-journal", ...result }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
