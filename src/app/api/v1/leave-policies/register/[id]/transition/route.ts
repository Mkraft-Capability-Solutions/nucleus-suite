import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { transitionLeavePolicy, transitionLeavePolicySchema } from "@/server/leave/policy-register";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = transitionLeavePolicySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A transition and a reason (min 3 characters) are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await transitionLeavePolicy(access, id, parsed.data, requestId);
    return ok({
      type: "leave-policy",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/leave-policies/register/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
