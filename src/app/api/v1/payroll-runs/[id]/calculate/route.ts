import { z } from "zod";
import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { calculateRun } from "@/server/payroll/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ employeeIds: z.array(z.string().uuid()).max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const key = requireIdempotencyKey(request.headers);
    const parsed = bodySchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The calculation payload is invalid." });
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "payroll.calculate", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await calculateRun(access, id, parsed.data.employeeIds, requestId);
    await storeIdempotency(access, "payroll.calculate", key, fingerprint, 200, id);
    return ok({ type: "payroll-run", id, version: 1, attributes: result, requestId, self: `/api/v1/payroll-runs/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
