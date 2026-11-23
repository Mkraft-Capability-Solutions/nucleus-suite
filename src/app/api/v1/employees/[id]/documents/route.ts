import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listEmployeeDocuments, uploadEmployeeDocument, vaultUploadSchema } from "@/server/documents/people";

export const dynamic = "force-dynamic";

const headers = (requestId: string) => ({ "cache-control": "no-store", "x-request-id": requestId });

async function employeeIdOf(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid employee reference." });
  return id;
}

/** One person's vault documents (document.read, or document.self.read for one's own folder). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const folder = await listEmployeeDocuments(access, await employeeIdOf(params));
    return NextResponse.json({ data: folder, meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Upload to a person's vault (document.write / document.self.write; Idempotency-Key required). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const employeeId = await employeeIdOf(params);
    const key = requireIdempotencyKey(request.headers);
    const parsed = vaultUploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Check the highlighted fields.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ employeeId, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "documents.vault_upload", key, fingerprint);
    if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    if (prior.outcome === "replay" && prior.responseLocator) {
      return NextResponse.json({ data: { id: prior.responseLocator, replayed: true }, meta: { requestId } }, { status: 200, headers: headers(requestId) });
    }
    const created = await uploadEmployeeDocument(access, employeeId, parsed.data, requestId);
    await storeIdempotency(access, "documents.vault_upload", key, fingerprint, 201, created.id);
    return NextResponse.json({ data: created, meta: { requestId } }, { status: 201, headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
