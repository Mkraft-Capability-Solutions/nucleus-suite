import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { getRecord, transitionRecord } from "@/server/ops-modules/records";
import { idempotent } from "@/server/ops-modules/payload";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ state: z.string().trim().min(1).max(80).optional(), status: z.string().trim().min(1).max(80).optional() })
  .refine((value) => Boolean(value.state ?? value.status), { message: "A target state is required.", path: ["state"] });

/** PATCH moves a record to one of its module's registry states; audited, write permission enforced. */
export async function PATCH(request: Request, { params }: { params: Promise<{ moduleId: string; id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const { moduleId, id } = await params;
    const access = await requireAccess(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "A target state is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const target = (parsed.data.state ?? parsed.data.status) as string;
    const key = request.headers.get("idempotency-key")?.trim();
    const record = key
      ? (await idempotent(access, `ops.module_record_state.${moduleId}.${id}`, key, { target },
        () => transitionRecord(access, moduleId, id, target, requestId),
        () => getRecord(access, moduleId, id))).result
      : await transitionRecord(access, moduleId, id, target, requestId);
    return ok({ type: "module-record", id: record.id, version: 1, attributes: record, requestId, self: `/api/v1/ops/modules/${moduleId}/records/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
