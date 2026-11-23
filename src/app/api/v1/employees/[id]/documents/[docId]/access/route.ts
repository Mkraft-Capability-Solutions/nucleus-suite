import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { issueAccessLink } from "@/server/documents/people";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid(), docId: z.string().uuid() });

/** A 5-minute signed link to view or download one vault document; every link is logged. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const ids = paramsSchema.safeParse(await params);
    if (!ids.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid document reference." });
    const mode = new URL(request.url).searchParams.get("mode") ?? "view";
    if (mode !== "view" && mode !== "download") throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "mode must be view or download.", details: [{ field: "mode", issue: "invalid" }] });
    const link = await issueAccessLink(access, ids.data.id, ids.data.docId, mode, requestId);
    return NextResponse.json({ data: link, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
