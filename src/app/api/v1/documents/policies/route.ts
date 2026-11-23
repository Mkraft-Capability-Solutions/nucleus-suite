import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listPolicyDocuments, MAX_POLICY_BYTES, POLICY_CATEGORIES, POLICY_MIME_TYPES, uploadPolicyDocument, uploadPolicySchema } from "@/server/engagement/policy-documents";
import { parseBody, runOnce } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

const SELF = "/api/v1/documents/policies";

/** GET lists the tenant's policy documents (employee.read); POST uploads a PDF policy (policy.manage, Idempotency-Key). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const result = await listPolicyDocuments(access);
    return NextResponse.json(
      {
        data: result.items.map((item) => ({ type: "policy-document", ...item })),
        meta: { requestId, canManage: result.canManage, categories: POLICY_CATEGORIES, mimeTypes: POLICY_MIME_TYPES, maxBytes: MAX_POLICY_BYTES },
        links: { self: SELF },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const input = parseBody(uploadPolicySchema, await request.json().catch(() => null), "Check the policy details.");
    const outcome = await runOnce(access, "policy.document_upload", key, input, () => uploadPolicyDocument(access, input, requestId));
    const attributes = outcome.result ? { ...outcome.result, replayed: false } : { id: outcome.id, replayed: true };
    return ok({ type: "policy-document", id: outcome.id, version: 1, attributes, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}
