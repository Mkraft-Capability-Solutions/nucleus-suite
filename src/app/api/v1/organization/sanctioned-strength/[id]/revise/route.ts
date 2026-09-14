import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { reviseSanctionedStrength, reviseSanctionedStrengthSchema } from "@/server/organization/sanctioned-strength";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = reviseSanctionedStrengthSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A sanctioned figure, approval reference and reason are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await reviseSanctionedStrength(access, id, parsed.data, requestId);
    return ok({
      type: "sanctioned-strength",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/organization/sanctioned-strength/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
