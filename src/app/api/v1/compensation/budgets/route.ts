import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createBudget, createBudgetSchema } from "@/server/compensation/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createBudgetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The budget payload is invalid." });
    const result = await createBudget(access, parsed.data);
    return ok({ type: "compensation-budget", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/compensation/budgets` });
  } catch (error) {
    return fail(error, requestId);
  }
}
