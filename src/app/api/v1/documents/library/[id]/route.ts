import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { deleteFromLibrary, deleteSchema } from "@/server/documents/library";

export const dynamic = "force-dynamic";

/** Delete a document: the file is removed, the record of it stays in the audit trail. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid document reference." });
    const body = deleteSchema.safeParse((await request.json().catch(() => ({}))) ?? {});
    if (!body.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The reason is too long." });
    const result = await deleteFromLibrary(access, id, body.data.reason, requestId);
    return NextResponse.json({ data: result, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
