import { z } from "zod";
import { picklistValues } from "@/lib/picklists";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { quoteEncashment } from "@/server/leave/encashment";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(picklistValues("PL_LEAVE_TYPE")),
  days: z.coerce.number().positive().max(9999.9).optional(),
});

/** FRM-LVE-04's derived fields: current balance, the ceiling, the rate basis and the indicative amount. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      employeeId: params.get("employeeId") ?? "",
      leaveType: params.get("leaveType") ?? "",
      days: params.get("days") || undefined,
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "An employee and a leave type are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const quote = await quoteEncashment(access, {
      employeeId: parsed.data.employeeId,
      leaveType: parsed.data.leaveType,
      daysToEncash: parsed.data.days ?? null,
    });
    return ok({
      type: "leave-encashment-quote",
      id: `${quote.employeeId}:${quote.leaveTypeCode}`,
      version: 1,
      attributes: quote,
      requestId,
      self: `/api/v1/leave/encashments/quote?employeeId=${quote.employeeId}&leaveType=${quote.leaveType}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
