import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { runLeaveAccrual } from "@/server/leave/accrual";

export const dynamic = "force-dynamic";

/**
 * RL-07 / RL-08 / RL-09 accrual, on demand.
 *
 * The same engine the scheduled task runs, exposed so the run can be previewed
 * before it is committed and so a tenant without a worker can still close a
 * month. `mode` defaults to preview, which writes nothing.
 */
const bodySchema = z
  .object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    mode: z.enum(["preview", "commit"]).optional(),
    employeeId: z.string().uuid().optional(),
  })
  .refine((input) => input.asOf !== undefined || input.period !== undefined, {
    path: ["period"],
    message: "An accrual run needs either an asOf date or a period.",
  });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The accrual run payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await runLeaveAccrual(access, parsed.data, requestId);
    return ok({
      type: "leave-accrual-run",
      id: `${result.asOf}:${result.mode}`,
      version: 1,
      attributes: result,
      requestId,
      self: "/api/v1/leave/accrual-runs",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
