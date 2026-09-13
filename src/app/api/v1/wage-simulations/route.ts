import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { simulateWageBase } from "@/server/payroll/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ basicMinor: z.number().int().min(0), dearnessMinor: z.number().int().min(0), scenario: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Wage inputs and a scenario name are required." });
    const result = await simulateWageBase(access, parsed.data, requestId);
    return ok({ type: "wage-simulation", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/wage-simulations/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
