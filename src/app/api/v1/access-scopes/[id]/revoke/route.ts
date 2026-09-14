import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { revokeAccessScope, revokeScopeSchema } from "@/server/access-scopes/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = revokeScopeSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reason is required to revoke a scope." });
    }
    const result = await revokeAccessScope(access, id, parsed.data.reason, requestId);
    return ok({ type: "access-scope", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/access-scopes/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
