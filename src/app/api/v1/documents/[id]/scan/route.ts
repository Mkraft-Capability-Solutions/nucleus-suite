import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { markDocumentScan } from "@/server/organization/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ clean: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A scan verdict (clean true/false) is required." });
    const result = await markDocumentScan(access, id, parsed.data.clean, requestId);
    return ok({ type: "document", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/documents/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
