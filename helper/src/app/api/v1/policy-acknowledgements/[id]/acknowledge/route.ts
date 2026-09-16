import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { acknowledgePolicy, acknowledgePolicySchema } from "@/server/engagement/policy-acknowledgements";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const parsed = acknowledgePolicySchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The acknowledgement comment must be 500 characters or fewer." });
    }
    const result = await acknowledgePolicy(access, id, parsed.data, requestId);
    return ok({
      type: "policy-acknowledgement",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/policy-acknowledgements/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
