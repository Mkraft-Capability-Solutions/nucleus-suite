import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { downloadDocument } from "@/server/organization/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const file = await downloadDocument(access, id);
    return NextResponse.json(
      { data: { type: "document-version", title: file.title, mime: file.mime, sha256: file.sha256, contentBase64: file.content_base64 }, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
