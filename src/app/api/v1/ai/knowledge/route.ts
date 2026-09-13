import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { ingestKnowledge, ingestKnowledgeSchema, searchKnowledge } from "@/server/ai/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const results = await searchKnowledge(access, params.get("q") ?? "", Number(params.get("limit") ?? "3"));
    return NextResponse.json({ data: results, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = ingestKnowledgeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The knowledge payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await ingestKnowledge(access, parsed.data, requestId);
    return ok({ type: "knowledge-document", id: result.knowledgeId, version: 1, attributes: result, requestId, self: `/api/v1/ai/knowledge` });
  } catch (error) {
    return fail(error, requestId);
  }
}
