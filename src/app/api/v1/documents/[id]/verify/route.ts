import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { verifyDocument, verifyDocumentSchema } from "@/server/documents/vault";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = verifyDocumentSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A verification decision and reason are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await verifyDocument(access, id, parsed.data, requestId);
    return ok({
      type: "document-vault",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/documents/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
