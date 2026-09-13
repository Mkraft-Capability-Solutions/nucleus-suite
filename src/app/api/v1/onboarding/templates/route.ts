import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createTemplate, createTemplateSchema, listTemplates } from "@/server/lifecycle/templates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const templates = await listTemplates(access, new URL(request.url).searchParams.get("archived") === "true");
    return NextResponse.json({ data: templates, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createTemplateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The template payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createTemplate(access, parsed.data, requestId);
    return ok({ type: "onboarding-template", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/onboarding/templates` });
  } catch (error) {
    return fail(error, requestId);
  }
}
